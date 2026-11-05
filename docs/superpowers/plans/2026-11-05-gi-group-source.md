# Gi Group Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar cada día las ofertas españolas verificadas del portal oficial de Gi Group, con punto municipal cuando se pueda confirmar y logo legible.

**Architecture:** Un adaptador de listado obtiene IDs y URL de las páginas normales; otro convierte el `JobPosting` JSON-LD de cada ficha en `PublicJob`. El runner existente aísla la fuente y reconcilia su captura. Triangle permanece en el inventario como pendiente.

**Tech Stack:** TypeScript, Node 24, parse5, `node:test`, GeoEmpleo national city resolver, Firebase Hosting y GitHub Actions existentes.

---

### Task 1: Adaptar listado y detalle de Gi Group

**Files:** Create `packages/ingestion/src/connectors/gi-group.ts`; create `tests/ingestion-gi-group.test.ts`.

- [ ] **Step 1: Write failing tests** for a two-item listing fixture and a `JobPosting` fixture: the listing yields unique numeric IDs and same-host detail URLs; the detail yields `GIGROUP-104837`, title, date, province Madrid, public URL and the resolver's point. Include negatives for duplicate IDs, foreign/unknown province, ambiguous locality and expired `validThrough`.

```ts
const jobs=adaptGiGroupDetails([{id:'104837',url:'https://es.gigroup.com/ofertas-de-trabajo-detalle/example/104837/',html:jobPostingHtml}],checkedAt,resolveCity);
assert.equal(jobs[0]?.id,'GIGROUP-104837');
assert.equal(jobs[0]?.sourceUrl,'https://es.gigroup.com/ofertas-de-trabajo-detalle/example/104837/');
assert.equal(jobs[0]?.province,'Madrid');
```

- [ ] **Step 2: Run** `node --test --experimental-strip-types tests/ingestion-gi-group.test.ts`; expect a missing module or export failure.
- [ ] **Step 3: Implement minimal parser** using `documentOf`, `descendants` and `attribute` from `html-dom.ts`. Accept only `https://es.gigroup.com/ofertas-de-trabajo-detalle/<slug>/<numeric-id>/` with no credentials, port, query or fragment. Select `script[type="application/ld+json"]` with `@type: JobPosting`, check `identifier.value === id`, parse `datePosted`/`validThrough` as ISO calendar dates, require `addressRegion` to resolve with `canonicalSpanishProvince`, and call `resolveCity(addressLocality, province.name)`. Use `location:null` if the locality cannot resolve; exclude a foreign/unknown province or expired posting. Convert the published description to plain text using the shared HTML helper; keep salary null when unspecified. Preserve only factual minimum plus source link.
- [ ] **Step 4: Re-run** the focused test; expect PASS.
- [ ] **Step 5: Commit** parser and tests with `git add packages/ingestion/src/connectors/gi-group.ts tests/ingestion-gi-group.test.ts` and `git commit -m 'feat: parse Gi Group job listings and details'`.

### Task 2: Capturar el listado completo

**Files:** Modify `packages/ingestion/src/connectors/gi-group.ts`; modify `tests/ingestion-gi-group.test.ts`.

- [ ] **Step 1: Add failing fetch tests** with a stub `fetch`: two listing pages, three details, unique IDs, a missing second page, a duplicated ID, and a failed detail. The successful capture must return three jobs; every incomplete capture must reject.

```ts
const jobs=await fetchGiGroupOffers(checkedAt,resolveCity,fetchStub);
assert.equal(jobs.length,3);
await assert.rejects(()=>fetchGiGroupOffers(checkedAt,resolveCity,missingPageFetch));
```

- [ ] **Step 2: Run** the focused test; expect failure because capture is not implemented.
- [ ] **Step 3: Implement** first-page discovery of `rel="next"` and the last `?npage=N` pagination link; visit each page through the ordinary URL, never the infinite-scroll endpoint. The portal's vacancy count inflates page links; stop after two consecutive empty pages and reject any nonempty page after an empty page. Reject more than 100 pages or 2,500 IDs, duplicate IDs, HTTP errors and unexpected content type. Fetch no more than four detail pages concurrently using the existing fetch injection, timeout, size guard and HTTPS redirect policy. Retry one inconsistent full snapshot before failing the source.
- [ ] **Step 4: Run** focused tests and expect PASS.
- [ ] **Step 5: Commit** with `git add packages/ingestion/src/connectors/gi-group.ts tests/ingestion-gi-group.test.ts` and `git commit -m 'feat: capture complete Gi Group snapshot'`.

### Task 3: Integrar fuente, marca e inventario

**Files:** Modify `packages/ingestion/src/registry.ts`, `packages/ingestion/src/runner.ts`, `apps/web-preview/public/presentation.mjs`, `apps/web-preview/public/index.html`, `apps/web-preview/public/brands/README.md`, `docs/fuentes-de-ofertas.md`, `docs/project-context.md`, `tests/web-employer-brand.test.ts`; add `apps/web-preview/public/brands/gi-group.*` from the official brand asset.

- [ ] **Step 1: Add failing tests**: `sourceRegistry.get('gigroup-oficial')?.status === 'active'`, runner test routes Gi Group through `fetchGiGroupOffers`, brand mapping yields `/brands/gi-group.*` and `Gi Group`.

```ts
assert.equal(sourceRegistry.get('gigroup-oficial')?.status,'active');
assert.deepEqual(employerBrand({sourceId:'gigroup-oficial'}),{src:'/brands/gi-group.jpg',alt:'Gi Group'});
```

- [ ] **Step 2: Run** focused tests; expect missing registration/brand.
- [ ] **Step 3: Register** `gigroup-oficial` with endpoint `https://es.gigroup.com/ofertas-de-trabajo/`; include it in `implementedSourceIds`, route it to `fetchGiGroupOffers`, and leave the current reconciliation policy unchanged. Add the verified logo to `presentation.mjs`, footer attribution, brand README and source inventory. Add Triangle to the pending table with HTTP 403 evidence. Update `docs/project-context.md` as an index of actual code state.
- [ ] **Step 4: Run** focused tests and `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check`; expect all tests, contracts and fixtures to pass.
- [ ] **Step 5: Commit** the integration and documentation.

### Task 4: Validar captura y publicación

**Files:** No manual job edits; only generated catalog through the existing GitHub Actions workflow.

- [ ] **Step 1: Run isolated** `npm run ingest:daily -- --source gigroup-oficial` against a temporary catalog using the documented runner CLI; check status, unique IDs, nonempty sample, Spanish provinces and `sourceUrl` HTTP 200 for several distributed offers. If the CLI lacks this option, use its existing test/runner API with temp paths.
- [ ] **Step 2: Verify** logo visually in local preview and confirm ambiguous locations never create points.
- [ ] **Step 3: Push branch and open PR**; verify CI. Merge only after source data and URLs pass, then trigger or observe `daily-offers.yml` and verify successful deployment.
- [ ] **Step 4: Check both** `https://geoempleo360.com/data/calls.json` and `https://geoempleo-49978.web.app/data/calls.json`: matching `checkedAt`, valid JSON, unique IDs, Gi Group count and map points; verify the daily workflow includes the new source.
- [ ] **Step 5: Report** real counts and any partial-source failures. Do not count Triangle as connected.
