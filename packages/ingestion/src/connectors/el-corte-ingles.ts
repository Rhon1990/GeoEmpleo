import type {PublicJob} from '../model.ts';
import {dateInSpain,htmlToParagraphs} from '../normalize.ts';
import {fetchJson} from '../http.ts';
import type {CityResolver} from './bizneo.ts';
import {approximateMunicipalNote} from './shared.ts';

export const elCorteInglesListingUrl='https://empleo.elcorteingles.es/ep/ofertas';
const listingEndpoint='https://empleo.elcorteingles.es/ep/api/job-requisitions/obtain';
const workdaySiteHost='wd3.myworkdaysite.com';
const workdayApiBase='https://wd3.myworkdayjobs.com/wday/cxs/elcorteingles/Ext';
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
  readonly path:string;
}

interface ListingPage {
  readonly total:number;
  readonly offers:ListedOffer[];
}

function record(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Respuesta El Corte Inglés inválida');
  return value as Record<string,unknown>;
}

function text(value:unknown):string {
  return typeof value==='string'?value.trim():'';
}

function officialPath(value:unknown,id:string):{url:string;path:string} {
  const raw=text(value);
  const url=new URL(raw);
  const prefix='/recruiting/elcorteingles/Ext';
  if(url.protocol!=='https:'||url.hostname!==workdaySiteHost||url.port||url.username||url.password||url.search||url.hash||
    !url.pathname.startsWith(`${prefix}/job/`)||!url.pathname.endsWith(`_${id}`)) throw new TypeError('URL El Corte Inglés no autorizada');
  return {url:url.href,path:url.pathname.slice(prefix.length)};
}

export function parseElCorteInglesListing(input:unknown,page:number):ListingPage {
  if(!Number.isSafeInteger(page)||page<0) throw new TypeError('Página El Corte Inglés inválida');
  const payload=record(input);
  if(!Number.isSafeInteger(payload.total_results)||Number(payload.total_results)<0||Number(payload.total_results)>maxOffers||
    !Array.isArray(payload.job_requisitions)) throw new TypeError('Listado El Corte Inglés inválido');
  const offers=payload.job_requisitions.map(value=>{
    const item=record(value);
    const id=text(item.job_requisition_id).toUpperCase();
    const title=text(item.job_posting_title);
    const location=text(item.job_location_name);
    if(!/^JR\d{4,12}$/.test(id)||!title||!location||!Array.isArray(item.job_areas)||
      !item.job_areas.every(area=>typeof area==='string'&&area.trim())) throw new TypeError('Oferta El Corte Inglés incompleta');
    const external=officialPath(item.external_url,id);
    const apply=text(item.job_apply_url);
    if(apply&&apply!==`${external.url}/apply`) throw new TypeError('URL de solicitud El Corte Inglés no autorizada');
    return {id,title,location,areas:item.job_areas.map(area=>(area as string).trim()),
      employeeType:text(item.job_employee_type),timeType:text(item.job_time_type),externalUrl:external.url,path:external.path};
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

function checkedDetailUrl(value:unknown,offer:ListedOffer):string {
  const external=officialPath(value,offer.id);
  if(external.path!==offer.path) throw new TypeError('Detalle El Corte Inglés no corresponde al listado');
  return external.url;
}

export function adaptElCorteInglesDetail(
  offer:ListedOffer,input:unknown,checkedAt:string,resolveCity:CityResolver,
):PublicJob|null {
  const info=record(record(input).jobPostingInfo);
  if(info.posted!==true) return null;
  if(text(info.jobReqId).toUpperCase()!==offer.id||text(info.title)!==offer.title) throw new TypeError('Detalle El Corte Inglés no corresponde al listado');
  const country=record(record(info.jobRequisitionLocation).country);
  if(text(country.alpha2Code)!=='ES') return null;
  const sourceUrl=checkedDetailUrl(info.externalUrl,offer);
  const paragraphs=htmlToParagraphs(text(info.jobDescription));
  if(!paragraphs.length) throw new TypeError('Detalle El Corte Inglés vacío');
  const originalLocation=text(info.location)||offer.location;
  const remote=/remot|teletrabajo/i.test(`${text(info.remoteType)} ${offer.title}`);
  const multiple=Array.isArray(info.additionalLocations)&&info.additionalLocations.length>0;
  const internalCode=/^\d{5,}$/.test(originalLocation)||/work\s*space/i.test(originalLocation);
  const resolved=!remote&&!multiple&&!internalCode?resolveCity(originalLocation):null;
  const published=text(info.startDate);
  const validPublished=/^\d{4}-\d{2}-\d{2}$/.test(published)&&published<=dateInSpain(checkedAt);
  const category=categoryFor(offer.areas);
  return {kind:'job',sourceId,source:sourceLabel,id:`ELCORTEINGLES-${offer.id}`,title:offer.title,
    employer:'El Corte Inglés',city:originalLocation,province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
    ...category,regime:remote?'Remoto':'Oferta de empleo',places:null,paragraphs,sourceUrl,
    publishedAt:validPublished?published:dateInSpain(checkedAt),...(validPublished?{}:{dateKind:'observed' as const}),checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null};
}

async function postListing(page:number,size:number,fetchImpl:typeof fetch):Promise<unknown> {
  const url=new URL(listingEndpoint);
  url.searchParams.set('page',String(page));
  url.searchParams.set('size',String(size));
  const response=await fetchImpl(url,{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:'{}',
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
    const parsed=parseElCorteInglesListing(await postListing(page,pageSize,fetchImpl),page);
    if(expected===null){
      if(parsed.total<1) throw new TypeError('Listado El Corte Inglés vacío');
      expected=parsed.total;
    } else if(parsed.total!==expected) throw new TypeError('Listado El Corte Inglés cambió durante la captura');
    if(!parsed.offers.length) throw new TypeError('Página El Corte Inglés vacía');
    for(const offer of parsed.offers){
      if(found.has(offer.id)) throw new TypeError('ID El Corte Inglés repetido entre páginas');
      found.set(offer.id,offer);
    }
  }
  if(expected===null||found.size!==expected) throw new TypeError('Paginación El Corte Inglés incompleta');
  const jobs:PublicJob[]=[];
  const offers=[...found.values()];
  for(let index=0;index<offers.length;index+=4){
    const batch=await Promise.all(offers.slice(index,index+4).map(async offer=>
      adaptElCorteInglesDetail(offer,await fetchJson(`${workdayApiBase}${offer.path}`,{fetchImpl,maxBytes:2_000_000}),checkedAt,resolveCity)));
    jobs.push(...batch.filter((job):job is PublicJob=>job!==null));
  }
  if(!jobs.length) throw new TypeError('No hay ofertas españolas de El Corte Inglés');
  return jobs;
}

export async function fetchElCorteInglesOffers(
  checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch,pageSize=defaultPageSize,
):Promise<PublicJob[]> {
  return fetchSnapshot(checkedAt,resolveCity,fetchImpl,pageSize);
}
