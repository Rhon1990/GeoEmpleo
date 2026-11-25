# Encuadre por distancia máxima y zoom fluido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encadrar el mapa al radio elegido y animar todos los cambios de cámara iniciados por la aplicación, con una vista local de prueba que no solicita GPS.

**Architecture:** Extraer cálculos de encuadre y una transición de cámara cancelable en un módulo puro y comprobable. El controlador de Google Maps utilizará esa transición para foco, límites, vista general, resultados, grupos y radio; el modo de prueba se habilitará solo con una marca explícita en un host local y usará un origen sintético.

**Tech Stack:** JavaScript ES modules, Google Maps JavaScript API, Node.js test runner, TypeScript check y build estático existente.

---

### Task 1: Probar geometría de radio y transición cancelable

**Files:**
- Create: `apps/web-preview/public/map-camera.mjs`
- Create: `tests/web-map-camera.test.ts`

- [ ] **Step 1: Escribir pruebas de bounds de radio y transiciones**

Cubrir: `radiusBounds([-3,40], 25)` contiene los cuatro puntos cardinales y se mantiene centrado; radio `0` devuelve `null`; animar interpola centro y zoom hasta el último destino; un destino nuevo cancela el anterior; `reducedMotion: true` aplica destino de forma inmediata.

- [ ] **Step 2: Ejecutar la prueba y confirmar fallo por módulo inexistente**

Ejecutar `node --test tests/web-map-camera.test.ts`.
Esperado: FAIL porque `map-camera.mjs` y sus exportaciones todavía no existen.

- [ ] **Step 3: Implementar las funciones puras y el animador inyectable**

Exportar `radiusBounds(origin, radiusKm)` con conversiones de kilómetros a grados y longitud corregida por latitud; exportar `createCameraTransition({apply,requestFrame,cancelFrame,durationMs,reducedMotion})`, que interpola centro/zoom con easing `easeInOutCubic`, mantiene una sola animación activa y da prioridad al destino más reciente.

- [ ] **Step 4: Ejecutar y confirmar las pruebas en verde**

Ejecutar `node --test tests/web-map-camera.test.ts`.
Esperado: todas las pruebas del archivo pasan.

### Task 2: Centralizar cambios de cámara del controlador

**Files:**
- Modify: `apps/web-preview/public/google-map.mjs`
- Modify: `tests/web-map-state.test.ts`
- Modify: `tests/web-map-camera.test.ts`

- [ ] **Step 1: Añadir prueba para encuadre por radio y movimiento reducido**

Extender las pruebas de `map-camera.mjs` para verificar que los bounds se convierten a un destino centrado que contiene el radio en un viewport dado, y que movimiento reducido evita solicitar frames. Añadir una prueba de contrato estática para asegurar que el controlador ofrece `fitRadius` y el mismo camino animado se usa para `focus`, `fitArea`, `overview` y `fit`.

- [ ] **Step 2: Ejecutar las pruebas y confirmar fallo esperado**

Ejecutar `node --test tests/web-map-camera.test.ts tests/web-map-state.test.ts`.
Esperado: FAIL en las nuevas expectativas por falta de cálculo/controlador `fitRadius`.

- [ ] **Step 3: Integrar cálculo de encuadre y animación en el controlador**

Crear helper privado `animateToBounds(bounds,padding)` que calcula zoom de Web Mercator a partir del tamaño del mapa, bounds y padding; cambiar `focus`, `fitArea`, `overview`, `fit` y el zoom al abrir grupos para llamar al animador común. Exponer `fitRadius(origin,radiusKm)` para radios mayores que cero; el radio cero no debe llamar al animador. Mantener `panBy` del ajuste del popup y los gestos de usuario como están.

- [ ] **Step 4: Ejecutar pruebas unitarias y revisión de rutas de cámara**

Ejecutar `node --test tests/web-map-camera.test.ts tests/web-map-state.test.ts tests/web-presentation.test.ts` y buscar `setCenter|setZoom|fitBounds|panTo|panBy` en `google-map.mjs`.
Esperado: suite verde; solo las operaciones de transición, ajuste del popup y gestos quedan como caminos directos.

### Task 3: Aplicar radio al cambiar distancia y añadir preview local seguro

**Files:**
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/styles.css`
- Modify: `apps/web-preview/server.mjs`
- Create: `apps/web-preview/public/camera-preview.mjs`
- Create: `tests/web-camera-preview.test.ts`
- Modify: `tests/web-map-search.test.ts`
- Modify: `docs/project-context.md`

- [ ] **Step 1: Escribir prueba del modo de preview limitado a localhost**

Probar `isCameraPreviewEnabled(host, search)`: activa solo con `?cameraPreview=1` en `localhost` o `127.0.0.1`, y siempre desactivada para dominios públicos incluso con la marca. Probar que el origen sintético es un punto válido y que `Sin límite` resuelve radio nulo.

- [ ] **Step 2: Confirmar fallo esperado**

Ejecutar `node --test tests/web-camera-preview.test.ts`.
Esperado: FAIL porque el módulo de preview todavía no existe.

- [ ] **Step 3: Implementar preview determinista y aplicación del radio**

En localhost con la marca, iniciar con origen sintético en Madrid y radio 25 km, sin llamar a `navigator.geolocation`; hacer que `commitRadius()` llame a `fitRadius()` al existir origen y radio positivo; cambiar distancia a 0 conserva el encuadre actual; añadir una etiqueta discreta fuera del mapa que indique «Vista de prueba: origen simulado». Permitir iniciar el servidor en un puerto elegido mediante `GEOEMPLEO_PREVIEW_PORT`, sin modificar el puerto por defecto.

- [ ] **Step 4: Probar regresiones de filtro y de interfaz**

Ejecutar `node --test tests/web-camera-preview.test.ts tests/web-map-search.test.ts tests/web-place-hierarchy.test.ts tests/web-brand-layout.test.ts`.
Esperado: todas pasan y las pruebas existentes de búsqueda geográfica permanecen iguales.

### Task 4: Validación, documentación y vista de prueba

**Files:**
- Modify: `docs/project-context.md`
- Modify: `apps/web-preview/public/index.html` (versionar módulo para evitar caché)

- [ ] **Step 1: Ejecutar typecheck, todas las pruebas web y build estático**

Ejecutar `npm run typecheck`, `npm test` y `npm run build:web:static`.
Esperado: las tres verificaciones finalizan con código 0.

- [ ] **Step 2: Actualizar contexto del proyecto con comportamiento y preview**

Documentar que la cámara usa transición común con movimiento reducido, el radio positivo encuadra el círculo y radio 0 conserva la vista, y la prueba local se activa con `?cameraPreview=1`.

- [ ] **Step 3: Abrir la vista local en puerto aislado**

Iniciar `GEOEMPLEO_PREVIEW_PORT=4311 npm run dev:web` desde esta worktree y abrir `http://127.0.0.1:4311/?cameraPreview=1`.
Confirmar visualmente que el origen sintético está seleccionado, probar 5, 25, 100 km y «Sin límite», y verificar cambios suaves desde «Ver España», territorio y selección manual. No desplegar a producción.
