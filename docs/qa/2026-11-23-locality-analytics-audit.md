# Auditoría de filtros, mapa y analítica — 23/11/2026

## Dictamen

**APTO para integrar la interfaz; publicación condicionada al flujo que preserva el catálogo vigente.** No se encontraron bloqueos funcionales en los recorridos comprobados. No equivale a una certificación de todos los navegadores, enlaces externos o datos de las fuentes.

Rama `codex/locality-search-ux`, trabajo sin commit sobre `4938e10`. `origin/main` actualizado mediante fetch: `66b8571`; la rama contiene ese main y un commit posterior de documentación. Los cambios funcionales pendientes están en el árbol de trabajo y deben incluir los módulos y pruebas nuevos; `node_modules` no forma parte de la entrega.

No se ha publicado ni modificado producción durante esta auditoría.

## Analítica actualizada

Se reutiliza `createAnalyticsController`, su consentimiento y validación de parámetros. No se añade otro SDK ni persistencia de ubicaciones.

| Interacción | Evento | Parámetro permitido |
| --- | --- | --- |
| Selección de comunidad, provincia o localidad | `filter_used` | `filter_type`: `community`, `province`, `locality` |
| Confirmar distancia | `filter_used` existente | `filter_type`: `distance` |
| Abrir ubicación, distancia, filtros compactos o favoritos | `ui_action` | `action`: `open_location_filter`, `open_distance_filter`, `open_mobile_filters`, `open_favorites` |
| Activar/desactivar ofertas del día | `ui_action` | `action`: `show_today_offers`, `hide_today_offers` |
| Limpiar criterios | `ui_action` | `action`: `clear_filters` |
| Alternar explícitamente entre mapa y ofertas | `ui_action` | `action`: `show_map_view`, `show_offers_view` |

No se envían nombres de lugares, coordenadas, consultas ni kilómetros concretos. Antes del consentimiento y después de rechazar no se emiten eventos. Los valores desconocidos y parámetros adicionales se rechazan. Firebase Analytics continúa desactivado en localhost.

Archivos modificados para esta ampliación: `apps/web-preview/public/analytics.mjs`, `apps/web-preview/public/app.mjs`, `apps/web-preview/public/index.html` (versión del módulo), `tests/web-analytics.test.ts` y `docs/project-context.md`. Se conserva el trabajo previo de localidades, mapa y diseño adaptable.

## Evidencia automatizada del 23/11

- TypeScript: correcto.
- Node: **600 pruebas aprobadas, 0 fallos**, incluidas 12 de analítica.
- OpenAPI: coincide con los esquemas versionados.
- Python: **76 fixtures correctas**. El primer intento detectó que faltaba `.venv`; se instalaron las versiones fijadas en un entorno temporal y se ejecutó `GEOEMPLEO_PYTHON=/private/tmp/geoempleo-qa-python/bin/python npm run test:contracts:python` correctamente.
- Construcción estática: correcta; 55.788 referencias geográficas y 1.988 archivos de consulta.
- `git diff --check`: correcto.

Las pruebas cubren normalización sin tildes, orden y agrupación de sugerencias, jerarquía territorial, filtros/mapa, entrega estática, estado de distancia/limpieza y consentimiento. Las pruebas de SDK usan un doble de prueba; no prueban recepción real en GA4.

## Recorridos manuales en Chrome

Pruebas locales realizadas en esta auditoría entre el 19 y el 23/11. Las pruebas de distancia y ofertas del día se revalidaron el 23/11.

| Área | Recorrido y resultado |
| --- | --- |
| Arranque | Mapa con puntos y catálogo visibles en `http://127.0.0.1:4310/`; restaurado al finalizar |
| Búsqueda | Empresa con buscador, área, texto sin coincidencias y limpieza recuperan resultados |
| Ubicación | Comunidad y provincia encuadran su ámbito; localidad seleccionable; Coslada aparece agrupada con sus códigos postales |
| Distancia | 0/sin límite, 1, 25, 30, 99 y 100 km; entrada 150 ajustada a 100; flechas del teclado, Escape, cierre/reapertura y edición posterior a limpiar correctos |
| Disponibilidad | Distancia oculta con comunidad/provincia; disponible con localidad, punto del mapa o referencia del dispositivo |
| Limpieza | Restablece búsqueda, empresa, área, zona manual, radio y selección diaria; conserva la referencia automática del dispositivo según diseño |
| Ofertas del día | En build estático con tres fechas simuladas: muestra tres resultados en escritorio; en móvil muestra los dos situados dentro del encuadre visible; mapa y lista coinciden; activar/desactivar conserva la vista móvil; limpiar elimina la selección |
| Mapa | Elegir zona, actualizar área, vista España, puntos individuales y apertura del detalle comprobados |
| Ofertas | Detalle y cierre; añadir/quitar favorito; diálogo de guardados; enlaces de origen/ubicación inspeccionados; compartir ofrece alternativa de copia cuando el navegador no permite el portapapeles |
| Navegación | Acerca de, preferencias de privacidad y atribuciones comprobados; rechazo de analítica cierra el panel |
| Móvil | Filtros plegables, cambio mapa/lista con radio conservado y carrusel anterior/siguiente correctos |
| Tamaños | 390×844, 768×1024, 1366×768 y 1440×900 sin desbordamiento horizontal observado; filtros compactos disponibles en pantallas pequeñas |

El ensayo diario solo cambió tres fechas en memoria en un servidor temporal, identificado como QA. No modificó archivos del catálogo ni producción. El servidor de ensayo se detuvo y se restauró el servidor normal.

## Incidencias de entorno resueltas y límites

1. **Configuración local del mapa.** El worktree no contiene `.env.local`: se arranca con `GEOEMPLEO_ENV_FILE` apuntando al archivo existente del proyecto principal. La prueba temporal en 4311 recibió `RefererNotAllowedMapError`; al usar el puerto autorizado 4310 el mapa cargó. No se cambiaron permisos ni restricciones de la clave. No se observaron errores nuevos de consola en el recorrido del puerto autorizado.
2. **Catálogo local antiguo.** Tiene 2.806 ofertas, comprobadas el 26/10/2026. El build local sirve para QA y **no debe publicarse directamente**. Usar `.github/workflows/deploy-ui.yml` desde main: recupera el catálogo público, exige coincidencia con ambos dominios antes de publicar y verifica el resultado. Ese workflow se revisó, pero no se ejecutó en esta auditoría.
3. **Analítica en producción pendiente.** Tras desplegar, aceptar analítica y verificar en GA4 DebugView/Tiempo real `ui_action` y los tres nuevos `filter_type`; comprobar también que rechazar/revocar detiene la colección. No se ha accedido al panel privado ni cambiado dimensiones/informes de GA4.
4. **Cobertura acotada.** Se comprobaron los recorridos principales de la web y las funciones modificadas. No se visitó cada enlace de cada oferta ni se enviaron solicitudes a empresas. Safari/Firefox, dispositivos físicos, permisos de ubicación recién concedidos y todos los controles nativos de Google Maps no tienen validación manual completa. El formulario local de publicación no se envió; la compilación pública estática lo excluye.

## Secuencia de publicación

Integrar los cambios revisados y módulos nuevos, ejecutar CI, publicar mediante `deploy-ui.yml` preservando el catálogo y verificar por HTTPS mapa, jerarquía, distancia y recepción de eventos con consentimiento. El dictamen se refiere a esta revisión; nuevos cambios requieren comprobaciones proporcionales.
