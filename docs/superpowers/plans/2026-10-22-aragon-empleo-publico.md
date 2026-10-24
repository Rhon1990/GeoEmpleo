# Aragón Public Employment Connector Implementation Plan

## Execution update — 22 October 2026

The original plan below is retained as history, not as evidence of completed activation. Live bulletin verification found that all four initially admitted candidates depend on an unlinked BOE publication for their application window. The machine-derived place counts are also incorrect (47 reported versus one actual vacancy in one bulletin). Sorting the navigable BOA URL query produces an HTTP-200 error page. See the revised specification and `docs/planning/2026-10-22-aragon-auditoria.md`.

Replacement delivery: a candidate audit parser and `audit:aragon` CLI, with source registry status `candidate`. The daily runner and public catalogue must remain unaffected. No activation, new map points, active-source attribution or automation changes until bulletin/BOE evidence verifies the application window and workplace. Estimated dates and counts remain explicitly named `reported*` in a separate operational report. Tests must prove original query order preservation, false-positive exclusion, conflict rejection and prevention of candidate ingestion. The implementation is reviewed and validated against this gate, rather than silently relaxing it to publish records.

Original tasks 2 (map placement), 3 (activation), 4 (public attribution) and 5 (public ingestion/automation) are blocked by that source-data dependency. Finish the safe audit implementation, test it and push it; leave these tasks uncompleted.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a strict, free and daily Aragón public-employment connector that publishes only current open-access calls with truthful provenance and municipal geography.

**Architecture:** A pure `adaptAragonOffers` connector validates and maps the official JSON feed into existing `PublicJob` objects. The current registry, national gazetteer, HTTP client, source reconciliation and atomic publication remain the integration boundary; web changes are limited to source attribution text.

**Tech Stack:** TypeScript 7, Node.js 24 test runner, existing ingestion runner, national gazetteer, Google Maps web preview.

---

### Task 1: Strict Aragón filtering, dates, URLs and identity

