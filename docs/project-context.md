# GeoEmpleo — Contexto del proyecto

Última revisión: 24 de octubre de 2026, Europe/Madrid.

## Propósito y alcance confirmado

GeoEmpleo será una plataforma pública de descubrimiento de empleo, inicialmente para España y totalmente en español. La referencia funcional es el buscador de Bandana, adaptado a la realidad española y con diseño modular para incorporar países, fuentes y reglas regionales.

El usuario ha elegido un **lanzamiento nacional de gran volumen**. La cobertura deberá incluir territorios urbanos y rurales, ofertas privadas, empleo público y perfiles desde trabajos operativos sin experiencia hasta puestos profesionales y ejecutivos.

El proveedor de visualización del mapa será **Google Maps**, por elección explícita del usuario. Tras completar el plan y el backlog, el usuario ha autorizado iniciar la implementación local y continuar con los contratos compartidos. Prioriza una experiencia similar a Bandana con poco gasto: objetivo inicial de Maps de 0 €, tramo Dynamic de 10.000 cargas/mes y continuidad básica gratuita mediante Embed. Véase la [decisión de mapas y coste](architecture/2026-10-14-google-maps-coste.md). Maps JavaScript API está habilitada en un proyecto personal con prueba gratuita; la consola indica que no cobrará hasta una actualización manual de la cuenta.

**No habrá registro, inicio de sesión ni cuentas de candidatos, tampoco opcionales.** Buscar, filtrar, consultar el mapa y leer el detalle completo serán funciones públicas. No se diseñarán perfiles, almacenamiento de CV ni candidaturas con autenticación en GeoEmpleo.

La inscripción a una oferta podrá realizarse en su destino de origen. Cuando ese tercero exija registro, deberá advertirse antes de salir. GeoEmpleo no puede garantizar que todos los destinos externos permitan inscribirse sin cuenta. La ausencia de registro propio no elimina esa dependencia externa.

## Estado real del repositorio

En la inspección inicial de esta tarea solo existía `README.md`, con el título del proyecto. El historial contenía el commit inicial `840e1e5`. No existían aplicación, módulos, componentes reutilizables, dependencias, infraestructura ni suites de pruebas. Tampoco existía este documento.

Existe una primera biblioteca local TypeScript de contratos de país, salario español y elegibilidad de publicación. `packages/contracts` contiene seis contratos JSON Schema con validadores TypeScript/Python y OpenAPI 3.1 para búsqueda/detalle/mapa. Preparar Node y venv Python según [README](../README.md), después ejecutar `npm run check`. `apps/web-preview` es una web pública en español, sin cuentas, con catálogo real. Hay consulta/filtrado/detalle, radio geográfico y Google Maps con agrupación por zoom y selección por oferta. La clave web está rotada y restringida. La ingesta diaria integra cuatro fuentes regionales, dos tablones Lever y seis tablones de cadenas de restauración y estaciones de servicio, con aislamiento de fallos y proyección JSON atómica; BOE sigue siendo una selección estática de cuatro anuncios. El número y el estado de la última captura están en `var/ingestion/latest.json` y `apps/web-preview/public/data/calls.json`; la última publicación pública debe verificarse por HTTPS. La API local de lectura y referencias territoriales está acotada. La compilación estática para Firebase Hosting Spark permite consulta pública sin backend, pero las ofertas directas siguen solo en SQLite privado local y revisión por CLI. El volumen cuenta publicaciones, no vacantes únicas entre fuentes ni fichas siempre completas. La cobertura nacional y los objetivos de escala siguen pendientes.

Versiones verificadas: Node.js 24.19.0, TypeScript 7.0.2 y tipos de Node 24.19.2. Las dependencias de desarrollo están fijadas y existe lockfile; no hay dependencias runtime en el dominio. Contratos usa Ajv 8.20.0; Python 3.9.6 con jsonschema 4.25.1 y ada-url 1.27.0, más dependencias fijadas en requirements. Node y Python contrastan el mismo corpus, sin descarga remota de esquemas. Las demás tecnologías siguientes siguen como propuestas. Si el código y este contexto difieren, prevalece el código y debe actualizarse este índice.

## Índice funcional

La especificación principal está en [Análisis de Bandana y arquitectura de GeoEmpleo](architecture/2026-10-14-geoempleo-arquitectura.md).

Planificación: [Backlog y plan técnico nacional](planning/2026-10-14-backlog-tecnico.md), [Primera iteración de dominio](superpowers/plans/2026-10-14-contratos-dominio.md), [Contratos v1](superpowers/plans/2026-10-14-contratos-v1.md), [Mapas/coste](architecture/2026-10-14-google-maps-coste.md), [Fuentes rurales y ciudades](superpowers/plans/2026-10-15-fuentes-rurales.md), [interacción mapa-lista inspirada en Bandana](superpowers/plans/2026-10-16-bandana-map-list-interaction.md) e [identidad visual y composición final](superpowers/specs/2026-10-16-identidad-bandana-geoempleo-design.md) con su [plan de implementación](superpowers/plans/2026-10-16-identidad-bandana-geoempleo.md).

| Área | Referencia en la especificación |
|---|---|
| Observaciones verificadas y límites de ingeniería inversa | 1. Referencia funcional |
| Experiencia pública y adaptación a España | 2. Producto |
| Alternativas y arquitectura recomendada | 3. Arquitectura |
| Países y adaptadores desacoplados | 4. Modularidad |
| Vacantes, publicaciones y procedencia | 5. Modelo de datos |
| Fuentes oficiales, privadas y rurales | 6. Agregación |
| Captación, normalización, deduplicación e indexación | 7. Flujo de datos |
| Ranking, filtros, mapa, API y rendimiento | 8. Búsqueda |
| Dimensionamiento y operación | 9. Escala |
| Fases, dependencias y criterios de salida | 10. Hoja de ruta |
| Pruebas, riesgos y pendientes | 11 y 12. Validación y decisiones |

