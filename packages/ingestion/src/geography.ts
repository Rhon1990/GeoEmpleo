import type { PointLocation } from './model.ts';

export interface GazetteerPlace {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sourceUrl: string;
  readonly updatedAt: string;
}

export type PlaceResolver = (city: string, province?: string | null) => PointLocation | null;

const locationNote = 'Ubicación municipal aproximada; no es la dirección exacta del puesto.';

// INE, relación de municipios y códigos por provincias, provincia 30 (Murcia):
// https://www.ine.es/daco/daco42/codmun/codmunmapa.htm
const murciaMunicipalityNames = [
  'Abanilla',
  'Abarán',
  'Águilas',
  'Albudeite',
  'Alcantarilla',
  'Los Alcázares',
  'Aledo',
  'Alguazas',
  'Alhama de Murcia',
  'Archena',
  'Beniel',
  'Blanca',
  'Bullas',
  'Calasparra',
  'Campos del Río',
  'Caravaca de la Cruz',
  'Cartagena',
  'Cehegín',
  'Ceutí',
  'Cieza',
  'Fortuna',
  'Fuente Álamo de Murcia',
  'Jumilla',
  'Librilla',
  'Lorca',
  'Lorquí',
  'Mazarrón',
  'Molina de Segura',
  'Moratalla',
  'Mula',
  'Murcia',
  'Ojós',
  'Pliego',
  'Puerto Lumbreras',
  'Ricote',
  'San Javier',
  'San Pedro del Pinatar',
  'Santomera',
  'Torre-Pacheco',
  'Las Torres de Cotillas',
  'Totana',
  'Ulea',
  'La Unión',
  'Villanueva del Río Segura',
  'Yecla',
] as const;

// Prefiltro defensivo de los centros municipales de la Región de Murcia; no representa su límite administrativo.
const murciaCentreBounds = Object.freeze({
  west: -2.35,
  south: 37.35,
  east: -0.65,
  north: 38.8,
});

const postponedArticles = new Set(['el', 'la', 'los', 'las']);

function normalizePlaceName(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es-ES')
    .trim()
    .replace(/\s+/g, ' ');
  const comma = normalized.lastIndexOf(',');
  if (comma < 0) return normalized;

  const name = normalized.slice(0, comma).trim();
  const article = normalized.slice(comma + 1).trim();
  return name && postponedArticles.has(article) ? `${article} ${name}` : normalized;
}

const murciaMunicipalities = new Set(murciaMunicipalityNames.map(normalizePlaceName));

function hasValidCoordinates(place: GazetteerPlace): boolean {
  return Number.isFinite(place.longitude)
    && Number.isFinite(place.latitude)
    && place.longitude >= -180
    && place.longitude <= 180
    && place.latitude >= -90
    && place.latitude <= 90;
}

function isInsideMurciaCentreBounds(place: GazetteerPlace): boolean {
  return place.longitude >= murciaCentreBounds.west
    && place.longitude <= murciaCentreBounds.east
    && place.latitude >= murciaCentreBounds.south
    && place.latitude <= murciaCentreBounds.north;
}

export function createPlaceResolver(places: readonly GazetteerPlace[]): PlaceResolver {
  const byNormalizedName = new Map<string, GazetteerPlace[]>();

  for (const place of places) {
    if (!hasValidCoordinates(place) || !isInsideMurciaCentreBounds(place)) continue;

    const name = normalizePlaceName(place.name);
    if (!murciaMunicipalities.has(name)) continue;

    const matches = byNormalizedName.get(name);
    if (matches) matches.push(place);
    else byNormalizedName.set(name, [place]);
  }

  return (city, province) => {
    if (typeof city !== 'string' || normalizePlaceName(province ?? '') !== 'murcia') return null;

    const matches = byNormalizedName.get(normalizePlaceName(city));
    if (matches?.length !== 1) return null;

    const [place] = matches;
    return {
      point: [place.longitude, place.latitude],
      precision: 'municipality',
      sourceUrl: place.sourceUrl,
      sourceUpdatedAt: place.updatedAt,
      note: locationNote,
    };
  };
}
