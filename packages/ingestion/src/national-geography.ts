import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import type { PlaceResolver } from './geography.ts';
import { approximateMunicipalNote } from './connectors/shared.ts';

const gunzipAsync = promisify(gunzip);
const postponedArticles = new Set(['a', 'as', 'el', 'la', 'los', 'las', 'o', 'os']);

export interface SpanishProvince {
  readonly name: string;
  readonly region: string;
}

export interface NationalGazetteerPlace {
  readonly id: string;
  readonly name: string;
  readonly aliases?: readonly string[] | null;
  readonly province: string;
  readonly municipality: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sourceUrl: string;
  readonly precision: 'locality' | 'postal_locality';
  readonly updatedAt?: string | null;
}

export interface NationalGazetteer {
  readonly retrievedAt: string;
  readonly license: string;
  readonly places: readonly NationalGazetteerPlace[];
}

function normalizePart(value: string): string {
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

function variants(value: string): Set<string> {
  const parts = value.split('/').map(normalizePart).filter(Boolean);
  const result = new Set(parts);
  if (parts.length > 1) result.add(parts.join('/'));
  return result;
}

const spanishProvinces = new Map<string, SpanishProvince>();

function registerProvince(name: string, region: string, ...aliases: string[]): void {
  const province = Object.freeze({ name, region });
  for (const alias of [name, ...aliases]) {
    for (const variant of variants(alias)) spanishProvinces.set(variant, province);
  }
}

registerProvince('A Coruña', 'Galicia', 'Coruña, A', 'La Coruña');
registerProvince('Álava', 'País Vasco', 'Araba', 'Araba/Álava');
registerProvince('Albacete', 'Castilla-La Mancha');
registerProvince('Alicante', 'Comunidad Valenciana', 'Alacant', 'Alicante/Alacant');
registerProvince('Almería', 'Andalucía');
registerProvince('Asturias', 'Principado de Asturias');
registerProvince('Ávila', 'Castilla y León');
registerProvince('Badajoz', 'Extremadura');
registerProvince('Barcelona', 'Cataluña');
registerProvince('Burgos', 'Castilla y León');
registerProvince('Cáceres', 'Extremadura');
registerProvince('Cádiz', 'Andalucía');
registerProvince('Cantabria', 'Cantabria');
registerProvince('Castellón', 'Comunidad Valenciana', 'Castelló', 'Castellón/Castelló');
registerProvince('Ceuta', 'Ciudad Autónoma de Ceuta');
registerProvince('Ciudad Real', 'Castilla-La Mancha');
registerProvince('Córdoba', 'Andalucía');
registerProvince('Cuenca', 'Castilla-La Mancha');
registerProvince('Girona', 'Cataluña', 'Gerona');
registerProvince('Granada', 'Andalucía');
registerProvince('Guadalajara', 'Castilla-La Mancha');
registerProvince('Guipúzcoa', 'País Vasco', 'Gipuzkoa');
registerProvince('Huelva', 'Andalucía');
registerProvince('Huesca', 'Aragón');
registerProvince('Illes Balears', 'Islas Baleares', 'Baleares', 'Islas Baleares');
registerProvince('Jaén', 'Andalucía');
registerProvince('La Rioja', 'La Rioja', 'Rioja, La');
registerProvince('Las Palmas', 'Canarias', 'Palmas, Las');
registerProvince('León', 'Castilla y León');
registerProvince('Lleida', 'Cataluña', 'Lérida');
registerProvince('Lugo', 'Galicia');
registerProvince('Madrid', 'Comunidad de Madrid');
registerProvince('Málaga', 'Andalucía');
registerProvince('Melilla', 'Ciudad Autónoma de Melilla');
registerProvince('Murcia', 'Región de Murcia');
registerProvince('Navarra', 'Comunidad Foral de Navarra');
registerProvince('Ourense', 'Galicia', 'Orense');
registerProvince('Palencia', 'Castilla y León');
registerProvince('Pontevedra', 'Galicia');
registerProvince('Salamanca', 'Castilla y León');
registerProvince('Santa Cruz de Tenerife', 'Canarias');
registerProvince('Segovia', 'Castilla y León');
registerProvince('Sevilla', 'Andalucía');
registerProvince('Soria', 'Castilla y León');
registerProvince('Tarragona', 'Cataluña');
registerProvince('Teruel', 'Aragón');
registerProvince('Toledo', 'Castilla-La Mancha');
registerProvince('Valencia', 'Comunidad Valenciana', 'València', 'Valencia/València');
registerProvince('Valladolid', 'Castilla y León');
registerProvince('Vizcaya', 'País Vasco', 'Bizkaia');
registerProvince('Zamora', 'Castilla y León');
registerProvince('Zaragoza', 'Aragón');

export function canonicalSpanishProvince(value: string): SpanishProvince | null {
  for (const candidate of variants(value)) {
    const province = spanishProvinces.get(candidate);
    if (province) return province;
  }
  return null;
}

function provinceKey(value: string): string {
  const province = canonicalSpanishProvince(value);
  if (province) return normalizePart(province.name);
  return normalizePart(value);
}

function hasValidCoordinates(place: NationalGazetteerPlace): boolean {
  return Number.isFinite(place.longitude)
    && Number.isFinite(place.latitude)
    && place.longitude >= -18.5
    && place.longitude <= 4.5
    && place.latitude >= 27.5
    && place.latitude <= 44.5;
}

function isGazetteerPlace(value: unknown): value is NationalGazetteerPlace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const place = value as Record<string, unknown>;
  return typeof place.id === 'string'
    && typeof place.name === 'string'
    && (place.aliases === undefined || place.aliases === null
      || (Array.isArray(place.aliases) && place.aliases.every((alias) => typeof alias === 'string')))
    && typeof place.province === 'string'
    && typeof place.municipality === 'string'
    && typeof place.latitude === 'number'
    && typeof place.longitude === 'number'
    && typeof place.sourceUrl === 'string'
    && (place.precision === 'locality' || place.precision === 'postal_locality')
    && (place.updatedAt === undefined || place.updatedAt === null || typeof place.updatedAt === 'string');
}

