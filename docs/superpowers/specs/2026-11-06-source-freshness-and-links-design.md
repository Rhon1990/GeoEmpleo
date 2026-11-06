# Corrección de vigencia y enlaces de fuentes

Fecha: 6 de noviembre de 2026  
Estado: aprobado para planificación

## Objetivo

Corregir Burger King, Capgemini, ECYL y Lanbide sin inventar ofertas ni ubicaciones. La actualización diaria debe retirar ofertas ausentes tras una captura completa, publicar enlaces oficiales utilizables y resistir caídas transitorias sin borrar el catálogo de forma accidental.

## Diagnóstico confirmado

- Burger King: `https://empleo.bkspain.es/jobs` responde HTTP 404. La ejecución diaria conserva una captura anterior porque el conector falla antes de reconciliarla.
- Capgemini: `locationsearch=Spain` devuelve cero resultados. El portal sigue publicando ofertas, pero la consulta configurada ya no representa el listado español.
- ECYL: algunas fichas `Plantilla100Detalle` responden 404. El adaptador ya prefiere determinados enlaces de Oficina Virtual, pero todavía puede publicar la ficha rota cuando la descripción no proporciona un destino reconocido y verificable.
- Lanbide: una captura correcta trae el conjunto actual, pero el runner conserva durante siete días las ofertas ausentes. Esta tolerancia explica las ofertas que ya no existen en origen.

## Diseño

### Vigencia y reconciliación

Lanbide y ECYL usarán reconciliación inmediata: tras una captura completa y válida, cualquier oferta anterior que no aparezca se retirará en esa misma ejecución. Una captura vacía, incompleta, inválida o fallida no podrá retirar datos.

Las fuentes empresariales conservarán la última captura válida durante fallos transitorios. Para Burger King, cuya URL oficial configurada está actualmente caída, la retención de la captura fallida tendrá un máximo de 72 horas desde su última comprobación individual. Superado ese plazo sin una captura válida, sus ofertas dejarán de publicarse hasta recuperar un listado oficial verificable. Esta caducidad será explícita y reutilizable, no una excepción manual sobre el JSON.

### Burger King

Se localizará el listado oficial vigente y se sustituirá la URL únicamente si se verifica el dominio, el listado, la ficha individual, la identidad estable y la ubicación española. Si no existe un listado automatizable y verificable, el conector permanecerá fallido y actuará la caducidad de 72 horas. No se copiarán resultados de agregadores ni se crearán fichas manuales.

### Capgemini

El conector dejará de buscar la palabra `Spain` como si fuera una localidad. Recorrerá el listado oficial completo o un filtro oficial equivalente y conservará únicamente filas cuyo país sea `ES`. La paginación deberá demostrar que recorrió el total anunciado, sin duplicados ni páginas repetidas. Cada oferta publicada conservará una ficha oficial válida; solo se situará en el mapa cuando el municipio español sea único y verificable.

### ECYL

El orden de preferencia para `sourceUrl` será:

1. enlace oficial de solicitud u Oficina Virtual publicado en la descripción;
2. ficha canónica ECYL cuando sea utilizable;
3. exclusión de la oferta si no existe ningún destino oficial utilizable.

El extractor admitirá variantes reales de texto y URL observadas en el dataset, manteniendo una lista cerrada de dominios oficiales. No seguirá redirecciones a dominios ajenos ni fabricará destinos. La validación del destino se hará durante la ingesta con límites de tiempo y tamaño; un enlace 404 no se publicará.

## Flujo de datos

1. GitHub Actions ejecuta la captura diaria.
2. Cada conector obtiene un snapshot completo y lo valida.
3. Las fichas y enlaces se contrastan con el portal oficial.
4. La reconciliación retira ausencias solo para fuentes capturadas correctamente.
5. Una fuente fallida conserva su snapshot dentro de su ventana de seguridad; Burger King caduca a las 72 horas.
6. El catálogo validado se genera de forma atómica y se publica en Firebase Hosting para `geoempleo360.com`.

## Errores y observabilidad

- Los informes distinguirán `listado no encontrado`, `listado vacío`, `paginación incompleta`, `ficha no utilizable` y `snapshot caducado` sin exponer HTML ni secretos.
- Un fallo de una fuente mantendrá el resultado global `partial`; las demás podrán actualizarse.
- No se publicará un catálogo si todas las fuentes fallan.
- No se editarán ofertas manualmente ni se afirmará cobertura cuando el portal no pueda verificarse.

## Pruebas y aceptación

- Una captura correcta de Lanbide elimina en el mismo ciclo una oferta ausente.
- Una captura Lanbide fallida conserva el último snapshot y no lo confunde con una captura vacía válida.
- Capgemini pagina el listado oficial y excluye países distintos de España.
- Burger King usa el nuevo portal verificado o elimina su snapshot al superar 72 horas de fallo.
- ECYL prefiere un enlace oficial de solicitud utilizable y rechaza fichas 404 sin alternativa.
- Los IDs permanecen únicos y los puntos del mapa solo corresponden a municipios verificados.
- Pasan las pruebas específicas, la suite completa, tipos, contratos y build estático.
- Una ejecución controlada de ingesta confirma los estados por fuente; la publicación solo se considerará terminada tras verificar por HTTPS el mismo `checkedAt` y catálogo en `geoempleo360.com`.

## Compatibilidad y riesgo

El cambio se limita a políticas de reconciliación y conectores existentes. El principal riesgo es retirar temporalmente una fuente durante una caída prolongada; se acepta para priorizar la vigencia y se mitiga con 72 horas de tolerancia. No cambia el modelo público, la búsqueda, el mapa, el acceso sin registro ni la facturación.
