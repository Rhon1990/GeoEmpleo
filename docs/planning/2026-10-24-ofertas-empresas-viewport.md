# Ofertas empresariales y mapa visible

El mapa ya consulta el catálogo interno con los límites visibles al terminar cada movimiento (350 ms de espera y cancelación de resultados anteriores). El objetivo de esta iteración es ampliar el catálogo con ofertas empresariales reales, sin convertir cada movimiento en un rastreo de terceros. Esto conserva la respuesta rápida y el coste inicial de Firebase Hosting Spark.

## Primera fuente privada

Se integran tablones publicados mediante la API pública de Lever, empezando por empresas cuyos tablones y ubicaciones españolas se han comprobado: Job&Talent y Skydance Animation Madrid. Lever documenta que solo devuelve vacantes publicadas y que terceros pueden rastrearlas. Cada tablón tiene identidad, estado e informe de fallo independientes. El listado y el detalle muestran empleador, procedencia, fecha de última comprobación y enlace a la oferta original.

Una publicación entra en el mapa solo si la localidad española se puede resolver sin ambigüedad con el gazetteer existente, hay una única localidad declarada y el puesto no es remoto. Para puestos remotos o multilocalidad no se inventa un punto. Una captura vacía o inválida conserva la anterior, mientras que las vacantes retiradas de un tablón válido desaparecen en la siguiente ejecución. No se infieren salarios ni direcciones exactas.

## Límites explícitos

Ni una IA ni una API gratuita pueden garantizar **todas** las vacantes de todas las webs en cada vista. Los sitios sin API, autorización o derecho de reutilización quedan pendientes de conector/permiso. La búsqueda por zona se ejecuta sobre los datos ya verificados y publicados, no sobre páginas externas en tiempo real. La actualización diaria depende de la automatización local y de que el equipo esté operativo; Firebase Spark no ejecuta un rastreador programado por sí mismo.

## Validación

Probar ciudad única, remoto, varias localidades, país ajeno, URL/ID inválidos, captura vacía, aislamiento de fallos y pan/zoom; después ejecutar la ingesta real y comprobar recuentos, IDs únicos, JSON válido y visualización en mapa antes de desplegar.
