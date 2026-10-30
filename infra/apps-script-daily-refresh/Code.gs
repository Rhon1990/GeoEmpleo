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
  var last=Number(deps.getProperty(GEOEMPLEO_CONFIG.lastDispatchProperty)||0);
  if(Number.isFinite(last)&&last>0&&deps.now-last<GEOEMPLEO_CONFIG.cooldownMs){
    return {status:'cooldown',lastDispatchAt:last};
  }
  var response=deps.dispatch();
  if(response.status!==204)throw new Error('GitHub dispatch HTTP '+response.status+': '+response.body);
  deps.setProperty(GEOEMPLEO_CONFIG.lastDispatchProperty,String(deps.now));
  return {status:'dispatched',at:deps.now};
}

function madridDay(value){
  return Utilities.formatDate(new Date(value),'Europe/Madrid','yyyy-MM-dd');
}

function madridHour(value){
  return Number(Utilities.formatDate(new Date(value),'Europe/Madrid','H'));
}

function checkAndDispatch(){
  var now=Date.now();
  var hour=madridHour(now);
  if(hour<GEOEMPLEO_CONFIG.windowStartHour||hour>=GEOEMPLEO_CONFIG.windowEndHour){
    return {status:'outside-window'};
  }
  var properties=PropertiesService.getScriptProperties();
  var token=properties.getProperty(GEOEMPLEO_CONFIG.tokenProperty);
  if(!token)throw new Error('Falta la propiedad GEOEMPLEO_GITHUB_TOKEN');
  return runRefreshCheck({
    now:now,
    formatMadridDay:madridDay,
    getProperty:function(name){return properties.getProperty(name);},
    setProperty:function(name,value){properties.setProperty(name,value);},
    fetchCatalog:function(){
      var response=UrlFetchApp.fetch(GEOEMPLEO_CONFIG.catalogUrl+'?appsScriptCheck='+now,{
        muteHttpExceptions:true,
        headers:{'Cache-Control':'no-cache'},
      });
      return {status:response.getResponseCode(),body:response.getContentText()};
    },
    dispatch:function(){
      var response=UrlFetchApp.fetch(GEOEMPLEO_CONFIG.dispatchUrl,{
        method:'post',
        contentType:'application/json',
        muteHttpExceptions:true,
        headers:{
          Authorization:'Bearer '+token,
          Accept:'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28',
        },
        payload:JSON.stringify({ref:'main'}),
      });
      return {status:response.getResponseCode(),body:response.getContentText()};
    },
  });
}

function installRecurringTrigger(){
  ScriptApp.getProjectTriggers()
    .filter(function(trigger){return trigger.getHandlerFunction()==='checkAndDispatch';})
    .forEach(function(trigger){ScriptApp.deleteTrigger(trigger);});
  ScriptApp.newTrigger('checkAndDispatch').timeBased().everyMinutes(15).create();
}

function installOneTimeTestTrigger(){
  ScriptApp.newTrigger('checkAndDispatch').timeBased().at(new Date(Date.now()+2*60*1000)).create();
}
