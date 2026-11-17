import {readFile,stat} from 'node:fs/promises';
import {employerFacet,searchCalls} from './public/catalog.mjs';
import {summaryFields,projectFields,mapSummaries,countMappedJobs} from './public/job-projections.mjs';
import {isOfferOnDay,newestOfferFirst,readTodayFilter} from './public/today-offers.mjs';
function parseFilters(params) {
  const filters={};
  Object.assign(filters,readTodayFilter(params));
  for(const [name,max] of [['q',200],['city',120],['category',80],['employer',120]]) {
    if(params.getAll(name).length>1 || (params.get(name)?.length??0)>max) throw new TypeError('Parámetros de búsqueda inválidos');
    filters[name]=params.get(name)??'';
  }
  if(params.has('bounds')) {
    const raw=params.get('bounds').split(',');
    const bounds=raw.map(Number);
    const [west,south,east,north]=bounds;
    if(params.getAll('bounds').length>1 || raw.length!==4 || raw.some(value=>!value.trim()) || !bounds.every(Number.isFinite) || Math.abs(west)>180 || Math.abs(east)>180 || Math.abs(south)>90 || Math.abs(north)>90 || south>north) throw new TypeError('Parámetros del área inválidos');
    filters.bounds=bounds;
  }
  return filters;
}
/** Snapshot-backed local read model. Replaced atomically by ingestion; no per-request full JSON download. */
/** @param {string|URL} path @param {()=>any[]} publicJobs */
export function createJobStore(path,publicJobs=()=>[]) {
  let cached;
  let signature;
  async function load() {
    const info=await stat(path,{bigint:true});
    const nextSignature=`${info.ino}:${info.size}:${info.mtimeNs}`;
    if(cached && signature===nextSignature) return cached;
    const catalog=JSON.parse(await readFile(path,'utf8'));
    if(!Array.isArray(catalog.calls)) throw new Error('Catálogo inválido');
    const next={catalog,byId:new Map(catalog.calls.map(job=>[job.id,job]))};
    cached=next;signature=nextSignature;
    return next;
  }
  return {
    async query(params) {
      const filters=parseFilters(params);
      const {catalog}=await load();
      const calls=[...catalog.calls,...publicJobs()];
      const categories=new Map(calls.map(job=>[job.category,job.categoryLabel]));
      const employers=new Map();
      for(const call of calls)if(call.employer){const facet=employerFacet(call.employer,call.sourceId);if(!employers.has(facet.id))employers.set(facet.id,facet.label);}
      const facets={categories:[...categories].map(([id,label])=>({id,label})),regions:[...new Set(calls.map(job=>job.region))].sort((a,b)=>a.localeCompare(b,'es')),employers:[...employers].map(([id,label])=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label,'es'))};
      const nationalMatches=searchCalls(calls,{...filters,bounds:undefined});
      const matches=filters.bounds?searchCalls(nationalMatches,{bounds:filters.bounds}):nationalMatches;
      const todayNational=filters.day?nationalMatches.filter(job=>isOfferOnDay(job,filters.day)):[];
      const todayMatches=filters.day?matches.filter(job=>isOfferOnDay(job,filters.day)):[];
      const selected=filters.onlyToday?todayMatches.sort(newestOfferFirst):matches;
      const selectedNational=filters.onlyToday?todayNational:nationalMatches;
      return {checkedAt:catalog.checkedAt,sources:[...new Set(calls.map(job=>job.source))],facets,catalogTotal:selectedNational.length,catalogMappedTotal:countMappedJobs(selectedNational),todayTotal:todayMatches.length,total:selected.length,truncated:selected.length>300,jobs:selected.slice(0,300).map(job=>projectFields(job,summaryFields)),mapJobs:mapSummaries(selected)};
    },
    async detail(id) {
      if(typeof id!=='string' || !id || id.length>120) throw new TypeError('Parámetros de detalle inválidos');
      const {byId}=await load();
      return publicJobs().find(job=>job.id===id)??byId.get(id)??null;
    },
  };
}
