import {searchCalls,groupSimilarOffers} from './catalog.mjs?v=20261118-optional-territories';
import {distanceKm} from './geography.mjs';
import {createGoogleMap,markerGroups} from './google-map.mjs?v=20261118-territory-views';
import {createMapLoadingState} from './map-loading.mjs';
import {cardVisualTheme,detailBadge,employerBrand,formatDate as date,formatDateTime,offerAgeWarning,offerDates,placesLabel,jobPresentation,resultCountPresentation,resultSummary,setBrandImageFallback} from './presentation.mjs';
import {locateOnce,createViewportSearch,hasActiveSearchFilters,originSearchTransition,clearOriginTransition,resolveSearchBounds,searchGeography,updateMapWithoutLosingJobs,visibleMapJobs} from './map-search.mjs?v=20261119-clear-filters';
import {requestLocationWithPermission} from './location-permission.mjs?v=20261123-location-feedback';
import {installMapActionHints} from './map-action-hints.mjs?v=20261124-long-press-hints';
import {referencePlaceZoom} from './reference-places.mjs?v=20261118-locality-search-ux';
import {beginNewSearch,captureDetailPosition,createJobInteraction,finishDetailInteraction,restoreJobFocus} from './job-interaction.mjs?v=20261116-detail-close-reset';
import {createWorkspaceView,createDisclosure} from './workspace-view.mjs';
import {offerIdFromUrl,shareableOfferUrl,offerShareMessage,shareOffer} from './search-share.mjs?v=20261125-share-message';
import {createRetentionStore} from './retention.mjs?v=20261117-today-offers';
import {dayInSpain,isOfferOnDay} from './today-offers.mjs';
import {siteFetch} from './static-data.mjs?v=20261118-optional-territories';
import {createAnalyticsController,isProductionAnalyticsHost,loadFirebaseAnalytics} from './analytics.mjs';
import {loadAdSensePublisher,requestAdSlot,validAdSensePublisher,watchAdStatus} from './adsense.mjs';
import {observeAdsToggle} from './ad-toggle.mjs';
import {selectableTerritories,territorySelection} from './territories.mjs?v=20261118-territory-views';
import {placeCommunities,placeProvinces} from './place-suggestions.mjs?v=20261118-place-hierarchy';
import {territoryBounds} from './territory-views.mjs';
import {enhanceSearchableSelect} from './searchable-select.mjs';
import {createPlaceHierarchy} from './place-hierarchy.mjs?v=20261119-location-panel';
import {createMobileOfferCarousel,featuredMapOfferId,mobileOfferCarouselSlides} from './mobile-offer-carousel.mjs?v=20261116-mobile-featured-pin';

const analyticsController=createAnalyticsController({config:null,loadSdk:()=>loadFirebaseAnalytics()});
const retention=createRetentionStore();
const analyticsPanel=document.querySelector('#analytics-consent-panel');
const adPrivacySettings=document.querySelector('#ad-privacy-settings');
let adsenseConfig={enabled:false};
let adsensePublisherReady=false;
const adContainer=document.querySelector('#footer-ad');
let adSlotRequested=false;
let adRevision=0;
let activeAds=false;
async function applyAdsEnabled(enabled) {
  if(enabled&&activeAds&&adSlotRequested)return;
  const revision=++adRevision;
  adContainer.hidden=true;
  delete adContainer.dataset.pending;
  if(!enabled||!validAdSensePublisher(adsenseConfig.publisherId)||!adsenseConfig.slotId){
    activeAds=false;
    adsensePublisherReady=false;
    adPrivacySettings.hidden=true;
    adSlotRequested=false;
    const replacement=document.createElement('ins');
    replacement.className='adsbygoogle';
    replacement.setAttribute('aria-label','Anuncio');
    adContainer.querySelector('.adsbygoogle')?.replaceWith(replacement);
    return;
  }
  adsensePublisherReady=await loadAdSensePublisher(adsenseConfig.publisherId);
  if(revision!==adRevision||!adsensePublisherReady)return;
  activeAds=true;
  adPrivacySettings.hidden=false;
  if(adSlotRequested)return;
  const slot=adContainer.querySelector('.adsbygoogle');
  watchAdStatus(slot,adContainer);
  adContainer.dataset.pending='true';
  adContainer.hidden=false;
  adSlotRequested=requestAdSlot(slot,{...adsenseConfig,enabled:true});
  if(!adSlotRequested){delete adContainer.dataset.pending;adContainer.hidden=true;}
}
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
  if(config?.firebaseAnalytics&&isProductionAnalyticsHost(window.location.hostname))analyticsController.setConfig(config.firebaseAnalytics);
  adsenseConfig=config?.adsense??{enabled:false};
  if(config?.firebaseAnalytics&&isProductionAnalyticsHost(window.location.hostname)&&validAdSensePublisher(adsenseConfig.publisherId)&&adsenseConfig.slotId)void observeAdsToggle(config.firebaseAnalytics,enabled=>void applyAdsEnabled(enabled));
  if(analyticsController.getPreference()==='accepted')return analyticsController.initializeFromPreference().then(()=>analyticsController.track('page_view'));
  if(!analyticsController.getPreference())analyticsPanel.hidden=false;
  return undefined;
}).catch(()=>{if(!analyticsController.getPreference())analyticsPanel.hidden=false;});

