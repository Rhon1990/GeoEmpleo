import { searchCalls } from './catalog.mjs';
import {distanceKm} from './geography.mjs';
import {createGoogleMap,markerGroups} from './google-map.mjs';
import {cardVisualTheme,detailBadge,employerBrand,formatDate as date,formatDateTime,offerDates,placesLabel,jobPresentation,resultSummary,setBrandImageFallback} from './presentation.mjs';
import {locateOnce,createViewportSearch,originSearchTransition,resolveSearchBounds,searchGeography,updateMapWithoutLosingJobs,visibleMapJobs} from './map-search.mjs?v=20261026-origin';
import {requestLocationWithPermission} from './location-permission.mjs';
import {resolveReferencePlace} from './reference-places.mjs';
import {clearSelectionBeforeFocusRestore,createJobInteraction,previewJobAfterFocusRestore,restoreJobFocus} from './job-interaction.mjs';
import {createWorkspaceView} from './workspace-view.mjs';
import {siteFetch} from './static-data.mjs?v=20261028-employer-filter';
import {createAnalyticsController,loadFirebaseAnalytics} from './analytics.mjs';
import {adInsertionIndex,loadAdSensePublisher,requestAdSlot,validAdSensePublisher,watchAdStatus} from './adsense.mjs';
import {selectableTerritories} from './territories.mjs';

const analyticsController=createAnalyticsController({config:null,loadSdk:()=>loadFirebaseAnalytics()});
const analyticsPanel=document.querySelector('#analytics-consent-panel');
const adPrivacySettings=document.querySelector('#ad-privacy-settings');
let adsenseConfig={enabled:false};
let adsensePublisherReady=false;
let adContainer=null;
let adSlotRequested=false;
document.querySelector('#analytics-consent').hidden=false;
analyticsPanel.hidden=Boolean(analyticsController.getPreference());
document.querySelector('#privacy-settings').addEventListener('click',()=>{analyticsPanel.hidden=!analyticsPanel.hidden;});
adPrivacySettings.addEventListener('click',()=>{
  const googlefc=window.googlefc;
  if(typeof googlefc?.showRevocationMessage==='function'&&googlefc.callbackQueue?.push)googlefc.callbackQueue.push(googlefc.showRevocationMessage);
});
document.querySelector('#analytics-accept').addEventListener('click',async()=>{
  await analyticsController.accept();analyticsPanel.hidden=true;
  void analyticsController.track('page_view');
});
document.querySelector('#analytics-reject').addEventListener('click',async()=>{
  await analyticsController.reject();analyticsPanel.hidden=true;
});
void fetch('/config.json').then(response=>response.ok?response.json():null).then(config=>{
  if(config?.firebaseAnalytics)analyticsController.setConfig(config.firebaseAnalytics);
  adsenseConfig=config?.adsense??{enabled:false};
  if(adsenseConfig.enabled===true&&validAdSensePublisher(adsenseConfig.publisherId)){
    void loadAdSensePublisher(adsenseConfig.publisherId).then(loaded=>{
      adsensePublisherReady=loaded;
      adPrivacySettings.hidden=!loaded;
      render();
    });
  }
  if(analyticsController.getPreference()==='accepted')return analyticsController.initializeFromPreference().then(()=>analyticsController.track('page_view'));
  if(!analyticsController.getPreference())analyticsPanel.hidden=false;
  return undefined;
}).catch(()=>{if(!analyticsController.getPreference())analyticsPanel.hidden=false;});

