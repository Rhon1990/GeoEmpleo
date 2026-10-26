# Referencias territoriales de España

`spain-places.json.gz` es un catálogo local de 55.788 referencias, generado el 15/10/2026: 30.663 lugares poblados de GeoNames, 25.124 referencias postales adicionales y un complemento OpenStreetMap para Coto de San Isidro. No representa 55.788 municipios ni direcciones; puede contener distintos núcleos o aproximaciones postales de un municipio. No es un registro oficial exhaustivo.

Fuentes GeoNames, bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): [dump ES](https://download.geonames.org/export/dump/ES.zip), [provincias](https://download.geonames.org/export/dump/admin2Codes.txt), [códigos postales ES](https://download.geonames.org/export/zip/ES.zip). Documentación: [dump](https://download.geonames.org/export/dump/readme.txt), [postal](https://download.geonames.org/export/zip/readme.txt). El catálogo contiene fecha, URLs y SHA-256 de entradas. Las coordenadas de localidades son puntos de referencia; las postales se identifican con `precision=postal_locality`.

El complemento Coto de San Isidro procede del [nodo 309691474](https://www.openstreetmap.org/node/309691474), © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Sus metadatos y licencia figuran en el registro y en `public/data/places.json`. El código postal municipal se contrastó con la [FEMP](https://www.femp.es/asociados/entidades-locales/ituero-y-lama). Los datos se mantienen disponibles en este repositorio, con atribución visible en la web.

Para regenerar, descargar las tres fuentes, conservar sus ZIP originales y ejecutar desde la raíz:

```sh
python3 apps/web-preview/tools/build-places.py /ruta/ES.zip /ruta/admin2Codes.txt /ruta/postal-ES.zip
```

Usa únicamente Python stdlib. Filtra clase P vigente, país ES y puntos válidos; conserva homónimos, diferencia provincia/municipio y excluye lugares históricos, abandonados o destruidos. Combina códigos postales solo por nombre/alias, provincia y municipio; si no coincide, conserva una referencia postal independiente. No geocodifica ofertas ni modifica la ingesta. El servidor descomprime una vez y conserva el índice en memoria hasta reiniciarse. `/api/places?q` entrega hasta 20 sugerencias; el navegador nunca descarga el catálogo nacional.
