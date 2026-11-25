import type { PublicJob } from '../model.ts';
import { dateInSpain, htmlToParagraphs } from '../normalize.ts';
import { fetchHtml } from '../http.ts';
import { attribute, descendants, documentOf, hasClass, innerHtml, textOf } from './html-dom.ts';

export interface BizneoBoard {
  readonly sourceId:string;
  readonly hostname:string;
  readonly employer:string;
  readonly category:string;
  readonly categoryLabel:string;
  readonly excludedTitlePattern?:RegExp;
  readonly maxPages?:number;
  readonly maxJobs?:number;
  readonly detailConcurrency?:number;
  readonly verifyListedTotal?:boolean;
  readonly status?:'active'|'paused';
}

export interface ResolvedCity {
  readonly city:string;
  readonly province:string;
  readonly region:string;
  readonly location:PublicJob['location'];
}
export type CityResolver = (city:string,provinceHint?:string)=>ResolvedCity|null;
export interface BizneoListedOffer { readonly url:string; readonly title:string; readonly city:string; readonly remote:boolean }

export const bizneoBoards:readonly BizneoBoard[]=[
  {sourceId:'bizneo-burger-king',hostname:'empleo.bkspain.es',employer:'Burger King España',category:'hosteleria',categoryLabel:'Turismo y hostelería'},
  {sourceId:'bizneo-plenergy',hostname:'empleo.plenergy.es',employer:'Plenergy',category:'servicios',categoryLabel:'Servicios y comercio'},
  {sourceId:'bizneo-telepizza',hostname:'ofertas.fooddeliverybrands.com',employer:'Telepizza',category:'hosteleria',categoryLabel:'Turismo y hostelería'},
  {sourceId:'bizneo-coviran',hostname:'jobs.coviran.com',employer:'Covirán',category:'servicios',categoryLabel:'Servicios y comercio',excludedTitlePattern:/^autocandidatura\b/i},
  {sourceId:'bizneo-iss',hostname:'jobs.iss.es',employer:'ISS Facility Services',category:'oficios',categoryLabel:'Oficios técnicos'},
  {sourceId:'bizneo-iman',hostname:'empleo.imancorp.es',employer:'IMAN',category:'otros',categoryLabel:'Otros sectores',maxPages:300,maxJobs:5_000,verifyListedTotal:true,excludedTitlePattern:/^(?:no_postular|test push)\b/i},
  {sourceId:'bizneo-faster',hostname:'jobs.faster.es',employer:'Faster Empleo',category:'otros',categoryLabel:'Otros sectores',maxPages:50,maxJobs:500,verifyListedTotal:true},
];

function validatedJobUrl(raw:string,board:BizneoBoard):string {
  const url=new URL(raw,`https://${board.hostname}`);
  if(url.protocol!=='https:'||url.hostname!==board.hostname||url.port||url.username||url.password||
    !/^\/jobs\/[a-z0-9][a-z0-9_-]*$/i.test(url.pathname)||url.search||url.hash) throw new TypeError('URL Bizneo no autorizada');
  return url.href;
}

export function parseBizneoListing(html:string,board:BizneoBoard):{offers:BizneoListedOffer[];nextPage:number|null;listedTotal:number|null;excludedCount:number} {
  const document=documentOf(html);
  const boardNode=descendants(document,element=>attribute(element,'id')==='job-board')[0];
  if(!boardNode) throw new TypeError('Tablón Bizneo no encontrado');
  const cards=descendants(boardNode,element=>element.tagName==='a'&&hasClass(element,'job-card'));
  const offers=cards.map(card=>{
    const raw=attribute(card,'href');
    if(!raw) throw new TypeError('Enlace Bizneo ausente');
    const titleNode=descendants(card,element=>hasClass(element,'title'))[0];
    const detailsNode=descendants(card,element=>hasClass(element,'details'))[0];
    const spans=detailsNode?descendants(detailsNode,element=>element.tagName==='span'):[];
    const title=titleNode?textOf(titleNode):'';
    const citySpan=spans.find(span=>!hasClass(span,'aggregation'));
    const city=citySpan?textOf(citySpan):'';
    if(!title||!city) throw new TypeError('Oferta Bizneo sin título o localidad');
    if(board.excludedTitlePattern?.test(title)) return null;
    return {url:validatedJobUrl(raw,board),title,city,remote:spans.some(span=>/\bremot[oa]\b/i.test(textOf(span)))};
  }).filter((offer):offer is BizneoListedOffer=>offer!==null);
  const next=descendants(document,element=>element.tagName==='a'&&hasClass(element,'next'))[0];
  const nextUrl=next?attribute(next,'href'):null;
  const page=nextUrl?new URL(nextUrl,`https://${board.hostname}`).searchParams.get('page'):null;
  const nextPage=page&&/^\d+$/.test(page)?Number(page):null;
  if(nextPage!==null&&(!Number.isSafeInteger(nextPage)||nextPage<2||nextPage>(board.maxPages??20))) throw new TypeError('Paginación Bizneo inválida');
  const header=descendants(document,element=>attribute(element,'id')==='jobs-header')[0];
  const listedTotal=header?Number(/\b([\d.]+) ofertas?\b/i.exec(textOf(header))?.[1]?.replace(/\./g,'')):null;
  if(board.verifyListedTotal&&(!Number.isSafeInteger(listedTotal)||!listedTotal||listedTotal>(board.maxJobs??300)))
    throw new TypeError('Total Bizneo ausente o inesperado');
  return {offers,nextPage,listedTotal:listedTotal&&Number.isSafeInteger(listedTotal)?listedTotal:null,excludedCount:cards.length-offers.length};
}

