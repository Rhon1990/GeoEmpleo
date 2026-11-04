# El Corte Inglés Offers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar diariamente las vacantes oficiales de El Corte Inglés ubicadas en España, mostrarlas con ubicación municipal verificada y su logo local en GeoEmpleo360.

**Architecture:** Un conector dedicado leerá el listado paginado público de `empleo.elcorteingles.es` con `country: ["ES"]`, validará cada enlace Workday y consultará su ficha oficial `JobPosting` para confirmar España. El conector devolverá `PublicJob[]` y reutilizará el runner, `reconcileSource`, el resolver municipal nacional y el sistema de marcas existentes; un fallo conservará la instantánea anterior de esta fuente.

**Tech Stack:** TypeScript, Node.js `fetch`, frontend público oficial y JSON-LD `JobPosting` de Workday, `node:test`, Firebase static build, GitHub Actions existente.

---

## Estructura de archivos

- Crear `packages/ingestion/src/connectors/el-corte-ingles.ts`: contrato remoto, validación, paginación, detalle Workday, filtro España y adaptación a `PublicJob`.
- Modificar `packages/ingestion/src/registry.ts`: registrar la fuente activa y su endpoint oficial.
- Modificar `packages/ingestion/src/runner.ts`: despachar la fuente al conector dentro del ciclo diario existente.
- Modificar `tests/ingestion-employer-boards.test.ts`: pruebas unitarias y de integración de la captura.
- Modificar `tests/ingestion-runner.test.ts`: aislamiento, conservación y registro diario de la nueva fuente.
- Crear `apps/web-preview/public/brands/el-corte-ingles.svg`: asset oficial local.
- Modificar `apps/web-preview/public/presentation.mjs` y `tests/web-employer-brand.test.ts`: asociación de marca y validación del asset.
- Modificar `apps/web-preview/public/brands/README.md`, `docs/fuentes-de-ofertas.md` y `docs/project-context.md`: procedencia, cobertura real, límites y operación diaria.

### Task 1: Contrato del listado, filtro España y paginación completa

**Files:**
- Create: `packages/ingestion/src/connectors/el-corte-ingles.ts`
- Modify: `tests/ingestion-employer-boards.test.ts`

- [ ] **Step 1: Escribir las pruebas fallidas del listado y detalle**

Añadir imports de `adaptElCorteInglesDetail`, `fetchElCorteInglesOffers` y `parseElCorteInglesListing`. Crear fixtures que representen el contrato verificado:

```ts
const eciListed=(id:string,location='Madrid')=>({
  job_requisition_id:id,
  job_posting_title:`Oferta ${id}`,
  job_location_name:location,
  job_areas:['Centros comerciales'],
  job_employee_type:'Empleo',
  job_time_type:'Completa',
  external_url:`https://wd3.myworkdaysite.com/recruiting/elcorteingles/Ext/job/MADRID/Oferta_${id}`,
  job_apply_url:`https://wd3.myworkdaysite.com/recruiting/elcorteingles/Ext/job/MADRID/Oferta_${id}/apply`,
});

test('El Corte Inglés valida listado, ficha española y municipio',()=>{
  const listing=parseElCorteInglesListing({job_requisitions:[eciListed('JR155839')],total_results:1},0);
  const detail={jobPostingInfo:{posted:true,jobReqId:'JR155839',title:'Oferta JR155839',
    jobDescription:'<p>Atención al cliente.</p>',externalUrl:listing.offers[0]!.externalUrl,
    jobRequisitionLocation:{country:{alpha2Code:'ES'}},country:{descriptor:'Spain'},
    location:'Madrid',additionalLocations:[],startDate:'2026-11-03'}};
  const job=adaptElCorteInglesDetail(listing.offers[0]!,detail,'2026-11-04T08:00:00.000Z',city=>city==='Madrid'?madridResolved:null);
  assert.equal(job?.sourceId,'elcorteingles-oficial');
  assert.equal(job?.employer,'El Corte Inglés');
  assert.deepEqual(job?.location?.point,[-3.7038,40.4168]);
});

