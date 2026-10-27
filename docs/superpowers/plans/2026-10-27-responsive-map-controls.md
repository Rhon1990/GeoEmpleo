# Responsive Integral and Map Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate horizontal overflow from 320 px upward and replace the five text map actions with compact, accessible icon controls at every viewport size.

**Architecture:** Preserve the existing HTML IDs, event listeners, analytics and single Google Map. Strengthen layout containment in CSS and make the toolbar declarative with inline SVG, visually hidden labels and CSS-only tooltips; no runtime dependency or new JavaScript state is introduced.

**Tech Stack:** Semantic HTML, CSS media queries, inline SVG, Node.js test runner, TypeScript, parse5 and the existing Google Maps adapter.

---

## File map

- Modify `apps/web-preview/public/index.html`: accessible icon markup for the five map actions.
- Modify `apps/web-preview/public/styles.css`: compact toolbar, tooltips and responsive constraints.
- Modify `tests/web-brand-layout.test.ts`: structural and CSS regression contracts.
- Modify `docs/project-context.md`: record only browser behavior verified after implementation.

### Task 1: Accessible icon controls for every viewport

**Files:**
- Modify: `tests/web-brand-layout.test.ts`
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/styles.css`

- [ ] **Step 1: Write the failing structure test**

Replace the current `approvedLabels` block in `map controls overlay the single map and keep approved labels and legend` with this five-action contract:

```ts
  const approvedLabels = new Map([
    ['return-origin', 'Volver a mi ubicación'],
    ['use-location', 'Usar mi ubicación'],
    ['choose-origin', 'Elegir mi zona'],
    ['search-area', 'Actualizar esta zona'],
    ['show-all-map', 'Ver España'],
  ]);
  for (const [id, label] of approvedLabels) {
    const action = elements(mapActions).find(element => attribute(element, 'id') === id);
    assert.ok(action, `Expected #${id} inside the map overlay`);
    assert.equal(attribute(action, 'aria-label'), label);
    assert.equal(attribute(action, 'data-tooltip'), label);
    assert.equal(elements(action).filter(element => element.tagName === 'svg').length, 1);
    assert.ok(elements(action).some(element => hasClass(element, 'visually-hidden')));
    assert.equal(textContent(action).trim(), label);
  }
