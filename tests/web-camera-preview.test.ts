import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCameraPreview} from '../apps/web-preview/public/camera-preview.mjs';
import {searchGeography} from '../apps/web-preview/public/map-search.mjs';

test('activa el origen sintético solo en localhost con la marca explícita',()=>{
 const preview=createCameraPreview('localhost','?cameraPreview=1');
 assert.deepEqual(preview,{origin:[-3.7038,40.4168],radiusKm:25});
 assert.deepEqual(createCameraPreview('127.0.0.1','?cameraPreview=1'),preview);
 assert.equal(createCameraPreview('geoempleo360.com','?cameraPreview=1'),null);
 assert.equal(createCameraPreview('localhost',''),null);
 assert.equal(createCameraPreview('localhost','?cameraPreview=true'),null);
});

test('el modo de prueba no cambia la semántica de «Sin límite»',()=>{
 const preview=createCameraPreview('localhost','?cameraPreview=1')!;
 assert.deepEqual(searchGeography(preview.origin,'25'),{origin:preview.origin,radiusKm:25});
 assert.deepEqual(searchGeography(preview.origin,'0'),{origin:preview.origin,radiusKm:null});
});

test('la etiqueta de demo queda fuera del mapa y el modo sintético omite la geolocalización',()=>{
 const html=readFileSync(new URL('../apps/web-preview/public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../apps/web-preview/public/app.mjs',import.meta.url),'utf8');
 assert.ok(html.indexOf('id="camera-preview-note"')<html.indexOf('id="google-map"'));
 assert.match(html,/id="camera-preview-note"[^>]*hidden[^>]*>Vista de prueba: origen simulado en Madrid/);
 assert.match(app,/const position=cameraPreview\?null:/);
 assert.match(app,/document\.querySelector\('#use-location'\)\.disabled=true/);
 assert.match(app,/render\(\);\s*if\(cameraPreview&&origin\)mapController\.fitRadius\(origin,Number\(radiusInput\.value\)\);\s*requestSearch\(\);/);
});
