import {isPoint} from './geography.mjs';

const EARTH_RADIUS_KM=6371.0088;
const WORLD_SIZE=256;
const MAX_MERCATOR_LATITUDE=85.05112878;

/** @param {number[]} origin @param {number} radiusKm @returns {number[]|null} */
export function radiusBounds(origin,radiusKm) {
  if(!isPoint(origin)||!Number.isFinite(radiusKm)||radiusKm<=0)return null;
  const angularRadius=radiusKm/EARTH_RADIUS_KM;
  const latitudeDelta=angularRadius*180/Math.PI;
  const south=Math.max(-MAX_MERCATOR_LATITUDE,origin[1]-latitudeDelta);
  const north=Math.min(MAX_MERCATOR_LATITUDE,origin[1]+latitudeDelta);
  const limitingLatitude=Math.max(Math.abs(south),Math.abs(north))*Math.PI/180;
  const longitudeRatio=Math.sin(angularRadius)/Math.cos(limitingLatitude);
  const longitudeDelta=longitudeRatio>=1?180:Math.asin(longitudeRatio)*180/Math.PI;
  return [origin[0]-longitudeDelta,south,origin[0]+longitudeDelta,north];
}

const mercatorY=latitude=>{
  const radians=Math.max(-MAX_MERCATOR_LATITUDE,Math.min(MAX_MERCATOR_LATITUDE,latitude))*Math.PI/180;
  return (1-Math.asinh(Math.tan(radians))/Math.PI)/2;
};
const inverseMercatorY=y=>Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI;

/** @param {number[]} bounds @param {{width:number,height:number}} viewport @param {number} padding @param {number[]|null} [centerOverride] @returns {{center:number[],zoom:number}} */
export function boundsCameraTarget(bounds,viewport,padding=0,centerOverride=null) {
  const [west,south,east,north]=bounds;
  const availableWidth=Math.max(1,viewport.width-padding*2);
  const availableHeight=Math.max(1,viewport.height-padding*2);
  const westX=(west+180)/360;
  const eastX=(east+180)/360;
  const southY=mercatorY(south);
  const northY=mercatorY(north);
  const widthSpan=Math.max(Number.EPSILON,eastX-westX);
  const heightSpan=Math.max(Number.EPSILON,southY-northY);
  const zoom=Math.max(0,Math.min(21,Math.log2(Math.min(availableWidth/(WORLD_SIZE*widthSpan),availableHeight/(WORLD_SIZE*heightSpan)))));
  const centerX=(westX+eastX)/2;
  const centerY=(northY+southY)/2;
  return {center:isPoint(centerOverride)?[...centerOverride]:[centerX*360-180,inverseMercatorY(centerY)],zoom};
}

/** @param {{center:number[],zoom:number}} camera */
const copyCamera=camera=>({center:[...camera.center],zoom:camera.zoom});

/** @param {{apply:(camera:{center:number[],zoom:number})=>void,getCurrent:()=>{center:number[],zoom:number},requestFrame?:(callback:(time:number)=>void)=>number,cancelFrame?:(id:number)=>void,durationMs?:number,reducedMotion?:boolean|(()=>boolean)}} options */
export function createCameraTransition({apply,getCurrent,requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id),durationMs=420,reducedMotion=false}) {
  let activeFrame;
  let revision=0;
  const stop=()=>{
    revision++;
    if(activeFrame!==undefined){cancelFrame(activeFrame);activeFrame=undefined;}
  };
  return {
    cancel:stop,
    animate(destination) {
      stop();
      const token=revision;
      const from=copyCamera(getCurrent());
      const to=copyCamera(destination);
      if((typeof reducedMotion==='function'?reducedMotion():reducedMotion)||durationMs<=0){apply(to);return;}
      let startedAt;
      const step=time=>{
        if(token!==revision)return;
        startedAt??=time;
        const progress=Math.min(1,(time-startedAt)/durationMs);
        const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
        apply({center:[from.center[0]+(to.center[0]-from.center[0])*eased,from.center[1]+(to.center[1]-from.center[1])*eased],zoom:from.zoom+(to.zoom-from.zoom)*eased});
        if(progress>=1){activeFrame=undefined;return;}
        activeFrame=requestFrame(step);
      };
      activeFrame=requestFrame(step);
    },
  };
}
