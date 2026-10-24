import type { PlaceResolver } from '../geography.ts';
import type { PublicJob } from '../model.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import { record, requiredText, sanitizedParagraphs } from './shared.ts';

export interface LeverBoard {
  readonly sourceId: string;
  readonly boardToken: string;
  readonly employer: string;
  readonly allowUnqualifiedSpanishLocation?: boolean;
}

export const leverBoards: readonly LeverBoard[] = [
  { sourceId: 'lever-jobandtalent', boardToken: 'jobandtalent', employer: 'Job&Talent' },
  { sourceId: 'lever-skydance', boardToken: 'skydance', employer: 'Skydance Animation Madrid', allowUnqualifiedSpanishLocation: true },
];

function spanishLocation(label: string, board: LeverBoard) {
  const parts = label.split(',').map(part => part.trim()).filter(Boolean);
  const country = parts.at(-1);
  if (country !== 'ES' && !(board.allowUnqualifiedSpanishLocation && parts.length === 1)) return null;
  const rawCity = parts[0]?.replace(/\s+HQ$/i, '').trim() ?? '';
  const province = canonicalSpanishProvince(parts.length >= 3 ? parts[1]! : rawCity);
  if (!rawCity || !province) return null;
  return { city: rawCity, province };
}

/** Only currently published Lever postings are returned by its public Postings API. */
export function adaptLeverOffers(
  input: unknown,
  checkedAt: string,
  resolve: PlaceResolver,
  board: LeverBoard,
): PublicJob[] {
  if (!Array.isArray(input)) throw new TypeError('Tablón Lever inválido');
  const seen = new Set<string>();
  const jobs: PublicJob[] = [];
  for (const value of input) {
    const offer = record(value, 'Lever');
    const id = requiredText(offer.id, 'Lever');
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || seen.has(id)) {
      throw new TypeError('Identidad Lever inválida o duplicada');
    }
    seen.add(id);
    const expectedUrl = `https://jobs.lever.co/${board.boardToken}/${id}`;
    if (offer.hostedUrl !== expectedUrl) throw new TypeError('URL Lever no corresponde a la publicación');
    const categories = record(offer.categories, 'categorías Lever');
    const locationLabel = requiredText(categories.location, 'ubicación Lever');
    const location = spanishLocation(locationLabel, board);
    if (!location) continue;
    const allLocations = categories.allLocations;
    if (allLocations !== undefined && (!Array.isArray(allLocations) || !allLocations.every(item => typeof item === 'string'))) {
      throw new TypeError('Localidades Lever inválidas');
    }
    const createdAt = offer.createdAt;
    if (typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt <= 0
      || createdAt > Date.parse(checkedAt) + 86_400_000) throw new TypeError('Fecha Lever inválida');
    const texts = [offer.descriptionPlain];
    if (Array.isArray(offer.lists)) {
      for (const item of offer.lists) {
        const list = record(item, 'detalle Lever');
        texts.push(list.text, list.content);
      }
    }
    const paragraphs = texts.flatMap(text => typeof text === 'string' && text.trim()
      ? sanitizedParagraphs(text, 'Lever') : []);
    if (paragraphs.length === 0) throw new TypeError('Descripción Lever vacía');
    const multipleLocations = Array.isArray(allLocations) && allLocations.length !== 1;
    const remote = offer.workplaceType === 'remote';
    if (multipleLocations) paragraphs.unshift(`Otras ubicaciones declaradas: ${allLocations.join(' · ')}`);
    jobs.push({
      kind: 'job', sourceId: board.sourceId, source: `${board.employer} · Lever`,
      id: `LEVER-${board.boardToken.toUpperCase()}-${id}`, title: requiredText(offer.text, 'título Lever'),
      employer: board.employer, city: location.city, province: location.province.name,
      region: location.province.region, category: 'otros', categoryLabel: 'Otros',
      regime: remote ? 'Remoto' : offer.workplaceType === 'hybrid' ? 'Híbrido' : 'Oferta de empleo',
      places: null, paragraphs, sourceUrl: expectedUrl,
      publishedAt: new Date(createdAt).toISOString().slice(0, 10), checkedAt,
      closingDate: null, salary: null, applicationRegistration: 'external_required',
      selection: null,
      location: remote || multipleLocations ? null : resolve(location.city, location.province.name),
    });
  }
  return jobs;
}
