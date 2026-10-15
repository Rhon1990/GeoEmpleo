import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlaceResolver } from '../packages/ingestion/src/geography.ts';

interface PlaceFixture {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  updatedAt: string;
}

const gazetteer = JSON.parse(
  readFileSync(new URL('../apps/web-preview/public/data/places.json', import.meta.url), 'utf8'),
) as { places: PlaceFixture[] };

test('resuelve un municipio murciano por nombre normalizado y artículo pospuesto', () => {
  const resolvePlace = createPlaceResolver(gazetteer.places);

  assert.deepEqual(resolvePlace('  ALCAZARES,   LOS  ', 'MURCIA'), {
    point: [-0.85041, 37.74425],
    precision: 'municipality',
    sourceUrl: 'https://www.geonames.org/2514868',
    sourceUpdatedAt: '2021-11-03',
    note: 'Ubicación municipal aproximada; no es la dirección exacta del puesto.',
  });
  assert.deepEqual(resolvePlace('los alcázares', 'murcia'), resolvePlace('LOS ALCÁZARES', 'Murcia'));
});

test('no inventa ubicación para nombres desconocidos o sin ámbito Murcia', () => {
  const resolvePlace = createPlaceResolver(gazetteer.places);

  assert.equal(resolvePlace('Municipio inexistente', 'Murcia'), null);
  assert.equal(resolvePlace('Los Alcázares'), null);
  assert.equal(resolvePlace('Los Alcázares', 'Alicante'), null);
  assert.equal(resolvePlace('Almoradí', 'Murcia'), null);
});

test('rechaza nombres duplicados aunque ambos puntos sean válidos', () => {
  const duplicated = [
    ...gazetteer.places,
    {
      id: 'duplicate-los-alcazares',
      name: 'Los Alcázares',
      latitude: 37.75,
      longitude: -0.84,
      sourceUrl: 'https://example.test/duplicate',
      updatedAt: '2026-10-15',
    },
  ];

  assert.equal(createPlaceResolver(duplicated)('Los Alcázares', 'Murcia'), null);
});

test('descarta coordenadas no finitas, fuera de rango o del ámbito de Murcia', () => {
  const invalidCoordinates = [
    {
      id: 'not-finite',
      name: 'Los Alcázares',
      latitude: Number.NaN,
      longitude: -0.85041,
      sourceUrl: 'https://example.test/not-finite',
      updatedAt: '2026-10-15',
    },
    {
      id: 'out-of-range',
      name: 'Murcia',
      latitude: 91,
      longitude: -1.13004,
      sourceUrl: 'https://example.test/out-of-range',
      updatedAt: '2026-10-15',
    },
    {
      id: 'outside-murcia',
      name: 'Cartagena',
      latitude: 40.4165,
      longitude: -3.70256,
      sourceUrl: 'https://example.test/outside-murcia',
      updatedAt: '2026-10-15',
    },
  ];

  const resolvePlace = createPlaceResolver(invalidCoordinates);
  assert.equal(resolvePlace('Los Alcázares', 'Murcia'), null);
  assert.equal(resolvePlace('Murcia', 'Murcia'), null);
  assert.equal(resolvePlace('Cartagena', 'Murcia'), null);
});
