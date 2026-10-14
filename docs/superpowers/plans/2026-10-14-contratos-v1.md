# Contratos v1 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Ejecución inline; revisión independiente al terminar. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Validar transporte JSON y describir la API pública inicial con contratos reutilizables por TypeScript/Python.

**Architecture:** Esquemas JSON estáticos versionados, validador Ajv compilado una vez y validador Python local sin descarga de referencias. OpenAPI empaquetado se genera desde los mismos esquemas. No hay modificaciones de la lógica salarial.

**Tech Stack:** Node 24, TypeScript, Ajv 2020, Python 3.9+ con `jsonschema` en venv.

## Secuencia acotada

- [x] Baseline: `npm run check` debe pasar las 20 pruebas existentes. Crear worktree aislado desde el HEAD actual y conservar cambios ajenos.
- [x] Preparar corpus en `packages/contracts/fixtures/v1.json` y tests `tests/contracts.test.ts` antes del validador. Cada fixture contiene `name`, `contract`, `valid` y `payload`; se compara resultado real contra `valid`, sin calcular el resultado esperado desde el esquema.

```typescript
for (const fixture of fixtures) {
  test(fixture.name, () => {
    assert.equal(validateContract(fixture.contract, fixture.payload).valid, fixture.valid);
  });
}
```

- [x] Crear esquemas comunes y seis contratos en `packages/contracts/schemas/v1/`. Añadir primero un adaptador mínimo que rechace todo y comprobar aserciones fallidas de fixtures válidos; después implementar `packages/contracts/src/validate.ts` con Ajv. Verificar ausencia de mutación y rechazo de campos de cuenta/secretos no definidos.
- [x] Extraer el parseo UTC existente a `packages/domain/src/time.ts`, usarlo desde publicación y validación sin modificar contratos del dominio. Reejecutar sus tests de caducidad.
- [x] Implementar `packages/contracts/python/validate.py` y `check_fixtures.py`, con resolución local de esquemas, chequeo de calendario y rechazo de JSON no estándar. Preparar venv y requirements fijados, sin modificar el Python global.
- [x] `npm run test:contracts:python` debe contrastar todos los fixtures con los mismos resultados esperados. `npm run check` incorporará esa comprobación; documentar instalación del venv.
- [ ] Implementar `packages/contracts/tools/generate-openapi.ts` y guardar `packages/contracts/openapi/v1.json`; usar referencias internas y `security: []`. `npm run check:openapi` debe detectar cualquier desajuste del artefacto o referencia rota; testear las rutas declaradas y formatos de respuesta.
- [ ] Ejecutar `npm run check`, revisión independiente de código/contratos y `git diff --check`. Actualizar README, contexto y backlog con alcance parcial real de GEO-04. Integrar localmente solo tras resolver hallazgos y comprobar el estado final.

## Evidencia requerida

La entrega identifica los comandos efectivamente ejecutados, número de fixtures en ambos lenguajes y resultados de tipos/regresión. No declara API funcionando a partir de OpenAPI ni integración de fuentes a partir de datos propios. Los secretos/credenciales de fuentes no viajan en los eventos ni en los DTO públicos.

## Resultado de implementación

`npm run check`: tipos, 102 tests Node, artefacto OpenAPI y 76 fixtures Python correctos. Revisión corrigió espacios Unicode, anclas de fin, autoridad/puertos, punycode y surrogates URL. Python añade ada-url/WHATWG fijado para compartir criterios de parseo con Node, sin reimplementar IDNA. README/contexto/backlog documentan setup y GEO-04 parcial. La revisión documental de mapas/coste recoge las nuevas preferencias del usuario; no activa SDK ni facturación.
