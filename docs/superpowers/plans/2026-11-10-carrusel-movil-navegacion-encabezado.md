# Mobile Carousel Header Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the mobile carousel arrows beside the `X de N` counter, give the offer card the full available width, and preserve the active slide across equivalent map updates.

**Architecture:** The existing carousel controller will expose a deterministic sequence comparison so `app.mjs` can avoid rebuilding unchanged slides. The mobile heading will own a compact navigation group while the track becomes a full-width block. Map summaries will continue carrying only the fields required by the reused card component, never the full description.

**Tech Stack:** JavaScript ESM, native DOM, CSS Flexbox and Scroll Snap, Node test runner, TypeScript static checks, Chrome responsive QA.

---

## File map

- Modify `apps/web-preview/public/job-projections.mjs`: include the summary fields required by `card(call)` for every mapped offer.
- Modify `apps/web-preview/public/static-data.mjs`: invalidate the browser module cache for the revised projection.
- Modify `apps/web-preview/public/mobile-offer-carousel.mjs`: compare the current ordered ID sequence without exposing DOM concerns.
- Modify `apps/web-preview/public/app.mjs`: skip slide reconstruction when IDs are unchanged and use the updated static-data cache key.
- Modify `apps/web-preview/public/index.html`: place previous/counter/next in the mobile heading and bump the app cache key.
- Modify `apps/web-preview/public/styles.css`: make the track full width and render header chevrons without visible containers.
- Modify `tests/static-delivery.test.ts`: protect the mapped-offer card projection while excluding descriptions.
- Modify `tests/web-mobile-offer-carousel.test.ts`: protect ordered-ID equality semantics.
- Modify `tests/web-brand-layout.test.ts`: protect header navigation, touch targets, full-width track and desktop isolation.
- Modify `docs/project-context.md`: describe header navigation and stable active-slide behavior.

### Task 1: Complete mapped-offer card projection

