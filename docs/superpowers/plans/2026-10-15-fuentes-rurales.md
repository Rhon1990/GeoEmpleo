# Fuentes rurales y ciudades — Implementation Plan

Goal: incorporar ECYL y Lanbide a la ingesta diaria sin pago ni registro.
Architecture: adaptadores puros sobre HTTP acotado, resolver nacional por provincia, reconciliación aislada y publicación atómica compartida.
Tech Stack: TypeScript/Node24, parse5 y gzip/std library existentes.

- [x] RED: tests `tests/ingestion-open-sources.test.ts` y `tests/ingestion-national-geography.test.ts` para fuentes, recencia, texto, coordenadas/provincia y alias; ejecutar antes de crear módulos.
- [x] Implementar `connectors/shared.ts`, `connectors/cyl.ts`, `connectors/lanbide.ts`, `national-geography.ts`; registrar fuentes activas. Mantener campos desconocidos nulos y evitar clasificación adivinada.
- [x] RED: tests HTTP Windows-1252 sin ejecutar JSONP y retención de 7 días/30 días; modificar `http.ts` y `catalog.ts`, sin cambiar defaults de Murcia.
- [x] RED: test `runDaily` con dos fuentes correctas y una fallida; modificar `runner.ts`/`cli.ts` y actualizar tests previos con sourceIds explícito. Cargar gazetteer nacional comprimido y publicar solo una vez por ejecución.
- [x] Corregir procedencia frontend por fuente y textos de catálogo. Verificar tests de presentación sin atribuciones cruzadas.
- [x] Ejecutar ingesta real y repeticiones; inspeccionar cantidades/IDs, municipios rurales, puntos y plazos; comprobar API/buscador local y detalle en navegador.
- [x] Ejecutar suite completa/tipos/OpenAPI/Python, revisión y actualizar contexto/README. Prompt de automatización actualizado y verificado para tres fuentes.

## Evidencia de cierre — 16/10/2026

- Captura completa de las tres fuentes y posteriores capturas parciales con conservación de Murcia ante respuesta no JSON. La última devuelve código 1 y reporta `partial`, publicando ECYL/Lanbide.
- Catálogo final: 1.429 publicaciones, IDs únicos, 1.348 con punto; 44 en Segovia, 42 con punto, 22 localidades. Las ausencias recientes conservadas explican diferencias entre recibidas y publicadas.
- Google Maps real: Riaza, tres publicaciones en un punto, selección de oferta y procedencia ECYL. Se corrigió la prioridad visual del marcador de origen para que no tape el marcador de empleo.
- Suite completa: 190 Node, tipos estrictos, OpenAPI y 76 fixtures Python. Venv reutilizado con `GEOEMPLEO_PYTHON`.
- Revisión independiente: identidad, URL exacta, provincia y proximidad del punto ECYL endurecidas. CLI parcial con código 1 cubierto en tests.
- Límites: no hay detalle enriquecido de ECYL, deduplicación entre fuentes, catálogo de todos los portales, índice nacional ni QA de carga/móvil. Sin nuevas cuentas, APIs de pago ni credenciales.
- Automatización diaria activa a las 05:30 Europe/Madrid; ejecución programada multifuente aún no observada. El equipo y la aplicación deben estar disponibles.
