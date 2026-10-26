import type { PlaceResolver } from '../geography.ts';
import type { PublicJob } from '../model.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import {
  canonicalUrlKey,
  type CoordinateBounds,
  isRecentPublication,
  isoDate,
  numericIdentifier,
  officialHttpsUrl,
  publishedPoint,
  record,
  requiredText,
  sanitizedParagraphs,
} from './shared.ts';

// Prefiltro defensivo de centros municipales; no representa límites administrativos.
const provinceCentreBounds: Readonly<Record<string, CoordinateBounds>> = Object.freeze({
  'Ávila': { west: -5.8, south: 40.1, east: -4, north: 41.3 },
  Burgos: { west: -4.6, south: 41.4, east: -2.3, north: 43.3 },
  'León': { west: -7.1, south: 41.6, east: -4.4, north: 43.3 },
  Palencia: { west: -5.1, south: 41.7, east: -3.4, north: 43.1 },
  Salamanca: { west: -7, south: 40.2, east: -5, north: 41.4 },
  Segovia: { west: -4.8, south: 40.5, east: -3.2, north: 41.6 },
  Soria: { west: -3.7, south: 41, east: -1.7, north: 42.3 },
  Valladolid: { west: -5.35, south: 41, east: -3.8, north: 42.1 },
  Zamora: { west: -6.9, south: 41.1, east: -4.8, north: 42.4 },
});

// Evita atribuir un punto oficial a otro municipio cercano dentro de la misma provincia.
const maximumMunicipalityDistanceKm = 25;

function distanceKm(
  [leftLongitude, leftLatitude]: readonly [number, number],
  [rightLongitude, rightLatitude]: readonly [number, number],
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (rightLatitude - leftLatitude) * radians;
  const longitudeDelta = (rightLongitude - leftLongitude) * radians;
  const leftLatitudeRadians = leftLatitude * radians;
  const rightLatitudeRadians = rightLatitude * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitudeRadians) * Math.cos(rightLatitudeRadians)
      * Math.sin(longitudeDelta / 2) ** 2;
  const centralAngle = 2 * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(Math.max(0, 1 - haversine)),
  );
  return 6_371 * centralAngle;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es-ES').trim();
}

function officialProvince(value: unknown): string | null {
  const input = requiredText(value, 'ECYL');
  if (normalize(input) === 'otra') return null;
  const province = canonicalSpanishProvince(input);
  if (!province || province.region !== 'Castilla y León') {
    throw new TypeError('Provincia ECYL no autorizada');
  }
  return province.name;
}

function locality(offer: Record<string, unknown>): string | null {
  const candidate = offer.localidad_asset0;
  if (candidate === null || candidate === undefined || candidate === '') return null;
  if (typeof candidate !== 'string') throw new TypeError('Localidad ECYL inválida');
  return candidate.trim() || null;
}

function sourceUrl(value: unknown): string {
  const input = requiredText(value, 'ECYL');
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new TypeError('URL ECYL no autorizada');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new TypeError('URL ECYL no autorizada');
  }
  if (['gestorcontenidos.jcyl.es', 'datosabiertos.jcyl.es'].includes(url.hostname)
    && url.pathname.startsWith('/web/jcyl/Empleo/')) {
    url.hostname = 'empleo.jcyl.es';
  }
  return officialHttpsUrl(url.href, 'empleo.jcyl.es', 'ECYL');
}

function isOfficialOfferPath(sourceUrl: string, externalId: string): boolean {
  return new URL(sourceUrl).pathname
    === `/web/jcyl/Empleo/es/Plantilla100Detalle/1284216458054/OfertasEmpleo/${externalId}/Empleo`;
}

/** A malformed record invalidates the complete source snapshot. */
export function adaptCylOffers(
  input: unknown,
  checkedAt: string,
  resolve: PlaceResolver,
): PublicJob[] {
  if (!Array.isArray(input)) throw new TypeError('ECYL debe devolver un array');
  const seen = new Set<string>();
  const seenUrls = new Set<string>();
  const jobs: PublicJob[] = [];

  for (const raw of input) {
    const offer = record(raw, 'ECYL');
    const externalId = numericIdentifier(offer.identificador, 'ECYL', 13);
    if (seen.has(externalId)) throw new TypeError('Identidad ECYL inválida o duplicada');
    seen.add(externalId);
    const canonicalSourceUrl = sourceUrl(offer.enlace_al_contenido);
    const sourceUrlKey = canonicalUrlKey(canonicalSourceUrl);
    if (seenUrls.has(sourceUrlKey)) throw new TypeError('URL ECYL duplicada');
    seenUrls.add(sourceUrlKey);
    if (!isOfficialOfferPath(canonicalSourceUrl, externalId)) {
      throw new TypeError('URL ECYL no corresponde al identificador');
    }

    const publishedAt = isoDate(offer.fecha_publicacion, 'ECYL');
    const province = officialProvince(offer.provincia);
    if (province === null) continue;
    const title = requiredText(offer.titulo, 'ECYL');
    const paragraphs = sanitizedParagraphs(offer.descripcion, 'ECYL');
    const city = locality(offer);
    if (city === null) continue;
    const sourceUpdatedAt = offer.actualizacionmetadatos == null
      ? null
      : isoDate(offer.actualizacionmetadatos, 'ECYL');
    const bounds = provinceCentreBounds[province];
    if (!bounds) throw new TypeError('Provincia ECYL sin límites validados');
    const officialLocation = publishedPoint(
      offer.geografico,
      canonicalSourceUrl,
      sourceUpdatedAt,
      bounds,
    );
    const municipalLocation = resolve(city, province);
    let location = municipalLocation;
    if (officialLocation !== null) {
      location = municipalLocation !== null
        && distanceKm(officialLocation.point, municipalLocation.point)
          <= maximumMunicipalityDistanceKm
        ? officialLocation
        : null;
    }

    if (!isRecentPublication(publishedAt, checkedAt)) continue;
    jobs.push({
      kind: 'job',
      sourceId: 'ecyl-castilla-leon',
      source: 'ECYL Castilla y León',
      id: `ECYL-${externalId}`,
      title,
      employer: 'Oferta publicada por ECYL',
      city,
      province,
      region: 'Castilla y León',
      category: 'otros',
      categoryLabel: 'Otros',
      regime: 'Oferta de empleo',
      places: null,
      paragraphs,
      sourceUrl: canonicalSourceUrl,
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
