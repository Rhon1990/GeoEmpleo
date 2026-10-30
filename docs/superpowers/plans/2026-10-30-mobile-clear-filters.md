# Mobile Clear Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mantener «Limpiar filtros» como una pastilla compacta alineada a la derecha en una fila propia en móvil, sin cambiar escritorio ni la lógica de filtrado.

**Architecture:** El DOM y JavaScript actuales se conservan. Una prueba estructural protege el contrato responsive y dos reglas CSS dentro del breakpoint de 780 px impiden que `filter-controls` comparta fila o que `#clear-filters` se estire.

**Tech Stack:** HTML/CSS estático, Node.js `node:test` y TypeScript.

---

### Task 1: Corregir la composición móvil del botón

**Files:**
- Modify: `tests/web-brand-layout.test.ts`
- Modify: `apps/web-preview/public/styles.css`

- [ ] **Step 1: Escribir la prueba de regresión que falla**

Añadir después de la prueba de la barra de categorías:

```ts
test('mobile clear filters stays compact on its own row', () => {
  const mobileRules = mediaBlocksForMaxWidth(css, 780).join('\n');
  assert.match(mobileRules, /\.filter-controls\{[^}]*flex:1 0 100%/);
  assert.match(
    mobileRules,
    /#clear-filters\{[^}]*align-self:flex-end[^}]*flex:none[^}]*min-height:38px/,
  );
});
```

- [ ] **Step 2: Ejecutar la prueba y comprobar RED**

Run: `node --test --test-name-pattern="mobile clear filters" tests/web-brand-layout.test.ts`  
Expected: FAIL porque el breakpoint no contiene `flex:1 0 100%` ni la regla móvil de `#clear-filters`.

- [ ] **Step 3: Aplicar el CSS mínimo**

Dentro del último `@media(max-width:780px)` de `styles.css`, cambiar y añadir:

```css
.filter-controls{width:100%;flex:1 0 100%}
#clear-filters{align-self:flex-end;flex:none;min-height:38px}
```

No modificar la regla base `.text-button`, el HTML ni JavaScript.

- [ ] **Step 4: Ejecutar GREEN y regresión de layout**

Run: `node --test --test-name-pattern="mobile clear filters|filter controls|mobile category rail|narrow mobile" tests/web-brand-layout.test.ts`  
Expected: PASS, 0 fallos.

- [ ] **Step 5: Ejecutar validación completa**

Run: `npm test`  
Expected: 405 o más pruebas, 0 fallos.

Run: `git diff --check`  
Expected: sin salida y código 0.

- [ ] **Step 6: Actualizar contexto y guardar el cambio**

Añadir en `docs/project-context.md`, dentro de «Código existente», una nota breve que indique que en móvil `#clear-filters` ocupa una fila propia compacta y que escritorio conserva la composición existente.

```bash
git add apps/web-preview/public/styles.css tests/web-brand-layout.test.ts docs/project-context.md
git commit -m "fix: compactar limpiar filtros en móvil"
```

### Task 2: Validación visual local

**Files:**
- No production files modified.

- [ ] **Step 1: Levantar la web con la configuración local existente**

Run: `GEOEMPLEO_ENV_FILE=/Users/rdelgpad/Documents/personal/GeoEmpleo/.env.local npm run dev:web`  
Expected: servidor disponible en `http://127.0.0.1:4310`.

- [ ] **Step 2: Verificar manualmente el diseño**

En 375, 390 y 430 px, activar un filtro y comprobar:

- el botón queda debajo de las categorías y alineado a la derecha;
- conserva altura compacta y no tapa selector ni chips;
- foco, ocultación y limpieza siguen funcionando.

En 781 px y escritorio, comprobar que el botón mantiene el diseño previo.
