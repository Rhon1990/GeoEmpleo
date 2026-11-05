import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {htmlToParagraphs} from '../normalize.ts';
import {fetchHtml} from '../http.ts';
import type {CityResolver} from './bizneo.ts';
import {attribute,descendants,documentOf,hasClass,textOf} from './html-dom.ts';

export const giGroupListingUrl='https://es.gigroup.com/ofertas-de-trabajo/';
const sourceId='gigroup-oficial';
export interface GiGroupOffer {readonly id:string;readonly url:string}

function record(value:unknown):Record<string,unknown>|null {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function string(value:unknown):string {return typeof value==='string'?value.trim():'';}
function calendarDate(value:unknown):string {
  const date=string(value).slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) {
    throw new TypeError('Fecha Gi Group inválida');
  }
  return date;
}
function detailUrl(raw:string):GiGroupOffer {
  const url=new URL(raw,giGroupListingUrl);
  const match=/^\/ofertas-de-trabajo-detalle\/[a-z0-9-]+\/(\d+)\/$/.exec(url.pathname);
  if(url.protocol!=='https:'||url.hostname!=='es.gigroup.com'||url.port||url.username||url.password||
    url.search||url.hash||!match)throw new TypeError('URL de detalle Gi Group no autorizada');
  return {id:match[1]!,url:url.href};
}

export function parseGiGroupListing(html:string,page:number):{offers:GiGroupOffer[];lastPage:number} {
  if(!Number.isSafeInteger(page)||page<1||page>100)throw new TypeError('Página Gi Group inválida');
  const doc=documentOf(html);
  const cards=descendants(doc,element=>element.tagName==='a'&&hasClass(element,'ggp-job-title-url'));
  if(!cards.length) {
    const result=descendants(doc,element=>hasClass(element,'ggp-job-results'))[0];
    if(page===1||!result||!/Lo sentimos, tu búsqueda no ha generado resultados\./.test(textOf(result))) {
      throw new TypeError('Listado Gi Group inesperado');
    }
  }
  const offers=cards.map(card=>detailUrl(attribute(card,'href')??''));
  if(new Set(offers.map(item=>item.id)).size!==offers.length)throw new TypeError('IDs Gi Group duplicados');
  const pagination=descendants(doc,element=>element.tagName==='a'||element.tagName==='link');
  let lastPage=page;
  for(const element of pagination) {
    const href=attribute(element,'href');
    if(!href)continue;
    const url=new URL(href,giGroupListingUrl);
    if(url.origin!==new URL(giGroupListingUrl).origin||url.pathname!==new URL(giGroupListingUrl).pathname)continue;
    const n=Number(url.searchParams.get('npage'));
    if(Number.isSafeInteger(n)&&n>100)throw new TypeError('Paginación Gi Group supera el límite');
    if(Number.isSafeInteger(n)&&n>=1)lastPage=Math.max(lastPage,n);
  }
  return {offers,lastPage};
}

async function captureGiGroup(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch):Promise<PublicJob[]> {
  const offers:GiGroupOffer[]=[];
  const ids=new Set<string>();
  let emptyPages=0;
  for(let page=1;page<=100;page++) {
    const listingUrl=page===1?giGroupListingUrl:`${giGroupListingUrl}?npage=${page}`;
    const parsed=parseGiGroupListing(await fetchHtml(listingUrl,{fetchImpl}),page);
    if(parsed.offers.length===0) {
      emptyPages++;
      if(emptyPages===2)break;
    } else {
      if(emptyPages)throw new TypeError('Hueco en la paginación Gi Group');
      for(const offer of parsed.offers) {
        if(ids.has(offer.id))throw new TypeError('ID Gi Group repetido entre páginas');
        ids.add(offer.id);offers.push(offer);
      }
    }
    if(offers.length>2500)throw new TypeError('Gi Group supera el límite de fichas');
    if(page===100)throw new TypeError('Gi Group no confirmó el final de la paginación');
  }
  if(!offers.length)throw new TypeError('Gi Group sin ofertas');
  const jobs:PublicJob[]=[];
  for(let i=0;i<offers.length;i+=4) {
    const batch=await Promise.all(offers.slice(i,i+4).map(async offer=>
      adaptGiGroupDetail(offer,await fetchHtml(offer.url,{fetchImpl}),checkedAt,resolveCity)));
    for(const job of batch)if(job)jobs.push(job);
  }
  if(!jobs.length)throw new TypeError('Gi Group sin ofertas españolas vigentes');
  return jobs;
}

export async function fetchGiGroupOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  let error:unknown;
  for(let attempt=0;attempt<2;attempt++) {
    try{return await captureGiGroup(checkedAt,resolveCity,fetchImpl);}
    catch(caught){error=caught;}
  }
  throw error instanceof Error?error:new TypeError('Captura Gi Group incompleta');
}

export function adaptGiGroupDetail(offer:GiGroupOffer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  if(detailUrl(offer.url).id!==offer.id)throw new TypeError('ID y URL Gi Group distintos');
  const doc=documentOf(html);
  const scripts=descendants(doc,element=>element.tagName==='script'&&attribute(element,'type')==='application/ld+json');
  let posting:Record<string,unknown>|null=null;
  for(const script of scripts) {
    const payload=JSON.parse(textOf(script)) as unknown;
    const root=record(payload);
    const entries=Array.isArray(payload)?payload:root&&Array.isArray(root['@graph'])?root['@graph']:[payload];
    for(const entry of entries) {
      const candidate=record(entry);
      if(candidate?.['@type']==='JobPosting')posting=candidate;
    }
  }
  if(!posting)throw new TypeError('JobPosting Gi Group ausente');
  const id=string(record(posting.identifier)?.value);
  if(id!==offer.id)throw new TypeError('ID Gi Group incoherente');
  const title=string(posting.title),description=string(posting.description);
  const address=record(record(posting.jobLocation)?.address);
  const city=string(address?.addressLocality),province=canonicalSpanishProvince(string(address?.addressRegion));
  const country=string(address?.addressCountry)||string(record(address?.addressCountry)?.name);
  const publishedAt=calendarDate(posting.datePosted);
  const closingDate=posting.validThrough?calendarDate(posting.validThrough):null;
  if(!title||!description||!city)throw new TypeError('Ficha Gi Group incompleta');
  if(!province||country&&!/^(ES|España|Spain)$/i.test(country)||closingDate&&closingDate<checkedAt.slice(0,10))return null;
  const remote=string(posting.jobLocationType).toUpperCase()==='TELECOMMUTE';
  const resolved=remote?null:resolveCity(city,province.name);
  if(resolved&&resolved.province!==province.name)throw new TypeError('Ubicación Gi Group incoherente');
  return {kind:'job',sourceId,source:'Gi Group · portal oficial',id:`GIGROUP-${id}`,title,
    employer:'Gi Group',city:resolved?.city??city,province:province.name,region:province.region,
    category:'otros',categoryLabel:'Otros',regime:'Oferta de empleo',places:null,
    paragraphs:htmlToParagraphs(description),sourceUrl:offer.url,publishedAt,checkedAt,closingDate,
    salary:null,applicationRegistration:'external_required',selection:null,location:resolved?.location??null};
}
