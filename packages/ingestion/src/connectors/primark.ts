import type {PublicJob} from '../model.ts';
import {dateInSpain} from '../normalize.ts';
import {fetchHtml,retryTransient} from '../http.ts';
import type {CityResolver} from './bizneo.ts';
import {attribute,descendants,documentOf,hasClass,textOf} from './html-dom.ts';

export const primarkListingUrl='https://careers.primark.com/es/buscar-trabajo/Espa%C3%B1a/8171/2/2510769/40/-4/50/2';
const primarkHost='careers.primark.com';
const pageSize=10;

interface PrimarkOffer {id:string;title:string;city:string;regime:string|null;category:string|null;path:string}
export interface PrimarkPage {total:number;totalPages:number;page:number;offers:PrimarkOffer[]}

function requiredInteger(value:string|null,label:string):number {
 const result=Number(value);
 if(!Number.isSafeInteger(result)||result<1) throw new TypeError(`${label} Primark inválido`);
 return result;
}

export function parsePrimarkListing(html:string):PrimarkPage {
 const document=documentOf(html);
 const results=descendants(document,element=>attribute(element,'id')==='search-results')[0];
 if(!results) throw new TypeError('Listado Primark ausente');
 const total=requiredInteger(attribute(results,'data-total-job-results'),'Total');
 const totalPages=requiredInteger(attribute(results,'data-total-pages'),'Paginación');
 const page=requiredInteger(attribute(results,'data-current-page'),'Página');
 const records=requiredInteger(attribute(results,'data-records-per-page'),'Tamaño de página');
 if(records!==pageSize||totalPages!==Math.ceil(total/pageSize)||page>totalPages) throw new TypeError('Paginación Primark inválida');
 const items=descendants(results,element=>element.tagName==='li'&&hasClass(element,'job-list-item'));
 const offers=items.map(item=>{
  const link=descendants(item,element=>element.tagName==='a'&&hasClass(element,'job-list-anchor'))[0];
  const id=attribute(link!,'data-job-id');
  const href=attribute(link!,'href');
  if(!link||!id||!/^\d{8,14}$/.test(id)||!href) throw new TypeError('Identificador Primark inválido');
  const url=new URL(href,primarkListingUrl);
  if(url.protocol!=='https:'||url.hostname!==primarkHost||url.port||url.username||url.password||url.search||url.hash||!new RegExp(`^/es/trabajo/[^/]+/[^/]+/8171/${id}$`).test(url.pathname)) throw new TypeError('URL Primark no autorizada');
  const titleNode=descendants(link,element=>element.tagName==='h3'&&hasClass(element,'job-list-title'))[0];
  const locationNode=descendants(link,element=>hasClass(element,'job-list-info--location'))[0];
  const categoryNode=descendants(link,element=>hasClass(element,'job-list-info--category'))[0];
  const regimeNode=descendants(link,element=>hasClass(element,'job-list-info--jobtype'))[0];
  const title=titleNode?textOf(titleNode):'',city=locationNode?textOf(locationNode):'';
  if(!title||!city) throw new TypeError('Oferta Primark incompleta');
  return {id,title,city,regime:regimeNode?textOf(regimeNode):null,category:categoryNode?textOf(categoryNode):null,path:url.pathname};
 });
 const expected=Math.min(pageSize,total-(page-1)*pageSize);
 if(offers.length!==expected||new Set(offers.map(offer=>offer.id)).size!==offers.length) throw new TypeError('Página Primark incompleta');
 return {total,totalPages,page,offers};
}

function municipalName(location:string):string {
 const parts=location.split(',').map(part=>part.trim()).filter(Boolean);
 if(/^Espa(?:ña|na)$/i.test(parts.at(-1)??'')) parts.pop();
 return parts.at(-1)??location.trim();
}

function adaptPrimarkOffer(offer:PrimarkOffer,checkedAt:string,resolveCity:CityResolver):PublicJob {
 const remote=/\bremote\b|\bremoto\b/i.test(offer.city+' '+offer.title);
 const city=municipalName(offer.city);
 const resolved=remote?null:resolveCity(city);
 return {kind:'job',sourceId:'radancy-primark',source:'Primark · portal oficial',id:'PRIMARK-'+offer.id,
  title:offer.title,employer:'Primark',city:resolved?.city??city,province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
  category:'servicios',categoryLabel:'Servicios y comercio',regime:remote?'Remoto':offer.regime??'Oferta de empleo',places:null,
  paragraphs:['Oferta publicada en el portal oficial de Primark.',`Ubicación indicada por la empresa: ${offer.city}.`,...(offer.category?[`Área indicada: ${offer.category}.`]:[]),'Consulta los requisitos y presenta tu candidatura en el enlace original.'],
  sourceUrl:new URL(offer.path,primarkListingUrl).href,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:resolved?.location??null};
}

export async function fetchPrimarkOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
 const first=parsePrimarkListing(await retryTransient(()=>fetchHtml(primarkListingUrl,{fetchImpl})));
 const offers=[...first.offers],ids=new Set(offers.map(offer=>offer.id));
 for(let page=2;page<=first.totalPages;page++) {
  if(fetchImpl===fetch) await new Promise(resolve=>setTimeout(resolve,500));
  const url=new URL(primarkListingUrl);url.searchParams.set('p',String(page));
  const current=parsePrimarkListing(await retryTransient(()=>fetchHtml(url.href,{fetchImpl})));
  if(current.page!==page||current.total!==first.total||current.totalPages!==first.totalPages) throw new TypeError('Paginación Primark cambió');
  for(const offer of current.offers){if(ids.has(offer.id)) throw new TypeError('Oferta Primark duplicada entre páginas');ids.add(offer.id);offers.push(offer);}
 }
 if(offers.length!==first.total) throw new TypeError('Captura Primark incompleta');
 return offers.map(offer=>adaptPrimarkOffer(offer,checkedAt,resolveCity));
}
