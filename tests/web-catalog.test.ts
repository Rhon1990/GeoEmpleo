import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { employerFacet, searchCalls } from '../apps/web-preview/public/catalog.mjs';

const catalog = JSON.parse(readFileSync(new URL('../apps/web-preview/public/data/calls.json', import.meta.url), 'utf8'));
// Use the fixed BOE selection for deterministic search assertions; other sources refresh daily.
const searchFixture = catalog.calls.filter((call:{sourceId:string}) => call.sourceId === 'boe');

test('busca sin distinguir tildes o mayúsculas', () => {
  const result = searchCalls(searchFixture, { q: 'TECNICO informatico' });
  assert.deepEqual(result.map(call => call.id), ['BOE-A-2026-21006']);
});

test('el filtro de empresa distingue DIA de coincidencias accidentales en el texto', () => {
  const companyCalls = [
    { ...searchFixture[0], employer: 'DIA', title: 'Cajero/a en Ávila' },
    { ...searchFixture[0], id: 'jandia', employer: 'Meliá Hotels International', title: 'Recepcionista en Jandía' },
  ];
  assert.deepEqual(searchCalls(companyCalls, { employer: 'dia' }).map(call => call.employer), ['DIA']);
});

test('agrupa las variantes de McDonald’s bajo un único filtro de empresa', () => {
  const companyCalls = [
    { ...searchFixture[0], employer: "McDonald's Parets" },
    { ...searchFixture[0], id: 'mcdonalds-sabadell', employer: "McDonald´s Sabadell" },
    { ...searchFixture[0], id: 'mcdonalds-moncada', employer: "McDonald's Moncada" },
    { ...searchFixture[0], id: 'mchire', employer: 'McHire' },
    { ...searchFixture[0], id: 'dia', employer: 'DIA' },
  ];
  assert.deepEqual(searchCalls(companyCalls, { employer: 'mcdonalds' }).map(call => call.id), [searchFixture[0].id, 'mcdonalds-sabadell', 'mcdonalds-moncada', 'mchire']);
  assert.deepEqual(employerFacet('McHire'), { id: 'mcdonalds', label: 'McDonald’s' });
  assert.deepEqual(employerFacet('mcdonalds-moncada'), { id: 'mcdonalds', label: 'McDonald’s' });
  assert.equal(companyCalls.find(call => call.id === 'mchire')?.employer, 'McHire');
});

test('usa la fuente verificada para agrupar bajo McDonald’s las ofertas cuyo anunciante es una persona', () => {
  const companyCalls = [
    { ...searchFixture[0], id: 'mcdonalds-publisher-1', sourceId: 'talentclue-mcdonalds', employer: 'AGUSTÍN SOLER DRÓPEZ' },
    { ...searchFixture[0], id: 'mcdonalds-publisher-2', sourceId: 'talentclue-mcdonalds', employer: 'MONICA SANCHEZ' },
    { ...searchFixture[0], id: 'unrelated-person', sourceId: 'boe', employer: 'MONICA SANCHEZ' },
  ];

  assert.deepEqual(employerFacet(companyCalls[0].employer, companyCalls[0].sourceId), { id: 'mcdonalds', label: 'McDonald’s' });
  assert.deepEqual(searchCalls(companyCalls, { employer: 'mcdonalds' }).map(call => call.id), ['mcdonalds-publisher-1', 'mcdonalds-publisher-2']);
  assert.deepEqual(employerFacet(companyCalls[2].employer, companyCalls[2].sourceId), { id: 'monica-sanchez', label: 'MONICA SANCHEZ' });
  assert.equal(companyCalls[0].employer, 'AGUSTÍN SOLER DRÓPEZ');
});

test('agrupa divisiones de Randstad en un solo filtro sin alterar el empleador original', () => {
  const names = [
    'Randstad', 'Randstad Digital', 'Randstad Inhouse Services', 'Randstad Outsourcing',
    'Randstad Professionals', 'Randstad Talento y Cultura', 'Randstad Trabajo Temporal',
  ];
  const companyCalls = names.map((employer, index) => ({
    ...searchFixture[0], id: `randstad-${index}`, employer,
  }));

  assert.deepEqual(employerFacet('Randstad Digital'), { id: 'randstad', label: 'Randstad' });
  assert.deepEqual(employerFacet('randstad-digital'), { id: 'randstad', label: 'Randstad' });
  assert.deepEqual(searchCalls(companyCalls, { employer: 'randstad' }).map(call => call.employer), names);
  assert.equal(companyCalls[1].employer, 'Randstad Digital');
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
