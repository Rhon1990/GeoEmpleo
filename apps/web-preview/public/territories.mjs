export function selectableTerritories(regions) {
  return regions.filter(region => String(region??'').trim().toLocaleLowerCase('es-ES')!=='españa');
}