### Código existente

| Ruta | Responsabilidad comprobada |
|---|---|
| `packages/domain/src/model.ts` | Contratos internos iniciales de remuneración, país y publicación |
| `packages/domain/src/country-policy.ts` | Registro y despacho de políticas versionadas sin condicionales por país |
| `packages/domain/src/publication.ts` | Rechazo de fichas incompletas, sin permiso, inactivas o caducadas |
| `packages/domain/src/time.ts` | Parser de instante UTC compartido por publicación y Ajv |
| `packages/contracts/schemas/v1/`, `packages/contracts/fixtures/v1.json` | Contratos versionados y corpus estructural propio |
| `packages/contracts/src/validate.ts`, `packages/contracts/src/formats.ts` | Validación Ajv, formatos UTC/HTTP y errores sin valores recibidos |
| `packages/contracts/python/validate.py`, `packages/contracts/python/requirements.txt` | Validación Python con esquemas locales y parser URL WHATWG |
| `packages/contracts/openapi/v1.json`, `packages/contracts/tools/` | API prevista sin auth, generación/verificación y runner Python |
| `tests/contracts.test.ts`, `tests/openapi.test.ts`, `tests/time.test.ts` | Interoperabilidad, referencias API y parseo temporal |
| `packages/country-es/src/compensation.ts` | Anualización EUR/bruto con pagas u horas/semanas explícitas, sin inventar mínimos |
| `tests/compensation.test.ts`, `tests/country-policy.test.ts`, `tests/publication.test.ts` | Reglas del dominio con fixtures propios |
| `apps/web-preview/public/` | Web local, filtrado, proximidad, estado de selección y adaptador Google Maps aislado |
| `apps/web-preview/public/workspace-view.mjs` | Estado de vista Ofertas/Mapa en móvil (hasta 780 px), conservando el mismo mapa; escritorio muestra ambos paneles |
| `apps/web-preview/public/data/calls.json` | Proyección real SEF/ECYL/Lanbide y selección BOE, texto publicado por cada fuente, procedencia y puntos municipales |
| `apps/web-preview/public/data/places.json` | 737 referencias originales y complemento Coto de San Isidro; usado también por resolver de ingesta |
| `apps/web-preview/data/spain-places.json.gz`, `tools/build-places.py`, `places-store.mjs` | 55.788 referencias nacionales y postales, generación reproducible, búsqueda cacheada hasta 20 sugerencias; fuentes/licencias en data/README |
| `apps/web-preview/job-store.mjs`, `public/map-search.mjs`, `public/reference-places.mjs` | API local de resúmenes/detalle, bbox, puntos completos aunque se limiten tarjetas, debounce/abort/revisión, geolocalización de una lectura y resolución manual sin ambigüedades |
| `apps/web-preview/server.mjs`, `routing.mjs`, `config.mjs` | Servidor loopback con whitelist, CSP nonce y configuración pública de Maps |
| `apps/web-preview/submissions.mjs`, `submission-api.mjs`, `moderate.mjs` | Persistencia SQLite local privada, API pública acotada, enlace de autor y moderación por operador local |
| `apps/web-preview/public/publish.*`, `manage.*`, `submission.css` | Publicación sin cuenta, salario, selección exacta en Google Maps, consulta de estado y retirada explícita por enlace privado |
| `.env.example`, `.env.local` (ignorado) | Configuración Google Maps; clave local restringida, nunca en Git |
| `apps/web-preview/tools/configure-local-maps-key.mjs` | Carga una clave desde stdin en `.env.local`, la valida y no imprime su valor |
| `tests/web-*.test.ts` | Búsqueda, proximidad, viewport, cancelación de selección y URLs del servidor |
| `packages/ingestion/src/connectors/`, `registry.ts` | Adaptadores SEF Murcia, ECYL, Lanbide, Andalucía, Lever, Bizneo, TalentClue, AmRest y DISA; fuentes activas, procedencia y URLs validadas |
| `packages/ingestion/src/national-geography.ts`, `geography.ts` | Resolución única por localidad/provincia; gazetteer nacional comprimido y verificación de puntos ECYL dentro de provincia y a menos de 25 km de referencia |
| `packages/ingestion/src/runner.ts`, `cli.ts`, `http.ts`, `catalog.ts` | Aislamiento por fuente, JSON UTF-8/Windows-1252, recencia/retención, identidad, bloqueo, informes success/partial/failed y publicación atómica |
| `tests/ingestion-*.test.ts`, `tests/fixtures/ingestion/` | Contratos, procedencia, recencia, geografía, codificación, identidad/URLs, fallos parciales/totales, CLI e idempotencia |
| `apps/web-preview/public/presentation.mjs` | Etiquetas de plazas desconocidas y procedencia por fuente |
| `package.json`, `package-lock.json`, `tsconfig.json` | Instalación reproducible, tipos estrictos y comandos de comprobación |

GEO-03 está implementado localmente; GEO-04 está parcial (faltan catálogos y persistencia canónica); GEO-06 tiene tooling local y un servidor de vista previa. GEO-12/20/21 están parciales: gazetteer, proximidad, web, adaptador Maps y agrupación local verificados; faltan catálogo nacional, agrupación en índice y control de consumo de producción. No hay CI, servicios de datos ni plataforma nacional completa.

## Arquitectura propuesta

