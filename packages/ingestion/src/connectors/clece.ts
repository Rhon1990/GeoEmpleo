import type {CityResolver} from './bizneo.ts';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {dateInSpain} from '../normalize.ts';
import {fetchHtml} from '../http.ts';
import {parseSuccessFactorsListing,type SuccessFactorsBoard,type SuccessFactorsListedOffer} from './successfactors.ts';

export const cleceBoard:SuccessFactorsBoard={
  sourceId:'successfactors-clece',hostname:'canaldeempleo.es',employer:'Clece',
  listingPath:'/CLECE/go/CLECE/910702/',jobPathPattern:/^\/CLECE\/job\/[^/]+\/\d+\/$/,
  category:'servicios',categoryLabel:'Cuidados y servicios',sourceLabel:'Clece · portal oficial',
  pageSize:50,maxPages:20,
};
export const cleceListingUrl=new URL(cleceBoard.listingPath,`https://${cleceBoard.hostname}`).href;

export function adaptCleceOffer(offer:SuccessFactorsListedOffer,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  const url=new URL(offer.url);
  if(url.protocol!=='https:'||url.hostname!==cleceBoard.hostname||url.port||url.username||url.password||
    !cleceBoard.jobPathPattern.test(url.pathname)||url.search||url.hash)throw new TypeError('URL Clece no autorizada');
  const id=/\/(\d+)\/$/.exec(url.pathname)?.[1];
  if(!id||!offer.title.trim())throw new TypeError('Oferta Clece sin ID o título');
  const match=/^(.+),\s*([^,]+),\s*España,\s*\d{5}$/i.exec(offer.city.trim());
  if(!match)return null;
  const city=match[1]!.trim();
  const province=canonicalSpanishProvince(match[2]!);
  if(!province)return null;
  const resolved=resolveCity(city,province.name);
  const verified=resolved?.province===province.name?resolved:null;
  const remote=/\b(remot[oa]|teletrabajo|remote)\b/i.test(offer.title);
  return {kind:'job',sourceId:cleceBoard.sourceId,source:cleceBoard.sourceLabel,id:`CLECE-${id}`,
    title:offer.title,employer:'Clece',city:verified?.city??city,
    province:province.name,region:province.region,
    category:cleceBoard.category,categoryLabel:cleceBoard.categoryLabel,regime:remote?'Remoto':'Oferta de empleo',places:null,
    paragraphs:[`Oferta publicada por Clece en ${city}.`,'Consulta descripción, condiciones y vigencia en la ficha original.'],
    sourceUrl:url.href,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:remote?null:verified?.location??null};
}

export async function fetchCleceOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const first=parseSuccessFactorsListing(await fetchHtml(cleceListingUrl,{fetchImpl}),cleceBoard);
  const offers=new Map(first.offers.map(offer=>[offer.url,offer]));
  for(let page=2;page<=first.pageCount;page++){
    const url=new URL(cleceBoard.listingPath,`https://${cleceBoard.hostname}`);
    url.pathname+=`${(page-1)*cleceBoard.pageSize}/`;
    url.searchParams.set('sortColumn','referencedate');
    url.searchParams.set('sortDirection','desc');
    const current=parseSuccessFactorsListing(await fetchHtml(url.href,{fetchImpl}),cleceBoard);
    let added=0;
    for(const offer of current.offers)if(!offers.has(offer.url)){offers.set(offer.url,offer);added++;}
    if(!added)throw new TypeError('Paginación Clece repetida');
  }
  const jobs=[...offers.values()].map(offer=>adaptCleceOffer(offer,checkedAt,resolveCity)).filter((job):job is PublicJob=>job!==null);
  if(!jobs.length)throw new TypeError('Clece sin ofertas españolas verificables');
  return jobs;
}
