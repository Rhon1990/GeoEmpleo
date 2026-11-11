import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCatalogParity,validateDailyRun} from '../tools/validate-daily-catalog.mjs';

const startedAt='2026-10-26T05:37:00.000Z';
const checkedAt='2026-10-26T05:38:00.000Z';
const catalog={checkedAt,calls:[{id:'sef-1'},{id:'dia-1'}]};
const report={status:'partial',checkedAt,published:2,sources:[{sourceId:'sef',status:'failed'},{sourceId:'dia',status:'success'}]};

test('acepta una captura parcial reciente con IDs únicos',()=>{
  assert.equal(validateDailyRun(report,catalog,startedAt,Date.parse('2026-10-26T05:39:00.000Z')).status,'partial');
});

test('rechaza una captura fallida',()=>{
  assert.throws(()=>validateDailyRun({...report,status:'failed'},catalog,startedAt),/no es publicable/);
});

test('rechaza un checkedAt anterior a esta ejecución',()=>{
  assert.throws(()=>validateDailyRun({...report,checkedAt:'2026-10-25T05:38:00.000Z'},catalog,startedAt),/no corresponde/);
});

test('rechaza IDs duplicados',()=>{
  assert.throws(()=>validateDailyRun(report,{...catalog,calls:[{id:'dup'},{id:'dup'}]},startedAt),/duplicados/);
});

test('rechaza una captura parcial sin ninguna fuente actualizada',()=>{
  assert.throws(()=>validateDailyRun({...report,sources:report.sources.map(source=>({...source,status:'failed'}))},catalog,startedAt),/ninguna fuente actualizada/);
});

test('una publicación de interfaz conserva exactamente el catálogo público',()=>{
  assert.deepEqual(validateCatalogParity(catalog,structuredClone(catalog)),{offers:2,checkedAt});
  assert.throws(()=>validateCatalogParity({...catalog,calls:catalog.calls.slice(0,1)},catalog),/no coincide/);
  assert.throws(()=>validateCatalogParity({...catalog,calls:[{id:'sef-1'},{id:'otra'}]},catalog),/no coincide/);
  assert.throws(()=>validateCatalogParity({...catalog,calls:[{id:'sef-1',title:'cambiado'},{id:'dia-1'}]},catalog),/no coincide/);
  assert.throws(()=>validateCatalogParity({...catalog,checkedAt:'2026-10-27T05:38:00.000Z'},catalog),/no coincide/);
  assert.throws(()=>validateCatalogParity({checkedAt,calls:[]},{checkedAt,calls:[]}),/vacío/);
});
