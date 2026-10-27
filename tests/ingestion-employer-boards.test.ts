import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBizneoListing, adaptBizneoDetail, fetchBizneoOffers } from '../packages/ingestion/src/connectors/bizneo.ts';
import { adaptTalentClueListing } from '../packages/ingestion/src/connectors/talentclue.ts';
import { createNationalCityResolver } from '../packages/ingestion/src/national-geography.ts';
import { parseKfcListing, adaptKfcDetail } from '../packages/ingestion/src/connectors/kfc.ts';
import {
  adaptSuccessFactorsDetail,
  fetchSuccessFactorsOffers,
  parseSuccessFactorsListing,
  type SuccessFactorsBoard,
} from '../packages/ingestion/src/connectors/successfactors.ts';
import { adaptDisaOffer, parseDisaListing } from '../packages/ingestion/src/connectors/disa.ts';
import { reconcileSource } from '../packages/ingestion/src/catalog.ts';
import { successFactorsBoards } from '../packages/ingestion/src/connectors/successfactors-boards.ts';
import { sourceRegistry } from '../packages/ingestion/src/registry.ts';
import { fetchCarrefourOffers, parseCarrefourListing } from '../packages/ingestion/src/connectors/carrefour.ts';
import { adaptLidlSearchPage, fetchLidlOffers } from '../packages/ingestion/src/connectors/lidl.ts';
import type { PublicCatalog } from '../packages/ingestion/src/model.ts';

const checkedAt = '2026-10-24T13:00:00.000Z';
const place = { id:'vicar', name:'Vícar', province:'Almería', municipality:'Vícar', latitude:36.83, longitude:-2.64, sourceUrl:'https://example.org/vicar', precision:'locality' as const };
const resolveCity = createNationalCityResolver([place]);
const board = { sourceId:'bizneo-plenergy', hostname:'empleo.plenergy.es', employer:'Plenergy', category:'servicios', categoryLabel:'Servicios y comercio' };
const successFactorsBoard:SuccessFactorsBoard={
  sourceId:'successfactors-example',hostname:'jobs.example.es',employer:'Empresa Ejemplo',
  listingPath:'/go/Empleo/1234/',jobPathPattern:/^\/job\/[^/]+\/\d+\/$/,
  category:'servicios',categoryLabel:'Servicios y comercio',sourceLabel:'Empresa Ejemplo · portal de empleo',
  pageSize:25,maxPages:3,
};

test('portales oficiales de Carrefour y Lidl están registrados como fuentes activas',()=>{
  assert.equal(sourceRegistry.get('carrefour-talentforjobs')?.status,'active');
  assert.equal(sourceRegistry.get('lidl-search-api')?.status,'active');
  assert.equal(sourceRegistry.get('carrefour-talentforjobs')?.endpoint,
    'https://carrefour.talentforjobs.com/particular/carrefour/web/ofertas-empleo.aspx');
  assert.equal(sourceRegistry.get('lidl-search-api')?.endpoint,
    'https://empleo.lidl.es/api/v1/search');
});

const carrefourPage=(page:number,total:number,token:string,city:string,nextValue:number|null)=>`<form id="form1" action="./ofertas-empleo.aspx"><input type="hidden" name="__VIEWSTATE" value="state-${page}"><input type="hidden" id="ph_hdnPg" name="ctl00$ph$hdnPg" value="${page-1}"><input type="submit" id="ph_btnBO" name="ctl00$ph$btnBO" value=""><select multiple name="ctl00$ph$lstProvincia"><option value="1">Álava</option></select><select multiple name="ctl00$ph$lstJornada"><option value="10">Indiferente</option></select></form><div id="ph_divPag"><p>${page} / ${total}</p>${nextValue===null?'':`<a onclick="$('#ph_hdnPg').val('${nextValue}');$('#ph_btnBO').click();">Siguiente →</a>`}</div><div class="list-group-item corpt4j"><h4><strong>Auxiliar de tienda</strong></h4><div class="ubicacion">${city}</div><a class="solicitar" href="https://carrefour.talentforjobs.com/ofertas/trabajo.aspx?j=${token}">Solicitar</a><p class="pe-contenido">Reposición y atención al cliente.</p></div>`;

