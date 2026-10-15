import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginSelection} from '../apps/web-preview/public/map-state.mjs';
import {cameraPlan,viewportPoints} from '../apps/web-preview/public/google-map.mjs';

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
