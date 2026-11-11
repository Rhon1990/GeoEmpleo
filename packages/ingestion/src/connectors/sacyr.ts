import type {PublicJob} from '../model.ts';
import {fetchHtml} from '../http.ts';
import {htmlToParagraphs} from '../normalize.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import type {CityResolver} from './bizneo.ts';
import {approximateMunicipalNote} from './shared.ts';
import {fetchTurboStream,listingDocuments} from './teamtailor.ts';
import {attribute,descendants,documentOf,textOf} from './html-dom.ts';

export const sacyrListingUrl='https://sacyrpeople.sacyr.com/jobs?country=Spain&query=&split_view=true';
const hostname='sacyrpeople.sacyr.com';
const pageSize=20;
const maxJobs=2_000;

interface ListedOffer {readonly url:string;readonly title:string}
interface ParsedListing {readonly offers:ListedOffer[];readonly total:number}
interface LocationAddress {readonly city:string;readonly province:string|null}

function normalized(value:string):string {return value.replace(/\s+/g,' ').trim();}

function validatedUrl(raw:string):string {
  const url=new URL(raw,sacyrListingUrl);
  if(url.protocol!=='https:'||url.hostname!==hostname||url.port||url.username||url.password||
    !/^\/jobs\/\d+-[a-z0-9-]+$/i.test(url.pathname)||url.search||url.hash)
    throw new TypeError('URL Sacyr no autorizada');
  return url.href;
}

function offersFromHtml(html:string):ListedOffer[] {
  const document=documentOf(html);
  return descendants(document,element=>element.tagName==='a'&&attribute(element,'data-turbo')==='false')
    .flatMap(link=>{
      const href=attribute(link,'href');
      if(!href||!new URL(href,sacyrListingUrl).pathname.startsWith('/jobs/')) return [];
      const title=normalized(textOf(link));
      if(!title) throw new TypeError('Título Sacyr ausente');
      return [{url:validatedUrl(href),title}];
    });
}

function totalFromHtml(html:string):number {
  const document=documentOf(html);
  const value=descendants(document,element=>element.tagName==='h2')
    .map(element=>/\b([\d.]+)\s+vacantes\b/i.exec(textOf(element))?.[1]).find(Boolean);
  const total=Number(value?.replace(/\./g,''));
  if(!Number.isSafeInteger(total)||total<1||total>maxJobs) throw new TypeError('Total Sacyr inesperado');
  return total;
}

export function parseSacyrListing(html:string):ParsedListing {
  const total=totalFromHtml(html);
  const offers=offersFromHtml(html);
  if(offers.length!==Math.min(total,pageSize)) throw new TypeError('Listado Sacyr incompleto');
  if(new Set(offers.map(offer=>offer.url)).size!==offers.length) throw new TypeError('Listado Sacyr duplicado');
  return {offers,total};
}

function parseSacyrMorePage(html:string):ListedOffer[] {
  const offers=listingDocuments(html).flatMap(offersFromHtml);
  if(!offers.length||offers.length>pageSize||new Set(offers.map(offer=>offer.url)).size!==offers.length)
    throw new TypeError('Página Sacyr incompleta');
  return offers;
}

function jobPosting(html:string):Record<string,unknown> {
  const document=documentOf(html);
  const scripts=descendants(document,element=>element.tagName==='script'&&attribute(element,'type')==='application/ld+json');
  for(const script of scripts) {
    try {
      const parsed=JSON.parse(textOf(script)) as unknown;
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&(parsed as {'@type'?:unknown})['@type']==='JobPosting')
        return parsed as Record<string,unknown>;
    } catch { /* Ignore unrelated structured data. */ }
  }
  throw new TypeError('Ficha Sacyr sin JobPosting');
}

