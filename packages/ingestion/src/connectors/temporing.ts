import {createHash} from 'node:crypto';
import type {PublicJob} from '../model.ts';
import {fetchHtml} from '../http.ts';
import {htmlToParagraphs} from '../normalize.ts';
import type {CityResolver,ResolvedCity} from './bizneo.ts';
import {approximateMunicipalNote} from './shared.ts';
import {fetchTurboStream,listingDocuments} from './teamtailor.ts';
import {attribute,descendants,documentOf,textOf} from './html-dom.ts';

export const temporingListingUrl='https://empleo.temporing.es/jobs';
const hostname='empleo.temporing.es';
const pageSize=20;
const maxJobs=2_000;
interface ListedOffer {readonly url:string;readonly title:string;readonly listedPlace:string}

function normalized(value:string):string{return value.replace(/\s+/g,' ').trim();}
function validatedUrl(raw:string):string {
  const url=new URL(raw,temporingListingUrl);
  if(url.protocol!=='https:'||url.hostname!==hostname||url.port||url.username||url.password||
    !/^\/jobs\/\d+-[a-z0-9-]+$/i.test(url.pathname)||url.search||url.hash)
    throw new TypeError('URL Temporing no autorizada');
  return url.href;
}
function offersFromHtml(html:string):ListedOffer[] {
  const document=documentOf(html);
  return descendants(document,element=>element.tagName==='a'&&attribute(element,'data-turbo')==='false')
    .flatMap(link=>{
      const raw=attribute(link,'href');
      if(!raw||!new URL(raw,temporingListingUrl).pathname.startsWith('/jobs/'))return [];
      const titleNode=descendants(link,element=>element.tagName==='span'&&Boolean(attribute(element,'title')))[0];
      const title=normalized(attribute(titleNode??link,'title')??'');
      const spans=descendants(link,element=>element.tagName==='span').map(textOf).filter(value=>value&&value!=='·');
      const listedPlace=normalized(spans.find((value,index)=>index>=2&&!/^(?:presencial|remot[oa]|híbrido)$/i.test(value))??'');
      if(!title)throw new TypeError('Título Temporing ausente');
      return [{url:validatedUrl(raw),title,listedPlace}];
    });
}
export function parseTemporingListing(html:string):{offers:ListedOffer[];total:number} {
  const document=documentOf(html);
  const value=descendants(document,element=>element.tagName==='h2')
    .map(element=>/\b([\d.]+)\s+vacantes\b/i.exec(textOf(element))?.[1]).find(Boolean);
  const total=Number(value?.replace(/\./g,''));
  const offers=offersFromHtml(html);
  if(!Number.isSafeInteger(total)||total<1||total>maxJobs||offers.length!==Math.min(total,pageSize)||
    new Set(offers.map(offer=>offer.url)).size!==offers.length)throw new TypeError('Listado Temporing incompleto');
  return {offers,total};
}
function jobPosting(html:string):Record<string,unknown> {
  const scripts=descendants(documentOf(html),element=>element.tagName==='script'&&attribute(element,'type')==='application/ld+json');
  for(const script of scripts){
    try{const parsed=JSON.parse(textOf(script)) as unknown;
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&(parsed as {'@type'?:unknown})['@type']==='JobPosting')
        return parsed as Record<string,unknown>;
    }catch{/* Ignore unrelated structured data. */}
  }
  throw new TypeError('Ficha Temporing sin JobPosting');
}
function municipalityFromTitle(title:string,resolveCity:CityResolver):ResolvedCity|null {
  const segments=title.split(/\s+[\/|–—-]\s+|[,;()]/u).map(normalized).filter(Boolean);
  const matches:ResolvedCity[]=[];
  for(const segment of segments){
    const words=segment.split(/\s+/u);
    const candidates=[segment,...Array.from({length:Math.min(words.length,6)},(_,index)=>words.slice(-(index+1)).join(' '))];
    const found=candidates.map(candidate=>({candidate,place:resolveCity(candidate)}))
      .filter((entry):entry is {candidate:string;place:ResolvedCity}=>entry.place!==null)
      .sort((a,b)=>b.candidate.length-a.candidate.length)[0]?.place;
    if(found)matches.push(found);
  }
  const unique=[...new Map(matches.map(place=>[`${place.city}\0${place.province}`,place])).values()];
  return unique.length===1?unique[0]??null:null;
}
export function adaptTemporingDetail(offer:ListedOffer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob[] {
  const document=documentOf(html);
  const data=jobPosting(html);
  const id=/^\/jobs\/(\d+)-/.exec(new URL(offer.url).pathname)?.[1];
  const heading=descendants(document,element=>element.tagName==='h1')[0];
  const identifier=data.identifier as {value?:unknown}|undefined;
  const posted=Date.parse(String(data.datePosted??''));
  if(!id||identifier?.value!==id||!heading||normalized(textOf(heading))!==offer.title||
    normalized(String(data.title??''))!==offer.title||!Number.isFinite(posted)||
    posted>Date.parse(checkedAt)+86_400_000||typeof data.description!=='string')
    throw new TypeError('Ficha Temporing no corresponde al listado');
  const paragraphs=htmlToParagraphs(data.description);
  if(!paragraphs.length)throw new TypeError('Descripción Temporing vacía');
  const raw=Array.isArray(data.jobLocation)?data.jobLocation:[data.jobLocation];
  const locations=raw.flatMap(item=>{
    if(!item||typeof item!=='object')return [];
    const address=(item as {address?:unknown}).address as {addressCountry?:unknown;addressLocality?:unknown}|undefined;
    if(address?.addressCountry&&address.addressCountry!=='ES')throw new TypeError('Ficha Temporing fuera de España');
    return typeof address?.addressLocality==='string'?[normalized(address.addressLocality)]:[];
  });
  return [...new Set(locations.length?locations:[''])].map(city=>{
    const listed=resolveCity(offer.listedPlace);
    const titlePlace=municipalityFromTitle(offer.title,resolveCity);
    const verified=titlePlace??listed;
    const suffix=createHash('sha256').update(city).digest('hex').slice(0,10);
    return {kind:'job',sourceId:'teamtailor-temporing',source:'Temporing · portal oficial',
      id:`TEAMTAILOR-TEMPORING-${id}-L${suffix}`,title:offer.title,employer:'Temporing',
      city:verified?.city??'Ubicación por verificar',province:verified?.province??'Sin verificar',region:verified?.region??'España',
      category:'otros',categoryLabel:'Otros sectores',regime:data.jobLocationType==='TELECOMMUTE'?'Remoto':'Oferta de empleo',
      places:null,paragraphs,sourceUrl:offer.url,publishedAt:new Date(posted).toISOString().slice(0,10),checkedAt,
      closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
      location:verified?.location?{...verified.location,note:approximateMunicipalNote}:null} satisfies PublicJob;
  });
}
export async function fetchTemporingOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const first=parseTemporingListing(await fetchHtml(temporingListingUrl,{fetchImpl}));
  const offers=[...first.offers];
  for(let page=2;page<=Math.ceil(first.total/pageSize);page++){
    const url=new URL('/jobs/show_more',temporingListingUrl);url.searchParams.set('page',String(page));
    const next=listingDocuments(await fetchTurboStream(url.href,fetchImpl,hostname)).flatMap(offersFromHtml);
    if(next.length!==Math.min(pageSize,first.total-offers.length))throw new TypeError('Página Temporing incompleta');
    offers.push(...next);
  }
  if(offers.length!==first.total||new Set(offers.map(offer=>offer.url)).size!==first.total)
    throw new TypeError('Captura Temporing incompleta o duplicada');
  const jobs:PublicJob[]=[];
  for(let index=0;index<offers.length;index+=5)
    jobs.push(...(await Promise.all(offers.slice(index,index+5).map(async offer=>{
      try{return adaptTemporingDetail(offer,await fetchHtml(offer.url,{fetchImpl}),checkedAt,resolveCity);}
      catch(error){throw new TypeError(`Ficha Temporing ${offer.url}: ${String(error)}`);}
    }))).flat());
  if(jobs.length<first.total)throw new TypeError('Detalles Temporing incompletos');
  return jobs;
}
