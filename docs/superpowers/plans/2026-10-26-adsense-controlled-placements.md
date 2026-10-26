# AdSense Controlled Placements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one opt-in, manually placed AdSense unit to the public GeoEmpleo results list without affecting offers, map, search, or the separate Firebase Analytics consent.

**Architecture:** Keep AdSense configuration in the existing static build path. A real publisher ID may generate `ads.txt` for site verification, but no advertising SDK loads before the site is Ready. The manual slot remains disabled until the owner confirms approval, disables Auto ads and configures publisher/slot IDs. A small browser module computes one insertion point in results; Google Privacy & Messaging handles ad consent only after activation, while the current controller continues to handle analytics consent. Add a static privacy page and narrowly required hosting headers.

**Tech Stack:** Node.js ESM, native `node:test`, static HTML/CSS/JS, Firebase Hosting headers, existing `tools/build-static-site.mjs`.

---

## Files and responsibilities

- Modify `apps/web-preview/config.mjs`: validate the public AdSense publisher, slot and explicit enable flag; allow publisher-only ads.txt verification while keeping the SDK and slot disabled.
- Modify `tools/build-static-site.mjs`: include validated ad configuration in the already-public `config.json` generated during static build.
- Modify `.github/workflows/daily-offers.yml` and `.env.example`: read only the public AdSense publisher, slot and enabled flag from repository variables, preserving the disabled default in daily rebuilds.
- Create `tests/adsense.test.ts`: test configuration gating and single-slot placement.
- Create `apps/web-preview/public/adsense.mjs`: pure functions for validating the runtime config and choosing the one eligible result-list insertion point; no offer data or map logic.
- Modify `apps/web-preview/public/app.mjs`: create the unit only at the computed position and initialize the AdSense client once when runtime configuration enables it.
- Modify `apps/web-preview/public/index.html` and `styles.css`: add a separately labeled ad unit, a Google consent-revocation control, a link to the privacy page and restrained responsive styling.
- Create `apps/web-preview/public/privacy.html` and `privacy.css`: publish the Spanish privacy/cookie disclosure with Analytics and advertising consent scopes explained separately.
- Modify `firebase.json`: change `Referrer-Policy` from `no-referrer` to `strict-origin-when-cross-origin` so the Google European message can be eligible while cross-origin requests receive only the origin; add only CSP origins proven necessary by the configured AdSense/CMP code.
- Modify `tests/static-delivery.test.ts`: ensure the policy page and public config are included in the static build, and that a disabled/default build has no active advertising code.
- Modify `docs/project-context.md`: record the implemented ad integration and account/site-approval dependency after implementation.

## Task 1: Gate AdSense configuration in the static build

**Files:**
- Modify: `apps/web-preview/config.mjs`
- Modify: `tools/build-static-site.mjs`
- Modify: `.github/workflows/daily-offers.yml`
- Modify: `.env.example`
- Test: `tests/adsense.test.ts`
- Test: `tests/static-delivery.test.ts`

- [ ] **Step 1: Write failing configuration tests**

In `tests/adsense.test.ts`, import `publicAdSenseConfig` from `apps/web-preview/config.mjs` and assert:

```ts
assert.deepEqual(publicAdSenseConfig({}), {enabled:false});
assert.deepEqual(publicAdSenseConfig({GEOEMPLEO_ADSENSE_ENABLED:'true'}), {enabled:false});
assert.deepEqual(publicAdSenseConfig({GEOEMPLEO_ADSENSE_PUBLISHER_ID:'ca-pub-1234567890123456'}), {enabled:false,publisherId:'ca-pub-1234567890123456'});
assert.deepEqual(publicAdSenseConfig({GEOEMPLEO_ADSENSE_ENABLED:'true',GEOEMPLEO_ADSENSE_PUBLISHER_ID:'ca-pub-1234567890123456',GEOEMPLEO_ADSENSE_SLOT_ID:'1234567890'}), {
  enabled:true,
  publisherId:'ca-pub-1234567890123456',
  slotId:'1234567890',
});
assert.deepEqual(publicAdSenseConfig({GEOEMPLEO_ADSENSE_ENABLED:'true',GEOEMPLEO_ADSENSE_PUBLISHER_ID:'fake',GEOEMPLEO_ADSENSE_SLOT_ID:'123'}), {enabled:false});
```

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `node --test tests/adsense.test.ts`
Expected: FAIL because `publicAdSenseConfig` is not exported.

- [ ] **Step 3: Implement configuration validation**

