import assert from 'node:assert/strict';
import {test} from 'node:test';
import {employerBrand} from '../apps/web-preview/public/presentation.mjs';

test('usa identidad visual solo para tablones empresariales verificados', () => {
  assert.deepEqual(employerBrand({sourceId:'talentclue-mcdonalds'}), {src:'/brands/mcdonalds.svg',alt:'McDonald’s'});
  assert.deepEqual(employerBrand({sourceId:'bizneo-burger-king'}), {src:'/brands/burger-king.svg',alt:'Burger King'});
  assert.deepEqual(employerBrand({sourceId:'amrest-kfc'}), {src:'/brands/kfc.svg',alt:'KFC'});
});

test('fuentes públicas y anuncios directos muestran la identidad neutra de GeoEmpleo', () => {
  const fallback={src:'/brands/geoempleo-neutral.svg',alt:'GeoEmpleo'};
  assert.deepEqual(employerBrand({sourceId:'ecyl-castilla-leon',employer:'McDonald’s'}),fallback);
  assert.deepEqual(employerBrand({sourceId:'direct-employer',employer:'KFC'}),fallback);
});
