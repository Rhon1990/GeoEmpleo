import type { PublicJob } from '../model.ts';
import { htmlToParagraphs } from '../normalize.ts';
import type { CityResolver } from './bizneo.ts';
import { approximateMunicipalNote } from './shared.ts';
import { attribute, descendants, documentOf, hasClass, innerHtml, textOf } from './html-dom.ts';

export const carrefourListingUrl='https://carrefour.talentforjobs.com/particular/carrefour/web/ofertas-empleo.aspx';
const sourceId='carrefour-talentforjobs';
const sourceLabel='Carrefour España · portal de empleo';
const maxPages=200;
const maxOffers=2000;

export interface CarrefourListedOffer {
  readonly id:string;
  readonly title:string;
  readonly city:string;
  readonly descriptionHtml:string;
  readonly sourceUrl:string;
}

export interface CarrefourListingPage {
  readonly offers:readonly CarrefourListedOffer[];
  readonly currentPage:number;
  readonly totalPages:number;
  readonly nextPageValue:number|null;
}

function checkedJobUrl(raw:string):{url:string;id:string} {
  const url=new URL(raw,carrefourListingUrl);
  const ids=url.searchParams.getAll('j');
  if(url.protocol!=='https:'||url.hostname!=='carrefour.talentforjobs.com'||url.port||url.username||url.password||
    url.pathname!=='/ofertas/trabajo.aspx'||ids.length!==1||!ids[0]||[...url.searchParams.keys()].some(key=>key!=='j')||url.hash) {
    throw new TypeError('URL Carrefour no autorizada');
  }
  return {url:url.href,id:`CARREFOUR-${Buffer.from(ids[0]).toString('base64url')}`};
}

