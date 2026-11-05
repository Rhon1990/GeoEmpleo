import type {PublicJob} from '../model.ts';
import {fetchHtml} from '../http.ts';
import {htmlToParagraphs} from '../normalize.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import type {CityResolver} from './bizneo.ts';
import {attribute,descendants,documentOf,textOf} from './html-dom.ts';
import {approximateMunicipalNote} from './shared.ts';
import {fetchTurboStream,listingDocuments} from './teamtailor.ts';

export const leroyMerlinListingUrl='https://empleo.leroymerlin.es/jobs';
const hostname='empleo.leroymerlin.es';
const pageSize=20;
const maxJobs=2000;

interface ListedOffer {readonly url:string;readonly title:string}
const normalizedTitle=(title:string)=>title.replace(/\s+/g,' ').trim();

function validatedUrl(raw:string):string {
  const url=new URL(raw,leroyMerlinListingUrl);
  if(url.protocol!=='https:'||url.hostname!==hostname||url.port||url.username||url.password||
    !/^\/jobs\/\d+-[a-z0-9-]+$/i.test(url.pathname)||url.search||url.hash)
    throw new TypeError('URL Leroy Merlin no autorizada');
  return url.href;
}

function offersFromHtml(html:string):ListedOffer[] {
  const document=documentOf(html);
  return descendants(document,element=>element.tagName==='a'&&attribute(element,'data-turbo')==='false')
    .flatMap(link=>{
      const href=attribute(link,'href');
      if(!href||!new URL(href,leroyMerlinListingUrl).pathname.startsWith('/jobs/'))return [];
      const titleElement=descendants(link,element=>element.tagName==='span'&&attribute(element,'title')!==null)[0];
      const title=titleElement&&normalizedTitle(attribute(titleElement,'title')??'');
      if(!title)throw new TypeError('Título Leroy Merlin ausente');
      return [{url:validatedUrl(href),title}];
    });
}

export function parseLeroyMerlinListing(html:string):{offers:ListedOffer[];total:number} {
  const document=documentOf(html);
  const totalText=descendants(document,element=>element.tagName==='h2')
    .map(element=>/\b([\d.]+)\s+vacantes\b/i.exec(textOf(element))?.[1]).find(Boolean);
  const total=Number(totalText?.replace(/\./g,''));
  const offers=offersFromHtml(html);
  if(!Number.isSafeInteger(total)||total<1||total>maxJobs||offers.length!==Math.min(total,pageSize))
    throw new TypeError('Listado Leroy Merlin incompleto');
  return {offers,total};
}

function parseMorePage(html:string):ListedOffer[] {
  const offers=listingDocuments(html).flatMap(offersFromHtml);
  if(!offers.length||offers.length>pageSize)throw new TypeError('Página Leroy Merlin incompleta');
  return offers;
}

function cityFromTitle(title:string,province:string|null,resolveCity:CityResolver) {
  const clean=title.replace(/\s+-\s+JR\d+$/i,'').replace(/\s+\([^)]*\)\s*$/,'').trim();
  const words=clean.split(/\s+/);
  for(let size=Math.min(5,words.length);size>=1;size--) {
    const candidate=words.slice(-size).join(' ').replace(/^[,.;:]+|[,.;:]+$/g,'');
    const resolved=resolveCity(candidate,province??undefined);
    if(resolved&&(!province||resolved.province===province))return resolved;
  }
  return null;
}

