import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchHtmlProbe,fetchStatus} from '../packages/ingestion/src/http.ts';

test('fetchStatus devuelve el estado y cancela el cuerpo sin descargar la página',async()=>{
 let cancelled=false;
 const body=new ReadableStream({cancel(){cancelled=true;}});
 const fetchImpl=(async()=>new Response(body,{status:404,headers:{'content-type':'text/html'}})) as typeof fetch;
 assert.equal(await fetchStatus('https://empleo.jcyl.es/oferta',{fetchImpl}),404);
 assert.equal(cancelled,true);
});

test('fetchHtmlProbe devuelve una muestra acotada para detectar errores HTML con estado 200',async()=>{
 let cancelled=false;
 const encoder=new TextEncoder();
 const body=new ReadableStream({
  start(controller){controller.enqueue(encoder.encode('<title>404 Error - Junta de Castilla y León</title>'+'.'.repeat(100)));},
  cancel(){cancelled=true;},
 });
 const fetchImpl=(async()=>new Response(body,{status:200,headers:{'content-type':'text/html;charset=utf-8'}})) as typeof fetch;
 const probe=await fetchHtmlProbe('https://empleo.jcyl.es/oferta',{fetchImpl,maxBytes:64});
 assert.equal(probe.status,200);
 assert.match(probe.prefix,/404 Error - Junta de Castilla y León/);
 assert.equal(cancelled,true);
});
