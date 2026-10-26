# Monetización web GeoEmpleo con Google AdSense

Fecha: 26 de octubre de 2026  
Estado: diseño aprobado; implementación local en curso.

## Objetivo

Preparar la web pública actual de GeoEmpleo para monetización con AdSense, preservando la búsqueda, las ofertas reales, el mapa y el acceso sin registro. No habilitar facturación ni introducir servicios de pago de Firebase o Google Cloud.

## Decisiones

- Usar **Google AdSense para la web**. AdMob corresponde a aplicaciones móviles.
- Usar **un bloque manual adaptable** en la lista de resultados, insertado después de las primeras ocho ofertas cuando haya suficientes resultados. Nunca se superpone al mapa, filtros, detalles ni controles de navegación.
- Identificar el espacio explícitamente como **Publicidad** y mantenerlo visualmente separado de las tarjetas de empleo. No imitar una oferta ni contar como resultado.
- No mostrar un espacio vacío, anuncio de prueba ni contenido inventado si la cuenta o el bloque no están listos.
- Usar `ads.txt` con el ID de editor real para verificar la propiedad del sitio durante la revisión. No cargar el SDK de anuncios/CMP antes de la aprobación. Solo cuando el sitio figure como aprobado/Ready, el titular haya desactivado Auto ads y estén configurados el ID de editor y el ID del bloque, cargar el SDK y el mensaje de consentimiento de AdSense.
- Para tráfico del EEE, utilizar Google AdSense Privacy & Messaging, su mensaje europeo certificado y las opciones para rechazar, aceptar, gestionar y retirar el consentimiento. La CMP administra las señales publicitarias; la preferencia opt-in existente de Firebase Analytics seguirá siendo independiente hasta demostrar una integración correcta entre ambas.
- Añadir una política de privacidad accesible que describa Analytics, AdSense, terceros, datos y opciones de consentimiento. Conservar un enlace persistente «Privacidad» para Analytics y, con AdSense habilitado, un control «Privacidad y cookies» que invoque `googlefc.callbackQueue.push(googlefc.showRevocationMessage)`.
- Publicar `ads.txt` solo después de obtener el identificador de editor real desde AdSense. Nunca inventar IDs ni guardar credenciales privadas en el repositorio.
- Incorporar en la CSP únicamente los orígenes estrictamente necesarios, según la documentación vigente de Google y los recursos que cargue el código final.

## Alternativas consideradas

1. **Bloque manual de AdSense (elegido):** máxima previsibilidad en el buscador con un espacio estable en el flujo de resultados.
2. **Anuncios automáticos:** configuración más sencilla, pero menor control sobre ubicación y posibilidad de interferencia visual con el mapa y la navegación.
3. **AdMob:** no es el producto adecuado para esta web; se reserva para una futura aplicación móvil, si se crea.

## Experiencia y comportamiento

- En escritorio, el bloque ocupa el flujo de la cuadrícula de resultados sin alterar la columna del mapa.
- En móvil, aparece entre tarjetas, nunca fijo ni por encima de controles.
- Solo se renderiza y solicita cuando el usuario llega a resultados suficientes y el slot está habilitado por configuración válida y el sitio está aprobado.
- El mapa, el conteo de vacantes y la selección de ofertas ignoran el bloque publicitario.
- Filtrar, mover el mapa, abrir/cerrar el detalle o cambiar de vista no debe duplicar slots ni reiniciar anuncios ya montados innecesariamente.
- La ausencia de configuración, consentimiento aplicable, conectividad o aprobación se resuelve sin error visible y sin afectar la búsqueda.

## Privacidad y consentimiento

