import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as aragon from '../packages/ingestion/src/connectors/aragon.ts';
import { sourceRegistry } from '../packages/ingestion/src/registry.ts';
import { runDaily } from '../packages/ingestion/src/runner.ts';
import type { PublicJob } from '../packages/ingestion/src/model.ts';

type Assert<T extends true> = T;
type AuditIsNotPublishable = Assert<aragon.AragonAuditCandidate extends PublicJob ? false : true>;

const checkedAt = '2026-10-22T08:00:00.000Z';
const valid = {
  fuente: 'BOPZ', fecha_publicacion: '19/10/2026', tipo: 'Libre',
  denominacion: 'Ingeniero técnico industrial', organo_convocante: 'AYUNTAMIENTO DE CALATAYUD',
  enlace: 'http://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VERDOC&BASE=BZHT&DOCS=1-100&DOCR=12',
  grupo: 'A2', escala: null, estado: 'Abierta',
  fecha_inicio_presentacion: '20/10/2026', fecha_fin_presentacion: '17/11/2026',
  titulo: 'Bases de la convocatoria de pruebas selectivas para una plaza.',
  plazo: 'veinte días hábiles', num_plazas_detectado: 1,
};

test('Aragón exports an audit API instead of a public-job adapter', () => {
  assert.equal(typeof aragon.auditAragonOffers, 'function');
  assert.equal('adaptAragonOffers' in aragon, false);
});

test('dates and detected places remain reported estimates awaiting bulletin verification', () => {
  const [candidate] = aragon.auditAragonOffers([valid], checkedAt);
  assert.ok(candidate);
  assert.match(candidate.id, /^ARAGON-AUDIT-V1-[a-f0-9]{64}$/);
  assert.equal(candidate.status, 'requires_bulletin_verification');
  assert.equal(candidate.sourceBulletin, 'BOPZ');
  assert.equal(candidate.reportedPublishedAt, '2026-10-19');
  assert.equal(candidate.reportedStartsAt, '2026-10-20');
  assert.equal(candidate.reportedClosingDate, '2026-11-17');
  assert.equal(candidate.reportedPlaces, 1);
  assert.equal(candidate.officialTitle, valid.titulo);
  for (const key of ['kind', 'closingDate', 'places', 'location', 'city', 'province', 'region']) {
    assert.equal(key in candidate, false);
  }
  // Live BOA 09/10/2026 DOCR=3 calls ONE vacancy; feed detected 47 and estimates dates.
  const [unverified] = aragon.auditAragonOffers([{ ...valid,
    fuente: 'BOA', organo_convocante: 'Universidad de Zaragoza', num_plazas_detectado: 47,
    plazo: 'Veinte días hábiles desde la publicación en el Boletín Oficial del Estado',
  }], checkedAt);
  assert.equal(unverified!.status, 'requires_bulletin_verification');
  assert.equal(unverified!.reportedPlaces, 47);
});

test('source CGI URL preserves query order and encoding', () => {
  const address = `${valid.enlace}&TEXT=Calatayud%20y%20m%C3%A1s`;
  assert.equal(aragon.auditAragonOffers([{ ...valid, enlace: address }], checkedAt)[0]!.sourceUrl,
    address.replace('http:', 'https:'));
});

test('eligible rows require supported bulletins, official URLs and valid dates', () => {
  for (const patch of [
    { denominacion: '' }, { organo_convocante: null }, { titulo: [] },
    { fuente: 'BOE' }, { fuente: undefined },
    { fecha_fin_presentacion: '31/02/2026' }, { fecha_publicacion: '2026-10-19' },
    { fecha_fin_presentacion: '19/10/2026' },
    { enlace: 'https://example.com/cgi-bin/EBOA/BRSCGI?CMD=VERDOC' },
    { enlace: 'https://www.boa.aragon.es/otra-ruta?CMD=VERDOC' },
    { enlace: 'https://user@www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VERDOC' },
    { enlace: valid.enlace.replace('http:', 'ftp:') },
    { enlace: valid.enlace.replace('CMD=VERDOC', 'CMD=SEARCH') },
    { enlace: valid.enlace.replace('.es/', '.es:444/') },
  ]) assert.throws(() => aragon.auditAragonOffers([{ ...valid, ...patch }], checkedAt));
  for (const fuente of ['BOA', 'BOPZ', 'BOPH', 'BOPT']) {
    assert.equal(aragon.auditAragonOffers([{ ...valid, fuente }], checkedAt).length, 1);
  }
});

