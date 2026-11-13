# GeoEmpleo360 Organic Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve GeoEmpleo360's search appearance and publish crawlable regional and sector pages without changing any offer.

**Architecture:** Keep the existing static Firebase build. The home page provides search metadata and a crawlable brand asset; a small build-time module renders only region and sector pages backed by the catalog that the protected workflow already downloads from production. The sitemap lists exactly the eligible pages; the home page keeps its existing filters and footer without a directory, per the user's preview feedback.

**Tech Stack:** HTML, CSS, Node.js 24 ESM, Node test runner, Firebase Hosting.

---

### Task 1: Home search appearance and brand assets

**Files:** `apps/web-preview/public/index.html`, `apps/web-preview/public/favicon.png`, `apps/web-preview/public/geoempleo360-logo.png`, `apps/web-preview/public/robots.txt`, `apps/web-preview/routing.mjs`, `tests/web-seo-metadata.test.ts`.

- [ ] **Step 1: Write a failing test** asserting one descriptive title and meta description, canonical apex URL, Open Graph title/description/image, `WebSite` JSON-LD, a non-`data:` PNG favicon of at least 48 × 48, `robots.txt` with the canonical sitemap, and absence of «cobertura parcial» from the home HTML. Use `readFile`, `parse5` or existing HTML test helpers and inspect PNG IHDR bytes.
- [ ] **Step 2: Run** `node --test tests/web-seo-metadata.test.ts`; expect failures on missing metadata and assets.
- [ ] **Step 3: Add** title `Ofertas de empleo en España | GeoEmpleo360`, the description from the approved spec, a self-referencing canonical, OG metadata, `WebSite` JSON-LD, and a linked `/favicon.png`. Copy the supplied brand logo from `/Users/rdelgpad/Documents/personal/GeoEmpleo/output/tiktok-ad/assets/logo.png` into tracked public assets and crop its left mark to a square PNG with `sips`, checking the result visually. Add `robots.txt` and register the new local-preview assets in `routing.mjs`. Replace the three home occurrences of «cobertura parcial» with factual source/locality wording.
- [ ] **Step 4: Run** `node --test tests/web-seo-metadata.test.ts tests/web-brand-layout.test.ts tests/web-routing.test.ts`; expect all pass. Commit the files with a focused SEO metadata message.

### Task 2: Indexable pages generated from the live catalog

**Files:** create `tools/seo-pages.mjs`, `apps/web-preview/public/seo.css`, `tests/seo-pages.test.ts`; modify `tools/build-static-site.mjs`, `apps/web-preview/public/index.html`, `tests/static-delivery.test.ts`.

- [ ] **Step 1: Write failing tests** for a catalog with 11 jobs in one region and sector plus one hostile title. Assert pages `/empleo/castilla-y-leon/index.html` and `/empleo/sector/industria/index.html` exist, use distinct titles/canonicals, escape the title, show dates and source links, and link back to `/?city=Castilla+y+Le%C3%B3n` or `/?category=industria`. Assert a group with fewer than 10 jobs produces no page or sitemap entry, and the home page shows no directory. Assert catalog bytes are unchanged.
- [ ] **Step 2: Run** `node --test tests/seo-pages.test.ts tests/static-delivery.test.ts`; expect the new assertions to fail.
- [ ] **Step 3: Implement** `seo-pages.mjs` as a pure page descriptor/HTML generator plus a writer called by `buildStaticSite`. Derive groups from actual `calls`; exclude the country label `España`, missing category, and malformed source URLs. Generate stable accent-free slugs, reject slug collisions, HTML/XML-escape all catalog fields, sort by published/detected date then ID, and display at most 20 jobs per page with honest date labels. Use only factual title, company, municipality, source and dates. Generate HTML for pages with at least 10 offers and a sitemap from the same descriptors. Add small responsive `seo.css` while preserving the existing home footer and filters.
- [ ] **Step 4: Run** `node --test tests/seo-pages.test.ts tests/static-delivery.test.ts tests/web-seo-metadata.test.ts`; expect all pass. Commit the generator, integration and tests.

### Task 3: Product context, regression and protected publication

**Files:** `docs/project-context.md`, affected tests and output assets only.

- [ ] **Step 1: Update** the project context with the public SEO routes, canonical host, favicon, daily rebuild and the explicit absence of `JobPosting` on list pages. Record that ranking and snippets remain Google-controlled.
- [ ] **Step 2: Run** `npm run typecheck`, `npm test`, `npm run check:openapi`, `git diff --check` and `npm run build:web:static` with the local Maps environment. If the sandbox blocks the one loopback API test, record that exact limitation and run the focused suites independently. Check PNG dimensions, sitemap XML, output HTML and unchanged `data/calls.json`.
- [ ] **Step 3: Use** a Firebase preview build that downloads the live public catalog. Check the home, one region, one sector and a mobile viewport; verify no offer count regression. Merge the reviewed branch to `main` and run `.github/workflows/deploy-ui.yml`. Confirm the workflow's pre/post catalog equality checks and the published pages by HTTPS.
- [ ] **Step 4: If** Google Search Console is accessible, submit `https://geoempleo360.com/sitemap.xml` and inspect the home URL. Report the observed state without promising a ranking position or a recrawl date.
