import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expireFailedSource,reconcileSource} from '../packages/ingestion/src/catalog.ts';
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
test('retiene una oferta ausente sin cierre durante siete días exactos',()=>{
 const missing=job('ECYL-MISSING','ecyl-castilla-leon',null);
 const base={...catalog,calls:[missing]} as PublicCatalog;
 const incoming=[{...job('ECYL-CURRENT','ecyl-castilla-leon',null),checkedAt:'2026-10-21T05:30:00Z'}];

 const atLimit=reconcileSource(
  base,'ecyl-castilla-leon',incoming,'2026-10-21T05:30:00Z',{missingRetentionDays:7},
 );
 const afterLimit=reconcileSource(
  base,'ecyl-castilla-leon',incoming,'2026-10-21T05:30:00.001Z',{missingRetentionDays:7},
 );

 assert.ok(atLimit.calls.some(item=>item.id==='ECYL-MISSING'));
 assert.ok(!afterLimit.calls.some(item=>item.id==='ECYL-MISSING'));
});
test('una fuente completa puede retirar ofertas ausentes aunque el cierre previsto sea futuro',()=>{
 const base={...catalog,calls:[job('ADECCO-OLD','adecco-oficial','2026-12-31'),job('OTHER','boe',null)]} as PublicCatalog;
 const incoming=[job('ADECCO-NEW','adecco-oficial','2026-12-31')];
 const next=reconcileSource(base,'adecco-oficial',incoming,at,{missingRetentionDays:0,retainMissingUntilClosingDate:false});
 assert.deepEqual(next.calls.map(item=>item.id).sort(),['ADECCO-NEW','OTHER']);
});
test('una fuente sucesora retira el espejo anterior solo tras una captura válida',()=>{
 const base={...catalog,calls:[job('EULEN-OLD','selectminds-eulen',null),job('OTHER','boe',null)]} as PublicCatalog;
 const incoming=[job('EULEN-NEW','taleo-eulen',null)];
 const next=reconcileSource(base,'taleo-eulen',incoming,at,{missingRetentionDays:0,supersededSourceIds:['selectminds-eulen']});
 assert.deepEqual(next.calls.map(item=>item.id).sort(),['EULEN-NEW','OTHER']);
 assert.throws(()=>reconcileSource(base,'taleo-eulen',[],at,{supersededSourceIds:['selectminds-eulen']}));
 assert.deepEqual(base.calls.map(item=>item.id),['EULEN-OLD','OTHER']);
});
test('caduca una fuente fallida después de su ventana sin tocar otras fuentes',()=>{
 const base={...catalog,calls:[
  {...job('BIZNEO-BK','bizneo-burger-king',null),checkedAt:'2026-11-01T08:00:00Z'},
  {...job('OTHER','lanbide-euskadi',null),checkedAt:'2026-11-01T08:00:00Z'},
 ]} as PublicCatalog;
 const retained=expireFailedSource(base,'bizneo-burger-king','2026-11-04T08:00:00Z',3);
 const expired=expireFailedSource(base,'bizneo-burger-king','2026-11-04T08:00:00.001Z',3);
 assert.ok(retained.calls.some(item=>item.id==='BIZNEO-BK'));
 assert.ok(!expired.calls.some(item=>item.id==='BIZNEO-BK'));
 assert.ok(expired.calls.some(item=>item.id==='OTHER'));
 assert.throws(()=>expireFailedSource({...base,calls:[{...base.calls[0]!,checkedAt:'invalid'}]},'bizneo-burger-king','2026-11-04T08:00:00Z',3),/Fecha/);
});
test('escribe JSON atómicamente y limpia temporales ante error',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-'));try{
 const target=join(dir,'catalog.json');await writeJsonAtomic(target,{ok:true});
 assert.deepEqual(JSON.parse(await readFile(target,'utf8')),{ok:true});
 await assert.rejects(writeJsonAtomic(dir,{other:true}));
 assert.deepEqual(await readdir(dir),['catalog.json']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
