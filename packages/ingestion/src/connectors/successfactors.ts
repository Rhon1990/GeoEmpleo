import type { PublicJob } from '../model.ts';
import { fetchHtml, retryTransient } from '../http.ts';
import { htmlToParagraphs } from '../normalize.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import type { CityResolver } from './bizneo.ts';
import { approximateMunicipalNote } from './shared.ts';
import { attribute, descendants, documentOf, hasClass, innerHtml, textOf } from './html-dom.ts';

export interface SuccessFactorsBoard {
  readonly sourceId:string;
  readonly hostname:string;
  readonly employer:string;
  readonly listingPath:string;
  readonly jobPathPattern:RegExp;
  readonly category:string;
  readonly categoryLabel:string;
  readonly sourceLabel:string;
  readonly idPrefix?:string;
  readonly requireCityMentionInTitle?:boolean;
  readonly skipVerifiedClosed?:boolean;
  readonly skipEmptyDescription?:boolean;
  readonly retryTransientErrors?:boolean;
  readonly remoteFromDescription?:boolean;
  readonly paginationOffsetParam?:'startrow';
  readonly listingFormat?:'table'|'tile';
  readonly paginationPath?:string;
  readonly excludedJobPathPattern?:RegExp;
  readonly pageSize:number;
  readonly maxPages:number;
}

export interface SuccessFactorsListedOffer {
  readonly url:string;
  readonly title:string;
  readonly city:string;
  readonly provinceHint:string|null;
  readonly listedDate:string;
  readonly ambiguousLocation:boolean;
}

function validatedJobUrl(raw:string,board:SuccessFactorsBoard):string {
  const url=new URL(raw,`https://${board.hostname}`);
  board.jobPathPattern.lastIndex=0;
  if(url.protocol!=='https:'||url.hostname!==board.hostname||url.port||url.username||url.password||
    !board.jobPathPattern.test(url.pathname)||url.search||url.hash) throw new TypeError('URL SuccessFactors no autorizada');
  return url.href;
}

function locationParts(raw:string):{city:string;provinceHint:string|null;ambiguousLocation:boolean} {
  const normalized=raw.replace(/\s+/g,' ').trim();
  const withoutCountry=normalized.replace(/,?\s*(?:ES(?:,\s*\d{1,5})?|España)\s*$/i,'').trim();
  const parenthesized=/^(.+?)\s*\(([^)]+)\)$/.exec(withoutCountry);
  if(parenthesized) return {city:parenthesized[1]!.trim(),provinceHint:parenthesized[2]!.trim(),ambiguousLocation:false};
  const parts=withoutCountry.split(',').map(part=>part.trim()).filter(Boolean);
  if(parts.length===1) return {city:parts[0]??normalized,provinceHint:null,ambiguousLocation:false};
  if(parts.length===2&&/^[A-Z]{1,2}$/.test(parts[1]!)) {
    return {city:parts[0]!,provinceHint:null,ambiguousLocation:false};
  }
  if(parts.length===2&&canonicalSpanishProvince(parts[1]!)) {
    return {city:parts[0]!,provinceHint:parts[1]!,ambiguousLocation:false};
  }
  return {city:withoutCountry||normalized,provinceHint:null,ambiguousLocation:true};
}

function cityMentionedInTitle(city:string,title:string):boolean {
  const normalize=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es-ES');
  const cityName=normalize(city);
  const escaped=cityName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,'i').test(normalize(title));
}

