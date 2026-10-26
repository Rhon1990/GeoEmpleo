# Analítica Firebase con consentimiento

**Fecha:** 26 de octubre de 2026  
**Estado:** Aprobado por el usuario para implementación  
**Alcance:** Web pública estática de GeoEmpleo en Firebase Hosting.

## Objetivo

Obtener métricas de uso agregadas de GeoEmpleo mediante Google Analytics for Firebase sin cuentas de visitantes, evitando emitir telemetría antes de que cada persona acepte la analítica.

## Diseño elegido

La web usará el SDK modular oficial de Firebase Analytics desde el CDN oficial, con versión fijada, inicializado únicamente tras el consentimiento afirmativo. La preferencia se guardará localmente como `accepted` o `rejected`; rechazar no limitará ninguna función. Un control persistente permitirá cambiar la decisión y retirarla.

Se enviarán eventos de página con ruta normalizada y eventos generales de búsqueda, uso de filtros, apertura de detalles y acciones del mapa. La analítica geográfica se limitará a país, región y ciudad aproximados que Google Analytics deriva de la conexión; no se solicitará GPS ni se enviará la localidad que la persona escribe para buscar empleo. No se transmitirán términos de búsqueda, parámetros de URL, ubicación manual, coordenadas, límites del mapa, identificadores o títulos de ofertas, contactos, ni información de candidatos. La vista automática se desactivará para impedir que Analytics reciba las consultas contenidas en la URL. Se desactivarán las señales publicitarias; no se habilitarán anuncios, BigQuery ni servicios de pago.

Un módulo aislado validará el consentimiento, inicializará Analytics de forma diferida, restringirá los eventos y omitirá fallos de configuración/SDK sin afectar la búsqueda. La UI mostrará un aviso breve con opciones equivalentes para aceptar o rechazar y una opción posterior de configuración. Si la configuración Firebase no está presente o el SDK no es compatible, no se carga el SDK.

El proyecto Firebase `geoempleo-49978` permanece en Spark. Google Analytics fue habilitado usando la cuenta `Default Account for Firebase`; la propiedad vinculada es `geoempleo-49978` y la aplicación web registrada se llama `GeoEmpleo Web`. Esta vinculación no cambia facturación ni integra otros productos.

`apps/web-preview/firebase-web-config.json` contiene únicamente la configuración pública del cliente Firebase (incluida su API key pública de identificación), nunca una clave de cuenta de servicio. Firebase documenta que sus API keys son públicas por diseño y que las provisionadas por Firebase llevan restricciones a APIs relacionadas con Firebase; la clave de Google Maps permanece separada. Referencia: [API keys de Firebase](https://firebase.google.com/docs/projects/api-keys).

## Alternativas consideradas

1. **Firebase Analytics opt-in con SDK modular (elegida):** aprovecha la integración Firebase existente, facilita informes gratuitos de eventos y permite no cargar el SDK antes de aceptar. Tiene una UI de consentimiento y carga adicional cuando alguien acepta.
2. **Google tag/gtag manual:** tiene menos dependencias de Firebase, pero duplicaría configuración y reduciría la integración nativa solicitada.
3. **Sin telemetría:** conserva la privacidad máxima, pero no responde a la petición de medir el uso.

## Flujo

1. Al cargar, leer la preferencia local sin cargar código remoto.
2. Sin decisión guardada, presentar el aviso; con rechazo, no iniciar Firebase; con aceptación previa, inicializar Firebase.
3. Al aceptar, cargar módulos `firebase-app` y `firebase-analytics` desde el CDN de Firebase, con `send_page_view: false` y señales publicitarias desactivadas. Google Analytics obtiene país, región y ciudad aproximados desde la conexión, sujeto a sus prácticas regionales de privacidad.
4. Emitir manualmente `page_view` solo con la ruta permitida, y eventos predefinidos sin valores libres.
5. Al rechazar o revocar, persistir `rejected`, aplicar consentimiento denegado y detener la colección si ya estaba inicializada.

## Validación y riesgos

Pruebas unitarias deben demostrar que no hay inicialización ni eventos antes del consentimiento, que rechazo impide la carga, que aceptar inicializa una sola vez, que revocar detiene la captura, que la ruta no contiene query string y que solo se permiten eventos/atributos explícitos. La validación de integración debe cubrir los controles accesibles, consentimiento guardado, bloqueo de colecciones antes de aceptar, funcionamiento de la búsqueda y ausencia de errores de consola. Firebase DebugView puede tardar en reflejar eventos; no se registrarán datos reales para probarlo.

El SDK se sirve desde un tercero solo después de aceptar y necesitará CSP que autorice los dominios documentados de Firebase/Analytics. Google Analytics procesa datos del navegador cuando se acepta; debe reflejarse en la información de privacidad del producto. La ubicación geográfica es aproximada (país, región y ciudad) y procede de la conexión, no del GPS ni de la búsqueda. No se promete anonimato absoluto del proveedor: el alcance de este diseño es no adjuntar información identificativa que el producto controla y no recolectar ubicación precisa o texto libre.
