import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestLocationWithPermission} from '../apps/web-preview/public/location-permission.mjs';

test('solicita confirmación antes del permiso pendiente y respeta la cancelación',async()=>{
 let locations=0, prompts=0;
 const result=await requestLocationWithPermission({permission:async()=> 'prompt',confirm:async()=>{prompts++;return false;},locate:async()=>{locations++;return {status:'located'};},denied:()=>{throw Error('inesperado');}});
 assert.equal(result.status,'cancelled');assert.equal(prompts,1);assert.equal(locations,0);
});
test('permiso concedido solicita posición sin diálogo adicional',async()=>{
 const result=await requestLocationWithPermission({permission:async()=> 'granted',confirm:async()=>{throw Error('inesperado');},locate:async()=>({status:'located',point:[-4,40]}),denied:()=>{throw Error('inesperado');}});
 assert.equal(result.status,'located');
});
test('permiso bloqueado y rechazo en la solicitud muestran instrucciones',async()=>{
 let denied=0,locations=0;
 const blocked=await requestLocationWithPermission({permission:async()=> 'denied',confirm:async()=>true,locate:async()=>{locations++;return {status:'located'};},denied:()=>{denied++;}});
 assert.equal(blocked.status,'denied');assert.equal(locations,0);assert.equal(denied,1);
 const rejected=await requestLocationWithPermission({permission:async()=> 'prompt',confirm:async()=>true,locate:async()=>({status:'denied'}),denied:()=>{denied++;}});
 assert.equal(rejected.status,'denied');assert.equal(denied,2);
});
test('si no se puede consultar el permiso, pide confirmación antes de localizar',async()=>{
 let prompted=0;
 const result=await requestLocationWithPermission({permission:async()=>{throw Error('unsupported');},confirm:async()=>{prompted++;return true;},locate:async()=>({status:'unavailable'}),denied:()=>{throw Error('inesperado');}});
 assert.equal(prompted,1);assert.equal(result.status,'unavailable');
});
