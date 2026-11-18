# Búsqueda de localidad de referencia

## Problema

La búsqueda puede presentar por separado un registro de localidad y otro postal del mismo lugar. Por ejemplo, Coslada aparece como `Coslada · Madrid (28820)` y `Coslada · Madrid (28821, 28822, 28823)`, aunque ambos puntos corresponden prácticamente al mismo sitio. Además, al limpiar tras elegir una localidad se retiran el origen y el radio, pero el mapa conserva su encuadre local y la búsqueda vuelve a usar el área visible; el resultado parece seguir filtrado.

## Diseño aprobado

- Mostrar una sugerencia combinada cuando localidad y registros postales tengan el mismo nombre normalizado y provincia y representen el mismo punto práctico. Unir los códigos postales y conservar como punto de referencia el registro de localidad.
- Mantener separadas las sugerencias de barrios, núcleos o localidades distintas, incluso dentro del mismo municipio. La selección mantiene el punto propio de la sugerencia y acerca el mapa a una escala adecuada a su precisión.
- Al limpiar un origen manual, borrar el texto, el punto y la distancia, retirar el ámbito local retenido y volver al encuadre general del mapa. La búsqueda por el área visible se actualiza con ese nuevo encuadre.
- Conservar el comportamiento existente de ubicación del dispositivo y de criterios no relacionados.

## Límites

El punto representa una ubicación municipal aproximada, no una dirección exacta. La agrupación no debe combinar homónimos de provincias distintas ni registros con ubicaciones diferentes.

## Criterios de aceptación

1. Coslada se ofrece una sola vez con todos sus códigos postales cuando los registros representan el mismo sitio.
2. Dos barrios o localidades con puntos diferentes siguen apareciendo como opciones separadas.
3. Elegir una sugerencia centra y acerca el mapa al punto de esa sugerencia.
4. Limpiar después de elegir una localidad elimina origen, radio y ámbito de búsqueda local, y devuelve el mapa a la vista general.
5. Limpiar filtros conserva el comportamiento ya definido para la ubicación del dispositivo y no altera los filtros no relacionados.
