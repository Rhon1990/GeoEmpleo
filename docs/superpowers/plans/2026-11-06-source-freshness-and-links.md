# Source Freshness and Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirar ofertas obsoletas de Lanbide y Burger King, recuperar Capgemini España y evitar que ECYL publique fichas oficiales explícitamente no disponibles.

**Architecture:** Mantener los conectores existentes y añadir dos límites pequeños: reconciliación inmediata para snapshots públicos completos y caducidad explícita para snapshots empresariales que llevan varios días sin verificarse. SuccessFactors contará todas las filas paginadas aunque filtre países, y ECYL validará los destinos canónicos durante la captura sin convertir bloqueos anti-bot de terceros en falsos cierres.

**Tech Stack:** TypeScript, Node.js test runner, parse5 DOM helpers, GitHub Actions daily ingestion, Firebase Hosting static catalog.

---

## File map

- `packages/ingestion/src/catalog.ts`: política reutilizable para caducar el snapshot de una fuente fallida.
- `packages/ingestion/src/runner.ts`: reconciliación inmediata de Lanbide, caducidad Burger King y captura ECYL validada.
- `packages/ingestion/src/connectors/successfactors.ts`: contabilización completa de filas globales y filtro español sin romper la paginación.
- `packages/ingestion/src/connectors/successfactors-boards.ts`: consulta completa y paginación vigente de Capgemini.
- `packages/ingestion/src/connectors/cyl.ts`: captura ECYL asíncrona y rechazo de fichas canónicas 404/410.
- `packages/ingestion/src/http.ts`: comprobación HTTPS acotada que devuelve estado y cancela el cuerpo.
- `tests/ingestion-catalog.test.ts`: caducidad de snapshots fallidos.
- `tests/ingestion-runner.test.ts`: retirada inmediata Lanbide y comportamiento diario Burger King/ECYL.
- `tests/ingestion-employer-boards.test.ts`: paginación global Capgemini con países descartados.
- `tests/ingestion-open-sources.test.ts`: validación de destinos ECYL.
- `docs/project-context.md`: política operativa y límites actualizados.

### Task 1: Retirada inmediata de Lanbide

**Files:**
- Modify: `tests/ingestion-runner.test.ts`
- Modify: `packages/ingestion/src/runner.ts`

- [ ] **Step 1: Write the failing runner test**

Extender la prueba de reconciliación que precarga `ECYL-OLD` y `LANBIDE-OLD` para exigir que ambos desaparezcan tras snapshots correctos:

```ts
assert.ok(!updated.calls.some((job:{id:string})=>job.id==='ECYL-OLD'));
assert.ok(!updated.calls.some((job:{id:string})=>job.id==='LANBIDE-OLD'));
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/ingestion-runner.test.ts`

Expected: FAIL porque `LANBIDE-OLD` sigue retenida siete días.

- [ ] **Step 3: Implement the minimal policy change**

En `runDaily`, definir la retención inmediata para las dos fuentes públicas completas:

```ts
const removeMissingImmediately = source.kind === 'ats'
  || sourceId === 'ecyl-castilla-leon'
  || sourceId === 'lanbide-euskadi';

next=reconcileSource(next,sourceId,jobs,checkedAt,sourceId==='sef-murcia'?{}:{
  missingRetentionDays:removeMissingImmediately?0:7,
  // opciones existentes sin cambios
});
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/ingestion-runner.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ingestion/src/runner.ts tests/ingestion-runner.test.ts
git commit -m "fix: retire missing Lanbide offers immediately"
```

### Task 2: Caducidad segura de Burger King cuando el portal falla

**Files:**
- Modify: `tests/ingestion-catalog.test.ts`
- Modify: `packages/ingestion/src/catalog.ts`
- Modify: `tests/ingestion-runner.test.ts`
- Modify: `packages/ingestion/src/runner.ts`

- [ ] **Step 1: Write failing catalog tests**

Añadir pruebas para una función pura que conserva observaciones dentro de 72 horas y retira solo la fuente indicada después del límite:

