export type SourceStatus =
  | 'candidate'
  | 'credentials_required'
  | 'authorization_required'
  | 'active'
  | 'paused'
  | 'retired';

export interface SourceDefinition {
  id: string;
  name: string;
  countryCode: 'ES';
  kind: 'open_data' | 'partner_api' | 'ats' | 'agreement';
  status: SourceStatus;
  endpoint: string | null;
  licenseUrl: string | null;
}

export interface PointLocation {
  point: [number, number];
  precision: 'municipality';
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  note: string;
}

export interface PublicJob {
  kind: 'public_call' | 'job';
  sourceId: string;
  source: string;
  id: string;
  title: string;
  employer: string;
  city: string;
  province: string;
  region: string;
  category: string;
  categoryLabel: string;
  regime: string;
  places: number | null;
  paragraphs: string[];
  sourceUrl: string;
  publishedAt: string;
  /** 'observed' means the board does not publish a full date; publishedAt is first seen by GeoEmpleo. */
  dateKind?: 'observed';
  checkedAt: string;
  closingDate: string | null;
  salary: null;
  applicationRegistration: 'unknown' | 'external_required';
  selection: string | null;
  location: PointLocation | null;
}

export interface PublicCatalog {
  checkedAt: string;
  publishedAt: string | null;
  mode: 'verified_snapshot' | 'daily_sources';
  sourceConditions: string;
  calls: PublicJob[];
}
