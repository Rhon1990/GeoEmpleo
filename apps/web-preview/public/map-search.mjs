import {isPoint} from './geography.mjs';

/**
 * One position request, no tracking, persistence or compulsory high-accuracy GPS.
 * @param {Pick<Geolocation,'getCurrentPosition'> | null | undefined} provider
 * @returns {Promise<{status:string,point?:number[],zoom?:number}>}
 */
export function locateOnce(provider=globalThis.navigator?.geolocation) {
  if(!provider?.getCurrentPosition) return Promise.resolve({status:'unavailable'});
  return new Promise(resolve=>{
    let finished=false;
    const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);resolve(result);};
    const timer=setTimeout(()=>finish({status:'timeout'}),9000);
    try {
      provider.getCurrentPosition(position=>{
        const point=[position.coords.longitude,position.coords.latitude];
        const accuracy=position.coords.accuracy;
        if(!isPoint(point)||!Number.isFinite(accuracy)||accuracy<0){finish({status:'unavailable'});return;}
        finish({status:'located',point,zoom:accuracy>20000?8:accuracy>5000?10:12});
      },error=>finish({status:error.code===1?'denied':error.code===3?'timeout':'unavailable'}),{enableHighAccuracy:false,maximumAge:300000,timeout:8000});
    }catch{finish({status:'unavailable'});}
  });
}

/**
 * Latest-query-wins even when a transport ignores AbortSignal.
 * @param {{endpoint?:string,fetchImpl?:(url:string,options:{signal:AbortSignal})=>Promise<Response>,schedule?:(callback:()=>void,delay:number)=>any,cancel?:(handle:any)=>void,onResult?:(result:unknown)=>void,onError?:(error:unknown)=>void,onLoading?:()=>void}} options
 */
export function createViewportSearch({endpoint='/api/jobs',fetchImpl=fetch,schedule=setTimeout,cancel=clearTimeout,onResult=()=>{},onError=()=>{},onLoading=()=>{}}={}) {
  let timer;
  let active;
  let revision=0;
  let desiredKey=null;
  let appliedKey=null;
  function cancelPending() {
    revision++;
    if(timer!==undefined){cancel(timer);timer=undefined;}
    active?.abort();active=null;
  }
  async function execute(key,token) {
    const controller=new AbortController();active=controller;
    onLoading();
    try {
      const response=await fetchImpl(`${endpoint}${key?`?${key}`:''}`,{signal:controller.signal});
      if(!response.ok)throw new Error('Consulta no disponible');
      const result=await response.json();
      if(token!==revision||controller.signal.aborted)return;
      appliedKey=key;active=null;onResult(result);
    }catch(error){
      if(token!==revision||controller.signal.aborted)return;
      active=null;desiredKey=null;onError(error);
    }
  }
  return {
    request(params,{immediate=false,force=false}={}) {
      const key=params.toString();
      if(!force&&key===desiredKey&&(timer!==undefined||active||appliedKey===key))return;
      cancelPending();desiredKey=key;
      const token=revision;
      if(immediate)void execute(key,token);
      else timer=schedule(()=>{timer=undefined;void execute(key,token);},350);
    },
    cancel(){cancelPending();desiredKey=null;appliedKey=null;},
  };
}
