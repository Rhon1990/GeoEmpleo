# Publicación directa y retirada por el autor

Estado: requisitos confirmados; diseño propuesto para revisión. No implementado.

## Decisiones confirmadas

- Formulario para crear ofertas con empresa, puesto, descripción, contactos, salario y ubicación elegida sobre el mapa.
- Revisión antes de aparecer en el catálogo público, elegida por el usuario.
- El autor puede dar de baja su oferta cuando ya no necesite contratar.
- Búsqueda, mapa y detalle públicos sin registro. Mantener la identidad visual existente.
- No activar facturación ni servicios de pago. Firebase está autorizado si es necesario, pero no está configurado para este flujo.

## Acceso del autor

Recomendación: enlace privado de gestión por oferta, mostrado al terminar el envío, con opción de copiarlo y advertencia de guardarlo. Permite gestionar desde otro dispositivo sin cuentas. Quien posea el enlace podrá retirar esa oferta; no acredita por sí solo la identidad del empleador.

Alternativa: enviar un enlace de acceso al correo verificado. Facilita recuperar acceso, pero exige configurar entrega de correo y controles contra abuso; no se presupone un proveedor disponible. Las cuentas permanentes añaden fricción y no se proponen para esta primera versión.

No prometer envío de correo ni recuperación automática mientras no estén implementados. El correo de gestión es privado y distinto de los contactos que el anunciante acepta publicar. Si se pierde el enlace, la recuperación requiere intervención del operador y comprobación de titularidad.

## Formulario y datos

Reutilizar estilos, buscador nacional de localidades y adaptador Google Maps existentes. Seleccionar localidad y ajustar manualmente un marcador al centro de trabajo, confirmándolo antes del envío. Si el mapa no está disponible, conservar el borrador y explicar que falta confirmar la ubicación; no inventar coordenadas.

Salario: importe fijo o rango, EUR, hora/mes/año, bruto/neto y número de pagas cuando corresponda. Permitir no publicar salario con estado explícito. Reutilizar los contratos de remuneración existentes, sin anualizar con datos insuficientes. Validar mínimo no superior al máximo y cantidades positivas.

Guardar ubicación como punto declarado por el anunciante, con procedencia y precisión diferenciadas de los centroides municipales de las fuentes externas. Un marcador declarado no equivale a una dirección verificada por GeoEmpleo.

Separar contenido público, correo privado de gestión y credencial de gestión. No introducir claves privadas en respuestas de catálogo ni en datos públicos. Requerir consentimiento para publicar los contactos elegidos y autorización para publicar el contenido.

## Estados y retirada

- Envío válido → `pending_review`, ausente del mapa y los resultados.
- Aprobación por operador autorizado → `published`.
- Rechazo → `rejected`, ausente del catálogo.
- Retirada por autor desde pendiente o publicada → `withdrawn`, con fecha y motivo opcional.
- Repetir una retirada válida es idempotente.
- Una oferta retirada no puede aprobarse mediante una revisión obsoleta ni reactivarse desde la ingesta diaria.

El enlace abre una pantalla con el estado y un botón «Dar de baja la oferta», seguido de confirmación. Abrir el enlace nunca modifica datos: la retirada requiere una petición de escritura explícita. Tras confirmar, la API excluye la oferta de nuevas consultas y el cliente actualiza lista, detalle y marcador; otras sesiones la eliminan en su siguiente consulta. No prometer actualización instantánea de pestañas desconectadas.

No borrar físicamente al retirar: conservar un registro mínimo del estado para impedir republicaciones accidentales. La retención de datos personales y su eliminación requieren una política explícita antes del lanzamiento público.

## Persistencia y seguridad

Repositorio de envíos separado de conectores de ingesta, con operaciones de crear, revisar y retirar. Los cambios de estado serán atómicos para resolver carreras entre aprobación y retirada. La consulta pública combinará únicamente envíos aprobados y activos con las publicaciones de origen.

La API del servidor valida cuerpos acotados, formatos, origen y frecuencia de solicitudes. Genera un token aleatorio de alta entropía por oferta, guarda solo su hash y lo muestra una vez. El enlace usa fragmento de URL; el cliente lo elimina de la barra tras leerlo y lo transmite al servidor mediante cabecera, nunca parámetros de consulta. No registrar tokens ni cuerpos con datos privados. La pantalla de gestión usa `no-store` y `Referrer-Policy: no-referrer`, sin recursos externos.

Las operaciones de moderación requieren autorización independiente del token del autor. No habrá endpoint administrativo abierto ni escritura pública directa en Firestore.

Evaluar Firebase gratuito como adaptador de almacenamiento privado sin activar facturación. El servidor local actual no constituye un backend público desplegado. Si Firebase no puede configurarse, documentar el bloqueo; una persistencia local no se presentará como integración Firebase. La habilitación pública requiere resolver almacenamiento, acceso del operador y controles de abuso.

## Verificación requerida

1. Envío con salario fijo, rango y no publicado; errores de rango y contactos.
2. Ubicación seleccionada coincide con el punto enviado, sin sustituirla por la sede o un centroide.
3. Pendientes y rechazadas no aparecen en búsquedas, detalle ni mapa.
4. Token inválido o perteneciente a otra oferta no permite consultar datos privados ni retirar.
5. Retirada válida elimina la oferta del catálogo, es idempotente y sobrevive a reinicios.
6. GET del enlace no da de baja; ninguna respuesta pública expone correo privado, token ni hash.
7. Retirada concurrente con aprobación nunca termina publicada; ingesta diaria conserva la baja.
8. Regresión de consultas existentes, lista/mapa y fuentes externas; prueba visual del formulario y de la gestión en móvil y escritorio.
