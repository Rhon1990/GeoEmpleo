import type {PublicJob} from '../model.ts';
import {dateInSpain} from '../normalize.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import type {CityResolver} from './bizneo.ts';

export const adeccoListingUrl='https://www.adecco.com/es-es/ofertas-trabajo';
const endpoint='https://www.adecco.com/api/data/jobs/summarized';
const sourceId='adecco-oficial';
const pageSize=10;
const maxOffers=10_000;

interface ListingJob {
  jobId?:unknown;jobTitle?:unknown;cityName?:unknown;stateName?:unknown;countryId?:unknown;
  webSite?:unknown;postedDate?:unknown;postingEndDate?:unknown;applyUri?:unknown;numberOfPositions?:unknown;
}

function listedJob(input:ListingJob,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  if(input.countryId!=='ESP'||input.webSite!=='adecco.es')return null;
  if(typeof input.jobId!=='string'||!/^[a-f0-9]{32}$/i.test(input.jobId)||
    typeof input.jobTitle!=='string'||!input.jobTitle.trim()||
    typeof input.postedDate!=='string'||!Number.isFinite(Date.parse(input.postedDate))||
    typeof input.postingEndDate!=='string'||!Number.isFinite(Date.parse(input.postingEndDate)))
    throw new TypeError('Oferta Adecco incompleta');
  if(Date.parse(input.postingEndDate)<Date.parse(checkedAt))return null;
  let url:URL;
  try {url=new URL(String(input.applyUri));}catch {throw new TypeError('URL Adecco inválida');}
  if(url.protocol!=='https:'||url.hostname!=='portalcandidatos.es.adecco.com'||url.port||url.username||url.password||
    !url.pathname.startsWith('/oferta-empleo/'))throw new TypeError('URL Adecco no autorizada');
  const city=typeof input.cityName==='string'&&input.cityName.trim()?input.cityName.trim():'Ubicación no indicada';
  const province=typeof input.stateName==='string'?canonicalSpanishProvince(input.stateName):null;
  const resolved=province?resolveCity(city,province.name):null;
  const coherent=resolved?.province===province?.name;
  const positions=typeof input.numberOfPositions==='number'&&Number.isSafeInteger(input.numberOfPositions)&&input.numberOfPositions>0?input.numberOfPositions:null;
  return {kind:'job',sourceId,source:'Adecco · portal oficial',id:`ADECCO-${input.jobId.toUpperCase()}`,
    title:input.jobTitle.trim(),employer:'Adecco',city,province:province?.name??'Sin verificar',region:province?.region??'España',
    category:'otros',categoryLabel:'Otros sectores',regime:'Oferta de empleo',places:positions,
    paragraphs:[`Oferta publicada por Adecco para ${city}.`,'Consulta las funciones, requisitos y condiciones en la ficha original.'],
    sourceUrl:`${adeccoListingUrl}/${input.jobId.toLowerCase()}`,publishedAt:dateInSpain(input.postedDate),checkedAt,closingDate:input.postingEndDate.slice(0,10),
    salary:null,applicationRegistration:'external_required',selection:null,
    location:coherent?resolved?.location??null:null};
}

async function fetchPage(range:number,checkedAt:string,fetchImpl:typeof fetch) {
  const body={baseSearchQuery:`PostingEndDate ge ${checkedAt} and CountryId eq 'ESP'`,
    filtersToDisplay:'',selectedFilters:'',queryString:'',range,siteName:'AdeccoES',brand:'adecco',countryCookie:'ES',langCookie:'es-ES'};
  const response=await fetchImpl(endpoint,{method:'POST',headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(25_000)});
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('json'))throw new Error(`Adecco HTTP ${response.status}`);
  const data=await response.json() as {jobs?:ListingJob[];pagination?:{total?:number;nextRange?:number}};
  if(!Array.isArray(data.jobs)||!Number.isSafeInteger(data.pagination?.total)||data.pagination!.total!<1||data.pagination!.total!>maxOffers||
    data.jobs.length>pageSize||data.jobs.length===0||data.pagination?.nextRange!==range+pageSize)
    throw new TypeError(`Paginación Adecco inválida en rango ${range}: total ${data.pagination?.total}, filas ${data.jobs?.length}, siguiente ${data.pagination?.nextRange}`);
  return {jobs:data.jobs,total:data.pagination!.total!};
}

export async function fetchAdeccoOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  if(!Number.isFinite(Date.parse(checkedAt)))throw new TypeError('Fecha de captura inválida');
  const first=await fetchPage(0,checkedAt,fetchImpl);
  const rows=[...first.jobs];
  if(first.total>pageSize&&first.jobs.length!==pageSize)throw new TypeError('Primera página Adecco incompleta');
  const ranges=Array.from({length:Math.ceil(first.total/pageSize)-1},(_,i)=>(i+1)*pageSize);
  for(let index=0;index<ranges.length;index+=5){
    const pages=await Promise.all(ranges.slice(index,index+5).map(range=>fetchPage(range,checkedAt,fetchImpl)));
    for(let page=0;page<pages.length;page++){
      const range=ranges[index+page]!;
      if(pages[page]!.jobs.length<Math.min(pageSize,first.total-range))throw new TypeError('Página Adecco incompleta');
      rows.push(...pages[page]!.jobs);
    }
  }
  const jobs=new Map<string,PublicJob>();
  for(const row of rows){const job=listedJob(row,checkedAt,resolveCity);if(job)jobs.set(job.id,job);}
  if(jobs.size===0||jobs.size<Math.floor(first.total*0.9))throw new TypeError('Captura Adecco insuficiente');
  return [...jobs.values()];
}
