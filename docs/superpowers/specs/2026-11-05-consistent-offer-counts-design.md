# Contadores coherentes entre escritorio y móvil

## Problema observado

El mismo catálogo público contiene 20.136 ofertas únicas: 17.972 con coordenadas verificables y 2.164 sin punto. La vista de escritorio envía los límites del mapa a `/api/jobs` y su contador muestra solo ofertas dentro de esos límites. La vista inicial móvil no envía límites y muestra el total. Por eso aparecen dos números distintos para la misma búsqueda.

## Comportamiento aprobado

- El titular de resultados muestra el total de ofertas que coinciden con los filtros de texto, territorio, empresa y área profesional, sin aplicar el rectángulo visible del mapa. Es el mismo número en escritorio y móvil para la misma búsqueda.
- Un texto secundario indica cuántas ofertas tienen ubicación verificable. Cuando el mapa está activo, indica además cuántas están en la zona visible. Las ofertas sin punto permanecen en el total, pero nunca reciben un marcador inventado.
- Las tarjetas y marcadores siguen limitados a la zona visible cuando hay límites del mapa. Se conserva el límite actual de 300 tarjetas y el mensaje de truncamiento.
- Los filtros, la selección de una oferta y la búsqueda por radio mantienen su comportamiento actual. El resultado sin datos y los errores de carga se expresan como tales, sin presentar el último total como si fuera nuevo.

## Diseño técnico

Las respuestas de `/api/jobs` añaden `catalogTotal` y `catalogMappedTotal`, calculados con los filtros de búsqueda sin `bounds`. `total` conserva el significado actual: coincidencias dentro de los límites solicitados. Tanto la entrega estática como el servidor local exponen los mismos campos. La interfaz usa `catalogTotal` para el titular y presenta `catalogMappedTotal`, `total` y el número sin punto en el desglose contextual. No se modifica el catálogo ni la geocodificación.

## Validación

Una prueba de contrato con ofertas dentro, fuera y sin coordenadas debe demostrar que `catalogTotal` es estable con y sin `bounds`, que `total` cambia con el mapa y que `mapJobs` nunca contiene ofertas sin punto. La prueba de presentación debe verificar el texto del titular y del desglose, incluidos los filtros y la búsqueda sin límites. El conjunto de pruebas y la compilación deben pasar antes de publicar; en producción se comprobarán el mismo catálogo y los dos dominios públicos.
