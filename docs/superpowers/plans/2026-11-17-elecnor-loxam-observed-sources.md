# Plan final de entrega de Elecnor

Este plan sustituye el alcance inicial Elecnor/Loxam en LinkedIn según la prioridad posterior del usuario: publicar las 76 fichas oficiales de Elecnor, su logo y su inclusión en el proceso diario.

- [x] Registrar `elecnor-oficial` como `observed_listing` e incluirla en el ejecutor diario predeterminado.
- [x] Validar la instantánea completa, IDs únicos, fechas y vigencia máxima de 14 días.
- [x] Conservar la hora real de revisión y retirar exclusivamente esta fuente tras caducar.
- [x] Añadir logo oficial local y corregir rutas de prueba.
- [x] Suprimir puntos de ubicaciones ambiguas, múltiples, itinerantes, nacionales o internacionales mediante notas observadas.
- [x] Documentar que HTTP 405 impide descubrir automáticamente nuevas vacantes; Loxam sigue pendiente.
- [ ] Ejecutar suite completa, tipos, contratos y build.
- [ ] Revisar diff y publicar PR a main sin incluir el catálogo local de prueba.
- [ ] Integrar y ejecutar el workflow diario desde main, recuperando primero el catálogo público vigente.
- [ ] Verificar fuente Elecnor, 76 IDs, geografía, logo y presentación HTTPS.

No cambiar el cron ni los conectores ajenos. No presentar la lectura del archivo observado como captura automática del portal. No incluir `apps/web-preview/public/data/calls.json` en el commit.
