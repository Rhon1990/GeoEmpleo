import {searchCalls} from './catalog.mjs';

const summaryFields=['id','kind','source','sourceId','title','employer','city','province','region','category','categoryLabel','regime','places','sourceUrl','publishedAt','checkedAt','closingDate','salary','applicationRegistration','selection','location'];
const normalize=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim();

export function placeShardKey(input) {
  return normalize(input).split(' ')[0]?.slice(0,2)??'';
}

export function shardPlaces(places) {
  const shards=new Map();
  for(const place of places) {
    const words=normalize([place.name,place.label,...(place.aliases??[]),...(place.postalCodes??[])].join(' ')).split(' ');
    for(const key of new Set(words.filter(word=>word.length>=2).map(word=>word.slice(0,2)))) {
      if(!shards.has(key))shards.set(key,[]);
      shards.get(key).push(place);
    }
  }
  return shards;
}

function json(body,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
}

function filtersFrom(params) {
  const filters={};
  for(const [name,max] of [['q',200],['city',120],['category',80]]) {
    if(params.getAll(name).length>1||(params.get(name)?.length??0)>max)throw new TypeError('Parámetros inválidos');
    filters[name]=params.get(name)??'';
  }
  if(params.has('bounds')) {
    const raw=params.get('bounds').split(',');
    const bounds=raw.map(Number);
    const [west,south,east,north]=bounds;
    if(params.getAll('bounds').length!==1||raw.length!==4||raw.some(value=>!value.trim())||!bounds.every(Number.isFinite)||Math.abs(west)>180||Math.abs(east)>180||Math.abs(south)>90||Math.abs(north)>90||south>north)throw new TypeError('Área inválida');
    filters.bounds=bounds;
  }
  return filters;
}

export function createStaticDataFetch({fetchImpl=fetch}={}) {
  let catalogPromise;
  const placePromises=new Map();
  async function catalog() {
    if(!catalogPromise)catalogPromise=fetchImpl('/data/calls.json').then(async response=>{
      if(!response.ok)throw new Error('Catálogo no disponible');
      const data=await response.json();
      if(!Array.isArray(data.calls)||typeof data.checkedAt!=='string'||new Set(data.calls.map(job=>job.id)).size!==data.calls.length)throw new Error('Catálogo inválido');
      return data;
    }).catch(error=>{catalogPromise=null;throw error;});
    return catalogPromise;
  }
  async function placeShard(key) {
    if(!placePromises.has(key))placePromises.set(key,fetchImpl(`/data/place-shards/${key}.json`).then(async response=>{
      if(response.status===404)return [];
      if(!response.ok)throw new Error('Localidades no disponibles');
      const data=await response.json();
      if(!Array.isArray(data))throw new Error('Índice de localidades inválido');
      return data;
    }).catch(error=>{placePromises.delete(key);throw error;}));
    return placePromises.get(key);
  }
  return async function staticDataFetch(url) {
    const parsed=new URL(url,'https://geoempleo.invalid');
    const params=parsed.searchParams;
    if(parsed.pathname==='/api/jobs') {
      const data=await catalog();
      const calls=data.calls;
      const matches=searchCalls(calls,filtersFrom(params));
      const categories=new Map(calls.map(job=>[job.category,job.categoryLabel]));
      return json({checkedAt:data.checkedAt,sources:[...new Set(calls.map(job=>job.source))],facets:{categories:[...categories].map(([id,label])=>({id,label})),regions:[...new Set(calls.map(job=>job.region))].sort((a,b)=>a.localeCompare(b,'es'))},total:matches.length,truncated:matches.length>300,jobs:matches.slice(0,300).map(job=>Object.fromEntries(summaryFields.map(field=>[field,job[field]])))});
    }
    if(parsed.pathname==='/api/job') {
      if(params.getAll('id').length!==1||!params.get('id')||params.get('id').length>120)throw new TypeError('ID inválido');
      const job=(await catalog()).calls.find(job=>job.id===params.get('id'));
      return json(job??{error:'Oferta no disponible'},job?200:404);
    }
    if(parsed.pathname==='/api/places') {
      if(params.getAll('q').length>1||(params.get('q')?.length??0)>120)throw new TypeError('Consulta inválida');
      const input=params.get('q')??'';
      const value=normalize(input);
      if(value.length<2)return json({query:input,places:[],truncated:false});
      const key=placeShardKey(input);
      const tokens=value.split(' ');
      const candidates=(await placeShard(key)).filter(place=>tokens.every(token=>normalize([place.label,...(place.aliases??[]),...(place.postalCodes??[])].join(' ')).includes(token)));
      const score=place=>{
        const names=[place.name,...(place.aliases??[])].map(normalize);
        return names.includes(value)?0:place.postalCodes?.includes(value)?1:names.some(name=>name.startsWith(value))?2:3;
      };
      candidates.sort((a,b)=>score(a)-score(b)||a.label.localeCompare(b.label,'es'));
      return json({query:input,places:candidates.slice(0,20),truncated:candidates.length>20});
    }
    return fetchImpl(url);
  };
}

const staticFetch=createStaticDataFetch();
export function siteFetch(url,options) {
  return globalThis.document?.documentElement?.dataset?.delivery==='static'&&String(url).startsWith('/api/')?staticFetch(url):fetch(url,options);
}
