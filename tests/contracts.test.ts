import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContract, type ContractName } from '../packages/contracts/src/validate.ts';

interface Fixture { name: string; contract: ContractName; valid: boolean; payload: unknown }
const fixtures: Fixture[] = JSON.parse(readFileSync(new URL('../packages/contracts/fixtures/v1.json', import.meta.url), 'utf8'));

for (const fixture of fixtures) {
  test(`contrato: ${fixture.name}`, () => {
    assert.equal(validateContract(fixture.contract, fixture.payload).valid, fixture.valid);
  });
}

test('la validación preserva entrada, null y ausencia de defaults', () => {
  const fixture = fixtures.find(item => item.contract === 'search-request' && item.valid)!;
  const before = structuredClone(fixture.payload);
  validateContract(fixture.contract, fixture.payload);
  assert.deepEqual(fixture.payload, before);
});

test('rechaza números no finitos y limita incidencias sin incluir valores', () => {
  const fixture = fixtures.find(item => item.contract === 'source-posting-event' && item.valid)!;
  const payload = structuredClone(fixture.payload) as { posting: { compensation: { minMinor: number } } };
  payload.posting.compensation.minMinor = Number.NaN;
  const result = validateContract(fixture.contract, payload);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.issues.length > 0 && result.issues.length <= 20);
    assert.ok(result.issues.every(issue => Object.keys(issue).sort().join(',') === 'code,path'));
  }
});
