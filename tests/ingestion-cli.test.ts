import test from 'node:test';
import assert from 'node:assert/strict';
import {runCli} from '../packages/ingestion/src/cli.ts';

test('CLI comunica fallo parcial aunque publique las fuentes disponibles',async()=>{
 const lines:string[]=[];
 const exitCode=await runCli(async()=>({status:'partial',published:2,sources:[
  {sourceId:'sef-murcia',status:'failed',received:0,mapped:0,reason:'source_fetch_or_validation_failed'},
 ]}),{log:line=>lines.push(line),error:line=>lines.push(line)});
 assert.equal(exitCode,1);
 assert.ok(lines.some(line=>line.startsWith('PARTIAL: catálogo 2')));
 assert.ok(lines.some(line=>line.includes('sef-murcia: failed')));
});

test('CLI solo termina correctamente si la captura es success',async()=>{
 const output={log:(_line:string)=>{},error:(_line:string)=>{}};
 assert.equal(await runCli(async()=>({status:'success',published:1,sources:[]}),output),0);
 assert.equal(await runCli(async()=>({status:'failed',published:1,sources:[]}),output),1);
 const errors:string[]=[];
 assert.equal(await runCli(async()=>{throw new Error('secret');},{...output,error:line=>errors.push(line)}),1);
 assert.equal(errors.length,1);
 assert.ok(!errors[0]?.includes('secret'));
});
