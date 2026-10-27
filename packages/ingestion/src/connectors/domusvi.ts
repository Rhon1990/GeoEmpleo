import type {PublicJob} from '../model.ts';
import {dateInSpain} from '../normalize.ts';
import {fetchHtml} from '../http.ts';
import type {CityResolver} from './bizneo.ts';
import {attribute,descendants,documentOf,hasClass,textOf} from './html-dom.ts';

export interface DomusViListedOffer {
  readonly url:string;
  readonly title:string;
  readonly city:string;
  readonly remote:boolean;
}

export const domusViListingUrl='https://empleo.domusvi.es/jobs';
const sourceId='bizneo-domusvi';

function validatedUrl(raw:string):string {
  const url=new URL(raw,domusViListingUrl);
  if(url.protocol!=='https:'||url.hostname!=='empleo.domusvi.es'||url.port||url.username||url.password||
    !/^\/jobs\/[a-z0-9][a-z0-9-]*$/i.test(url.pathname)||url.search||url.hash) {
    throw new TypeError('URL DomusVi no autorizada');
  }
  return url.href;
}

export function parseDomusViListing(html:string):{offers:DomusViListedOffer[];nextPage:number|null} {
  const document=documentOf(html);
  const board=descendants(document,element=>attribute(element,'id')==='job-board')[0];
  if(!board)throw new TypeError('Tablón DomusVi no encontrado');
  const cards=descendants(board,element=>element.tagName==='a'&&hasClass(element,'job-card'));
  if(!cards.length)throw new TypeError('Listado DomusVi vacío');
  const offers=cards.map(card=>{
    const raw=attribute(card,'href');
    const titleNode=descendants(card,element=>hasClass(element,'title'))[0];
    const details=descendants(card,element=>hasClass(element,'details'))[0];
    const spans=details?descendants(details,element=>element.tagName==='span'):[];
    const cityNode=spans.find(span=>!hasClass(span,'aggregation')&&!/\b(presencial|remot[oa]|h[ií]brid[oa])\b/i.test(textOf(span)));
    const title=titleNode?textOf(titleNode):'';
    const city=cityNode?textOf(cityNode):'';
    if(!raw||!title||!city)throw new TypeError('Oferta DomusVi incompleta');
    return {url:validatedUrl(raw),title,city,
      remote:spans.some(span=>/\bremot[oa]\b/i.test(textOf(span)))};
  });
  const next=descendants(document,element=>element.tagName==='a'&&hasClass(element,'next'))[0];
  const nextUrl=next?attribute(next,'href'):null;
  const page=nextUrl?new URL(nextUrl,domusViListingUrl).searchParams.get('page'):null;
  const nextPage=page&&/^\d+$/.test(page)?Number(page):null;
  if(nextPage!==null&&(!Number.isSafeInteger(nextPage)||nextPage<2||nextPage>40)) {
    throw new TypeError('Paginación DomusVi inválida');
  }
  return {offers,nextPage};
}

export function adaptDomusViOffer(offer:DomusViListedOffer,checkedAt:string,resolveCity:CityResolver):PublicJob {
  const url=validatedUrl(offer.url);
  const slug=new URL(url).pathname.slice('/jobs/'.length);
  const resolved=resolveCity(offer.city);
  return {kind:'job',sourceId,source:'DomusVi · portal oficial',id:`DOMUSVI-${slug}`,
    title:offer.title,employer:'DomusVi',city:resolved?.city??offer.city,
    province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
    category:'cuidados',categoryLabel:'Cuidados y servicios',regime:offer.remote?'Remoto':'Oferta de empleo',places:null,
    paragraphs:[`Oferta publicada por DomusVi en ${offer.city}.`,'Consulta descripción, requisitos y vigencia en la ficha original.'],
    sourceUrl:url,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:offer.remote?null:resolved?.location??null};
}

export async function fetchDomusViOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const found=new Map<string,DomusViListedOffer>();
  let page=1;
  while(true){
    const url=new URL(domusViListingUrl);
    if(page>1)url.searchParams.set('page',String(page));
    const parsed=parseDomusViListing(await fetchHtml(url.href,{fetchImpl}),);
    let added=0;
    for(const offer of parsed.offers){if(found.has(offer.url))continue;found.set(offer.url,offer);added++;}
    if(!added)throw new TypeError('Paginación DomusVi repetida');
    if(!parsed.nextPage)break;
    if(parsed.nextPage!==page+1)throw new TypeError('Salto de página DomusVi inválido');
    page=parsed.nextPage;
  }
  if(found.size===0||found.size>500)throw new TypeError('Volumen DomusVi inesperado');
  return [...found.values()].map(offer=>adaptDomusViOffer(offer,checkedAt,resolveCity));
}
