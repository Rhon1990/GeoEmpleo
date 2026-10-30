import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

type RefreshDependencies={
  now:number;
  fetchCatalog:()=>{status:number;body:string};
  dispatch:()=>{status:number;body:string};
  getProperty:(name:string)=>string|null;
  setProperty:(name:string,value:string)=>void;
  formatMadridDay:(value:number)=>string;
};

type RefreshResult={status:string;checkedAt?:number;count?:number};

async function loadController(){
  const source=await readFile('infra/apps-script-daily-refresh/Code.gs','utf8');
  const context:Record<string,unknown>={};
  runInNewContext(`${source}\nthis.__exports={runRefreshCheck};`,context);
  return (context.__exports as {runRefreshCheck:(deps:RefreshDependencies)=>RefreshResult}).runRefreshCheck;
}

test('does not dispatch when the public catalog belongs to today in Madrid',async()=>{
  const run=await loadController();
  let dispatches=0;
  const result=run({
    now:Date.parse('2026-10-29T08:00:00Z'),
    fetchCatalog:()=>({status:200,body:JSON.stringify({checkedAt:'2026-10-29T06:00:00Z',calls:[{id:'one'}]})}),
    dispatch:()=>{dispatches++;return {status:204,body:''};},
    getProperty:()=>null,
    setProperty:()=>{},
    formatMadridDay:(value)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(value),
  });
  assert.equal(result.status,'fresh');
  assert.equal(dispatches,0);
});

function dependencies(overrides:Partial<RefreshDependencies>={}){
  const writes:Array<[string,string]>=[];
  let dispatches=0;
  const now=Date.parse('2026-10-29T08:00:00Z');
  const value:RefreshDependencies={
    now,
    fetchCatalog:()=>({status:200,body:JSON.stringify({checkedAt:'2026-10-28T06:00:00Z',calls:[{id:'one'}]})}),
    dispatch:()=>{dispatches++;return {status:204,body:''};},
    getProperty:()=>null,
    setProperty:(name,value)=>writes.push([name,value]),
    formatMadridDay:(date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(date),
    ...overrides,
  };
  return {writes,dispatches:()=>dispatches,value};
}

test('dispatches a stale catalog and stores the accepted attempt',async()=>{
  const run=await loadController();
  const deps=dependencies();
  assert.equal(run(deps.value).status,'dispatched');
  assert.equal(deps.dispatches(),1);
  assert.deepEqual(deps.writes,[['GEOEMPLEO_LAST_DISPATCH_AT',String(deps.value.now)]]);
});

test('respects the 60 minute cooldown',async()=>{
  const run=await loadController();
  const deps=dependencies({getProperty:()=>String(Date.parse('2026-10-29T07:30:00Z'))});
  assert.equal(run(deps.value).status,'cooldown');
  assert.equal(deps.dispatches(),0);
});

test('allows a retry after the cooldown',async()=>{
  const run=await loadController();
  const deps=dependencies({getProperty:()=>String(Date.parse('2026-10-29T06:59:00Z'))});
  assert.equal(run(deps.value).status,'dispatched');
  assert.equal(deps.dispatches(),1);
});

test('does not store cooldown when GitHub rejects the dispatch',async()=>{
  const run=await loadController();
  const deps=dependencies({dispatch:()=>({status:401,body:'Bad credentials'})});
  assert.throws(()=>run(deps.value),/GitHub dispatch HTTP 401/);
  assert.deepEqual(deps.writes,[]);
});

for(const [name,response] of [
  ['HTTP error',{status:503,body:''}],
  ['invalid date',{status:200,body:JSON.stringify({checkedAt:'invalid',calls:[{id:'one'}]})}],
  ['future date',{status:200,body:JSON.stringify({checkedAt:'2026-12-01T00:00:00Z',calls:[{id:'one'}]})}],
  ['empty catalog',{status:200,body:JSON.stringify({checkedAt:'2026-10-28T06:00:00Z',calls:[]})}],
  ['duplicate IDs',{status:200,body:JSON.stringify({checkedAt:'2026-10-28T06:00:00Z',calls:[{id:'dup'},{id:'dup'}]})}],
] as const)test(`rejects ${name}`,async()=>{
  const run=await loadController();
  const deps=dependencies({fetchCatalog:()=>response});
  assert.throws(()=>run(deps.value));
  assert.equal(deps.dispatches(),0);
});

type AppsScriptExports={
  checkAndDispatch:()=>RefreshResult;
  installRecurringTrigger:()=>void;
  installOneTimeTestTrigger:()=>void;
};

async function loadAppsScript(globals:Record<string,unknown>={}){
  const source=await readFile('infra/apps-script-daily-refresh/Code.gs','utf8');
  const context:Record<string,unknown>={...globals};
  runInNewContext(`${source}\nthis.__exports={checkAndDispatch,installRecurringTrigger,installOneTimeTestTrigger};`,context);
  return context.__exports as AppsScriptExports;
}

test('does not access services outside the Madrid morning window',async()=>{
  const app=await loadAppsScript({Utilities:{formatDate:()=> '4'}});
  assert.equal(app.checkAndDispatch().status,'outside-window');
});

test('replaces duplicate recurring triggers with one 15 minute trigger',async()=>{
  const deleted:unknown[]=[];
  const created:Array<{handler:string;minutes:number}>=[];
  const existing={getHandlerFunction:()=> 'checkAndDispatch'};
  const app=await loadAppsScript({
    ScriptApp:{
      getProjectTriggers:()=>[existing],
      deleteTrigger:(trigger:unknown)=>deleted.push(trigger),
      newTrigger:(handler:string)=>({timeBased:()=>({everyMinutes:(minutes:number)=>({create:()=>created.push({handler,minutes})})})}),
    },
  });
  app.installRecurringTrigger();
  assert.deepEqual(deleted,[existing]);
  assert.deepEqual(created,[{handler:'checkAndDispatch',minutes:15}]);
});

test('creates a one-time test trigger two minutes in the future',async()=>{
  const scheduled:Date[]=[];
  const before=Date.now()+119_000;
  const app=await loadAppsScript({
    ScriptApp:{newTrigger:()=>({timeBased:()=>({at:(date:Date)=>({create:()=>scheduled.push(date)})})})},
  });
  app.installOneTimeTestTrigger();
  assert.equal(scheduled.length,1);
  assert.ok(scheduled[0].getTime()>=before);
});
