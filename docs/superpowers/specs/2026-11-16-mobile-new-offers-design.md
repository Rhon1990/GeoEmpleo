# Novedades móviles y medición de aperturas

Fecha: 16/11/2026. Diseño aprobado por el usuario.

## Objetivo

Ayudar a quien vuelve a GeoEmpleo360 a encontrar las ofertas publicadas o detectadas desde su última visita y medir si abre sus detalles. El mapa conserva la prioridad visual en móvil.

## Comportamiento

- Reutilizar el control `#new-since` debajo del mapa. Cuando haya visita previa y novedades entre las ofertas cargadas que coinciden con la búsqueda actual, mostrarlo como botón compacto `Novedades (N)` con los colores petróleo de la interfaz. Mantenerlo oculto si no hay visita previa o el recuento es cero. En ordenador se conserva el enlace actual de la lista.
- Al pulsarlo, reutilizar la vista de resultados filtrada por novedades y el evento `new_offers_viewed`. El usuario puede volver a todas las ofertas con el control existente. La fecha de novedad sigue siendo la de publicación o primera detección, nunca la comprobación diaria.
- Al abrir el detalle de una oferta desde la vista de novedades, registrar `new_offer_detail_opened` además de `offer_detail_opened`. El evento nuevo no lleva título, identificador, URL, localidad ni otros parámetros. Mantener el consentimiento y la restricción de dominios de producción existentes.
- No cambiar las tarjetas, el carrusel, los marcadores, el catálogo, la ingesta ni los recuentos globales. El botón se ubica después del mapa y no desplaza la primera vista del mapa.

## Medición y validación

En GA4, `offer_original_clicked` ya está marcado como evento clave; el embudo búsqueda → detalle → origen ya desglosa por dispositivo y existe una exploración de cohortes D7. Tras recibir tráfico del nuevo evento, comparar usuarios que disparan `new_offers_viewed` con quienes disparan después `new_offer_detail_opened`, separados por dispositivo. No atribuir causalidad a esa comparación ni interpretar la pequeña muestra de escritorio como tendencia.

Probar visibilidad y recuento del botón en primera visita, retorno con novedades y retorno sin novedades; navegación a la vista filtrada y regreso a todas; apertura de un detalle nuevo frente a uno ordinario; consentimiento rechazado; diseño móvil a 360 y 780 px y ausencia de cambios visibles en escritorio. Verificar que el mapa y el catálogo siguen cargando y que las ofertas actuales y futuras no se filtran por este cambio.
