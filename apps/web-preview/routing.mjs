const previewAssets = new Map([
  ['/publicar', ['publish.html','text/html; charset=utf-8']],
  ['/gestionar', ['manage.html','text/html; charset=utf-8']],
  ['/publish.mjs', ['publish.mjs','text/javascript; charset=utf-8']],
  ['/manage.mjs', ['manage.mjs','text/javascript; charset=utf-8']],
  ['/submission.css', ['submission.css','text/css; charset=utf-8']],
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/index.html', ['index.html','text/html; charset=utf-8']],
  ['/styles.css', ['styles.css','text/css; charset=utf-8']],
  ['/select-controls.css', ['select-controls.css','text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs','text/javascript; charset=utf-8']],
  ['/job-interaction.mjs', ['job-interaction.mjs','text/javascript; charset=utf-8']],
  ['/workspace-view.mjs', ['workspace-view.mjs','text/javascript; charset=utf-8']],
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

export function previewAsset(path) {return previewAssets.get(path);}

export function resolvePreviewPath(target) {
  try { return new URL(target, 'http://127.0.0.1').pathname; }
  catch { return null; }
}
