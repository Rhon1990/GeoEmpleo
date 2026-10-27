import type { PublicJob } from '../model.ts';
import { fetchJson } from '../http.ts';
import { htmlToParagraphs } from '../normalize.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import type { CityResolver } from './bizneo.ts';
import { approximateMunicipalNote } from './shared.ts';

export const lidlSearchEndpoint='https://empleo.lidl.es/api/v1/search';
const pageSize=100;
const maxPages=20;
const maxJobs=2000;
const sourceId='lidl-search-api';
const sourceLabel='Lidl España · portal de empleo';

class LidlSnapshotChangedError extends Error {}

interface LidlJob {
  postingId?:unknown;
  requisitionId?:unknown;
  title?:unknown;
  location?:unknown;
  jobDetailUrl?:unknown;
  onlineFrom?:unknown;
  onlineUntil?:unknown;
  descResponsibilities?:unknown;
  salaryValue?:unknown;
  salaryNote?:unknown;
  workingModel?:unknown;
}

interface LidlPage {
  jobs:LidlJob[];
  page:number;
  totalCount:number;
}

function record(value:unknown):Record<string,unknown>|null {
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}

function text(value:unknown):string {
  return typeof value==='string'?value.trim():'';
}

export function parseLidlSearchPage(value:unknown,expectedPage:number):LidlPage {
  const payload=record(value);
  const meta=record(payload?.meta);
  if(!payload||!meta||!Array.isArray(payload.jobs)) throw new TypeError('Respuesta Lidl inválida');
  const page=meta.page;
  const count=meta.count;
  const totalCount=meta.totalCount;
  const resultsPerPage=meta.resultsPerPage;
  if(typeof page!=='number'||page!==expectedPage||typeof count!=='number'||!Number.isSafeInteger(count)||count!==payload.jobs.length||
    typeof totalCount!=='number'||!Number.isSafeInteger(totalCount)||totalCount<0||totalCount>maxJobs||
    resultsPerPage!==pageSize||payload.jobs.length>pageSize) throw new TypeError('Paginación Lidl inválida');
  return {jobs:payload.jobs as LidlJob[],page,totalCount};
}

function checkedUrl(value:unknown,requisitionId:string):string {
  const raw=text(value);
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.hostname!=='empleo.lidl.es'||url.port||url.username||url.password||
    !/^\/jobs\/[a-z0-9][a-z0-9._%-]*-\d+$/i.test(url.pathname)||!url.pathname.endsWith(`-${requisitionId}`)||url.search||url.hash) {
    throw new TypeError('URL Lidl no autorizada');
  }
  return url.href;
}

function municipalName(city:string):string {
  return city.replace(/\s+\((?:Fuerteventura|Gran Canaria|Lanzarote|Tenerife|La Palma|Mallorca|Menorca|Ibiza)\)$/i,'').trim();
}

function cityCandidates(location:Record<string,unknown>):string[] {
  const candidates=[municipalName(text(location.city))];
  const address=text(location.name);
  const lastAddressPart=address.split(',').map(part=>part.trim()).filter(Boolean).at(-1)??'';
  if(lastAddressPart&&!/^store\s/i.test(lastAddressPart)) candidates.push(lastAddressPart);
  return [...new Set(candidates.filter(Boolean))];
}

function onlineDate(value:unknown,checkedAt:string):string {
  const date=Date.parse(text(value));
  if(!Number.isFinite(date)||date>Date.parse(checkedAt)+86_400_000) throw new TypeError('Fecha de publicación Lidl inválida');
  return new Date(date).toISOString().slice(0,10);
}

