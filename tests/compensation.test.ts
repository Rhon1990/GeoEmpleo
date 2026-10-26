import test from 'node:test';
import assert from 'node:assert/strict';
import type { Compensation } from '../packages/domain/src/model.ts';
import { spainPolicy } from '../packages/country-es/src/compensation.ts';

const salary = (patch: Partial<Compensation> = {}): Compensation => ({
  minMinor: 150000, maxMinor: 200000, currency: 'EUR',
  period: 'month', basis: 'gross', paymentsPerYear: null,
  hoursPerWeek: null, paidWeeksPerYear: null, ...patch,
});

test('anualiza según las pagas declaradas, sin imponer 14', () => {
  assert.equal(spainPolicy.annualize(salary({ paymentsPerYear: 12 }))?.minMinor, 1800000);
  assert.equal(spainPolicy.annualize(salary({ paymentsPerYear: 14 }))?.minMinor, 2100000);
});
test('preserva ausencia de salario y de pagas', () => {
  assert.equal(spainPolicy.annualize(null), null);
  assert.equal(spainPolicy.annualize(salary()), null);
  assert.equal(spainPolicy.annualize(salary({ minMinor: null, maxMinor: null })), null);
});
test('no convierte neto, base desconocida ni otra moneda', () => {
  for (const patch of [{ basis: 'net' }, { basis: 'unknown' }, { currency: 'USD' }] as const) {
    assert.equal(spainPolicy.annualize(salary(patch)), null);
  }
});
test('hora exige horas y semanas remuneradas explícitas', () => {
  const input = salary({ period: 'hour', minMinor: 1000, maxMinor: null, hoursPerWeek: 20 });
  assert.equal(spainPolicy.annualize(input), null);
  assert.equal(spainPolicy.annualize({ ...input, paidWeeksPerYear: 48 })?.minMinor, 960000);
});
test('el salario anual conserva el rango sin duplicar pagas', () => {
  const output = spainPolicy.annualize(salary({ period: 'year', paymentsPerYear: 14 }));
  assert.equal(output?.minMinor, 150000);
  assert.equal(output?.maxMinor, 200000);
  assert.equal(output?.factor, 1);
});
test('máximo conocido no inventa mínimo garantizado', () => {
  assert.equal(spainPolicy.annualize(salary({ period: 'year', minMinor: null }))?.minMinor, null);
});
test('rechaza rangos, importes y factores inválidos', () => {
  for (const input of [salary({ minMinor: 300000 }), salary({ minMinor: -1 }),
    salary({ minMinor: 1.5 }), salary({ paymentsPerYear: 0 }),
    salary({ hoursPerWeek: Number.NaN }), salary({ paidWeeksPerYear: -1 })]) {
    assert.throws(() => spainPolicy.annualize(input), RangeError);
  }
});
test('rechaza desbordamiento al convertir', () => {
  assert.throws(() => spainPolicy.annualize(salary({
    minMinor: Number.MAX_SAFE_INTEGER, maxMinor: null, paymentsPerYear: 14,
  })), RangeError);
});

test('redondea medio céntimo con factores decimales sin perder precisión', () => {
  const result = spainPolicy.annualize(salary({
    period: 'hour', minMinor: 1005, maxMinor: null,
    hoursPerWeek: 10.2, paidWeeksPerYear: 50.5,
  }));
  assert.equal(result?.minMinor, 517676);
  assert.equal(spainPolicy.annualize(salary({
    period: 'hour', minMinor: 10000000, maxMinor: null,
    hoursPerWeek: 1e-7, paidWeeksPerYear: 50,
  }))?.minMinor, 50);
  assert.equal(spainPolicy.annualize(salary({
    period: 'hour', minMinor: 1005, maxMinor: null,
    hoursPerWeek: 1e21, paidWeeksPerYear: 1e-21,
  }))?.minMinor, 1005);
});

test('rechaza factores compuestos fuera del rango representable', () => {
  for (const hoursPerWeek of [1e-200, 1e200]) {
    assert.throws(() => spainPolicy.annualize(salary({
      period: 'hour', minMinor: 0, maxMinor: null,
      hoursPerWeek, paidWeeksPerYear: hoursPerWeek,
    })), RangeError);
  }
});
