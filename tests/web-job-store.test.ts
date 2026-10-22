import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore} from '../apps/web-preview/job-store.mjs';
const job=(id:string,point:number[]|null)=>({id,title:'Técnico de empleo',employer:'Anunciante',city:'Ciudad',province:'Provincia',region:'Región',category:'tecnico',categoryLabel:'Oficios técnicos',paragraphs:['Detalle completo'],source:'Fuente',location:point?{point}:null});
async function fixture(run:(store:ReturnType<typeof createJobStore>,path:string)=>Promise<void>) {
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-store-'));
 try{const path=join(dir,'calls.json');await writeFile(path,JSON.stringify({checkedAt:'2026-10-15',calls:[job('inside',[-1,38]),job('outside',[-3,40]),job('unknown',null)]}));await run(createJobStore(path),path);}
 finally{await rm(dir,{recursive:true,force:true});}
}
test('devuelve solo ofertas del viewport y resúmenes sin descripción',()=>fixture(async store=>{
 const page=await store.query(new URLSearchParams({bounds:'-2,37,0,39',q:'TECNICO'}));
 assert.equal(page.total,1);assert.deepEqual(page.jobs.map(j=>j.id),['inside']);assert.equal('paragraphs' in page.jobs[0],false);
 assert.deepEqual((await store.detail('inside'))?.paragraphs,['Detalle completo']);assert.equal(await store.detail('missing'),null);
 assert.ok(page.facets.categories.some((c:{id:string})=>c.id==='tecnico'));
}));
test('valida coordenadas, duplicados y tamaño de parámetros antes de consultar',()=>fixture(async store=>{
 for(const value of ['','NaN,37,0,39','-181,37,0,39','-2,40,0,39','-2,37,0','-2,,0,39']) await assert.rejects(store.query(new URLSearchParams({bounds:value})),/Parámetros/);
 await assert.rejects(store.query(new URLSearchParams('q=a&q=b')),/Parámetros/);
 await assert.rejects(store.query(new URLSearchParams({q:'x'.repeat(201)})),/Parámetros/);
}));
test('limita la transferencia y detecta cambios de snapshot sin reiniciar',()=>fixture(async(store,path)=>{
 await writeFile(path,JSON.stringify({checkedAt:'2026-10-16',calls:Array.from({length:350},(_,i)=>job(`job-${i}`,[-1,38]))}));
 const first=await store.query(new URLSearchParams({bounds:'-2,37,0,39'}));assert.equal(first.total,350);assert.equal(first.jobs.length,300);assert.equal(first.truncated,true);
 await writeFile(path,JSON.stringify({checkedAt:'2026-10-17',calls:[job('new',[-1,38])]}));
 const next=await store.query(new URLSearchParams());assert.equal(next.total,1);assert.equal(next.jobs[0].id,'new');assert.equal(await store.detail('job-0'),null);
}));
test('incluye ofertas directas publicadas en resultados, detalle, fuentes y filtros',()=>fixture(async(_store,path)=>{
 const direct={...job('direct-1',[-4.4,40.8]),sourceId:'direct-employer',source:'Anunciante en GeoEmpleo',region:'Castilla y León',category:'otros',categoryLabel:'Otras oportunidades'};
 const store=createJobStore(path,()=>[direct]);
 const page=await store.query(new URLSearchParams({city:'Castilla y León'}));
 assert.deepEqual(page.jobs.map(item=>item.id),['direct-1']);
 assert.ok(page.sources.includes('Anunciante en GeoEmpleo'));
 assert.ok(page.facets.regions.includes('Castilla y León'));
 assert.ok(page.facets.categories.some(item=>item.id==='otros'&&item.label==='Otras oportunidades'));
 assert.equal((await store.detail('direct-1'))?.sourceId,'direct-employer');
}));
