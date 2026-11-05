import type {PublicJob} from '../model.ts';
import {retryTransient} from '../http.ts';
import {dateInSpain} from '../normalize.ts';
import type {CityResolver} from './bizneo.ts';
import {approximateMunicipalNote} from './shared.ts';

export const elCorteInglesListingUrl='https://empleo.elcorteingles.es/ep/ofertas';
const listingEndpoint='https://empleo.elcorteingles.es/ep/api/job-requisitions/obtain';
const workdaySiteHost='wd3.myworkdaysite.com';
const sourceId='elcorteingles-oficial';
const sourceLabel='El Corte Inglés · portal oficial';
const defaultPageSize=100;
const maxOffers=1000;
const maxPages=10;

interface ListedOffer {
  readonly id:string;
  readonly title:string;
  readonly location:string;
  readonly areas:readonly string[];
  readonly employeeType:string;
  readonly timeType:string;
  readonly externalUrl:string;
}

interface ListingPage {
  readonly total:number;
  readonly offers:ListedOffer[];
}

class SnapshotChangedError extends TypeError {}

function record(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Respuesta El Corte Inglés inválida');
  return value as Record<string,unknown>;
}

function text(value:unknown):string {
  return typeof value==='string'?value.trim():'';
}

function normalizedSpace(value:unknown):string {
  return text(value).replace(/\s+/g,' ');
}

function officialUrl(value:unknown,id:string):string {
  const raw=text(value);
  const url=new URL(raw);
  const prefix='/recruiting/elcorteingles/Ext';
  const expectedSuffix=new RegExp(`_${id}(?:-\\d+)?$`);
  if(url.protocol!=='https:'||url.hostname!==workdaySiteHost||url.port||url.username||url.password||url.search||url.hash||
    !url.pathname.startsWith(`${prefix}/job/`)||!expectedSuffix.test(url.pathname)) throw new TypeError('URL El Corte Inglés no autorizada');
  return url.href;
}

export function parseElCorteInglesListing(input:unknown,page:number):ListingPage {
  if(!Number.isSafeInteger(page)||page<0) throw new TypeError('Página El Corte Inglés inválida');
  const payload=record(input);
  if(!Number.isSafeInteger(payload.total_results)||Number(payload.total_results)<0||Number(payload.total_results)>maxOffers||
    !Array.isArray(payload.job_requisitions)) throw new TypeError('Listado El Corte Inglés inválido');
  const offers=payload.job_requisitions.map(value=>{
    const item=record(value);
    const id=text(item.job_requisition_id).toUpperCase();
    const title=normalizedSpace(item.job_posting_title);
    const location=text(item.job_location_name);
    if(!/^JR\d{4,12}$/.test(id)||!title||!location||!Array.isArray(item.job_areas)||
      !item.job_areas.every(area=>typeof area==='string'&&area.trim())) throw new TypeError('Oferta El Corte Inglés incompleta');
    const externalUrl=officialUrl(item.external_url,id);
    const apply=text(item.job_apply_url);
    if(apply&&apply!==`${externalUrl}/apply`) throw new TypeError('URL de solicitud El Corte Inglés no autorizada');
    return {id,title,location,areas:item.job_areas.map(area=>(area as string).trim()),
      employeeType:text(item.job_employee_type),timeType:text(item.job_time_type),externalUrl};
  });
  if(new Set(offers.map(offer=>offer.id)).size!==offers.length) throw new TypeError('ID El Corte Inglés repetido');
  return {total:Number(payload.total_results),offers};
}

function categoryFor(areas:readonly string[]):Pick<PublicJob,'category'|'categoryLabel'> {
  const joined=areas.join(' ');
  if(/IT|e-commerce|tecnolog/i.test(joined)) return {category:'tecnologia',categoryLabel:'Tecnología y consultoría'};
  if(/viajes|turismo/i.test(joined)) return {category:'hosteleria',categoryLabel:'Turismo y hostelería'};
  if(/logística|almacén/i.test(joined)) return {category:'transporte',categoryLabel:'Transporte y logística'};
  return {category:'servicios',categoryLabel:'Servicios y comercio'};
}

