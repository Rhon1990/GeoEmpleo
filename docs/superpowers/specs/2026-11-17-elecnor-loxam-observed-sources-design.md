# Elecnor: publicación de ofertas observadas

## Alcance final autorizado

El usuario priorizó el portal oficial de Elecnor y pidió publicar las ofertas verificadas, su logo y añadirlas al proceso diario. Este diseño sustituye el planteamiento inicial de diez destinos de LinkedIn. Loxam queda fuera de esta entrega, pendiente de integración verificable.

## Datos y presentación

- 76 fichas observadas el 17/11/2026 en https://elecnor.epreselec.com/Ofertas/Ofertas.aspx.
- ID oficial, título, localidad, provincia y fecha editorial. URL individual construida con el ID numérico validado.
- Sin copiar descripciones ni inventar salario o fecha de cierre.
- Logo oficial local en el registro compartido de marcas; mismos componentes de tarjetas, detalle y carrusel.
- Solo puntos municipales resueltos coherentemente. Las advertencias de ubicación observadas (Angola, ámbito nacional, itinerancia, varios municipios o discrepancias) impiden crear un marcador y aparecen en el detalle.

## Actualización diaria y límite de acceso

La fuente `elecnor-oficial`, de tipo `observed_listing`, pertenece a la lista predeterminada de `runDaily`. El workflow existente la incluye sin modificar horarios ni reemplazar el catálogo público por el de prueba. Relee la captura versionada, valida sus datos y conserva `checkedAt` en el instante de revisión real. Caduca el 01/12/2026 a las 18:00 UTC si no hay nueva revisión; el runner retira únicamente las ofertas de esta fuente.

El portal devuelve HTTP 405 a la consulta automatizada comprobada el 17/11/2026. Esta entrega no implementa descubrimiento automático de nuevas ofertas de Elecnor. Requiere acceso autorizado a un feed o canal estable para sustituir la revisión manual.

## Validación y entrega

Pruebas del adaptador, fechas, geografía, reconciliación, repetición diaria sin renovar observación, caducidad y preservación de otras fuentes. Suite completa, tipos, contrato OpenAPI, build estático y rutas de imágenes. Integración en main mediante PR y ejecución del workflow diario. Verificación posterior de las 76 fichas, IDs, puntos, logo y UI en producción.
