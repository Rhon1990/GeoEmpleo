# Firebase Analytics with Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in Firebase Analytics to the static GeoEmpleo site with a reversible consent choice and a strict allowlist of privacy-safe events.

**Architecture:** Keep the existing static/no-bundler architecture. Add a small consent controller and an analytics adapter; load pinned modular Firebase SDK modules only after affirmative consent, using the Firebase web config. Keep collection disabled by default, disable automatic page views/ad personalization, and emit a sanitized route plus fixed events only.

**Tech Stack:** Native browser ES modules, Firebase JavaScript SDK from official gstatic CDN (pinned version), Node built-in test runner, Firebase Hosting CSP.

---

## Files

- [x] Create `apps/web-preview/public/analytics.mjs`: consent state and allowlisted event adapter.
- [x] Modify `apps/web-preview/public/index.html`: non-blocking Spanish consent UI and a persistent privacy-settings control.
- [x] Modify `apps/web-preview/public/styles.css`: styles consistent with existing consent/dialog patterns.
- [x] Modify `apps/web-preview/public/app.mjs`: attach fixed event names to existing actions without passing free-text, offer IDs, or coordinates.
- [x] Add `apps/web-preview/firebase-web-config.json`: public Firebase web SDK configuration outside the static source directory; the static build copies it only into generated runtime config. Local development omits analytics config.
- [x] Modify `firebase.json`: allow only the SDK and collection origins required by the consent-gated Analytics module.
- [x] Modify `tests/`: add focused tests for consent lifecycle, privacy allowlist, and event payloads, including revocation during initialization.
- [x] Modify `docs/project-context.md`: record the implemented analytics behavior and setup after QA.

### Task 1: Specify consent lifecycle and event contract

- [ ] Add `tests/web-analytics.test.ts` before implementation with cases for no SDK load before acceptance, rejected state, one-time acceptance initialization, revocation, route sanitization, and disallowed event/parameter rejection.
- [ ] Run `node --test tests/web-analytics.test.ts` and confirm the expected missing-module/behavior failure.
- [ ] Implement `analytics.mjs` with injected SDK loader and storage for deterministic tests. Export `createAnalyticsController({config,storage,loadSdk,location})`; expose `initializeFromPreference()`, `accept()`, `reject()`, `revoke()`, and `track(name,params)`.
- [ ] Allow only `page_view`, `search_submitted`, `filter_used`, `offer_detail_opened`, and `map_action`; allow only enum values for `filter_type` and `action`. Do not accept free-text or IDs. Disclose that coarse country/region/city are derived by Google Analytics from the connection, never GPS or search locality.
- [ ] Run the test file and confirm every lifecycle and privacy assertion passes.

### Task 2: Integrate Firebase Analytics behind consent

- [ ] Populate `firebase-web-config.json` from the registered `GeoEmpleo Web` SDK config, keeping the public config fields required by Firebase and never printing the API key in command output; merge it into generated static `config.json` only.
- [ ] Dynamically import the pinned `firebase-app.js` and `firebase-analytics.js` only after `accepted`; call `initializeAnalytics` with `send_page_view:false`, `allow_google_signals:false`, and `allow_ad_personalization_signals:false`.
- [x] Add a no-blocking consent banner with equally clear “Aceptar analítica” and “Rechazar” controls and a persistent “Privacidad” control that reopens preferences. Explain approximate country/region/city inferred from connection, with no GPS or typed locality.
- [ ] Connect fixed telemetry events to existing submit/filter/detail/map handlers without passing search text, URL query parameters, locations, coordinates, employer values, offer IDs, or contacts.
- [ ] Run `node --test tests/web-analytics.test.ts tests/web-presentation.test.ts` and verify they pass.

### Task 3: Harden Hosting and validate production build

- [x] Update the Firebase Hosting Content Security Policy only with the Firebase CDN and Analytics collection hosts required by the pinned SDK.
- [x] Run `npm run check` and `git diff --check`.
- [x] Run `npm run build:web:static` with the current local map config; verify static build retains the privacy controls and firebase config while excluding local publish/manage pages.
- [ ] Run a local browser QA scenario: first visit shows the banner and sends no Analytics requests; reject stores the preference and sends none; accept initializes and emits only allowlisted events; privacy settings can revoke; search/map remain usable in all states.
- [x] Verify the project remains on Spark and no BigQuery, advertising, Blaze, or paid products were enabled.
- [ ] Complete browser/runtime verification, commit the reviewed implementation, and deploy to the existing Hosting live channel after checking consent, privacy settings, and existing search/map behavior.

**Expected checks:** all `npm run check` validations pass; no Analytics request before consent; live page remains functional with consent accepted or rejected; no event payload includes raw query strings, precise locations, or offer/user identifiers.