test('Carrefour pagina las vacantes oficiales y solo geolocaliza municipios identificados',async()=>{
  const first=carrefourPage(1,2,'token-uno','Vícar',1);
  const second=carrefourPage(2,2,'token-dos','Zona no identificada',null);
  const placeResolver=(city:string)=>city==='Vícar'?{city:'Vícar',province:'Almería',region:'Andalucía',location:{point:[-2.64,36.83] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org/vicar',sourceUpdatedAt:null,note:'approx'}}:null;
  const requests:Request[]=[];
  const fetchImpl=(async(input:string|URL|Request,init?:RequestInit)=>{
    const request=input instanceof Request?input:new Request(input,init);
    requests.push(request);
    if(request.method==='GET')return new Response(first,{headers:{'content-type':'text/html; charset=utf-8'}});
    const body=new URLSearchParams(await request.text());
    assert.equal(body.get('ctl00$ph$hdnPg'),'1');
    assert.equal(body.get('__VIEWSTATE'),'state-1');
    assert.equal(body.has('ctl00$ph$lstProvincia'),false);
    assert.equal(body.has('ctl00$ph$lstJornada'),false);
    return new Response(second,{headers:{'content-type':'text/html; charset=utf-8'}});
  }) as typeof fetch;
  const jobs=await fetchCarrefourOffers(checkedAt,placeResolver,fetchImpl);
  assert.equal(requests.length,2);
  assert.deepEqual(jobs.map(job=>job.id),['CARREFOUR-dG9rZW4tdW5v','CARREFOUR-dG9rZW4tZG9z']);
  assert.deepEqual(jobs[0]?.location?.point,[-2.64,36.83]);
  assert.equal(jobs[1]?.location,null);
  assert.match(jobs[0]?.sourceUrl??'',/^https:\/\/carrefour\.talentforjobs\.com\/ofertas\/trabajo\.aspx\?j=/);
});

test('Carrefour rechaza destinos externos y paginación inconsistente',()=>{
  const html=carrefourPage(1,2,'token','Vícar',1);
  assert.throws(()=>parseCarrefourListing(html.replace('carrefour.talentforjobs.com','evil.test')),/URL Carrefour/);
  assert.throws(()=>parseCarrefourListing(html.replace("val('1')","val('2')")),/Paginación/);
});

test('Carrefour conserva una oferta sin localidad sin inventar un punto',async()=>{
  const html=carrefourPage(1,1,'token-sin-zona','',null);
  const jobs=await fetchCarrefourOffers(checkedAt,()=>null,(async()=>new Response(html,{headers:{'content-type':'text/html'}})) as typeof fetch);
  assert.equal(jobs.length,1);
  assert.equal(jobs[0]?.city,'Ubicación no indicada');
  assert.equal(jobs[0]?.location,null);
});

const lidlOffer=(postingId:string,city='Vícar')=>({
  postingId,requisitionId:postingId,title:'Cajero/a - Reponedor/a',
  location:{country:'ES',city,state:'',name:`${city} C/ Mayor 1`,type:'Point'},
  jobDetailUrl:`https://empleo.lidl.es/jobs/cajero-a-reponedor-a-${postingId}`,
  onlineFrom:'2026-10-23T10:00:00+00:00',onlineUntil:null,
  descResponsibilities:'<div><p>Atención al cliente y reposición.</p></div>',
  salaryValue:'Desde 18.800€ hasta 21.000€',salaryNote:'Importe anual bruto',workingModel:'Presencial',
});

test('Lidl adapta ofertas reales del JSON público y usa únicamente su localidad verificada',()=>{
  const payload={jobs:[lidlOffer('123456'),lidlOffer('123457','Localidad desconocida')],meta:{page:1,count:2,totalCount:2,resultsPerPage:100}};
  const result=adaptLidlSearchPage(payload,checkedAt,city=>city==='Vícar'?{city:'Vícar',province:'Almería',region:'Andalucía',location:{point:[-2.64,36.83],precision:'municipality',sourceUrl:'https://example.org/vicar',sourceUpdatedAt:null,note:'approx'}}:null);
  assert.equal(result.jobs.length,2);
  assert.equal(result.jobs[0]?.publishedAt,'2026-10-23');
  assert.equal(result.jobs[0]?.employer,'Lidl España');
  assert.equal(result.jobs[0]?.salary,null);
  assert.match(result.jobs[0]?.paragraphs.join(' ')??'',/Salario publicado por Lidl/);
  assert.deepEqual(result.jobs[0]?.location?.point,[-2.64,36.83]);
  assert.equal(result.jobs[1]?.location,null);
});

test('Lidl recupera todas las páginas verificando que el feed conserva el total',async()=>{
  const received:number[]=[];
  const page=(number:number,jobs:ReturnType<typeof lidlOffer>[])=>({jobs,meta:{page:number,count:jobs.length,totalCount:2,resultsPerPage:100}});
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    const query=JSON.parse(url.searchParams.get('general')??'{}') as {page?:number;resultsPerPage?:number};
    assert.equal(query.resultsPerPage,100);
    received.push(query.page??0);
    return new Response(JSON.stringify(page(query.page??1,[lidlOffer(`12345${query.page}`)])),{headers:{'content-type':'application/json'}});
  }) as typeof fetch;
  const jobs=await fetchLidlOffers(checkedAt,()=>null,fetchImpl);
  assert.deepEqual(received,[1,2]);
  assert.equal(jobs.length,2);
});