```ts
test('caduca una fuente fallida después de su ventana sin tocar otras fuentes',()=>{
  const catalog={checkedAt:'2026-11-01T08:00:00Z',publishedAt:null,mode:'verified_snapshot',sourceConditions:'x',calls:[
    {...job('BIZNEO-BK','bizneo-burger-king',null),checkedAt:'2026-11-01T08:00:00Z'},
    {...job('OTHER','lanbide-euskadi',null),checkedAt:'2026-11-01T08:00:00Z'},
  ]};
  const retained=expireFailedSource(catalog,'bizneo-burger-king','2026-11-04T08:00:00Z',3);
  const expired=expireFailedSource(catalog,'bizneo-burger-king','2026-11-04T08:00:00.001Z',3);
  assert.ok(retained.calls.some(item=>item.id==='BIZNEO-BK'));
  assert.ok(!expired.calls.some(item=>item.id==='BIZNEO-BK'));
  assert.ok(expired.calls.some(item=>item.id==='OTHER'));
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/ingestion-catalog.test.ts`

Expected: FAIL porque `expireFailedSource` no existe.

- [ ] **Step 3: Implement the pure expiration helper**

Añadir en `catalog.ts`:

```ts
export function expireFailedSource(
  catalog:PublicCatalog,
  sourceId:string,
  checkedAt:string,
  retentionDays:number,
):PublicCatalog {
  if(!Number.isInteger(retentionDays)||retentionDays<0) throw new TypeError('Retención de fuente fallida inválida');
  const current=Date.parse(checkedAt);
  if(!Number.isFinite(current)) throw new TypeError('Fecha de caducidad inválida');
  return {
    ...catalog,
    calls:catalog.calls.filter(job=>job.sourceId!==sourceId
      || current-Date.parse(job.checkedAt)<=retentionDays*86_400_000),
  };
}
```

Validar también que un `job.checkedAt` inválido provoca error en vez de retirar silenciosamente.

- [ ] **Step 4: Verify the helper**

Run: `node --test tests/ingestion-catalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing runner test**

Preparar un catálogo con Burger King observado hace más de 72 horas y una segunda fuente que sí actualiza. Simular 404 para `empleo.bkspain.es` y exigir:

```ts
assert.equal(report.status,'partial');
assert.ok(!published.calls.some((job:{sourceId:string})=>job.sourceId==='bizneo-burger-king'));
assert.ok(published.calls.some((job:{sourceId:string})=>job.sourceId==='lanbide-euskadi'));
```

- [ ] **Step 6: Verify runner RED**

Run: `node --test tests/ingestion-runner.test.ts`

Expected: FAIL porque el catch conserva Burger King indefinidamente.

- [ ] **Step 7: Apply expiration only on Burger King failure**

En el `catch` de cada fuente:

```ts
if(sourceId==='bizneo-burger-king') {
  next=expireFailedSource(next,sourceId,checkedAt,3);
}
```

Mantener el estado `failed`, el resultado global `partial` y la regla existente que no publica nada cuando todas las fuentes fallan.

- [ ] **Step 8: Verify and commit**

Run: `node --test tests/ingestion-catalog.test.ts tests/ingestion-runner.test.ts`

Expected: PASS.

```bash
git add packages/ingestion/src/catalog.ts packages/ingestion/src/runner.ts tests/ingestion-catalog.test.ts tests/ingestion-runner.test.ts
git commit -m "fix: expire stale Burger King snapshot"
```

### Task 3: Recuperar Capgemini España desde el listado global

**Files:**
- Modify: `tests/ingestion-employer-boards.test.ts`
- Modify: `packages/ingestion/src/connectors/successfactors.ts`
- Modify: `packages/ingestion/src/connectors/successfactors-boards.ts`

- [ ] **Step 1: Write a failing pagination test**

Construir dos páginas con total 4: dos filas `ES` y dos filas `PT`. Exigir que se consulten ambas páginas, que la captura se considere completa y que solo se abran las dos fichas españolas:

```ts
assert.deepEqual(jobs.map(job=>job.city),['Madrid','Barcelona']);
assert.deepEqual(listingStarts,[0,2]);
assert.equal(detailCalls,2);
```

La configuración de prueba debe usar `paginationOffsetParam:'startrow'`, `pageSize:2` y `maxPages:2`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/ingestion-employer-boards.test.ts`