const form = document.querySelector('#search-form');
const query = document.querySelector('#query');
const location = document.querySelector('#location');
const locationTrigger=document.querySelector('#location-trigger');
const locationSummary=document.querySelector('#location-summary');
const locationPanel=document.querySelector('#location-panel');
const locationBackdrop=document.querySelector('#location-backdrop');
const employerFilter=document.querySelector('#employer-filter');
const searchableEmployer=enhanceSearchableSelect(employerFilter,{label:'Buscar empresa',searchPlaceholder:'Buscar empresa…'});
const list = document.querySelector('#job-list');
const detail = document.querySelector('#job-detail');
const about = document.querySelector('#about-dialog');
let calls = [];
let category = '';
let employer = '';
let origin = null;
let originSource = 'none';
let originZoom=10;
let sharedOfferId=offerIdFromUrl(window.location.href);
let page = null;
let loadError = false;
let detailRequest = null;
let detailReturnJobId = null;
let restoreDetailPosition = null;
let originRevision = 0;
let mapStarting = false;
let locating = false;
let facetSignature = null;
let mapController = null;
let searchBounds = null;
let territoryFocusPending = null;
let selectedTerritoryBounds = null;
let todayOnly=false;
let activeDay=dayInSpain();
const interaction=createJobInteraction(syncJobInteraction);
const originInput = document.querySelector('#origin-city');
const radiusInput=document.querySelector('#radius');
const radiusNumber=document.querySelector('#radius-number');
const radiusValue=document.querySelector('#radius-value');
const radiusRow=document.querySelector('.distance-filter-row');
const radiusTrigger=document.querySelector('#radius-trigger');
const radiusSummary=document.querySelector('#radius-summary');
const radiusDisclosure=createDisclosure(expanded=>{
  radiusRow.dataset.open=String(expanded);
  radiusTrigger.setAttribute('aria-expanded',String(expanded));
});
function closeRadiusPanel({restoreFocus=false}={}){
  if(!radiusDisclosure.snapshot())return;
  radiusDisclosure.toggle();
  if(restoreFocus)radiusTrigger.focus();
}
radiusTrigger.addEventListener('click',()=>{
  if(!radiusDisclosure.snapshot())closeLocationPanel();
  radiusDisclosure.toggle();
  if(radiusDisclosure.snapshot())void analyticsController.track('ui_action',{action:'open_distance_filter'});
  if(radiusDisclosure.snapshot()&&!radiusInput.disabled)radiusInput.focus();
});
document.addEventListener('click',event=>{if(radiusDisclosure.snapshot()&&!radiusRow.contains(event.target))closeRadiusPanel();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&radiusDisclosure.snapshot()){event.preventDefault();closeRadiusPanel({restoreFocus:true});}});
function syncRadiusControls(){
  const distance=Number(radiusInput.value);
  radiusNumber.value=distance?String(distance):'';
  radiusNumber.disabled=radiusInput.disabled;
  radiusValue.textContent=distance?`${distance.toLocaleString('es-ES')} km`:'Sin límite';
  radiusSummary.textContent=radiusValue.textContent;
  radiusInput.style.setProperty('--radius-progress',`${distance/Number(radiusInput.max)*100}%`);
  if(radiusInput.disabled)closeRadiusPanel();
  radiusRow.hidden=radiusInput.disabled;
}
const mapHost = document.querySelector('#google-map');
const mapState = document.querySelector('#map-state');
const mapMessage = document.querySelector('#map-message');
const loadMapButton = document.querySelector('#load-map');
const mapLoading = document.querySelector('#map-loading');
const mapLoadingLabel = document.querySelector('#map-loading-label');
const mapPanel = document.querySelector('#map-panel');
const mapLoadingState = createMapLoadingState(mode => {
  mapLoading.hidden=mode==='hidden';
  mapLoading.dataset.phase=mode;
  mapLoadingLabel.textContent=mode==='refresh'?'Actualizando ofertas…':'Cargando mapa y ofertas…';
  mapPanel.setAttribute('aria-busy',String(mode==='initial'));
});
const mapIsVisible = () => mapHost.clientWidth>0&&mapHost.clientHeight>0;
const workspace = document.querySelector('.workspace');
const mobileMapMedia=window.matchMedia('(max-width:780px)');
const viewButtons = document.querySelectorAll('[data-workspace-view]');
const workspaceView = createWorkspaceView(view=>{
  workspace.dataset.view=view;
  for(const button of viewButtons)button.setAttribute('aria-pressed',String(button.dataset.workspaceView===view));
  requestAnimationFrame(()=>syncMobileFeaturedPin());
},'map',()=>requestAnimationFrame(()=>requestSearch({immediate:true,force:true})));
for(const button of viewButtons)button.addEventListener('click',()=>{
  workspaceView.select(button.dataset.workspaceView);
  void analyticsController.track('ui_action',{action:button.dataset.workspaceView==='map'?'show_map_view':'show_offers_view'});
});
for(const link of document.querySelectorAll('a[href="#results"]'))link.addEventListener('click',()=>workspaceView.select('jobs'));
const filterToggle=document.querySelector('#mobile-filter-toggle');
const advancedFilters=document.querySelector('#advanced-filters');
const filtersDisclosure=createDisclosure(expanded=>{
  filterToggle.setAttribute('aria-expanded',String(expanded));
  advancedFilters.dataset.expanded=String(expanded);
});
filterToggle.addEventListener('click',()=>{
  filtersDisclosure.toggle();
  if(filtersDisclosure.snapshot())void analyticsController.track('ui_action',{action:'open_mobile_filters'});
  else closeRadiusPanel();
});
const savedDialog=document.querySelector('#saved-dialog');
const favoritesButton=document.querySelector('#show-saved');
const todayButton=document.querySelector('#today-offers');
const featured=document.querySelector('#mobile-featured-offer');
const featuredCard=document.querySelector('#featured-card');
const featuredTitle=document.querySelector('#mobile-zone-offers-title');
const featuredCounter=document.querySelector('#mobile-zone-offers-counter');
const featuredPrevious=document.querySelector('#featured-previous');
const featuredNext=document.querySelector('#featured-next');
const featuredCarousel=createMobileOfferCarousel();
let featuredSyncing=false;
let featuredActiveSlot=0;
let featuredOffers=[];
function syncMobileFeaturedPin(state=featuredCarousel.snapshot(),previousId=null) {
  if(previousId&&previousId!==state.activeId)interaction.clearPreview(previousId);
  interaction.setFeatured(featuredMapOfferId(state,mobileMapMedia.matches,workspaceView.snapshot()));
}
mobileMapMedia.addEventListener('change',()=>syncMobileFeaturedPin());
favoritesButton.addEventListener('click',()=>{renderSaved();savedDialog.showModal();void analyticsController.track('ui_action',{action:'open_favorites'});});
document.querySelector('#close-saved').addEventListener('click',()=>savedDialog.close());
todayButton.addEventListener('click',()=>{
  beginNewSearch(interaction,document.querySelector('#results'));
  todayOnly=!todayOnly;
  void analyticsController.track('ui_action',{action:todayOnly?'show_today_offers':'hide_today_offers'});
  todayButton.setAttribute('aria-pressed',String(todayOnly));
  requestSearch({immediate:true,force:true});
});
featuredPrevious.addEventListener('click',()=>moveMobileCarousel(-1));
featuredNext.addEventListener('click',()=>moveMobileCarousel(1));
function settleMobileCarousel() {
  if(featuredSyncing||!featuredCard.clientWidth)return;
  const nextSlot=Math.round(featuredCard.scrollLeft/featuredCard.clientWidth);
  const delta=nextSlot-featuredActiveSlot;
  if(!delta)return;
  const previousId=featuredCarousel.snapshot().activeId;
  const state=featuredCarousel.move(delta);
  updateMobileCarouselControls(state);
  renderMobileCarouselSlides(state);
  syncMobileFeaturedPin(state,previousId);
}
if('onscrollend' in featuredCard)featuredCard.addEventListener('scrollend',settleMobileCarousel);
else {
  let scrollTimer;
  featuredCard.addEventListener('scroll',()=>{
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(settleMobileCarousel,180);
  });
}
const activeGeography = () => searchGeography(origin,radiusInput.value,Boolean(location.value));

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
  if(!url)return null;
  const link=externalLink(label,url,className);
  link.addEventListener('click',()=>{void analyticsController.track('offer_original_clicked');});
  return link;
}