Separar tres superficies desplegables: frontend público, API pública de lectura y workers de captación/procesamiento. La API comienza como monolito modular; los workers se escalan por carga y fuente. El aislamiento evita que una fuente lenta o rota afecte a la búsqueda.

| Responsabilidad | Propuesta |
|---|---|
| Web pública en español, responsive, páginas de detalle indexables | Next.js + TypeScript, SSR para detalles y páginas editoriales |
| Visualización de mapa | Google Dynamic para la experiencia avanzada; adaptador local verificado. Embed y admisión distribuida siguen pendientes para continuidad/coste de producción |
| API y lógica de catálogo/búsqueda | NestJS + TypeScript, contratos OpenAPI |
| Datos canónicos y geografía | PostgreSQL + PostGIS |
| Búsqueda textual, facetas y geográfica | OpenSearch administrado |
| Captación y extracción | Python, Scrapy; Playwright en workers aislados cuando sea necesario y permitido |
| Normalización y dominio | Worker TypeScript separado de la API, con paquetes de país reutilizables y eventos JSON validados |
| Distribución de tareas y reintentos | Cola administrada con DLQ, por ejemplo SQS |
| Evidencia original y reprocesado | Almacenamiento de objetos compatible con S3 |
| Caché | CDN; Redis solo si las mediciones justifican caché adicional o limitación distribuida |
| Operación | Contenedores administrados, infraestructura como código, métricas y trazas |

El proveedor cloud, los servicios equivalentes, las versiones y el presupuesto quedan pendientes de elección. No se presupone una infraestructura existente ni se exige Kubernetes para empezar.

Google Maps y bajo gasto son decisiones confirmadas; el objetivo inicial del mapa es 0 € usando tramos gratuitos. El proyecto `static-gravity-143714`, la prueba gratuita, Maps JavaScript API y la clave `GeoEmpleo Local Web` están configurados. La clave se restringe a Maps JavaScript API y a `http://127.0.0.1:4310/*` y `https://geoempleo-49978.web.app/*`; su versión anterior fue eliminada tras la rotación. **Para cualquier dominio nuevo**, conservar la restricción y añadir su patrón HTTPS explícito en Google Cloud antes del cambio DNS/despliegue; el build lee la clave de `GEOEMPLEO_ENV_FILE`, no fija el dominio en código. No usar una clave abierta a todos los sitios: permitiría consumo de cuota por terceros. La cuota `Map loads per day` aparece no ajustable, por lo que no hay garantía técnica de 0 € indefinidos si la cuenta se actualiza o sube el tráfico. El usuario rechazó el iframe general como buscador y confirmó Google Maps con puntos reales. La configuración se documenta en [Google Maps local](architecture/2026-10-14-google-maps-local.md). Ninguna de estas credenciales implica registro de visitantes.

El mapa no decide la geografía del catálogo. Las coordenadas persistentes deberán tener permiso de almacenamiento/indexación; no se presupone que los resultados de Google Geocoding/Places se puedan guardar indefinidamente. Consultar las políticas y condiciones EEE aplicables antes de habilitar esos servicios adicionales.

## Contratos que deben preservarse

1. El núcleo no depende de nombres de portales ni contiene condicionales por país. Los países implementan contratos versionados de normalización, taxonomía, territorio, salario y reglas regionales.
2. `Vacancy` representa la oferta canónica; `SourcePosting` representa cada publicación de origen. La deduplicación debe ser reversible y conservar enlaces y procedencia.
3. El motor de búsqueda es una proyección reconstruible. PostgreSQL es la fuente de verdad; los cambios se propagan mediante outbox transaccional e indexadores idempotentes.
4. Campos desconocidos son `null` o estado explícito, nunca datos inventados. Sin salario declarado no equivale a salario cero. No se inferirá falta de experiencia a partir de una descripción incompleta.
5. El núcleo permite varias ubicaciones por vacante y restricciones geográficas para empleo remoto. Un centroide municipal no se presenta como dirección exacta.
6. El contenido completo solo se publica si la fuente permite su obtención y reproducción. Una ficha parcial con enlace no cumple el requisito de detalle completo; no se contabilizará como oferta completa del catálogo público.
7. Las credenciales técnicas de proveedores pertenecen al backend y no implican registro de candidatos. La gestión operativa tendrá acceso restringido, independiente de las rutas públicas.
8. Búsqueda y detalle no dependen de cookies de sesión, perfiles, correo electrónico ni identificadores persistentes de candidatos.

## Prioridades y dependencias

Primero: asegurar fuentes con derechos de reproducción y datos completos, acordar escala/presupuesto, aprobar arquitectura y validar el modelo con muestras representativas. Después: ingesta, catálogo y búsqueda; finalmente: cobertura nacional, endurecimiento y lanzamiento.

La documentación oficial revisada confirma búsqueda/detalle en la API de InfoJobs y datos abiertos del BOE, pero no acredita credenciales concedidas, cuotas suficientes ni acuerdos para GeoEmpleo. Empléate documenta publicación automática mediante XML/JSON/RSS; no se ha confirmado una API pública de extracción. COCEDER es una candidata rural, con acceso técnico y permiso pendientes.

La propuesta usa una hipótesis de carga de 1 millón de ofertas activas y 500 consultas por segundo sostenidas; **son objetivos para pruebas, no tráfico real ni inventario garantizado**. El número de ofertas disponibles dependerá de las fuentes y acuerdos efectivos.

## QA y actualización de este archivo

