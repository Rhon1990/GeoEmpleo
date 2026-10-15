# Ingesta diaria multifuente de ofertas reales

Fecha: 15 de octubre de 2026, Europe/Madrid.

## Objetivo y significado de «conectar todos»

GeoEmpleo incorporará diariamente todas las fuentes de empleo para España que dispongan de una vía técnica y jurídica válida: API, datos abiertos, feed, interfaz pública de ATS o acuerdo de distribución. Cada oferta conservará identificador, URL original, fuente, fechas de publicación/comprobación y ubicación. La plataforma no fabricará ofertas, ubicaciones, salarios, plazos ni estados.

«Todos» no autoriza a eludir autenticación, controles anti-bot, `robots.txt` o condiciones de servicio. Una fuente sin interfaz de lectura autorizada se registra como `authorization_required` y se activa cuando el proveedor conceda acceso. Esto afecta especialmente a LinkedIn e Indeed. Sus adaptadores y requisitos formarán parte del registro, pero no se presentarán como conectores activos hasta disponer de un acuerdo válido.

La búsqueda, el mapa y el detalle de GeoEmpleo seguirán siendo públicos y sin cuentas de candidatos. Las credenciales de fuentes son credenciales técnicas del backend.

El usuario autoriza crear cuentas operativas o de desarrollador cuando un proveedor las exija. Cada alta utilizará una identidad y un contacto reales controlados por el usuario; no se crearán perfiles ficticios ni se aceptarán declaraciones empresariales que no puedan acreditarse. Las verificaciones de correo, teléfono, identidad, condiciones contractuales o pago se completarán en la web del proveedor por el usuario cuando sean obligatorias. Los secretos se guardarán fuera de Git y nunca se copiarán al chat. Crear una cuenta en LinkedIn no habilita lectura de su catálogo: ese conector seguirá bloqueado hasta que LinkedIn conceda el acceso de socio correspondiente.

## Estrategia elegida

Se adopta una arquitectura híbrida de conectores. Las fuentes oficiales y abiertas se consultan directamente; los agregadores privados se integran mediante API; las empresas se incorporan mediante interfaces públicas o autorizadas de sus ATS. La extracción de HTML queda reservada a páginas que la permitan, con límites y revisión por fuente.

Esta estrategia ofrece más cobertura y procedencia que depender de un único agregador. También evita que un cambio de portal afecte al resto del catálogo. Usar solo scraping daría resultados rápidos pero frágiles; usar solo un agregador reduciría mantenimiento, pero perdería empleo público/local, control de vigencia y trazabilidad.

## Registro inicial de fuentes

### Fuentes abiertas activables sin credenciales

| Conector | Interfaz | Cobertura |
|---|---|---|
| `boe` | API Open Data de sumarios y documentos | Convocatorias publicadas en BOE |
| `administracion-publica` | Exportación XML/CSV del buscador | AGE, autonomías, capitales, UE y exterior incluidos por el portal |
| `lanbide` | JSON y RSS | País Vasco |
| `feina-activa` | XML diario | Cataluña |
| `ecyl` | JSON/CSV/XML y API Opendatasoft | Castilla y León |
| `emprego-galicia` | RSS | Galicia |
| `sef-murcia` | REST JSON | Región de Murcia |
| `aragon-empleo-publico` | JSON/XML/CSV | Aragón, BOA, boletines provinciales y BOE |
| `andalucia-entidades` | REST JSON/OpenAPI | Entidades instrumentales de Andalucía |
| `andalucia-libre-designacion` | REST JSON/OpenAPI | Puestos de libre designación de Andalucía |
| `lorca-empleo-privado` | JSON/XML | Ofertas privadas recopiladas por el Ayuntamiento de Lorca |
| `eprinsa-empleo-publico` | JSON/XML/CSV por entidad | Ayuntamientos y entidades locales integradas en Enlaza |

Los catálogos de Canarias, Parlamento de Canarias y Santander se registran en `candidate`. Se activan únicamente si la inspección diaria confirma datos vigentes, detalle suficiente y una licencia compatible. El catálogo de Santander declara frecuencia diaria, pero su metadato de actualización observado es antiguo.

