import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNationalPlaceResolver,
  loadNationalGazetteer,
  type NationalGazetteerPlace,
} from '../packages/ingestion/src/national-geography.ts';

const gazetteerUrl = new URL(
  '../apps/web-preview/data/spain-places.json.gz',
  import.meta.url,
);

test('carga el gazetteer gzip real y resuelve Riaza con precisión locality', async () => {
  const gazetteer = await loadNationalGazetteer(gazetteerUrl);
  const resolvePlace = createNationalPlaceResolver(gazetteer.places);

  assert.deepEqual(resolvePlace('Riaza', 'Segovia'), {
    point: [-3.47787, 41.27826],
    precision: 'municipality',
    sourceUrl: 'https://www.geonames.org/3111867',
    sourceUpdatedAt: '2012-03-04',
    note: 'Ubicación municipal aproximada; no es la dirección exacta del puesto.',
  });
});

test('normaliza acentos y variantes bilingües separadas por barra', async () => {
  const gazetteer = await loadNationalGazetteer(gazetteerUrl);
  const resolvePlace = createNationalPlaceResolver(gazetteer.places);
  const expected = {
    point: [-1.97499, 43.31283] as [number, number],
    precision: 'municipality' as const,
    sourceUrl: 'https://www.geonames.org/3110044',
    sourceUpdatedAt: '2025-07-03',
    note: 'Ubicación municipal aproximada; no es la dirección exacta del puesto.',
  };

  assert.deepEqual(resolvePlace('DONOSTIA/SAN SEBASTIÁN', 'GIPUZKOA'), expected);
  assert.deepEqual(resolvePlace('San Sebastian', 'Guipúzcoa'), expected);
});

test('normaliza artículos pospuestos en localidades nacionales', () => {
  const place: NationalGazetteerPlace = {
    id: 'postal-80',
    name: 'Abelida, A',
    aliases: null,
    province: 'Ourense',
    municipality: 'Gomesende',
    latitude: 42.42,
    longitude: -7.9568,
    sourceUrl: 'https://download.geonames.org/export/zip/ES.zip',
    precision: 'postal_locality',
    updatedAt: null,
  };
  const resolvePlace = createNationalPlaceResolver([place]);

  assert.deepEqual(resolvePlace('A Abelida', 'Ourense'), {
    point: [-7.9568, 42.42],
    precision: 'municipality',
    sourceUrl: place.sourceUrl,
    sourceUpdatedAt: null,
    note: 'Ubicación municipal aproximada; no es la dirección exacta del puesto.',
  });
});

test('exige provincia compatible y rechaza resultados ambiguos', async () => {
  const gazetteer = await loadNationalGazetteer(gazetteerUrl);
  const resolvePlace = createNationalPlaceResolver(gazetteer.places);

  assert.equal(resolvePlace('Riaza'), null);
  assert.equal(resolvePlace('Riaza', 'Madrid'), null);

  const duplicated: NationalGazetteerPlace[] = [
    {
      id: 'one', name: 'Villa', aliases: [], province: 'Segovia', municipality: 'Villa',
      latitude: 41.1, longitude: -3.1, sourceUrl: 'https://example.test/one',
      precision: 'locality', updatedAt: '2026-10-15',
    },
    {
      id: 'two', name: 'Villa', aliases: [], province: 'Segovia', municipality: 'Villa',
      latitude: 41.2, longitude: -3.2, sourceUrl: 'https://example.test/two',
      precision: 'locality', updatedAt: '2026-10-15',
    },
  ];
  assert.equal(createNationalPlaceResolver(duplicated)('Villa', 'Segovia'), null);
});

test('prefiere locality a postal_locality y descarta coordenadas inválidas', () => {
  const places: NationalGazetteerPlace[] = [
    {
      id: 'postal', name: 'Riaza', aliases: null, province: 'Segovia', municipality: 'Riaza',
      latitude: 41.3, longitude: -3.5, sourceUrl: 'https://example.test/postal',
      precision: 'postal_locality', updatedAt: null,
    },
    {
      id: 'locality', name: 'Riaza', aliases: [], province: 'Segovia', municipality: 'Riaza',
      latitude: 41.27826, longitude: -3.47787, sourceUrl: 'https://example.test/locality',
      precision: 'locality', updatedAt: '2026-10-15',
    },
    {
      id: 'invalid', name: 'Fuera', aliases: [], province: 'Segovia', municipality: 'Fuera',
      latitude: 91, longitude: -3, sourceUrl: 'https://example.test/invalid',
      precision: 'locality', updatedAt: '2026-10-15',
    },
  ];
  const resolvePlace = createNationalPlaceResolver(places);

  assert.equal(resolvePlace('Fuera', 'Segovia'), null);
  assert.equal(resolvePlace('Riaza', 'Segovia')?.sourceUrl, 'https://example.test/locality');
});
