export interface Compensation {
  minMinor: number | null;
  maxMinor: number | null;
  currency: string;
  period: 'hour' | 'month' | 'year';
  basis: 'gross' | 'net' | 'unknown';
  paymentsPerYear: number | null;
  hoursPerWeek: number | null;
  paidWeeksPerYear: number | null;
}

export interface AnnualSalary {
  minMinor: number | null;
  maxMinor: number | null;
  currency: string;
  basis: 'gross';
  period: 'year';
  factor: number;
  rounding: 'nearest_minor_unit';
}

export interface CountryPolicy {
  code: string;
  version: string;
  annualize(input: Compensation | null): AnnualSalary | null;
}

export interface PublicationCandidate {
  id: string;
  sourceId: string;
  title: string;
  descriptionText: string;
  status: 'active' | 'closed' | 'unknown';
  expiresAt: string | null;
}

export interface SourcePublicationPolicy {
  sourceId: string;
  allowsFullDescription: boolean;
}

export type PublicationDecision =
  | { publish: true }
  | { publish: false; reason:
      'source_mismatch' | 'permission_missing' | 'incomplete'
      | 'inactive' | 'invalid_expiry' | 'expired' };
