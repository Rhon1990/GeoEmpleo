import {readFile} from 'node:fs/promises';
import type {PublicJob} from '../model.ts';
import {dateInSpain} from '../normalize.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import type {CityResolver} from './bizneo.ts';
import {approximateMunicipalNote,isoDate,record,requiredText} from './shared.ts';

export const elecnorListingUrl='https://elecnor.epreselec.com/Ofertas/Ofertas.aspx';
const allowedKeys=new Set(['id','title','city','province','publishedAt','locationNote']);
const utc=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface ElecnorObservedOffer {
  id:string;
  title:string;
  city:string;
  province:string;
  publishedAt:string;
  locationNote?:string;
}

function validatedOffer(value:unknown):ElecnorObservedOffer {
  const row=record(value,'Elecnor');
  if(Object.keys(row).some(key=>!allowedKeys.has(key))) {
    throw new TypeError('Oferta Elecnor inválida');
  }
  const offer={
    id:requiredText(row.id,'ID Elecnor'),
    title:requiredText(row.title,'título Elecnor'),
    city:requiredText(row.city,'localidad Elecnor'),
    province:requiredText(row.province,'provincia Elecnor'),
    publishedAt:isoDate(row.publishedAt,'publicación Elecnor'),
    ...('locationNote' in row?{locationNote:requiredText(row.locationNote,'advertencia de ubicación Elecnor')}:{}),
  };
  if(!/^\d+$/.test(offer.id))throw new TypeError('Oferta Elecnor inválida');
  return offer;
}

export function adaptElecnorObservedSnapshot(input:unknown,checkedAt:string,resolveCity:CityResolver):PublicJob[] {
  const snapshot=record(input,'instantánea Elecnor');
  if(Object.keys(snapshot).length!==3||!Array.isArray(snapshot.offers)||snapshot.offers.length===0) {
    throw new TypeError('Instantánea Elecnor inválida');
  }
  const observedAt=requiredText(snapshot.observedAt,'observación Elecnor');
  const expiresAt=requiredText(snapshot.expiresAt,'caducidad Elecnor');
  const observed=Date.parse(observedAt),expires=Date.parse(expiresAt);
  if(!utc.test(observedAt)||!utc.test(expiresAt)||!Number.isFinite(observed)||!Number.isFinite(expires)||
    new Date(observed).toISOString()!==observedAt||new Date(expires).toISOString()!==expiresAt||
    expires<=observed||expires-observed>14*86_400_000)throw new TypeError('Instantánea Elecnor inválida');
  const offers=snapshot.offers.map(validatedOffer);
  const ids=new Set<string>();
  for(const offer of offers) {
    if(ids.has(offer.id))throw new TypeError('Oferta Elecnor duplicada');
    if(offer.publishedAt>dateInSpain(observedAt))throw new TypeError('Publicación Elecnor futura');
    ids.add(offer.id);
  }
  const now=Date.parse(checkedAt);
  if(!Number.isFinite(now)||observed>now)throw new TypeError('Fecha de ejecución inválida');
  return (expires>=now?offers:[]).map(offer=>{
    const province=canonicalSpanishProvince(offer.province);
    const resolved=province&&!offer.locationNote?resolveCity(offer.city,province.name):null;
    const coherent=resolved?.province===province?.name;
    return {
      kind:'job',sourceId:'elecnor-oficial',source:'Elecnor · portal oficial',id:`ELECNOR-${offer.id}`,
      title:offer.title,employer:'Elecnor',city:offer.city,province:province?.name??offer.province,
      region:province?.region??'España',category:'industria',categoryLabel:'Industria y producción',
      regime:'Oferta de empleo',places:null,
      paragraphs:['Oferta publicada en el portal oficial de Elecnor.',...(offer.locationNote?[offer.locationNote]:[]),'Consulta la descripción, los requisitos y la vigencia en la ficha original.'],
      sourceUrl:`${elecnorListingUrl}?Id_Oferta=${offer.id}`,publishedAt:offer.publishedAt,checkedAt:observedAt,closingDate:null,salary:null,
      applicationRegistration:'external_required',selection:null,
      location:coherent&&resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null,
    };
  });
}

export async function loadElecnorObservedOffers(checkedAt:string,resolveCity:CityResolver):Promise<PublicJob[]> {
  const input=JSON.parse(await readFile(new URL('../../data/elecnor-observed.json',import.meta.url),'utf8')) as unknown;
  return adaptElecnorObservedSnapshot(input,checkedAt,resolveCity);
}
