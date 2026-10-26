# Ampliación nacional de fuentes — 19/10/2026

## Alcance confirmado

50 provincias y las ciudades autónomas de Ceuta y Melilla. Pueblos, ciudades, empleo operativo, profesional y rural. Consulta pública sin registro. Actualización diaria, sin APIs de pago ni ubicaciones inventadas. La presencia de referencias geográficas nacionales no acredita cobertura de ofertas nacionales.

## Auditoría inicial de las fuentes solicitadas

Comprobación directa de páginas oficiales el 19/10/2026. Una respuesta HTTP 200 acredita acceso a esa página, no un permiso de extracción ni acceso al detalle de todo el catálogo. Los portales siguientes no se han activado en la ingesta.

| Fuente | Evidencia / estado | Siguiente paso |
|---|---|---|
| Laboris | Error de certificado TLS en la consulta | Verificar dominio vigente; no omitir validación TLS |
| Quiero Empleo | Consulta sin respuesta útil en el tiempo acotado | Verificar acceso y canal de colaboración de Cámaras |
| Infoempleo | Portada pública; condiciones limitan reproducción | Obtener autorización/feed; no se ha verificado la vinculación con SEPE indicada en la propuesta |
| Jooble | Página API devuelve 403 en esta sesión | Verificar API, condiciones, credenciales y cuota gratuita |
| Jobatus | Fallo TLS al consultar | Verificar disponibilidad y acceso a feed |
| Jobsora | Portada pública; términos restringen scraping y extracción automatizada | Canal de partners y autorización |
| Adzuna | Pausada por requisito gratuito según configuración existente | No reactivar el plan de pago; comprobar alternativa gratuita si cambia |
| Talent.com / Neuvoo | Página de Talent.com accesible | Verificar feed y acuerdo; no duplicar una fuente por nombres históricos |
| Tecnoempleo | Portada pública; robots restringe GPTBot y ruta de alertas RSS | Verificar acceso autorizado de integración; no tratar RSS como permitido por su nombre |
| Domestika Jobs | Listado público accesible | Verificar términos, detalle, fechas y canal de reutilización |
| RemotoJob | Página pública; aviso legal limita reproducción | Obtener permiso; teletrabajo sin centro físico no recibe un punto ficticio |
| Vente a vivir a un pueblo | Error de certificado en la consulta al dominio probado | Verificar dominio oficial vigente y canal de datos |
| Volver al Pueblo / COCEDER | Mapa de recursos y PDF de empleos de octubre accesibles; aviso legal limita reproducción | Acuerdo/feed; separar empleos de viviendas, tierras y traspasos |
| Holapueblo | Página y feed enlazado; orientación al emprendimiento | Confirmar que cada elemento sea una vacante, no una noticia o proyecto de emprendimiento |
| Infoagro | Listado con enlaces a ofertas; aviso legal exige autorización para reutilización | Solicitar canal autorizado |
| Tablón de Anuncios | Sección agrícola pública | Verificar reutilización; distinguir ofertas de demandas de empleo y proteger contactos personales |
| Aragón Open Data (adicional) | Catálogo CC BY 4.0 y JSON de convocatorias en plazo accesibles; respuesta observada de 100 registros | Validar completitud/paginación, identidad y anuncio original antes de activar |

## Evidencias primarias