export function parseSuccessFactorsListing(html:string,board:SuccessFactorsBoard):{offers:SuccessFactorsListedOffer[];excludedUrls:string[];observedUrls:string[];pageCount:number;totalCount:number|null} {
  const document=documentOf(html);
  const tile=board.listingFormat==='tile';
  const rows=descendants(document,element=>tile?
    element.tagName==='li'&&hasClass(element,'job-tile'):
    element.tagName==='tr'&&hasClass(element,'data-row'));
  if(!rows.length) throw new TypeError('Listado SuccessFactors vacío');
  const seen=new Set<string>();
  const excludedUrls:string[]=[];
  const observedUrls:string[]=[];
  const offers=rows.flatMap(row=>{
    const link=descendants(row,element=>element.tagName==='a'&&hasClass(element,'jobTitle-link'))[0];
    const locationField=descendants(row,element=>tile?
      hasClass(element,'section-field')&&(hasClass(element,'location')||hasClass(element,'city')):
      element.tagName==='td'&&hasClass(element,'colLocation'))[0];
    const locationCell=tile&&locationField?descendants(locationField,element=>element!==locationField&&element.tagName==='div')[0]:locationField;
    const dateField=descendants(row,element=>tile?
      hasClass(element,'section-field')&&hasClass(element,'date'):
      element.tagName==='td'&&hasClass(element,'colDate'))[0];
    const dateCell=tile&&dateField?descendants(dateField,element=>element!==dateField&&element.tagName==='div')[0]:dateField;
    const raw=link&&attribute(link,'href');
    if(!raw||!locationCell) throw new TypeError('Fila SuccessFactors incompleta');
    const candidate=new URL(raw,`https://${board.hostname}`);
    board.excludedJobPathPattern?.lastIndex&&(board.excludedJobPathPattern.lastIndex=0);
    if(board.excludedJobPathPattern?.test(candidate.pathname)) {
      if(candidate.protocol!=='https:'||candidate.hostname!==board.hostname||candidate.port||candidate.username||candidate.password||candidate.search||candidate.hash)
        throw new TypeError('URL SuccessFactors no autorizada');
      if(seen.has(candidate.href)) throw new TypeError('Oferta SuccessFactors duplicada');
      seen.add(candidate.href);
      observedUrls.push(candidate.href);
      excludedUrls.push(candidate.href);
      return [];
    }
    const rawLocation=textOf(locationCell);
    const url=validatedJobUrl(raw,board);
    if(seen.has(url)) throw new TypeError('Oferta SuccessFactors duplicada');
    seen.add(url);
    observedUrls.push(url);
    if(/,\s*[A-Z]{2}(?:,\s*\d{1,5})?\s*$/.test(rawLocation)&&
      !/,\s*ES(?:,\s*\d{1,5})?\s*$/.test(rawLocation)) return [];
    const title=textOf(link);
    if(!title) throw new TypeError('Título SuccessFactors ausente');
    return [{url,title,listedDate:dateCell?textOf(dateCell):'',...locationParts(rawLocation)}];
  });
  const label=descendants(document,element=>tile?attribute(element,'id')==='tile-search-results-label':hasClass(element,'paginationLabel'))[0];
  const total=label?/\bde\s+(\d+)\b/i.exec(textOf(label))?.[1]:null;
  const totalCount=total?Number(total):null;
  const pageCount=totalCount?Math.ceil(totalCount/board.pageSize):1;
  if(!Number.isSafeInteger(pageCount)||pageCount<1||pageCount>board.maxPages) throw new TypeError('Paginación SuccessFactors inválida');
  return {offers,excludedUrls,observedUrls,pageCount,totalCount};
}

export function adaptSuccessFactorsDetail(
  offer:SuccessFactorsListedOffer,
  html:string,
  checkedAt:string,
  resolveCity:CityResolver,
  board:SuccessFactorsBoard,
):PublicJob {
  const document=documentOf(html);
  const heading=descendants(document,element=>attribute(element,'id')==='job-title')[0]??
    descendants(document,element=>element.tagName==='h1')[0];
  const title=heading?(descendants(heading,element=>attribute(element,'itemprop')==='title')[0]??heading):null;
  const date=descendants(document,element=>element.tagName==='meta'&&attribute(element,'itemprop')==='datePosted')[0];
  const description=descendants(document,element=>attribute(element,'itemprop')==='description')[0];
  if(!title||textOf(title)!==offer.title||!date||!description) throw new TypeError('Detalle SuccessFactors inválido');
  const posted=Date.parse(attribute(date,'content')??'');
  if(!Number.isFinite(posted)||posted>Date.parse(checkedAt)+86_400_000) throw new TypeError('Fecha SuccessFactors inválida');
  const paragraphs=htmlToParagraphs(innerHtml(description));
  if(!paragraphs.length) throw new TypeError('Descripción SuccessFactors vacía');
  const id=/\/(\d+)\/$/.exec(new URL(offer.url).pathname)?.[1];
  if(!id) throw new TypeError('ID SuccessFactors no verificable');
  const remote=/\b(remot[oa]|teletrabajo|remote)\b/i.test(
    `${offer.city} ${offer.title} ${board.remoteFromDescription===false?'':paragraphs.join(' ')}`,
  );
  const eligibleCity=!board.requireCityMentionInTitle||cityMentionedInTitle(offer.city,offer.title);
  const resolved=!offer.ambiguousLocation&&!remote&&eligibleCity?resolveCity(offer.city):null;
  const hintedProvince=offer.provinceHint?canonicalSpanishProvince(offer.provinceHint):canonicalSpanishProvince(offer.city);
  const coherentProvince=!hintedProvince||hintedProvince.name===resolved?.province;
  const verified=coherentProvince?resolved:null;
  const location=verified?.location?{
    ...verified.location,
    note:approximateMunicipalNote,
  }:null;
  return {
    kind:'job',sourceId:board.sourceId,source:board.sourceLabel,
    id:`${board.idPrefix??`SUCCESSFACTORS-${board.sourceId.toUpperCase()}`}-${id}`,title:offer.title,employer:board.employer,
    city:offer.city,province:verified?.province??hintedProvince?.name??'Sin verificar',region:verified?.region??hintedProvince?.region??'España',
    category:board.category,categoryLabel:board.categoryLabel,regime:remote?'Remoto':'Oferta de empleo',places:null,
    paragraphs,sourceUrl:offer.url,publishedAt:new Date(posted).toISOString().slice(0,10),checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location,
  };
}