- AdSense Privacy & Messaging gestiona el consentimiento para publicidad en regiones donde corresponda; la opción de retirada debe seguir accesible.
- El panel actual de GeoEmpleo gestiona solo Firebase Analytics y continuará separado en la primera versión. Aceptar anuncios no activa Analytics y aceptar Analytics no autoriza publicidad.
- Los dos controles deben estar accesibles desde el área persistente de Privacidad y conservar ámbitos independientes: aceptar anuncios no activa Analytics y aceptar Analytics no autoriza publicidad.
- Política de privacidad: explicar finalidades, Google como proveedor, tecnologías/almacenamiento pertinentes, controles de consentimiento y contacto del responsable. El texto deberá revisarse antes de publicación; esta especificación no sustituye asesoría jurídica.

## Requisitos externos y límites

- El propietario debe completar directamente en Google AdSense los datos de cuenta, identidad y pagos, incorporar el dominio `geoempleo-49978.web.app`, verificar propiedad y solicitar revisión. No compartir datos bancarios, fiscales ni contraseñas en el chat o en Git.
- Google no permite mostrar anuncios hasta que el sitio tenga estado aprobado/Ready. La revisión puede tardar días o varias semanas.
- La selección de unidades publicitarias y la divulgación de proveedores deben configurarse en la cuenta de AdSense.
- Esta integración no garantiza ingresos. La web no debe activar compras, actualización a Blaze, tarjeta ni facturación para mostrar el espacio AdSense.

## Criterios de aceptación

1. Sin IDs, aprobación o carga del SDK, la web se comporta como hoy: las búsquedas, filtros, detalles, mapa y uso público continúan operativos, sin un espacio publicitario vacío.
2. Con una configuración válida, hay como máximo un bloque manual por vista de resultados y está rotulado «Publicidad».
3. El anuncio nunca aparece dentro del mapa ni se cuenta como oferta; los filtros y el conteo conservan sus resultados.
4. Las decisiones publicitarias y analíticas permanecen separadas, sobreviven a recarga y pueden cambiarse desde «Privacidad».
5. Rechazar publicidad impide cargar/solicitar anuncios personalizados conforme al modo elegido en la CMP; no impide la búsqueda pública.
6. La política de privacidad y `ads.txt` (cuando exista ID real) se publican en rutas accesibles y se verifican en la build estática.
7. CSP contiene solo dominios requeridos. No se incluyen claves privadas, credenciales, IDs ficticios ni configuración que habilite facturación.
8. Tests cubren el estado sin configuración, consentimiento, una inserción estable, navegación/filtrado y exclusión del conteo/mapa. Build estática y revisión visual móvil/escritorio pasan.

## Riesgos y mitigaciones

- **Revisión o aprobación pendiente:** verificar propiedad con `ads.txt`, mantener el SDK y el slot ausentes; tras el estado Ready, confirmar que Auto ads está desactivado y activar el bloque manual/CMP.
- **Doble aviso de consentimiento:** la CMP de AdSense y el opt-in existente de Analytics tienen ámbitos distintos. Presentarlos con claridad y vincular ambos desde Privacidad; no fusionar señales sin prueba funcional del flujo.
- **Política de privacidad incompleta:** validar texto, proveedores efectivos y URL pública antes de solicitar revisión.
- **CSP incompleta:** probar con las solicitudes reales del SDK y restringir cada origen; no usar comodines amplios.
- **Política Referrer-Policy incompatible:** ahora la web usa `no-referrer`, que puede impedir que el mensaje europeo de Google sea elegible. Cambiarla a `strict-origin-when-cross-origin` para compartir solo el origen con terceros, y verificar que no se expongan rutas, consultas ni localidades buscadas.
- **Regresión en resultados/mapa:** el slot será un nodo separado del modelo de ofertas y se probará sin red publicitaria.

## Fuera de alcance

- Activar AdMob, intersticiales, ventanas emergentes, anuncios superpuestos al mapa o anuncios automáticos.
- Crear cuentas de Google o introducir datos legales/financieros del titular por cuenta del propietario.
- Alterar la captura de ofertas, el mapa, el catálogo público o los consentimientos previamente registrados.
- Prometer ingresos, CPM o aprobación del sitio.
