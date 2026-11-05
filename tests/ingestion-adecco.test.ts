import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchAdeccoOffers} from '../packages/ingestion/src/connectors/adecco.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const checkedAt='2026-11-05T10:00:00Z';
const madrid={city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org/madrid',sourceUpdatedAt:null,note:'aproximado'}};
const offer=(index:number,overrides:Record<string,unknown>={})=>({jobId:`${index}`.padStart(32,'A'),jobTitle:`Oferta ${index}`,cityName:'Madrid',stateName:'Madrid',countryId:'ESP',webSite:'adecco.es',postedDate:'2026-11-04T10:00:00Z',postingEndDate:'2026-12-01T00:00:00Z',applyUri:`https://portalcandidatos.es.adecco.com/oferta-empleo/oferta-${index}_3UR${index}?isExternalApply=true`,...overrides});
const response=(jobs:unknown[],total:number,range:number)=>new Response(JSON.stringify({jobs,pagination:{total,pageCount:Math.ceil(total/10),nextRange:range+10}}),{headers:{'content-type':'application/json'}});

test('Adecco permanece desactivada hasta resolver las condiciones de reutilización',()=>{
 assert.equal(sourceRegistry.get('adecco-oficial')?.status,'authorization_required');
});

test('Adecco pagina el listado vigente español y sitúa solo municipios confirmados',async()=>{
 const requests:number[]=[];
 const fetchImpl=(async (_url:string,init:RequestInit)=>{
  const body=JSON.parse(String(init.body));requests.push(body.range);
  assert.match(body.baseSearchQuery,/PostingEndDate ge 2026-11-05T10:00:00Z/);
  assert.match(body.baseSearchQuery,/CountryId eq 'ESP'/);
  return body.range===0?response(Array.from({length:10},(_,i)=>offer(i+1)),11,0):response([offer(11,{cityName:'Ciudad no verificada'})],11,10);
 }) as typeof fetch;
 const jobs=await fetchAdeccoOffers(checkedAt,(city)=>city==='Madrid'?madrid:null,fetchImpl);
 assert.deepEqual(requests.sort((a,b)=>a-b),[0,10]);
 assert.equal(jobs.length,11);
 assert.equal(jobs[0]?.sourceUrl,'https://portalcandidatos.es.adecco.com/oferta-empleo/oferta-1_3UR1?isExternalApply=true');
 assert.deepEqual(jobs[0]?.location?.point,[-3.7,40.4]);
 assert.equal(jobs[10]?.location,null);
 assert.equal(jobs[0]?.closingDate,'2026-12-01');
});

test('Adecco descarta registros extranjeros y rechaza una página incompleta',async()=>{
 const fetchImpl=(async()=>response([...Array.from({length:9},(_,i)=>offer(i+1)),offer(10,{countryId:'PRT'})],10,0)) as typeof fetch;
 const jobs=await fetchAdeccoOffers(checkedAt,()=>madrid,fetchImpl);
 assert.equal(jobs.length,9);
 assert.ok(jobs.every(job=>job.title!=='Oferta 10'));
 const broken=(async()=>response([offer(1)],11,0)) as typeof fetch;
 await assert.rejects(fetchAdeccoOffers(checkedAt,()=>madrid,broken),/página|paginación/i);
});
