# Leroy Merlin Teamtailor — plan de implementación

**Objetivo:** incorporar solo las vacantes españolas abiertas del [portal oficial](https://empleo.leroymerlin.es/jobs) a la ingesta diaria, con mapa únicamente para localidades verificadas.

**Contrato observado el 04/11/2026:** el HTML inicial anuncia 263 vacantes y contiene 20 tarjetas en `#jobs_list_container`. `GET /jobs/show_more?page=2` con `Accept: text/vnd.turbo-stream.html` devuelve otras 20 tarjetas. Cada enlace tiene un ID numérico en `/jobs/<id>-<slug>` y el título íntegro en el atributo `title`. La ficha expone `JobPosting` JSON-LD con ID, fecha, descripción y `jobLocation` con `addressCountry`.

## Pasos

1. Escribir pruebas rojas para total, paginación, ID/enlace oficial, título sin truncar, fichas retiradas y ausencia de punto ante varias ubicaciones, país ajeno o municipio no resuelto.
2. Reutilizar el lector TurboStream de Teamtailor de DIA con un host declarado; mantener intactos sus tests. Crear adaptador Leroy que lea el `JobPosting` y exija coincidencia de ID/título, fecha válida y país `ES`.
3. Recorrer todas las páginas hasta el total anunciado, rechazar duplicados/truncamiento y consultar cada ficha. Con una única localidad española confirmada, resolver el municipio; con varias sedes, conservar la oferta sin punto.
4. Hacer captura aislada, comparar total, IDs y puntos, y solo entonces añadir `teamtailor-leroy` al registro y runner.
5. Añadir logo oficial local, inventario y contexto. Ejecutar tests focales, `npm run check` y build estático; publicar mediante GitHub Actions y verificar ambos dominios por HTTPS.

**Límites:** si el portal cambia formato, bloquea la captura o mezcla empleos extranjeros sin país verificable, no activar la fuente. Una captura fallida conserva el catálogo anterior.