test('Lidl repite una captura si una oferta nueva desplaza resultados entre páginas',async()=>{
  const baseJobs=Array.from({length:100},(_,index)=>lidlOffer(String(100000+index)));
  const newJobs=[lidlOffer('100100'),lidlOffer('100101')];
  let attempt=0;
  const received:string[]=[];
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    const query=JSON.parse(url.searchParams.get('general')??'{}') as {page?:number};
    const page=query.page??0;
    received.push(`${attempt}:${page}`);
    let jobs:ReturnType<typeof lidlOffer>[];
    let totalCount:number;
    if(attempt===0&&page===1){jobs=baseJobs;totalCount=101;}
    else if(attempt===0){jobs=[baseJobs.at(-1)!,newJobs[0]!];totalCount=102;}
    else if(page===1){jobs=baseJobs;totalCount=102;}
    else {jobs=newJobs;totalCount=102;}
    if(page===2)attempt+=1;
    return new Response(JSON.stringify({jobs,meta:{page,count:jobs.length,totalCount,resultsPerPage:100}}),{headers:{'content-type':'application/json'}});
  }) as typeof fetch;
  const jobs=await fetchLidlOffers(checkedAt,()=>null,fetchImpl);
  assert.equal(jobs.length,102);
  assert.equal(new Set(jobs.map(job=>job.id)).size,102);
  assert.deepEqual(received,['0:1','0:2','1:1','1:2']);
});

test('Bizneo reconcilia páginas solapadas sin duplicar una oferta real',async()=>{
  const domusvi={sourceId:'bizneo-domusvi',hostname:'empleo.domusvi.es',employer:'DomusVi',category:'cuidados',categoryLabel:'Cuidados y servicios'};
  const card=(slug:string)=>`<a class="job-card" href="/jobs/${slug}"><div class="title">Oferta ${slug}</div><div class="details"><span>${slug==='vigo'?'Vigo':'Madrid'}</span><span>Presencial</span></div></a>`;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.pathname.startsWith('/jobs/')&&url.pathname!=='/jobs/')return new Response(`<h1>Oferta ${url.pathname.slice('/jobs/'.length)}</h1><div class="general-content"><p>Atención a personas.</p></div><div title="Ubicación">${url.pathname.includes('vigo')?'Vigo':'Madrid'}</div>`,{headers:{'content-type':'text/html'}});
    return new Response(`<div id="job-board">${url.searchParams.has('page')?card('vigo')+card('madrid'):card('vigo')}</div>${url.searchParams.has('page')?'':'<a class="next" href="/jobs?page=2">Siguiente</a>'}`,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchBizneoOffers(domusvi,checkedAt,()=>null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.title),['Oferta vigo','Oferta madrid']);
});

