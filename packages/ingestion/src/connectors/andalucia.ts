import type {PlaceResolver} from '../geography.ts';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {dateInSpain,htmlToParagraphs} from '../normalize.ts';
import {record,requiredText,numericIdentifier,isoDate} from './shared.ts';

/** The API's En curso includes selection processes with expired application windows. */
export function adaptAndaluciaOffers(input:unknown,checkedAt:string,resolve:PlaceResolver):PublicJob[] {
 const snapshot=record(input,'Andalucía');
 if(!Array.isArray(snapshot.results)||snapshot.hits!==snapshot.results.length||snapshot.total_hits!==snapshot.results.length)throw new TypeError('Captura Andalucía incompleta');
 const today=dateInSpain(checkedAt);const seen=new Set<string>();const jobs:PublicJob[]=[];
 for(const raw of snapshot.results){
  const offer=record(raw,'Andalucía');const id=numericIdentifier(offer.id,'Andalucía');
  if(seen.has(id))throw new TypeError('Identidad Andalucía duplicada');seen.add(id);
  if(offer.announcement_status!=='En curso'||!['Oferta de empleo','Oferta genérica SAE','Bolsa de trabajo','Oferta de empleo de estabilización'].includes(String(offer.announcement_type)))continue;
  if(offer.deadline_application==null||offer.deadline_application==='')continue;
  const publishedAt=isoDate(offer.publish_date,'Andalucía');const closingDate=isoDate(offer.deadline_application,'Andalucía');
  if(publishedAt>today||closingDate<today)continue;
  if(closingDate<publishedAt)throw new TypeError('Plazo Andalucía inválido');
  const title=requiredText(offer.job_name,'Andalucía');
  if(!Array.isArray(offer.job_location)||!offer.job_location.length)throw new TypeError('Ubicación Andalucía ausente');
  const places=offer.job_location.map(rawLocation=>{
   const location=record(rawLocation,'Andalucía');
   const city=requiredText(location.locality,'Andalucía');
   if(!Array.isArray(location.field_lugar_provincia)||location.field_lugar_provincia.length!==1)throw new TypeError('Provincia Andalucía ambigua');
   const province=canonicalSpanishProvince(requiredText(record(location.field_lugar_provincia[0],'Andalucía').provinces,'Andalucía'));
   if(!province||province.region!=='Andalucía')throw new TypeError('Provincia Andalucía inválida');
   return {city,province:province.name};
  });
  const unique=[...new Map(places.map(place=>[`${place.province}:${place.city.toLocaleLowerCase('es')}`,place])).values()];
  const single=unique.length===1?unique[0]:undefined;
  const paragraphs:string[]=[];
  for(const [key,label] of [['functions','Funciones'],['job_official_degree_requirements','Titulación oficial'],['job_specific_degree_requirements','Titulación específica'],['job_other_requirements','Otros requisitos']]){
   const value=offer[key!];if(value==null||value==='')continue;
   const lines=htmlToParagraphs(requiredText(value,'Andalucía'));if(lines.length)paragraphs.push(`${label}:`,...lines);
  }
  if(!paragraphs.length)throw new TypeError('Descripción Andalucía vacía');
  paragraphs.push(`Lugar de trabajo publicado: ${unique.map(place=>`${place.city} (${place.province})`).join('; ')}.`);
  jobs.push({kind:'job',sourceId:'andalucia-entidades',source:'Junta de Andalucía · Entidades instrumentales',id:`ANDALUCIA-${id}`,title,employer:'Oferta publicada por la Junta de Andalucía',city:unique.map(place=>place.city).join(' / '),province:[...new Set(unique.map(place=>place.province))].join(' / '),region:'Andalucía',category:'otros',categoryLabel:'Otros',regime:requiredText(offer.job_agreement,'Andalucía'),places:null,paragraphs,sourceUrl:`https://www.juntadeandalucia.es/organismos/transparencia/empleo-publico/entidades-instrumentales/ofertas-empleo/detalle/${id}.html`,publishedAt,checkedAt,closingDate,salary:null,applicationRegistration:'unknown',selection:String(offer.announcement_type),location:single?resolve(single.city,single.province):null});
 }
 return jobs;
}
