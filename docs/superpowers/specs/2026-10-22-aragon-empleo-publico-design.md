# Conector estricto de empleo público de Aragón

## Revisión de seguridad tras contrastar los boletines — 22/10/2026

**La activación descrita en el diseño inicial de abajo queda suspendida.** La auditoría real demuestra que los campos calculados del feed no bastan para cumplir el requisito de ofertas vigentes. Esta revisión prevalece sobre el mapeo, la arquitectura y los criterios de activación iniciales.

Alcance ejecutable actual: `auditAragonOffers` captura candidatos tipados, sin convertirlos en `PublicJob`. Los campos estimados se llaman `reportedPublishedAt`, `reportedStartsAt`, `reportedClosingDate` y `reportedPlaces`; ninguna de esas estimaciones es un dato confirmado del catálogo. Cada candidato queda en `requires_bulletin_verification`.

El registro declara `aragon-empleo-publico` como **candidate**. `npm run audit:aragon` genera exclusivamente `var/ingestion/aragon-audit.json`, con instante de comprobación, candidatos, número de filas recibidas y cero publicaciones. No actualiza `calls.json` ni `latest.json`. Ante fallo conserva el informe anterior y devuelve código de error. La ingesta diaria mantiene sus cuatro conectores activos; una petición explícita de ingesta de la fuente candidata debe fallar sin consultar red ni cambiar el catálogo.

Los enlaces de navegación conservan el orden original de sus parámetros: reordenarlos produjo «Error durante la búsqueda» con HTTP 200. Solo la clave interna de deduplicación usa canonicalización. Filas con la misma identidad y diferentes fechas, plazas estimadas o modalidad invalidan la auditoría; no se escoge arbitrariamente la primera. Se filtran también nombramientos, convocatorias desiertas y anuncios de recursos.

No se infiere un centro laboral del organismo o boletín. El punto municipal se implementará cuando exista evidencia del lugar de trabajo y la convocatoria supere la verificación de vigencia.

Prueba real: los cuatro candidatos admitidos por el filtro inicial vinculan la apertura a una publicación en el BOE ausente del feed. Una convocatoria de la Universidad de Zaragoza contiene **una plaza** mientras el campo automático informa **47**. Véase [auditoría y condiciones para desbloquear la publicación](../../planning/2026-10-22-aragon-auditoria.md).

Criterios de esta entrega: captura reproducible gratuita; destinos oficiales preservados; duplicados y conflictos controlados; estimaciones diferenciadas por tipo de los datos publicables; catálogo y reporte diario intactos ante éxito o fallo; pruebas del bloqueo en el runner; fuente candidata documentada. La integración pública nacional continúa pendiente, sin sustituirla por un resultado de auditoría.

## Diseño inicial de referencia (activación suspendida)

## Objetivo

Incorporar a GeoEmpleo convocatorias públicas reales de Aragón mediante el recurso oficial «Ofertas en plazo de presentación» sin publicar promoción interna, resoluciones de procesos ya terminados ni contenido clasificado erróneamente como empleo.

La integración debe ser gratuita, diaria, trazable y compatible con el comportamiento actual ante fallos: una caída o una captura inválida de Aragón no puede retirar ni corromper ofertas válidas de otras fuentes.

## Fuente autorizada

- Dataset: `Datos de anuncios de oposiciones y ofertas de empleo público`.
- Recurso: `https://opendata.aragon.es/GA_OD_Core/download?resource_id=309&formato=json`.
- Titular: Gobierno de Aragón.
- Licencia: Creative Commons Attribution 4.0.
- Frecuencia declarada: tiempo real.
- Contenido: convocatorias publicadas en BOA y boletines provinciales que el portal identifica como abiertas y en plazo.

El propio catálogo advierte que los campos se generan mediante procesos automáticos y pueden diferir del boletín. GeoEmpleo tratará el feed como conjunto de candidatos y aplicará validaciones adicionales antes de publicar.

## Alcance

La primera versión incluye:

