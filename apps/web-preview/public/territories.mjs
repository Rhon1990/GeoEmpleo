import {placeCommunities,placeProvinces} from './place-suggestions.mjs?v=20261118-place-hierarchy';
import {territoryBounds} from './territory-views.mjs';

export function selectableTerritories(regions) {
  return regions.filter(region => String(region??'').trim().toLocaleLowerCase('es-ES')!=='españa');
}

export function territorySelection(community,province='') {
  if(!placeCommunities().includes(community))throw new TypeError('Comunidad inválida');
  if(province&&!placeProvinces(community).includes(province))throw new TypeError('Provincia ajena a la comunidad');
  const name=province||community;
  return {name,bounds:territoryBounds(name)};
}