Add `publicAdSenseConfig(environment)` in `config.mjs`. Include a publisher ID only when it matches `/^ca-pub-\d{16}$/`. Return `enabled:true` only when the explicit flag is exactly `true`, the publisher is valid and the slot ID matches `/^\d{6,20}$/`; otherwise return `{enabled:false,publisherId?}` with no slot ID. In `build-static-site.mjs`, add `adsense:publicAdSenseConfig(environment)` to `/config.json` and generate `ads.txt` only from a valid real publisher ID. The browser loads no publisher SDK or CMP before the explicit enabled state; the owner must verify the site through ads.txt, reach Ready, and disable Auto ads first.

- [ ] **Step 4: Run the targeted tests**

Run: `node --test tests/adsense.test.ts tests/static-delivery.test.ts`
Expected: PASS; missing configuration produces disabled ad configuration.

- [ ] **Step 5: Commit the configuration gate**

```bash
git add apps/web-preview/config.mjs tools/build-static-site.mjs tests/adsense.test.ts tests/static-delivery.test.ts
git commit -m "feat: gate public AdSense configuration"
```

## Task 2: Insert at most one labeled unit in results

**Files:**
- Create: `apps/web-preview/public/adsense.mjs`
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/styles.css`
- Test: `tests/adsense.test.ts`

- [ ] **Step 1: Write failing placement tests**

Test that `adInsertionIndex(count,config)` returns `null` if ads are disabled or fewer than nine offers are present; returns `8` for 9 or more results; and remains `8` for larger lists. Test that a zero-result search returns `null`.

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `node --test tests/adsense.test.ts`
Expected: FAIL because `adInsertionIndex` is not defined.

- [ ] **Step 3: Implement a single insertion point and lazy unit initialization**

In `adsense.mjs`, implement `adInsertionIndex` and a DOM initializer that receives the validated config and one existing `<ins class="adsbygoogle">` slot. Do not load any AdSense code unless `config.adsense.enabled` is true and publisher/slot IDs validate. When enabled, load `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<publisherId>` once per page, set `crossOrigin="anonymous"`, and enqueue the unit once after insertion; the account's Privacy & Messaging message handles advertising consent. On missing configuration or script failure, remove/hide the unit without changing the offers. In `app.mjs`, render the slot after result index 8 only when `config.adsense.enabled` is true; never add it to the job array, counters, map data, or detail dialog.

- [ ] **Step 4: Add accessible styling and test behavior**

Add a visible `Publicidad` label and style the block as a distinct neutral panel in the results grid. Verify `node --test tests/adsense.test.ts` passes and inspect that the `#job-list` offers remain keyed only by `data-job-id`.

- [ ] **Step 5: Commit the result-list slot**

```bash
git add apps/web-preview/public/adsense.mjs apps/web-preview/public/app.mjs apps/web-preview/public/index.html apps/web-preview/public/styles.css tests/adsense.test.ts
git commit -m "feat: add one labeled AdSense result slot"
```

## Task 3: Provide ad-consent control and privacy disclosure

