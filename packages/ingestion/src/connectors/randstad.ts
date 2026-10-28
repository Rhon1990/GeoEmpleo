import type {CityResolver} from './bizneo.ts';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {attribute,descendants,documentOf,hasClass,textOf} from './html-dom.ts';
import {dateFromSpanish,isRecentPublication} from './shared.ts';

export const randstadListingUrl='https://www.randstad.es/candidatos/ofertas-empleo/pg-10/';
const randstadApiUrl='https://apis.randstad.es/talent/offers/';
const apiPageSize=300;
const maxApiPages=100;
const sourceId='randstad-oficial';

export function adaptRandstadListing(html:string,checkedAt:string,resolveCity:CityResolver):PublicJob[] {
  const cards=descendants(documentOf(html),element=>element.tagName==='a'&&attribute(element,'data-offerid')!==null);
  if(!cards.length)throw new TypeError('Listado Randstad vacío');
  const jobs:PublicJob[]=[];
  const seen=new Set<string>();
  for(const card of cards){
    const id=attribute(card,'data-offerid');
    const raw=attribute(card,'href');
    const url=raw&&new URL(raw);
    if(!id||!/^\d+$/.test(id)||!url||url.protocol!=='https:'||url.hostname!=='www.randstad.es'||url.port||url.username||url.password||
      !/^\/(?:candidatos\/ofertas-empleo|unete-al-equipo\/ofertas-randstad|fundacion-randstad\/empleo-discapacidad)\/oferta\/[^/]+-\d+\/$/.test(url.pathname)||
      !url.pathname.endsWith(`-${id}/`)||url.search||url.hash)throw new TypeError('URL Randstad no autorizada');
    if(seen.has(id))throw new TypeError('Oferta Randstad duplicada');
    seen.add(id);
    const title=attribute(card,'data-title')?.trim();
    const provinceHint=attribute(card,'data-province');
    const province=provinceHint?canonicalSpanishProvince(provinceHint):null;
    const locationNode=descendants(card,element=>element.tagName==='div'&&hasClass(element,'rel_text-ellipsis-2'))[0];
    const locationText=locationNode&&textOf(locationNode);
    const match=locationText&&/^(.+?)\s+-\s+(.+)$/.exec(locationText);
    const publishedText=/publicada el (\d{2}\/\d{2}\/\d{4})/i.exec(textOf(card))?.[1];
    if(!title||!province||!match||!publishedText)continue;
    if(canonicalSpanishProvince(match[2])?.name!==province.name)continue;
    const publishedAt=dateFromSpanish(publishedText,'Randstad');
    if(!isRecentPublication(publishedAt,checkedAt,30))continue;
    const city=match[1]!.trim();
    const resolved=resolveCity(city,province.name);
    const employer=attribute(card,'data-publication-company-business')?.trim()||'Randstad';
    jobs.push({kind:'job',sourceId,source:'Randstad · portal oficial',id:`RANDSTAD-${id}`,title,employer,
      city:resolved?.city??city,province:province.name,region:province.region,
      category:'otros',categoryLabel:'Otros',regime:'Oferta de empleo',places:null,
      paragraphs:[`Oferta publicada por ${employer} para ${city}.`,'La empresa contratante y las condiciones se detallan en la ficha original.'],
      sourceUrl:url.href,publishedAt,checkedAt,closingDate:null,salary:null,
      applicationRegistration:'external_required',selection:null,location:resolved?.location??null});
  }
  if(!jobs.length)throw new TypeError('Randstad sin ofertas españolas recientes verificables');
  return jobs;
}

interface RandstadApiOffer {
  offerId?:unknown;title?:unknown;company?:unknown;date?:unknown;description?:unknown;requirements?:unknown;conditions?:unknown;
  url?:unknown;province?:unknown;city?:unknown;publicationCompanyBusiness?:unknown;workModality?:unknown;
}

interface RandstadPage {
  readonly page:number;readonly totalCount:number;readonly totalPages:number;readonly offers:readonly RandstadApiOffer[];
}

function object(value:unknown):Record<string,unknown>|null {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}

function text(value:unknown):string {return typeof value==='string'?value.trim():'';}

function parseRandstadApiPage(value:unknown,expectedPage:number):RandstadPage {
  const payload=object(value),pagination=object(payload?.pagination);
  if(!payload||!pagination||!Array.isArray(payload.result))throw new TypeError('Respuesta API Randstad inválida');
  const page=pagination.page,totalCount=pagination.totalCount,totalPages=pagination.totalPages;
  const elements=pagination.elements,hasNext=pagination.hasNext,hasPrev=pagination.hasPrev;
  const pageCount=pagination.pageCount;
  if(typeof page!=='number'||typeof totalCount!=='number'||typeof totalPages!=='number'||typeof pageCount!=='number'||
    typeof elements!=='number'||typeof hasNext!=='boolean'||typeof hasPrev!=='boolean') {
    throw new TypeError('Metadatos de paginación Randstad inválidos');
  }
  const expectedPages=Math.ceil(totalCount/apiPageSize);
  const expectedElements=Math.min(apiPageSize,totalCount-expectedPage*apiPageSize);
  if(page!==expectedPage||!Number.isSafeInteger(totalCount)||totalCount<1||totalCount>apiPageSize*maxApiPages||
    !Number.isSafeInteger(totalPages)||totalPages!==expectedPages||totalPages>maxApiPages||
    pageCount!==expectedPage+1||elements!==apiPageSize||payload.result.length!==expectedElements||
    hasNext!==(expectedPage+1<expectedPages)||hasPrev!==(expectedPage>0)) {
    throw new TypeError('Paginación Randstad incompleta o inconsistente');
  }
  return {page,totalCount,totalPages,offers:payload.result as RandstadApiOffer[]};
}

