import type {CityResolver} from './bizneo.ts';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {attribute,descendants,documentOf,hasClass,textOf} from './html-dom.ts';
import {dateInSpain} from '../normalize.ts';

export const eulenListingUrl='https://eulen.referrals.selectminds.com/grupoeulenespana/latest-jobs';
const sourceId='selectminds-eulen';

function categoryFor(label:string):{category:string;categoryLabel:string} {
  if(/sanidad|salud/i.test(label))return {category:'sanidad',categoryLabel:'Sanidad y salud'};
  if(/logística|almacén/i.test(label))return {category:'transporte',categoryLabel:'Transporte y logística'};
  if(/turismo|restauración/i.test(label))return {category:'hosteleria',categoryLabel:'Turismo y hostelería'};
  if(/oficios/i.test(label))return {category:'tecnico',categoryLabel:'Oficios técnicos'};
  return {category:'servicios',categoryLabel:'Servicios y comercio'};
}

export function adaptEulenListing(html:string,checkedAt:string,resolveCity:CityResolver):PublicJob[] {
  const rows=descendants(documentOf(html),element=>hasClass(element,'job_list_row'));
  if(!rows.length)throw new TypeError('Listado Eulen vacío');
  const jobs:PublicJob[]=[];
  const seen=new Set<string>();
  for(const row of rows){
    const id=/^job_list_(\d+)$/.exec(attribute(row,'id')??'')?.[1];
    if(!id)throw new TypeError('ID Eulen inválido');
    if(seen.has(id))throw new TypeError('Oferta Eulen duplicada');
    seen.add(id);
    const link=descendants(row,element=>element.tagName==='a'&&hasClass(element,'job_link'))[0];
    const raw=link&&attribute(link,'href');
    const url=raw&&new URL(raw);
    if(!url||url.protocol!=='https:'||url.hostname!=='eulen.referrals.selectminds.com'||url.port||url.username||url.password||
      !new RegExp(`^/grupoeulenespana/jobs/[^/]+-${id}$`).test(url.pathname)||url.search||url.hash)throw new TypeError('URL Eulen no autorizada');
    const title=textOf(link!);
    const locationNode=descendants(row,element=>element.tagName==='a'&&hasClass(element,'location'))[0];
    const locationText=locationNode&&textOf(locationNode).replace(/^🔍\s*/u,'');
    const match=locationText&&/^([^,]+),\s*([^,]+),\s*\d{5}\s*-\s*([^,]+),\s*España$/i.exec(locationText);
    if(!match||!title)continue;
    const province=canonicalSpanishProvince(match[1]!);
    if(!province)continue;
    const city=match[3]!.trim();
    const resolved=resolveCity(city,province.name);
    const descriptionNode=descendants(row,element=>hasClass(element,'jlr_description'))[0];
    const description=descriptionNode&&textOf(descriptionNode);
    const categoryNode=descendants(row,element=>hasClass(element,'jlr_category_field'))[0];
    const category=categoryFor(categoryNode?textOf(categoryNode):'');
    jobs.push({kind:'job',sourceId,source:'Grupo Eulen · empleo oficial',id:`EULEN-${id}`,
      title,employer:'Grupo Eulen',city:resolved?.city??city,province:province.name,region:province.region,
      ...category,regime:'Oferta de empleo',places:null,
      paragraphs:[description||`Oferta publicada por Grupo Eulen en ${city}.`,'Consulta el detalle y las condiciones en la ficha original.'],
      sourceUrl:url.href,publishedAt:dateInSpain(checkedAt),dateKind:'observed',checkedAt,
      closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:resolved?.location??null});
  }
  if(!jobs.length)throw new TypeError('Eulen sin ofertas españolas verificables');
  return jobs;
}

export async function fetchEulenOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const response=await fetchImpl(eulenListingUrl,{headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(40_000)});
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('html'))throw new Error('Listado Eulen no disponible');
  const html=await response.text();
  if(html.length>2_000_000)throw new TypeError('Listado Eulen demasiado grande');
  return adaptEulenListing(html,checkedAt,resolveCity);
}
