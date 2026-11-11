# Seis portales empresariales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar al catálogo diario únicamente las ofertas españolas completas, activas y trazables de Mercadona, Grupo Crit, Sacyr, Acciona, Ferrovial y STEF, sin reducir ni alterar las fuentes existentes.

**Architecture:** Cada portal se valida primero contra su interfaz pública: listado paginado, ID estable, URL de ficha, país y detalle coherente. Solo los portales que superen ese contrato se añaden como `active` al registro y al despachador diario; los demás permanecen explícitamente como `candidate` o `authorization_required`, fuera del runner. Los adaptadores validan URLs HTTPS del dominio oficial, recorren todas las páginas anunciadas y resuelven el marcador solo para municipios españoles inequívocos.

**Tech Stack:** TypeScript 7, Node 24, `parse5`, Node test runner, catálogo JSON estático, GitHub Actions y Firebase Hosting.

---

## Estructura y límites

| Archivo | Responsabilidad |
| --- | --- |
| `packages/ingestion/src/connectors/{mercadona,crit,sacyr,acciona,ferrovial,stef}.ts` | Un adaptador aislado por portal que solo se crea para un contrato público validado. |
| `packages/ingestion/src/registry.ts` | Estado, URL oficial y procedencia de las seis fuentes. |
| `packages/ingestion/src/runner.ts` | Despacho explícito de los adaptadores activos y conciliación independiente. |
| `tests/ingestion-<empresa>.test.ts` | Contrato de listado, paginación, ficha, España, URL y fallo seguro. |
| `tests/ingestion-runner.test.ts` | Aislamiento: una fuente nueva fallida conserva las existentes. |
| `apps/web-preview/public/presentation.mjs` | Asociación de marca únicamente por `sourceId`. |
| `apps/web-preview/public/brands/*` | Logotipo local y documentado de cada fuente activa. |
| `tests/web-employer-brand.test.ts` | Existencia y formato del recurso de marca. |
| `docs/fuentes-de-ofertas.md` y `docs/project-context.md` | Inventario operativo, estado verificable y funcionamiento diario. |

No se modifica `daily-offers.yml`: el workflow ya llama a `npm run ingest:daily`, que recorre `implementedSourceIds`, y publica solo si el catálogo es consistente. Añadir una fuente al runner la incorpora a los horarios diarios existentes (05:37, 07:37 y 09:37 Europe/Madrid).

### Contrato común de activación

Una empresa pasa a `active` solo si una captura pública demuestra simultáneamente:

1. listado finito y paginable, sin repetir ni truncar resultados;
2. identificador estable extraído de la URL o datos estructurados de cada ficha;
3. ficha cuyo título e ID coinciden con el listado y aporta descripción útil;
4. ubicación que acredita España; los casos ambiguos permanecen sin punto;
5. URL HTTPS del dominio oficial, sin redirecciones ni credenciales;
6. al fallar el portal, el runner informa fallo seguro y conserva la instantánea anterior.

El bloqueo HTTP, una pantalla anti-bot, una sesión obligatoria o la falta de cualquiera de esos datos no se sortean: la fuente queda fuera de `implementedSourceIds` y se documenta el canal necesario.

### Task 1: Fijar el veredicto técnico de los seis portales

**Files:**
- Create: `tests/ingestion-employer-source-eligibility.test.ts`
- Modify: `packages/ingestion/src/registry.ts`
- Modify: `docs/fuentes-de-ofertas.md`

- [ ] **Step 1: Escribir la prueba de estados y URLs oficiales antes de activar conectores.**

```ts
test('las seis fuentes solicitadas tienen un estado explícito y URL HTTPS oficial', () => {
  for (const id of ['mercadona-oficial', 'crit-oficial', 'sacyr-oficial', 'acciona-oficial', 'ferrovial-oficial', 'stef-oficial']) {
    const source = sourceRegistry.get(id);
    assert.ok(source, `${id} debe quedar inventariado`);
    assert.match(source.endpoint ?? '', /^https:\/\//);
    assert.ok(['active', 'candidate', 'authorization_required'].includes(source.status));
  }
});
```

- [ ] **Step 2: Ejecutar la prueba y comprobar el fallo inicial.**

Run: `node --test tests/ingestion-employer-source-eligibility.test.ts`

Expected: `FAIL` porque ninguno de los seis IDs está aún inventariado.

- [ ] **Step 3: Registrar las fuentes con el estado derivado de la evidencia.**

```ts
{id:'sacyr-oficial', name:'Sacyr · portal oficial', countryCode:'ES', kind:'ats', status:'active', endpoint:'https://sacyrpeople.sacyr.com/jobs?country=Spain&query=&split_view=true', licenseUrl:null},
{id:'mercadona-oficial', name:'Mercadona · portal oficial', countryCode:'ES', kind:'ats', status:'candidate', endpoint:'https://mercadona.avature.net/es_ES/Careers/SearchJobs/', licenseUrl:null},
```

