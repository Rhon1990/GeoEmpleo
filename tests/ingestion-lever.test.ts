import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { adaptLeverOffers } from '../packages/ingestion/src/connectors/lever.ts';
import { runDaily } from '../packages/ingestion/src/runner.ts';

const checkedAt = '2026-10-24T12:00:00.000Z';
const id = '268aa722-9857-4994-b26b-677c60b63664';
const board = { sourceId: 'lever-jobandtalent', boardToken: 'jobandtalent', employer: 'Job&Talent' };
const offer = {
  id, text: 'Especialista de operaciones', createdAt: 1_783_000_000_000,
  hostedUrl: `https://jobs.lever.co/jobandtalent/${id}`,
  workplaceType: 'hybrid',
  categories: { location: 'Madrid HQ, ES', allLocations: ['Madrid HQ, ES'], commitment: 'Permanent' },
  descriptionPlain: 'Oferta vigente publicada por la empresa.',
  lists: [{ text: 'Requisitos', content: '<ul><li>Experiencia en operaciones</li></ul>' }],
};

test('Lever publica una oferta empresarial y marca solo una localidad española comprobada', () => {
  const calls: string[] = [];
  const jobs = adaptLeverOffers([offer], checkedAt, (city, province) => {
    calls.push(`${city}/${province}`);
    return { point: [-3.7, 40.4], precision: 'municipality', sourceUrl: 'https://example.org/place', sourceUpdatedAt: null, note: 'municipal' };
  }, board);
  assert.equal(jobs.length, 1);
  assert.deepEqual(calls, ['Madrid/Madrid']);
  assert.equal(jobs[0]?.sourceId, board.sourceId);
  assert.equal(jobs[0]?.employer, board.employer);
  assert.equal(jobs[0]?.sourceUrl, offer.hostedUrl);
  assert.equal(jobs[0]?.location?.point[0], -3.7);
  assert.match(jobs[0]?.paragraphs.join(' ') ?? '', /Experiencia en operaciones/);
  assert.equal(jobs[0]?.salary, null);
});

test('Lever no coloca puntos en puestos remotos o de varias localidades', () => {
  const remote = { ...offer, workplaceType: 'remote' };
  const multi = { ...offer, id: 'bc3b0b89-b62c-49b9-8470-5f2a10dd4e1f', hostedUrl: 'https://jobs.lever.co/jobandtalent/bc3b0b89-b62c-49b9-8470-5f2a10dd4e1f', categories: { ...offer.categories, allLocations: ['Madrid HQ, ES', 'Barcelona, ES'] } };
  const jobs = adaptLeverOffers([remote, multi], checkedAt, () => { throw new Error('No debe geocodificar'); }, board);
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every(job => job.location === null));
});

test('Lever rechaza URLs ajenas y duplicados, e ignora destinos fuera de España', () => {
  assert.throws(() => adaptLeverOffers([offer, offer], checkedAt, () => null, board));
  assert.throws(() => adaptLeverOffers([{ ...offer, hostedUrl: `https://example.org/${id}` }], checkedAt, () => null, board));
  assert.deepEqual(adaptLeverOffers([{ ...offer, categories: { location: 'London, UK', allLocations: ['London, UK'] } }], checkedAt, () => null, board), []);
});

test('la ingesta de empresa conserva el catálogo ante una captura vacía', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'geoempleo-lever-'));
  try {
    const catalogPath = join(directory, 'catalog.json');
    const reportPath = join(directory, 'report.json');
    const nationalPlacesPath = join(directory, 'places.json.gz');
    await writeFile(catalogPath, JSON.stringify({ checkedAt, calls: [] }));
    await writeFile(nationalPlacesPath, gzipSync(JSON.stringify({ retrievedAt: '2026-10-24', license: 'test', places: [{ id: 'madrid', name: 'Madrid', province: 'Madrid', municipality: 'Madrid', latitude: 40.4, longitude: -3.7, sourceUrl: 'https://example.org/place', precision: 'locality' }] })));
    const options = { catalogPath, reportPath, nationalPlacesPath, placesPath: 'unused', checkedAt, sourceIds: [board.sourceId], fetchImpl: (async () => new Response(JSON.stringify([offer]), { headers: { 'content-type': 'application/json' } })) as typeof fetch };
    assert.equal((await runDaily(options)).status, 'success');
    const before = await readFile(catalogPath, 'utf8');
    assert.equal(JSON.parse(before).calls[0].location.point[0], -3.7);
    await assert.rejects(runDaily({ ...options, checkedAt: '2026-10-25T12:00:00.000Z', fetchImpl: (async () => new Response('[]', { headers: { 'content-type': 'application/json' } })) as typeof fetch }));
    assert.equal(await readFile(catalogPath, 'utf8'), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
