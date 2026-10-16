# GeoEmpleo — Contexto del proyecto

Última revisión: 16 de octubre de 2026, Europe/Madrid.

## Propósito y alcance confirmado

GeoEmpleo será una plataforma pública de descubrimiento de empleo, inicialmente para España y totalmente en español. La referencia funcional es el buscador de Bandana, adaptado a la realidad española y con diseño modular para incorporar países, fuentes y reglas regionales.

El usuario ha elegido un **lanzamiento nacional de gran volumen**. La cobertura deberá incluir territorios urbanos y rurales, ofertas privadas, empleo público y perfiles desde trabajos operativos sin experiencia hasta puestos profesionales y ejecutivos.

El proveedor de visualización del mapa será **Google Maps**, por elección explícita del usuario. Tras completar el plan y el backlog, el usuario ha autorizado iniciar la implementación local y continuar con los contratos compartidos. Prioriza una experiencia similar a Bandana con poco gasto: objetivo inicial de Maps de 0 €, tramo Dynamic de 10.000 cargas/mes y continuidad básica gratuita mediante Embed. Véase la [decisión de mapas y coste](architecture/2026-10-14-google-maps-coste.md). Maps JavaScript API está habilitada en un proyecto personal con prueba gratuita; la consola indica que no cobrará hasta una actualización manual de la cuenta.

**No habrá registro, inicio de sesión ni cuentas de candidatos, tampoco opcionales.** Buscar, filtrar, consultar el mapa y leer el detalle completo serán funciones públicas. No se diseñarán perfiles, almacenamiento de CV ni candidaturas con autenticación en GeoEmpleo.

La inscripción a una oferta podrá realizarse en su destino de origen. Cuando ese tercero exija registro, deberá advertirse antes de salir. GeoEmpleo no puede garantizar que todos los destinos externos permitan inscribirse sin cuenta. La ausencia de registro propio no elimina esa dependencia externa.

## Estado real del repositorio

En la inspección inicial de esta tarea solo existía `README.md`, con el título del proyecto. El historial contenía el commit inicial `840e1e5`. No existían aplicación, módulos, componentes reutilizables, dependencias, infraestructura ni suites de pruebas. Tampoco existía este documento.

Existe una primera biblioteca local TypeScript de contratos de país, salario español y elegibilidad de publicación. `packages/contracts` contiene seis contratos JSON Schema con validadores TypeScript/Python y OpenAPI 3.1 para búsqueda/detalle/mapa. Preparar Node y venv Python según [README](../README.md), después ejecutar `npm run check`. `apps/web-preview` es una web local en español, sin cuentas, con 1.429 publicaciones reales y 1.348 puntos municipales verificables en el catálogo del 16/10/2026. Hay consulta/filtrado/detalle, radio geográfico y Google Maps con agrupación por zoom y selección por oferta. La clave local está configurada, rotada y restringida. La ingesta diaria integra SEF Murcia, ECYL Castilla y León y Lanbide con aislamiento de fallos y proyección JSON atómica; BOE sigue siendo una selección estática de cuatro anuncios. La API local de lectura y referencias territoriales está acotada; no hay persistencia canónica en base de datos ni índice nacional. El volumen cuenta publicaciones, no vacantes únicas entre fuentes ni fichas siempre completas. La cobertura nacional y los objetivos de escala siguen pendientes.

Versiones verificadas: Node.js 24.19.0, TypeScript 7.0.2 y tipos de Node 24.19.2. Las dependencias de desarrollo están fijadas y existe lockfile; no hay dependencias runtime en el dominio. Contratos usa Ajv 8.20.0; Python 3.9.6 con jsonschema 4.25.1 y ada-url 1.27.0, más dependencias fijadas en requirements. Node y Python contrastan el mismo corpus, sin descarga remota de esquemas. Las demás tecnologías siguientes siguen como propuestas. Si el código y este contexto difieren, prevalece el código y debe actualizarse este índice.

## Índice funcional

La especificación principal está en [Análisis de Bandana y arquitectura de GeoEmpleo](architecture/2026-10-14-geoempleo-arquitectura.md).

