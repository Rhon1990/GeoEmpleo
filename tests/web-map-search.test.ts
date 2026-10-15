import test from 'node:test';
import assert from 'node:assert/strict';
import {locateOnce,createViewportSearch} from '../apps/web-preview/public/map-search.mjs';

test('localización de una sola lectura con precisión moderada y fallo controlado',async()=>{
 let options:unknown;
 const provider={getCurrentPosition(success:(position:GeolocationPosition)=>void,_error:unknown,opts:unknown){options=opts;success({coords:{longitude:-3.7,latitude:40.4,accuracy:80}} as GeolocationPosition);}};
 const position=await locateOnce(provider);
 assert.equal(position.status,'located');assert.deepEqual(position.point,[-3.7,40.4]);assert.equal(position.zoom,12);
 assert.deepEqual(options,{enableHighAccuracy:false,maximumAge:300000,timeout:8000});
 for(const [code,status] of [[1,'denied'],[2,'unavailable'],[3,'timeout']] as const) {
  assert.equal((await locateOnce({getCurrentPosition(_ok:unknown,error:(err:GeolocationPositionError)=>void){error({code} as GeolocationPositionError);}})).status,status);
 }
 assert.equal((await locateOnce(null)).status,'unavailable');
 assert.equal((await locateOnce({getCurrentPosition(success:(value:GeolocationPosition)=>void){success({coords:{longitude:0,latitude:91,accuracy:0}} as GeolocationPosition);}})).status,'unavailable');
});
function clock(){let id=0;const tasks=new Map<number,()=>void>();return{schedule(fn:()=>void,delay:number){assert.equal(delay,350);tasks.set(++id,fn);return id;},cancel(key:number){tasks.delete(key);},flush(){const pending=[...tasks.values()];tasks.clear();for(const fn of pending)fn();}};}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('agrupa movimientos y solo ejecuta el último viewport',async()=>{
 const timer=clock(),requests:string[]=[],results:unknown[]=[];
 const controller=createViewportSearch({schedule:timer.schedule,cancel:timer.cancel,fetchImpl:async(url:string)=>{requests.push(url);return Response.json({jobs:[]});},onResult:(result:unknown)=>results.push(result)});
 controller.request(new URLSearchParams({bounds:'-4,39,-3,40'}));controller.request(new URLSearchParams({bounds:'-2,37,-1,38'}));assert.equal(requests.length,0);
 timer.flush();await tick();assert.equal(requests.length,1);assert.match(requests[0],/-2%2C37%2C-1%2C38/);assert.equal(results.length,1);
 controller.request(new URLSearchParams({bounds:'-2,37,-1,38'}));timer.flush();await tick();assert.equal(requests.length,1);
 controller.cancel();
});
test('aborta consulta activa e ignora respuestas fuera de orden aunque fetch ignore abort',async()=>{
 const timer=clock(),signals:AbortSignal[]=[],resolvers:Array<(response:Response)=>void>=[],results:unknown[]=[];
 const controller=createViewportSearch({schedule:timer.schedule,cancel:timer.cancel,fetchImpl:(_url:string,options:{signal:AbortSignal})=>{signals.push(options.signal);return new Promise<Response>(resolve=>resolvers.push(resolve));},onResult:(result:unknown)=>results.push(result)});
 controller.request(new URLSearchParams({q:'old'}));timer.flush();
 controller.request(new URLSearchParams({q:'new'}));assert.equal(signals[0].aborted,true);timer.flush();
 resolvers[1](Response.json({id:'new'}));await tick();resolvers[0](Response.json({id:'old'}));await tick();assert.deepEqual(results,[{id:'new'}]);
 controller.cancel();
});
test('permite reintentar tras fallo y cancelar trabajo pendiente',async()=>{
 const timer=clock();let attempts=0,errors=0;
 const controller=createViewportSearch({schedule:timer.schedule,cancel:timer.cancel,fetchImpl:async()=>{attempts++;return new Response('',{status:503});},onError:()=>errors++});
 controller.request(new URLSearchParams({q:'test'}));timer.flush();await tick();assert.equal(errors,1);
 controller.request(new URLSearchParams({q:'test'}));timer.flush();await tick();assert.equal(attempts,2);
 controller.request(new URLSearchParams({q:'cancel'}));controller.cancel();timer.flush();assert.equal(attempts,2);
});
