# Retención con mapa prioritario en móvil — plan de implementación

**Objetivo:** Mostrar el mapa y una oferta en la primera pantalla móvil, dar continuidad a la búsqueda en ambos dispositivos y medir la salida al origen.

**Arquitectura:** Reutilizar la búsqueda, el mapa, las tarjetas y la analítica opt-in existentes. Guardar únicamente filtros públicos y metadatos mínimos de ofertas en `localStorage`. Mantener las dos columnas y los filtros visibles de escritorio.

## Cambios de código

1. Iniciar móvil en «Mapa», plegar filtros secundarios y compactar mapa y primera tarjeta. Mantener «Mapa/Ofertas» y el fallback de lista.
2. Incorporar en móvil y escritorio Guardar, Guardados, Compartir y el filtro de publicaciones o detecciones desde la última visita. No exigir cuenta ni guardar GPS.
3. Agrupar visualmente solo anuncios consecutivos aparentemente equivalentes en la lista móvil; conservar cada oferta y enlace. Advertir antigüedad y distinguir catálogo y zona visible.
4. Registrar `offer_original_clicked`, búsquedas sin resultados y reaperturas de guardados solo tras consentimiento. No enviar texto libre ni ubicación precisa.

## Validación y límites

- Probar lógica de guardados, URLs, agrupación, analítica, estructura HTML/CSS, routing y fechas; ejecutar `npm run check`, build estático y `git diff --check`.
- Revisar visualmente 390 px y 1440 px: primera oferta, mapa, filtros, búsqueda, guardados y desbordamiento.
- Para producción: integrar esta rama sin sustituir el catálogo vivo por el snapshot local del 26/10, verificar HTTPS y recepción de eventos, marcar `offer_original_clicked` como evento clave y configurar cohortes D1/D7/D30.
- La medición individual por oferta y la exclusión de tráfico propio precisan una decisión adicional de cardinalidad/identidad e instrumentación en GA4. No se atribuirán esas capacidades a la entrega local.

## Publicación de interfaz sin pérdida de ofertas

**Archivos:** `tools/validate-daily-catalog.mjs`, `tests/daily-catalog-validation.test.ts`, `.github/workflows/deploy-ui.yml`, `tests/ui-workflow-publication.test.ts`, `docs/project-context.md`.

1. Añadir una prueba que rechace un catálogo candidato distinto al público, incluidos IDs perdidos, cambios de ficha y `checkedAt`; comprobar el fallo esperado.
2. Añadir una comparación estricta reutilizable al validador existente y una opción CLI para cotejar un archivo contra HTTPS. Ejecutar la prueba dirigida.
3. Añadir una prueba que exija recuperación del catálogo publicado, verificación de ambos dominios, ausencia de ingesta, grupo de concurrencia compartido y despliegue solo tras las comprobaciones; comprobar el fallo esperado.
4. Crear el workflow manual de interfaz con la misma configuración de Hosting y verificación posterior. Ejecutar la prueba dirigida.
5. Actualizar el contexto funcional. Ejecutar `npm run check`, build estático, `git diff --check` y verificar que el candidato local antiguo es rechazado frente al sitio público.
