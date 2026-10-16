import {isPoint} from './geography.mjs';
import {createOriginSelection} from './map-state.mjs';

let sdkPromise;

export function viewportPoints(calls,origin) {
  const points = [];
  const seen = new Set();
  for (const point of [origin,...calls.map(call => call.location?.point)]) {
    if (!isPoint(point)) continue;
    const key = `${point[0]},${point[1]}`;
    if (seen.has(key)) continue;
    seen.add(key); points.push(point);
  }
  return points;
}

export function cameraPlan(calls,origin) {
  const points = viewportPoints(calls,origin);
  if (points.length === 0) return {mode:'none',points};
  if (points.length === 1) return {mode:'focus',points};
  return {mode:'bounds',points};
}

// Screen-space groups retain a real member point; the label identifies an area, not a job address.
export function markerGroups(calls,zoom=20) {
  const groups=[];
  const scale=256*2**zoom;
  const pixel=point=>{
    const latitude=Math.max(-85.05,Math.min(85.05,point[1]))*Math.PI/180;
    return [(point[0]+180)/360*scale,(1-Math.log(Math.tan(latitude)+1/Math.cos(latitude))/Math.PI)/2*scale];
  };
  for(const call of calls) {
    if(!isPoint(call.location?.point)) continue;
    const point=call.location.point;
    const position=pixel(point);
    let group=groups.find(candidate=>Math.hypot(candidate.pixel[0]-position[0],candidate.pixel[1]-position[1])<80);
    if(!group){group={key:point.join(','),point:[...point],pixel:position,calls:[]};groups.push(group);}
    group.calls.push(call);
  }
  return groups;
}

export const expandedZoom=(current,fitted)=>fitted>current?fitted:current+1;

export function markerVisualState(ids,selectedId,previewId) {
  const selected=selectedId!==null&&ids.includes(selectedId);
  const previewed=!selected&&previewId!==null&&ids.includes(previewId);
  return {selected,previewed,zIndex:selected?100:previewed?50:1};
}

function loadSdk(key) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(new Error('Google Maps no respondió. Revisa conexión y clave.')),20000);
    window.geoEmpleoMapsReady = () => {clearTimeout(timer); resolve(window.google); delete window.geoEmpleoMapsReady;};
    window.gm_authFailure = () => {clearTimeout(timer); reject(new Error('Google rechazó la clave. Revisa API, facturación y restricciones.'));};
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    for (const [name,value] of Object.entries({key,callback:'geoEmpleoMapsReady',loading:'async',v:'weekly',language:'es',region:'ES'})) url.searchParams.set(name,value);
    const script = document.createElement('script'); script.src = url.href; script.async = true;
    script.nonce = document.querySelector('script[nonce]')?.nonce ?? '';
    script.onerror = () => {clearTimeout(timer); reject(new Error('No se pudo cargar Google Maps.'));};
    document.head.append(script);
  });
  return sdkPromise;
}

