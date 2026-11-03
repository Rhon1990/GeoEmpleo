import type {CityResolver} from './bizneo.ts';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {attribute,descendants,documentOf,textOf,type HtmlElement} from './html-dom.ts';
import {dateFromSpanish} from './shared.ts';

export const eulenTaleoListingUrl='https://eulen.taleo.net/careersection/eul_career_site/jobsearch.ftl?lang=es';
const searchUrl='https://eulen.taleo.net/careersection/rest/jobboard/searchjobs?lang=es&portal=8170431885';
const sourceId='taleo-eulen';

export interface EulenTaleoOffer {
  jobId:unknown;
  contestNo:unknown;
  column:unknown;
}

function elementById(nodes:HtmlElement[],id:string):HtmlElement|undefined {
  return nodes.find(node=>attribute(node,'id')===`requisitionDescriptionInterface.${id}.row1`);
}

function provinceOf(offer:EulenTaleoOffer):ReturnType<typeof canonicalSpanishProvince>|null {
  if(!Array.isArray(offer.column)||typeof offer.column[2]!=='string')return null;
  let locations:unknown;
  try {locations=JSON.parse(offer.column[2]);}catch{return null;}
  if(!Array.isArray(locations)||locations.length!==1||typeof locations[0]!=='string')return null;
  return canonicalSpanishProvince(locations[0]);
}

export function adaptEulenTaleoDetail(offer:EulenTaleoOffer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  const id=offer.contestNo;
  if(typeof id!=='string'||!/^\d[A-Z0-9]{5,15}$/.test(id))throw new TypeError('ID Taleo Eulen inválido');
  if(typeof offer.jobId!=='string'||!/^\d+$/.test(offer.jobId))throw new TypeError('ID interno Taleo Eulen inválido');
  const nodes=descendants(documentOf(html),()=>true);
  const titleNode=elementById(nodes,'reqTitleLinkAction');
  const title=titleNode&&textOf(titleNode);
  const dateNode=elementById(nodes,'reqPostingDate');
  const dateText=dateNode&&textOf(dateNode);
  if(!title||!dateText)return null;
  const province=provinceOf(offer);
  if(!province)return null;
  const sites=nodes.filter(node=>/^requisitionDescriptionInterface\.reqSiteCity\.row\d+$/.test(attribute(node,'id')??''));
  const cities=[...new Set(sites.map(node=>textOf(node)).filter(Boolean))];
  const city=cities.length===1?cities[0]!:'Varias localidades';
  const resolved=cities.length===1?resolveCity(city,province.name):null;
  const description=elementById(nodes,'ID1404');
  const requirements=elementById(nodes,'ID1462');
  const paragraphs=[description&&textOf(description),requirements&&textOf(requirements)].filter((value):value is string=>Boolean(value));
  if(!paragraphs.length)paragraphs.push(`Oferta publicada por Grupo Eulen en ${province.name}.`);
  const sourceUrl=`https://eulen.taleo.net/careersection/eul_career_site/jobdetail.ftl?job=${id}&lang=es`;
  return {kind:'job',sourceId,source:'Grupo Eulen · Taleo oficial',id:`EULEN-TALEO-${id}`,title,employer:'Grupo Eulen',
    city:resolved?.city??city,province:province.name,region:province.region,category:'servicios',categoryLabel:'Servicios y comercio',
    regime:'Oferta de empleo',places:null,paragraphs,sourceUrl,publishedAt:dateFromSpanish(dateText.slice(0,10),'Eulen Taleo'),
    checkedAt,closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:resolved?.location??null};
}

function safeCookieHeaders(response:Response):string {
  const cookies=response.headers.getSetCookie().map(value=>value.split(';',1)[0]?.trim()??'');
  const valid=cookies.filter(value=>/^[A-Za-z][\w-]*=[^\s;,]+$/.test(value));
  if(!valid.length)throw new TypeError('Sesión anónima Eulen sin cookie');
  return valid.join('; ');
}

async function responseText(response:Response,type:'html'|'json',limit:number):Promise<string> {
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes(type))throw new Error(`Respuesta Eulen ${type} no disponible`);
  const text=await response.text();
  if(!text||text.length>limit)throw new TypeError(`Respuesta Eulen ${type} inválida`);
  return text;
}

interface TaleoPage {pagingData?:{currentPageNo?:unknown;pageSize?:unknown;totalCount?:unknown};requisitionList?:unknown}

