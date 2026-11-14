import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicAdSenseConfig} from '../apps/web-preview/config.mjs';
import {requestAdSlot,watchAdStatus} from '../apps/web-preview/public/adsense.mjs';
import {isAdsEnabled,observeAdsToggle} from '../apps/web-preview/public/ad-toggle.mjs';

test('el interruptor remoto solo acepta true explícito',()=>{
  assert.equal(isAdsEnabled('true'),true);
  for(const value of ['false','TRUE','1','',null,undefined])assert.equal(isAdsEnabled(value),false);
});

test('Remote Config aplica el estado inicial y sus cambios sin iniciar Analytics',async()=>{
  const values:string[]=[];
  let current='false';
  let observer:{next:(update:{getUpdatedKeys:()=>Set<string>})=>Promise<void>;error:()=>void}|undefined;
  const appSdk={getApps:()=>[],initializeApp:()=>({})};
  const remoteSdk={
    isSupported:async()=>true,
    getRemoteConfig:()=>({settings:{},defaultConfig:{}}),
    fetchAndActivate:async()=>true,
    getValue:()=>({asString:()=>current}),
    activate:async()=>true,
    onConfigUpdate:(_remote:unknown,callbacks:typeof observer)=>{observer=callbacks;return ()=>{};},
  };
  await observeAdsToggle({apiKey:'key',projectId:'project',appId:'app'},(value:boolean)=>values.push(String(value)),{loadSdk:async()=>[appSdk,remoteSdk]});
  current='true';
  await observer?.next({getUpdatedKeys:()=>new Set(['ads_footer_enabled'])});
  observer?.error();
  assert.deepEqual(values,['false','true','false']);
});

