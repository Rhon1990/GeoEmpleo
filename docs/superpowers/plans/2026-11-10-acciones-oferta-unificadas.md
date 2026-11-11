# Acciones de oferta unificadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar favorito, compartir y ubicación de forma coherente en el menú de tarjeta, el detalle y el diálogo de favoritos, con distancia contextual y eliminación mediante X.

**Architecture:** `app.mjs` reutilizará constructores pequeños para compartir y ubicación. Cada superficie compondrá esos controles según su densidad, sin guardar coordenadas nuevas. `styles.css` definirá una barra equilibrada para el detalle y grupos compactos para menú y favoritos.

**Tech Stack:** JavaScript ESM, DOM nativo, CSS responsive, Node test runner y SVG locales de Google Material Symbols.

---

### Task 1: Contrato visual y recursos

**Files:**
- Modify: `tests/web-brand-layout.test.ts`
- Create: `apps/web-preview/public/icons/material-symbols/location-on.svg`
- Create: `apps/web-preview/public/icons/material-symbols/close.svg`

- [x] **Step 1: Write the failing test**

Añadir aserciones que exijan `location-on.svg`, `close.svg`, tres acciones en `offerActionsMenu`, tres controles secundarios en `detailActions` y un grupo `.saved-offer-actions` con botón `.remove-saved-offer` sin texto visible.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/web-brand-layout.test.ts`
Expected: FAIL porque los dos SVG y los constructores compartidos todavía no existen.

- [x] **Step 3: Add the official icons**

Descargar `location_on_24px.svg` y `close_24px.svg` desde `google/material-design-icons/symbols/web/*/materialsymbolsoutlined/` y documentarlos en `icons/material-symbols/README.md`.

- [x] **Step 4: Run the focused test again**

Run: `node --test tests/web-brand-layout.test.ts`
Expected: sigue fallando por el comportamiento pendiente, confirmando que los recursos por sí solos no satisfacen el contrato.

### Task 2: Acciones compartidas y composición

**Files:**
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/styles.css`
- Modify: `apps/web-preview/public/index.html`
- Test: `tests/web-brand-layout.test.ts`

- [x] **Step 1: Implement shared helpers**

Crear `offerDistanceLabel(call)`, `offerMapLink(call,{compact})` y `shareOfferButton(call,{status,compact})`. La distancia usará `distanceKm(origin,call.location?.point)` y `Intl.NumberFormat('es-ES',{maximumFractionDigits:1})`; el fallback será «Abrir ubicación».

- [x] **Step 2: Compose all surfaces**

El menú añadirá favorito, compartir y ubicación. El detalle conservará la CTA original a todo el ancho y debajo mostrará tres controles iguales. Cada fila guardada incluirá apertura del detalle y un grupo con compartir, ubicación y X para eliminar.

- [x] **Step 3: Add responsive styles**

Usar `.detail-secondary-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}` y controles de al menos 44 px. En favoritos, usar `.saved-offer-actions` con botones cuadrados de 44 px y `.remove-saved-offer` en rojo. Mantener foco visible y texto ajustable.

- [x] **Step 4: Bump cache keys and pass the focused test**

Run: `node --test tests/web-brand-layout.test.ts && npm run typecheck`
Expected: PASS sin errores.

### Task 3: Documentación y verificación

**Files:**
- Modify: `docs/project-context.md`
- Test: `tests/*.test.ts`

- [x] **Step 1: Update project context**

Documentar las tres superficies, el fallback municipal, la distancia efímera y la X accesible.

- [x] **Step 2: Build and restore the current preview catalog**

Run: `GEOEMPLEO_ENV_FILE=/Users/rdelgpad/Documents/personal/GeoEmpleo/.env.local npm run build:web:static`
Expected: build estático correcto; después se recupera el catálogo HTTPS vigente únicamente en `var/public-site/data/calls.json`.

- [x] **Step 3: Run full verification**

Run: `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check && git diff --check`
Expected: cero fallos, OpenAPI coincidente y fixtures Python correctos.

- [x] **Step 4: Verify desktop and mobile preview**

Abrir menú de tres puntos, detalle y favoritos a 390 × 844 y en escritorio. Confirmar las tres acciones, distancia/fallback, compartir, alternancia de favorito, X accesible y ausencia de pérdida de ofertas. Guardar capturas y dejar la pestaña local abierta sin publicar.
