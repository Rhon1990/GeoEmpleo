import type {PublicJob} from '../model.ts';
import {dateInSpain,htmlToParagraphs} from '../normalize.ts';
import {fetchJson} from '../http.ts';
import type {CityResolver} from './bizneo.ts';

const host='accenture.wd103.myworkdayjobs.com';
const base=`https://${host}`;
const endpoint=`${base}/wday/cxs/accenture/AccentureCareers/jobs`;
export const accentureListingUrl='https://www.accenture.com/es-es/careers/jobsearch';
export interface AccentureListedOffer {readonly id:string;readonly title:string;readonly path:string}

function record(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Formato Workday inválido');
  return value as Record<string,unknown>;
}

function jobPath(value:unknown):{path:string;id:string} {
  if(typeof value!=='string'||!/^\/job\/[^?#]+_R?\d{5,}(?:-\d+)?$/i.test(value)) throw new TypeError('Ruta Workday inválida');
  const id=value.match(/_(R?\d{5,}(?:-\d+)?)$/i)?.[1];
  if(!id) throw new TypeError('ID Workday ausente');
  return {path:value,id:id.toUpperCase()};
}

export function parseAccentureListing(input:unknown):{total:number;offers:AccentureListedOffer[]} {
  const data=record(input);
  if(!Number.isSafeInteger(data.total)||Number(data.total)<0||!Array.isArray(data.jobPostings)) throw new TypeError('Listado Accenture inválido');
  const offers=data.jobPostings.map(value=>{
    const item=record(value);
    const {path,id}=jobPath(item.externalPath);
    if(typeof item.title!=='string'||!item.title.trim()) throw new TypeError('Título Accenture ausente');
    return {id,title:item.title.trim(),path};
  });
  if(new Set(offers.map(offer=>offer.id)).size!==offers.length) throw new TypeError('IDs Accenture repetidos');
  return {total:Number(data.total),offers};
}

function officialUrl(value:unknown,id:string):string {
  if(typeof value!=='string') throw new TypeError('URL Accenture ausente');
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!==host||url.port||url.username||url.password||url.search||url.hash||
    !new RegExp(`^/AccentureCareers/job/[^?#]+_${id}$`,'i').test(url.pathname)) throw new TypeError('URL Accenture no autorizada');
  return url.href;
}

export function adaptAccentureDetail(offer:AccentureListedOffer,input:unknown,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  const info=record(record(input).jobPostingInfo);
  if(info.posted!==true) return null;
  if(info.jobReqId!==offer.id.replace(/-\d+$/,'')||info.title!==offer.title||typeof info.jobDescription!=='string') throw new TypeError('Detalle Accenture no corresponde al listado');
  const country=record(info.jobRequisitionLocation);
  if(record(country.country).alpha2Code!=='ES'||record(info.country).descriptor!=='Spain') return null;
  const sourceUrl=officialUrl(info.externalUrl,offer.id);
  const paragraphs=htmlToParagraphs(info.jobDescription);
  if(!paragraphs.length) throw new TypeError('Detalle Accenture vacío');
  const originalLocation=typeof info.location==='string'?info.location.trim():'';
  const city=originalLocation.split(',')[0]?.trim()||'Ubicación no indicada';
  const multiple=Array.isArray(info.additionalLocations)&&info.additionalLocations.length>0;
  const remote=typeof info.remoteType==='string'&&/\bremote\b|\bremoto\b/i.test(info.remoteType);
  const resolved=!multiple&&!remote?resolveCity(city):null;
  const startDate=typeof info.startDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(info.startDate)&&
    info.startDate<=dateInSpain(checkedAt)?info.startDate:null;
  return {kind:'job',sourceId:'workday-accenture',source:'Accenture · portal oficial',id:`ACCENTURE-${offer.id}`,
    title:offer.title,employer:'Accenture',city:originalLocation||city,province:resolved?.province??'Sin verificar',
    region:resolved?.region??'España',category:'tecnologia',categoryLabel:'Tecnología y consultoría',
    regime:remote?'Remoto':'Oferta de empleo',places:null,paragraphs,sourceUrl,
    publishedAt:startDate??dateInSpain(checkedAt),...(startDate?{}:{dateKind:'observed' as const}),checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:resolved?.location??null};
}

async function postListing(payload:Record<string,unknown>,fetchImpl:typeof fetch):Promise<unknown> {
  const response=await fetchImpl(endpoint,{method:'POST',headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(40_000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  if(!response.headers.get('content-type')?.toLowerCase().includes('json')) throw new TypeError('Workday no devolvió JSON');
  const body=await response.text();
  if(body.length>8_000_000) throw new TypeError('Respuesta Workday demasiado grande');
  return JSON.parse(body);
}

function spainFacet(input:unknown):string {
  const facets=record(input).facets;
  if(!Array.isArray(facets)) throw new TypeError('Facetas Accenture ausentes');
  const main=facets.map(record).find(facet=>facet.facetParameter==='locationMainGroup');
  const group=Array.isArray(main?.values)?main.values.map(record).find(value=>value.facetParameter==='locationCountry'):null;
  const value=Array.isArray(group?.values)?group.values.map(record).find(item=>item.descriptor==='Spain'):null;
  if(typeof value?.id!=='string'||!value.id) throw new TypeError('Filtro España Accenture ausente');
  return value.id;
}

export async function fetchAccentureOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const first=await postListing({appliedFacets:{},limit:20,offset:0,searchText:''},fetchImpl);
  const countryId=spainFacet(first);
  const found=new Map<string,AccentureListedOffer>();
  let expected:number|null=null;
  for(let offset=0;offset<(expected??20);offset+=20){
    const page=parseAccentureListing(await postListing({appliedFacets:{locationCountry:[countryId]},limit:20,offset,searchText:''},fetchImpl));
    if(expected===null){
      if(page.total<1||page.total>1000) throw new TypeError('Volumen Accenture inesperado');
      expected=page.total;
    } else if(page.total!==0&&page.total!==expected) throw new TypeError('Listado Accenture cambió durante la captura');
    if(!page.offers.length) throw new TypeError('Página Accenture vacía');
    for(const offer of page.offers){if(found.has(offer.id)) throw new TypeError('ID Accenture repetido entre páginas');found.set(offer.id,offer);}
  }
  if(found.size!==expected) throw new TypeError('Paginación Accenture incompleta');
  const jobs:PublicJob[]=[];
  const offers=[...found.values()];
  for(let i=0;i<offers.length;i+=4){
    const batch=await Promise.all(offers.slice(i,i+4).map(async offer=>{
      const path=`/wday/cxs/accenture/AccentureCareers${offer.path}`;
      return adaptAccentureDetail(offer,await fetchJson(`${base}${path}`,{fetchImpl,maxBytes:2_000_000}),checkedAt,resolveCity);
    }));
    jobs.push(...batch.filter((job):job is PublicJob=>job!==null));
  }
  if(!jobs.length) throw new TypeError('No hay ofertas españolas de Accenture');
  return jobs;
}
