import type { PublicJob } from '../model.ts';
import { htmlToParagraphs } from '../normalize.ts';
import { fetchHtml } from '../http.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import type { CityResolver } from './bizneo.ts';
import { approximateMunicipalNote } from './shared.ts';
import { attribute, descendants, documentOf, innerHtml, textOf } from './html-dom.ts';

export const diaListingUrl = 'https://empleo.dia.es/jobs';
const diaHost = 'empleo.dia.es';
const pageSize = 20;
const maxJobs = 500;
const maxPages = Math.ceil(maxJobs / pageSize);

export interface TeamtailorOffer {
  readonly url: string;
  readonly title: string;
}

async function fetchTurboStream(url: string, fetchImpl: typeof fetch): Promise<string> {
  const address = new URL(url);
  if (address.protocol !== 'https:' || address.hostname !== diaHost || address.port || address.username || address.password) {
    throw new TypeError('URL de paginación DIA no autorizada');
  }
  const response = await fetchImpl(address, {
    headers: { accept: 'text/vnd.turbo-stream.html' }, redirect: 'error', signal: AbortSignal.timeout(40_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.toLowerCase().includes('turbo-stream')) {
    throw new TypeError('DIA no devolvió el formato incremental esperado');
  }
  const html = await response.text();
  if (html.length > 2_000_000) throw new TypeError('Respuesta de paginación DIA demasiado grande');
  return html;
}

function cityFromTitle(title: string, resolveCity: CityResolver) {
  let normalized = title.replace(/\s+/g, ' ').trim();
  let provinceHint: string | undefined;
  const provinceSuffix = /\s*(?:\(([^()]+)\)|,\s*([^,]+))\s*$/u.exec(normalized);
  const province = provinceSuffix ? canonicalSpanishProvince(provinceSuffix[1] ?? provinceSuffix[2] ?? '') : null;
  if (provinceSuffix && province) {
    provinceHint = province.name;
    normalized = normalized.slice(0, provinceSuffix.index).trim();
  }

  const cue = /\b(?:en|para|zona)\s+(.+)$/iu.exec(normalized);
  if (cue) {
    normalized = cue[1]!.trim();
  } else {
    const leadingProvince = /^([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s-]+?)\s+(?=[A-ZÁÉÍÓÚÜÑ])/u.exec(normalized);
    const provinceAtStart = leadingProvince ? canonicalSpanishProvince(leadingProvince[1]!.trim()) : null;
    if (provinceAtStart) {
      provinceHint ??= provinceAtStart.name;
      normalized = normalized.slice(leadingProvince![0].length).trim();
    }
  }

  normalized = normalized.replace(/\b\d+\s*(?:h|hrs?|horas?)\b/giu, ' ')
    .replace(/\bturnos?\s+(?:fijos|rotativos|de)\b.*$/iu, '')
    .replace(/\s+capital\b/iu, '').replace(/[,.\s]+$/u, '');
  const parts = normalized.split(/\s+/u);
  for (let start = 0; start < parts.length; start++) {
    const resolved = resolveCity(parts.slice(start).join(' '), provinceHint);
    if (resolved) return resolved;
  }
  if (!provinceHint && !cue) {
    const lastWord = parts.at(-1)?.replace(/[().,]/g, '');
    const lastProvince = lastWord ? canonicalSpanishProvince(lastWord) : null;
    if (lastProvince) return resolveCity(lastProvince.name, lastProvince.name);
  }
  return null;
}

function cityFromAddress(address: string, resolveCity: CityResolver) {
  if (/\b(?:área de trabajo|area de trabajo|tiendas ubicadas|provincia de|comunidad autónoma|sur de Madrid y área metropolitana)\b/i.test(address)) return null;
  const postalCity = /\b\d{5}\s+([\p{L}][\p{L} .'-]*)\s*$/u.exec(address)?.[1]?.trim();
  if (postalCity) {
    const province = canonicalSpanishProvince(postalCity);
    const resolved = resolveCity(postalCity, province?.name);
    if (resolved) return resolved;
  }
  const parenthesized = /^(.+?)\s*\(([^()]+)\)$/u.exec(address);
  const commaSeparated = /^(.+?),\s*([^,]+)$/u.exec(address);
  const suffix = parenthesized?.[2] ?? commaSeparated?.[2];
  const province = suffix ? canonicalSpanishProvince(suffix) : null;
  if (province) {
    const prefix = (parenthesized?.[1] ?? commaSeparated?.[1] ?? '').trim();
    const segments = prefix.split(/[,.]/u).map(value => value.trim()).filter(Boolean).reverse();
    for (const segment of segments) {
      const parts = segment.replace(/^(?:calle|c\/?|c\.|avenida|avda\.?|carretera|ctra\.?|plaza|paseo)\s+/iu, '')
        .replace(/\b(?:nº?|número)\s*\d+.*$/iu, '').split(/\s+/u);
      for (let start = 0; start < parts.length; start++) {
        const resolved = resolveCity(parts.slice(start).join(' '), province.name);
        if (resolved) return resolved;
      }
    }
    return resolveCity(province.name, province.name);
  }
  const clean = address.replace(/\s*\(\s*zona[^)]*\)\s*$/iu, '').replace(/\bcapital\b/iu, '').trim();
  const direct = resolveCity(clean);
  if (direct) return direct;
  const tokens = clean.replace(/\b(?:calle|c\/?|c\.|avenida|avda\.?|carretera|ctra\.?|plaza|paseo)\b/giu, ' ')
    .replace(/\b\d{5}\b/g, ' ').replace(/\b(?:nº?|número)\s*\d+.*$/iu, '').split(/\s+/u).filter(Boolean);
  for (let start = 0; start < tokens.length; start++) {
    const candidate = tokens.slice(start).join(' ');
    const provinceHint = canonicalSpanishProvince(candidate)?.name;
    const resolved = resolveCity(candidate, provinceHint);
    if (resolved) return resolved;
  }
  return null;
}

function validatedJobUrl(raw: string): string {
  const url = new URL(raw, diaListingUrl);
  if (url.protocol !== 'https:' || url.hostname !== diaHost || url.port || url.username || url.password ||
    !/^\/jobs\/\d+-[a-z0-9-]+$/i.test(url.pathname) || url.search || url.hash) {
    throw new TypeError('URL de oferta DIA no válida');
  }
  return url.href;
}

function listingDocuments(html: string): string[] {
  if (!html.includes('<turbo-stream')) return [html];
  const streams = [...html.matchAll(/<turbo-stream\b([^>]*)>([\s\S]*?)<\/turbo-stream>/gi)];
  if (!streams.length) throw new TypeError('Respuesta de paginación DIA inválida');
  const pages = streams.flatMap(([, attributes, content]) => {
    if (/\baction="update"/i.test(attributes ?? '') && /\btarget="show_more_button"/i.test(attributes ?? '')) return [];
    if (!/\baction="append"/i.test(attributes ?? '') || !/\btarget="jobs_list_container"/i.test(attributes ?? '')) {
      throw new TypeError('Destino de paginación DIA inesperado');
    }
    const template = /<template\b[^>]*>([\s\S]*?)<\/template>/i.exec(content ?? '')?.[1];
    if (!template) throw new TypeError('Plantilla de vacantes DIA ausente');
    return [template];
  });
  if (!pages.length) throw new TypeError('La página de vacantes DIA no contiene anuncios');
  return pages;
}

function offersFromDocument(html: string): TeamtailorOffer[] {
  const document = documentOf(html);
  const links = descendants(document, element => element.tagName === 'a' && attribute(element, 'data-turbo') === 'false');
  return links.flatMap(link => {
    const raw = attribute(link, 'href');
    if (!raw || !new URL(raw, diaListingUrl).pathname.startsWith('/jobs/')) return [];
    const title = textOf(link);
    if (!title) throw new TypeError('Oferta DIA sin título');
    return [{ url: validatedJobUrl(raw), title }];
  });
}

export function parseDiaListing(html: string): { offers: TeamtailorOffer[]; total: number } {
  const document = documentOf(html);
  const headings = descendants(document, element => element.tagName === 'h2');
  const total = headings.map(heading => /\b(\d+)\s+vacantes\b/i.exec(textOf(heading))?.[1]).find(Boolean);
  if (!total) throw new TypeError('Total de vacantes DIA ausente');
  const count = Number(total);
  if (!Number.isSafeInteger(count) || count < 1 || count > maxJobs) throw new TypeError('Total de vacantes DIA inesperado');
  const offers = offersFromDocument(html);
  if (offers.length === 0 || offers.length > pageSize) throw new TypeError('Primera página DIA inválida');
  return { offers, total: count };
}

export function parseDiaMorePage(html: string): TeamtailorOffer[] {
  const documents = listingDocuments(html);
  const offers = documents.flatMap(offersFromDocument);
  if (offers.length === 0 || offers.length > pageSize) throw new TypeError('Página DIA vacía o fuera de rango');
  return offers;
}

function fieldValue(document: ReturnType<typeof documentOf>, label: string): string | null {
  const term = descendants(document, element => element.tagName === 'dt' && textOf(element).toLocaleLowerCase('es-ES') === label.toLocaleLowerCase('es-ES'))[0];
  const parent = term?.parentNode;
  if (!term || !parent || !('childNodes' in parent)) return null;
  const siblings = parent.childNodes;
  const index = siblings.indexOf(term);
  for (const sibling of siblings.slice(index + 1)) {
    if (!('tagName' in sibling)) continue;
    if (sibling.tagName === 'dt') return null;
    if (sibling.tagName === 'dd') return textOf(sibling);
  }
  return null;
}

function jobPosting(document: ReturnType<typeof documentOf>): Record<string, unknown> {
  const scripts = descendants(document, element => element.tagName === 'script' && attribute(element, 'type') === 'application/ld+json');
  for (const script of scripts) {
    try {
      const parsed: unknown = JSON.parse(textOf(script));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as { '@type'?: unknown })['@type'] === 'JobPosting') {
        return parsed as Record<string, unknown>;
      }
    } catch { /* Ignore unrelated JSON-LD blocks. */ }
  }
  throw new TypeError('Ficha DIA sin datos JobPosting verificables');
}

export function adaptDiaDetail(offer: TeamtailorOffer, html: string, checkedAt: string, resolveCity: CityResolver): PublicJob {
  const document = documentOf(html);
  const posting = jobPosting(document);
  const heading = descendants(document, element => element.tagName === 'h1')[0];
  const id = /\/jobs\/(\d+)-/.exec(new URL(offer.url).pathname)?.[1];
  const identifier = posting.identifier as { value?: unknown } | undefined;
  const postedAt = typeof posting.datePosted === 'string' ? Date.parse(posting.datePosted) : Number.NaN;
  if (!id || identifier?.value !== id || !heading || textOf(heading) !== offer.title || posting.title !== offer.title ||
    !Number.isFinite(postedAt) || postedAt > Date.parse(checkedAt) + 86_400_000 || typeof posting.description !== 'string') {
    throw new TypeError('Ficha DIA no corresponde al anuncio del listado');
  }

  const descriptionBlock = descendants(document, element => element.tagName === 'div' &&
    (attribute(element, 'class') ?? '').split(/\s+/).includes('prose'))[0];
  const description = descriptionBlock ? htmlToParagraphs(innerHtml(descriptionBlock)) : [];
  if (!description.length) throw new TypeError('Descripción DIA vacía');
  const address = fieldValue(document, 'Dirección del puesto de trabajo');
  const validAddress = address && !/^(?:xxxx|n\/?a|sin especificar|no especificad[oa])$/i.test(address.trim()) ? address.trim() : null;
  const resolved = (validAddress ? cityFromAddress(validAddress, resolveCity) : null) ?? cityFromTitle(offer.title, resolveCity);
  const location = resolved?.location ? { ...resolved.location, note: approximateMunicipalNote } : null;
  const employment = typeof posting.employmentType === 'string' ? posting.employmentType : '';
  const regime = /REMOTE|TELECOMMUTE/i.test(employment) ? 'Remoto' : 'Oferta de empleo';
  const placesRaw = fieldValue(document, 'Número de plazas disponibles');
  const places = placesRaw && /^\d+$/.test(placesRaw) && Number(placesRaw) > 0 ? Number(placesRaw) : null;

  return {
    kind: 'job', sourceId: 'teamtailor-dia', source: 'DIA · portal de empleo',
    id: `TEAMTAILOR-DIA-${id}`, title: offer.title, employer: 'DIA',
    city: resolved?.city ?? validAddress ?? 'Sin verificar', province: resolved?.province ?? 'Sin verificar', region: resolved?.region ?? 'España',
    category: 'servicios', categoryLabel: 'Servicios y comercio', regime,
    places, paragraphs: description, sourceUrl: offer.url, publishedAt: new Date(postedAt).toISOString().slice(0, 10), checkedAt,
    closingDate: null, salary: null, applicationRegistration: 'external_required', selection: null, location,
  };
}

export async function fetchDiaOffers(checkedAt: string, resolveCity: CityResolver, fetchImpl: typeof fetch = fetch): Promise<PublicJob[]> {
  const firstPage = await fetchHtml(diaListingUrl, { fetchImpl });
  const { offers: firstOffers, total } = parseDiaListing(firstPage);
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount > maxPages || firstOffers.length !== Math.min(pageSize, total)) throw new TypeError('Primera página DIA incompleta');

  const offers = [...firstOffers];
  for (let page = 2; page <= pageCount; page++) {
    const url = new URL(`/jobs/show_more?page=${page}`, diaListingUrl);
    const pageOffers = parseDiaMorePage(await fetchTurboStream(url.href, fetchImpl));
    if (pageOffers.length !== Math.min(pageSize, total - offers.length)) throw new TypeError('Página DIA incompleta');
    offers.push(...pageOffers);
  }
  const urls = new Set(offers.map(offer => offer.url));
  if (offers.length !== total || urls.size !== total) throw new TypeError('Captura DIA incompleta o duplicada');

  const jobs: PublicJob[] = [];
  for (let index = 0; index < offers.length; index += 5) {
    jobs.push(...await Promise.all(offers.slice(index, index + 5).map(async offer =>
      adaptDiaDetail(offer, await fetchHtml(offer.url, { fetchImpl }), checkedAt, resolveCity))));
  }
  if (jobs.length !== total) throw new TypeError('Detalles DIA incompletos');
  return jobs;
}
