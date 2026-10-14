# GeoEmpleo

Plataforma pública de descubrimiento de empleo para España, en español y sin registro ni cuentas de candidatos. El mapa previsto será Google Maps.

## Desarrollo local

Requisitos: Node.js 24 o superior, npm y Python 3.9 o superior. Preparación en macOS/Linux:

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r packages/contracts/python/requirements.txt
npm run check
```

`npm run check` comprueba tipos, pruebas Node, sincronización OpenAPI y el corpus compartido en Python. Comandos individuales: `npm run typecheck`, `npm test`, `npm run check:openapi` y `npm run test:contracts:python`. En Windows, preparar el venv con `python -m venv .venv` e instalar mediante `.venv\Scripts\python.exe -m pip install -r packages/contracts/python/requirements.txt`; el runner detecta esa ruta. `GEOEMPLEO_PYTHON` permite seleccionar otro intérprete aislado.

La primera biblioteca contiene contratos y registro de políticas de país, normalización de salarios españoles con datos explícitos y elegibilidad de publicación según permiso, contenido, estado y caducidad. El núcleo no depende de frameworks ni servicios cloud.

El paquete [contracts](packages/contracts/README.md) añade seis contratos JSON Schema 2020-12, validadores TypeScript/Python y una descripción OpenAPI 3.1 de búsqueda, detalle y mapa sin autenticación. Validar transporte no sustituye las reglas de negocio ni permite publicar automáticamente datos de una fuente.

La biblioteca no requiere cuentas, claves Google ni fuentes externas. Todavía no incluye frontend, servidor API, persistencia, mapa integrado o datos reales. No se han activado servicios de pago. El mapa avanzado y la continuidad gratuita mediante Embed se describen en la decisión de costes; no son componentes implementados.

## Documentación

- [Contexto del proyecto](docs/project-context.md).
- [Arquitectura](docs/architecture/2026-10-14-geoempleo-arquitectura.md).
- [Backlog técnico](docs/planning/2026-10-14-backlog-tecnico.md).
- [Plan de la primera iteración](docs/superpowers/plans/2026-10-14-contratos-dominio.md).
- [Contratos v1](docs/superpowers/plans/2026-10-14-contratos-v1.md).
- [Google Maps y control de coste](docs/architecture/2026-10-14-google-maps-coste.md).
