# Google Apps Script Daily Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un disparador gratuito e independiente que compruebe GeoEmpleo360 y ejecute el workflow de actualización solo cuando el catálogo del día esté pendiente.

**Architecture:** Un script de Google Apps Script consulta el catálogo público cada 15 minutos durante la mañana, aplica validación y enfriamiento, y crea un `workflow_dispatch` mediante un token de GitHub limitado al repositorio. GitHub Actions continúa siendo el único responsable de la ingesta, build, despliegue y validación de ambos dominios.

**Tech Stack:** Google Apps Script V8, GitHub REST API, GitHub Actions, Node.js 24 test runner, Firebase Hosting.

---

## Estructura de archivos

- Crear `infra/apps-script-daily-refresh/Code.gs`: controlador, adaptadores de Apps Script e instalación idempotente del trigger.
- Crear `infra/apps-script-daily-refresh/README.md`: alta, permisos, secreto, prueba y operación.
- Crear `tests/apps-script-daily-refresh.test.ts`: pruebas del controlador cargando el mismo `Code.gs` en `node:vm`.
- Modificar `docs/fuentes-de-ofertas.md`: registrar el disparador externo y recuperación.
- Modificar `docs/project-context.md`: sustituir el estado obsoleto del scheduler por evidencia verificada.

### Task 1: Controlador de comprobación y despacho

**Files:**
- Create: `infra/apps-script-daily-refresh/Code.gs`
- Test: `tests/apps-script-daily-refresh.test.ts`

- [ ] **Step 1: Escribir la prueba fallida del catálogo actualizado**

Crear el cargador del archivo Apps Script y la primera prueba:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

async function loadController(){
  const source=await readFile('infra/apps-script-daily-refresh/Code.gs','utf8');
  const context:Record<string,unknown>={};
  runInNewContext(`${source}\nthis.__exports={runRefreshCheck};`,context);
  return (context.__exports as {runRefreshCheck:Function}).runRefreshCheck;
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
    formatMadridDay:(value:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(value),
  });
  assert.equal(result.status,'fresh');
  assert.equal(dispatches,0);
});
```

- [ ] **Step 2: Ejecutar la prueba y comprobar RED**

Run: `node --test tests/apps-script-daily-refresh.test.ts`  
Expected: FAIL porque `infra/apps-script-daily-refresh/Code.gs` o `runRefreshCheck` no existe.

- [ ] **Step 3: Implementar el controlador mínimo**

Crear `Code.gs` con configuración explícita e inyección de dependencias:

```js
var GEOEMPLEO_CONFIG={
  catalogUrl:'https://geoempleo360.com/data/calls.json',
  dispatchUrl:'https://api.github.com/repos/Rhon1990/GeoEmpleo/actions/workflows/daily-offers.yml/dispatches',
  tokenProperty:'GEOEMPLEO_GITHUB_TOKEN',
  lastDispatchProperty:'GEOEMPLEO_LAST_DISPATCH_AT',
  cooldownMs:60*60*1000,
  windowStartHour:5,
  windowEndHour:12,
};

function parseCatalogResponse(response,now){
  if(response.status!==200)throw new Error('Catálogo HTTP '+response.status);
  var catalog=JSON.parse(response.body);
  var checkedAt=Date.parse(catalog.checkedAt);
  if(!Number.isFinite(checkedAt)||checkedAt>now+5*60*1000)throw new Error('checkedAt inválido');
  if(!Array.isArray(catalog.calls)||catalog.calls.length===0)throw new Error('Catálogo vacío');
  var ids={};
  catalog.calls.forEach(function(call){
    if(!call||typeof call.id!=='string'||!call.id||ids[call.id])throw new Error('ID inválido o duplicado');
    ids[call.id]=true;
  });
  return {checkedAt:checkedAt,count:catalog.calls.length};
}