Se comprobaron fallos antes de implementar las reglas y se validó la fase verde. La última suite completa pasó tipos estrictos, 224 pruebas Node, OpenAPI sincronizado y 76 fixtures con resultado compartido en Python. En este worktree se reutiliza el venv de la raíz mediante `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check`; también se puede preparar uno propio según README. Los validadores externos necesitan los formatos personalizados documentados en [contracts](../packages/contracts/README.md). Las revisiones independientes de adaptadores y runner llevaron a endurecer identidad/URLs/geografía y a marcar fallo parcial con código de salida 1, cubierto por tests. La QA anterior de Madrid–Fuentidueña, viewport y localidades se complementa con datos reales ECYL/Lanbide y selección en Riaza. Estas evidencias no acreditan QA ni carga de una plataforma nacional completa.

Limitaciones actuales: la validación JSON implementada solo acredita estructura/formato; la conversión HTML segura usa parse5, pero no hay verificación automática de licencias, deduplicación entre fuentes, cierre canónico multifuente ni interpretación general de plazos oficiales/territoriales. El módulo de publicación espera instantes UTC normalizados y una política de fuente previamente comprobada. La futura plataforma deberá superar pruebas de integración, idempotencia, geografía, acceso anónimo, seguridad, accesibilidad y carga.

Actualizar este archivo cuando se apruebe o cambie una decisión arquitectónica, se incorpore una fuente, exista un módulo real, se establezcan comandos de ejecución o se pruebe un despliegue. Registrar evidencias y distinguir siempre propuesta, implementación, integración y validación runtime.

## Ejecución y datos de la web local

`npm run dev:web` inicia `http://127.0.0.1:4310` en loopback. El snapshot BOE fue comprobado por navegación oficial; la petición al sumario API agotó el tiempo de espera. No se considera un conector automático. Texto del anuncio completo visible, bases externas, inscripción/fecha final desconocidas. Los títulos cortos y las áreas son adaptación editorial identificada. Salarios no publicados se conservan nulos. Geografía abierta de GeoNames (CC BY 4.0) y Wikidata (CC0); los puntos no son direcciones laborales. Origen de proximidad solo en memoria; no va en URL/logs. Guía: [configuración de Google Maps](architecture/2026-10-14-google-maps-local.md).

## Ingesta diaria multifuente verificada el 19/10/2026

`npm run ingest:daily` consulta las fuentes públicas gratuitas SEF Murcia, ECYL Castilla y León y Lanbide, valida cada captura y actualiza por `sourceId + id`. Se verificaron una ejecución `success` y repeticiones `partial`, sin IDs duplicados. Último catálogo: 19/10/2026 10:44:19.243 UTC (12:44:19 Europe/Madrid), 1.518 publicaciones y 1.434 con punto; 84 sin geografía permanecen en la lista de respaldo, fuera de radio/viewport. No representa todas las ofertas de España ni deduplica vacantes entre portales.

| Fuente | Publicaciones conservadas | Con punto | Última ejecución |
|---|---:|---:|---|
| SEF Murcia | 224 | 195 | Conserva captura anterior: la oferta `142026005925` llegó sin `urlDetalles` obligatorio |
| ECYL Castilla y León | 607 | 570 | 508 recibidas, 474 normalizadas; actualizada y con ausencias recientes retenidas |
| Lanbide | 683 | 665 | 558 recibidas, 542 normalizadas; actualizada y con ausencias recientes retenidas |
| BOE | 4 | 4 | Selección estática comprobada el 14/10; la ingesta no renueva su evidencia |

Segovia aporta 48 publicaciones, 45 con punto, en 24 localidades: incluye Riaza, Pedraza, Cuéllar, Navas de Oro y El Espinar. Google Maps y la lista muestran tres publicaciones ECYL en Riaza a unos 0,4 km de su referencia municipal. Son ubicaciones aproximadas, no domicilios laborales.

La normalización HTML usa `parse5@8.0.0` y preserva el texto publicado; no extrae salarios ni plazas desde prosa. Se identifica al publicador sin presentarlo como empresa. ECYL/Lanbide usan categoría `otros` cuando no existe clasificación comprobada. ECYL y Lanbide se reutilizan bajo CC BY 4.0, con atribución visible; Lanbide se decodifica en Windows-1252 y nunca se ejecuta JSONP. El resolver nacional exige nombre/provincia únicos, admite alias lingüísticos y deja nulas las ambigüedades. Un punto publicado ECYL exige provincia válida y referencia a menos de 25 km; un punto fuera de provincia invalida la captura. Murcia mantiene su resolver propio. El agrupado visual conserva puntos y permite seleccionar las ofertas de cada localidad.

**Brecha de detalle completo:** algunos textos de ECYL solo remiten a la Oficina Virtual (190 de 607 tienen menos de 100 caracteres en este catálogo). Se publica fielmente el texto disponible y el enlace; no hay extracción de requisitos completos desde esas páginas. Estos registros se cuentan como publicaciones reales, no como fichas completas que cumplan el contrato de producto. También se desconoce su fecha de cierre si no se publica. Es necesario enriquecer/verificar el detalle antes de declarar satisfecho ese requisito.

Un fallo de red o validación conserva los datos de la fuente afectada; las otras sí se actualizan. ECYL/Lanbide incorporan publicaciones de los últimos 30 días y retienen ausencias hasta siete días desde su última observación, sin inventar fecha de caducidad. Murcia mantiene su política de cierre declarado. Se rechazan capturas vacías para evitar retiradas masivas. El runner usa timeout, máximo 8 MB, HTTPS sin redirecciones y bloqueo concurrente; `var/ingestion/latest.json` distingue `success`, `partial` y `failed`, sin secretos. El CLI devuelve 0 solo en `success`, y 1 en `partial` o `failed`. Con todas las fuentes fallidas no se publica nada. Un cierre abrupto podría dejar `.lock`: comprobar primero que no exista ejecución viva antes de retirarlo. La publicación usa un solo rename atómico por ejecución. Faltan evidencias crudas persistidas, revisiones canónicas, deduplicación reversible y coordinación distribuida.

