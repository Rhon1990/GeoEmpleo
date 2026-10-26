# Fuentes de ofertas de GeoEmpleo

Inventario operativo revisado el **26/10/2026**. El registro ejecutable es
[`packages/ingestion/src/registry.ts`](../packages/ingestion/src/registry.ts) y la
lista que recorre la ingesta diaria está en
[`packages/ingestion/src/runner.ts`](../packages/ingestion/src/runner.ts).
Esta página explica esas fuentes; por sí sola no activa ningún portal.

## Conectores diarios activos

Los 16 identificadores siguientes están marcados como `active` en el registro,
tienen adaptador en el runner y aparecen en el último informe de ingesta.
«Actualizada» y «fallida» describen **solo la ejecución del
26/10/2026 a las 12:05:00 UTC**, no el estado permanente del portal. Ante un
fallo se conservan las publicaciones anteriores de esa fuente, sin certificar
que sigan abiertas.

| ID de fuente | Portal de origen | Canal | Última ejecución |
|---|---|---|---|
| `sef-murcia` | [SEF Murcia](https://sefapps.carm.es/sefApps/rest/ofertas/ofertas) | Datos públicos | Fallida; catálogo anterior conservado |
| `ecyl-castilla-leon` | [ECYL Castilla y León](https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/ofertas-de-empleo/exports/json) | Datos públicos | Actualizada |
| `lanbide-euskadi` | [Lanbide](https://apps.lanbide.euskadi.net/apps/OF_OFERTAS_ODE_JSON) | Datos públicos | Fallida; catálogo anterior conservado |
| `andalucia-entidades` | [Junta de Andalucía, entidades instrumentales](https://datos.juntadeandalucia.es/api/v0/job-offering-public-sector/search?announcement_status=En%20curso&job_official_degree_requirements=-&announcement_type=-&provinces=-&job_agreement=-&order_by=id&mode=DESC&format=json&size=0) | Datos públicos | Fallida; catálogo anterior conservado |
| `lever-jobandtalent` | [Job&Talent](https://api.lever.co/v0/postings/jobandtalent?mode=json) | Lever | Fallida; catálogo anterior conservado |
| `lever-skydance` | [Skydance Animation Madrid](https://api.lever.co/v0/postings/skydance?mode=json) | Lever | Actualizada |
| `bizneo-burger-king` | [Burger King España](https://empleo.bkspain.es/jobs) | Tablón Bizneo | Actualizada |
| `bizneo-plenergy` | [Plenergy](https://empleo.plenergy.es/jobs) | Tablón Bizneo | Actualizada |
| `bizneo-telepizza` | [Telepizza](https://ofertas.fooddeliverybrands.com/jobs) | Tablón Bizneo | Actualizada |
| `successfactors-vithas` | [Vithas](https://empleo.vithas.es/search/?createNewAlert=false&q=&locationsearch=) | SuccessFactors | Actualizada |
| `successfactors-mapfre` | [MAPFRE](https://jobs.mapfre.com/go/PROFESIONALES/3296401/) | SuccessFactors | Actualizada |
| `successfactors-capgemini` | [Capgemini](https://careers.capgemini.com/search/?q=&locationsearch=Spain) | SuccessFactors | Actualizada |
| `successfactors-melia` | [Meliá Hotels International](https://careers.melia.com/go/Profesionales-de-hotel/8861001/) | SuccessFactors | Actualizada |
| `talentclue-mcdonalds` | [McDonald's](https://careers.talentclue.com/es/company/6285677f44a78f103ce17087c20ecee7/jsoffers/modal?order=Fecha&sort=asc) | TalentClue | Actualizada |
| `amrest-kfc` | [KFC / AmRest](https://careers.amrest.eu/KFC/go/Jobs-KFC-ES/9158355/) | Portal AmRest | Actualizada |
| `disa-empleo` | [Grupo DISA](https://empleo.disagrupo.es/offer/getofferlistdata) | Portal empresarial | Actualizada |

El catálogo incluye además **cuatro anuncios BOE** (`sourceId: boe`)
incorporados como selección estática. `npm run ingest:daily` **no** los consulta
ni comprueba su vigencia. Tampoco hay un conector Shell independiente: algunas
fichas de Grupo DISA pueden corresponder a estaciones de esa marca.

## Fuentes registradas o estudiadas, todavía sin actualización diaria

| Fuente | Situación comprobada en el proyecto | Requisito antes de activarla |
|---|---|---|
| Aragón, empleo público | `candidate` en el registro | Resolver completitud, duplicados y plazos frente al anuncio original |
| InfoJobs | `credentials_required` | Acceso autorizado y condiciones de uso verificadas |
| Adzuna España | `paused` por el objetivo de coste cero | No activar un plan de pago; revisar condiciones si cambia la oferta |
| LinkedIn | `authorization_required` | Acuerdo o canal autorizado |
| DIA | Tablón público identificado, sin adaptador | Implementar y validar su formato, URLs, vigencia y localidad |
| Correos | Portal explorado, sin conector | Obtener localidad laboral verificable en cada publicación |
| DomusVi | Tablón Bizneo explorado, sin conector; una lectura completa devolvió HTTP 429 | Resolver acceso estable y validar la captura completa |

Otros portales y empresas solicitados se documentan en la
[auditoría nacional](planning/2026-10-19-ampliacion-nacional-fuentes.md) y el
[diseño de portales empresariales](superpowers/specs/2026-10-26-portales-empresariales-oficiales-design.md).
Que una empresa tenga sedes o un portal público no crea una oferta en GeoEmpleo.
No presentar como conectados Mercadona, Lidl, Carrefour, Repsol, Moeve, BP,
Galp, InfoJobs o LinkedIn hasta verificar un adaptador y una captura real.

## Cómo actualizar y comprobar

Desde el directorio de trabajo de `web-preview`:

1. Ejecutar `npm run ingest:daily`. El proceso recorre todos los conectores
   activos implementados; un resultado `partial` devuelve código 1 aunque sí
   publique las fuentes correctas. No lanzar otra ejecución si existe
   `var/ingestion/latest.json.lock` sin comprobar antes si hay un proceso vivo.
2. Leer `var/ingestion/latest.json`: `checkedAt`, `status` y cada `sourceId`
   indican qué se comprobó. Contrastar ese instante con
   `apps/web-preview/public/data/calls.json`, verificar JSON válido, IDs únicos,
   enlaces de origen y puntos. Si `status=failed`, no desplegar: el catálogo
   anterior debe conservarse.
3. Si el resultado es `success` o `partial`, generar la entrega estática con
   `GEOEMPLEO_ENV_FILE=/ruta/privada/.env.local npm run build:web:static`.
   Comprobar que `var/public-site/data/calls.json` mantiene el mismo
   `checkedAt` y que el formulario local `/publicar` no se incluye.
4. Publicar con `firebase deploy --only hosting --project geoempleo-49978` y
   verificar por HTTPS que
   [`/data/calls.json`](https://geoempleo-49978.web.app/data/calls.json)
   conserva `checkedAt`, cantidad e IDs únicos. La automatización diaria
   `actualizar-ofertas-reales-de-geoempleo` sigue este flujo mientras el equipo
   local y Codex están disponibles; Firebase Hosting Spark no ejecuta la
   ingesta por sí solo.

La captura del 26/10/2026 terminó `partial`: **12 fuentes actualizadas y 4
fallidas**; el catálogo público comprobado tenía **2.685 publicaciones con ID
único**, **2.263 con punto**. Son publicaciones de origen real, no vacantes
deduplicadas entre portales ni una garantía de que las fichas conservadas sigan
abiertas. Las ubicaciones son municipales aproximadas salvo que la fuente
acredite otra precisión. Al investigar un fallo, reparar solo su conector y
repetir la ingesta antes de declarar la fuente actualizada.

Al incorporar una fuente nueva, actualizar `registry.ts`, añadir su adaptador al
runner, probar identidad/URL/fecha/ubicación y fallos de red, verificar una
captura real, **y actualizar este inventario y la automatización diaria**. No
inferir empleos a partir de establecimientos ni colocar puntos arbitrarios.
