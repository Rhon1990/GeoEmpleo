# Conector Andalucía

Aplicar el diseño de ampliación aprobado con el runner y resolver existentes. API pública CC BY 4.0; publicar solo procesos en curso con plazo vigente explícito y publicación no futura. Contrastar ruta canónica de detalle antes de activar. Varias ubicaciones conservan una sola publicación sin punto, indicando sus localidades; no duplicar plazas ni asignar sede arbitraria. Identidad estable ANDALUCIA-id, texto sanitizado, salario nulo y empleador presentado como publicador.

1. Tests previos: respuesta incompleta, duplicados, plazos vencidos, promoción interna, fechas, municipio ambiguo y varias ubicaciones.
2. Implementar adaptador y registrar fuente en runner con geografía nacional.
3. Validar captura aislada y enlaces originales, atribuir CC BY 4.0 en web.
4. Ejecutar suite completa y actualización diaria; comprobar IDs y conteos.
5. Actualizar contexto y automatización únicamente tras captura correcta.
