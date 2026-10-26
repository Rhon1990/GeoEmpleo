# Bandana Map-List Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicar en GeoEmpleo la coordinación funcional observada en Bandana entre lista, marcadores y detalle, sin introducir registro ni cambiar el catálogo real.

**Architecture:** Mantener la búsqueda por viewport y la única instancia de Google Maps existentes. Añadir un pequeño estado de interacción compartido: el foco temporal de una tarjeta resalta el pin sin mover la cámara, mientras que la selección persistente abre el detalle y puede centrar el mapa. El adaptador de Google Maps seguirá siendo responsable solo de marcadores y cámara; `app.mjs` coordinará lista y detalle.

**Tech Stack:** JavaScript ESM, Google Maps JavaScript API, Node test runner, HTML/CSS sin framework.

---

### Task 1: Estado compartido de foco y selección

**Files:**
- Create: `apps/web-preview/public/job-interaction.mjs`
- Create: `tests/web-job-interaction.test.ts`

- [x] **Step 1: Write the failing tests**

Crear pruebas para que `preview(id)` active un foco temporal, `select(id)` establezca la selección persistente, `clearPreview(id)` restaure esa selección y `clearSelection()` deje el estado vacío.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/web-job-interaction.test.ts`
Expected: FAIL porque el módulo aún no existe.

- [x] **Step 3: Write minimal implementation**

Implementar `createJobInteraction(onChange)` con `snapshot`, `preview`, `clearPreview`, `select` y `clearSelection`. Cada cambio notifica `{selectedId, previewId, activeId}` y no notifica si el valor efectivo no cambia.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/web-job-interaction.test.ts`
Expected: PASS.

### Task 2: Separar resaltado de movimiento de cámara

**Files:**
- Modify: `apps/web-preview/public/google-map.mjs`
- Modify: `tests/web-map-state.test.ts`

- [x] **Step 1: Write the failing test**

Probar una función pura `markerVisualState(ids, selectedId, previewId)` que diferencie `selected`, `previewed` y `zIndex`, dando prioridad visual a la selección y sin implicar movimiento de cámara.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/web-map-state.test.ts`
Expected: FAIL porque `markerVisualState` no existe.

- [x] **Step 3: Write minimal implementation**

Aplicar el estado visual desde un único helper en la creación y regeneración de marcadores. Exponer `preview(id)` para resaltar sin cámara, `select(id,{pan})` para selección intencionada y `clearSelection()` para limpiar ambos estados. Conservar z-index después de una reconsulta.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/web-map-state.test.ts`
Expected: PASS.

### Task 3: Coordinar tarjetas, pines y detalle

**Files:**
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/styles.css`
- Modify: `docs/project-context.md`

- [x] **Step 1: Connect card preview and selection**

En `card(call)`, conectar `pointerenter`, `pointerleave`, `focusin` y `focusout` al estado compartido. Al hacer clic, seleccionar la oferta, centrar su pin y abrir el detalle. Añadir `aria-current` y clases visuales a la tarjeta activa.

- [x] **Step 2: Connect map selection to the list**

Cuando un pin elija una oferta, seleccionar el mismo id, abrir el detalle y llevar la tarjeta correspondiente a la zona visible de la lista sin lanzar una búsqueda nueva.

- [x] **Step 3: Make detail lifecycle consistent**

Al cerrar el detalle, abortar la petición pendiente y limpiar la selección. Corregir `aria-labelledby` también en carga y error. Evitar el doble `panTo` cuando la selección nace en el mapa.

- [x] **Step 4: Add focused visual states**

Añadir estilos para tarjeta seleccionada/previsualizada y pin previsualizado, respetando `prefers-reduced-motion`. Mantener la cuadrícula, el mapa sticky y la presentación responsive existentes.

- [x] **Step 5: Update project context**

Documentar la selección coordinada, la diferencia entre previsualización y selección, y que el hover/foco no mueve la cámara ni consume búsquedas adicionales.

- [x] **Step 6: Run focused and full verification**

Run: `node --test tests/web-job-interaction.test.ts tests/web-map-state.test.ts`
Expected: PASS.

Run: `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check`
Expected: typecheck, Node tests, OpenAPI y fixtures Python en verde.

- [x] **Step 7: Browser QA**

Validar en `http://127.0.0.1:4310/`: hover/foco no mueve el mapa, clic de tarjeta resalta pin y abre detalle, clic de pin resalta y acerca la tarjeta, cierre limpia selección, movimiento del mapa conserva la actualización por viewport y no muestra errores de consola.