Usar el mismo formato para Crit, Acciona, Ferrovial y STEF. Su estado inicial será `candidate` o `authorization_required` salvo que las pruebas de las tareas 2–4 acrediten todo el contrato común.

- [ ] **Step 4: Volver a ejecutar la prueba.**

Run: `node --test tests/ingestion-employer-source-eligibility.test.ts`

Expected: `PASS` con seis URL oficiales y sin que una fuente no validada aparezca como activa.

- [ ] **Step 5: Documentar el veredicto y hacer commit.**

Run: `git add packages/ingestion/src/registry.ts tests/ingestion-employer-source-eligibility.test.ts docs/fuentes-de-ofertas.md && git commit -m "docs: inventory requested employer portals"`

Expected: un commit que no modifica el catálogo público ni el runner.

### Task 2: Incorporar Sacyr mediante el contrato Teamtailor público

**Files:**
- Create: `packages/ingestion/src/connectors/sacyr.ts`
- Create: `tests/ingestion-sacyr.test.ts`
- Modify: `packages/ingestion/src/runner.ts`
- Modify: `packages/ingestion/src/registry.ts`

- [ ] **Step 1: Escribir pruebas de listado, detalle y rechazo de datos no españoles.**

```ts
test('Sacyr publica la captura completa España con fichas verificables', async () => {
  const jobs = await fetchSacyrOffers(checkedAt, resolveCity, fixtureFetch);
  assert.deepEqual(jobs.map(job => job.id), ['TEAMTAILOR-SACYR-8703655']);
  assert.equal(jobs[0]?.employer, 'Sacyr');
  assert.equal(jobs[0]?.sourceUrl, 'https://sacyrpeople.sacyr.com/jobs/8703655-oficial-de-1-madrid');
});

test('Sacyr rechaza fichas cuyo JobPosting no acredita España', async () => {
  await assert.rejects(() => fetchSacyrOffers(checkedAt, resolveCity, portugalFixtureFetch), /España|país/i);
});
```

- [ ] **Step 2: Ejecutar la prueba y verificar que falla por importación inexistente.**

Run: `node --test tests/ingestion-sacyr.test.ts`

Expected: `FAIL` con módulo o exportación `fetchSacyrOffers` ausente.

- [ ] **Step 3: Implementar el adaptador mínimo, sin reutilizar selectores específicos de DIA.**

```ts
export const sacyrListingUrl = 'https://sacyrpeople.sacyr.com/jobs?country=Spain&query=&split_view=true';
export async function fetchSacyrOffers(checkedAt:string, resolveCity:CityResolver, fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const listing = parseSacyrListing(await fetchHtml(sacyrListingUrl, {fetchImpl}));
  const jobs = await fetchAllSacyrDetails(listing, checkedAt, resolveCity, fetchImpl);
  if (jobs.length !== listing.total || new Set(jobs.map(job => job.id)).size !== listing.total) throw new TypeError('Captura Sacyr incompleta o duplicada');
  return jobs;
}
```

`parseSacyrListing` validará enlaces `/jobs/<id>-<slug>` en `sacyrpeople.sacyr.com`, total publicado y páginas Turbo. `adaptSacyrDetail` exigirá `JobPosting`, ID, título, fecha y dirección española. La concurrencia será de cinco fichas, como los adaptadores Teamtailor existentes.

- [ ] **Step 4: Conectar Sacyr al runner solo después de pasar las pruebas.**

```ts
import {fetchSacyrOffers} from './connectors/sacyr.ts';
// …
'sacyr-oficial',
// …
: sourceId==='sacyr-oficial'
  ? await fetchSacyrOffers(checkedAt, national?.resolveCity ?? (() => null), options.fetchImpl)
```

- [ ] **Step 5: Ejecutar pruebas específicas y de aislamiento.**

Run: `node --test tests/ingestion-sacyr.test.ts tests/ingestion-runner.test.ts`

Expected: `PASS`; si Sacyr falla, el informe queda `partial` y no se elimina ninguna oferta de otra fuente.

- [ ] **Step 6: Commit.**

Run: `git add packages/ingestion/src/connectors/sacyr.ts packages/ingestion/src/{registry,runner}.ts tests/ingestion-sacyr.test.ts tests/ingestion-runner.test.ts && git commit -m "feat: add verified Sacyr daily source"`

### Task 3: Validar Mercadona, Crit y STEF contra fichas completas