**Files:**
- Create: `packages/ingestion/src/connectors/aragon.ts`
- Create: `tests/ingestion-aragon.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Create `tests/ingestion-aragon.test.ts` with a reusable valid row and tests for public access, dates, official links, semantic false positives and deterministic deduplication:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptAragonOffers} from '../packages/ingestion/src/connectors/aragon.ts';

const checkedAt='2026-10-22T08:00:00.000Z';
const valid={
 fuente:'BOPZ',fecha_publicacion:'19/10/2026',tipo:'Libre',
 denominacion:'Ingeniero técnico industrial',organo_convocante:'AYUNTAMIENTO DE CALATAYUD',
 enlace:'http://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VERDOC&DOCR=12',
 grupo:'A2',escala:null,estado:'Abierta',fecha_inicio_presentacion:'20/10/2026',
 fecha_fin_presentacion:'17/11/2026',cuerpo:null,subescala:null,datos_contacto:null,
 uri_eli:null,titulo:'Bases de la convocatoria de pruebas selectivas para una plaza.',
 rango:'Resolución',id_orden:null,fecha_disposicion:'07/10/2026',
 plazo:'veinte días hábiles',num_plazas_detectado:1,
};

test('Aragón maps a current free-access call and upgrades its official URL',()=>{
 const jobs=adaptAragonOffers([valid],checkedAt,()=>null);
 assert.equal(jobs.length,1);
 assert.match(jobs[0]!.id,/^ARAGON-[A-F0-9]{24}$/);
 assert.equal(jobs[0]!.sourceId,'aragon-empleo-publico');
 assert.equal(jobs[0]!.sourceUrl,'https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VERDOC&DOCR=12');
 assert.equal(jobs[0]!.closingDate,'2026-11-17');
 assert.equal(jobs[0]!.places,1);
 assert.equal(jobs[0]!.salary,null);
});

test('Aragón excludes internal, expired, future and semantic false positives',()=>{
 const patches=[
  {tipo:'Interna'},
  {fecha_fin_presentacion:'21/10/2026'},
  {fecha_publicacion:'23/10/2026'},
  {fecha_inicio_presentacion:'23/10/2026'},
  {titulo:'Aprobación de la relación definitiva de personas seleccionadas.'},
  {titulo:'ANUNCIO relativo a la Ordenanza fiscal reguladora de una tasa.',denominacion:'Ordenanza fiscal'},
 ];
 for(const patch of patches) assert.equal(adaptAragonOffers([{...valid,...patch}],checkedAt,()=>null).length,0);
});

test('Aragón rejects broken eligible rows, dates and unofficial destinations',()=>{
 for(const patch of [
  {denominacion:''},
  {fecha_fin_presentacion:'31/02/2026'},
  {fecha_fin_presentacion:'18/10/2026',fecha_inicio_presentacion:'19/10/2026'},
  {enlace:'https://example.com/cgi-bin/EBOA/BRSCGI?CMD=VERDOC'},
  {enlace:'https://www.boa.aragon.es/otra-ruta'},
 ]) assert.throws(()=>adaptAragonOffers([{...valid,...patch}],checkedAt,()=>null));
 assert.throws(()=>adaptAragonOffers([],checkedAt,()=>null),/vacía/i);
 assert.throws(()=>adaptAragonOffers({},checkedAt,()=>null),/array/i);
});

test('Aragón collapses exact duplicates but keeps different positions from one bulletin',()=>{
 const same=adaptAragonOffers([valid,{...valid}],checkedAt,()=>null);
 assert.equal(same.length,1);
 const different=adaptAragonOffers([valid,{...valid,denominacion:'Arquitecto técnico'}],checkedAt,()=>null);
 assert.equal(different.length,2);
 assert.equal(new Set(different.map(job=>job.id)).size,2);
});

test('Aragón discards missing titles and only accepts bounded positive place counts',()=>{
 assert.equal(adaptAragonOffers([{...valid,denominacion:'NO INDICADO'}],checkedAt,()=>null).length,0);
 for(const value of [null,0,-1,1.5,100001,'2']) {
  assert.equal(adaptAragonOffers([{...valid,num_plazas_detectado:value}],checkedAt,()=>null)[0]!.places,null);
 }
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test tests/ingestion-aragon.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `connectors/aragon.ts`.

- [ ] **Step 3: Implement the minimal pure adapter**

Create `packages/ingestion/src/connectors/aragon.ts`. Use `dateFromSpanish`, `dateInSpain`, `canonicalUrlKey`, `record` and `requiredText`; use `createHash` from `node:crypto`. Keep network and persistence outside this file.

The implementation must contain these focused helpers and behavior:

```ts
import {createHash} from 'node:crypto';
import type {PlaceResolver} from '../geography.ts';
import type {PublicJob} from '../model.ts';
import {dateInSpain} from '../normalize.ts';
import {canonicalUrlKey,dateFromSpanish,record,requiredText} from './shared.ts';

const positive=/(?:\bconvocatoria\b|\bconvoca(?:n|da|do)?\b|proceso selectivo|pruebas selectivas|bases reguladoras|provisi[oó]n)/iu;
const negative=/(?:relaci[oó]n (?:definitiva|provisional)|admitid|excluid|seleccionad|aprobaci[oó]n definitiva|expediente del concurso|constituci[oó]n de la bolsa|ordenanza|tasa fiscal|correcci[oó]n(?!.*convocatoria))/iu;
const provincesBySource={BOPZ:'Zaragoza',BOPH:'Huesca',BOPT:'Teruel'} as const;

function normalized(value:string):string {
 return value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es-ES');
}

function officialUrl(value:unknown):string {
 let url:URL;
 try {url=new URL(requiredText(value,'Aragón'));} catch {throw new TypeError('URL Aragón no autorizada');}
 if(!['http:','https:'].includes(url.protocol)||url.hostname!=='www.boa.aragon.es'||url.port||url.username||url.password||url.pathname!=='/cgi-bin/EBOA/BRSCGI') throw new TypeError('URL Aragón no autorizada');
 url.protocol='https:';url.hash='';
 return canonicalUrlKey(url.href);
}

