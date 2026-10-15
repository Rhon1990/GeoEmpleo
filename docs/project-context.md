# GeoEmpleo — Contexto del proyecto

Última revisión: 15 de octubre de 2026, Europe/Madrid.

## Propósito y alcance confirmado

GeoEmpleo será una plataforma pública de descubrimiento de empleo, inicialmente para España y totalmente en español. La referencia funcional es el buscador de Bandana, adaptado a la realidad española y con diseño modular para incorporar países, fuentes y reglas regionales.

El usuario ha elegido un **lanzamiento nacional de gran volumen**. La cobertura deberá incluir territorios urbanos y rurales, ofertas privadas, empleo público y perfiles desde trabajos operativos sin experiencia hasta puestos profesionales y ejecutivos.

El proveedor de visualización del mapa será **Google Maps**, por elección explícita del usuario. Tras completar el plan y el backlog, el usuario ha autorizado iniciar la implementación local y continuar con los contratos compartidos. Prioriza una experiencia similar a Bandana con poco gasto: objetivo inicial de Maps de 0 €, tramo Dynamic de 10.000 cargas/mes y continuidad básica gratuita mediante Embed. Véase la [decisión de mapas y coste](architecture/2026-10-14-google-maps-coste.md). Maps JavaScript API está habilitada en un proyecto personal con prueba gratuita; la consola indica que no cobrará hasta una actualización manual de la cuenta.

**No habrá registro, inicio de sesión ni cuentas de candidatos, tampoco opcionales.** Buscar, filtrar, consultar el mapa y leer el detalle completo serán funciones públicas. No se diseñarán perfiles, almacenamiento de CV ni candidaturas con autenticación en GeoEmpleo.

La inscripción a una oferta podrá realizarse en su destino de origen. Cuando ese tercero exija registro, deberá advertirse antes de salir. GeoEmpleo no puede garantizar que todos los destinos externos permitan inscribirse sin cuenta. La ausencia de registro propio no elimina esa dependencia externa.

## Estado real del repositorio

En la inspección inicial de esta tarea solo existía `README.md`, con el título del proyecto. El historial contenía el commit inicial `840e1e5`. No existían aplicación, módulos, componentes reutilizables, dependencias, infraestructura ni suites de pruebas. Tampoco existía este documento.

Existe una primera biblioteca local TypeScript de contratos de país, salario español y elegibilidad de publicación. Se añade `packages/contracts`: seis contratos JSON Schema con validadores TypeScript/Python y OpenAPI 3.1 para búsqueda/detalle/mapa. Ejecutar la preparación de Node y venv Python del [README](../README.md), después `npm run check`. Las reglas usan fixtures propios. Ahora existe `apps/web-preview`: web estática local en español, sin cuentas, con 242 ofertas reales: 238 activas del SEF Murcia y cuatro convocatorias BOE (9 plazas). Hay consulta/filtrado/detalle, radio geográfico y Google Maps con agrupación por zoom y selección por oferta. La clave local está configurada, rotada y restringida; el SDK se verificó con cuatro marcadores, selección de detalle y proximidad Madrid–Fuentidueña. Existe ingesta automática del SEF Murcia con proyección JSON atómica; hay API local acotada de ofertas/detalle y referencias territoriales, sin persistencia canónica en base de datos ni índice nacional. La cobertura nacional y los objetivos de escala permanecen sin validar en runtime.

Versiones verificadas: Node.js 24.19.0, TypeScript 7.0.2 y tipos de Node 24.19.2. Las dependencias de desarrollo están fijadas y existe lockfile; no hay dependencias runtime en el dominio. Contratos usa Ajv 8.20.0; Python 3.9.6 con jsonschema 4.25.1 y ada-url 1.27.0, más dependencias fijadas en requirements. Node y Python contrastan el mismo corpus, sin descarga remota de esquemas. Las demás tecnologías siguientes siguen como propuestas. Si el código y este contexto difieren, prevalece el código y debe actualizarse este índice.

## Índice funcional

