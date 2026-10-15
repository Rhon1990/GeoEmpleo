import {isPoint} from './geography.mjs';

const normalize=value=>value.trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/\s+/g,' ');

// A postal code alone does not identify a unique locality or a device position.
export function resolveReferencePlace(places,input) {
  const value=normalize(input);
  if(!value||/^\d{5}$/.test(value))return null;
  const matches=places.filter(place=>isPoint([place.longitude,place.latitude])&&
    [place.label,place.name,...(place.aliases??[])].some(label=>typeof label==='string'&&normalize(label)===value));
  return matches.length===1?matches[0]:null;
}
