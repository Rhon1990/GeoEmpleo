import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchDecathlonOffers,parseDecathlonListing} from '../packages/ingestion/src/connectors/decathlon.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const url=(id:number)=>`https://careers.talentclue.com/es/node/${id}/4590/modalbrowser?destination=company/ab1c62a7331dda3ee254559964560b88/jsoffers/modal&logo=1`;
const row=(id:number,city:string,province:string,country='España')=>`<tr><td></td><td><a href="${url(id)}">Vendedor/a Decathlon ${city}</a></td><td>DECATHLON</td><td>${city}</td><td>${province}</td><td>${country}</td><td>Ventas</td><td>Retail</td></tr>`;
const checkedAt='2026-11-05T10:00:00Z';
const madrid={city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org/madrid',sourceUpdatedAt:null,note:'aproximado'}};

test('Decathlon publica el listado completo español con punto solo para municipio verificado',async()=>{
  assert.equal(sourceRegistry.get('talentclue-decathlon')?.status,'active');
  const html=`<table>${row(123,'Madrid','Madrid')}${row(456,'Sin indicar','-')}${row(789,'Porto','Porto','Portugal')}</table>`;
  assert.equal(parseDecathlonListing(html).length,2);
  const fetchImpl=(async()=>new Response(html,{headers:{'content-type':'text/html'}})) as typeof fetch;
  const jobs=await fetchDecathlonOffers(checkedAt,city=>city==='Madrid'?madrid:null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.id),['DECATHLON-123','DECATHLON-456']);
  assert.deepEqual(jobs[0]?.location?.point,[-3.7,40.4]);
  assert.equal(jobs[1]?.location,null);
  assert.equal(jobs[0]?.dateKind,'observed');
});

test('Decathlon rechaza enlaces externos y IDs repetidos',()=>{
  assert.throws(()=>parseDecathlonListing(`<table>${row(123,'Madrid','Madrid').replace('careers.talentclue.com','evil.test')}</table>`),/URL/);
  assert.throws(()=>parseDecathlonListing(`<table>${row(123,'Madrid','Madrid')+row(123,'Madrid','Madrid')}</table>`),/duplicado/);
});
