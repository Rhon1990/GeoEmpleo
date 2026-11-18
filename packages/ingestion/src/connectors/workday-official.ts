import type {PublicJob} from '../model.ts';
import {dateInSpain} from '../normalize.ts';
import {fetchHtml,retryTransient} from '../http.ts';
import type {CityResolver} from './bizneo.ts';

const spainId='bd34c524a6a04ae6915f5d96fa086199';
export const repsolListingUrl='https://repsol.wd3.myworkdayjobs.com/es/Repsol?Country='+spainId;
export const pwcListingUrl='https://www.pwc.es/es/carrera-profesional/student-job-search/results.html?wdcountry=ESP&wdjobsite=Global_Campus_Careers';
interface Board {sourceId:string;host:string;site:string;employer:string;category:string;categoryLabel:string}
export const repsolBoard:Board={sourceId:'workday-repsol',host:'repsol.wd3.myworkdayjobs.com',site:'Repsol',employer:'Repsol',category:'otros',categoryLabel:'Otros sectores'};
export const pwcBoard:Board={sourceId:'pwc-campus',host:'pwc.wd3.myworkdayjobs.com',site:'Global_Campus_Careers',employer:'PwC',category:'tecnologia',categoryLabel:'Tecnología y consultoría'};
interface ListedOffer {id:string;title:string;path:string;city:string;multiple:boolean;date:string|null;timeType:string|null}
function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Formato de listado inválido');
 return value as Record<string,unknown>;
}
function validDate(value:unknown):value is string {
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
}
function listedOffer(value:unknown):ListedOffer {
 const row=record(value),id=Array.isArray(row.bulletFields)?row.bulletFields[0]:null;
 if(typeof id!=='string'||!/^\d{4,}(?:WD)?$/.test(id)||typeof row.title!=='string'||!row.title.trim()) throw new TypeError('Oferta Workday inválida');
 const path=row.externalPath;
 if(typeof path!=='string'||!/^\/job\/[^/?#]+\/[^/?#]+$/.test(path)||!new RegExp('_'+id+'(?:-\\d+)?$').test(path)) throw new TypeError('Ruta Workday inválida');
 if(typeof row.locationsText!=='string'||!row.locationsText.trim()) throw new TypeError('Ubicación de listado ausente');
 return {id,title:row.title.trim(),path,city:row.locationsText.trim(),multiple:/^\d+ Locations?$/i.test(row.locationsText.trim()),date:null,timeType:typeof row.timeType==='string'?row.timeType:null};
}
export function parseWorkdayListing(input:unknown):{total:number;offers:ListedOffer[]} {
 const data=record(input);
 if(!Number.isSafeInteger(data.total)||Number(data.total)<0||Number(data.total)>2000||!Array.isArray(data.jobPostings)) throw new TypeError('Listado Workday inválido');
 const offers=data.jobPostings.map(listedOffer);
 if(new Set(offers.map(x=>x.path)).size!==offers.length) throw new TypeError('Oferta Workday duplicada');
 return {total:Number(data.total),offers};
}
export function parsePwcListing(html:string):ListedOffer[] {
 const raw=/\bvar\s+jsondata\s*=\s*(\[.*?\])\s*;/s.exec(html)?.[1];
 if(!raw) throw new TypeError('Listado PwC ausente');
 const rows:unknown=JSON.parse(raw);
 if(!Array.isArray(rows)||!rows.length||rows.length>2000) throw new TypeError('Volumen PwC inválido');
 const seen=new Set<string>();
 return rows.flatMap(value=>{
  const row=record(value);
  if(row.iso!=='ESP'||row.jobsite!==pwcBoard.site) throw new TypeError('Oferta PwC fuera de España o Campus');
  if(typeof row.apply!=='string') throw new TypeError('URL PwC ausente');
  const url=new URL(row.apply);
  if(url.protocol!=='https:'||url.hostname!==pwcBoard.host||url.port||url.username||url.password||url.search||url.hash||!url.pathname.startsWith('/'+pwcBoard.site+'/job/')||!url.pathname.endsWith('/apply')) throw new TypeError('URL PwC no autorizada');
  const offer=listedOffer({title:row.title,bulletFields:[row.jobreqid],externalPath:url.pathname.slice(pwcBoard.site.length+1,-6),locationsText:row.location,timeType:row.timetype});
  if(seen.has(offer.path)) throw new TypeError('Oferta PwC duplicada');
  seen.add(offer.path);
  if(!validDate(row.date)||typeof row.otherlocations!=='string') throw new TypeError('Metadatos PwC inválidos');
  // The Spanish campus feed also labels the Andorra office as ESP; do not map it to Teruel.
  if(row.location==='Andorra'&&row.region==='Andorra') return [];
  return [{...offer,date:row.date,multiple:Boolean(row.otherlocations.trim()),city:row.otherlocations.trim()?offer.city+' · '+row.otherlocations:offer.city}];
 });
}
const repsolCities:Readonly<Record<string,string>>={
 'Campus Repsol-Madrid':'Madrid','R.Materials Complejo Industrial Tarragona-Tarragona':'Tarragona',
 'R.Fuels Refineria A Coruna-A Coruna':'A Coruña','Polidux Fabrica Monzon-Huesca':'Monzón',
 'Solgas Xirivella-Valencia':'Xirivella','Delegacion Bilbao-Vizcaya':'Bilbao',
 'Delegacion Barcelona-Barcelona':'Barcelona','Delegacion Sevilla-Sevilla':'Sevilla',
};
export function adaptOfficialListing(offer:ListedOffer,board:Board,checkedAt:string,resolveCity:CityResolver):PublicJob {
 const remote=/\bremote\b|\bremoto\b/i.test(offer.city+' '+offer.title);
 const city=board.sourceId===repsolBoard.sourceId?(repsolCities[offer.city]??offer.city):offer.city.split(/\s*-\s+/)[0]!.trim();
 const ambiguous=offer.multiple||(board.sourceId===pwcBoard.sourceId&&city==='Las Palmas');
 const resolved=!ambiguous&&!remote?resolveCity(city):null;
 if(offer.date&&offer.date>dateInSpain(checkedAt)) throw new TypeError('Fecha de publicación futura');
 const sourceUrl='https://'+board.host+'/'+board.site+offer.path;
 return {kind:'job',sourceId:board.sourceId,source:board.employer+' · portal oficial',id:board.sourceId.toUpperCase()+'-'+offer.path.split('_').at(-1),
  title:offer.title,employer:board.employer,city:offer.multiple?offer.city:city,province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
  category:board.category,categoryLabel:board.categoryLabel,regime:remote?'Remoto':'Oferta de empleo',places:null,
  paragraphs:['Oferta publicada en el portal oficial de '+board.employer+'.','Ubicación indicada por la empresa: '+offer.city+'.',...(offer.timeType?['Jornada indicada: '+offer.timeType+'.']:[]),'Consulta los requisitos y presenta tu candidatura en el enlace original.'],
  sourceUrl,publishedAt:offer.date??dateInSpain(checkedAt),...(offer.date?{}:{dateKind:'observed' as const}),checkedAt,closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:resolved?.location??null};
}
export async function fetchRepsolOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
 const found=new Map<string,ListedOffer>();let expected:number|null=null;
 for(let offset=0;offset<(expected??20);offset+=20){
  if(offset) await new Promise(resolve=>setTimeout(resolve,1000));
  const response=await fetchImpl('https://'+repsolBoard.host+'/wday/cxs/repsol/Repsol/jobs',{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({appliedFacets:{Country:[spainId]},limit:20,offset,searchText:''}),redirect:'error',signal:AbortSignal.timeout(40_000)});
  if(!response.ok) throw new Error('HTTP '+response.status);
  if(!response.headers.get('content-type')?.includes('json')) throw new TypeError('Workday no devolvió JSON');
  const text=await response.text();if(text.length>8_000_000) throw new TypeError('Respuesta Workday demasiado grande');
  const data=record(JSON.parse(text));
  const page=parseWorkdayListing(data);
  if(expected===null){
   expected=page.total;
   const countries=Array.isArray(data.facets)?data.facets.map(record).find(x=>x.facetParameter==='Country'):null;
   const spain=Array.isArray(countries?.values)?countries.values.map(record).find(x=>x.id===spainId):null;
   if(!spain||spain.count!==expected) throw new TypeError('Filtro España no verificable');
  } else if(page.total!==0&&page.total!==expected) throw new TypeError('Listado Workday cambió');
  if(page.offers.length!==Math.min(20,expected-offset)) throw new TypeError('Paginación Workday incompleta');
  for(const offer of page.offers){if(found.has(offer.path)) throw new TypeError('Oferta Workday duplicada entre páginas');found.set(offer.path,offer);}
 }
 if(!expected||found.size!==expected) throw new TypeError('Paginación Workday incompleta');
 return [...found.values()].map(offer=>adaptOfficialListing(offer,repsolBoard,checkedAt,resolveCity));
}
export async function fetchPwcOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
 const offers=parsePwcListing(await retryTransient(()=>fetchHtml(pwcListingUrl,{fetchImpl})));
 if(!offers.length) throw new TypeError('Sin ofertas PwC españolas');
 return offers.map(offer=>adaptOfficialListing(offer,pwcBoard,checkedAt,resolveCity));
}
