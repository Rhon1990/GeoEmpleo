import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkdayListing,parsePwcListing,adaptOfficialListing,fetchRepsolOffers,repsolBoard,pwcBoard} from '../packages/ingestion/src/connectors/workday-official.ts';
import {successFactorsBoards} from '../packages/ingestion/src/connectors/successfactors-boards.ts';
import {parseSuccessFactorsListing} from '../packages/ingestion/src/connectors/successfactors.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';
import {runDaily} from '../packages/ingestion/src/runner.ts';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

const checkedAt='2026-11-18T12:00:00Z';
const offer={id:'83770',title:'Consultor IA',path:'/job/Campus-Repsol-Madrid/Consultor-IA_83770-3',city:'Campus Repsol-Madrid',multiple:false,date:null,timeType:null};
const resolveCity=(city:string)=>city==='Madrid'?{city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org',sourceUpdatedAt:null,note:'Aproximada'}}:null;

test('Repsol valida enlaces y duplicados del listado',()=>{
 const row={title:offer.title,externalPath:offer.path,bulletFields:[offer.id],locationsText:offer.city};
 assert.equal(parseWorkdayListing({total:1,jobPostings:[row]}).offers[0]?.id,offer.id);
 assert.throws(()=>parseWorkdayListing({total:2,jobPostings:[row,row]}),/duplicad/);
 assert.throws(()=>parseWorkdayListing({total:1,jobPostings:[{...row,externalPath:'https://evil.test/job/123'}]}),/Ruta/);
 for(const [id,path] of [['Req1635224','/job/Madrid/Analista_Req1635224'],['R-01328','/job/Spain-Bilbao/Programa-R-01328_R-01328']]) {
  assert.equal(parseWorkdayListing({total:1,jobPostings:[{...row,bulletFields:[id],externalPath:path}]}).offers[0]?.id,id);
 }
});
test('runner incorpora las tres fuentes y conserva primera detección y otras empresas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geo-three-test-'));
 try {
  const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json'),reportPath=join(dir,'report.json');
  const nationalPlacesPath=join(dir,'national.json.gz');
  await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-11-18',license:'test',places:[]})));
  const other={...adaptOfficialListing(offer,repsolBoard,checkedAt,resolveCity),id:'OTHER',sourceId:'other'};
  await writeFile(catalogPath,JSON.stringify({checkedAt,publishedAt:null,mode:'daily_sources',sourceConditions:'test',calls:[other]}));
  await writeFile(placesPath,JSON.stringify({places:[]}));
  const fetchImpl:typeof fetch=async(url)=>{
   const u=String(url);
   if(u.includes('/wday/cxs/')) return new Response(JSON.stringify({total:1,facets:[{facetParameter:'Country',values:[{id:'bd34c524a6a04ae6915f5d96fa086199',count:1}]}],jobPostings:[{title:offer.title,externalPath:offer.path,bulletFields:[offer.id],locationsText:offer.city}]}),{headers:{'content-type':'application/json'}});
   let html='';
   if(u.includes('pwc.es')) html='<script>var jsondata = '+JSON.stringify([{jobreqid:'98729WD',title:'Becas',iso:'ESP',jobsite:'Global_Campus_Careers',location:'Madrid',date:'2026-11-17',otherlocations:'',apply:'https://pwc.wd3.myworkdayjobs.com/Global_Campus_Careers/job/Madrid/Becas_98729WD/apply'}])+';</script>';
   else if(u.includes('/search/')) html='<span class="paginationLabel">Results 1 of 1</span><table><tr class="data-row"><td><a class="jobTitle-link" href="/ey/job/Madrid-Consultor/1234567890/">Consultor</a></td><td class="colLocation">Madrid, M, ES, 28020</td></tr></table>';
   else html='<h1>Consultor</h1><meta itemprop="datePosted" content="2026-11-17"><div itemprop="description"><p>Oferta oficial.</p></div>';
   return new Response(html,{headers:{'content-type':'text/html'}});
  };
  const options={catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds:['workday-repsol','pwc-campus','successfactors-ey'],fetchImpl,checkedAt};
  const report=await runDaily(options);
  assert.equal(report.status,'success');assert.equal(report.published,4);
  assert.ok(report.sources.every(x=>x.received===1));
  await runDaily({...options,checkedAt:'2026-11-19T12:00:00Z'});
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.equal(catalog.calls.find((x:{sourceId:string})=>x.sourceId==='workday-repsol').publishedAt,'2026-11-18');
  assert.deepEqual(catalog.calls.find((x:{id:string})=>x.id==='OTHER'),other);
  await assert.rejects(runDaily({...options,fetchImpl:async()=>new Response('',{status:429}),checkedAt:'2026-11-26T12:05:00Z'}),/Todas las fuentes/);
  assert.equal(JSON.parse(await readFile(catalogPath,'utf8')).calls.length,4);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('listado conserva fechas y evita puntos en destinos múltiples y remotos',()=>{
 const job=adaptOfficialListing(offer,repsolBoard,checkedAt,resolveCity);
 assert.equal(job.dateKind,'observed');assert.equal(job.closingDate,null);assert.ok(job.location);
 assert.equal(adaptOfficialListing({...offer,date:'2026-11-17'},repsolBoard,checkedAt,resolveCity).publishedAt,'2026-11-17');
 for(const extra of [{multiple:true},{title:'Consultor remoto'}]) assert.equal(adaptOfficialListing({...offer,...extra},repsolBoard,checkedAt,resolveCity).location,null);
 assert.throws(()=>adaptOfficialListing({...offer,date:'2026-11-19'},repsolBoard,checkedAt,resolveCity),/futura/);
});
test('PwC lee JSON sin ejecutar scripts y limita al portal Campus España',()=>{
 const row={jobreqid:'98729WD',title:'Becas',iso:'ESP',jobsite:'Global_Campus_Careers',location:'Madrid',region:'Madrid',otherlocations:'',date:'2026-11-17',apply:'https://pwc.wd3.myworkdayjobs.com/Global_Campus_Careers/job/Madrid/Becas_98729WD/apply'};
 const html=(rows:unknown[])=>`<script>var jsondata = ${JSON.stringify(rows)} ;</script>`;
 assert.equal(parsePwcListing(html([row]))[0]?.id,'98729WD');
 for(const change of [{iso:'FRA'},{jobsite:'Global_Experienced_Careers'},{apply:'https://evil.test/apply'}]) assert.throws(()=>parsePwcListing(html([{...row,...change}])));
 assert.throws(()=>parsePwcListing(html([row,row])),/duplicad/);
 assert.throws(()=>parsePwcListing('<script>var jsondata = runCode();</script>'));
 assert.equal(pwcBoard.site,'Global_Campus_Careers');
 assert.equal(parsePwcListing(html([{...row,location:'Andorra',region:'Andorra'}])).length,0);
 assert.equal(parsePwcListing(html([{...row,otherlocations:'Barcelona'}]))[0]?.multiple,true);
});
test('Repsol exige captura completa y mantiene filtro España en cada página',async()=>{
 let requests=0;
 const fetchImpl:typeof fetch=async(_url,init)=>{
  requests++;
  const body=JSON.parse(String(init?.body));assert.deepEqual(body.appliedFacets,{Country:['bd34c524a6a04ae6915f5d96fa086199']});
  return new Response(JSON.stringify({total:21,facets:[{facetParameter:'Country',values:[{id:'bd34c524a6a04ae6915f5d96fa086199',count:21}]}],jobPostings:requests===1?[{title:offer.title,externalPath:offer.path,bulletFields:[offer.id],locationsText:offer.city}]:[]}),{headers:{'content-type':'application/json'}});
 };
 await assert.rejects(fetchRepsolOffers(checkedAt,resolveCity,fetchImpl),/incompleta/);
});
test('Repsol usa una instantánea de arranque solo ante HTTP 429 y antes de caducar',async()=>{
 const blocked:typeof fetch=async()=>new Response('',{status:429,headers:{'content-type':'text/html'}});
 const jobs=await fetchRepsolOffers('2026-11-18T14:00:00Z',resolveCity,blocked);
 assert.equal(jobs.length,18);assert.ok(jobs.every(job=>job.sourceId==='workday-repsol'));
 assert.equal(jobs[0]?.checkedAt,'2026-11-18T13:02:28.612Z');
 await assert.rejects(fetchRepsolOffers('2026-11-26T12:00:00Z',resolveCity,blocked),/caducada/);
});
test('EY conserva ruta propia y país al reutilizar SuccessFactors; fuentes activas',()=>{
 const board=successFactorsBoards.find(x=>x.sourceId==='successfactors-ey')!;assert.ok(board);
 const html='<span class="paginationLabel">Results 1 – 25 of 220</span><table><tr class="data-row"><td><a class="jobTitle-link" href="/ey/job/Madrid-Consultor/1234567890/">Consultor</a></td><td class="colLocation">Madrid, M, ES, 28020</td></tr></table>';
 assert.equal(parseSuccessFactorsListing(html,board).pageCount,9);
 assert.equal(new URL(board.listingPath,'https://careers.ey.com').searchParams.get('optionsFacetsDD_country'),'ES');
 for(const id of ['workday-repsol','successfactors-ey','pwc-campus']) assert.equal(sourceRegistry.get(id)?.status,'active');
});
