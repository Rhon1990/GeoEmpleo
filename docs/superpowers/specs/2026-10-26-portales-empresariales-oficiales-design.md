# Portales empresariales oficiales: diseño de ampliación

## Objetivo

Ampliar GeoEmpleo con vacantes reales publicadas en los portales oficiales de las empresas priorizadas, sin inferir puestos a partir de sus tiendas, sedes, hoteles, oficinas o puntos de venta. La búsqueda seguirá siendo pública y sin registro, y el mapa solo mostrará ubicaciones laborales verificables.

## Decisiones

- La fuente canónica es la ficha pública de la vacante en el portal oficial del empleador.
- Se reutilizarán adaptadores por ATS antes de crear conectores específicos por empresa.
- La primera entrega cubrirá tablones SAP SuccessFactors porque el patrón ya existe en KFC y permite incorporar varias empresas con un contrato común.
- Cada empresa tendrá configuración declarativa: identificador de fuente, dominio permitido, ruta del tablón, empleador, categoría y límites de captura.
- Una oferta solo se publica si conserva identificador estable, título, empleador, enlace HTTPS autorizado, contenido no vacío y una fecha real o fecha de primera observación explícitamente etiquetada.
- La geografía procede de la localidad publicada en la vacante. No se usa el inventario de establecimientos de la empresa.
- Una localidad española única recibe un punto municipal aproximado. Una oferta remota, nacional, itinerante o con varias localidades permanece en la lista sin marcador.
- Cada fuente falla de manera aislada. Una respuesta vacía, una estructura desconocida o un volumen fuera del rango esperado no retira el catálogo anterior de esa fuente.
- La actualización diaria existente ejecutará los conectores activos; no se consultarán los portales al mover el mapa.

## Fuentes priorizadas

### Ola 1: ATS compartido SuccessFactors

- Meliá Hotels International.
- Vithas.
- Capgemini.
- MAPFRE.
- Correos.

Estas fuentes exponen listados y fichas públicas con identificadores y ubicaciones. El adaptador será genérico y KFC migrará al mismo núcleo sin cambiar sus datos públicos.

### Ola 2: portales públicos con adaptador específico o ATS distinto

- DIA y Lidl.
- DHL.
- DomusVi y Amavir.
- NTT DATA y Accenture.
- RTVE.

Cada fuente se activará solo después de una prueba de contrato con una captura representativa y una comprobación de acceso público sin credenciales.

### No activables todavía

- MRW: el canal observado es principalmente un formulario de candidatura, no un catálogo público estable de vacantes.
- Paradores: se vigilarán convocatorias oficiales, pero no se publicará una candidatura general ni un proceso sin plazo abierto.
- Loterías: los puntos de venta no son vacantes. Solo se admitirían procesos laborales de SELAE vigentes.
- Servicios Sociales municipales: requiere fuentes por administración; no existe un portal empresarial nacional único.
- Cualquier portal que exija autenticación para consultar el detalle, bloquee el acceso automatizado, carezca de identificadores estables o no permita verificar la vigencia permanecerá como candidato.

## Arquitectura

`successfactors.ts` contendrá el contrato común del ATS, validación estricta de URL, análisis de listado y detalle, paginación limitada, adaptación a `PublicJob` y captura concurrente acotada. `successFactorsBoards` contendrá únicamente configuración y permitirá que el registro y el runner incorporen empresas sin ramas específicas.

El runner resolverá la localidad con el nomenclátor nacional actual, reconciliará cada empresa por `sourceId + id` y mantendrá la política de retención cero para ATS: una ficha que desaparece de una captura válida se retira; una captura fallida conserva la anterior.

## Contrato geográfico

- Municipio único y provincia coherente: marcador municipal aproximado.
- Provincia sin municipio, varias localidades, ámbito nacional, remoto o itinerante: sin marcador.
- La tarjeta conservará el texto territorial publicado por la empresa.
- No se realizará geocodificación de direcciones mediante Google Maps durante la ingesta.

## Seguridad y calidad

- Lista explícita de dominios y patrones de rutas por tablón.
- HTTPS obligatorio; sin puertos, credenciales, redirecciones ni hosts externos.
- Máximo de páginas, ofertas y tamaño de respuesta.
- Rechazo de listados vacíos y duplicados.
- HTML convertido a párrafos mediante la sanitización existente.
- Pruebas de dominio, identidad, fecha, geografía ambigua, remoto, paginación, duplicados, fallo aislado e idempotencia.
- Una ejecución real se publicará solo después de `npm run check`, validación de IDs únicos y revisión de una muestra de enlaces oficiales.

## Interfaz

No se requiere un rediseño. Las nuevas ofertas usarán tarjetas, filtros, detalle, logotipos y mapa existentes. Al mover el mapa, GeoEmpleo filtrará el catálogo descargado por el rectángulo visible; nunca iniciará scraping desde el navegador.

## Criterios de aceptación

1. Todas las ofertas nuevas tienen URL oficial verificable y un `sourceId` empresarial.
2. No existe ninguna oferta creada a partir de una sede o establecimiento sin vacante publicada.
3. Las ofertas con municipio único aparecen en lista y mapa con nota de precisión municipal.
4. Las ofertas ambiguas permanecen consultables sin marcador.
5. El fallo de una empresa no elimina sus datos previos ni impide actualizar las demás.
6. La ejecución repetida no crea IDs duplicados.
7. La web pública conserva búsqueda, filtros, detalle y navegación del mapa sin registro.

