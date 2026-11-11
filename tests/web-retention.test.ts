import test from 'node:test';
import assert from 'node:assert/strict';
import {createRetentionStore} from '../apps/web-preview/public/retention.mjs';

function memoryStorage(initial:string|null=null) {
  let value=initial;
  return {getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;},snapshot:()=>value};
}

test('guarda búsquedas públicas y ofertas sin coordenadas ni cuenta',()=>{
  const storage=memoryStorage();
  const retention=createRetentionStore({storage,now:()=>new Date('2026-11-08T10:00:00Z')});
  assert.equal(retention.saveSearch('https://geoempleo360.com/?q=panadero&city=Madrid&lat=40.4&token=privado'),true);
  assert.deepEqual(retention.savedSearches(),[{href:'/?q=panadero&city=Madrid',label:'panadero · Madrid'}]);
  assert.equal(retention.toggleOffer({id:'job-1',title:'Panadero/a',employer:'Empresa',city:'Madrid',province:'Madrid',source:'Portal',sourceUrl:'https://example.com/1',location:{point:[-3.7,40.4]}}),true);
  assert.equal(retention.savedOffers()[0].id,'job-1');
  assert.doesNotMatch(storage.snapshot()??'',/lat|token|point|40\.4|longitude|example\.com/);
  assert.equal(retention.toggleOffer({id:'job-1'}),false);
  assert.deepEqual(retention.savedOffers(),[]);
});

test('nuevas desde la visita previa usa publicación o detección, no comprobación diaria',()=>{
  const storage=memoryStorage(JSON.stringify({lastVisitAt:'2026-11-06T09:00:00Z',searches:[],offers:[]}));
  const retention=createRetentionStore({storage,now:()=>new Date('2026-11-08T10:00:00Z')});
  assert.equal(retention.isNew({publishedAt:'2026-11-07',checkedAt:'2026-11-08T08:00:00Z'}),true);
  assert.equal(retention.isNew({publishedAt:'2026-10-01',checkedAt:'2026-11-08T08:00:00Z'}),false);
  retention.markVisit();
  assert.equal(retention.previousVisitAt(),'2026-11-06T09:00:00Z');
  assert.match(storage.snapshot()??'',/2026-11-08T10:00:00\.000Z/);
});

test('estado local inválido se ignora y guardar búsquedas vacías no crea entradas',()=>{
  const retention=createRetentionStore({storage:memoryStorage('{mal'),now:()=>new Date('2026-11-08T10:00:00Z')});
  assert.equal(retention.saveSearch('https://geoempleo360.com/?lat=40.4'),false);
  assert.deepEqual(retention.savedSearches(),[]);
  assert.equal(retention.previousVisitAt(),null);
});

test('recupera únicamente metadatos públicos permitidos de guardados previos',()=>{
  const storage=memoryStorage(JSON.stringify({lastVisitAt:null,searches:[],offers:[{id:'job-1',title:'Título',city:'Madrid',sourceUrl:'https://example.com',location:{point:[-3.7,40.4]}}]}));
  const retention=createRetentionStore({storage});
  assert.deepEqual(retention.savedOffers(),[{id:'job-1',title:'Título',employer:'',city:'Madrid',province:'',source:''}]);
});
