import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const requestedSourceIds=[
  'mercadona-oficial',
  'crit-oficial',
  'sacyr-oficial',
  'acciona-oficial',
  'ferrovial-oficial',
  'stef-oficial',
] as const;

test('las seis fuentes empresariales solicitadas quedan inventariadas con URL HTTPS oficial',()=>{
  for(const sourceId of requestedSourceIds) {
    const source=sourceRegistry.get(sourceId);
    assert.ok(source,`${sourceId} debe quedar inventariada`);
    assert.match(source.endpoint??'',/^https:\/\//);
    assert.ok(['active','candidate','authorization_required'].includes(source.status));
  }
});

test('Mercadona, Sacyr, Acciona y STEF están activas tras comprobar su contrato completo',()=>{
  assert.equal(sourceRegistry.get('sacyr-oficial')?.status,'active');
  assert.equal(sourceRegistry.get('mercadona-oficial')?.status,'active');
  assert.equal(sourceRegistry.get('crit-oficial')?.status,'candidate');
  assert.equal(sourceRegistry.get('acciona-oficial')?.status,'active');
  assert.equal(sourceRegistry.get('ferrovial-oficial')?.status,'authorization_required');
  assert.equal(sourceRegistry.get('stef-oficial')?.status,'active');
});
