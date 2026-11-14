# Firebase-controlled footer ad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the sole AdSense unit before the footer and switch it from Firebase Remote Config.

**Architecture:** Keep the current publisher/slot IDs in the public static config. Add a small Remote Config adapter that supplies a boolean to the existing AdSense loader; the default is off. Mount the ad in a dedicated container outside the results and remove its old insertion path.

**Tech Stack:** Browser ES modules, Firebase Web SDK 13.1.0, Google AdSense, Node test runner, Firebase Hosting.

---

### Task 1: Remote switch

**Files:** Create `apps/web-preview/public/ad-toggle.mjs`; modify `apps/web-preview/public/app.mjs`, `firebase.json`; test `tests/adsense.test.ts`.

- [ ] Write tests first for strict `true` parsing, disabled fallback, activation and deactivation callbacks. Run `node --test tests/adsense.test.ts` and confirm a feature-specific failure.
- [ ] Implement `readAdsEnabled(value) { return value === 'true'; }` and `observeAdsToggle(firebaseConfig, onChange)` using dynamic Firebase app/remote-config imports, `fetchAndActivate`, and `onConfigUpdate`; return a cleanup function. Never import Analytics. Fail closed.
- [ ] Add the minimum Firebase Remote Config/Installations origins required by observed browser requests to CSP. Run the focused tests and confirm zero failures.

### Task 2: One responsive footer slot

**Files:** Modify `apps/web-preview/public/index.html`, `styles.css`, `app.mjs`, `adsense.mjs`; test `tests/adsense.test.ts`, `tests/static-delivery.test.ts`.

- [ ] First test that the static page has exactly one ad container after `main` and before `footer`, that `adInsertionIndex` is no longer used, and that the slot appears only after `filled`; confirm failure.
- [ ] Place `<aside id="footer-ad" aria-label="Publicidad" hidden>` between `main` and `footer`; cap visual width via CSS and collapse when hidden. Reuse `loadAdSensePublisher`, `requestAdSlot`, `watchAdStatus`; remove list insertion and ensure new slot after a disable/enable cycle.
- [ ] Run focused tests, then `npm run check` and `npm run build:web:static`. Verify no catalog or map data changes.

### Task 3: Operation and privacy

**Files:** Modify `apps/web-preview/public/privacy.html`, `docs/project-context.md`; create Firebase parameter in Console after local QA.

- [ ] Add a test asserting Remote Config disclosure and separate Analytics/advertising controls; confirm failure, then update privacy copy.
- [ ] Document `ads_footer_enabled=false`, the exact activation steps, cached/real-time propagation and the AdSense `Ready` gate. Verify the remote parameter exists and remains off in Firebase Console.
- [ ] Review the layout at 390, 768 and 1440 px and record any runtime limits. Commit implementation on the isolated branch; do not activate ads until the site is Ready.
