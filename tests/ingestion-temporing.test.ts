import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTemporingListing,adaptTemporingDetail} from '../packages/ingestion/src/connectors/temporing.ts';

const link='<a data-turbo="false" href="https://empleo.temporing.es/jobs/123-operario"><span title="Operario/a">Operario/a</span><span>Industria</span><span>Madrid</span></a>';
const listing=`<h2>1 vacantes</h2>${link}`;
const posting=(city:string)=>`<h1>Operario/a</h1><script type="application/ld+json">${JSON.stringify({
  '@type':'JobPosting',identifier:{value:'123'},title:'Operario/a',datePosted:'2026-11-23T10:00:00+01:00',
  description:'<p>Producción industrial.</p>',jobLocation:[{address:{addressCountry:'ES',addressLocality:city,addressRegion:'Madrid'}}],
})}</script>`;
const resolved=(city:string)=>city==='Madrid'?{city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org',sourceUpdatedAt:null,note:'aproximada'}}:null;

test('Temporing valida total, enlace y usa el municipio indicado en el listado',()=>{
  const parsed=parseTemporingListing(listing);
  assert.equal(parsed.total,1);
  assert.equal(parsed.offers[0]?.title,'Operario/a');
  assert.deepEqual(adaptTemporingDetail(parsed.offers[0]!,posting('Madrid'),'2026-11-24T12:00:00.000Z',resolved)[0]?.location?.point,[-3.7,40.4]);
  assert.deepEqual(adaptTemporingDetail(parsed.offers[0]!,posting('Arrecife'),'2026-11-24T12:00:00.000Z',resolved)[0]?.location?.point,[-3.7,40.4]);
  assert.throws(()=>parseTemporingListing(listing.replace('empleo.temporing.es','evil.test')),/URL Temporing/);
});

test('Temporing no interpreta el nombre de una delegación como municipio',()=>{
  const offer={url:'https://empleo.temporing.es/jobs/123-operario',title:'Operario/a',listedPlace:'TEMPORING LANZAROTE'};
  const job=adaptTemporingDetail(offer,posting('Arrecife'),'2026-11-24T12:00:00.000Z',resolved)[0];
  assert.equal(job?.location,null);
});

test('Temporing conserva una oferta con dirección estructurada vacía',()=>{
  const offer={url:'https://empleo.temporing.es/jobs/123-operario',title:'Operario/a / Madrid',listedPlace:'TEMPORING CENTRO'};
  const detail=posting('Arrecife').replaceAll('Operario/a','Operario/a / Madrid').replace('"addressCountry":"ES","addressLocality":"Arrecife","addressRegion":"Madrid"','');
  const job=adaptTemporingDetail(offer,detail,'2026-11-24T12:00:00.000Z',resolved)[0];
  assert.equal(job?.city,'Madrid');
  assert.deepEqual(job?.location?.point,[-3.7,40.4]);
});

test('Temporing usa un municipio explícito del título cuando la ficha indica otra oficina',()=>{
  const offer={url:'https://empleo.temporing.es/jobs/123-operario',title:'Operario/a / Puerto del Carmen',listedPlace:'TEMPORING LANZAROTE'};
  const detail=posting('Arrecife').replaceAll('Operario/a','Operario/a / Puerto del Carmen');
  const resolver=(city:string)=>city==='Puerto del Carmen'
    ?{city,province:'Las Palmas',region:'Canarias',location:{point:[-13.66,28.92] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org',sourceUpdatedAt:null,note:'aproximada'}}:null;
  const job=adaptTemporingDetail(offer,detail,'2026-11-24T12:00:00.000Z',resolver)[0];
  assert.equal(job?.city,'Puerto del Carmen');
  assert.deepEqual(job?.location?.point,[-13.66,28.92]);
});
