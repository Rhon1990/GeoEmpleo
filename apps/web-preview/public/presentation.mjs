export const placesLabel = call => call.places == null ? 'Plazas no publicadas' : `${call.places} ${call.places === 1 ? 'plaza' : 'plazas'}`;
export function resultSummary(results) {
 const known=results.reduce((total,call)=>total+(call.places??0),0);
 const unknown=results.filter(call=>call.places==null).length;
 return `${known} plazas publicadas${unknown?` · ${unknown} ${unknown===1?'oferta sin número de plazas':'ofertas sin número de plazas'}`:''} · Consulta el plazo en cada oferta`;
}
export function jobPresentation(call) {
 const isPublic=call.kind==='public_call';
 const source=call.source??'Fuente original';
 return {source,sourceLink:`Ver ${isPublic?'anuncio':'oferta'} original en ${source} ↗`,
 note:isPublic?'El anuncio remite a las bases del proceso. Consulta allí requisitos, solicitud y posibles cambios. El plazo se reproduce sin calcular una fecha de cierre.':'Mostramos el texto facilitado por la fuente; algunas publicaciones solo incluyen un resumen. Consulta en el origen los requisitos completos y la vigencia. La solicitud se realiza fuera de GeoEmpleo y puede requerir identificación o registro.',
 salaryLabel:isPublic?'Salario no publicado':'Retribución: consulta la descripción',
 provenance:isPublic?'El título corto y el área son adaptación editorial. Reproducción informativa sin carácter oficial.':`Origen de los datos: ${source}. La etiqueta de anunciante identifica al publicador; no identifica necesariamente a la empresa contratante. Consulta la descripción original. Clasificación de GeoEmpleo; sin vínculo de patrocinio.`};
}
