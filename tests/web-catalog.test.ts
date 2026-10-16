import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchCalls } from '../apps/web-preview/public/catalog.mjs';

const catalog = JSON.parse(readFileSync(new URL('../apps/web-preview/public/data/calls.json', import.meta.url), 'utf8'));
// Use the fixed BOE selection for deterministic search assertions; other sources refresh daily.
const searchFixture = catalog.calls.filter((call:{sourceId:string}) => call.sourceId === 'boe');

test('busca sin distinguir tildes o mayúsculas', () => {
  const result = searchCalls(searchFixture, { q: 'TECNICO informatico' });
  assert.deepEqual(result.map(call => call.id), ['BOE-A-2026-21006']);
});

test('combina texto, territorio y categoría sin resultados ajenos', () => {
  const result = searchCalls(searchFixture, { city: 'Comunidad de Madrid', category: 'administracion' });
  assert.deepEqual(result.map(call => call.id), ['BOE-A-2026-21011']);
  assert.equal(searchCalls(searchFixture, { city: 'Comunidad de Madrid', category: 'cultura' }).length, 0);
});

test('limpiar consulta recupera los anuncios y preserva datos originales', () => {
  const original = structuredClone(catalog.calls);
  assert.equal(searchCalls(catalog.calls, { q: '  ' }).length, catalog.calls.length);
  assert.deepEqual(catalog.calls, original);
});

test('catálogo público contiene referencias reales y no inventa salario ni cierre', () => {
  assert.ok(['verified_snapshot','daily_sources'].includes(catalog.mode));
  const boe=catalog.calls.filter((call:{sourceId:string})=>call.sourceId==='boe');
  assert.equal(boe.length,4);
  assert.equal(boe.reduce((sum: number, call: { places: number }) => sum + call.places, 0), 9);
  for (const call of boe) {
    assert.match(call.id, /^BOE-A-2026-210(?:06|08|10|11)$/);
    assert.equal(new URL(call.sourceUrl).hostname, 'www.boe.es');
    assert.equal(call.salary, null);
    assert.equal(call.closingDate, null);
    assert.equal(call.kind, 'public_call');
    assert.ok(call.paragraphs.some((paragraph: string) => paragraph.startsWith('El plazo')));
  }
});
