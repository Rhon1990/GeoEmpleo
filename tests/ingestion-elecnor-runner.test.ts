import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {runDaily} from '../packages/ingestion/src/runner.ts';

test('runner publica las 76 fichas oficiales observadas de Elecnor',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-elecnor-'));
 try {
  const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json');
  const nationalPlacesPath=join(dir,'spain-places.json.gz'),reportPath=join(dir,'latest.json');
  await writeFile(catalogPath,JSON.stringify({checkedAt:'2026-11-16T00:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[]}));
  await writeFile(placesPath,JSON.stringify({places:[]}));
  await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-11-17',license:'test',places:[]})));
  const report=await runDaily({catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds:['elecnor-oficial'],checkedAt:'2026-11-17T18:30:00.000Z'});
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.deepEqual(report.sources,[{sourceId:'elecnor-oficial',status:'success',received:76,mapped:0,reason:null}]);
  assert.equal(catalog.calls.length,76);
  assert.ok(catalog.calls.every((job:{id:string;sourceUrl:string})=>job.id.startsWith('ELECNOR-')&&job.sourceUrl.startsWith('https://elecnor.epreselec.com/Ofertas/Ofertas.aspx?Id_Oferta=')));
  const other={...catalog.calls[0],id:'OTHER-KEEP',sourceId:'another-source'};
  await writeFile(catalogPath,JSON.stringify({...catalog,calls:[...catalog.calls,other]}));
  const options={catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds:['elecnor-oficial']};
  await runDaily({...options,checkedAt:'2026-11-18T08:00:00.000Z'});
  const nextDay=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.equal(nextDay.calls.length,77);
  assert.ok(nextDay.calls.filter((job:{sourceId:string})=>job.sourceId==='elecnor-oficial').every((job:{checkedAt:string})=>job.checkedAt==='2026-11-17T18:00:00.000Z'));
  await runDaily({...options,checkedAt:'2026-12-01T18:00:00.001Z'});
  const expired=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.deepEqual(expired.calls,[other]);
 } finally {await rm(dir,{recursive:true,force:true});}
});
