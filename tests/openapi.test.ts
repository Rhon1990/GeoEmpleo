import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenApi } from '../packages/contracts/tools/generate-openapi.ts';

function references(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(references);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => key === '$ref' ? [String(child)] : references(child));
}

test('OpenAPI declara solo las tres rutas públicas de lectura sin autenticación', () => {
  const document = buildOpenApi();
  assert.equal(document.openapi, '3.1.0');
  assert.deepEqual(document.security, []);
  assert.deepEqual(Object.keys(document.paths as object).sort(), [
    '/v1/{country}/jobs', '/v1/{country}/jobs/{id}', '/v1/{country}/map',
  ]);
  for (const item of Object.values(document.paths as Record<string, { get: { security: unknown[] } }>)) {
    assert.deepEqual(Object.keys(item), ['get']);
    assert.deepEqual(item.get.security, []);
  }
});

test('todas las referencias OpenAPI están empaquetadas y resuelven localmente', () => {
  const document = buildOpenApi();
  const refs = references(document);
  assert.ok(refs.length > 0);
  for (const ref of refs) {
    assert.ok(ref.startsWith('#/'), ref);
    let current: unknown = document;
    for (const part of ref.slice(2).split('/')) {
      assert.ok(current && typeof current === 'object', ref);
      current = (current as Record<string, unknown>)[part.replaceAll('~1', '/').replaceAll('~0', '~')];
    }
    assert.notEqual(current, undefined, ref);
  }
});
