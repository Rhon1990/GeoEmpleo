# GeoEmpleo360 — disparador diario redundante con Google Apps Script

Fecha: 29 de octubre de 2026  
Zona horaria de producto: `Europe/Madrid`

## Objetivo

Actualizar el catálogo público cada mañana sin depender de Codex, del ordenador
del creador ni de una intervención humana. Se conserva GitHub Actions como único
ejecutor de la ingesta, compilación y despliegue; Google Apps Script añade un
reloj externo gratuito que inicia el workflow cuando el catálogo está
desactualizado.

## Decisión

Se usará un proyecto independiente de Google Apps Script con un disparador cada
15 minutos. El script solo actuará durante la ventana de 05:00 a 12:00 de
`Europe/Madrid` y consultará primero
`https://geoempleo360.com/data/calls.json`. Si `checkedAt` pertenece al día
actual, terminará sin iniciar GitHub Actions. Si está desactualizado y no existe
un intento reciente, enviará `workflow_dispatch` al workflow
`.github/workflows/daily-offers.yml` en `main`.

El cron nativo de GitHub se conserva como respaldo. Apps Script no captura
ofertas, no transforma datos y no despliega directamente.

## Arquitectura y flujo

1. Un disparador instalable de Apps Script ejecuta `checkAndDispatch()` cada 15
   minutos.
2. El script calcula la fecha actual con `Europe/Madrid` y consulta el catálogo
   público con un parámetro anticaché.
3. Si el JSON es válido y su `checkedAt` corresponde a hoy, registra `fresh` y
   finaliza.
4. Si el catálogo está atrasado, comprueba en `ScriptProperties` que no haya un
   despacho aceptado durante los últimos 60 minutos.
5. Envía un `POST` al endpoint oficial de GitHub para crear un evento
   `workflow_dispatch` en `main`.
6. Solo una respuesta HTTP 204 se registra como despacho aceptado. Un error de
   red, autenticación o respuesta distinta de 204 deja el catálogo intacto y
   permite reintentar en la siguiente ejecución.
7. GitHub Actions recupera el catálogo publicado, consulta todos los conectores
   activos, valida IDs y fechas, compila y despliega en Firebase Hosting.
8. El workflow valida por HTTPS el mismo `checkedAt` tanto en
   `geoempleo-49978.web.app` como en `geoempleo360.com`.

## Seguridad

- Se creará un token fino de GitHub limitado al repositorio
  `Rhon1990/GeoEmpleo`, con permiso `Actions: write` y sin acceso a otros
  repositorios.
- El token se guardará como propiedad del script, nunca en Git, en el catálogo,
  en logs ni en el chat.
- El script no tendrá endpoint web público; solo un disparador instalable.
- El token tendrá caducidad y se documentará su fecha para renovarlo antes de
  vencer.
- No se habilitará facturación, Blaze, tarjetas ni servicios de IA.

## Límites y coste

La cuenta personal dispone actualmente de 20.000 llamadas `URL Fetch` y 90
minutos de ejecución de disparadores por día. La propuesta usa como máximo unas
96 comprobaciones HTTP diarias y, normalmente, un solo despacho. El coste
esperado es 0 EUR dentro de las cuotas gratuitas actuales.

## Manejo de fallos

- Catálogo inaccesible o JSON inválido: no se despacha a ciegas; se registra el
  error y se reintenta 15 minutos después.
- GitHub rechaza el despacho: no se activa el enfriamiento; se reintenta.
- Despacho aceptado pero workflow fallido: tras 60 minutos, si el catálogo sigue
  atrasado, se permite un nuevo intento.
- Ingesta parcial: se conserva la última captura válida de las fuentes fallidas
  según el runner existente y se publica el resto.
- Ingesta fallida: GitHub conserva el catálogo anterior y Apps Script volverá a
  intentar después del enfriamiento.
- Catálogo actualizado: todas las ejecuciones posteriores del día son lecturas
  ligeras y no disparan Actions.

## Pruebas de aceptación

1. Pruebas unitarias locales del script con respuestas simuladas: catálogo de
   hoy, catálogo atrasado, JSON inválido, 204 de GitHub, error de GitHub y
   enfriamiento de 60 minutos.
2. Prueba automática cercana: se instala un disparador de una sola ejecución
   dentro de la ventana matinal y se cierra la consola.
3. Ese disparador debe crear un run de GitHub con evento `workflow_dispatch`,
   sin usar el botón de GitHub, Codex ni el terminal y sin modificar el catálogo
   directamente.
4. El run debe terminar `success` o `partial` válido y desplegar.
5. Ambos dominios deben publicar el nuevo `checkedAt`, JSON válido y la misma
   cantidad de IDs únicos.
6. Después de la prueba se instala el disparador recurrente y se elimina el
   disparador temporal.

## Fuera de alcance

- Sustituir GitHub Actions o Firebase Hosting.
- Consultar fuentes desde Apps Script.
- Añadir ofertas manualmente o generar datos con IA.
- Activar productos de pago.
