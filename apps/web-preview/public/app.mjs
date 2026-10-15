import { searchCalls } from './catalog.mjs';
import {distanceKm} from './geography.mjs';
import {createGoogleMap,markerGroups} from './google-map.mjs';
import {placesLabel,jobPresentation,resultSummary} from './presentation.mjs';

const form = document.querySelector('#search-form');
const query = document.querySelector('#query');
const location = document.querySelector('#location');
const list = document.querySelector('#job-list');
const detail = document.querySelector('#job-detail');
const about = document.querySelector('#about-dialog');
let calls = [];
let category = '';
let origin = null;
let bounds = null;
let places = [];
let mapController = null;
const originInput = document.querySelector('#origin-city');
const radiusSelect = document.querySelector('#radius');
const mapHost = document.querySelector('#google-map');
const mapState = document.querySelector('#map-state');
const mapMessage = document.querySelector('#map-message');
const loadMapButton = document.querySelector('#load-map');
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

function showDetail(call) {
  mapController?.select(call.id);
  const presentation=jobPresentation(call);
  detail.querySelector('.public-badge').textContent=`Oferta real · ${presentation.source}`;
  const content = document.querySelector('#detail-content');
  content.replaceChildren();
  const body = element('div', undefined, 'detail-body');
  const title = element('h2', call.title); title.id = 'detail-title';
  body.append(title, element('p', `${call.employer} · ${call.city}, ${call.province}`, 'detail-employer'));
  const facts = element('dl', undefined, 'detail-facts');
  for (const [label, value] of [['Plazas',placesLabel(call)],['Régimen',call.regime],['Retribución',presentation.salaryLabel],['Ubicación',call.location?'Municipio aproximado; no dirección exacta':'Sin coordenadas verificadas'],['Publicación',date(call.publishedAt)],['Fin de publicación',call.closingDate?date(call.closingDate):'Consultar bases; no calculado']]) {
    const fact = element('div'); fact.append(element('dt', label), element('dd', value)); facts.append(fact);
  }
  body.append(facts, element('h3','Texto del anuncio publicado'));
  for (const paragraph of call.paragraphs) body.append(element('p', paragraph, 'source-paragraph'));
  body.append(element('p',presentation.note, 'detail-note'));
  const links = element('div', undefined, 'detail-links');
  links.append(externalLink(presentation.sourceLink, call.sourceUrl, 'primary-button'), externalLink('Ver municipio en Google Maps ↗', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${call.city}, ${call.province}, España`)}`, 'secondary-button'));
  body.append(links, element('p', `${call.id} · Consultado el ${date(call.checkedAt)}. Fuente: ${presentation.source}. ${presentation.provenance}`, 'detail-provenance'));
  content.append(body);
  detail.showModal();
}

function card(call) {
  const article = element('article', undefined, 'job-card');
  article.dataset.jobId = call.id;
  const button = element('button', undefined, 'card-open');
  button.type = 'button'; button.setAttribute('aria-label', `Ver oferta: ${call.title}`);
  button.addEventListener('click', () => showDetail(call));
  const top = element('div', undefined, 'card-top');
  top.append(element('span', call.city.slice(0,2).toLocaleUpperCase('es'), 'employer-avatar'), element('span', call.employer, 'employer-name'), element('span','↗','card-arrow'));
  const locationLine = element('p', `${call.city}, ${call.province}`, 'location-line');
  const tags = element('div', undefined, 'job-meta');
  tags.append(element('span',placesLabel(call), 'meta-tag'), element('span',call.categoryLabel,'meta-tag'), element('span',call.kind==='public_call'?'Turno libre':call.source,'meta-tag'));
  tags.append(element('span',call.location?'Ubicación municipal':'Ubicación sin verificar','meta-tag'));
  if (origin) {
    const distance = distanceKm(origin,call.location?.point);
    if (Number.isFinite(distance)) tags.append(element('span',`≈ ${new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(distance)} km de tu zona`,'distance-tag'));
  }
  button.append(top, element('h3',call.title), locationLine, tags, element('p',jobPresentation(call).salaryLabel,'salary-label'));
  const footer = element('div', undefined, 'card-footer');
  footer.append(element('span',`Publicado ${date(call.publishedAt)}`), externalLink(`${call.id} ↗`, call.sourceUrl));
  article.append(button, footer);
  return article;
}

