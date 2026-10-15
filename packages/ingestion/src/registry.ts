import type { SourceDefinition } from './model.ts';

const definitions: readonly SourceDefinition[] = [
  {
    id: 'sef-murcia',
    name: 'SEF Murcia',
    countryCode: 'ES',
    kind: 'open_data',
    status: 'active',
    endpoint: 'https://sefapps.carm.es/sefApps/rest/ofertas/ofertas',
    licenseUrl: 'https://datosabiertos.regiondemurcia.es/avisolegal',
  },
  {
    id: 'infojobs',
    name: 'InfoJobs',
    countryCode: 'ES',
    kind: 'partner_api',
    status: 'credentials_required',
    endpoint: 'https://api.infojobs.net/api/1/offer',
    licenseUrl: 'https://developer.infojobs.net/',
  },
  {
    id: 'adzuna-es',
    name: 'Adzuna España',
    countryCode: 'ES',
    kind: 'partner_api',
    status: 'credentials_required',
    endpoint: 'https://api.adzuna.com/v1/api/jobs/es/search/1',
    licenseUrl: 'https://developer.adzuna.com/',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    countryCode: 'ES',
    kind: 'agreement',
    status: 'authorization_required',
    endpoint: null,
    licenseUrl: 'https://learn.microsoft.com/en-us/linkedin/talent/',
  },
];

export const sourceRegistry: ReadonlyMap<string, Readonly<SourceDefinition>> = new Map(
  definitions.map((source) => [source.id, Object.freeze({ ...source })]),
);
