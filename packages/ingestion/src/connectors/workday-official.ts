import type {PublicJob} from '../model.ts';
import {dateInSpain} from '../normalize.ts';
import {fetchHtml,fetchJson,retryTransient} from '../http.ts';
import type {CityResolver} from './bizneo.ts';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const workdaySpainId='bd34c524a6a04ae6915f5d96fa086199';
export const repsolListingUrl='https://repsol.wd3.myworkdayjobs.com/es/Repsol?Country='+workdaySpainId;
export const pwcListingUrl='https://www.pwc.es/es/carrera-profesional/student-job-search/results.html?wdcountry=ESP&wdjobsite=Global_Campus_Careers';
interface Board {sourceId:string;host:string;site:string;employer:string;category:string;categoryLabel:string;cityFromLocation?:(value:string)=>string;sourcePrefix?:string}
export interface WorkdayBoard extends Board {tenant:string;facetParameter:string;listingUrl:string;verifyFacetCount?:boolean}
export const repsolBoard:WorkdayBoard={sourceId:'workday-repsol',host:'repsol.wd3.myworkdayjobs.com',tenant:'repsol',site:'Repsol',facetParameter:'Country',listingUrl:repsolListingUrl,verifyFacetCount:true,sourcePrefix:'/es',employer:'Repsol',category:'otros',categoryLabel:'Otros sectores'};
export const santanderListingUrl='https://santander.wd3.myworkdayjobs.com/es/SantanderCareers/jobs?source=Santander_com&locationCountry='+workdaySpainId;
export const iberdrolaListingUrl='https://iberdrola.wd3.myworkdayjobs.com/es/Iberdrola/jobs?locationCountry='+workdaySpainId;
export const santanderBoard:WorkdayBoard={sourceId:'workday-santander',host:'santander.wd3.myworkdayjobs.com',tenant:'santander',site:'SantanderCareers',facetParameter:'locationCountry',listingUrl:santanderListingUrl,sourcePrefix:'/es',employer:'Banco Santander',category:'otros',categoryLabel:'Banca y seguros'};
export const iberdrolaBoard:WorkdayBoard={sourceId:'workday-iberdrola',host:'iberdrola.wd3.myworkdayjobs.com',tenant:'iberdrola',site:'Iberdrola',facetParameter:'locationCountry',listingUrl:iberdrolaListingUrl,sourcePrefix:'/es',employer:'Iberdrola',category:'industria',categoryLabel:'Industria y producción',cityFromLocation:value=>value.replace(/^Spain,\s*/i,'').replace(/^(?:EDIF\.\s*)?IBERDROLA\s+/i,'').trim()};
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
 if(typeof id!=='string'||!/^(?:\d{4,}(?:WD)?|Req\d{4,}|R-\d{4,})$/.test(id)||typeof row.title!=='string'||!row.title.trim()) throw new TypeError('Oferta Workday inválida');
 const path=row.externalPath;
 const escapedId=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 if(typeof path!=='string'||!/^\/job\/[^/?#]+\/[^/?#]+$/.test(path)||!new RegExp('_'+escapedId+'(?:-\\d+)?$').test(path)) throw new TypeError('Ruta Workday inválida');
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
function parseWorkdayLocations(input:unknown,board:WorkdayBoard,offer:ListedOffer):string[] {
 const data=record(input),info=record(data.jobPostingInfo);
 if(info.jobReqId!==offer.id||info.title!==offer.title||typeof info.externalUrl!=='string') throw new TypeError('Detalle Workday inválido');
 const externalUrl=new URL(info.externalUrl);
 const expectedPaths=[`/${board.site}${offer.path}`,`/es/${board.site}${offer.path}`];
 if(externalUrl.protocol!=='https:'||externalUrl.hostname!==board.host||externalUrl.port||externalUrl.username||externalUrl.password||externalUrl.search||externalUrl.hash||!expectedPaths.includes(externalUrl.pathname)) throw new TypeError('URL de detalle Workday no autorizada');
 const values=[info.location,...(Array.isArray(info.additionalLocations)?info.additionalLocations:[])];
 if(values.length<2||values.length>50||values.some(value=>typeof value!=='string'||!value.trim())) throw new TypeError('Ubicaciones Workday inválidas');
 return [...new Set((values as string[]).map(value=>value.trim()))];
}
export function parsePwcListing(html:string):ListedOffer[] {
 const raw=/\bvar\s+jsondata\s*=\s*(\[.*?\])\s*;/s.exec(html)?.[1];
 if(!raw) throw new TypeError('Listado PwC ausente');
 const rows:unknown=JSON.parse(raw);
 if(!Array.isArray(rows)||!rows.length||rows.length>2000) throw new TypeError('Volumen PwC inválido');
 const seen=new Set<string>();
 return rows.flatMap(value=>{
  const row=record(value);
  if((row.title==null||row.title==='')&&row.apply===''&&row.date===''&&row.iso==='') return [];
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
 const city=board.sourceId===repsolBoard.sourceId?(repsolCities[offer.city]??offer.city):(board.cityFromLocation?.(offer.city)??offer.city.split(/\s*-\s+/)[0]!.trim());
 const ambiguous=offer.multiple||(board.sourceId===pwcBoard.sourceId&&city==='Las Palmas');
 const resolved=!ambiguous&&!remote?resolveCity(city):null;
 if(offer.date&&offer.date>dateInSpain(checkedAt)) throw new TypeError('Fecha de publicación futura');
 const sourceUrl='https://'+board.host+(board.sourcePrefix??'')+'/'+board.site+offer.path;
 return {kind:'job',sourceId:board.sourceId,source:board.employer+' · portal oficial',id:board.sourceId.toUpperCase()+'-'+offer.path.split('_').at(-1),
  title:offer.title,employer:board.employer,city:offer.multiple?offer.city:(resolved?.city??city),province:resolved?.province??'Sin verificar',region:resolved?.region??'España',
  category:board.category,categoryLabel:board.categoryLabel,regime:remote?'Remoto':'Oferta de empleo',places:null,
  paragraphs:['Oferta publicada en el portal oficial de '+board.employer+'.','Ubicación indicada por la empresa: '+offer.city+'.',...(offer.timeType?['Jornada indicada: '+offer.timeType+'.']:[]),'Consulta los requisitos y presenta tu candidatura en el enlace original.'],
  sourceUrl,publishedAt:offer.date??dateInSpain(checkedAt),...(offer.date?{}:{dateKind:'observed' as const}),checkedAt,closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:resolved?.location??null};
}
export async function fetchWorkdayOffers(board:WorkdayBoard,checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
 const found=new Map<string,ListedOffer>();let expected:number|null=null;
 for(let offset=0;offset<(expected??20);offset+=20){
  if(offset&&fetchImpl===fetch) await new Promise(resolve=>setTimeout(resolve,1000));
  const response=await retryTransient(async()=>{
   const result=await fetchImpl('https://'+board.host+'/wday/cxs/'+board.tenant+'/'+board.site+'/jobs',{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({appliedFacets:{[board.facetParameter]:[workdaySpainId]},limit:20,offset,searchText:''}),redirect:'error',signal:AbortSignal.timeout(40_000)});
   if(!result.ok) throw new Error('HTTP '+result.status);
   return result;
  });
  if(!response.headers.get('content-type')?.includes('json')) throw new TypeError('Workday no devolvió JSON');
  const text=await response.text();if(text.length>8_000_000) throw new TypeError('Respuesta Workday demasiado grande');
  const data=record(JSON.parse(text));
  const page=parseWorkdayListing(data);
  if(expected===null){
   expected=page.total;
   if(board.verifyFacetCount){
    const countries=Array.isArray(data.facets)?data.facets.map(record).find(x=>x.facetParameter===board.facetParameter):null;
    const spain=Array.isArray(countries?.values)?countries.values.map(record).find(x=>x.id===workdaySpainId):null;
    if(!spain||spain.count!==expected) throw new TypeError('Filtro España no verificable');
   }
  } else if(page.total!==0&&page.total!==expected) throw new TypeError('Listado Workday cambió');
  if(page.offers.length!==Math.min(20,expected-offset)) throw new TypeError('Paginación Workday incompleta');
  for(const offer of page.offers){if(found.has(offer.path)) throw new TypeError('Oferta Workday duplicada entre páginas');found.set(offer.path,offer);}
 }
 if(!expected||found.size!==expected) throw new TypeError('Paginación Workday incompleta');
 const jobs:PublicJob[]=[];
 for(const offer of found.values()) {
  if(!offer.multiple) {jobs.push(adaptOfficialListing(offer,board,checkedAt,resolveCity));continue;}
  let locations:string[];
  try {
   const detailUrl='https://'+board.host+'/wday/cxs/'+board.tenant+'/'+board.site+offer.path;
   locations=parseWorkdayLocations(await retryTransient(()=>fetchJson(detailUrl,{fetchImpl})),board,offer);
  } catch {jobs.push(adaptOfficialListing(offer,board,checkedAt,resolveCity));continue;}
  for(const location of locations) {
   const job=adaptOfficialListing({...offer,city:location,multiple:false},board,checkedAt,resolveCity);
   const locationKey=createHash('sha256').update(location.trim().toLocaleLowerCase('es')).digest('hex').slice(0,12);
   jobs.push({...job,id:`${job.id}-L${locationKey}`});
  }
 }
 return jobs;
}
export async function fetchRepsolOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
 try {return await fetchWorkdayOffers(repsolBoard,checkedAt,resolveCity,fetchImpl);}
 catch(error) {
  if(!(error instanceof Error)||error.message!=='HTTP 429') throw error;
  const snapshot=record(JSON.parse(await readFile(new URL('../../data/repsol-observed.json',import.meta.url),'utf8')));
  if(Object.keys(snapshot).length!==3||typeof snapshot.observedAt!=='string'||typeof snapshot.expiresAt!=='string') throw new TypeError('Instantánea Repsol inválida');
  const observed=Date.parse(snapshot.observedAt),expires=Date.parse(snapshot.expiresAt),current=Date.parse(checkedAt);
  if(!Number.isFinite(observed)||!Number.isFinite(expires)||!Number.isFinite(current)||expires<=observed||expires-observed>14*86_400_000||current<observed) throw new TypeError('Instantánea Repsol inválida');
  if(current>expires) throw new TypeError('Instantánea Repsol caducada');
  const listing=parseWorkdayListing(snapshot.listing);
  if(!listing.total||listing.offers.length!==listing.total) throw new TypeError('Instantánea Repsol incompleta');
  return listing.offers.map(offer=>adaptOfficialListing(offer,repsolBoard,snapshot.observedAt as string,resolveCity));
 }
}
export async function fetchPwcOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
 const offers=parsePwcListing(await retryTransient(()=>fetchHtml(pwcListingUrl,{fetchImpl})));
 if(!offers.length) throw new TypeError('Sin ofertas PwC españolas');
 return offers.map(offer=>adaptOfficialListing(offer,pwcBoard,checkedAt,resolveCity));
}
