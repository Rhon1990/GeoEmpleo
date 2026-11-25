export async function requestLocationWithPermission({permission,confirm,locate,denied}) {
  let state='prompt';
  try {state=await permission();} catch { /* La API de permisos no está disponible en todos los navegadores. */ }
  if(state==='denied') {denied();return {status:'denied'};}
  if(state!=='granted' && !await confirm()) return {status:'cancelled'};
  const result=await locate();
  if(result.status==='denied') denied();
  return result;
}

export function locationFeedbackMessage(status) {
  switch(status) {
    case 'located': return 'Ubicación aproximada marcada en el mapa.';
    case 'denied': return 'No se pudo obtener tu ubicación. Comprueba el permiso de GeoEmpleo360 en Chrome y el acceso a la ubicación de Chrome en los ajustes del ordenador.';
    case 'timeout': return 'La búsqueda de ubicación tardó demasiado. Comprueba que el ordenador tenga Wi‑Fi activo y vuelve a intentarlo; también puedes elegir una localidad manualmente.';
    case 'unavailable': return 'Chrome no pudo determinar una ubicación. Comprueba que el ordenador tenga Wi‑Fi activo y vuelve a intentarlo; también puedes elegir una localidad manualmente.';
    default: return 'No pudimos obtener tu ubicación. Comprueba los permisos de ubicación de Chrome e inténtalo de nuevo.';
  }
}

export function shouldSimulateLocationUnavailable(hostname,search) {
  return ['localhost','127.0.0.1'].includes(hostname)
    && new URLSearchParams(search).get('locationPreview')==='unavailable';
}