function syncSavedButtons() {
  for(const button of document.querySelectorAll('[data-save-offer]')){
    const saved=retention.isOfferSaved(button.dataset.saveOffer);
    button.setAttribute('aria-pressed',String(saved));
    const label=`${saved?'Quitar de favoritos':'Añadir a favoritos'}: ${button.dataset.offerTitle}`;
    button.setAttribute('aria-label',label);
    button.title=label;
    const visibleLabel=button.querySelector('.save-offer-label');
    if(visibleLabel)visibleLabel.textContent=saved?button.dataset.savedLabel:button.dataset.unsavedLabel;
  }
  syncFavoritesCount();
}

function syncFavoritesCount() {
  const count=retention.savedOffers().length;
  favoritesButton.textContent=`(${count}) Favoritos`;
}

function materialIcon(className) {
  const icon=element('span',undefined,`material-icon ${className}`);
  icon.setAttribute('aria-hidden','true');
  return icon;
}

function favoriteIcon() {
  return materialIcon('favorite-icon');
}

function saveOfferButton(call,{showLabel=false,savedLabel='Quitar de favoritos',unsavedLabel='Añadir a favoritos'}={}) {
  const button=element('button',undefined,'save-offer');
  button.type='button';button.dataset.saveOffer=call.id;button.dataset.offerTitle=call.title;
  button.dataset.savedLabel=savedLabel;button.dataset.unsavedLabel=unsavedLabel;
  button.addEventListener('click',()=>{retention.toggleOffer(call);syncSavedButtons();if(savedDialog.open)renderSaved();});
  button.append(favoriteIcon());
  const saved=retention.isOfferSaved(call.id);
  if(showLabel)button.append(element('span',saved?savedLabel:unsavedLabel,'save-offer-label'));
  button.setAttribute('aria-pressed',String(saved));
  const label=`${saved?'Quitar de favoritos':'Añadir a favoritos'}: ${call.title}`;
  button.setAttribute('aria-label',label);
  button.title=label;
  return button;
}

function offerDistanceLabel(call) {
  const distance=distanceKm(origin,call.location?.point);
  return Number.isFinite(distance)?`≈ ${new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(distance)} km de tu zona`:'Abrir ubicación';
}

