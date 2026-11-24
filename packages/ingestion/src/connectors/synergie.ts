import type {PublicJob} from '../model.ts';
import {fetchHtml} from '../http.ts';
import {htmlToParagraphs} from '../normalize.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import type {CityResolver} from './bizneo.ts';
import {attribute,descendants,documentOf} from './html-dom.ts';
import {approximateMunicipalNote} from './shared.ts';

export const synergieListingUrl='https://www.synergie.es/busco-trabajo/';
interface SynergieOffer {
  id:number;title:string;city:string;province:string|null;description:string;requirements:string;
  publishedAt:string;closingDate:string|null;places:number|null;status:number;sourceUrl:string;
}

function decodeAstro(value:unknown):unknown {
  if(Array.isArray(value)&&value.length===2&&typeof value[0]==='number') {
    if(value[0]===1&&Array.isArray(value[1])) return value[1].map(decodeAstro);
    if(value[0]===0) return decodeAstro(value[1]);
  }
  if(value&&typeof value==='object'&&!Array.isArray(value))
    return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,decodeAstro(entry)]));
  return value;
}

function sourceUrl(raw:unknown):string {
  const url=new URL(String(raw),synergieListingUrl);
  if(url.protocol!=='https:'||url.hostname!=='www.synergie.es'||url.port||url.username||url.password||
    !/^\/busco-trabajo\/[a-z0-9][a-z0-9-]*\/?$/i.test(url.pathname)||url.search||url.hash)
    throw new TypeError('URL Synergie no autorizada');
  return url.href;
}

export function parseSynergieListing(html:string):SynergieOffer[] {
  const island=descendants(documentOf(html),element=>element.tagName==='astro-island'&&attribute(element,'component-export')==='OfferList')[0];
  const props=island?attribute(island,'props'):null;
  if(!props) throw new TypeError('Listado Synergie ausente');
  const parsed=decodeAstro(JSON.parse(props)) as {offers?:unknown};
  if(!Array.isArray(parsed.offers)||!parsed.offers.length||parsed.offers.length>5_000)
    throw new TypeError('Volumen Synergie inesperado');
  const ids=new Set<number>();
  return parsed.offers.map(value=>{
    if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Oferta Synergie inválida');
    const row=value as Record<string,unknown>;
    const id=Number(row.id);
    const title=typeof row.title==='string'?row.title.trim():'';
    const city=typeof row.city==='string'?row.city.trim():'';
    const provinceRow=row.posting_province_id as {NOMBRE_PROV?:unknown}|null;
    const province=typeof provinceRow?.NOMBRE_PROV==='string'?canonicalSpanishProvince(provinceRow.NOMBRE_PROV)?.name??null:null;
    const publishedAt=typeof row.date_init==='string'?row.date_init:'';
    const closingDate=typeof row.date_end==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date_end)?row.date_end:null;
    if(!Number.isSafeInteger(id)||id<1||ids.has(id)||!title||!city||!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt))
      throw new TypeError('Oferta Synergie incompleta o duplicada');
    ids.add(id);
    return {id,title,city,province,description:String(row.description??''),requirements:String(row.requirements??''),
      publishedAt,closingDate,places:Number.isSafeInteger(row.number_vacancies)&&Number(row.number_vacancies)>0?Number(row.number_vacancies):null,
      status:Number(row.status),sourceUrl:sourceUrl(row.url)};
  });
}

export async function fetchSynergieOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const listed=parseSynergieListing(await fetchHtml(synergieListingUrl,{fetchImpl,maxBytes:10_000_000}));
  const today=checkedAt.slice(0,10);
  const seen=new Set<string>();
  const jobs:PublicJob[]=[];
  for(const offer of listed){
    if(offer.status!==1||offer.publishedAt>today||(offer.closingDate!==null&&offer.closingDate<today)||
      /^(?:deja tu cv|autocandidatura)\b/i.test(offer.title)) continue;
    const key=`${offer.sourceUrl}\u0000${offer.city}`;
    if(seen.has(key))continue;
    const paragraphs=htmlToParagraphs(`${offer.description}<br>${offer.requirements}`);
    if(!paragraphs.length)continue;
    seen.add(key);
    const resolved=offer.province?resolveCity(offer.city,offer.province):null;
    jobs.push({kind:'job',sourceId:'synergie-oficial',source:'Synergie · portal oficial',id:`SYNERGIE-${offer.id}`,
      title:offer.title,employer:'Synergie',city:resolved?.city??offer.city,
      province:resolved?.province??offer.province??'Sin verificar',region:resolved?.region??canonicalSpanishProvince(offer.province??'')?.region??'España',
      category:'otros',categoryLabel:'Otros sectores',regime:'Oferta de empleo',places:offer.places,
      paragraphs,sourceUrl:offer.sourceUrl,publishedAt:offer.publishedAt,checkedAt,closingDate:offer.closingDate,
      salary:null,applicationRegistration:'external_required',selection:null,
      location:resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null});
  }
  if(!jobs.length)throw new TypeError('Synergie no devolvió ofertas vigentes');
  return jobs;
}