function adaptDetail(offer:ListedOffer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const document=documentOf(html);
  const script=descendants(document,element=>element.tagName==='script'&&attribute(element,'type')==='application/ld+json')[0];
  if(!script)throw new TypeError('Ficha Leroy Merlin sin JobPosting');
  const posting=JSON.parse(textOf(script)) as Record<string,unknown>;
  const id=/^\/jobs\/(\d+)-/.exec(new URL(offer.url).pathname)?.[1];
  const identifier=posting.identifier as {value?:unknown}|undefined;
  const heading=descendants(document,element=>element.tagName==='h1')[0];
  const posted=Date.parse(String(posting.datePosted??''));
  if(posting['@type']!=='JobPosting'||!id||identifier?.value!==id||typeof posting.title!=='string'||
    normalizedTitle(posting.title)!==offer.title||!heading||normalizedTitle(textOf(heading))!==offer.title||
    !Number.isFinite(posted)||posted>Date.parse(checkedAt)+86_400_000||
    typeof posting.description!=='string')throw new TypeError(`Ficha Leroy Merlin ${id??'desconocida'} no corresponde al listado`);
  const paragraphs=htmlToParagraphs(posting.description);
  if(!paragraphs.length)throw new TypeError('Descripción Leroy Merlin vacía');
  const rawLocations=Array.isArray(posting.jobLocation)?posting.jobLocation:[posting.jobLocation];
  if(!rawLocations.length||rawLocations.some(raw=>{
    const address=raw&&typeof raw==='object'?(raw as {address?:{addressCountry?:unknown}}).address:null;
    return !address||address.addressCountry!=='ES';
  }))throw new TypeError('País Leroy Merlin no verificable o fuera de España');
  const single=rawLocations.length===1?(rawLocations[0] as {address:{addressLocality?:unknown;addressRegion?:unknown}}).address:null;
  const city=single&&typeof single.addressLocality==='string'?single.addressLocality.trim():null;
  const province=single&&typeof single.addressRegion==='string'?canonicalSpanishProvince(single.addressRegion):null;
  const remote=posting.jobLocationType==='TELECOMMUTE'||/\b(remot[oa]|teletrabajo)\b/i.test(offer.title);
  // Teamtailor sometimes advertises a store in the title but puts a different
  // administrative city in JobPosting. Only a municipality confirmed in both
  // the title and national gazetteer receives a marker.
  const verified=single&&!remote?cityFromTitle(offer.title,province?.name??null,resolveCity):null;
  const location=verified?.location?{...verified.location,note:approximateMunicipalNote}:null;
  return {
    kind:'job',sourceId:'teamtailor-leroy',source:'Leroy Merlin · portal oficial',
    id:`TEAMTAILOR-LEROY-${id}`,title:offer.title,employer:'Leroy Merlin',
    city:verified?.city??city??'Varias ubicaciones',province:verified?.province??province?.name??'Sin verificar',
    region:verified?.region??province?.region??'España',category:'servicios',categoryLabel:'Servicios y comercio',
    regime:remote?'Remoto':'Oferta de empleo',places:null,paragraphs,sourceUrl:offer.url,
    publishedAt:new Date(posted).toISOString().slice(0,10),checkedAt,closingDate:null,salary:null,
    applicationRegistration:'external_required',selection:null,location,
  };
}

export async function fetchLeroyMerlinOffers(
  checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  const first=parseLeroyMerlinListing(await fetchHtml(leroyMerlinListingUrl,{fetchImpl}));
  const offers=[...first.offers];
  const pages=Math.ceil(first.total/pageSize);
  for(let page=2;page<=pages;page++) {
    const url=new URL(`/jobs/show_more?page=${page}`,leroyMerlinListingUrl);
    const next=parseMorePage(await fetchTurboStream(url.href,fetchImpl,hostname));
    if(next.length!==Math.min(pageSize,first.total-offers.length))throw new TypeError('Paginación Leroy Merlin incompleta');
    offers.push(...next);
  }
  if(offers.length!==first.total||new Set(offers.map(offer=>offer.url)).size!==first.total)
    throw new TypeError('Captura Leroy Merlin incompleta o duplicada');
  const jobs:PublicJob[]=[];
  for(let index=0;index<offers.length;index+=5)
    jobs.push(...await Promise.all(offers.slice(index,index+5).map(async offer=>
      adaptDetail(offer,await fetchHtml(offer.url,{fetchImpl}),checkedAt,resolveCity))));
  return jobs;
}
