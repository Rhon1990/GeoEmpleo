# Grupo Eulen Taleo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish current Spanish Grupo Eulen vacancies from Taleo in GeoEmpleo360 with verified municipal map points and daily updates.

**Architecture:** A dedicated `taleo-eulen` adapter opens an anonymous session, pages through Taleo's public JSON search and reads each public detail page. The existing runner reconciles this source independently, preserving the last good capture on failure.

**Tech Stack:** Node 24 fetch, TypeScript, parse5, node:test, existing national gazetteer and Firebase Hosting workflow.

---

## File map

- Create `packages/ingestion/src/connectors/eulen-taleo.ts`: session, pagination, detail parsing and job adaptation.
- Create `tests/ingestion-eulen-taleo.test.ts`: protocol and data integrity cases.
- Modify `packages/ingestion/src/registry.ts` and `runner.ts`: activate `taleo-eulen` with the existing source isolation.
- Modify `docs/fuentes-de-ofertas.md` and `docs/project-context.md`: list the new source and observed run only after verification.
- Reuse existing Eulen logo and map projection; no new UI component.

### Task 1: Parse and validate one Taleo detail

- [ ] Write failing tests with HTML fixtures containing `reqSiteCity.row1`, `reqSiteZipCode.row1`, `reqPostingDate.row1`, `reqTitleLinkAction.row1`, description and requirements. Assert `EULEN-TALEO-260007QU`, source URL, municipality point for Alhama de Murcia, and `location:null` for an ambiguous/multiple site.
- [ ] Run `node --test tests/ingestion-eulen-taleo.test.ts` and confirm the new adapter is missing.
- [ ] Implement `adaptEulenTaleoDetail(offer, html, checkedAt, resolveCity)` using `documentOf`, `descendants`, `attribute`, `textOf`, `canonicalSpanishProvince` and `dateFromSpanish`. Only `https://eulen.taleo.net/careersection/eul_career_site/jobdetail.ftl?job=<validatedContestNo>&lang=es` is accepted.
- [ ] Run the focused test; commit parser and tests.

### Task 2: Capture a complete anonymous Taleo snapshot

- [ ] Write failing fetch tests: GET listing sets an anonymous cookie; POST uses it and submits `{fieldData:{fields:{KEYWORD:'',ORGANIZATION:'',CATEGORY:''},valid:true},filterSelectionParam:{searchFilterSelections:[]},sortingSelection:{sortBySelectionParam:'1',ascendingSortingOrder:'false'},pageNo}`. Assert all `pagingData.totalCount` entries are read once, duplicate IDs or truncated pages reject the capture, and a request failure does not produce a partial source result.
- [ ] Run the focused test and verify failure.
- [ ] Implement `fetchEulenTaleoOffers(checkedAt, resolveCity, fetchImpl=fetch)`: extract only safe `Set-Cookie` name/value pairs from the anonymous GET, page through the official JSON endpoint, verify `currentPageNo`, `pageSize`, stable `totalCount`, and distinct `contestNo`, then fetch detail pages with bounded concurrency and retry only transient failures. Reject unexpected content type, redirected URL, oversized responses and malformed identity.
- [ ] Run focused tests and commit capture code.

### Task 3: Integrate and verify daily publication

- [ ] Write a failing registry/runner test asserting `taleo-eulen` is active and its jobs are reconciled independently of `selectminds-eulen`.
- [ ] Run the focused test and verify failure.
- [ ] Add `taleo-eulen` to the registry and `implementedSourceIds`/dispatch in the runner; keep existing SelectMinds source. The existing ATS `missingRetentionDays:0` removes stale Taleo IDs only after a complete successful capture.
- [ ] Run `npm run typecheck`, `node --test tests/ingestion-eulen-taleo.test.ts` and `npm test`. Update source inventory and project context with the measured count. Commit.
- [ ] Run a real source-only capture into temporary files, verify IDs unique, links official and mapped points within the published municipality. Compare captured IDs to Taleo's announced total; investigate any gap before publishing.
- [ ] Push branch, create/review PR, integrate to `main`, run the existing daily GitHub Action, and verify both `https://geoempleo360.com/data/calls.json` and the map show the newly captured Eulen offers. Report exact observed totals and any exclusions.

## Risks and release gate

Never use a province center as a municipal point. If Taleo changes its session API or the count changes mid-capture, the source fails closed and its previous catalog remains. Do not claim full coverage or deploy until a real run confirms the pagination and public HTTPS catalog.