function identity(parts:readonly string[]):string {
 return `ARAGON-${createHash('sha256').update(parts.map(normalized).join('\u0000')).digest('hex').slice(0,24).toUpperCase()}`;
}
```

In `adaptAragonOffers`:

1. Reject non-arrays, empty arrays and arrays larger than 10,000.
2. Require every row to be an object.
3. Skip anything outside `Abierta` plus `Libre|Libre+Interna` before requiring eligible-only fields.
4. Parse all three dates and reject impossible ordering; skip rows not yet open or already closed for `dateInSpain(checkedAt)`.
5. Require positive semantics and reject negative semantics or `NO INDICADO`.
6. Canonicalize the source URL, create the fingerprint and collapse exact repeated fingerprints.
7. Create `PublicJob` with source `Gobierno de Aragón · Empleo público`, `kind: 'public_call'`, `region: 'Aragón'`, `category: 'otros'`, `regime: 'Empleo público'`, `salary: null` and `applicationRegistration: 'external_required'`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
node --test tests/ingestion-aragon.test.ts
npm run typecheck
```

Expected: all Aragón tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the adapter slice**

```bash
git add packages/ingestion/src/connectors/aragon.ts tests/ingestion-aragon.test.ts
git commit -m "feat: add strict Aragon public jobs adapter"
```

### Task 2: Municipal geography without fabricated points

**Files:**
- Modify: `packages/ingestion/src/connectors/aragon.ts`
- Modify: `tests/ingestion-aragon.test.ts`

- [ ] **Step 1: Add failing geography tests**

Append tests that assert the resolver receives `Calatayud, Zaragoza` for `BOPZ`, receives `Alcorisa, Teruel` for `AYTO. DE ALCORISA`, and is never called for a regional `BOA` record without an explicit province. Assert that the latter remains visible with `location: null`.

```ts
test('Aragón resolves only an unambiguous municipal and provincial pair',()=>{
 const point={point:[-1.643,41.353] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.test/place',sourceUpdatedAt:null,note:'aproximada'};
 const jobs=adaptAragonOffers([valid],checkedAt,(city,province)=>{
  assert.equal(city,'Calatayud');assert.equal(province,'Zaragoza');return point;
 });
 assert.deepEqual(jobs[0]!.location,point);
 assert.equal(jobs[0]!.city,'Calatayud');
 assert.equal(jobs[0]!.province,'Zaragoza');
});

test('Aragón keeps an offer without a point when workplace evidence is insufficient',()=>{
 let calls=0;
 const jobs=adaptAragonOffers([{...valid,fuente:'BOA',organo_convocante:'DEPARTAMENTO DE EDUCACIÓN'}],checkedAt,()=>{calls+=1;return null;});
 assert.equal(calls,0);assert.equal(jobs.length,1);assert.equal(jobs[0]!.location,null);
 assert.equal(jobs[0]!.region,'Aragón');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run `node --test tests/ingestion-aragon.test.ts`.

Expected: FAIL because the adapter does not yet extract or resolve municipalities.

- [ ] **Step 3: Add source-bounded location extraction**

Add a helper that maps `BOPZ`, `BOPH`, `BOPT` to province and extracts a municipality only from the beginning of the employer string:

```ts
function municipalPlace(source:string,employer:string):{city:string;province:string}|null {
 const province=provincesBySource[source as keyof typeof provincesBySource];
 if(!province)return null;
 const match=/^(?:AYUNTAMIENTO|AYTO\.?)\s+DE\s+(.+?)(?:\.\s|$)/iu.exec(employer.trim());
 const city=match?.[1]?.trim();
 return city?{city,province}:null;
}
```

Call `resolve` only for a non-null pair. Use `city = place?.city ?? 'Aragón'` and `province = place?.province ?? 'Aragón'`; never substitute Zaragoza for an unknown workplace.

- [ ] **Step 4: Verify geography and regression tests**

Run:

```bash
node --test tests/ingestion-aragon.test.ts tests/ingestion-national-geography.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the geography slice**

```bash
git add packages/ingestion/src/connectors/aragon.ts tests/ingestion-aragon.test.ts
git commit -m "feat: map verified Aragon municipalities"
```

