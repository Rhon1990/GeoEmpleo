import type { AnnualSalary, Compensation, CountryPolicy } from '../../domain/src/model.ts';

function validate(input: Compensation): void {
  for (const amount of [input.minMinor, input.maxMinor]) {
    if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) {
      throw new RangeError('Importe inválido en unidades menores');
    }
  }
  if (input.minMinor !== null && input.maxMinor !== null && input.minMinor > input.maxMinor) {
    throw new RangeError('Rango salarial invertido');
  }
  for (const factor of [input.paymentsPerYear, input.hoursPerWeek, input.paidWeeksPerYear]) {
    if (factor !== null && (!Number.isFinite(factor) || factor <= 0)) {
      throw new RangeError('Factor salarial inválido');
    }
  }
  if (input.paymentsPerYear !== null && !Number.isSafeInteger(input.paymentsPerYear)) {
    throw new RangeError('Número de pagas inválido');
  }
}

function decimalRatio(value: number): [bigint, bigint] {
  const [coefficient, exponent = '0'] = value.toString().split('e');
  const [integer, fraction = ''] = coefficient.split('.');
  const numerator = BigInt(integer + fraction);
  const scale = fraction.length - Number(exponent);
  return scale >= 0
    ? [numerator, 10n ** BigInt(scale)]
    : [numerator * 10n ** BigInt(-scale), 1n];
}

function convert(amount: number | null, factors: readonly number[]): number | null {
  if (amount === null) return null;
  let numerator = BigInt(amount);
  let denominator = 1n;
  for (const factor of factors) {
    const [factorNumerator, factorDenominator] = decimalRatio(factor);
    numerator *= factorNumerator;
    denominator *= factorDenominator;
  }
  // Redondeo de importes positivos al céntimo más próximo, con empate hacia arriba.
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Importe anual fuera de rango');
  return Number(rounded);
}

function annualize(input: Compensation | null): AnnualSalary | null {
  if (input === null) return null;
  validate(input);
  if (input.basis !== 'gross' || input.currency !== 'EUR') return null;
  if (input.minMinor === null && input.maxMinor === null) return null;
  let factors: readonly number[];
  switch (input.period) {
    case 'year': factors = [1]; break;
    case 'month':
      if (input.paymentsPerYear === null) return null;
      factors = [input.paymentsPerYear];
      break;
    case 'hour':
      if (input.hoursPerWeek === null || input.paidWeeksPerYear === null) return null;
      factors = [input.hoursPerWeek, input.paidWeeksPerYear];
      break;
  }
  const factor = factors.reduce((product, value) => product * value, 1);
  if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('Factor salarial fuera de rango');
  return {
    minMinor: convert(input.minMinor, factors), maxMinor: convert(input.maxMinor, factors),
    currency: input.currency, basis: 'gross', period: 'year', factor,
    rounding: 'nearest_minor_unit',
  };
}

export const spainPolicy: CountryPolicy = { code: 'ES', version: '1.0.0', annualize };
