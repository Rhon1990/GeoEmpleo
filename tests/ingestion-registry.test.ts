import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceRegistry, sourceRegistry } from '../packages/ingestion/src/registry.ts';

test('el registro distingue fuentes activas y bloqueadas sin credenciales', () => {
  assert.equal(sourceRegistry.get('sef-murcia')?.status, 'active');
  assert.equal(sourceRegistry.get('infojobs')?.status, 'credentials_required');
  assert.equal(sourceRegistry.get('adzuna-es')?.status, 'paused');
  assert.equal(sourceRegistry.get('linkedin')?.status, 'authorization_required');
  assert.equal(sourceRegistry.get('sef-murcia')?.countryCode, 'ES');
});

test('los tablones empresariales verificados figuran activos en el registro',()=>{
  for(const id of ['successfactors-vithas','successfactors-mapfre','successfactors-capgemini']) {
    const source=sourceRegistry.get(id);
    assert.equal(source?.kind,'ats');
    assert.equal(source?.status,'active');
    assert.equal(new URL(source.endpoint!).protocol,'https:');
  }
});

test('el registro no expone mutadores en runtime', () => {
  assert.equal('set' in sourceRegistry, false);
  assert.equal('delete' in sourceRegistry, false);
  assert.equal('clear' in sourceRegistry, false);
  assert.equal(Object.isFrozen(sourceRegistry), true);
});

test('rechaza identificadores de fuente duplicados', () => {
  const source = sourceRegistry.get('sef-murcia');
  assert.ok(source);

  assert.throws(
    () => createSourceRegistry([source, { ...source }]),
    /Fuente duplicada: sef-murcia/,
  );
});