export function parseCarrefourListing(html:string):CarrefourListingPage {
  const document=documentOf(html);
  const form=descendants(document,element=>element.tagName==='form'&&attribute(element,'id')==='form1')[0];
  const pager=descendants(document,element=>attribute(element,'id')==='ph_divPag')[0];
  if(!form||!pager) throw new TypeError('Listado Carrefour incompleto');
  const formAction=attribute(form,'action')??'';
  const action=new URL(formAction,carrefourListingUrl);
  if(action.origin!==new URL(carrefourListingUrl).origin||action.pathname!==new URL(carrefourListingUrl).pathname||action.search||action.hash) {
    throw new TypeError('Paginación Carrefour no autorizada');
  }
  const pageMatch=/\b(\d+)\s*\/\s*(\d+)\b/.exec(textOf(pager));
  const currentPage=Number(pageMatch?.[1]);
  const totalPages=Number(pageMatch?.[2]);
  if(!pageMatch||!Number.isSafeInteger(currentPage)||currentPage<1||!Number.isSafeInteger(totalPages)||totalPages<currentPage||totalPages>maxPages) {
    throw new TypeError('Número de páginas Carrefour inválido');
  }
  const cards=descendants(document,element=>element.tagName==='div'&&hasClass(element,'list-group-item')&&hasClass(element,'corpt4j'));
  const offers=cards.map(card=>{
    const heading=descendants(card,element=>element.tagName==='h4')[0];
    const location=descendants(card,element=>hasClass(element,'ubicacion'))[0];
    const description=descendants(card,element=>element.tagName==='p'&&hasClass(element,'pe-contenido'))[0];
    const link=descendants(card,element=>element.tagName==='a'&&hasClass(element,'solicitar'))[0];
    const title=heading?textOf(heading):'';
    const city=location?textOf(location):'';
    const descriptionHtml=description?innerHtml(description):'';
    const href=link?attribute(link,'href'):null;
    if(!title||!descriptionHtml||!href) throw new TypeError('Oferta Carrefour incompleta');
    const checked=checkedJobUrl(href);
    return {id:checked.id,title,city,descriptionHtml,sourceUrl:checked.url};
  });
  const ids=new Set<string>();
  for(const offer of offers) {
    if(ids.has(offer.id)) throw new TypeError('Oferta Carrefour duplicada');
    ids.add(offer.id);
  }
  const nextLink=descendants(pager,element=>element.tagName==='a'&&/siguiente/i.test(textOf(element)))[0];
  const nextMatch=nextLink?/(?:ph_hdnPg|hdnPg)[^]*?\.val\(['"](\d+)['"]\)/i.exec(attribute(nextLink,'onclick')??''):null;
  const nextPageValue=nextMatch?Number(nextMatch[1]):null;
  if((currentPage<totalPages&&(nextPageValue!==currentPage))||(currentPage===totalPages&&nextPageValue!==null)||offers.length===0||offers.length>maxOffers) {
    throw new TypeError('Paginación u ofertas Carrefour inválidas');
  }
  return {offers,currentPage,totalPages,nextPageValue};
}

function postbackFields(html:string,pageValue:number):URLSearchParams {
  const document=documentOf(html);
  const form=descendants(document,element=>element.tagName==='form'&&attribute(element,'id')==='form1')[0];
  if(!form) throw new TypeError('Formulario Carrefour ausente');
  const fields=new URLSearchParams();
  for(const input of descendants(form,element=>element.tagName==='input')) {
    const name=attribute(input,'name');
    const type=(attribute(input,'type')??'text').toLowerCase();
    if(!name||['button','reset','image','file'].includes(type)) continue;
    if(['checkbox','radio'].includes(type)&&attribute(input,'checked')===null) continue;
    fields.set(name,attribute(input,'value')??'');
  }
  for(const select of descendants(form,element=>element.tagName==='select')) {
    const name=attribute(select,'name');
    if(!name) continue;
    const options=descendants(select,element=>element.tagName==='option');
    fields.delete(name);
    if(attribute(select,'multiple')!==null) {
      for(const option of options.filter(item=>attribute(item,'selected')!==null)) fields.append(name,attribute(option,'value')??textOf(option));
    } else {
      const option=options.find(item=>attribute(item,'selected')!==null)??options[0];
      if(option) fields.set(name,attribute(option,'value')??textOf(option));
    }
  }
  const pageField=[...new Set([...fields.keys()])].find(name=>/\$ph\$hdnPg$/i.test(name));
  if(!pageField) throw new TypeError('Control de página Carrefour ausente');
  fields.set(pageField,String(pageValue));
  fields.set('ctl00$ph$btnBO','');
  return fields;
}

function resolveMunicipality(city:string,resolveCity:CityResolver) {
  const clean=city.replace(/^carrefour\s+/i,'').trim();
  const tokens=clean.split(/\s+/).filter(Boolean);
  const candidates=new Map<string,ReturnType<CityResolver>>();
  const add=(name:string)=>{
    const place=resolveCity(name);
    if(place) candidates.set(`${place.province}|${place.city}|${place.location?.point.join(',')??''}`,place);
  };
  add(clean);
  for(let start=0;start<tokens.length;start++) for(let end=start+1;end<=tokens.length;end++) add(tokens.slice(start,end).join(' '));
  return candidates.size===1?[...candidates.values()][0]??null:null;
}

function adaptCarrefourOffer(offer:CarrefourListedOffer,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const paragraphs=htmlToParagraphs(offer.descriptionHtml);
  if(!paragraphs.length) throw new TypeError('Descripción Carrefour vacía');
  const resolved=offer.city?resolveMunicipality(offer.city,resolveCity):null;
  return {
    kind:'job',sourceId,source:sourceLabel,id:offer.id,title:offer.title,employer:'Carrefour',city:offer.city||'Ubicación no indicada',
    province:resolved?.province??'Sin verificar',region:resolved?.region??'España',category:'servicios',
    categoryLabel:'Servicios y comercio',regime:'Oferta de empleo',places:null,paragraphs,sourceUrl:offer.sourceUrl,
    publishedAt:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(checkedAt)),
    dateKind:'observed',checkedAt,closingDate:null,salary:null,applicationRegistration:'unknown',selection:null,
    location:resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null,
  };
}

async function readHtml(response:Response):Promise<string> {
  if(!response.ok) {await response.body?.cancel();throw new Error(`HTTP ${response.status}`);}
  if(!response.headers.get('content-type')?.toLowerCase().includes('html')) {await response.body?.cancel();throw new TypeError('Carrefour no devolvió HTML');}
  const html=await response.text();
  if(html.length>2_000_000) throw new TypeError('Respuesta Carrefour demasiado grande');
  return html;
}

async function requestPage(url:string,fetchImpl:typeof fetch,body?:URLSearchParams):Promise<string> {
  const response=await fetchImpl(url,{
    method:body?'POST':'GET',
    headers:body?{accept:'text/html','content-type':'application/x-www-form-urlencoded'}:{accept:'text/html'},
    ...(body?{body}:{}),redirect:'error',signal:AbortSignal.timeout(15_000),
  });
  return readHtml(response);
}

export async function fetchCarrefourOffers(
  checkedAt:string,
  resolveCity:CityResolver,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  const offers=new Map<string,CarrefourListedOffer>();
  let html=await requestPage(carrefourListingUrl,fetchImpl);
  let page=parseCarrefourListing(html);
  const totalPages=page.totalPages;
  for(let current=1;current<=totalPages;current++) {
    if(page.currentPage!==current||page.totalPages!==totalPages) throw new TypeError('El listado Carrefour cambió durante la captura');
    for(const offer of page.offers) {
      if(offers.has(offer.id)) throw new TypeError('Oferta Carrefour repetida entre páginas');
      offers.set(offer.id,offer);
    }
    if(current===totalPages) break;
    await new Promise(resolve=>setTimeout(resolve,150));
    html=await requestPage(carrefourListingUrl,fetchImpl,postbackFields(html,page.nextPageValue!));
    page=parseCarrefourListing(html);
  }
  if(offers.size===0||offers.size>maxOffers) throw new TypeError('Volumen Carrefour inválido');
  return [...offers.values()].map(offer=>adaptCarrefourOffer(offer,checkedAt,resolveCity));
}
