import { createHash } from 'node:crypto';
import { dateInSpain } from '../normalize.ts';
import { canonicalUrlKey, dateFromSpanish, record, requiredText } from './shared.ts';

type Bulletin = 'BOA' | 'BOPZ' | 'BOPH' | 'BOPT';

/** Audit-only data. Feed dates/counts are machine estimates, not verified application terms. */
export interface AragonAuditCandidate {
  id: string;
  status: 'requires_bulletin_verification';
  title: string;
  employer: string;
  officialTitle: string;
  sourceUrl: string;
  sourceBulletin: Bulletin;
  reportedPublishedAt: string;
  reportedStartsAt: string;
  reportedClosingDate: string;
  reportedPlaces: number | null;
}

const positiveAnnouncement = /(?:\bconvocatoria\b|\bconvoca(?:n|da|do)?\b|proceso selectivo|pruebas selectivas|bases reguladoras|provisi[oó]n)/iu;
const negativeAnnouncement = /(?:desiert[oa]s?|nombramiento|\brecurso\b|relaci[oó]n (?:definitiva|provisional)|admitid|excluid|seleccionad|aprobaci[oó]n definitiva|expediente del concurso|constituci[oó]n de la bolsa|ordenanza|tasa fiscal|correcci[oó]n(?!.*convocatoria))/iu;

function normalized(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-ES');
}

function officialUrl(value: unknown): string {
  const original = requiredText(value, 'Aragón');
  let url: URL;
  try { url = new URL(original); }
  catch { throw new TypeError('URL Aragón no autorizada'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'www.boa.aragon.es'
    || url.port || url.username || url.password || url.pathname !== '/cgi-bin/EBOA/BRSCGI'
    || url.searchParams.get('CMD') !== 'VERDOC') {
    throw new TypeError('URL Aragón no autorizada');
  }
  // BOA's CGI is sensitive to parameter order: canonicalize only the identity key.
  return original.replace(/^http:/i, 'https:');
}

function bulletin(value: unknown): Bulletin {
  if (value !== 'BOA' && value !== 'BOPZ' && value !== 'BOPH' && value !== 'BOPT') {
    throw new TypeError('Boletín Aragón no autorizado');
  }
  return value;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? normalized(value) : null;
}

function reportedPlaces(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100_000
    ? value : null;
}

/** Selects audit candidates only; never verifies dates, vacancy counts or workplace locations. */
export function auditAragonOffers(input: unknown, checkedAt: string): AragonAuditCandidate[] {
  if (!Array.isArray(input)) throw new TypeError('Aragón debe devolver un array');
  if (input.length === 0) throw new TypeError('Captura Aragón vacía');
  if (input.length > 10_000) throw new TypeError('Captura Aragón excede el límite');
  const today = dateInSpain(checkedAt);
  const seen = new Map<string, string>();
  const candidates: AragonAuditCandidate[] = [];
  for (const raw of input) {
    const offer = record(raw, 'Aragón');
    if (offer.estado !== 'Abierta' || (offer.tipo !== 'Libre' && offer.tipo !== 'Libre+Interna')) continue;
    const title = requiredText(offer.denominacion, 'Aragón');
    const employer = requiredText(offer.organo_convocante, 'Aragón');
    const officialTitle = requiredText(offer.titulo, 'Aragón');
    const sourceUrl = officialUrl(offer.enlace);
    const sourceBulletin = bulletin(offer.fuente);
    const reportedPublishedAt = dateFromSpanish(offer.fecha_publicacion, 'Aragón');
    const reportedStartsAt = dateFromSpanish(offer.fecha_inicio_presentacion, 'Aragón');
    const reportedClosingDate = dateFromSpanish(offer.fecha_fin_presentacion, 'Aragón');
    if (reportedClosingDate < reportedStartsAt) throw new TypeError('Plazo Aragón inválido');
    const places = reportedPlaces(offer.num_plazas_detectado);
    const identity = JSON.stringify([
      canonicalUrlKey(sourceUrl), normalized(title), normalized(employer), normalized(officialTitle),
    ]);
    const id = `ARAGON-AUDIT-V1-${createHash('sha256').update(identity).digest('hex')}`;
    const material = JSON.stringify([
      reportedPublishedAt, reportedStartsAt, reportedClosingDate, places, offer.tipo, sourceBulletin,
      optionalText(offer.grupo), optionalText(offer.escala), optionalText(offer.plazo),
    ]);
    const previous = seen.get(id);
    if (previous !== undefined) {
      if (previous !== material) throw new TypeError('Identidad Aragón en conflicto');
      continue;
    }
    seen.set(id, material);
    if (reportedPublishedAt > today || reportedStartsAt > today || reportedClosingDate < today) continue;
    const semantics = `${officialTitle} ${title}`.normalize('NFKC');
    if (normalized(title) === 'no indicado' || !positiveAnnouncement.test(semantics)
      || negativeAnnouncement.test(semantics)) continue;
    candidates.push({ id, status: 'requires_bulletin_verification', title, employer, officialTitle,
      sourceUrl, sourceBulletin, reportedPublishedAt, reportedStartsAt, reportedClosingDate,
      reportedPlaces: places });
  }
  return candidates;
}
