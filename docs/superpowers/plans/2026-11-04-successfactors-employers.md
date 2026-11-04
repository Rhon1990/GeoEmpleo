# SuccessFactors employer sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir KPMG, Deloitte e ILUNION al catálogo diario de ofertas españolas, y comprobar que MAPFRE conserva su fuente única.

**Architecture:** KPMG usa el parser tabular existente. Deloitte e ILUNION comparten un nuevo parser de tarjetas `job-tile` de SuccessFactors; la adaptación de detalle y la geografía siguen en el conector común. Cada tablero declara su host, ruta, tamaño de página, límites y categoría. El runner y el registro incorporan solo tableros que superen la captura completa.

**Tech Stack:** Node.js 24, TypeScript nativo, DOM HTML local del proyecto, tests `node --test`, GitHub Actions, Firebase Hosting.

---

## Archivos y responsabilidades

- `packages/ingestion/src/connectors/successfactors.ts`: distinguir listados tabulares de tarjetas y validar identidad, localización y paginación.
- `packages/ingestion/src/connectors/successfactors-boards.ts`: contratos de KPMG, Deloitte e ILUNION, sin alterar MAPFRE.
- `packages/ingestion/src/registry.ts` y `runner.ts`: registrar y recorrer las fuentes verificadas.
- `tests/ingestion-employer-boards.test.ts`, `tests/ingestion-runner.test.ts`: fixtures de HTML, captura íntegra, conservación ante fallo y mapas.
- `apps/web-preview/public/presentation.mjs`, `apps/web-preview/public/brands/`, `tests/web-employer-brand.test.ts`: logos locales por fuente.
- `docs/fuentes-de-ofertas.md` y `docs/project-context.md`: estado operativo contrastado.

## Task 1: KPMG en el parser tabular

- [ ] **Step 1: Escribir un test rojo.** Crear un fixture reducido de la fila `tr.data-row` con URL `/job/Madrid-Puesto/1444635133/`, ubicación `Madrid, ES, 28046`, fecha y detalle con `datePosted` y `description`. En `tests/ingestion-employer-boards.test.ts` exigir que `sourceRegistry.get('successfactors-kpmg')` esté activo, que `fetchSuccessFactorsOffers` devuelva ID estable y punto Madrid, y que no se admita una URL de otro host.
- [ ] **Step 2: Ejecutar `node --test tests/ingestion-employer-boards.test.ts`; comprobar fallo por tablero ausente.**
- [ ] **Step 3: Añadir el tablero exacto:**

```ts
{sourceId:'successfactors-kpmg',hostname:'carreras.kpmg.es',employer:'KPMG',
 listingPath:'/search/?createNewAlert=false&q=&locationsearch=',
 jobPathPattern:/^\/job\/[^/]+\/\d+\/$/,
 category:'otros',categoryLabel:'Otros sectores',sourceLabel:'KPMG · empleo oficial',
 pageSize:100,maxPages:10,paginationOffsetParam:'startrow'}
```

  Registrar el ID en el runner por el array `successFactorsBoards`, sin rama especial. Confirmar que la paginación real usa `startrow`; si el portal usa otra ruta, corregir el tablero y el test antes de activarlo.
- [ ] **Step 4: Ejecutar el test focal y una captura aislada `runDaily` en un catálogo temporal.** Exigir que todas las páginas anunciadas queden cubiertas, IDs únicos y enlaces HTTPS del host oficial. Comparar una muestra de fichas originales y puntos municipales.
- [ ] **Step 5: Commit del conector y tests de KPMG.**

## Task 2: Parser de tarjetas SuccessFactors para Deloitte e ILUNION

- [ ] **Step 1: Guardar fixtures mínimos de ambos listados.** Para Deloitte usar `li.job-tile`, `a.jobTitle-link`, `.section-field.location`, `#tile-search-results-label` (`Mostrando 1 a 25 de N puestos`); para ILUNION el mismo esquema con diez filas. Probar que un elemento sin ubicación o enlace válido falla, que la misma fila repetida en desktop/tablet/mobile cuenta una sola vez y que país distinto de ES se excluye.
- [ ] **Step 2: Ejecutar `node --test tests/ingestion-employer-boards.test.ts`; comprobar fallo del nuevo formato.**
- [ ] **Step 3: Añadir `listingFormat?: 'table'|'tile'` al contrato `SuccessFactorsBoard`, con `table` por defecto.** En `parseSuccessFactorsListing`, cuando sea `tile`, seleccionar solo `li.job-tile`, tomar el primer `a.jobTitle-link`, la ubicación de `.section-field.location` y el total de `#tile-search-results-label`; llamar a las funciones existentes `validatedJobUrl` y `locationParts`. Rechazar páginas sin total o filas y no inferir un municipio de la provincia.
- [ ] **Step 4: Verificar la paginación real `tile-search-results` con una segunda página pública.** Codificar la ruta, parámetros y tamaño observados en un test de dos páginas; exigir que la suma de IDs únicos coincida con el total del portal antes de llamar a `reconcileSource`. Si el portal solo proporciona resultados parciales, conservarlo como candidato sin activar.
- [ ] **Step 5: Añadir los tableros `successfactors-deloitte` y `successfactors-ilunion` con `listingFormat:'tile'`, hosts y rutas oficiales, categorías `otros`, tamaños 25 y 10, respectivamente.** Usar `maxPages` suficientes para sus totales observados y límites de seguridad finitos. Los detalles siguen validando `h1`, `datePosted` y `description` en el adaptador común; ampliar solo si una ficha oficial tiene un contrato diferente comprobado.
- [ ] **Step 6: Tests focales, capturas aisladas completas y commit.** Comprobar ausencia de puntos cuando la ficha solo indica una provincia, varias sedes o remoto.

## Task 3: Logos, documentación y publicación

- [ ] **Step 1: Añadir assets locales identificados de los portales oficiales para las tres empresas; registrar rutas/alt en `presentation.mjs` y `tests/web-employer-brand.test.ts`.** Si un asset no se puede verificar, usar el logo neutro actual y documentarlo.
- [ ] **Step 2: Ejecutar `npm run check`, `npm run build:web:static` con la configuración local existente y `git diff --check`; revisar catálogo JSON con IDs únicos.** Verificar que MAPFRE sigue con un solo `sourceId`.
- [ ] **Step 3: Actualizar inventario y contexto con fuentes activadas, capturas reales, limitaciones de ubicación y fecha. Commit.**
- [ ] **Step 4: Publicar mediante PR y GitHub Actions; comprobar por HTTPS `checkedAt`, conteos por fuente y logos en ambos dominios.** Una ejecución parcial conserva fuentes fallidas y se comunica sin llamarla éxito total.

## Siguiente plan

La especificación aprobada también cubre Leroy Merlin, Alcampo, Adecco, Manpower y Decathlon. Sus portales no comparten el contrato SuccessFactors y requieren auditoría del canal de listado/detalle antes de escribir el plan de implementación de sus adaptadores. MAPFRE solo requiere regresión. El plan siguiente se escribirá con endpoints y campos observados, sin activar fuentes a partir de un listado parcial.
