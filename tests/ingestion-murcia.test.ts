import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptMurciaOffers} from '../packages/ingestion/src/connectors/murcia.ts';
const raw = {numeroOferta:'142026005875',fechaDeInicio:'15/10/2026',fechaDeFin:'26/10/2026',municipio:{codigo:'30019',municipio:'CIEZA',provincia:{codigo:'30',provincia:'MURCIA'}},descripcion:'ELECTROMECÁNICO/A',adicionales:'<b>Funciones</b><BR/>Reparación y mantenimiento.',urlDetalles:'https://sefoficinavirtual.carm.es/sefoficinavirtual/public/oferta/detalle-oferta.xhtml?id=58073',sectorProfesional:{id:'MR'}};
const checkedAt = '2026-10-15T05:30:00Z';
const location = {point:[-1.4206,38.23998] as [number,number],precision:'municipality' as const,sourceUrl:'https://www.geonames.org/2519466',sourceUpdatedAt:null,note:'Punto municipal aproximado'};
test('adapta datos reales conservando desconocidos y procedencia', () => {
  const jobs = adaptMurciaOffers([raw],checkedAt,(city,province) => {assert.equal(city,'CIEZA');assert.equal(province,'MURCIA');return location;});
  assert.equal(jobs.length,1);const job=jobs[0];
  assert.equal(job.id,'SEF-MURCIA-142026005875');assert.equal(job.sourceId,'sef-murcia');
  assert.equal(job.employer,'Oferta gestionada por SEF Murcia');assert.equal(job.places,null);assert.equal(job.salary,null);
  assert.equal(job.closingDate,'2026-10-26');assert.deepEqual(job.location,location);
  assert.deepEqual(job.paragraphs,['Funciones','Reparación y mantenimiento.']);
  assert.equal(job.sourceUrl,raw.urlDetalles);
});
test('rechaza capturas inválidas completas para preservar catálogo anterior', () => {
  for (const input of [null,{},[{}],[{...raw,numeroOferta:'duplicado'}],[{...raw,urlDetalles:'javascript:alert(1)'}],[{...raw,urlDetalles:'https://example.com/oferta'}],[{...raw,adicionales:''}],[{...raw,municipio:null}],[raw,raw]]) {
    assert.throws(()=>adaptMurciaOffers(input,checkedAt,()=>null));
  }
});
test('filtra caducadas y publicaciones futuras por fecha de España sin inventar punto', () => {
  const active=adaptMurciaOffers([raw,{...raw,numeroOferta:'142026000001',fechaDeInicio:'01/10/2026',fechaDeFin:'14/10/2026'},{...raw,numeroOferta:'142026000002',fechaDeInicio:'16/10/2026'}],checkedAt,()=>null);
  assert.equal(active.length,1);assert.equal(active[0].location,null);
  assert.equal(adaptMurciaOffers([raw],'2026-10-26T23:30:00Z',()=>null).length,0);
});
