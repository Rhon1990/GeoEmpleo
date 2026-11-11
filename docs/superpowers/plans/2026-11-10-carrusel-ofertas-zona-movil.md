# Mobile Visible-Zone Offers Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single featured mobile offer with an accessible horizontal carousel containing every offer currently visible in the map viewport, without changing desktop.

**Architecture:** A focused `mobile-offer-carousel.mjs` controller owns only the active offer and boundary navigation. `app.mjs` composes existing `card(call)` nodes from `visibleMapJobs(...)`, synchronizes native scroll with the controller, and updates heading, counter and arrows. HTML provides stable accessible controls; CSS activates the grid-and-scroll-snap layout only below 780 px.

**Tech Stack:** JavaScript ESM, native DOM and horizontal scrolling, CSS Grid and Scroll Snap, Node test runner, TypeScript static checks.

---

## File map

- Create `apps/web-preview/public/mobile-offer-carousel.mjs`: deterministic active-offer state, preservation and boundary navigation.
- Create `tests/web-mobile-offer-carousel.test.ts`: unit coverage for update, preservation, movement and boundary states.
- Modify `apps/web-preview/public/index.html`: accessible mobile-only carousel structure and cache key.
- Modify `apps/web-preview/public/app.mjs`: render every `mapResults` offer with existing cards and synchronize controls/scroll.
- Modify `apps/web-preview/public/styles.css`: mobile-only three-column navigation, visible logos and non-overlapping scroll-snap slides.
- Modify `tests/web-brand-layout.test.ts`: static responsive and accessibility contract.
- Modify `docs/project-context.md`: record the visible-zone carousel and unchanged desktop/catalog behavior.

### Task 1: Isolated carousel state

**Files:**
- Create: `tests/web-mobile-offer-carousel.test.ts`
- Create: `apps/web-preview/public/mobile-offer-carousel.mjs`

- [x] **Step 1: Write the failing controller tests**

Add tests that establish the exact contract:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMobileOfferCarousel} from '../apps/web-preview/public/mobile-offer-carousel.mjs';

const offers=(...ids:string[])=>ids.map(id=>({id}));

test('starts at the first visible offer and exposes boundaries',()=>{
  const carousel=createMobileOfferCarousel();
  assert.deepEqual(carousel.update(offers('a','b','c')),{
    activeId:'a',index:0,total:3,hasPrevious:false,hasNext:true,
  });
});

test('preserves the active offer while it remains visible and resets otherwise',()=>{
  const carousel=createMobileOfferCarousel();
  carousel.update(offers('a','b','c'));
  carousel.select(1);
  assert.equal(carousel.update(offers('c','b','d')).activeId,'b');
  assert.equal(carousel.update(offers('x','y')).activeId,'x');
});

test('moves within boundaries and supports empty or single sets',()=>{
  const carousel=createMobileOfferCarousel();
  assert.deepEqual(carousel.update([]),{activeId:null,index:0,total:0,hasPrevious:false,hasNext:false});
  carousel.update(offers('a','b'));
  assert.equal(carousel.move(1).activeId,'b');
  assert.equal(carousel.move(1).activeId,'b');
  assert.equal(carousel.move(-1).activeId,'a');
  assert.deepEqual(carousel.update(offers('only')), {activeId:'only',index:0,total:1,hasPrevious:false,hasNext:false});
});
```

- [x] **Step 2: Run the tests and confirm RED**

Run: `node --test tests/web-mobile-offer-carousel.test.ts`

Expected: FAIL because `mobile-offer-carousel.mjs` does not exist.

- [x] **Step 3: Implement the minimal controller**

Create a module with this public API:

```js
export function createMobileOfferCarousel(){
  let ids=[];
  let activeId=null;

  const snapshot=()=>{
    const index=Math.max(0,ids.indexOf(activeId));
    const total=ids.length;
    return {activeId:total?ids[index]:null,index,total,hasPrevious:index>0,hasNext:index<total-1};
  };

  return {
    update(offers){
      ids=offers.map(offer=>offer.id);
      if(!ids.includes(activeId))activeId=ids[0]??null;
      return snapshot();
    },
    select(index){
      if(ids.length)activeId=ids[Math.max(0,Math.min(index,ids.length-1))];
      return snapshot();
    },
    move(delta){
      return this.select(snapshot().index+delta);
    },
    snapshot,
  };
}
```

- [x] **Step 4: Run the focused test and typecheck**

Run: `node --test tests/web-mobile-offer-carousel.test.ts && npm run typecheck`

Expected: all carousel tests PASS and TypeScript reports no errors.

### Task 2: Accessible mobile structure and visual contract

**Files:**
- Modify: `tests/web-brand-layout.test.ts`
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/styles.css`

- [x] **Step 1: Add failing static UI assertions**

Require the following HTML IDs and accessible labels:

