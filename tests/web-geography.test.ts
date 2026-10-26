import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceKm, matchesGeography} from '../apps/web-preview/public/geography.mjs';

const madrid = [-3.70256,40.4165];
const manzanares = [-3.36991,38.99915];
const located = {location:{point:manzanares,precision:'municipality'}};
test('distancia geográfica cero en el mismo punto',() => assert.equal(distanceKm(madrid,madrid),0));
test('distancia en línea recta Madrid a Manzanares es aproximadamente 160 km',() => {
  assert.ok(distanceKm(madrid,manzanares)>155 && distanceKm(madrid,manzanares)<162);
  assert.equal(distanceKm(madrid,manzanares),distanceKm(manzanares,madrid));
});
test('radio filtra ofertas por distancia, incluyendo el límite',() => {
  assert.equal(matchesGeography(located,{origin:madrid,radiusKm:25}),false);
  assert.equal(matchesGeography(located,{origin:madrid,radiusKm:200}),true);
  assert.equal(matchesGeography(located,{origin:manzanares,radiusKm:0}),true);
});
test('ubicación desconocida se conserva sin ámbito y se excluye del radio',() => {
  assert.equal(matchesGeography({location:{point:null}},{}),true);
  assert.equal(matchesGeography({location:{point:null}},{origin:madrid,radiusKm:25}),false);
});
test('un radio sin origen nunca se trata como búsqueda nacional',() => {
  assert.equal(matchesGeography(located,{radiusKm:25}),false);
});
test('viewport admite puntos dentro y respeta límites de longitud/latitud',() => {
  assert.equal(matchesGeography(located,{bounds:[-4,38,-3,40]}),true);
  assert.equal(matchesGeography(located,{bounds:[-4,40,-3,41]}),false);
});
