import type { PlaceResolver } from '../geography.ts';
import type { PublicJob } from '../model.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import {
  canonicalUrlKey,
  dateFromSpanish,
  isRecentPublication,
  numericIdentifier,
  officialHttpsUrl,
  record,
  requiredText,
  sanitizedParagraphs,
} from './shared.ts';

/** A malformed record invalidates the complete source snapshot. */
export function adaptLanbideOffers(
  input: unknown,
  checkedAt: string,
  resolve: PlaceResolver,
): PublicJob[] {
  if (!Array.isArray(input)) throw new TypeError('Lanbide debe devolver un array');
  const seen = new Set<string>();
  const seenUrls = new Set<string>();
  const jobs: PublicJob[] = [];

  for (const raw of input) {
    const offer = record(raw, 'Lanbide');
    const externalId = numericIdentifier(offer.codigo, 'Lanbide', 12);
    if (seen.has(externalId)) throw new TypeError('Identidad Lanbide inválida o duplicada');
    seen.add(externalId);
    const sourceUrl = officialHttpsUrl(offer.url, 'web.lanbide.eus', 'Lanbide');
    const sourceUrlKey = canonicalUrlKey(sourceUrl);
    if (seenUrls.has(sourceUrlKey)) throw new TypeError('URL Lanbide duplicada');
    seenUrls.add(sourceUrlKey);
    const linkedIds = new URL(sourceUrl).searchParams.getAll('IDRG');
    if (linkedIds.length !== 1 || linkedIds[0] !== externalId) {
      throw new TypeError('URL Lanbide no corresponde al código');
    }

    requiredText(offer.pais, 'Lanbide');
    const publishedAt = dateFromSpanish(offer.fecPub, 'Lanbide');
    const title = requiredText(offer.desEmpleo, 'Lanbide');
    const paragraphs = sanitizedParagraphs(offer.desPuesto, 'Lanbide');
    const city = requiredText(offer.municipio, 'Lanbide');
    const province = canonicalSpanishProvince(requiredText(offer.provincia, 'Lanbide'));
    if (!province) throw new TypeError('Provincia Lanbide no autorizada');
    const location = resolve(city, province.name);

    if (!isRecentPublication(publishedAt, checkedAt)) continue;
    jobs.push({
      kind: 'job',
      sourceId: 'lanbide-euskadi',
      source: 'Lanbide',
      id: `LANBIDE-${externalId}`,
      title,
      employer: 'Oferta gestionada por Lanbide',
      city,
      province: province.name,
      region: province.region,
      category: 'otros',
      categoryLabel: 'Otros',
      regime: 'Oferta de empleo',
      places: null,
      paragraphs,
      sourceUrl,
      publishedAt,
      checkedAt,
      closingDate: null,
      salary: null,
      applicationRegistration: 'external_required',
      selection: null,
      location,
    });
  }
  return jobs;
}
