import type { Compensation, CountryPolicy } from './model.ts';

export function createCountryRegistry(policies: readonly CountryPolicy[]): ReadonlyMap<string, CountryPolicy> {
  const registry = new Map<string, CountryPolicy>();
  for (const policy of policies) {
    if (registry.has(policy.code)) throw new Error(`País duplicado: ${policy.code}`);
    registry.set(policy.code, policy);
  }
  return registry;
}

export function normalizeCompensation(
  registry: ReadonlyMap<string, CountryPolicy>, countryCode: string, input: Compensation | null,
) {
  const policy = registry.get(countryCode);
  if (!policy) throw new Error(`País no configurado: ${countryCode}`);
  return { countryCode, policyVersion: policy.version, annualSalary: policy.annualize(input) };
}
