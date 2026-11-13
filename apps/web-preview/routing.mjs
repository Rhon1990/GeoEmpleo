const previewAssets = new Map([
  ['/publicar', ['publish.html','text/html; charset=utf-8']],
  ['/gestionar', ['manage.html','text/html; charset=utf-8']],
  ['/publish.mjs', ['publish.mjs','text/javascript; charset=utf-8']],
  ['/manage.mjs', ['manage.mjs','text/javascript; charset=utf-8']],
  ['/submission.css', ['submission.css','text/css; charset=utf-8']],
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/index.html', ['index.html','text/html; charset=utf-8']],
  ['/favicon.png', ['favicon.png','image/png']],
  ['/favicon.svg', ['favicon.svg','image/svg+xml']],
  ['/geoempleo360-logo.png', ['geoempleo360-logo.png','image/png']],
  ['/robots.txt', ['robots.txt','text/plain; charset=utf-8']],
  ['/styles.css', ['styles.css','text/css; charset=utf-8']],
  ['/select-controls.css', ['select-controls.css','text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs','text/javascript; charset=utf-8']],
  ['/job-interaction.mjs', ['job-interaction.mjs','text/javascript; charset=utf-8']],
  ['/workspace-view.mjs', ['workspace-view.mjs','text/javascript; charset=utf-8']],
  ['/analytics.mjs', ['analytics.mjs','text/javascript; charset=utf-8']],
  ['/search-share.mjs', ['search-share.mjs','text/javascript; charset=utf-8']],
  ['/retention.mjs', ['retention.mjs','text/javascript; charset=utf-8']],
  ['/static-data.mjs', ['static-data.mjs','text/javascript; charset=utf-8']],
  ['/mobile-offer-carousel.mjs', ['mobile-offer-carousel.mjs','text/javascript; charset=utf-8']],
  ['/map-loading.mjs', ['map-loading.mjs','text/javascript; charset=utf-8']],
  ['/adsense.mjs', ['adsense.mjs','text/javascript; charset=utf-8']],
  ['/territories.mjs', ['territories.mjs','text/javascript; charset=utf-8']],
  ['/job-projections.mjs', ['job-projections.mjs','text/javascript; charset=utf-8']],
  ['/presentation.mjs', ['presentation.mjs','text/javascript; charset=utf-8']],
  ['/catalog.mjs', ['catalog.mjs','text/javascript; charset=utf-8']],
  ['/geography.mjs', ['geography.mjs','text/javascript; charset=utf-8']],
  ['/google-map.mjs', ['google-map.mjs','text/javascript; charset=utf-8']],
  ['/map-search.mjs', ['map-search.mjs','text/javascript; charset=utf-8']],
  ['/location-permission.mjs', ['location-permission.mjs','text/javascript; charset=utf-8']],
  ['/reference-places.mjs', ['reference-places.mjs','text/javascript; charset=utf-8']],
  ['/map-state.mjs', ['map-state.mjs','text/javascript; charset=utf-8']],
  ['/data/calls.json', ['data/calls.json','application/json; charset=utf-8']],
  ['/data/places.json', ['data/places.json','application/json; charset=utf-8']],
]);

const brandAssets = [
  'accenture.svg','adecco.svg','alcampo.png','burger-king.svg','capgemini.png','carrefour.svg','clece.png','coviran.png','decathlon.png','deloitte.png','dia.png','disa.png','domusvi.png','el-corte-ingles.svg','eulen.webp','geoempleo-neutral.svg','gi-group.jpg','ilunion.jpg','indra.png','iss.png','jobandtalent.png','kfc.svg','kpmg.png','leroy-merlin.png','lidl.svg','mapfre.png','mcdonalds.svg','melia.svg','plenergy.png','quironsalud.jpg','randstad.svg','skydance.jpg','telepizza.svg','vithas.png',
];
const materialSymbolAssets = ['arrow-back-ios.svg','arrow-forward-ios.svg','close.svg','favorite-filled.svg','favorite-outline.svg','location-on.svg','more-vert.svg','progress-activity.svg','share.svg'];
const imageContentType = name => name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
const visualAssets = new Map([
  ...brandAssets.map(name=>[`/brands/${name}`,[`brands/${name}`,imageContentType(name)]]),
  ...materialSymbolAssets.map(name=>[`/icons/material-symbols/${name}`,[`icons/material-symbols/${name}`,'image/svg+xml']]),
]);

export function previewAsset(path) {return previewAssets.get(path)??visualAssets.get(path);}

export function resolvePreviewPath(target) {
  try { return new URL(target, 'http://127.0.0.1').pathname; }
  catch { return null; }
}
