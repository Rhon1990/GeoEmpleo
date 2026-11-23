import {employerFacet,searchCalls} from './catalog.mjs?v=20261118-optional-territories';
import {formatPlaceSuggestion,mergeEquivalentPlaces,normalizePlaceSearchText,placeSearchText,rankPlaceSuggestions,samePlaceProvince} from './place-suggestions.mjs?v=20261118-place-hierarchy';
import {summaryFields,projectFields,mapSummaries,countMappedJobs} from './job-projections.mjs?v=20261110-mobile-zone-carousel';
import {isOfferOnDay,newestOfferFirst,readTodayFilter} from './today-offers.mjs';

export function placeShardKey(input) {
  return normalizePlaceSearchText(input).split(' ')[0]?.slice(0,2)??'';
}

export function shardPlaces(places) {
  const shards=new Map();
  for(const place of mergeEquivalentPlaces(places)) {
    const words=normalizePlaceSearchText(placeSearchText(place)).split(' ');
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
  Object.assign(filters,readTodayFilter(params));
  for(const [name,max] of [['q',200],['city',120],['category',80],['employer',120]]) {
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
      const filters=filtersFrom(params);
      const nationalMatches=searchCalls(calls,{...filters,bounds:undefined});
      const matches=filters.bounds?searchCalls(nationalMatches,{bounds:filters.bounds}):nationalMatches;
      const todayNational=filters.day?nationalMatches.filter(job=>isOfferOnDay(job,filters.day)):[];
      const todayMatches=filters.day?matches.filter(job=>isOfferOnDay(job,filters.day)):[];
      const selected=filters.onlyToday?todayMatches.sort(newestOfferFirst):matches;
      const selectedNational=filters.onlyToday?todayNational:nationalMatches;
      const categories=new Map(calls.map(job=>[job.category,job.categoryLabel]));
      const employers=new Map();
      for(const call of calls)if(call.employer){const facet=employerFacet(call.employer,call.sourceId);if(!employers.has(facet.id))employers.set(facet.id,facet.label);}
      return json({checkedAt:data.checkedAt,sources:[...new Set(calls.map(job=>job.source))],facets:{categories:[...categories].map(([id,label])=>({id,label})),regions:[...new Set(calls.map(job=>job.region))].sort((a,b)=>a.localeCompare(b,'es')),employers:[...employers].map(([id,label])=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label,'es'))},catalogTotal:selectedNational.length,catalogMappedTotal:countMappedJobs(selectedNational),todayTotal:todayMatches.length,total:selected.length,truncated:selected.length>300,jobs:selected.slice(0,300).map(job=>projectFields(job,summaryFields)),mapJobs:mapSummaries(selected)});
    }
    if(parsed.pathname==='/api/job') {
      if(params.getAll('id').length!==1||!params.get('id')||params.get('id').length>120)throw new TypeError('ID inválido');
      const job=(await catalog()).calls.find(job=>job.id===params.get('id'));
      return json(job??{error:'Oferta no disponible'},job?200:404);
    }
    if(parsed.pathname==='/api/places') {
      if(params.getAll('q').length>1||(params.get('q')?.length??0)>120)throw new TypeError('Consulta inválida');
      if(params.getAll('province').length>1||(params.get('province')?.length??0)>80)throw new TypeError('Provincia inválida');
      const input=params.get('q')??'';
      const value=normalizePlaceSearchText(input);
      if(value.length<2)return json({query:input,places:[],truncated:false});
      const key=placeShardKey(input);
      const tokens=value.split(' ');
      const province=params.get('province');
      const candidates=(await placeShard(key)).filter(place=>(!province||samePlaceProvince(place.province,province))&&tokens.every(token=>normalizePlaceSearchText(placeSearchText(place)).includes(token)));
      const ranked=rankPlaceSuggestions(candidates,value);
      return json({query:input,places:ranked.slice(0,20).map(place=>({...place,label:formatPlaceSuggestion(place)})),truncated:candidates.length>20});
    }
    return fetchImpl(url);
  };
}

const staticFetch=createStaticDataFetch();
export function siteFetch(url,options) {
  return globalThis.document?.documentElement?.dataset?.delivery==='static'&&String(url).startsWith('/api/')?staticFetch(url):fetch(url,options);
}
