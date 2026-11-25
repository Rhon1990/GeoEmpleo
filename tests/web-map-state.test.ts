import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOriginSelection} from '../apps/web-preview/public/map-state.mjs';
import {cameraPlan,markerVisualState,viewportPoints} from '../apps/web-preview/public/google-map.mjs';

test('cancelar la selección evita que un clic posterior reactive el origen',() => {
  const origins: number[][] = [];
  const selection=createOriginSelection((point:number[]) => origins.push(point));
  selection.arm();selection.cancel();
  assert.equal(selection.isActive(),false);
  assert.equal(selection.capture([-3,40]),false);
  assert.deepEqual(origins,[]);
});

test('la selección de origen solo captura el primer clic solicitado',() => {
  const origins: number[][] = [];
  const selection=createOriginSelection((point:number[]) => origins.push(point));
  selection.arm();selection.capture([-3,40]);selection.capture([-4,41]);
  assert.deepEqual(origins,[[-3,40]]);
  assert.equal(selection.isActive(),false);
});

test('el viewport de proximidad incluye el origen y las ofertas filtradas',() => {
  const origin = [-3.70256,40.4165];
  const calls = [
    {location:{point:[-3.15944,40.11866]}},
    {location:{point:null}},
  ];

  assert.deepEqual(viewportPoints(calls,origin),[
    origin,
    [-3.15944,40.11866],
  ]);
});

test('el movimiento de cámara se decide fuera de la actualización de marcadores',() => {
  const origin = [-3.70256,40.4165];
  const calls = [{location:{point:[-3.15944,40.11866]}}];

  assert.deepEqual(cameraPlan(calls,origin),{
    mode:'bounds',
    points:[origin,[-3.15944,40.11866]],
  });
  assert.deepEqual(cameraPlan([],origin),{mode:'focus',points:[origin]});
  assert.deepEqual(cameraPlan([],null),{mode:'none',points:[]});
});

test('la previsualización solo cambia el estado visual del pin, sin texto de oferta',() => {
  assert.deepEqual(markerVisualState(['job-a'],'job-a','job-b'),{
    selected:true,previewed:false,zIndex:100,
  });
  assert.deepEqual(markerVisualState(['job-b'],'job-a','job-b'),{
    selected:false,previewed:true,zIndex:50,
  });
  assert.deepEqual(markerVisualState(['job-c'],'job-a','job-b'),{
    selected:false,previewed:false,zIndex:1,
  });
  assert.deepEqual(markerVisualState(['job-a','job-b'],'job-a','job-b'),{
    selected:true,previewed:true,zIndex:100,
  });
});

test('las acciones de cámara del controlador pasan por la transición común e incluyen el radio',()=>{
 const source=readFileSync(new URL('../apps/web-preview/public/google-map.mjs',import.meta.url),'utf8');
 assert.match(source,/focus\(point,zoom=10\)\s*\{[^}]*transition\.animate/);
 assert.match(source,/fitArea\(bounds\)\s*\{\s*animateToBounds/);
 assert.match(source,/overview\(\)\s*\{\s*transition\.animate/);
 assert.match(source,/fit\(calls,origin\)\s*\{[\s\S]*?animateToBounds/);
 assert.match(source,/fitRadius\(origin,radiusKm\)\s*\{[\s\S]*?animateToBounds/);
 assert.doesNotMatch(source,/map\.(?:setCenter|setZoom|fitBounds|panTo)\(/);
});
