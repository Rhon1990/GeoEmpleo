# Ingesta pública diaria — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un runner diario modular que incorpore ofertas activas reales del SEF de Murcia al catálogo y al mapa, con geografía municipal verificada, actualización atómica y una base reutilizable para los demás conectores.

**Architecture:** `packages/ingestion` contiene contratos, registro de fuentes, normalización, resolución territorial y adaptadores sin dependencias del frontend. El CLI obtiene una captura completa, valida y sustituye únicamente la partición de esa fuente dentro de `calls.json`; un fallo conserva el catálogo anterior. La web admite ofertas con número de plazas desconocido y sigue consumiendo una única proyección estática.

**Tech Stack:** Node.js 24, TypeScript estricto con ejecución nativa, Fetch API, `node:test`, JSON y Google Maps JavaScript API existente.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/ingestion/src/model.ts` | Contratos de fuente, observación, oferta proyectada y ejecución |
| `packages/ingestion/src/registry.ts` | Registro inmutable y estados operativos por fuente |
| `packages/ingestion/src/normalize.ts` | Fechas españolas, texto HTML y categorías deterministas |
| `packages/ingestion/src/geography.ts` | Índice territorial y resolución municipio/provincia |
| `packages/ingestion/src/connectors/murcia.ts` | Adaptador puro del JSON del SEF Murcia |
| `packages/ingestion/src/catalog.ts` | Sustitución idempotente de una partición del catálogo |
| `packages/ingestion/src/http.ts` | GET JSON con timeout y límites de respuesta |
| `packages/ingestion/src/storage.ts` | Escritura JSON atómica e informe operativo |
| `packages/ingestion/src/cli.ts` | Orquestación diaria ejecutable |
| `tests/fixtures/ingestion/murcia.json` | Muestra contractual anonimizada desde la API pública |
| `tests/ingestion-*.test.ts` | Pruebas unitarias e integración del runner |
| `apps/web-preview/public/data/calls.json` | Proyección pública regenerada |
| `apps/web-preview/public/app.mjs` | Presentación honesta de plazas conocidas/desconocidas |

### Task 1: Contratos y registro de fuentes

**Files:**
- Create: `packages/ingestion/src/model.ts`
- Create: `packages/ingestion/src/registry.ts`
- Test: `tests/ingestion-registry.test.ts`

- [ ] **Step 1: Write the failing registry test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

test('el registro distingue fuentes activas y bloqueadas sin credenciales', () => {
  assert.equal(sourceRegistry.get('sef-murcia')?.status, 'active');
  assert.equal(sourceRegistry.get('infojobs')?.status, 'credentials_required');
  assert.equal(sourceRegistry.get('linkedin')?.status, 'authorization_required');
  assert.equal(sourceRegistry.get('sef-murcia')?.countryCode, 'ES');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/ingestion-registry.test.ts`

Expected: FAIL because `registry.ts` does not exist.

- [ ] **Step 3: Define the contracts**

```ts
// packages/ingestion/src/model.ts
export type SourceStatus = 'candidate'|'credentials_required'|'authorization_required'|'active'|'paused'|'retired';

export interface SourceDefinition {
  id: string;
  name: string;
  countryCode: 'ES';
  kind: 'open_data'|'partner_api'|'ats'|'agreement';
  status: SourceStatus;
  endpoint: string|null;
  licenseUrl: string|null;
}

export interface PointLocation {
  point: [number,number];
  precision: 'municipality';
  sourceUrl: string;
  sourceUpdatedAt: string|null;
  note: string;
}

export interface PublicJob {
  kind: 'public_call'|'job';
  sourceId: string;
  source: string;
  id: string;
  title: string;
  employer: string;
  city: string;
  province: string;
  region: string;
  category: string;
  categoryLabel: string;
  regime: string;
  places: number|null;
  paragraphs: string[];
  sourceUrl: string;
  publishedAt: string;
  checkedAt: string;
  closingDate: string|null;
  salary: null;
  applicationRegistration: 'unknown'|'external_required';
  selection: string|null;
  location: PointLocation|null;
}

export interface PublicCatalog {
  checkedAt: string;
  publishedAt: string|null;
  mode: 'verified_snapshot'|'daily_sources';
  sourceConditions: string;
  calls: PublicJob[];
}
```

