import test from 'node:test';
import assert from 'node:assert/strict';
import { createCountryRegistry, normalizeCompensation } from '../packages/domain/src/country-policy.ts';
import { spainPolicy } from '../packages/country-es/src/compensation.ts';

test('despacha un segundo país sintético sin modificar el núcleo', () => {
  const registry = createCountryRegistry([spainPolicy, {
    code: 'ZZ', version: 'fixture-1', annualize: () => ({
      minMinor: 100, maxMinor: null, currency: 'XXX', basis: 'gross',
      period: 'year', factor: 1, rounding: 'nearest_minor_unit',
    }),
  }]);
  const output = normalizeCompensation(registry, 'ZZ', null);
  assert.equal(output.countryCode, 'ZZ');
  assert.equal(output.policyVersion, 'fixture-1');
  assert.equal(output.annualSalary?.currency, 'XXX');
});
test('rechaza países duplicados o no configurados', () => {
  assert.throws(() => createCountryRegistry([spainPolicy, spainPolicy]), /duplicado/);
  assert.throws(() => normalizeCompensation(createCountryRegistry([spainPolicy]), 'XX', null), /no configurado/);
});
