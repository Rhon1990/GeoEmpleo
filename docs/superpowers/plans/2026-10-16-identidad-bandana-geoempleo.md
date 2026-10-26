# GeoEmpleo Bandana-Inspired Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Ruta G identity and Bandana-inspired 50/50 jobs-map composition to the existing public GeoEmpleo preview without changing its real-data, search, map-cost, or no-registration contracts.

**Architecture:** Keep the existing server, API routes, single Google Maps adapter, viewport search, and job interaction state. Recompose `index.html`, derive decorative card visuals through the existing presentation module, add one small DOM-independent controller for the mobile view, and replace the current green CSS with approved brand tokens and responsive layouts.

**Tech Stack:** Semantic HTML, CSS, browser ES modules, Node.js 24 test runner, TypeScript test files, parse5, Google Maps JavaScript API.

---

## File map

| Path | Responsibility after this plan |
|---|---|
| `apps/web-preview/public/index.html` | Semantic header/search, filters, workspace, map controls, mobile selector, Ruta G SVG and dialogs |
| `apps/web-preview/public/styles.css` | Brand tokens, responsive composition, card visuals, map overlays and focus states |
| `apps/web-preview/public/presentation.mjs` | Existing labels plus deterministic decorative card theme |
| `apps/web-preview/public/workspace-view.mjs` | Mobile jobs/map mode; no map creation or fetching |
| `apps/web-preview/public/app.mjs` | Existing orchestration plus card visual markup and mobile view binding |
| `tests/web-brand-layout.test.ts` | Static semantic, brand and layout contract |
| `tests/web-presentation.test.ts` | Decorative theme and provenance contracts |
| `tests/web-workspace-view.test.ts` | Mobile view transitions and idempotence |
| `docs/project-context.md` | Verified visual state and links |

## Task 0: Protect the existing map-list baseline

**Files:**
- Inspect: `apps/web-preview/public/app.mjs`
- Inspect: `apps/web-preview/public/google-map.mjs`
- Inspect: `apps/web-preview/public/job-interaction.mjs`
- Inspect: `tests/web-job-interaction.test.ts`

- [ ] **Step 1: Record the existing dirty scope**

```
git status --short
git diff -- apps/web-preview/public/app.mjs apps/web-preview/public/google-map.mjs apps/web-preview/public/job-interaction.mjs tests/web-job-interaction.test.ts
```

Expected: the interaction changes are identifiable and no unrelated file is staged.

- [ ] **Step 2: Validate the baseline**

```
npm test
npm run typecheck
```

Expected: all Node tests pass and TypeScript reports no errors. If either fails, fix the existing interaction work before Task 1.

- [ ] **Step 3: Preserve isolation**

Never use `git add -A`. Stage only exact task paths. If the existing interaction work still lacks a checkpoint commit, finish its plan and commit it before editing the same files.

## Task 1: Lock the Ruta G identity and semantic header

**Files:**
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/styles.css`
- Create: `tests/web-brand-layout.test.ts`

- [ ] **Step 1: Write failing static tests**

Create `tests/web-brand-layout.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'parse5';

const htmlPath=new URL('../apps/web-preview/public/index.html',import.meta.url);

test('expone Ruta G y una búsqueda pública en la cabecera',async()=>{
  const html=await readFile(htmlPath,'utf8');
  parse(html);
  assert.match(html,/class="brand-mark"/);
  assert.match(html,/class="brand-geo">geo<\/span><span class="brand-empleo">empleo/);
  assert.match(html,/id="search-form"/);
  assert.match(html,/Sin registro/);
  assert.doesNotMatch(html,/class="intro"/);
});