```ts
for(const id of ['mobile-zone-offers-title','mobile-zone-offers-counter','featured-previous','featured-card','featured-next']){
  assert.ok(allElements.some(element=>attribute(element,'id')===id));
}
assert.equal(attribute(allElements.find(element=>attribute(element,'id')==='featured-previous')!,'aria-label'),'Oferta anterior');
assert.equal(attribute(allElements.find(element=>attribute(element,'id')==='featured-next')!,'aria-label'),'Oferta siguiente');
```

Require base desktop hiding and mobile-only layout:

```ts
assert.match(ruleForSelector(css,'.mobile-featured-offer'),/display:none/);
assert.match(mobileRules,/\.mobile-offer-carousel\{[^}]*grid-template-columns:44px minmax\(0,1fr\) 44px/);
assert.match(mobileRules,/\.mobile-offer-track\{[^}]*overflow-x:auto[^}]*scroll-snap-type:x mandatory/);
assert.match(mobileRules,/\.mobile-offer-slide\{[^}]*scroll-snap-align:start/);
assert.match(mobileRules,/\.mobile-carousel-arrow\{[^}]*min-width:44px[^}]*min-height:44px/);
assert.doesNotMatch(mobileRules,/\.mobile-carousel-arrow\{[^}]*position:absolute/);
assert.match(mobileRules,/\.mobile-featured-offer \.job-visual-frame\{[^}]*display:block/);
```

- [x] **Step 2: Run the static test and confirm RED**

Run: `node --test tests/web-brand-layout.test.ts`

Expected: FAIL because the new controls and styles do not exist.

- [x] **Step 3: Replace the featured-offer markup**

Use stable elements inside the existing `#mobile-featured-offer`:

```html
<div id="mobile-featured-offer" class="mobile-featured-offer" hidden>
  <div class="mobile-featured-heading">
    <strong id="mobile-zone-offers-title">Ofertas en esta zona</strong>
    <span id="mobile-zone-offers-counter" aria-live="polite"></span>
    <button type="button" id="new-since" hidden>Nuevas desde mi última visita</button>
  </div>
  <div class="mobile-offer-carousel">
    <button type="button" id="featured-previous" class="mobile-carousel-arrow" aria-label="Oferta anterior">‹</button>
    <div id="featured-card" class="mobile-offer-track" aria-label="Ofertas visibles en el mapa"></div>
    <button type="button" id="featured-next" class="mobile-carousel-arrow" aria-label="Oferta siguiente">›</button>
  </div>
  <p class="mobile-carousel-hint">Desliza horizontalmente o usa las flechas</p>
</div>
```

Bump both `styles.css` and `app.mjs` cache keys to `20261110-mobile-zone-carousel`.

- [x] **Step 4: Implement mobile-only non-overlapping CSS**

Keep `.mobile-featured-offer{display:none}` outside media queries. Inside `@media(max-width:780px)`, add:

```css
.mobile-offer-carousel{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:7px}
.mobile-carousel-arrow{min-width:44px;min-height:44px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--petrol);font-size:28px;font-weight:800}
.mobile-carousel-arrow:disabled{color:#aebcbd;background:#f7f9f8;cursor:default}
.mobile-offer-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:12px}
.mobile-offer-track::-webkit-scrollbar{display:none}
.mobile-offer-slide{min-width:100%;scroll-snap-align:start;scroll-snap-stop:always}
.mobile-featured-offer .job-visual-frame{display:block;height:58px}
.mobile-featured-offer .job-meta,.mobile-featured-offer .salary-label{display:none}
```

Retain compact logo sizing and remove any selector that hides `.job-visual-frame` in this block. Arrows remain normal grid children, never absolute.

- [x] **Step 5: Run the static test**

Run: `node --test tests/web-brand-layout.test.ts`

Expected: PASS with the desktop and mobile contracts intact.

### Task 3: Render all visible offers and synchronize navigation

**Files:**
- Modify: `apps/web-preview/public/app.mjs`
- Test: `tests/web-brand-layout.test.ts`
- Test: `tests/web-mobile-offer-carousel.test.ts`

- [x] **Step 1: Add failing integration-contract assertions**

Require imports and rendering from map results rather than `results[0]`:

```ts
assert.match(app,/import \{createMobileOfferCarousel\} from '\.\/mobile-offer-carousel\.mjs'/);
assert.match(app,/function renderMobileOfferCarousel\(offers\)/);
assert.match(app,/renderMobileOfferCarousel\(mapResults\)/);
assert.doesNotMatch(app,/featuredCard\.replaceChildren\(\.\.\.\(results\.length\?\[card\(results\[0\]\)\]/);
assert.match(app,/offers\.map\(call=>{[\s\S]*mobile-offer-slide/);
assert.match(app,/featuredPrevious\.addEventListener\('click'/);
assert.match(app,/featuredNext\.addEventListener\('click'/);
assert.match(app,/featuredCard\.addEventListener\('scroll'/);
```

- [x] **Step 2: Run tests and confirm RED**

Run: `node --test tests/web-brand-layout.test.ts tests/web-mobile-offer-carousel.test.ts`