function render({fitMap=false}={}) {
  const results = searchCalls(calls, {q:query.value, city:location.value, category,origin,radiusKm:radiusKm(),bounds});
  if (origin) results.sort((a,b) => distanceKm(origin,a.location?.point)-distanceKm(origin,b.location?.point));
  list.replaceChildren(...results.map(card));
  document.querySelector('#result-count').textContent = `${results.length} ${results.length === 1 ? 'oferta real' : 'ofertas reales'}`;
  document.querySelector('#result-summary').textContent = resultSummary(results);
  document.querySelector('#empty-state').hidden = results.length > 0;
  document.querySelector('#clear-filters').hidden = !query.value && !location.value && !category && !origin && !bounds;
  mapController?.update(results,origin,radiusKm());
  if (fitMap) mapController?.fit(results,origin);
  document.querySelector('#map-footnote').textContent = `${results.filter(call => call.location?.point).length} ofertas en ${markerGroups(results).length} ${markerGroups(results).length===1?"punto municipal":"puntos municipales"} · Ubicación municipal aproximada. Distancias en línea recta; no direcciones exactas del puesto.`;
  const params = new URLSearchParams();
  if (query.value) params.set('q',query.value);
  if (location.value) params.set('city',location.value);
  if (category) params.set('category',category);
  history.replaceState(null,'',`${locationUrl()}${params.size ? `?${params}` : ''}`);
}

function locationUrl() { return window.location.pathname; }

function clear() {
  mapController?.cancelOriginSelection();
  query.value = ''; location.value = ''; category = '';
  origin = null; bounds = null; originInput.value = ''; radiusSelect.value = ''; radiusSelect.disabled = true;
  document.querySelector('#origin-status').textContent = 'Elige una localidad o selecciona tu zona en el mapa.';
  syncCategories(); render();
}

function setOrigin(point,label) {
  mapController?.cancelOriginSelection();
  if (!origin) radiusSelect.value = '25';
  origin = point; bounds = null; radiusSelect.disabled = false;
  document.querySelector('#origin-status').textContent = `${label} · Distancia aproximada en línea recta`;
  render({fitMap:true});
}

originInput.addEventListener('change',() => {
  mapController?.cancelOriginSelection();
  const selected = places.find(place => place.label === originInput.value);
  if (!selected) {
    origin=null;radiusSelect.disabled=true;radiusSelect.value='';
    document.querySelector('#origin-status').textContent=originInput.value ? 'Localidad no reconocida: el filtro de distancia está desactivado. Elige una opción o usa el mapa.' : 'Elige una localidad o selecciona tu zona en el mapa.';
    render();return;
  }
  setOrigin([selected.longitude,selected.latitude],selected.name);
});
radiusSelect.addEventListener('change',render);
document.querySelector('#choose-origin').addEventListener('click',() => {
  mapController?.chooseOrigin(); document.querySelector('#origin-status').textContent = 'Haz clic en el mapa para situar tu zona de búsqueda.';
});
document.querySelector('#search-area').addEventListener('click',() => {bounds=mapController?.bounds();render();});
document.querySelector('#show-all-map').addEventListener('click',() => {
  bounds=null;render({fitMap:true});
});
loadMapButton.addEventListener('click',async () => {
  loadMapButton.disabled = true;
  try {
    const response = await fetch('/config.json');
    if (!response.ok) throw new Error('Configuración local no disponible.');
    const config = await response.json();
    if (!config.googleMapsApiKey) {
      mapMessage.textContent = 'Falta la clave propia. Completa GEOEMPLEO_GOOGLE_MAPS_API_KEY en .env.local y vuelve a comprobar. No se ha solicitado el SDK de Google.';
      return;
    }
    mapMessage.textContent = 'Conectando Google Maps y cargando los puntos de las ofertas…';
    mapController = await createGoogleMap(mapHost,config,{
      onSelect(id) {const call=calls.find(item => item.id===id); if(call) showDetail(call);},
      onOrigin(point) {originInput.value='';setOrigin(point,'Zona elegida en el mapa');},
    });
    for (const id of ['choose-origin','search-area','show-all-map']) document.getElementById(id).disabled=false;
    render({fitMap:true});
  } catch(error) {
    mapMessage.textContent = `${error.message} La lista sigue disponible. Revisa la configuración y recarga la página.`;
    mapHost.replaceChildren(mapState);
  } finally {loadMapButton.disabled=false;}
});

