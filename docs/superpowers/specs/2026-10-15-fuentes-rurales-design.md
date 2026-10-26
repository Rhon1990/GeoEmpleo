# Más fuentes reales para pueblos y ciudades

Alcance autorizado: ampliar las fuentes gratuitas de GeoEmpleo manteniendo actualización diaria, datos reales y búsqueda pública. Conectar ECYL (Castilla y León, CC BY 4.0) y Lanbide (CC BY 4.0), además de SEF Murcia. Se verificaron sus distribuciones públicas JSON y las fichas de datos.gob.es. No se necesitan cuentas ni APIs de pago.

Se reutilizan adaptadores aislados, HTTP limitado a 8 MB/40 s, normalización segura parse5, registro de fuentes, reconciliación por ID y escritura atómica. Frente a scraping HTML o portales privados con credenciales no concedidas, estas dos distribuciones ofrecen acceso estable, texto y procedencia explícita. La lista pública identifica cada fuente, sin atribuirlas a Murcia ni presentarlas como integración directa de InfoJobs.

ECYL: endpoint Explore v2.1 de exportación completa; nueve provincias de Castilla y León. Punto municipal publicado por la fuente, validado dentro del ámbito, o resolución nacional única por localidad/provincia. Lanbide: JSON con codificación Windows-1252, nunca evaluación de JSONP; localidad y provincia resueltas en el gazetteer nacional con alias bilingües y rechazo de homónimos. Sin punto fiable, solo lista de respaldo.

Ambas fuentes contienen historial. La vista inicial publica solo los últimos 30 días; no inventa una fecha de cierre ni garantiza que el puesto siga abierto. En captura correcta, una oferta ausente se conserva hasta 7 días desde la última observación; una avería conserva íntegramente su fuente. Se mantienen las reglas de caducidad explícita de Murcia. Un fallo no bloquea otras fuentes; informe parcial e identificación de la fuente fallida, sin secretos. Todas las fuentes se ejecutan desde el mismo comando diario ya programado.

QA: datos malformados, HTML peligroso, codificación castellana, fecha/historial, identidad duplicada, URL de otro dominio, geografía fuera de provincia/ámbito, homónimos, actualización idempotente, fallo de una fuente, plazo de conservación y consulta real en Segovia/pueblos/ciudades. El inventario nacional de empleo y deduplicación entre portales siguen pendientes.
