# Offer Position and Map Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the reader's place when a job detail closes and identify the corresponding map pin with a distinct coral highlight.

**Architecture:** Extend the existing interaction state and Google Maps marker adapter. Capture the two scroll containers before opening the native dialog and restore them after focus returns. Do not pan the map for card clicks or reset results on viewport responses.

**Tech Stack:** Browser ES modules, Google Maps AdvancedMarkerElement, CSS, Node test runner, TypeScript checks.

---

### Task 1: Preserve the reading position

**Files:** `apps/web-preview/public/job-interaction.mjs`, `apps/web-preview/public/app.mjs`, `tests/web-job-interaction.test.ts`

- [ ] Add a failing test for a helper that snapshots and restores `results.scrollTop`, `carousel.scrollLeft`, and `window.scrollY` through `scrollTo(0, y)`. Run `node --test tests/web-job-interaction.test.ts` and confirm the new test fails.
- [ ] Add this small helper to `job-interaction.mjs`:

```js
export function captureDetailPosition(results,carousel,viewport=window) {
  const top=results.scrollTop;
  const left=carousel.scrollLeft;
  const y=viewport.scrollY;
  return () => {
    results.scrollTop=top;
    carousel.scrollLeft=left;
    viewport.scrollTo(0,y);
  };
}
```

- [ ] In `showDetail`, capture the position before `revealCard` or `showModal`. In the dialog `close` callback, restore it in the existing animation frame after restoring focus. Remove the unconditional `results.scrollTop=0` from viewport `onResult`; reset it only in explicit search/filter handlers. Default card selection to `panMap:false` so opening a card cannot trigger a new viewport query. Run the focused test and commit the change.

### Task 2: Identify the active offer on a shared pin

**Files:** `apps/web-preview/public/google-map.mjs`, `tests/web-map-state.test.ts`

- [ ] Add failing cases to `markerVisualState` for a selected ID, a preview ID in the same group, and an ID outside every group. The returned state must expose `activeId` (preview ID takes precedence for the label), alongside existing booleans and `zIndex`. Run `node --test tests/web-map-state.test.ts` and confirm the new cases fail.
- [ ] Update the helper and `updateMarkerVisuals` so the pin's `data-active-offer` and Advanced Marker `title` show `employer · title` for the active ID; remove the attribute and restore the group title when inactive. Build an ID lookup once in `update(calls,...)`, and store each marker's base title when created. Re-render marker visuals after map zoom as already done. Run the focused test and commit.

```js
const selected=selectedId!==null&&ids.includes(selectedId);
const previewed=previewId!==null&&ids.includes(previewId);
const activeId=previewed?previewId:selected?selectedId:null;
return {selected,previewed,activeId,zIndex:selected?100:previewed?50:1};
```

### Task 3: Make the highlight visible and persistent

**Files:** `apps/web-preview/public/styles.css`, `apps/web-preview/public/app.mjs`, `apps/web-preview/public/index.html`, `docs/project-context.md`

- [ ] Use `#B84A3A` for a selected pin fill and a preview pin border, with white text on fill; position a bounded title label above the active pin. Apply matching coral emphasis to the selected/previewed card. Keep `origin-pin` yellow. Update the CSS cache version in `index.html`.

```css
.job-pin.selected{background:#b84a3a;color:#fff}
.job-pin.previewed:not(.selected){border-color:#b84a3a;box-shadow:0 0 0 3px #b84a3a55}
.job-pin[data-active-offer]::after{content:attr(data-active-offer)}
```

- [ ] On dialog close, leave `selectedId` intact instead of calling `clearSelectionBeforeFocusRestore`; restore focus with `preventScroll` and then restore the captured position. Ensure transient hover does not hide the persistent selection. Document the verified behavior in `docs/project-context.md` and update the JS cache version in `index.html`.
- [ ] Run `node --test tests/web-job-interaction.test.ts tests/web-map-state.test.ts`, then `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check`.

### Task 4: Responsive QA and review

**Files:** no catalog or ingestion files.

- [ ] In a local preview, check 360 px, 768 px, 1024 px and 1280 px: scroll deep into offers, open/close by button and Escape, hover/focus a card, select one of several jobs sharing a pin, and navigate the mobile carousel. Confirm selected pin remains coral after closing, «Tu zona» remains yellow, and manual map dragging still updates offers.
- [ ] Inspect `git diff --check`, `git status --short`, and `git diff --stat`; confirm `data/calls.json` and daily ingestion files are untouched. Commit the UI/docs changes and report the tested result without publishing production until requested.
