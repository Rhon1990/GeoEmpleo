import type { PublicJob } from '../model.ts';
import type { CityResolver } from './bizneo.ts';
import {
  adaptSuccessFactorsDetail,
  fetchSuccessFactorsOffers,
  parseSuccessFactorsListing,
  type SuccessFactorsBoard,
  type SuccessFactorsListedOffer,
} from './successfactors.ts';

const kfcBoard:SuccessFactorsBoard={
  sourceId:'amrest-kfc',hostname:'careers.amrest.eu',employer:'KFC · AmRest',
  listingPath:'/KFC/go/Jobs-KFC-ES/9158355/',jobPathPattern:/^\/KFC\/job\/[^/]+\/\d+\/$/,
  category:'hosteleria',categoryLabel:'Turismo y hostelería',sourceLabel:'KFC · AmRest',
  idPrefix:'AMREST-KFC',pageSize:30,maxPages:20,
};

export const kfcListingUrl=`https://${kfcBoard.hostname}${kfcBoard.listingPath}`;
export type KfcListedOffer=SuccessFactorsListedOffer;

export function parseKfcListing(html:string):{offers:KfcListedOffer[];pageCount:number} {
  return parseSuccessFactorsListing(html,kfcBoard);
}

export function adaptKfcDetail(
  offer:KfcListedOffer,
  html:string,
  checkedAt:string,
  resolveCity:CityResolver,
):PublicJob {
  return adaptSuccessFactorsDetail(offer,html,checkedAt,resolveCity,kfcBoard);
}

export async function fetchKfcOffers(
  checkedAt:string,
  resolveCity:CityResolver,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  return fetchSuccessFactorsOffers(kfcBoard,checkedAt,resolveCity,fetchImpl);
}
