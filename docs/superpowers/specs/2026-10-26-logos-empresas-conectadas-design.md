# Logos de empresas conectadas

## Objetivo

Mostrar la identidad visual de la empresa en la tarjeta y el detalle de cada oferta empresarial conectada. Las ofertas genéricas, públicas o sin empresa identificable conservan el SVG neutral de GeoEmpleo.

## Diseño aceptado

- Mantener un registro local de logos en `apps/web-preview/public/brands/`, sin solicitudes de imágenes a terceros durante la navegación.
- Resolver el logo con identificadores de fuente empresarial verificados y, cuando la oferta sí identifica una marca, con su empleador canónico. No inferir la empresa a partir del título del puesto.
- Compartir el mismo resolvedor entre tarjeta y detalle. Un error de carga de imagen reemplaza el logo por GeoEmpleo neutral.
- Conservar el nombre de empleador y procedencia originales en la ficha; agrupar marca no cambia datos de la oferta.
- Añadir un inventario de fuente de cada asset para facilitar reemplazo y revisión de marca.

## Validación

Los tests cubren marcas conectadas, ofertas con empresa identificable, fuentes genéricas y fallback. La inspección visual comprobará tarjeta y detalle en escritorio/móvil; la compilación y publicación deben servir los assets locales.
