import type {PublicJob} from '../model.ts';
import {fetchJson} from '../http.ts';
import {dateInSpain,htmlToParagraphs} from '../normalize.ts';
import type {CityResolver} from './bizneo.ts';
import {approximateMunicipalNote,record,requiredText} from './shared.ts';

export const capgeminiListingUrl='https://www.capgemini.com/es-es/wp-json/macs/v1/jobs?country=es-es&size=5000';
const sourceId='successfactors-capgemini';
const maximumOffers=5_000;

function canonicalOfferUrl(value:unknown):{url:string;id:string} {
  let url:URL;
  try {url=new URL(requiredText(value,'Capgemini'));}
  catch {throw new TypeError('URL Capgemini inválida');}
  const id=/^\/job\/[^/]+\/(\d+)\/$/u.exec(url.pathname)?.[1];
  const allowedParameters=new Set(['feedId','utm_source','tcsource']);
  if(url.protocol!=='https:'||url.hostname!=='careers.capgemini.com'||url.port||url.username||url.password||
    !id||url.hash||[...url.searchParams.keys()].some(name=>!allowedParameters.has(name)))
    throw new TypeError('URL Capgemini no autorizada');
  url.search='';
  return {url:url.href,id};
}

function adaptOffer(input:unknown,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const offer=record(input,'Capgemini');
  if(offer.country_code!=='es-es') throw new TypeError('Oferta Capgemini fuera de España');
  if(offer.status!=='1'||(offer.deleted_at!==''&&offer.deleted_at!==null&&offer.deleted_at!==undefined))
    throw new TypeError('Oferta Capgemini no vigente');
  const title=requiredText(offer.title,'Capgemini');
  const city=requiredText(offer.location,'Capgemini');
  const description=requiredText(offer.description,'Capgemini');
  const publishedParagraphs=htmlToParagraphs(description);
  const {url,id}=canonicalOfferUrl(offer.apply_job_url);
  const locations=city.split(',').map(value=>value.trim()).filter(Boolean);
  const remote=/\b(remot[oa]|teletrabajo|remote)\b/iu.test(`${title} ${description}`);
  const resolved=!remote&&locations.length===1?resolveCity(locations[0]!):null;
  const location=resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null;
  return {
    kind:'job',sourceId,source:'Capgemini · empleo oficial',
    id:`SUCCESSFACTORS-SUCCESSFACTORS-CAPGEMINI-${id}`,title,employer:'Capgemini',
    city:resolved?.city??city,province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
    category:'tecnologia',categoryLabel:'Tecnología y consultoría',regime:remote?'Remoto':'Oferta de empleo',places:null,
    paragraphs:publishedParagraphs.length?publishedParagraphs:[
      `Oferta publicada por Capgemini para ${city}.`,
      'Consulta las funciones, requisitos y vigencia en la ficha original.',
    ],sourceUrl:url,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,closingDate:null,
    salary:null,applicationRegistration:'external_required',selection:null,location,
  };
}

export async function fetchCapgeminiOffers(
  checkedAt:string,
  resolveCity:CityResolver,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  const input=record(await fetchJson(capgeminiListingUrl,{fetchImpl}),'Capgemini');
  if(input.timed_out===true||!Number.isSafeInteger(input.count)||!Number.isSafeInteger(input.total)||
    input.count!==input.total||Number(input.count)<1||Number(input.count)>maximumOffers||!Array.isArray(input.data)||
    input.data.length!==input.count) throw new TypeError('Captura Capgemini incompleta');
  const jobs=input.data.map(item=>adaptOffer(item,checkedAt,resolveCity));
  const ids=new Set(jobs.map(job=>job.id));
  if(ids.size!==jobs.length) throw new TypeError('Identidad Capgemini duplicada');
  return jobs;
}
