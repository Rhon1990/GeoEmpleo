# Encuadre por distancia máxima y zoom fluido

## Contexto

El filtro «Distancia máxima» selecciona un radio de 0 a 100 km. Cero significa «Sin límite». El mapa ya dibuja el círculo correspondiente y filtra ofertas por ese radio, pero no ajusta su encuadre al cambiar la distancia. Otras acciones de la interfaz cambian el centro o el zoom mediante operaciones separadas del controlador de Google Maps.

## Diseño aprobado

- Cuando haya un origen y se seleccione un radio mayor que cero, el mapa ajustará su encuadre a los límites del círculo de búsqueda, manteniendo el origen como centro. Radios mayores mostrarán más territorio; radios menores acercarán la vista.
- «Sin límite» quitará el círculo y conservará el encuadre actual, igual que hoy.
- Todos los cambios de cámara iniciados por la aplicación pasarán por una transición común y fluida, sin importar qué control o sección los haya iniciado. Esto cubre los encuadres por distancia y territorio, la ubicación del dispositivo, el origen manual, la vista general y los encuadres de resultados.
- Los gestos de la persona usuaria sobre el mapa seguirán siendo directos. Si llega una nueva selección durante una transición, la cámara continuará hacia el objetivo más reciente.
- La transición respetará la preferencia del sistema de movimiento reducido.
- La página de prueba tendrá un modo local determinista con un origen sintético y el control de distancia operativo. No solicitará ubicación real y el modo no se activará en producción.

## Límites

El filtro geográfico, los resultados, los límites de búsqueda visibles, el círculo de radio y la navegación existente conservarán sus contratos. El cambio no se despliega a producción como parte de esta tarea.

## Validación prevista

- Verificar mediante pruebas que el encuadre del radio contiene el círculo para radios pequeños y grandes y que cero no fuerza un nuevo encuadre.
- Comprobar que todos los métodos de cámara de la aplicación usan la transición común y que una preferencia de movimiento reducido evita la animación.
- En la página local, probar radios de 5, 25 y 100 km, quitar el radio con «Sin límite» y activar los cambios de cámara desde distintos controles. El encuadre debe corresponder a la selección y moverse suavemente sin texto superpuesto al mapa.
- Ejecutar las pruebas del módulo web, los chequeos de tipos y el build estático.