test('mantiene una sola superficie de Google Maps',async()=>{
  const html=await readFile(htmlPath,'utf8');
  assert.equal((html.match(/id="google-map"/g)??[]).length,1);
});
```

- [ ] **Step 2: Verify failure**

```
node --test tests/web-brand-layout.test.ts
```

Expected: FAIL because `.brand-mark`, the split wordmark and hero removal are absent.

- [ ] **Step 3: Replace the old pin identity**

Use this brand markup in `index.html`:

```html
<a class="brand" href="/" aria-label="GeoEmpleo, inicio">
  <svg class="brand-mark" viewBox="0 0 56 56" aria-hidden="true">
    <path class="route" d="M42.5 18.2A18 18 0 1 0 42 39.1"/>
    <path class="destination" d="M28 28h15v11"/>
    <circle class="destination-dot" cx="43" cy="43" r="6"/>
  </svg>
  <span class="brand-name"><span class="brand-geo">geo</span><span class="brand-empleo">empleo</span></span>
</a>
```

Update the data-URI favicon with the same geometry. Move `#search-form` into `.site-header`, remove `.intro`, and retain `#query`, `#location`, submit labels, names and autocomplete. Keep `Sin registro` informational.

- [ ] **Step 4: Add approved tokens**

```css
:root{--petrol:#086071;--petrol-dark:#064b58;--saffron:#f5b944;--paper:#f4f7f6;--ink:#1b2b2d;--muted:#708083;--line:#dce4e3;--white:#fff;--focus:#0b72a7}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.site-header{min-height:76px;display:flex;align-items:center;gap:18px;padding:12px 24px;border-bottom:1px solid var(--line);background:var(--white)}
.brand{display:flex;align-items:center;gap:8px;text-decoration:none;white-space:nowrap}
.brand-mark{width:38px;height:38px;fill:none}
.brand-mark .route{stroke:var(--petrol);stroke-width:8;stroke-linecap:round}
.brand-mark .destination{stroke:var(--saffron);stroke-width:8;stroke-linecap:round;stroke-linejoin:round}
.brand-mark .destination-dot{fill:var(--saffron);stroke:#fff;stroke-width:3}
.brand-name{font-size:25px;font-weight:900;letter-spacing:-1.5px}
.brand-geo{color:var(--petrol)}.brand-empleo{color:var(--saffron)}
.open-access{margin-left:auto;border-radius:999px;background:var(--saffron);color:#392d0f;padding:10px 13px;font-size:11px;font-weight:800;white-space:nowrap}
```

- [ ] **Step 5: Verify and commit**

```
node --test tests/web-brand-layout.test.ts
npm run typecheck
git add apps/web-preview/public/index.html apps/web-preview/public/styles.css tests/web-brand-layout.test.ts
git commit -m "feat: apply Ruta G identity"
```

Expected: tests pass and only the three task paths are committed.

## Task 2: Add honest decorative card themes