/** The official Spain-filtered listing is the source of truth: Workday currently serves only an SPA shell. */
export function adaptElCorteInglesListing(offer:ListedOffer,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const remote=/remot|teletrabajo/i.test(`${offer.title} ${offer.location}`);
  const internalCode=/^\d{5,}$/.test(offer.location)||/work\s*space/i.test(offer.location);
  const resolved=remote||internalCode?null:resolveCity(offer.location);
  const paragraphs=[
    ...(offer.employeeType?[`Tipo de empleo: ${offer.employeeType}.`]:[]),
    ...(offer.timeType?[`Jornada: ${offer.timeType}.`]:[]),
  ];
  return {kind:'job',sourceId,source:sourceLabel,id:`ELCORTEINGLES-${offer.id}`,title:offer.title,
    employer:'El Corte Inglés',city:internalCode?'Sin localidad verificada':offer.location,
    province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
    ...categoryFor(offer.areas),regime:remote?'Remoto':'Oferta de empleo',places:null,paragraphs,
    sourceUrl:offer.externalUrl,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null};
}

async function postListing(page:number,size:number,fetchImpl:typeof fetch):Promise<unknown> {
  const url=new URL(listingEndpoint);
  url.searchParams.set('page',String(page));
  url.searchParams.set('size',String(size));
  const filters={location:[],contract_type:[],department:[],company:[],campaign:false,new_talent:false,
    is_fp_offers:false,employment_type:[],search_term:'',country:['ES']};
  const response=await fetchImpl(url,{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify(filters),
    redirect:'error',signal:AbortSignal.timeout(40_000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  if(!response.headers.get('content-type')?.toLowerCase().includes('json')) throw new TypeError('El Corte Inglés no devolvió JSON');
  const body=await response.text();
  if(body.length>4_000_000) throw new TypeError('Respuesta El Corte Inglés demasiado grande');
  return JSON.parse(body);
}

async function fetchSnapshot(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch,pageSize:number):Promise<PublicJob[]> {
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>defaultPageSize) throw new TypeError('Tamaño de página El Corte Inglés inválido');
  const found=new Map<string,ListedOffer>();
  let expected:number|null=null;
  for(let page=0;page<maxPages&&(expected===null||found.size<expected);page++){
    const parsed=parseElCorteInglesListing(await retryTransient(()=>postListing(page,pageSize,fetchImpl)),page);
    if(expected===null){
      if(parsed.total<1) throw new TypeError('Listado El Corte Inglés vacío');
      expected=parsed.total;
    } else if(parsed.total!==expected) throw new SnapshotChangedError('Listado El Corte Inglés cambió durante la captura');
    if(!parsed.offers.length) throw new SnapshotChangedError('Página El Corte Inglés vacía');
    for(const offer of parsed.offers){
      if(found.has(offer.id)) throw new SnapshotChangedError('ID El Corte Inglés repetido entre páginas');
      found.set(offer.id,offer);
    }
  }
  if(expected===null||found.size!==expected) throw new SnapshotChangedError('Paginación El Corte Inglés incompleta');
  const jobs=[...found.values()].map(offer=>adaptElCorteInglesListing(offer,checkedAt,resolveCity));
  if(!jobs.length) throw new TypeError('No hay ofertas españolas de El Corte Inglés');
  return jobs;
}

export async function fetchElCorteInglesOffers(
  checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch,pageSize=defaultPageSize,
):Promise<PublicJob[]> {
  try{return await fetchSnapshot(checkedAt,resolveCity,fetchImpl,pageSize);}
  catch(error){
    if(!(error instanceof SnapshotChangedError)) throw error;
    return fetchSnapshot(checkedAt,resolveCity,fetchImpl,pageSize);
  }
}
