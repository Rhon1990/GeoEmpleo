import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptCylOffers } from '../packages/ingestion/src/connectors/cyl.ts';
import { adaptLanbideOffers } from '../packages/ingestion/src/connectors/lanbide.ts';
import { sourceRegistry } from '../packages/ingestion/src/registry.ts';

const checkedAt = '2026-10-15T05:30:00Z';
const location = {
  point: [-3.47787, 41.27826] as [number, number],
  precision: 'municipality' as const,
  sourceUrl: 'https://www.geonames.org/3111867',
  sourceUpdatedAt: '2012-03-04',
  note: 'Ubicación municipal aproximada; no es la dirección exacta del puesto.',
};
const cylIdentifier = '1285689059828';
const cylPath = `/web/jcyl/Empleo/es/Plantilla100Detalle/1284216458054/OfertasEmpleo/${cylIdentifier}/Empleo`;
const cylOfficialUrl = `https://empleo.jcyl.es${cylPath}`;

const cylRaw = {
  titulo: 'Técnico/a de mantenimiento',
  provincia: 'SEGOVIA',
  fecha_publicacion: '2026-09-15T09:45:00+02:00',
  descripcion: '<p>Revisión de equipos.</p><script>alert(1)</script><p>Contrato estable.</p>',
  fuente_contenido: 'ECYL',
  localidad_asset: '1179297860755',
  localidad_asset0: 'RIAZA',
  identificador: cylIdentifier,
  actualizacionmetadatos: '2026-10-14T08:00:00+02:00',
  enlace_al_contenido: `https://gestorcontenidos.jcyl.es${cylPath}`,
  geografico: { lon: -3.47787, lat: 41.27826 },
};

function cylOffer(
  identifier: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    ...cylRaw,
    identificador: identifier,
    enlace_al_contenido: `https://gestorcontenidos.jcyl.es/web/jcyl/Empleo/es/Plantilla100Detalle/1284216458054/OfertasEmpleo/${identifier}/Empleo`,
    ...overrides,
  };
}

const lanbideRaw = {
  codigo: '162026012345',
  desEmpleo: 'Auxiliar administrativo/a',
  desPuesto: 'Atención al público.\r\n\u0007Gestión documental completa.',
  pais: 'ESPAÑA',
  provincia: 'GIPUZKOA',
  municipio: 'DONOSTIA/SAN SEBASTIÁN',
  fecMod: '14/10/2026',
  fecPub: '15/09/2026',
  url: 'https://web.lanbide.eus/apps/OF_DETALLE_OFERTA_TRABAJO?LG=C&ML=OFEMEN1&MS=Eaaa&IDRG=162026012345&CTRG=1',
};

function lanbideOffer(
  code: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    ...lanbideRaw,
    codigo: code,
    url: `https://web.lanbide.eus/apps/OF_DETALLE_OFERTA_TRABAJO?LG=C&ML=OFEMEN1&MS=Eaaa&IDRG=${code}&CTRG=1`,
    ...overrides,
  };
}

test('adapta ECYL reciente con texto completo seguro, procedencia y punto publicado', () => {
  const jobs = adaptCylOffers([cylRaw], checkedAt, (city, province) => {
    assert.equal(city, 'RIAZA');
    assert.equal(province, 'Segovia');
    return location;
  });

  assert.equal(jobs.length, 1);
  assert.deepEqual(jobs[0], {
    kind: 'job', sourceId: 'ecyl-castilla-leon', source: 'ECYL Castilla y León',
    id: `ECYL-${cylIdentifier}`, title: 'Técnico/a de mantenimiento',
    employer: 'Oferta publicada por ECYL', city: 'RIAZA', province: 'Segovia',
    region: 'Castilla y León', category: 'otros', categoryLabel: 'Otros',
    regime: 'Oferta de empleo', places: null,
    paragraphs: ['Revisión de equipos.', 'Contrato estable.'],
    sourceUrl: cylOfficialUrl, publishedAt: '2026-09-15',
    checkedAt, closingDate: null, salary: null,
    applicationRegistration: 'external_required', selection: null,
    location: {
      point: [-3.47787, 41.27826], precision: 'municipality',
      sourceUrl: cylOfficialUrl, sourceUpdatedAt: '2026-10-14',
      note: 'Ubicación municipal aproximada; no es la dirección exacta del puesto.',
    },
  });
});