```

Add this CSS contract:

```ts
test('map actions are compact accessible icon buttons with focus tooltips', () => {
  const actionRule = ruleForSelector(css, '.map-actions button');
  assert.match(actionRule, /width:44px/);
  assert.match(actionRule, /height:44px/);
  assert.match(actionRule, /position:relative/);
  assert.match(ruleForSelector(css, '.map-actions button svg'), /width:22px[^}]*height:22px/);
  assert.match(css, /\.map-actions button:is\(:hover,:focus-visible\)::after\{[^}]*opacity:1/);
  assert.match(css, /\.map-actions button::after\{[^}]*content:attr\(data-tooltip\)/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/web-brand-layout.test.ts`

Expected: FAIL because current buttons have no `aria-label`, `data-tooltip`, SVG icon or 44 px contract.

- [ ] **Step 3: Replace text-only controls with semantic icon buttons**

Keep all existing IDs and disabled states. Replace the contents of `.map-actions` with:

```html
<button id="return-origin" type="button" disabled aria-label="Volver a mi ubicación" data-tooltip="Volver a mi ubicación"><svg class="map-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7H4v-5"/><path d="M4.5 7.5A8 8 0 1 1 4 15"/><path d="M12 18s4-3.6 4-7a4 4 0 1 0-8 0c0 3.4 4 7 4 7Z"/><circle cx="12" cy="11" r="1.5"/></svg><span class="visually-hidden">Volver a mi ubicación</span></button>
<button id="use-location" type="button" aria-label="Usar mi ubicación" data-tooltip="Usar mi ubicación"><svg class="map-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg><span class="visually-hidden">Usar mi ubicación</span></button>
<button id="choose-origin" type="button" disabled aria-label="Elegir mi zona" data-tooltip="Elegir mi zona"><svg class="map-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg><span class="visually-hidden">Elegir mi zona</span></button>
<button id="search-area" type="button" disabled aria-label="Actualizar esta zona" data-tooltip="Actualizar esta zona"><svg class="map-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 7v5h-5"/><path d="M18.5 12A7 7 0 1 0 17 17"/></svg><span class="visually-hidden">Actualizar esta zona</span></button>
<button id="show-all-map" type="button" disabled aria-label="Ver España" data-tooltip="Ver España"><svg class="map-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 6 5-2 8 2 5-2v14l-5 2-8-2-5 2Z"/><path d="M8 4v14M16 6v14"/></svg><span class="visually-hidden">Ver España</span></button>
```

- [ ] **Step 4: Implement the minimal toolbar and tooltip CSS**

```css
.map-actions{display:flex;gap:8px;justify-content:center;padding:6px;border:1px solid #ffffffb8;border-radius:999px;background:#ffffffde;box-shadow:0 4px 18px #0002;backdrop-filter:blur(8px)}
.map-actions button{position:relative;display:grid;place-items:center;width:44px;height:44px;flex:0 0 44px;padding:0;border:1px solid var(--line);border-radius:50%;background:#fff;color:var(--petrol);box-shadow:none}
.map-actions button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.map-actions button::after{content:attr(data-tooltip);position:absolute;top:calc(100% + 8px);left:50%;z-index:7;max-width:min(220px,calc(100vw - 24px));padding:7px 9px;border-radius:7px;background:var(--ink);color:#fff;font-size:11px;line-height:1.2;white-space:nowrap;opacity:0;pointer-events:none;transform:translate(-50%,-4px);transition:opacity .15s,transform .15s}
.map-actions button:is(:hover,:focus-visible)::after{opacity:1;transform:translate(-50%,0)}
.map-actions button:first-child::after{left:0;transform:translate(0,-4px)}
.map-actions button:first-child:is(:hover,:focus-visible)::after{transform:translate(0,0)}
.map-actions button:last-child::after{right:0;left:auto;transform:translate(0,-4px)}
.map-actions button:last-child:is(:hover,:focus-visible)::after{transform:translate(0,0)}
#search-area{background:var(--petrol);border-color:var(--petrol);color:#fff}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/web-brand-layout.test.ts`

Expected: PASS with no parsing errors.

- [ ] **Step 6: Commit Task 1**

```bash
git add tests/web-brand-layout.test.ts apps/web-preview/public/index.html apps/web-preview/public/styles.css
git commit -m "feat: compact map actions into accessible icons"
```

### Task 2: Remove responsive overflow at its source

**Files:**
- Modify: `tests/web-brand-layout.test.ts`
- Modify: `apps/web-preview/public/styles.css`

- [ ] **Step 1: Write failing containment tests**

```ts
test('filter controls constrain horizontal scrolling to the category rail', () => {
  assert.match(ruleForSelector(css, '.filter-bar'), /min-width:0/);
  assert.match(ruleForSelector(css, '.filter-controls'), /min-width:0/);
  const categories = ruleForSelector(css, '.categories');
  assert.match(categories, /width:100%/);
  assert.match(categories, /max-width:100%/);
  assert.match(categories, /overflow-x:auto/);
});

test('narrow mobile stacks flexible fields without shrinking touch controls', () => {
  const narrowRules = mediaBlockForViewport(css, 480);
  assert.ok(narrowRules, 'Expected a responsive rule that applies at 480px');
  assert.match(narrowRules, /\.proximity-bar label:first-child\{[^}]*min-width:0[^}]*width:100%/);
  assert.match(narrowRules, /\.proximity-bar label:nth-child\(2\)\{[^}]*width:100%/);
  assert.match(narrowRules, /\.map-actions\{[^}]*max-width:100%/);
  assert.doesNotMatch(narrowRules, /\.map-overlay\{[^}]*position:static/);
});

test('map offer groups stay within the visible viewport', () => {
  assert.match(ruleForSelector(css, '.map-job-group'), /max-width:min\(340px,calc\(100vw - 48px\)\)/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/web-brand-layout.test.ts`

Expected: FAIL because categories lack explicit width constraints, no 480 px contract exists and map groups have a fixed maximum.

- [ ] **Step 3: Add minimal containment rules**

```css
.filter-bar{min-width:0}
.filter-controls{min-width:0;max-width:100%}
.categories{width:100%;max-width:100%;min-width:0;overflow-x:auto;overscroll-behavior-inline:contain}
.map-job-group{max-height:300px;max-width:min(340px,calc(100vw - 48px));overflow:auto;color:var(--ink)}
.job-card,.results-heading,.detail-body,.about-content{min-width:0}
.job-card h3,.detail-body,.about-content{overflow-wrap:anywhere}
@media(max-width:780px){
  .filter-bar{align-items:stretch;flex-wrap:wrap}
  .filter-controls{width:100%}
  .map-overlay{position:absolute;top:10px;left:50%;width:calc(100% - 20px);padding:0;transform:translateX(-50%)}
  .map-actions{max-width:100%;gap:6px}
}
@media(max-width:480px){
  .site-header,.search-section{padding-inline:14px}
  .location-field,.search-button{width:100%}
  .search-button{flex-basis:100%}
  .proximity-bar label:first-child,.proximity-bar label:nth-child(2){min-width:0;width:100%}
  .proximity-bar input,.proximity-bar select{width:100%}
  .mobile-view-switch{padding-inline:14px}
  .map-actions{max-width:100%;gap:4px;padding:5px}
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/web-brand-layout.test.ts`

Expected: PASS.

- [ ] **Step 5: Run related behavior tests**

Run:

```bash
node --test tests/web-brand-layout.test.ts tests/web-map-search.test.ts tests/web-map-state.test.ts tests/web-analytics.test.ts
```

Expected: PASS; IDs, map actions and analytics remain unchanged.

- [ ] **Step 6: Commit Task 2**

```bash
git add tests/web-brand-layout.test.ts apps/web-preview/public/styles.css
git commit -m "fix: constrain responsive filters and map overlays"
```

### Task 3: Browser QA, project context and complete verification

**Files:**
- Modify: `docs/project-context.md`

- [ ] **Step 1: Start the local site without ingesting offers**

Run: `npm run dev:web`

Expected: the existing real catalog is served locally; no ingestion or Firebase deployment occurs.

- [ ] **Step 2: Validate responsive behavior in a real browser**

At 320×568, 360×800, 390×844, 768×1024, 1280×800 and 1440×900, inspect both Ofertas and Mapa with:

```js
({
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  overflowing: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  mapButtons: [...document.querySelectorAll('.map-actions button')].map(button => ({
    id: button.id,
    label: button.getAttribute('aria-label'),
    width: button.getBoundingClientRect().width,
    height: button.getBoundingClientRect().height,
  })),
})
```

Expected: `overflowing` is `false`; five labels are present; every button is at least 44 × 44 px. Confirm internal category scrolling, hover/focus tooltips, map popups and all five actions.

- [ ] **Step 3: Update project context with verified evidence**

Add only the viewport results actually observed:

```markdown
## Responsive integral y controles del mapa (27/10/2026)

Los cinco controles del mapa usan iconos SVG accesibles en escritorio y móvil, con objetivo táctil de 44 × 44 px, nombre accesible y tooltip en hover/foco. Se conservaron IDs, listeners, analítica y una sola instancia de Google Maps.

Los filtros y el carrusel de áreas quedan limitados al viewport; las categorías se desplazan dentro de su propia fila. Se verificaron 320×568, 360×800, 390×844, 768×1024, 1280×800 y 1440×900 sin desplazamiento horizontal del documento.
```

- [ ] **Step 4: Run full automated verification**

Run each command:

```bash
npm run typecheck
npm test
git diff --check
```

Expected: all exit 0, with no failed test or whitespace error.

- [ ] **Step 5: Commit verified documentation**

```bash
git add docs/project-context.md
git commit -m "docs: record verified responsive behavior"
```

- [ ] **Step 6: Request code review before integration**

Invoke `superpowers:requesting-code-review`, address any P1/P2 finding with a new RED/GREEN cycle, and rerun Step 4 before claiming completion.
