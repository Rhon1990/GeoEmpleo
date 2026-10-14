import { readFileSync } from 'node:fs';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { parseUtcInstant } from '../../domain/src/time.ts';
import { isHttpUrl } from './formats.ts';

export type ContractName = 'source-posting-event' | 'search-request' | 'job-detail' | 'job-list' | 'map-response' | 'problem';
export type ValidationResult = { valid: true } | { valid: false; issues: { path: string; code: string }[] };
export const contractNames: readonly ContractName[] = [
  'source-posting-event', 'search-request', 'job-detail', 'job-list', 'map-response', 'problem',
];

const ajv = new Ajv2020({
  strict: true, strictNumbers: true, allErrors: true,
  coerceTypes: false, removeAdditional: false, useDefaults: false,
  messages: false, verbose: false,
});
ajv.addFormat('date-time', { type: 'string', validate: value => parseUtcInstant(value) !== null });
ajv.addFormat('http-url', { type: 'string', validate: isHttpUrl });

for (const name of ['common', ...contractNames]) {
  const schema = JSON.parse(readFileSync(new URL(`../schemas/v1/${name}.schema.json`, import.meta.url), 'utf8'));
  ajv.addSchema(schema);
}

const validators = new Map<ContractName, ValidateFunction>();
for (const name of contractNames) {
  const validator = ajv.getSchema(`https://geoempleo.example/contracts/v1/${name}.schema.json`);
  if (!validator) throw new Error(`Contrato no disponible: ${name}`);
  validators.set(name, validator);
}

export function validateContract(name: ContractName, payload: unknown): ValidationResult {
  const validator = validators.get(name);
  if (!validator) throw new Error(`Contrato no admitido: ${name}`);
  if (validator(payload)) return { valid: true };
  return {
    valid: false,
    issues: (validator.errors ?? []).slice(0, 20).map(error => ({ path: error.instancePath, code: error.keyword })),
  };
}
