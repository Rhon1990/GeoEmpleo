# Diseño: «Limpiar filtros» compacto en móvil

Fecha: 30 de octubre de 2026  
Estado: aprobado visualmente — opción A

## Problema

En pantallas móviles, `filter-bar` permite que `filter-controls` se reduzca para
compartir fila con `#clear-filters`. Como el contenedor usa alineación estirada,
el botón adopta la altura del bloque de empresa y categorías y aparece como una
pastilla grande y desproporcionada. En escritorio su tamaño y posición actuales
son correctos.

## Decisión visual

Por debajo de 780 px, «Limpiar filtros» se mostrará como la misma pastilla
secundaria de escritorio, pero en una fila propia debajo de las categorías y
alineada a la derecha.

- Mantiene texto e icono `×`, colores petróleo/azafrán, foco y estados actuales.
- Conserva un objetivo táctil mínimo de 38 px y no se convierte en un botón de
  ancho completo.
- No modifica el DOM, el comportamiento de limpieza ni la versión de escritorio.
- Cuando no hay filtros activos, continúa oculto mediante el atributo `hidden`.

## Implementación mínima

La corrección se limita a las reglas móviles de `styles.css`:

1. `filter-controls` ocupará una fila completa sin poder encogerse frente al
   botón.
2. `#clear-filters` no se estirará, conservará su altura intrínseca y se alineará
   al extremo derecho en la siguiente fila.
3. Las categorías seguirán desplazándose horizontalmente y el selector de
   empresa conservará su ancho disponible.

No se añadirá JavaScript ni se cambiarán las reglas de filtrado.

## Validación QA

- Prueba de regresión CSS que exija fila completa para `filter-controls` y
  autoalineación compacta para `#clear-filters` en el breakpoint móvil.
- Ejecutar las pruebas de layout web y la suite completa.
- Comprobar visualmente a 375, 390 y 430 px que el botón no tapa ni comprime el
  selector o las categorías.
- Comprobar a 781 px y en escritorio que el diseño existente no cambia.
- Validar navegación por teclado, foco visible, ocultación sin filtros y acción
  de limpieza con filtros activos.

## Riesgos y límites

El cambio es exclusivamente CSS y de bajo riesgo. El riesgo principal es crear
una fila innecesaria en tablet; se evita acotándolo al breakpoint móvil ya usado
por la página. No se aprovecha este ajuste para reorganizar otros filtros ni
refactorizar la hoja de estilos.
