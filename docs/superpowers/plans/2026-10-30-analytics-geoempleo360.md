# GeoEmpleo360 Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recibir visitas consentidas de geoempleo360.com en GA4 y consultar usuarios y tiempo medio de interacción por periodo.

**Architecture:** Se reutiliza el flujo web de Firebase/GA4 y el controlador opt-in existente. Solo se corrige su URL y la CSP que bloquea el script oficial.

**Tech Stack:** Firebase Hosting, Firebase Analytics SDK, GA4, Node test runner.

---

### Task 1: Flujo web de GA4

**Files:** Configuración externa del flujo «GeoEmpleo Web» en la propiedad `geoempleo-49978`.

- [ ] Leer el ID `G-W8FJ6RYVQJ` y la URL actual del flujo.
- [ ] Establecer la URL `https://geoempleo360.com` en ese mismo flujo.
- [ ] Volver a abrir los detalles y verificar URL e ID sin crear otro flujo.

### Task 2: Cabecera CSP

**Files:** `firebase.json`, `tests/static-delivery.test.ts`.

- [ ] Añadir una prueba que exija `https://www.googletagmanager.com` en `script-src` del Hosting y que preserve el consentimiento opt-in.
- [ ] Ejecutar `node --test tests/static-delivery.test.ts` y comprobar que falle por la CSP actual.
- [ ] Añadir solo ese origen a `script-src` en `firebase.json`.
- [ ] Ejecutar `node --test tests/static-delivery.test.ts tests/web-analytics.test.ts` y `npm run typecheck`.

### Task 3: Contexto y publicación

**Files:** `docs/project-context.md`.

- [ ] Registrar el diagnóstico, la corrección y la condición de validación en el contexto.
- [ ] Publicar el cambio con el mecanismo de integración del repositorio, preservando el catálogo vigente.
- [ ] Comprobar por HTTPS la CSP de `geoempleo360.com`, probar una visita consentida y verificar el informe en tiempo real.