function apiJobUrl(value:unknown,id:string):string {
  const url=new URL(text(value));
  if(url.protocol!=='https:'||url.hostname!=='www.randstad.es'||url.port||url.username||url.password||
    !/^\/(?:candidatos\/ofertas-empleo|unete-al-equipo\/ofertas-randstad|fundacion-randstad\/empleo-discapacidad)\/oferta\/[^/]+-\d+\/?$/.test(url.pathname)||
    !url.pathname.replace(/\/$/,'').endsWith(`-${id}`)||url.search||url.hash)throw new TypeError('URL Randstad no autorizada');
  return url.href;
}

function apiOfferDate(value:unknown):string {
  const date=text(value).slice(0,10),instant=Date.parse(`${date}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(instant)||new Date(instant).toISOString().slice(0,10)!==date) {
    throw new TypeError('Fecha Randstad inválida');
  }
  return date;
}

function paragraphs(value:unknown):string[] {return text(value).split(/\n+/).map(part=>part.trim()).filter(Boolean);}

function adaptRandstadApiOffer(offer:RandstadApiOffer,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  const id=String(offer.offerId??''),title=text(offer.title),cityData=object(offer.city),provinceData=object(offer.province);
  const city=text(cityData?.name),province=canonicalSpanishProvince(text(provinceData?.name));
  if(!/^\d+$/.test(id)||!title||!city||!province)return null;
  const publishedAt=apiOfferDate(offer.date);
  const url=apiJobUrl(offer.url,id),resolved=resolveCity(city,province.name);
  if(resolved&&resolved.province!==province.name)throw new TypeError('Ubicación Randstad incoherente');
  const employer=text(offer.publicationCompanyBusiness)||text(offer.company)||'Randstad';
  const description=[...paragraphs(offer.description),...paragraphs(offer.requirements),...paragraphs(offer.conditions)];
  if(!description.length)description.push(`Oferta publicada por ${employer} para ${city}.`,'Consulta el detalle completo en la ficha original.');
  const remote=/remot|teletrabajo/i.test(text(offer.workModality));
  return {kind:'job',sourceId,source:'Randstad · portal oficial',id:`RANDSTAD-${id}`,title,employer,
    city:resolved?.city??city,province:province.name,region:province.region,
    category:'otros',categoryLabel:'Otros',regime:remote?'Remoto':'Oferta de empleo',places:null,
    paragraphs:description,sourceUrl:url,publishedAt,checkedAt,closingDate:null,salary:null,
    applicationRegistration:'external_required',selection:null,location:remote?null:resolved?.location??null};
}

async function fetchApiPage(page:number,fetchImpl:typeof fetch):Promise<unknown> {
  const url=new URL(randstadApiUrl);url.searchParams.set('page',String(page));url.searchParams.set('elements',String(apiPageSize));
  const response=await fetchImpl(url,{headers:{accept:'application/json',origin:'https://www.randstad.es',referer:'https://www.randstad.es/'},
    redirect:'error',signal:AbortSignal.timeout(60_000)});
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('json'))throw new Error('API Randstad no disponible');
  return response.json();
}

async function captureRandstadSnapshot(fetchImpl:typeof fetch):Promise<RandstadApiOffer[]> {
  const first=parseRandstadApiPage(await fetchApiPage(0,fetchImpl),0),offers:RandstadApiOffer[]=[],ids=new Set<string>();
  for(let page=0;page<first.totalPages;page++) {
    const snapshot=page===0?first:parseRandstadApiPage(await fetchApiPage(page,fetchImpl),page);
    if(snapshot.totalCount!==first.totalCount||snapshot.totalPages!==first.totalPages)throw new TypeError('El catálogo Randstad cambió durante la paginación');
    for(const offer of snapshot.offers) {
      const id=String(offer.offerId??'');
      if(!/^\d+$/.test(id)||ids.has(id))throw new TypeError('Oferta Randstad duplicada o sin identificador');
      ids.add(id);
      offers.push(offer);
    }
  }
  if(offers.length!==first.totalCount)throw new TypeError('Captura Randstad incompleta');
  return offers;
}

export async function fetchRandstadOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  let snapshot:RandstadApiOffer[]|undefined,lastError:unknown;
  for(let attempt=0;attempt<2;attempt++) {
    try {snapshot=await captureRandstadSnapshot(fetchImpl);break;}
    catch(error) {lastError=error;}
  }
  if(!snapshot)throw lastError instanceof Error?lastError:new TypeError('Captura Randstad incompleta');
  const found:PublicJob[]=[];
  for(const offer of snapshot) {
    const job=adaptRandstadApiOffer(offer,checkedAt,resolveCity);
    if(job) {
      found.push(job);
    }
  }
  if(!found.length)throw new TypeError('Randstad sin ofertas españolas verificables');
  return found;
}
