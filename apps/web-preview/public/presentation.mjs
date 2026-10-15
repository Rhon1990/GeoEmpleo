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
 note:isPublic?'El anuncio remite a las bases del proceso. Consulta allí requisitos, solicitud y posibles cambios. El plazo se reproduce sin calcular una fecha de cierre.':'Consulta en el origen la vigencia y los requisitos de inscripción. La solicitud se realiza fuera de GeoEmpleo y puede requerir identificación o registro.',
 salaryLabel:isPublic?'Salario no publicado':'Retribución: consulta la descripción',
 provenance:isPublic?'El título corto y el área son adaptación editorial. Reproducción informativa sin carácter oficial.':'Origen de los datos: Servicio Regional de Empleo y Formación de la Región de Murcia. La empresa no se identifica en el conjunto de datos; SEF es el anunciante. Clasificación de GeoEmpleo; sin vínculo de patrocinio.'};
}
