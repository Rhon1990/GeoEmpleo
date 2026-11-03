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

function quotedArray(input:string,start:number):string[] {
  if(input[start]!=='[')throw new TypeError('Datos Taleo inválidos');
  const result:string[]=[];
  let index=start+1;
  while(index<input.length) {
    while(/[\s,]/.test(input[index]??''))index++;
    if(input[index]===']')return result;
    if(input[index]!=="'")throw new TypeError('Datos Taleo inválidos');
    index++;
    let value='',closed=false;
    while(index<input.length) {
      const char=input[index++];
      if(char==="'"){closed=true;break;}
      if(char!=='\\'){value+=char;continue;}
      const escape=input[index++];
      if(escape==="'"||escape==='\\'||escape==='"')value+=escape;
      else if(escape==='n')value+='\n';
      else if(escape==='r')value+='\r';
      else if(escape==='t')value+='\t';
      else if(escape==='u'||escape==='x'){
        const size=escape==='u'?4:2,hex=input.slice(index,index+size);
        if(!new RegExp(`^[0-9a-fA-F]{${size}}$`).test(hex))throw new TypeError('Escape Taleo inválido');
        value+=String.fromCharCode(parseInt(hex,16));index+=size;
      }else throw new TypeError('Escape Taleo inválido');
    }
    if(!closed)throw new TypeError('Datos Taleo incompletos');
    result.push(value);
    while(/\s/.test(input[index]??''))index++;
    if(input[index]===','){index++;continue;}
    if(input[index]===']')return result;
    throw new TypeError('Datos Taleo inválidos');
  }
  throw new TypeError('Datos Taleo incompletos');
}