**Files:**
- Create when eligible: `packages/ingestion/src/connectors/mercadona.ts`
- Create when eligible: `packages/ingestion/src/connectors/crit.ts`
- Create when eligible: `packages/ingestion/src/connectors/stef.ts`
- Create: `tests/ingestion-mercadona.test.ts`
- Create: `tests/ingestion-crit.test.ts`
- Create: `tests/ingestion-stef.test.ts`
- Modify: `packages/ingestion/src/{registry,runner}.ts`

- [ ] **Step 1: Crear primero tres pruebas de contrato aisladas.**

Cada prueba debe incluir una primera página, una segunda página y dos fichas: una española válida y otra portuguesa, multiubicación o sin descripción. El resultado esperado será una única `PublicJob` española, con `location:null` cuando el municipio no sea inequívoco.

```ts
assert.equal(job.sourceId, 'mercadona-oficial');
assert.match(job.id, /^MERCADONA-/);
assert.equal(job.applicationRegistration, 'external_required');
assert.equal(job.location, null);
```

- [ ] **Step 2: Ejecutar los tres tests para verificar el fallo inicial.**

Run: `node --test tests/ingestion-mercadona.test.ts tests/ingestion-crit.test.ts tests/ingestion-stef.test.ts`

Expected: `FAIL` mientras no exista un parser con contrato completo.

- [ ] **Step 3: Implementar solamente los adaptadores cuya evidencia pública satisfaga el contrato.**

Mercadona deberá filtrar y volver a comprobar España por ficha Avature; Crit deberá leer el portal embebido `jobs.grupo-crit.com`, nunca la página de marketing; STEF deberá verificar si `apply.stef.jobs` proporciona listado y detalle completos, no asumir que el enlace SuccessFactors de inicio es el catálogo. Cada adaptador validará host/path antes de seguir enlaces, rechazará respuestas parciales y conservará `dateKind:'observed'` si el portal no da fecha de publicación.

- [ ] **Step 4: Mantener de forma explícita las fuentes no elegibles fuera del runner.**

```ts
const active = sourceRegistry.get('stef-oficial');
assert.notEqual(active?.status, 'active');
assert.ok(!implementedSourceIds.includes('stef-oficial'));
```

Cambiar a `active` y añadir a `implementedSourceIds` exclusivamente al mismo tiempo que sus pruebas pasan y existe una captura pública verificable.

- [ ] **Step 5: Ejecutar los tests de cada adaptador activado y el runner.**

Run: `node --test tests/ingestion-mercadona.test.ts tests/ingestion-crit.test.ts tests/ingestion-stef.test.ts tests/ingestion-runner.test.ts`

Expected: `PASS`; un portal no elegible se informa como documentado, no como una oferta parcial.

- [ ] **Step 6: Commit por fuente activada.**

Run: `git add packages/ingestion/src/connectors packages/ingestion/src/{registry,runner}.ts tests/ingestion-{mercadona,crit,stef}.test.ts tests/ingestion-runner.test.ts && git commit -m "feat: add verified employer source"`

### Task 4: Mantener Acciona y Ferrovial fuera de la ingesta hasta disponer de canal permitido

**Files:**
- Modify: `packages/ingestion/src/registry.ts`
- Modify: `docs/fuentes-de-ofertas.md`
- Test: `tests/ingestion-employer-source-eligibility.test.ts`

- [ ] **Step 1: Añadir casos de bloqueo seguro.**

```ts
assert.equal(sourceRegistry.get('ferrovial-oficial')?.status, 'authorization_required');
assert.equal(sourceRegistry.get('acciona-oficial')?.status, 'candidate');
```

- [ ] **Step 2: Ejecutar y comprobar que fallan antes de declarar el estado.**

Run: `node --test tests/ingestion-employer-source-eligibility.test.ts`

Expected: `FAIL` si el estado no refleja la evidencia observada.

- [ ] **Step 3: Registrar el motivo técnico y el criterio de salida.**

Ferrovial conserva `authorization_required` mientras su portal responda 403 al cliente automatizado; Acciona conserva `candidate` hasta identificar un listado y detalle públicos completos. No añadir `fetch` alternativo, cabeceras evasivas, cookies ni navegador automatizado para superar el bloqueo.

- [ ] **Step 4: Ejecutar prueba y commit.**

Run: `node --test tests/ingestion-employer-source-eligibility.test.ts && git add packages/ingestion/src/registry.ts docs/fuentes-de-ofertas.md tests/ingestion-employer-source-eligibility.test.ts && git commit -m "docs: record employer source eligibility"`

Expected: `PASS` y ninguna fuente bloqueada en la actualización diaria.

### Task 5: Añadir las marcas locales de las fuentes activas