test('El Corte Inglés excluye Portugal y no inventa puntos ambiguos',()=>{
  const listed=parseElCorteInglesListing({job_requisitions:[eciListed('JR149187','Braga')],total_results:1},0).offers[0]!;
  const portugal={jobPostingInfo:{posted:true,jobReqId:'JR149187',title:'Oferta JR149187',jobDescription:'<p>Loja.</p>',
    externalUrl:listed.externalUrl,jobRequisitionLocation:{country:{alpha2Code:'PT'}},country:{descriptor:'Portugal'},location:'Braga'}};
  assert.equal(adaptElCorteInglesDetail(listed,portugal,checkedAt,()=>null),null);
});
```

- [ ] **Step 2: Ejecutar las pruebas y comprobar RED**

Run: `node --test tests/ingestion-employer-boards.test.ts`

Expected: FAIL porque `packages/ingestion/src/connectors/el-corte-ingles.ts` todavía no existe.

- [ ] **Step 3: Implementar validadores y adaptación mínima**

Crear tipos cerrados para las filas y páginas, validar `JR` + dígitos, títulos no vacíos, `total_results` seguro y URLs HTTPS limitadas a `wd3.myworkdaysite.com/recruiting/elcorteingles/Ext/job/`. La ficha debe verificar:

```ts
if(info.posted!==true) return null;
if(info.jobReqId!==offer.id||info.title!==offer.title) throw new TypeError('Detalle El Corte Inglés no corresponde al listado');
const alpha2=record(record(info.jobRequisitionLocation).country).alpha2Code;
if(alpha2!=='ES') return null;
```

Adaptar con `htmlToParagraphs`, `dateInSpain`, `CityResolver`, categoría derivada de `job_areas`, `applicationRegistration:'external_required'`, `dateKind:'observed'` cuando no haya `startDate` válida y `location:null` para teletrabajo, ubicaciones múltiples, códigos internos o ciudades no resueltas.

- [ ] **Step 4: Añadir paginación y consulta de detalles**

Implementar `POST https://empleo.elcorteingles.es/ep/api/job-requisitions/obtain?page=<n>&size=100` con el cuerpo de filtros usado por el frontend oficial (`location`, `contract_type`, `department`, `company` y `employment_type` vacíos; `campaign`, `new_talent` e `is_fp_offers` falsos; `search_term` vacío; `country: ["ES"]`), límite de 10 páginas/1.000 filas, `content-type` JSON y timeout de 40 segundos. Verificar total constante, páginas no vacías, IDs únicos y suma exacta. Para cada fila consultar por lotes de cuatro la ficha pública `external_url` de Workday y leer su `JobPosting` JSON-LD, incluidos ID, país, descripción y ubicación.

La captura debe lanzar si el listado está vacío, incompleto o si ninguna ficha confirma España. Reintentar una vez errores transitorios de red/HTTP por solicitud y una vez el barrido completo ante cambios estructurales del snapshot.

- [ ] **Step 5: Completar pruebas de paginación y seguridad**

El `fetchImpl` de prueba debe comprobar método POST, `page`, `size=100`, cuerpo con `country: ["ES"]`, devolver dos páginas y detalles ES/PT. Añadir aserciones para total, exclusión PT, enlace no autorizado, ID repetido, cambio de total, respuesta vacía y ubicación interna `0030908` sin marcador.

- [ ] **Step 6: Ejecutar pruebas y comprobar GREEN**

Run: `node --test tests/ingestion-employer-boards.test.ts`

Expected: PASS para todos los casos empresariales, incluidos los nuevos de El Corte Inglés.

- [ ] **Step 7: Commit**

```bash
git add packages/ingestion/src/connectors/el-corte-ingles.ts tests/ingestion-employer-boards.test.ts
git commit -m "feat: ingest Spanish El Corte Ingles jobs"
```

### Task 2: Registro y runner diario con conservación segura

**Files:**
- Modify: `packages/ingestion/src/registry.ts`
- Modify: `packages/ingestion/src/runner.ts`
- Modify: `tests/ingestion-runner.test.ts`