function encodedFields(html:string):Map<string,string> {
  const list=/descRequisition\s*:\s*\{/.exec(html)?.index??-1;
  const namesStart=list<0?-1:html.slice(list).search(/\b_hles\s*:\s*\[/)+list;
  const call=/api\.fillList\(\s*'requisitionDescriptionInterface'\s*,\s*'descRequisition'\s*,\s*\[/.exec(html);
  if(list<0||namesStart<list||!call)return new Map();
  const names=quotedArray(html,html.indexOf('[',namesStart));
  const values=quotedArray(html,call.index+call[0].length-1);
  if(names.length!==values.length)throw new TypeError('Campos Taleo inconsistentes');
  return new Map(names.map((name,index)=>[name,values[index]!]));
}

function decodedFieldMarkup(value:string|undefined):string {
  if(!value)return '';
  return value.startsWith('!*!')
    ? decodeURIComponent(value.slice(3).replace(/%(?![0-9a-fA-F]{2})/g,'%25'))
    :value;
}

function cleanField(value:string|undefined):string {
  return textOf(documentOf(decodedFieldMarkup(value))).trim();
}

function siteCities(value:string|undefined):string[] {
  const markup=decodedFieldMarkup(value),cities:string[]=[];
  for(const match of markup.matchAll(/>\s*\d{5}\s+-\s+([^<]+)</gi)) {
    const city=textOf(documentOf(match[1]??'')).trim();
    if(city)cities.push(city);
  }
  return cities;
}

function uniqueStrings(values:string[]):string[] {
  return [...new Map(values.filter(Boolean).map(value=>[value.trim().toLocaleLowerCase('es'),value.trim()])).values()];
}

function provinceOf(offer:EulenTaleoOffer):ReturnType<typeof canonicalSpanishProvince>|null {
  if(!Array.isArray(offer.column)||typeof offer.column[2]!=='string')return null;
  let locations:unknown;
  try {locations=JSON.parse(offer.column[2]);}catch{return null;}
  if(!Array.isArray(locations)||!locations.length||locations.some(location=>typeof location!=='string'))return null;
  const canonical=locations.map(location=>canonicalSpanishProvince(location as string));
  if(canonical.some(province=>province===null))return null;
  const provinces=[...new Map(canonical.map(province=>[province!.name,province!])).values()];
  return provinces.length===1?provinces[0]!:null;
}

export function adaptEulenTaleoDetail(offer:EulenTaleoOffer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  const id=offer.contestNo;
  if(typeof id!=='string'||!/^\d[A-Z0-9]{5,15}$/.test(id))throw new TypeError('ID Taleo Eulen inválido');
  if(typeof offer.jobId!=='string'||!/^\d+$/.test(offer.jobId))throw new TypeError('ID interno Taleo Eulen inválido');
  const nodes=descendants(documentOf(html),()=>true);
  const fields=encodedFields(html);
  if(fields.has('reqContestNumberValue')&&cleanField(fields.get('reqContestNumberValue'))!==id)throw new TypeError('Ficha Eulen con ID distinto');
  const value=(name:string)=>{const element=elementById(nodes,name);return element?textOf(element)||cleanField(fields.get(name)):cleanField(fields.get(name));};
  const titleNode=elementById(nodes,'reqTitleLinkAction');
  const title=titleNode&&textOf(titleNode)||cleanField(fields.get('reqTitleLinkAction'));
  const dateText=value('reqPostingDate');
  if(!title||!dateText)return null;
  const province=provinceOf(offer)??canonicalSpanishProvince(value('ID1520'));
  if(!province)return null;
  const sites=nodes.filter(node=>/^requisitionDescriptionInterface\.reqSiteCity\.row\d+$/.test(attribute(node,'id')??''));
  const cities=uniqueStrings([...sites.map(node=>textOf(node)),cleanField(fields.get('reqSiteCity')),...siteCities(fields.get('ID1577'))]);
  const city=cities.length===1?cities[0]!:'Varias localidades';
  const resolved=cities.length===1?resolveCity(city,province.name):null;
  const paragraphs=[value('ID1404'),value('ID1462')].filter(Boolean);
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
  let minTotal=0,maxTotal=0,pageSize=0,pageCount=0;
  const searchFilterSelections=['LOCATION','JOB_FIELD','ORGANIZATION','POSTING_DATE','JOB_SCHEDULE']
    .map(id=>({id,selectedValues:[]}));
  for(let pageNo=1;pageNo<=Math.max(pageCount,1);pageNo++) {
    const payload={fieldData:{fields:{KEYWORD:'',ORGANIZATION:'',CATEGORY:''},valid:true},
      filterSelectionParam:{searchFilterSelections},sortingSelection:{sortBySelectionParam:'1',ascendingSortingOrder:'true'},pageNo};
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
    if(pageNo===1){
      minTotal=Number(paging.totalCount);maxTotal=minTotal;pageSize=Number(paging.pageSize);pageCount=Math.ceil(maxTotal/pageSize);
      if(pageCount>200)throw new TypeError('Demasiadas páginas Eulen');
    }
    minTotal=Math.min(minTotal,Number(paging.totalCount));maxTotal=Math.max(maxTotal,Number(paging.totalCount));
    pageCount=Math.max(pageCount,Math.ceil(Number(paging.totalCount)/pageSize));
    if(paging.pageSize!==pageSize||maxTotal-minTotal>pageSize||pageCount>200){
      throw new TypeError('Captura Eulen incompleta');
    }
    for(const rawOffer of parsed.requisitionList) {
      const offer=rawOffer as EulenTaleoOffer,id=offer?.contestNo;
      if(typeof id!=='string'||!/^\d[A-Z0-9]{5,15}$/.test(id)||ids.has(id))throw new TypeError('Oferta Eulen duplicada o sin ID');
      ids.add(id);offers.push(offer);
    }
  }
  if(!offers.length)throw new TypeError('Captura Eulen vacía');
  return {cookie,offers};
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
      if(!job)throw new TypeError(`Ficha Eulen sin datos verificables: ${String(batch[offset]?.contestNo)}`);
      jobs.push(job);
    }
  }
  return jobs;
}
