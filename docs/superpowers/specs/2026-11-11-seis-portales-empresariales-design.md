# Diseño — Seis portales empresariales para la captura diaria

**Fecha:** 11 de noviembre de 2026  
**Estado:** aprobado para especificación; pendiente de revisión del documento y plan de implementación.

## Objetivo

Incorporar al catálogo público de GeoEmpleo360 las vacantes españolas activas de Mercadona, Grupo Crit, Sacyr, Acciona, Ferrovial y STEF. Cada vacante deberá conservar su enlace al portal oficial y actualizarse mediante el flujo diario existente, sin modificar, eliminar ni rebajar la calidad de las ofertas actuales de otras fuentes.

## Decisión

Se implementarán conectores aislados por fuente, reutilizando adaptadores de ATS ya existentes solo cuando se confirme el mismo contrato público. No se añadirá un scraper genérico del HTML visual ni se publicarán resultados parciales.

| Fuente | Entrada pública conocida | Estrategia inicial | Condición de activación |
| --- | --- | --- | --- |
| Mercadona | Búsqueda de Avature | Adaptador Avature específico o configuración sobre un helper común si el contrato es estable | Listado paginable y detalle público con identificador estable |
| Grupo Crit | Portal corporativo con buscador alojado en `jobs.grupo-crit.com` | Adaptador sobre el portal de vacantes real, no sobre la página corporativa | Datos de oferta, URL de detalle y ubicación española verificables |
| Sacyr | Tablón Sacyr People con filtro `Spain` | Adaptador propio sobre el endpoint o documento de vacante público | Filtro de país de origen y detalle por vacante |
| Acciona | Página corporativa de ofertas | Descubrir el proveedor real del listado; crear adaptador solo para ese contrato | Listado y detalle público estables, sin depender de cookies opcionales |
| Ferrovial | Buscador oficial de empleo | Descubrir interfaz pública permitida; no sortear bloqueos ni protecciones | Endpoint o documento público estable, con detalle completo |
| STEF | Portal europeo que enlaza a SuccessFactors | Reutilizar el adaptador SuccessFactors con la configuración específica de STEF si la respuesta es compatible | País España confirmado por el origen y detalle de cada vacante |

Una fuente sin interfaz pública estable quedará registrada como `authorization_required` o `candidate`; no se marcará activa, no se inventarán datos y no se publicarán enlaces de búsqueda como si fueran ofertas.

## Arquitectura

1. **Conector de fuente.** Cada módulo en `packages/ingestion/src/connectors/` será responsable únicamente de pedir el listado, paginar, consultar detalles necesarios y normalizar una oferta. Los contratos compartidos de paginación, limpieza HTML, fecha, URL, ciudad y deduplicación se reutilizarán desde los helpers actuales cuando correspondan.
2. **Registro y ejecución.** `registry.ts` describirá únicamente fuentes activas y sus URL públicas. `runner.ts` llamará al conector de cada fuente y conciliará sus ofertas de forma independiente.
3. **Publicación segura.** El conector solo devolverá ofertas que tengan ID estable, título, descripción permitida, URL HTTPS oficial y localización española resuelta. Las filas sin país verificable, detalle, enlace o ubicación publicable se descartan antes de la conciliación.
4. **Resiliencia.** Un fallo de red, formato, paginación o respuesta incompleta hará fallar solo esa fuente. La conciliación conservará su último snapshot válido y el informe diario mostrará causa, recibidas y publicadas.
5. **Presentación.** Cada `sourceId` empresarial tendrá asset local, texto alternativo y atribución en `presentation.mjs`, `brands/README.md` e `index.html`. No se inferirá la marca a partir del título de una vacante.

## Flujo de datos

```text
Portal oficial -> listado y detalle público -> adaptador de fuente
  -> validación España/detalle/URL/fecha -> normalización y deduplicación
  -> conciliación aislada por sourceId -> catálogo diario -> Firebase Hosting
```

