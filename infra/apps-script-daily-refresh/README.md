# Vigilancia diaria externa con Google Apps Script

Este proyecto de Apps Script comprueba el catálogo público de GeoEmpleo360 sin
depender de Codex ni de un ordenador encendido. El disparador ejecuta
`checkAndDispatch` cada 15 minutos, pero la función solo actúa entre las 05:00 y
las 12:00 de `Europe/Madrid`.

- Si `geoempleo360.com/data/calls.json` ya tiene un `checkedAt` del día, no hace
  nada.
- Si el catálogo está desactualizado, ejecuta por `workflow_dispatch` el
  workflow `daily-offers.yml` de la rama `main`.
- Un enfriamiento de 60 minutos evita ejecuciones repetidas mientras GitHub
  procesa y publica el catálogo.
- Los horarios de GitHub Actions de las 05:37, 07:37 y 09:37 quedan como
  respaldo; Apps Script es el vigilante externo principal.

## Configuración

Proyecto operativo:
[`GeoEmpleo360 Daily Refresh`](https://script.google.com/home/projects/1PfOL5UhA7LJti8ZOr7nx32O2F6AzLIvZ5aQsy1RyR5aeRvPxwADk1_BJ/edit).

La propiedad privada `GEOEMPLEO_GITHUB_TOKEN` debe contener un token fine-grained
limitado al repositorio `Rhon1990/GeoEmpleo`, con `Actions: Read and write` y
`Metadata: Read`. El valor no se guarda en este repositorio. Por decisión del
titular, el token no caduca: evita renovaciones periódicas, pero aumenta el
impacto de una filtración. Si se sospecha exposición, hay que revocarlo en
GitHub, crear otro con el mismo alcance mínimo y sustituir la propiedad del
script.

`installRecurringTrigger` elimina disparadores anteriores de la misma función y
crea exactamente uno nuevo cada 15 minutos. Para detener la vigilancia basta
con eliminar ese disparador o revocar el token; no es necesario borrar el
catálogo ni modificar Firebase Hosting.

## Operación y coste

La ventana produce unas 28 comprobaciones diarias como máximo. Apps Script usa
sus cuotas gratuitas y esta arquitectura no activa Blaze, facturación de
Google ni servicios de pago. Los runners estándar del repositorio público de
GitHub se mantienen dentro del modelo gratuito aplicable; si el repositorio se
hiciera privado, habría que revisar los minutos incluidos en su plan.

Una ejecución correcta debe dejar el mismo `checkedAt`, cantidad e IDs únicos
en `geoempleo-49978.web.app` y `geoempleo360.com`. Si GitHub falla, revisar el
log de `daily-offers.yml`: la publicación HTTPS reintenta durante un minuto para
absorber la propagación de caché posterior al despliegue.
