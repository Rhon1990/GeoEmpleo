# SuccessFactors Employer Boards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar vacantes oficiales y geolocalizables de Meliá, Vithas, Capgemini, MAPFRE y Correos mediante un adaptador reutilizable de SAP SuccessFactors.

**Architecture:** Extraer el análisis específico de KFC a un conector configurable por tablón. El registro y el runner consumirán la misma lista de configuraciones, manteniendo aislamiento por empresa y reconciliación ATS existente.

**Tech Stack:** TypeScript, Node.js test runner, parse5, nomenclátor nacional de GeoEmpleo y Firebase Hosting estático.

---

### Task 1: Contrato configurable de SuccessFactors

**Files:**
- Create: `packages/ingestion/src/connectors/successfactors.ts`
- Modify: `packages/ingestion/src/connectors/kfc.ts`
- Modify: `tests/ingestion-employer-boards.test.ts`

- [ ] **Step 1: Escribir pruebas fallidas para listado, detalle y restricciones de URL**

Añadir casos con una configuración de prueba que comprueben dominio, ruta de ficha, ID estable, fecha, descripción, localidad única, remoto y duplicados. El resultado esperado debe ser un `PublicJob` con `location.precision === 'municipality'` solo cuando `resolveCity` confirme la localidad.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo por módulo ausente**

Run: `node --test tests/ingestion-employer-boards.test.ts`

Expected: FAIL con `ERR_MODULE_NOT_FOUND` para `successfactors.ts`.

- [ ] **Step 3: Implementar el contrato mínimo reutilizable**

Definir los tipos y funciones públicas:

```ts
export interface SuccessFactorsBoard {
  readonly sourceId: string;
  readonly hostname: string;
  readonly employer: string;
  readonly listingPath: string;
  readonly jobPathPattern: RegExp;
  readonly category: string;
  readonly categoryLabel: string;
  readonly sourceLabel: string;
  readonly pageSize: number;
  readonly maxPages: number;
}

export function parseSuccessFactorsListing(
  html: string,
  board: SuccessFactorsBoard,
): { offers: SuccessFactorsListedOffer[]; pageCount: number };

export function adaptSuccessFactorsDetail(
  offer: SuccessFactorsListedOffer,
  html: string,
  checkedAt: string,
  resolveCity: CityResolver,
  board: SuccessFactorsBoard,
): PublicJob;

export async function fetchSuccessFactorsOffers(
  board: SuccessFactorsBoard,
  checkedAt: string,
  resolveCity: CityResolver,
  fetchImpl?: typeof fetch,
): Promise<PublicJob[]>;
```

La implementación debe reutilizar `html-dom.ts`, `htmlToParagraphs`, `canonicalSpanishProvince` y `fetchHtml`; rechazar listados vacíos, hosts/rutas externas, fechas futuras, páginas fuera de límite y URLs duplicadas.

- [ ] **Step 4: Convertir KFC en configuración compatible**

Conservar `kfcListingUrl`, `parseKfcListing`, `adaptKfcDetail` y `fetchKfcOffers` como envoltorios para evitar cambios en consumidores y pruebas existentes.

- [ ] **Step 5: Ejecutar pruebas focalizadas**

Run: `node --test tests/ingestion-employer-boards.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ingestion/src/connectors/successfactors.ts packages/ingestion/src/connectors/kfc.ts tests/ingestion-employer-boards.test.ts
git commit -m "refactor: generalize successfactors ingestion"
```

### Task 2: Configurar los cinco portales oficiales

**Files:**
- Create: `packages/ingestion/src/connectors/successfactors-boards.ts`
- Create: `tests/fixtures/ingestion/successfactors/` snapshots HTML mínimos
- Modify: `tests/ingestion-employer-boards.test.ts`

- [ ] **Step 1: Capturar y reducir muestras oficiales**

Guardar solo el HTML estructural necesario de un listado y una ficha vigente por empresa, eliminando scripts, analítica y datos personales. Registrar URL y fecha de captura en comentarios del fixture.

- [ ] **Step 2: Escribir pruebas fallidas de las configuraciones**

```ts
for (const board of successFactorsBoards) {
  test(`${board.employer} conserva identidad y URL oficial`, async () => {
    const parsed = parseSuccessFactorsListing(fixture(board, 'listing'), board);
    assert.ok(parsed.offers.length > 0);
    const job = adaptSuccessFactorsDetail(
      parsed.offers[0]!, fixture(board, 'detail'), checkedAt, resolveCity, board,
    );
    assert.equal(job.sourceId, board.sourceId);
    assert.equal(job.employer, board.employer);
    assert.equal(new URL(job.sourceUrl).hostname, board.hostname);
  });
}
```

- [ ] **Step 3: Ejecutar la prueba y confirmar que faltan configuraciones**

Run: `node --test tests/ingestion-employer-boards.test.ts`

Expected: FAIL porque `successFactorsBoards` todavía no existe.

- [ ] **Step 4: Añadir configuraciones declarativas verificadas**

