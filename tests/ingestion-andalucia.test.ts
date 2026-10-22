import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adaptAndaluciaOffers} from '../packages/ingestion/src/connectors/andalucia.ts';
const now='2026-10-20T08:00:00.000Z';
const raw={id:'689251',job_name:'Administrativa',announcement_type:'Oferta de empleo',announcement_status:'En curso',publish_date:'2026-10-20',deadline_application:'2026-10-23',job_agreement:'Indefinido',functions:'<p>Atención pública</p><script>bad()</script>',job_official_degree_requirements:'Bachiller',job_specific_degree_requirements:null,job_other_requirements:null,job_location:[{locality:'Tarifa',field_lugar_provincia:[{provinces:'Cádiz'}]}]};
const wrap=(rows:unknown[])=>({hits:rows.length,total_hits:rows.length,results:rows});
test('Andalucía retains official detail, deadline, sanitized text and verified municipality',()=>{
 const jobs=adaptAndaluciaOffers(wrap([raw]),now,(city,province)=>{assert.equal(city,'Tarifa');assert.equal(province,'Cádiz');return null;});
 assert.equal(jobs.length,1);assert.equal(jobs[0]?.closingDate,'2026-10-23');assert.equal(jobs[0]?.id,'ANDALUCIA-689251');
 assert.ok(jobs[0]?.sourceUrl.endsWith('/detalle/689251.html'));assert.ok(!jobs[0]?.paragraphs.join(' ').includes('bad()'));assert.equal(jobs[0]?.salary,null);
});
test('Andalucía rejects incomplete snapshots and duplicate IDs',()=>{
 assert.throws(()=>adaptAndaluciaOffers({...wrap([raw]),total_hits:2},now,()=>null));
 assert.throws(()=>adaptAndaluciaOffers(wrap([raw,raw]),now,()=>null));
});
test('Andalucía excludes closed, future, internal and unknown-deadline processes',()=>{
 for(const patch of [{publish_date:'2026-10-18',deadline_application:'2026-10-19'},{publish_date:'2026-10-21'},{announcement_type:'Promoción interna'},{announcement_status:'Concluido'},{deadline_application:null}])assert.equal(adaptAndaluciaOffers(wrap([{...raw,...patch}]),now,()=>null).length,0);
});
test('Andalucía never chooses an arbitrary point for multiple workplaces',()=>{
 const jobs=adaptAndaluciaOffers(wrap([{...raw,job_location:[...raw.job_location,{locality:'Sevilla',field_lugar_provincia:[{provinces:'Sevilla'}]}]}]),now,()=>{throw Error('No arbitrary point');});
 assert.equal(jobs.length,1);assert.equal(jobs[0]?.location,null);assert.match(jobs[0]!.city,/Tarifa.*Sevilla/);
});
test('Andalucía rejects malformed dates and provinces',()=>{
 for(const patch of [{deadline_application:'2026-02-30'},{job_location:[{locality:'Tarifa',field_lugar_provincia:[{provinces:'Madrid'}]}]}])assert.throws(()=>adaptAndaluciaOffers(wrap([{...raw,...patch}]),now,()=>null));
});
test('historical expired processes do not invalidate current applications',()=>{
 assert.equal(adaptAndaluciaOffers(wrap([{...raw,id:'1',publish_date:'2024-02-02',deadline_application:'2024-01-01'},raw]),now,()=>null).length,1);
});
test('runner integrates Andalucía idempotently and preserves previous snapshot on failure',async()=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {gzipSync}=await import('node:zlib');const {runDaily}=await import('../packages/ingestion/src/runner.ts');
 const dir=await mkdtemp(join(tmpdir(),'andalucia-'));
 try{
 const catalogPath=join(dir,'calls.json'),reportPath=join(dir,'report.json'),nationalPlacesPath=join(dir,'places.gz');
 await writeFile(catalogPath,JSON.stringify({checkedAt:now,calls:[]}));await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-10-20',license:'test',places:[]})));
 const options={catalogPath,reportPath,nationalPlacesPath,placesPath:'unused',sourceIds:['andalucia-entidades'],checkedAt:now,fetchImpl:(async()=>new Response(JSON.stringify(wrap([raw])),{headers:{'content-type':'application/json'}})) as typeof fetch};
 assert.equal((await runDaily(options)).status,'success');await runDaily(options);
 const before=await readFile(catalogPath,'utf8');assert.equal(JSON.parse(before).calls.length,1);
 await assert.rejects(runDaily({...options,fetchImpl:(async()=>{throw Error('network');}) as typeof fetch}));assert.equal(await readFile(catalogPath,'utf8'),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