export async function loadNationalGazetteer(path: string | URL): Promise<NationalGazetteer> {
  let parsed: unknown;
  try {
    const compressed = await readFile(path);
    parsed = JSON.parse((await gunzipAsync(compressed)).toString('utf8'));
  } catch {
    throw new TypeError('Gazetteer nacional gzip inválido');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Gazetteer nacional inválido');
  }
  const gazetteer = parsed as Record<string, unknown>;
  if (typeof gazetteer.retrievedAt !== 'string'
    || typeof gazetteer.license !== 'string'
    || !Array.isArray(gazetteer.places)
    || !gazetteer.places.every(isGazetteerPlace)) {
    throw new TypeError('Esquema de gazetteer nacional inválido');
  }
  return {
    retrievedAt: gazetteer.retrievedAt,
    license: gazetteer.license,
    places: gazetteer.places,
  };
}

export function createNationalPlaceResolver(
  places: readonly NationalGazetteerPlace[],
): PlaceResolver {
  const indexed = new Map<string, Map<string, NationalGazetteerPlace>>();

  for (const place of places) {
    if (!hasValidCoordinates(place)) continue;
    const province = provinceKey(place.province);
    const names = [place.name, ...(place.aliases ?? [])];
    for (const name of names) {
      for (const variant of variants(name)) {
        const key = `${province}\u0000${variant}`;
        let matches = indexed.get(key);
        if (!matches) {
          matches = new Map();
          indexed.set(key, matches);
        }
        matches.set(place.id, place);
      }
    }
  }

  return (city, province) => {
    if (typeof city !== 'string' || typeof province !== 'string' || !province.trim()) return null;
    const matches = new Map<string, NationalGazetteerPlace>();
    const normalizedProvince = provinceKey(province);
    for (const cityVariant of variants(city)) {
      for (const [id, place] of indexed.get(`${normalizedProvince}\u0000${cityVariant}`) ?? []) {
        matches.set(id, place);
      }
    }
    const candidates = [...matches.values()];
    const localities = candidates.filter((place) => place.precision === 'locality');
    const preferred = localities.length ? localities : candidates;
    if (preferred.length !== 1) return null;
    const [place] = preferred;
    return {
      point: [place.longitude, place.latitude],
      precision: 'municipality',
      sourceUrl: place.sourceUrl,
      sourceUpdatedAt: place.updatedAt ?? null,
      note: approximateMunicipalNote,
    };
  };
}
