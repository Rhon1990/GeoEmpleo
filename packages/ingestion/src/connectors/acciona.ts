import {fetchHtml} from '../http.ts';
import type {PublicJob} from '../model.ts';
import {htmlToParagraphs} from '../normalize.ts';
import {isoDate,requiredText} from './shared.ts';
import type {CityResolver} from './bizneo.ts';
import {attribute,descendants,documentOf} from './html-dom.ts';

export const accionaListingUrl='https://www.acciona.com/es/nuestro-proposito/trabaja-con-nosotros/ofertas-empleo';
const host='www.acciona.com';
const detailPath='/es/nuestro-proposito/trabaja-con-nosotros/detalle-empleo';

function record(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Oferta Acciona inválida');
  return value as Record<string,unknown>;
}

function detailUrl(value:unknown,id:string):string {
  const url=new URL(requiredText(value,'URL Acciona'),accionaListingUrl);
  if(url.protocol!=='https:'||url.hostname!==host||url.port||url.username||url.password||
    url.pathname!==detailPath||url.hash||url.searchParams.size!==1||url.searchParams.get('id')!==id)
    throw new TypeError('URL Acciona no autorizada');
  return url.href;
}

function listingOffers(html:string):Record<string,unknown>[] {
  const element=descendants(documentOf(html),item=>item.tagName==='a-mo-oferta-v2')[0];
  if(!element||attribute(element,'pagination')!=='true'||!/^\d+$/.test(attribute(element,'page-size')??''))
    throw new TypeError('Listado Acciona inesperado');
  const raw=attribute(element,'jobs');
  let jobs:unknown;
  try { jobs=JSON.parse(raw??''); } catch { throw new TypeError('Listado Acciona sin ofertas legibles'); }
  if(!Array.isArray(jobs)||!jobs.length||jobs.length>5_000) throw new TypeError('Listado Acciona incompleto');
  return jobs.map(record);
}

export async function fetchAccionaOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const seen=new Set<string>();
  const jobs:PublicJob[]=[];
  for(const offer of listingOffers(await fetchHtml(accionaListingUrl,{fetchImpl,maxBytes:5_000_000}))) {
    if(offer.locationCountry!=='ESP') continue;
    const id=requiredText(offer.id,'ID Acciona');
    if(!/^\d+$/.test(id)||offer.jobRequisitionId!==id||seen.has(id)) throw new TypeError('ID Acciona inválido o duplicado');
    seen.add(id);
    const title=requiredText(offer.jobPostingTitle,'título Acciona');
    const city=requiredText(offer.primaryLocation,'localidad Acciona');
    const paragraphs=htmlToParagraphs(requiredText(offer.jobDescription,'descripción Acciona'));
    if(!paragraphs.length) throw new TypeError('Descripción Acciona vacía');
    const resolved=resolveCity(city);
    jobs.push({
      kind:'job',sourceId:'acciona-oficial',source:'Acciona · portal oficial',id:`ACCIONA-${id}`,
      title,employer:'Acciona',city:resolved?.city??city,province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
      category:'otros',categoryLabel:'Otros',regime:'Oferta de empleo',places:null,paragraphs,
      sourceUrl:detailUrl(offer.url,id),publishedAt:isoDate(offer.startDate,'publicación Acciona'),checkedAt,
      closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:resolved?.location??null,
    });
  }
  if(!jobs.length) throw new TypeError('Acciona sin ofertas españolas');
  return jobs;
}
