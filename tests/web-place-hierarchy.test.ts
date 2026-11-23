import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../apps/web-preview/public/index.html',import.meta.url),'utf8');
const styles=await readFile(new URL('../apps/web-preview/public/select-controls.css',import.meta.url),'utf8');
const app=await readFile(new URL('../apps/web-preview/public/app.mjs',import.meta.url),'utf8');
const hierarchy=await readFile(new URL('../apps/web-preview/public/place-hierarchy.mjs',import.meta.url),'utf8');

test('la ubicación se elige desde un único control de cabecera',()=>{
 assert.doesNotMatch(html,/<datalist\b/i);
 assert.match(html,/<button[^>]*id="location-trigger"[^>]*aria-controls="location-panel"/);
 assert.match(html,/<div[^>]*id="location-panel"[^>]*hidden/);
 assert.match(html,/<select[^>]*id="location"[^>]*hidden/);
 assert.match(html,/<span[^>]*id="place-hierarchy-title"[^>]*>Tu localidad de referencia<\/span>/);
 assert.match(html,/<input[^>]*id="origin-city"[^>]*type="hidden"/);
 assert.match(html,/<div[^>]*id="place-hierarchy"[^>]*><\/div>/);
 assert.doesNotMatch(html,/id="place-hierarchy-toggle"/);
 assert.doesNotMatch(html,/class="proximity-bar"/);
 assert.match(html,/<span[^>]*id="origin-status"[^>]*class="visually-hidden"/);
});

test('distancia máxima se oculta cuando no hay un punto desde el que medir',()=>{
 assert.match(html,/<div class="distance-filter-row" data-open="false" hidden>/);
 assert.match(app,/radiusRow\.hidden=radiusInput\.disabled/);
 assert.match(app,/if\(radiusInput\.disabled\)closeRadiusPanel\(\)/);
});

test('las tres pestañas permanecen recogidas y abren su lista con buscador',()=>{
 assert.match(hierarchy,/aria-expanded/);
 assert.match(hierarchy,/menu\.hidden=true/);
 assert.match(hierarchy,/menu\.hidden=false/);
 assert.match(styles,/\.place-hierarchy-menu\{[^}]*position:absolute/);
 assert.doesNotMatch(styles,/\.place-hierarchy\{[^}]*height:220px/);
 assert.match(styles,/\.place-hierarchy-option:hover,[^}]*background:#edf4f2/);
});

test('distancia máxima queda fuera del panel de ubicación y junto a los filtros',()=>{
 const locationPanel=html.slice(html.indexOf('id="location-panel"'),html.indexOf('</form>'));
 const filters=html.slice(html.indexOf('id="advanced-filters"'),html.indexOf('</section>'));
 assert.doesNotMatch(locationPanel,/id="radius"/);
 assert.match(filters,/id="categories"[\s\S]*?<\/div><div class="distance-filter-row" data-open="false" hidden>/);
 assert.match(filters,/<button[^>]*id="radius-trigger"[^>]*aria-expanded="false"[^>]*aria-controls="radius-panel"/);
 assert.match(filters,/<strong id="radius-summary">Sin límite<\/strong>/);
 assert.match(filters,/<div id="radius-panel" class="distance-filter-panel" role="region" aria-label="Seleccionar distancia máxima">[\s\S]*?<label for="radius">Distancia máxima<\/label>/);
 assert.match(filters,/<input id="radius" type="range" min="0" max="100" step="1" value="0" disabled>/);
 assert.match(filters,/<input id="radius-number" type="number" min="0" max="100" step="1"/);
 assert.match(filters,/<output id="radius-value"/);
 assert.equal((html.match(/id="radius"/g)??[]).length,1);
 assert.match(filters,/>100 km<\/span>/);
 assert.match(styles,/@media\(max-width:780px\)\{[\s\S]*?\.distance-filter-trigger\{display:none\}/);
 assert.match(styles,/@media\(max-width:780px\)\{[\s\S]*?\.distance-filter-panel\{[^}]*display:block/);
});
