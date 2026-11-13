# Descubrimiento orgánico de GeoEmpleo360 — diseño aprobado

Fecha: 13/11/2026. Destino canónico: `https://geoempleo360.com/`.

## Problema y objetivo

El resultado de marca mostrado por Google usa un icono genérico y extrae de la portada «la cobertura todavía es parcial». El HTML actual declara un favicon `data:` que Google Search no admite como archivo de icono rastreable; la frase está en el contenido visible. La portada carece de canónica, datos de nombre de sitio y sitemap. La búsqueda por zona y sector funciona mediante filtros de una sola página, sin páginas HTML independientes que expliquen esas consultas.

El objetivo es presentar con claridad la web en producción y facilitar el descubrimiento de búsquedas de empleo en España, localidades y sectores. Los resultados, el orden y el texto final de Google dependen de su rastreo y clasificación; no se promete una posición ni un plazo.

## Portada, marca y texto

- Título: `Ofertas de empleo en España | GeoEmpleo360`. Descripción: `Busca ofertas de empleo en España por puesto, localidad y sector. Explora el mapa, comprueba la fuente de cada anuncio y guarda favoritos sin registrarte.` El texto visible de la portada y el estado sin resultados describirán la búsqueda, el mapa, las fuentes y la comprobación en origen. Se retirará la frase «cobertura parcial» sin afirmar que se reúnen todas las ofertas del país. En la explicación del producto se aclarará que la disponibilidad varía por fuente y localidad.
- Crear un favicon PNG cuadrado, estable y de al menos 48 × 48 px a partir de la marca existente; enlazarlo desde el HTML y publicar una versión adecuada para compartir con el logotipo completo. No se generará una identidad nueva.
- Añadir URL canónica absoluta en la portada y páginas indexables; `www` y el dominio de Firebase apuntarán en sus metadatos a `geoempleo360.com`. Añadir Open Graph y datos `WebSite`/editor con nombre, URL y logo verdaderos, sin atribuciones empresariales inventadas.
- Publicar `robots.txt` y `sitemap.xml` con URLs canónicas. No incluir búsquedas con parámetros ni páginas privadas. Mantener la ficha compartida `?oferta=` funcional, pero no declararla `JobPosting` en una página de resultados.

## Páginas por zona y sector

- El build estático, que ya usa el catálogo público vigente en los despliegues de interfaz y diarios, generará páginas HTML en `/empleo/{slug-region}/` y `/empleo/sector/{slug-sector}/` para regiones españolas y sectores presentes con al menos 10 ofertas. No se crean páginas vacías ni combinaciones automáticas de región × sector.
- Cada página tendrá título, descripción y encabezado propios; fecha de actualización derivada del catálogo; recuento claro; hasta 20 ofertas recientes con título, empresa, municipio, fecha disponible, fuente y enlace al anuncio original; una explicación de puntos municipales aproximados; y un enlace que abra la búsqueda correspondiente en el mapa. Las páginas de zona y sector se enlazarán desde una sección discreta de exploración en la portada.
- El sitemap contendrá solo las páginas creadas en ese build y la portada. Al desaparecer una página por falta de ofertas, se retirará del artefacto y del sitemap. La generación no altera `data/calls.json`, conectores, ranking de la aplicación ni futuras publicaciones.
- El contenido de las páginas será factual y útil para la persona; no repetirá una plantilla de palabras clave ni inventará salarios, direcciones o vigencia. El esquema `JobPosting` queda fuera de alcance hasta existir URLs de detalle individuales y un control específico de caducidad y permisos.

## Validación y publicación

- Pruebas de HTML, favicon PNG, metadatos, canónicas, sitemap, enlaces, escaping y omisión de páginas sin contenido; tipos y build estático. Comparar `data/calls.json` con el catálogo público antes y después.
- Revisar portada, una zona y un sector en móvil, tableta y ordenador; verificar enlaces, logo, mapa y ausencia de desbordamiento.
- Publicar mediante `deploy-ui.yml`, que aborta ante cualquier diferencia del catálogo. Verificar HTTPS y entregar un resultado visible. Si Search Console está disponible, enviar el sitemap y consultar inspección de URL; medir indexación, impresiones, clics y consultas en las semanas posteriores.

## Riesgos y límites

Google puede escoger otro título, texto o favicon y necesita volver a rastrear la web. El sitemap facilita descubrimiento, no garantiza indexación ni ranking. Las consultas genéricas como «empleo España» son competitivas y requieren contenido útil sostenido, enlaces legítimos y medición; no se promete aparecer siempre entre los primeros resultados.

Referencias: [favicon en Google Search](https://developers.google.com/search/docs/appearance/favicon-in-search), [descripciones de resultados](https://developers.google.com/search/docs/appearance/snippet), [nombre del sitio](https://developers.google.com/search/docs/appearance/site-names), [canónicas](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [ofertas de empleo](https://developers.google.com/search/docs/appearance/structured-data/job-posting) y [guía SEO](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
