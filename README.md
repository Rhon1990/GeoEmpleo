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

La biblioteca no requiere cuentas. La web consulta datos reales del BOE, SEF Murcia, ECYL Castilla y León, Lanbide y Junta de Andalucía, con búsqueda, filtros, detalle, proximidad y Google Maps. La clave web restringida está en `.env.local` y no se publica en Git. Cuatro conectores oficiales se ejecutan en la ingesta diaria; faltan persistencia canónica, índice nacional y control distribuido de consumo para escalar.

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

Abrir `http://127.0.0.1:4310`. La captura completa del 24/10/2026 contiene 1.797 publicaciones reales y 1.686 con punto municipal. La selección BOE permanece estática y su inscripción vigente no se infiere. No hay datos de muestra en la página. Los totales cambian con cada actualización y pueden incluir publicaciones distintas de una misma vacante.

Al abrir, se solicita una posición del navegador para centrar el mapa; si falla, puedes elegir localidad o zona manualmente. Al terminar cada movimiento se consultan solo las ofertas del área visible, con debounce/cancelación y hasta 300 resúmenes. El detalle completo se pide al abrirlo. El radio adicional se aplica en el navegador. El origen no se guarda ni se añade a la URL; el servidor recibe el área visible y Google recibe el centro/área para dibujar el mapa. Los puntos de ofertas son municipales aproximados.

«Tu localidad de referencia» busca entre 55.788 referencias de toda España, incluidos pueblos y códigos postales. Entrega hasta 20 sugerencias y distingue homónimos por municipio/provincia. Elige una sugerencia o confirma un nombre único para centrar el mapa. «Volver a mi ubicación» regresa al último origen detectado o elegido, sin pedir otro permiso. El [catálogo territorial y sus fuentes](apps/web-preview/data/README.md) no es un registro oficial exhaustivo ni implica cobertura de empleo en cada localidad.

[Configurar Google Maps](docs/architecture/2026-10-14-google-maps-local.md): copiar `.env.example` a `.env.local` si aún no existe y completar la clave en el archivo, nunca en el chat. En este equipo ya está configurada. El servidor lee esa configuración al iniciar el mapa. El SDK carga al abrir la página si existe clave; una instancia Map se reutiliza al filtrar, moverse y regresar al origen. Sin clave hay un estado de configuración pendiente, no un mapa ficticio. Este prototipo no implementa todavía el control de presupuesto de producción.

## Actualización diaria gratuita de fuentes

```sh
npm run ingest:daily
```

El runner obtiene las ofertas del [SEF Murcia](https://sefapps.carm.es/sefApps/rest/ofertas/ofertas), [ECYL](https://analisis.datosabiertos.jcyl.es/explore/dataset/ofertas-de-empleo/), [Lanbide](https://opendata.euskadi.eus/catalogo/-/ofertas-de-empleo-de-lanbide/) y [Junta de Andalucía](https://www.juntadeandalucia.es/datosabiertos/portal/dataset/ofertas-de-empleo-de-entidades-instrumentales). Respeta las condiciones de cada fuente y muestra atribución. Conserva IDs, texto publicado, fechas y procedencia; no inventa empresa, salario, plazas ni coordenadas. Algunos textos de ECYL son breves remisiones a la Oficina Virtual: los requisitos completos se consultan en el origen. No se promete cobertura de todos los portales ni fichas completas para todas las publicaciones.

Cada fuente se valida y reconcilia por separado y el JSON público se publica una sola vez, atómicamente. Un fallo conserva los datos de esa fuente. El informe `var/ingestion/latest.json` distingue `success`, `partial` y `failed`; el CLI devuelve código 1 en los dos últimos casos, aunque `partial` sí publica las fuentes correctas. ECYL/Lanbide solo incorporan publicaciones de los últimos 30 días; una ausencia se conserva hasta siete días desde su última observación. Murcia conserva su política de caducidad declarada. Se rechazan capturas vacías, IDs/URLs incoherentes y ubicaciones inválidas; las ubicaciones no resolubles quedan nulas.

La captura del 24/10/2026 terminó `success` para las cuatro fuentes; el JSON resultante tiene IDs únicos. Las publicaciones sin punto se excluyen del radio/viewport. Google Maps se comprobó con ofertas de Riaza y detalle desde el marcador. Los puntos son aproximados, nunca direcciones laborales verificadas.

La tarea diaria de este chat está activa sobre el worktree `web-preview`. Requiere este equipo encendido, la aplicación abierta y red; no es un servicio 24/7. Usa reglas deterministas y no una API de IA de pago. Adzuna está pausado porque el acceso completo requiere tarjeta/suscripción; InfoJobs y LinkedIn no están conectados. No se activan servicios de pago automáticamente.

En un worktree, se puede reutilizar la configuración Maps ya existente sin copiar claves: `GEOEMPLEO_ENV_FILE=/ruta/al/.env.local npm run dev:web`. El control de coste de Maps sigue descrito en su documento: esta ingesta gratuita no garantiza coste cero de Maps en producción.

## Publicación estática en Firebase Hosting Spark

El build estático usa el catálogo validado y genera consultas de lectura y localidades en el navegador. No requiere Functions, Firestore ni cuenta de visitante. El formulario de ofertas directas sigue siendo solo local hasta disponer de moderación y almacenamiento productivos; la versión pública no ofrece un formulario sin backend.

```sh
GEOEMPLEO_ENV_FILE=/ruta/segura/.env.local npm run build:web:static
firebase deploy --only hosting --project geoempleo-49978
```

`firebase.json` publica `var/public-site/` (ignorado por Git); `config.json` se genera con la clave **pública de navegador** restringida en Google Cloud a Maps JavaScript API y a los orígenes autorizados. Para publicar en cualquier dominio futuro no hace falta cambiar la aplicación: añade el dominio HTTPS concreto a las restricciones de esa clave, asocia el dominio en Firebase Hosting y vuelve a desplegar. No retires la restricción de sitios web, porque terceros podrían consumir la cuota de Maps. El plan Spark no exige tarjeta para este Hosting, pero tiene límites de transferencia; Google Maps pertenece a otro proyecto con prueba gratuita y su cuota no está garantizada por Spark.
