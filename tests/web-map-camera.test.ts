import test from 'node:test';
import assert from 'node:assert/strict';
import {boundsCameraTarget,createCameraTransition,radiusBounds} from '../apps/web-preview/public/map-camera.mjs';

test('los límites del radio contienen los cuatro puntos cardinales y permanecen centrados',()=>{
 const origin=[-3,40];
 const bounds=radiusBounds(origin,25);
 assert.ok(bounds);
 assert.ok(bounds[0]<origin[0]&&bounds[2]>origin[0]);
 assert.ok(bounds[1]<origin[1]&&bounds[3]>origin[1]);
 const north=origin[1]+25/6371.0088*180/Math.PI;
 const south=origin[1]-25/6371.0088*180/Math.PI;
 const east=origin[0]+Math.asin(Math.sin(25/6371.0088)/Math.cos(origin[1]*Math.PI/180))*180/Math.PI;
 const west=origin[0]-Math.asin(Math.sin(25/6371.0088)/Math.cos(origin[1]*Math.PI/180))*180/Math.PI;
 assert.ok(bounds[0]<=west&&bounds[2]>=east&&bounds[1]<=south&&bounds[3]>=north);
 assert.deepEqual(radiusBounds(origin,0),null);
});

test('calcula centro y zoom para encuadrar bounds con padding',()=>{
 const target=boundsCameraTarget([-4,39,-2,41],{width:800,height:600},60);
 assert.equal(target.center[0],-3);
 assert.ok(target.center[1]>39&&target.center[1]<41);
 assert.ok(target.zoom>0&&target.zoom<10);
 const narrow=boundsCameraTarget([-4,39,-2,41],{width:400,height:600},60);
 assert.ok(narrow.zoom<target.zoom);
 const origin=[-3,40];
 assert.deepEqual(boundsCameraTarget(radiusBounds(origin,25)!,{width:800,height:600},60,origin).center,origin);
});

test('anima cámara hasta el destino y reemplaza una animación por la selección más reciente',()=>{
 let camera={center:[0,0],zoom:4};
 let nextId=0;
 const frames=new Map<number,(time:number)=>void>();
 const transition=createCameraTransition({
  apply:next=>{camera=next;},getCurrent:()=>camera,
  requestFrame:callback=>{const id=++nextId;frames.set(id,callback);return id;},
  cancelFrame:id=>frames.delete(id),durationMs:300,
 });
 const frame=(time:number)=>{const [id,callback]=frames.entries().next().value!;frames.delete(id);callback(time);};
 transition.animate({center:[10,20],zoom:8});
 frame(0);frame(100);
 assert.notDeepEqual(camera,{center:[0,0],zoom:4});
 transition.animate({center:[-5,5],zoom:6});
 frame(200);frame(500);
 assert.deepEqual(camera,{center:[-5,5],zoom:6});
 assert.equal(frames.size,0);
});

test('movimiento reducido aplica el objetivo sin solicitar frames',()=>{
 let camera={center:[0,0],zoom:4};
 let requested=0;
 const transition=createCameraTransition({
  apply:next=>{camera=next;},getCurrent:()=>camera,
  requestFrame:()=>{requested++;return requested;},cancelFrame:()=>{},reducedMotion:true,
 });
 transition.animate({center:[1,2],zoom:7});
 assert.deepEqual(camera,{center:[1,2],zoom:7});
 assert.equal(requested,0);
});

test('el cálculo de radio mantiene el origen como centro incluso con encuadre Web Mercator',()=>{
 const origin=[-3.70256,40.4165];
 const target=boundsCameraTarget(radiusBounds(origin,100)!,{width:1100,height:620},60,origin);
 assert.deepEqual(target.center,origin);
 assert.ok(target.zoom>4&&target.zoom<10);
});
