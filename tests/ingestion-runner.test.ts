import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fetchJson} from '../packages/ingestion/src/http.ts';
import {runDaily} from '../packages/ingestion/src/runner.ts';

test('HTTP limita tipos, tamaño declarado/real y redirecciones',async()=>{
 const response=(body:string,headers:Record<string,string>)=>(async()=>new Response(body,{headers})) as typeof fetch;
 await assert.rejects(fetchJson('https://example.test',{fetchImpl:response('x',{'content-type':'text/plain'})}),/JSON/);
 await assert.rejects(fetchJson('https://example.test',{maxBytes:4,fetchImpl:response('12345',{'content-type':'application/json'})}),/tamaño/);
 await assert.rejects(fetchJson('https://example.test',{maxBytes:4,fetchImpl:response('{}',{'content-type':'application/json','content-length':'99'})}),/tamaño/);
 assert.deepEqual(await fetchJson('https://example.test',{fetchImpl:response('{"ok":true}',{'content-type':'application/json'})}),{ok:true});
});
test('runner conserva catálogo ante fallo y publica una captura completa sin duplicados',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-runner-'));try{
 const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json'),reportPath=join(dir,'latest.json');
 const initial={checkedAt:'2026-10-14T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[]};
 await writeFile(catalogPath,JSON.stringify(initial));await writeFile(placesPath,JSON.stringify({places:[]}));
 const options={catalogPath,placesPath,reportPath,checkedAt:'2026-10-15T05:30:00Z'};
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
