# Contratos interoperables v1

La continuación de la implementación desarrolla el contrato compartido previsto en GEO-04. Se conserva el dominio existente y el acceso público sin cuentas. Esta iteración no crea una API HTTP, base de datos ni captadores reales.

## Decisión

JSON Schema 2020-12 será la fuente de verdad de transporte; Ajv validará en TypeScript y `jsonschema` en Python. Frente a validadores escritos a mano reduce duplicación; frente a un esquema exclusivo de TypeScript permite consumir los mismos documentos desde captadores Python. OpenAPI 3.1 describe rutas públicas de búsqueda, detalle y mapa, sin seguridad de candidato y con referencias empaquetadas dentro del documento.

Se usará versión de payload `1.0.0`, objetos cerrados y valores desconocidos explícitos (`null`, arrays vacíos o códigos de estado desconocido). No habrá coerción, eliminación de campos ni aplicación de defaults durante validación. Una versión no admitida se rechaza; agregar campos a un objeto cerrado requiere evolucionar el contrato y mantener compatibilidad mediante versiones, no ignorarlos silenciosamente.

## Contratos

- Evento de publicación observada/retirada: fuente, ID externo o URL, run/parser, fecha de observación, evidencia y datos extraídos. Una retirada exige payload nulo. Una observación incompleta puede llegar a staging; no supone permiso ni elegibilidad para publicar.
- Solicitud de búsqueda: país y consulta tipada, filtros, ámbito geográfico, orden, límite y cursor. El esquema no decide si un país está habilitado ni ejecuta búsquedas.
- Detalle público completo: empresa, territorio/precisión, clasificación, contrato/jornada/modalidad, salario, descripción, procedencia y vías externas con registro requerido/no requerido/desconocido.
- Página de resultados y respuesta de mapa: tarjetas, facetas/cursor y markers/clusters limitados. Ubicaciones desconocidas se preservan fuera del mapa.
- Error público: código, mensaje y rutas/códigos de incidencia, sin incluir valores recibidos.

Campos comunes viven en un único esquema con `$defs`. OpenAPI se genera desde esos mismos archivos y se verifica contra el artefacto guardado para impedir divergencias. Los `$id` son identificadores de contrato bajo dominio reservado `.example`, no endpoints desplegados; el validador registra todo localmente y no descarga esquemas.

## Límites y QA

La validación es estructural y de formato. Reglas como mínimo salarial ≤ máximo, país registrado, correspondencias geográficas, vigencia de permisos y pertenencia de la publicación a la fuente configurada siguen perteneciendo al dominio/normalizador. No se confunde una observación válida de transporte con una oferta válida para mostrar.

El tiempo usa UTC con segundos y milisegundos opcionales de tres dígitos, calendario válido y años 0001–9999. Se extrajo el parseo ya existente del dominio a una utilidad compartida por la regla de publicación y Ajv, sin cambiar su comportamiento. Python comprueba el mismo formato mediante su biblioteca estándar.

Fixtures independientes, propios, con resultado esperado explícito: nulos, campos faltantes/desconocidos, cuentas no admitidas, versiones, tipos, importes enteros seguros, booleanos como números, fechas, coordenadas, eventos, variantes mapa y contenido público. Ambos lenguajes deben aceptar/rechazar todos los mismos fixtures; la comprobación no acredita conformidad de todos los validadores del mercado.

Las sugerencias, catálogos de filtros, modelo completo de persistencia y todas las reglas de negocio del futuro normalizador quedan fuera. GEO-04 se registrará como parcial hasta cerrar esos contratos; no se dará por terminado el catálogo nacional.

Fuentes: [JSON Schema 2020-12](https://json-schema.org/draft/2020-12), [Ajv](https://ajv.js.org/json-schema.html), [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html).

## Ajustes de revisión implementados

Se usan patrones de final absoluto y espacios/controles explícitos para resolver divergencias JavaScript/Python. El formato personalizado `http-url` limita autoridad/puerto/IP y utiliza parsers WHATWG (Node URL y Python Ada), con IDN punycode y sin surrogates aislados en URLs. Su registro es obligatorio para validadores externos, también al consumir OpenAPI. No hay resolución DNS ni comprobación SSRF. Revisar interoperabilidad al actualizar dependencias.

Corpus actual: 76 fixtures estructurales propios, más regresión del dominio/formato/OpenAPI: 102 tests Node. Ambas implementaciones aceptan/rechazan el corpus con las expectativas explícitas; no se afirma equivalencia universal entre motores.
