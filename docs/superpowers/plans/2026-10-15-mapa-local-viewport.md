# Consulta local por viewport — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Geolocalizar el inicio con permiso y solicitar únicamente ofertas del viewport, automáticamente al terminar movimientos.

**Architecture:** Store local cacheado separa resumen/detalle; el adaptador Google emite idle y recibe foco explícito. Un controlador de consultas con debounce/abort/revisión protege la UI. La app conserva un único mapa y no descarga el catálogo completo.

**Tech Stack:** Node 24, módulos JS existentes, node:test y Google Maps/geolocation del navegador, sin nuevas dependencias.

### Task 1: API de catálogo acotada

Files: crear `apps/web-preview/job-store.mjs`, `tests/web-job-store.test.ts`; modificar `server.mjs`.

- [x] Escribir tests RED de bbox, límite 300, resumen sin paragraphs, detalle por ID, validación y caché invalidada por cambio de archivo.
- [x] Ejecutar `node --test tests/web-job-store.test.ts`; comprobar módulo ausente.
- [x] Implementar `createJobStore(path)` con `query(URLSearchParams)` y `detail(id)`. Reutilizar `searchCalls` y `stat/readFile`; responder 400/404/503 sin logs de coordenadas.
- [x] Integrar en rutas fijas `/api/jobs` y `/api/job`; registrar módulos de frontend nuevos en whitelist.
- [x] Ejecutar tests dirigidos y `npm run typecheck`.

### Task 2: Geolocalización y concurrencia

Files: crear `public/map-search.mjs`, `tests/web-map-search.test.ts`.

- [x] Escribir RED para `locateOnce(provider)` con granted/denied/timeout/unavailable; validar punto y precisión, timeout 8 s, maximumAge 5 min, sin watchPosition.
- [x] Escribir RED con temporizadores inyectados para `createViewportSearch`: 350 ms, último cambio gana, abort de petición activa, ninguna respuesta obsoleta aplicada y retry tras error.
- [x] Ejecutar `node --test tests/web-map-search.test.ts`.
- [x] Implementar funciones puras/inyección de fetch, scheduler y callbacks; sin DOM ni dependencias nuevas.
- [x] Verificar tests dirigidos y tipos.

### Task 3: Adaptador Google y UI

Files: modificar `google-map.mjs`, `app.mjs`, `index.html`, `styles.css`, `server.mjs`.

- [x] Incorporar evento idle al adaptador y métodos explícitos focus(point,zoom), overview(), manteniendo update sin fit.
- [x] Iniciar configuración/geolocalización una vez, crear un mapa y consultar únicamente al disponer de bounds. Sin clave/SDK, permitir búsqueda en lista.
- [x] Sustituir descarga calls.json por `/api/jobs`; filtros disparan petición, radio adicional se aplica a resultados, facets no reconstruyen continuamente controles.
- [x] Pedir `/api/job?id` al abrir detalle, cancelando aperturas anteriores/cierre.
- [x] Mensajes para permiso denegado, sin cobertura, carga, error recuperable y límite de resultados. Conservar procedencia, listas y grupos del mapa.
- [x] Verificar tipos, pruebas de cámara y suite de web.

### Task 4: QA y documentación

- [x] Ejecutar suite completa `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check` y diff check.
- [x] Reiniciar servidor local con archivo Maps existente; verificar HTTP y navegador (permiso denegado, foco manual, pan/zoom, detalle, consultas limitadas).
- [x] Actualizar README, guía Maps, `docs/project-context.md` con evidencia y límites de privacidad/escala.
- [x] Guardar captura y commit enfocado; conservar rama/worktree usado por actualización diaria.

### Task 5: Referencias de toda España

Files: crear `apps/web-preview/places-store.mjs`, `apps/web-preview/tools/build-places.py`, `apps/web-preview/data/spain-places.json.gz`, `tests/web-places-store.test.ts`; modificar `server.mjs`, `app.mjs`, `map-search.mjs`, `reference-places.mjs`.

- [x] Crear pruebas RED: consulta de pueblos por nombre/alias sin tildes, homónimos separados por provincia, CP con varios resultados, mínimo 2 caracteres, máximo 20 sugerencias, rechazo de query duplicada o >120 caracteres. Ejecutar `node --test tests/web-places-store.test.ts` antes de implementar.
- [x] Generar catálogo de clase P vigente y registros postales válidos desde ES.zip/admin2Codes.txt/zip ES.zip; guardar metadatos de fuente/licencia/fecha, deduplicar identidad y conservar precisión territorial. Añadir build reproducible con Python stdlib, sin dependencias.
- [x] Implementar `createPlacesStore(path).query(params)` cacheado, devolver `{places,truncated}` y priorizar coincidencia exacta. Servir GET/HEAD `/api/places?q` sin descargar el dump nacional al cliente.
- [x] Reutilizar el controlador debounce/abort/revisión parametrizando endpoint; mantener su valor por defecto `/api/jobs`. Cambiar datalist a sugerencias bajo demanda y centrar solo una coincidencia única o selección explícita.
- [x] Probar pueblos rurales reales y homónimos en API y navegador; no afirmar cobertura exhaustiva ni direcciones precisas.

### Task 6: Regreso al origen y cierre

Files: modificar `public/app.mjs`, `index.html`, `docs/project-context.md`, README y guía Maps.

- [x] Añadir `#return-origin`, desactivado sin origen, habilitado tras selección o GPS. Click llama `mapController.focus(origin)` sin geolocalizar de nuevo y mantiene filtros.
- [x] Verificar en navegador desplazamiento, retorno al origen Coto, actualización de lista, detalle bajo demanda y fallo de GPS honesto.
- [x] Ejecutar `npm run check` con venv existente, `git diff --check`, revisar cambios y actualizar evidencia/documentación antes de commit.

## Evidencia de ejecución

163 tests Node, tipos y OpenAPI correctos; 76 fixtures Python. Pruebas de API HTTP 200/400/404, bbox Cieza con 17 resúmenes y detalle bajo demanda. Navegador: GPS no disponible, elección manual Coto 40151/Ituero y Lama, Navas de San Antonio y Robledillo de Gata; regreso a Robledillo tras vista España; desplazamiento real desde Cieza actualiza 17→0 sin botón Buscar. Las concesiones GPS se simulan únicamente en tests. Revisión independiente detectó y se corrigieron consultas nacionales prematuras, autoPan de popup y carreras entre GPS, sugerencias y carga del SDK.

Catálogo nacional: 55.788 referencias en 2.611.778 bytes gzip, API CP40151 de 1.070 bytes; 55.788 etiquetas e IDs distintos, puntos dentro del ámbito permitido. No es catálogo de empleos ni registro territorial oficial exhaustivo. Sin dependencias nuevas ni activación de APIs pagadas.
