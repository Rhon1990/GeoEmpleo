# Elecnor y Loxam: fuentes observadas con enlace al origen

## Objetivo

Publicar en GeoEmpleo360 las vacantes actuales de Elecnor y Loxam que puedan verificarse en las páginas indicadas por el usuario, aunque no exista un canal de ingesta diaria estable. La publicación será parcial y transparente: conservará el enlace de candidatura original, no copiará descripciones completas y caducará si no se renueva mediante una nueva observación.

## Alcance aprobado

- Elecnor se observará desde su portal oficial ePreSelec y, cuando la protección interactiva impida leer el listado, desde resultados públicos de Google Jobs que conduzcan a una ficha concreta.
- Loxam se observará desde el resultado público de Google Jobs aportado por el usuario.
- Google Jobs se usa solo para descubrir fichas visibles. Cada oferta publicada debe conservar un destino HTTPS concreto del proveedor que muestra Google, por ejemplo LinkedIn. No se enlazará una búsqueda genérica como si fuera una ficha.
- Se publicarán como máximo 25 fichas verificadas por empresa en cada revisión manual. La cobertura se identificará como parcial y no como catálogo completo.
- No se resolverán CAPTCHAs ni se intentará eludir bloqueos, autenticación o límites técnicos.
- No se copiarán descripciones completas, requisitos, salarios ni fechas que no puedan comprobarse directamente.
- No se añadirán logotipos de las empresas. Las tarjetas reutilizarán la identidad neutral existente hasta disponer de un activo autorizado.

## Alternativas consideradas

### Seleccionada: instantánea observada y caducable

Un archivo versionado contiene únicamente metadatos revisados: identificador estable, empresa, título, municipio/provincia, enlace de ficha, proveedor visible, fecha de observación y fecha de caducidad. Es la opción más rápida que mantiene trazabilidad y evita presentar un agregador como fuente oficial.

### Descartada: captura automática de Google Jobs o ePreSelec

Google Jobs no es un feed contractual y ePreSelec presenta una verificación interactiva. Automatizar cualquiera de los dos produciría un conector frágil y podría requerir eludir controles. No se implementará.

### Descartada: esperar un feed oficial

Es la opción con menor riesgo operativo, pero no cumple la petición de publicar ofertas actuales. La instantánea observada queda diseñada para sustituirse por un conector oficial cuando exista.

## Arquitectura

Se añadirá un adaptador genérico de fuentes observadas en `packages/ingestion/src/connectors/observed-employers.ts`. Leerá un archivo JSON local y producirá `PublicJob[]` sin realizar solicitudes externas.

El modelo de fuente incorporará el tipo `observed_listing`, separado de `ats`, `partner_api` y `agreement`. El registro declarará:

- `observed-elecnor`, con el portal oficial de ePreSelec como endpoint informativo.
- `observed-loxam`, con la búsqueda pública aportada como endpoint informativo.

El runner tratará ambas fuentes como implementadas. La lectura completa del archivo debe validarse antes de reconciliar el catálogo. Un archivo inválido falla de forma aislada y conserva la publicación anterior. Una instantánea válida sin ofertas vigentes retira las anteriores porque su caducidad es deliberada.

## Contrato de datos observado

Cada registro contendrá:

- `sourceId`: solo `observed-elecnor` u `observed-loxam`.
- `id`: derivado de la URL canónica de destino, estable y único dentro de la fuente.
- `title` y `employer`: texto visible, no inferido.
- `city`, `province`: valores visibles y coherentes con el nomenclátor nacional; si no son inequívocos se guardará ubicación no indicada.
- `sourceUrl`: ficha HTTPS concreta de ePreSelec, LinkedIn u otro proveedor visible en la tarjeta de Google Jobs.
- `provider`: nombre transparente del intermediario o portal que publica la ficha.
- `observedAt`: instante UTC de la revisión manual.
- `expiresAt`: instante UTC posterior y como máximo 14 días después de `observedAt`.

El adaptador rechazará propiedades desconocidas, duplicados, URLs con credenciales o puertos, fechas no canónicas, empresas distintas de la fuente y vigencias superiores a 14 días. Primero validará la instantánea completa y después filtrará las filas caducadas.

## Presentación pública

Las ofertas usarán las tarjetas, filtros, detalles y mapa actuales. El detalle incluirá únicamente:

- el título y la localidad observados;
- una nota que indique que es una oferta observada y que la descripción y vigencia deben comprobarse en la fuente original;
- el proveedor visible y el enlace de salida;
- la fecha de primera observación, marcada como observada, no como fecha de publicación del empleador.

Solo se dibujará un punto municipal aproximado cuando municipio y provincia se resuelvan de forma única. Ámbitos nacionales, varias localidades o ubicaciones ambiguas quedarán en la lista sin marcador.

## Flujo de actualización

1. Revisar manualmente las páginas aportadas.
2. Abrir cada resultado y conservar únicamente los que tengan una ficha HTTPS concreta y visible.
3. Actualizar el archivo versionado con las filas verificadas y una vigencia máxima de 14 días.
4. Ejecutar pruebas dirigidas, suite completa, tipos y una captura local aislada.
5. Publicar mediante el flujo diario existente y verificar recuentos, IDs únicos y enlaces HTTPS.
6. Si no se repite la revisión, el runner retirará las filas al caducar; nunca renovará `checkedAt` solo por volver a leer el archivo.

## Manejo de errores

- CAPTCHA o login: no se publica esa ficha desde ese canal.
- Destino genérico, búsqueda o redirección no verificable: se descarta.
- Dato territorial ambiguo: oferta sin marcador.
- Registro inválido o duplicado: falla toda la instantánea de esa fuente y se conserva el catálogo anterior.
- Todas las filas caducadas en una instantánea válida: reconciliación vacía y retirada de la fuente.

## Pruebas y QA

- Parser: estructura estricta, IDs únicos, dominios HTTPS y caducidad máxima.
- Adaptación: texto transparente, `dateKind: observed`, `checkedAt` igual a `observedAt`, sin salario ni descripción inventados.
- Geografía: municipio coherente recibe punto aproximado; ambigüedad no recibe punto.
- Runner: ambas fuentes quedan registradas, una fuente inválida no afecta a la otra y una instantánea caducada retira sus ofertas.
- Catálogo: no hay IDs duplicados y todos los destinos responden o muestran una ficha verificable durante la revisión.
- Web: filtro por Elecnor/Loxam, detalle, enlace externo y presentación neutral.
- Regresión: `npm test`, `npm run typecheck` y `git diff --check`.

## Riesgos residuales

- La cobertura es parcial y depende de una revisión manual.
- Un destino puede retirar una oferta antes de los 14 días.
- LinkedIn u otros proveedores pueden exigir registro para candidatarse; GeoEmpleo lo indicará como registro externo desconocido o requerido según lo visible.
- La vigencia no se renueva sin una nueva observación humana.

## Criterios de aceptación

1. Se publica al menos una ficha verificable de Elecnor y una de Loxam, o se informa expresamente si una empresa no ofrece ningún destino concreto verificable durante la revisión.
2. Cada oferta enlaza a una ficha concreta y atribuye el proveedor visible.
3. No se publica una búsqueda genérica, contenido completo copiado, salario inferido ni fecha inventada.
4. Las fichas no verificadas durante 14 días desaparecen automáticamente.
5. El fallo de una fuente no elimina ni bloquea las demás.
6. El mapa solo muestra municipios resueltos de forma inequívoca.
7. La web sigue siendo pública, sin registro propio y compatible con ordenador, tableta y móvil.