- [ ] **Step 4: Add the immutable registry**

```ts
// packages/ingestion/src/registry.ts
import type {SourceDefinition} from './model.ts';

const definitions: SourceDefinition[] = [
  {id:'sef-murcia',name:'SEF Murcia',countryCode:'ES',kind:'open_data',status:'active',endpoint:'https://sefapps.carm.es/sefApps/rest/ofertas/ofertas',licenseUrl:'https://datosabiertos.regiondemurcia.es/avisolegal'},
  {id:'infojobs',name:'InfoJobs',countryCode:'ES',kind:'partner_api',status:'credentials_required',endpoint:'https://api.infojobs.net/api/1/offer',licenseUrl:'https://developer.infojobs.net/'},
  {id:'adzuna-es',name:'Adzuna España',countryCode:'ES',kind:'partner_api',status:'credentials_required',endpoint:'https://api.adzuna.com/v1/api/jobs/es/search/1',licenseUrl:'https://developer.adzuna.com/'},
  {id:'linkedin',name:'LinkedIn',countryCode:'ES',kind:'agreement',status:'authorization_required',endpoint:null,licenseUrl:'https://learn.microsoft.com/en-us/linkedin/talent/'},
];

export const sourceRegistry = new Map(definitions.map(source => [source.id,Object.freeze({...source})]));
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test tests/ingestion-registry.test.ts`

Expected: 1 test passes.

```bash
git add packages/ingestion/src/model.ts packages/ingestion/src/registry.ts tests/ingestion-registry.test.ts
git commit -m "feat: add ingestion source registry"
```

### Task 2: Normalización determinista

**Files:**
- Create: `packages/ingestion/src/normalize.ts`
- Test: `tests/ingestion-normalize.test.ts`

- [ ] **Step 1: Write tests for dates, HTML and category mapping**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryForSector,htmlToParagraphs,spanishDate} from '../packages/ingestion/src/normalize.ts';

test('convierte fechas españolas sin depender de locale del host', () => {
  assert.equal(spanishDate('15/10/2026'),'2026-10-15');
  assert.equal(spanishDate('31/02/2026'),null);
});

test('convierte HTML externo en párrafos de texto', () => {
  assert.deepEqual(htmlToParagraphs('<b>Funciones</b><BR/>Atención &amp; archivo.'),['Funciones','Atención & archivo.']);
});

