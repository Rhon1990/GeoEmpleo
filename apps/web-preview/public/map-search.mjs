import {isPoint,matchesGeography} from './geography.mjs';

export function visibleMapJobs(page,origin,radiusKm) {
  return (page?.mapJobs??page?.jobs??[]).filter(job=>matchesGeography(job,{origin,radiusKm}));
}

export function searchGeography(origin,radiusValue,hasTerritory=false) {
  if(hasTerritory)return {origin:null,radiusKm:null};
  const radiusKm=origin&&radiusValue?Number(radiusValue):null;
  return {origin,radiusKm:Number.isFinite(radiusKm)?radiusKm:null};
}

export function originSearchTransition(point) {
  if(!isPoint(point))throw new TypeError('El origen debe ser un punto válido.');
  return {origin:[...point],territory:'',bounds:null,pendingTerritory:null};
}

export function updateMapWithoutLosingJobs(controller,jobs,origin,radiusKm,onFailure=()=>{}) {
  if(!controller)return true;
  try {controller.update(jobs,origin,radiusKm);return true;}
  catch {onFailure();return false;}
}

/**
 * A hidden map has no usable viewport. Keep its last visible area, or use list search.
 * @param {number[]|null|undefined} bounds
 * @param {boolean} visible
 * @param {number[]|null} [previous]
 * @param {boolean} [territoryChanged]
 * @returns {number[]|null}
 */
export function resolveSearchBounds(bounds,visible,previous=null,territoryChanged=false) {
  if(territoryChanged)return null;
  if(!visible||!bounds||bounds.length!==4||!bounds.every(Number.isFinite))return previous;
  const [west,south,east,north]=bounds;
  if(west===east||south>=north)return previous;
  return [...bounds];
}

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
        finish({status:'located',point,zoom:accuracy>20000?8:accuracy>5000?9:10});
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
