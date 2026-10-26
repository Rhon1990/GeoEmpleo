/** @param {unknown} point */
export function isPoint(point) {
  return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
    && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
}

/** Distancia esférica en km; puntos [longitud, latitud]. */
export function distanceKm(from, to) {
  if (!isPoint(from) || !isPoint(to)) return Infinity;
  const radians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = radians(to[1] - from[1]);
  const longitudeDelta = radians(to[0] - from[0]);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(from[1])) * Math.cos(radians(to[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1,a)));
}

/** @param {{location?:{point?:number[]|null}}} call @param {{origin?:number[]|null,radiusKm?:number|null,bounds?:number[]|null}} filters */
export function matchesGeography(call, filters = {}) {
  const point = call.location?.point;
  if (filters.radiusKm != null) {
    if (!isPoint(filters.origin) || !isPoint(point) || !Number.isFinite(filters.radiusKm) || filters.radiusKm < 0) return false;
    if (distanceKm(filters.origin, point) > filters.radiusKm) return false;
  }
  if (filters.bounds) {
    if (!isPoint(point)) return false;
    const [west,south,east,north] = filters.bounds;
    const longitudeMatches = west <= east ? point[0] >= west && point[0] <= east : point[0] >= west || point[0] <= east;
    if (!longitudeMatches || point[1] < south || point[1] > north) return false;
  }
  return true;
}
