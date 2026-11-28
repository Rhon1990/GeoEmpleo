import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareDailyRefresh} from '../tools/prepare-daily-refresh.mjs';
const now=Date.parse('2026-10-27T07:00:00Z');
const previous={checkedAt:'2026-10-26T15:58:30Z',calls:[{id:'published-offer',paragraphs:['Descripción original']}]};
async function setup(){
  const file=join(await mkdtemp(join(tmpdir(),'geoempleo-refresh-')),'calls.json');
  await writeFile(file,JSON.stringify({checkedAt:'2026-10-20T00:00:00Z',calls:[{id:'stale-git-copy'}]}));
  return file;
}
test('uses the published baseline rather than an outdated Git copy',async()=>{
  const catalogPath=await setup();
  const urls:string[]=[];
  const result=await prepareDailyRefresh({catalogPath,now,fetchImpl:async url=>{urls.push(String(url));return new Response(JSON.stringify(previous));}});
  assert.equal(result.required,true);
  assert.match(urls[0],/\/data\/calls-full\.json\?/);
  assert.deepEqual(JSON.parse(await readFile(catalogPath,'utf8')),previous);
});
test('falls back to the legacy full catalog only when the new archive is absent',async()=>{
  const catalogPath=await setup();
  const urls:string[]=[];
  await prepareDailyRefresh({catalogPath,now,fetchImpl:async url=>{
    urls.push(String(url));
    return new Response(urls.length===1?'':JSON.stringify(previous),{status:urls.length===1?404:200});
  }});
  assert.match(urls[0],/\/data\/calls-full\.json\?/);
  assert.match(urls[1],/\/data\/calls\.json\?/);
  assert.deepEqual(JSON.parse(await readFile(catalogPath,'utf8')),previous);
});
test('never uses the reduced search index as an ingestion baseline',async()=>{
  const catalogPath=await setup();
  await assert.rejects(prepareDailyRefresh({catalogPath,now,fetchImpl:async url=>
    new Response(String(url).includes('calls-full.json')?'':JSON.stringify({checkedAt:previous.checkedAt,detailShardSize:100,calls:[{id:'published-offer'}]}),{status:String(url).includes('calls-full.json')?404:200})
  }),/completo/);
});
test('backup skips a catalog already updated today in Madrid',async()=>{
  const catalogPath=await setup();
  const today={...previous,checkedAt:'2026-10-26T23:10:00Z'};
  assert.equal((await prepareDailyRefresh({catalogPath,now,fetchImpl:async()=>new Response(JSON.stringify(today))})).required,false);
});
test('manual Actions dispatch explicitly retries today',async()=>{
  const catalogPath=await setup();
  const today={...previous,checkedAt:'2026-10-27T05:00:00Z'};
  assert.equal((await prepareDailyRefresh({catalogPath,now,force:true,fetchImpl:async()=>new Response(JSON.stringify(today))})).required,true);
});
for(const [name,response] of [
  ['HTTP error',()=>new Response('',{status:503})],
  ['duplicate IDs',()=>new Response(JSON.stringify({...previous,calls:[{id:'dup'},{id:'dup'}]}))],
  ['invalid date',()=>new Response(JSON.stringify({...previous,checkedAt:'invalid'}))],
  ['future date',()=>new Response(JSON.stringify({...previous,checkedAt:'2026-12-01T00:00:00Z'}))],
  ['empty catalog',()=>new Response(JSON.stringify({...previous,calls:[]}))],
] as const) test(`preserves baseline on ${name}`,async()=>{
  const catalogPath=await setup();
  const before=await readFile(catalogPath,'utf8');
  await assert.rejects(prepareDailyRefresh({catalogPath,now,fetchImpl:async()=>response()}));
  assert.equal(await readFile(catalogPath,'utf8'),before);
});
