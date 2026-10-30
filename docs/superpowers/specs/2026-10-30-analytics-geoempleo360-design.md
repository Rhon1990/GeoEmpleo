# Analítica de GeoEmpleo360

## Objetivo

Medir usuarios y tiempo medio de interacción de `geoempleo360.com` en la propiedad privada de Google Analytics vinculada a Firebase, con periodos diarios, mensuales y anuales.

## Diagnóstico verificado

El sitio público entrega el ID `G-W8FJ6RYVQJ`, que coincide con el único flujo web «GeoEmpleo Web» de la propiedad `geoempleo-49978`. El flujo tiene la URL del sitio vacía y Analytics indica que no ha recibido datos en 48 horas. La web inserta la etiqueta desde `www.googletagmanager.com` después del consentimiento, pero su cabecera CSP no permite ese origen en `script-src`.

## Diseño

Conservar el flujo web existente y asignarle `https://geoempleo360.com` como URL. Añadir únicamente `https://www.googletagmanager.com` a `script-src`. Mantener el SDK, el ID de medición, la carga posterior al consentimiento y los eventos actuales. Usar los informes privados de GA4/Firebase con selector de fechas para día, mes y año, y sus métricas de usuarios activos y tiempo de interacción medio. No crear una base de datos de visitantes ni mostrar cifras públicas.

## Validación

Comprobar la cabecera CSP publicada, el ID de medición y la URL del flujo. Tras una visita de prueba con consentimiento, comprobar el informe en tiempo real y, posteriormente, los informes procesados. El tiempo medio puede tardar en consolidarse. Si los eventos siguen sin llegar, revisar bloqueo del navegador y la inicialización del SDK antes de modificar la política de privacidad.