function adaptLidlJob(job:LidlJob,checkedAt:string,resolveCity:CityResolver):PublicJob|null {
  const title=text(job.title);
  const postingId=text(job.postingId);
  const requisitionId=text(job.requisitionId);
  const location=record(job.location);
  const country=text(location?.country);
  const city=text(location?.city);
  if(!/^\d{3,20}$/.test(postingId)||!/^\d{3,20}$/.test(requisitionId)||!title||!location||!city||country!=='ES') throw new TypeError('Oferta Lidl incompleta');
  const sourceUrl=checkedUrl(job.jobDetailUrl,requisitionId);
  const closingDate=text(job.onlineUntil);
  const closingInstant=closingDate?Date.parse(closingDate):null;
  if(closingDate&&(!Number.isFinite(closingInstant)||closingInstant!<=Date.parse(checkedAt))) return null;
  const publishedAt=onlineDate(job.onlineFrom,checkedAt);
  const paragraphs=htmlToParagraphs(text(job.descResponsibilities));
  const salaryNote=text(job.salaryNote);
  const salaryText=text(job.salaryValue);
  if(salaryText) paragraphs.push(`Salario publicado por Lidl: ${salaryText}${salaryNote?` · ${salaryNote}`:''}`);
  if(!paragraphs.length) throw new TypeError('Descripción Lidl vacía');
  const found=cityCandidates(location).map(candidate=>resolveCity(candidate)).find(Boolean)??null;
  const locationPoint=found?.location?{...found.location,note:approximateMunicipalNote}:null;
  const province=found?.province??canonicalSpanishProvince(text(location.state))?.name??'Sin verificar';
  const region=found?.region??canonicalSpanishProvince(text(location.state))?.region??'España';
  const regime=/remote|remot|teletrabajo/i.test(`${text(job.workingModel)} ${text(location.type)}`)?'Remoto':'Oferta de empleo';
  return {
    kind:'job',sourceId,source:sourceLabel,id:`LIDL-${postingId}`,title,employer:'Lidl España',city,
    province,region,category:'servicios',categoryLabel:'Servicios y comercio',regime,places:null,paragraphs,
    sourceUrl,publishedAt,checkedAt,closingDate:closingDate||null,salary:null,applicationRegistration:'unknown',
    selection:null,location:regime==='Remoto'?null:locationPoint,
  };
}

export function adaptLidlSearchPage(value:unknown,checkedAt:string,resolveCity:CityResolver,expectedPage=1):{jobs:PublicJob[];totalCount:number} {
  const page=parseLidlSearchPage(value,expectedPage);
  const jobs=page.jobs.map(job=>adaptLidlJob(job,checkedAt,resolveCity)).filter((job):job is PublicJob=>job!==null);
  return {jobs,totalCount:page.totalCount};
}

async function fetchLidlSnapshot(
  checkedAt:string,
  resolveCity:CityResolver,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  const jobs=new Map<string,PublicJob>();
  let totalCount=0;
  let retrieved=0;
  for(let page=1;page<=maxPages;page++) {
    const url=new URL(lidlSearchEndpoint);
    url.searchParams.set('general',JSON.stringify({page,resultsPerPage:pageSize,sortField:'',sortOrder:'asc'}));
    const parsed=parseLidlSearchPage(await fetchJson(url.href,{fetchImpl}),page);
    totalCount=Math.max(totalCount,parsed.totalCount);
    retrieved+=parsed.jobs.length;
    for(const item of parsed.jobs) {
      const job=adaptLidlJob(item,checkedAt,resolveCity);
      if(job) {
        if(jobs.has(job.id)) throw new LidlSnapshotChangedError('El listado Lidl cambió durante la paginación');
        jobs.set(job.id,job);
      }
    }
    if(retrieved>=totalCount) break;
  }
  if(totalCount===0||retrieved!==totalCount||jobs.size!==totalCount) throw new LidlSnapshotChangedError('Captura Lidl incompleta');
  return [...jobs.values()];
}

export async function fetchLidlOffers(
  checkedAt:string,
  resolveCity:CityResolver,
  fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  for(let attempt=0;attempt<2;attempt++) {
    try {
      return await fetchLidlSnapshot(checkedAt,resolveCity,fetchImpl);
    } catch(error) {
      if(!(error instanceof LidlSnapshotChangedError)||attempt===1) throw error;
    }
  }
  throw new TypeError('Captura Lidl incompleta');
}
