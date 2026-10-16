import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {fetchJson} from '../packages/ingestion/src/http.ts';
import {runDaily} from '../packages/ingestion/src/runner.ts';

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
 const lanbide=[{codigo:'162026012345',desEmpleo:'Técnico/a de almacén',desPuesto:'Gestión y revisión.',pais:'ESPAÑA',provincia:'GIPUZKOA',municipio:'DONOSTIA/SAN SEBASTIÁN',fecPub:'15/09/2026',url:'https://web.lanbide.eus/apps/OF_DETALLE_OFERTA_TRABAJO?IDRG=162026012345'}];
 const fetchImpl=(async(input:string|URL|Request)=>{
  const host=new URL(input instanceof Request?input.url:input).hostname;
  if(host==='sefapps.carm.es') throw new Error('secreto de red');
  if(host==='analisis.datosabiertos.jcyl.es') return new Response(JSON.stringify(cyl),{headers:{'content-type':'application/json'}});
  if(host==='apps.lanbide.euskadi.net') return new Response(new Uint8Array(Buffer.from(JSON.stringify(lanbide),'latin1')),{headers:{'content-type':'application/json'}});
  throw new Error('host inesperado');
 }) as typeof fetch;
 const options={catalogPath,placesPath,nationalPlacesPath,reportPath,checkedAt:'2026-10-15T05:30:00Z',fetchImpl};

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
 assert.ok(!(await readFile(reportPath,'utf8')).includes('secreto'));
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
 const options={catalogPath,placesPath,nationalPlacesPath,reportPath,checkedAt:'2026-10-15T05:30:00Z',fetchImpl:(async()=>{throw new Error('credential=secret');}) as typeof fetch};

 await assert.rejects(runDaily(options),/Todas las fuentes/);

 assert.equal(await readFile(catalogPath,'utf8'),serialized);
 const report=JSON.parse(await readFile(reportPath,'utf8'));
 assert.equal(report.status,'failed');
 assert.equal(report.sources.length,3);
 assert.ok(!JSON.stringify(report).includes('secret'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
