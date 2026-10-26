export function publicMapConfig(environment) {
  return {googleMapsApiKey:(environment.GEOEMPLEO_GOOGLE_MAPS_API_KEY ?? '').trim(),googleMapsMapId:(environment.GEOEMPLEO_GOOGLE_MAPS_MAP_ID ?? '').trim() || 'DEMO_MAP_ID'};
}
