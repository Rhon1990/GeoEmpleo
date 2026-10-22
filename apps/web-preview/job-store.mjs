import {readFile,stat} from 'node:fs/promises';
import {searchCalls} from './public/catalog.mjs';

const summaryFields=['id','kind','source','sourceId','title','employer','city','province','region','category','categoryLabel','regime','places','sourceUrl','publishedAt','checkedAt','closingDate','salary','applicationRegistration','selection','location'];
function parseFilters(params) {
  const filters={};
  for(const [name,max] of [['q',200],['city',120],['category',80]]) {
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
      const facets={categories:[...categories].map(([id,label])=>({id,label})),regions:[...new Set(calls.map(job=>job.region))].sort((a,b)=>a.localeCompare(b,'es'))};
      const matches=searchCalls(calls,filters);
      return {checkedAt:catalog.checkedAt,sources:[...new Set(calls.map(job=>job.source))],facets,total:matches.length,truncated:matches.length>300,jobs:matches.slice(0,300).map(job=>Object.fromEntries(summaryFields.map(field=>[field,job[field]])))};
    },
    async detail(id) {
      if(typeof id!=='string' || !id || id.length>120) throw new TypeError('Parámetros de detalle inválidos');
      const {byId}=await load();
      return publicJobs().find(job=>job.id===id)??byId.get(id)??null;
    },
  };
}
