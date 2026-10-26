# Google Maps: experiencia y coste inicial

Fecha de comprobación: 14 de octubre de 2026. Estado: adaptador web local, clave restringida y QA real del SDK completados. El proyecto usa una prueba gratuita que requiere actualización manual antes de cobrar; el control de consumo de producción sigue pendiente. El usuario confirma Google Maps y rechaza que un iframe general sustituya al mapa de ofertas.

El usuario quiere una experiencia lo más parecida posible a Bandana, Google Maps y poco gasto, inicialmente usando solo cargas gratuitas. Se prioriza mapa avanzado con marcadores propios, clusters y selección sincronizada con lista; se conserva un mapa básico gratuito cuando no pueda usarse el avanzado.

## Datos verificados

| Modalidad | Precio publicado | Encaje |
|---|---|---|
| Dynamic Maps / Maps JavaScript API | 10.000 cargas gratuitas al mes; después 7 USD/1.000 en el primer tramo | Marcadores propios, clusters, eventos y sincronización de resultados |
| Maps Embed API | Uso gratuito ilimitado, sin límites diarios/de tasa publicados | Mapa interactivo básico, zona o ubicación seleccionada; sin capas arbitrarias del catálogo |

Las 10.000 cargas son del SKU por cuenta de facturación, compartidas entre sus proyectos; no son 10.000 por usuario ni por fuente. Una visita puede crear más de una carga si se reinstancia el mapa. Las tarifas pueden cambiar y se revalidarán antes de activar el servicio. [Tarifas globales](https://developers.google.com/maps/billing-and-pricing/pricing), [Embed: facturación](https://developers.google.com/maps/documentation/embed/usage-and-billing).

Embed admite `place` y `view`, entre otros modos. `view` se centra en coordenadas sin marcador; `place` muestra una ubicación identificada por nombre/dirección/plus code/ID. Su modo `search` busca en Google, no en las ofertas de GeoEmpleo. El iframe no expone los eventos/capas necesarios para un buscador geográfico de ofertas como Bandana. No se superpondrán artificialmente nuestros marcadores sobre un iframe. [Modos y parámetros](https://developers.google.com/maps/documentation/embed/embedding-map).

## Diseño recomendado

Dos adaptadores de presentación, `GoogleDynamicMap` y `GoogleEmbedMap`, sobre geografía propia. El buscador, filtros y detalle permanecen públicos y desacoplados de ambos.

1. El avanzado usa una sola instancia por sesión de página. Cambiar filtros, selección, viewport o markers reutiliza esa instancia; no crea otro `google.maps.Map`. Carga bajo demanda al abrir el mapa, sin precargarlo en páginas que no lo usan. No se guardan teselas ni se comparten mapas renderizados para eludir facturación.
2. Antes de crear un mapa avanzado en producción, un servicio futuro de admisión consulta y reserva capacidad de forma atómica, sin login ni identificador persistente del visitante. Propuesta conservadora: 300 admisiones/día, máximo 9.300 en un mes de 31 días, con reserva frente al umbral de 10.000. La consola del proyecto mostró `Map loads per day` como no ajustable, de modo que este corte debe ser propio. Se deduce consumo de otros entornos/proyectos del mismo SKU.
3. Agotamiento diario/mensual, contador no disponible o incertidumbre de facturación llevan a Embed. La lista mantiene todos sus filtros; seleccionar una oferta centra el iframe en su ubicación conocida. Se indica precisión municipal cuando corresponda. Ubicación desconocida se informa sin inventar un punto.
4. El modo básico sigue ofreciendo Google Maps durante el resto del mes, pero pierde clusters, múltiples marcadores propios y búsqueda al arrastrar el mapa. No se presenta como funcionalmente idéntico al avanzado. Un fallo del propio proveedor conserva lista y detalle, aunque no se puede garantizar disponibilidad absoluta de Google.

Presupuesto objetivo inicial de Maps: **0 €**. Dynamic se habilitó solo para QA local dentro de la prueba gratuita; no desplegarlo a tráfico público hasta validar admisión y fallback. Si se exige cero gasto sin exposición a excesos tras la prueba, activar únicamente Embed mientras se prepara el control avanzado. El límite interno de admisiones reduce consumo pero no es un tope de facturación garantizado: la clave web es visible y pueden existir reintentos, abuso y diferencias de conteo.

Google documenta cuotas de cargas por minuto para JavaScript; no se presupone que exista un corte mensual nativo de 10.000. Los presupuestos son alertas, no bloqueos, y los datos de facturación pueden retrasarse hasta 48 horas. Las cuotas disponibles deben verificarse en el proyecto; repartir cargas en la aplicación no garantiza acceso avanzado para todos los visitantes. [Cuotas JavaScript](https://developers.google.com/maps/documentation/javascript/usage-and-billing?hl=en), [Control de costes](https://developers.google.com/maps/billing-and-pricing/manage-costs).

Para tráfico nacional alto, **Google avanzado equivalente a Bandana para todos los visitantes, uso ilimitado y coste cero no son requisitos simultáneamente garantizables**. Si el modo básico deja de ser aceptable, habrá que acordar un presupuesto de mapas o revisar proveedor. Como referencia, 20.000 cargas Dynamic al mes supondrían 70 USD y 50.000, 280 USD, antes de impuestos y otros servicios. No son costes contratados ni estimación del tráfico.

## Configuración y validación de producción pendientes

API keys separadas y restringidas por API y dominio; proyecto dedicado de producción para controlar contabilidad, sin duplicar cuentas/proyectos para ampliar artificialmente el tramo gratuito. Solo Embed inicialmente; Places, Geocoding, Routes y otros SKUs deshabilitados. Coordenadas procedentes de fuentes con derechos de uso y catálogo territorial propio.

QA requerido antes de activar el avanzado: recreaciones SPA/recargas, concurrencia de reservas, reintentos, caídas del contador, periodo de facturación confirmado por proveedor, consumo de otros proyectos, último token, cambio automático a Embed y vuelta al siguiente periodo. Prueba de claves/restricciones, CSP/iframe, español, teclado y precisión de ubicaciones; confirmar ausencia de llamadas a otros SKUs. La medición distinguirá admisiones internas de eventos realmente facturados.

La infraestructura, extracción y motor de búsqueda tienen presupuestos independientes todavía pendientes. El tramo gratuito del mapa no hace gratuita toda la plataforma.

## Estado de implementación local

`apps/web-preview/public/google-map.mjs` prepara puntos propios con AdvancedMarkerElement, selección, origen, círculo de radio y viewport; reutiliza una instancia. Los puntos proceden de geografía abierta de localidades, no de geocodificación Google ni de direcciones laborales conocidas. La clave rotada está en `.env.local`, restringida a Maps JavaScript API y al origen local; sin ella no se carga SDK. [Guía local](2026-10-14-google-maps-local.md). Se verificaron cuatro marcadores, selección/detalle y proximidad con encuadre conjunto. Todavía no está implementada la admisión mensual/distribuida; el prototipo no se debe desplegar como si garantizara gasto cero.
