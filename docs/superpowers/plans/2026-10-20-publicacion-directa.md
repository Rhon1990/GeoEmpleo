# Publicación directa — Implementation Plan

> Ejecutar en el worktree web-preview con Superpowers executing-plans y test-driven-development.

**Goal:** Crear, revisar y retirar ofertas locales con salario, contacto y ubicación declarada.
**Architecture:** Repositorio SQLite privado y transaccional, API limitada al servidor local, proyección de aprobadas en consultas existentes. Token de autor separado de moderación por CLI local. Sin servicios de pago ni Firebase necesario para esta etapa.
**Tech Stack:** Node 24, node:sqlite, HTML/CSS/ES modules existentes, Google Maps ya configurado.

- [ ] Repositorio: crear `submissions.mjs` y pruebas en `tests/web-submissions.test.ts`. Comprobar ausencia pública antes de aprobar, token inválido, baja idempotente/persistente y aprobación obsoleta rechazada. Validar salario y ubicación sin inventarlos.
- [ ] API: `submission-api.mjs`, POST JSON con límite 24 KiB, mismo origen y límite por IP; GET autenticado sin efecto lateral. No exponer datos privados. Integrar en `server.mjs` antes del rechazo de métodos.
- [ ] Lectura: `job-store.mjs` combina aprobadas por consulta sin modificar calls.json; `presentation.mjs` muestra salario y procedencia directa. Moderación vía `moderate.mjs`, solo operador local.
- [ ] Interfaz: `/publicar` y `/gestionar`, módulos y CSS aislados; selección de localidad por `/api/places`, mapa con marcador ajustable, confirmación de ubicación; enlace privado mostrado una vez. Reutilizar cargador SDK.
- [ ] QA: ejecutar pruebas específicas, suite completa y revisar web local; fixtures solo en directorios temporales, nunca en catálogo real. Documentar límites locales y pasos de moderación.

Comandos: `node --test tests/web-submissions.test.ts`, `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check`.
