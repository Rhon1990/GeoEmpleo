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

function convert(amount: number | null, factor: number): number | null {
  if (amount === null) return null;
  const result = Math.round(amount * factor);
  if (!Number.isSafeInteger(result)) throw new RangeError('Importe anual fuera de rango');
  return result;
}

function annualize(input: Compensation | null): AnnualSalary | null {
  if (input === null) return null;
  validate(input);
  if (input.basis !== 'gross' || input.currency !== 'EUR') return null;
  if (input.minMinor === null && input.maxMinor === null) return null;
  let factor: number;
  switch (input.period) {
    case 'year': factor = 1; break;
    case 'month':
      if (input.paymentsPerYear === null) return null;
      factor = input.paymentsPerYear;
      break;
    case 'hour':
      if (input.hoursPerWeek === null || input.paidWeeksPerYear === null) return null;
      factor = input.hoursPerWeek * input.paidWeeksPerYear;
      break;
  }
  return {
    minMinor: convert(input.minMinor, factor), maxMinor: convert(input.maxMinor, factor),
    currency: input.currency, basis: 'gross', period: 'year', factor,
    rounding: 'nearest_minor_unit',
  };
}

export const spainPolicy: CountryPolicy = { code: 'ES', version: '1.0.0', annualize };
