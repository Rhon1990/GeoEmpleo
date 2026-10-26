# Fuentes de ofertas de GeoEmpleo

Inventario operativo revisado el **26/10/2026**. El registro ejecutable es
[`packages/ingestion/src/registry.ts`](../packages/ingestion/src/registry.ts) y la
lista que recorre la ingesta diaria está en
[`packages/ingestion/src/runner.ts`](../packages/ingestion/src/runner.ts).
Esta página explica esas fuentes; por sí sola no activa ningún portal.

## Conectores diarios activos

Los 17 identificadores siguientes están marcados como `active` en el registro,
tienen adaptador en el runner y aparecen en el último informe de ingesta.
«Actualizada» y «fallida» describen **solo la ejecución del
26/10/2026 a las 12:49:43 UTC**, no el estado permanente del portal. Ante un
fallo se conservan las publicaciones anteriores de esa fuente, sin certificar
que sigan abiertas.

| ID de fuente | Portal de origen | Canal | Última ejecución |
|---|---|---|---|
| `sef-murcia` | [SEF Murcia](https://sefapps.carm.es/sefApps/rest/ofertas/ofertas) | Datos públicos | Fallida; catálogo anterior conservado |
| `ecyl-castilla-leon` | [ECYL Castilla y León](https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/ofertas-de-empleo/exports/json) | Datos públicos | Actualizada |
| `lanbide-euskadi` | [Lanbide](https://apps.lanbide.euskadi.net/apps/OF_OFERTAS_ODE_JSON) | Datos públicos | Actualizada |
| `andalucia-entidades` | [Junta de Andalucía, entidades instrumentales](https://datos.juntadeandalucia.es/api/v0/job-offering-public-sector/search?announcement_status=En%20curso&job_official_degree_requirements=-&announcement_type=-&provinces=-&job_agreement=-&order_by=id&mode=DESC&format=json&size=0) | Datos públicos | Actualizada |
| `lever-jobandtalent` | [Job&Talent](https://api.lever.co/v0/postings/jobandtalent?mode=json) | Lever | Actualizada |
| `lever-skydance` | [Skydance Animation Madrid](https://api.lever.co/v0/postings/skydance?mode=json) | Lever | Actualizada |
| `bizneo-burger-king` | [Burger King España](https://empleo.bkspain.es/jobs) | Tablón Bizneo | Actualizada |
| `bizneo-plenergy` | [Plenergy](https://empleo.plenergy.es/jobs) | Tablón Bizneo | Actualizada |
| `bizneo-telepizza` | [Telepizza](https://ofertas.fooddeliverybrands.com/jobs) | Tablón Bizneo | Actualizada |
| `successfactors-vithas` | [Vithas](https://empleo.vithas.es/search/?createNewAlert=false&q=&locationsearch=) | SuccessFactors | Actualizada |
| `successfactors-mapfre` | [MAPFRE](https://jobs.mapfre.com/go/PROFESIONALES/3296401/) | SuccessFactors | Actualizada |
| `successfactors-capgemini` | [Capgemini](https://careers.capgemini.com/search/?q=&locationsearch=Spain) | SuccessFactors | Actualizada |
| `successfactors-melia` | [Meliá Hotels International](https://careers.melia.com/go/Profesionales-de-hotel/8861001/) | SuccessFactors | Actualizada |
| `teamtailor-dia` | [DIA](https://empleo.dia.es/jobs) | Teamtailor | Actualizada; 118 publicaciones, 95 con punto |
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

## Actualización autónoma sin Codex

`.github/workflows/daily-offers.yml` prepara una ejecución diaria de GitHub
Actions a las 05:37 de `Europe/Madrid`, más una opción manual en la pestaña
Actions. Captura únicamente los conectores ya activos; acepta `success` o
`partial` si al menos una fuente se actualizó, y rechaza `failed`, un `checkedAt`
antiguo, un catálogo inconsistente o IDs duplicados. Solo después compila,
despliega Hosting y compara por HTTPS el catálogo publicado. Una fuente fallida
conserva su catálogo anterior, como en la ingesta normal.

El workflow no está operativo hasta subirlo a la rama por defecto y configurar
estos secretos en la configuración del repositorio GitHub:

| Secreto | Uso |
|---|---|
| `GEOEMPLEO_GOOGLE_MAPS_API_KEY` | Build estático; sigue siendo una clave pública restringida por referrer y API, nunca una credencial de despliegue |
| `GEOEMPLEO_GOOGLE_MAPS_MAP_ID` | ID de mapa, opcional |
| `FIREBASE_SERVICE_ACCOUNT_GEOEMPLEO_49978` | JSON de cuenta de servicio con permiso de despliegue de Firebase Hosting |

No guardar esos valores en el código ni en archivos del repositorio. La clave
de Maps termina en la configuración pública del navegador y debe mantener sus
restricciones de HTTP referrer. La clave de la cuenta de servicio solo se usa
durante la acción de despliegue. Firebase documenta la integración oficial
con GitHub y la creación/custodia del secreto de servicio. Para repositorios
públicos, los runners estándar de GitHub Actions son gratuitos; en repositorios
privados se aplican los minutos incluidos en el plan y el exceso puede cobrarse.
No activar facturación de Google ni Blaze para esta arquitectura. La
automatización Codex existente se conserva como respaldo hasta que se confirme
una ejecución autónoma correcta.

La captura del 26/10/2026 a las 12:49:43 UTC terminó `partial`: **16 fuentes
actualizadas y 1 fallida (SEF Murcia)**; el catálogo local comprobado tenía
**2.806 publicaciones con ID único**, **2.361 con punto**. DIA aportó 118
publicaciones y 95 puntos municipales aproximados; las 23 restantes siguen en
la lista y no llevan marcador porque su ficha no permite validar una localidad
única. El catálogo está desplegado y verificado por HTTPS con el mismo instante
de captura. Son publicaciones de origen real, no vacantes
deduplicadas entre portales ni una garantía de que las fichas conservadas sigan
abiertas. Las ubicaciones son municipales aproximadas salvo que la fuente
acredite otra precisión. Al investigar un fallo, reparar solo su conector y
repetir la ingesta antes de declarar la fuente actualizada.

Al incorporar una fuente nueva, actualizar `registry.ts`, añadir su adaptador al
runner, probar identidad/URL/fecha/ubicación y fallos de red, verificar una
captura real, **y actualizar este inventario y la automatización diaria**. No
inferir empleos a partir de establecimientos ni colocar puntos arbitrarios.