test('tablones SuccessFactors oficiales tienen identidad, categoría y URL propias',()=>{
  assert.deepEqual(successFactorsBoards.map(item=>item.sourceId),[
    'successfactors-vithas','successfactors-mapfre','successfactors-capgemini','successfactors-melia',
  ]);
  for(const item of successFactorsBoards) {
    assert.match(item.hostname,/^[a-z0-9.-]+$/);
    assert.equal(new URL(item.listingPath,`https://${item.hostname}`).protocol,'https:');
    assert.ok(item.categoryLabel);
    assert.ok(item.employer);
  }
});

test('Bizneo publica solo fichas del dominio verificado y geolocaliza un municipio único', () => {
  const listing = '<div id="job-board"><a class="job-card" href="https://empleo.plenergy.es/jobs/expendedor-vicar"><div class="title">Expendedor/a</div><div class="details"><span>Vícar</span><span>Presencial</span></div></a><a class="next" href="/jobs?page=2">Siguiente</a></div>';
  const parsed = parseBizneoListing(listing, board);
  assert.equal(parsed.offers.length,1);
  assert.equal(parsed.nextPage,2);
  const detail = '<h1>Expendedor/a</h1><div class="general-content"><p>Atención al cliente y repostaje.</p></div><div title="Ubicación"><span>Vícar</span></div>';
  const job = adaptBizneoDetail(parsed.offers[0]!,detail,checkedAt,resolveCity,board);
  assert.equal(job.city,'Vícar');
  assert.equal(job.province,'Almería');
  assert.deepEqual(job.location?.point,[-2.64,36.83]);
  assert.equal(job.dateKind,'observed');
  assert.match(job.paragraphs.join(' '),/repostaje/);
});

test('Bizneo rechaza enlaces externos y no sitúa anuncios remotos', () => {
  assert.throws(()=>parseBizneoListing('<div id="job-board"><a class="job-card" href="https://evil.test/jobs/falso"><div class="title">Falso</div><div class="details"><span>Vícar</span></div></a></div>',board));
  const parsed = parseBizneoListing('<div id="job-board"><a class="job-card" href="https://empleo.plenergy.es/jobs/remoto"><div class="title">Atención</div><div class="details"><span>Vícar</span><span>Remoto</span></div></a></div>',board);
  const job = adaptBizneoDetail(parsed.offers[0]!, '<h1>Atención</h1><div class="general-content"><p>Atención telefónica.</p></div>', checkedAt, resolveCity, board);
  assert.equal(job.location,null);
});

test('Bizneo reconoce una categoría previa a la localidad en Telepizza',()=>{
  const telepizza={sourceId:'bizneo-telepizza',hostname:'ofertas.fooddeliverybrands.com',employer:'Telepizza',category:'hosteleria',categoryLabel:'Turismo y hostelería'};
  const html='<div id="job-board"><a class="job-card" href="https://ofertas.fooddeliverybrands.com/jobs/repartidor-villacastin"><div class="title">Repartidor/a</div><div class="details"><span class="aggregation">REPARTID@R</span><span>Villacastín</span><span>Presencial</span></div></a></div>';
  assert.equal(parseBizneoListing(html,telepizza).offers[0]?.city,'Villacastín');
});

test('TalentClue conserva fecha real y no añade una localidad ambigua', () => {
  const html = '<table><tr><td><a href="https://careers.talentclue.com/es/node/129742113/4590/modal">Personal de equipo</a></td><td>McDonald’s Rosaleda</td><td>Málaga</td><td>Málaga</td><td>Ventas</td><td>23/10/2026</td></tr></table>';
  const jobs = adaptTalentClueListing(html,checkedAt,() => null);
  assert.equal(jobs.length,1);
  assert.equal(jobs[0]?.publishedAt,'2026-10-23');
  assert.equal(jobs[0]?.location,null);
  assert.equal(jobs[0]?.sourceUrl,'https://careers.talentclue.com/es/node/129742113/4590/modal');
});

