import type { SourceDefinition } from './model.ts';
import { leverBoards } from './connectors/lever.ts';

const definitions: readonly SourceDefinition[] = [
  {
    id: 'aragon-empleo-publico', name: 'Gobierno de Aragón · Empleo público',
    countryCode: 'ES', kind: 'open_data', status: 'candidate',
    endpoint: 'https://opendata.aragon.es/GA_OD_Core/download?resource_id=309&formato=json',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    id: 'andalucia-entidades', name: 'Junta de Andalucía · Entidades instrumentales',
    countryCode: 'ES', kind: 'open_data', status: 'active',
    endpoint: 'https://datos.juntadeandalucia.es/api/v0/job-offering-public-sector/search?announcement_status=En%20curso&job_official_degree_requirements=-&announcement_type=-&provinces=-&job_agreement=-&order_by=id&mode=DESC&format=json&size=0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
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
    id: 'ecyl-castilla-leon',
    name: 'ECYL Castilla y León',
    countryCode: 'ES',
    kind: 'open_data',
    status: 'active',
    endpoint: 'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/ofertas-de-empleo/exports/json',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    id: 'lanbide-euskadi',
    name: 'Lanbide',
    countryCode: 'ES',
    kind: 'open_data',
    status: 'active',
    endpoint: 'https://apps.lanbide.euskadi.net/apps/OF_OFERTAS_ODE_JSON',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
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
    // 2026-10-15: account provides 25 trial calls; full access requires £8/month.
    // Paused under the user's zero-cost requirement, even when credentials exist.
    status: 'paused',
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
  ...leverBoards.map(board => ({
    id: board.sourceId,
    name: `${board.employer} · Lever`,
    countryCode: 'ES' as const,
    kind: 'ats' as const,
    status: 'active' as const,
    endpoint: `https://api.lever.co/v0/postings/${board.boardToken}?mode=json`,
    licenseUrl: 'https://github.com/lever/postings-api',
  })),
];

export interface SourceRegistry {
  readonly size: number;
  get(id: string): Readonly<SourceDefinition> | undefined;
  values(): IterableIterator<Readonly<SourceDefinition>>;
}

export function createSourceRegistry(
  sourceDefinitions: readonly Readonly<SourceDefinition>[],
): SourceRegistry {
  const sourceById = new Map<string, Readonly<SourceDefinition>>();
  for (const source of sourceDefinitions) {
    if (sourceById.has(source.id)) throw new Error(`Fuente duplicada: ${source.id}`);
    sourceById.set(source.id, Object.freeze({ ...source }));
  }

  return Object.freeze({
    size: sourceById.size,
    get: (id: string) => sourceById.get(id),
    values: () => sourceById.values(),
  });
}

export const sourceRegistry = createSourceRegistry(definitions);
