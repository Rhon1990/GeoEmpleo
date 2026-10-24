import type { PublicJob } from '../model.ts';
import { fetchHtml } from '../http.ts';
import { htmlToParagraphs } from '../normalize.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import type { CityResolver } from './bizneo.ts';
import { attribute, descendants, documentOf, hasClass, innerHtml, textOf } from './html-dom.ts';

export const kfcListingUrl='https://careers.amrest.eu/KFC/go/Jobs-KFC-ES/9158355/';
export interface KfcListedOffer {readonly url:string;readonly title:string;readonly city:string;readonly provinceHint:string|null;readonly listedDate:string}

function kfcUrl(raw:string):string {
  const url=new URL(raw,'https://careers.amrest.eu');
  if(url.protocol!=='https:'||url.hostname!=='careers.amrest.eu'||url.port||url.username||url.password||
    !/^\/KFC\/job\/[^/]+\/\d+\/$/.test(url.pathname)||url.search||url.hash) throw new TypeError('URL KFC no autorizada');
  return url.href;
}

export function parseKfcListing(html:string):{offers:KfcListedOffer[];pageCount:number} {
  const document=documentOf(html);
  const rows=descendants(document,element=>element.tagName==='tr'&&hasClass(element,'data-row'));
  if(!rows.length) throw new TypeError('Listado KFC vacío');
  const offers=rows.map(row=>{
    const link=descendants(row,element=>element.tagName==='a'&&hasClass(element,'jobTitle-link'))[0];
    const locationCell=descendants(row,element=>element.tagName==='td'&&hasClass(element,'colLocation'))[0];
    const dateCell=descendants(row,element=>element.tagName==='td'&&hasClass(element,'colDate'))[0];
    const raw=link&&attribute(link,'href');
    const location=locationCell?textOf(locationCell):'';
    const match=/^(.+?)(?:\s*\(([^)]+)\))?,\s*ES(?:,\s*\d{1,5})?$/.exec(location);
    if(!raw||!match||!dateCell) throw new TypeError('Fila KFC incompleta');
    const parts=match[1]!.split(',').map(part=>part.trim()).filter(Boolean);
    const inferredProvince=parts.length===2&&canonicalSpanishProvince(parts[1]!)?parts[1]:null;
    return {url:kfcUrl(raw),title:textOf(link),city:(inferredProvince?parts[0]:match[1])!.trim(),
      provinceHint:match[2]??inferredProvince,listedDate:textOf(dateCell)};
  });
  const label=descendants(document,element=>hasClass(element,'paginationLabel'))[0];
  const total=label?/\bde\s+(\d+)\b/.exec(textOf(label))?.[1]:null;
  const pageCount=total?Math.ceil(Number(total)/30):1;
  if(pageCount<1||pageCount>20) throw new TypeError('Paginación KFC inválida');
  return {offers,pageCount};
}

export function adaptKfcDetail(offer:KfcListedOffer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const document=documentOf(html);
  const title=descendants(document,element=>attribute(element,'id')==='job-title')[0];
  const date=descendants(document,element=>element.tagName==='meta'&&attribute(element,'itemprop')==='datePosted')[0];
  const description=descendants(document,element=>attribute(element,'itemprop')==='description')[0];
  if(!title||textOf(title)!==offer.title||!date||!description) throw new TypeError('Detalle KFC inválido');
  const posted=Date.parse(attribute(date,'content')??'');
  if(!Number.isFinite(posted)||posted>Date.parse(checkedAt)+86_400_000) throw new TypeError('Fecha KFC inválida');
  const paragraphs=htmlToParagraphs(innerHtml(description));
  if(!paragraphs.length) throw new TypeError('Descripción KFC vacía');
  const resolved=resolveCity(offer.city);
  const province=canonicalSpanishProvince(offer.provinceHint??resolved?.province??'');
  const sameProvince=!!province&&province.name===resolved?.province;
  const id=/\/(\d+)\/$/.exec(new URL(offer.url).pathname)?.[1];
  if(!id) throw new TypeError('ID KFC no verificable');
  return {kind:'job',sourceId:'amrest-kfc',source:'KFC · AmRest',id:`AMREST-KFC-${id}`,
    title:offer.title,employer:'KFC · AmRest',city:offer.city,province:province?.name??'Sin verificar',region:province?.region??'España',
    category:'hosteleria',categoryLabel:'Turismo y hostelería',regime:'Oferta de empleo',places:null,
    paragraphs,sourceUrl:offer.url,publishedAt:new Date(posted).toISOString().slice(0,10),checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:sameProvince?resolved!.location:null};
}

export async function fetchKfcOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const listed=new Map<string,KfcListedOffer>();
  const first=parseKfcListing(await fetchHtml(kfcListingUrl,{fetchImpl}));
  for(const offer of first.offers) listed.set(offer.url,offer);
  for(let page=2;page<=first.pageCount;page++){
    const url=new URL(`/KFC/go/Jobs-KFC-ES/9158355/${(page-1)*30}/?q=&sortColumn=referencedate&sortDirection=desc`,'https://careers.amrest.eu');
    const parsed=parseKfcListing(await fetchHtml(url.href,{fetchImpl}));
    for(const offer of parsed.offers){if(listed.has(offer.url)) throw new TypeError('Oferta KFC duplicada');listed.set(offer.url,offer);}
  }
  const jobs:PublicJob[]=[];
  const offers=[...listed.values()];
  for(let index=0;index<offers.length;index+=5) jobs.push(...await Promise.all(offers.slice(index,index+5).map(async offer=>
    adaptKfcDetail(offer,await fetchHtml(offer.url,{fetchImpl}),checkedAt,resolveCity))));
  return jobs;
}
