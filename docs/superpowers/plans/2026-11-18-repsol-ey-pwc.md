# Repsol, EY y PwC

Objetivo: incorporar las ofertas españolas de los tres enlaces aportados, sus logos oficiales y su ejecución diaria.

Arquitectura: EY reutiliza SuccessFactors; Repsol pagina Workday con Country=España; PwC usa el JSON público del listado Campus español. Los dos últimos comparten adaptación de metadatos públicos del listado, sin copiar descripciones ni depender de detalles Workday que devuelven comprobación antibot. Se conservan fechas oficiales cuando existen, enlaces y resolución municipal; destinos múltiples permanecen sin punto. Repsol usa fecha de primera detección; PwC excluye Andorra pese al código ESP erróneo del listado.

- [ ] Probar rechazo de URLs externas, países ajenos, duplicados, paginación incompleta y detalles incoherentes; verificar fechas y ubicaciones múltiples.
- [ ] Implementar conectores en packages/ingestion/src/connectors y registrarlos en registry.ts/runner.ts.
- [ ] Registrar logos oficiales locales en presentation.mjs y documentar procedencia en brands/README.md.
- [ ] Ejecutar captura real de las tres fuentes, pruebas, TypeScript y build; revisar la interfaz.
- [ ] Actualizar project-context.md y fuentes-de-ofertas.md con cobertura y límites comprobados.

Validación: node --test tests/ingestion-repsol-ey-pwc.test.ts; npm run typecheck; npm test; captura aislada con runDaily(sourceIds). Publicación usando el catálogo vigente como base, nunca el catálogo de fixtures.