async function snapshot(fetchImpl:typeof fetch):Promise<{cookie:string;offers:EulenTaleoOffer[]}> {
  const landing=await fetchImpl(eulenTaleoListingUrl,{headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(30_000)});
  await responseText(landing,'html',2_000_000);
  const cookie=safeCookieHeaders(landing);
  const offers:EulenTaleoOffer[]=[],ids=new Set<string>();
  let total=0,pageSize=0;
  for(let pageNo=1;pageNo<=200;pageNo++) {
    const payload={fieldData:{fields:{KEYWORD:'',ORGANIZATION:'',CATEGORY:''},valid:true},
      filterSelectionParam:{searchFilterSelections:[]},sortingSelection:{sortBySelectionParam:'1',ascendingSortingOrder:'false'},pageNo};
    const response=await fetchImpl(searchUrl,{method:'POST',headers:{accept:'application/json','content-type':'application/json',
      cookie,referer:eulenTaleoListingUrl,tz:'GMT+01:00',tzname:'Europe/Madrid'},body:JSON.stringify(payload),
      redirect:'error',signal:AbortSignal.timeout(30_000)});
    const raw=await responseText(response,'json',2_000_000);
    const parsed=JSON.parse(raw) as TaleoPage;
    const paging=parsed.pagingData;
    if(!paging||!Number.isSafeInteger(paging.currentPageNo)||paging.currentPageNo!==pageNo||
      !Number.isSafeInteger(paging.pageSize)||Number(paging.pageSize)<1||Number(paging.pageSize)>100||
      !Number.isSafeInteger(paging.totalCount)||Number(paging.totalCount)<1||Number(paging.totalCount)>20_000||
      !Array.isArray(parsed.requisitionList))throw new TypeError('Paginación Eulen inválida');
    if(pageNo===1){total=Number(paging.totalCount);pageSize=Number(paging.pageSize);if(Math.ceil(total/pageSize)>200)throw new TypeError('Demasiadas páginas Eulen');}
    if(paging.totalCount!==total||paging.pageSize!==pageSize||parsed.requisitionList.length!==Math.min(pageSize,total-offers.length)){
      throw new TypeError('Captura Eulen incompleta');
    }
    for(const rawOffer of parsed.requisitionList) {
      const offer=rawOffer as EulenTaleoOffer,id=offer?.contestNo;
      if(typeof id!=='string'||!/^\d[A-Z0-9]{5,15}$/.test(id)||ids.has(id))throw new TypeError('Oferta Eulen duplicada o sin ID');
      ids.add(id);offers.push(offer);
    }
    if(offers.length===total)return {cookie,offers};
  }
  throw new TypeError('Captura Eulen incompleta');
}

async function fetchDetail(offer:EulenTaleoOffer,cookie:string,fetchImpl:typeof fetch):Promise<string> {
  const url=`https://eulen.taleo.net/careersection/eul_career_site/jobdetail.ftl?job=${offer.contestNo}&lang=es`;
  const response=await fetchImpl(url,{headers:{accept:'text/html',cookie,referer:eulenTaleoListingUrl},redirect:'error',signal:AbortSignal.timeout(30_000)});
  return responseText(response,'html',1_000_000);
}

export async function fetchEulenTaleoOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  let captured:{cookie:string;offers:EulenTaleoOffer[]}|undefined,lastError:unknown;
  for(let attempt=0;attempt<2;attempt++) {
    try {captured=await snapshot(fetchImpl);break;}catch(error){lastError=error;}
  }
  if(!captured)throw lastError instanceof Error?lastError:new TypeError('Captura Eulen incompleta');
  const jobs:PublicJob[]=[];
  for(let index=0;index<captured.offers.length;index+=4) {
    const batch=captured.offers.slice(index,index+4);
    const details=await Promise.all(batch.map(async offer=>{
      let last:unknown;
      for(let attempt=0;attempt<2;attempt++) {
        try{return await fetchDetail(offer,captured.cookie,fetchImpl);}catch(error){last=error;}
      }
      throw last instanceof Error?last:new Error('Ficha Eulen no disponible');
    }));
    for(let offset=0;offset<batch.length;offset++) {
      const job=adaptEulenTaleoDetail(batch[offset]!,details[offset]!,checkedAt,resolveCity);
      if(!job)throw new TypeError('Ficha Eulen sin datos verificables');
      jobs.push(job);
    }
  }
  return jobs;
}
