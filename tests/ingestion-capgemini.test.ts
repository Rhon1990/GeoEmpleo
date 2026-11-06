import test from 'node:test';
import assert from 'node:assert/strict';
import {capgeminiListingUrl,fetchCapgeminiOffers} from '../packages/ingestion/src/connectors/capgemini.ts';

const checkedAt='2026-11-06T10:00:00.000Z';
const location={point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://www.geonames.org/3117735',sourceUpdatedAt:null,note:'Ubicación municipal aproximada; no es la dirección exacta del puesto.'};
const resolveCity=(city:string)=>city==='Madrid'?{city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location}:null;

function row(overrides:Record<string,unknown>={}) {
  return {
    id:'591105-es_ES_SAPBTP',brand:'Capgemini Engineering',contract_type:'Permanente',country_code:'es-es',
    description:'<p>Desarrollo de soluciones tecnológicas.</p>',experience_level:'Profesionales con experiencia',
    location:'Madrid',ref:'591105-es_ES',source_ref:'es-es:591105-es_ES',status:'1',title:'Operation Shift Leader',
    updated_at:'2026-11-05T17:16:35.000Z',
    apply_job_url:'https://careers.capgemini.com/job/Madrid-Operation-Shift-Leader/1454810333/?feedId=388633&utm_source=CareerSite&tcsource=apply',
    ...overrides,
  };
}

test('Capgemini usa el endpoint oficial español completo y solo sitúa una localidad inequívoca',async()=>{
  const rows=[row(),row({id:'446911-es_ES_SAPBTP',ref:'446911-es_ES',source_ref:'es-es:446911-es_ES',
    title:'Referente Técnico',location:'Murcia, Valencia',description:'<div></div>',apply_job_url:'https://careers.capgemini.com/job/Valencia-Referente-Tecnico/1378910333/'})];
  const requested:string[]=[];
  const fetchImpl=(async(input:string|URL|Request)=>{
    requested.push(input instanceof Request?input.url:String(input));
    return new Response(JSON.stringify({count:2,data:rows,timed_out:null,total:2}),{headers:{'content-type':'application/json; charset=UTF-8'}});
  }) as typeof fetch;
  const jobs=await fetchCapgeminiOffers(checkedAt,resolveCity,fetchImpl);
  assert.deepEqual(requested,[capgeminiListingUrl]);
  assert.equal(jobs.length,2);
  assert.equal(jobs[0]?.id,'SUCCESSFACTORS-SUCCESSFACTORS-CAPGEMINI-1454810333');
  assert.equal(jobs[0]?.sourceUrl,'https://careers.capgemini.com/job/Madrid-Operation-Shift-Leader/1454810333/');
  assert.deepEqual(jobs[0]?.location?.point,[-3.7,40.4]);
  assert.equal(jobs[1]?.location,null);
  assert.equal(jobs[1]?.city,'Murcia, Valencia');
  assert.match(jobs[1]?.paragraphs[0]??'',/Oferta publicada por Capgemini/);
  assert.equal(jobs[0]?.dateKind,'observed');
});

test('Capgemini rechaza capturas incompletas, extranjeras o con enlaces no oficiales',async()=>{
  const response=(body:unknown)=>(async()=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}})) as typeof fetch;
  await assert.rejects(()=>fetchCapgeminiOffers(checkedAt,resolveCity,response({count:2,data:[row()],timed_out:false,total:2})),/incompleta/);
  await assert.rejects(()=>fetchCapgeminiOffers(checkedAt,resolveCity,response({count:1,data:[row({country_code:'pt-pt'})],timed_out:false,total:1})),/España/);
  await assert.rejects(()=>fetchCapgeminiOffers(checkedAt,resolveCity,response({count:1,data:[row({apply_job_url:'https://evil.test/job/1/'})],timed_out:false,total:1})),/URL/);
});