### Task 3: Registry and daily-runner integration

**Files:**
- Modify: `packages/ingestion/src/registry.ts`
- Modify: `packages/ingestion/src/runner.ts`
- Modify: `tests/ingestion-registry.test.ts`
- Modify: `tests/ingestion-runner.test.ts`

- [ ] **Step 1: Write failing registry and runner tests**

Add registry assertions for an active `aragon-empleo-publico` source, exact endpoint and CC BY 4.0 license. Add a runner test using a temporary catalog and compressed national gazetteer; return one Aragón fixture from the injected `fetchImpl`, run twice and assert one stable Aragón ID, `success`, and one mapped point.

The test source selection must be `sourceIds:['aragon-empleo-publico']`, so it does not depend on the network or other connectors.

- [ ] **Step 2: Run the selected tests and verify RED**

Run:

```bash
node --test tests/ingestion-registry.test.ts tests/ingestion-runner.test.ts
```

Expected: FAIL because Aragón is unavailable in the registry and implemented-source union.

- [ ] **Step 3: Register and route the connector**

Add this definition before blocked commercial sources in `registry.ts`:

```ts
{
 id:'aragon-empleo-publico',
 name:'Gobierno de Aragón · Empleo público',
 countryCode:'ES',kind:'open_data',status:'active',
 endpoint:'https://opendata.aragon.es/GA_OD_Core/download?resource_id=309&formato=json',
 licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
},
```

In `runner.ts`, import `adaptAragonOffers`, append the source ID to `implementedSourceIds`, and route it before the Lanbide fallback:

```ts
if(sourceId==='aragon-empleo-publico') return adaptAragonOffers(input,checkedAt,resolve);
```

Keep UTF-8 encoding and national geography. Preserve the current seven-day missing retention used by non-Murcia sources.

- [ ] **Step 4: Verify integration and full ingestion unit suite**

Run:

