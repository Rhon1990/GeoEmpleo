import {createHash} from 'node:crypto';
import type {PublicJob} from '../model.ts';
import {fetchHtml} from '../http.ts';
import {htmlToParagraphs} from '../normalize.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import type {CityResolver} from './bizneo.ts';
import {approximateMunicipalNote} from './shared.ts';
import {fetchTurboStream,listingDocuments} from './teamtailor.ts';
import {attribute,descendants,documentOf,textOf} from './html-dom.ts';

export const alseaListingUrl='https://alseaespana.teamtailor.com/jobs';
const hostname='alseaespana.teamtailor.com';
const pageSize=20;
const maxJobs=2_000;
interface Offer {readonly url:string;readonly title:string}
interface Location {readonly city:string;readonly province:string|null}

function normalized(value:string):string {return value.replace(/\s+/g,' ').trim();}
function validatedUrl(raw:string):string {
  const url=new URL(raw,alseaListingUrl);
  if(url.protocol!=='https:'||url.hostname!==hostname||url.port||url.username||url.password||
    !/^\/jobs\/\d+-[a-z0-9-]+$/i.test(url.pathname)||url.search||url.hash) throw new TypeError('URL Alsea no autorizada');
  return url.href;
}
function offersFromHtml(html:string):Offer[] {
  const document=documentOf(html);
  return descendants(document,element=>element.tagName==='a'&&attribute(element,'data-turbo')==='false').flatMap(link=>{
    const href=attribute(link,'href');
    if(!href||!new URL(href,alseaListingUrl).pathname.startsWith('/jobs/'))return [];
    const titleNode=descendants(link,element=>element.tagName==='span'&&Boolean(attribute(element,'title')))[0];
    const title=normalized(attribute(titleNode??link,'title')??'');
    if(!title)throw new TypeError('Título Alsea ausente');
    return [{url:validatedUrl(href),title}];
  });
}
export function parseAlseaListing(html:string):{offers:Offer[];total:number} {
  const document=documentOf(html);
  const value=descendants(document,element=>element.tagName==='h2').map(element=>/(\d[\d.]*)\s+vacantes\b/i.exec(textOf(element))?.[1]).find(Boolean);
  const total=Number(value?.replace(/\./g,''));
  const offers=offersFromHtml(html);
  if(!Number.isSafeInteger(total)||total<1||total>maxJobs||offers.length!==Math.min(total,pageSize))throw new TypeError('Listado Alsea incompleto');
  if(new Set(offers.map(offer=>offer.url)).size!==offers.length)throw new TypeError('Listado Alsea duplicado');
  return {offers,total};
}
function posting(html:string):Record<string,unknown> {
  const scripts=descendants(documentOf(html),element=>element.tagName==='script'&&attribute(element,'type')==='application/ld+json');
  for(const script of scripts){try{const parsed=JSON.parse(textOf(script)) as unknown;
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&(parsed as {'@type'?:unknown})['@type']==='JobPosting')return parsed as Record<string,unknown>;
  }catch{/* Ignore unrelated JSON-LD. */}}
  throw new TypeError('Ficha Alsea sin JobPosting');
}
function spanishLocations(data:Record<string,unknown>):Location[] {
  const raw=Array.isArray(data.jobLocation)?data.jobLocation:[data.jobLocation];
  if(!raw.length||raw.some(item=>!item||typeof item!=='object'))throw new TypeError('Ficha Alsea sin ubicación verificable');
  const locations=raw.map(item=>{
    const address=(item as {address?:unknown}).address;
    if(!address||typeof address!=='object')throw new TypeError('Ubicación Alsea inválida');
    const fields=address as {addressCountry?:unknown;addressLocality?:unknown;addressRegion?:unknown};
    if(fields.addressCountry!=='ES')throw new TypeError('Ficha Alsea fuera de España');
    const city=typeof fields.addressLocality==='string'?normalized(fields.addressLocality):'';
    if(!city)throw new TypeError('Localidad Alsea ausente');
    return {city,province:typeof fields.addressRegion==='string'?canonicalSpanishProvince(fields.addressRegion)?.name??null:null};
  });
  return [...new Map(locations.map(location=>[`${location.city}\0${location.province??''}`,location])).values()];
}
function adapt(offer:Offer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob[] {
  const document=documentOf(html);const data=posting(html);
  const id=/^\/jobs\/(\d+)-/.exec(new URL(offer.url).pathname)?.[1];
  const heading=descendants(document,element=>element.tagName==='h1')[0];
  const identifier=data.identifier as {value?:unknown}|undefined;
  const title=typeof data.title==='string'?normalized(data.title):'';
  const posted=Date.parse(String(data.datePosted??''));
  if(!id||identifier?.value!==id||!heading||normalized(textOf(heading))!==offer.title||title!==offer.title||
    !Number.isFinite(posted)||posted>Date.parse(checkedAt)+86_400_000||typeof data.description!=='string')throw new TypeError('Ficha Alsea no corresponde al listado');
  const paragraphs=htmlToParagraphs(data.description);if(!paragraphs.length)throw new TypeError('Descripción Alsea vacía');
  const locations=spanishLocations(data);const remote=data.jobLocationType==='TELECOMMUTE';
  return locations.map(location=>{
    const resolved=remote?null:resolveCity(location.city,location.province??undefined);
    const suffix=createHash('sha256').update(`${location.city}\0${location.province??''}`.toLocaleLowerCase('es')).digest('hex').slice(0,12);
    return {kind:'job',sourceId:'teamtailor-alsea',source:'Alsea · portal oficial',id:`TEAMTAILOR-ALSEA-${id}-L${suffix}`,
      title:offer.title,employer:'Alsea',city:resolved?.city??location.city,province:resolved?.province??location.province??'Sin verificar',
      region:resolved?.region??canonicalSpanishProvince(location.province??'')?.region??'España',category:'otros',categoryLabel:'Turismo y hostelería',
      regime:remote?'Remoto':'Oferta de empleo',places:null,paragraphs,sourceUrl:offer.url,publishedAt:new Date(posted).toISOString().slice(0,10),
      checkedAt,closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
      location:resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null} satisfies PublicJob;
  });
}
export async function fetchAlseaOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const first=parseAlseaListing(await fetchHtml(alseaListingUrl,{fetchImpl}));const offers=[...first.offers];
  for(let page=2;page<=Math.ceil(first.total/pageSize);page++){
    const url=new URL('/jobs/show_more',alseaListingUrl);url.searchParams.set('page',String(page));url.searchParams.set('query','');url.searchParams.set('split_view','true');
    const next=listingDocuments(await fetchTurboStream(url.href,fetchImpl,hostname)).flatMap(offersFromHtml);
    if(next.length!==Math.min(pageSize,first.total-offers.length))throw new TypeError('Página Alsea incompleta');offers.push(...next);
  }
  if(offers.length!==first.total||new Set(offers.map(offer=>offer.url)).size!==first.total)throw new TypeError('Captura Alsea incompleta o duplicada');
  const jobs:PublicJob[]=[];
  for(let index=0;index<offers.length;index+=5)jobs.push(...(await Promise.all(offers.slice(index,index+5).map(async offer=>
    adapt(offer,await fetchHtml(offer.url,{fetchImpl}),checkedAt,resolveCity)))).flat());
  if(jobs.length<first.total)throw new TypeError('Fichas Alsea incompletas');
  return jobs;
}