test('ECYL resuelve nacionalmente solo cuando no publica geográfico', () => {
  const withoutPoint = { ...cylRaw, geografico: null };
  const jobs = adaptCylOffers([withoutPoint], checkedAt, (city, province) => {
    assert.equal(city, 'RIAZA');
    assert.equal(province, 'Segovia');
    return location;
  });

  assert.deepEqual(jobs[0]?.location, location);
});

test('ECYL no publica un punto oficial alejado del municipio resuelto', () => {
  const conflictingPoint = {
    ...cylRaw,
    geografico: { lon: -3.7, lat: 40.8 },
  };
  const jobs = adaptCylOffers([conflictingPoint], checkedAt, (city, province) => {
    assert.equal(city, 'RIAZA');
    assert.equal(province, 'Segovia');
    return location;
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.location, null);
});

test('ECYL conserva la oferta sin ubicación si no resuelve el municipio publicado', () => {
  const jobs = adaptCylOffers([cylRaw], checkedAt, () => null);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.location, null);
});

test('ECYL admite el extremo occidental publicado de Valladolid', () => {
  const edge = {
    ...cylOffer('1285689962112'),
    provincia: 'VALLADOLID',
    localidad_asset0: 'Villavicencio de los Caballeros',
    geografico: { lon: -5.237418, lat: 42.05893 },
  };

  assert.equal(adaptCylOffers([edge], checkedAt, () => null).length, 1);
});

test('ECYL filtra historial anterior a 30 días y ofertas futuras', () => {
  const jobs = adaptCylOffers([
    cylRaw,
    cylOffer('1285689000001', { fecha_publicacion: '2026-09-14' }),
    cylOffer('1285689000002', { fecha_publicacion: '2026-10-16' }),
    cylOffer('1285689000003', {
      provincia: 'Otra',
      localidad_asset: null,
      localidad_asset0: null,
      geografico: null,
    }),
    cylOffer('1285689000004', {
      provincia: 'Palencia',
      localidad_asset: null,
      localidad_asset0: null,
      geografico: null,
    }),
  ], checkedAt, () => null);

  assert.deepEqual(jobs.map((job) => job.id), [`ECYL-${cylIdentifier}`]);
});

test('ECYL invalida la captura por identidad, URL o geografía publicada malformada', () => {
  const invalidInputs = [
    [cylRaw, cylRaw],
    [cylOffer('X')],
    [cylOffer('1')],
    [cylOffer('../oferta')],
    [{ ...cylRaw, enlace_al_contenido: 'http://empleo.jcyl.es/oferta' }],
    [{ ...cylRaw, enlace_al_contenido: 'https://example.com/oferta' }],
    [{ ...cylRaw, enlace_al_contenido: `https://empleo.jcyl.es:444${cylPath}` }],
    [{ ...cylRaw, enlace_al_contenido: `https://empleo.jcyl.es/web/jcyl/Empleo/arbitraria/${cylIdentifier}/Empleo` }],
    [{ ...cylRaw, enlace_al_contenido: `https://empleo.jcyl.es/web/jcyl/Empleo/es/SegmentoFalso/1284216458054/OfertasEmpleo/${cylIdentifier}/Empleo` }],
    [{ ...cylRaw, provincia: 'MADRID' }],
    [{ ...cylRaw, geografico: { lon: -3.7038, lat: 40.4168 } }],
    [{ ...cylRaw, geografico: { lon: -0.12, lat: 51.5 } }],
  ];
  for (const input of invalidInputs) {
    assert.throws(() => adaptCylOffers(input, checkedAt, () => null));
  }
});

test('ECYL rechaza URL canónica duplicada y vínculo URL-ID incoherente', () => {
  const duplicateUrl = {
    ...cylOffer('1285689059829'),
    enlace_al_contenido: cylOfficialUrl,
  };
  assert.throws(
    () => adaptCylOffers([cylRaw, duplicateUrl], checkedAt, () => null),
    /URL ECYL duplicada/,
  );
  assert.throws(
    () => adaptCylOffers([duplicateUrl], checkedAt, () => null),
    /URL ECYL no corresponde al identificador/,
  );
});

