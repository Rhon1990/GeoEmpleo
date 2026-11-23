import test from 'node:test';
import assert from 'node:assert/strict';
import {placeCommunities,placeProvinces} from '../apps/web-preview/public/place-suggestions.mjs';
import {territoryBounds} from '../apps/web-preview/public/territory-views.mjs';
import {territorySelection} from '../apps/web-preview/public/territories.mjs';

test('cada comunidad y provincia elegible tiene un encuadre geográfico válido',()=>{
 for(const community of placeCommunities()){
  for(const territory of [community,...placeProvinces(community)]){
   const bounds=territoryBounds(territory);
   assert.ok(bounds,`Faltan límites de ${territory}`);
   const [west,south,east,north]=bounds!;
   assert.ok(west<east&&south<north&&west>=-19&&east<=5&&south>=27&&north<=44,`Límites incorrectos de ${territory}: ${bounds}`);
  }
 }
});

test('la provincia es opcional y determina el ámbito antes de elegir localidad',()=>{
 const community=territorySelection('Castilla y León');
 assert.equal(community.name,'Castilla y León');
 assert.deepEqual(community.bounds,territoryBounds('Castilla y León'));
 const province=territorySelection('Castilla y León','Segovia');
 assert.equal(province.name,'Segovia');
 assert.deepEqual(province.bounds,territoryBounds('Segovia'));
 assert.throws(()=>territorySelection('Canarias','Segovia'),/provincia/i);
});
