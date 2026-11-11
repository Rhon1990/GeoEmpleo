# Ajustes finales de tarjetas y favoritos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el menú de tres puntos y el tamaño de logotipos en móvil, retirar la etiqueta visual de procedencia de todas las tarjetas y limitar «Tus favoritos» a ofertas.

**Architecture:** Se mantiene el componente de tarjeta y su menú `<details>` existente. Los cambios se concentran en su presentación responsive, en la composición DOM de la tarjeta y en el diálogo de favoritos; la persistencia de búsquedas queda intacta pero deja de exponerse y de contar como favorito.

**Tech Stack:** HTML, CSS responsive, JavaScript ES modules, Node.js test runner, Chrome responsive QA.

---

### Task 1: Proteger el nuevo contrato de tarjetas y favoritos

**Files:**
- Modify: `tests/web-brand-layout.test.ts:314-452`

- [ ] **Step 1: Write the failing tests**

Actualizar el contrato del diálogo para que solo exija `show-saved` y `saved-offers`, y rechace los controles de búsquedas:

```ts
const favorites=allElements.find(element=>attribute(element,'id')==='saved-dialog');
assert.ok(favorites);
assert.ok(elements(favorites).some(element=>attribute(element,'id')==='saved-offers'));
for(const id of ['save-search','share-search','share-status','saved-searches']){
  assert.equal(elements(favorites).some(element=>attribute(element,'id')===id),false);
}
assert.doesNotMatch(textContent(favorites),/Búsquedas|Añadir búsqueda|Compartir búsqueda/);
assert.match(app,/const count=retention\.savedOffers\(\)\.length/);
assert.doesNotMatch(app,/const count=retention\.savedOffers\(\)\.length\+retention\.savedSearches\(\)\.length/);
```

Reemplazar la expectativa de `source-pill` por:

```ts
assert.match(app,/visualFrame\.append\(visual\)/);
assert.doesNotMatch(app,/source-pill/);
assert.doesNotMatch(css,/\.source-pill\{/);
assert.match(app,/setAttribute\('aria-label', `Ver oferta: \$\{call\.title\}\. Fuente: \$\{call\.source\}`\)/);
```

Añadir al contrato móvil:

```ts
assert.match(mobileRules,/\.mobile-featured-offer \.card-footer \.offer-actions\{[^}]*position:static/);
assert.match(mobileRules,/\.mobile-featured-offer \.offer-actions-toggle\{[^}]*position:absolute[^}]*top:8px[^}]*right:8px/);
assert.match(mobileRules,/\.mobile-featured-offer \.offer-actions-menu\{[^}]*top:48px[^}]*right:8px[^}]*bottom:auto/);
assert.match(mobileRules,/\.mobile-featured-offer \.job-visual\.logo-brand img\{[^}]*width:auto[^}]*height:auto[^}]*max-width:calc\(100% - 28px\)[^}]*max-height:40px/);
assert.doesNotMatch(mobileRules,/\.mobile-featured-offer \.job-visual img\{[^}]*width:42px[^}]*height:42px/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/web-brand-layout.test.ts
```

