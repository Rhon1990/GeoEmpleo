import test from 'node:test';
import assert from 'node:assert/strict';
import {cardVisualTheme,detailBadge,placesLabel,jobPresentation,resultSummary} from '../apps/web-preview/public/presentation.mjs';
import {markerGroups,expandedZoom} from '../apps/web-preview/public/google-map.mjs';
test('presenta desconocidos y fuentes sin atribuir ofertas privadas al BOE',()=>{
 assert.equal(placesLabel({places:null}),'Plazas no publicadas');
 assert.equal(placesLabel({places:1}),'1 plaza');
 const job={kind:'job',source:'SEF Murcia',closingDate:'2026-10-26',applicationRegistration:'external_required'};
 assert.equal(jobPresentation(job).source,'SEF Murcia');
 assert.equal(jobPresentation(job).sourceLink,'Ver oferta original en SEF Murcia ↗');
 assert.ok(!jobPresentation(job).note.includes('bases del proceso'));
 assert.match(resultSummary([{places:null},{places:2}]),/2 plazas indicadas.*1 oferta/);
 assert.equal(resultSummary([{places:null},{places:null}]),'Consulta condiciones y vigencia en cada anuncio');
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
test('presenta ofertas directas sin inventar un enlace externo ni degradar salario y ubicación',()=>{
 const direct={kind:'job',sourceId:'direct-employer',source:'Anunciante en GeoEmpleo',salary:{minMinor:150000,maxMinor:170000,currency:'EUR',period:'month',basis:'gross',paymentsPerYear:14},location:{precision:'employer_declared'}};
 const view=jobPresentation(direct);
 assert.equal(view.sourceLink,null);
 assert.equal(view.salaryLabel,'1.500–1.700 € brutos al mes · 14 pagas');
 assert.equal(view.locationLabel,'Punto declarado por el anunciante; no verificado por GeoEmpleo');
 assert.match(view.note,/contacto publicado/);
});
test('deriva un tema decorativo estable sin inventar una imagen',()=>{
 assert.equal(cardVisualTheme({category:'tecnico',kind:'job'}),'technical');
 assert.equal(cardVisualTheme({category:'tecnologia',kind:'public_call'}),'public');
 assert.equal(cardVisualTheme({category:'unknown',kind:'job'}),'local');
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
