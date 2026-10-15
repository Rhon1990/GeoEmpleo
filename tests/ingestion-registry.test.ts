import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceRegistry } from '../packages/ingestion/src/registry.ts';

test('el registro distingue fuentes activas y bloqueadas sin credenciales', () => {
  assert.equal(sourceRegistry.get('sef-murcia')?.status, 'active');
  assert.equal(sourceRegistry.get('infojobs')?.status, 'credentials_required');
  assert.equal(sourceRegistry.get('adzuna-es')?.status, 'credentials_required');
  assert.equal(sourceRegistry.get('linkedin')?.status, 'authorization_required');
  assert.equal(sourceRegistry.get('sef-murcia')?.countryCode, 'ES');
});
