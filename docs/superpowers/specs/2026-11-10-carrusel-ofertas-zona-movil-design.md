# Carrusel de ofertas visibles en el mapa móvil

**Fecha:** 10 de noviembre de 2026

**Estado:** diseño aprobado por el usuario

**Alcance:** vista móvil de GeoEmpleo360, hasta 780 px

## Objetivo

Sustituir el bloque móvil «Primera oferta de esta zona» por un carrusel que permita recorrer todas las ofertas actualmente visibles en el mapa. La interfaz de escritorio no cambia.

## Diseño aprobado

- El encabezado mostrará «N ofertas en esta zona» a la izquierda y, a la derecha, la navegación compacta «‹ X de N ›».
- Se mostrará una sola tarjeta activa por paso. No habrá una segunda tarjeta detrás ni contenido parcialmente cubierto.
- La navegación admitirá desplazamiento horizontal táctil con ajuste a una tarjeta y dos flechas en el encabezado.
- Las flechas no tendrán círculo, fondo ni borde visible. Mantendrán un área táctil de 44 px alrededor del chevrón.
- La tarjeta ocupará todo el ancho del bloque. Las flechas nunca se superpondrán al logotipo, título, localidad ni metadatos.
- La flecha anterior estará desactivada en la primera oferta y la siguiente en la última.
- Cada tarjeta reutilizará la identidad empresarial existente: logotipo real cuando esté disponible y marca neutral de GeoEmpleo360 como fallback.
- La tarjeta conservará el botón de tres puntos y sus acciones de favorito, compartir y ubicación.
- Pulsar el cuerpo de la tarjeta abrirá el detalle existente.
- El control aparecerá únicamente en móvil. Escritorio conservará su lista y disposición actuales sin carrusel ni flechas nuevas.

## Fuente de datos y actualización

El carrusel recibirá exactamente el conjunto devuelto por `visibleMapJobs(page, origin, radiusKm)`, ya usado para representar las ofertas de la zona visible. Por tanto:

1. una búsqueda, cambio de filtros o movimiento del mapa actualiza `page`;
2. se recalculan las ofertas visibles del mapa;
3. el carrusel solo reconstruye sus tarjetas si cambia la secuencia de IDs; una actualización equivalente conserva el DOM y el desplazamiento horizontal;
4. la posición se restablece a la primera oferta si la oferta activa ya no pertenece a la zona;
5. si sigue visible, se conserva su posición para evitar saltos innecesarios.

El carrusel no elimina, agrupa ni limita ofertas adicionales. Solo presenta las ofertas visibles ya disponibles en memoria y no altera el catálogo, los conectores ni las futuras publicaciones. La proyección de ofertas del mapa incluirá los campos resumidos que ya consume `card(call)` —fechas, provincia, categoría, plazas, salario, fuente e identificador para resolver el logotipo—, pero seguirá excluyendo la descripción completa.

## Componentes y responsabilidades

### Estado del carrusel

Un controlador pequeño mantendrá el ID activo, resolverá el índice actual y expondrá operaciones anterior, siguiente y selección por desplazamiento. No tendrá acceso al catálogo completo ni modificará filtros.

### Render móvil

El bloque móvil compondrá:

- encabezado con total y un grupo de navegación formado por botón anterior, posición y botón siguiente;
- viewport horizontal de ancho completo con las tarjetas existentes;
- indicación breve «Desliza horizontalmente o usa las flechas».

Las tarjetas se construirán reutilizando `card(call)`, `employerBrand(call)` y el menú de acciones actual. No se duplicará la lógica de logos, detalle, favoritos ni compartir.

### Escritorio

El bloque seguirá oculto fuera de `@media(max-width:780px)`. La cuadrícula de resultados y el mapa de escritorio no recibirán reglas ni controles nuevos.

## Interacción y accesibilidad

- Las flechas tendrán al menos 44 px de área táctil, etiquetas «Oferta anterior» y «Oferta siguiente», y un chevrón visible sin contenedor circular.
- El carrusel usará desplazamiento horizontal nativo, `scroll-snap-type` y `scroll-snap-align`.
- Al usar una flecha, el foco permanecerá en ella y la tarjeta cambiará mediante desplazamiento suave, salvo si el usuario prefiere movimiento reducido.
- El contador se actualizará después del desplazamiento sin anunciar repetidamente toda la tarjeta.
- Las flechas desactivadas usarán el atributo `disabled` real.
- El contenido de la tarjeta no quedará debajo de las flechas porque la navegación vivirá exclusivamente en el encabezado.

## Estados límite

- **Cero ofertas:** el bloque se oculta, como ocurre actualmente.
- **Una oferta:** se muestra «1 oferta en esta zona», contador «1 de 1» y ambas flechas desactivadas.
- **Muchas ofertas:** todas permanecen accesibles mediante scroll; no se crean copias infinitas ni navegación circular.
- **Cambio de zona durante un gesto:** se cancela el índice anterior y se aplica el conjunto más reciente.
- **Actualización equivalente del mapa:** no se reconstruye la pista ni se pierde la oferta activa.
- **Logo ausente o fallido:** se usa el fallback neutral ya existente.

## Medición y privacidad

El cambio no añade analítica nueva ni envía coordenadas, índices o identificadores de ofertas. La apertura del detalle y la salida al origen conservan los eventos actuales. La posición del carrusel solo vive en memoria durante la sesión de página.

## Validación

Las pruebas automatizadas cubrirán:

- render de todas las ofertas visibles y no solo la primera;
- actualización al cambiar el conjunto visible;
- conservación o reinicio correcto del ID activo;
- estados de las flechas en primera, intermedia, última y única oferta;
- contador singular/plural y posición;
- apertura del detalle y menú de tres puntos desde cualquier tarjeta;
- reglas móviles con scroll snap, tarjeta de ancho completo, flechas en el encabezado sin círculo y objetivos de 44 px;
- proyección de mapa suficiente para renderizar la tarjeta sin incluir la descripción;
- conservación visual de la tarjeta activa cuando el mapa emite una actualización con los mismos IDs;
- ausencia del carrusel y de las flechas en escritorio.

La QA manual se realizará en 390 × 844 y en escritorio. Se verificará swipe, flechas, logos, textos sin solapamiento, menú, detalle, cambio de zona y conservación de la oferta activa cuando el conjunto no cambia.

## Fuera de alcance

- Cambiar la lista de ofertas de escritorio.
- Modificar el criterio geográfico del mapa.
- Alterar orden, deduplicación, vigencia, catálogo o conectores.
- Añadir paginación remota o carga infinita.
- Publicar la rama en producción.
