# GeoEmpleo

Plataforma pública de descubrimiento de empleo para España, en español y sin registro ni cuentas de candidatos. El mapa previsto será Google Maps.

## Desarrollo local del dominio

Requisitos: Node.js 24 o superior y npm.

```sh
npm ci
npm run check
```

`npm run check` comprueba los tipos y ejecuta las pruebas. También pueden ejecutarse por separado con `npm run typecheck` y `npm test`.

La primera biblioteca contiene contratos y registro de políticas de país, normalización de salarios españoles con datos explícitos y elegibilidad de publicación según permiso, contenido, estado y caducidad. El núcleo no depende de frameworks ni servicios cloud.

La biblioteca no requiere cuentas, claves Google ni fuentes externas. Todavía no incluye frontend, API, persistencia, mapa integrado o datos reales. Sus entradas son internas y tipadas; no debe exponerse a JSON externo sin el validador previsto para la siguiente iteración.

## Documentación

- [Contexto del proyecto](docs/project-context.md).
- [Arquitectura](docs/architecture/2026-10-14-geoempleo-arquitectura.md).
- [Backlog técnico](docs/planning/2026-10-14-backlog-tecnico.md).
- [Plan de la primera iteración](docs/superpowers/plans/2026-10-14-contratos-dominio.md).
