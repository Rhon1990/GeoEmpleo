# Grupo Eulen en Taleo: cobertura diaria y mapa

## Objetivo

Incorporar las ofertas españolas vigentes del [buscador oficial de Grupo Eulen en Taleo](https://eulen.taleo.net/careersection/eul_career_site/jobsearch.ftl?lang=es) al catálogo público y a la ejecución diaria. Mantener el conector SelectMinds existente y mostrar en el mapa únicamente municipios identificados en la ficha original y resueltos de forma única.

## Evidencia del origen (3 de noviembre de 2026)

- El buscador público mostró un contador de 1.394 resultados en español y un tamaño nominal de 25. Sus páginas reales tienen tamaños irregulares y, al recorrer todo el rango anunciado, devolvieron 493 IDs únicos. El contador no equivale a fichas recuperables.
- La página usa una sesión anónima y `POST /careersection/rest/jobboard/searchjobs` con `pageNo`; devuelve `requisitionList`, `pagingData.totalCount`, ID de oferta, título y ubicaciones generalmente provinciales.
- La ficha `jobdetail.ftl?job=<contestNo>&lang=es` mostró `Ubicaciones de trabajos` con `30840 - ALHAMA DE MURCIA`. Otra ficha mostró una ubicación principal provincial y una localidad concreta. Por tanto, la provincia del listado no basta para poner un marcador.
- Una consulta directa sin la cookie de la sesión pública devolvió error 500; la misma consulta tras abrir el buscador anónimamente devolvió JSON 200. No se requiere cuenta ni credenciales.

## Diseño

1. Añadir `taleo-eulen` como fuente ATS independiente. El adaptador abre la página anónima, toma solo sus cookies de sesión y consulta secuencialmente todo el rango anunciado por `pagingData`, con límite razonable y validación de páginas, variación acotada del contador, IDs únicos y dominio de los enlaces. No exige que el contador coincida con las fichas porque el propio portal no cumple esa relación.
2. Para cada ID anunciado, leer su ficha pública. Extraer título, fecha y descripción con selectores estables y la localidad de `Ubicaciones de trabajos`. Validar provincia española y resolver el municipio con el gazetteer nacional existente. Si hay varias localidades inequívocas, conservar la oferta sin punto único; nunca señalar la capital provincial por defecto. Las ofertas verificadas sin punto pueden seguir visibles en la lista general.
3. Usar el ID `EULEN-TALEO-<contestNo>`, URL oficial, empleador `Grupo Eulen` y el logotipo local ya utilizado. Evitar duplicados exactos dentro de Taleo; contrastar con SelectMinds por ID/URL verificable, sin fusionar ofertas distintas solo por título.
4. Integrar la fuente en `registry.ts` y `runner.ts`. El workflow diario existente la ejecutará con el resto. Ante captura incompleta, errores persistentes o cambio de formato, fallar solo esta fuente y conservar su última captura válida mediante la reconciliación actual. Reintentos acotados y concurrencia baja para no sobrecargar Taleo.
5. Actualizar el inventario de fuentes y `docs/project-context.md` con el estado verificado. No añadir ofertas manuales, cuentas ni servicios de pago.

## Verificación

- Pruebas de paginación, conteos, identidad, URLs, provincias/localidades, ambigüedad, enlaces retirados y fallo parcial de fuente.
- Captura real de todas las páginas anunciadas y muestra de fichas; comprobar número de anuncios, IDs únicos y porcentaje de puntos municipales.
- Build y pruebas del repositorio; después de integrar, ejecución de GitHub Actions y verificación HTTPS del catálogo público y de ofertas Eulen en el mapa.

## Límites

El número de puntos puede ser menor que el número de ofertas si faltan localidades únicas. La captura aislada del 3 de noviembre de 2026 obtuvo 493 fichas y 455 puntos. El contador de Taleo no es utilizable como total verificable; la cobertura se define como todos los IDs únicos devueltos al recorrer el rango completo de páginas públicas en esa ejecución.
