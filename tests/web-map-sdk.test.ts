import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSdk} from '../apps/web-preview/public/google-map.mjs';

test('Google Maps puede volver a cargarse después de un fallo de red',async () => {
  const previousWindow=globalThis.window;
  const previousDocument=globalThis.document;
  const scripts: Array<{onerror?:()=>void}> = [];
  const mockWindow={google:{},geoEmpleoMapsReady:()=>{}};
  globalThis.window=mockWindow as unknown as Window & typeof globalThis;
  globalThis.document={
    createElement:()=>({src:'',async:false,nonce:'',onerror:undefined}),
    querySelector:()=>null,
    head:{append:(script:{onerror?:()=>void})=>scripts.push(script)},
  } as unknown as Document;
  try {
    const first=loadSdk('test-key');
    assert.equal(scripts.length,1);
    scripts[0].onerror?.();
    await assert.rejects(first,/No se pudo cargar Google Maps/);

    const second=loadSdk('test-key');
    assert.equal(scripts.length,2);
    mockWindow.geoEmpleoMapsReady();
    assert.equal(await second,mockWindow.google);
  } finally {
    globalThis.window=previousWindow;
    globalThis.document=previousDocument;
  }
});
