import type {PublicJob} from '../model.ts';
import {htmlToParagraphs} from '../normalize.ts';
import type {CityResolver} from './bizneo.ts';
import {postbackFields,requestPage} from './carrefour.ts';
import {attribute,descendants,documentOf,hasClass,innerHtml,textOf} from './html-dom.ts';
import {approximateMunicipalNote} from './shared.ts';

export const alcampoListingUrl='https://talentforjobs.com/particular/alcampo/ofertas-empleo.aspx';
const sourceId='talentforjobs-alcampo';
const maxPages=200;
const maxOffers=1500;

interface ListedOffer {readonly id:string;readonly title:string;readonly city:string;readonly url:string}
interface ListingPage {readonly offers:ListedOffer[];readonly page:number;readonly totalPages:number;readonly next:number|null}

function checkedUrl(raw:string):{url:string;id:string} {
  const url=new URL(raw,alcampoListingUrl);
  const tokens=url.searchParams.getAll('j');
  if(url.protocol!=='https:'||url.hostname!=='talentforjobs.com'||url.port||url.username||url.password||
    url.pathname!=='/ofertas/trabajo.aspx'||tokens.length!==1||!tokens[0]||
    [...url.searchParams.keys()].some(key=>key!=='j')||url.hash)throw new TypeError('URL Alcampo no autorizada');
  return {url:url.href,id:`ALCAMPO-${Buffer.from(tokens[0]).toString('base64url')}`};
}