- convocatorias con `estado = Abierta`;
- acceso `Libre` o `Libre+Interna`;
- fecha de publicación no futura;
- fecha de fin igual o posterior al día de ingesta en España;
- organismo, denominación, título, fechas y enlace oficial presentes;
- descarte semántico conservador de anuncios que describen resultados, listas de admitidos, procesos concluidos, normas fiscales o actos sin una nueva solicitud abierta;
- deduplicación exacta y determinista;
- punto municipal aproximado solo cuando municipio y provincia sean inequívocos;
- atribución visible al Gobierno de Aragón y enlace al boletín oficial.

Quedan fuera:

- promoción exclusivamente interna;
- inferencia de salarios, requisitos o plazas desde prosa ambigua;
- geocodificación de organismos regionales sin centro de trabajo publicado;
- extracción masiva del texto íntegro de cada boletín;
- clasificación ocupacional automática no verificada;
- deduplicación con otras fuentes de GeoEmpleo.

## Arquitectura

Se añadirá un adaptador aislado en `packages/ingestion/src/connectors/aragon.ts`. Recibirá la captura JSON, el instante `checkedAt` y el `PlaceResolver` nacional, y devolverá únicamente objetos `PublicJob` válidos. No realizará red ni persistencia.

`packages/ingestion/src/registry.ts` declarará `aragon-empleo-publico` como fuente `open_data`, activa y CC BY 4.0. `packages/ingestion/src/runner.ts` incorporará el identificador al conjunto de conectores implementados y reutilizará el fetch JSON, la resolución nacional, la reconciliación por fuente y la publicación atómica existentes.

La web seguirá leyendo el catálogo unificado. No necesita rutas nuevas ni cambios de interfaz: procedencia, plazo, localidad y punto usarán los contratos actuales.

## Validación de captura

El adaptador exigirá un array de entre 1 y 10.000 filas. Cada fila debe ser un objeto. Los registros elegibles deben tener:

- `fuente` igual a `BOA`, `BOPZ`, `BOPH` o `BOPT`;
- `estado` igual a `Abierta`;
- `tipo` igual a `Libre` o `Libre+Interna`;
- `denominacion`, `organo_convocante`, `titulo` y `enlace` no vacíos;
- fechas españolas válidas en `fecha_publicacion`, `fecha_inicio_presentacion` y `fecha_fin_presentacion`;
- enlace con host `www.boa.aragon.es` y ruta oficial `/cgi-bin/EBOA/BRSCGI`.

Los enlaces HTTP publicados por el feed se normalizarán a HTTPS. Parámetros y fragmentos se canonicalizarán con la utilidad compartida antes de calcular identidad o detectar duplicados.

Una fila mal formada que no es elegible puede omitirse sin invalidar datos válidos. Una fila elegible con contrato roto invalida la captura para evitar publicar contenido incompleto. Un array vacío invalida la fuente y conserva la captura previa.

## Filtro semántico

La admisión será una lista positiva, no una importación por exclusión. El texto combinado de título y denominación debe expresar una convocatoria o proceso de provisión abierto mediante términos como `convocatoria`, `convoca`, `proceso selectivo`, `pruebas selectivas` o `bases reguladoras`.

Se excluyen expresamente textos que describan:

- relación definitiva o provisional de personas;
- admitidos, excluidos o personas seleccionadas;
- aprobación o resolución de un expediente ya ejecutado;
- constitución o resultado de una bolsa;
- ordenanzas, tasas y normas fiscales;
- correcciones sin convocatoria identificable.

El campo `tipo` sigue siendo obligatorio: la presencia de palabras positivas nunca convierte una convocatoria interna en acceso público.

## Identidad y deduplicación

El identificador estable se deriva de una huella versionada formada por:

1. enlace oficial canonicalizado;
2. denominación normalizada;
3. organismo convocante normalizado;
4. título normalizado.

Filas con la misma huella se colapsan en una sola publicación. Un mismo boletín puede conservar varias ofertas cuando cambia la denominación o el organismo. Una colisión de identidad con contenido diferente invalida la captura.

## Mapeo al catálogo público