Expected: FAIL por `Paginación SuccessFactors incompleta`, ya que las filas extranjeras no cuentan como observadas.

- [ ] **Step 3: Count every validated row independently from publication eligibility**

Ampliar el resultado de `parseSuccessFactorsListing`:

```ts
{
  offers:SuccessFactorsListedOffer[];
  excludedUrls:string[];
  observedUrls:string[];
  pageCount:number;
  totalCount:number|null;
}
```

Para cada fila, validar primero la URL oficial y añadirla a `observedUrls`; después decidir si se publica, se excluye por patrón o se descarta por país. En `fetchSuccessFactorsOffers`, mantener un `Set` global de URLs observadas, rechazar repeticiones entre páginas y comprobar:

```ts
if(board.paginationOffsetParam && observed.size!==first.totalCount) {
  throw new TypeError('Paginación SuccessFactors incompleta');
}
```

- [ ] **Step 4: Update Capgemini board**

Configurar:

```ts
listingPath:'/search/?q=&locationsearch=',
pageSize:25,
maxPages:80,
paginationOffsetParam:'startrow',
```

El parser existente conservará solo ubicaciones terminadas en `ES`; las demás filas contarán para integridad pero no producirán `PublicJob`.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/ingestion-employer-boards.test.ts tests/ingestion-registry.test.ts`

Expected: PASS.

```bash
git add packages/ingestion/src/connectors/successfactors.ts packages/ingestion/src/connectors/successfactors-boards.ts tests/ingestion-employer-boards.test.ts
git commit -m "fix: restore Spanish Capgemini listings"
```

### Task 4: Excluir fichas ECYL explícitamente rotas

**Files:**
- Modify: `tests/ingestion-http.test.ts`
- Modify: `packages/ingestion/src/http.ts`
- Modify: `tests/ingestion-open-sources.test.ts`
- Modify: `packages/ingestion/src/connectors/cyl.ts`
- Modify: `tests/ingestion-runner.test.ts`
- Modify: `packages/ingestion/src/runner.ts`

- [ ] **Step 1: Write a failing bounded status test**

Añadir en `tests/ingestion-http.test.ts` una respuesta con cuerpo que registre su cancelación y exigir:

```ts
assert.equal(await fetchStatus('https://empleo.jcyl.es/oferta',{fetchImpl}),404);
assert.equal(cancelled,true);
```

- [ ] **Step 2: Verify HTTP RED**

Run: `node --test tests/ingestion-http.test.ts`

Expected: FAIL porque `fetchStatus` no existe.

- [ ] **Step 3: Implement the bounded status helper**

Añadir en `http.ts`:

```ts
export async function fetchStatus(url:string,options:FetchOptions={}):Promise<number> {
  const address=new URL(url);
  if(address.protocol!=='https:'||address.username||address.password) throw new TypeError('URL HTTPS requerida');
  const response=await (options.fetchImpl??fetch)(address,{
    headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(options.timeoutMs??40_000),
  });
  await response.body?.cancel();
  return response.status;
}
```

- [ ] **Step 4: Verify HTTP GREEN**

Run: `node --test tests/ingestion-http.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing destination tests**

Añadir una prueba asíncrona con tres ofertas adaptadas: una Oficina Virtual, una ficha canónica 200 y una ficha canónica 404. El `fetchImpl` debe devolver 404 solo para el último ID. Exigir:

```ts
const jobs=await filterUnavailableCylOffers(adapted,fetchImpl);
assert.deepEqual(jobs.map(job=>job.id),['ECYL-VALID-APPLICATION','ECYL-VALID-CANONICAL']);
```

Añadir otro caso donde un enlace externo devuelve 403 y se conserva, porque un bloqueo automatizado no demuestra que la página haya desaparecido.

- [ ] **Step 6: Verify ECYL RED**

Run: `node --test tests/ingestion-open-sources.test.ts`

Expected: FAIL porque `filterUnavailableCylOffers` no existe.