test('clasifica sectores conocidos y conserva un fallback explícito', () => {
  assert.deepEqual(categoryForSector('TH'),{category:'hosteleria',label:'Turismo y hostelería'});
  assert.deepEqual(categoryForSector('ZZ'),{category:'otros',label:'Otros'});
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/ingestion-normalize.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure normalizers**

```ts
// packages/ingestion/src/normalize.ts
const entities: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};

export function spanishDate(value: string): string|null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(iso) ? iso : null;
}

export function htmlToParagraphs(value: string): string[] {
  const text = value
    .replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|li|div)>/gi,'\n')
    .replace(/<[^>]*>/g,'')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_,entity:string) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? `&${entity};`;
      const radix = entity[1].toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
      const code = Number.parseInt(digits,radix);
      return Number.isSafeInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    });
  return text.split(/\n+/).map(item => item.replace(/\s+/g,' ').trim()).filter(Boolean);
}

export function categoryForSector(code: string): {category:string;label:string} {
  const categories: Record<string,{category:string;label:string}> = {
    AO:{category:'administracion',label:'Administración'},
    IF:{category:'tecnologia',label:'Tecnología'},
    SA:{category:'sanidad',label:'Sanidad'},
    SP:{category:'cuidados',label:'Cuidados y servicios'},
    TC:{category:'transporte',label:'Transporte'},
    TH:{category:'hosteleria',label:'Turismo y hostelería'},
    MR:{category:'oficios',label:'Oficios técnicos'},
  };
  return categories[code] ?? {category:'otros',label:'Otros'};
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test tests/ingestion-normalize.test.ts`

Expected: 3 tests pass.

```bash
git add packages/ingestion/src/normalize.ts tests/ingestion-normalize.test.ts
git commit -m "feat: normalize external job data"
```

### Task 3: Resolución territorial verificable

**Files:**
- Create: `packages/ingestion/src/geography.ts`
- Test: `tests/ingestion-geography.test.ts`

- [ ] **Step 1: Write resolver tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaceResolver} from '../packages/ingestion/src/geography.ts';

const resolve = createPlaceResolver([
  {name:'Murcia',longitude:-1.13004,latitude:37.98704,sourceUrl:'https://www.geonames.org/2513416',updatedAt:'2025-01-01'},
  {name:'Los Alcázares',longitude:-0.85385,latitude:37.74425,sourceUrl:'https://www.geonames.org/2514868',updatedAt:'2025-01-01'},
]);

test('resuelve un municipio único sin distinguir tildes o formato invertido', () => {
  assert.deepEqual(resolve('ALCAZARES, LOS')?.point,[-0.85385,37.74425]);
});

test('no asigna coordenadas a una localidad desconocida', () => {
  assert.equal(resolve('LOCALIDAD INVENTADA'),null);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/ingestion-geography.test.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement indexed exact matching**

```ts
// packages/ingestion/src/geography.ts
import type {PointLocation} from './model.ts';

interface Place {name:string;longitude:number;latitude:number;sourceUrl:string;updatedAt:string|null}
const key = (value:string) => value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g,' ').trim();
const reorder = (value:string) => {
  const [name,article] = value.split(',').map(item => item.trim());
  return article ? `${article} ${name}` : name;
};

export function createPlaceResolver(places: Place[]) {
  const index = new Map<string,Place[]>();
  for (const place of places) {
    const placeKey = key(place.name);
    index.set(placeKey,[...(index.get(placeKey) ?? []),place]);
  }
  return (city:string): PointLocation|null => {
    const matches = index.get(key(reorder(city))) ?? [];
    if (matches.length !== 1) return null;
    const place = matches[0];
    return {point:[place.longitude,place.latitude],precision:'municipality',sourceUrl:place.sourceUrl,sourceUpdatedAt:place.updatedAt,note:'Punto representativo del municipio; no dirección del puesto'};
  };
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test tests/ingestion-geography.test.ts`

Expected: 2 tests pass.

```bash
git add packages/ingestion/src/geography.ts tests/ingestion-geography.test.ts
git commit -m "feat: resolve verified municipal locations"
```

### Task 4: Adaptador del SEF Murcia

**Files:**
- Create: `packages/ingestion/src/connectors/murcia.ts`
- Create: `tests/fixtures/ingestion/murcia.json`
- Test: `tests/ingestion-murcia.test.ts`

- [ ] **Step 1: Save a minimal real-source fixture**

Use the current records `142026005875` and `142026005858` from `https://sefapps.carm.es/sefApps/rest/ofertas/ofertas`. Keep their public identifiers, dates, municipality, description, detail URL and sector verbatim. Store only the first two public description paragraphs in `adicionales`, preserving the `<BR/>` and `<b>` constructs required by the parser; the fixture validates the contract and is not published as the catalog.

- [ ] **Step 2: Write the adapter test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adaptMurciaOffers} from '../packages/ingestion/src/connectors/murcia.ts';
import {createPlaceResolver} from '../packages/ingestion/src/geography.ts';

const input = JSON.parse(readFileSync(new URL('./fixtures/ingestion/murcia.json',import.meta.url),'utf8'));
const resolve = createPlaceResolver([{name:'Cieza',longitude:-1.4206,latitude:38.23998,sourceUrl:'https://www.geonames.org/2519466',updatedAt:null}]);

test('adapta ofertas activas sin inventar empresa, plazas o salario', () => {
  const jobs = adaptMurciaOffers(input,'2026-10-15T05:30:00Z',resolve);
  const job = jobs.find(item => item.id === 'SEF-MURCIA-142026005875');
  assert.equal(job?.employer,'Oferta gestionada por SEF Murcia');
  assert.equal(job?.places,null);
  assert.equal(job?.salary,null);
  assert.equal(job?.closingDate,'2026-10-26');
  assert.deepEqual(job?.location?.point,[-1.4206,38.23998]);
  assert.ok(job?.paragraphs.some(paragraph => paragraph.includes('mantenimiento')));
});
```

- [ ] **Step 3: Run test and verify RED**

Run: `node --test tests/ingestion-murcia.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Implement the adapter**

```ts
// packages/ingestion/src/connectors/murcia.ts
import type {PointLocation,PublicJob} from '../model.ts';
import {categoryForSector,htmlToParagraphs,spanishDate} from '../normalize.ts';

interface MurciaOffer {numeroOferta:string;fechaDeInicio:string;fechaDeFin:string;municipio:{municipio:string;provincia:{provincia:string}};descripcion:string;adicionales:string;urlDetalles:string;sectorProfesional:{id:string}}
type Resolver = (city:string) => PointLocation|null;

export function adaptMurciaOffers(input: unknown,checkedAt:string,resolve:Resolver): PublicJob[] {
  if (!Array.isArray(input)) throw new TypeError('SEF Murcia debe devolver un array');
  return input.map((raw):PublicJob => {
    const offer = raw as MurciaOffer;
    const publishedAt = spanishDate(offer.fechaDeInicio);
    const closingDate = spanishDate(offer.fechaDeFin);
    if (!offer.numeroOferta || !publishedAt || !closingDate || !offer.descripcion || !offer.urlDetalles) throw new TypeError('Oferta SEF Murcia incompleta');
    const city = offer.municipio.municipio;
    const province = offer.municipio.provincia.provincia;
    const resolved = resolve(city);
    const category = categoryForSector(offer.sectorProfesional?.id ?? '');
    return {kind:'job',sourceId:'sef-murcia',source:'SEF Murcia',id:`SEF-MURCIA-${offer.numeroOferta}`,title:offer.descripcion.trim(),employer:'Oferta gestionada por SEF Murcia',city,province,region:'Región de Murcia',category:category.category,categoryLabel:category.label,regime:'Oferta de empleo',places:null,paragraphs:htmlToParagraphs(offer.adicionales),sourceUrl:offer.urlDetalles,publishedAt,checkedAt,closingDate,salary:null,applicationRegistration:'external_required',selection:null,location:resolved};
  });
}
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test tests/ingestion-murcia.test.ts`

Expected: 1 test passes.

```bash
git add packages/ingestion/src/connectors/murcia.ts tests/fixtures/ingestion/murcia.json tests/ingestion-murcia.test.ts
git commit -m "feat: ingest active Murcia jobs"
```

### Task 5: Actualización idempotente y atómica del catálogo

**Files:**
- Create: `packages/ingestion/src/catalog.ts`
- Create: `packages/ingestion/src/storage.ts`
- Test: `tests/ingestion-catalog.test.ts`

- [ ] **Step 1: Write replacement and persistence tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {replaceSourcePartition} from '../packages/ingestion/src/catalog.ts';
import {writeJsonAtomic} from '../packages/ingestion/src/storage.ts';

test('sustituye solo una fuente y es idempotente', () => {
  const current:any = {checkedAt:'old',publishedAt:null,mode:'daily_sources',sourceConditions:'x',calls:[{id:'BOE-1',sourceId:'boe'},{id:'SEF-OLD',sourceId:'sef-murcia'}]};
  const incoming:any = [{id:'SEF-NEW',sourceId:'sef-murcia',publishedAt:'2026-10-15'}];
  const once = replaceSourcePartition(current,'sef-murcia',incoming,'2026-10-15T05:30:00Z');
  const twice = replaceSourcePartition(once,'sef-murcia',incoming,'2026-10-15T05:30:00Z');
  assert.deepEqual(once,twice);
  assert.deepEqual(once.calls.map((job:any) => job.id),['BOE-1','SEF-NEW']);
});

test('escribe JSON mediante rename atómico', async () => {
  const directory = await mkdtemp(join(tmpdir(),'geoempleo-'));
  const target = join(directory,'catalog.json');
  await writeJsonAtomic(target,{ok:true});
  assert.deepEqual(JSON.parse(await readFile(target,'utf8')),{ok:true});
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/ingestion-catalog.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement partition replacement**

```ts
// packages/ingestion/src/catalog.ts
import type {PublicCatalog,PublicJob} from './model.ts';

export function replaceSourcePartition(catalog:PublicCatalog,sourceId:string,incoming:PublicJob[],checkedAt:string): PublicCatalog {
  const retained = catalog.calls.filter(job => job.sourceId !== sourceId);
  const calls = [...retained,...incoming].sort((a,b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
  return {...catalog,checkedAt,mode:'daily_sources',publishedAt:calls[0]?.publishedAt ?? null,calls};
}
```

- [ ] **Step 4: Implement atomic JSON writes**

```ts
// packages/ingestion/src/storage.ts
import {mkdir,rename,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

export async function writeJsonAtomic(path:string,value:unknown): Promise<void> {
  await mkdir(dirname(path),{recursive:true});
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',mode:0o644});
  await rename(temporary,path);
}
```

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test tests/ingestion-catalog.test.ts`

Expected: 2 tests pass.

```bash
git add packages/ingestion/src/catalog.ts packages/ingestion/src/storage.ts tests/ingestion-catalog.test.ts
git commit -m "feat: update source catalog atomically"
```

### Task 6: Cliente HTTP y CLI diario

**Files:**
- Create: `packages/ingestion/src/http.ts`
- Create: `packages/ingestion/src/cli.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `tests/ingestion-http.test.ts`

- [ ] **Step 1: Write HTTP boundary tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchJson} from '../packages/ingestion/src/http.ts';

test('rechaza respuestas no JSON y cuerpos excesivos', async () => {
  const fake = async () => new Response('texto',{status:200,headers:{'content-type':'text/plain'}});
  await assert.rejects(fetchJson('https://example.test',{fetchImpl:fake as typeof fetch}),/JSON/);
  const large = async () => new Response('x'.repeat(101),{status:200,headers:{'content-type':'application/json','content-length':'101'}});
  await assert.rejects(fetchJson('https://example.test',{fetchImpl:large as typeof fetch,maxBytes:100}),/tamaño/);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/ingestion-http.test.ts`

Expected: FAIL because `http.ts` does not exist.

- [ ] **Step 3: Implement bounded JSON fetching**

```ts
// packages/ingestion/src/http.ts
export async function fetchJson(url:string,options:{fetchImpl?:typeof fetch;timeoutMs?:number;maxBytes?:number}={}):Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxBytes = options.maxBytes ?? 8_000_000;
  const response = await fetchImpl(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.toLowerCase().includes('json')) throw new Error('La fuente no devolvió JSON');
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new Error('La respuesta supera el tamaño permitido');
  const text = await response.text();
  if (Buffer.byteLength(text,'utf8') > maxBytes) throw new Error('La respuesta supera el tamaño permitido');
  return JSON.parse(text);
}
```

- [ ] **Step 4: Add the CLI**

```ts
// packages/ingestion/src/cli.ts
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {adaptMurciaOffers} from './connectors/murcia.ts';
import {replaceSourcePartition} from './catalog.ts';
import {createPlaceResolver} from './geography.ts';
import {fetchJson} from './http.ts';
import {sourceRegistry} from './registry.ts';
import {writeJsonAtomic} from './storage.ts';
import type {PublicCatalog} from './model.ts';

const catalogPath = fileURLToPath(new URL('../../../apps/web-preview/public/data/calls.json',import.meta.url));
const placesPath = fileURLToPath(new URL('../../../apps/web-preview/public/data/places.json',import.meta.url));
const reportPath = fileURLToPath(new URL('../../../var/ingestion/latest.json',import.meta.url));
const source = sourceRegistry.get('sef-murcia');
if (!source?.endpoint || source.status !== 'active') throw new Error('SEF Murcia no está activo');
const checkedAt = new Date().toISOString();
const [catalogFile,placesFile,input] = await Promise.all([readFile(catalogPath,'utf8'),readFile(placesPath,'utf8'),fetchJson(source.endpoint)]);
const catalog = JSON.parse(catalogFile) as PublicCatalog;
const places = JSON.parse(placesFile).places;
const jobs = adaptMurciaOffers(input,checkedAt,createPlaceResolver(places));
if (jobs.length === 0) throw new Error('La captura completa no contiene ofertas; se conserva el catálogo anterior');
const next = replaceSourcePartition(catalog,source.id,jobs,checkedAt);
await writeJsonAtomic(catalogPath,next);
await writeJsonAtomic(reportPath,{checkedAt,sourceId:source.id,received:jobs.length,mapped:jobs.filter(job => job.location).length,published:next.calls.length});
console.log(`OK ${source.id}: ${jobs.length} ofertas, ${jobs.filter(job => job.location).length} con ubicación`);
```

- [ ] **Step 5: Register scripts and generated reports**

Add to `package.json`:

```json
"ingest:daily": "node packages/ingestion/src/cli.ts"
```

Add to `.gitignore`:

```gitignore
var/ingestion/
```

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test tests/ingestion-http.test.ts && npm run typecheck`

Expected: HTTP test passes and TypeScript exits 0.

```bash
git add packages/ingestion/src/http.ts packages/ingestion/src/cli.ts tests/ingestion-http.test.ts package.json .gitignore
git commit -m "feat: run bounded daily ingestion"
```

### Task 7: Catálogo y UI con plazas desconocidas

**Files:**
- Modify: `apps/web-preview/public/data/calls.json`
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/google-map.mjs`
- Modify: `tests/web-catalog.test.ts`

- [ ] **Step 1: Add `sourceId` to the four BOE records**

Each existing record receives:

```json
"sourceId": "boe"
```

- [ ] **Step 2: Write a failing UI-data test**

Append to `tests/web-catalog.test.ts`:

```ts
test('el catálogo admite ofertas reales sin número de plazas publicado', () => {
  const jobs = [{places:null},{places:2}];
  const known = jobs.reduce((sum,job) => sum + (job.places ?? 0),0);
  const unknown = jobs.filter(job => job.places == null).length;
  assert.equal(known,2);
  assert.equal(unknown,1);
});
```

- [ ] **Step 3: Make rendering null-safe**

In `app.mjs`, use these display helpers and totals:

```js
const placesLabel = call => call.places == null ? 'Plazas no publicadas' : `${call.places} ${call.places === 1 ? 'plaza' : 'plazas'}`;
// card/detail: replace direct `${call.places}` labels with placesLabel(call)
const knownPlaces = results.reduce((total,call) => total + (call.places ?? 0),0);
const unknownPlaces = results.filter(call => call.places == null).length;
document.querySelector('#result-summary').textContent = `${knownPlaces} plazas publicadas${unknownPlaces ? ` · ${unknownPlaces} ofertas sin número de plazas` : ''} · Consulta el plazo en cada anuncio`;
```

In `google-map.mjs`, set marker text with:

```js
pin.textContent = call.places == null ? 'Oferta' : `${call.places} ${call.places === 1 ? 'plaza' : 'plazas'}`;
```

- [ ] **Step 4: Run the real ingestion**

Run: `npm run ingest:daily`

Expected: output starts with `OK sef-murcia:`; `calls.json` contains more than four offers and every Murcia marker has a municipal `location.point` or an explicit `location: null`.

- [ ] **Step 5: Verify UI tests and commit the real catalog snapshot**

Run: `node --test tests/web-catalog.test.ts tests/web-geography.test.ts tests/web-map-state.test.ts`

Expected: all selected tests pass.

```bash
git add apps/web-preview/public/data/calls.json apps/web-preview/public/app.mjs apps/web-preview/public/google-map.mjs tests/web-catalog.test.ts
git commit -m "feat: show daily real jobs on the map"
```

### Task 8: Runtime QA, documentación y programación diaria

**Files:**
- Modify: `README.md`
- Modify: `docs/project-context.md`
- Modify: `docs/planning/2026-10-14-backlog-tecnico.md`
- Modify: `docs/superpowers/plans/2026-10-15-ingesta-publica-diaria-fase-1.md`

- [ ] **Step 1: Run the full verification**

Run:

```bash
GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check
git diff --check
rg -n "AIza[0-9A-Za-z_-]{20,}|INFOJOBS.*SECRET|ADZUNA.*KEY" .
```

Expected: all checks pass; the secret scan has no matches.

- [ ] **Step 2: Perform browser QA**

Open `http://127.0.0.1:4310`, reload, connect Google Maps and verify:

1. Result count is greater than four.
2. At least one Murcia offer appears with its original SEF URL.
3. An offer with a resolved municipality has a marker and opens the matching detail.
4. An unresolved municipality remains in the list and does not create a false marker.
5. Search and radius keep list and map synchronized.
6. No candidate registration is requested by GeoEmpleo.

- [ ] **Step 3: Update project documentation**

Document `npm run ingest:daily`, the SEF source/license, last verified counts, geographic precision, scheduler time and the distinction between active, credential-blocked and agreement-blocked connectors. Update `docs/project-context.md` with current test totals and runtime evidence.

- [ ] **Step 4: Create the Codex daily automation**

Use `list_projects` to resolve GeoEmpleo, then `automation_update` to create one active local cron at 05:30 Europe/Madrid. Its prompt must execute `npm run ingest:daily`, run the ingestion tests, preserve the previous catalog on failure, report only failures or required credentials, and never invent or manually add offers. Set notifications to failed runs only.

- [ ] **Step 5: Final review and commit**

Request an independent code review for P1/P2 findings. Correct any finding, rerun the complete verification, then:

```bash
git add README.md docs/project-context.md docs/planning/2026-10-14-backlog-tecnico.md docs/superpowers/plans/2026-10-15-ingesta-publica-diaria-fase-1.md
git commit -m "docs: record daily Murcia ingestion"
```

## Subsequent implementation plans

After this vertical slice is verified, create separate plans from the approved multifuente specification for:

1. Remaining open-data connectors: Lanbide, Feina Activa, ECYL, Galicia, Aragón, Andalucía, BOE/Punto de Acceso General and local datasets.
2. Credentialled APIs: InfoJobs, Adzuna and Jooble, with secret management and quota tests.
3. ATS discovery and adapters: Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Personio, Recruitee and Teamtailor.
4. Partner sources: LinkedIn, Indeed, EURES, Empléate, Talent.com and COCEDER after authorization.
5. PostgreSQL/PostGIS, reversible deduplication, distributed scheduling and clustered map rendering for national volume.

Las cuentas operativas autorizadas se tramitan con identidad y contacto reales del usuario, comenzando por InfoJobs y Adzuna. Las verificaciones personales, aceptaciones contractuales y cualquier alta con pago quedan en manos del usuario dentro del portal; los secretos se guardan fuera de Git. LinkedIn no se marca como conectado por crear una cuenta: requiere aprobación formal de Talent Solutions para una interfaz de lectura o distribución compatible.
