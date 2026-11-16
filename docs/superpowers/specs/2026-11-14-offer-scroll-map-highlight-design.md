# Posición de ofertas y resaltado en el mapa

Fecha: 14/11/2026. Diseño aprobado inicialmente y corregido por el usuario el 16/11/2026.

## Objetivo

En ordenador, tableta y móvil, abrir y cerrar el detalle debe conservar la posición de lectura. Pasar el ratón o enfocar una tarjeta identifica su ubicación en el mapa; en la vista móvil de mapa, la tarjeta centrada del carrusel identifica su pin sin necesidad de tocarla.

## Comportamiento

- Conservar la posición vertical del panel de resultados y, en móvil, la posición de la página y la oferta activa del carrusel mientras se consulta un detalle. Restaurar la posición al cerrarlo sin desplazamiento animado. Un cambio explícito de búsqueda o filtros puede iniciar una nueva lista desde arriba.
- La selección de una tarjeta puede centrar su punto en el mapa, pero ese movimiento programático no debe lanzar otra búsqueda de zona ni sustituir la lista que se estaba leyendo. Mover el mapa manualmente sigue actualizando la zona como hoy.
- Reutilizar el estado de previsualización y selección de `job-interaction.mjs` y las clases de los pines de `google-map.mjs`. El pin normal conserva el petróleo y «Tu zona» conserva el amarillo. El pin o grupo de la oferta enfocada/previsualizada usa relleno coral oscuro `#B84A3A` con texto blanco. La tarjeta correspondiente recibe el mismo acento visual.
- No superponer empresa ni título sobre el mapa. En grupos de varias ofertas el color identifica el grupo donde está la oferta; el detalle se consulta en la tarjeta. Al salir del hover, volver al resaltado de la tarjeta centrada en el carrusel móvil, si procede.
- Limpiar la selección del clic al cerrar el detalle. En la vista móvil de mapa, el pin de la tarjeta centrada del carrusel se resalta automáticamente y sigue el cambio de tarjeta por deslizamiento o flechas. No cambiar automáticamente entre «Ofertas» y «Mapa». Fuera de esa vista móvil, el pin vuelve al estado normal al cerrar si no hay hover o foco activo. Si una oferta carece de punto verificable, no inventar marcador ni ubicación.

## Alcance y validación

Cambios limitados a la interacción de la web y sus estilos; no modificar catálogo, ingesta, orden de ofertas, enlaces originales ni analítica. Probar desplazamiento profundo, clic de tarjeta, cierre por botón y Escape, hover/foco, grupos de varias ofertas, cambio manual del mapa y carrusel móvil en anchos de móvil, tableta y escritorio. Verificar también que el cambio explícito de filtros sigue actualizando resultados y que la búsqueda por movimiento manual mantiene su comportamiento.
