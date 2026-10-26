# Mapa local con consulta automática del área visible

Petición aprobada por el usuario el 15/10/2026: iniciar cerca de su ubicación tras el permiso del navegador y actualizar ofertas cuando se mueva el mapa, reduciendo recursos.

Se adopta filtrado en el servidor local frente a conservar el catálogo completo en el navegador. Mantener filtrado íntegro en cliente reduciría implementación, pero seguiría transfiriendo descripciones ajenas al área; crear ahora PostGIS/OpenSearch sería un cambio mayor innecesario para esta vista previa.

Al abrir la web, se lee configuración y se solicita una sola posición con geolocation, sin seguimiento continuo ni alta precisión obligatoria. Si existe clave, se inicializa un único Google Map centrado en esa posición; si falla el permiso, se conserva una vista de España y la elección manual de localidad/zona. La posición no se persiste ni se añade a la URL de la página. El viewport se envía al servidor propio para búsqueda y Google recibe el centro/viewport para dibujar el mapa. No se registran coordenadas en logs.

El evento idle programa consulta tras 350 ms. Se agrupan cambios, se cancelan peticiones anteriores y se ignoran respuestas tardías incluso si el transporte no respeta abort. Actualizar resultados no mueve la cámara. El radio es un filtro adicional opcional; al iniciar por geolocalización no se activa un radio que impida explorar otras zonas. Seleccionar una localidad centra allí y preserva la elección manual.

GET /api/jobs admite bounds, texto, territorio y categoría; devuelve total, hasta 300 resúmenes, facets y metadatos. No incluye paragraphs. GET /api/job?id devuelve el detalle real bajo demanda. El catálogo se mantiene en memoria del proceso y se invalida por la firma del archivo tras la ingesta atómica. Cada petición valida parámetros y límites. El frontend no descarga calls.json ni recalcula una búsqueda nacional; si se alcanza el límite, muestra un aviso para ampliar zoom. Las ofertas sin punto no se presentan en un viewport; sin mapa pueden consultarse en lista.

El servidor sigue siendo una vista previa local, no el índice nacional previsto. La ingestión diaria y las condiciones de fuentes no cambian. Se mantienen no registro, procedencia, agrupación y coordenadas municipales aproximadas.

QA: geolocalización concedida/denegada/timeout/no soportada, límites de consulta y detalle, carga sin catálogo íntegro, debounce/cancelación/respuestas fuera de orden, movimientos sin recámara, sincronía lista/mapa, preservación de snapshot ante ingesta, filtros y mapa sin clave. Navegador real para denegación y movimiento; concesión mediante callback simulado en tests, sin fabricar ubicación real del usuario ni solicitar seguimiento.

## Ampliación territorial y regreso al origen

Petición adicional del usuario: localizar pueblos de toda España desde «Tu localidad de referencia» y volver al origen después de explorar. Se usará el dump nacional GeoNames y su catálogo postal abiertos, con coordenadas y atribución propias; no requiere Places/Geocoding ni consultas de pago. Frente a descargar todas las localidades al cliente, una API local devolverá hasta 20 sugerencias por consulta. Frente a un geocodificador externo en cada pulsación, el catálogo local mantiene coste y dependencia de red bajos. Los nombres repetidos se distinguen por provincia; un código postal propone localidades, nunca una posición personal inferida.

El catálogo territorial será independiente del catálogo de ofertas: ampliar localidades no crea empleos. Solo lugares poblados vigentes de la clase P (sin históricos/abandonados/destruidos) y registros postales con coordenadas válidas en España. Los datos postales se presentan como referencia aproximada. La elección explícita de una sugerencia centra el único mapa y conserva la búsqueda automática por viewport. «Volver a mi ubicación» usa el último origen de sesión, detectado o manual, sin pedir de nuevo permiso. «Usar mi ubicación» sigue permitiendo una nueva lectura del navegador.

Validación adicional: homónimos, tildes, alias, códigos postales múltiples, pueblos reales de distintas comunidades, límites/errores de API, consultas obsoletas y regreso al origen tras desplazar el mapa. Sin persistir la ubicación del visitante.