test('el bloque único vive antes del pie y fuera de las ofertas',async()=>{
  const html=await readFile(new URL('../apps/web-preview/public/index.html',import.meta.url),'utf8');
  assert.match(html,/<\/main>\s*<aside id="footer-ad"[^>]*hidden[^>]*>.*?<\/aside>\s*<footer class="site-footer"/s);
  const app=await readFile(new URL('../apps/web-preview/public/app.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(app,/adInsertionIndex\(/);
});

test('AdSense permanece desactivado si faltan aprobación o identificadores',()=>{
  assert.deepEqual(publicAdSenseConfig({}),{enabled:false});
  assert.deepEqual(publicAdSenseConfig({GEOEMPLEO_ADSENSE_ENABLED:'true'}),{enabled:false});
  assert.deepEqual(publicAdSenseConfig({GEOEMPLEO_ADSENSE_PUBLISHER_ID:'ca-pub-1234567890123456'}),{enabled:false,publisherId:'ca-pub-1234567890123456'});
});

test('AdSense expone solo el editor y el bloque cuando todos los datos son válidos',()=>{
  assert.deepEqual(publicAdSenseConfig({
    GEOEMPLEO_ADSENSE_ENABLED:'true',
    GEOEMPLEO_ADSENSE_PUBLISHER_ID:'ca-pub-1234567890123456',
    GEOEMPLEO_ADSENSE_SLOT_ID:'1234567890',
  }),{
    enabled:false,
    publisherId:'ca-pub-1234567890123456',
    slotId:'1234567890',
  });
});

test('AdSense no acepta identificadores con formato incorrecto',()=>{
  assert.deepEqual(publicAdSenseConfig({
    GEOEMPLEO_ADSENSE_ENABLED:'true',
    GEOEMPLEO_ADSENSE_PUBLISHER_ID:'fake',
    GEOEMPLEO_ADSENSE_SLOT_ID:'123',
  }),{enabled:false});
});

test('una unidad ya solicitada no vuelve a generar otra petición',()=>{
  const slot={dataset:{},style:{display:''}} as unknown as HTMLElement;
  const requests:unknown[]=[];
  const runtime={adsbygoogle:{push:(request:unknown)=>requests.push(request)}};
  const config={enabled:true,publisherId:'ca-pub-1234567890123456',slotId:'1234567890'};
  assert.equal(requestAdSlot(slot,config,runtime as unknown as typeof globalThis),true);
  assert.equal(requestAdSlot(slot,config,runtime as unknown as typeof globalThis),false);
  assert.equal(requests.length,1);
  assert.equal(slot.dataset.adClient,config.publisherId);
  assert.equal(slot.dataset.adSlot,config.slotId);
  assert.equal(slot.dataset.adFormat,'horizontal');
});

test('la tarjeta publicitaria solo aparece cuando AdSense devuelve un anuncio',()=>{
  let notify:(()=>void)|undefined;
  class Observer {
    constructor(callback:(records:unknown[])=>void){notify=()=>callback([]);}
    observe(){ }
    disconnect(){ }
  }
  const slot={dataset:{adStatus:''}} as unknown as HTMLElement;
  const container={hidden:true,dataset:{}} as unknown as HTMLElement;
  watchAdStatus(slot,container,{MutationObserverClass:Observer as unknown as typeof MutationObserver});
  assert.equal(container.hidden,true);
  slot.dataset.adStatus='filled';
  notify?.();
  assert.equal(container.hidden,false);
  slot.dataset.adStatus='unfilled';
  notify?.();
  assert.equal(container.hidden,true);
});

test('el anuncio deja de estar pendiente solo al llenarse',()=>{
  let notify:(()=>void)|undefined;
  class Observer {
    constructor(callback:()=>void){notify=callback;}
    observe(){}
  }
  const slot={dataset:{adStatus:''}} as unknown as HTMLElement;
  const container={hidden:false,dataset:{pending:'true'}} as unknown as HTMLElement;
  watchAdStatus(slot,container,{MutationObserverClass:Observer as unknown as typeof MutationObserver});
  slot.dataset.adStatus='filled';notify?.();
  assert.equal(container.dataset.pending,undefined);
});

test('una respuesta tardía de un anuncio desmontado no vuelve a mostrarlo',()=>{
  let notify:(()=>void)|undefined;
  class Observer {
    constructor(callback:()=>void){notify=callback;}
    observe(){}
  }
  const slot={dataset:{adStatus:'filled'}} as unknown as HTMLElement;
  const container={hidden:true,contains:()=>false} as unknown as HTMLElement;
  watchAdStatus(slot,container,{MutationObserverClass:Observer as unknown as typeof MutationObserver});
  notify?.();
  assert.equal(container.hidden,true);
});

test('la página ofrece controles separados para analítica y publicidad',async()=>{
  const html=await readFile(new URL('../apps/web-preview/public/index.html',import.meta.url),'utf8');
  assert.match(html,/id="privacy-settings"[^>]*>Privacidad<\/button>/);
  assert.match(html,/id="ad-privacy-settings"[^>]*>Privacidad y cookies<\/button>/);
  assert.match(html,/href="\/privacy\.html"/);
  const policy=await readFile(new URL('../apps/web-preview/public/privacy.html',import.meta.url),'utf8');
  assert.match(policy,/Firebase Analytics/);
  assert.match(policy,/Google AdSense/);
  assert.match(policy,/Firebase Remote Config/);
  assert.match(policy,/rhonal\.delgado@gmail\.com/);
  const app=await readFile(new URL('../apps/web-preview/public/app.mjs',import.meta.url),'utf8');
  assert.match(app,/googlefc\.callbackQueue\.push\(googlefc\.showRevocationMessage\)/);
});

test('la actualización diaria conserva las variables públicas de AdSense durante el build',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/daily-offers.yml',import.meta.url),'utf8');
  for(const name of ['GEOEMPLEO_ADSENSE_ENABLED','GEOEMPLEO_ADSENSE_PUBLISHER_ID','GEOEMPLEO_ADSENSE_SLOT_ID']){
    assert.ok(workflow.includes(name+': ${{ vars.'+name+' }}'));
    assert.ok(workflow.includes(`${name}=%s\\n`));
  }
});
