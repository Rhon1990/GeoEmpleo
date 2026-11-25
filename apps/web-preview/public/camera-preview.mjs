const PREVIEW_HOSTS=new Set(['localhost','127.0.0.1','::1']);
const SYNTHETIC_ORIGIN=[-3.7038,40.4168];

/** @param {string} hostname @param {string} search */
export function createCameraPreview(hostname,search) {
  if(!PREVIEW_HOSTS.has(String(hostname).toLowerCase()))return null;
  if(new URLSearchParams(search).get('cameraPreview')!=='1')return null;
  return {origin:[...SYNTHETIC_ORIGIN],radiusKm:25};
}