La especificación principal está en [Análisis de Bandana y arquitectura de GeoEmpleo](architecture/2026-10-14-geoempleo-arquitectura.md).

Planificación: [Backlog y plan técnico nacional](planning/2026-10-14-backlog-tecnico.md) y [Plan ejecutable de la primera iteración de dominio](superpowers/plans/2026-10-14-contratos-dominio.md), [Contratos v1](superpowers/plans/2026-10-14-contratos-v1.md) y [Mapas/coste](architecture/2026-10-14-google-maps-coste.md).

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
| `apps/web-preview/public/data/calls.json` | Snapshot real BOE, procedencia, texto completo del anuncio y puntos municipales |
| `apps/web-preview/public/data/places.json` | 737 referencias originales y complemento Coto de San Isidro; usado también por resolver de ingesta |
| `apps/web-preview/data/spain-places.json.gz`, `tools/build-places.py`, `places-store.mjs` | 55.788 referencias nacionales y postales, generación reproducible, búsqueda cacheada hasta 20 sugerencias; fuentes/licencias en data/README |
| `apps/web-preview/job-store.mjs`, `public/map-search.mjs`, `public/reference-places.mjs` | API local de resúmenes/detalle, bbox, debounce/abort/revisión, geolocalización de una lectura y resolución manual sin ambigüedades |
| `apps/web-preview/server.mjs`, `routing.mjs`, `config.mjs` | Servidor loopback con whitelist, CSP nonce y configuración pública de Maps |
| `.env.example`, `.env.local` (ignorado) | Configuración Google Maps; clave local restringida, nunca en Git |
| `apps/web-preview/tools/configure-local-maps-key.mjs` | Carga una clave desde stdin en `.env.local`, la valida y no imprime su valor |
| `tests/web-*.test.ts` | Búsqueda, proximidad, viewport, cancelación de selección y URLs del servidor |
| `packages/ingestion/src/` | Registro de fuentes, normalización con parse5, resolución municipal de Murcia, conector SEF, reconciliación por identidad, HTTP acotado y publicación atómica con bloqueo |
| `tests/ingestion-*.test.ts`, `tests/fixtures/ingestion/murcia.json` | 28 pruebas de contratos, texto, geografía, fuente, fallo seguro e idempotencia |
| `apps/web-preview/public/presentation.mjs` | Etiquetas de plazas desconocidas y procedencia por fuente |
| `package.json`, `package-lock.json`, `tsconfig.json` | Instalación reproducible, tipos estrictos y comandos de comprobación |

GEO-03 está implementado localmente; GEO-04 está parcial (faltan sugerencias/catálogos y persistencia canónica); GEO-06 tiene tooling local y un servidor de vista previa. GEO-12/20/21 están parciales (gazetteer/proximidad/web/adaptador Maps verificado); faltan catálogo nacional, clustering y control de consumo de producción. No hay CI, servicios de datos ni plataforma nacional completa.

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

Las pruebas se crearon antes de implementar las reglas y se comprobaron fallos funcionales antes de la fase verde. `npm run check` verifica tipos estrictos, 163 pruebas Node (incluidas 28 de ingesta y pruebas de web/geografía/selección/cámara/presentación/routing, viewport y sugerencias nacionales), OpenAPI sincronizado y 76 fixtures con el mismo resultado esperado en Python. La revisión independiente no dejó hallazgos pendientes después de corregir el redondeo decimal mediante aritmética BigInt, discrepancias de formatos Unicode/URLs y un acoplamiento entre actualización de marcadores y cámara. Los importes mantienen el contrato en unidades menores; el producto numérico de factores solo es informativo. La instalación desde lockfile se comprueba con `npm ci`; Python usa venv y requirements fijados. Los validadores externos necesitan registrar los formatos personalizados, documentados en [contracts](../packages/contracts/README.md). Se verificaron navegador, anuncios reales, detalle, HTTP 200/400/404 y Google Maps real: cuatro marcadores, apertura desde marcador, origen Madrid, radio de 100 km, distancia de 56,7 km y encuadre conjunto del origen/oferta. Estas evidencias no acreditan QA de una plataforma completa.