Expected: FAIL porque todavía existen la sección de búsquedas y `source-pill`, y el menú/logo móvil conservan las reglas antiguas.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/web-brand-layout.test.ts
git commit -m "test: cover final mobile card fixes"
```

### Task 2: Corregir DOM, favoritos y caché

**Files:**
- Modify: `apps/web-preview/public/index.html:9-11,76`
- Modify: `apps/web-preview/public/app.mjs:10,104-159,197-200,304-324,433-470,582-591`

- [ ] **Step 1: Remove search controls from favorites**

Dejar el diálogo así:

```html
<dialog id="saved-dialog" aria-labelledby="saved-title"><div class="dialog-toolbar"><span class="eyebrow">EN ESTE DISPOSITIVO</span><button type="button" id="close-saved" class="close-button" aria-label="Cerrar favoritos">×</button></div><div class="about-content"><h2 id="saved-title">Tus favoritos</h2><p>Ofertas guardadas solo en este navegador, sin cuenta ni ubicación precisa.</p><h3>Ofertas</h3><div id="saved-offers"></div></div></dialog>
```

En `app.mjs`, retirar `shareableSearchUrl`, las referencias y listeners de `save-search`, `share-search`, `share-status`, el renderizado de `saved-searches` y la actualización de esos controles en `render()`.

- [ ] **Step 2: Count only favorite offers**

Cambiar el contador a:

```js
function syncFavoritesCount() {
  const count=retention.savedOffers().length;
  favoritesButton.textContent=`(${count}) Favoritos`;
}
```

- [ ] **Step 3: Remove the visual source pill without losing accessibility**

Cambiar la composición visual a:

```js
visual.append(logo);
visualFrame.append(visual);
```

Conservar intacto:

```js
button.setAttribute('aria-label', `Ver oferta: ${call.title}. Fuente: ${call.source}`);
```

- [ ] **Step 4: Bump static cache keys**

Usar una clave `20261111-final-card-fixes` para `/styles.css` y `/app.mjs` en `index.html`.

- [ ] **Step 5: Run the focused test**

Run:

```bash
node --test tests/web-brand-layout.test.ts
```

Expected: todavía FAIL únicamente en las reglas CSS móviles pendientes.

### Task 3: Corregir menú y escala de logos móviles

**Files:**
- Modify: `apps/web-preview/public/styles.css:22-50,151-181,212-228`

- [ ] **Step 1: Remove the unused source pill style**

Eliminar la regla `.source-pill` completa.

- [ ] **Step 2: Keep the carousel menu inside the card**

Añadir dentro de `@media(max-width:780px)`:

```css
.mobile-featured-offer .card-footer .offer-actions{position:static}
.mobile-featured-offer .offer-actions-toggle{position:absolute;top:8px;right:8px;z-index:2}
.mobile-featured-offer .offer-actions-menu{top:48px;right:8px;bottom:auto;z-index:10}
```

Esto hace que el panel quede dentro de la altura de la tarjeta y no sea recortado por `.mobile-offer-track{overflow-x:auto}`.

- [ ] **Step 3: Preserve brand logo proportions on mobile**

Sustituir la regla cuadrada por:

```css
.mobile-featured-offer .job-visual.logo-brand img{width:auto;height:auto;max-width:calc(100% - 28px);max-height:40px;object-fit:contain}
.mobile-featured-offer .job-visual.logo-generic img{width:42px;height:42px}
```

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
node --test tests/web-brand-layout.test.ts tests/web-mobile-offer-carousel.test.ts && npm run typecheck
```

Expected: PASS.

### Task 4: Actualizar contexto y verificar integralmente

**Files:**
- Modify: `docs/project-context.md:5-9`
- Modify: `docs/superpowers/plans/2026-11-11-ajustes-finales-tarjetas-favoritos.md`

- [ ] **Step 1: Update project context**

Documentar que el carrusel mantiene su menú dentro de la tarjeta, los logos conservan proporción, la etiqueta superpuesta desapareció y favoritos solo muestra/cuenta ofertas sin borrar búsquedas antiguas almacenadas.

- [ ] **Step 2: Run full verification**

Run:

```bash
GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check
git diff --check
```

Expected: 509 pruebas Node, OpenAPI sincronizado, 76 fixtures Python y diff sin errores.

- [ ] **Step 3: Run responsive browser QA**

En Chrome a 390 × 844:

1. Abrir el menú de tres puntos de una tarjeta del carrusel y confirmar que se ven favorito, compartir y ubicación.
2. Navegar a una oferta Randstad y confirmar que el logo horizontal utiliza el ancho disponible sin deformarse.
3. Abrir «Favoritos» y confirmar que solo aparecen ofertas y que el contador coincide.
4. Revisar que no haya errores de consola.

En escritorio a 1280 × 800, confirmar que no aparece la etiqueta pastel y que el layout de dos columnas sigue intacto.

- [ ] **Step 4: Mark plan complete**

Marcar todas las tareas ejecutadas en este documento y conservar la rama/worktree para revisión local; no desplegar.

