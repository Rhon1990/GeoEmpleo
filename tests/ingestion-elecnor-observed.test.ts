import assert from 'node:assert/strict';
import {test} from 'node:test';
import {adaptElecnorObservedSnapshot} from '../packages/ingestion/src/connectors/elecnor-observed.ts';

const observedAt='2026-11-17T18:00:00.000Z';
const expiresAt='2026-12-01T18:00:00.000Z';
const base={
  id:'3381057',
  title:'Oficial Sistemas de Proteccion contra Incendios - Cordoba (h/m)',
  city:'Cordoba',
  province:'Cordoba',
  publishedAt:'2026-11-17',
};
const snapshot=(offers:unknown[])=>({observedAt,expiresAt,offers});
const resolved={
  city:'Cordoba',province:'Córdoba',region:'Andalucía',
  location:{point:[-4.7794,37.8882] as [number,number],precision:'municipality' as const,
    sourceUrl:'https://example.test/cordoba',sourceUpdatedAt:null,note:'fixture'},
};

test('adapta una ficha oficial vigente sin inventar descripcion, salario ni cierre',()=>{
  const jobs=adaptElecnorObservedSnapshot(snapshot([base]),'2026-11-18T08:00:00.000Z',()=>resolved);
  assert.equal(jobs.length,1);
  assert.deepEqual(jobs[0],{
    kind:'job',sourceId:'elecnor-oficial',source:'Elecnor · portal oficial',id:'ELECNOR-3381057',
    title:base.title,employer:'Elecnor',city:'Cordoba',province:'Córdoba',region:'Andalucía',
    category:'industria',categoryLabel:'Industria y producción',regime:'Oferta de empleo',places:null,
    paragraphs:['Oferta publicada en el portal oficial de Elecnor.','Consulta la descripción, los requisitos y la vigencia en la ficha original.'],
    sourceUrl:'https://elecnor.epreselec.com/Ofertas/Ofertas.aspx?Id_Oferta=3381057',publishedAt:'2026-11-17',checkedAt:observedAt,closingDate:null,salary:null,
    applicationRegistration:'external_required',selection:null,
    location:{...resolved.location,note:'Ubicación municipal aproximada; no es la dirección exacta del puesto.'},
  });
});

test('valida toda la instantanea antes de filtrar fichas caducadas',()=>{
  assert.deepEqual(adaptElecnorObservedSnapshot(snapshot([base]),'2026-12-01T18:00:00.001Z',()=>resolved),[]);
  assert.throws(()=>adaptElecnorObservedSnapshot(snapshot([{...base,title:''}]),'2026-12-02T00:00:00.000Z',()=>resolved),/Elecnor/i);
});

test('rechaza identidad, URL, propiedades, fechas y duplicados no autorizados',()=>{
  for(const offer of [
    {...base,id:'otro'},
    {...base,publishedAt:'17/11/2026'},
    {...base,extra:true},
  ]) assert.throws(()=>adaptElecnorObservedSnapshot(snapshot([offer]),'2026-11-18T00:00:00.000Z',()=>resolved));
  assert.throws(()=>adaptElecnorObservedSnapshot({...snapshot([base]),expiresAt:'2026-12-02T18:00:00.000Z'},'2026-11-18T00:00:00.000Z',()=>resolved));
  assert.throws(()=>adaptElecnorObservedSnapshot(snapshot([base,{...base}]),'2026-11-18T00:00:00.000Z',()=>resolved),/duplicada/i);
});

test('conserva la ficha pero no inventa punto cuando municipio y provincia no son coherentes',()=>{
  const [job]=adaptElecnorObservedSnapshot(snapshot([{...base,city:'Valencia',province:'Malaga'}]),'2026-11-18T00:00:00.000Z',()=>null);
  assert.equal(job?.location,null);
  assert.equal(job?.province,'Málaga');
});

test('las ubicaciones observadas con advertencia se conservan sin marcador',()=>{
  const locationNote='Destino del puesto: Angola. La localidad publicada corresponde a la sede de referencia.';
  const [job]=adaptElecnorObservedSnapshot(snapshot([{...base,locationNote}]),'2026-11-18T00:00:00.000Z',()=>resolved);
  assert.equal(job?.location,null);
  assert.ok(job?.paragraphs.includes(locationNote));
  assert.throws(()=>adaptElecnorObservedSnapshot(snapshot([{...base,locationNote:''}]),'2026-11-18T00:00:00.000Z',()=>resolved));
});

test('rechaza observaciones futuras y fechas UTC normalizadas a otro día',()=>{
  assert.throws(()=>adaptElecnorObservedSnapshot(snapshot([base]),'2026-11-17T17:59:59.999Z',()=>resolved));
  assert.throws(()=>adaptElecnorObservedSnapshot({...snapshot([base]),observedAt:'2026-11-31T18:00:00.000Z',expiresAt:'2026-12-02T18:00:00.000Z'},'2026-12-01T20:00:00.000Z',()=>resolved));
  assert.throws(()=>adaptElecnorObservedSnapshot(snapshot([{...base,publishedAt:'2026-11-18'}]),'2026-11-18T20:00:00.000Z',()=>resolved));
});