El workflow `daily-offers.yml` no necesita una programación nueva: ya ejecuta la captura y validación diaria, despliega únicamente una vez validado el catálogo y conserva los resultados de fuentes que no actualicen correctamente.

## Reglas de calidad y geografía

- Se aceptan únicamente ofertas cuya respuesta de origen confirme España (`ES`, `Spain` o una ubicación resuelta inequívocamente por el nomenclátor nacional).
- La descripción no se inventa ni se reconstruye desde un título; se conserva únicamente si la fuente la expone y permite su uso conforme a la política vigente del proyecto.
- Una región amplia, un país sin ciudad o una referencia ambigua no se transforma en un punto exacto del mapa.
- Los IDs deben ser estables entre ejecuciones y la URL de aplicación debe apuntar al portal oficial concreto.
- Las fechas faltantes permanecen desconocidas; no se fabrican fechas de publicación.
- Las vacantes repetidas dentro de la fuente se deduplican por el ID de origen antes de reconciliar; la deduplicación entre fuentes conserva trazabilidad y no elimina URLs oficiales.

## Activos de marca

Los logos se guardarán en `apps/web-preview/public/brands/` y se servirán localmente. Se usará un recurso del portal oficial, de la web corporativa o una fuente de licencia clara; se anotará origen y titularidad en `brands/README.md`. La prueba comprobará firma del formato y el CSS verificará contraste para logotipos claros u oscuros en tarjetas y detalle.

## Pruebas y validación

Por cada conector activo se añadirán pruebas de fixture que cubran:

1. Captura del listado y todas sus páginas.
2. Selección exclusiva de España antes de aceptar una fila.
3. Consulta y normalización del detalle completo.
4. Rechazo de filas sin ID, URL HTTPS oficial, detalle o ubicación española comprobable.
5. Preservación del último snapshot cuando la fuente falle o entregue una respuesta transitoria inválida.
6. Registro de la fuente y ejecución desde `runDaily`.
7. Logo local, texto alternativo, atribución y fallback visual.

La validación final incluirá `npm run check`, una captura diaria controlada con los seis IDs de fuente, validación del catálogo resultante y verificación HTTPS de los dominios públicos. No se desplegará un conector que no supere sus pruebas o que rebaje el catálogo existente.

## Fuera de alcance

- Cuentas, inicio de sesión, CV o candidatura dentro de GeoEmpleo.
- Circunvalar `403`, CAPTCHA, restricciones de robots o autenticación del portal.
- Publicar agregados, enlaces de búsqueda o datos incompletos como ofertas.
- Cambios visuales ajenos a las nuevas marcas y atribuciones.

## Riesgos y mitigación

| Riesgo | Mitigación |
| --- | --- |
| Contrato web no documentado cambia | Encapsularlo en un conector; validar forma, conservar snapshot y avisar en informe |
| Fuente internacional devuelve resultados no españoles | Filtrar en origen y validar país/ciudad antes de publicar |
| Detalle exige sesión o bloquea automatización | No activar la fuente; documentar el acceso autorizado necesario |
| Logo no tiene contraste o falla | Asset local, prueba de formato y fallback neutral |
| Fuente temporalmente vacía por error | Reintento y criterio de snapshot inválido; no reconciliar contra un cero no probado |

## Criterios de aceptación

- Cada fuente activada añade solo ofertas españolas con enlace oficial y detalle válido.
- Los seis nombres aparecen en el registro con un estado honesto: `active` solo después de validar su conector; en caso contrario, `candidate` o `authorization_required` con motivo documentado.
- La actualización diaria procesa las fuentes activas de forma independiente y una incidencia no reduce las ofertas de fuentes existentes.
- Todas las nuevas marcas se muestran correctamente en móvil y escritorio, con fallback neutral seguro.
- Los tests, la validación del catálogo y la comprobación HTTPS pasan antes de subir a `main`.
