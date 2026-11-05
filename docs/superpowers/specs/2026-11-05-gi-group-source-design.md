# Gi Group: ofertas oficiales españolas en GeoEmpleo360

Fecha: 5 de noviembre de 2026. Estado: diseño aprobado en conversación; pendiente de revisión de esta especificación.

## Alcance

Añadir Gi Group como fuente diaria independiente a partir de su [listado oficial](https://es.gigroup.com/ofertas-de-trabajo/). Publicar únicamente vacantes españolas activas con ID y enlace a la ficha pública. Mostrar su marca local como las demás empresas conectadas. La lectura en GeoEmpleo360 permanece abierta, sin registro.

Triangle Solutions queda documentada como fuente pendiente: el [portal oficial](https://trianglerrhh.viterbit.site/) muestra ofertas en navegador, pero devuelve HTTP 403 al proceso automatizado. No se incorporarán sus anuncios ni marcadores hasta disponer de un canal oficial estable y verificable.

## Captura y normalización

Un conector `gigroup-oficial` recorrerá exclusivamente las páginas ordinarias `?npage=N` del listado y los enlaces de detalle `/ofertas-de-trabajo-detalle/.../<id>/` del mismo dominio. No usará la ruta de paginación infinita excluida por `robots.txt`, ni el portal de candidatura. El ID numérico de la ficha será la identidad estable. Se leerá el `JobPosting` JSON-LD de cada detalle para título, descripción, fecha de publicación, fecha de vigencia y localidad/provincia, contrastando el ID y la URL del listado.

La ingesta exigirá paginación completa y sin IDs duplicados; un error de página, HTML inesperado o ficha inválida hará fallar **solo esta fuente** y conservará la última captura válida. Se limitará a 100 páginas y 2.500 fichas por ejecución, con no más de cuatro solicitudes de detalle simultáneas. No se inventarán salarios, direcciones, empresas contratantes ni fechas. La fecha de cierre se aceptará solo si la ficha la publica y sigue vigente. Una oferta sin provincia española verificable se excluirá; una localidad ambigua podrá permanecer sin punto si la provincia sí es válida. Los puntos serán aproximaciones municipales mediante el resolver nacional ya existente. Una oferta remota sin centro confirmado no recibirá marcador.

La tarjeta y el detalle enlazarán a la ficha pública individual. La candidatura podrá llevar a un tercero y requerir cuenta; se conserva el aviso general de GeoEmpleo360. El logo de Gi Group se guardará como recurso local verificado de la marca oficial y se reutilizará con el sistema de imágenes existente.

## Integración y comprobación

El conector se registrará en `registry.ts` y en el runner diario con el mismo aislamiento de errores y política de retención del resto de fuentes. Se actualizarán el inventario de fuentes y `docs/project-context.md` con el estado real; Triangle figurará como pendiente, sin contar como fuente activa.

Pruebas clave: paginación y unicidad, extracción de JSON-LD, España frente a país no confirmado, localidad ambigua sin punto, URL de detalle pública, cierre/vigencia, captura parcial fallida que conserva el catálogo, y logo legible. Tras la captura aislada se ejecutarán las comprobaciones del repositorio. Solo se publicará después de verificar una captura completa, IDs únicos y varios enlaces de detalle; la ejecución de GitHub Actions deberá demostrar la actualización y ambos dominios deberán servir el mismo `checkedAt`.

## Riesgos y límites

El portal puede cambiar su HTML o las condiciones de reutilización. La presencia de `JobPosting` y el acceso HTTP no equivalen a una licencia de republicación; se limitará el contenido a lo necesario para descubrir y enlazar la oferta, preservando la atribución y el enlace oficial. Si no se puede demostrar captura completa o acceso permitido, la fuente permanecerá sin activar. El conteo del listado puede variar mientras se recorren sus páginas; se validará contra la paginación observada y se reintentará una captura inconsistente antes de publicar.
