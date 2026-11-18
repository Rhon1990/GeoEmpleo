# Primark, Banco Santander e Iberdrola — diseño

## Objetivo

Incorporar al catálogo diario las ofertas españolas visibles en los portales oficiales de Primark, Banco Santander e Iberdrola, mostrando sus logotipos oficiales locales y manteniendo los enlaces originales.

## Enfoque aprobado

- Reutilizar y parametrizar el adaptador Workday existente para Banco Santander e Iberdrola. Cada fuente fija su host, tenant, sitio y faceta `locationCountry`, y valida que todas las páginas pertenecen al filtro España.
- Crear un adaptador pequeño para el listado HTML paginado de Primark (Radancy/TalentBrew). El total, el número de páginas y cada identificador se contrastan para impedir publicaciones parciales.
- No copiar descripciones completas. En ofertas Workday marcadas con varias ubicaciones se consulta únicamente el detalle público necesario para obtener `location` y `additionalLocations`: se crea una ficha geográfica estable por municipio, todas remiten al mismo anuncio original. Si el detalle no está disponible, se conserva una ficha sin coordenadas.
- Cuando el listado no expone una fecha absoluta, usar `dateKind: observed`; la reconciliación diaria conserva la primera detección y no convierte vacantes antiguas en ofertas del día.
- Resolver solo municipios inequívocos. Las ubicaciones múltiples se separan cuando el portal enumera sus localidades; los destinos remotos o no reconocibles permanecen sin marcador para no inventar precisión.
- Descargar una copia local de cada logotipo oficial, documentar su procedencia y conservar la identidad neutra existente como alternativa ante errores.

## Integración diaria

Las fuentes `radancy-primark`, `workday-santander` y `workday-iberdrola` se registran como ATS activas y se añaden al ejecutor diario. Un fallo aislado conserva el catálogo anterior de esa fuente mediante el mecanismo existente; una captura incompleta se rechaza.

## Corrección de la publicación anterior

El primer despliegue de Repsol y PwC terminó parcial: Repsol recibió HTTP 429 y PwC sufrió un fallo transitorio, por lo que ninguna tenía un catálogo previo que conservar. Repsol usará como arranque una instantánea de 18 ofertas obtenida y verificada el 18/11/2026, únicamente cuando el portal responda 429 y hasta el 25/11/2026; después caduca sin renovarse. La captura en vivo mantiene prioridad. PwC conserva su conector en vivo y el siguiente despliegue vuelve a intentarlo.

## Validación

- Pruebas unitarias de parsing, paginación, filtro España, IDs, expansión de ubicaciones múltiples y fallback sin detalle.
- Prueba del ejecutor con las tres fuentes y conservación de primera detección.
- Pruebas de registro, rutas y assets de marca.
- Suite TypeScript/Node completa y build estático.
- Captura real aislada para contrastar los totales visibles antes de publicar.