La automatización existente `actualizar-ofertas-reales-de-geoempleo` sigue activa a las 05:30 Europe/Madrid sobre `web-preview`. Su prompt se actualizó y verificó para las tres fuentes y los resultados parciales; solo notifica fallos o acciones requeridas. Ejecuta el runner, no navega portales ni modifica código. Requiere equipo encendido, aplicación abierta, red y worktree disponible. Se observaron ejecuciones manuales multifuente; aún no un ciclo programado con las tres. No usa API de IA de pago; está sujeta a los límites de uso de la aplicación.

Cuentas: el usuario autoriza cuentas operativas con identidad real, manteniendo GeoEmpleo sin registro de visitantes. InfoJobs tiene el formulario preparado, pero no se confirmó alta ni credenciales API. Adzuna muestra cuenta creada en Pending Activation: 25 llamadas de prueba y acceso completo de 8 GBP/mes con tarjeta, observado en su página autenticada. Se ha marcado `paused` y no se usa bajo el requisito gratuito. LinkedIn continúa `authorization_required`; una cuenta de usuario no concede lectura del catálogo. No se activó ningún plan de pago ni se introdujeron tarjetas.

QA multifuente: pruebas de identidad/URLs, alias/provincia, puntos incongruentes, texto Unicode/Windows-1252, retención, fallos parciales/totales, bloqueo e idempotencia. El navegador verifica localidades rurales, marcadores y procedencia ECYL sin atribuirla a Murcia. Persisten detalle enriquecido ECYL, lectores de pantalla, límites Maps de producción y fuentes restantes del diseño.

## Mapa local, búsqueda territorial y recursos (15/10/2026)

Implementado según [diseño](superpowers/specs/2026-10-15-mapa-local-viewport-design.md) y [plan](superpowers/plans/2026-10-15-mapa-local-viewport.md): permiso de ubicación una sola vez al abrir, sin watchPosition ni persistencia. Se crea un único Google Map; si falla GPS, se permite referencia manual. Tras idle, debounce 350 ms y consulta `/api/jobs?bounds=...` con texto/territorio/categoría; cancelación y revisión evitan aplicar respuestas antiguas. El navegador no descarga el snapshot completo. El detalle llega desde `/api/job?id` al abrirlo y se aborta al cerrar/cambiar. Cache local invalidada por stat del snapshot atómico. Son rutas de vista previa; no implementan todavía la API v1 nacional diseñada.

La interacción lista-mapa distingue previsualización y selección. Pasar el puntero o el foco de teclado por una tarjeta resalta su pin o grupo sin mover la cámara ni consultar de nuevo `/api/jobs`; hacer clic mantiene tarjeta y pin seleccionados, centra el punto cuando la acción nace en la lista y abre el detalle sobre el mismo contexto. Elegir una oferta desde un pin abre el mismo detalle y lleva su tarjeta a la zona visible sin un segundo centrado. El cierre aborta el detalle pendiente y limpia la selección. La regeneración de marcadores conserva clases y z-index de la selección.

«Tu localidad de referencia» usa `/api/places?q`: búsqueda local cacheada sobre 55.788 lugares poblados/referencias postales de toda España (50 provincias, Ceuta y Melilla), máximo 20 sugerencias con provincia/municipio y procedencia. GeoNames CC BY 4.0 y complemento Coto OpenStreetMap ODbL, con atribución visible; [detalles y regeneración](../apps/web-preview/data/README.md). No es un registro oficial exhaustivo ni un geocodificador de direcciones. El código postal no identifica posición personal única. «Volver a mi ubicación» vuelve al último origen detectado o elegido, sin otra petición GPS. GPS, selección manual y selección en mapa cancelan sugerencias pendientes para respetar la última acción.

QA: navegador sin posición utilizable; se verificó centro manual Coto/Ituero 40151, Navas de San Antonio y Robledillo de Gata, Cieza con 17 ofertas, regreso tras Ver España y detalle SEF bajo demanda. La concesión GPS se prueba con callbacks, no como detección real del usuario. Cieza: 14.931 bytes frente a 658.110 del catálogo íntegro. CP 40151: dos sugerencias y 1.070 bytes. Sin nuevas APIs de Google ni servicios de pago. Revisión independiente sin P1/P2 pendientes; 163 Node + 76 Python correctos, tipos/OpenAPI sincronizados.

Límites de la versión del 15/10: máximo 300 resúmenes por consulta, con aviso; el radio cliente se aplicaba tras ese corte. La ampliación del 24/10 separa puntos y tarjetas, como se documenta al final de este archivo. Las zonas sin empleo conectado siguen vacías, aunque sí exista referencia territorial. El catálogo nacional de localidades se descomprime/carga una vez por proceso y requiere reinicio tras regeneración. Falta índice espacial/nacional, QA con lector de pantalla y control de admisiones de Maps para producción; reducir transferencias no constituye una garantía de coste cero de Maps.

## Identidad visual y composición Bandana inspirada (19/10/2026)

La web aplica la identidad aprobada **Ruta G**: logotipo bicolor y paleta petróleo `#086071` con azafrán `#f5b944`. La referencia de Bandana se adopta en la jerarquía de búsqueda, resultados y mapa; las formas, ilustraciones CSS, textos y marca son propios de GeoEmpleo. No se usan imágenes de empresas ni se atribuyen fotografías a ofertas reales.

