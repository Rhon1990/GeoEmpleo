import type { PlaceResolver } from '../geography.ts';
import type { PublicJob } from '../model.ts';
import { fetchHtml } from '../http.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import { dateInSpain, htmlToParagraphs } from '../normalize.ts';
import { record, requiredText } from './shared.ts';
import { descendants, documentOf, hasClass, innerHtml, textOf } from './html-dom.ts';

export const disaEndpoint='https://empleo.disagrupo.es/offer/getofferlistdata';
interface DisaListedOffer { readonly id:string; readonly title:string; readonly province:string; readonly workplace:string }

export function parseDisaListing(input:unknown):DisaListedOffer[] {
  const data=record(input,'DISA');
  if(!Array.isArray(data.Offers)||!Number.isInteger(data.TotalOfertas)||Number(data.TotalOfertas)<0||Number(data.TotalOfertas)>200||
    data.Offers.length!==data.TotalOfertas) throw new TypeError('Listado DISA incompleto');
  const seen=new Set<string>();
  return data.Offers.map(value=>{
    const offer=record(value,'oferta DISA');
    const id=requiredText(offer.OfferId,'ID DISA');
    if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)||seen.has(id)) throw new TypeError('ID DISA inválido');
    seen.add(id);
    return {id,title:requiredText(offer.JobName,'título DISA'),province:requiredText(offer.Province,'provincia DISA'),
      workplace:typeof offer.WorkPlaceName==='string'?offer.WorkPlaceName.trim():''};
  });
}

function fieldsOf(html:string):{title:string;fields:Map<string,string[]>;paragraphs:string[]} {
  const document=documentOf(html);
  const title=descendants(document,element=>element.tagName==='h1')[0];
  const dl=descendants(document,element=>element.tagName==='dl')[0];
  if(!title||!dl) throw new TypeError('Ficha DISA incompleta');
  const fields=new Map<string,string[]>();
  const items=descendants(dl,element=>element.tagName==='dt'||element.tagName==='dd');
  for(let index=0;index+1<items.length;index+=2){
    const label=textOf(items[index]!).replace(/:$/,'').toLocaleLowerCase('es-ES');
    const values=descendants(items[index+1]!,element=>element.tagName==='div');
    fields.set(label,values.length?values.map(textOf).filter(Boolean):[textOf(items[index+1]!)]);
  }
  const sections=descendants(document,element=>hasClass(element,'mb-7'));
  const paragraphs=sections.flatMap(section=>{
    const heading=descendants(section,element=>element.tagName==='h4')[0];
    if(!heading||!/descripción de la oferta|requisitos imprescindibles|requisitos valorables/i.test(textOf(heading))) return [];
    return htmlToParagraphs(innerHtml(section));
  });
  return {title:textOf(title),fields,paragraphs};
}

export function adaptDisaOffer(offer:DisaListedOffer,html:string,checkedAt:string,resolve:PlaceResolver):PublicJob {
  const detail=fieldsOf(html);
  if(!detail.title||!detail.paragraphs.length) throw new TypeError('Detalle DISA incompleto');
  const municipalities=detail.fields.get('municipios')??[];
  const provinces=detail.fields.get('provincias')??[offer.province];
  const province=provinces.length===1?canonicalSpanishProvince(provinces[0]!):null;
  const city=municipalities.join(' / ')||'Municipio sin especificar';
  const sourceUrl=`https://empleo.disagrupo.es/offer/detail/${offer.id}`;
  const point=municipalities.length===1&&province?resolve(municipalities[0]!,province.name):null;
  const paragraphs=[...detail.paragraphs];
  if(offer.workplace) paragraphs.unshift(`Centro de trabajo declarado: ${offer.workplace}.`);
  return {kind:'job',sourceId:'disa-empleo',source:'Grupo DISA · empleo',id:`DISA-${offer.id}`,
    title:detail.title,employer:'Grupo DISA',city,province:province?.name??offer.province,
    region:province?.region??'España',category:'servicios',categoryLabel:'Servicios y comercio',regime:'Oferta de empleo',
    places:null,paragraphs,sourceUrl,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:point};
}

export async function fetchDisaOffers(checkedAt:string,resolve:PlaceResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const form=new URLSearchParams({puesto:'',categoria:'0',provincia:'',modalidad:'0',impulsa:'False',pagina:'1',ofertasPorPagina:'200'});
  const response=await fetchImpl(disaEndpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',
    'x-requested-with':'XMLHttpRequest',accept:'application/json',referer:'https://empleo.disagrupo.es/'},
    body:form,redirect:'error',signal:AbortSignal.timeout(40_000)});
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('json')) throw new Error('Listado DISA no disponible');
  const offers=parseDisaListing(await response.json());
  if(!offers.length) throw new TypeError('DISA sin ofertas');
  const jobs:PublicJob[]=[];
  for(let index=0;index<offers.length;index+=4) jobs.push(...await Promise.all(offers.slice(index,index+4).map(async offer=>
    adaptDisaOffer(offer,await fetchHtml(`https://empleo.disagrupo.es/offer/detail/${offer.id}`,{fetchImpl}),checkedAt,resolve))));
  return jobs;
}
