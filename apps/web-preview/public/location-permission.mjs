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
    case 'located': return 'Mapa centrado en tu ubicación aproximada.';
    case 'timeout': return 'La ubicación tardó demasiado. Inténtalo de nuevo o elige tu zona en el mapa.';
    case 'denied': return 'El permiso de ubicación está bloqueado. Revísalo en los ajustes del navegador.';
    default: return 'No pudimos obtener tu ubicación. Elige una localidad o una zona en el mapa.';
  }
}
