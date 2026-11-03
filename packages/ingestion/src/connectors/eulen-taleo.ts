import type {CityResolver} from './bizneo.ts';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {attribute,descendants,documentOf,textOf,type HtmlElement} from './html-dom.ts';
import {dateFromSpanish} from './shared.ts';

export const eulenTaleoListingUrl='https://eulen.taleo.net/careersection/eul_career_site/jobsearch.ftl?lang=es';
const sourceId='taleo-eulen';

export interface EulenTaleoOffer {
  jobId:unknown;
  contestNo:unknown;
  column:unknown;
}

function elementById(nodes:HtmlElement[],id:string):HtmlElement|undefined {
  return nodes.find(node=>attribute(node,'id')===`requisitionDescriptionInterface.${id}.row1`);
}

function provinceOf(offer:EulenTaleoOffer):ReturnType<typeof canonicalSpanishProvince>|null {
  if(!Array.isArray(offer.column)||typeof offer.column[2]!=='string')return null;
  let locations:unknown;
  try {locations=JSON.parse(offer.column[2]);}catch{return null;}
  if(!Array.isArray(locations)||locations.length!==1||typeof locations[0]!=='string')return null;
  return canonicalSpanishProvince(locations[0]);
}

export function adaptEulenTaleoDetail(offer:EulenTaleoOffer,html:string,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  const id=offer.contestNo;
  if(typeof id!=='string'||!/^\d[A-Z0-9]{5,15}$/.test(id))throw new TypeError('ID Taleo Eulen inválido');
  if(typeof offer.jobId!=='string'||!/^\d+$/.test(offer.jobId))throw new TypeError('ID interno Taleo Eulen inválido');
  const nodes=descendants(documentOf(html),()=>true);
  const titleNode=elementById(nodes,'reqTitleLinkAction');
  const title=titleNode&&textOf(titleNode);
  const dateNode=elementById(nodes,'reqPostingDate');
  const dateText=dateNode&&textOf(dateNode);
  if(!title||!dateText)return null;
  const province=provinceOf(offer);
  if(!province)return null;
  const sites=nodes.filter(node=>/^requisitionDescriptionInterface\.reqSiteCity\.row\d+$/.test(attribute(node,'id')??''));
  const cities=[...new Set(sites.map(node=>textOf(node)).filter(Boolean))];
  const city=cities.length===1?cities[0]!:'Varias localidades';
  const resolved=cities.length===1?resolveCity(city,province.name):null;
  const description=elementById(nodes,'ID1404');
  const requirements=elementById(nodes,'ID1462');
  const paragraphs=[description&&textOf(description),requirements&&textOf(requirements)].filter((value):value is string=>Boolean(value));
  if(!paragraphs.length)paragraphs.push(`Oferta publicada por Grupo Eulen en ${province.name}.`);
  const sourceUrl=`https://eulen.taleo.net/careersection/eul_career_site/jobdetail.ftl?job=${id}&lang=es`;
  return {kind:'job',sourceId,source:'Grupo Eulen · Taleo oficial',id:`EULEN-TALEO-${id}`,title,employer:'Grupo Eulen',
    city:resolved?.city??city,province:province.name,region:province.region,category:'servicios',categoryLabel:'Servicios y comercio',
    regime:'Oferta de empleo',places:null,paragraphs,sourceUrl,publishedAt:dateFromSpanish(dateText.slice(0,10),'Eulen Taleo'),
    checkedAt,closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:resolved?.location??null};
}

export async function fetchEulenTaleoOffers(_checkedAt:string,_resolveCity:CityResolver,_fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  throw new Error('Captura Taleo no implementada');
}
