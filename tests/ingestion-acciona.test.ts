import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchAccionaOffers} from '../packages/ingestion/src/connectors/acciona.ts';

const offer=(id:string,country:string,city:string,title:string)=>({
  id,jobRequisitionId:id,jobPostingTitle:title,locationCountry:country,primaryLocation:city,
  jobDescription:`<p>Descripción de ${title}</p>`,startDate:'2026-11-11',
  url:`/es/nuestro-proposito/trabaja-con-nosotros/detalle-empleo?id=${id}`,
  External_Apply_URL:`https://acciona.wd3.myworkdayjobs.com/ACCIONA_Employment_Channel/job/${city}/${id}/apply`,
});
const listing=(jobs:unknown[])=>`<a-mo-oferta-v2 jobs='${JSON.stringify(jobs)}' pagination="true" page-size="9"></a-mo-oferta-v2>`;

test('Acciona conserva solo las ofertas españolas completas publicadas en su listado oficial',async()=>{
  const html=listing([
    offer('20077403','ESP','Madrid','Gerente Soporte Técnico'),
    offer('20087593','ESP','Sevilla','Beca Compras'),
    offer('20010000','PRT','Lisboa','Oferta portuguesa'),
  ]);
  const fetchImpl=(async()=>new Response(html,{headers:{'content-type':'text/html'}})) as typeof fetch;
  const jobs=await fetchAccionaOffers('2026-11-12T10:00:00.000Z',city=>city==='Madrid'?{
    city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[-3.7,40.4],precision:'municipality',sourceUrl:'https://example.org',sourceUpdatedAt:null,note:'aproximada'},
  }:null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.id),['ACCIONA-20077403','ACCIONA-20087593']);
  assert.equal(jobs[0]?.sourceUrl,'https://www.acciona.com/es/nuestro-proposito/trabaja-con-nosotros/detalle-empleo?id=20077403');
  assert.deepEqual(jobs[0]?.paragraphs,['Descripción de Gerente Soporte Técnico']);
  assert.equal(jobs[0]?.location?.precision,'municipality');
  assert.equal(jobs[1]?.location,null);
});

test('Acciona admite el listado oficial completo aunque supere el límite HTML común',async()=>{
  const complete=offer('20077403','ESP','Madrid','Gerente Soporte Técnico');
  complete.jobDescription=`<p>${'a'.repeat(2_100_000)}</p>`;
  const fetchImpl=(async()=>new Response(listing([complete]),{headers:{'content-type':'text/html'}})) as typeof fetch;
  const jobs=await fetchAccionaOffers('2026-11-12T10:00:00.000Z',()=>null,fetchImpl);
  assert.equal(jobs.length,1);
});

test('Acciona rechaza toda la captura cuando una oferta española carece de descripción o repite ID',async()=>{
  const valid=offer('20077403','ESP','Madrid','Gerente Soporte Técnico');
  const incomplete={...offer('20087593','ESP','Sevilla','Beca Compras'),jobDescription:''};
  for(const rows of [[valid,incomplete],[valid,valid]]) {
    const fetchImpl=(async()=>new Response(listing(rows),{headers:{'content-type':'text/html'}})) as typeof fetch;
    await assert.rejects(fetchAccionaOffers('2026-11-12T10:00:00.000Z',()=>null,fetchImpl),TypeError);
  }
});
