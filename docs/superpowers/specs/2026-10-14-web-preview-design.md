# Primera web local con datos reales

El usuario pide ver la web y exige datos reales. Se entrega una primera superficie navegable de consulta sin registro, con lista/búsqueda/filtros/detalle y Google Maps. No se publica en Internet ni se activan APIs de pago.

## Alcance

Sitio estático local en `apps/web-preview/public`, servido por Node en loopback. Alternativa elegida frente a desplegar Next.js ahora: permite revisar el producto sin añadir framework, infraestructura o gasto; la arquitectura de producción Next.js permanece propuesta. El prototipo no reutiliza fixtures de contratos como catálogo. Un snapshot curado contiene cuatro anuncios reales comprobados en BOE, referencias BOE-A-2026-21006/21008/21010/21011, publicados el 09/10/2026 y consultados el 14/10/2026. Son convocatorias públicas, no ofertas privadas ni un catálogo nacional completo. Vigencia actual, requisitos completos de las bases y registro externo no se infieren.

La primera maqueta usó un mapa general insertado para validar la composición visual. Ese enfoque fue sustituido tras comprobar que no admite marcadores propios ni sincronización con las ofertas. La implementación vigente usa Maps JavaScript API y conserva enlaces municipales de Google Maps en el detalle.

## Diseño y seguridad

Pantalla en español: marca GeoEmpleo, búsqueda por puesto/organismo, filtro territorial y categoría editorial, lista a la izquierda y mapa a la derecha. Detalle accesible con texto del anuncio y enlace al original; salario desconocido explícito, plazo textual sin fecha final calculada. Datos externos insertados como texto, no HTML. No cuentas, tracking, CV ni candidaturas. El servidor sirve exclusivamente archivos permitidos, solo GET/HEAD, en 127.0.0.1.

La atribución y fecha de origen se conservan. Los títulos cortos/categorías son adaptación editorial identificada; el texto del anuncio se distingue de ella. Reutilización informativa, no web oficial ni respaldo del BOE. [Condiciones del BOE](https://www.boe.es/informacion/aviso_legal/index.php), [Inserción de Google Maps](https://support.google.com/maps/answer/7101463?hl=es).

## Validación

Tests funcionales de filtrado de texto/ubicación/categoría sin alterar datos y preservación de salario/plazo desconocidos; corpus BOE separado de fixtures de prueba. Prueba de rutas HTTP restringidas, respuesta 200 y navegador: listado real, filtro, vacío, detalle, cierre, mapa, enlaces y diseño responsive. La API BOE directa agotó tiempo de espera; los cuatro anuncios se comprobaron mediante navegación web oficial. No se declara captación automatizada funcionando.

## Corrección de alcance: búsqueda geográfica real

El usuario rechaza la vista general como experiencia principal y confirma mantener Google Maps con clave propia. La integración se amplía a Maps JavaScript + AdvancedMarkerElement, una sola instancia, puntos de cada convocatoria, selección mapa/lista y radio alrededor de un origen. El iframe general deja de ser la superficie principal; sin clave se informa de configuración pendiente, nunca se simulan puntos sobre un iframe.

Los puntos representan la capital/núcleo municipal, obtenidos de geografía abierta con procedencia; no direcciones laborales. Distancias en línea recta aproximadas, claramente indicadas. Origen elegible por municipio del catálogo o clic en mapa; no se conserva ubicación del visitante en URLs/logs. Radio sin origen queda deshabilitado. Se puede buscar en viewport tras mover el mapa; no se presume tiempo de desplazamiento.

La configuración se realiza en `.env.local` ignorado por Git, con clave web restringida y map ID de pruebas admitido por Google. El usuario completó condiciones/facturación de prueba; la clave se rotó, se restringió a Maps JavaScript API y al origen local, y se validó sin imprimir su valor. `/config.json` contiene solo configuración pública de mapa; nunca el entorno completo. El SDK no se solicita sin clave y carga una sola vez tras acción del usuario. No hay contador de facturación de producción implementado; el QA local no acredita un tope de coste garantizado.
