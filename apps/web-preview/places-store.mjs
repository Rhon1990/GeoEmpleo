import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {formatPlaceSuggestion,mergeEquivalentPlaces,normalizePlaceSearchText,placeSearchText,rankPlaceSuggestions,samePlaceProvince} from './public/place-suggestions.mjs';

/** @typedef {{id:string,name:string,label:string,aliases?:string[],postalCodes?:string[],latitude:number,longitude:number,province:string,municipality?:string,sourceUrl:string,precision:string}} ReferencePlace */

/** National locality lookup, separate from the jobs projection. Cached until process restart. */
export function createPlacesStore(path) {
  let catalog;
  async function load() {
    if(!catalog)catalog=readFile(path).then(buffer=>JSON.parse(gunzipSync(buffer).toString())).then(({places})=>mergeEquivalentPlaces(places).map(place=>({
      place,text:normalizePlaceSearchText(placeSearchText(place)),
    }))).catch(error=>{catalog=null;throw error;});
    return catalog;
  }
  return {
    /** @returns {Promise<{query:string,places:ReferencePlace[],truncated:boolean}>} */
    async query(params) {
      if(params.getAll('q').length>1)throw new TypeError('Consulta repetida');
      if(params.getAll('province').length>1||(params.get('province')?.length??0)>80)throw new TypeError('Provincia inválida');
      const input=params.get('q')??'';
      if(input.length>120)throw new TypeError('Consulta demasiado larga');
      const value=normalizePlaceSearchText(input);
      if(value.length<2)return{query:input,places:[],truncated:false};
      const tokens=value.split(' ');
      const province=params.get('province');
      const matches=(await load()).filter(item=>(!province||samePlaceProvince(item.place.province,province))&&tokens.every(token=>item.text.includes(token)));
      const ranked=rankPlaceSuggestions(matches.map(item=>item.place),value);
      return{query:input,places:ranked.slice(0,20).map(place=>({...place,label:formatPlaceSuggestion(place)})),truncated:matches.length>20};
    },
  };
}
