import { searchCalls } from './catalog.mjs';
import {distanceKm} from './geography.mjs';
import {createGoogleMap,markerGroups} from './google-map.mjs';
import {cardVisualTheme,detailBadge,placesLabel,jobPresentation,resultSummary} from './presentation.mjs';
import {locateOnce,createViewportSearch,resolveSearchBounds} from './map-search.mjs';
import {resolveReferencePlace} from './reference-places.mjs';
import {clearSelectionBeforeFocusRestore,createJobInteraction,previewJobAfterFocusRestore,restoreJobFocus} from './job-interaction.mjs';
import {createWorkspaceView} from './workspace-view.mjs';

const form = document.querySelector('#search-form');
const query = document.querySelector('#query');
const location = document.querySelector('#location');
const list = document.querySelector('#job-list');
const detail = document.querySelector('#job-detail');
const about = document.querySelector('#about-dialog');
let calls = [];
let category = '';
let origin = null;
let originPresentation = null;
let page = null;
let loadError = false;
let detailRequest = null;
let detailReturnJobId = null;
let originRevision = 0;
let mapStarting = false;
let locating = false;
let facetSignature = null;
let places = [];
let pendingPlace = null;
let mapController = null;
let searchBounds = null;
const interaction=createJobInteraction(syncJobInteraction);
const originInput = document.querySelector('#origin-city');
const radiusSelect = document.querySelector('#radius');
const mapHost = document.querySelector('#google-map');
const mapState = document.querySelector('#map-state');
const mapMessage = document.querySelector('#map-message');
const loadMapButton = document.querySelector('#load-map');
const mapIsVisible = () => mapHost.clientWidth>0&&mapHost.clientHeight>0;
const workspace = document.querySelector('.workspace');
const viewButtons = document.querySelectorAll('[data-workspace-view]');
const workspaceView = createWorkspaceView(view=>{
  workspace.dataset.view=view;
  for(const button of viewButtons)button.setAttribute('aria-pressed',String(button.dataset.workspaceView===view));
},'jobs',()=>requestAnimationFrame(()=>requestSearch({immediate:true,force:true})));
for(const button of viewButtons)button.addEventListener('click',()=>workspaceView.select(button.dataset.workspaceView));
for(const link of document.querySelectorAll('a[href="#results"]'))link.addEventListener('click',()=>workspaceView.select('jobs'));
const radiusKm = () => origin && radiusSelect.value ? Number(radiusSelect.value) : null;
const date = value => new Intl.DateTimeFormat('es-ES', {day:'numeric', month:'short', year:'numeric', timeZone:'Europe/Madrid'}).format(new Date(value));

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function externalLink(label, url, className) {
  const link = element('a', label, className);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function sourceLink(label,url,className) {
  return url ? externalLink(label,url,className) : null;
}

function syncJobInteraction(state) {
  for(const article of list.querySelectorAll('[data-job-id]')) {
    const selected=article.dataset.jobId===state.selectedId;
    const previewed=!selected&&article.dataset.jobId===state.previewId;
    article.classList.toggle('selected',selected);
    article.classList.toggle('previewed',previewed);
    const button=article.querySelector('.card-open');
    if(selected)button?.setAttribute('aria-current','true');
    else button?.removeAttribute('aria-current');
  }
  if(state.selectedId)mapController?.select(state.selectedId,{pan:false});
  else mapController?.clearSelection();
  mapController?.preview(state.previewId);
}

function scrollCardIntoView(id) {
  const article=[...list.querySelectorAll('[data-job-id]')].find(node=>node.dataset.jobId===id);
  article?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}

function renderDetail(call) {
  const presentation=jobPresentation(call);
  detail.querySelector('.public-badge').textContent=detailBadge(call);
  const content = document.querySelector('#detail-content');
  content.replaceChildren();
  const body = element('div', undefined, 'detail-body');
  const title = element('h2', call.title); title.id = 'detail-title';
  body.append(title, element('p', `${call.employer} · ${call.city}, ${call.province}`, 'detail-employer'));
  const facts = element('dl', undefined, 'detail-facts');
  for (const [label, value] of [['Plazas',placesLabel(call)],['Régimen',call.regime],['Retribución',presentation.salaryLabel],['Ubicación',presentation.locationLabel],['Publicación',date(call.publishedAt)],['Fin de publicación',call.closingDate?date(call.closingDate):'Consultar bases; no calculado']]) {
    const fact = element('div'); fact.append(element('dt', label), element('dd', value)); facts.append(fact);
  }
  body.append(facts, element('h3','Texto del anuncio publicado'));
  for (const paragraph of call.paragraphs) body.append(element('p', paragraph, 'source-paragraph'));
  body.append(element('p',presentation.note, 'detail-note'));
  const links = element('div', undefined, 'detail-links');
  const original=sourceLink(presentation.sourceLink,call.sourceUrl,'primary-button');
  if(original)links.append(original);
  links.append(externalLink('Ver ubicación en Google Maps ↗', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(call.location?.point?.slice().reverse().join(',')??`${call.city}, ${call.province}, España`)}`, 'secondary-button'));
  body.append(links, element('p', `${call.id} · Consultado el ${date(call.checkedAt)}. Fuente: ${presentation.source}. ${presentation.provenance}`, 'detail-provenance'));
  content.append(body);
  if(!detail.open) detail.showModal();
}

async function showDetail(call,{panMap=true,revealCard=false}={}) {
  detailRequest?.abort();
  detailReturnJobId=call.id;
  detail.querySelector('.public-badge').textContent=detailBadge(call);
  interaction.select(call.id);
  if(revealCard)scrollCardIntoView(call.id);
  mapController?.select(call.id,{pan:panMap});
  const request=new AbortController();detailRequest=request;
  const content=document.querySelector('#detail-content');
  const loadingTitle=element('h2',call.title);loadingTitle.id='detail-title';
  content.replaceChildren(loadingTitle,element('p','Cargando el texto de la oferta…'));
  if(!detail.open) detail.showModal();
  try {
    const response=await fetch(`/api/job?id=${encodeURIComponent(call.id)}`,{signal:request.signal});
    if(!response.ok) throw new Error('Detalle no disponible');
    const job=await response.json();
    if(request.signal.aborted||detailRequest!==request||!detail.open)return;
    if(job.id!==call.id||!Array.isArray(job.paragraphs))throw new Error('Detalle inválido');
    renderDetail(job);
  }catch{
    if(request.signal.aborted||detailRequest!==request||!detail.open)return;
    const errorTitle=element('h2','No se pudo cargar el detalle');errorTitle.id='detail-title';
    const retry=element('p','Vuelve a abrir la oferta para reintentar.');
    const original=sourceLink('Consultar en la fuente original ↗',call.sourceUrl,'primary-button');
    content.replaceChildren(errorTitle,retry,...(original?[original]:[]));
  }
}

function card(call) {
  const article = element('article', undefined, 'job-card');
  article.dataset.jobId = call.id;
  const button = element('button', undefined, 'card-open');
  button.type = 'button'; button.setAttribute('aria-label', `Ver oferta: ${call.title}. Fuente: ${call.source}`);
  button.addEventListener('click', () => showDetail(call));
  article.addEventListener('pointerenter',()=>interaction.preview(call.id));
  article.addEventListener('pointerleave',()=>interaction.clearPreview(call.id));
  article.addEventListener('focusin',()=>interaction.preview(call.id));
  article.addEventListener('focusout',event=>{if(!article.contains(event.relatedTarget))interaction.clearPreview(call.id);});
  const visualFrame = element('div', undefined, 'job-visual-frame');
  const visual = element('div', undefined, `job-visual theme-${cardVisualTheme(call)}`);
  visual.setAttribute('aria-hidden','true');
  visualFrame.append(visual, element('span',call.source,'source-pill'));
  const top = element('div', undefined, 'card-top');
  top.append(element('span', call.city.slice(0,2).toLocaleUpperCase('es'), 'employer-avatar'), element('span', call.employer, 'employer-name'), element('span','↗','card-arrow'));
  const locationLine = element('p', `${call.city}, ${call.province}`, 'location-line');
  const tags = element('div', undefined, 'job-meta');
  tags.append(element('span',placesLabel(call), 'meta-tag'), element('span',call.categoryLabel,'meta-tag'), element('span',call.kind==='public_call'?'Turno libre':call.source,'meta-tag'));
  tags.append(element('span',call.location?.precision==='employer_declared'?'Punto del anunciante':call.location?'Ubicación municipal':'Ubicación sin verificar','meta-tag'));
  if (origin) {
    const distance = distanceKm(origin,call.location?.point);
    if (Number.isFinite(distance)) tags.append(element('span',`≈ ${new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(distance)} km de tu zona`,'distance-tag'));
  }
  button.append(visualFrame, top, element('h3',call.title), locationLine, tags, element('p',jobPresentation(call).salaryLabel,'salary-label'));
  const footer = element('div', undefined, 'card-footer');
  footer.append(element('span',`Publicado ${date(call.publishedAt)}`));
  const original=sourceLink(call.sourceUrl?`${call.id} ↗`:call.id,call.sourceUrl);
  footer.append(original??element('span',call.id));
  article.append(button, footer);
  return article;
}

function render() {
  document.querySelector('#return-origin').disabled=!origin||!mapController;
  const results=searchCalls(calls,{origin,radiusKm:radiusKm()});
  if(origin)results.sort((a,b)=>distanceKm(origin,a.location?.point)-distanceKm(origin,b.location?.point));
  list.replaceChildren(...results.map(card));
  document.querySelector('#result-count').textContent=`${results.length} ${results.length===1?'oferta real':'ofertas reales'}${searchBounds?' en esta zona':''}`;
  const summary=resultSummary(results);
  document.querySelector('#result-summary').textContent=page?.truncated?`${summary} · Mostrando hasta 300 de ${page.total}; acerca el mapa para acotar.`:summary;
  document.querySelector('#empty-state').hidden=loadError||results.length>0;
  document.querySelector('#clear-filters').hidden=!query.value&&!location.value&&!category&&!origin;
  mapController?.update(results,origin,radiusKm());
  syncJobInteraction(interaction.snapshot());
  const mapped=results.filter(call=>call.location?.point).length;
  const municipalities=markerGroups(results).length;
  document.querySelector('#map-footnote').textContent=`${mapped} ofertas en ${municipalities} ${municipalities===1?'punto municipal':'puntos municipales'} de la búsqueda. Ubicaciones municipales aproximadas; no direcciones exactas.`;
  const params=new URLSearchParams();
  if(query.value)params.set('q',query.value);
  if(location.value)params.set('city',location.value);
  if(category)params.set('category',category);
  history.replaceState(null,'',`${locationUrl()}${params.size?`?${params}`:''}`);
}

function updateFacets(facets) {
  const signature=JSON.stringify(facets);
  if(signature===facetSignature)return;
  facetSignature=signature;
  const territory=location.value;
  location.replaceChildren(element('option','Toda España'));
  location.firstChild.value='';
  for(const region of facets.regions){const option=element('option',region);option.value=region;location.append(option);}
  location.value=territory;
  const categories=document.querySelector('#categories');categories.replaceChildren();
  for(const {id,label} of [{id:'',label:'Todas las áreas'},...facets.categories]) {
    const button=element('button',label,'filter-chip');button.type='button';button.dataset.category=id;categories.append(button);
  }
  syncCategories();
}

const search=createViewportSearch({
  onLoading(){list.setAttribute('aria-busy','true');document.querySelector('#search-status').textContent='Actualizando ofertas de la zona…';},
  onResult(result){
    if(!Array.isArray(result.jobs)||!result.facets)throw new Error('Respuesta de catálogo inválida');
    calls=result.jobs;page=result;loadError=false;
    updateFacets(result.facets);
    document.querySelector('#snapshot-label').textContent=`Fuentes: ${result.sources.join(' · ')} · Catálogo actualizado el ${date(result.checkedAt)}`;
    list.setAttribute('aria-busy','false');render();
    document.querySelector('#search-status').textContent=searchBounds?'Se conserva la última zona consultada; mueve o amplía el mapa para actualizarla.':mapController?'Búsqueda sin área de mapa, limitada a 300 ofertas. Abre el mapa para acotar la zona.':'Mapa no disponible; búsqueda en lista con transferencia limitada.';
  },
  onError(){
    calls=[];loadError=true;list.setAttribute('aria-busy','false');render();
    document.querySelector('#result-count').textContent='No se pudo actualizar esta zona';
    document.querySelector('#search-status').textContent='Comprueba la conexión y pulsa Buscar oportunidades para reintentar.';
  },
});

function requestSearch({immediate=false,force=false,allowList=false}={}) {
  if(mapStarting&&!mapController&&!allowList)return;
  searchBounds=resolveSearchBounds(mapController?.bounds(),mapIsVisible(),searchBounds);
  const params=new URLSearchParams();
  if(searchBounds)params.set('bounds',searchBounds.join(','));
  if(query.value)params.set('q',query.value);
  if(location.value)params.set('city',location.value);
  if(category)params.set('category',category);
  search.request(params,{immediate,force});
}

function locationUrl() { return window.location.pathname; }

function clear() {
  cancelPlaceSearch();
  mapController?.cancelOriginSelection();
  query.value = ''; location.value = ''; category = '';
  originRevision++;origin = null; originInput.value = ''; radiusSelect.value = ''; radiusSelect.disabled = true;
  document.querySelector('#origin-status').textContent = 'Elige una localidad o selecciona tu zona en el mapa.';
  syncCategories(); render(); requestSearch({immediate:true});
}

function setOrigin(point,label) {
  cancelPlaceSearch();
  mapController?.cancelOriginSelection();originRevision++;
  searchBounds=null;
  origin=point;radiusSelect.value='';radiusSelect.disabled=false;
  document.querySelector('#origin-status').textContent=`${label} · Ubicación aproximada; el mapa filtra la zona visible`;
  originPresentation={input:originInput.value,status:document.querySelector('#origin-status').textContent};
  mapController?.focus(point);
  render();
  if(!mapController&&!mapStarting)requestSearch({immediate:true});
}

async function useMyLocation() {
  if(locating)return;
  cancelPlaceSearch();originRevision++;
  locating=true;
  const revision=originRevision;
  document.querySelector('#use-location').disabled=true;
  document.querySelector('#origin-status').textContent='Esperando permiso de ubicación del navegador…';
  try {
    const position=await locateOnce();
    if(originRevision!==revision)return;
    if(position.status==='located') {
      originInput.value='';
      setOrigin(position.point,'Ubicación aproximada del dispositivo');
      mapController?.focus(position.point,position.zoom);
    } else {
      document.querySelector('#origin-status').textContent=position.status==='denied'?'Ubicación no compartida. Elige una localidad o mueve el mapa.':'No pudimos localizarte. Elige una localidad o mueve el mapa.';
    }
    return position;
  }finally{locating=false;document.querySelector('#use-location').disabled=false;}
}

function applyReferencePlace() {
  const selected = resolveReferencePlace(places,originInput.value);
  if (!selected) {
    origin=null;radiusSelect.disabled=true;radiusSelect.value='';
    document.querySelector('#origin-status').textContent=/^\d{5}$/.test(originInput.value.trim())?'El código postal puede abarcar varias localidades. Elige una sugerencia con su nombre.':originInput.value ? 'Localidad no reconocida: el filtro de distancia está desactivado. Elige una opción o usa el mapa.' : 'Elige una localidad o selecciona tu zona en el mapa.';
    render();return;
  }
  originInput.value=selected.label;
  workspaceView.select('map');
  setOrigin([selected.longitude,selected.latitude],`Zona elegida manualmente: ${selected.label}`);
}

const placeSearch=createViewportSearch({
  endpoint:'/api/places',
  onLoading(){originInput.setAttribute('aria-busy','true');},
  onResult(result){
    originInput.setAttribute('aria-busy','false');
    if(result.query!==originInput.value||!Array.isArray(result.places))return;
    places=result.places;
    const options=places.map(place=>{const option=element('option');option.value=place.label;return option;});
    document.querySelector('#places').replaceChildren(...options);
    if(pendingPlace===originInput.value){pendingPlace=null;applyReferencePlace();}
    else document.querySelector('#origin-status').textContent=places.length?'Elige una localidad de las sugerencias para centrar el mapa.':'Sin coincidencias. Prueba el municipio, la provincia o el código postal.';
  },
  onError(){originInput.setAttribute('aria-busy','false');pendingPlace=null;document.querySelector('#origin-status').textContent='No se pudieron consultar las localidades. Reintenta o elige tu zona en el mapa.';},
});
function cancelPlaceSearch() {
  placeSearch.cancel();pendingPlace=null;originInput.setAttribute('aria-busy','false');
}
function searchPlaces(immediate=false) {
  if(originInput.value.trim().length<2){placeSearch.cancel();places=[];document.querySelector('#places').replaceChildren();return;}
  placeSearch.request(new URLSearchParams({q:originInput.value}),{immediate,force:immediate});
}
originInput.addEventListener('input',()=>{originRevision++;pendingPlace=null;searchPlaces();});
originInput.addEventListener('change',()=>{
  mapController?.cancelOriginSelection();originRevision++;
  if(!originInput.value.trim()){places=[];applyReferencePlace();return;}
  const selected=resolveReferencePlace(places,originInput.value);
  if(selected){placeSearch.cancel();pendingPlace=null;applyReferencePlace();return;}
  pendingPlace=originInput.value;searchPlaces(true);
});
originInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();pendingPlace=originInput.value;searchPlaces(true);}});
radiusSelect.addEventListener('change',render);
document.querySelector('#choose-origin').addEventListener('click',() => {
  mapController?.chooseOrigin(); document.querySelector('#origin-status').textContent = 'Haz clic en el mapa para situar tu zona de búsqueda.';
});
document.querySelector('#search-area').addEventListener('click',()=>requestSearch({immediate:true,force:true}));
document.querySelector('#show-all-map').addEventListener('click',()=>mapController?.overview());
document.querySelector('#use-location').addEventListener('click',()=>{if(mapController)void useMyLocation();else void startMap();});
document.querySelector('#return-origin').addEventListener('click',()=>{
  if(!origin||!mapController)return;
  cancelPlaceSearch();originRevision++;
  originInput.value=originPresentation.input;
  document.querySelector('#origin-status').textContent=originPresentation.status;
  mapController.focus(origin);
});

async function startMap() {
  if(mapStarting||mapController)return;
  const revision=originRevision;
  mapStarting=true;loadMapButton.disabled=true;
  try {
    const response=await fetch('/config.json');
    if(!response.ok)throw new Error('Configuración local no disponible.');
    const config=await response.json();
    if(!config.googleMapsApiKey){mapMessage.textContent='Falta la configuración del mapa. Puedes buscar en la lista o elegir una localidad.';requestSearch({immediate:true,allowList:true});return;}
    mapMessage.textContent='Permite tu ubicación para empezar cerca de ti; también puedes elegir una localidad.';
    const position=originRevision===revision?await useMyLocation():null;
    mapMessage.textContent='Cargando el mapa y las ofertas de tu zona…';
    const mapRevision=originRevision;
    mapController=await createGoogleMap(mapHost,config,{
      onSelect(id){const call=calls.find(item=>item.id===id);if(call)void showDetail(call,{panMap:false,revealCard:true});},
      onOrigin(point){originInput.value='';setOrigin(point,'Zona elegida en el mapa');},
      onViewport(){if(mapController&&mapIsVisible())requestSearch();},
    },{point:origin,zoom:origin?(position?.zoom??12):6});
    if(originRevision!==mapRevision){if(origin)mapController.focus(origin);else mapController.overview();}
    for(const id of ['choose-origin','search-area','show-all-map'])document.getElementById(id).disabled=false;
    render();requestSearch();
  }catch(error){
    mapMessage.textContent=`${error.message} La búsqueda en lista sigue disponible.`;
    mapHost.replaceChildren(mapState);requestSearch({immediate:true,allowList:true});
  }finally{mapStarting=false;loadMapButton.disabled=false;}
}
loadMapButton.addEventListener('click',()=>void startMap());

function syncCategories() {
  for (const button of document.querySelectorAll('[data-category]')) {
    const active = button.dataset.category === category;
    button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
  }
}

form.addEventListener('submit',event=>{event.preventDefault();requestSearch({immediate:true,force:true});});
location.addEventListener('change',()=>requestSearch({immediate:true}));
document.querySelector('#categories').addEventListener('click',event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  category = button.dataset.category; syncCategories(); requestSearch({immediate:true});
});
document.querySelector('#clear-filters').addEventListener('click',clear);
document.querySelector('#empty-clear').addEventListener('click',clear);
document.querySelector('#close-detail').addEventListener('click',()=>detail.close());
detail.addEventListener('close',()=>{
  detailRequest?.abort();detailRequest=null;
  const returnId=detailReturnJobId;detailReturnJobId=null;
  clearSelectionBeforeFocusRestore(interaction,()=>requestAnimationFrame(()=>{
    if(window.matchMedia('(max-width:780px)').matches&&workspaceView.snapshot()==='map') {
      document.querySelector('#map-panel').focus({preventScroll:true});
      return;
    }
    previewJobAfterFocusRestore(interaction,returnId,()=>
      restoreJobFocus(list,returnId,document.querySelector('#results')),
    );
  }));
});
document.querySelector('#about-button').addEventListener('click',() => about.showModal());
document.querySelector('#close-about').addEventListener('click',() => about.close());

const initialParams=new URLSearchParams(window.location.search);
query.value=initialParams.get('q')??'';
category=initialParams.get('category')??'';
const initialTerritory=initialParams.get('city');
if(initialTerritory){const option=element('option',initialTerritory);option.value=initialTerritory;location.append(option);location.value=initialTerritory;}

window.addEventListener('pagehide',()=>{search.cancel();placeSearch.cancel();detailRequest?.abort();});
void startMap();
