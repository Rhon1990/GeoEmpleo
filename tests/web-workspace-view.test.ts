import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceView,createDisclosure} from '../apps/web-preview/public/workspace-view.mjs';

test('aplica ofertas inicialmente y permite alternar ambas vistas',()=>{
  const applied:string[]=[];
  const workspace=createWorkspaceView(view=>applied.push(view));
  assert.equal(workspace.snapshot(),'jobs');
  workspace.select('map');
  assert.equal(workspace.snapshot(),'map');
  workspace.select('jobs');
  assert.deepEqual(applied,['jobs','map','jobs']);
});

test('respeta la vista inicial y no repite notificaciones',()=>{
  const applied:string[]=[];
  const workspace=createWorkspaceView(view=>applied.push(view),'map');
  workspace.select('map');
  workspace.select('jobs');
  workspace.select('jobs');
  assert.deepEqual(applied,['map','jobs']);
});

test('activa el refresco del mapa solo al entrar en la vista mapa',()=>{
  const activated:string[]=[];
  const workspace=createWorkspaceView(()=>{},'jobs',()=>activated.push('map'));
  workspace.select('map');
  workspace.select('map');
  workspace.select('jobs');
  workspace.select('map');
  assert.deepEqual(activated,['map','map']);
});

test('rechaza vistas desconocidas sin modificar la selección',()=>{
  const applied:string[]=[];
  const workspace=createWorkspaceView(view=>applied.push(view));
  assert.throws(()=>workspace.select('unknown'),RangeError);
  assert.equal(workspace.snapshot(),'jobs');
  assert.deepEqual(applied,['jobs']);
  assert.throws(()=>createWorkspaceView(view=>applied.push(view),'unknown'),RangeError);
  assert.deepEqual(applied,['jobs']);
});

test('el panel secundario móvil comienza cerrado y conserva su estado al alternar',()=>{
  const applied:boolean[]=[];
  const filters=createDisclosure(expanded=>applied.push(expanded));
  assert.equal(filters.snapshot(),false);
  filters.toggle();
  assert.equal(filters.snapshot(),true);
  filters.toggle();
  assert.deepEqual(applied,[false,true,false]);
});
