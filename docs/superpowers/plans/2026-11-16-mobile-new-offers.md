# Mobile New Offers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Destacar las novedades bajo el mapa móvil y medir las aperturas de detalle iniciadas desde esa vista.

**Architecture:** Reutilizar el control, filtro local y evento de vista existentes. Añadir solo un evento sin parámetros a la lista segura de GA4 y emitirlo en el punto único que abre detalles. Limitar el cambio visual al CSS móvil.

**Tech Stack:** HTML/CSS, JavaScript ES modules, Firebase Analytics, Node test runner, TypeScript.

---

### Task 1: Evento seguro de apertura de novedad

**Files:**
- Modify: `tests/web-analytics.test.ts`
- Modify: `apps/web-preview/public/analytics.mjs:2`
- Modify: `apps/web-preview/public/app.mjs:428-430`

- [ ] **Step 1: Write the failing test.** Añadir al final de `tests/web-analytics.test.ts`:

```ts
test('la apertura desde novedades solo emite un evento sin datos de oferta y exige consentimiento',async()=>{
  const h=createHarness();
  const controller=createAnalyticsController({config,storage:h.storage as unknown as Storage,loadSdk:async()=>h.sdk,location:{pathname:'/'} as Location});
  assert.equal(await controller.track('new_offer_detail_opened'),false);
  await controller.accept();
  assert.equal(await controller.track('new_offer_detail_opened',{id:'privado'}),false);
  assert.equal(await controller.track('new_offer_detail_opened'),true);
  assert.deepEqual(h.calls.filter(([kind])=>kind==='event').map(([, ,name,params])=>[name,params]),[['new_offer_detail_opened',{}]]);
});
```

- [ ] **Step 2: Run `node --test tests/web-analytics.test.ts`.** Expected: new test fails because the event is not allowlisted.
- [ ] **Step 3: Add `'new_offer_detail_opened'` to `eventNames` in `analytics.mjs`.** In `showDetail(call)` after the existing `offer_detail_opened` call, add:

```js
if(newOnly&&retention.isNew(call))void analyticsController.track('new_offer_detail_opened');
```

- [ ] **Step 4: Run `node --test tests/web-analytics.test.ts`.** Expected: all tests pass.
- [ ] **Step 5: Commit the three files** with `git commit -m "feat: medir aperturas de novedades"`.

### Task 2: Botón compacto bajo el mapa

**Files:**
- Modify: `tests/web-brand-layout.test.ts`
- Modify: `apps/web-preview/public/styles.css:239-241`
- Modify: `apps/web-preview/public/index.html:19-21`

- [ ] **Step 1: Write a failing layout regression assertion** immediately after `const mobileRules=mediaBlocksForMaxWidth(css,780).join('\n');` in the mobile carousel test:

```ts
assert.match(mobileRules,/\.mobile-featured-heading #new-since\{[^}]*background:#e8f0f2[^}]*border-radius:999px[^}]*text-decoration:none/);
```

- [ ] **Step 2: Run `node --test tests/web-brand-layout.test.ts`.** Expected: the new CSS assertion fails.
- [ ] **Step 3: Extend the mobile rule `.mobile-featured-heading #new-since`** with `background:#e8f0f2`, `border:1px solid #b8d0d5`, `border-radius:999px`, `padding:6px 11px`, `min-height:34px`, `display:inline-flex`, `align-items:center`, `font-weight:700`, `text-decoration:none` and existing grid placement. Change only the cache keys of `/styles.css` and `/app.mjs` in `index.html` to `20261116-mobile-novelties`.
- [ ] **Step 4: Run `node --test tests/web-brand-layout.test.ts`.** Expected: all tests pass.
- [ ] **Step 5: Commit the three files** with `git commit -m "style: destacar novedades bajo el mapa movil"`.

### Task 3: Context and QA

**Files:**
- Modify: `docs/project-context.md`

- [ ] **Step 1: Document** that mobile shows a compact novedades button under the map and that `new_offer_detail_opened` carries no offer data and respects consent.
- [ ] **Step 2: Run `npm run typecheck`, `node --test tests/web-analytics.test.ts tests/web-brand-layout.test.ts tests/web-retention.test.ts`, and `git diff --check`.** Expected: zero failures.
- [ ] **Step 3: Review a local build** at 360 px, 780 px and desktop. Verify the button appears only with a previous visit and matching novelties, opens the filtered list, and leaves the map, carousel and catalog counts unchanged.
- [ ] **Step 4: Commit the context file** with `git commit -m "docs: registrar novedades moviles y medicion"`.

No se publica en `main` ni se despliega como parte de este plan; el usuario podrá revisar la página de pruebas primero.