```bash
node --test tests/ingestion-aragon.test.ts tests/ingestion-registry.test.ts tests/ingestion-runner.test.ts tests/ingestion-catalog.test.ts
npm run typecheck
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the runner slice**

```bash
git add packages/ingestion/src/registry.ts packages/ingestion/src/runner.ts tests/ingestion-registry.test.ts tests/ingestion-runner.test.ts
git commit -m "feat: run Aragon ingestion daily"
```

### Task 4: Public attribution and project context

**Files:**
- Modify: `apps/web-preview/public/index.html`
- Modify: `tests/web-presentation.test.ts`

- [ ] **Step 1: Add a failing presentation assertion**

In `tests/web-presentation.test.ts`, add Aragón to the existing source-attribution cases and require:

```ts
const aragon=jobPresentation({kind:'public_call',sourceId:'aragon-empleo-publico',source:'Gobierno de Aragón · Empleo público'});
assert.equal(aragon.sourceLink,'Ver anuncio original en Gobierno de Aragón · Empleo público ↗');
assert.equal(detailBadge({kind:'public_call',source:'Gobierno de Aragón · Empleo público'}),'Oferta real · Gobierno de Aragón · Empleo público');
```

- [ ] **Step 2: Run the presentation test**

Run `node --test tests/web-presentation.test.ts`.

Expected: the generic presentation may already satisfy the assertion. If it passes immediately, retain it as a contract test and do not modify `presentation.mjs`.

- [ ] **Step 3: Update visible source attribution**

Extend the catalog note in `apps/web-preview/public/index.html` to list `empleo público del Gobierno de Aragón`.

- [ ] **Step 4: Verify UI contracts**

Run:

```bash
node --test tests/web-presentation.test.ts tests/web-access.test.ts
```

Expected: all selected web tests pass.

- [ ] **Step 5: Commit attribution**

```bash
git add apps/web-preview/public/index.html tests/web-presentation.test.ts
git commit -m "feat: show Aragon source attribution"
```

### Task 5: Live source verification, national catalog and automation

**Files:**
- Modify through the ingestion command: `apps/web-preview/public/data/calls.json`
- Modify through the ingestion command: `var/ingestion/latest.json` (ignored operational evidence)
- Modify through coverage capture: `docs/planning/2026-10-20-cobertura-provincial.json`
- Modify: `docs/project-context.md`
- Modify: `docs/planning/2026-10-20-cobertura-17-comunidades.md`
- Modify: daily automation `actualizar-ofertas-reales-de-geoempleo`

- [ ] **Step 1: Run Aragón alone against the official endpoint**

Run:

```bash
node --input-type=module -e "import {resolve} from 'node:path';import {runDaily} from './packages/ingestion/src/runner.ts';const report=await runDaily({catalogPath:resolve('apps/web-preview/public/data/calls.json'),placesPath:resolve('apps/web-preview/public/data/places.json'),nationalPlacesPath:resolve('apps/web-preview/data/spain-places.json.gz'),reportPath:resolve('var/ingestion/latest.json'),sourceIds:['aragon-empleo-publico']});console.log(JSON.stringify(report,null,2));"
```

Confirm the report is `success`, `checkedAt` belongs to this run, all published Aragón rows are current, no published row has internal-only access in `selection`, IDs are unique, and every point is marked municipal approximation.

Expected: at least one valid current call from the audited 22/10/2026 feed. If strict filtering returns zero, keep the previous catalog and report the source as failed rather than weakening filters.

- [ ] **Step 2: Run the complete daily ingestion**

Run:

```bash
npm run ingest:daily
```

Expected: `SUCCESS` with five source lines. If another independent source fails, accept `partial` only after checking that its previous records were retained and Aragón succeeded.

- [ ] **Step 3: Validate catalog and regenerate coverage evidence**

Run:

```bash
npm run report:coverage --silent > /tmp/geoempleo-coverage.json
node -e "const fs=require('node:fs');const p='apps/web-preview/public/data/calls.json';const c=JSON.parse(fs.readFileSync(p,'utf8'));const ids=c.calls.map(x=>x.id);if(ids.length!==new Set(ids).size)throw Error('duplicate ids');const a=c.calls.filter(x=>x.sourceId==='aragon-empleo-publico');console.log(JSON.stringify({checkedAt:c.checkedAt,total:c.calls.length,aragon:a.length,mapped:a.filter(x=>x.location).length},null,2));"
```

Copy the validated coverage JSON without hand-editing calculated counts:

```bash
cp /tmp/geoempleo-coverage.json docs/planning/2026-10-20-cobertura-provincial.json
```

Update `docs/project-context.md` with the exact execution time, five source results, full catalog count, Aragón count and Aragón point count. Update the Aragón row in `docs/planning/2026-10-20-cobertura-17-comunidades.md` to `Sí, empleo público parcial` using the same generated counts. Preserve the statement that these public calls do not provide general private-sector coverage.

- [ ] **Step 4: Run the full verification gate**

Run:

```bash
npm run check
git diff --check
git status --short
```

Expected: TypeScript, all Node tests, OpenAPI synchronization and 76 Python fixtures pass; no whitespace errors; only intended catalog, coverage and documentation changes remain.

- [ ] **Step 5: Update the daily automation**

Use the Codex automation tool to update `actualizar-ofertas-reales-de-geoempleo`. Preserve its schedule and notification policy. Change its source inventory to SEF Murcia, ECYL Castilla y León, Lanbide, Junta de Andalucía and Gobierno de Aragón. Require `partial` reporting per failed source and keep the prohibitions on invented offers, paid APIs, cards, credentials and code modifications.

- [ ] **Step 6: Commit and push verified operational evidence**

```bash
git add apps/web-preview/public/data/calls.json docs/planning/2026-10-20-cobertura-provincial.json docs/project-context.md docs/planning/2026-10-20-cobertura-17-comunidades.md
git commit -m "data: publish verified Aragon public jobs"
git push origin codex/web-preview
```

- [ ] **Step 7: Final review**

Compare the implementation against every acceptance criterion in `docs/superpowers/specs/2026-10-22-aragon-empleo-publico-design.md`. Report exact Aragón publication/point counts, complete catalog count, test count, live-run status, pushed commit range and any residual risk from the source's machine-generated classifications.
