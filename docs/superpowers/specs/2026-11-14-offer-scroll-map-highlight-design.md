# Posición de ofertas y resaltado en el mapa

Fecha: 14/11/2026. Diseño aprobado por el usuario.

## Objetivo

En ordenador, tableta y móvil, abrir y cerrar el detalle debe devolver a la misma oferta y a la misma posición de lectura. Pasar el ratón o enfocar una tarjeta debe identificar su ubicación en el mapa; al pulsarla, la selección debe seguir identificable después de cerrar el detalle.

## Comportamiento

- Conservar la posición vertical del panel de resultados y, en móvil, la posición de la página y la oferta activa del carrusel mientras se consulta un detalle. Restaurar la posición al cerrarlo sin desplazamiento animado. Un cambio explícito de búsqueda o filtros puede iniciar una nueva lista desde arriba.
- La selección de una tarjeta puede centrar su punto en el mapa, pero ese movimiento programático no debe lanzar otra búsqueda de zona ni sustituir la lista que se estaba leyendo. Mover el mapa manualmente sigue actualizando la zona como hoy.
- Reutilizar el estado de previsualización y selección de `job-interaction.mjs` y las clases de los pines de `google-map.mjs`. El pin normal conserva el petróleo y «Tu zona» conserva el amarillo. El pin o grupo de la oferta enfocada/previsualizada usa borde coral oscuro `#B84A3A`; la oferta seleccionada usa relleno coral oscuro con texto blanco. La tarjeta correspondiente recibe el mismo acento visual.
- En un pin que agrupa varias ofertas, mostrar un rótulo breve con empresa y título de la oferta activa, truncado visualmente y accesible por nombre, para que el color no señale únicamente un grupo ambiguo. Al salir del hover, volver a la selección persistente si existe.
- Mantener la selección al cerrar el detalle. En móvil no cambiar automáticamente entre «Ofertas» y «Mapa»: el pin permanece resaltado cuando el usuario abre Mapa. Si una oferta carece de punto verificable, no inventar marcador ni ubicación.

## Alcance y validación

Cambios limitados a la interacción de la web y sus estilos; no modificar catálogo, ingesta, orden de ofertas, enlaces originales ni analítica. Probar desplazamiento profundo, clic de tarjeta, cierre por botón y Escape, hover/foco, grupos de varias ofertas, cambio manual del mapa y carrusel móvil en anchos de móvil, tableta y escritorio. Verificar también que el cambio explícito de filtros sigue actualizando resultados y que la búsqueda por movimiento manual mantiene su comportamiento.