function spanishLocations(posting:Record<string,unknown>):LocationAddress[] {
  const raw=Array.isArray(posting.jobLocation)?posting.jobLocation:[posting.jobLocation];
  if(!raw.length) throw new TypeError('Ficha Sacyr sin ubicación');
  const locations=raw.map(item=>{
    const address=item&&typeof item==='object'?(item as {address?:unknown}).address:null;
    if(!address||typeof address!=='object') throw new TypeError('Ubicación Sacyr inválida');
    const fields=address as {addressCountry?:unknown;addressLocality?:unknown;addressRegion?:unknown};
    if(fields.addressCountry!=='ES') throw new TypeError('Ficha Sacyr fuera de España');
    const city=typeof fields.addressLocality==='string'?normalized(fields.addressLocality):'';
    if(!city) throw new TypeError('Localidad Sacyr ausente');
    const province=typeof fields.addressRegion==='string'?canonicalSpanishProvince(fields.addressRegion)?.name??null:null;
    return {city,province};
  });
  return [...new Map(locations.map(location=>[`${location.city}\u0000${location.province??''}`,location])).values()];
}

function adaptSacyrDetail(offer:ListedOffer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const document=documentOf(html);
  const posting=jobPosting(html);
  const id=/^\/jobs\/(\d+)-/.exec(new URL(offer.url).pathname)?.[1];
  const heading=descendants(document,element=>element.tagName==='h1')[0];
  const identifier=posting.identifier as {value?:unknown}|undefined;
  const title=typeof posting.title==='string'?normalized(posting.title):'';
  const posted=Date.parse(String(posting.datePosted??''));
  if(!id||identifier?.value!==id||!heading||normalized(textOf(heading))!==offer.title||title!==offer.title||
    !Number.isFinite(posted)||posted>Date.parse(checkedAt)+86_400_000||typeof posting.description!=='string')
    throw new TypeError('Ficha Sacyr no corresponde al listado');
  const paragraphs=htmlToParagraphs(posting.description);
  if(!paragraphs.length) throw new TypeError('Descripción Sacyr vacía');
  const locations=spanishLocations(posting);
  const single=locations.length===1?locations[0]??null:null;
  const province=single?.province?canonicalSpanishProvince(single.province):null;
  const remote=posting.jobLocationType==='TELECOMMUTE'||/\b(remot[oa]|teletrabajo)\b/i.test(`${offer.title} ${paragraphs.join(' ')}`);
  const resolved=single&&!remote?resolveCity(single.city,single.province??undefined):null;
  const location=resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null;
  return {
    kind:'job',sourceId:'sacyr-oficial',source:'Sacyr · portal oficial',id:`TEAMTAILOR-SACYR-${id}`,
    title:offer.title,employer:'Sacyr',city:resolved?.city??(single?.city??'Varias ubicaciones'),
    province:resolved?.province??single?.province??'Sin verificar',region:resolved?.region??province?.region??'España',
    category:'otros',categoryLabel:'Ingeniería y construcción',regime:remote?'Remoto':'Oferta de empleo',places:null,
    paragraphs,sourceUrl:offer.url,publishedAt:new Date(posted).toISOString().slice(0,10),checkedAt,closingDate:null,
    salary:null,applicationRegistration:'external_required',selection:null,location,
  };
}

export async function fetchSacyrOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const first=parseSacyrListing(await fetchHtml(sacyrListingUrl,{fetchImpl}));
  const offers=[...first.offers];
  for(let page=2;page<=Math.ceil(first.total/pageSize);page++) {
    const url=new URL('/jobs/show_more',sacyrListingUrl);
    url.searchParams.set('country','Spain');
    url.searchParams.set('page',String(page));
    url.searchParams.set('query','');
    url.searchParams.set('split_view','true');
    const next=parseSacyrMorePage(await fetchTurboStream(url.href,fetchImpl,hostname));
    if(next.length!==Math.min(pageSize,first.total-offers.length)) throw new TypeError('Página Sacyr incompleta');
    offers.push(...next);
  }
  if(offers.length!==first.total||new Set(offers.map(offer=>offer.url)).size!==first.total)
    throw new TypeError('Captura Sacyr incompleta o duplicada');
  const jobs:PublicJob[]=[];
  for(let index=0;index<offers.length;index+=5)
    jobs.push(...await Promise.all(offers.slice(index,index+5).map(async offer=>
      adaptSacyrDetail(offer,await fetchHtml(offer.url,{fetchImpl}),checkedAt,resolveCity))));
  if(jobs.length!==first.total) throw new TypeError('Detalles Sacyr incompletos');
  return jobs;
}