**Files:**
- Modify: `apps/web-preview/public/presentation.mjs`
- Modify: `tests/web-presentation.test.ts`
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/styles.css`

- [ ] **Step 1: Write the failing test**

Extend the current named import and append:

```ts
test('deriva un tema decorativo estable sin inventar una imagen',()=>{
  assert.equal(cardVisualTheme({category:'tecnico',kind:'job'}),'technical');
  assert.equal(cardVisualTheme({category:'administracion',kind:'public_call'}),'public');
  assert.equal(cardVisualTheme({category:'unknown',kind:'job'}),'local');
});
```

- [ ] **Step 2: Verify failure**

```
node --test tests/web-presentation.test.ts
```

Expected: FAIL because `cardVisualTheme` is not exported.

- [ ] **Step 3: Implement the mapping**

```js
export function cardVisualTheme(job) {
  if(job.kind==='public_call'||job.category==='administracion')return 'public';
  if(['tecnico','industria','construccion'].includes(job.category))return 'technical';
  return 'local';
}
```

Import it in `app.mjs`. In `card(call)` prepend this block inside `.card-open`:

```js
const visual=element('div',undefined,'job-visual theme-'+cardVisualTheme(call));
visual.setAttribute('aria-hidden','true');
visual.append(element('span',call.source,'source-pill'));
button.append(visual,top,element('h3',call.title),locationLine,tags,element('p',jobPresentation(call).salaryLabel,'salary-label'));
```

Remove the old later `button.append(...)`. Do not add remote images, favorites or inferred job photos.

- [ ] **Step 4: Style the visuals and grid**

```css
.job-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.job-card{min-width:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.card-open{padding:0 14px 14px}
.job-visual{height:116px;margin:0 -14px 14px;position:relative;overflow:hidden;background:#d7e7e7}
.job-visual:before,.job-visual:after{content:"";position:absolute}
.theme-local{background:linear-gradient(#c9e2e8 0 55%,#d8cb87 56%)}
.theme-technical{background:linear-gradient(150deg,#c8dcde,#f2e6c9)}
.theme-public{background:linear-gradient(145deg,#d9e8e5,#f5e3b5)}
.source-pill{position:absolute;left:10px;top:10px;z-index:1;border-radius:999px;background:#fff;color:var(--petrol);padding:5px 8px;font-size:10px;font-weight:800;box-shadow:0 2px 8px #1232}
```

Complete pseudo-elements with simple building/landscape geometry. They remain decorative.

- [ ] **Step 5: Verify and commit**

```
node --test tests/web-presentation.test.ts tests/web-job-interaction.test.ts
npm run typecheck
git add apps/web-preview/public/presentation.mjs apps/web-preview/public/app.mjs apps/web-preview/public/styles.css tests/web-presentation.test.ts
git commit -m "feat: add honest visual job cards"
```

Expected: all checks pass.

## Task 3: Build the desktop 50/50 workspace

**Files:**
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/styles.css`
- Modify: `tests/web-brand-layout.test.ts`

- [ ] **Step 1: Extend the contract**

```ts
test('estructura resultados y mapa como superficies hermanas',async()=>{
  const html=await readFile(htmlPath,'utf8');
  assert.match(html,/class="workspace"/);
  assert.match(html,/class="results-panel"/);
  assert.match(html,/class="map-panel"/);
  assert.match(html,/id="search-area"/);
  assert.match(html,/Ubicaciones municipales aproximadas/);
});
```

- [ ] **Step 2: Verify failure**

```
node --test tests/web-brand-layout.test.ts
```

Expected: FAIL until the map legend uses the approved wording.

- [ ] **Step 3: Recompose without renaming control IDs**

Keep filters, proximity and status in one compact region. Keep `#results` and `.map-panel` as visual columns. Place `.map-actions` inside a new `.map-overlay` immediately before `#google-map`. Use labels `Volver a mi ubicación`, `Elegir mi zona`, `Rehacer en esta zona` and `Ver España` while preserving IDs. Use `Ubicaciones municipales aproximadas` in the map legend. Keep one `#google-map`.

- [ ] **Step 4: Implement the desktop layout**

```css
main{width:100%;max-width:none;padding:0}
.search-section{padding:10px 20px;background:#fff;border-bottom:1px solid var(--line)}
.workspace{display:grid;grid-template-columns:minmax(480px,1fr) minmax(480px,1fr);gap:0;min-height:calc(100dvh - 176px)}
.results-panel{padding:18px 20px;overflow:auto;max-height:calc(100dvh - 176px);background:#fff}
.map-panel{position:relative;min-width:0;border:0;border-left:1px solid var(--line);border-radius:0;overflow:hidden;background:#e9efed}
.dynamic-map{width:100%;height:100%;min-height:calc(100dvh - 176px)}
.map-overlay{position:absolute;top:12px;left:50%;z-index:5;display:flex;gap:7px;transform:translateX(-50%)}
.map-overlay button{border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);padding:9px 11px;box-shadow:0 3px 12px #0002;white-space:nowrap}
#search-area{background:var(--petrol);border-color:var(--petrol);color:#fff}
.map-footer{position:absolute;left:12px;bottom:12px;z-index:5;border-radius:8px;background:var(--petrol-dark);color:#fff;padding:9px 11px;max-width:300px}
```

Use one CSS custom property if QA needs exact header/control height. Do not recreate or reparent `#google-map` after `startMap()`.

- [ ] **Step 5: Verify and commit**

```
node --test tests/web-brand-layout.test.ts tests/web-map-state.test.ts tests/web-map-search.test.ts
npm run typecheck
git add apps/web-preview/public/index.html apps/web-preview/public/styles.css tests/web-brand-layout.test.ts
git commit -m "feat: compose jobs and map workspace"
```

Expected: all checks pass.

## Task 4: Add an accessible mobile jobs-map mode

**Files:**
- Create: `apps/web-preview/public/workspace-view.mjs`
- Create: `tests/web-workspace-view.test.ts`
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/styles.css`

- [ ] **Step 1: Write failing controller tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceView} from '../apps/web-preview/public/workspace-view.mjs';

test('cambia de vista sin notificaciones duplicadas',()=>{
  const applied:string[]=[];
  const view=createWorkspaceView(value=>applied.push(value));
  assert.equal(view.snapshot(),'jobs');
  view.select('map');view.select('map');view.select('jobs');
  assert.deepEqual(applied,['jobs','map','jobs']);
});

test('rechaza modos inexistentes',()=>{
  const view=createWorkspaceView(()=>{});
  assert.throws(()=>view.select('other'),/Modo de workspace inválido/);
});
```

- [ ] **Step 2: Verify failure**

```
node --test tests/web-workspace-view.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the controller**

```js
export function createWorkspaceView(apply,initial='jobs') {
  let current=null;
  function select(next) {
    if(next!=='jobs'&&next!=='map')throw new Error('Modo de workspace inválido');
    if(next===current)return;
    current=next;apply(current);
  }
  select(initial);
  return {select,snapshot:()=>current};
}
```

- [ ] **Step 4: Add and bind the selector**

Before `.workspace`:

```html
<div class="mobile-view-switch" role="group" aria-label="Vista principal">
  <button type="button" data-workspace-view="jobs" aria-pressed="true">Ofertas</button>
  <button type="button" data-workspace-view="map" aria-pressed="false">Mapa</button>
</div>
```

Import `createWorkspaceView` and bind once:

```js
const workspace=document.querySelector('.workspace');
const workspaceView=createWorkspaceView(view=>{
  workspace.dataset.view=view;
  for(const button of document.querySelectorAll('[data-workspace-view]'))button.setAttribute('aria-pressed',String(button.dataset.workspaceView===view));
});
document.querySelector('.mobile-view-switch').addEventListener('click',event=>{
  const button=event.target.closest('[data-workspace-view]');
  if(button)workspaceView.select(button.dataset.workspaceView);
});
```

Do not call `startMap()` from this switch.

- [ ] **Step 5: Add responsive CSS**

```css
.mobile-view-switch{display:none}
@media(max-width:780px){
  .site-header{display:grid;grid-template-columns:1fr auto}
  .site-header .search-bar{grid-column:1/-1}
  .open-access{grid-column:2;grid-row:1}
  .mobile-view-switch{display:grid;grid-template-columns:1fr 1fr;padding:8px 16px;background:#fff;border-bottom:1px solid var(--line)}
  .mobile-view-switch button[aria-pressed="true"]{background:var(--petrol);color:#fff}
  .workspace{display:block;min-height:calc(100dvh - 210px)}
  .workspace[data-view="jobs"] .map-panel,.workspace[data-view="map"] .results-panel{display:none}
  .results-panel{max-height:none;padding:14px 16px}
  .job-list{grid-template-columns:1fr}
  .map-panel,.dynamic-map{height:calc(100dvh - 210px);min-height:440px}
  .filter-bar,.proximity-bar{overflow-x:auto;flex-wrap:nowrap}
}
```

- [ ] **Step 6: Verify and commit**

```
node --test tests/web-workspace-view.test.ts tests/web-brand-layout.test.ts tests/web-map-state.test.ts
npm run typecheck
git add apps/web-preview/public/workspace-view.mjs apps/web-preview/public/index.html apps/web-preview/public/app.mjs apps/web-preview/public/styles.css tests/web-workspace-view.test.ts
git commit -m "feat: add mobile jobs map switch"
```

Expected: all checks pass and the same map instance survives view changes.

## Task 5: Finish accessibility, documentation and QA

**Files:**
- Modify: `apps/web-preview/public/styles.css`
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/app.mjs` only if QA exposes a bug
- Modify: `docs/project-context.md`

- [ ] **Step 1: Add focus and reduced motion**

```css
:where(a,button,input,select):focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.job-card{position:relative}
.job-card.selected{border-color:var(--petrol);box-shadow:0 0 0 3px #08607135,0 8px 22px #1232;transform:translateY(-1px)}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
```

Preserve `aria-current` in `syncJobInteraction` so selection does not depend on color.

- [ ] **Step 2: Verify every visible control has behavior**

```
rg -n "favorit|guardar búsqueda|registr|iniciar sesión|data-workspace-view|id=\"(search-area|return-origin|use-location|choose-origin|show-all-map)\"" apps/web-preview/public/index.html apps/web-preview/public/app.mjs
```

Expected: `Sin registro` is informational; every map/view control is bound; no favorite or save-search UI exists.

- [ ] **Step 3: Run the complete suite**

```
npm run check
```

Expected: TypeScript, Node tests, OpenAPI drift and Python contract tests pass.

- [ ] **Step 4: Perform browser QA**

Run `npm run dev:web`. Verify 1440×900, 1280×800, 1024×768, 390×844 and 360×800:

- Ruta G and split wordmark are crisp.
- Desktop has balanced columns and no hero.
- Results scroll without moving the map.
- Mobile switches views without creating a second map.
- Card and marker preview/select by pointer and keyboard.
- Detail close restores focus and clears selection.
- Loading, empty, truncated, missing-key and map-error states are legible.
- `Volver a mi ubicación` returns to the latest detected or chosen origin.
- Counts, sources and municipalities come from the local API.
- Console has no uncaught errors.

- [ ] **Step 5: Update project context**

Add design and plan links to the functional index. Append, correcting any claim that QA does not verify:

```md
## Identidad visual y composición (16/10/2026)

La web local usa la identidad Ruta G aprobada, con `geo` en petróleo (`#086071`) y `empleo` en azafrán (`#F5B944`). En escritorio integra la búsqueda en la cabecera y divide resultados y Google Maps aproximadamente al 50 %; en móvil alterna ambas superficies sin crear un segundo mapa. Las tarjetas usan tratamientos gráficos decorativos derivados de categoría, no fotografías inventadas. Se mantienen una sola carga de mapa, datos reales, procedencia, ubicaciones municipales aproximadas y acceso sin registro. Diseño: [especificación](superpowers/specs/2026-10-16-identidad-bandana-geoempleo-design.md). Implementación: [plan](superpowers/plans/2026-10-16-identidad-bandana-geoempleo.md).
```

- [ ] **Step 6: Review and commit**

```
git diff --check
git status --short
git add apps/web-preview/public/index.html apps/web-preview/public/styles.css docs/project-context.md
git commit -m "docs: record GeoEmpleo visual redesign"
```

If `app.mjs` changed during QA, include it explicitly. Confirm no secret or `.env.local` is staged.

## Final verification

- [ ] Run `npm run check` and record fresh counts.
- [ ] Confirm `git diff --check` produces no output.
- [ ] Confirm no secret or `.env.local` is staged.
- [ ] Confirm one `#google-map`, no registration flow, and no inactive controls.
- [ ] Compare the implementation with `docs/superpowers/specs/2026-10-16-identidad-bandana-geoempleo-design.md` section by section.