test('la primera observación de Bizneo se mantiene en refrescos diarios', () => {
  const listing = parseBizneoListing('<div id="job-board"><a class="job-card" href="https://empleo.plenergy.es/jobs/expendedor-vicar"><div class="title">Expendedor/a</div><div class="details"><span>Vícar</span><span>Presencial</span></div></a></div>',board);
  const detail = '<h1>Expendedor/a</h1><div class="general-content"><p>Atención al cliente.</p></div>';
  const first = adaptBizneoDetail(listing.offers[0]!,detail,checkedAt,resolveCity,board);
  const initial:PublicCatalog = {checkedAt,mode:'daily_sources',publishedAt:first.publishedAt,sourceConditions:'',calls:[first]};
  const second = adaptBizneoDetail(listing.offers[0]!,detail,'2026-10-25T13:00:00.000Z',resolveCity,board);
  const refreshed = reconcileSource(initial,board.sourceId,[second],'2026-10-25T13:00:00.000Z',{missingRetentionDays:0});
  assert.equal(refreshed.calls[0]?.publishedAt,'2026-10-24');
});

test('KFC obtiene fecha, municipio y descripción de una ficha pública',()=>{
  const listing='<table><tr class="data-row"><td><a class="jobTitle-link" href="/KFC/job/VICAR-CREW-MEMBER-04738/1234567890/">CREW MEMBER</a></td><td class="colLocation"><span class="jobLocation">VÍCAR (ALMERÍA), ES, 04738</span></td><td class="colDate"><span class="jobDate">24 oct 2026</span></td></tr></table>';
  const [offer]=parseKfcListing(listing).offers;
  assert.equal(offer?.city,'VÍCAR');
  const detail='<div class="jobDisplayShell"><meta itemprop="datePosted" content="Sat Oct 24 02:00:00 UTC 2026"><h1 id="job-title">CREW MEMBER</h1><span itemprop="description" class="jobdescription"><p>Atender clientes en restaurante.</p></span></div>';
  const job=adaptKfcDetail(offer!,detail,checkedAt,resolveCity);
  assert.equal(job.publishedAt,'2026-10-24');
  assert.equal(job.province,'Almería');
  assert.deepEqual(job.location?.point,[-2.64,36.83]);
});

test('SuccessFactors valida el dominio oficial y geolocaliza una localidad española única',()=>{
  const listing='<table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Dependiente-Vicar/1234567890/">Dependiente/a</a></td><td class="colLocation"><span class="jobLocation">VÍCAR (ALMERÍA), ES</span></td><td class="colDate"><span class="jobDate">24 oct 2026</span></td></tr></table>';
  const parsed=parseSuccessFactorsListing(listing,successFactorsBoard);
  assert.equal(parsed.pageCount,1);
  assert.equal(parsed.offers[0]?.city,'VÍCAR');
  const detail='<meta itemprop="datePosted" content="2026-10-24"><h1 id="job-title">Dependiente/a</h1><span itemprop="description"><p>Atención al cliente en tienda.</p></span>';
  const job=adaptSuccessFactorsDetail(parsed.offers[0]!,detail,checkedAt,resolveCity,successFactorsBoard);
  assert.equal(job.id,'SUCCESSFACTORS-SUCCESSFACTORS-EXAMPLE-1234567890');
  assert.equal(job.sourceUrl,'https://jobs.example.es/job/Dependiente-Vicar/1234567890/');
  assert.deepEqual(job.location?.point,[-2.64,36.83]);
  assert.throws(()=>parseSuccessFactorsListing(listing.replace('/job/Dependiente-Vicar/1234567890/','https://evil.test/job/Falso/123/'),successFactorsBoard),/URL/);
});

test('SuccessFactors no sitúa ofertas remotas o territoriales ambiguas',()=>{
  const listing='<table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Consultor-remoto/9876543210/">Consultor/a</a></td><td class="colLocation">Madrid, Barcelona, ES</td><td class="colDate">24 oct 2026</td></tr></table>';
  const offer=parseSuccessFactorsListing(listing,successFactorsBoard).offers[0]!;
  const detail='<meta itemprop="datePosted" content="2026-10-24"><h1 id="job-title">Consultor/a</h1><span itemprop="description"><p>Trabajo remoto desde España.</p></span>';
  assert.equal(adaptSuccessFactorsDetail(offer,detail,checkedAt,resolveCity,successFactorsBoard).location,null);
});