Planificación: [Backlog y plan técnico nacional](planning/2026-10-14-backlog-tecnico.md), [Primera iteración de dominio](superpowers/plans/2026-10-14-contratos-dominio.md), [Contratos v1](superpowers/plans/2026-10-14-contratos-v1.md), [Mapas/coste](architecture/2026-10-14-google-maps-coste.md) y [Fuentes rurales y ciudades](superpowers/plans/2026-10-15-fuentes-rurales.md).

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
| `apps/web-preview/public/data/calls.json` | Proyección real SEF/ECYL/Lanbide y selección BOE, texto publicado por cada fuente, procedencia y puntos municipales |
| `apps/web-preview/public/data/places.json` | 737 referencias originales y complemento Coto de San Isidro; usado también por resolver de ingesta |
| `apps/web-preview/data/spain-places.json.gz`, `tools/build-places.py`, `places-store.mjs` | 55.788 referencias nacionales y postales, generación reproducible, búsqueda cacheada hasta 20 sugerencias; fuentes/licencias en data/README |
| `apps/web-preview/job-store.mjs`, `public/map-search.mjs`, `public/reference-places.mjs` | API local de resúmenes/detalle, bbox, debounce/abort/revisión, geolocalización de una lectura y resolución manual sin ambigüedades |
| `apps/web-preview/server.mjs`, `routing.mjs`, `config.mjs` | Servidor loopback con whitelist, CSP nonce y configuración pública de Maps |
| `.env.example`, `.env.local` (ignorado) | Configuración Google Maps; clave local restringida, nunca en Git |
| `apps/web-preview/tools/configure-local-maps-key.mjs` | Carga una clave desde stdin en `.env.local`, la valida y no imprime su valor |
| `tests/web-*.test.ts` | Búsqueda, proximidad, viewport, cancelación de selección y URLs del servidor |
| `packages/ingestion/src/connectors/`, `registry.ts` | Adaptadores SEF Murcia, ECYL y Lanbide; fuentes activas, licencias y URLs oficiales validadas |
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

Google Maps y bajo gasto son decisiones confirmadas; el objetivo inicial del mapa es 0 € usando tramos gratuitos, con Embed gratuito ilimitado de respaldo básico. El proyecto `static-gravity-143714`, la prueba gratuita, Maps JavaScript API y la clave `GeoEmpleo Local Web` están configurados para desarrollo local. La clave se restringe a Maps JavaScript API y `http://127.0.0.1:4310/*`; su versión anterior fue eliminada tras la rotación. La cuota `Map loads per day` aparece no ajustable, por lo que el control de 300 admisiones/día requiere backend antes de producción. El usuario rechazó el iframe general como buscador y confirmó Google Maps con puntos reales. La configuración se documenta en [Google Maps local](architecture/2026-10-14-google-maps-local.md). Presupuesto de infraestructura/fuentes pendiente; no se promete que toda la plataforma sea gratuita. Ninguna de estas credenciales implica registro de visitantes.

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

Se comprobaron fallos antes de implementar las reglas y se validó la fase verde. La última suite completa pasó tipos estrictos, 190 pruebas Node, OpenAPI sincronizado y 76 fixtures con resultado compartido en Python. En este worktree se reutiliza el venv de la raíz mediante `GEOEMPLEO_PYTHON=/Users/rdelgpad/Documents/personal/GeoEmpleo/.venv/bin/python npm run check`; también se puede preparar uno propio según README. Los validadores externos necesitan los formatos personalizados documentados en [contracts](../packages/contracts/README.md). Las revisiones independientes de adaptadores y runner llevaron a endurecer identidad/URLs/geografía y a marcar fallo parcial con código de salida 1, cubierto por tests. La QA anterior de Madrid–Fuentidueña, viewport y localidades se complementa con datos reales ECYL/Lanbide y selección en Riaza. Estas evidencias no acreditan QA ni carga de una plataforma nacional completa.

Limitaciones actuales: la validación JSON implementada solo acredita estructura/formato; la conversión HTML segura usa parse5, pero no hay verificación automática de licencias, deduplicación entre fuentes, cierre canónico multifuente ni interpretación general de plazos oficiales/territoriales. El módulo de publicación espera instantes UTC normalizados y una política de fuente previamente comprobada. La futura plataforma deberá superar pruebas de integración, idempotencia, geografía, acceso anónimo, seguridad, accesibilidad y carga.

Actualizar este archivo cuando se apruebe o cambie una decisión arquitectónica, se incorpore una fuente, exista un módulo real, se establezcan comandos de ejecución o se pruebe un despliegue. Registrar evidencias y distinguir siempre propuesta, implementación, integración y validación runtime.

