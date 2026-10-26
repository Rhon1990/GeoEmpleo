export function publicMapConfig(environment) {
  return {googleMapsApiKey:(environment.GEOEMPLEO_GOOGLE_MAPS_API_KEY ?? '').trim(),googleMapsMapId:(environment.GEOEMPLEO_GOOGLE_MAPS_MAP_ID ?? '').trim() || 'DEMO_MAP_ID'};
}

export function publicAdSenseConfig(environment) {
  const publisherId=(environment.GEOEMPLEO_ADSENSE_PUBLISHER_ID??'').trim();
  const slotId=(environment.GEOEMPLEO_ADSENSE_SLOT_ID??'').trim();
  if(!/^ca-pub-\d{16}$/.test(publisherId))return {enabled:false};
  if(environment.GEOEMPLEO_ADSENSE_ENABLED!=='true'||!/^\d{6,20}$/.test(slotId))return {enabled:false,publisherId};
  return {enabled:true,publisherId,slotId};
}
