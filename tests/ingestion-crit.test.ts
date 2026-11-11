import assert from 'node:assert/strict';
import {test} from 'node:test';
import {bizneoBoards,fetchBizneoOffers,parseBizneoListing} from '../packages/ingestion/src/connectors/bizneo.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const checkedAt='2026-11-11T12:00:00.000Z';
const board=()=>bizneoBoards.find(item=>item.sourceId==='crit-oficial');
const listing=(href:string,title='Técnico/a de laboratorio',city='Umbrete')=>`<div id="job-board"><a class="job-card" href="${href}"><span class="title">${title}</span><div class="details"><span>${city}</span></div></a></div>`;
const detail=(title:string,city:string)=>`<h1>${title}</h1><div title="Ubicación">${city}</div><section class="general-content"><p>Oferta con descripción completa.</p></section>`;

test('Grupo Crit reutiliza el tablón Bizneo oficial y queda activo',()=>{
  assert.equal(sourceRegistry.get('crit-oficial')?.status,'active');
  assert.equal(board()?.hostname,'jobs.grupo-crit.com');
});

test('Crit publica fichas trazables y solo sitúa un municipio verificado',async()=>{
  const configured=board();
  assert.ok(configured);
  const href='https://jobs.grupo-crit.com/jobs/tecnico-a-de-laboratorio-umbrete-8e074479-ac83-4b6b-ab29-15d8368c6720';
  const html=listing(href);
  assert.equal(parseBizneoListing(html,configured).offers[0]?.url,href);
  const place={city:'Umbrete',province:'Sevilla',region:'Andalucía',location:{point:[-6.157,37.369] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.test/umbrete',sourceUpdatedAt:null,note:'Municipio aproximado'}};
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return new Response(url.pathname.startsWith('/jobs/')?detail('Técnico/a de laboratorio','Umbrete'):html,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchBizneoOffers(configured,checkedAt,name=>name==='Umbrete'?place:null,fetchImpl);
  assert.equal(jobs[0]?.sourceId,'crit-oficial');
  assert.equal(jobs[0]?.dateKind,'observed');
  assert.deepEqual(jobs[0]?.location?.point,[-6.157,37.369]);
});

test('Crit rechaza destinos externos',()=>{
  const configured=board();
  assert.ok(configured);
  assert.throws(()=>parseBizneoListing(listing('https://evil.test/jobs/falsa'),configured),/URL/);
});

test('Crit admite la paginación completa que expone su portal oficial',()=>{
  const configured=board();
  assert.ok(configured);
  const html=`${listing('https://jobs.grupo-crit.com/jobs/puesto') }<a class="next" href="/jobs?page=100">Siguiente</a>`;
  assert.equal(parseBizneoListing(html,configured).nextPage,100);
});