function syncCategories() {
  for (const button of document.querySelectorAll('[data-category]')) {
    const active = button.dataset.category === category;
    button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
  }
}

form.addEventListener('submit', event => {event.preventDefault(); render();});
location.addEventListener('change',render);
document.querySelector('#categories').addEventListener('click',event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  category = button.dataset.category; syncCategories(); render();
});
document.querySelector('#clear-filters').addEventListener('click',clear);
document.querySelector('#empty-clear').addEventListener('click',clear);
document.querySelector('#close-detail').addEventListener('click',() => detail.close());
document.querySelector('#about-button').addEventListener('click',() => about.showModal());
document.querySelector('#close-about').addEventListener('click',() => about.close());

try {
  const response = await fetch('/data/calls.json');
  if (!response.ok) throw new Error('Catálogo no disponible');
  const catalog = await response.json();
  calls = catalog.calls;
  try {
    const placesResponse=await fetch('/data/places.json');
    if(!placesResponse.ok) throw new Error('Localidades no disponibles');
    const gazetteer=await placesResponse.json();
    const names = new Map(); for(const place of gazetteer.places) names.set(place.name,(names.get(place.name)??0)+1);
    places=gazetteer.places.map(place => ({...place,label:names.get(place.name)>1 ? `${place.name} (${place.id})` : place.name}));
    for(const place of places) {const option=element('option');option.value=place.label;document.querySelector('#places').append(option);}
  } catch {originInput.disabled=true;document.querySelector('#origin-status').textContent='Localidades no disponibles; puedes elegir tu zona al conectar el mapa.';}
  for (const region of [...new Set(calls.map(call => call.region))].sort((a,b) => a.localeCompare(b,'es'))) {
    const option = element('option', region); option.value = region; location.append(option);
  }
  const categories=document.querySelector('#categories');
  categories.replaceChildren();
  const labels=new Map(calls.map(call=>[call.category,call.categoryLabel]));
  for(const [value,label] of [['','Todas las áreas'],...labels]) {
    const button=element('button',label,'filter-chip');button.type='button';button.dataset.category=value;categories.append(button);
  }
  const params = new URLSearchParams(window.location.search);
  query.value = params.get('q') ?? '';
  location.value = params.get('city') ?? '';
  category = [...document.querySelectorAll('[data-category]')].some(button => button.dataset.category === params.get('category')) ? params.get('category') : '';
  document.querySelector('#snapshot-label').textContent = `Fuentes: ${[...new Set(calls.map(call=>call.source))].join(" · ")} · Catálogo actualizado el ${date(catalog.checkedAt)}`;
  syncCategories(); render();
} catch {
  document.querySelector('#result-count').textContent = 'Catálogo no disponible';
  document.querySelector('#result-summary').textContent = 'No se han sustituido las convocatorias por datos de muestra.';
  list.append(element('p','No se ha podido cargar el catálogo real. Recarga la página para volver a intentarlo.','error-message'));
  form.querySelector('button').disabled = true;
}
