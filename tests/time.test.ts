import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUtcInstant } from '../packages/domain/src/time.ts';

test('parsea UTC con y sin milisegundos sin cambiar el instante', () => {
  assert.equal(parseUtcInstant('2026-10-14T10:00:00Z'), Date.UTC(2026, 9, 14, 10));
  assert.equal(parseUtcInstant('2026-10-14T10:00:00.001Z'), Date.UTC(2026, 9, 14, 10) + 1);
  assert.notEqual(parseUtcInstant('2024-02-29T00:00:00Z'), null);
});

test('rechaza calendario y formato UTC no canónicos', () => {
  for (const value of ['2026-02-29T00:00:00Z', '2026-02-30T00:00:00Z', '2026-10-14',
    '2026-10-14T10:00:00+00:00', '2026-10-14T10:00:60Z', '2026-10-14T10:00:00.1Z']) {
    assert.equal(parseUtcInstant(value), null);
  }
});
