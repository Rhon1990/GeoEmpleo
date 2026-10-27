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
  assert.deepEqual(previewAsset('/location-permission.mjs'),['location-permission.mjs','text/javascript; charset=utf-8']);
  assert.deepEqual(previewAsset('/select-controls.css'),['select-controls.css','text/css; charset=utf-8']);
});
