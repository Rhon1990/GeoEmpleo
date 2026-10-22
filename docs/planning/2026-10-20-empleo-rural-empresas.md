# Captación de empleo rural desde empresas

## Problema y alcance

Caso aportado por el usuario: residente en Coto de San Isidro, Ituero y Lama, con empresas que contratan en Villacastín (Hola Food, Lonypack) ausentes del mapa. La cobertura por comunidad es necesaria pero insuficiente: incorporar empresas pequeñas y centros de trabajo rurales, bolsas municipales, agentes de desarrollo local y asociaciones empresariales en toda España. No limitar la captación al sector agrario.

## Evidencia consultada el 20/10/2026

- La web de Grupo Copese enlaza su portal de contratación Talentview: https://www.grupocopese.com/trabaja-con-nosotros/ y https://grupo-copese.talentview.io/iframe/mmhry5?locale=es . El listado consultado presenta en Villacastín AUXILIAR DE CALIDAD, Personal de producción cárnico sección despiece (H/M) y Responsable sección sector cárnico (H/M). También muestra puestos en Coca, Cuéllar y Hornillos de Eresma. Figurar en el listado no confirma por sí solo una fecha de cierre ni una plaza disponible hoy.
- Lonypack: anuncio de auxiliar administrativo de RR. HH. localizado en Villacastín: https://es.linkedin.com/jobs/view/auxiliar-administrativo-de-rr-hh-at-lonypack-global-sa-4476140192 . Otra publicación del empleador en JOIN: https://join.com/companies/lonypack/16790609-operario-de-almacen . El resultado de JOIN identifica Segovia; no asignar automáticamente Villacastín por el domicilio de la empresa. Debe verificarse el centro laboral de esa vacante.
- Segovia Empleo presenta anuncios de Hola Food con antigüedad visible elevada; no importarlos como vacantes actuales sin comprobar el original: https://www.segoviaempleo.com/empresa/hola-food-s-l/em_829 .
- Búsqueda en título, publicador y párrafos del catálogo local por Hola Food, Lonypack y Copese: cero coincidencias. Esto verifica la falta de menciones explícitas; no descarta anuncios anónimos de las mismas empresas.

## Diseño propuesto para generalizar

1. Inventario de empresas y centros por municipio y comarca: identidad del empleador separada del publicador y de cada centro laboral. Un directorio empresarial permite descubrir empresas, pero nunca genera una vacante.
2. Descubrimiento de fuentes: web oficial → portal de contratación enlazado por la empresa → bolsas locales/municipales → feeds de asociaciones o proveedores autorizados. Reutilizar conectores por sistema de contratación cuando sea posible. Registrar permiso/licencia y disponibilidad técnica antes de activar cada canal.
3. Comprobación diaria de fuentes conectadas: detectar altas, cambios y cierres; guardar URL original, identificador, primera/última observación y evidencias. Una caída no cierra ofertas. Una candidatura espontánea no se cuenta como vacante.
4. Ubicación: usar el centro de trabajo explícito de la oferta. Municipio aproximado cuando no haya dirección contrastada; no trasladar todas las vacantes a la sede social. Con varios centros, no elegir uno arbitrariamente.
5. Proximidad: consultar pueblos vecinos por coordenadas y radio, sin cortar por municipio o provincia. Mantener la referencia del usuario; no cambiar su ubicación real a Coto por este ejemplo ni usar domicilio personal en registros de captación.
6. Duplicados: una publicación en la web empresarial, una bolsa local y un portal puede corresponder al mismo puesto. Conservar procedencias y deduplicar de manera reversible; no sumar las tres como puestos distintos.
7. Para empresas sin canal automático, valorar recepción de ofertas directamente de la empresa y verificación editorial, sin exigir cuenta al visitante. No enviar solicitudes ni mensajes a empresas sin autorización explícita.

## Criterio de aceptación del piloto

Desde una referencia elegida en Coto de San Isidro, las vacantes verificadas cuyo centro laboral esté en Villacastín deben aparecer al abarcarlo con el mapa/radio, con empresa, puesto, procedencia, fecha de comprobación y precisión geográfica visibles. Si un anuncio no existe, está cerrado o su ubicación es ambigua, no se debe crear un marcador ficticio. Aplicar las mismas reglas a cualquier comarca española.

## Estado

Investigación verificada y requisito incorporado. Talentview/Copese y JOIN/Lonypack aún NO tienen conectores activos; falta verificar condiciones de integración, extracción, fechas y ejecutar pruebas/captura. LinkedIn continúa sin integración autorizada. No se añadieron ofertas manuales ni se enviaron mensajes a empresas.