Referencias: [BOE Open Data](https://www.boe.es/datosabiertos/api/api.php?lang=es), [Empleo Público](https://administracion.gob.es/pagFront/empleoBecas/empleo/buscadorEmpleo.htm), [Lanbide](https://datos.gob.es/es/catalogo/a16003011-ofertas-de-empleo-de-lanbide1), [Feina Activa](https://datos.gob.es/es/catalogo/a09002970-portal-feina-activa-ofertas-de-empleo), [ECYL](https://datos.gob.es/es/catalogo/a07002862-ofertas-de-empleo1), [Galicia](https://datos.gob.es/es/catalogo/a12002994-ofertas-de-empleo), [Murcia](https://datos.gob.es/es/catalogo/a14002961-ofertas-de-empleo-activas-en-la-region-de-murcia), [Aragón](https://datos.gob.es/es/catalogo/a02002834-datos-de-anuncios-de-oposiciones-y-ofertas-de-empleo-publico1) y [Andalucía](https://datos.gob.es/es/catalogo/a01002820-ofertas-de-empleo-de-entidades-instrumentales).

### APIs privadas activables con credenciales

| Conector | Requisito | Estado inicial |
|---|---|---|
| `infojobs` | Aplicación registrada, Client ID y secret | `credentials_required` |
| `adzuna-es` | App ID y key | `credentials_required` |
| `jooble-es` | Key española; controlar su cuota contractual | `credentials_required` |
| `talent-publisher` | Alta en programa publisher/API o XML | `authorization_required` |
| `careerjet-es` | Cuenta publisher; respetar el requisito de búsqueda iniciada por visitante | `authorization_required` para ingesta diaria |

InfoJobs y Adzuna son los primeros conectores privados por amplitud y documentación. Jooble se usa solo cuando su cuota permita el volumen diario. Careerjet no se utilizará como importación por lotes si su contrato continúa exigiendo IP y agente del visitante que inició la búsqueda.

Referencias: [InfoJobs](https://developer.infojobs.net/documentation/operation/offer-list-1.xhtml), [Adzuna](https://developer.adzuna.com/overview), [Jooble](https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation), [Talent.com](https://employers.talent.com/publishers) y [Careerjet](https://www.careerjet.com/partners/api).

### Conectores de páginas de empleo empresarial

Se crea un adaptador por ATS y un registro explícito de organizaciones españolas. Descubrir que una empresa usa un ATS no concede por sí solo derechos adicionales; cada tablero se activa cuando sus términos y su configuración pública permiten mostrar las ofertas.

| Adaptador ATS | Interfaz |
|---|---|
| Greenhouse | Job Board API pública de lectura |
| Lever | Postings API pública |
| Ashby | Public Job Postings API |
| Workable | Public Jobs API por subdominio |
| SmartRecruiters | Posting API por empresa |
| Personio | Feed XML de posiciones abiertas |
| Recruitee | Careers API/feed; token cuando sea exigido |
| Teamtailor | API pública con token de alcance público |

Referencias: [Greenhouse](https://docs.greenhouse.io/job-board.html), [Lever](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api), [Workable](https://workable.readme.io/reference/jobs-1), [SmartRecruiters](https://developers.smartrecruiters.com/docs/posting-api), [Personio](https://developer.personio.de/docs/retrieving-open-job-positions), [Recruitee](https://docs.recruitee.com/reference/intro-to-careers-site-api) y [Teamtailor](https://docs.teamtailor.com/).

### Fuentes que requieren acuerdo

`linkedin`, `indeed`, `eures`, `empleate`, `coceder-volver-al-pueblo`, Glassdoor, Computrabajo, JobToday, Turijobs, Monster y otros portales sin API de búsqueda documentada se registran con evidencia y responsable de acceso. LinkedIn ofrece una API de publicación para socios de Talent Solutions, no una API pública para descargar su catálogo. Google Jobs es un destino de indexación mediante `JobPosting`, no una fuente de descarga.

GeoEmpleo solicitará acuerdos o feeds. Mientras tanto, estos portales no se rastrearán mediante sesiones de usuario ni automatización que eluda sus controles. Referencias: [LinkedIn Talent Solutions](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/sync-job-postings), [EURES](https://eures.europa.eu/employers/advertise-job_en), [COCEDER](https://volveralpueblo.coceder.org/asientate/como-funciona) y [Google JobPosting](https://developers.google.com/search/docs/appearance/structured-data/job-posting).

## Componentes y contratos

`SourceRegistry` contiene por fuente: país, tipo, interfaz, licencia, política de reproducción, frecuencia, propietario, credenciales requeridas, límites, estado operativo y última ejecución. Los estados válidos son `candidate`, `credentials_required`, `authorization_required`, `active`, `paused` y `retired`.

Cada `SourceConnector` implementa `fetch(cursor)`, devuelve observaciones sin transformar y expone su política de reintento. El núcleo desconoce nombres de portales. Las observaciones se validan con contratos versionados antes de almacenarse.

El flujo diario consta de:

1. Planificador a las 05:30, `Europe/Madrid`.
2. Captura por conector, con límites, timeout, reintentos y cursor independiente.
3. Conservación temporal de evidencia original, digest y metadatos de respuesta.
4. Normalización determinista de fechas, texto, empleo, salario y ubicación.
5. Clasificación asistida por IA solo cuando las reglas no basten.
6. Resolución territorial contra el catálogo local y códigos oficiales.
7. Detección reversible de duplicados.
8. Validación de vigencia y permiso de publicación.
9. Generación atómica de la proyección que consume la web y el mapa.
10. Informe operativo con altas, cambios, cierres, errores y fuentes bloqueadas.

Una fuente que falle no bloquea las demás. El proceso conserva la última proyección válida y no cierra ofertas masivamente por un error de red.

## Uso controlado de IA

La captación, identificación y vigencia se basan en datos de la fuente. La IA puede sugerir categoría, ocupación, modalidad, requisitos y correspondencia territorial, siempre con el texto original como evidencia y una puntuación de confianza. Los campos sensibles o ausentes permanecen `null`.

Una sugerencia de IA no puede crear empleador, salario, fecha, número de plazas, dirección o URL. La salida debe cumplir un esquema cerrado. Las decisiones de publicación, cierre y ubicación en el mapa son deterministas.

## Ubicaciones reales y mapa

La ubicación se resuelve en este orden: coordenadas declaradas por la fuente, dirección verificable, código territorial, combinación municipio/provincia y, finalmente, catálogo abierto de localidades. Google Maps se limita a visualización; la ingesta no dependerá de Google Geocoding para mantener el coste controlado.

Una oferta presencial se muestra como punto solo si la localidad se resuelve de forma única. Una oferta remota utiliza ámbito remoto y requisitos geográficos, sin marcador inventado. Una oferta con varias sedes conserva todas las ubicaciones. La sede social del empleador nunca sustituye la ubicación del puesto.

## Vigencia, duplicados y publicación

La clave primaria de una publicación es `sourceId + externalId`. Una vacante canónica puede agrupar varias publicaciones, manteniendo sus enlaces. La unión usa identificadores compartidos o una coincidencia fuerte de empleador, puesto, municipio y fecha; la IA solo propone candidatos de duplicado.

Una oferta se publica cuando tiene fuente permitida, URL válida, título, descripción suficiente, empleador o anunciante, estado activo y geografía interpretable. Las ofertas explícitamente cerradas se retiran en la misma ejecución. La ausencia en una sola captura no implica cierre: se requieren capturas completas consecutivas según la política de la fuente. Las fechas límite declaradas se respetan; si no existen, se muestra estado de vigencia comprobado y fecha de última observación.

## Seguridad, coste y operación

Los secretos se leen desde variables de entorno o un gestor de secretos y nunca llegan al navegador, a Git ni a los informes. Cada conector tiene límites de solicitudes, tamaño máximo, allowlist de hosts, validación de contenido y métricas. El contenido externo se transforma a texto seguro antes de publicarse.

El primer despliegue usa servicios gratuitos o de bajo coste y una ejecución diaria. La IA se aplica únicamente a registros nuevos o modificados, con caché por digest. Un fallo de la IA deja el registro pendiente o utiliza reglas deterministas; no interrumpe la actualización de fuentes.

## Validación y criterios de aceptación

- Fixtures contractuales por conector, sin depender de Internet en la suite.
- Pruebas de paginación, cursores, reintentos, rate limit y respuestas incompletas.
- Idempotencia: repetir una captura no duplica ofertas.
- Actualización: un cambio conserva identidad y procedencia.
- Retirada: cierres explícitos desaparecen del catálogo; fallos de fuente no provocan cierres masivos.
- Geografía: solo puntos resueltos; remoto y ambiguo tienen comportamiento explícito.
- IA: esquema cerrado, campos ausentes intactos y fallback sin IA.
- Seguridad: secretos ausentes de logs, web, snapshots y repositorio.
- Ejecución diaria: informe con conteos por fuente y publicación atómica del catálogo.
- QA de navegador: lista y mapa contienen el mismo conjunto filtrado y cada marcador abre la oferta correcta.

## Entrega incremental

La primera implementación crea el registro, contratos, runner diario y conectores abiertos de mayor rendimiento: Lanbide, Feina Activa, ECYL, Galicia, Murcia, Aragón, BOE/Empleo Público y Andalucía. Después se incorporan fuentes locales y ATS. InfoJobs, Adzuna y Jooble se activan al configurar sus credenciales. Los adaptadores que requieren acuerdo quedan operativos a nivel de contrato y configuración, pero permanecen bloqueados hasta recibir autorización.

Cada incremento aumenta ofertas reales visibles. Ningún conector se contará como activo sin una captura reciente, pruebas del adaptador y verificación de una muestra contra el origen.
