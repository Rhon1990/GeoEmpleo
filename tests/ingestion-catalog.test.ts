import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reconcileSource} from '../packages/ingestion/src/catalog.ts';
import {writeJsonAtomic} from '../packages/ingestion/src/storage.ts';
import type {PublicCatalog,PublicJob} from '../packages/ingestion/src/model.ts';
const job=(id:string,sourceId='sef-murcia',closingDate:string|null='2026-10-26')=>({id,sourceId,publishedAt:'2026-10-01',checkedAt:'2026-10-14T05:30:00Z',closingDate}) as PublicJob;
const catalog:PublicCatalog={checkedAt:'old',publishedAt:'2026-10-01',mode:'verified_snapshot',sourceConditions:'x',calls:[job('BOE-1','boe',null),job('SEF-1'),job('SEF-MISSING'),job('SEF-EXPIRED','sef-murcia','2026-10-14')]};
const at='2026-10-15T05:30:00Z';
test('actualiza por identidad, conserva otras fuentes y no duplica al repetir',()=>{
 const incoming=[{...job('SEF-1'),title:'Actualizada'}];
 const once=reconcileSource(catalog,'sef-murcia',incoming,at);
 assert.deepEqual(reconcileSource(once,'sef-murcia',incoming,at),once);
 assert.deepEqual(once.calls.map(x=>x.id).sort(),['BOE-1','SEF-1','SEF-MISSING']);
 assert.equal(once.calls.find(x=>x.id==='SEF-1')?.title,'Actualizada');
 assert.equal(once.calls.find(x=>x.id==='SEF-MISSING')?.checkedAt,'2026-10-14T05:30:00Z');
 assert.equal(catalog.calls.length,4);
});
test('rechaza captura vacía, IDs duplicados o fuente cruzada sin alterar el catálogo',()=>{
 for(const incoming of [[],[job('X'),job('X')],[job('X','boe')]]) assert.throws(()=>reconcileSource(catalog,'sef-murcia',incoming,at));
 assert.equal(catalog.checkedAt,'old');
});
test('escribe JSON atómicamente y limpia temporales ante error',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-'));try{
 const target=join(dir,'catalog.json');await writeJsonAtomic(target,{ok:true});
 assert.deepEqual(JSON.parse(await readFile(target,'utf8')),{ok:true});
 await assert.rejects(writeJsonAtomic(dir,{other:true}));
 assert.deepEqual(await readdir(dir),['catalog.json']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