const form = document.querySelector('#search-form');
const query = document.querySelector('#query');
const location = document.querySelector('#location');
const list = document.querySelector('#job-list');
const detail = document.querySelector('#job-detail');
const about = document.querySelector('#about-dialog');
let calls = [];
let category = '';
let employer = '';
let origin = null;
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
let territoryFocusPending = null;
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
const activeGeography = () => searchGeography(origin,radiusSelect.value,Boolean(location.value));

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
  const dates=offerDates(call);
  detail.querySelector('.public-badge').textContent=detailBadge(call);
  const content = document.querySelector('#detail-content');
  content.replaceChildren();
  const body = element('div', undefined, 'detail-body');
  const title = element('h2', call.title); title.id = 'detail-title';
  const brand=employerBrand(call);
  const brandHeader=element('div',undefined,'detail-brand');
  const brandLogo=setBrandImageFallback(element('img'));
  brandLogo.src=brand.src; brandLogo.alt=brand.alt; brandLogo.loading='lazy'; brandLogo.decoding='async';
  brandHeader.append(brandLogo,element('p',`${call.employer} · ${call.city}, ${call.province}`,'detail-employer'));
  body.append(brandHeader,title);
  const facts = element('dl', undefined, 'detail-facts');
  for (const [label, value] of [['Plazas',placesLabel(call)],['Régimen',call.regime],['Retribución',presentation.salaryLabel],['Ubicación',presentation.locationLabel],[dates.publication.label,dates.publication.value],[dates.checked.label,dates.checked.value],['Fin de publicación',call.closingDate?date(call.closingDate):'No indicada; comprueba vigencia en el origen']]) {
    const fact = element('div'); fact.append(element('dt', label), element('dd', value)); facts.append(fact);
  }
  body.append(facts, element('h3','Texto del anuncio publicado'));
  for (const paragraph of call.paragraphs) body.append(element('p', paragraph, 'source-paragraph'));
  body.append(element('p',presentation.note, 'detail-note'));
  const links = element('div', undefined, 'detail-links');
  const original=sourceLink(presentation.sourceLink,call.sourceUrl,'primary-button');
  if(original)links.append(original);
  links.append(externalLink('Ver ubicación en Google Maps ↗', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(call.location?.point?.slice().reverse().join(',')??`${call.city}, ${call.province}, España`)}`, 'secondary-button'));
  body.append(links, element('p', `${call.id} · Fuente: ${presentation.source}. ${presentation.provenance}`, 'detail-provenance'));
  content.append(body);
  if(!detail.open) detail.showModal();
}

async function showDetail(call,{panMap=true,revealCard=false}={}) {
  void analyticsController.track('offer_detail_opened');
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
    const response=await siteFetch(`/api/job?id=${encodeURIComponent(call.id)}`,{signal:request.signal});
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
  const dates=offerDates(call);
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
  const brand=employerBrand(call);
  const visual = element('div', undefined, `job-visual theme-${cardVisualTheme(call)} ${brand.alt==='GeoEmpleo360'?'logo-generic':'logo-brand'}`);
  visual.setAttribute('aria-hidden','true');
  const logo=setBrandImageFallback(element('img'));logo.src=brand.src;logo.alt='';logo.loading='lazy';logo.decoding='async';logo.draggable=false;
  visual.append(logo);
  visualFrame.append(visual, element('span',call.source,'source-pill'));
  const top = element('div', undefined, 'card-top');
  top.append(element('span', call.employer, 'employer-name'), element('span','↗','card-arrow'));
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
  const cardDates=element('div',undefined,'card-dates');
  cardDates.append(element('span',`${dates.publication.short} ${dates.publication.value}`),element('span',`${dates.checked.short} ${dates.checked.value}`));
  footer.append(cardDates);
  const original=sourceLink(call.sourceUrl?`${call.id} ↗`:call.id,call.sourceUrl);
  footer.append(original??element('span',call.id));
  article.append(button, footer);
  return article;
}

function adUnit() {
  if(adContainer)return adContainer;
  adContainer=element('aside',undefined,'ad-unit');
  adContainer.hidden=true;
  adContainer.setAttribute('aria-label','Publicidad');
  adContainer.append(element('span','Publicidad','ad-unit-label'));
  const slot=document.createElement('ins');
  slot.className='adsbygoogle';
  slot.style.display='block';
  slot.setAttribute('aria-label','Anuncio');
  adContainer.append(slot);
  return adContainer;
}

function render() {
  const geography=activeGeography();
  const results=searchCalls(calls,geography);
  const mapResults=visibleMapJobs(page,geography.origin,geography.radiusKm);
  if(geography.origin)results.sort((a,b)=>distanceKm(geography.origin,a.location?.point)-distanceKm(geography.origin,b.location?.point));
  const cards=results.map(card);
  const insertAt=adInsertionIndex(results.length,adsenseConfig);
  if(insertAt!==null&&adsensePublisherReady)cards.splice(insertAt,0,adUnit());
  list.replaceChildren(...cards);
  if(insertAt!==null&&adsensePublisherReady&&!adSlotRequested){
    const slot=adContainer?.querySelector('.adsbygoogle');
    watchAdStatus(slot,adContainer);
    adSlotRequested=true;
    requestAdSlot(slot,adsenseConfig);
  }
  const count=geography.radiusKm===null?page?.total??results.length:mapResults.length;
  document.querySelector('#result-count').textContent=`${count} ${count===1?'oferta real':'ofertas reales'}${searchBounds?' en esta zona':''}`;
  const summary=resultSummary(results);
  document.querySelector('#result-summary').textContent=page?.truncated?`Mostrando 300 de ${page.total} tarjetas · El mapa incluye todos los puntos`:summary;
  document.querySelector('#empty-state').hidden=loadError||results.length>0||mapResults.length>0;
  document.querySelector('#clear-filters').hidden=!query.value&&!location.value&&!category&&!employer&&!origin;
  updateMapWithoutLosingJobs(mapController,mapResults,geography.origin,geography.radiusKm,()=>{
    mapController=null;
    mapHost.replaceChildren(mapState);
    mapMessage.textContent='El mapa no está disponible ahora. Puedes seguir consultando las ofertas en la lista.';
  });
  syncJobInteraction(interaction.snapshot());
  const mapped=mapResults.length;
  const municipalities=markerGroups(mapResults).length;
  document.querySelector('#map-footnote').textContent=`${mapped} ofertas en ${municipalities} ${municipalities===1?'punto municipal':'puntos municipales'} de la búsqueda. Ubicaciones municipales aproximadas; no direcciones exactas.`;
  const params=new URLSearchParams();
  if(query.value)params.set('q',query.value);
  if(location.value)params.set('city',location.value);
  if(category)params.set('category',category);
  if(employer)params.set('employer',employer);
  history.replaceState(null,'',`${locationUrl()}${params.size?`?${params}`:''}`);
}

function updateFacets(facets) {
  const signature=JSON.stringify(facets);
  if(signature===facetSignature)return;
  facetSignature=signature;
  const territory=location.value;
  location.replaceChildren(element('option','Toda España'));
  location.firstChild.value='';
  for(const region of selectableTerritories(facets.regions)){const option=element('option',region);option.value=region;location.append(option);}
  location.value=territory;
  const employerFilter=document.querySelector('#employer-filter');
  employerFilter.replaceChildren(element('option','Todas las empresas'));
  employerFilter.firstChild.value='';
  for(const item of facets.employers??[]){const option=element('option',item.label);option.value=item.id;employerFilter.append(option);}
  employerFilter.value=employer;
  const categories=document.querySelector('#categories');categories.replaceChildren();
  for(const {id,label} of [{id:'',label:'Todas las áreas'},...facets.categories]) {
    const button=element('button',label,'filter-chip');button.type='button';button.dataset.category=id;categories.append(button);
  }
  syncCategories();
}

const search=createViewportSearch({
  fetchImpl:siteFetch,
  onLoading(){list.setAttribute('aria-busy','true');document.querySelector('#search-status').textContent='Actualizando ofertas de la zona…';},
  onResult(result){
    if(!Array.isArray(result.jobs)||!Array.isArray(result.mapJobs)||!result.facets)throw new Error('Respuesta de catálogo inválida');
    calls=result.jobs;page=result;loadError=false;
    updateFacets(result.facets);
    document.querySelector('#snapshot-label').textContent=`Catálogo actualizado el ${formatDateTime(result.checkedAt)} · ${result.sources.length} fuentes`;
    list.setAttribute('aria-busy','false');render();
    document.querySelector('#results').scrollTop=0;
    document.querySelector('#search-status').textContent=searchBounds?'Ofertas de la zona visible del mapa.':mapController?'Búsqueda sin área de mapa, limitada a 300 ofertas. Abre el mapa para acotar la zona.':'Mapa no disponible; búsqueda en lista con transferencia limitada.';
    if(territoryFocusPending!==null){
      const territory=territoryFocusPending;territoryFocusPending=null;
      if(territory===location.value&&mapController&&result.mapJobs.length)mapController.fit(result.mapJobs,null);
    }
  },
  onError(){
    calls=[];loadError=true;list.setAttribute('aria-busy','false');render();
    document.querySelector('#result-count').textContent='No se pudo actualizar esta zona';
    document.querySelector('#search-status').textContent='Comprueba la conexión y pulsa Buscar oportunidades para reintentar.';
  },
});

function requestSearch({immediate=false,force=false,allowList=false}={}) {
  if(mapStarting&&!mapController&&!allowList)return;
  searchBounds=resolveSearchBounds(mapController?.bounds(),mapIsVisible(),searchBounds,territoryFocusPending!==null);
  const params=new URLSearchParams();
  if(searchBounds)params.set('bounds',searchBounds.join(','));
  if(query.value)params.set('q',query.value);
  if(location.value)params.set('city',location.value);
  if(category)params.set('category',category);
  if(employer)params.set('employer',employer);
  search.request(params,{immediate,force});
}

function locationUrl() { return window.location.pathname; }

function clear() {
  cancelPlaceSearch();
  mapController?.cancelOriginSelection();
  territoryFocusPending=null;
  query.value = ''; location.value = ''; category = ''; employer = '';
  document.querySelector('#employer-filter').value='';
  originRevision++;origin = null; originInput.value = ''; radiusSelect.value = ''; radiusSelect.disabled = true;
  document.querySelector('#origin-status').textContent = 'Elige una localidad o selecciona tu zona en el mapa.';
  syncCategories(); render(); requestSearch({immediate:true});
}

function setOrigin(point,label) {
  cancelPlaceSearch();
  mapController?.cancelOriginSelection();originRevision++;
  const next=originSearchTransition(point);
  searchBounds=next.bounds;territoryFocusPending=next.pendingTerritory;
  location.value=next.territory;origin=next.origin;radiusSelect.value='';radiusSelect.disabled=false;
  document.querySelector('#origin-status').textContent=`${label} · Ubicación aproximada; el mapa filtra la zona visible`;
  mapController?.focus(point);
  render();
  if(!mapController&&!mapStarting)requestSearch({immediate:true});
}

const locationPermissionDialog=document.querySelector('#location-permission-dialog');
function showLocationPermission(mode) {
  const title=document.querySelector('#location-permission-title');
  const message=document.querySelector('#location-permission-message');
  const help=document.querySelector('#location-permission-help');
  const action=document.querySelector('#location-permission-action');
  const cancel=document.querySelector('#location-permission-cancel');
  title.textContent=mode==='denied'?'Ubicación bloqueada':'Usar tu ubicación';
  message.textContent=mode==='denied'?'El permiso de ubicación está rechazado o bloqueado. ¿Quieres saber cómo activarlo?':'GeoEmpleo360 usará tu ubicación una vez para centrar el mapa y encontrar ofertas cercanas. El navegador te pedirá permiso.';
  action.textContent=mode==='denied'?'Ver cómo activarlo':'Solicitar ubicación';
  cancel.textContent='Ahora no';help.hidden=true;
  if(!locationPermissionDialog.open)locationPermissionDialog.showModal();
  return new Promise(resolve=>{
    let accepted=false;
    const finish=()=>{action.removeEventListener('click',onAction);cancel.removeEventListener('click',onCancel);locationPermissionDialog.removeEventListener('close',finish);resolve(accepted);};
    const onCancel=()=>locationPermissionDialog.close();
    const onAction=()=>{
      if(mode==='denied'&&help.hidden){help.hidden=false;action.textContent='Entendido';cancel.hidden=true;return;}
      accepted=mode!=='denied';locationPermissionDialog.close();
    };
    cancel.hidden=false;
    action.addEventListener('click',onAction);cancel.addEventListener('click',onCancel);
    locationPermissionDialog.addEventListener('close',finish,{once:true});
  });
}
document.querySelector('#location-permission-close').addEventListener('click',()=>locationPermissionDialog.close());

async function useMyLocation({interactive=false}={}) {
  if(locating)return;
  cancelPlaceSearch();originRevision++;
  locating=true;
  const revision=originRevision;
  document.querySelector('#use-location').disabled=true;
  document.querySelector('#origin-status').textContent='Esperando permiso de ubicación del navegador…';
  try {
    const position=interactive?await requestLocationWithPermission({
      permission:async()=>navigator.permissions?(await navigator.permissions.query({name:'geolocation'})).state:'prompt',
      confirm:()=>showLocationPermission('prompt'),locate:()=>locateOnce(),denied:()=>{void showLocationPermission('denied');},
    }):await locateOnce();
    if(originRevision!==revision)return;
    if(position.status==='cancelled'){document.querySelector('#origin-status').textContent='Puedes elegir una localidad o usar el mapa.';return position;}
    if(position.status==='located') {
      originInput.value='';
      setOrigin(position.point,'Ubicación aproximada del dispositivo');
      mapController?.focus(position.point,position.zoom);
    } else {
      document.querySelector('#origin-status').textContent=position.status==='denied'?'Este navegador ha rechazado el permiso de ubicación. Actívalo para GeoEmpleo360 en los ajustes del sitio y vuelve a pulsar «Usar mi ubicación», o elige una localidad.':'No pudimos localizarte. Elige una localidad o mueve el mapa.';
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
  fetchImpl:siteFetch,
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
radiusSelect.addEventListener('change',()=>{void analyticsController.track('filter_used',{filter_type:'distance'});render();});
document.querySelector('#choose-origin').addEventListener('click',() => {
  void analyticsController.track('map_action',{action:'choose_zone'});
  mapController?.chooseOrigin(); document.querySelector('#origin-status').textContent = 'Haz clic en el mapa para situar tu zona de búsqueda.';
});
document.querySelector('#search-area').addEventListener('click',()=>{void analyticsController.track('map_action',{action:'search_visible_area'});requestSearch({immediate:true,force:true});});
document.querySelector('#show-all-map').addEventListener('click',()=>{void analyticsController.track('map_action',{action:'show_spain'});mapController?.overview();});
document.querySelector('#use-location').addEventListener('click',()=>{void analyticsController.track('map_action',{action:'use_my_location'});if(mapController)void useMyLocation({interactive:true});else void startMap({interactive:true});});

async function startMap({interactive=false}={}) {
  if(mapStarting||mapController)return;
  const revision=originRevision;
  mapStarting=true;loadMapButton.disabled=true;
  try {
    const response=await fetch('/config.json');
    if(!response.ok)throw new Error('Configuración local no disponible.');
    const config=await response.json();
    if(!config.googleMapsApiKey){mapMessage.textContent='Falta la configuración del mapa. Puedes buscar en la lista o elegir una localidad.';requestSearch({immediate:true,allowList:true});return;}
    mapMessage.textContent='Permite tu ubicación para empezar cerca de ti; también puedes elegir una localidad.';
    const position=originRevision===revision&&(interactive||!location.value)?await useMyLocation({interactive}):null;
    mapMessage.textContent='Cargando el mapa y las ofertas de tu zona…';
    const mapRevision=originRevision;
    mapController=await createGoogleMap(mapHost,config,{
      onSelect(id){const call=calls.find(item=>item.id===id)??page?.mapJobs.find(item=>item.id===id);if(call)void showDetail(call,{panMap:false,revealCard:true});},
      onOrigin(point){originInput.value='';setOrigin(point,'Zona elegida en el mapa');},
      onViewport(){if(mapController&&mapIsVisible())requestSearch();},
    },{point:origin,zoom:origin?(position?.zoom??10):6});
    if(originRevision!==mapRevision){if(origin)mapController.focus(origin);else mapController.overview();}
    for(const id of ['choose-origin','search-area','show-all-map'])document.getElementById(id).disabled=false;
    render();requestSearch();
  }catch(error){
    mapMessage.textContent=`${error.message} La búsqueda en lista sigue disponible.`;
    mapHost.replaceChildren(mapState);requestSearch({immediate:true,allowList:true});
  }finally{mapStarting=false;loadMapButton.disabled=false;}
}
loadMapButton.addEventListener('click',()=>{void analyticsController.track('map_action',{action:'show_map'});void startMap();});

function syncCategories() {
  for (const button of document.querySelectorAll('[data-category]')) {
    const active = button.dataset.category === category;
    button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
  }
}

form.addEventListener('submit',event=>{event.preventDefault();void analyticsController.track('search_submitted');requestSearch({immediate:true,force:true});});
location.addEventListener('change',()=>{territoryFocusPending=location.value;radiusSelect.value='';void analyticsController.track('filter_used',{filter_type:'territory'});requestSearch({immediate:true,force:true});});
document.querySelector('#categories').addEventListener('click',event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  void analyticsController.track('filter_used',{filter_type:'category'});
  category = button.dataset.category; syncCategories(); requestSearch({immediate:true});
});
document.querySelector('#employer-filter').addEventListener('change',event=>{
  void analyticsController.track('filter_used',{filter_type:'employer'});
  employer=event.currentTarget.value;
  requestSearch({immediate:true,force:true});
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
employer=initialParams.get('employer')??'';
category=initialParams.get('category')??'';
const initialTerritory=initialParams.get('city');
if(initialTerritory&&selectableTerritories([initialTerritory]).length){const option=element('option',initialTerritory);option.value=initialTerritory;location.append(option);location.value=initialTerritory;territoryFocusPending=initialTerritory;}

window.addEventListener('pagehide',()=>{search.cancel();placeSearch.cancel();detailRequest?.abort();});
void startMap();
