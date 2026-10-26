# GeoEmpleo — Identidad y composición inspirada en Bandana

**Fecha:** 16 de octubre de 2026

**Estado:** Aprobado por el usuario

**Alcance:** Rediseño visual y de composición de `apps/web-preview`; no modifica contratos, fuentes, datos ni reglas de búsqueda.

## 1. Problema

La vista local ya permite buscar ofertas reales, filtrar por territorio y coordinar lista y Google Maps, pero su composición visual actual no refleja con suficiente fidelidad la experiencia observada en Bandana. Presenta una cabecera y una introducción amplias, tarjetas principalmente textuales y un mapa contenido en un panel secundario. Esto reduce el protagonismo de la búsqueda geográfica, que es el propósito principal de GeoEmpleo.

El rediseño debe acercar la jerarquía y la densidad visual a Bandana sin copiar su identidad, sus activos ni su marca. GeoEmpleo conservará una personalidad propia, accesible y adecuada al mercado español.

## 2. Decisiones aprobadas

### 2.1 Identidad

- Nombre visible: `geoempleo`, sin espacio.
- Paleta corporativa: **Petróleo y Azafrán**.
  - Petróleo principal: `#086071`.
  - Petróleo oscuro: `#064B58`.
  - Azafrán: `#F5B944`.
  - Fondo papel: `#F4F7F6`.
  - Texto principal: `#1B2B2D`.
- El nombre se divide por significado: `geo` en petróleo y `empleo` en azafrán.
- Isotipo aprobado: **Ruta G**. Una `G` construida como recorrido termina en un punto azafrán y representa búsqueda geográfica, desplazamiento y oportunidad.
- El isotipo debe funcionar como SVG accesible, favicon, marcador de marca y elemento de cabecera, sobre fondos claros y petróleo.
- La identidad será original. No se reutilizarán el logotipo, los gráficos, los textos ni los activos de Bandana.

### 2.2 Composición principal

- La búsqueda se integra en la cabecera; se elimina el hero introductorio de la página de resultados.
- Escritorio muestra un espacio de trabajo dividido aproximadamente al 50 %:
  - izquierda: controles y resultados;
  - derecha: Google Maps ocupando toda la altura útil.
- Los filtros forman una fila compacta inmediatamente debajo de la cabecera.
- Los resultados usan una cuadrícula de dos columnas con tarjetas visuales compactas.
- El mapa y los resultados comparten el mismo contexto: el conteo y las tarjetas representan la zona visible del mapa.
- Se mantiene visible el mensaje `Sin registro` para reforzar el acceso público, sin convertirlo en una acción de cuenta.

## 3. Arquitectura de la interfaz

### 3.1 Cabecera

La cabecera contiene, en este orden:

1. lockup de Ruta G y `geoempleo`;
2. búsqueda por puesto, empresa o palabra clave;
3. localidad, provincia o código postal;
4. indicador no interactivo `Sin registro`.

La búsqueda existente mantiene su semántica, sugerencias territoriales, envío por teclado y reglas de proximidad. El cambio es de composición y estilo; no se duplica lógica de búsqueda.

### 3.2 Filtros y resumen

La fila de filtros reutiliza los estados existentes. Los filtros activos se distinguen con fondo petróleo suave, borde contrastado y texto petróleo oscuro. Debajo se muestra:

- título `Ofertas en esta zona`;
- número real de resultados devuelto por la API;
- aviso de límite cuando la consulta esté truncada;
- procedencia y fecha del catálogo sin ocultar limitaciones;
- selector visual de cuadrícula/lista solo si ambas vistas quedan implementadas y probadas. En la primera iteración puede mantenerse fija la cuadrícula, sin control inerte.

### 3.3 Tarjetas

Cada tarjeta mantiene los datos reales y la procedencia ya disponibles:

- fuente;
- título;
- municipio y provincia;
- fecha cuando exista;
- salario o jornada cuando estén publicados;
- etiquetas de categoría y tipo;
- indicación honesta de oferta pública/real;
- selección y previsualización sincronizadas con el mapa.

La zona visual superior no inventará una fotografía del puesto. Debe usar uno de estos recursos, por orden:

1. imagen autorizada entregada por la fuente;
2. tratamiento gráfico reutilizable basado en territorio/categoría, claramente decorativo;
3. bloque cromático con fuente e iconografía propia.

La ausencia de imagen nunca bloquea la tarjeta. No se añade un botón de guardado funcional porque el producto no tendrá cuenta ni almacenamiento de favoritos; un corazón puramente decorativo tampoco se mostrará.

### 3.4 Mapa

Se conserva el adaptador Google Maps y sus contratos actuales. La superficie incluye:

- marcadores o grupos con conteo;
- diferenciación de previsualización y selección;
- ubicación de referencia del usuario;
- control `Volver a mi ubicación`;
- acción `Rehacer en esta zona`;
- estado `Actualizar al mover` cuando la actualización automática esté activa;
- leyenda `Ubicaciones municipales aproximadas`, nunca direcciones laborales exactas.

Mover o ampliar el mapa mantiene el debounce y la cancelación de solicitudes existentes. El rediseño no debe crear instancias adicionales de Google Maps ni aumentar las cargas por interacción.

### 3.5 Detalle

