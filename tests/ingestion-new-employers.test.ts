import assert from 'node:assert/strict';
import {test} from 'node:test';
import {adaptQuironsaludListing} from '../packages/ingestion/src/connectors/quironsalud.ts';
import {adaptEulenListing} from '../packages/ingestion/src/connectors/eulen.ts';
import {adaptRandstadListing,fetchRandstadOffers} from '../packages/ingestion/src/connectors/randstad.ts';
import {adaptCleceOffer} from '../packages/ingestion/src/connectors/clece.ts';
import {adaptDomusViOffer} from '../packages/ingestion/src/connectors/domusvi.ts';
import {adaptIndraOffer} from '../packages/ingestion/src/connectors/indra.ts';
import {createNationalCityResolver} from '../packages/ingestion/src/national-geography.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const checkedAt='2026-10-27T12:00:00.000Z';
const resolveCity=createNationalCityResolver([
  {id:'madrid',name:'Madrid',province:'Madrid',municipality:'Madrid',latitude:40.42,longitude:-3.70,sourceUrl:'https://example.org/madrid',precision:'locality'},
  {id:'alcobendas',name:'Alcobendas',province:'Madrid',municipality:'Alcobendas',latitude:40.54,longitude:-3.64,sourceUrl:'https://example.org/alcobendas',precision:'locality'},
]);

test('las nuevas fuentes oficiales forman parte del registro diario',()=>{
  assert.equal(sourceRegistry.get('talentclue-quironsalud')?.status,'active');
  assert.equal(sourceRegistry.get('selectminds-eulen')?.status,'active');
  assert.equal(sourceRegistry.get('randstad-oficial')?.status,'active');
  assert.equal(sourceRegistry.get('successfactors-clece')?.status,'active');
  assert.equal(sourceRegistry.get('bizneo-domusvi')?.status,'active');
  assert.equal(sourceRegistry.get('successfactors-indra')?.status,'active');
});

test('DomusVi conserva la ficha oficial y solo sitúa una localidad única',()=>{
  const offer={url:'https://empleo.domusvi.es/jobs/medico-a-centro-residencial-domusvi-madrid-123e4567-e89b-12d3-a456-426614174000',title:'Médico/a Centro Residencial DomusVi Madrid',city:'Madrid',remote:false};
  const job=adaptDomusViOffer(offer,checkedAt,resolveCity);
  assert.equal(job.id,'DOMUSVI-medico-a-centro-residencial-domusvi-madrid-123e4567-e89b-12d3-a456-426614174000');
  assert.equal(job.employer,'DomusVi');
  assert.deepEqual(job.location?.point,[-3.70,40.42]);
  assert.equal(adaptDomusViOffer({...offer,city:'Localidad incierta'},checkedAt,resolveCity).location,null);
});

test('Indra publica únicamente fichas españolas del portal oficial',()=>{
  const offer={url:'https://careers.indragroup.com/job/Madrid-Ingenieroa-Software-MD/12345/',title:'Ingeniero/a Software',city:'Madrid',provinceHint:null,listedDate:'',ambiguousLocation:false};
  const job=adaptIndraOffer(offer,checkedAt,resolveCity);
  assert.equal(job.id,'INDRA-12345');
  assert.equal(job.employer,'Indra');
  assert.deepEqual(job.location?.point,[-3.70,40.42]);
  assert.equal(adaptIndraOffer({...offer,city:'Localidad incierta'},checkedAt,resolveCity).location,null);
});

test('Randstad distingue vacantes españolas con ubicación municipal de búsquedas genéricas',()=>{
  const card=(id:string,location:string,province:string,date='27/10/2026')=>`<a href="https://www.randstad.es/candidatos/ofertas-empleo/oferta/auxiliar-${id}/" data-offerid="${id}" data-title="Auxiliar de tienda" data-province="${province}" data-publication-company-business="Randstad Trabajo Temporal"><div class="rel_text-ellipsis-2">${location}</div><div>publicada el ${date}</div></a>`;
  const foundation=card('125','Madrid - Madrid','Madrid','01/01/2025').replace('/candidatos/ofertas-empleo/','/fundacion-randstad/empleo-discapacidad/');
  const jobs=adaptRandstadListing(`${card('123','Madrid - Madrid','Madrid')}${card('124','Lisboa - Lisboa','Lisboa')}${foundation}`,checkedAt,resolveCity);
  assert.deepEqual(jobs.map(job=>job.id),['RANDSTAD-123','RANDSTAD-125']);
  assert.deepEqual(jobs[0]?.location?.point,[-3.70,40.42]);
  assert.equal(jobs[0]?.employer,'Randstad Trabajo Temporal');
});

