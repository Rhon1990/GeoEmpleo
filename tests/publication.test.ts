import test from 'node:test';
import assert from 'node:assert/strict';
import type { PublicationCandidate } from '../packages/domain/src/model.ts';
import { publicationDecision } from '../packages/domain/src/publication.ts';

const now = new Date('2026-10-14T10:00:00.000Z');
const candidate: PublicationCandidate = {
  id: 'fixture-1', sourceId: 'fixture-source', title: 'Operario/a',
  descriptionText: 'Descripción completa de ejemplo propio.',
  status: 'active', expiresAt: null,
};
const policy = { sourceId: 'fixture-source', allowsFullDescription: true };

test('publica una ficha completa activa con permiso y sin cuenta', () => {
  assert.deepEqual(publicationDecision(candidate, policy, now), { publish: true });
});
test('no confunde política de otra fuente con permiso de publicación', () => {
  assert.deepEqual(publicationDecision(candidate, { ...policy, sourceId: 'otra' }, now),
    { publish: false, reason: 'source_mismatch' });
});
test('bloquea descripción sin permiso', () => {
  assert.deepEqual(publicationDecision(candidate, { ...policy, allowsFullDescription: false }, now),
    { publish: false, reason: 'permission_missing' });
});
test('bloquea título o descripción vacíos', () => {
  for (const patch of [{ title: ' ' }, { descriptionText: ' ' }]) {
    assert.deepEqual(publicationDecision({ ...candidate, ...patch }, policy, now),
      { publish: false, reason: 'incomplete' });
  }
});
test('no publica estado cerrado ni desconocido', () => {
  for (const status of ['closed', 'unknown'] as const) {
    assert.deepEqual(publicationDecision({ ...candidate, status }, policy, now),
      { publish: false, reason: 'inactive' });
  }
});
test('bloquea expiración inválida o sin hora normalizada', () => {
  for (const expiresAt of ['incorrecta', '2026-10-14', '2026-02-30T10:00:00.000Z']) {
    assert.deepEqual(publicationDecision({ ...candidate, expiresAt }, policy, now),
      { publish: false, reason: 'invalid_expiry' });
  }
});
test('cierra exactamente en el instante de expiración', () => {
  assert.deepEqual(publicationDecision({ ...candidate, expiresAt: now.toISOString() }, policy, now),
    { publish: false, reason: 'expired' });
});
test('permite vencimiento futuro y rechaza reloj inválido', () => {
  assert.deepEqual(publicationDecision({ ...candidate, expiresAt: '2026-10-15T10:00:00.000Z' }, policy, now),
    { publish: true });
  assert.deepEqual(publicationDecision({ ...candidate, expiresAt: '2026-10-15T10:00:00Z' }, policy, now),
    { publish: true });
  assert.throws(() => publicationDecision(candidate, policy, new Date('invalid')), RangeError);
});
