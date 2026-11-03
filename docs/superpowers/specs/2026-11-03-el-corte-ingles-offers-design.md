# Integración de ofertas de El Corte Inglés

**Fecha:** 3 de noviembre de 2026  
**Estado:** aprobado para planificación  
**Ámbito:** ofertas activas ubicadas exclusivamente en España

## Objetivo

Incorporar a GeoEmpleo360 las vacantes reales publicadas en el portal oficial de empleo de El Corte Inglés, mostrarlas en el listado y en el mapa cuando su municipio pueda verificarse, y mantenerlas actualizadas mediante el proceso diario existente. La integración no inventará ofertas, ubicaciones ni coordenadas.

## Fuente y límites

El portal `https://empleo.elcorteingles.es/ep/ofertas` es una aplicación Angular. Su frontend consulta endpoints accesibles sin autenticación bajo `https://empleo.elcorteingles.es/ep/api/`:

- `GET /job-requisition-filters` para catálogos de países, ubicaciones, áreas y empresas.
- `POST /job-requisitions/obtain` para el listado paginado de vacantes.

Estos endpoints no constituyen una API pública documentada para terceros. El conector debe tratarlos como un contrato externo no garantizado, limitar las peticiones al mínimo necesario y fallar de forma segura ante cambios. Antes de activar la fuente se revisarán las condiciones aplicables; si prohíben la reutilización automatizada, la fuente permanecerá desactivada hasta obtener autorización.

Solo se admitirán publicaciones cuya información devuelta por el portal confirme España (`ES`). Se excluirán Portugal, autocandidaturas sin vacante concreta, registros sin identificador estable, ofertas cerradas y ubicaciones internas que no puedan asociarse inequívocamente con un municipio español.

## Arquitectura propuesta

Se añadirá un conector dedicado y desacoplado, con un identificador estable como `elcorteingles-oficial`. El conector será responsable de:

1. Consultar el listado paginado hasta completar todas las páginas disponibles.
2. Validar la estructura de cada respuesta y detener la publicación de la fuente ante una respuesta vacía inesperada o incompatible.
3. Filtrar España en origen y volver a comprobar el país durante la adaptación.
4. Deduplicar por el identificador oficial de la requisición.
5. Producir el modelo `PublicJob` actual sin alterar contratos compartidos.
6. Resolver ubicaciones mediante el `PlaceResolver` nacional ya existente; solo habrá marcador si se obtiene una coincidencia municipal única.

El conector se registrará en `registry.ts` y `runner.ts` igual que las fuentes empresariales existentes. `reconcileSource` continuará siendo el único responsable de reemplazar la instantánea de esta fuente. Si la captura o la validación falla, el runner marcará únicamente esta fuente como fallida y conservará su catálogo anterior, sin bloquear las demás fuentes.

## Modelo y normalización

Cada oferta tendrá, como mínimo:

- ID estable prefijado, derivado del identificador oficial.
- `sourceId` y nombre de fuente propios.
- Título y empresa contratante publicados por el portal.
- País confirmado como España.
- Municipio, provincia y comunidad cuando puedan verificarse.
- Fecha de publicación y/o última comprobación, sin fechas inferidas.
- Enlace directo a la ficha oficial.
- Texto descriptivo disponible públicamente, sin completar campos ausentes.

La empresa visible se normalizará como `El Corte Inglés` para el filtro, salvo que el portal identifique expresamente otra sociedad o marca contratante y exista una regla documentada. Códigos de centro o nombres internos no se mostrarán como municipios.

## Mapa y experiencia de usuario

Las ofertas con ubicación municipal confirmada se mostrarán en Google Maps con el punto aproximado del municipio, igual que las demás fuentes sin dirección exacta. Las ofertas españolas válidas pero sin municipio inequívoco podrán aparecer en el listado nacional, pero no recibirán un marcador arbitrario.

Se añadirá un recurso de marca local verificado, obtenido de una fuente oficial y sin modificar la identidad corporativa. `presentation.mjs` asociará el nuevo `sourceId` al logo y `web-employer-brand.test.ts` comprobará la asociación, el texto alternativo y el fallback neutro. La marca seguirá perteneciendo a su titular y no implicará patrocinio.

## Actualización diaria

La fuente formará parte del runner ejecutado por el workflow diario existente de GitHub Actions. No se creará otro programador ni se dependerá de Codex. La actualización debe:

- recorrer todas las páginas españolas;
- incorporar altas y cambios;
- retirar registros que ya no estén activos conforme a la política de reconciliación acordada;
- conservar la última instantánea correcta si el portal falla;
- publicar únicamente después de validar JSON, IDs únicos y build estático.

## Validación y observabilidad

Se implementarán pruebas para:

- contrato POST, paginación y finalización del recorrido;
- filtrado estricto de España y exclusión de Portugal;
- deduplicación e identidad estable;
- rechazo de respuestas vacías o malformadas;
- normalización de empresa, fechas y enlaces oficiales;
- resolución de municipio y ausencia de marcador para ubicaciones ambiguas;
- aislamiento de fallos y conservación del catálogo anterior;
- registro de la fuente en runner/registry;
- asociación del logo y fallback visual;
- generación del catálogo público con IDs únicos y build web.

El informe diario mostrará ofertas recibidas, ofertas con ubicación y un motivo accionable si la fuente falla. La comprobación final comparará el `checkedAt` del workflow, el catálogo publicado por HTTPS y una muestra de enlaces oficiales.

## Riesgos y mitigaciones

- **API no documentada:** encapsular el contrato en un único conector y validar esquemas.
- **Cambios de paginación o protección anti-bot:** carga moderada, sin concurrencia agresiva y conservación de la instantánea previa.
- **Restricciones de uso:** no activar el conector si las condiciones no permiten la reutilización o si se requiere autorización.
- **Ubicaciones internas/ambiguas:** no geocodificar sin municipio confirmado.
- **Ofertas retiradas durante una captura:** reconciliar solo después de completar y validar toda la fuente.

## Documentación afectada

La implementación actualizará `docs/project-context.md`, el inventario de fuentes y la documentación de marcas para reflejar únicamente la cobertura que haya sido verificada y activada.