test('audit rejects malformed rows, empty/oversized snapshots and invalid clock', () => {
  for (const input of [{}, [], [null], [[]], [1], Array(10001).fill(valid)]) {
    assert.throws(() => aragon.auditAragonOffers(input, checkedAt));
  }
  assert.throws(() => aragon.auditAragonOffers([valid], 'not-a-date'));
  assert.equal(aragon.auditAragonOffers(Array(10000).fill(valid), checkedAt).length, 1);
});

test('audit excludes closed/internal, unknown, future and estimated-expired rows', () => {
  for (const patch of [
    { estado: 'Cerrada' }, { tipo: 'Interna' }, { tipo: 'Otro' },
    { denominacion: '  NO INDICADO  ' },
    { fecha_fin_presentacion: '21/10/2026' },
    { fecha_publicacion: '23/10/2026' }, { fecha_inicio_presentacion: '23/10/2026' },
    { titulo: 'Información general', denominacion: 'Técnico' },
  ]) assert.equal(aragon.auditAragonOffers([{ ...valid, ...patch }], checkedAt).length, 0);
  assert.equal(aragon.auditAragonOffers([{ ...valid, tipo: 'Libre+Interna' }], checkedAt).length, 1);
});

test('reviewed non-open recruitment acts never become audit candidates', () => {
  for (const titulo of [
    'Declarar desierta la convocatoria de una plaza de técnico.',
    'Nombramiento del candidato de la convocatoria de selección.',
    'Recurso de alzada contra las bases de la convocatoria.',
    'Anuncio por el que se hace público un recurso contencioso-administrativo contra la convocatoria.',
    'Relación definitiva de personas admitidas y excluidas de la convocatoria.',
    'Lista provisional de seleccionados para la convocatoria.',
    'Constitución de la bolsa derivada del proceso selectivo.',
    'Aprobación definitiva de ordenanzas fiscales y convocatoria de información pública.',
    'Aprobación del expediente del concurso para la provisión de plazas.',
  ]) assert.equal(aragon.auditAragonOffers([{ ...valid, titulo }], checkedAt).length, 0, titulo);
});

test('reported places accepts only bounded positive integers', () => {
  for (const count of [null, undefined, 0, -1, 1.5, 100001, '2', Infinity, NaN]) {
    assert.equal(aragon.auditAragonOffers([{ ...valid, num_plazas_detectado: count }], checkedAt)[0]!.reportedPlaces, null);
  }
  assert.equal(aragon.auditAragonOffers([{ ...valid, num_plazas_detectado: 100000 }], checkedAt)[0]!.reportedPlaces, 100000);
});

test('identity normalizes Unicode text/query order but preserves URL value case', () => {
  const variant = { ...valid,
    denominacion: `  ${valid.denominacion.toUpperCase().normalize('NFD')}  `,
    organo_convocante: valid.organo_convocante.toLowerCase(), titulo: valid.titulo.toUpperCase(),
    enlace: 'https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?DOCR=12&DOCS=1-100&BASE=BZHT&CMD=VERDOC',
  };
  assert.equal(aragon.auditAragonOffers([valid, variant], checkedAt).length, 1);
  const originalId = aragon.auditAragonOffers([valid], checkedAt)[0]!.id;
  assert.equal(aragon.auditAragonOffers([variant], checkedAt)[0]!.id, originalId);
  assert.notEqual(aragon.auditAragonOffers([{ ...valid, enlace: valid.enlace.replace('BZHT', 'bzht') }], checkedAt)[0]!.id, originalId);
  assert.equal(aragon.auditAragonOffers([valid, { ...valid, denominacion: 'Arquitecto técnico' }], checkedAt).length, 2);
  assert.notEqual(
    aragon.auditAragonOffers([{ ...valid, denominacion: 'Técnico\u0000A', organo_convocante: 'B' }], checkedAt)[0]!.id,
    aragon.auditAragonOffers([{ ...valid, denominacion: 'Técnico', organo_convocante: 'A\u0000B' }], checkedAt)[0]!.id,
  );
});