En escritorio, resultados y Google Maps ocupan dos columnas 50/50 y la zona de trabajo usa el alto restante del viewport. En móvil hasta 780 px, los botones **Ofertas/Mapa** alternan los paneles conservando la misma instancia del mapa; al abrir Mapa se refresca explícitamente el ámbito visible. Lista, pin y detalle comparten selección y foco. Los pines, el origen y el radio usan la paleta corporativa y el evento vigente `gmp-click` de Advanced Markers. El acceso continúa totalmente público y sin registro.

QA visual del 19/10: 1440×900 presenta columnas de 720 px, footer dentro del viewport y sin desbordamiento horizontal; 390×844 alterna Ofertas/Mapa sin recrear Google Maps. La búsqueda manual `Riaza · Segovia (40500)` devuelve tres ofertas ECYL reales en un punto municipal y el pin muestra sus tres títulos. Tras la recarga final no aparecieron errores ni advertencias nuevas en consola. La revisión independiente no dejó P1/P2 pendientes.

## Ampliación a todas las provincias (19/10/2026)

El usuario confirma cobertura objetivo de las 50 provincias más Ceuta y Melilla. La [auditoría de portales y diseño de ampliación](planning/2026-10-19-ampliacion-nacional-fuentes.md) distingue acceso público, permiso de reutilización e integración real. La [matriz provincial](planning/2026-10-19-cobertura-provincial.json), calculada desde el catálogo local, contiene 52 territorios: 21 con alguna publicación y 31 sin publicaciones. No acredita cobertura suficiente ni vigencia de todas las ofertas. Aragón Open Data aporta una candidata adicional con JSON y CC BY 4.0, pendiente de validar completitud, identidad, fechas y ubicación laboral. Ninguna fuente nueva se ha activado por esta auditoría.

QA responsive adicional: 1280×800 y 1024×768 mantienen mitades de 640 y 512 px; 360×800 alterna ambos paneles, sin desbordamiento y con una sola instancia de mapa. Cierre de detalle por teclado devuelve el foco a la tarjeta y limpia selección. Metadatos y atribuciones usan `--muted:#5f6f72`, contraste mínimo 4.757:1 sobre los fondos revisados. La prueba manual sin clave/error de SDK queda pendiente; el servidor normal se restauró con la configuración local existente.

## Medición reproducible de cobertura (20/10/2026)

Implementados `packages/ingestion/src/coverage.ts` y `coverage-cli.ts`, con `npm run report:coverage --silent`. Reutiliza `listSpanishProvinces()` del registro nacional existente: 50 provincias más Ceuta y Melilla, alias normalizados, contadores por fuente y fechas mínima/máxima de observación. Las provincias no reconocidas se reflejan por separado; IDs duplicados y fechas inválidas hacen fallar el informe. Los puntos se comprueban numéricamente dentro de la envolvente española, sin certificar límites administrativos ni direcciones exactas. Operación de solo lectura; no forma parte de la publicación atómica de ingesta.

QA: `npm run check` completado con 232 pruebas Node y 76 fixtures Python, tipos estrictos y OpenAPI sincronizado. Ocho pruebas nuevas cubren territorios vacíos, alias, ubicaciones inválidas, identidades duplicadas, fechas y compatibilidad BOE sin milisegundos. No se activaron nuevos conectores: ver la auditoría provincial para el error de plazos de Aragón y las comprobaciones de la API gratuita de Andalucía. La cobertura nacional de ofertas sigue pendiente.

Actualización manual 20/10/2026, 06:58:09.322 UTC (08:58 Europe/Madrid): resultado `partial`. ECYL recibe 494 publicaciones, 462 con punto; Murcia y Lanbide conservan sus capturas previas. La reconsulta diagnóstica de ambas termina en `TypeError: fetch failed`; no permite atribuir el fallo actual a datos malformados. Reintentar con conectividad a sus endpoints antes de modificar adaptadores. Catálogo validado contra el `checkedAt` de esta ejecución, JSON válido y 1.518 IDs únicos. La [matriz actualizada](planning/2026-10-20-cobertura-provincial.json) conserva 1.434 puntos, 21 territorios con publicaciones y 31 vacíos. No acredita vigencia de los registros retenidos.

## Fuentes activas actuales — 20/10/2026

Esta sección sustituye el inventario de tres conectores de las evidencias históricas anteriores. El runner ejecuta **SEF Murcia, ECYL Castilla y León, Lanbide y Junta de Andalucía (entidades instrumentales)**. Andalucía está implementada en `packages/ingestion/src/connectors/andalucia.ts`, registrada y publicada con atribución CC BY 4.0 en la web. Usa API pública gratuita sin credenciales.

Captura real del 20/10/2026 a las 07:12:05.548 UTC: Andalucía success, 11 publicaciones y 10 puntos municipales; catálogo total 1.529 IDs únicos. Una publicación con destinos Sevilla y Málaga mantiene ambas localidades y no recibe un punto único. El adaptador comprueba respuesta completa, identidad, tipos admitidos, fechas y provincia; solo incorpora plazos explícitos no vencidos, sanitiza el texto y conserva campos desconocidos. La ruta canónica de detalle se contrastó con fichas oficiales; la comprobación individual completa de las once fichas quedó pendiente tras una interrupción.

La ejecución global fue partial: ECYL actualizada (494 recibidas, 462 con punto); Murcia y Lanbide fallidas y conservadas. La automatización diaria fue actualizada en la aplicación para los cuatro conectores, con aviso únicamente ante fallos; falta observar un ciclo programado con Andalucía. Validación: 239 pruebas Node, 76 fixtures Python, tipos y OpenAPI correctos. Incluye prueba de integración idempotente y conservación del catálogo ante fallo.

