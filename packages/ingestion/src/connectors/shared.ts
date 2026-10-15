import type { PointLocation } from '../model.ts';
import { dateInSpain, htmlToParagraphs, spanishDate } from '../normalize.ts';

export const approximateMunicipalNote =
  'Ubicación municipal aproximada; no es la dirección exacta del puesto.';

export interface CoordinateBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export function record(value: unknown, source: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Registro ${source} inválido`);
  }
  return value as Record<string, unknown>;
}

export function requiredText(value: unknown, source: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Campo ${source} obligatorio ausente`);
  }
  return value.trim();
}

export function externalIdentifier(value: unknown, source: string): string {
  const identifier = requiredText(value, source);
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/.test(identifier)) {
    throw new TypeError(`Identidad ${source} inválida`);
  }
  return identifier;
}

export function officialHttpsUrl(value: unknown, hostname: string, source: string): string {
  let url: URL;
  try {
    url = new URL(requiredText(value, source));
  } catch {
    throw new TypeError(`URL ${source} no autorizada`);
  }
  if (url.protocol !== 'https:' || url.hostname !== hostname || url.username || url.password) {
    throw new TypeError(`URL ${source} no autorizada`);
  }
  return url.href;
}

function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function isoDate(value: unknown, source: string): string {
  const input = requiredText(value, source);
  const date = input.slice(0, 10);
  if (!validCalendarDate(date) || (input.length > 10 && !Number.isFinite(new Date(input).valueOf()))) {
    throw new TypeError(`Fecha ${source} inválida`);
  }
  return date;
}

export function dateFromSpanish(value: unknown, source: string): string {
  const date = spanishDate(requiredText(value, source));
  if (!date) throw new TypeError(`Fecha ${source} inválida`);
  return date;
}

export function isRecentPublication(
  publishedAt: string,
  checkedAt: string,
  maximumAgeDays = 30,
): boolean {
  const today = dateInSpain(checkedAt);
  const published = Date.parse(`${publishedAt}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  const oldest = current - maximumAgeDays * 24 * 60 * 60 * 1000;
  return published >= oldest && published <= current;
}

export function sanitizedParagraphs(value: unknown, source: string): string[] {
  const paragraphs = htmlToParagraphs(requiredText(value, source));
  if (!paragraphs.length) throw new TypeError(`Descripción ${source} vacía`);
  return paragraphs;
}

export function publishedPoint(
  value: unknown,
  sourceUrl: string,
  sourceUpdatedAt: string | null,
  bounds: CoordinateBounds,
): PointLocation | null {
  if (value === null || value === undefined) return null;
  const geography = record(value, 'geográfico ECYL');
  const longitude = geography.lon;
  const latitude = geography.lat;
  if (typeof longitude !== 'number' || typeof latitude !== 'number'
    || !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || longitude < bounds.west || longitude > bounds.east
    || latitude < bounds.south || latitude > bounds.north) {
    throw new TypeError('Geográfico ECYL fuera de su provincia');
  }
  return {
    point: [longitude, latitude],
    precision: 'municipality',
    sourceUrl,
    sourceUpdatedAt,
    note: approximateMunicipalNote,
  };
}