La lista incluirá únicamente las empresas cuya muestra real cumpla el contrato. Los IDs previstos son `successfactors-melia`, `successfactors-vithas`, `successfactors-capgemini`, `successfactors-mapfre` y `successfactors-correos`. Si un portal no cumple el mismo HTML, se elimina de esta ola y queda como candidato; no se fuerza el parser.

- [ ] **Step 5: Ejecutar pruebas focalizadas**

Run: `node --test tests/ingestion-employer-boards.test.ts`

Expected: PASS para todas las configuraciones activadas.

- [ ] **Step 6: Commit**

```bash
git add packages/ingestion/src/connectors/successfactors-boards.ts tests/fixtures/ingestion/successfactors tests/ingestion-employer-boards.test.ts
git commit -m "feat: configure official employer boards"
```

### Task 3: Integrar registro y ejecución diaria

**Files:**
- Modify: `packages/ingestion/src/registry.ts`
- Modify: `packages/ingestion/src/runner.ts`
- Modify: `tests/ingestion-registry.test.ts`
- Modify: `tests/ingestion-runner.test.ts`

- [ ] **Step 1: Escribir pruebas fallidas de registro y aislamiento**

Comprobar que cada configuración aparece como `kind: 'ats'` y `status: 'active'`, que el runner la ejecuta por `sourceId`, que una empresa fallida conserva su catálogo y que otra correcta se publica en la misma ejecución.

- [ ] **Step 2: Ejecutar pruebas y confirmar el fallo**

Run: `node --test tests/ingestion-registry.test.ts tests/ingestion-runner.test.ts`

Expected: FAIL porque las nuevas fuentes todavía no están en registro ni runner.

- [ ] **Step 3: Registrar los tablones desde la configuración compartida**

```ts
...successFactorsBoards.map(board => ({
  id: board.sourceId,
  name: board.sourceLabel,
  countryCode: 'ES' as const,
  kind: 'ats' as const,
  status: 'active' as const,
  endpoint: new URL(board.listingPath, `https://${board.hostname}`).href,
  licenseUrl: null,
}))
```

- [ ] **Step 4: Ejecutar cada tablón desde el runner**

Incluir sus IDs en `implementedSourceIds`, encontrar la configuración por ID y llamar `fetchSuccessFactorsOffers` usando `national.resolveCity`. Mantener `missingRetentionDays: 0` y el mismo reporte sanitizado.

- [ ] **Step 5: Ejecutar pruebas focalizadas**

Run: `node --test tests/ingestion-registry.test.ts tests/ingestion-runner.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ingestion/src/registry.ts packages/ingestion/src/runner.ts tests/ingestion-registry.test.ts tests/ingestion-runner.test.ts
git commit -m "feat: run official employer sources daily"
```

### Task 4: Validación real y publicación

**Files:**
- Modify: `docs/project-context.md`
- Generated: `apps/web-preview/public/data/calls.json`
- Generated: `var/ingestion/latest.json`

- [ ] **Step 1: Ejecutar verificación completa antes de red**

Run: `npm run check`

Expected: typecheck, pruebas Node, OpenAPI y pruebas Python en PASS.

- [ ] **Step 2: Ejecutar la ingesta real**

Run: `npm run ingest:daily`

Expected: `success` o `partial`; cada fuente correcta tiene `received > 0`. Una fuente incompatible permanece fallida sin retirar su catálogo previo.

- [ ] **Step 3: Validar el catálogo generado**

Ejecutar una comprobación Node que confirme JSON válido, IDs únicos, URLs HTTPS oficiales, coordenadas finitas dentro de España y ausencia de marcador para ubicaciones múltiples/remotas.

- [ ] **Step 4: Actualizar contexto con evidencia reciente**

Documentar fuentes realmente activas, `checkedAt`, recibidas, mapeadas, fallos concretos y límites. No conservar en la lista activa una empresa que no superó la captura.

- [ ] **Step 5: Construir y verificar la web estática**

Run: `GEOEMPLEO_ENV_FILE=/Users/rdelgpad/Documents/personal/GeoEmpleo/.env.local npm run build:web:static`

Expected: build correcto, mismo `checkedAt`, JSON válido y formulario local excluido.

- [ ] **Step 6: Desplegar y comprobar HTTPS**

Run: `firebase deploy --only hosting --project geoempleo-49978`

Expected: despliegue correcto; el catálogo público conserva `checkedAt`, IDs únicos y las nuevas fuentes validadas.

- [ ] **Step 7: QA manual clave**

En `https://geoempleo-49978.web.app/`, buscar cada empleador activado; verificar filtro territorial, tarjeta, detalle, enlace oficial, marcador municipal cuando corresponda, selección mapa-lista y ausencia de marcador para ubicación ambigua.

- [ ] **Step 8: Commit**

```bash
git add docs/project-context.md apps/web-preview/public/data/calls.json var/ingestion/latest.json
git commit -m "docs: record verified employer ingestion"
```

