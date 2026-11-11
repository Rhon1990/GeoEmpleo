import test from 'node:test';
import assert from 'node:assert/strict';
import { previewAsset,resolvePreviewPath } from '../apps/web-preview/routing.mjs';

test('un request target malformado no termina el servidor de vista previa', () => {
  assert.equal(resolvePreviewPath('http://%'), null);
});

test('los filtros de URL no se interpretan como rutas de ficheros', () => {
  assert.equal(resolvePreviewPath('/data/calls.json?q=administracion'), '/data/calls.json');
});

test('sirve todos los módulos importados por la aplicación web',() => {
  assert.deepEqual(previewAsset('/job-interaction.mjs'),['job-interaction.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/workspace-view.mjs'),['workspace-view.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/analytics.mjs'),['analytics.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/search-share.mjs'),['search-share.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/retention.mjs'),['retention.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/static-data.mjs'),['static-data.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/mobile-offer-carousel.mjs'),['mobile-offer-carousel.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/adsense.mjs'),['adsense.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/territories.mjs'),['territories.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/job-projections.mjs'),['job-projections.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/location-permission.mjs'),['location-permission.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/select-controls.css'),['select-controls.css','text/css; charset=utf-8']);
});

test('sirve los recursos visuales usados por las tarjetas y el carrusel móvil',() => {
  assert.deepEqual(previewAsset('/brands/adecco.svg'),['brands/adecco.svg','image/svg+xml']);
  assert.deepEqual(previewAsset('/brands/jobandtalent.png'),['brands/jobandtalent.png','image/png']);
  assert.deepEqual(previewAsset('/icons/material-symbols/arrow-back-ios.svg'),['icons/material-symbols/arrow-back-ios.svg','image/svg+xml']);
  assert.deepEqual(previewAsset('/icons/material-symbols/arrow-forward-ios.svg'),['icons/material-symbols/arrow-forward-ios.svg','image/svg+xml']);
  assert.equal(previewAsset('/brands/no-existe.svg'),undefined);
  assert.equal(previewAsset('/icons/material-symbols/../styles.css'),undefined);
});
