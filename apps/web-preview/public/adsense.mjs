const publisherPattern=/^ca-pub-\d{16}$/;
const slotPattern=/^\d{6,20}$/;
const requestedSlots=new WeakSet();
const slotObservers=new WeakMap();

export function adInsertionIndex(resultCount,config) {
  if(config?.enabled!==true||!Number.isInteger(resultCount)||resultCount<9)return null;
  return 8;
}

export function validAdSensePublisher(publisherId) {
  return typeof publisherId==='string'&&publisherPattern.test(publisherId);
}

export function loadAdSensePublisher(publisherId,{document=globalThis.document}={}) {
  if(!validAdSensePublisher(publisherId)||!document?.head)return Promise.resolve(false);
  const selector=`script[data-geoempleo-adsense="${publisherId}"]`;
  const existing=document.querySelector(selector);
  if(existing?.dataset.loaded==='true')return Promise.resolve(true);
  if(existing?.dataset.failed==='true')existing.remove();
  else if(existing)return new Promise(resolve=>{
    existing.addEventListener('load',()=>resolve(true),{once:true});
    existing.addEventListener('error',()=>resolve(false),{once:true});
  });

  const script=document.createElement('script');
  script.async=true;
  script.crossOrigin='anonymous';
  script.dataset.geoempleoAdsense=publisherId;
  script.src=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
  return new Promise(resolve=>{
    script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(true);},{once:true});
    script.addEventListener('error',()=>{script.dataset.failed='true';resolve(false);},{once:true});
    document.head.append(script);
  });
}

export function requestAdSlot(slot,config,windowObject=globalThis) {
  if(!slot||config?.enabled!==true||!validAdSensePublisher(config.publisherId)||!slotPattern.test(config.slotId)||requestedSlots.has(slot))return false;
  slot.dataset.adClient=config.publisherId;
  slot.dataset.adSlot=config.slotId;
  slot.dataset.adFormat='auto';
  slot.dataset.fullWidthResponsive='true';
  slot.style.display='block';
  try {
    (windowObject.adsbygoogle=windowObject.adsbygoogle||[]).push({});
    requestedSlots.add(slot);
    return true;
  } catch {
    return false;
  }
}

export function watchAdStatus(slot,container,{MutationObserverClass=globalThis.MutationObserver}={}) {
  if(!slot||!container||typeof MutationObserverClass!=='function')return false;
  const observer=new MutationObserverClass(()=>{
    if(slot.dataset.adStatus==='filled')container.hidden=false;
    else if(slot.dataset.adStatus==='unfilled')container.hidden=true;
  });
  observer.observe(slot,{attributes:true,attributeFilter:['data-ad-status']});
  slotObservers.set(slot,observer);
  return true;
}