- [ ] **Step 7: Implement bounded availability validation**

Exportar en `cyl.ts`:

```ts
export async function filterUnavailableCylOffers(
  jobs:readonly PublicJob[],
  fetchImpl:typeof fetch=fetch,
):Promise<PublicJob[]> {
  const checked:PublicJob[]=[];
  for(let index=0;index<jobs.length;index+=8) {
    const batch=await Promise.all(jobs.slice(index,index+8).map(async job=>{
      const url=new URL(job.sourceUrl);
      if(url.hostname!=='empleo.jcyl.es') return job;
      const status=await fetchStatus(url.href,{fetchImpl});
      if(status===404||status===410) return null;
      if(status<200||status>=300) throw new TypeError('Validación ECYL no disponible');
      return job;
    }));
    checked.push(...batch.filter((job):job is PublicJob=>job!==null));
  }
  if(jobs.length>0&&checked.length===0) throw new TypeError('Sin ofertas ECYL con destino verificable');
  return checked;
}
```

- [ ] **Step 8: Route ECYL through the validator**

En `runner.ts`, después de adaptar el JSON ECYL:

```ts
const adapted=adaptSource(sourceId,input,checkedAt,national?.resolve??(()=>null));
const jobs=sourceId==='ecyl-castilla-leon'
  ? await filterUnavailableCylOffers(adapted,options.fetchImpl)
  : adapted;
```

Mantener la captura como fallida si la validación no puede completarse; así el catálogo previo se conserva y no se confunde un fallo de red con 404.

- [ ] **Step 9: Verify runner behavior**

Run: `node --test tests/ingestion-open-sources.test.ts tests/ingestion-runner.test.ts`

Expected: PASS y ninguna oferta publicada con una ficha canónica 404 simulada.

- [ ] **Step 10: Commit**

```bash
git add packages/ingestion/src/http.ts packages/ingestion/src/connectors/cyl.ts packages/ingestion/src/runner.ts tests/ingestion-http.test.ts tests/ingestion-open-sources.test.ts tests/ingestion-runner.test.ts
git commit -m "fix: remove broken ECYL destinations"
```

### Task 5: Documentar, verificar y probar con fuentes reales

**Files:**
- Modify: `docs/project-context.md`

- [ ] **Step 1: Update operational context**

Documentar:

- Lanbide retira ausencias en la primera captura completa correcta.
- Burger King conserva como máximo 72 horas tras fallos consecutivos y su portal se encuentra actualmente en 404.
- Capgemini usa el listado global completo, filtra `ES` y valida toda la paginación.
- ECYL descarta respuestas 404/410 canónicas, conserva alternativas oficiales y trata fallos de validación como fallo de fuente.

- [ ] **Step 2: Run focused tests**

Run:

```bash
node --test tests/ingestion-catalog.test.ts tests/ingestion-open-sources.test.ts tests/ingestion-employer-boards.test.ts tests/ingestion-runner.test.ts
```

Expected: PASS, 0 failures.

- [ ] **Step 3: Run the full quality gate**

Run: `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check`

Expected: TypeScript, Node tests, OpenAPI and Python fixtures PASS.

- [ ] **Step 4: Run controlled live captures without publishing**

Usar el CLI de ingesta con copias temporales del catálogo para `ecyl-castilla-leon`, `lanbide-euskadi`, `successfactors-capgemini` y `bizneo-burger-king`. Validar:

```text
ECYL: success y ningún sourceUrl canónico 404/410
Lanbide: success y total igual al snapshot actual, sin retención de ausentes
Capgemini: success con fichas españolas verificadas
Burger King: failed mientras el portal responda 404; su snapshot caduca según checkedAt
```

No desplegar ni editar manualmente `calls.json` durante esta prueba.

- [ ] **Step 5: Build static delivery**

Run: `npm run build:web:static`

Expected: PASS y catálogo JSON válido con IDs únicos.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/project-context.md
git commit -m "docs: record source freshness policies"
```

- [ ] **Step 7: Review final diff**

Run:

```bash
git diff --check origin/main...HEAD
git status --short
```

Expected: sin errores de whitespace y árbol limpio.
