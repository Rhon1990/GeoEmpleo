# Aragón: auditoría de candidatos y bloqueo de publicación

Comprobación: 22/10/2026, Europe/Madrid. Se descargó el JSON oficial y se contrastaron los cuatro anuncios admitidos por el filtro inicial con el documento completo de sus boletines. Son candidatos, no ofertas activas verificadas para GeoEmpleo.

## Fuente y resultado

[Aragón Open Data, recurso 309](https://opendata.aragon.es/GA_OD_Core/download?resource_id=309&formato=json), metadatos [CKAN oficiales](https://opendata.aragon.es/api/3/action/package_show?id=datos-de-anuncios-y-ofertas-de-empleo-publico). Licencia CC BY 4.0. El catálogo advierte de posibles discrepancias por extracción automática.

La descarga de esta revisión tiene 76 filas, 73 enlaces distintos y cuatro candidatos únicos tras el filtro inicial de acceso, títulos, fechas estimadas y duplicados. Los 53 registros exclusivamente internos quedan excluidos. Los cuatro documentos originales remiten la apertura de solicitudes a un anuncio del BOE que el feed no identifica. Las fechas del feed no acreditan por sí mismas que se pueda solicitar la plaza ahora.

| Convocatoria | Documento consultado | Hallazgo |
|---|---|---|
| Ingeniero técnico industrial, Cuarte de Huerva | BOA 19/10/2026, `DOCR=9`, sección Personal | Veinte días hábiles desde el extracto en BOE. No se confirma el cierre estimado del 17/11/2026. |
| Técnico superior, Universidad de Zaragoza | BOA 09/10/2026, `DOCR=3`, sección Personal | Veinte días naturales desde BOE. El objeto convoca una plaza; el campo `num_plazas_detectado` informa 47. |
| Veterinaria, Universidad de Zaragoza, acceso mixto | BOA 08/10/2026, `DOCR=3`, sección Personal | Veinte días naturales desde BOE. El objeto enumera una plaza interna y cinco libres; el campo automático informa 40. |
| Auxiliar de biblioteca, Aliaga | BOPT 30/09/2026, `DOCR=10` | Veinte días hábiles desde BOE. Sí declara como centro la biblioteca municipal, pero falta verificar la apertura y el cierre. |

Los identificadores de documento se interpretan dentro de la consulta completa del feed (fecha, base y sección), no como IDs globales. `audit:aragon` conserva cada URL completa de navegación en `sourceUrl`.

## Error de navegación reproducido

La URL original, cambiando únicamente HTTP por HTTPS, devuelve el documento completo. Ordenar sus parámetros con `URLSearchParams` antes de navegar devuelve «Error durante la búsqueda» con HTTP 200. Se contrastó para los cuatro anuncios; el código de estado no basta como verificación del detalle. La canonicalización se limita a la identidad interna y nunca sustituye la URL pública original.

## Decisión implementable

- Mantener Aragón como `candidate`, fuera del runner diario.
- Captar candidatos en un informe operativo separado, nunca como `PublicJob`.
- Conservar fecha y plazas automáticas bajo nombres `reported*` y estado `requires_bulletin_verification`.
- Rechazar conflictos de contenido para la misma identidad; filtrar actos cerrados y recursos.
- No actualizar la cobertura territorial ni el listado público de fuentes activas con estos candidatos.

El comando `npm run audit:aragon` permitirá repetir la captura sin tocar el catálogo. Reutilizará los límites de respuesta, timeout, validación HTTPS y escritura atómica existentes. Un error conserva el último informe y termina con código 1. En esta máquina Node necesitó `--use-system-ca` para confiar en el certificado del endpoint; no se deshabilitó TLS.

## Para desbloquear la integración pública

1. Obtener y enlazar el anuncio BOE que abre cada convocatoria, comprobando organismo y objeto, no solo coincidencias de palabras.
2. Contrastar fecha de inicio y plazo de solicitud; para días hábiles, resolver el calendario aplicable o localizar una fecha final explícita fiable.
3. Extraer el centro de trabajo y las plazas de las bases correspondientes; mantener los campos desconocidos sin inventarlos.
4. Probar errores de boletín con HTTP 200, texto incompleto, convocatoria anulada y cambios del anuncio. Si no puede verificarse, conservarlo como candidato.
5. Solo entonces integrar el adaptador publicable, atribución y actualización diaria, ejecutar captura real y recalcular cobertura.

No se ha creado manualmente ninguna oferta ni se ha activado un servicio de pago. La entrega de auditoría no completa todavía el conector público de Aragón.
