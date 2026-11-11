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