- [ ] **Step 1: Escribir pruebas fallidas de registro y runner**

Añadir una prueba que verifique:

```ts
assert.deepEqual(sourceRegistry.get('elcorteingles-oficial'),{
  id:'elcorteingles-oficial',name:'El Corte Inglés · portal oficial',countryCode:'ES',kind:'ats',status:'active',
  endpoint:'https://empleo.elcorteingles.es/ep/ofertas',licenseUrl:null,
});
```

En el runner, simular una captura española válida y comprobar `received`, `mapped`, catálogo y aislamiento. Simular después HTTP 500 con una fila previa de esa fuente y comprobar estado `partial` y que la fila anterior se conserva.

- [ ] **Step 2: Ejecutar pruebas y comprobar RED**

Run: `node --test tests/ingestion-runner.test.ts`

Expected: FAIL porque la fuente no está registrada ni despachada.

- [ ] **Step 3: Registrar y despachar el conector**

Importar `elCorteInglesListingUrl` y `fetchElCorteInglesOffers`, añadir `elcorteingles-oficial` a `implementedSourceIds`, registrar una definición `kind:'ats'`, `status:'active'` y añadir una rama del runner que pase `checkedAt`, `national.resolveCity` y `options.fetchImpl`.

Mantener `missingRetentionDays:0` por ser una instantánea ATS completa: las retiradas solo se aplican tras una captura válida; cualquier excepción conserva la instantánea anterior mediante el aislamiento actual del runner.

- [ ] **Step 4: Ejecutar pruebas focalizadas y typecheck**

Run: `node --test tests/ingestion-runner.test.ts tests/ingestion-employer-boards.test.ts && npm run typecheck`

Expected: PASS y TypeScript sin errores.

- [ ] **Step 5: Commit**

```bash
git add packages/ingestion/src/registry.ts packages/ingestion/src/runner.ts tests/ingestion-runner.test.ts
git commit -m "feat: schedule El Corte Ingles in daily runner"
```

### Task 3: Logo oficial local y filtro de empresa canónico

**Files:**
- Create: `apps/web-preview/public/brands/el-corte-ingles.svg`
- Modify: `apps/web-preview/public/presentation.mjs`
- Modify: `tests/web-employer-brand.test.ts`
- Modify: `apps/web-preview/public/brands/README.md`

- [ ] **Step 1: Escribir la prueba fallida de marca**

Añadir a `publicBrands`:

```ts
'elcorteingles-oficial':['/brands/el-corte-ingles.svg','El Corte Inglés'],
```

La prueba existente debe comprobar que el asset existe y contiene `<svg>`.

- [ ] **Step 2: Ejecutar la prueba y comprobar RED**

Run: `node --test tests/web-employer-brand.test.ts`

Expected: FAIL porque no existe la asociación o el archivo local.

- [ ] **Step 3: Incorporar el recurso oficial sin redibujarlo**

Descargar el SVG que el portal oficial sirve en `https://empleo.elcorteingles.es/ep/assets/images/companies/eci.svg`, verificar que es SVG sin scripts ni referencias externas y guardarlo como `apps/web-preview/public/brands/el-corte-ingles.svg`. Añadir la asociación exacta a `employerBrands` y documentar en el README la URL oficial, fecha y titularidad de marca.

- [ ] **Step 4: Ejecutar prueba de marca y build estático**

Run: `node --test tests/web-employer-brand.test.ts && npm run build:web:static`

Expected: PASS; el build copia el SVG y mantiene el fallback neutro.

- [ ] **Step 5: Commit**

```bash
git add apps/web-preview/public/brands/el-corte-ingles.svg apps/web-preview/public/presentation.mjs apps/web-preview/public/brands/README.md tests/web-employer-brand.test.ts
git commit -m "feat: add El Corte Ingles employer branding"
```

### Task 4: Documentación operativa y contexto del proyecto

**Files:**
- Modify: `docs/fuentes-de-ofertas.md`
- Modify: `docs/project-context.md`

- [ ] **Step 1: Documentar solo evidencia verificada**

