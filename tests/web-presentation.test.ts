import test from 'node:test';
import assert from 'node:assert/strict';
import {detailBadge,placesLabel,jobPresentation,resultSummary} from '../apps/web-preview/public/presentation.mjs';
import {markerGroups,expandedZoom} from '../apps/web-preview/public/google-map.mjs';
test('presenta desconocidos y fuentes sin atribuir ofertas privadas al BOE',()=>{
 assert.equal(placesLabel({places:null}),'Plazas no publicadas');
 assert.equal(placesLabel({places:1}),'1 plaza');
 const job={kind:'job',source:'SEF Murcia',closingDate:'2026-10-26',applicationRegistration:'external_required'};
 assert.equal(jobPresentation(job).source,'SEF Murcia');
 assert.equal(jobPresentation(job).sourceLink,'Ver oferta original en SEF Murcia ↗');
 assert.ok(!jobPresentation(job).note.includes('bases del proceso'));
 assert.match(resultSummary([{places:null},{places:2}]),/2 plazas publicadas.*1 oferta/);
});
test('identifica ECYL y Lanbide sin atribuir su procedencia a Murcia',()=>{
 for(const [sourceId,source] of [['ecyl-castilla-leon','ECYL Castilla y León'],['lanbide-euskadi','Lanbide']]) {
  const view=jobPresentation({kind:'job',sourceId,source});
  assert.ok(view.provenance.includes(source));
  assert.ok(!view.provenance.includes('Murcia'));
  assert.ok(view.provenance.includes('no identifica'));
 }
 const unknown=jobPresentation({kind:'job',source:'Otra fuente'});
 assert.ok(unknown.provenance.includes('Otra fuente'));
 assert.ok(!unknown.provenance.includes('Murcia'));
});
test('la etiqueta del detalle siempre procede de la oferta que se está abriendo',()=>{
 assert.equal(detailBadge({kind:'job',source:'Lanbide'}),'Oferta real · Lanbide');
 assert.equal(detailBadge({kind:'job',source:'ECYL Castilla y León'}),'Oferta real · ECYL Castilla y León');
});
test('agrupa posiciones iguales sin desplazar puntos y conserva todas las ofertas',()=>{
 const calls=[{id:'a',location:{point:[-1,38]}},{id:'b',location:{point:[-1,38]}},{id:'c',location:{point:[-2,39]}},{id:'d',location:null}];
 const groups=markerGroups(calls);assert.equal(groups.length,2);
 assert.deepEqual(groups[0].calls.map((x:{id:string})=>x.id),['a','b']);assert.deepEqual(groups[0].point,[-1,38]);
 assert.deepEqual(calls[0].location?.point,[-1,38]);
});
test('agrupa puntos cercanos al alejar y los separa al ampliar, sin perder ofertas',()=>{
 const calls=[{id:'a',location:{point:[-1.13,37.99]}},{id:'b',location:{point:[-1.12,38]}},{id:'c',location:{point:[2.17,41.38]}}];
 assert.equal(markerGroups(calls,6).length,2);
 assert.equal(markerGroups(calls,15).length,3);
 assert.equal(markerGroups(calls,6).flatMap((g:{calls:unknown[]})=>g.calls).length,3);
});

test('un grupo siempre permite ampliar aunque el encuadre automático mantenga el zoom',()=>{
 assert.equal(expandedZoom(8,8),9);assert.equal(expandedZoom(8,7),9);assert.equal(expandedZoom(8,11),11);
});
