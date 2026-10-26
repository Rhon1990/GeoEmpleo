import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveReferencePlace} from '../apps/web-preview/public/reference-places.mjs';

test('resuelve nombres y alias sin depender de mayúsculas o tildes',()=>{
 const place={id:'a',name:'Urbanización rural',label:'Urbanización rural · Segovia (40151)',aliases:['Coto de San Isidro'],latitude:40.77,longitude:-4.36};
 for(const name of ['urbanizacion rural',' COTO DE SAN ISIDRO ','Urbanización rural · Segovia (40151)'])assert.equal(resolveReferencePlace([place],name),place);
});

test('no asigna puntos por nombres ambiguos, códigos postales o coordenadas inválidas',()=>{
 const point={name:'San Isidro',latitude:40,longitude:-4};
 assert.equal(resolveReferencePlace([point,{...point,latitude:38}],'San Isidro'),null);
 assert.equal(resolveReferencePlace([{...point,aliases:['40151']}],'40151'),null);
 assert.equal(resolveReferencePlace([{...point,latitude:91}],'San Isidro'),null);
 assert.equal(resolveReferencePlace([point],'otro sitio'),null);
});

test('Coto de San Isidro tiene referencia pública propia, distinta de otros San Isidro',async()=>{
 const {places}=JSON.parse(await readFile(new URL('../apps/web-preview/public/data/places.json',import.meta.url),'utf8'));
 const place=resolveReferencePlace(places,'Coto de San Isidro');
 assert.ok(place);
 assert.equal(place.municipality,'Ituero y Lama');
 assert.equal(place.province,'Segovia');
 assert.deepEqual(place.postalCodes,['40151']);
 assert.deepEqual([place.longitude,place.latitude],[-4.3689205,40.7737942]);
 assert.equal(place.sourceUrl,'https://www.openstreetmap.org/node/309691474');
 assert.equal(resolveReferencePlace(places,'40151'),null);
});
