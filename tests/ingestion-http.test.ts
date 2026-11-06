import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchStatus} from '../packages/ingestion/src/http.ts';

test('fetchStatus devuelve el estado y cancela el cuerpo sin descargar la página',async()=>{
 let cancelled=false;
 const body=new ReadableStream({cancel(){cancelled=true;}});
 const fetchImpl=(async()=>new Response(body,{status:404,headers:{'content-type':'text/html'}})) as typeof fetch;
 assert.equal(await fetchStatus('https://empleo.jcyl.es/oferta',{fetchImpl}),404);
 assert.equal(cancelled,true);
});
