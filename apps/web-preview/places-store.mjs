import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

/** @typedef {{id:string,name:string,label:string,aliases?:string[],postalCodes?:string[],latitude:number,longitude:number,province:string,sourceUrl:string,precision:string}} ReferencePlace */

const normalize=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim();

/** National locality lookup, separate from the jobs projection. Cached until process restart. */
export function createPlacesStore(path) {
  let catalog;
  async function load() {
    if(!catalog)catalog=readFile(path).then(buffer=>JSON.parse(gunzipSync(buffer).toString())).then(({places})=>places.map(place=>({
      place,names:[place.name,...(place.aliases??[])].map(normalize),text:normalize([place.label,...(place.aliases??[]),...(place.postalCodes??[])].join(' ')),
    }))).catch(error=>{catalog=null;throw error;});
    return catalog;
  }
  return {
    /** @returns {Promise<{query:string,places:ReferencePlace[],truncated:boolean}>} */
    async query(params) {
      if(params.getAll('q').length>1)throw new TypeError('Consulta repetida');
      const input=params.get('q')??'';
      if(input.length>120)throw new TypeError('Consulta demasiado larga');
      const value=normalize(input);
      if(value.length<2)return{query:input,places:[],truncated:false};
      const tokens=value.split(' ');
      const matches=(await load()).filter(item=>tokens.every(token=>item.text.includes(token)));
      const score=item=>item.names.includes(value)?0:item.place.postalCodes?.includes(value)?1:item.names.some(name=>name.startsWith(value))?2:3;
      matches.sort((a,b)=>score(a)-score(b)||a.place.label.localeCompare(b.place.label,'es'));
      return{query:input,places:matches.slice(0,20).map(item=>item.place),truncated:matches.length>20};
    },
  };
}
