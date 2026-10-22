# Cobertura provincial reproducible

> **For agentic workers:** Ejecutar con superpowers:executing-plans y TDD, sin alterar catálogo ni activar fuentes candidatas.

**Goal:** Medir publicaciones y puntos de los 52 territorios desde cada catálogo real, incluyendo explícitamente zonas vacías.

**Architecture:** Reutilizar el registro de provincias y sus alias. Una función pura produce el informe; un CLI de solo lectura imprime JSON. No modifica la ingesta, la web ni el catálogo.

**Tech Stack:** TypeScript, Node test runner, utilidades geográficas existentes.

- [x] Añadir `tests/ingestion-coverage.test.ts`: catálogo vacío => 52 filas; alias unidos; puntos ausentes/invalidos diferenciados; provincias desconocidas no desaparecen; IDs duplicados y fechas inválidas fallan. Ejecutar `node --test tests/ingestion-coverage.test.ts` antes de implementar.
- [x] Exponer `listSpanishProvinces(): readonly SpanishProvince[]` desde el registro existente sin duplicar la lista.
- [x] Crear `packages/ingestion/src/coverage.ts`, exportando `buildCoverageReport(input:unknown)`, que valida campos usados y cuenta publicaciones por provincia/fuente. Conservar fechas observadas por fuente; no denominar activas a las publicaciones conservadas.
- [x] Crear `packages/ingestion/src/coverage-cli.ts` que lee el catálogo desde una ruta relativa al módulo e imprime JSON. Registrar `npm run report:coverage` sin escritura al catálogo.
- [x] Ejecutar tests, tipos y suite completa. Generar `docs/planning/2026-10-19-cobertura-provincial.json` desde el CLI y comprobar sumas y 52 filas.
- [x] Actualizar `docs/project-context.md` y auditoría de Aragón: el plazo de recurso de Tarazona se extrajo como plazo de presentación; fuente no activada. El alcance de conectar nuevas fuentes sigue pendiente.

Esta entrega es infraestructura de medición de la ampliación, no acredita nuevas fuentes conectadas ni cobertura nacional efectiva. No se mezclan los cambios UI previos en un commit.
