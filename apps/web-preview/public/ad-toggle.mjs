export const isAdsEnabled=value=>value==='true';

const loadFirebaseSdk=()=>Promise.all([
  import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/13.1.0/firebase-remote-config.js'),
]);

export async function observeAdsToggle(firebaseConfig,onChange,{loadSdk=loadFirebaseSdk}={}) {
  if(!firebaseConfig?.apiKey||!firebaseConfig?.projectId||!firebaseConfig?.appId)return ()=>{};
  try {
    const [appSdk,remoteSdk]=await loadSdk();
    if(!await remoteSdk.isSupported())return ()=>{};
    const app=appSdk.getApps().find(item=>item.options.appId===firebaseConfig.appId)??appSdk.initializeApp(firebaseConfig);
    const remote=remoteSdk.getRemoteConfig(app);
    remote.defaultConfig={ads_footer_enabled:'false'};
    remote.settings.minimumFetchIntervalMillis=3600000;
    await remoteSdk.fetchAndActivate(remote);
    onChange(isAdsEnabled(remoteSdk.getValue(remote,'ads_footer_enabled').asString()));
    return remoteSdk.onConfigUpdate(remote,{
      next:async update=>{
        if(!update.getUpdatedKeys().has('ads_footer_enabled'))return;
        await remoteSdk.activate(remote);
        onChange(isAdsEnabled(remoteSdk.getValue(remote,'ads_footer_enabled').asString()));
      },
      error:()=>onChange(false),
    });
  } catch {
    onChange(false);
    return ()=>{};
  }
}
