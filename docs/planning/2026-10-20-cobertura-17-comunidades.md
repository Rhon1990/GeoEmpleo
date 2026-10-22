# Cobertura exigida: 17 comunidades autónomas

Estado calculado desde el catálogo comprobado en 2026-10-20T07:12:05.548Z. Publicaciones conservadas, no vacantes únicas ni todas necesariamente vigentes. Ceuta y Melilla mantienen el objetivo adicional ya aprobado.

| Comunidad | Publicaciones | Con punto | Canal regional a integrar o ampliar | Conector propio activo |
|---|---:|---:|---|---|
| Andalucía | 12 | 11 | Junta de Andalucía (entidades instrumentales); ampliar con SAE | Sí, cobertura parcial |
| Aragón | 0 | 0 | INAEM | No |
| Canarias | 0 | 0 | Servicio Canario de Empleo | No |
| Cantabria | 0 | 0 | Emplea Cantabria | No |
| Castilla-La Mancha | 1 | 1 | Servicio de empleo de Castilla-La Mancha | No |
| Castilla y León | 609 | 571 | ECYL | Sí, cobertura parcial |
| Cataluña | 3 | 3 | SOC / Feina Activa | No |
| Comunidad de Madrid | 1 | 1 | Servicio de empleo de Madrid / Agencia para el Empleo | No |
| Comunidad Foral de Navarra | 1 | 0 | Servicio Navarro de Empleo | No |
| Comunidad Valenciana | 0 | 0 | LABORA | No |
| Extremadura | 0 | 0 | SEXPE | No |
| Galicia | 0 | 0 | Emprego Galicia | No |
| Islas Baleares | 0 | 0 | SOIB | No |
| La Rioja | 0 | 0 | Servicio de empleo de La Rioja | No |
| País Vasco | 677 | 661 | Lanbide | Sí, cobertura parcial |
| Principado de Asturias | 1 | 1 | Trabajastur | No |
| Región de Murcia | 224 | 195 | SEF Murcia | Sí, cobertura parcial |

## Prioridad de ejecución

1. Aumentar Madrid, Cataluña y Comunidad Valenciana con fuentes generalistas; cubrir Galicia y Canarias con canales reutilizables y vigentes.
2. Incorporar Aragón, Cantabria, Extremadura, Baleares y La Rioja, actualmente sin publicaciones, y reforzar Castilla-La Mancha, Asturias y Navarra, con presencia incidental.
3. Ampliar Andalucía más allá de las entidades instrumentales y recuperar las actualizaciones fallidas de Murcia y Lanbide.
4. Medir cobertura provincial y municipal, ofertas operativas/profesionales/rurales, fechas de observación y fallos por fuente. Una publicación no acredita cobertura suficiente de una comunidad.

## Comprobaciones de acceso del 20/10/2026

- Galicia: el RSS anunciado en el catálogo oficial redirige a HTML «Páxina non atopada». Es necesario localizar el canal vigente; no se ha importado como feed.
- Canarias: conjunto oficial registrado para reutilización; el buscador público requiere un token temporal y su endpoint público `https://www.gobiernodecanarias.org/aplicaciones/sce/authtoken` devuelve HTTP 404. El código del buscador incluye fallback a datos de prueba: queda expresamente excluido de cualquier ingesta. Se necesita un endpoint operativo; no hay nuevo conector activo.
- SEPE nacional: el RSS de Administración anunciado por SEPE agotó el tiempo de conexión de 20 segundos. Pendiente comprobar canal actual y condiciones de reutilización. No acredita una integración nacional.
- Los otros servicios enumerados son destinos de integración identificados; sus endpoints y condiciones no están validados por figurar en este documento.

## Evidencias

- Directorio oficial autonómico: https://sede.sepe.gob.es/portalSede/es/procedimientos-y-servicios/personas/empleo/tramites-demanda/tramites-demanda-comunidad.html
- Galicia: https://datos.gob.es/es/catalogo/a12002994-ofertas-de-empleo
- Canarias: https://datos.canarias.es/catalogos/general/dataset/ofertas-de-empleo-del-servicio-canario-de-empleo
- SEPE RSS: https://sede.sepe.gob.es/portalSede/es/informacion/canales-RSS

## Criterio de aceptación

La cobertura nacional sigue pendiente hasta que las 17 comunidades tengan publicaciones reales, procedencia verificable, ubicación laboral contrastable y renovación diaria comprobada. No crear ofertas ni puntos para completar una cuota territorial. Cada conector se activa después de pruebas, captura real y atribución de su fuente.