Actualización manual 22/10/2026, 08:04:09.511 UTC (10:04 Europe/Madrid): resultado `success`. SEF Murcia actualizó 252 publicaciones, 221 con punto; ECYL 507 y 463; Lanbide 619 y 601; Andalucía 13 y 11. SEF publica dos registros activos sin `urlDetalles`; se validan pero se omiten porque GeoEmpleo no puede ofrecer una ficha de origen. El resto de la captura continúa siendo estricta y las ofertas previamente observadas conservan su fecha de cierre declarada. El catálogo publicado contiene 1.799 IDs únicos y 1.689 puntos; `checkedAt` coincide con el informe de esta ejecución.

Pendiente: revisión visual de ofertas andaluzas en el mapa, terminar el contraste de todas sus fichas, diagnosticar conectividad Murcia/Lanbide y continuar ampliación territorial. El registro multifuente aún no deduplica vacantes entre portales. La cobertura nacional completa sigue sin alcanzarse.

## Requisito territorial confirmado: 17 comunidades (20/10/2026)

El usuario exige ofertas reales de las 17 comunidades, además del objetivo previo de Ceuta y Melilla. La [matriz y backlog por comunidad](planning/2026-10-20-cobertura-17-comunidades.md) contiene el inventario de las 17, conteos actuales y canales a integrar. El catálogo tiene presencia en 9 comunidades; 8 están vacías. Solo cuatro servicios regionales tienen conector directo; presencia incidental fuera de su región no equivale a cobertura nacional. Esta tarea permanece pendiente. Se verificaron bloqueos técnicos en RSS de Galicia, acceso público del buscador canario y RSS nacional de SEPE; no se activaron fuentes ni se importaron datos de prueba.

## Empleo de empresas rurales: caso Coto–Villacastín (20/10/2026)

### Publicación directa solicitada

El usuario ha solicitado un formulario para publicar ofertas con salario, contactos y ubicación elegida en el mapa. Ha elegido **revisión antes de publicar** y requiere que **el autor pueda dar de baja su oferta**. El [diseño de publicación directa y gestión](superpowers/specs/2026-10-20-publicacion-directa-design.md) está implementado en la vista previa local: `/publicar` crea un envío pendiente con punto ajustable en Google Maps y muestra una sola vez un enlace privado; `/gestionar` consulta su estado y permite una retirada explícita e idempotente. Solo las ofertas aprobadas mediante `node apps/web-preview/moderate.mjs approve ID` se combinan con el catálogo público. El token se guarda únicamente como hash y el correo de gestión no forma parte de la proyección pública.

La persistencia actual es SQLite privada en `var/submissions/private.sqlite`, ignorada por Git, y sirve para QA/local. No se presenta como backend productivo ni integración Firebase. Antes de exponer este flujo en Internet faltan almacenamiento gestionado, acceso autenticado del operador, protección antiabuso distribuida, política de retención y recuperación del enlace. La búsqueda y el detalle de candidatos continúan totalmente públicos y sin registro.

El usuario requiere encontrar empleo en empresas cercanas de los pueblos, incluidas Hola Food y Lonypack en Villacastín, y generalizarlo a toda España. La cobertura autonómica no satisface por sí sola este requisito. Priorizar webs de contratación empresarial y bolsas locales además de las fuentes regionales. El [caso verificado y diseño de captación rural](planning/2026-10-20-empleo-rural-empresas.md) documenta el portal Talentview enlazado por Grupo Copese, anuncios de Lonypack y criterios de ubicación, vigencia, deduplicación y actualización diaria. No existen aún esos conectores; la búsqueda explícita de esas empresas en el catálogo no encontró coincidencias. No confundir sede empresarial, centro de trabajo y origen del usuario. El piloto de aceptación es mostrar vacantes verificadas de Villacastín desde la referencia de Coto cuando el mapa/radio abarque el centro laboral.

## Entrega pública Spark — 24/10/2026

Proyecto Firebase `geoempleo-49978`, plan Spark confirmado en consola. `firebase.json` configura Hosting estático, `tools/build-static-site.mjs` genera `var/public-site/` desde el catálogo validado, y `apps/web-preview/public/static-data.mjs` resuelve búsqueda, detalle y localidades sin servidor. La misma UI conserva la API local en desarrollo. La compilación excluye `/publicar` y `/gestionar`: esas rutas dependen de SQLite y moderación local; publicarlas en Hosting sin backend seguro expondría un flujo roto. No se creó Firestore ni Cloud Functions ni se activó Blaze. La automatización diaria debe publicar únicamente después de una captura válida.

Última ingesta manual verificada: `2026-10-24T12:02:32.597Z`, resultado `success` para SEF Murcia, ECYL, Lanbide y Andalucía; 1.797 IDs únicos, 1.686 puntos. El cambio ECYL admite la URL oficial de detalle `datosabiertos.jcyl.es` mediante canonicalización al dominio `empleo.jcyl.es` y tiene prueba de regresión. Aragón sigue en auditoría candidata y **no** entra en el catálogo activo.

La clave Maps `GeoEmpleo Local Web` del proyecto Google Cloud `static-gravity-143714` está restringida a Maps JavaScript API y a `http://127.0.0.1:4310/*` y `https://geoempleo-49978.web.app/*`; este último se añadió con autorización explícita del usuario. Para alojar la web en cualquier otro dominio, añadir ese referente HTTPS concreto a la misma lista antes de apuntar el dominio. El código no depende del nombre del dominio. No quitar restricciones ni actualizar la cuenta de prueba a facturación plena sin una decisión explícita sobre el gasto. Una página estática no puede imponer un límite duro mensual a cargas de Maps; el fallo de Maps conserva la lista de ofertas accesible.

