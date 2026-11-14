# Publicidad discreta con control desde Firebase

Fecha: 14 de noviembre de 2026. Diseño aprobado por el titular.

## Objetivo

Mostrar como máximo un bloque manual de Google AdSense en la franja situada entre el contenido principal y el pie de GeoEmpleo360, tanto en móvil como en tableta y ordenador. El titular podrá activarlo o desactivarlo desde Firebase Console sin desplegar la web.

## Diseño y comportamiento

- Reutilizar la integración AdSense existente, el editor y la unidad manual configurados; retirar su inserción actual entre ocho resultados para no duplicar anuncios.
- Crear un contenedor semántico «Publicidad» inmediatamente después de `main` y antes de `footer`. Será parte del flujo normal, con ancho adaptable y límites de altura razonables; no será fijo ni se superpondrá al mapa, al carrusel, a filtros o a tarjetas.
- El contenedor permanecerá oculto hasta que AdSense marque la unidad como `filled`. Si responde `unfilled`, falla la red o falta configuración válida, no dejará un hueco visible.
- En móvil aparecerá después del mapa y el carrusel cuando esté seleccionada la vista Mapa; en vista Ofertas aparecerá después de la lista. En ordenador irá debajo del espacio de lista y mapa. No alterará el número, orden ni contenido de las ofertas.

## Control remoto

- Un parámetro global booleano de Firebase Remote Config, `ads_footer_enabled`, será el interruptor. Su valor por defecto local y remoto será `false`.
- El navegador consultará Remote Config al iniciar y escuchará actualizaciones publicadas para aplicar el estado sin desplegar. El control no promete efecto instantáneo: depende de la conectividad, caché y entrega de Firebase. En pestañas abiertas, una desactivación ocultará y desmontará el espacio; al activar se podrá crear una nueva unidad. Al recargar, se volverá a consultar el estado.
- El valor remoto solo autoriza anuncios si, además, la configuración pública contiene un ID de editor y un ID de unidad válidos y AdSense ha aprobado el dominio. La variable antigua `GEOEMPLEO_ADSENSE_ENABLED` dejará de decidir la visibilidad; el despliegue diario no debe reactivar anuncios por accidente.
- Si Remote Config no está disponible, falla o devuelve un valor inesperado, prevalece `false`. El interruptor no contiene secretos ni datos de ofertas.

## Privacidad y operación

- Remote Config se inicializará sin activar Firebase Analytics ni cambiar la preferencia opt-in del visitante. Firebase utiliza un identificador de instalación para Remote Config; la política de privacidad explicará este uso y la finalidad técnica del interruptor. Las decisiones sobre publicidad y analítica siguen separadas.
- La CMP europea de AdSense y el control «Privacidad y cookies» existentes permanecen a cargo del consentimiento publicitario. No habilitar Auto ads.
- La función se podrá publicar apagada. Para activarla, comprobar antes que el dominio esté `Ready` en AdSense, que la unidad y el editor sean los reales y que el mensaje europeo esté operativo; después publicar `ads_footer_enabled=true` en Firebase Console. El estado inicial en producción seguirá apagado hasta esa comprobación.

## Validación

1. `false`, configuración ausente o error de Firebase: ningún SDK de AdSense, contenedor visible ni hueco en móvil, tableta u ordenador.
2. `true` con editor/unidad válidos: una sola solicitud de anuncio; solo se ve si la respuesta es `filled`; `unfilled` lo oculta.
3. Cambios remoto `true→false→true`, recarga y fallo de red: sin duplicados ni excepciones, con mapa, ofertas, filtros y carrusel funcionales.
4. Comparar conteos e IDs de ofertas antes y después. Revisar diseños a 390, 768 y 1440 px, además del flujo de consentimiento y CSP.

## Fuera de alcance

Anuncios automáticos, intersticiales, publicidad dentro del mapa o tarjetas, pagos en Firebase, cambios del catálogo y promesas de ingresos.
