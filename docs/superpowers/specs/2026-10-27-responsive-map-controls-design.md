# GeoEmpleo — Responsive integral y controles compactos del mapa

**Fecha:** 27 de octubre de 2026

**Estado:** Aprobado por el usuario

**Alcance:** Endurecimiento responsive de `apps/web-preview` y sustitución visual de los cinco controles del mapa por iconos accesibles en escritorio, tableta y móvil. No modifica búsqueda, fuentes, datos, Google Maps ni acciones existentes.

## 1. Problema comprobado

En móvil, la fila de categorías puede ampliar el ancho del documento porque el carrusel no queda limitado explícitamente por su contenedor flexible. Esto desalinea la página y deja controles fuera del viewport. En la vista de mapa, los cinco botones con texto ocupan varias filas y cubren una parte relevante del mapa y de las ventanas de ofertas.

La solución debe corregir la causa del desbordamiento, no ocultarla, y reducir los controles sin perder comprensión, accesibilidad ni superficie táctil.

## 2. Decisiones aprobadas

- Los cinco controles del mapa usarán iconos compactos tanto en escritorio como en móvil.
- Cada botón conservará un área interactiva mínima de 44 × 44 px.
- Los iconos serán SVG embebidos, propios y coherentes con la paleta petróleo/azafrán; no se añadirá una librería de iconos.
- La descripción aparecerá como tooltip al pasar el puntero o enfocar con teclado.
- Cada botón tendrá nombre accesible mediante `aria-label` y texto visualmente oculto. El tooltip no será la única fuente del nombre.
- `Actualizar esta zona` seguirá siendo la acción principal y mantendrá el tratamiento petróleo.
- Se preservan IDs, listeners, estados `disabled`, analítica y comportamiento de las cinco acciones actuales.
- El ajuste cubrirá cualquier otro desbordamiento relacionado encontrado en cabecera, filtros, proximidad, resultados, mapa, ventanas, diálogos y pie.

## 3. Arquitectura de interfaz

### 3.1 Barra de acciones del mapa

`map-actions` seguirá dentro del único `map-overlay` y del único mapa. Cada botón contendrá:

1. un SVG decorativo con `aria-hidden="true"`;
2. un texto `.visually-hidden` con el nombre de la acción;
3. un atributo `aria-label` equivalente;
4. un texto de tooltip asociado mediante un atributo declarativo, sin JavaScript adicional.

Acciones e iconos:

| Acción existente | Icono |
|---|---|
| Volver a mi ubicación | marcador con retorno |
| Usar mi ubicación | punto de mira |
| Elegir mi zona | marcador de mapa |
| Rehacer en esta zona | actualización circular |
| Ver España | mapa territorial simplificado |

La barra permanecerá flotante sobre el mapa. En anchuras pequeñas podrá ajustar su separación, pero no crecerá a botones de texto ni cubrirá el ancho completo. Los tooltips se colocarán bajo el botón y se limitarán al viewport.

### 3.2 Contención responsive

- `filter-bar`, `filter-controls` y `categories` tendrán límites explícitos `min-width: 0`, `width/max-width: 100%` donde corresponda.
- Las categorías conservarán desplazamiento horizontal interno y no aumentarán el `scrollWidth` del documento.
- Empresa y `Limpiar filtros` se reorganizarán sin competir con el carrusel.
- Localidad y distancia pasarán de fila flexible a una composición apilada cuando el ancho no permita campos legibles.
- Cabecera, navegación, búsqueda y botón principal podrán envolver contenido sin anchos mínimos incompatibles.
- Textos extensos de tarjetas, estados y diálogos podrán romper línea sin ampliar el viewport.
- Las ventanas de grupos del mapa usarán un máximo relativo al viewport.
- El diálogo y el panel de consentimiento respetarán márgenes móviles seguros.
- No se aplicará `overflow-x: hidden` al documento como sustituto de corregir el elemento causante.

