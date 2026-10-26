# Web local — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Ejecución inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una primera web local navegable con datos reales y sin registro.

**Architecture:** HTML/CSS/ES modules, filtrado puro separado de DOM, snapshot BOE real independiente de fixtures; servidor Node estático restringido a loopback. Adaptador Maps JavaScript aislado, cargado bajo demanda y configurado localmente.

**Tech Stack:** Node 24, navegador, sin dependencias runtime nuevas.

- [x] Worktree `codex/web-preview` desde `codex/domain-core`, baseline 102 tests Node/76 Python correcto.
- [x] Verificar anuncios BOE, texto/fecha/referencia, condiciones de reutilización y HTML público de inserción de Google Maps.
- [x] Crear datos en `apps/web-preview/public/data/calls.json`; conservar texto original, origen, fecha, plazo literal y salario nulo.
- [x] Escribir tests `tests/web-catalog.test.ts` antes de `apps/web-preview/public/catalog.mjs`. Caso clave: `searchCalls(calls, {q: 'TECNICO informatico', city: '', category: ''})` devuelve solo BOE-A-2026-21006; combinar Madrid + categoría Cultura devuelve vacío. Ver fallo con adaptador mínimo y luego implementar.
- [x] Crear `index.html`, `styles.css`, `app.mjs`: lista, filtros, detalle y estados vacíos, con DOM seguro.
- [x] Crear `apps/web-preview/server.mjs`: `npm run dev:web` sirve en 127.0.0.1:4310; whitelist explícita de assets + JSON. GET/HEAD, 404 para rutas ajenas, sin exponer repositorio.
- [x] Verificar Node/sintaxis, contrato de datos reales, HTTP y navegador; actualizar README/contexto/backlog con alcance parcial.
- [ ] Integrar localmente, ejecutar comprobación completa y abrir la URL al usuario, conservando el servidor de vista previa.

## Ampliación aprobada: mapa de convocatorias y proximidad

- [x] Añadir procedencia de coordenadas municipales verificadas, sin geocodificar ni inventar direcciones laborales.
- [x] Tests antes de `geography.mjs`: distancia cero/mismo punto, radio inclusivo, fuera de radio, coordenadas desconocidas excluidas solo al filtrar, viewport y origen requerido. Mantener búsqueda/texto/territorio compartidos.
- [x] Crear `google-map.mjs`: SDK único con clave local, AdvancedMarkerElement por convocatoria, selección/mapa/lista, origen por clic y radio Circle; actualizar capas sin reconstruir Map.
- [x] Modificar DOM para origen municipal/radio, carga voluntaria del SDK, buscar en viewport y configuración pendiente visible. No usar el iframe como sustituto funcional de búsqueda.
- [x] Configuración pública limitada a key/map ID desde `.env.local` ignorado, ejemplo y guía Google. Cargar configuración sin imprimirla.
- [x] Verificar sin clave: ningún request SDK, filtros geográficos locales correctos y estado honesto; con clave: cuatro marcadores, selección/detalle y proximidad Madrid–Fuentidueña validados.