Limitaciones actuales: la validación JSON implementada solo acredita estructura/formato; la conversión HTML segura usa parse5, pero no hay verificación automática de licencias, deduplicación entre fuentes, cierre canónico multifuente ni interpretación general de plazos oficiales/territoriales. El módulo de publicación espera instantes UTC normalizados y una política de fuente previamente comprobada. La futura plataforma deberá superar pruebas de integración, idempotencia, geografía, acceso anónimo, seguridad, accesibilidad y carga.

Actualizar este archivo cuando se apruebe o cambie una decisión arquitectónica, se incorpore una fuente, exista un módulo real, se establezcan comandos de ejecución o se pruebe un despliegue. Registrar evidencias y distinguir siempre propuesta, implementación, integración y validación runtime.

## Ejecución y datos de la web local

`npm run dev:web` inicia `http://127.0.0.1:4310` en loopback. El snapshot BOE fue comprobado por navegación oficial; la petición al sumario API agotó el tiempo de espera. No se considera un conector automático. Texto del anuncio completo visible, bases externas, inscripción/fecha final desconocidas. Los títulos cortos y las áreas son adaptación editorial identificada. Salarios no publicados se conservan nulos. Geografía abierta de GeoNames (CC BY 4.0) y Wikidata (CC0); los puntos no son direcciones laborales. Origen de proximidad solo en memoria; no va en URL/logs. Guía: [configuración de Google Maps](architecture/2026-10-14-google-maps-local.md).

## Ingesta diaria verificada el 15/10/2026

`npm run ingest:daily` consulta exclusivamente el endpoint público gratuito del SEF Murcia, valida toda la captura y actualiza por `sourceId + id`. Dos ejecuciones reales dieron 238 ofertas activas y 203 con punto verificado, sin duplicados. El catálogo total tiene 242 registros y 207 geolocalizados en 24 localidades. No representa cobertura nacional completa. El BOE conserva su fecha de comprobación del 14/10/2026 y sigue siendo una selección estática; la ejecución SEF no renueva esa evidencia.

La normalización HTML usa `parse5@8.0.0` y preserva el texto de las ofertas; no extrae salarios ni plazas desde prosa. El anunciante es SEF Murcia cuando la empresa no figura. El resolver exige provincia Murcia, un nombre municipal permitido por INE, coordenadas válidas dentro de su ámbito y una coincidencia única. 35 ofertas de 12 municipios sin punto verificado se pueden consultar en la lista de respaldo sin mapa; no se incluyen en radio/viewport. La agrupación visual se calcula por píxeles según zoom, conserva los puntos originales y abre una lista de todas las ofertas cuando comparten localidad.

Un error de red o validación conserva el catálogo anterior. Una ausencia aislada mantiene la última observación hasta la caducidad declarada. Se rechazan capturas vacías para evitar retiradas masivas. El runner usa timeout, máximo 8 MB, HTTPS sin redirecciones y bloqueo de ejecuciones concurrentes; el informe sin secretos queda en `var/ingestion/latest.json` (ignorado). Un cierre abrupto podría dejar un `.lock`: comprobar primero que no exista ejecución viva antes de retirarlo manualmente. La publicación usa rename atómico. Es una proyección local; faltan evidencias crudas persistidas, revisiones canónicas, deduplicación reversible y coordinación distribuida.

Se creó y verificó activa la automatización de este chat `actualizar-ofertas-reales-de-geoempleo`, diaria a las 05:30 Europe/Madrid, dirigida al worktree `web-preview`; solo notifica fallos o acciones requeridas. Ejecuta el runner, no navega portales ni modifica código. Requiere equipo encendido, aplicación abierta, acceso de red y disponibilidad del worktree. La ejecución programada futura no se ha observado todavía; sí se verificaron dos ejecuciones manuales. No usa una API de IA de pago: las reglas deterministas bastan para esta fuente; la automatización está sujeta a los límites de uso de la aplicación.

