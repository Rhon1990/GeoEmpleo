# GeoEmpleo

Plataforma pública de descubrimiento de empleo para España, en español y sin registro ni cuentas de candidatos. La vista local utiliza Google Maps.

## Desarrollo local

Requisitos: Node.js 24 o superior, npm y Python 3.9 o superior. Preparación en macOS/Linux:

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r packages/contracts/python/requirements.txt
npm run check
```

`npm run check` comprueba tipos, pruebas Node, sincronización OpenAPI y el corpus compartido en Python. Comandos individuales: `npm run typecheck`, `npm test`, `npm run check:openapi` y `npm run test:contracts:python`. En Windows, preparar el venv con `python -m venv .venv` e instalar mediante `.venv\Scripts\python.exe -m pip install -r packages/contracts/python/requirements.txt`; el runner detecta esa ruta. `GEOEMPLEO_PYTHON` permite seleccionar otro intérprete aislado.

La primera biblioteca contiene contratos y registro de políticas de país, normalización de salarios españoles con datos explícitos y elegibilidad de publicación según permiso, contenido, estado y caducidad. El núcleo no depende de frameworks ni servicios cloud.

El paquete [contracts](packages/contracts/README.md) añade seis contratos JSON Schema 2020-12, validadores TypeScript/Python y una descripción OpenAPI 3.1 de búsqueda, detalle y mapa sin autenticación. Validar transporte no sustituye las reglas de negocio ni permite publicar automáticamente datos de una fuente.

La biblioteca no requiere cuentas ni fuentes externas. Existe una primera web local con datos reales del BOE, SEF Murcia, ECYL Castilla y León y Lanbide, búsqueda, filtros, detalle, proximidad y Google Maps con agrupación según zoom. El entorno local del titular tiene una clave web restringida en `.env.local`; la suite no depende de ella. Existe ingesta diaria de las tres fuentes abiertas y API local de lectura acotada; faltan persistencia canónica, índice nacional y control distribuido de consumo para producción.

## Documentación

- [Contexto del proyecto](docs/project-context.md).
- [Arquitectura](docs/architecture/2026-10-14-geoempleo-arquitectura.md).
- [Backlog técnico](docs/planning/2026-10-14-backlog-tecnico.md).
- [Plan de la primera iteración](docs/superpowers/plans/2026-10-14-contratos-dominio.md).
- [Contratos v1](docs/superpowers/plans/2026-10-14-contratos-v1.md).
- [Google Maps y control de coste](docs/architecture/2026-10-14-google-maps-coste.md).

## Ver la web local

```sh
npm run dev:web
```

Abrir `http://127.0.0.1:4310`. El catálogo verificado el 16/10/2026 contiene 1.429 publicaciones reales: 570 ECYL, 631 Lanbide, 224 SEF Murcia y cuatro convocatorias BOE (9 plazas) consultadas el 14/10. Hay 1.348 publicaciones con punto municipal. La selección BOE permanece estática y su inscripción vigente no se infiere. No hay datos de muestra en la página. Los totales cambian con cada actualización y pueden incluir publicaciones distintas de una misma vacante.

Al abrir, se solicita una posición del navegador para centrar el mapa; si falla, puedes elegir localidad o zona manualmente. Al terminar cada movimiento se consultan solo las ofertas del área visible, con debounce/cancelación y hasta 300 resúmenes. El detalle completo se pide al abrirlo. El radio adicional se aplica en el navegador. El origen no se guarda ni se añade a la URL; el servidor recibe el área visible y Google recibe el centro/área para dibujar el mapa. Los puntos de ofertas son municipales aproximados.

«Tu localidad de referencia» busca entre 55.788 referencias de toda España, incluidos pueblos y códigos postales. Entrega hasta 20 sugerencias y distingue homónimos por municipio/provincia. Elige una sugerencia o confirma un nombre único para centrar el mapa. «Volver a mi ubicación» regresa al último origen detectado o elegido, sin pedir otro permiso. El [catálogo territorial y sus fuentes](apps/web-preview/data/README.md) no es un registro oficial exhaustivo ni implica cobertura de empleo en cada localidad.

[Configurar Google Maps](docs/architecture/2026-10-14-google-maps-local.md): copiar `.env.example` a `.env.local` si aún no existe y completar la clave en el archivo, nunca en el chat. En este equipo ya está configurada. El servidor lee esa configuración al iniciar el mapa. El SDK carga al abrir la página si existe clave; una instancia Map se reutiliza al filtrar, moverse y regresar al origen. Sin clave hay un estado de configuración pendiente, no un mapa ficticio. Este prototipo no implementa todavía el control de presupuesto de producción.

## Actualización diaria gratuita de fuentes

```sh
npm run ingest:daily
```

El runner obtiene las ofertas del [SEF Murcia](https://sefapps.carm.es/sefApps/rest/ofertas/ofertas), [ECYL](https://analisis.datosabiertos.jcyl.es/explore/dataset/ofertas-de-empleo/) y [Lanbide](https://opendata.euskadi.eus/catalogo/-/ofertas-de-empleo-de-lanbide/). Usa las [condiciones SEF](https://datosabiertos.regiondemurcia.es/avisolegal) y CC BY 4.0 para ECYL/Lanbide, con atribución visible. Conserva IDs, texto publicado, fechas y procedencia; no inventa empresa, salario, plazas ni coordenadas. Algunos textos de ECYL son breves remisiones a la Oficina Virtual: los requisitos completos no están enriquecidos y se consultan en el origen. No se promete cobertura de todos los portales ni fichas completas para todas las publicaciones.

Cada fuente se valida y reconcilia por separado y el JSON público se publica una sola vez, atómicamente. Un fallo conserva los datos de esa fuente. El informe `var/ingestion/latest.json` distingue `success`, `partial` y `failed`; el CLI devuelve código 1 en los dos últimos casos, aunque `partial` sí publica las fuentes correctas. ECYL/Lanbide solo incorporan publicaciones de los últimos 30 días; una ausencia se conserva hasta siete días desde su última observación. Murcia conserva su política de caducidad declarada. Se rechazan capturas vacías, IDs/URLs incoherentes y ubicaciones inválidas; las ubicaciones no resolubles quedan nulas.

Se verificaron una captura completa y repeticiones parciales sin IDs duplicados: en la última, ECYL y Lanbide se actualizaron y Murcia devolvió contenido no JSON, conservándose sus datos anteriores. De las 1.429 publicaciones, 81 sin punto están disponibles en la lista de respaldo; se excluyen del radio/viewport. Segovia tiene 44 publicaciones, 42 con punto, en 22 localidades. Google Maps se comprobó con tres ofertas de Riaza y detalle desde el marcador. Los puntos son aproximados, nunca direcciones laborales verificadas.

La tarea diaria de este chat está activa a las 05:30 Europe/Madrid sobre el worktree `web-preview`; su instrucción se actualizó para las tres fuentes y avisa ante fallos. Requiere este equipo encendido, la aplicación abierta y red. Las capturas multifuente verificadas son manuales; aún no se observó un ciclo programado con las tres fuentes. Usa reglas deterministas y no una API de IA de pago. Adzuna está pausado porque el acceso completo requiere tarjeta/suscripción; InfoJobs y LinkedIn no están conectados. No se activan servicios de pago automáticamente.

En un worktree, se puede reutilizar la configuración Maps ya existente sin copiar claves: `GEOEMPLEO_ENV_FILE=/ruta/al/.env.local npm run dev:web`. El control de coste de Maps sigue descrito en su documento: esta ingesta gratuita no garantiza coste cero de Maps en producción.
