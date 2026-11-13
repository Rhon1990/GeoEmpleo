import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapLoadingState} from '../apps/web-preview/public/map-loading.mjs';

test('la primera carga espera mapa y catálogo; las siguientes no tapan el mapa',() => {
  const states:string[]=[];
  const loading=createMapLoadingState(state=>states.push(state));
  assert.equal(states.at(-1),'initial');

  loading.searchStarted();
  loading.searchFinished();
  assert.equal(states.at(-1),'initial');
  loading.mapReady();
  assert.equal(states.at(-1),'hidden');

  loading.searchStarted();
  assert.equal(states.at(-1),'refresh');
  loading.searchFinished();
  assert.equal(states.at(-1),'hidden');
});

test('el fallo retira el indicador y el reintento reinicia la carga',() => {
  const states:string[]=[];
  const loading=createMapLoadingState(state=>states.push(state));
  loading.searchStarted();
  loading.fail();
  assert.equal(states.at(-1),'hidden');
  loading.searchFinished();
  assert.equal(states.at(-1),'hidden');
  loading.retry();
  assert.equal(states.at(-1),'initial');
});