### 3.3 Puntos de ruptura

- **Escritorio (> 900 px):** composición actual lista/mapa; barra flotante de iconos.
- **Tableta (781–900 px):** cabecera envuelta y columnas flexibles; controles compactos.
- **Móvil (≤ 780 px):** conmutador Ofertas/Mapa, una superficie visible, filtros contenidos y mapa con toolbar compacta.
- **Móvil estrecho (≤ 480 px):** campos apilados, gaps reducidos y toolbar ajustada sin reducir objetivos táctiles por debajo de 44 px.

## 4. Accesibilidad e interacción

- Área táctil mínima de 44 × 44 px.
- Estado `disabled` perceptible visualmente y conservado semánticamente.
- `focus-visible` con el anillo corporativo existente.
- Tooltip visible mediante `hover` y `focus-visible`; oculto cuando no hay interacción.
- El tooltip no interceptará eventos ni alterará el tamaño de la barra.
- El nombre accesible no dependerá de `title`, hover o color.
- Los iconos no introducirán imágenes externas ni solicitudes adicionales.
- Se conserva el orden de tabulación y de las acciones existentes.

## 5. Estrategia de pruebas

### Automatizada

- Prueba estructural para exigir icono, nombre accesible y texto oculto en cada acción.
- Prueba CSS para exigir botones compactos, objetivos de 44 px y tooltip por hover/foco.
- Pruebas responsive para exigir contención de filtros, categorías y ventana de mapa.
- Las pruebas existentes deben acreditar que IDs, etiquetas aprobadas, listeners, analítica, mapa único y alternancia móvil no cambian.
- Ejecutar las pruebas nuevas primero en rojo y después en verde, seguidas de `npm test`, `npm run typecheck` y `git diff --check`.

### Manual

Validar 320×568, 360×800, 390×844, 768×1024, 1280×800 y 1440×900:

- `document.documentElement.scrollWidth === document.documentElement.clientWidth`;
- filtros utilizables y categorías desplazables internamente;
- todos los controles del mapa visibles sin tapar las ventanas de ofertas;
- tooltips correctos con ratón y teclado;
- acciones ejecutables con toque y teclado;
- sin recrear Google Maps ni modificar las cargas de API;
- resultados, detalle, consentimiento y pie sin recortes laterales.

## 6. Archivos previstos

- `apps/web-preview/public/index.html`: contenido semántico e iconos de los controles.
- `apps/web-preview/public/styles.css`: toolbar, tooltips y contención responsive.
- `tests/web-brand-layout.test.ts`: contrato estructural y visual automatizado.
- Pruebas adicionales existentes solo si revelan una regresión funcional concreta.
- `docs/project-context.md`: actualizar el estado después de la validación final.

## 7. Riesgos y mitigaciones

- **Iconos ambiguos:** tooltip y nombre accesible explícito para cada acción.
- **Tooltip fuera del viewport:** posición acotada y alineación especial en extremos.
- **Objetivos demasiado pequeños:** 44 px mínimos aunque el dibujo sea compacto.
- **Regresión de listeners:** conservar IDs y no cambiar el código de eventos salvo evidencia.
- **Solución cosmética del overflow:** probar el ancho real del documento y limitar los contenedores causantes.
- **Cambio de escritorio innecesario:** solo se compactan controles del mapa; la composición 50/50 se conserva.

## 8. Criterios de aceptación

1. No existe desplazamiento horizontal del documento entre 320 px y escritorio.
2. Todas las categorías siguen accesibles mediante desplazamiento interno.
3. Los cinco controles del mapa son iconos compactos en todos los tamaños.
4. Cada control conserva su función, estado y seguimiento analítico.
5. Todos los controles tienen nombre accesible y tooltip en hover/foco.
6. Las ventanas de ofertas y los controles pueden coexistir sin solapamiento significativo.
7. La suite automatizada y la comprobación visual en los seis viewports definidos finalizan sin regresiones.
