import test from 'node:test';
import assert from 'node:assert/strict';
import { selectableTerritories } from '../apps/web-preview/public/territories.mjs';

test('omits the country label from selectable territories while keeping regional filters', () => {
  assert.deepEqual(selectableTerritories(['España', 'Castilla y León', 'Comunidad de Madrid']), [
    'Castilla y León',
    'Comunidad de Madrid',
  ]);
});

test('omits a country-wide URL value from the selector options', () => {
  assert.deepEqual(selectableTerritories(['España']), []);
});