**Files:**
- Modify: `tests/static-delivery.test.ts`
- Modify: `apps/web-preview/public/job-projections.mjs`
- Modify: `apps/web-preview/public/static-data.mjs`
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/index.html`

- [x] **Step 1: Write the failing static-delivery regression test**

Extend the Villacastín fixture with `sourceUrl`, `places` and `salary`, then assert that `mapJobs[0]` contains the fields needed by the existing card:

```ts
assert.deepEqual(
  {
    sourceId:result.mapJobs[0].sourceId,
    sourceUrl:result.mapJobs[0].sourceUrl,
    province:result.mapJobs[0].province,
    category:result.mapJobs[0].category,
    categoryLabel:result.mapJobs[0].categoryLabel,
    places:result.mapJobs[0].places,
    publishedAt:result.mapJobs[0].publishedAt,
    dateKind:result.mapJobs[0].dateKind,
    checkedAt:result.mapJobs[0].checkedAt,
    salary:result.mapJobs[0].salary,
  },
  {
    sourceId:'ecyl-castilla-leon',
    sourceUrl:'https://example.com/segovia-1',
    province:'Segovia',
    category:'industria',
    categoryLabel:'Industria',
    places:1,
    publishedAt:'2026-10-20',
    dateKind:'observed',
    checkedAt:'2026-10-23T09:00:00Z',
    salary:null,
  },
);
assert.equal(result.mapJobs[0].paragraphs,undefined);
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/static-delivery.test.ts`

Expected: FAIL because the former map projection omits province, dates, category, places, salary and `sourceId`.

- [x] **Step 3: Expand only the mapped summary fields**

Use this projection in `job-projections.mjs`:

```js
const mapFields=['id','kind','source','sourceId','title','employer','city','province','category','categoryLabel','places','sourceUrl','publishedAt','dateKind','checkedAt','salary','location'];
```

Keep `paragraphs`, selection details and other full-detail fields out of `mapFields`.

- [x] **Step 4: Invalidate the static browser module chain**

Import `job-projections.mjs?v=20261110-mobile-zone-carousel` from `static-data.mjs`, import `static-data.mjs?v=20261110-mobile-zone-carousel` from `app.mjs`, and use `/app.mjs?v=20261110-mobile-zone-carousel-data` in `index.html`.

- [x] **Step 5: Run projection, store, carousel and layout tests**

Run:

```bash
node --test tests/static-delivery.test.ts tests/web-job-store.test.ts tests/web-mobile-offer-carousel.test.ts tests/web-brand-layout.test.ts
npm run typecheck
```

Expected: 55 tests pass and TypeScript reports no errors.

### Task 2: Preserve the active slide across equivalent renders

**Files:**
- Modify: `tests/web-mobile-offer-carousel.test.ts`
- Modify: `apps/web-preview/public/mobile-offer-carousel.mjs`
- Modify: `apps/web-preview/public/app.mjs`

- [ ] **Step 1: Write the failing ordered-sequence test**

Add this controller test:

```ts
test('identifies an unchanged ordered offer sequence',()=>{
  const carousel=createMobileOfferCarousel();
  assert.equal(carousel.matches([]),true);
  carousel.update(offers('a','b','c'));
  assert.equal(carousel.matches(offers('a','b','c')),true);
  assert.equal(carousel.matches(offers('b','a','c')),false);
  assert.equal(carousel.matches(offers('a','b')),false);
});
```

- [ ] **Step 2: Run the controller test and confirm RED**

Run: `node --test tests/web-mobile-offer-carousel.test.ts`

Expected: FAIL with `carousel.matches is not a function`.

- [ ] **Step 3: Implement sequence comparison in the controller**

Add a side-effect-free method beside `update`:

```js
matches(offers){
  return ids.length===offers.length&&offers.every((offer,index)=>offer.id===ids[index]);
},
```

- [ ] **Step 4: Skip equivalent DOM reconstruction**

Change `renderMobileOfferCarousel` so it updates state and controls on every render, but only replaces slides when IDs changed:

```js
function renderMobileOfferCarousel(offers){
  const sameOffers=featuredCarousel.matches(offers);
  const state=featuredCarousel.update(offers);
  featured.hidden=state.total===0;
  updateMobileCarouselControls(state);
  if(sameOffers)return;
  featuredSyncing=true;
  featuredCard.replaceChildren(...offers.map(call=>{
    const slide=element('div',undefined,'mobile-offer-slide');
    slide.append(card(call));
    return slide;
  }));
  requestAnimationFrame(()=>{
    scrollMobileCarouselTo(state,'auto');
    requestAnimationFrame(()=>{featuredSyncing=false;});
  });
}
```

- [ ] **Step 5: Run the controller and static integration tests**

Run: `node --test tests/web-mobile-offer-carousel.test.ts tests/web-brand-layout.test.ts && npm run typecheck`

Expected: all focused tests pass and equivalent renders no longer call `replaceChildren`.

### Task 3: Move navigation into the mobile heading

**Files:**
- Modify: `tests/web-brand-layout.test.ts`
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/styles.css`

- [ ] **Step 1: Replace the obsolete three-column CSS assertions with failing header assertions**

Require the new HTML and CSS contract:

```ts
assert.match(html,/class="mobile-carousel-navigation"[\s\S]*id="featured-previous"[\s\S]*id="mobile-zone-offers-counter"[\s\S]*id="featured-next"/);
assert.match(mobileRules,/\.mobile-carousel-navigation\{[^}]*display:flex[^}]*align-items:center/);
assert.match(mobileRules,/\.mobile-offer-carousel\{[^}]*display:block/);
assert.match(mobileRules,/\.mobile-carousel-arrow\{[^}]*min-width:44px[^}]*min-height:44px[^}]*border:0[^}]*background:transparent/);
assert.doesNotMatch(mobileRules,/\.mobile-carousel-arrow\{[^}]*border-radius/);
```

Retain the assertions for `overflow-x:auto`, scroll snap, visible logo, accessible labels and desktop `.mobile-featured-offer{display:none}`.

- [ ] **Step 2: Run the layout test and confirm RED**

Run: `node --test tests/web-brand-layout.test.ts`

Expected: FAIL because navigation is still rendered as three grid columns around the card.

- [ ] **Step 3: Move controls into the heading**

