import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSynergieListing,fetchSynergieOffers} from '../packages/ingestion/src/connectors/synergie.ts';

const checkedAt='2026-11-24T12:00:00.000Z';
const offer=(id:number,title:string,city:string,dateInit='2026-11-23',dateEnd='2026-12-31')=>({
  id:[0,id],title:[0,title],city:[0,city],description:[0,'<p>Trabajo de producción.</p>'],
  requirements:[0,'<p>Experiencia previa.</p>'],date_init:[0,dateInit],date_end:[0,dateEnd],
  number_vacancies:[0,2],status:[0,1],country_id:[0,56],
  posting_province_id:[0,{NOMBRE_PROV:[0,'ÁVILA']}],
  url:[0,`https://www.synergie.es/busco-trabajo/oferta-${id}`],
});
const html=(rows:object[])=>`<astro-island component-export="OfferList" props="${JSON.stringify({offers:[1,rows.map(row=>[0,row])]}).replaceAll('"','&quot;')}"></astro-island>`;

test('Synergie conserva ofertas vigentes y sitúa solo municipios verificables',async()=>{
  const sample=html([offer(10,'Operario/a','ÁVILA'),offer(11,'DEJA TU CV','ÁVILA'),offer(12,'Caducada','ÁVILA','2026-10-01','2026-10-31'),offer(13,'Sin municipio','CASTILLA Y LEÓN')]);
  const resolve=(city:string,province?:string)=>city==='ÁVILA'&&province==='Ávila'
    ?{city:'Ávila',province:'Ávila',region:'Castilla y León',location:{point:[-4.7,40.66] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org',sourceUpdatedAt:null,note:'aproximada'}}:null;
  const jobs=await fetchSynergieOffers(checkedAt,resolve,(async()=>new Response(sample,{headers:{'content-type':'text/html'}})) as typeof fetch);
  assert.deepEqual(jobs.map(job=>job.id),['SYNERGIE-10','SYNERGIE-13']);
  assert.deepEqual(jobs[0]?.location?.point,[-4.7,40.66]);
  assert.equal(jobs[1]?.location,null);
  assert.equal(jobs[0]?.publishedAt,'2026-11-23');
  assert.equal(jobs[0]?.places,2);
});

test('Synergie rechaza enlaces externos y listados incompletos',()=>{
  assert.throws(()=>parseSynergieListing(html([offer(1,'Operario/a','ÁVILA')]).replace('www.synergie.es','evil.test')),/URL Synergie/);
  assert.throws(()=>parseSynergieListing('<html>Sin datos</html>'),/Synergie/);
});