test('same identity with conflicting material fields fails the whole audit', () => {
  for (const patch of [
    { fecha_publicacion: '18/10/2026' }, { fecha_inicio_presentacion: '21/10/2026' },
    { fecha_fin_presentacion: '18/11/2026' }, { num_plazas_detectado: 2 },
    { tipo: 'Libre+Interna' }, { fuente: 'BOA' }, { grupo: 'A1' },
    { escala: 'General' }, { plazo: '30 días naturales' },
  ]) assert.throws(() => aragon.auditAragonOffers([valid, { ...valid, ...patch }], checkedAt), /conflicto/i);
});

test('candidate registry cannot be explicitly published by daily runner', async () => {
  const source = sourceRegistry.get('aragon-empleo-publico');
  assert.equal(source?.status, 'candidate');
  assert.equal(source?.endpoint, 'https://opendata.aragon.es/GA_OD_Core/download?resource_id=309&formato=json');
  assert.equal(source?.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
  const directory = await mkdtemp(join(tmpdir(), 'aragon-daily-'));
  try {
    const catalogPath = join(directory, 'calls.json');
    const reportPath = join(directory, 'latest.json');
    const catalog = JSON.stringify({ calls: [{ id: 'existing' }] });
    await writeFile(catalogPath, catalog);
    let requests = 0;
    await assert.rejects(runDaily({ catalogPath, reportPath, placesPath: '', checkedAt,
      sourceIds: ['aragon-empleo-publico'],
      fetchImpl: async () => { requests++; throw new Error('Network must not run'); },
    }), /Todas las fuentes/);
    assert.equal(requests, 0);
    assert.equal(await readFile(catalogPath, 'utf8'), catalog);
    assert.equal(JSON.parse(await readFile(reportPath, 'utf8')).sources[0].reason, 'source_unavailable');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('audit CLI writes a separate candidate report without touching catalog or daily report', async () => {
  const cli = await import('../packages/ingestion/src/aragon-audit-cli.ts').catch(() => null);
  assert.ok(cli, 'An isolated audit CLI must exist');
  const directory = await mkdtemp(join(tmpdir(), 'aragon-audit-'));
  const output = { log: (_message: string) => {}, error: (_message: string) => {} };
  try {
    await writeFile(join(directory, 'calls.json'), 'catalog sentinel');
    await writeFile(join(directory, 'latest.json'), 'daily sentinel');
    let requested = '';
    const exit = await cli.runAragonAuditCli({ reportDirectory: directory, checkedAt,
      fetchImpl: async (url) => {
        requested = String(url);
        return new Response(JSON.stringify([valid, valid]), { headers: { 'content-type': 'application/json' } });
      },
    }, output);
    assert.equal(exit, 0);
    assert.equal(requested, sourceRegistry.get('aragon-empleo-publico')!.endpoint);
    const report = JSON.parse(await readFile(join(directory, 'aragon-audit.json'), 'utf8'));
    assert.equal(report.status, 'candidate');
    assert.equal(report.checkedAt, checkedAt);
    assert.equal(report.received, 2);
    assert.equal(report.candidateCount, 1);
    assert.equal(report.candidates[0].status, 'requires_bulletin_verification');
    assert.equal(report.published, 0);
    assert.equal(await readFile(join(directory, 'calls.json'), 'utf8'), 'catalog sentinel');
    assert.equal(await readFile(join(directory, 'latest.json'), 'utf8'), 'daily sentinel');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('audit CLI failures exit 1 preserving last report and catalog', async () => {
  const cli = await import('../packages/ingestion/src/aragon-audit-cli.ts').catch(() => null);
  assert.ok(cli, 'An isolated audit CLI must exist');
  const directory = await mkdtemp(join(tmpdir(), 'aragon-audit-failure-'));
  try {
    for (const file of ['aragon-audit.json', 'calls.json', 'latest.json']) {
      await writeFile(join(directory, file), `${file} sentinel`);
    }
    for (const fetchImpl of [
      async () => { throw new Error('Network unavailable'); },
      async () => new Response('[]', { headers: { 'content-type': 'application/json' } }),
      async () => new Response(JSON.stringify([valid, { ...valid, num_plazas_detectado: 2 }]),
        { headers: { 'content-type': 'application/json' } }),
    ]) {
      assert.equal(await cli.runAragonAuditCli({ reportDirectory: directory, checkedAt, fetchImpl },
        { log: () => {}, error: () => {} }), 1);
      for (const file of ['aragon-audit.json', 'calls.json', 'latest.json']) {
        assert.equal(await readFile(join(directory, file), 'utf8'), `${file} sentinel`);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