El detalle continúa usando el mismo flujo y la misma procedencia. En escritorio se presentará preferentemente como panel superpuesto sobre la columna de resultados o como diálogo acotado, sin reemplazar el mapa. En móvil puede ocupar la mayor parte de la pantalla. Cerrar el detalle restaura el foco y limpia la selección según el contrato actual.

## 4. Comportamiento responsive

- **≥ 1024 px:** lista y mapa al 50 %, mapa fijo dentro del viewport útil y cuadrícula de dos tarjetas.
- **781–1023 px:** proporción flexible con ancho mínimo legible; tarjetas pueden pasar a una columna antes de comprimir el contenido.
- **≤ 780 px:** una sola superficie prioritaria. Resultados y mapa se alternan mediante un conmutador accesible; no se renderizan dos mapas. La búsqueda permanece arriba y los filtros permiten desplazamiento horizontal.
- El alto debe usar unidades de viewport dinámicas con un respaldo estable para navegadores móviles.

## 5. Accesibilidad

- Contraste AA para texto, controles, estados activos y marcadores.
- Isotipo SVG con nombre accesible cuando sea informativo y oculto cuando acompañe al nombre textual.
- Orden de foco: cabecera, búsqueda, filtros, resultados y controles del mapa.
- Tarjetas operables con teclado; `hover` y `focus-visible` producen la misma previsualización.
- Selección persistente anunciada mediante atributos y estilos que no dependan solo del color.
- Regiones de resultados y estado de actualización con anuncios no intrusivos.
- Respeto de `prefers-reduced-motion`; las transiciones no moverán contenido de forma imprescindible.

## 6. Reutilización y límites de implementación

Se preservan y se reutilizan:

- `app.mjs` como orquestador de consulta, detalle y estado;
- `job-interaction.mjs` para previsualización/selección;
- `google-map.mjs` para una única instancia y marcadores;
- `map-search.mjs` para viewport, debounce, abort y revisión;
- `presentation.mjs` para textos derivados de datos reales;
- las rutas `/api/jobs`, `/api/job`, `/api/places` y sus contratos.

El trabajo se concentra en la estructura HTML, componentes de renderizado reutilizables, tokens CSS y estilos responsive. Solo se modifica lógica cuando sea imprescindible para una vista móvil alternable o para exponer un estado ya existente. No se introduce framework, autenticación, almacenamiento de preferencias, nueva API de Google ni dependencia runtime.

## 7. Estrategia de implementación

1. Incorporar tokens de marca y el SVG Ruta G como recurso reutilizable.
2. Reorganizar la cabecera para integrar búsqueda y localidad sin cambiar el contrato del formulario.
3. Convertir el workspace a composición 50/50 de altura útil.
4. Convertir las tarjetas a cuadrícula visual sin inventar datos ni funciones.
5. Integrar controles de mapa existentes en la superficie del mapa.
6. Implementar el modo móvil lista/mapa con una sola instancia de mapa.
7. Ajustar diálogo/detalle, foco, estados vacíos, errores y carga.
8. Actualizar `docs/project-context.md` cuando el rediseño esté implementado y verificado.

## 8. Validación y criterios de aceptación

### Automatizada

- Las pruebas existentes de búsqueda, routing, mapa, detalle e interacción deben seguir pasando.
- Añadir pruebas enfocadas para el estado del conmutador móvil y cualquier función de presentación nueva.
- Verificar que una interacción de mapa no duplique solicitudes ni cree una segunda instancia.
- Ejecutar `npm test`, `npm run typecheck`, validación OpenAPI y las comprobaciones incluidas en `npm run check` cuando el alcance lo permita.

### Manual

- Escritorio: 1440×900 y 1280×800.
- Tableta: 1024×768.
- Móvil: 390×844 y 360×800.
- Teclado completo: búsqueda, sugerencias, filtros, tarjetas, detalle y retorno de foco.
- Estados: carga, error de mapa, sin clave, sin resultados, consulta truncada, sin ubicación y detalle fallido.
- Sin regresión de selección tarjeta–marcador ni de `Volver a mi ubicación`.
- Confirmar que los conteos, fuentes y ubicaciones mostrados provienen de respuestas reales.
- Confirmar una sola carga de mapa por visita y ausencia de nuevas llamadas de pago.

## 9. Riesgos y mitigaciones

- **Densidad excesiva:** usar jerarquía tipográfica y puntos de ruptura antes de reducir texto por debajo de lo legible.
- **Tarjetas visuales sin imágenes reales:** usar gráficos territoriales propios y explícitamente decorativos.
- **Mapa costoso:** conservar carga diferida, una instancia y controles actuales de admisión; el CSS no debe provocar reinicios.
- **Similitud de marca:** limitar la referencia a la composición e interacción; conservar identidad, textos, colores y activos originales de GeoEmpleo.
- **Funciones aparentes sin respaldo:** no mostrar favoritos, cambio de vista u otros controles hasta que su comportamiento exista.

## 10. Resultado esperado

GeoEmpleo ofrecerá una experiencia pública y geográfica de alta densidad: búsqueda integrada, resultados reales a la izquierda y Google Maps a la derecha, con una identidad propia reconocible. La interfaz se sentirá próxima al patrón útil de Bandana, pero será claramente GeoEmpleo y mantendrá las garantías existentes de procedencia, ubicación aproximada, ausencia de registro y bajo consumo.
