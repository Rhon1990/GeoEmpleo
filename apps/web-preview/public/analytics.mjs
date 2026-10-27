const consentKey='geoempleo-analytics-consent';
const eventNames=new Set(['page_view','search_submitted','filter_used','offer_detail_opened','map_action']);
const filterTypes=new Set(['category','employer','territory','distance']);
const mapActions=new Set(['show_map','search_visible_area','use_my_location','show_spain','choose_zone']);
const routes=new Set(['/','/publicar']);

function validConfig(config) {
  return ['apiKey','appId','projectId','measurementId'].every(key=>typeof config?.[key]==='string'&&config[key].trim());
}

function currentPagePath(location) {
  return routes.has(location?.pathname)?location.pathname:'/';
}

/** @param {{config?:object,storage?:Storage,loadSdk?:()=>Promise<object>,location?:Location}} options */
export function createAnalyticsController({config,storage=globalThis.localStorage,loadSdk,location=globalThis.location}={}) {
  let firebaseConfig=config;
  let sdkPromise=null;
  let analytics=null;
  let accepted=false;

  const readPreference=()=>{
    try{return storage?.getItem(consentKey)??null;}catch{return null;}
  };
  const savePreference=value=>{
    try{storage?.setItem(consentKey,value);}catch{}
  };
  const consent=value=>({analytics_storage:value,ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});

  async function initialize() {
    accepted=true;
    if(!validConfig(firebaseConfig)||typeof loadSdk!=='function')return false;
    if(!sdkPromise)sdkPromise=Promise.resolve().then(async()=>{
      loadedSdk=await loadSdk();
      if(!accepted)return null;
      loadedSdk.setConsent(null,consent('denied'));
      return loadedSdk.init({
        config:firebaseConfig,
        analyticsConfig:{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false},
      });
    }).then(instance=>{if(instance)analytics=instance;return instance;}).catch(()=>{sdkPromise=null;loadedSdk=null;return null;});
    const instance=await sdkPromise;
    if(!instance)return false;
    if(!accepted){
      try{loadedSdk.setConsent(analytics,consent('denied'));loadedSdk.setCollectionEnabled(analytics,false);}catch{}
      return false;
    }
    try{loadedSdk.setConsent(analytics,consent('granted'));}catch{return false;}
    return true;
  }

  let loadedSdk=null;

  async function initializeFromPreference() {
    if(readPreference()!=='accepted')return false;
    accepted=true;
    return initialize();
  }

  async function accept() {
    savePreference('accepted');
    accepted=true;
    if(analytics){
      try{
        loadedSdk.setConsent(analytics,consent('granted'));
        loadedSdk.setCollectionEnabled(analytics,true);
        return true;
      }catch{return false;}
    }
    return initialize();
  }

  async function reject() {
    accepted=false;
    savePreference('rejected');
    if(analytics){
      try{
        loadedSdk.setConsent(analytics,consent('denied'));
        loadedSdk.setCollectionEnabled(analytics,false);
      }catch{}
    }
  }

  async function track(name,params={}) {
    if(!accepted||!analytics||!eventNames.has(name))return false;
    let safeParams={};
    if(name==='page_view'){
      if(Object.keys(params).length)return false;
      safeParams={page_path:currentPagePath(location)};
    }
    else if(name==='filter_used'){
      if(Object.keys(params).some(key=>key!=='filter_type')||!filterTypes.has(params.filter_type))return false;
      safeParams={filter_type:params.filter_type};
    }else if(name==='map_action'){
      if(Object.keys(params).some(key=>key!=='action')||!mapActions.has(params.action))return false;
      safeParams={action:params.action};
    }else if(Object.keys(params).length)return false;
    try{
      loadedSdk.setConsent(analytics,consent('granted'));
      loadedSdk.logEvent(analytics,name,safeParams);
      return true;
    }catch{return false;}
  }

  return {initializeFromPreference,accept,reject,revoke:reject,track,getPreference:readPreference,setConfig:value=>{firebaseConfig=value;}};
}

export async function loadFirebaseAnalytics() {
  const [appSdk,analyticsSdk]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js'),
  ]);
  let app;
  let instance;
  return {
    init:async({config:firebaseConfig,analyticsConfig})=>{
      app=appSdk.initializeApp(firebaseConfig);
      if(!await analyticsSdk.isSupported())throw new Error('Firebase Analytics no está disponible en este navegador.');
      instance=analyticsSdk.initializeAnalytics(app,{config:analyticsConfig});
      return instance;
    },
    setConsent:(analytics,status)=>analyticsSdk.setConsent(status),
    setCollectionEnabled:(analytics,enabled)=>analyticsSdk.setAnalyticsCollectionEnabled(analytics,enabled),
    logEvent:(analytics,name,params)=>analyticsSdk.logEvent(analytics,name,params),
  };
}