function isVerifiedClosedDetail(html:string):boolean {
  const document=documentOf(html);
  const shell=descendants(document,element=>hasClass(element,'jobDisplayShell'))[0];
  const date=descendants(document,element=>element.tagName==='meta'&&attribute(element,'itemprop')==='datePosted')[0];
  return Boolean(shell&&!date&&textOf(shell).trim()==='Lo sentimos, esta posición ya está cubierta.');
}

function isVerifiedEmptyDescription(html:string):boolean {
  const document=documentOf(html);
  const heading=descendants(document,element=>element.tagName==='h1')[0];
  const date=descendants(document,element=>element.tagName==='meta'&&attribute(element,'itemprop')==='datePosted')[0];
  const description=descendants(document,element=>attribute(element,'itemprop')==='description')[0];
  return Boolean(heading&&date&&description&&htmlToParagraphs(innerHtml(description)).length===0);
}

export async function fetchSuccessFactorsOffers(
  board:SuccessFactorsBoard,
  checkedAt:string,
  resolveCity:CityResolver,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  const found=new Map<string,SuccessFactorsListedOffer>();
  const excluded=new Set<string>();
  const observed=new Set<string>();
  const fetchPage=(url:string)=>board.retryTransientErrors?
    retryTransient(()=>fetchHtml(url,{fetchImpl})):fetchHtml(url,{fetchImpl});
  const listingUrl=new URL(board.listingPath,`https://${board.hostname}`);
  const first=parseSuccessFactorsListing(await fetchPage(listingUrl.href),board);
  if(board.paginationOffsetParam&&first.totalCount===null) throw new TypeError('Paginación SuccessFactors sin total');
  for(const offer of first.offers) found.set(offer.url,offer);
  for(const url of first.excludedUrls) excluded.add(url);
  for(const url of first.observedUrls) observed.add(url);
  for(let page=2;page<=first.pageCount;page++) {
    const url=new URL(board.paginationPath??board.listingPath,`https://${board.hostname}`);
    if(board.paginationOffsetParam) url.searchParams.set(board.paginationOffsetParam,String((page-1)*board.pageSize));
    else url.pathname=`${url.pathname.replace(/\/$/,'')}/${(page-1)*board.pageSize}/`;
    url.searchParams.set('sortColumn','referencedate');
    url.searchParams.set('sortDirection','desc');
    const parsed=parseSuccessFactorsListing(await fetchPage(url.href),board);
    if(board.paginationOffsetParam&&(!board.listingFormat||board.listingFormat==='table')&&parsed.totalCount!==first.totalCount) throw new TypeError('Listado SuccessFactors cambió durante la paginación');
    let added=0;
    for(const observedUrl of parsed.observedUrls) {
      if(observed.has(observedUrl)) continue;
      observed.add(observedUrl);
      added++;
    }
    for(const offer of parsed.offers) {
      if(found.has(offer.url)) continue;
      found.set(offer.url,offer);
    }
    for(const excludedUrl of parsed.excludedUrls) {
      if(excluded.has(excludedUrl)) continue;
      excluded.add(excludedUrl);
    }
    if(!added) throw new TypeError('Paginación SuccessFactors repetida');
  }
  if(board.paginationOffsetParam&&observed.size!==first.totalCount) throw new TypeError('Paginación SuccessFactors incompleta');
  if(found.size===0||found.size>board.pageSize*board.maxPages) throw new TypeError('Volumen SuccessFactors inesperado');
  const offers=[...found.values()];
  const jobs:PublicJob[]=[];
  for(let index=0;index<offers.length;index+=5) {
    const batch=await Promise.all(offers.slice(index,index+5).map(async offer=>{
      const html=await fetchPage(offer.url);
      if(board.skipVerifiedClosed&&isVerifiedClosedDetail(html)) return null;
      if(board.skipEmptyDescription&&isVerifiedEmptyDescription(html)) return null;
      return adaptSuccessFactorsDetail(offer,html,checkedAt,resolveCity,board);
    }));
    jobs.push(...batch.filter((job):job is PublicJob=>job!==null));
  }
  if(!jobs.length) throw new TypeError('Sin ofertas SuccessFactors vigentes verificables');
  return jobs;
}