Hosting quedó publicado en `https://geoempleo-49978.web.app` y se comprobó por HTTPS que el catálogo tiene el mismo `checkedAt`, 1.797 IDs únicos y 1.686 puntos. En navegador público, Riaza (40500) mostró tres ofertas ECYL en un punto municipal; se abrió el detalle completo y su enlace oficial. Firebase conserva plan Spark, 0 USD/mes, tras publicar. La automatización diaria existente se actualizó para validar, compilar, desplegar y comparar el catálogo público; aún falta observar su primer ciclo programado con despliegue. Depende del equipo local y la aplicación; Firebase Spark no ofrece un programador de Functions. Para operación independiente del equipo hará falta un ejecutor programado externo con credenciales de despliegue seguras, sin añadir fuentes no autorizadas ni inventar ubicaciones.

## Ampliación empresarial y puntos completos del área — 24/10/2026

El [diseño de fuentes privadas y viewport](planning/2026-10-24-ofertas-empresas-viewport.md) incorpora dos tablones empresariales mediante la [API pública de Lever](https://github.com/lever/postings-api): Job&Talent y Skydance Animation Madrid. Las vacantes publicadas se capturan diariamente con origen y empleador declarados. Solo reciben punto cuando hay una localidad española única verificable y el puesto no es remoto; los puntos son municipales aproximados. La captura real `2026-10-24T12:26:27.223Z` terminó `success` en las seis fuentes activas: 1.819 IDs únicos y 1.701 puntos. Lever aportó 22 publicaciones y 15 puntos. La API gratuita de Arbeitnow se evaluó, pero sus primeras 1.200 publicaciones no mostraron ubicaciones españolas; no se activó.

Al mover o ampliar Google Maps, `idle` consulta el rectángulo visible con espera de 350 ms. La API local y la entrega estática mantienen hasta 300 tarjetas para no saturar la lista, pero ahora devuelven todos los resúmenes con punto de esa consulta en `mapJobs`; el mapa dibuja todos sus puntos y el detalle sigue disponible al elegir cualquiera. En Firebase Hosting la consulta de viewport trabaja sobre el catálogo descargado y cacheado, sin rastreo externo en cada movimiento. Esta primera ampliación no cubre todos los portales ni todas las localidades españolas; se requieren más fuentes autorizadas y un índice espacial si el volumen crece mucho.

## Cadenas de restauración y estaciones de servicio — 24/10/2026

Se añadieron seis fuentes de empleo propias y públicas: Burger King España, Plenergy y Telepizza mediante sus tablones Bizneo; McDonald's mediante TalentClue; KFC mediante AmRest; y Grupo DISA, cuyas fichas incluyen algunas ofertas para estaciones Shell. Se capturan una vez al día desde listados y fichas oficiales con ID, enlace y empresa de origen. Las fichas sin localidad española única o con ámbito amplio permanecen en el catálogo sin marcador. La posición de otras fichas es el centro municipal aproximado, no el establecimiento exacto. Al mover el mapa se filtra el índice local, sin lanzar rastreos externos en cada desplazamiento.

La captura completa `2026-10-24T13:12:34.581Z` terminó `success` en las doce fuentes activas. El catálogo validado tiene 2.359 publicaciones con ID único, de las cuales 2.159 tienen punto. Las seis fuentes nuevas aportaron en esa ejecución 540 publicaciones (Burger King 26, Plenergy 48, Telepizza 91, McDonald's 204, KFC 95 y DISA 76); el total incluye retención temporal de publicaciones anteriores según la política de cada fuente, por lo que no es una afirmación de vacantes únicas vigentes en todas las empresas. La ejecución diaria siguiente debe volver a validar estas cifras y las fuentes, sin tratar este corte como permanente.

Se compiló y desplegó la web Spark. La respuesta pública HTTPS de `https://geoempleo-49978.web.app/data/calls.json` coincidió con ese `checkedAt`, 2.359 IDs únicos y 2.159 puntos; `app.mjs` incluyó el texto corregido para plazos no publicados. En navegador se comprobó Google Maps y una búsqueda por Burger King: 23 ofertas localizadas en el área visible, nueve puntos municipales y detalle con enlace al origen. `npm run check` terminó con 288 pruebas Node, 76 fixtures Python, tipos y OpenAPI correctos. El despliegue no activa facturación ni un programador cloud; la captura diaria sigue dependiendo del ordenador y la automatización del chat.

Los tablones que no publican una fecha completa usan `dateKind: observed`: la interfaz dice «Detectada» y `reconcileSource` conserva la primera observación, sin fingir que es la fecha original. McDonald's solo proporciona un resumen factual en GeoEmpleo y enlaza el detalle original; se evita recorrer cientos de fichas por ejecución. Los demás adaptadores obtienen la descripción de la ficha pública. El parser HTML se comparte (`html-dom.ts`), la resolución nacional (`createNationalCityResolver`) evita puntos para topónimos ambiguos y cada fuente mantiene validación y reconciliación aisladas. Las nuevas fuentes no implican una licencia general de redistribución: antes de escalar la republicación de textos hay que revisar sus condiciones.

100 Montaditos, Domino's, Repsol, Moeve, BP y Galp siguen pendientes de un conector verificable; Shell no tiene conector propio. No atribuirles cobertura por la presencia de Grupo DISA ni añadir vacantes inferidas por la existencia de un local. InfoJobs, LinkedIn y Adzuna siguen desconectados por acceso o coste. La automatización `actualizar-ofertas-reales-de-geoempleo` se actualizó para ejecutar y desplegar únicamente los doce conectores registrados, a las 05:30 Europe/Madrid, conservando fuentes fallidas y avisando solo fallos o acciones necesarias. Depende del ordenador local y de la aplicación, así que no garantiza ejecución si están apagados.