export function adaptBizneoDetail(offer:BizneoListedOffer,html:string,checkedAt:string,resolveCity:CityResolver,board:BizneoBoard):PublicJob {
  const document=documentOf(html);
  const heading=descendants(document,element=>element.tagName==='h1')[0];
  if(!heading||textOf(heading)!==offer.title) throw new TypeError('Detalle Bizneo no corresponde al listado');
  const content=descendants(document,element=>hasClass(element,'general-content'));
  const paragraphs=content.flatMap(section=>htmlToParagraphs(innerHtml(section)));
  if(!paragraphs.length) throw new TypeError('Detalle Bizneo vacío');
  const detailCity=descendants(document,element=>attribute(element,'title')==='Ubicación')[0];
  const detailLocation=detailCity?textOf(detailCity):'';
  const place=resolveCity(offer.city);
  const sameCity=!detailLocation||detailLocation.toLocaleLowerCase('es-ES').includes(offer.city.toLocaleLowerCase('es-ES'));
  const slug=new URL(offer.url).pathname.slice('/jobs/'.length);
  return {
    kind:'job',sourceId:board.sourceId,source:`${board.employer} · portal de empleo`,
    id:`BIZNEO-${board.sourceId.toUpperCase()}-${slug}`,title:offer.title,employer:board.employer,
    city:offer.city,province:place?.province??'Sin verificar',region:place?.region??'España',
    category:board.category,categoryLabel:board.categoryLabel,regime:offer.remote?'Remoto':'Oferta de empleo',
    places:null,paragraphs,sourceUrl:offer.url,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:offer.remote||!sameCity?null:place?.location??null,
  };
}

export async function fetchBizneoOffers(board:BizneoBoard,checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const found=new Map<string,BizneoListedOffer>();
  let page=1;
  let listedTotal:number|null=null;
  let excludedCount=0;
  while(true){
    if(board.sourceId==='bizneo-iman'&&page>1&&fetchImpl===fetch) await new Promise(resolve=>setTimeout(resolve,1500));
    const url=new URL(`https://${board.hostname}/jobs`);
    if(page>1) url.searchParams.set('page',String(page));
    const parsed=parseBizneoListing(await fetchHtml(url.href,{fetchImpl}),board);
    if(page===1) listedTotal=parsed.listedTotal;
    excludedCount+=parsed.excludedCount;
    let added=0;
    for(const offer of parsed.offers){if(found.has(offer.url))continue;found.set(offer.url,offer);added++;}
    if(!added) throw new TypeError('Paginación Bizneo repetida');
    if(!parsed.nextPage) break;
    if(parsed.nextPage!==page+1) throw new TypeError('Salto de página Bizneo inválido');
    page=parsed.nextPage;
  }
  if(found.size===0||found.size>(board.maxJobs??300)||
    (board.verifyListedTotal&&found.size+excludedCount!==listedTotal)) throw new TypeError('Volumen Bizneo inesperado');
  const offers=[...found.values()];
  if(board.sourceId==='bizneo-iman') return offers.map(offer=>{
    const place=resolveCity(offer.city);
    const slug=new URL(offer.url).pathname.slice('/jobs/'.length);
    return {kind:'job',sourceId:board.sourceId,source:`${board.employer} · portal de empleo`,
      id:`BIZNEO-${board.sourceId.toUpperCase()}-${slug}`,title:offer.title,employer:board.employer,
      city:offer.city,province:place?.province??'Sin verificar',region:place?.region??'España',
      category:board.category,categoryLabel:board.categoryLabel,regime:offer.remote?'Remoto':'Oferta de empleo',
      places:null,paragraphs:['Consulta la descripción y las condiciones en la oferta original de IMAN.'],
      sourceUrl:offer.url,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,
      closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
      location:offer.remote?null:place?.location??null};
  });
  const jobs:PublicJob[]=[];
  const concurrency=board.detailConcurrency??4;
  for(let index=0;index<offers.length;index+=concurrency){
    jobs.push(...await Promise.all(offers.slice(index,index+concurrency).map(async offer=>
      adaptBizneoDetail(offer,await fetchHtml(offer.url,{fetchImpl}),checkedAt,resolveCity,board))));
  }
  return jobs;
}
