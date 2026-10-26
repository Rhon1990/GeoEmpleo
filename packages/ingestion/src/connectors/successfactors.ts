import type { PublicJob } from '../model.ts';
import { fetchHtml } from '../http.ts';
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
  const withoutCountry=normalized.replace(/,?\s*ES(?:,\s*\d{1,5})?\s*$/i,'').trim();
  const parenthesized=/^(.+?)\s*\(([^)]+)\)$/.exec(withoutCountry);
  if(parenthesized) return {city:parenthesized[1]!.trim(),provinceHint:parenthesized[2]!.trim(),ambiguousLocation:false};
  const parts=withoutCountry.split(',').map(part=>part.trim()).filter(Boolean);
  if(parts.length===1) return {city:parts[0]??normalized,provinceHint:null,ambiguousLocation:false};
  if(parts.length===2&&canonicalSpanishProvince(parts[1]!)) {
    return {city:parts[0]!,provinceHint:parts[1]!,ambiguousLocation:false};
  }
  return {city:withoutCountry||normalized,provinceHint:null,ambiguousLocation:true};
}

export function parseSuccessFactorsListing(html:string,board:SuccessFactorsBoard):{offers:SuccessFactorsListedOffer[];pageCount:number} {
  const document=documentOf(html);
  const rows=descendants(document,element=>element.tagName==='tr'&&hasClass(element,'data-row'));
  if(!rows.length) throw new TypeError('Listado SuccessFactors vacío');
  const seen=new Set<string>();
  const offers=rows.map(row=>{
    const link=descendants(row,element=>element.tagName==='a'&&hasClass(element,'jobTitle-link'))[0];
    const locationCell=descendants(row,element=>element.tagName==='td'&&hasClass(element,'colLocation'))[0];
    const dateCell=descendants(row,element=>element.tagName==='td'&&hasClass(element,'colDate'))[0];
    const raw=link&&attribute(link,'href');
    if(!raw||!locationCell||!dateCell) throw new TypeError('Fila SuccessFactors incompleta');
    const url=validatedJobUrl(raw,board);
    if(seen.has(url)) throw new TypeError('Oferta SuccessFactors duplicada');
    seen.add(url);
    const title=textOf(link);
    if(!title) throw new TypeError('Título SuccessFactors ausente');
    return {url,title,listedDate:textOf(dateCell),...locationParts(textOf(locationCell))};
  });
  const label=descendants(document,element=>hasClass(element,'paginationLabel'))[0];
  const total=label?/\bde\s+(\d+)\b/i.exec(textOf(label))?.[1]:null;
  const pageCount=total?Math.ceil(Number(total)/board.pageSize):1;
  if(!Number.isSafeInteger(pageCount)||pageCount<1||pageCount>board.maxPages) throw new TypeError('Paginación SuccessFactors inválida');
  return {offers,pageCount};
}

export function adaptSuccessFactorsDetail(
  offer:SuccessFactorsListedOffer,
  html:string,
  checkedAt:string,
  resolveCity:CityResolver,
  board:SuccessFactorsBoard,
):PublicJob {
  const document=documentOf(html);
  const heading=descendants(document,element=>attribute(element,'id')==='job-title')[0];
  const date=descendants(document,element=>element.tagName==='meta'&&attribute(element,'itemprop')==='datePosted')[0];
  const description=descendants(document,element=>attribute(element,'itemprop')==='description')[0];
  if(!heading||textOf(heading)!==offer.title||!date||!description) throw new TypeError('Detalle SuccessFactors inválido');
  const posted=Date.parse(attribute(date,'content')??'');
  if(!Number.isFinite(posted)||posted>Date.parse(checkedAt)+86_400_000) throw new TypeError('Fecha SuccessFactors inválida');
  const paragraphs=htmlToParagraphs(innerHtml(description));
  if(!paragraphs.length) throw new TypeError('Descripción SuccessFactors vacía');
  const id=/\/(\d+)\/$/.exec(new URL(offer.url).pathname)?.[1];
  if(!id) throw new TypeError('ID SuccessFactors no verificable');
  const remote=/\b(remot[oa]|teletrabajo|remote)\b/i.test(`${offer.city} ${paragraphs.join(' ')}`);
  const resolved=!offer.ambiguousLocation&&!remote?resolveCity(offer.city):null;
  const hintedProvince=offer.provinceHint?canonicalSpanishProvince(offer.provinceHint):null;
  const coherentProvince=!hintedProvince||hintedProvince.name===resolved?.province;
  const location=resolved?.location&&coherentProvince?{
    ...resolved.location,
    note:approximateMunicipalNote,
  }:null;
  return {
    kind:'job',sourceId:board.sourceId,source:board.sourceLabel,
    id:`${board.idPrefix??`SUCCESSFACTORS-${board.sourceId.toUpperCase()}`}-${id}`,title:offer.title,employer:board.employer,
    city:offer.city,province:resolved?.province??hintedProvince?.name??'Sin verificar',region:resolved?.region??hintedProvince?.region??'España',
    category:board.category,categoryLabel:board.categoryLabel,regime:remote?'Remoto':'Oferta de empleo',places:null,
    paragraphs,sourceUrl:offer.url,publishedAt:new Date(posted).toISOString().slice(0,10),checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location,
  };
}

export async function fetchSuccessFactorsOffers(
  board:SuccessFactorsBoard,
  checkedAt:string,
  resolveCity:CityResolver,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  const found=new Map<string,SuccessFactorsListedOffer>();
  const listingUrl=new URL(board.listingPath,`https://${board.hostname}`);
  const first=parseSuccessFactorsListing(await fetchHtml(listingUrl.href,{fetchImpl}),board);
  for(const offer of first.offers) found.set(offer.url,offer);
  for(let page=2;page<=first.pageCount;page++) {
    const url=new URL(board.listingPath,`https://${board.hostname}`);
    url.pathname=`${url.pathname.replace(/\/$/,'')}/${(page-1)*board.pageSize}/`;
    url.search='?q=&sortColumn=referencedate&sortDirection=desc';
    const parsed=parseSuccessFactorsListing(await fetchHtml(url.href,{fetchImpl}),board);
    for(const offer of parsed.offers) {
      if(found.has(offer.url)) throw new TypeError('Oferta SuccessFactors duplicada');
      found.set(offer.url,offer);
    }
  }
  if(found.size===0||found.size>board.pageSize*board.maxPages) throw new TypeError('Volumen SuccessFactors inesperado');
  const offers=[...found.values()];
  const jobs:PublicJob[]=[];
  for(let index=0;index<offers.length;index+=5) {
    jobs.push(...await Promise.all(offers.slice(index,index+5).map(async offer=>
      adaptSuccessFactorsDetail(offer,await fetchHtml(offer.url,{fetchImpl}),checkedAt,resolveCity,board))));
  }
  return jobs;
}