- [Infoempleo: aviso legal](https://www.infoempleo.com/avisolegal/).
- [Jobsora: condiciones](https://es.jobsora.com/terms) y [partners](https://es.jobsora.com/partner).
- [Tecnoempleo: robots](https://www.tecnoempleo.com/robots.txt).
- [RemotoJob: aviso legal](https://remotojob.com/aviso-legal/).
- [COCEDER: recursos](https://volveralpueblo.org/asientate/mapa-de-recursos) y [aviso legal](https://volveralpueblo.org/aviso-legal).
- [Infoagro: empleo](https://www.infoagro.com/empleo/) y [aviso legal](https://www.infoagro.com/legal).
- [Aragón: catálogo de empleo público](https://opendata.aragon.es/ckan/dataset/datos-de-anuncios-y-ofertas-de-empleo-publico).
- [Aragón: JSON en plazo](https://opendata.aragon.es/GA_OD_Core/download?resource_id=309&formato=json).

## Diseño de integración

Se conserva el runner diario y su aislamiento por fuente. Cada conector entrega publicaciones verificadas con identidad estable, URL original, fecha, procedencia y ubicación municipal contrastada. La resolución usa provincia y municipio explícitos; sin coincidencia inequívoca, `location=null`. La sede del convocante no demuestra el lugar del puesto. Promoción interna y plazas abiertas deben distinguirse. Un cierre calculado por la fuente mediante extracción automática no se presenta como plazo confirmado sin revisar el anuncio original.

La opción preferida es combinar fuentes públicas regionales y municipales con feeds privados autorizados. La alternativa de acuerdos privados nacionales puede aumentar cobertura, pero depende de permisos y cuotas. El scraping indiscriminado no satisface el requisito de funcionamiento estable y gratuito.

Para cada territorio se buscarán primero servicios autonómicos, diputaciones, ayuntamientos y bolsas rurales con licencia o permiso verificable. El progreso se medirá por publicaciones observadas, puntos válidos, municipios representados, última captura correcta y cobertura provincial. Una oferta incidental en una provincia no acredita cobertura suficiente.

## Criterios de activación

1. Acceso y reutilización verificados, coste gratuito y sin acuerdos pendientes.
2. Muestra real y formato completos; no confundir un límite de 100 registros con catálogo completo.
3. Tests de identidad, URLs, fechas, Unicode, localidades ambiguas y fuente caída.
4. Captura real aislada y validación del catálogo: JSON válido, IDs únicos y trazabilidad.
5. Integración en el runner, atribución en la web y actualización del prompt diario solo después de verificar el conector.

Estado: investigación y diseño; las fuentes activas siguen siendo SEF Murcia, ECYL y Lanbide. BOE conserva su selección estática. No se han enviado solicitudes a terceros ni creado cuentas.

## Comprobación adicional del 20/10/2026

Aragón: el feed observado contenía 100 filas y 67 enlaces distintos, incluyendo «Ordenanza fiscal». La convocatoria de Tarazona sí era laboral, pero el plazo de un mes extraído como presentación era el plazo de recurso de reposición en el anuncio original. No activar fechas ni publicaciones automáticas sin contrastar el boletín y resolver duplicados.

Andalucía: [API oficial de entidades instrumentales](https://www.juntadeandalucia.es/datosabiertos/portal/aplicaciones/buscador-apis/detalle/2050.html), con [licencia CC BY 4.0 del conjunto](https://www.juntadeandalucia.es/datosabiertos/portal/dataset/ofertas-de-empleo-de-entidades-instrumentales). Se descargaron OpenAPI y la consulta `search` con `announcement_status=En curso`, filtros restantes `-`, `order_by=id`, `mode=DESC`, `format=json`, `size=0`. La respuesta anuncia `hits=total_hits=853`, con 853 resultados; 11 tienen `deadline_application >= 2026-10-20`. «En curso» incluye procesos con plazo de inscripción vencido. La API contiene localidades y provincias laborales explícitas, pero varias ofertas tienen múltiples ubicaciones. Antes de activar: validar enlaces originales (el intento `/node/689251` devuelve 404), tratamiento de varias ubicaciones, zona horaria de cierre, elegibilidad y conservación de fuentes ante fallo. El feed Atom oficial es paginado (50 de 5.163 registros) y no acredita por sí solo cobertura completa. No se ha activado este conector ni republicado ninguna de sus ofertas.

Medición implementada: `npm run report:coverage --silent` genera JSON a stdout sin modificar el catálogo. Reutiliza el registro territorial y sus alias, cuenta fuentes y fechas de observación por provincia, informa provincias desconocidas y puntos inválidos, y rechaza IDs duplicados. El informe cuenta publicaciones conservadas; no certifica vigencia ni deduplica vacantes multifuente.

Actualización 20/10/2026 07:12 UTC: Andalucía ya integrada y activa; sustituye su estado candidato descrito arriba. Captura success con 11 publicaciones y 10 puntos; atribución en web y automatización actualizadas. Ver el inventario actual y pendientes de QA en `docs/project-context.md`.