- `kind`: `public_call`.
- `sourceId`: `aragon-empleo-publico`.
- `source`: `Gobierno de Aragón · Empleo público`.
- `title`: denominación publicada, excepto `NO INDICADO`, que se descarta.
- `employer`: organismo convocante.
- `publishedAt`: `fecha_publicacion` convertida a ISO.
- `closingDate`: `fecha_fin_presentacion` convertida a ISO.
- `selection`: modalidad de acceso publicada.
- `places`: `num_plazas_detectado` solo cuando sea un entero entre 1 y 100.000; en cualquier otro caso, `null`.
- `salary`: `null`.
- `category`: `otros`.
- `applicationRegistration`: `external_required`.
- `paragraphs`: título oficial, modalidad, grupo/escala cuando estén presentes y plazo publicado, sin completar datos ausentes.

## Ubicación

La ubicación se obtiene solo de evidencia estructural:

- `BOPZ`, `BOPH` y `BOPT` determinan respectivamente Zaragoza, Huesca y Teruel;
- el municipio puede extraerse de un organismo municipal con los prefijos normalizados `AYUNTAMIENTO DE`, `AYTO. DE` o `AYTO DE`;
- para `BOA`, solo se asigna provincia cuando aparece de forma inequívoca en el título u organismo;
- el par municipio/provincia debe resolver a una única entrada del gazetteer nacional.

La coordenada representa el centro municipal y conserva la nota compartida «Ubicación municipal aproximada; no es la dirección exacta del puesto». Si falta cualquiera de esas garantías, `location` queda en `null`; la oferta permanece en la lista y no participa en búsquedas por radio o viewport.

No se usa la sede del Gobierno de Aragón ni la capital provincial como sustituto del lugar de trabajo.

## Reconciliación y fallos

Aragón participará en el runner multifuente como unidad independiente:

- captura y adaptación correctas actualizan únicamente `aragon-empleo-publico`;
- fallo de red, JSON, contrato o geografía conserva su versión anterior y produce resultado parcial si otra fuente se actualiza;
- fallo exclusivo de Aragón no altera SEF, ECYL, Lanbide ni Andalucía;
- la fecha de cierre explícita permite retirar convocatorias vencidas de acuerdo con la reconciliación existente;
- la ausencia puntual de una fila no provoca retirada inmediata durante una interrupción de fuente.

La automatización diaria se actualizará después de la validación real para enumerar cinco conectores activos y mantener su política de silencio en ejecuciones correctas.

## Seguridad y coste

La integración usa solo HTTPS, el cliente HTTP limitado existente y datos públicos sin credenciales. No activa servicios, tarjetas, suscripciones ni APIs de pago. Los enlaces se restringen al host y ruta oficiales para impedir que valores manipulados se proyecten como destinos públicos.

## Estrategia QA

Las pruebas del adaptador cubrirán:

- convocatoria libre válida y vigente;
- exclusión de promoción interna;
- exclusión de resultados, admitidos y ordenanzas;
- descarte de `NO INDICADO`;
- fechas futuras, vencidas e imposibles;
- normalización HTTP a HTTPS y rechazo de hosts/rutas no autorizados;
- deduplicación exacta sin fusionar ofertas diferentes del mismo boletín;
- plazas positivas frente a valores ausentes o inválidos;
- resolución municipal única y oferta sin punto cuando la ubicación es ambigua;
- array vacío, registro elegible incompleto e identidad conflictiva.

La prueba del runner cubrirá éxito idempotente y conservación de catálogo ante fallo. La validación final ejecutará el test específico, la suite completa `npm run check`, una ingesta real solo de Aragón, una ingesta multifuente completa y el informe de cobertura. Se comprobarán JSON válido, IDs únicos, `checkedAt`, conteo por fuente y ausencia de promociones internas/falsos positivos conocidos.

## Criterios de aceptación

La integración se considera terminada cuando:

1. Aragón aparece como fuente activa con licencia y procedencia visibles.
2. La ingesta real publica al menos una convocatoria libre vigente o informa honestamente cero resultados si ninguna supera los filtros.
3. No se publica promoción interna ni los falsos positivos conocidos de la auditoría del 22/10/2026.
4. Todas las coordenadas publicadas proceden de un municipio y provincia únicos.
5. Una caída simulada conserva el catálogo previo de Aragón.
6. El catálogo completo mantiene IDs únicos y JSON válido.
7. `npm run check` termina sin fallos.
8. `docs/project-context.md`, la matriz de cobertura y la automatización diaria reflejan el quinto conector activo.
