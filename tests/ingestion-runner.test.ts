import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {fetchJson} from '../packages/ingestion/src/http.ts';
import {formatRunReportLines,runDaily} from '../packages/ingestion/src/runner.ts';

const windows1252Characters=new Map([['€',0x80],['“',0x93],['”',0x94],['–',0x96]]);
function encodeWindows1252(value:string):Uint8Array {
 return Uint8Array.from([...value].map(character=>{
  const encoded=windows1252Characters.get(character);
  if(encoded!==undefined) return encoded;
  const codePoint=character.codePointAt(0);
  if(codePoint===undefined||codePoint>0xff) throw new TypeError('Carácter no representable en Windows-1252');
  return codePoint;
 }));
}

test('HTTP limita tipos, tamaño declarado/real y redirecciones',async()=>{
 const response=(body:string,headers:Record<string,string>)=>(async()=>new Response(body,{headers})) as typeof fetch;
 await assert.rejects(fetchJson('https://example.test',{fetchImpl:response('x',{'content-type':'text/plain'})}),/JSON/);
 await assert.rejects(fetchJson('https://example.test',{maxBytes:4,fetchImpl:response('12345',{'content-type':'application/json'})}),/tamaño/);
 await assert.rejects(fetchJson('https://example.test',{maxBytes:4,fetchImpl:response('{}',{'content-type':'application/json','content-length':'99'})}),/tamaño/);
 assert.deepEqual(await fetchJson('https://example.test',{fetchImpl:response('{"ok":true}',{'content-type':'application/json'})}),{ok:true});
});
test('HTTP decodifica JSON Windows-1252 explícito y nunca acepta JSONP',async()=>{
 const windowsBytes=new Uint8Array(Buffer.from('{"title":"Técnico en acción"}','latin1'));
 const fetchImpl=(async()=>new Response(windowsBytes,{headers:{'content-type':'application/json'}})) as typeof fetch;
 assert.deepEqual(
  await fetchJson('https://example.test',{fetchImpl,encoding:'windows-1252'}),
  {title:'Técnico en acción'},
 );
 const jsonp=(async()=>new Response('callback({"ok":true})',{headers:{'content-type':'application/json'}})) as typeof fetch;
 await assert.rejects(fetchJson('https://example.test',{fetchImpl:jsonp}),SyntaxError);
 await assert.rejects(
  fetchJson('https://example.test',{fetchImpl,encoding:'iso-8859-1' as 'utf-8'}),
  /codificación/i,
 );
});
test('formatea resúmenes success y partial por fuente',()=>{
 const successful={status:'success' as const,published:4,sources:[
  {sourceId:'sef-murcia',status:'success' as const,received:2,mapped:0,reason:null},
  {sourceId:'ecyl-castilla-leon',status:'success' as const,received:1,mapped:1,reason:null},
 ]};
 const partial={status:'partial' as const,published:3,sources:[
  {sourceId:'sef-murcia',status:'failed' as const,received:0,mapped:0,reason:'source_fetch_or_validation_failed'},
  {sourceId:'lanbide-euskadi',status:'success' as const,received:1,mapped:0,reason:null},
 ]};

 assert.deepEqual(formatRunReportLines(successful),[
  'SUCCESS: catálogo 4',
  'sef-murcia: success, 2 ofertas, 0 con ubicación',
  'ecyl-castilla-leon: success, 1 ofertas, 1 con ubicación',
 ]);
 assert.deepEqual(formatRunReportLines(partial),[
  'PARTIAL: catálogo 3',
  'sef-murcia: failed, 0 ofertas, 0 con ubicación, source_fetch_or_validation_failed',
  'lanbide-euskadi: success, 1 ofertas, 0 con ubicación',
 ]);
});
test('runner conserva catálogo ante fallo y publica una captura completa sin duplicados',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-runner-'));try{
 const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json'),reportPath=join(dir,'latest.json');
 const initial={checkedAt:'2026-10-14T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[]};
 await writeFile(catalogPath,JSON.stringify(initial));await writeFile(placesPath,JSON.stringify({places:[]}));
 const options={catalogPath,placesPath,reportPath,checkedAt:'2026-10-15T05:30:00Z',sourceIds:['sef-murcia']};
 await assert.rejects(runDaily({...options,fetchImpl:(async()=>{throw new Error('source failure with secret');}) as typeof fetch}));
 assert.deepEqual(JSON.parse(await readFile(catalogPath,'utf8')),initial);
 assert.ok(!(await readFile(reportPath,'utf8')).includes('secret'));
 const input=await readFile(new URL('./fixtures/ingestion/murcia.json',import.meta.url),'utf8');
 const fetchImpl=(async()=>new Response(input,{headers:{'content-type':'application/json'}})) as typeof fetch;
 const first=await runDaily({...options,fetchImpl});const second=await runDaily({...options,fetchImpl});
 assert.equal(first.received,2);assert.equal(first.mapped,0);assert.equal(second.published,2);
 assert.equal(JSON.parse(await readFile(catalogPath,'utf8')).calls.length,2);
 await writeFile(reportPath+'.lock','busy');await assert.rejects(runDaily({...options,fetchImpl}),/ejecución/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('runner publica una oferta empresarial oficial y conserva la fuente fallida',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-employers-'));try{
  const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json');
  const nationalPlacesPath=join(dir,'spain-places.json.gz'),reportPath=join(dir,'latest.json');
  await writeFile(catalogPath,JSON.stringify({checkedAt:'2026-10-25T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[]}));
  await writeFile(placesPath,JSON.stringify({places:[]}));
  await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-10-26',license:'test',places:[]})));
  const listing='<table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-Medico/1234567890/">Médico/a</a></td><td class="colLocation">Madrid, ES</td><td class="colDate">26 oct 2026</td></tr></table>';
  const detail='<meta itemprop="datePosted" content="2026-10-26"><h1>Médico/a</h1><span itemprop="description"><p>Atención a pacientes.</p></span>';
  const fetchImpl=(async(input:string|URL|Request)=>{
   const url=new URL(input instanceof Request?input.url:input);
   if(url.hostname==='jobs.mapfre.com') throw new Error('secreto remoto');
   assert.equal(url.hostname,'empleo.vithas.es');
   return new Response(url.pathname.startsWith('/job/')?detail:listing,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const report=await runDaily({catalogPath,placesPath,nationalPlacesPath,reportPath,
   sourceIds:['successfactors-mapfre','successfactors-vithas'],checkedAt:'2026-10-26T12:00:00Z',fetchImpl});
  assert.equal(report.status,'partial');
  assert.deepEqual(report.sources.map(source=>source.status),['failed','success']);
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.equal(catalog.calls.length,1);
  assert.equal(catalog.calls[0].employer,'Vithas');
  assert.equal(catalog.calls[0].location,null);
  assert.ok(!(await readFile(reportPath,'utf8')).includes('secreto remoto'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('runner informa un código seguro cuando Accenture responde con error HTTP',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-accenture-diagnostic-'));try{
  const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json');
  const nationalPlacesPath=join(dir,'spain-places.json.gz'),reportPath=join(dir,'latest.json');
  await writeFile(catalogPath,JSON.stringify({checkedAt:'2026-10-27T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[]}));
  await writeFile(placesPath,JSON.stringify({places:[]}));
  await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-10-28',license:'test',places:[]})));
  const id='1285689059828';
  const path=`/web/jcyl/Empleo/es/Plantilla100Detalle/1284216458054/OfertasEmpleo/${id}/Empleo`;
  const ecyl=[{titulo:'Técnico/a',provincia:'SEGOVIA',fecha_publicacion:'2026-10-01',descripcion:'<p>Oferta real.</p>',localidad_asset0:'RIAZA',identificador:id,actualizacionmetadatos:'2026-10-28',enlace_al_contenido:`https://empleo.jcyl.es${path}`}];
  const fetchImpl=(async(input:string|URL|Request)=>{
   const host=new URL(input instanceof Request?input.url:String(input)).hostname;
   if(host==='accenture.wd103.myworkdayjobs.com') return new Response('',{status:429});
   if(host==='analisis.datosabiertos.jcyl.es') return new Response(JSON.stringify(ecyl),{headers:{'content-type':'application/json'}});
   throw new Error('host inesperado');
  }) as typeof fetch;
  const report=await runDaily({catalogPath,placesPath,nationalPlacesPath,reportPath,
   sourceIds:['workday-accenture','ecyl-castilla-leon'],checkedAt:'2026-10-28T10:00:00Z',fetchImpl});
  assert.equal(report.status,'partial');
  assert.equal(report.sources[0]?.reason,'accenture_http_429');
  assert.ok(!(await readFile(reportPath,'utf8')).includes('host inesperado'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('runner publica fuentes correctas una vez, aísla fallos y es idempotente',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-multisource-'));try{
 const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json');
 const nationalPlacesPath=join(dir,'spain-places.json.gz'),reportPath=join(dir,'latest.json');
 const initial={checkedAt:'2026-10-14T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[]};
 await writeFile(catalogPath,JSON.stringify(initial));
 await writeFile(placesPath,JSON.stringify({places:[]}));
 await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-10-15',license:'test',places:[]})));
 const cylId='1285689059828';
 const cylPath=`/web/jcyl/Empleo/es/Plantilla100Detalle/1284216458054/OfertasEmpleo/${cylId}/Empleo`;
 const cyl=[{titulo:'Técnico/a de mantenimiento',provincia:'SEGOVIA',fecha_publicacion:'2026-09-15',descripcion:'<p>Revisión de equipos.</p>',localidad_asset0:'RIAZA',identificador:cylId,actualizacionmetadatos:'2026-10-14',enlace_al_contenido:`https://empleo.jcyl.es${cylPath}`,geografico:{lon:-3.47787,lat:41.27826}}];
 const lanbide=[{codigo:'162026012345',desEmpleo:'Técnico/a de almacén',desPuesto:'Gestión “premium” – revisión por 1.500 €.',pais:'ESPAÑA',provincia:'GIPUZKOA',municipio:'DONOSTIA/SAN SEBASTIÁN',fecPub:'15/09/2026',url:'https://web.lanbide.eus/apps/OF_DETALLE_OFERTA_TRABAJO?IDRG=162026012345'}];
 const fetchImpl=(async(input:string|URL|Request)=>{
  const host=new URL(input instanceof Request?input.url:input).hostname;
  if(host==='sefapps.carm.es') throw new Error('secreto de red');
  if(host==='analisis.datosabiertos.jcyl.es') return new Response(JSON.stringify(cyl),{headers:{'content-type':'application/json'}});
  if(host==='apps.lanbide.euskadi.net') return new Response(new Uint8Array(encodeWindows1252(JSON.stringify(lanbide))),{headers:{'content-type':'application/json'}});
  throw new Error('host inesperado');
 }) as typeof fetch;
 const options={catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds:['sef-murcia','ecyl-castilla-leon','lanbide-euskadi'],checkedAt:'2026-10-15T05:30:00Z',fetchImpl};

 const first=await runDaily(options);
 const second=await runDaily(options);

 assert.equal(first.status,'partial');
 assert.deepEqual(first.sources.map(source=>({sourceId:source.sourceId,status:source.status,received:source.received,mapped:source.mapped,reason:source.reason})),[
  {sourceId:'sef-murcia',status:'failed',received:0,mapped:0,reason:'source_fetch_or_validation_failed'},
  {sourceId:'ecyl-castilla-leon',status:'success',received:1,mapped:0,reason:null},
  {sourceId:'lanbide-euskadi',status:'success',received:1,mapped:0,reason:null},
 ]);
 assert.equal(second.status,'partial');
 const published=JSON.parse(await readFile(catalogPath,'utf8'));
 assert.deepEqual(published.calls.map((call:{id:string})=>call.id).sort(),['ECYL-1285689059828','LANBIDE-162026012345']);
 assert.deepEqual(
  published.calls.find((call:{id:string})=>call.id==='LANBIDE-162026012345')?.paragraphs,
  ['Gestión “premium” – revisión por 1.500 €.'],
 );
 assert.ok(!(await readFile(reportPath,'utf8')).includes('secreto'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('runner despacha Carrefour y Lidl como fuentes diarias y publica sus vacantes con localidad verificada',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-carrefour-lidl-'));try{
  const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json');
  const nationalPlacesPath=join(dir,'spain-places.json.gz'),reportPath=join(dir,'latest.json');
  await writeFile(catalogPath,JSON.stringify({checkedAt:'2026-10-26T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[]}));
  await writeFile(placesPath,JSON.stringify({places:[]}));
  await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-10-26',license:'test',places:[{
   id:'vicar',name:'Vícar',province:'Almería',municipality:'Vícar',latitude:36.83,longitude:-2.64,
   sourceUrl:'https://example.org/vicar',precision:'locality',
  }]})));
  const carrefour='<form id="form1" action="./ofertas-empleo.aspx"><input type="hidden" name="__VIEWSTATE" value="state"><input type="hidden" name="ctl00$ph$hdnPg" value="0"></form><div id="ph_divPag"><p>1 / 1</p></div><div class="list-group-item corpt4j"><h4><strong>Auxiliar de tienda</strong></h4><div class="ubicacion">Vícar</div><a class="solicitar" href="https://carrefour.talentforjobs.com/ofertas/trabajo.aspx?j=token-vicar">Solicitar</a><p class="pe-contenido">Atención al cliente y reposición.</p></div>';
  const lidl={postingId:'123456',requisitionId:'123456',title:'Cajero/a - Reponedor/a',location:{country:'ES',city:'Vícar',state:'Almería',name:'Vícar',type:'Point'},jobDetailUrl:'https://empleo.lidl.es/jobs/cajero-a-reponedor-a-vicar-123456',onlineFrom:'2026-10-26T10:00:00Z',onlineUntil:null,descResponsibilities:'<p>Atención al cliente y reposición.</p>'};
  const fetchImpl=(async(input:string|URL|Request)=>{
   const url=new URL(input instanceof Request?input.url:String(input));
   if(url.hostname==='carrefour.talentforjobs.com')return new Response(carrefour,{headers:{'content-type':'text/html'}});
   assert.equal(url.hostname,'empleo.lidl.es');
   return new Response(JSON.stringify({jobs:[lidl],meta:{page:1,count:1,totalCount:1,resultsPerPage:100}}),{headers:{'content-type':'application/json'}});
  }) as typeof fetch;
  const report=await runDaily({catalogPath,placesPath,nationalPlacesPath,reportPath,
   sourceIds:['carrefour-talentforjobs','lidl-search-api'],checkedAt:'2026-10-27T10:00:00Z',fetchImpl});
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.equal(report.status,'success');
  assert.deepEqual(report.sources.map(source=>[source.sourceId,source.received,source.mapped]),[
   ['carrefour-talentforjobs',1,1],['lidl-search-api',1,1],
  ]);
  assert.deepEqual(catalog.calls.map((job:{sourceId:string;location?:unknown})=>[job.sourceId,job.location!==null]),[
   ['carrefour-talentforjobs',true],['lidl-search-api',true],
  ]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('runner publica success con tres fuentes seleccionadas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-all-success-'));try{
 const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json');
 const nationalPlacesPath=join(dir,'spain-places.json.gz'),reportPath=join(dir,'latest.json');
 const missing=(sourceId:string,id:string)=>({kind:'job',sourceId,source:sourceId,id,title:'Oferta anterior',employer:'ECYL',city:'Segovia',province:'Segovia',region:'Castilla y León',category:'otros',categoryLabel:'Otros',regime:'Oferta de empleo',places:null,paragraphs:[],sourceUrl:'https://empleo.jcyl.es/',publishedAt:'2026-10-14',checkedAt:'2026-10-14T00:00:00Z',closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:null});
 await writeFile(catalogPath,JSON.stringify({checkedAt:'2026-10-14T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[missing('ecyl-castilla-leon','ECYL-OLD'),missing('lanbide-euskadi','LANBIDE-OLD')]}));
 await writeFile(placesPath,JSON.stringify({places:[]}));
 await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-10-15',license:'test',places:[]})));
 const murcia=await readFile(new URL('./fixtures/ingestion/murcia.json',import.meta.url),'utf8');
 const cylId='1285689059828';
 const cylPath=`/web/jcyl/Empleo/es/Plantilla100Detalle/1284216458054/OfertasEmpleo/${cylId}/Empleo`;
 const cyl=[{titulo:'Técnico/a de mantenimiento',provincia:'SEGOVIA',fecha_publicacion:'2026-09-15',descripcion:'<p>Revisión de equipos.</p>',localidad_asset0:'RIAZA',identificador:cylId,actualizacionmetadatos:'2026-10-14',enlace_al_contenido:`https://empleo.jcyl.es${cylPath}`,geografico:{lon:-3.47787,lat:41.27826}}];
 const lanbide=[{codigo:'162026012345',desEmpleo:'Técnico/a de almacén',desPuesto:'Gestión y revisión.',pais:'ESPAÑA',provincia:'GIPUZKOA',municipio:'DONOSTIA/SAN SEBASTIÁN',fecPub:'15/09/2026',url:'https://web.lanbide.eus/apps/OF_DETALLE_OFERTA_TRABAJO?IDRG=162026012345'}];
 const fetchImpl=(async(input:string|URL|Request)=>{
  const host=new URL(input instanceof Request?input.url:input).hostname;
  if(host==='sefapps.carm.es') return new Response(murcia,{headers:{'content-type':'application/json'}});
  if(host==='analisis.datosabiertos.jcyl.es') return new Response(JSON.stringify(cyl),{headers:{'content-type':'application/json'}});
  if(host==='apps.lanbide.euskadi.net') return new Response(new Uint8Array(encodeWindows1252(JSON.stringify(lanbide))),{headers:{'content-type':'application/json'}});
  throw new Error('host inesperado');
 }) as typeof fetch;

 const report=await runDaily({catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds:['sef-murcia','ecyl-castilla-leon','lanbide-euskadi'],checkedAt:'2026-10-15T05:30:00Z',fetchImpl});

 assert.equal(report.status,'success');
 assert.deepEqual(report.sources,[
  {sourceId:'sef-murcia',status:'success',received:2,mapped:0,reason:null},
  {sourceId:'ecyl-castilla-leon',status:'success',received:1,mapped:0,reason:null},
  {sourceId:'lanbide-euskadi',status:'success',received:1,mapped:0,reason:null},
 ]);
 assert.equal(report.published,5);
 const updated=JSON.parse(await readFile(catalogPath,'utf8'));
 assert.ok(!updated.calls.some((job:{id:string})=>job.id==='ECYL-OLD'));
 assert.ok(updated.calls.some((job:{id:string})=>job.id==='LANBIDE-OLD'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('runner no publica catálogo cuando fallan todas las fuentes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-all-failed-'));try{
 const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json');
 const nationalPlacesPath=join(dir,'spain-places.json.gz'),reportPath=join(dir,'latest.json');
 const initial={checkedAt:'2026-10-14T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[]};
 const serialized=JSON.stringify(initial);
 await writeFile(catalogPath,serialized);await writeFile(placesPath,JSON.stringify({places:[]}));
 await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-10-15',license:'test',places:[]})));
 const options={catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds:['sef-murcia','ecyl-castilla-leon','lanbide-euskadi'],checkedAt:'2026-10-15T05:30:00Z',fetchImpl:(async()=>{throw new Error('credential=secret');}) as typeof fetch};

 await assert.rejects(runDaily(options),/Todas las fuentes/);

 assert.equal(await readFile(catalogPath,'utf8'),serialized);
 const report=JSON.parse(await readFile(reportPath,'utf8'));
 assert.equal(report.status,'failed');
 assert.equal(report.sources.length,3);
 assert.ok(!JSON.stringify(report).includes('secret'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
