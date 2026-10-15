import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreviewPath } from '../apps/web-preview/routing.mjs';

test('un request target malformado no termina el servidor de vista previa', () => {
  assert.equal(resolvePreviewPath('http://%'), null);
});

test('los filtros de URL no se interpretan como rutas de ficheros', () => {
  assert.equal(resolvePreviewPath('/data/calls.json?q=administracion'), '/data/calls.json');
});
