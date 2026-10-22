export const placesLabel = call => call.places == null ? 'Plazas no publicadas' : `${call.places} ${call.places === 1 ? 'plaza' : 'plazas'}`;
export function cardVisualTheme(job) {
  if(job.kind==='public_call'||job.category==='administracion')return 'public';
  if(['tecnico','industria','construccion'].includes(job.category))return 'technical';
  return 'local';
}
export function resultSummary(results) {
 const known=results.reduce((total,call)=>total+(call.places??0),0);
 const unknown=results.filter(call=>call.places==null).length;
 return `${known} plazas publicadas${unknown?` · ${unknown} ${unknown===1?'oferta sin número de plazas':'ofertas sin número de plazas'}`:''} · Consulta el plazo en cada oferta`;
}
function salaryLabel(salary) {
 if(!salary)return 'Retribución no publicada';
 const number=value=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:0,maximumFractionDigits:2,useGrouping:'always'}).format(value/100);
 const currency=salary.currency==='EUR'||!salary.currency?'€':salary.currency;
 const values=salary.maxMinor!=null&&salary.maxMinor!==salary.minMinor?`${number(salary.minMinor)}–${number(salary.maxMinor)}`:number(salary.minMinor);
 const amount=`${values} ${currency}`;
 const basis=salary.basis==='net'?'netos':'brutos';
 const period={hour:'por hora',month:'al mes',year:'al año'}[salary.period]??salary.period;
 return `${amount} ${basis} ${period}${salary.period==='month'&&salary.paymentsPerYear?` · ${salary.paymentsPerYear} pagas`:''}`;
}
export function jobPresentation(call) {
 const isPublic=call.kind==='public_call';
 const isDirect=call.sourceId==='direct-employer';
 const source=call.source??'Fuente original';
 return {source,sourceLink:isDirect?null:`Ver ${isPublic?'anuncio':'oferta'} original en ${source} ↗`,
 note:isDirect?'Usa el contacto publicado por el anunciante. GeoEmpleo revisa el contenido antes de mostrarlo, pero no verifica de forma independiente la identidad, la ubicación ni las condiciones.':isPublic?'El anuncio remite a las bases del proceso. Consulta allí requisitos, solicitud y posibles cambios. El plazo se reproduce sin calcular una fecha de cierre.':'Mostramos el texto facilitado por la fuente; algunas publicaciones solo incluyen un resumen. Consulta en el origen los requisitos completos y la vigencia. La solicitud se realiza fuera de GeoEmpleo y puede requerir identificación o registro.',
 salaryLabel:isDirect?salaryLabel(call.salary):isPublic?'Salario no publicado':'Retribución: consulta la descripción',
 locationLabel:isDirect?'Punto declarado por el anunciante; no verificado por GeoEmpleo':call.location?'Municipio aproximado; no dirección exacta':'Sin coordenadas verificadas',
 provenance:isDirect?'Contenido y punto facilitados por el anunciante y revisados antes de publicarse.':isPublic?'El título corto y el área son adaptación editorial. Reproducción informativa sin carácter oficial.':`Origen de los datos: ${source}. La etiqueta de anunciante identifica al publicador; no identifica necesariamente a la empresa contratante. Consulta la descripción original. Clasificación de GeoEmpleo; sin vínculo de patrocinio.`};
}
export const detailBadge=call=>`Oferta real · ${jobPresentation(call).source}`;
