import {isPoint} from './geography.mjs';
import {loadSdk} from './google-map.mjs';

const salaryModes=new Set(['fixed','range','unknown']);

export function salaryFieldState(mode) {
  if(!salaryModes.has(mode))throw new RangeError('Modo de salario no válido.');
  return {
    fieldsHidden:mode==='unknown',
    minRequired:mode!=='unknown',
    maxVisible:mode==='range',
    maxRequired:mode==='range',
  };
}

function minorUnits(value) {
  const normalized=String(value??'').trim().replace(',','.');
  if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))throw new TypeError('Revisa el importe del salario.');
  const [units,cents='']=normalized.split('.');
  const amount=Number(units)*100+Number(cents.padEnd(2,'0'));
  if(!Number.isSafeInteger(amount)||amount<=0)throw new TypeError('Revisa el importe del salario.');
  return amount;
}

function buildSalary(values) {
  const mode=String(values.salaryMode??'');
  if(!salaryModes.has(mode))throw new TypeError('Revisa el salario.');
  if(mode==='unknown')return null;
  const minMinor=minorUnits(values.salaryMin);
  const maxMinor=mode==='range'?minorUnits(values.salaryMax):minMinor;
  if(minMinor>maxMinor)throw new TypeError('El mínimo del salario no puede superar el máximo.');
  if(!['hour','month','year'].includes(values.period)||!['gross','net'].includes(values.basis))throw new TypeError('Revisa el periodo y el tipo de salario.');
  let paymentsPerYear=null;
  if(values.period==='month'&&String(values.payments??'').trim()) {
    paymentsPerYear=Number(values.payments);
    if(!Number.isInteger(paymentsPerYear)||paymentsPerYear<1||paymentsPerYear>24)throw new TypeError('Revisa el número de pagas.');
  }
  return {minMinor,maxMinor,currency:'EUR',period:values.period,basis:values.basis,paymentsPerYear};
}

export function buildSubmissionPayload(values,point) {
  if(values.locationConfirmed!==true||!isPoint(point))throw new TypeError('Confirma la ubicación exacta del centro de trabajo.');
  return {
    title:String(values.title??''),
    employer:String(values.employer??''),
    description:String(values.description??''),
    city:String(values.city??''),
    province:String(values.province??''),
    region:String(values.region??''),
    address:String(values.address??''),
    point:[...point],
    locationConfirmed:true,
    managerEmail:String(values.managerEmail??''),
    contactEmail:String(values.contactEmail??''),
    contactPhone:String(values.contactPhone??''),
    consent:values.consent===true,
    salary:buildSalary(values),
  };
}

/** @param {(state:{point:number[]|null,confirmed:boolean})=>void} onChange */
export function createPointSelection(onChange=()=>{}) {
  let point=null;
  let confirmed=false;
  const notify=()=>onChange({point:point?[...point]:null,confirmed});
  return {
    select(next) {
      if(!isPoint(next))throw new TypeError('Punto no válido.');
      point=[...next];confirmed=false;notify();
    },
    confirm() {
      if(!point)throw new TypeError('Selecciona primero un punto.');
      confirmed=true;notify();
    },
    unconfirm() {confirmed=false;notify();},
    snapshot() {return {point:point?[...point]:null,confirmed};},
  };
}

async function responseJson(response,fallback) {
  let body={};
  try{body=await response.json();}catch{}
  if(!response.ok)throw new Error(typeof body.error==='string'?body.error:fallback);
  return body;
}

export async function submitSubmission(payload,fetchImpl=fetch) {
  const response=await fetchImpl('/api/submissions',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
  });
  const result=await responseJson(response,'No se pudo enviar la oferta.');
  if(typeof result.id!=='string'||typeof result.token!=='string'||result.state!=='pending_review')throw new Error('Respuesta de creación no válida.');
  return {id:result.id,token:result.token,state:result.state};
}

export function buildManagementLink(origin,{id,token}) {
  const url=new URL('/gestionar',origin);
  url.hash=new URLSearchParams({id,token}).toString();
  return url.href;
}

export async function searchReferencePlaces(query,fetchImpl=fetch) {
  const response=await fetchImpl(`/api/places?q=${encodeURIComponent(query)}`);
  const body=await responseJson(response,'No se pudieron consultar las localidades.');
  if(!Array.isArray(body.places))throw new Error('Respuesta de localidades no válida.');
  return body.places;
}

export async function createLocationPicker(host,config,selection,initialPoint,loadSdkImpl=loadSdk) {
  const google=await loadSdkImpl(config.googleMapsApiKey);
  const [{Map:GoogleMap},{AdvancedMarkerElement}]=await Promise.all([
    google.maps.importLibrary('maps'),google.maps.importLibrary('marker'),
  ]);
  const start=isPoint(initialPoint)?initialPoint:[-3.5,39.7];
  const map=new GoogleMap(host,{center:{lng:start[0],lat:start[1]},zoom:isPoint(initialPoint)?14:6,mapId:config.googleMapsMapId||'DEMO_MAP_ID',streetViewControl:false,mapTypeControl:false,gestureHandling:'greedy'});
  const marker=new AdvancedMarkerElement({map,position:{lng:start[0],lat:start[1]},gmpDraggable:true,title:'Centro de trabajo; arrastra para ajustar'});
  const setPoint=point=>{marker.position={lng:point[0],lat:point[1]};selection.select(point);};
  map.addListener('click',event=>{if(event.latLng)setPoint([event.latLng.lng(),event.latLng.lat()]);});
  marker.addListener('dragend',event=>{
    const position=event.latLng??marker.position;
    const lng=typeof position.lng==='function'?position.lng():position.lng;
    const lat=typeof position.lat==='function'?position.lat():position.lat;
    setPoint([lng,lat]);
  });
  if(isPoint(initialPoint))selection.select(initialPoint);
  return {
    focus(point) {if(!isPoint(point))return;marker.position={lng:point[0],lat:point[1]};map.setCenter(marker.position);map.setZoom(14);},
  };
}