Cuentas: el usuario autoriza cuentas operativas con identidad real, manteniendo GeoEmpleo sin registro de visitantes. InfoJobs tiene el formulario preparado, pero no se confirmó alta ni credenciales API. Adzuna muestra cuenta creada en Pending Activation: 25 llamadas de prueba y acceso completo de 8 GBP/mes con tarjeta, observado en su página autenticada. Se ha marcado `paused` y no se usa bajo el requisito gratuito. LinkedIn continúa `authorization_required`; una cuenta de usuario no concede lectura del catálogo. No se activó ningún plan de pago ni se introdujeron tarjetas.

QA actual: tipos estrictos, 150 pruebas Node, 76 fixtures Python y OpenAPI sincronizado. Navegador real: 242 ofertas, SDK Maps, 24 puntos iniciales antes del agrupado por zoom, popup con las 17 ofertas de Cieza, detalle SEF y proximidad de 5 km con 17 resultados/1 municipio. Registro y normalización tuvieron revisión independiente; la revisión posterior se interrumpió por error de acceso del servicio de agentes y se sustituyó por revisión directa más pruebas. Persisten QA móvil/teclado completo, límites Maps de producción y fuentes restantes del diseño multifuente.

## Mapa local, búsqueda territorial y recursos (15/10/2026)

Implementado según [diseño](superpowers/specs/2026-10-15-mapa-local-viewport-design.md) y [plan](superpowers/plans/2026-10-15-mapa-local-viewport.md): permiso de ubicación una sola vez al abrir, sin watchPosition ni persistencia. Se crea un único Google Map; si falla GPS, se permite referencia manual. Tras idle, debounce 350 ms y consulta `/api/jobs?bounds=...` con texto/territorio/categoría; cancelación y revisión evitan aplicar respuestas antiguas. El navegador no descarga el snapshot completo. El detalle llega desde `/api/job?id` al abrirlo y se aborta al cerrar/cambiar. Cache local invalidada por stat del snapshot atómico. Son rutas de vista previa; no implementan todavía la API v1 nacional diseñada.

«Tu localidad de referencia» usa `/api/places?q`: búsqueda local cacheada sobre 55.788 lugares poblados/referencias postales de toda España (50 provincias, Ceuta y Melilla), máximo 20 sugerencias con provincia/municipio y procedencia. GeoNames CC BY 4.0 y complemento Coto OpenStreetMap ODbL, con atribución visible; [detalles y regeneración](../apps/web-preview/data/README.md). No es un registro oficial exhaustivo ni un geocodificador de direcciones. El código postal no identifica posición personal única. «Volver a mi ubicación» vuelve al último origen detectado o elegido, sin otra petición GPS. GPS, selección manual y selección en mapa cancelan sugerencias pendientes para respetar la última acción.

QA: navegador sin posición utilizable; se verificó centro manual Coto/Ituero 40151, Navas de San Antonio y Robledillo de Gata, Cieza con 17 ofertas, regreso tras Ver España y detalle SEF bajo demanda. La concesión GPS se prueba con callbacks, no como detección real del usuario. Cieza: 14.931 bytes frente a 658.110 del catálogo íntegro. CP 40151: dos sugerencias y 1.070 bytes. Sin nuevas APIs de Google ni servicios de pago. Revisión independiente sin P1/P2 pendientes; 163 Node + 76 Python correctos, tipos/OpenAPI sincronizados.

Límites: máximo 300 resúmenes por consulta, con aviso; ofertas >300 en un mismo punto requieren futura paginación/agrupación de índice y no se recuperan solo ampliando zoom. El radio cliente se aplica tras ese corte. Las zonas sin empleo conectado siguen vacías, aunque sí exista referencia territorial. El catálogo nacional de localidades se descomprime/carga una vez por proceso y requiere reinicio tras regeneración. Falta índice espacial/nacional, QA móvil/teclado y control de admisiones de Maps para producción; reducir transferencias no constituye una garantía de coste cero de Maps.
