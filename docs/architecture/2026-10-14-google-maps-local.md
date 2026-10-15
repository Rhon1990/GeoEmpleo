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

Ejecutar `npm run dev:web`, abrir `http://127.0.0.1:4310` y pulsar **Comprobar configuración**. Si existe clave, esa acción carga el SDK y una instancia de mapa. Filtrar o seleccionar puntos reutiliza la instancia. Con clave rechazada, revisar configuración y recargar; lista/detalle permanecen disponibles. Sin clave no se solicita el SDK.

## Uso y límites reales

Los puntos representan las localidades de las convocatorias (geografía GeoNames/Wikidata), no direcciones exactas del puesto. Seleccionar localidad de referencia activa radio inicial de 25 km, ajustable. Clic en «Elegir mi zona» permite fijar origen en el mapa. «Buscar en esta zona» aplica viewport a los mismos filtros de la lista. Los marcadores muestran número de ofertas agrupadas según zoom. Un grupo de varias localidades amplía la zona; un grupo municipal abre la lista de todas sus ofertas. No se desplazan puntos para separar rótulos.

No hay geolocalización automática ni origen guardado en URLs/logs. El gazetteer local incluye 737 localidades, no todos los municipios ni direcciones españolas. Distancias aproximadas en línea recta, no tiempo de desplazamiento.

El catálogo contiene 238 ofertas SEF con ingesta diaria y cuatro convocatorias BOE estáticas; 207 ofertas tienen punto. La agrupación local por zoom está implementada, pero faltan clustering desde el índice para grandes catálogos, buscador indexado y capado de consumo de producción. El QA real cargó el SDK, los cuatro marcadores, apertura de detalle desde un marcador y proximidad Madrid–Fuentidueña a 56,7 km; también se verificó el estado sin clave.

La CSP utiliza nonces por respuesta siguiendo la [guía oficial](https://developers.google.com/maps/documentation/javascript/content-security-policy); el SDK aplica el nonce a sus scripts/estilos. La carga real confirmó compatibilidad del SDK y nombres accesibles de marcadores en la vista local. Antes de publicar todavía se requiere QA móvil, teclado y dominio de producción.

La consola muestra `Map loads per day` como no ajustable. La prueba gratuita activa indica que no habrá cobro hasta una actualización manual de la cuenta, pero esto no sustituye el control de producción. El corte conservador de 300 admisiones diarias deberá residir en un backend atómico; los presupuestos de Google solo alertan.

El QA del 15/10/2026 verificó 242 ofertas, 207 con ubicación, agrupación y popup municipal con 17 ofertas de Cieza, apertura del detalle SEF y radio de 5 km (17 resultados). Si el servidor se ejecuta desde un worktree, `GEOEMPLEO_ENV_FILE` puede apuntar al archivo local existente sin copiar su clave.
