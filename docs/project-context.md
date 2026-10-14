# GeoEmpleo — Contexto del proyecto

Última revisión: 14 de octubre de 2026, Europe/Madrid.

## Propósito y alcance confirmado

GeoEmpleo será una plataforma pública de descubrimiento de empleo, inicialmente para España y totalmente en español. La referencia funcional es el buscador de Bandana, adaptado a la realidad española y con diseño modular para incorporar países, fuentes y reglas regionales.

El usuario ha elegido un **lanzamiento nacional de gran volumen**. La cobertura deberá incluir territorios urbanos y rurales, ofertas privadas, empleo público y perfiles desde trabajos operativos sin experiencia hasta puestos profesionales y ejecutivos.

El proveedor de visualización del mapa será **Google Maps**, por elección explícita del usuario. La continuación autorizada se limita a completar el plan técnico y el backlog, sin implementar todavía la aplicación.

**No habrá registro, inicio de sesión ni cuentas de candidatos, tampoco opcionales.** Buscar, filtrar, consultar el mapa y leer el detalle completo serán funciones públicas. No se diseñarán perfiles, almacenamiento de CV ni candidaturas con autenticación en GeoEmpleo.

La inscripción a una oferta podrá realizarse en su destino de origen. Cuando ese tercero exija registro, deberá advertirse antes de salir. GeoEmpleo no puede garantizar que todos los destinos externos permitan inscribirse sin cuenta. La ausencia de registro propio no elimina esa dependencia externa.

## Estado real del repositorio

En la inspección inicial de esta tarea solo existía `README.md`, con el título del proyecto. El historial contenía el commit inicial `840e1e5`. No existían aplicación, módulos, componentes reutilizables, dependencias, infraestructura ni suites de pruebas. Tampoco existía este documento.

Esta entrega añade documentación. **No hay implementación, integración de fuentes, despliegue ni QA de una plataforma funcionando.** Las tecnologías siguientes son propuestas, no decisiones implementadas o aprobadas. Si el código futuro difiere de este contexto, prevalece el código y debe actualizarse este índice.

## Índice funcional

La especificación principal está en [Análisis de Bandana y arquitectura de GeoEmpleo](architecture/2026-10-14-geoempleo-arquitectura.md).

Planificación: [Backlog y plan técnico nacional](planning/2026-10-14-backlog-tecnico.md) y [Plan ejecutable de la primera iteración de dominio](superpowers/plans/2026-10-14-contratos-dominio.md).

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

## Arquitectura propuesta

Separar tres superficies desplegables: frontend público, API pública de lectura y workers de captación/procesamiento. La API comienza como monolito modular; los workers se escalan por carga y fuente. El aislamiento evita que una fuente lenta o rota afecte a la búsqueda.

| Responsabilidad | Propuesta |
|---|---|
| Web pública en español, responsive, páginas de detalle indexables | Next.js + TypeScript, SSR para detalles y páginas editoriales |
| Visualización de mapa | Google Maps JavaScript API, carga bajo demanda y adaptación en un componente aislado |
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

Google Maps es una decisión de producto confirmada; su proyecto técnico, facturación, clave restringida y presupuesto siguen pendientes. La clave web será visible en el navegador y debe restringirse por sitios y API; las claves de servicios backend serán independientes. Ninguna de estas credenciales implica registro de visitantes.

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

La entrega actual se valida mediante revisión documental y comprobaciones de estructura, enlaces locales y diferencias Git. Los ejemplos del primer plan se ejecutaron exclusivamente en un directorio temporal: 18 pruebas de reglas pasaron con Node 24.19.0; no se ejecutó comprobación TypeScript porque el compilador no está disponible localmente. Esto no acredita implementación en el repositorio ni QA de una aplicación. La futura plataforma deberá superar pruebas de contratos de fuentes/países, idempotencia, salarios, geografía, deduplicación, caducidad, acceso anónimo, seguridad, accesibilidad y carga.

Actualizar este archivo cuando se apruebe o cambie una decisión arquitectónica, se incorpore una fuente, exista un módulo real, se establezcan comandos de ejecución o se pruebe un despliegue. Registrar evidencias y distinguir siempre propuesta, implementación, integración y validación runtime.
