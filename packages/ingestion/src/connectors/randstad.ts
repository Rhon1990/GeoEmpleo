import type {CityResolver} from './bizneo.ts';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {attribute,descendants,documentOf,hasClass,textOf} from './html-dom.ts';
import {dateFromSpanish,isRecentPublication} from './shared.ts';

// Randstad's public pg-10 page contains the first 300 results in one response.
export const randstadListingUrl='https://www.randstad.es/candidatos/ofertas-empleo/pg-10/';
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

export async function fetchRandstadOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const response=await fetchImpl(randstadListingUrl,{headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(60_000)});
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('html'))throw new Error('Listado Randstad no disponible');
  const html=await response.text();
  if(html.length>3_000_000)throw new TypeError('Listado Randstad demasiado grande');
  return adaptRandstadListing(html,checkedAt,resolveCity);
}
