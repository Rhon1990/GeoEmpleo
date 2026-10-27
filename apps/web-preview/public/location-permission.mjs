export async function requestLocationWithPermission({permission,confirm,locate,denied}) {
  let state='prompt';
  try {state=await permission();} catch { /* La API de permisos no está disponible en todos los navegadores. */ }
  if(state==='denied') {denied();return {status:'denied'};}
  if(state!=='granted' && !await confirm()) return {status:'cancelled'};
  const result=await locate();
  if(result.status==='denied') denied();
  return result;
}