Expected: the controller tests pass and integration assertions fail.

- [x] **Step 3: Wire controller and stable DOM references**

Import `createMobileOfferCarousel`, query title/counter/arrows, and instantiate the controller:

```js
import {createMobileOfferCarousel} from './mobile-offer-carousel.mjs';

const featuredTitle=document.querySelector('#mobile-zone-offers-title');
const featuredCounter=document.querySelector('#mobile-zone-offers-counter');
const featuredPrevious=document.querySelector('#featured-previous');
const featuredNext=document.querySelector('#featured-next');
const featuredCarousel=createMobileOfferCarousel();
```

- [x] **Step 4: Implement rendering and controls using existing cards**

Add helpers with these responsibilities:

```js
function updateMobileCarouselControls(state){
  featuredTitle.textContent=`${state.total} ${state.total===1?'oferta':'ofertas'} en esta zona`;
  featuredCounter.textContent=state.total?`${state.index+1} de ${state.total}`:'';
  featuredPrevious.disabled=!state.hasPrevious;
  featuredNext.disabled=!state.hasNext;
}

function scrollMobileCarouselTo(state,behavior='smooth'){
  featuredCard.scrollTo({left:state.index*featuredCard.clientWidth,behavior});
}

function renderMobileOfferCarousel(offers){
  const state=featuredCarousel.update(offers);
  featured.hidden=state.total===0;
  featuredCard.replaceChildren(...offers.map(call=>{
    const slide=element('div',undefined,'mobile-offer-slide');
    slide.append(card(call));
    return slide;
  }));
  updateMobileCarouselControls(state);
  requestAnimationFrame(()=>scrollMobileCarouselTo(state,'auto'));
}
```

Arrow handlers call `featuredCarousel.move(-1|1)`, update controls and scroll. A requestAnimationFrame-throttled scroll handler calculates `Math.round(featuredCard.scrollLeft/featuredCard.clientWidth)`, calls `select(index)`, then updates controls. Use `matchMedia('(prefers-reduced-motion: reduce)')` to choose `auto` instead of smooth movement.

- [x] **Step 5: Render map-visible offers**

Replace the existing first-result rendering in `render()`:

```js
renderMobileOfferCarousel(mapResults);
```

Do not alter `results`, `displayed`, the desktop `list`, `mapResults`, catalog totals or map markers.

- [x] **Step 6: Run focused tests and typecheck**

Run: `node --test tests/web-mobile-offer-carousel.test.ts tests/web-brand-layout.test.ts && npm run typecheck`

Expected: all focused tests PASS and TypeScript reports no errors.

### Task 4: Documentation, build and QA

**Files:**
- Modify: `docs/project-context.md`
- Verify: `var/public-site/`

- [ ] **Step 1: Update project context**

Replace the statement that mobile shows one compact first offer with an explicit record that mobile shows all `visibleMapJobs` offers in a non-looping carousel, preserves the active ID when possible, includes logos and external arrow gutters, and leaves desktop/catalog/ingestion unchanged.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check
git diff --check
```

Expected: 0 failed Node tests, OpenAPI synchronized, 76 Python fixtures correct and no whitespace errors.

- [ ] **Step 3: Build the static preview and restore the current public catalog**

Run:

```bash
GEOEMPLEO_ENV_FILE=/Users/rdelgpad/Documents/personal/GeoEmpleo/.env.local npm run build:web:static
node --input-type=module -e "import {prepareDailyRefresh} from './tools/prepare-daily-refresh.mjs'; console.log(await prepareDailyRefresh({catalogPath:'var/public-site/data/calls.json',force:true}));"
```

Expected: static build succeeds, then `var/public-site/data/calls.json` reports the current HTTPS `checkedAt` and offer count rather than the stale 2,806-offer local snapshot.

- [ ] **Step 4: Manual responsive QA**

At 390 × 844 verify:

- heading and `X de N` match the visible map offers;
- actual company logo is visible;
- arrows never cover title or locality;
- previous/next disable at boundaries;
- swipe updates the counter;
- three-dot actions and card detail work from non-first slides;
- moving the map updates the carousel and preserves the active ID only if still present.

At 1280 × 800 verify no carousel or arrows are visible and the two-column desktop remains unchanged. Confirm zero browser console errors.

- [ ] **Step 5: Leave the local preview open without publishing**

Keep `http://127.0.0.1:4310/` open in Chrome at mobile dimensions and mark the tab as the user-facing deliverable. Do not run Firebase deploy, GitHub workflow dispatch or any production mutation.

## Commit policy for this worktree

`app.mjs`, `styles.css`, `index.html`, `tests/web-brand-layout.test.ts` and `docs/project-context.md` already contain uncommitted work from the same retention-map effort. Do not stage those files wholesale or mix unrelated hunks into a carousel commit. Finish and verify the implementation, then present the diff for review; create an implementation commit only after the existing shared-file changes have been intentionally grouped.