function runRefreshCheck(deps){
  var catalog=parseCatalogResponse(deps.fetchCatalog(),deps.now);
  if(deps.formatMadridDay(catalog.checkedAt)===deps.formatMadridDay(deps.now)){
    return {status:'fresh',checkedAt:catalog.checkedAt,count:catalog.count};
  }
  throw new Error('Catálogo atrasado todavía no implementado');
}
```

- [ ] **Step 4: Ejecutar la prueba y comprobar GREEN**

Run: `node --test tests/apps-script-daily-refresh.test.ts`  
Expected: PASS, 1 test, 0 failures.

- [ ] **Step 5: Añadir casos de catálogo atrasado, enfriamiento y errores**

Añadir pruebas que verifiquen:

```ts
function dependencies(overrides:Record<string,unknown>={}){
  const writes:Array<[string,string]>=[];
  let dispatches=0;
  const now=Date.parse('2026-10-29T08:00:00Z');
  return {
    writes,
    dispatches:()=>dispatches,
    value:{
      now,
      fetchCatalog:()=>({status:200,body:JSON.stringify({checkedAt:'2026-10-28T06:00:00Z',calls:[{id:'one'}]})}),
      dispatch:()=>{dispatches++;return {status:204,body:''};},
      getProperty:()=>null,
      setProperty:(name:string,value:string)=>writes.push([name,value]),
      formatMadridDay:(value:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(value),
      ...overrides,
    },
  };
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
```

Cada prueba usará funciones reales del controlador y adaptadores en memoria, sin llamadas de red.

- [ ] **Step 6: Ejecutar RED y confirmar el motivo**

Run: `node --test tests/apps-script-daily-refresh.test.ts`  
Expected: FAIL en los comportamientos aún no implementados, no por sintaxis.

- [ ] **Step 7: Completar adaptadores e instalación idempotente**

Añadir a `Code.gs`:

```js
function runRefreshCheck(deps){
  var catalog=parseCatalogResponse(deps.fetchCatalog(),deps.now);
  if(deps.formatMadridDay(catalog.checkedAt)===deps.formatMadridDay(deps.now)){
    return {status:'fresh',checkedAt:catalog.checkedAt,count:catalog.count};
  }
  var last=Number(deps.getProperty(GEOEMPLEO_CONFIG.lastDispatchProperty)||0);
  if(Number.isFinite(last)&&last>0&&deps.now-last<GEOEMPLEO_CONFIG.cooldownMs){
    return {status:'cooldown',lastDispatchAt:last};
  }
  var response=deps.dispatch();
  if(response.status!==204)throw new Error('GitHub dispatch HTTP '+response.status+': '+response.body);
  deps.setProperty(GEOEMPLEO_CONFIG.lastDispatchProperty,String(deps.now));
  return {status:'dispatched',at:deps.now};
}

function madridDay(value){return Utilities.formatDate(new Date(value),'Europe/Madrid','yyyy-MM-dd');}
function madridHour(value){return Number(Utilities.formatDate(new Date(value),'Europe/Madrid','H'));}

function checkAndDispatch(){
  var now=Date.now();
  var hour=madridHour(now);
  if(hour<GEOEMPLEO_CONFIG.windowStartHour||hour>=GEOEMPLEO_CONFIG.windowEndHour)return {status:'outside-window'};
  var properties=PropertiesService.getScriptProperties();
  var token=properties.getProperty(GEOEMPLEO_CONFIG.tokenProperty);
  if(!token)throw new Error('Falta la propiedad GEOEMPLEO_GITHUB_TOKEN');
  return runRefreshCheck({
    now:now,
    formatMadridDay:madridDay,
    getProperty:function(name){return properties.getProperty(name);},
    setProperty:function(name,value){properties.setProperty(name,value);},
    fetchCatalog:function(){
      var response=UrlFetchApp.fetch(GEOEMPLEO_CONFIG.catalogUrl+'?appsScriptCheck='+now,{muteHttpExceptions:true,headers:{'Cache-Control':'no-cache'}});
      return {status:response.getResponseCode(),body:response.getContentText()};
    },
    dispatch:function(){
      var response=UrlFetchApp.fetch(GEOEMPLEO_CONFIG.dispatchUrl,{method:'post',contentType:'application/json',muteHttpExceptions:true,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},payload:JSON.stringify({ref:'main'})});
      return {status:response.getResponseCode(),body:response.getContentText()};
    },
  });
}

function installRecurringTrigger(){
  ScriptApp.getProjectTriggers().filter(function(trigger){return trigger.getHandlerFunction()==='checkAndDispatch';}).forEach(function(trigger){ScriptApp.deleteTrigger(trigger);});
  ScriptApp.newTrigger('checkAndDispatch').timeBased().everyMinutes(15).create();
}

function installOneTimeTestTrigger(){
  ScriptApp.newTrigger('checkAndDispatch').timeBased().at(new Date(Date.now()+2*60*1000)).create();
}
```

Ampliar el cargador de pruebas para exportar las funciones de integración y
añadir estos casos con servicios falsos:

```ts
async function loadAppsScript(globals:Record<string,unknown>={}){
  const source=await readFile('infra/apps-script-daily-refresh/Code.gs','utf8');
  const context:Record<string,unknown>={...globals};
  runInNewContext(`${source}\nthis.__exports={checkAndDispatch,installRecurringTrigger,installOneTimeTestTrigger};`,context);
  return context.__exports as {checkAndDispatch:Function;installRecurringTrigger:Function;installOneTimeTestTrigger:Function};
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
```

- [ ] **Step 8: Ejecutar GREEN y regresión Node completa**

Run: `node --test tests/apps-script-daily-refresh.test.ts`  
Expected: todos los casos PASS.  
Run: `npm test`  
Expected: 0 failures.

- [ ] **Step 9: Commit**

```bash
git add infra/apps-script-daily-refresh/Code.gs tests/apps-script-daily-refresh.test.ts
git commit -m "feat: añadir disparador externo de actualización"
```

### Task 2: Operación segura y documentación

**Files:**
- Create: `infra/apps-script-daily-refresh/README.md`
- Modify: `docs/fuentes-de-ofertas.md`
- Modify: `docs/project-context.md`

- [ ] **Step 1: Documentar aprovisionamiento y recuperación**

El README debe exigir estos pasos exactos:

1. Crear un token fino en GitHub, limitado a `Rhon1990/GeoEmpleo`, permiso de repositorio `Actions: Read and write`, sin otros permisos, y caducidad máxima aceptada por el usuario.
2. Crear un proyecto independiente en `script.google.com`, zona horaria `Europe/Madrid`, y copiar `Code.gs`.
3. Crear la propiedad de script `GEOEMPLEO_GITHUB_TOKEN`; nunca pegar el valor en código, Git, logs ni chat.
4. Ejecutar `installOneTimeTestTrigger` dentro de la ventana matinal para conceder permisos sin despachar inmediatamente.
5. Observar que el trigger, no el botón de GitHub ni Codex, crea el run y recibe HTTP 204.
6. Ejecutar `installRecurringTrigger` una sola vez y comprobar que solo exista un trigger cada 15 minutos.
7. Documentar rotación del token, lectura de ejecuciones y desactivación segura.

- [ ] **Step 2: Actualizar contexto operativo**

En `docs/fuentes-de-ofertas.md` y `docs/project-context.md`, distinguir:

- GitHub `schedule`: respaldo gratuito que puede retrasarse u omitirse.
- Apps Script: disparador externo principal, sin ingesta ni datos propios.
- GitHub Actions: único pipeline de ingesta y despliegue.
- Firebase Hosting: destino, no programador.
- Evidencia todavía pendiente hasta completar la prueba real.

- [ ] **Step 3: Verificar documentación**

Run:

```bash
rg -n "GEOEMPLEO_GITHUB_TOKEN|Apps Script|geoempleo360.com|cada 15 minutos" infra/apps-script-daily-refresh/README.md docs/fuentes-de-ofertas.md docs/project-context.md
rg -n "TBD|TODO|pegar.*token.*código" infra/apps-script-daily-refresh docs/fuentes-de-ofertas.md docs/project-context.md
git diff --check
```

Expected: referencias coherentes, sin placeholders ni espacios erróneos.

- [ ] **Step 4: Commit**

```bash
git add infra/apps-script-daily-refresh/README.md docs/fuentes-de-ofertas.md docs/project-context.md
git commit -m "docs: operar actualización mediante Apps Script"
```

### Task 3: Aprovisionamiento y prueba real

**Files:**
- No repository file changes expected.

- [ ] **Step 1: Crear el token restringido**

En GitHub, crear el token fino con propietario `Rhon1990`, repositorio único
`GeoEmpleo` y permiso `Actions: write`. No conceder `Contents: write`,
`Administration`, acceso a otros repositorios ni permisos de organización.

- [ ] **Step 2: Crear y configurar el proyecto Apps Script**

Crear el proyecto `GeoEmpleo360 Daily Refresh`, seleccionar `Europe/Madrid`,
copiar el archivo verificado y guardar el token como propiedad del script.

- [ ] **Step 3: Prueba automática independiente**

Ejecutar `installOneTimeTestTrigger`, cerrar la consola y esperar el trigger. La
evidencia válida es un run creado sin usar el botón de GitHub, Codex ni terminal.

- [ ] **Step 4: Verificar pipeline y publicación**

Comprobar en el run:

- `prepare-daily-refresh` recupera el catálogo público.
- `ingest:daily` termina `success` o `partial`, nunca `failed` publicado.
- build y Firebase deploy correctos.
- verificación HTTPS correcta en ambos dominios.

Después consultar ambos JSON y confirmar: mismo `checkedAt` del día, igual número
de ofertas e IDs únicos.

- [ ] **Step 5: Instalar la recurrencia y retirar la prueba**

Ejecutar `installRecurringTrigger`, comprobar un único trigger de 15 minutos y
eliminar cualquier trigger de una sola ejecución que siga visible.

### Task 4: Validación final e integración

**Files:**
- Modify: `docs/project-context.md` solamente para registrar evidencia real.

- [ ] **Step 1: Ejecutar la suite completa**

Run: `npm run check`  
Expected: typecheck, pruebas Node, OpenAPI y fixtures Python sin fallos.

- [ ] **Step 2: Registrar evidencia real**

Actualizar `docs/project-context.md` con fecha/hora Europe/Madrid, ID del run,
resultado, `checkedAt`, cantidad de IDs únicos, igualdad de ambos dominios y
estado del trigger recurrente. No declarar éxito si falta cualquiera.

- [ ] **Step 3: Revisar cambios y secretos**

Run:

```bash
git diff --check
git grep -nE 'github_pat_|ghp_|GEOEMPLEO_GITHUB_TOKEN=.+'
git status --short
```

Expected: ninguna credencial en Git y solo archivos previstos.

- [ ] **Step 4: Commit y publicación por PR**

```bash
git add docs/project-context.md
git commit -m "docs: registrar actualización externa verificada"
git push -u origin codex/apps-script-daily-refresh
gh pr create --base main --head codex/apps-script-daily-refresh --title "feat: asegurar actualización diaria con Apps Script" --body-file /tmp/geoempleo-apps-script-pr.md
```

Integrar únicamente después de que las verificaciones del PR pasen y la prueba
real confirme el flujo completo.
