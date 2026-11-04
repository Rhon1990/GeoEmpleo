# Nueve portales empresariales para GeoEmpleo360

Fecha: 04/11/2026. Diseño aprobado por el titular el 04/11/2026.

## Objetivo y alcance

Incorporar ofertas laborales reales, publicadas en España, de Adecco, Leroy Merlin, Deloitte, Manpower, ILUNION, Alcampo, KPMG y Decathlon. MAPFRE ya tiene el conector activo `successfactors-mapfre`: se comprobará su captura, sin crear una fuente duplicada. Cada incorporación debe aparecer en la búsqueda, el filtro de empresa y el mapa cuando la localidad laboral se pueda comprobar. La ingesta diaria seguirá ejecutándose en GitHub Actions y publicando el catálogo validado en los dos dominios actuales.

La búsqueda y el detalle en GeoEmpleo360 continuarán sin registro. La candidatura se realiza en el portal de origen y puede exigir cuenta allí. No se contratan servicios ni APIs de pago.

## Evidencia inicial y decisión

| Portal oficial | Señal pública observada el 04/11/2026 | Ruta de integración que se debe verificar |
|---|---|---|
| [Adecco](https://www.adecco.com/es-es/ofertas-trabajo) | Listado con referencias, localidad y detalle; el contenido depende del navegador | Obtener paginación y ficha estable del propio portal |
| [MAPFRE](https://jobs.mapfre.com/search/) | `successfactors-mapfre` figura activo en `registry.ts` y `runner.ts` | Auditar captura existente; ninguna fuente nueva |
| [Leroy Merlin](https://empleo.leroymerlin.es/jobs) | Teamtailor muestra 259 vacantes y algunas «Varias ubicaciones» | Reutilizar la lógica Teamtailor tras validar todas las páginas y fichas |
| [Deloitte](https://empleo.es.deloitte.com/search/) | Listado público de 307 puestos con localidad | Adaptador del ATS tras validar paginación, ID y ficha |
| [Manpower](https://www.manpower.es/es/buscar-trabajo) | Buscador JavaScript y [listado alternativo](https://www.manpower.es/es/all-jobs) | Verificar canal repetible con ID, enlace y localidad |
| [ILUNION](https://empleo.ilunion.com/Ilunion/go/TODAS-LAS-OFERTAS-ILUNION/9135102/) | Listado público de 440 puestos; algunas «poblaciones» son provincias | Reutilizar SuccessFactors; comprobar la localidad en cada ficha |
| [Alcampo](https://alcampocorporativo.es/trabaja-con-nosotros/) | El sitio oficial incrusta ofertas desde TalentForJobs | Reutilizar patrón Carrefour solo tras identificar tablón y ficha propios |
| [KPMG](https://carreras.kpmg.es/search/) | Listado público de 177 puestos con localidad | Reutilizar SuccessFactors tras comprobar paginación y ficha |
| [Decathlon](https://trabajaconnosotros.decathlon.es/ofertas/) | El buscador muestra ofertas en navegador; la respuesta HTML básica no trae el listado | Verificar el canal usado por el buscador y sus enlaces públicos |

Los contadores anteriores son señales del portal, no promesas de importación ni de vigencia. No se derivan vacantes de tiendas, sedes o marcas. Un listado visible en el navegador no demuestra por sí solo que exista una captura diaria íntegra y permitida.

## Componentes y flujo

1. **Auditoría por fuente.** Comprobar condiciones de acceso/reutilización, una captura completa con la misma ruta que usará GitHub Actions, paginación estable, identificador persistente, enlace público y país de cada ficha. No eludir bloqueos ni usar sesiones personales. Si no hay canal fiable, mantener la fuente documentada como pendiente y solicitar un feed o permiso al empleador.
2. **Adaptador aislado.** Reutilizar los parsers SuccessFactors, Teamtailor o TalentForJobs cuando el contrato real coincida. Un adaptador específico traduce los datos a `PublicJob`; no cambia el modelo común ni las fuentes existentes. El `sourceId` es estable y cada ID de oferta incorpora el identificador del portal.
3. **Reglas de publicación.** Solo anuncios abiertos con enlace verificable y puesto en España. La fecha, salario, descripción y empleador se toman del origen o quedan sin indicar. Un país genérico, provincia, código de tienda, «varias ubicaciones» o remoto sin lugar laboral inequívoco no produce punto en el mapa. Un municipio se resuelve contra el nomenclátor actual y el marcador se presenta como aproximado.
4. **Catálogo diario.** Registrar cada adaptador validado en `registry.ts` y `runner.ts`. `reconcileSource` elimina los anuncios desaparecidos únicamente tras una instantánea completa de esa fuente; ante fallo conserva la captura anterior y marca el resultado parcial. El workflow actual genera el sitio, despliega y comprueba ambos dominios. Medir su duración antes y después de cada lote para no comprometer la actualización.
5. **Presentación.** Añadir un logo local verificado por empresa en `presentation.mjs`, siguiendo los assets y el fondo neutro existentes. El filtro muestra una sola faceta canónica por empresa, sin atribuir a la marca ofertas de otra entidad que aparezcan en un portal de ETT.

## Orden de trabajo

Primero auditar y conectar Leroy Merlin, Deloitte, ILUNION, Alcampo y KPMG, donde los listados públicos y patrones ATS son más próximos a los ya soportados. Después auditar Adecco, Manpower y Decathlon, cuyos buscadores requieren confirmar un canal reproducible. MAPFRE se valida en ambos lotes como regresión, sin duplicación. Cada fuente se activa solo con captura directa completa y pruebas; la publicación puede hacerse por lotes pequeños para identificar fallos.

## QA y criterios de aceptación

- Por fuente: comparar el total anunciado y las páginas obtenidas, exigir IDs únicos, URLs oficiales válidas, país España y campos sin invenciones. Cubrir listados vacíos, cambios de paginación, ubicaciones ambiguas, remoto, varias sedes y fichas retiradas.
- Ejecución aislada y prueba de `runDaily`: una fuente fallida conserva su catálogo y las otras se publican; la recuperación elimina solo las ofertas ausentes de una captura completa.
- `npm run check`, compilación estática, `git diff --check` y revisión de una muestra de tarjetas, filtro, detalle, logo y marcadores.
- Tras integrar, ejecutar GitHub Actions y verificar por HTTPS `checkedAt`, IDs únicos, conteos por fuente y assets en `geoempleo360.com` y `geoempleo-49978.web.app`. El estado público no se declara actualizado antes de esa comprobación.

## Riesgos y límites

Los portales pueden cambiar su interfaz, restringir la automatización o mostrar ubicaciones más amplias que un municipio. El primer caso causa un fallo aislado; el segundo impide activar la fuente hasta disponer de acceso autorizado; el tercero deja la oferta sin punto. Los logos pertenecen a sus titulares y se usan para identificar la procedencia, sin sugerir patrocinio. Los recuentos del portal y de GeoEmpleo360 pueden diferir por exclusión de fichas extranjeras, caducadas, duplicadas o sin enlace verificable.
