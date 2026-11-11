# Ajustes finales de tarjetas y favoritos

## Objetivo

Corregir cuatro inconsistencias de la interfaz sin modificar el catálogo, el orden de las ofertas, los conectores ni el comportamiento de escritorio que no esté expresamente solicitado.

## Diseño aprobado

1. En el carrusel móvil, el menú de tres puntos se mantendrá dentro de los límites visuales de la tarjeta. El botón seguirá arriba a la derecha y el panel se superpondrá sobre el contenido de la propia tarjeta, evitando el recorte causado por el contenedor de desplazamiento horizontal.
2. Las tarjetas dejarán de renderizar la etiqueta pastel de procedencia situada sobre el logotipo. La procedencia seguirá disponible en el nombre accesible de la tarjeta, en el enlace original y en el detalle.
3. Los logotipos empresariales conservarán su proporción mediante `object-fit: contain` y límites máximos de anchura y altura. En el carrusel móvil no se forzarán a un cuadrado, para que marcas horizontales como Randstad tengan una presencia comparable a las demás.
4. El diálogo «Tus favoritos» mostrará únicamente ofertas. Se retirarán la sección, los botones y los mensajes de búsquedas guardadas. El contador `(n) Favoritos` contará solo ofertas. El almacenamiento histórico de búsquedas no se borrará para evitar una eliminación destructiva de datos locales, aunque ya no se expondrá en esta interfaz.

## Componentes afectados

- `apps/web-preview/public/app.mjs`: renderizado de tarjetas, menú móvil, favoritos y contador.
- `apps/web-preview/public/index.html`: contenido del diálogo de favoritos y claves de caché.
- `apps/web-preview/public/styles.css`: dimensiones proporcionales de logos y posicionamiento del menú en el carrusel.
- `tests/web-brand-layout.test.ts`: contrato estructural y visual de las cuatro correcciones.
- `docs/project-context.md`: estado funcional actualizado.

## Accesibilidad y comportamiento

- El botón de tres puntos conserva su nombre accesible y un objetivo táctil suficiente.
- Favorito, compartir y ubicación mantienen sus etiquetas y funciones actuales.
- El origen de cada oferta continúa anunciándose una vez a lectores de pantalla aunque desaparezca la etiqueta visual redundante.
- No se eliminan favoritos ni búsquedas almacenadas durante la migración de interfaz.

## Validación

- Pruebas TDD del DOM y CSS para confirmar ausencia de `source-pill`, logos no cuadrados en el carrusel, menú contenido dentro de la tarjeta y favoritos sin controles de búsqueda.
- Suite completa `npm run check`.
- Revisión manual responsive en Chrome a 390 px y escritorio, comprobando apertura del menú, legibilidad de logos, diálogo de favoritos y ausencia de regresiones de consola.

