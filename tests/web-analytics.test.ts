import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyticsController } from '../apps/web-preview/public/analytics.mjs';

function createHarness(initial='') {
  const values=new Map(initial?[["geoempleo-analytics-consent",initial]]:[]);
  const calls:any[][]=[];
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
  const sdk={
    init:async(options:unknown)=>{calls.push(['init',options]);return {analytics:{id:'test'}};},
    setConsent:(analytics:unknown,status:unknown)=>calls.push(['consent',analytics,status]),
    setCollectionEnabled:(analytics:unknown,enabled:boolean)=>calls.push(['collection',analytics,enabled]),
    logEvent:(analytics:unknown,name:string,params:unknown)=>calls.push(['event',analytics,name,params]),
  };
  return {values,calls,storage,sdk};
}

const config={apiKey:'test',appId:'test-app',projectId:'test-project',measurementId:'G-TEST'};

test('no inicia ni emite eventos antes del consentimiento afirmativo',async()=>{
  const h=createHarness();
  const controller=createAnalyticsController({config,storage:h.storage as unknown as Storage,loadSdk:async()=>h.sdk,location:{pathname:'/',search:'?q=privado'} as Location});
  await controller.initializeFromPreference();
  controller.track('page_view');
  assert.deepEqual(h.calls,[]);
});

test('un rechazo persistido impide cargar el SDK y emitir eventos',async()=>{
  const h=createHarness('rejected');
  const controller=createAnalyticsController({config,storage:h.storage as unknown as Storage,loadSdk:async()=>h.sdk,location:{pathname:'/'} as Location});
  await controller.initializeFromPreference();
  await controller.reject();
  controller.track('search_submitted');
  assert.equal(h.values.get('geoempleo-analytics-consent'),'rejected');
  assert.deepEqual(h.calls,[]);
});

test('aceptar inicializa una sola vez y registra consentimiento analítico',async()=>{
  const h=createHarness();
  const controller=createAnalyticsController({config,storage:h.storage as unknown as Storage,loadSdk:async()=>h.sdk,location:{pathname:'/'} as Location});
  await controller.accept(); await controller.accept();
  assert.equal(h.calls.filter(([kind])=>kind==='init').length,1);
  assert.ok(h.calls.some(([kind,,status])=>kind==='consent'&&status.analytics_storage==='granted'));
  assert.equal(h.values.get('geoempleo-analytics-consent'),'accepted');
});

test('revocar persiste rechazo, deniega consentimiento y detiene colección',async()=>{
  const h=createHarness('accepted');
  const controller=createAnalyticsController({config,storage:h.storage as unknown as Storage,loadSdk:async()=>h.sdk,location:{pathname:'/'} as Location});
  await controller.initializeFromPreference();
  await controller.revoke();
  controller.track('page_view');
  assert.equal(h.values.get('geoempleo-analytics-consent'),'rejected');
  assert.ok(h.calls.some(([kind,,status])=>kind==='consent'&&status.analytics_storage==='denied'));
  assert.ok(h.calls.some(([kind,,enabled])=>kind==='collection'&&enabled===false));
  assert.equal(h.calls.filter(([kind])=>kind==='event').length,0);
});

test('revocar mientras Firebase se inicializa no concede consentimiento al resolver',async()=>{
  const h=createHarness();
  let markInitStarted:(()=>void)|undefined;
  let finishInit:((value:{analytics:{id:string}})=>void)|undefined;
  const initStarted=new Promise<void>(resolve=>{markInitStarted=resolve;});
  const sdk={...h.sdk,init:async(options:unknown)=>{
    h.calls.push(['init',options]);markInitStarted?.();
    return new Promise<{analytics:{id:string}}>(resolve=>{finishInit=resolve;});
  }};
  const controller=createAnalyticsController({config,storage:h.storage as unknown as Storage,loadSdk:async()=>sdk,location:{pathname:'/'} as Location});
  const accepting=controller.accept();
  await initStarted;
  await controller.reject();
  finishInit?.({analytics:{id:'test'}});
  await accepting;
  assert.equal(h.values.get('geoempleo-analytics-consent'),'rejected');
  assert.ok(h.calls.some(([kind,,status])=>kind==='consent'&&status.analytics_storage==='denied'));
  assert.ok(h.calls.some(([kind,,enabled])=>kind==='collection'&&enabled===false));
  assert.equal(h.calls.some(([kind,,status])=>kind==='consent'&&status.analytics_storage==='granted'),false);
  assert.equal(h.calls.filter(([kind])=>kind==='event').length,0);
});

test('page_view solo transmite ruta permitida y nunca query ni geolocalización',async()=>{
  const h=createHarness();
  const controller=createAnalyticsController({config,storage:h.storage as unknown as Storage,loadSdk:async()=>h.sdk,location:{pathname:'/',search:'?q=panaderia&city=Sevilla'} as Location});
  await controller.accept();
  controller.track('page_view');
  const event=h.calls.find(([kind])=>kind==='event');
  assert.deepEqual(event?.[3],{page_path:'/'});
  assert.doesNotMatch(JSON.stringify(event),/panaderia|Sevilla|latitude|longitude|coordinates/);
});

test('solo permite eventos y valores categóricos definidos, nunca texto libre',async()=>{
  const h=createHarness();
  const controller=createAnalyticsController({config,storage:h.storage as unknown as Storage,loadSdk:async()=>h.sdk,location:{pathname:'/'} as Location});
  await controller.accept();
  controller.track('filter_used',{filter_type:'employer',employer:'DIA'});
  controller.track('filter_used',{filter_type:'employer'});
  controller.track('map_action',{action:'search_visible_area'});
  controller.track('map_action',{action:'use_my_location',latitude:40.1,longitude:-3.7});
  controller.track('unknown_event');
  assert.deepEqual(h.calls.filter(([kind])=>kind==='event').map(([, ,name,params])=>[name,params]),[
    ['filter_used',{filter_type:'employer'}],
    ['map_action',{action:'search_visible_area'}],
  ]);
});
