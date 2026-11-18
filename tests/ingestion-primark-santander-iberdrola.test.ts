import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchWorkdayOffers,iberdrolaBoard,santanderBoard} from '../packages/ingestion/src/connectors/workday-official.ts';
import {fetchPrimarkOffers,parsePrimarkListing} from '../packages/ingestion/src/connectors/primark.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';
import {runDaily} from '../packages/ingestion/src/runner.ts';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

const checkedAt='2026-11-18T12:00:00Z';
const spainId='bd34c524a6a04ae6915f5d96fa086199';
const canonicalCities:Readonly<Record<string,string>>={madrid:'Madrid',salamanca:'Salamanca',bilbao:'Bilbao',valencia:'Valencia'};
const resolveCity=(city:string)=>canonicalCities[city.toLocaleLowerCase('es')]
 ? {city:canonicalCities[city.toLocaleLowerCase('es')]!,province:canonicalCities[city.toLocaleLowerCase('es')]!,region:'España',location:{point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org',sourceUpdatedAt:null,note:'Aproximada'}}
 : null;

function primarkPage(page=1,total=1,totalPages=1) {
 return `<section id="search-results" data-total-job-results="${total}" data-total-pages="${totalPages}" data-current-page="${page}" data-records-per-page="10">
 <ul class="job-list"><li class="job-list-item"><a href="/es/trabajo/salamanca/retail-assistant-dependiente-a/8171/99966016608" data-job-id="99966016608" class="job-list-anchor">
 <h3 class="job-list-title">Retail Assistant - Dependiente/a</h3>
 <span class="job-list-title job-list-info job-list-info--location">Salamanca, Salamanca, Espa&#xF1;a</span>
 <span class="job-list-title job-list-info job-list-info--category">Retail Assistant/Dependiente/a</span>
 <span class="job-list-title job-list-info job-list-info--jobtype">A tiempo parcial</span></a></li></ul></section>`;
}

test('Primark valida el total, la página y los campos públicos del listado',()=>{
 const parsed=parsePrimarkListing(primarkPage());
 assert.equal(parsed.total,1);assert.equal(parsed.page,1);assert.equal(parsed.totalPages,1);
 assert.deepEqual(parsed.offers[0],{
  id:'99966016608',title:'Retail Assistant - Dependiente/a',city:'Salamanca, Salamanca, España',
  regime:'A tiempo parcial',category:'Retail Assistant/Dependiente/a',
  path:'/es/trabajo/salamanca/retail-assistant-dependiente-a/8171/99966016608',
 });
 assert.throws(()=>parsePrimarkListing(primarkPage(2,1,1)),/paginación/i);
 assert.throws(()=>parsePrimarkListing(primarkPage().replace('99966016608','99966016609')),/Primark/i);
});

test('Primark pagina, conserva primera detección y solo sitúa municipios inequívocos',async()=>{
 const jobs=await fetchPrimarkOffers(checkedAt,resolveCity,async()=>new Response(primarkPage(),{headers:{'content-type':'text/html'}}));
 assert.equal(jobs.length,1);assert.equal(jobs[0]?.sourceId,'radancy-primark');
 assert.equal(jobs[0]?.publishedAt,'2026-11-18');assert.equal(jobs[0]?.dateKind,'observed');
 assert.equal(jobs[0]?.city,'Salamanca');assert.ok(jobs[0]?.location);
});

test('Workday reutiliza el filtro España para Santander e Iberdrola',async()=>{
 for(const [board,id,path,location] of [
  [santanderBoard,'Req1635224','/job/Boadilla-del-Monte/Analista_Req1635224','Madrid'],
  [iberdrolaBoard,'R-01328','/job/Spain-Bilbao/Programa-R-01328_R-01328','3 Locations'],
 ] as const) {
  let requestBody:unknown;
  const jobs=await fetchWorkdayOffers(board,checkedAt,resolveCity,async(url,init)=>{
   const target=String(url);
   if(board===iberdrolaBoard&&target.endsWith(path)) return new Response(JSON.stringify({jobPostingInfo:{jobReqId:id,title:'Oferta',location:'Spain, Bilbao',additionalLocations:['Spain, Madrid','EDIF. IBERDROLA VALENCIA'],externalUrl:`https://${board.host}/${board.site}${path}`}}),{headers:{'content-type':'application/json'}});
   assert.match(target,new RegExp(`/wday/cxs/${board.tenant}/${board.site}/jobs$`));
   requestBody=JSON.parse(String(init?.body));
   return new Response(JSON.stringify({total:1,jobPostings:[{title:'Oferta',externalPath:path,bulletFields:[id],locationsText:location}]}),{headers:{'content-type':'application/json'}});
  });
  assert.deepEqual((requestBody as {appliedFacets:unknown}).appliedFacets,{locationCountry:[spainId]});
  assert.ok(jobs.every(job=>job.sourceId===board.sourceId));
  if(board===iberdrolaBoard){
   assert.equal(jobs.length,3);assert.deepEqual(jobs.map(job=>job.city),['Bilbao','Madrid','Valencia']);
   assert.equal(new Set(jobs.map(job=>job.id)).size,3);
  } else assert.equal(jobs.length,1);
 }
});

test('Workday rechaza una captura paginada incompleta',async()=>{
 let calls=0;
 await assert.rejects(fetchWorkdayOffers(santanderBoard,checkedAt,resolveCity,async()=>{
  calls++;
  const rows=calls===1?Array.from({length:20},(_,index)=>({title:`Oferta ${index}`,externalPath:`/job/Madrid/Oferta-${index}_Req${1000000+index}`,bulletFields:[`Req${1000000+index}`],locationsText:'Madrid'})):[];
  return new Response(JSON.stringify({total:21,jobPostings:rows}),{headers:{'content-type':'application/json'}});
 }),/incompleta/);
});
test('Workday reintenta una respuesta 429 transitoria antes de descartar la fuente',async()=>{
 let requests=0;
 const jobs=await fetchWorkdayOffers(santanderBoard,checkedAt,resolveCity,async()=>{
  requests++;
  return requests===1?new Response('',{status:429}):new Response(JSON.stringify({total:1,jobPostings:[{title:'Analista',externalPath:'/job/Madrid/Analista_Req1635224',bulletFields:['Req1635224'],locationsText:'Madrid'}]}),{headers:{'content-type':'application/json'}});
 });
 assert.equal(requests,2);assert.equal(jobs.length,1);
});

test('runner actualiza las tres fuentes y conserva su primera detección',async()=>{
 const sourceIds=['radancy-primark','workday-santander','workday-iberdrola'];
 for(const id of sourceIds) assert.equal(sourceRegistry.get(id)?.status,'active');
 const dir=await mkdtemp(join(tmpdir(),'geo-three-employers-'));
 try {
  const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json'),nationalPlacesPath=join(dir,'national.json.gz'),reportPath=join(dir,'report.json');
  await writeFile(catalogPath,JSON.stringify({checkedAt,publishedAt:null,mode:'daily_sources',sourceConditions:'test',calls:[]}));
  await writeFile(placesPath,JSON.stringify({places:[]}));
  await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-11-18',license:'test',places:[]})));
  const fetchImpl:typeof fetch=async url=>{
   const target=String(url);
   if(target.includes('careers.primark.com')) return new Response(primarkPage(),{headers:{'content-type':'text/html'}});
   const santander=target.includes('/santander/SantanderCareers/');
   return new Response(JSON.stringify({total:1,jobPostings:[santander
    ?{title:'Analista',externalPath:'/job/Madrid/Analista_Req1635224',bulletFields:['Req1635224'],locationsText:'Madrid'}
    :{title:'Técnico',externalPath:'/job/Spain-Madrid/Tecnico_R-01328',bulletFields:['R-01328'],locationsText:'Spain, Madrid'}]}),{headers:{'content-type':'application/json'}});
  };
  const options={catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds,fetchImpl,checkedAt};
  const report=await runDaily(options);
  assert.equal(report.status,'success');assert.equal(report.sources.length,3);assert.ok(report.sources.every(source=>source.received===1));
  await runDaily({...options,checkedAt:'2026-11-19T12:00:00Z'});
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.equal(catalog.calls.length,3);
  assert.ok(catalog.calls.every((job:{publishedAt:string})=>job.publishedAt==='2026-11-18'));
 } finally {await rm(dir,{recursive:true,force:true});}
});
