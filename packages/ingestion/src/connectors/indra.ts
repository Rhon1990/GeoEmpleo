import type {PublicJob} from '../model.ts';
import {dateInSpain} from '../normalize.ts';
import {fetchHtml} from '../http.ts';
import type {CityResolver} from './bizneo.ts';
import {parseSuccessFactorsListing,type SuccessFactorsBoard,type SuccessFactorsListedOffer} from './successfactors.ts';

export const indraBoard:SuccessFactorsBoard={
  sourceId:'successfactors-indra',hostname:'careers.indragroup.com',employer:'Indra',
  listingPath:'/search/',jobPathPattern:/^\/job\/[^/]+\/\d+\/$/,
  category:'tecnologia',categoryLabel:'Tecnología y consultoría',sourceLabel:'Indra · portal oficial',
  pageSize:25,maxPages:30,
};
export const indraListingUrl='https://careers.indragroup.com/search/?locale=es_ES';

function validatedUrl(raw:string):URL {
  const url=new URL(raw);
  indraBoard.jobPathPattern.lastIndex=0;
  if(url.protocol!=='https:'||url.hostname!==indraBoard.hostname||url.port||url.username||url.password||
    !indraBoard.jobPathPattern.test(url.pathname)||url.search||url.hash)throw new TypeError('URL Indra no autorizada');
  return url;
}

export function adaptIndraOffer(offer:SuccessFactorsListedOffer,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const url=validatedUrl(offer.url);
  const id=/\/(\d+)\/$/.exec(url.pathname)?.[1];
  if(!id||!offer.title.trim())throw new TypeError('Oferta Indra sin ID o título');
  const remote=/\b(remot[oa]|teletrabajo|remote)\b/i.test(`${offer.title} ${offer.city}`);
  const resolved=remote||offer.ambiguousLocation?null:resolveCity(offer.city,offer.provinceHint??undefined);
  return {kind:'job',sourceId:indraBoard.sourceId,source:indraBoard.sourceLabel,id:`INDRA-${id}`,
    title:offer.title,employer:'Indra',city:resolved?.city??offer.city,
    province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
    category:indraBoard.category,categoryLabel:indraBoard.categoryLabel,regime:remote?'Remoto':'Oferta de empleo',places:null,
    paragraphs:[`Oferta publicada por Indra para ${offer.city}.`,'Consulta descripción, requisitos y vigencia en la ficha original.'],
    sourceUrl:url.href,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:resolved?.location??null};
}

export async function fetchIndraOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const first=parseSuccessFactorsListing(await fetchHtml(indraListingUrl,{fetchImpl}),indraBoard);
  const offers=new Map(first.offers.map(offer=>[offer.url,offer]));
  for(let page=2;page<=first.pageCount;page++){
    const url=new URL(indraListingUrl);
    url.searchParams.set('q','');
    url.searchParams.set('sortColumn','referencedate');
    url.searchParams.set('sortDirection','desc');
    url.searchParams.set('startrow',String((page-1)*indraBoard.pageSize));
    const current=parseSuccessFactorsListing(await fetchHtml(url.href,{fetchImpl}),indraBoard);
    let added=0;
    for(const offer of current.offers)if(!offers.has(offer.url)){offers.set(offer.url,offer);added++;}
    if(!added&&page<first.pageCount)throw new TypeError('Paginación Indra repetida');
  }
  if(!offers.size||offers.size>indraBoard.pageSize*indraBoard.maxPages)throw new TypeError('Volumen Indra inesperado');
  return [...offers.values()].map(offer=>adaptIndraOffer(offer,checkedAt,resolveCity));
}