function offerMapLink(call,{className='',compact=false}={}) {
  const mapQuery=call.location?.point?.slice().reverse().join(',')??`${call.city}, ${call.province}, España`;
  const label=offerDistanceLabel(call);
  const link=externalLink(undefined,`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,className);
  link.append(materialIcon('location-icon'));
  if(!compact)link.append(element('span',label));
  link.setAttribute('aria-label',`${label}. Abrir ubicación en Google Maps: ${call.title}`);
  link.title=`${label} · Google Maps`;
  return link;
}

function shareFeedback(className='offer-share-feedback') {
  const feedback=element('div',undefined,className);
  const status=element('span',undefined,'offer-share-status');status.setAttribute('role','status');
  const link=element('textarea',undefined,'offer-share-link');link.readOnly=true;
  link.setAttribute('aria-label','Mensaje para compartir la oferta');link.hidden=true;
  feedback.append(status,link);
  return {feedback,status,link};
}

function shareOfferButton(call,{label='Compartir oferta',status,link,onShared,className='share-offer'}={}) {
  const button=element('button',label??undefined,className);button.type='button';
  button.prepend(materialIcon('share-icon'));
  button.setAttribute('aria-label',`Compartir oferta: ${call.title}`);
  button.title=`Compartir oferta: ${call.title}`;
  button.addEventListener('click',async()=>{
    const url=shareableOfferUrl(window.location.href,call.id);
    if(!url){if(status)status.textContent='No se pudo crear el enlace.';return;}
    if(status)status.textContent='';if(link)link.hidden=true;
    try {
      const nativeShare=!!navigator.share;
      await shareOffer(call,url,navigator);
      if(status&&!nativeShare)status.textContent='Mensaje de la oferta copiado';
      onShared?.();
    }catch(error){
      if(error?.name==='AbortError')return;
      if(link){link.value=`${offerShareMessage(call)}\n${url}`;link.hidden=false;link.focus();link.select();}
      if(status)status.textContent=link?'Selecciona y copia este mensaje':'No se pudo copiar el mensaje.';
    }
  });
  return button;
}

function offerActionsMenu(call) {
  const menu=element('details',undefined,'offer-actions');
  const toggle=element('summary',undefined,'offer-actions-toggle');
  toggle.setAttribute('aria-label',`Opciones de la oferta: ${call.title}`);
  toggle.append(materialIcon('more-vert-icon'));
  toggle.addEventListener('click',()=>{
    for(const other of document.querySelectorAll('.offer-actions[open]'))if(other!==menu)other.open=false;
  });
  const panel=element('div',undefined,'offer-actions-menu');
  const favorite=saveOfferButton(call,{showLabel:true});
  favorite.addEventListener('click',()=>{menu.open=false;toggle.focus();});
  const {feedback,status,link}=shareFeedback();
  const share=shareOfferButton(call,{label:'Compartir oferta',status,link,onShared:()=>{menu.open=false;toggle.focus();}});
  const map=offerMapLink(call,{className:'offer-menu-location'});
  panel.append(favorite,share,map,feedback);
  menu.append(toggle,panel);
  return menu;
}

document.addEventListener('click',event=>{
  for(const menu of document.querySelectorAll('.offer-actions[open]'))if(!menu.contains(event.target))menu.open=false;
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const menu=document.querySelector('.offer-actions[open]');
  if(!menu)return;
  menu.open=false;menu.querySelector('summary')?.focus();event.preventDefault();event.stopPropagation();
});

function renderSaved() {
  syncFavoritesCount();
  const offers=document.querySelector('#saved-offers');
  const offerRows=retention.savedOffers().map(item=>{
    const row=element('div',undefined,'saved-row saved-offer-row');
    const open=element('button',`${item.title} · ${item.city}`);open.type='button';
    open.addEventListener('click',()=>{savedDialog.close();void analyticsController.track('saved_offer_opened');void showDetail(item);});
    row.append(open,savedOfferActions(item));return row;
  });
  offers.replaceChildren(...(offerRows.length?offerRows:[element('p','Aún no has guardado ofertas.') ]));
}

function savedOfferActions(item) {
  const actions=element('div',undefined,'saved-offer-actions');
  const {feedback,status,link}=shareFeedback('saved-offer-feedback');
  actions.append(
    shareOfferButton(item,{label:null,status,link,className:'saved-offer-share'}),
    offerMapLink(item,{className:'saved-offer-location',compact:true}),
  );
  const remove=element('button',undefined,'remove-saved-offer');remove.type='button';
  remove.append(materialIcon('close-icon'));
  remove.setAttribute('aria-label',`Eliminar de favoritos: ${item.title}`);
  remove.title=`Eliminar de favoritos: ${item.title}`;
  remove.addEventListener('click',()=>{retention.toggleOffer(item);renderSaved();syncSavedButtons();});
  actions.append(remove,feedback);
  return actions;
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
  mapController?.preview(state.activeId);
}

function scrollCardIntoView(id) {
  const article=[...list.querySelectorAll('[data-job-id]')].find(node=>node.dataset.jobId===id);
  article?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}

function detailActions(call,presentation) {
  const actions=element('div',undefined,'detail-actions');
  const original=sourceLink(presentation.sourceLink,call.sourceUrl,'primary-button');
  if(original)actions.append(original);
  else actions.classList.add('without-original');
  const detailSecondary=element('div',undefined,'detail-secondary-actions');
  const {feedback,status,link}=shareFeedback('detail-share-feedback');
  detailSecondary.append(saveOfferButton(call,{showLabel:true,savedLabel:'En favoritos',unsavedLabel:'Favorito'}));
  detailSecondary.append(shareOfferButton(call,{label:'Compartir',status,link,className:'detail-share-button'}));
  detailSecondary.append(offerMapLink(call,{className:'detail-map-link'}));
  actions.append(detailSecondary,feedback);
  return actions;
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
  const facts = element('dl', undefined, 'detail-facts');
  for (const [label, value] of [['Plazas',placesLabel(call)],['Régimen',call.regime],['Retribución',presentation.salaryLabel],['Ubicación',presentation.locationLabel],[dates.publication.label,dates.publication.value],[dates.checked.label,dates.checked.value],['Fin de publicación',call.closingDate?date(call.closingDate):'No indicada; comprueba vigencia en el origen']]) {
    const fact = element('div'); fact.append(element('dt', label), element('dd', value)); facts.append(fact);
  }
  body.append(brandHeader,title,detailActions(call,presentation),facts);
  const ageWarning=offerAgeWarning(call);
  if(ageWarning)body.append(element('p',ageWarning,'offer-age-warning'));
  body.append(element('h3','Texto del anuncio publicado'));
  for (const paragraph of call.paragraphs) body.append(element('p', paragraph, 'source-paragraph'));
  body.append(element('p',presentation.note, 'detail-note'));
  body.append(element('p', `${call.id} · Fuente: ${presentation.source}. ${presentation.provenance}`, 'detail-provenance'));
  content.append(body);
  if(!detail.open) detail.showModal();
}

async function showDetail(call,{panMap=false,revealCard=false}={}) {
  void analyticsController.track('offer_detail_opened');
  detailRequest?.abort();
  if(!detail.open)restoreDetailPosition=captureDetailPosition(document.querySelector('#results'),featuredCard);
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
  visualFrame.append(visual);
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
  const ageWarning=offerAgeWarning(call);
  if(ageWarning)button.append(element('p',ageWarning,'offer-age-warning'));
  const footer = element('div', undefined, 'card-footer');
  const cardDates=element('div',undefined,'card-dates');
  cardDates.append(element('span',`${dates.publication.short} ${dates.publication.value}`),element('span',`${dates.checked.short} ${dates.checked.value}`));
  footer.append(cardDates);
  const original=sourceLink(call.sourceUrl?`${call.id} ↗`:call.id,call.sourceUrl);
  footer.append(original??element('span',call.id),offerActionsMenu(call));
  article.append(button, footer);
  return article;
}

function updateMobileCarouselControls(state) {
  featuredTitle.textContent=`${state.total} ${state.total===1?'oferta':'ofertas'} en esta zona`;
  featuredCounter.textContent=state.total?`${state.index+1} de ${state.total}`:'';
  featuredPrevious.disabled=!state.hasPrevious;
  featuredNext.disabled=!state.hasNext;
}

function scrollMobileCarouselTo(behavior='auto') {
  featuredCard.scrollTo({left:featuredActiveSlot*featuredCard.clientWidth,behavior});
}

function moveMobileCarousel(delta) {
  const previousId=featuredCarousel.snapshot().activeId;
  const state=featuredCarousel.move(delta);
  updateMobileCarouselControls(state);
  renderMobileCarouselSlides(state);
  syncMobileFeaturedPin(state,previousId);
}

function renderMobileCarouselSlides(state) {
  const slides=mobileOfferCarouselSlides(featuredOffers,state);
  featuredActiveSlot=slides.activeSlot;
  featuredSyncing=true;
  featuredCard.replaceChildren(...slides.offers.map(call=>{
    const slide=element('div',undefined,'mobile-offer-slide');
    slide.append(card(call));
    return slide;
  }));
  requestAnimationFrame(()=>{
    scrollMobileCarouselTo();
    requestAnimationFrame(()=>{featuredSyncing=false;});
  });
}

function renderMobileOfferCarousel(offers) {
  const sameOffers=featuredCarousel.matches(offers);
  featuredOffers=offers;
  const previousId=featuredCarousel.snapshot().activeId;
  const state=featuredCarousel.update(offers);
  featured.hidden=state.total===0;
  updateMobileCarouselControls(state);
  syncMobileFeaturedPin(state,previousId);
  if(sameOffers)return;
  renderMobileCarouselSlides(state);
}

function visibleCards(results) {
  if(!window.matchMedia('(max-width:780px)').matches)return results.map(card);
  return groupSimilarOffers(results).flatMap(group=>{
    const first=card(group[0]);
    if(group.length===1)return [first];
    const more=element('details',undefined,'similar-offers');
    const summary=element('summary',`Ver ${group.length-1} ${group.length===2?'oferta similar':'ofertas similares'} de ${group[0].employer} en ${group[0].city}`);
    more.append(summary,...group.slice(1).map(card));
    return [first,more];
  });
}

function todayCount(result,geography=activeGeography()) {
  return geography.radiusKm!==null
    ?visibleMapJobs(result,geography.origin,geography.radiusKm).filter(call=>isOfferOnDay(call,activeDay)).length
    :result?.todayTotal??0;
}

function render() {
  const geography=activeGeography();
  const results=searchCalls(calls,geography);
  const mapResults=visibleMapJobs(page,geography.origin,geography.radiusKm);
  if(geography.origin&&!todayOnly)results.sort((a,b)=>distanceKm(geography.origin,a.location?.point)-distanceKm(geography.origin,b.location?.point));
  list.replaceChildren(...visibleCards(results));
  renderMobileOfferCarousel(mapController?mapResults:[]);
  todayButton.hidden=todayCount(page,geography)===0;
  todayButton.setAttribute('aria-pressed',String(todayOnly));
  const countPresentation=resultCountPresentation(page,{hasBounds:Boolean(searchBounds),radiusKm:geography.radiusKm,radiusCount:mapResults.length});
  const todayVisibleCount=geography.radiusKm!==null?mapResults.length:page?.total??0;
  document.querySelector('#result-count').textContent=todayOnly?`${todayVisibleCount.toLocaleString('es-ES')} ${todayVisibleCount===1?'oferta':'ofertas'} del día ${searchBounds?'en esta zona':'en tu búsqueda'}`:countPresentation.title;
  document.querySelector('#result-scope').textContent=todayOnly?'Publicadas o detectadas hoy':countPresentation.scope;
  const summary=resultSummary(results);
  document.querySelector('#result-summary').textContent=todayOnly?`Mostrando ${Math.min(results.length,300)} de ${todayVisibleCount} ofertas de hoy en tarjetas · El mapa muestra sus puntos`:page?.truncated?`Mostrando 300 de ${page.total} tarjetas · El mapa incluye todos los puntos`:summary;
  const filtersActive=hasActiveSearchFilters({query:query.value,territory:location.value,category,employer,radius:radiusInput.value,originSource,todayOnly});
  document.querySelector('#empty-state').hidden=loadError||list.getAttribute('aria-busy')==='true'||results.length>0||mapResults.length>0;
  document.querySelector('#empty-clear').hidden=!filtersActive;
  document.querySelector('#clear-filters').hidden=!filtersActive;
  document.querySelector('#mobile-clear-filters').hidden=!filtersActive;
  updateMapWithoutLosingJobs(mapController,mapResults,geography.origin,geography.radiusKm,()=>{
    mapController=null;
    renderMobileOfferCarousel([]);
    mapHost.replaceChildren(mapState);
    mapMessage.textContent='El mapa no está disponible ahora. Puedes seguir consultando las ofertas en la lista.';
    mapLoadingState.fail();
  });
  syncJobInteraction(interaction.snapshot());
  const params=new URLSearchParams();
  if(query.value)params.set('q',query.value);
  if(location.value)params.set('city',location.value);
  if(category)params.set('category',category);
  if(employer)params.set('employer',employer);
  if(sharedOfferId)params.set('oferta',sharedOfferId);
  history.replaceState(null,'',`${locationUrl()}${params.size?`?${params}`:''}`);
}

function updateFacets(facets) {
  const signature=JSON.stringify(facets);
  if(signature===facetSignature)return;
  facetSignature=signature;
  const territory=location.value;
  location.replaceChildren(element('option','Toda España'));
  location.firstChild.value='';
  const territories=new Set([...selectableTerritories(facets.regions),...placeCommunities(),...placeCommunities().flatMap(placeProvinces)]);
  for(const region of territories){const option=element('option',region);option.value=region;location.append(option);}
  location.value=territory;
  employerFilter.replaceChildren(element('option','Todas las empresas'));
  employerFilter.firstChild.value='';
  for(const item of facets.employers??[]){const option=element('option',item.label);option.value=item.id;employerFilter.append(option);}
  employerFilter.value=employer;
  syncLocationSummary();searchableEmployer.refresh();
  const categories=document.querySelector('#categories');categories.replaceChildren();
  for(const {id,label} of [{id:'',label:'Todas las áreas'},...facets.categories]) {
    const button=element('button',label,'filter-chip');button.type='button';button.dataset.category=id;categories.append(button);
  }
  syncCategories();
}

const search=createViewportSearch({
  fetchImpl:siteFetch,
  onLoading(){list.setAttribute('aria-busy','true');document.querySelector('#search-status').textContent='Actualizando ofertas de la zona…';mapLoadingState.searchStarted();},
  onResult(result){
    if(!Array.isArray(result.jobs)||!Array.isArray(result.mapJobs)||!result.facets)throw new Error('Respuesta de catálogo inválida');
    if(todayOnly&&todayCount(result)===0){
      todayOnly=false;todayButton.hidden=true;todayButton.setAttribute('aria-pressed','false');
      requestSearch({immediate:true,force:true});
      return;
    }
    calls=result.jobs;page=result;loadError=false;
    updateFacets(result.facets);
    document.querySelector('#snapshot-label').textContent=`Catálogo actualizado el ${formatDateTime(result.checkedAt)} · ${result.sources.length} fuentes`;
    list.setAttribute('aria-busy','false');render();mapLoadingState.searchFinished();
    if(result.total===0&&!todayOnly)void analyticsController.track('search_no_results');
    document.querySelector('#search-status').textContent=searchBounds?'Ofertas de la zona visible del mapa.':mapController?'Búsqueda sin área de mapa, limitada a 300 ofertas. Abre el mapa para acotar la zona.':'Mapa no disponible; búsqueda en lista con transferencia limitada.';
    if(territoryFocusPending!==null){
      const territory=territoryFocusPending;territoryFocusPending=null;
      if(territory===location.value&&mapController){
        if(selectedTerritoryBounds)mapController.fitArea(selectedTerritoryBounds);
        else if(result.mapJobs.length)mapController.fit(result.mapJobs,null);
      }
    }
  },
  onError(){
    calls=[];page=null;loadError=true;list.setAttribute('aria-busy','false');render();mapLoadingState.searchFinished();
    document.querySelector('#result-count').textContent='No se pudo actualizar esta zona';
    document.querySelector('#search-status').textContent='Comprueba la conexión y pulsa Buscar oportunidades para reintentar.';
  },
});

function requestSearch({immediate=false,force=false,allowList=false,skipMapBounds=false}={}) {
  if(mapStarting&&!mapController&&!allowList)return;
  activeDay=dayInSpain();
  if(!skipMapBounds)searchBounds=resolveSearchBounds(mapController?.bounds(),mapIsVisible(),searchBounds,territoryFocusPending!==null);
  const params=new URLSearchParams();
  if(searchBounds)params.set('bounds',searchBounds.join(','));
  if(query.value)params.set('q',query.value);
  if(location.value)params.set('city',location.value);
  if(category)params.set('category',category);
  if(employer)params.set('employer',employer);
  params.set('day',activeDay);
  if(todayOnly)params.set('onlyToday','1');
  search.request(params,{immediate,force});
}

function locationUrl() { return window.location.pathname; }

function syncLocationSummary(){
  locationSummary.textContent=originInput.value||location.value||(originSource==='device'?'Cerca de mí':origin?'Zona del mapa':'Toda España');
}
function closeLocationPanel({restoreFocus=false}={}){
  locationPanel.hidden=true;locationBackdrop.hidden=true;locationTrigger.setAttribute('aria-expanded','false');
  placeHierarchy.close();
  if(restoreFocus)locationTrigger.focus();
}
locationTrigger.addEventListener('click',()=>{
  if(!locationPanel.hidden){closeLocationPanel();return;}
  locationPanel.hidden=false;locationBackdrop.hidden=false;locationTrigger.setAttribute('aria-expanded','true');
  void analyticsController.track('ui_action',{action:'open_location_filter'});
  locationPanel.querySelector('.place-hierarchy-trigger').focus();
});
document.querySelector('#location-close').addEventListener('click',()=>closeLocationPanel({restoreFocus:true}));
document.querySelector('#location-done').addEventListener('click',()=>{closeLocationPanel({restoreFocus:true});workspaceView.select('map');});
locationBackdrop.addEventListener('click',()=>closeLocationPanel({restoreFocus:true}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!locationPanel.hidden){event.preventDefault();closeLocationPanel({restoreFocus:true});}});
document.addEventListener('click',event=>{if(!locationPanel.hidden&&!event.composedPath().includes(locationPanel)&&!event.composedPath().includes(locationTrigger))closeLocationPanel();});

function clear() {
  void analyticsController.track('ui_action',{action:'clear_filters'});
  beginNewSearch(interaction,document.querySelector('#results'));
  cancelPlaceSearch();placeHierarchy.reset();
  mapController?.cancelOriginSelection();
  territoryFocusPending=null;selectedTerritoryBounds=null;
  query.value = ''; location.value = ''; category = ''; employer = '';
  employerFilter.value='';searchableEmployer.refresh();
  originRevision++;radiusInput.value='0';
  const clearedOrigin=clearOriginTransition(origin,originSource);
  origin=clearedOrigin.origin;originSource=clearedOrigin.originSource;
  if(clearedOrigin.resetMap){
    searchBounds=null;originZoom=10;mapController?.overview();
  }
  if(originSource==='device')mapController?.focus(origin,originZoom);
  else {
    originInput.value='';radiusInput.disabled=true;
    document.querySelector('#origin-status').textContent = 'Elige una localidad o selecciona tu zona en el mapa.';
  }
  syncRadiusControls();syncLocationSummary();closeLocationPanel();closeRadiusPanel();
  todayOnly=false;
  syncCategories();
  requestSearch({immediate:true,force:true,skipMapBounds:clearedOrigin.resetMap});
  render();
}

function setOrigin(point,label,source='manual',zoom=10) {
  beginNewSearch(interaction,document.querySelector('#results'));
  cancelPlaceSearch();
  mapController?.cancelOriginSelection();originRevision++;
  const next=originSearchTransition(point);
  searchBounds=next.bounds;territoryFocusPending=next.pendingTerritory;selectedTerritoryBounds=null;
  location.value=next.territory;origin=next.origin;originSource=source;originZoom=zoom;radiusInput.value='0';radiusInput.disabled=false;
  syncRadiusControls();
  syncLocationSummary();
  document.querySelector('#origin-status').textContent=`${label} · Ubicación aproximada; el mapa filtra la zona visible`;
  mapController?.focus(point,zoom);
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
  cancelPlaceSearch();placeHierarchy.reset();originRevision++;
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
      setOrigin(position.point,'Ubicación aproximada del dispositivo','device',position.zoom);
    } else {
      document.querySelector('#origin-status').textContent=position.status==='denied'?'Este navegador ha rechazado el permiso de ubicación. Actívalo para GeoEmpleo360 en los ajustes del sitio y vuelve a pulsar «Usar mi ubicación», o elige una localidad.':'No pudimos localizarte. Elige una localidad o mueve el mapa.';
    }
    return position;
  }finally{locating=false;document.querySelector('#use-location').disabled=false;}
}

function selectReferencePlace(place){
  mapController?.cancelOriginSelection();originRevision++;
  originInput.value=`${place.name} · ${place.province}`;
  workspaceView.select('map');
  setOrigin([place.longitude,place.latitude],`Zona elegida manualmente: ${place.label}`,'manual',referencePlaceZoom(place));
  void analyticsController.track('filter_used',{filter_type:'locality'});
}
function selectReferenceTerritory({community,province}){
  const selected=territorySelection(community,province);
  void analyticsController.track('filter_used',{filter_type:province?'province':'community'});
  beginNewSearch(interaction,document.querySelector('#results'));
  mapController?.cancelOriginSelection();originRevision++;
  origin=null;originSource='manual';originInput.value='';radiusInput.value='0';radiusInput.disabled=true;syncRadiusControls();
  if(![...location.options].some(option=>option.value===selected.name)){
    const option=element('option',selected.name);option.value=selected.name;location.append(option);
  }
  location.value=selected.name;syncLocationSummary();
  searchBounds=null;territoryFocusPending=selected.name;selectedTerritoryBounds=selected.bounds;
  document.querySelector('#origin-status').textContent=`Mostrando ${province?`la provincia de ${province}`:community} en el mapa`;
  workspaceView.select('map');mapController?.fitArea(selected.bounds);
  requestSearch({immediate:true,force:true});
}
const placeHierarchy=createPlaceHierarchy({
  panel:document.querySelector('#place-hierarchy'),
  fetchImpl:siteFetch,onSelect:selectReferencePlace,onSelectTerritory:selectReferenceTerritory,
});
function cancelPlaceSearch(){placeHierarchy.cancel();}
function commitRadius(){
  beginNewSearch(interaction,document.querySelector('#results'));
  void analyticsController.track('filter_used',{filter_type:'distance'});
  render();
}
radiusInput.addEventListener('input',()=>syncRadiusControls());
radiusInput.addEventListener('change',commitRadius);
radiusNumber.addEventListener('input',()=>{
  radiusInput.value=String(Math.min(Number(radiusInput.max),Math.max(0,Math.round(Number(radiusNumber.value)||0))));
  syncRadiusControls();render();
});
radiusNumber.addEventListener('change',()=>{syncRadiusControls();commitRadius();});
syncRadiusControls();
installMapActionHints(document.querySelectorAll('.map-actions button'));
document.querySelector('#choose-origin').addEventListener('click',() => {
  void analyticsController.track('map_action',{action:'choose_zone'});
  mapController?.chooseOrigin(); document.querySelector('#origin-status').textContent = 'Haz clic en el mapa para situar tu zona de búsqueda.';
});
document.querySelector('#search-area').addEventListener('click',()=>{void analyticsController.track('map_action',{action:'search_visible_area'});requestSearch({immediate:true,force:true});});
document.querySelector('#show-all-map').addEventListener('click',()=>{void analyticsController.track('map_action',{action:'show_spain'});mapController?.overview();});
document.querySelector('#use-location').addEventListener('click',()=>{void analyticsController.track('map_action',{action:'use_my_location'});if(mapController||mapStarting)void useMyLocation({interactive:true});else void startMap({interactive:true});});

async function startMap({interactive=false}={}) {
  if(mapStarting||mapController)return;
  const revision=originRevision;
  mapLoadingState.retry();
  mapStarting=true;loadMapButton.disabled=true;
  try {
    const response=await fetch('/config.json');
    if(!response.ok)throw new Error('Configuración local no disponible.');
    const config=await response.json();
    if(!config.googleMapsApiKey){mapMessage.textContent='Falta la configuración del mapa. Puedes buscar en la lista o elegir una localidad.';mapLoadingState.fail();requestSearch({immediate:true,allowList:true});return;}
    mapMessage.textContent='Permite tu ubicación para empezar cerca de ti; también puedes elegir una localidad.';
    const position=originRevision===revision&&(interactive||!location.value)?await useMyLocation({interactive}):null;
    mapMessage.textContent='Cargando el mapa y las ofertas de tu zona…';
    const mapRevision=originRevision;
    mapController=await createGoogleMap(mapHost,config,{
      onSelect(id){const call=calls.find(item=>item.id===id)??page?.mapJobs.find(item=>item.id===id);if(call)void showDetail(call,{panMap:false,revealCard:true});},
      onOrigin(point){originInput.value='';placeHierarchy.reset();setOrigin(point,'Zona elegida en el mapa');},
      onViewport(){if(mapController&&mapIsVisible())requestSearch();},
      onReady(){mapLoadingState.mapReady();},
    },{point:origin,zoom:origin?(position?.zoom??originZoom):6});
    if(selectedTerritoryBounds)mapController.fitArea(selectedTerritoryBounds);
    else if(originRevision!==mapRevision){if(origin)mapController.focus(origin,originZoom);else mapController.overview();}
    for(const id of ['choose-origin','search-area','show-all-map'])document.getElementById(id).disabled=false;
    render();requestSearch();
  }catch(error){
    mapMessage.textContent=`${error.message} La búsqueda en lista sigue disponible.`;
    mapHost.replaceChildren(mapState);mapLoadingState.fail();requestSearch({immediate:true,allowList:true});
  }finally{mapStarting=false;loadMapButton.disabled=false;}
}
loadMapButton.addEventListener('click',()=>{void analyticsController.track('map_action',{action:'show_map'});void startMap();});

function syncCategories() {
  for (const button of document.querySelectorAll('[data-category]')) {
    const active = button.dataset.category === category;
    button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
  }
}

form.addEventListener('submit',event=>{event.preventDefault();beginNewSearch(interaction,document.querySelector('#results'));void analyticsController.track('search_submitted');requestSearch({immediate:true,force:true});});
location.addEventListener('change',()=>{
  beginNewSearch(interaction,document.querySelector('#results'));
  placeHierarchy.setTerritory(location.value);syncLocationSummary();selectedTerritoryBounds=territoryBounds(location.value);
  territoryFocusPending=location.value;radiusInput.value='0';radiusInput.disabled=true;syncRadiusControls();
  void analyticsController.track('filter_used',{filter_type:'territory'});
  if(selectedTerritoryBounds)mapController?.fitArea(selectedTerritoryBounds);
  requestSearch({immediate:true,force:true});
});
document.querySelector('#categories').addEventListener('click',event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  beginNewSearch(interaction,document.querySelector('#results'));
  void analyticsController.track('filter_used',{filter_type:'category'});
  category = button.dataset.category; syncCategories(); requestSearch({immediate:true});
});
document.querySelector('#employer-filter').addEventListener('change',event=>{
  beginNewSearch(interaction,document.querySelector('#results'));
  void analyticsController.track('filter_used',{filter_type:'employer'});
  employer=event.currentTarget.value;
  requestSearch({immediate:true,force:true});
});
document.querySelector('#clear-filters').addEventListener('click',clear);
document.querySelector('#mobile-clear-filters').addEventListener('click',clear);
document.querySelector('#empty-clear').addEventListener('click',clear);
document.querySelector('#close-detail').addEventListener('click',()=>detail.close());
detail.addEventListener('close',()=>{
  detailRequest?.abort();detailRequest=null;
  if(sharedOfferId){
    sharedOfferId=null;
    const url=new URL(window.location.href);url.searchParams.delete('oferta');
    history.replaceState(null,'',`${url.pathname}${url.search}`);
  }
  const returnId=detailReturnJobId;detailReturnJobId=null;
  const restorePosition=restoreDetailPosition;restoreDetailPosition=null;
  requestAnimationFrame(()=>{
    finishDetailInteraction(interaction,()=>{
      if(window.matchMedia('(max-width:780px)').matches&&workspaceView.snapshot()==='map') {
        document.querySelector('#map-panel').focus({preventScroll:true});
      } else {
        restoreJobFocus(list,returnId,document.querySelector('#results'));
      }
    });
    restorePosition?.();
  });
});
document.querySelector('#about-button').addEventListener('click',() => about.showModal());
document.querySelector('#close-about').addEventListener('click',() => about.close());

const initialParams=new URLSearchParams(window.location.search);
query.value=initialParams.get('q')??'';
employer=initialParams.get('employer')??'';
category=initialParams.get('category')??'';
const initialTerritory=initialParams.get('city');
if(initialTerritory&&selectableTerritories([initialTerritory]).length){const option=element('option',initialTerritory);option.value=initialTerritory;location.append(option);location.value=initialTerritory;placeHierarchy.setTerritory(initialTerritory);syncLocationSummary();territoryFocusPending=initialTerritory;}
syncLocationSummary();

window.matchMedia('(max-width:780px)').addEventListener('change',render);
window.addEventListener('pagehide',()=>{search.cancel();placeHierarchy.cancel();detailRequest?.abort();});
syncFavoritesCount();
void startMap();
if(sharedOfferId)void showDetail({id:sharedOfferId,title:'Oferta compartida',source:'GeoEmpleo360'},{panMap:false});
