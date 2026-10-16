const previewAssets = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/index.html', ['index.html','text/html; charset=utf-8']],
  ['/styles.css', ['styles.css','text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs','text/javascript; charset=utf-8']],
  ['/job-interaction.mjs', ['job-interaction.mjs','text/javascript; charset=utf-8']],
  ['/presentation.mjs', ['presentation.mjs','text/javascript; charset=utf-8']],
  ['/catalog.mjs', ['catalog.mjs','text/javascript; charset=utf-8']],
  ['/geography.mjs', ['geography.mjs','text/javascript; charset=utf-8']],
  ['/google-map.mjs', ['google-map.mjs','text/javascript; charset=utf-8']],
  ['/map-search.mjs', ['map-search.mjs','text/javascript; charset=utf-8']],
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
