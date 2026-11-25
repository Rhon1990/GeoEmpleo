import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locationFeedbackMessage,requestLocationWithPermission,shouldSimulateLocationUnavailable} from '../apps/web-preview/public/location-permission.mjs';

test('location feedback tells the user when the device position is unavailable', () => {
 assert.match(locationFeedbackMessage('denied'),/ubicación.*Chrome/i);
 assert.match(locationFeedbackMessage('timeout'),/Wi.?Fi/i);
 assert.match(locationFeedbackMessage('unavailable'),/Wi.?Fi/i);
 assert.match(locationFeedbackMessage('unavailable'),/localidad manualmente/i);
 assert.equal(locationFeedbackMessage('located'),'Ubicación aproximada marcada en el mapa.');
});

test('solo simula ubicación no disponible en localhost con el parámetro de vista previa',()=>{
 assert.equal(shouldSimulateLocationUnavailable('127.0.0.1','?locationPreview=unavailable'),true);
 assert.equal(shouldSimulateLocationUnavailable('geoempleo360.com','?locationPreview=unavailable'),false);
 assert.equal(shouldSimulateLocationUnavailable('localhost',''),false);
});

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
