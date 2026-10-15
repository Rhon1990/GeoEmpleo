# Configurar Google Maps local

El usuario confirma mantener Google Maps y usar una clave propia. El mapa de ofertas requiere Maps JavaScript API; el iframe general no admite los puntos/selección/radio de GeoEmpleo. El proyecto existente `static-gravity-143714` tiene facturación de prueba vinculada, Maps JavaScript API habilitada y una clave web rotada denominada `GeoEmpleo Local Web`. La clave se limita a Maps JavaScript API y a `http://127.0.0.1:4310/*`; su valor solo existe en `.env.local`.

## Preparación en Google Cloud

1. Crear o seleccionar un proyecto propio dedicado a GeoEmpleo, dentro de la cuenta del titular. La configuración local usa el proyecto personal indicado arriba.
2. Completar personalmente la vinculación de facturación/condiciones si Google lo solicita. Antes de habilitar consumo, revisar el tramo gratuito y las cuotas de la cuenta; un presupuesto es una alerta, no un corte.
3. Habilitar únicamente **Maps JavaScript API** para este mapa. No necesita Places, Geocoding, Routes ni claves de otros servicios.
4. Crear una clave web y restringir aplicaciones a los sitios usados. La configuración verificada admite `http://127.0.0.1:4310/*`; añadir `http://localhost:4310/*` solo si se sirve con ese host. Restringir APIs a Maps JavaScript API. Para desplegar, crear configuración de producción separada y añadir solo el dominio propio necesario.
5. Usar `DEMO_MAP_ID` únicamente en pruebas locales; Google admite ese identificador para AdvancedMarkerElement. Crear map ID JavaScript propio para producción.

[Configuración y marcadores oficiales](https://developers.google.com/maps/documentation/javascript/advanced-markers/start), [Seguridad de claves](https://developers.google.com/maps/api-security-best-practices), [Precios](https://developers.google.com/maps/billing-and-pricing/pricing).

## Archivo local

`.env.local` está ignorado por Git; `.env.example` es la plantilla sin clave. Completar en el editor local, sin pegar la clave en el chat:

```dotenv
GEOEMPLEO_GOOGLE_MAPS_API_KEY=
GEOEMPLEO_GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID
```

El servidor relee ese archivo al consultar `/config.json` y devuelve únicamente los dos parámetros públicos del SDK. La clave web será visible en el navegador, por diseño de Google; la protección depende de las restricciones de sitio/API. No se serializa el entorno completo ni se registra la clave.

Ejecutar `npm run dev:web` y abrir `http://127.0.0.1:4310`. Con clave, se solicita una única posición del navegador (sin seguimiento), después se crea una instancia de mapa. Si no hay permiso o posición utilizable, se muestra España y se permite elegir localidad/zona. Filtrar, desplazarse y regresar al origen reutilizan esa instancia. Con clave rechazada, revisar configuración y recargar; lista/detalle permanecen disponibles. Sin clave no se solicita el SDK.

## Uso y límites reales

Los puntos representan localidades de las ofertas, no direcciones exactas. La búsqueda de referencia consulta `/api/places?q` sobre 55.788 referencias de toda España, con GeoNames y un complemento OpenStreetMap atribuido. Son lugares poblados y referencias postales aproximadas, no 55.788 municipios. Hasta 20 sugerencias por consulta; seleccionar un nombre inequívoco o una sugerencia centra el mapa. Un código postal compartido exige elegir localidad. «Volver a mi ubicación» regresa al último origen de sesión; «Usar mi ubicación» solicita una nueva posición del dispositivo.

Al terminar un movimiento/zoom, el servidor recibe bounds y filtros; espera 350 ms, cancela consultas anteriores e ignora respuestas tardías. `/api/jobs` devuelve hasta 300 resúmenes sin descripciones; `/api/job?id` entrega texto bajo demanda. No se descarga calls.json en el navegador. Actualizar marcadores conserva la cámara. El radio es opcional y se aplica sobre los resultados recibidos. Distancias en línea recta, no tiempos de viaje. Origen solo en memoria de sesión: sin URL, almacenamiento o logs; Google recibe centro/área visible y el servidor propio recibe bounds.

El catálogo mantiene 242 ofertas reales (238 SEF con ingesta diaria y 4 BOE estáticas), 207 con punto verificado. Si una zona no tiene ofertas, aparece vacía; ampliar localidades no inventa empleos. Sin mapa, la lista limitada admite registros sin punto. Los grupos de distintas localidades amplían zoom; los grupos municipales permiten seleccionar ofertas. El popup no desplaza automáticamente la cámara para evitar una consulta que lo cierre.

Límites: catálogo territorial abierto no exhaustivo, sin búsqueda de direcciones; GPS real depende del navegador/sistema y no se puede sustituir por una localidad supuesta. El servidor local usa JSON cacheado, no un índice nacional. El límite 300 puede ocultar ofertas incluso al ampliar zoom si todas comparten municipio; el radio cliente también se aplica después del corte. Producción requiere paginación/listado y agregaciones desde índice, QA móvil/teclado y admisión/capado de consumo.

La CSP utiliza nonces por respuesta siguiendo la [guía oficial](https://developers.google.com/maps/documentation/javascript/content-security-policy); el SDK aplica el nonce a sus scripts/estilos. La carga real confirmó compatibilidad del SDK y nombres accesibles de marcadores en la vista local. Antes de publicar todavía se requiere QA móvil, teclado y dominio de producción.

La consola muestra `Map loads per day` como no ajustable. La prueba gratuita activa indica que no habrá cobro hasta una actualización manual de la cuenta, pero esto no sustituye el control de producción. El corte conservador de 300 admisiones diarias deberá residir en un backend atómico; los presupuestos de Google solo alertan.

El QA del 15/10/2026 verificó 242 ofertas, 207 con ubicación, agrupación y popup municipal con 17 ofertas de Cieza, apertura del detalle SEF y radio de 5 km (17 resultados). Si el servidor se ejecuta desde un worktree, `GEOEMPLEO_ENV_FILE` puede apuntar al archivo local existente sin copiar su clave.

QA adicional del 15/10: geolocalización del navegador no disponible, fallback manual Coto de San Isidro, Navas de San Antonio y Robledillo de Gata; búsqueda CP 40151 diferencia Coto/Ituero y Lama. Prueba de regreso a Robledillo tras Ver España y actualización automática de resultados, Cieza con 17 ofertas y detalle SEF bajo demanda. El permiso concedido y errores del proveedor se cubren con callbacks de prueba; no se simuló GPS como ubicación real del usuario. API Cieza: 14.931 bytes frente a 658.110 del snapshot completo; CP 40151: 1.070 bytes, dos sugerencias. 163 tests Node, tipos, OpenAPI y 76 fixtures Python correctos.