## Ejecución y datos de la web local

`npm run dev:web` inicia `http://127.0.0.1:4310` en loopback. El snapshot BOE fue comprobado por navegación oficial; la petición al sumario API agotó el tiempo de espera. No se considera un conector automático. Texto del anuncio completo visible, bases externas, inscripción/fecha final desconocidas. Los títulos cortos y las áreas son adaptación editorial identificada. Salarios no publicados se conservan nulos. Geografía abierta de GeoNames (CC BY 4.0) y Wikidata (CC0); los puntos no son direcciones laborales. Origen de proximidad solo en memoria; no va en URL/logs. Guía: [configuración de Google Maps](architecture/2026-10-14-google-maps-local.md).

## Ingesta diaria multifuente verificada el 16/10/2026

`npm run ingest:daily` consulta las fuentes públicas gratuitas SEF Murcia, ECYL Castilla y León y Lanbide, valida cada captura y actualiza por `sourceId + id`. Se verificaron una ejecución `success` y repeticiones `partial`, sin IDs duplicados. Último catálogo: 16/10/2026 10:45:57.860 UTC (12:45:57 Europe/Madrid), 1.429 publicaciones y 1.348 con punto; 81 sin geografía permanecen en la lista de respaldo, fuera de radio/viewport. No representa todas las ofertas de España ni deduplica vacantes entre portales.

| Fuente | Publicaciones conservadas | Con punto | Última ejecución |
|---|---:|---:|---|
| SEF Murcia | 224 | 195 | Fallo de contenido JSON; conserva captura anterior y ausencias aún no caducadas |
| ECYL Castilla y León | 570 | 534 | 570 observadas, actualizada |
| Lanbide | 631 | 615 | 630 observadas, actualizada; conserva una ausencia reciente |
| BOE | 4 | 4 | Selección estática comprobada el 14/10; la ingesta no renueva su evidencia |

Segovia aporta 44 publicaciones, 42 con punto, en 22 localidades: incluye Riaza, Pedraza, Cuéllar, Navas de Oro y El Espinar. Google Maps y la lista muestran tres publicaciones ECYL en Riaza a unos 0,4 km de su referencia municipal. Son ubicaciones aproximadas, no domicilios laborales.

La normalización HTML usa `parse5@8.0.0` y preserva el texto publicado; no extrae salarios ni plazas desde prosa. Se identifica al publicador sin presentarlo como empresa. ECYL/Lanbide usan categoría `otros` cuando no existe clasificación comprobada. ECYL y Lanbide se reutilizan bajo CC BY 4.0, con atribución visible; Lanbide se decodifica en Windows-1252 y nunca se ejecuta JSONP. El resolver nacional exige nombre/provincia únicos, admite alias lingüísticos y deja nulas las ambigüedades. Un punto publicado ECYL exige provincia válida y referencia a menos de 25 km; un punto fuera de provincia invalida la captura. Murcia mantiene su resolver propio. El agrupado visual conserva puntos y permite seleccionar las ofertas de cada localidad.

**Brecha de detalle completo:** algunos textos de ECYL solo remiten a la Oficina Virtual (175 de 570 tienen menos de 100 caracteres en esta captura). Se publica fielmente el texto disponible y el enlace; no hay extracción de requisitos completos desde esas páginas. Estos registros se cuentan como publicaciones reales, no como fichas completas que cumplan el contrato de producto. También se desconoce su fecha de cierre si no se publica. Es necesario enriquecer/verificar el detalle antes de declarar satisfecho ese requisito.

Un fallo de red o validación conserva los datos de la fuente afectada; las otras sí se actualizan. ECYL/Lanbide incorporan publicaciones de los últimos 30 días y retienen ausencias hasta siete días desde su última observación, sin inventar fecha de caducidad. Murcia mantiene su política de cierre declarado. Se rechazan capturas vacías para evitar retiradas masivas. El runner usa timeout, máximo 8 MB, HTTPS sin redirecciones y bloqueo concurrente; `var/ingestion/latest.json` distingue `success`, `partial` y `failed`, sin secretos. El CLI devuelve 0 solo en `success`, y 1 en `partial` o `failed`. Con todas las fuentes fallidas no se publica nada. Un cierre abrupto podría dejar `.lock`: comprobar primero que no exista ejecución viva antes de retirarlo. La publicación usa un solo rename atómico por ejecución. Faltan evidencias crudas persistidas, revisiones canónicas, deduplicación reversible y coordinación distribuida.