test('adapta Lanbide reciente con texto completo sanitizado y resolución nacional', () => {
  const jobs = adaptLanbideOffers([lanbideRaw], checkedAt, (city, province) => {
    assert.equal(city, 'DONOSTIA/SAN SEBASTIÁN');
    assert.equal(province, 'Guipúzcoa');
    return location;
  });

  assert.deepEqual(jobs[0], {
    kind: 'job', sourceId: 'lanbide-euskadi', source: 'Lanbide',
    id: 'LANBIDE-162026012345', title: 'Auxiliar administrativo/a',
    employer: 'Oferta gestionada por Lanbide', city: 'DONOSTIA/SAN SEBASTIÁN',
    province: 'Guipúzcoa', region: 'País Vasco', category: 'otros', categoryLabel: 'Otros',
    regime: 'Oferta de empleo', places: null,
    paragraphs: ['Atención al público.', 'Gestión documental completa.'],
    sourceUrl: lanbideRaw.url, publishedAt: '2026-09-15', checkedAt,
    closingDate: null, salary: null, applicationRegistration: 'external_required',
    selection: null, location,
  });
});

test('Lanbide conserva ofertas españolas fuera de Euskadi con su región real', () => {
  const navarra = lanbideOffer('162026011032', {
    provincia: 'NAVARRA',
    municipio: 'LARRAUN',
  });
  const jobs = adaptLanbideOffers([navarra], checkedAt, (city, province) => {
    assert.equal(city, 'LARRAUN');
    assert.equal(province, 'Navarra');
    return null;
  });

  assert.equal(jobs[0]?.province, 'Navarra');
  assert.equal(jobs[0]?.region, 'Comunidad Foral de Navarra');
});

test('Lanbide aplica 30 días, no publica futuras e invalida identidad, fecha o URL', () => {
  const jobs = adaptLanbideOffers([
    lanbideRaw,
    lanbideOffer('162026000001', { fecPub: '14/09/2026' }),
    lanbideOffer('162026000002', { fecPub: '16/10/2026' }),
  ], checkedAt, () => null);
  assert.deepEqual(jobs.map((job) => job.id), ['LANBIDE-162026012345']);

  for (const input of [
    [lanbideRaw, lanbideRaw],
    [lanbideOffer('X')],
    [{ ...lanbideRaw, codigo: 'código inválido' }],
    [{ ...lanbideRaw, pais: 'FRANCIA' }],
    [{ ...lanbideRaw, fecPub: '2026-10-15' }],
    [{ ...lanbideRaw, url: 'http://web.lanbide.eus/oferta' }],
    [{ ...lanbideRaw, url: 'https://example.com/oferta' }],
    [{ ...lanbideRaw, url: lanbideRaw.url.replace('web.lanbide.eus', 'web.lanbide.eus:444') }],
    [{ ...lanbideRaw, url: lanbideRaw.url.replace('OF_DETALLE_OFERTA_TRABAJO', 'RUTA_ARBITRARIA') }],
  ]) {
    assert.throws(() => adaptLanbideOffers(input, checkedAt, () => null));
  }
});

test('Lanbide rechaza URL canónica duplicada y vínculo IDRG-codigo incoherente', () => {
  const duplicateUrl = {
    ...lanbideOffer('162026012346'),
    url: 'https://WEB.LANBIDE.EUS:443/apps/OF_DETALLE_OFERTA_TRABAJO?CTRG=1&IDRG=162026012345&MS=Eaaa&ML=OFEMEN1&LG=C',
  };
  assert.throws(
    () => adaptLanbideOffers([lanbideRaw, duplicateUrl], checkedAt, () => null),
    /URL Lanbide duplicada/,
  );
  assert.throws(
    () => adaptLanbideOffers([duplicateUrl], checkedAt, () => null),
    /URL Lanbide no corresponde al código/,
  );
});

test('registra ECYL y Lanbide activas con endpoints y licencias oficiales', () => {
  assert.deepEqual(sourceRegistry.get('ecyl-castilla-leon'), {
    id: 'ecyl-castilla-leon', name: 'ECYL Castilla y León', countryCode: 'ES',
    kind: 'open_data', status: 'active',
    endpoint: 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/ofertas-de-empleo/exports/json',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  });
  assert.deepEqual(sourceRegistry.get('lanbide-euskadi'), {
    id: 'lanbide-euskadi', name: 'Lanbide', countryCode: 'ES',
    kind: 'open_data', status: 'active',
    endpoint: 'https://apps.lanbide.euskadi.net/apps/OF_OFERTAS_ODE_JSON',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  });
});
