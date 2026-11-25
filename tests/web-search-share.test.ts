import test from 'node:test';
import assert from 'node:assert/strict';
import * as sharing from '../apps/web-preview/public/search-share.mjs';
const {shareableSearchUrl}=sharing;

test('solo comparte filtros públicos y excluye ubicación precisa o parámetros ajenos',()=>{
  const url=shareableSearchUrl('https://geoempleo360.com/?q=panaderia&city=Madrid&category=servicios&employer=adecco&lat=40.4&lng=-3.7&token=privado');
  assert.equal(url,'https://geoempleo360.com/?q=panaderia&city=Madrid&category=servicios&employer=adecco');
});

test('sin filtros no hay búsqueda guardable',()=>{
  assert.equal(shareableSearchUrl('https://geoempleo360.com/?lat=40.4'),null);
});

test('el enlace de una oferta abre solo su detalle sin compartir ubicación ni filtros',()=>{
  const shareableOfferUrl=(sharing as typeof sharing & {shareableOfferUrl?:(url:string,id:string)=>string|null}).shareableOfferUrl;
  const offerIdFromUrl=(sharing as typeof sharing & {offerIdFromUrl?:(url:string)=>string|null}).offerIdFromUrl;
  assert.equal(typeof shareableOfferUrl,'function');
  assert.equal(typeof offerIdFromUrl,'function');
  const url=shareableOfferUrl!('https://geoempleo360.com/?q=peon&lat=40.4&lng=-3.7&token=privado','ADECCO-123');
  assert.equal(url,'https://geoempleo360.com/?oferta=ADECCO-123');
  assert.equal(offerIdFromUrl!(url!), 'ADECCO-123');
  assert.equal(offerIdFromUrl!('https://geoempleo360.com/?oferta=uno&oferta=dos'),null);
  assert.equal(offerIdFromUrl!('https://geoempleo360.com/?oferta='),null);
  assert.equal(shareableOfferUrl!('https://geoempleo360.com/','x'.repeat(121)),null);
});

test('el mensaje de una oferta incluye título, ubicación y enlace sin repetir la provincia',()=>{
  const message=sharing.offerShareMessage({title:'Operario/a',city:'Ávila',province:'Ávila'});
  assert.equal(message,'Creemos que esta oferta te puede interesar:\n\nOperario/a\nUbicación: Ávila');
  assert.equal(sharing.offerShareMessage({title:'Técnico',city:'Coslada',province:'Madrid'}),'Creemos que esta oferta te puede interesar:\n\nTécnico\nUbicación: Coslada, Madrid');
  assert.equal(sharing.offerShareMessage({title:'Técnico'}),'Creemos que esta oferta te puede interesar:\n\nTécnico');
});

test('comparte el mensaje y enlace por el selector nativo o el portapapeles',async()=>{
  const offer={title:'Técnico',city:'Coslada',province:'Madrid'};
  const url='https://geoempleo360.com/?oferta=123';
  let native:unknown;
  await sharing.shareOffer(offer,url,{share:async (data:unknown)=>{native=data;}});
  assert.deepEqual(native,{title:'Técnico',text:sharing.offerShareMessage(offer),url});
  let copied='';
  await sharing.shareOffer(offer,url,{clipboard:{writeText:async (text:string)=>{copied=text;}}});
  assert.equal(copied,`${sharing.offerShareMessage(offer)}\n${url}`);
});
