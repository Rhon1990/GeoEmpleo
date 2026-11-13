# Indicador de carga del mapa

Fecha: 13 de noviembre de 2026.

## Objetivo

Mostrar que GeoEmpleo360 está preparando el mapa y los puntos al abrir la página, sin bloquear la búsqueda ni ocultar un mapa ya utilizable durante actualizaciones posteriores.

## Diseño aprobado

- El panel del mapa muestra desde el HTML inicial una capa centrada con un icono local de Google Material Symbols, texto «Cargando mapa y ofertas…» y estado accesible. La capa no cubre la búsqueda ni la lista.
- La capa desaparece cuando Google Maps ha emitido su primer estado `idle` y la primera respuesta del catálogo se ha aplicado, incluidos sus puntos municipales. Una respuesta válida sin puntos también termina la carga.
- Al consultar otra zona, el mapa sigue visible y una señal pequeña indica que se actualizan las ofertas. Desaparece tanto al recibir respuesta como al fallar la consulta.
- Si falla la configuración, el SDK o la primera consulta, se retira el indicador y se muestra el mensaje o botón de reintento existente. Si el mapa no alcanza su primer estado `idle` en 20 segundos tras construirse, se trata como fallo de mapa. No debe quedar un indicador permanente.
- El SVG se almacena junto a los demás Material Symbols locales y usa los colores del proyecto. La animación se desactiva con `prefers-reduced-motion`.

## Alcance y validación

La carga de datos y el número, orden o contenido de las ofertas no cambian. El indicador funciona en móvil, tableta y ordenador. Verificar: carga inicial satisfactoria, catálogo vacío, fallo de mapa, fallo de búsqueda, nueva zona y movimiento reducido; comprobar visualmente que los puntos aparecen y que el indicador desaparece.