test('SuccessFactors admite listado sin columna de fecha y título de ficha sin id',()=>{
  const listing='<table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Sevilla-Camarero/1234567890/">Camarero/a - Meliá Sevilla</a></td><td class="colLocation">Sevilla, ES</td></tr></table>';
  const offer=parseSuccessFactorsListing(listing,successFactorsBoard).offers[0]!;
  const detail='<meta itemprop="datePosted" content="Mon Oct 26 02:00:00 UTC 2026"><h1>Camarero/a - Meliá Sevilla</h1><span itemprop="description"><p>Atención en sala.</p></span>';
  const job=adaptSuccessFactorsDetail(offer,detail,'2026-10-26T12:00:00.000Z',resolveCity,successFactorsBoard);
  assert.equal(job.publishedAt,'2026-10-26');
  assert.equal(job.location,null);
});

test('SuccessFactors separa localidad del código territorial y descarta países ajenos',()=>{
  const listing='<table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Sevilla-Agente/1234567890/">Agente</a></td><td class="colLocation">SEVILLA, SE, ES</td><td class="colDate">26 oct 2026</td></tr><tr class="data-row"><td><a class="jobTitle-link" href="/job/Guayaquil-Agente/2234567890/">Agente Ecuador</a></td><td class="colLocation">Guayaquil, EC</td><td class="colDate">26 oct 2026</td></tr></table>';
  const offers=parseSuccessFactorsListing(listing,successFactorsBoard).offers;
  assert.equal(offers.length,1);
  assert.equal(offers[0]?.city,'SEVILLA');
  assert.equal(offers[0]?.ambiguousLocation,false);
});

test('SuccessFactors no confunde una provincia con una localidad homónima de otra provincia',()=>{
  const offer=parseSuccessFactorsListing('<table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Araba-Vitoria/1234567890/">Enfermero/a VITORIA</a></td><td class="colLocation">Araba/Álava, ES</td></tr></table>',successFactorsBoard).offers[0]!;
  const detail='<meta itemprop="datePosted" content="2026-10-24"><h1>Enfermero/a VITORIA</h1><span itemprop="description"><p>Atención a pacientes.</p></span>';
  const wrongResolver=()=>({city:'Alava',province:'Asturias',region:'Principado de Asturias',location:{point:[-6.19946,43.36057] as [number,number],precision:'municipality' as const,sourceUrl:'https://www.geonames.org/3130718',sourceUpdatedAt:null,note:'Municipal'}});
  const job=adaptSuccessFactorsDetail(offer,detail,checkedAt,wrongResolver,successFactorsBoard);
  assert.equal(job.location,null);
  assert.equal(job.province,'Álava');
  assert.equal(job.region,'País Vasco');
});