export function parseAlcampoListing(html:string):ListingPage {
  const document=documentOf(html);
  const form=descendants(document,e=>e.tagName==='form'&&attribute(e,'id')==='form1')[0];
  const pager=descendants(document,e=>attribute(e,'id')==='ph_divPag')[0];
  if(!form||!pager)throw new TypeError('Listado Alcampo incompleto');
  const action=new URL(attribute(form,'action')??'',alcampoListingUrl);
  if(action.origin!==new URL(alcampoListingUrl).origin||action.pathname!==new URL(alcampoListingUrl).pathname||action.search||action.hash)
    throw new TypeError('Paginación Alcampo no autorizada');
  const match=/(\d+)\s*\/\s*(\d+)/.exec(textOf(pager));
  const page=Number(match?.[1]),totalPages=Number(match?.[2]);
  if(!match||!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(totalPages)||totalPages<page||totalPages>maxPages)
    throw new TypeError('Paginación Alcampo inválida');
  const cards=descendants(document,e=>e.tagName==='div'&&hasClass(e,'list-group-item')&&hasClass(e,'corpt4j'));
  const offers=cards.map(card=>{
    const heading=descendants(card,e=>e.tagName==='h4')[0];
    const location=descendants(card,e=>hasClass(e,'ubicacion'))[0];
    const link=descendants(card,e=>e.tagName==='a'&&hasClass(e,'solicitar'))[0];
    const title=heading?textOf(heading):'',city=location?textOf(location):'';
    if(!title||!city||!link)throw new TypeError('Oferta Alcampo sin título, localidad o enlace');
    return {...checkedUrl(attribute(link,'href')??''),title,city};
  });
  const nextLink=descendants(pager,e=>e.tagName==='a'&&/siguiente/i.test(textOf(e)))[0];
  const nextMatch=nextLink?/(?:ph_hdnPg|hdnPg)[^]*?\.val\(['"](\d+)['"]\)/i.exec(attribute(nextLink,'onclick')??''):null;
  const next=nextMatch?Number(nextMatch[1]):null;
  if(!offers.length||offers.length>6||new Set(offers.map(o=>o.id)).size!==offers.length||
    (page<totalPages&&next!==page)||(page===totalPages&&next!==null))
    throw new TypeError('Página Alcampo incompleta o duplicada');
  return {offers,page,totalPages,next};
}

function adaptDetail(offer:ListedOffer,detail:{html:string;id:string},checkedAt:string,resolveCity:CityResolver):PublicJob {
  const {html,id}=detail;
  const document=documentOf(html);
  const pageTitle=descendants(document,e=>e.tagName==='title')[0];
  const description=descendants(document,e=>attribute(e,'id')==='contDescPuesto')[0];
  const normalized=(value:string)=>value.replace(/\s+/g,' ').trim().toLocaleLowerCase('es');
  if(!pageTitle||normalized(textOf(pageTitle))!==normalized(`Alcampo Trabajo - ${offer.title}`)||!description)
    throw new TypeError('Ficha Alcampo no corresponde al listado');
  const paragraphs=htmlToParagraphs(innerHtml(description));
  if(!paragraphs.length)throw new TypeError('Descripción Alcampo vacía');
  const resolved=resolveCity(offer.city);
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(checkedAt));
  return {kind:'job',sourceId,source:'Alcampo · portal oficial',id:`ALCAMPO-${id}`,title:offer.title,
    employer:'Alcampo',city:offer.city,province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
    category:'servicios',categoryLabel:'Servicios y comercio',regime:'Oferta de empleo',places:null,paragraphs,
    sourceUrl:offer.url,publishedAt:date,dateKind:'observed',checkedAt,closingDate:null,salary:null,
    applicationRegistration:'external_required',selection:null,
    location:resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null};
}

async function readDetail(url:string,fetchImpl:typeof fetch):Promise<{html:string;id:string}> {
  let response=await fetchImpl(url,{headers:{accept:'text/html'},redirect:'manual',signal:AbortSignal.timeout(20_000)});
  if(response.status<300||response.status>=400)throw new TypeError('Ficha Alcampo sin identificador estable');
  const target=new URL(response.headers.get('location')??'',url);
  const id=target.searchParams.get('j');
  if(target.protocol!=='https:'||target.hostname!=='talentforjobs.com'||target.pathname!=='/ofertas/empleos/alcampo/trabajo.aspx'||
    !/^\d+$/.test(id??'')||!target.searchParams.has('e')||!target.searchParams.has('p'))
    throw new TypeError('Redirección Alcampo no autorizada');
  await response.body?.cancel();
  response=await fetchImpl(target.href,{headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(20_000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  if(!response.headers.get('content-type')?.toLowerCase().includes('html'))throw new TypeError('Ficha Alcampo no devolvió HTML');
  const html=await response.text();
  if(html.length>2_000_000)throw new TypeError('Ficha Alcampo demasiado grande');
  return {html,id:id!};
}

export async function fetchAlcampoOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const offers=new Map<string,ListedOffer>();
  let html=await requestPage(alcampoListingUrl,fetchImpl),page=parseAlcampoListing(html);
  const totalPages=page.totalPages;
  for(let current=1;current<=totalPages;current++) {
    if(page.page!==current||page.totalPages!==totalPages)throw new TypeError('Listado Alcampo cambió durante la captura');
    for(const offer of page.offers) {
      if(offers.has(offer.id))throw new TypeError('Oferta Alcampo duplicada entre páginas');
      offers.set(offer.id,offer);
    }
    if(current===totalPages)break;
    html=await requestPage(alcampoListingUrl,fetchImpl,postbackFields(html,page.next!));
    page=parseAlcampoListing(html);
  }
  if(offers.size===0||offers.size>maxOffers)throw new TypeError('Volumen Alcampo inválido');
  const jobs:PublicJob[]=[],listed=[...offers.values()];
  for(let index=0;index<listed.length;index+=6)
    jobs.push(...await Promise.all(listed.slice(index,index+6).map(async offer=>
      adaptDetail(offer,await readDetail(offer.url,fetchImpl),checkedAt,resolveCity))));
  if(new Set(jobs.map(job=>job.id)).size!==jobs.length)throw new TypeError('IDs Alcampo duplicados');
  return jobs;
}