test('Randstad recorre todas las páginas y conserva ofertas activas antiguas del portal',async()=>{
 const make=(id:number)=>({offerId:id,title:`Puesto ${id}`,company:'Randstad Digital',date:id===301?'2026-06-01T02:00:00':'2026-10-27T02:00:00',
  description:`Descripción del puesto ${id}`,requirements:null,conditions:null,
  url:`https://www.randstad.es/candidatos/ofertas-empleo/oferta/puesto-${id}`,
  province:{id:'28',name:'Madrid'},city:{id:'28079',name:'Madrid'},publicationCompanyBusiness:'Randstad Digital',workModality:'presencial'});
 const first=Array.from({length:300},(_,index)=>make(index+1));
 const page=(number:number,result:ReturnType<typeof make>[])=>({
  pagination:{page:number,elements:300,totalCount:301,pageCount:number+1,totalPages:2,hasNext:number===0,hasPrev:number>0},result,
 });
 const requested:number[]=[];
 const fetchImpl=(async(input:string|URL|Request)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  requested.push(Number(url.searchParams.get('page')));
  assert.equal(url.searchParams.get('elements'),'300');
  const number=Number(url.searchParams.get('page'));
  const unstableFirstPass=requested.length<=2;
  return new Response(JSON.stringify(page(number,number===0?first:[unstableFirstPass?make(300):make(301)])),{headers:{'content-type':'application/json'}});
 }) as typeof fetch;
 const jobs=await fetchRandstadOffers(checkedAt,resolveCity,fetchImpl);
 assert.deepEqual(requested,[0,1,0,1]);
 assert.equal(jobs.length,301);
 assert.equal(jobs.at(-1)?.id,'RANDSTAD-301');
 assert.equal(jobs.at(-1)?.city,'Madrid');
});

test('Quirónsalud conserva vacantes antiguas del listado y ubica el municipio verificado',()=>{
  const row=(id:string,city:string,province:string,date:string)=>`<tr><td><img alt="Quirónsalud"></td><td><a href="https://careers.talentclue.com/es/node/${id}/4590/modal">Enfermería</a></td><td>Quirónsalud</td><td>${city}</td><td>${province}</td><td>${date}</td></tr>`;
  const html=`<table>${row('123','Alcobendas','Madrid','27/10/2026')}${row('124','Lisboa','Portugal','27/10/2026')}${row('125','Madrid','Madrid','01/01/2026')}</table>`;
  const jobs=adaptQuironsaludListing(html,checkedAt,resolveCity);
  assert.deepEqual(jobs.map(job=>job.id),['QUIRONSALUD-123','QUIRONSALUD-125']);
  assert.deepEqual(jobs[0]?.location?.point,[-3.64,40.54]);
  assert.equal(jobs[0]?.sourceUrl,'https://careers.talentclue.com/es/node/123/4590/modal');
  assert.equal(jobs[1]?.publishedAt,'2026-01-01');
});

test('Quirónsalud no inventa punto para localidad ambigua y rechaza enlaces externos',()=>{
  const row='<tr><td><img alt="Quirónsalud"></td><td><a href="https://careers.talentclue.com/es/node/123/4590/modal">Enfermería</a></td><td>Quirónsalud</td><td>Localidad incierta</td><td>Madrid</td><td>27/10/2026</td></tr>';
  assert.equal(adaptQuironsaludListing(`<table>${row}</table>`,checkedAt,resolveCity)[0]?.location,null);
  assert.throws(()=>adaptQuironsaludListing(`<table>${row.replace('careers.talentclue.com','example.org')}</table>`,checkedAt,resolveCity),/URL/);
});

test('Eulen conserva solo anuncios de España con ciudad validada',()=>{
  const row=(id:string,location:string)=>`<div id="job_list_${id}" class="job_list_row"><a class="job_link" href="https://eulen.referrals.selectminds.com/grupoeulenespana/jobs/enfermero-a-${id}">Enfermero/a</a><p class="jlr_location"><a class="location">${location}</a></p><p class="jlr_description">Atención sanitaria.</p><p class="jlr_category_field">Sanidad y salud</p></div>`;
  const jobs=adaptEulenListing(`${row('123','🔍 Madrid, Comunidad de Madrid, 28028 - MADRID, España')}${row('124','Lisboa, Portugal')}`,checkedAt,resolveCity);
  assert.deepEqual(jobs.map(job=>job.id),['EULEN-123']);
  assert.equal(jobs[0]?.dateKind,'observed');
  assert.equal(jobs[0]?.category,'sanidad');
  assert.deepEqual(jobs[0]?.location?.point,[-3.70,40.42]);
});

test('Clece usa el municipio español de su tablón y omite países ajenos',()=>{
  const offer={url:'https://canaldeempleo.es/CLECE/job/Madrid-Auxiliar-de-ayuda-12345/12345/',title:'Auxiliar de ayuda',city:'Madrid, Madrid, España, 28028',provinceHint:null,listedDate:'27 oct 2026',ambiguousLocation:true};
  const job=adaptCleceOffer(offer,checkedAt,resolveCity);
  assert.equal(job?.id,'CLECE-12345');
  assert.deepEqual(job?.location?.point,[-3.70,40.42]);
  assert.equal(job?.dateKind,'observed');
  assert.equal(adaptCleceOffer({...offer,city:'Lisboa, Lisboa, Portugal, 12000'},checkedAt,resolveCity),null);
  assert.equal(adaptCleceOffer({...offer,city:'Madrid, Lisboa, España, 28028'},checkedAt,resolveCity),null);
});
