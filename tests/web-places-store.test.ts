import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlacesStore} from '../apps/web-preview/places-store.mjs';

const store=createPlacesStore(new URL('../apps/web-preview/data/spain-places.json.gz',import.meta.url));
test('busca pueblos españoles y conserva provincia, punto y procedencia',async()=>{
 for(const [q,province] of [['Ituero y Lama','Segovia'],['Robledillo de Gata','Cáceres'],['Tramacastilla','Teruel']] as const){
  const result=await store.query(new URLSearchParams({q}));
  assert.ok(result.places.some(place=>place.province===province));
  assert.ok(result.places.every(place=>Number.isFinite(place.latitude)&&Number.isFinite(place.longitude)&&place.sourceUrl.startsWith('https://')));
 }
});
test('código postal propone núcleos y no confunde Coto con el centro de Ituero',async()=>{
 const result=await store.query(new URLSearchParams({q:'40151'}));
 const coto=result.places.find(place=>place.name==='Coto de San Isidro');
 const ituero=result.places.find(place=>place.name==='Ituero y Lama');
 assert.ok(coto);assert.ok(ituero);
 assert.notEqual(coto.latitude,ituero.latitude);
 assert.match(coto.label,/Segovia.*40151/);
});
test('normaliza tildes, acota consultas y diferencia homónimos',async()=>{
 const result=await store.query(new URLSearchParams({q:'san isidro'}));
 assert.ok(result.places.length>1&&result.places.length<=20);
 assert.equal(new Set(result.places.map(place=>place.label)).size,result.places.length);
 assert.equal((await store.query(new URLSearchParams({q:'a'}))).places.length,0);
 assert.equal((await store.query(new URLSearchParams({q:'pueblo inexistente qzx123'}))).places.length,0);
 assert.ok((await store.query(new URLSearchParams({q:'Avila'}))).places.some(place=>place.name==='Ávila'));
 await assert.rejects(()=>store.query(new URLSearchParams('q=a&q=b')),TypeError);
 await assert.rejects(()=>store.query(new URLSearchParams({q:'x'.repeat(121)})),TypeError);
});
