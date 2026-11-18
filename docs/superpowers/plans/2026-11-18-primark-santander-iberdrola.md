# Primark, Santander e Iberdrola Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar diariamente las ofertas españolas de Primark, Banco Santander e Iberdrola con logos oficiales y ubicación municipal prudente.

**Architecture:** El conector Workday actual se parametriza para compartir paginación y validación del filtro España entre Repsol, Santander e Iberdrola. Primark se integra mediante un conector Radancy independiente que valida el total y las páginas HTML. El runner, registro y presentación reutilizan sus contratos actuales.

**Tech Stack:** TypeScript, Node test runner, HTML público Radancy, JSON público Workday, módulos ESM del frontend.

---

### Task 1: Contratos de los conectores

**Files:**
- Modify: `tests/ingestion-repsol-ey-pwc.test.ts`
- Create: `tests/ingestion-primark-santander-iberdrola.test.ts`
- Create: `packages/ingestion/src/connectors/primark.ts`
- Modify: `packages/ingestion/src/connectors/workday-official.ts`

- [ ] **Step 1: Write failing tests**

Añadir casos que exijan aceptar IDs Workday `Req1635224` y `R-01328`, enviar `locationCountry`, rechazar paginación incompleta, expandir `location` y `additionalLocations` en fichas municipales y extraer de Primark total, página, título, ubicación y jornada.

```ts
assert.equal(parseWorkdayListing(workdayPage).offers[0]?.id,'Req1635224');
assert.deepEqual(requestBody.appliedFacets,{locationCountry:[spainId]});
assert.deepEqual(parsePrimarkListing(page).offers[0],{id:'99966016608',title:'Retail Assistant - Dependiente/a',city:'Salamanca, Salamanca, España',regime:'A tiempo parcial',path:'/es/trabajo/salamanca/retail-assistant-dependiente-a/8171/99966016608'});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --import tsx --test tests/ingestion-repsol-ey-pwc.test.ts tests/ingestion-primark-santander-iberdrola.test.ts`

Expected: FAIL porque los nuevos exports y parsers aún no existen.

- [ ] **Step 3: Implement minimal shared Workday and Primark connectors**

```ts
export const santanderBoard={sourceId:'workday-santander',tenant:'santander',site:'SantanderCareers',facetParameter:'locationCountry',employer:'Banco Santander'};
export const iberdrolaBoard={sourceId:'workday-iberdrola',tenant:'iberdrola',site:'Iberdrola',facetParameter:'locationCountry',employer:'Iberdrola'};
export async function fetchWorkdayOffers(board,checkedAt,resolveCity,fetchImpl=fetch){ /* pagina hasta total, valida filtro y expande detalles con varias localidades */ }
export async function fetchPrimarkOffers(checkedAt,resolveCity,fetchImpl=fetch){ /* pagina 1..totalPages y valida total */ }
```

La adaptación genera `dateKind: 'observed'`, conserva el enlace HTTPS permitido, asigna un ID estable por localidad y deja `location: null` si el detalle múltiple no está disponible o la localidad no es resoluble.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --import tsx --test tests/ingestion-repsol-ey-pwc.test.ts tests/ingestion-primark-santander-iberdrola.test.ts`

Expected: PASS.

### Task 2: Registro y actualización diaria

**Files:**
- Modify: `packages/ingestion/src/registry.ts`
- Modify: `packages/ingestion/src/runner.ts`
- Modify: `tests/ingestion-primark-santander-iberdrola.test.ts`

- [ ] **Step 1: Add failing runner test**

```ts
for(const id of ['radancy-primark','workday-santander','workday-iberdrola']) assert.equal(sourceRegistry.get(id)?.status,'active');
const report=await runDaily({...options,sourceIds:['radancy-primark','workday-santander','workday-iberdrola']});
assert.equal(report.sources.length,3);
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --import tsx --test tests/ingestion-primark-santander-iberdrola.test.ts`

Expected: FAIL porque el runner todavía no conoce las fuentes.

- [ ] **Step 3: Register and dispatch sources**

Añadir las tres definiciones activas y tres ramas del dispatcher que llamen a `fetchPrimarkOffers` o `fetchWorkdayOffers` con el resolver nacional ya existente.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `node --import tsx --test tests/ingestion-primark-santander-iberdrola.test.ts`

Expected: PASS y primera detección estable en una segunda ejecución.

### Task 3: Logos y presentación

**Files:**
- Create: `apps/web-preview/public/brands/primark.svg`
- Create: `apps/web-preview/public/brands/santander.png`
- Create: `apps/web-preview/public/brands/iberdrola.jpg`
- Modify: `apps/web-preview/public/brands/README.md`
- Modify: `apps/web-preview/public/presentation.mjs`
- Modify: `apps/web-preview/routing.mjs`
- Modify: `apps/web-preview/public/index.html`
- Modify: `tests/web-employer-brand.test.ts`
- Modify: `tests/web-routing.test.ts`

- [ ] **Step 1: Add failing brand/routing assertions**

```ts
assert.deepEqual(employerBrand({sourceId:'radancy-primark'}),{src:'/brands/primark.svg',alt:'Primark'});
assert.deepEqual(employerBrand({sourceId:'workday-santander'}),{src:'/brands/santander.png',alt:'Banco Santander'});
assert.deepEqual(employerBrand({sourceId:'workday-iberdrola'}),{src:'/brands/iberdrola.jpg',alt:'Iberdrola'});
```

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --import tsx --test tests/web-employer-brand.test.ts tests/web-routing.test.ts`

Expected: FAIL por mappings y assets ausentes.

- [ ] **Step 3: Add official local assets and mappings**

Descargar únicamente los SVG oficiales desde los portales corporativos, registrar `/brands/*.svg`, documentar URL de origen y añadir los enlaces de atribución del pie.

- [ ] **Step 4: Run UI tests and verify GREEN**

Run: `node --import tsx --test tests/web-employer-brand.test.ts tests/web-routing.test.ts`

Expected: PASS.

### Task 4: Evidencia y regresión completa

**Files:**
- Modify: `docs/project-context.md`

- [ ] **Step 1: Capture live sources in isolation**

Run: `npm run ingest -- --source radancy-primark --source workday-santander --source workday-iberdrola`

Expected: tres fuentes válidas; los recibidos coinciden con los totales visibles del momento.

- [ ] **Step 2: Document verified behavior**

Registrar fuentes, tratamiento de fechas observadas, ubicaciones ambiguas, logos, conteos de la captura y límites residuales en `docs/project-context.md`.

- [ ] **Step 3: Run full verification**

Run: `npm run check`

Expected: TypeScript, suite Node, OpenAPI y fixtures Python en PASS.

- [ ] **Step 4: Build static site**

Run: `GEOEMPLEO_ENV_FILE=/Users/rdelgpad/Documents/personal/GeoEmpleo/.env.local npm run build:web:static`

Expected: build completo sin publicar el catálogo fixture local.