**Files:**
- Create for each active source: `apps/web-preview/public/brands/<empresa>.<svg|png|jpg>`
- Modify: `apps/web-preview/public/presentation.mjs`
- Modify: `apps/web-preview/public/brands/README.md`
- Modify: `tests/web-employer-brand.test.ts`

- [ ] **Step 1: Escribir los casos de marca antes de registrar recursos.**

```ts
'sacyr-oficial':['/brands/sacyr.png','Sacyr'],
// Cada fuente activada recibe una entrada equivalente.
```

- [ ] **Step 2: Ejecutar el test y comprobar el fallo por asociación o archivo ausente.**

Run: `node --test tests/web-employer-brand.test.ts`

Expected: `FAIL` hasta que la marca local exista y `employerBrand` la devuelva por `sourceId`.

- [ ] **Step 3: Añadir el logotipo local de procedencia pública y su mapeo.**

No inferir marcas desde `employer` ni cargar imágenes de terceros en el navegador. Añadir en el README la URL de procedencia, formato y empresa.

- [ ] **Step 4: Ejecutar el test de marca.**

Run: `node --test tests/web-employer-brand.test.ts`

Expected: `PASS` con cabecera válida de cada imagen y `alt` correcto.

- [ ] **Step 5: Commit.**

Run: `git add apps/web-preview/public/{presentation.mjs,brands} tests/web-employer-brand.test.ts && git commit -m "feat: add verified employer brands"`

### Task 6: Actualizar el contexto y realizar la validación de integración

**Files:**
- Modify: `docs/fuentes-de-ofertas.md`
- Modify: `docs/project-context.md`
- Test: `tests/ingestion-*.test.ts`, `tests/web-employer-brand.test.ts`

- [ ] **Step 1: Actualizar el inventario con la evidencia real obtenida.**

Para cada fuente: URL de listado, tecnología, fecha de captura, número observado solo como fotografía temporal, regla de España, campos no verificables y estado. No declarar una fuente como diaria hasta que sea `active` en código.

- [ ] **Step 2: Actualizar `docs/project-context.md`.**

Reflejar los conectores realmente activos, los pendientes y que el workflow incorpora automáticamente solo `implementedSourceIds`; eliminar cifras obsoletas que contradigan la captura actual.

- [ ] **Step 3: Ejecutar la batería completa sin escribir sobre el catálogo de producción local.**

Run: `npm run check`

Expected: `typecheck`, tests TypeScript, OpenAPI y contratos Python finalizan correctamente.

- [ ] **Step 4: Ejecutar una captura aislada con catálogo temporal por cada fuente activa.**

Run: `node --test tests/ingestion-runner.test.ts tests/ingestion-sacyr.test.ts`

Expected: cada conector activo reconcilia solo su propio `sourceId`; un fallo deja intactos los IDs de las demás fuentes.

- [ ] **Step 5: Revisar el diff, registrar la verificación y preparar la publicación.**

Run: `git diff --check && git status --short && git add docs/fuentes-de-ofertas.md docs/project-context.md && git commit -m "docs: document employer source operations"`

Expected: árbol limpio salvo cambios deliberados, sin `calls.json` masivo ni secretos.

### Task 7: Integrar en `main` y comprobar la primera actualización real

**Files:**
- Modify: ninguna adicional; la ejecución escribe el catálogo mediante el flujo existente.

- [ ] **Step 1: Publicar los commits revisados en `main`.**

Run: `git push origin HEAD:main`

Expected: la rama remota avanza solo con código, pruebas, marcas y documentación revisados.

- [ ] **Step 2: Ejecutar manualmente `daily-offers.yml` desde GitHub Actions y esperar su informe.**

Expected: `success` o `partial` con al menos una fuente actualizada; las fallidas aparecen como advertencia y conservan la instantánea previa.

- [ ] **Step 3: Verificar ambos dominios y el catálogo.**

Run: `curl -fsS https://geoempleo360.com/data/calls.json` y `curl -fsS https://geoempleo-49978.web.app/data/calls.json`

Expected: mismo `checkedAt`, IDs únicos, catálogo no reducido por un fallo de fuente y presencia de las nuevas fuentes activas.

- [ ] **Step 4: Revisar la UI en móvil y escritorio.**

Casos: tarjeta con marca local, detalle, enlace a origen, ubicación aproximada solo cuando se verifica municipio, y filtro por empresa. Confirmar que las fuentes pendientes no se presentan como activas.

## Cobertura de la especificación

- Inclusión diaria sin afectar el catálogo existente: Tasks 1–4 y 7.
- Seis empresas y estado honesto de cada una: Tasks 1, 3 y 4.
- Logotipos coherentes con las empresas actuales: Task 5.
- Verificación de campos, España, URLs, paginación y fallos: Tasks 2–4 y 6.
- Documentación de operación y actualización automática: Task 6.
