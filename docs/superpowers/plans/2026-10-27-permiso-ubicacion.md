# Permiso de ubicación: plan de implementación

**Objetivo:** explicar la solicitud de ubicación y ayudar a reactivarla cuando el navegador la haya bloqueado.

1. Mantener la geolocalización existente y consultar el estado de permisos si la API está disponible; ante estado desconocido solicitar confirmación antes de llamar al navegador.
2. Reutilizar un diálogo accesible con acciones para solicitar, cancelar o consultar instrucciones. Para permisos denegados explicar ajustes del sitio y del dispositivo, sin prometer que la web pueda cambiarlos.
3. Cubrir permiso concedido, pendiente, denegado, API no disponible y rechazo durante la solicitud; verificar UI, tipos y compilación.
4. Integrar y publicar mediante GitHub Actions, sin alterar el catálogo ni las credenciales.