/** Un mapa por página; actualizar markers no genera una nueva instancia Map. */
export async function createGoogleMap(host,config,events,initial={}) {
  const google = await loadSdk(config.googleMapsApiKey);
  const [{Map:GoogleMap},{AdvancedMarkerElement}] = await Promise.all([google.maps.importLibrary('maps'),google.maps.importLibrary('marker')]);
  const map = new GoogleMap(host,{center:isPoint(initial.point)?{lat:initial.point[1],lng:initial.point[0]}:{lat:39.7,lng:-3.5},zoom:initial.zoom??6,mapId:config.googleMapsMapId || 'DEMO_MAP_ID',streetViewControl:false,mapTypeControl:false,fullscreenControl:true,gestureHandling:'greedy'});
  const markers = new window.Map();
  let originMarker;
  let radiusCircle;
  const originSelection = createOriginSelection(point => events.onOrigin(point));
  let selectedId = null;
  let previewId = null;
  let knownCalls = [];
  const infoWindow=new google.maps.InfoWindow({disableAutoPan:true});
  map.addListener('click',event => {
    if (!event.latLng) return;
    originSelection.capture([event.latLng.lng(),event.latLng.lat()]);
  });
  function updateMarkerVisuals() {
    for (const item of markers.values()) {
      const state=markerVisualState(item.ids,selectedId,previewId);
      item.pin.classList.toggle('selected',state.selected);
      item.pin.classList.toggle('previewed',state.previewed);
      item.marker.zIndex=state.zIndex;
    }
  }
  function select(id,{pan=true}={}) {
    selectedId = id;
    previewId = null;
    updateMarkerVisuals();
    const call = knownCalls.find(item => item.id === id);
    if (pan&&call&&isPoint(call.location?.point)) map.panTo({lat:call.location.point[1],lng:call.location.point[0]});
  }
  function preview(id) {previewId=id;updateMarkerVisuals();}
  function renderMarkers() {
      infoWindow.close();
      for(const item of markers.values()) item.marker.map=null;
      markers.clear();
      for(const group of markerGroups(knownCalls,map.getZoom()??6)) {
        const pin=document.createElement('div');pin.className='job-pin';
        pin.textContent=`${group.calls.length} ${group.calls.length===1?'oferta':'ofertas'}`;
        const severalLocations=new Set(group.calls.map(call=>call.location.point.join(','))).size>1;
        const title=severalLocations?`${group.calls.length} ofertas en esta zona; ampliar mapa`:`${group.calls.length} ofertas en ${group.calls[0].city} · ubicación municipal aproximada`;
        const marker=new AdvancedMarkerElement({map,position:{lng:group.point[0],lat:group.point[1]},gmpClickable:true,title,zIndex:1});
        marker.append(pin);
        marker.addListener('click',()=>{
          if(severalLocations){
            const bounds=new google.maps.LatLngBounds();
            for(const call of group.calls) bounds.extend({lng:call.location.point[0],lat:call.location.point[1]});
            const previousZoom=map.getZoom()??6;
            const listener=map.addListener('idle',()=>{
              listener.remove();
              const fitted=map.getZoom()??previousZoom;
              const next=expandedZoom(previousZoom,fitted);
              if(next!==fitted) map.setZoom(next);
            });
            map.fitBounds(bounds,40);return;
          }
          if(group.calls.length===1){select(group.calls[0].id,{pan:false});events.onSelect(group.calls[0].id);return;}
          const panel=document.createElement('div');panel.className='map-job-group';
          const heading=document.createElement('h3');heading.textContent=`${group.calls.length} ofertas · ${group.calls[0].city}`;panel.append(heading);
          for(const call of group.calls){
            const button=document.createElement('button');button.type='button';button.textContent=call.title;
            button.addEventListener('click',()=>{infoWindow.close();select(call.id,{pan:false});events.onSelect(call.id);});panel.append(button);
          }
          infoWindow.setContent(panel);infoWindow.open({map,anchor:marker});
        });
        markers.set(group.key,{marker,pin,ids:group.calls.map(call=>call.id)});
      }
    updateMarkerVisuals();
  }
  map.addListener('zoom_changed',renderMarkers);
  map.addListener('idle',()=>events.onViewport?.());
  return {
    select,
    preview,
    clearSelection() {selectedId=null;previewId=null;updateMarkerVisuals();},
    focus(point,zoom=12) {if(!isPoint(point))return;map.setCenter({lng:point[0],lat:point[1]});map.setZoom(zoom);},
    overview() {map.setCenter({lat:39.7,lng:-3.5});map.setZoom(6);},
    chooseOrigin() {originSelection.arm();map.setOptions({draggableCursor:'crosshair'});},
    cancelOriginSelection() {originSelection.cancel();map.setOptions({draggableCursor:null});},
    bounds() {const bounds = map.getBounds(); if (!bounds) return null; return [bounds.getSouthWest().lng(),bounds.getSouthWest().lat(),bounds.getNorthEast().lng(),bounds.getNorthEast().lat()];},
    update(calls,origin,radiusKm) {
      knownCalls = calls;
      renderMarkers();
      if (originMarker) {originMarker.map = null; originMarker = undefined;}
      if (radiusCircle) {radiusCircle.setMap(null); radiusCircle = undefined;}
      if (isPoint(origin)) {
        const position = {lat:origin[1],lng:origin[0]};
        const pin = document.createElement('div'); pin.className = 'origin-pin'; pin.textContent = 'Tu zona';
        originMarker = new AdvancedMarkerElement({map,position,title:'Origen elegido para buscar',zIndex:0}); originMarker.append(pin);
        if (radiusKm != null) radiusCircle = new google.maps.Circle({map,center:position,radius:radiusKm*1000,strokeColor:'#4e7950',strokeWeight:1,fillColor:'#6ea967',fillOpacity:.12,clickable:false});
      }
      updateMarkerVisuals();
      map.setOptions({draggableCursor:originSelection.isActive() ? 'crosshair' : null});
    },
    fit(calls,origin) {
      const plan = cameraPlan(calls,origin);
      if (plan.mode === 'none') return;
      if (plan.mode === 'focus') {
        map.panTo({lat:plan.points[0][1],lng:plan.points[0][0]});
        map.setZoom(10);
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      for (const point of plan.points) bounds.extend({lat:point[1],lng:point[0]});
      map.fitBounds(bounds,60);
    },
  };
}
