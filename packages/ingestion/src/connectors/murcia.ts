import type {PublicJob} from '../model.ts';
import type {PlaceResolver} from '../geography.ts';
import {categoryForSector, htmlToParagraphs, spanishDate} from '../normalize.ts';

function object(value:unknown): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Registro SEF inválido');
  return value as Record<string,unknown>;
}
function text(value:unknown):string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Campo SEF obligatorio ausente');
  return value.trim();
}
export function dateInSpain(instant:string):string {
  const date=new Date(instant);
  if (!Number.isFinite(date.valueOf())) throw new TypeError('Instante de captura inválido');
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
/** A malformed record invalidates the snapshot rather than silently closing valid jobs. */
export function adaptMurciaOffers(input:unknown,checkedAt:string,resolve:PlaceResolver):PublicJob[] {
  if (!Array.isArray(input)) throw new TypeError('SEF Murcia debe devolver un array');
  const today=dateInSpain(checkedAt);
  const seen=new Set<string>();
  const jobs:PublicJob[]=[];
  for(const raw of input) {
    const offer=object(raw);
    const externalId=text(offer.numeroOferta);
    if(!/^\d{12}$/.test(externalId) || seen.has(externalId)) throw new TypeError('Identidad SEF inválida o duplicada');
    seen.add(externalId);
    const publishedAt=spanishDate(text(offer.fechaDeInicio));
    const closingDate=spanishDate(text(offer.fechaDeFin));
    if(!publishedAt || !closingDate || closingDate<publishedAt) throw new TypeError('Fechas SEF inválidas');
    const municipality=object(offer.municipio);
    const province=object(municipality.provincia);
    const city=text(municipality.municipio);
    const provinceName=text(province.provincia);
    const sourceUrl=new URL(text(offer.urlDetalles));
    if(sourceUrl.protocol!=='https:' || sourceUrl.hostname!=='sefoficinavirtual.carm.es' || sourceUrl.username || sourceUrl.password) throw new TypeError('URL SEF no autorizada');
    const title=text(offer.descripcion);
    const paragraphs=htmlToParagraphs(text(offer.adicionales));
    if(!paragraphs.length) throw new TypeError('Descripción SEF vacía');
    const sector=object(offer.sectorProfesional);
    const category=categoryForSector(typeof sector.id==='string'?sector.id:'');
    if(closingDate<today || publishedAt>today) continue;
    jobs.push({kind:'job',sourceId:'sef-murcia',source:'SEF Murcia',id:`SEF-MURCIA-${externalId}`,title,employer:'Oferta gestionada por SEF Murcia',city,province:provinceName,region:'Región de Murcia',category:category.category,categoryLabel:category.label,regime:'Oferta de empleo',places:null,paragraphs,sourceUrl:sourceUrl.href,publishedAt,checkedAt,closingDate,salary:null,applicationRegistration:'external_required',selection:null,location:resolve(city,provinceName)});
  }
  return jobs;
}