test('SuccessFactors evita situar el hotel en la capital provincial indicada por un tablón',()=>{
  const hotelBoard={...successFactorsBoard,requireCityMentionInTitle:true};
  const offer=parseSuccessFactorsListing('<table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Barcelona-Sitges/1234567890/">Recepcionista - Hotel Sitges</a></td><td class="colLocation">Barcelona, ES</td></tr></table>',hotelBoard).offers[0]!;
  const detail='<meta itemprop="datePosted" content="2026-10-24"><h1>Recepcionista - Hotel Sitges</h1><span itemprop="description"><p>Recepción hotelera.</p></span>';
  const resolveBarcelona=()=>({city:'Barcelona',province:'Barcelona',region:'Cataluña',location:{point:[2.15899,41.38879] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org',sourceUpdatedAt:null,note:'Municipal'}});
  assert.equal(adaptSuccessFactorsDetail(offer,detail,checkedAt,resolveBarcelona,hotelBoard).location,null);
});

test('SuccessFactors conserva el filtro de España al paginar una búsqueda',async()=>{
  const spanishBoard=successFactorsBoards.find(item=>item.sourceId==='successfactors-capgemini')!;
  const list=(id:string,title:string)=>`<span class="paginationLabel">Resultados 1 – 25 de 26</span><table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-${id}/${id}/">${title}</a></td><td class="colLocation">Madrid, ES</td></tr></table>`;
  const fetched:string[]=[];
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    fetched.push(url.href);
    if(url.pathname.startsWith('/job/')) return new Response(`<meta itemprop="datePosted" content="2026-10-24"><h1>${url.pathname.includes('111')?'Uno':'Dos'}</h1><span itemprop="description"><p>Oficio verificable.</p></span>`,{headers:{'content-type':'text/html'}});
    assert.equal(url.searchParams.get('locationsearch'),'Spain');
    return new Response(url.pathname.includes('/25/')?list('222','Dos'):list('111','Uno'),{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(spanishBoard,'2026-10-26T12:00:00Z',()=>null,fetchImpl);
  assert.equal(jobs.length,2);
  assert.equal(fetched.filter(url=>url.includes('/search/')).length,2);
});

test('Meliá omite una ficha confirmada como cubierta y conserva las vigentes',async()=>{
  const meliaBoard={...successFactorsBoard,hostname:'careers.melia.com',skipVerifiedClosed:true};
  const listing='<table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-Cubierta/111/">Puesto cubierto</a></td><td class="colLocation">Madrid, ES</td></tr><tr class="data-row"><td><a class="jobTitle-link" href="/job/Sevilla-Vigente/222/">Camarero/a Sevilla</a></td><td class="colLocation">Sevilla, ES</td></tr></table>';
  const closed='<div class="jobDisplayShell"><div class="job"><p><strong>Lo sentimos, esta posición ya está cubierta.</strong></p></div></div>';
  const current='<meta itemprop="datePosted" content="2026-10-24"><h1>Camarero/a Sevilla</h1><span itemprop="description"><p>Servicio en sala.</p></span>';
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return new Response(url.pathname.includes('111')?closed:url.pathname.includes('222')?current:listing,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(meliaBoard,'2026-10-26T12:00:00Z',()=>null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.title),['Camarero/a Sevilla']);
});

test('SuccessFactors tolera un solapamiento entre páginas sin duplicar la oferta',async()=>{
  const pagedBoard={...successFactorsBoard,hostname:'careers.melia.com'};
  const row=(id:string)=>`<tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-Agente/${id}/">Agente ${id}</a></td><td class="colLocation">Madrid, ES</td></tr>`;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.pathname.startsWith('/job/'))return new Response(`<meta itemprop="datePosted" content="2026-10-24"><h1>Agente ${url.pathname.includes('111')?'111':'222'}</h1><span itemprop="description"><p>Atención a clientes.</p></span>`,{headers:{'content-type':'text/html'}});
    return new Response(`<span class="paginationLabel">Resultados 1 – 25 de 26</span><table>${url.pathname.includes('/25/')?row('111')+row('222'):row('111')}</table>`,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(pagedBoard,'2026-10-26T12:00:00Z',()=>null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.title),['Agente 111','Agente 222']);
});

test('DISA valida identidad y solo mapea el municipio indicado en su detalle',()=>{
  const id='39750a01-4138-4195-a19b-38f0340a5640';
  const offers=parseDisaListing({Offers:[{OfferId:id,JobName:'Expendedor/a Shell Vícar',WorkPlaceName:'Shell Vícar',Province:'ALMERÍA',CategoryName:'Estaciones de Servicio',ModalityName:'Empleo',OfferReference:'O.974-26'}],TotalOfertas:1});
  const detail='<h1>Expendedor/a Shell Vícar</h1><dl><dt>Provincias:</dt><dd><div>ALMERÍA</div></dd><dt>Municipios:</dt><dd><div>VÍCAR</div></dd><dt>Centro de trabajo:</dt><dd>Shell Vícar</dd></dl><div class="mb-7"><h4>Descripción de la oferta</h4><p>Atención al cliente en estación de servicio.</p></div>';
  const job=adaptDisaOffer(offers[0]!,detail,checkedAt,(city,province)=>{
    assert.equal(city,'VÍCAR');assert.equal(province,'Almería');return resolveCity(city)?.location??null;
  });
  assert.deepEqual(job.location?.point,[-2.64,36.83]);
  assert.equal(job.dateKind,'observed');
  assert.equal(job.sourceUrl,`https://empleo.disagrupo.es/offer/detail/${id}`);
});