function formValues(form) {
  const values=Object.fromEntries(new FormData(form));
  values.consent=form.elements.consent.checked;
  values.locationConfirmed=form.elements.locationConfirmed.checked;
  return values;
}

export function initializePublish(doc=document,{fetchImpl=fetch,clipboard=navigator.clipboard}={}) {
  const form=doc.querySelector('#publish-form');
  const status=doc.querySelector('#form-status');
  const salaryMode=form.elements.salaryMode;
  const salaryFields=doc.querySelector('#salary-fields');
  const salaryMin=form.elements.salaryMin;
  const salaryMax=form.elements.salaryMax;
  const salaryMaxLabel=doc.querySelector('#salary-max-label');
  const confirmation=form.elements.locationConfirmed;
  const pointLabel=doc.querySelector('#point-label');
  let picker=null;
  const selection=createPointSelection(state=>{
    confirmation.disabled=!state.point;
    confirmation.checked=state.confirmed;
    pointLabel.textContent=state.point?`Punto elegido: ${state.point[1].toFixed(5)}, ${state.point[0].toFixed(5)}. Confirma que corresponde al centro de trabajo.`:'Ubicación pendiente de confirmar.';
  });
  const syncSalary=()=>{
    const state=salaryFieldState(salaryMode.value);
    salaryFields.hidden=state.fieldsHidden;
    salaryMin.required=state.minRequired;
    salaryMaxLabel.hidden=!state.maxVisible;
    salaryMax.required=state.maxRequired;
  };
  salaryMode.addEventListener('change',syncSalary);syncSalary();
  confirmation.addEventListener('change',()=>{if(confirmation.checked)selection.confirm();else selection.unconfirm();});

  const localityInput=doc.querySelector('#locality-search');
  localityInput.addEventListener('input',()=>doc.querySelector('#locality-results').replaceChildren());
  localityInput.setAttribute('aria-controls','locality-results');
  localityInput.setAttribute('aria-expanded','false');
  localityInput.setAttribute('role','combobox');
  localityInput.setAttribute('aria-autocomplete','list');
  doc.querySelector('#locality-results').setAttribute('role','listbox');

  const searchPlaces=async()=>{
    const input=doc.querySelector('#locality-search');
    const results=doc.querySelector('#locality-results');
    const query=input.value.trim();
    if(query.length<2){results.textContent='Escribe al menos dos caracteres.';return;}
    results.textContent='Buscando localidades…';input.setAttribute('aria-busy','true');
    try{
      const places=await searchReferencePlaces(query,fetchImpl);
      results.replaceChildren();
      input.setAttribute('aria-expanded',String(places.length>0));
      if(places.length===0){results.textContent='Sin coincidencias. Prueba con municipio, provincia o código postal.';return;}
      for(const place of places){
        const button=doc.createElement('button');button.type='button';button.className='secondary';button.textContent=place.label;button.setAttribute('role','option');
        button.addEventListener('click',()=>{
          input.value=place.label;
          form.elements.city.value=place.name;
          form.elements.province.value=place.province;
          const point=[place.longitude,place.latitude];
          selection.select(point);picker?.focus(point);
          results.replaceChildren();input.setAttribute('aria-expanded','false');
        });
        results.append(button);
      }
    }catch(error){results.textContent=error.message;}
    finally{input.removeAttribute('aria-busy');}
  };
  doc.querySelector('#search-locality').addEventListener('click',()=>void searchPlaces());
  doc.querySelector('#locality-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void searchPlaces();}});

  doc.querySelector('#open-picker').addEventListener('click',async()=>{
    const host=doc.querySelector('#location-map');host.hidden=false;
    status.textContent='Cargando el mapa…';
    try{
      if(!picker){
        const response=await fetchImpl('/config.json');
        const config=await responseJson(response,'Configuración del mapa no disponible.');
        if(!config.googleMapsApiKey)throw new Error('Falta la configuración local de Google Maps.');
        picker=await createLocationPicker(host,config,selection,selection.snapshot().point);
      }
      status.textContent='Haz clic en el mapa o arrastra el marcador para ajustar el centro de trabajo.';
    }catch(error){status.textContent=error.message;}
  });

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const button=doc.querySelector('#submit-offer');button.disabled=true;status.textContent='Enviando la oferta para revisión…';
    try{
      const payload=buildSubmissionPayload(formValues(form),selection.snapshot().point);
      const created=await submitSubmission(payload,fetchImpl);
      const link=buildManagementLink(window.location.origin,created);
      doc.querySelector('#management-link').value=link;
      doc.querySelector('#manage-now').href=link;
      form.hidden=true;doc.querySelector('#created').hidden=false;
    }catch(error){status.textContent=error.message;button.disabled=false;}
  });
  doc.querySelector('#copy-link').addEventListener('click',async()=>{
    const input=doc.querySelector('#management-link');
    try{await clipboard.writeText(input.value);doc.querySelector('#copy-link').textContent='Enlace copiado';}
    catch{input.select();status.textContent='No se pudo copiar automáticamente. Copia el enlace seleccionado.';}
  });
  return {selection,searchPlaces};
}

if(typeof document!=='undefined')initializePublish();
