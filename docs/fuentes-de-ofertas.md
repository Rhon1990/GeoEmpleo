# Fuentes de ofertas de GeoEmpleo

Inventario operativo revisado el **28/10/2026**. El registro ejecutable es
[`packages/ingestion/src/registry.ts`](../packages/ingestion/src/registry.ts) y la
lista que recorre la ingesta diaria está en
[`packages/ingestion/src/runner.ts`](../packages/ingestion/src/runner.ts).
Esta página explica esas fuentes; por sí sola no activa ningún portal.

## Conectores diarios activos

El registro tiene ahora 28 identificadores marcados como `active`, con adaptador
en el runner. Covirán, ISS y Accenture están publicados en la web pública. La
columna de ejecución de las demás fuentes recoge capturas históricas. «Actualizada»
y «fallida» describen solo la ejecución indicada, no el estado permanente del portal. Ante un
fallo se conservan las publicaciones anteriores de esa fuente, sin certificar
que sigan abiertas.

| ID de fuente | Portal de origen | Canal | Evidencia de ejecución |
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
| `carrefour-talentforjobs` | [Carrefour](https://www.carrefour.es/trabaja-en-carrefour/envia-tu-curriculum/mas-info/) | TalentForJobs | Captura directa 27/10/2026: 887 publicaciones, 716 con punto municipal |
| `lidl-search-api` | [Lidl España](https://empleo.lidl.es/buscar-empleo) | Buscador oficial JSON | Captura directa 27/10/2026: 259 publicaciones, 224 con punto municipal |
| `talentclue-mcdonalds` | [McDonald's](https://careers.talentclue.com/es/company/6285677f44a78f103ce17087c20ecee7/jsoffers/modal?order=Fecha&sort=asc) | TalentClue | Actualizada |
| `amrest-kfc` | [KFC / AmRest](https://careers.amrest.eu/KFC/go/Jobs-KFC-ES/9158355/) | Portal AmRest | Actualizada |
| `disa-empleo` | [Grupo DISA](https://empleo.disagrupo.es/offer/getofferlistdata) | Portal empresarial | Actualizada |
| `talentclue-quironsalud` | [Quirónsalud](https://empleo.quironsalud.es/) | TalentClue | Captura directa: 263 publicaciones, 260 con punto |
| `selectminds-eulen` | [Grupo Eulen](https://eulen.referrals.selectminds.com/grupoeulenespana/latest-jobs) | SelectMinds | Captura directa: 9 publicaciones, 8 con punto |
| `randstad-oficial` | [Randstad](https://www.randstad.es/candidatos/ofertas-empleo/) | API pública del portal oficial | La captura recorre y valida todas las páginas anunciadas; publica fichas con provincia española y ubicación municipal solo si se resuelve |
| `successfactors-clece` | [Clece](https://canaldeempleo.es/CLECE) | SuccessFactors | Captura directa: 355 publicaciones, 335 con punto |
| `bizneo-domusvi` | [DomusVi](https://empleo.domusvi.es/jobs) | Tablón Bizneo | Captura directa: 340 publicaciones, 280 con punto |
| `successfactors-indra` | [Indra](https://careers.indragroup.com/) | SuccessFactors | Publicación 27/10/2026: 562 publicaciones, 437 con punto |
| `bizneo-coviran` | [Covirán](https://jobs.coviran.com/jobs) | Tablón Bizneo | Captura directa 28/10/2026: 6 vacantes concretas, 6 con punto; autocandidaturas excluidas |
| `bizneo-iss` | [ISS Facility Services](https://jobs.iss.es/jobs) | Tablón Bizneo | Captura directa 28/10/2026: 13 vacantes, 9 con punto |
| `workday-accenture` | [Accenture](https://www.accenture.com/es-es/careers/jobsearch) | Workday oficial | Publicación 28/10/2026: 274 fichas españolas, 131 con punto; país validado por ficha |

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
| Unide | Los enlaces aportados son búsquedas por palabra clave en InfoJobs | Encontrar catálogo oficial público con ID, vigencia y localidad |
| Farmacia | Es un sector, no una empresa canónica | Integrar fuentes verificables del sector sin atribuir una marca ficticia |
| Lupa Supermercados | [Portal oficial](https://lupa.epreselec.com/Ofertas/Ofertas.aspx) devuelve HTTP 405 y una verificación interactiva a la captura programada | Obtener un canal permitido y estable, sin eludir la verificación |
| Mercadona | Portal Avature oficial comprobado; mezcla España y Portugal y expone 384 resultados en páginas de seis | Aplicar un filtro de país verificable y validar cada ficha antes de activar |
| Inditex | El [portal oficial](https://www.inditexpeople.com/es/es/joinus/offers) bloquea la captura automatizada con HTTP 403 | Conseguir un canal público autorizado y estable |
| SEUR | Sin conector oficial verificable | Conseguir un canal público autorizado y estable |
| NTT DATA | El [portal oficial](https://careers.emeal.nttdata.com/s/?language=es) muestra 32 resultados al filtrar España en navegador; su página es dinámica y aún no hay un canal de captura diario verificado | Validar un endpoint público estable y fichas con localidad española |
| Elecnor | Los enlaces aportados son búsquedas por palabra clave en InfoJobs | Encontrar el portal oficial y validar ubicación laboral |

Otros portales y empresas solicitados se documentan en la
[auditoría nacional](planning/2026-10-19-ampliacion-nacional-fuentes.md) y el
[diseño de portales empresariales](superpowers/specs/2026-10-26-portales-empresariales-oficiales-design.md).
Que una empresa tenga sedes o un portal público no crea una oferta en GeoEmpleo.
Mercadona, Repsol, Moeve, BP, Galp, InfoJobs y LinkedIn siguen sin conector
activo verificado.

La ejecución de GitHub Actions [`40658043000`](https://github.com/Rhon1990/GeoEmpleo/actions/runs/40658043000),
terminada el 28/10/2026, actualizó las 28 fuentes con estado `success` y publicó
6.145 ofertas con 6.145 IDs únicos. Covirán aportó 6 ofertas (6 puntos), ISS 13
(9 puntos) y Accenture 274 (131 puntos). El catálogo público se contrastó por HTTPS
con el mismo `checkedAt=2026-10-28T08:36:59.596Z`. De la lista de empresas aportada por el usuario están activas
Randstad, Quirónsalud, Vithas, DomusVi, Indra, Capgemini, Grupo Eulen, Clece, Covirán, Accenture e ISS.
Las demás permanecen en esta tabla hasta disponer de un canal oficial,
autorizado y estable; los enlaces de búsqueda de InfoJobs se conservan como
referencia de descubrimiento, pero no se extraen ni se republican.

### Matriz de empresas solicitadas y referencias de descubrimiento

| Empresa o búsqueda solicitada | Referencia aportada | Estado en GeoEmpleo |
|---|---|---|
| Randstad | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=RANDSTAD&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial |
| Unide | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=unide&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Pendiente de canal oficial verificable |
| Covirán | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=coviran&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial Bizneo |
| Farmacia | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=farmacia&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Pendiente; es una categoría, no una empresa |
| Lupa Supermercados | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=lupa&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Pendiente de canal oficial verificable |
| Mercadona | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=mercadona&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Pendiente de filtro España fiable en el portal oficial |
| Inditex | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=inditex&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Pendiente; el portal oficial bloquea la captura automatizada |
| SEUR | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=SEUR&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Pendiente de canal oficial verificable |
| Quirónsalud | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=Quir%C3%B3nsalud&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial |
| Vithas | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=Vithas&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial |
| DomusVi | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=DomusVi&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial |
| Indra | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=Indra&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial |
| NTT DATA | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=NTT%20DATA&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Pendiente de conector oficial estable |
| Accenture | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=Accenture&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante Workday oficial |
| Capgemini | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=Capgemini&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial |
| Grupo Eulen | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=Grupo%20Eulen&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial |
| ISS | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=ISS&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial Bizneo |
| Clece | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=Clece&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Activa mediante portal oficial |
| Elecnor | [Búsqueda en InfoJobs](https://www.infojobs.net/ofertas-trabajo/bp?keyword=Elecnor&referer=search-filtered&page=1&sortBy=RELEVANCE&onlyForeignCountry=false&sinceDate=ANY) | Pendiente de conector oficial estable |

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
   conserva `checkedAt`, cantidad e IDs únicos. GitHub Actions ejecuta este
   flujo sin depender del equipo local ni de Codex; Firebase Hosting Spark no
   ejecuta la ingesta por sí solo.

## Actualización autónoma sin Codex

Google Apps Script actúa como vigilante externo principal: cada 15 minutos,
entre las 05:00 y las 12:00 de `Europe/Madrid`, comprueba el `checkedAt` público
y, si el catálogo aún no es del día, ejecuta `daily-offers.yml` en `main`. Un
enfriamiento de 60 minutos evita disparos duplicados. El workflow conserva como
respaldo sus horarios de las 05:37, 07:37 y 09:37, más la opción manual de la
pestaña Actions. La configuración y revocación están documentadas en
[`infra/apps-script-daily-refresh`](../infra/apps-script-daily-refresh/README.md).

El workflow captura únicamente los conectores ya activos; acepta `success` o
`partial` si al menos una fuente se actualizó, y rechaza `failed`, un `checkedAt`
antiguo, un catálogo inconsistente o IDs duplicados. Solo después compila,
despliega Hosting y compara por HTTPS el catálogo publicado. Una fuente fallida
conserva su catálogo anterior, como en la ingesta normal.

El workflow está operativo en `main`. Los dos secretos obligatorios están
configurados en el repositorio y la ejecución `40658043000` confirmó captura,
build, despliegue y validación HTTPS. El ID del mapa es opcional;
`GITHUB_TOKEN` lo proporciona automáticamente GitHub:

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
No activar facturación de Google ni Blaze para esta arquitectura. Apps Script
usa sus cuotas gratuitas y GitHub Actions ejecuta la captura y el despliegue;
ninguno depende de Codex ni de un ordenador encendido.

La prueba automática [`41026123338`](https://github.com/Rhon1990/GeoEmpleo/actions/runs/41026123338)
fue iniciada por Apps Script el 30/10/2026 a las 09:23 Europe/Madrid. Capturó,
compiló y desplegó **12.553 publicaciones con 12.553 IDs únicos** y
`checkedAt=2026-10-30T08:23:46.918Z`; ambos dominios públicos sirvieron después
ese mismo catálogo. La acción quedó marcada como fallida porque la primera
lectura HTTPS recibió temporalmente el catálogo anterior desde caché. La
validación final ahora reintenta seis veces, con diez segundos entre intentos,
antes de declarar un fallo de publicación.

La captura del 28/10/2026 a las 08:36:59 UTC terminó `success`: **28 fuentes
actualizadas**, **6.145 publicaciones con ID único**. El catálogo está desplegado
y verificado por HTTPS con el mismo instante de captura. Son publicaciones de origen real, no vacantes
deduplicadas entre portales ni una garantía de que las fichas conservadas sigan
abiertas. Las ubicaciones son municipales aproximadas salvo que la fuente
acredite otra precisión. Al investigar un fallo, reparar solo su conector y
repetir la ingesta antes de declarar la fuente actualizada.

Al incorporar una fuente nueva, actualizar `registry.ts`, añadir su adaptador al
runner, probar identidad/URL/fecha/ubicación y fallos de red, verificar una
captura real, **y actualizar este inventario y la automatización diaria**. El
workflow llama al runner que recorre el registro; una fuente integrada en el
runner entra en las capturas programadas sin una lista adicional en el workflow. No inferir empleos a partir de
establecimientos ni colocar puntos arbitrarios.

### Verificación de Carrefour y Lidl — 27/10/2026

Las capturas de solo lectura desde sus portales oficiales devolvieron 887 ofertas
de Carrefour y 259 de Lidl, con IDs únicos por fuente. El gazetteer nacional
reconoció 716 y 224 localidades, respectivamente, para el mapa. GeoEmpleo
conserva el texto de zona que publica cada tarjeta; si el dato es regional,
ambiguo o no coincide con una localidad única, la oferta permanece sin marcador
municipal. En Carrefour, los filtros del formulario son multiselección: el
postback del paginador ya no envía sus primeras opciones como filtros
seleccionados. Estas cifras son una captura de prueba, no un resultado de la
ingesta pública diaria ni una garantía de vigencia futura.