**Files:**
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/styles.css`
- Create: `apps/web-preview/public/privacy.html`
- Create: `apps/web-preview/public/privacy.css`
- Test: `tests/adsense.test.ts`
- Test: `tests/static-delivery.test.ts`

- [ ] **Step 1: Write failing static and interaction tests**

Assert static source/build includes Spanish links and distinct headings for Firebase Analytics and Google advertising consent, that the revocation control calls the Google Privacy & Messaging API through `googlefc.callbackQueue.push(googlefc.showRevocationMessage)`, and that the existing Analytics consent key/behavior remains unchanged.

- [ ] **Step 2: Run targeted tests and verify the expected failure**

Run: `node --test tests/adsense.test.ts tests/static-delivery.test.ts`
Expected: FAIL because there is no privacy page or ad-consent revocation control.

- [ ] **Step 3: Add disclosure and revocation UI**

Add a static Spanish policy page describing the data used by Firebase Analytics and AdSense, Google as a third-party advertising provider, the independent purposes and consent choices, the contact address already published on the site, and how to change each preference. Add a `button` titled `Privacidad y cookies` that safely queues `googlefc.showRevocationMessage` when the API exists; hide it while AdSense is disabled. Keep current Firebase Analytics actions and persisted values unchanged. Do not load an advertising script on the privacy page.

- [ ] **Step 4: Run tests and review text and accessibility**

Run: `node --test tests/adsense.test.ts tests/static-delivery.test.ts`
Expected: PASS; links and buttons have Spanish accessible names; analytics rejection does not alter ad preference.

- [ ] **Step 5: Commit privacy controls**

```bash
git add apps/web-preview/public/index.html apps/web-preview/public/app.mjs apps/web-preview/public/styles.css apps/web-preview/public/privacy.html apps/web-preview/public/privacy.css tests/adsense.test.ts tests/static-delivery.test.ts
git commit -m "feat: add AdSense privacy controls"
```

## Task 4: Configure hosting headers and ads.txt safely

**Files:**
- Modify: `firebase.json`
- Modify: `tools/build-static-site.mjs`
- Modify: `.github/workflows/daily-offers.yml`
- Modify: `.env.example`
- Modify: `tests/static-delivery.test.ts`
- Modify: `docs/project-context.md`

- [ ] **Step 1: Write failing delivery assertions**

Assert that static output includes `privacy.html`, defaults to `adsense.enabled === false`, has no AdSense/CMP script or fabricated `ads.txt` without a valid publisher ID, and that Firebase Hosting uses `strict-origin-when-cross-origin`.

- [ ] **Step 2: Run the focused tests and verify expected failures**

Run: `node --test tests/static-delivery.test.ts`
Expected: FAIL on the privacy page/config/header assertions.

- [ ] **Step 3: Implement minimal delivery changes**

Allow the policy page through the existing static copy. Change only `Referrer-Policy` to `strict-origin-when-cross-origin`; retain all other security headers. Extend `script-src`, `connect-src`, `img-src` and `frame-src` only with hosts shown necessary by the official, account-generated AdSense/CMP code and a browser request audit. Do not introduce wildcard hosts. Generate `/ads.txt` only when a validated real publisher ID is provided, with exactly `google.com, pub-<16-digits>, DIRECT, f08c47fec0942fa0`.

- [ ] **Step 4: Verify static output and privacy boundaries**

Run: `node --test tests/static-delivery.test.ts tests/adsense.test.ts`; build a fixture with no AdSense env vars; verify `config.json` is disabled, no ad/CMP SDK is loaded, no `ads.txt` is fabricated, the privacy page exists, the map configuration remains unchanged, and user-entered query values are not present in referrer data or the policy URL. Build a second fixture with a valid publisher but no enabled slot; verify only `ads.txt` and a disabled public config are produced, with no advertising SDK/CMP or unit. Verify the daily workflow reads all three public values from `vars.*` and still passes empty values safely.

- [ ] **Step 5: Update project context and commit delivery policy**

Add a concise entry to `docs/project-context.md` explaining disabled-by-default AdSense, manual result-list slot, independent consent, privacy page, approval prerequisite, and header behavior.

```bash
git add firebase.json tools/build-static-site.mjs tests/static-delivery.test.ts docs/project-context.md
git commit -m "feat: prepare static hosting for AdSense"
```

## Task 5: Run regression checks and deployment gate

**Files:**
- Test: `tests/adsense.test.ts`
- Test: `tests/static-delivery.test.ts`
- Check: all current repository tests and static build.

- [ ] **Step 1: Run focused ad and static-delivery tests**

Run: `node --test tests/adsense.test.ts tests/static-delivery.test.ts tests/web-analytics.test.ts`
Expected: all tests pass, no network calls are needed, and Analytics consent semantics are unchanged.

- [ ] **Step 2: Run the full repository checks and static build**

Run: `npm run check` and `npm run build:web:static` with the existing local Maps configuration.
Expected: test/type/contract checks pass, the static site builds, catalog `checkedAt` is unchanged, and local submission pages remain excluded.

- [ ] **Step 3: Review production readiness without enabling ads**

Check current AdSense account/site status in the browser. Until GeoEmpleo is approved and the owner provides the actual publisher/slot configuration, keep `GEOEMPLEO_ADSENSE_ENABLED` unset and do not deploy an enabled slot. The code may be deployed in disabled state after QA, preserving current behavior. Do not enable billing, Blaze, subscriptions or payment APIs.

- [ ] **Step 4: Record final state**

Verify the working tree and tests. Report whether the current public site contains the disabled implementation or remains unchanged; distinguish code readiness from AdSense account approval and actual ad serving.

## Self-review against the approved spec

- Controlled placement, «Publicidad» label, no map/count/detail coupling: Tasks 2 and 5.
- Ad slot and SDK disabled by default until site approval and real IDs; optional ads.txt ownership verification before approval: Tasks 1, 2 and 5.
- Google CMP and independent Analytics consent: Task 3.
- Privacy disclosure and consent revocation: Task 3.
- ads.txt with real ID only: Task 4.
- Narrow CSP, referrer handling and static hosting: Task 4.
- No billing/Blaze and no impact to search/map: Tasks 1, 4 and 5.
- Automated and build verification: Task 5.