Añadir la fuente, el enlace oficial, endpoint frontend no documentado, confirmación por ficha Workday, criterio España, marcadores municipales y política de conservación. Registrar cifras de ofertas/mapeadas únicamente después de una captura real; si todavía no se ha capturado, indicar “pendiente de primera ejecución” en vez de estimar.

- [ ] **Step 2: Verificar coherencia documental**

Run: `rg -n "elcorteingles-oficial|El Corte Inglés" docs/project-context.md docs/fuentes-de-ofertas.md apps/web-preview/public/brands/README.md`

Expected: la fuente, sus límites y el logo aparecen una sola vez en las secciones operativas correspondientes.

- [ ] **Step 3: Commit**

```bash
git add docs/project-context.md docs/fuentes-de-ofertas.md
git commit -m "docs: document El Corte Ingles job source"
```

### Task 5: Captura real, regresión completa y preparación de publicación

**Files:**
- Modify only if capture succeeds: `apps/web-preview/public/data/calls.json`
- Modify only if runner generates it: `var/ingestion/latest.json`

- [ ] **Step 1: Ejecutar una captura aislada de la nueva fuente**

Ejecutar el runner con `sourceIds:['elcorteingles-oficial']` sobre copias temporales del catálogo y del informe. Comprobar: al menos una oferta ES, IDs únicos, cero ubicaciones PT, URLs oficiales HTTPS y que `mapped <= received`.

- [ ] **Step 2: Auditar una muestra real**

Abrir al menos tres enlaces de fichas: una oferta con punto, una sin punto y una de distinta provincia. Confirmar que título, país, municipio y vigencia coinciden con el origen. No publicar si alguna URL devuelve 404 o si el país no puede confirmarse.

- [ ] **Step 3: Ejecutar verificación completa**

Run: `npm run check && npm run build:web:static`

Expected: typecheck, 423+ pruebas, OpenAPI, contratos Python y build estático correctos; el número exacto aumentará con las pruebas nuevas.

- [ ] **Step 4: Revisar diferencias y seguridad**

Run: `git diff --check && git status --short && git diff --stat origin/main...HEAD`

Expected: sin whitespace inválido, secretos, credenciales, cambios al workflow de pago ni ficheros temporales.

- [ ] **Step 5: Commit de datos solo si procede**

No versionar una captura temporal. El catálogo público se actualizará mediante el workflow diario después de integrar la rama. Si la ejecución real forma parte de una publicación autorizada, generar el catálogo desde la línea base HTTPS vigente, validar IDs únicos y hacer un commit separado claramente identificado.

### Task 6: Revisión e integración segura

**Files:**
- Review: `packages/ingestion/src/connectors/el-corte-ingles.ts`
- Review: `packages/ingestion/src/registry.ts`
- Review: `packages/ingestion/src/runner.ts`
- Review: `tests/ingestion-employer-boards.test.ts`
- Review: `tests/ingestion-runner.test.ts`
- Review: `apps/web-preview/public/presentation.mjs`
- Review: `apps/web-preview/public/brands/el-corte-ingles.svg`
- Review: `tests/web-employer-brand.test.ts`
- Review: `apps/web-preview/public/brands/README.md`
- Review: `docs/fuentes-de-ofertas.md`
- Review: `docs/project-context.md`

- [ ] **Step 1: Revisar contra la especificación**

Confirmar filtro España por detalle, paginación completa, no invención de coordenadas, conservación ante fallo, marca local y documentación actualizada.

- [ ] **Step 2: Preparar PR con evidencia**

Publicar la rama `codex/el-corte-ingles-offers`, crear PR contra `main` y adjuntar comandos/resultados, número real de ofertas españolas y número mapeado. No integrar ni desplegar sin revisar checks.

- [ ] **Step 3: Validar publicación tras merge**

Ejecutar manualmente el workflow diario existente y comprobar por HTTPS `https://geoempleo360.com/data/calls.json`: `checkedAt` nuevo, JSON válido, IDs únicos, presencia de `elcorteingles-oficial`, logo accesible y tarjetas/marcadores coherentes.