La automatización existente `actualizar-ofertas-reales-de-geoempleo` sigue activa a las 05:30 Europe/Madrid sobre `web-preview`. Su prompt se actualizó y verificó para las tres fuentes y los resultados parciales; solo notifica fallos o acciones requeridas. Ejecuta el runner, no navega portales ni modifica código. Requiere equipo encendido, aplicación abierta, red y worktree disponible. Se observaron ejecuciones manuales multifuente; aún no un ciclo programado con las tres. No usa API de IA de pago; está sujeta a los límites de uso de la aplicación.

Cuentas: el usuario autoriza cuentas operativas con identidad real, manteniendo GeoEmpleo sin registro de visitantes. InfoJobs tiene el formulario preparado, pero no se confirmó alta ni credenciales API. Adzuna muestra cuenta creada en Pending Activation: 25 llamadas de prueba y acceso completo de 8 GBP/mes con tarjeta, observado en su página autenticada. Se ha marcado `paused` y no se usa bajo el requisito gratuito. LinkedIn continúa `authorization_required`; una cuenta de usuario no concede lectura del catálogo. No se activó ningún plan de pago ni se introdujeron tarjetas.

QA multifuente: pruebas de identidad/URLs, alias/provincia, puntos incongruentes, texto Unicode/Windows-1252, retención, fallos parciales/totales, bloqueo e idempotencia. El navegador verifica localidades rurales, marcadores y procedencia ECYL sin atribuirla a Murcia. Persisten detalle enriquecido ECYL, QA móvil/teclado completo, límites Maps de producción y fuentes restantes del diseño.

## Mapa local, búsqueda territorial y recursos (15/10/2026)

Implementado según [diseño](superpowers/specs/2026-10-15-mapa-local-viewport-design.md) y [plan](superpowers/plans/2026-10-15-mapa-local-viewport.md): permiso de ubicación una sola vez al abrir, sin watchPosition ni persistencia. Se crea un único Google Map; si falla GPS, se permite referencia manual. Tras idle, debounce 350 ms y consulta `/api/jobs?bounds=...` con texto/territorio/categoría; cancelación y revisión evitan aplicar respuestas antiguas. El navegador no descarga el snapshot completo. El detalle llega desde `/api/job?id` al abrirlo y se aborta al cerrar/cambiar. Cache local invalidada por stat del snapshot atómico. Son rutas de vista previa; no implementan todavía la API v1 nacional diseñada.

«Tu localidad de referencia» usa `/api/places?q`: búsqueda local cacheada sobre 55.788 lugares poblados/referencias postales de toda España (50 provincias, Ceuta y Melilla), máximo 20 sugerencias con provincia/municipio y procedencia. GeoNames CC BY 4.0 y complemento Coto OpenStreetMap ODbL, con atribución visible; [detalles y regeneración](../apps/web-preview/data/README.md). No es un registro oficial exhaustivo ni un geocodificador de direcciones. El código postal no identifica posición personal única. «Volver a mi ubicación» vuelve al último origen detectado o elegido, sin otra petición GPS. GPS, selección manual y selección en mapa cancelan sugerencias pendientes para respetar la última acción.

QA: navegador sin posición utilizable; se verificó centro manual Coto/Ituero 40151, Navas de San Antonio y Robledillo de Gata, Cieza con 17 ofertas, regreso tras Ver España y detalle SEF bajo demanda. La concesión GPS se prueba con callbacks, no como detección real del usuario. Cieza: 14.931 bytes frente a 658.110 del catálogo íntegro. CP 40151: dos sugerencias y 1.070 bytes. Sin nuevas APIs de Google ni servicios de pago. Revisión independiente sin P1/P2 pendientes; 163 Node + 76 Python correctos, tipos/OpenAPI sincronizados.

Límites: máximo 300 resúmenes por consulta, con aviso; ofertas >300 en un mismo punto requieren futura paginación/agrupación de índice y no se recuperan solo ampliando zoom. El radio cliente se aplica tras ese corte. Las zonas sin empleo conectado siguen vacías, aunque sí exista referencia territorial. El catálogo nacional de localidades se descomprime/carga una vez por proceso y requiere reinicio tras regeneración. Falta índice espacial/nacional, QA móvil/teclado y control de admisiones de Maps para producción; reducir transferencias no constituye una garantía de coste cero de Maps.
