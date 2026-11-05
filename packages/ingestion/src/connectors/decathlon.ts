import type {PublicJob} from '../model.ts';
import {fetchHtml} from '../http.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import type {CityResolver} from './bizneo.ts';
import {attribute,descendants,documentOf,textOf} from './html-dom.ts';
import {approximateMunicipalNote} from './shared.ts';

export const decathlonListingUrl='https://careers.talentclue.com/es/company/ab1c62a7331dda3ee254559964560b88/jsoffers/modal?op=1';
const sourceId='talentclue-decathlon';
const companyId='ab1c62a7331dda3ee254559964560b88';

interface ListedOffer {readonly id:string;readonly title:string;readonly city:string;readonly province:string;readonly url:string}

export function parseDecathlonListing(html:string):ListedOffer[] {
  const rows=descendants(documentOf(html),element=>element.tagName==='tr');
  const offers:ListedOffer[]=[];
  for(const row of rows) {
    const cells=descendants(row,element=>element.tagName==='td');
    if(cells.length!==8)continue;
    if(textOf(cells[2]!).toLocaleLowerCase('es')!=='decathlon'||textOf(cells[5]!)!=='España')continue;
    const link=descendants(cells[1]!,element=>element.tagName==='a')[0];
    if(!link)throw new TypeError('Oferta Decathlon sin enlace');
    const raw=attribute(link,'href')??'',url=new URL(raw,decathlonListingUrl);
    const match=/^\/es\/node\/(\d+)\/4590\/modalbrowser$/.exec(url.pathname);
    if(url.protocol!=='https:'||url.hostname!=='careers.talentclue.com'||url.port||url.username||url.password||
      !match||url.searchParams.get('destination')!==`company/${companyId}/jsoffers/modal`||
      url.searchParams.get('logo')!=='1'||[...url.searchParams.keys()].length!==2||url.hash)
      throw new TypeError('URL Decathlon no autorizada');
    const provinceRaw=textOf(cells[4]!),province=canonicalSpanishProvince(provinceRaw);
    const title=textOf(link),city=textOf(cells[3]!);
    if(!title)throw new TypeError('Título Decathlon ausente');
    offers.push({id:match[1]!,title,city:city||'Ubicación no indicada',province:province?.name??'Sin verificar',url:url.href});
  }
  if(!offers.length||offers.length>2000||new Set(offers.map(offer=>offer.id)).size!==offers.length)
    throw new TypeError('Listado Decathlon vacío, excesivo o duplicado');
  return offers;
}

function adaptOffer(offer:ListedOffer,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const resolved=offer.province!=='Sin verificar'?resolveCity(offer.city,offer.province):null;
  const coherent=resolved?.province===offer.province;
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(checkedAt));
  return {kind:'job',sourceId,source:'Decathlon · portal oficial',id:`DECATHLON-${offer.id}`,title:offer.title,
    employer:'Decathlon',city:offer.city,province:offer.province,
    region:canonicalSpanishProvince(offer.province)?.region??'España',category:'servicios',categoryLabel:'Servicios y comercio',
    regime:'Oferta de empleo',places:null,
    paragraphs:[`Oferta publicada por Decathlon en ${offer.city}.`,'Consulta la descripción y los requisitos completos en la ficha original.'],
    sourceUrl:offer.url,publishedAt:date,dateKind:'observed',
    checkedAt,closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:coherent&&resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null};
}

export async function fetchDecathlonOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const offers=parseDecathlonListing(await fetchHtml(decathlonListingUrl,{fetchImpl,maxBytes:3_000_000}));
  return offers.map(offer=>adaptOffer(offer,checkedAt,resolveCity));
}