Use this structure inside `#mobile-featured-offer`:

```html
<div class="mobile-featured-heading">
  <strong id="mobile-zone-offers-title">Ofertas en esta zona</strong>
  <div class="mobile-carousel-navigation" aria-label="Navegar por las ofertas de esta zona">
    <button type="button" id="featured-previous" class="mobile-carousel-arrow" aria-label="Oferta anterior">‹</button>
    <span id="mobile-zone-offers-counter" aria-live="polite"></span>
    <button type="button" id="featured-next" class="mobile-carousel-arrow" aria-label="Oferta siguiente">›</button>
  </div>
  <button type="button" id="new-since" hidden>Nuevas desde mi última visita</button>
</div>
<div class="mobile-offer-carousel">
  <div id="featured-card" class="mobile-offer-track" aria-label="Ofertas visibles en el mapa"></div>
</div>
```

- [ ] **Step 4: Implement full-width track and visually minimal chevrons**

Replace the three-column rules with:

```css
.mobile-featured-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 8px}
.mobile-carousel-navigation{display:flex;align-items:center;justify-content:flex-end;gap:0}
.mobile-offer-carousel{display:block}
.mobile-carousel-arrow{min-width:44px;min-height:44px;padding:0;border:0;background:transparent;color:var(--petrol);font-size:30px;font-weight:800;line-height:1}
.mobile-carousel-arrow:disabled{color:#aebcbd;background:transparent;cursor:default}
```

Keep the track, slides, logo and hint rules unchanged. Do not add absolute positioning, circles or overlays.

- [ ] **Step 5: Run layout, controller and type checks**

Run:

```bash
node --test tests/web-brand-layout.test.ts tests/web-mobile-offer-carousel.test.ts
npm run typecheck
```

Expected: all focused tests pass and no TypeScript errors are reported.

### Task 4: Context, complete verification and browser QA

**Files:**
- Modify: `docs/project-context.md`
- Verify: `var/public-site/`

- [ ] **Step 1: Update the project context**

Record that mobile navigation lives beside `X de N`, the card uses the full track width, equivalent ID sequences preserve the active slide, mapped summaries contain card fields but not descriptions, and desktop/catalog/ingestion remain unchanged.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check
git diff --check
```

Expected: 0 failed Node tests, OpenAPI synchronized, 76 Python fixtures correct and no whitespace errors.

- [ ] **Step 3: Refresh the static preview without replacing its current catalog**

Copy the changed public assets into `var/public-site/` through the existing static build workflow, then restore the current catalog with:

```bash
node --input-type=module -e "import {prepareDailyRefresh} from './tools/prepare-daily-refresh.mjs'; console.log(await prepareDailyRefresh({catalogPath:'var/public-site/data/calls.json',force:true}));"
```

Expected: the preview reports 19,535 catalog offers and the current `checkedAt`, not the smaller source fixture.

- [ ] **Step 4: Validate mobile behavior in Chrome at 390 × 844**

Verify all of the following with the real 10-offer Villacastín viewport:

- the heading reads `10 ofertas en esta zona` and navigation reads `‹ 1 de 10 ›`;
- the card spans the available width and shows its real employer logo;
- chevrons have no visible circle, border or background;
- next changes the visible card and counter to `2 de 10`;
- a map refresh with the same IDs leaves the second card visible;
- swipe, three-dot actions and card detail remain operational;
- no title, location or logo overlaps navigation;
- the browser console has no errors.

- [ ] **Step 5: Validate desktop isolation at 1280 × 800**

Verify `#mobile-featured-offer` is hidden and the existing two-column desktop layout is unchanged.

- [ ] **Step 6: Leave the mobile preview open without publishing**

Return Chrome to 390 × 844, leave `http://127.0.0.1:4310/` open, and mark the tab as the user-facing deliverable. Do not deploy Firebase or dispatch a production workflow.

## Commit policy

Shared UI files already contain uncommitted retention-map work. Stage only the design and plan documentation commits during planning. After implementation, present the verified diff without staging shared implementation files unless the user explicitly asks for an implementation commit.
