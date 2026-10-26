import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createSubmissionHandler} from '../apps/web-preview/submission-api.mjs';
test('write endpoint rejects foreign origin, wrong content type and oversized body',async()=>{
 const handler=createSubmissionHandler({create(){throw new Error('must not write');}});
 const server=createServer((req,res)=>void handler(req,res));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address() as any;const base=`http://127.0.0.1:${address.port}`;
 try{
  assert.equal((await fetch(base+'/api/submissions',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/submissions',{method:'POST',headers:{Origin:base},body:'{}'})).status,415);
  assert.equal((await fetch(base+'/api/submissions',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'x'.repeat(25000)})).status,413);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
