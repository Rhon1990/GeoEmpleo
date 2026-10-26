# Contratos de transporte v1

Fuente de verdad: `schemas/v1/`, JSON Schema 2020-12. Payloads con `contractVersion: "1.0.0"`. Los seis contratos son `source-posting-event`, `search-request`, `job-detail`, `job-list`, `map-response` y `problem`.

`src/validate.ts` expone `validateContract(name, payload)` en TypeScript. Python expone `validate_contract(name, payload)` en `python/validate.py`. El resultado es `{valid: true}` o `{valid: false, issues: [{path, code}]}`; no contiene valores recibidos y limita las incidencias a 20. El orden/código exacto de errores entre motores no constituye un contrato compartido; sí lo constituye aceptar/rechazar el corpus.

Los validadores registran esquemas locales; no descargan `$ref`. No convierten tipos, eliminan campos ni aplican defaults. Objetos cerrados, nulos explícitos, importes enteros seguros y límites de página/mapa. Son validadores estructurales: no comprueban fuente autorizada, registro de país, coherencia salarial/geográfica, saneamiento HTML ni publicación elegible. Esas comprobaciones deben ejecutarse antes de persistir/publicar.

## Formatos comunes

UTC: calendario válido, años 0001–9999, segundos y milisegundos opcionales de tres dígitos, siempre `Z`. Ajv reutiliza el parser del dominio; Python comprueba calendario/canonicalización.

`http-url` es un formato personalizado obligatorio: HTTP/HTTPS, autoridad ASCII, sin credenciales, barras inversas ni host escapado; puerto decimal de hasta cinco dígitos entre 0 y 65535, IPv4/IPv6 convencionales o etiquetas DNS limitadas. Se admite IDN expresado en punycode válido. Node usa `URL`; Python usa Ada/WHATWG para evitar las diferencias de IDNA de `urlsplit`. No resuelve DNS ni acredita seguridad de un destino o permiso de extracción. Los controles SSRF corresponden al futuro captador.

Los patrones usan final absoluto y un conjunto explícito de espacios/controles para evitar diferencias de `\S` y `$` entre JavaScript/Python. Los validadores externos de los esquemas/OpenAPI deberán registrar `http-url` y el formato UTC descrito; un validador que ignore formatos no reproduce esta validación. No se garantiza equivalencia para entradas arbitrarias fuera del corpus, y actualizar runtimes/parsers exige volver a probar interoperabilidad.

## Comprobación y API prevista

Preparar dependencias con los comandos del [README raíz](../../README.md). `npm run check` ejecuta la verificación completa. `fixtures/v1.json` contiene casos propios con resultado esperado explícito, consumidos por ambos lenguajes. Python/Ada puede necesitar compilador C si no existe wheel para su plataforma.

`npm run generate:openapi` regenera `openapi/v1.json`; `npm run check:openapi` detecta diferencias. Es OpenAPI 3.1 empaquetado, con referencias internas y `security: []` en las tres rutas GET: listado, detalle y mapa por país. No hay servidor desplegado. La futura capa HTTP deserializará parámetros y aplicará los defaults documentados antes de validar.

GEO-04 sigue parcial: faltan sugerencias, catálogos territoriales/de filtros, contratos canónicos de persistencia y cierre completo de reglas del normalizador. Los clusters describen el mapa avanzado futuro; Embed no puede dibujarlos.
