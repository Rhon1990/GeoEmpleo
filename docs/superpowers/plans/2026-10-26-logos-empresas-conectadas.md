# Logos de empresas conectadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar logos locales de empresas conectadas en tarjetas y detalles, con un fallback fiable.

**Architecture:** Extender el resolvedor de marca ya usado por las tarjetas, con asignación determinista por fuente/empleador verificado. Reutilizar ese resultado en el detalle; almacenar SVGs e inventario de procedencia dentro de la web estática.

**Tech Stack:** JavaScript ESM, SVG local, Node test runner, Firebase Hosting estático.

---

### Task 1: Resolver y presentar marcas

**Files:**
- Modify: `apps/web-preview/public/presentation.mjs`
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/styles.css`
- Create: `apps/web-preview/public/brands/*.svg` para las marcas activas con logo verificado
- Create: `apps/web-preview/public/brands/README.md` con la fuente de cada logo
- Test: `tests/web-employer-brand.test.ts`

- [ ] Escribir tests para cada fuente empresarial activa y para fuentes/ofertas genéricas.
- [ ] Ejecutar `node --experimental-strip-types --test tests/web-employer-brand.test.ts` y confirmar el fallo esperado.
- [ ] Añadir los assets locales verificados y el mapa de marcas por identificador.
- [ ] Reutilizar el resolvedor en la cabecera del detalle y mostrar el fallback si un asset falla.
- [ ] Ejecutar tests, `npm run check` y `npm run build:web:static`; inspeccionar assets en la salida.
- [ ] Desplegar Hosting y comprobar por HTTPS los logos y HTML actualizados.
