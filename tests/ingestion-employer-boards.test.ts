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
import {
  adaptElCorteInglesListing,
  fetchElCorteInglesOffers,
  parseElCorteInglesListing,
} from '../packages/ingestion/src/connectors/el-corte-ingles.ts';
import type { PublicCatalog } from '../packages/ingestion/src/model.ts';

const checkedAt = '2026-10-24T13:00:00.000Z';
const place = { id:'vicar', name:'Vícar', province:'Almería', municipality:'Vícar', latitude:36.83, longitude:-2.64, sourceUrl:'https://example.org/vicar', precision:'locality' as const };
const resolveCity = createNationalCityResolver([place]);
const madridResolved={city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[-3.7038,40.4168] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org/madrid',sourceUpdatedAt:null,note:'approx'}};
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

test('Carrefour no confunde una región con un municipio incluido en su nombre',async()=>{
  const html=carrefourPage(1,1,'token-region','Comunidad de Madrid',null);
  const resolver=(city:string)=>city==='Madrid'?{city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org/madrid',sourceUpdatedAt:null,note:'approx'}}:null;
  const jobs=await fetchCarrefourOffers(checkedAt,resolver,(async()=>new Response(html,{headers:{'content-type':'text/html'}})) as typeof fetch);
  assert.equal(jobs[0]?.city,'Comunidad de Madrid');
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

const eciListed=(id:string,location='Madrid')=>({
  job_requisition_id:id,
  job_posting_title:`Oferta ${id}`,
  job_location_name:location,
  job_areas:['Centros comerciales'],
  job_employee_type:'Empleo',
  job_time_type:'Completa',
  external_url:`https://wd3.myworkdaysite.com/recruiting/elcorteingles/Ext/job/MADRID/Oferta_${id}`,
  job_apply_url:`https://wd3.myworkdaysite.com/recruiting/elcorteingles/Ext/job/MADRID/Oferta_${id}/apply`,
});

test('El Corte Inglés usa el listado oficial cuando la ficha Workday solo muestra una SPA',async()=>{
  const requests:string[]=[];
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    requests.push(url.hostname);
    if(url.hostname==='empleo.elcorteingles.es')return new Response(JSON.stringify({
      job_requisitions:[eciListed('JR155839')],total_results:1,
    }),{headers:{'content-type':'application/json'}});
    return new Response('<html><head><title></title></head><body></body></html>',{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchElCorteInglesOffers(checkedAt,city=>city==='Madrid'?madridResolved:null,fetchImpl);
  assert.equal(jobs.length,1);
  assert.equal(jobs[0]?.id,'ELCORTEINGLES-JR155839');
  assert.equal(jobs[0]?.dateKind,'observed');
  assert.deepEqual(jobs[0]?.location?.point,[-3.7038,40.4168]);
  assert.deepEqual(requests,['empleo.elcorteingles.es']);
});

test('El Corte Inglés adapta solo los datos publicados en el listado oficial',()=>{
  const listing=parseElCorteInglesListing({job_requisitions:[eciListed('JR155839')],total_results:1},0);
  const job=adaptElCorteInglesListing(listing.offers[0]!,checkedAt,city=>city==='Madrid'?madridResolved:null);
  assert.equal(job?.sourceId,'elcorteingles-oficial');
  assert.equal(job?.employer,'El Corte Inglés');
  assert.equal(job?.publishedAt,'2026-10-24');
  assert.equal(job?.dateKind,'observed');
  assert.deepEqual(job?.paragraphs,['Tipo de empleo: Empleo.','Jornada: Completa.']);
  assert.deepEqual(job?.location?.point,[-3.7038,40.4168]);
  const versioned={...eciListed('JR147725')};
  versioned.external_url+='-1';
  versioned.job_apply_url=versioned.external_url+'/apply';
  assert.equal(parseElCorteInglesListing({job_requisitions:[versioned],total_results:1},0).offers[0]?.id,'JR147725');
  const spacing={...eciListed('JR147518'),job_posting_title:'Campaña de Navidad  Bilbao'};
  const normalized=parseElCorteInglesListing({job_requisitions:[spacing],total_results:1},0).offers[0]!;
  assert.equal(adaptElCorteInglesListing(normalized,checkedAt,()=>null).title,'Campaña de Navidad Bilbao');
  const remoteListing=parseElCorteInglesListing({job_requisitions:[eciListed('JR155841','Remoto')],total_results:1},0).offers[0]!;
  const remote=adaptElCorteInglesListing(remoteListing,checkedAt,()=>madridResolved);
  assert.equal(remote?.regime,'Remoto');
  assert.equal(remote?.location,null);
});

test('El Corte Inglés no inventa puntos para códigos internos',()=>{
  const internal=parseElCorteInglesListing({job_requisitions:[eciListed('JR151341','0030908')],total_results:1},0).offers[0]!;
  const job=adaptElCorteInglesListing(internal,checkedAt,()=>madridResolved);
  assert.equal(job?.location,null);
  assert.equal(job?.city,'Sin localidad verificada');
});

test('El Corte Inglés pagina todo el listado solicitando solo España',async()=>{
  const requests:{url:string;method:string;body:string}[]=[];
  const fetchImpl=(async(input:string|URL|Request,init?:RequestInit)=>{
    const request=input instanceof Request?input:new Request(input,init);
    const url=new URL(request.url);
    requests.push({url:url.href,method:request.method,body:request.method==='POST'?await request.clone().text():''});
    if(url.hostname==='empleo.elcorteingles.es'){
      const page=Number(url.searchParams.get('page'));
      const rows=page===0?[eciListed('JR155839')]:[eciListed('JR149187','Sevilla')];
      return new Response(JSON.stringify({job_requisitions:rows,total_results:2}),{headers:{'content-type':'application/json'}});
    }
    throw new Error('No debe consultarse Workday');
  }) as typeof fetch;
  const jobs=await fetchElCorteInglesOffers(checkedAt,city=>city==='Madrid'?madridResolved:null,fetchImpl,1);
  assert.deepEqual(jobs.map(job=>job.id),['ELCORTEINGLES-JR155839','ELCORTEINGLES-JR149187']);
  const listingRequests=requests.filter(item=>item.url.includes('empleo.elcorteingles.es'));
  assert.deepEqual(listingRequests.map(item=>[new URL(item.url).searchParams.get('page'),new URL(item.url).searchParams.get('size'),item.method,item.body]),[
    ['0','1','POST',JSON.stringify({location:[],contract_type:[],department:[],company:[],campaign:false,new_talent:false,is_fp_offers:false,employment_type:[],search_term:'',country:['ES']})],
    ['1','1','POST',JSON.stringify({location:[],contract_type:[],department:[],company:[],campaign:false,new_talent:false,is_fp_offers:false,employment_type:[],search_term:'',country:['ES']})],
  ]);
});

test('El Corte Inglés repite una vez si el total cambia durante la captura',async()=>{
  let attempt=0;
  const pages:number[]=[];
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.hostname==='empleo.elcorteingles.es'){
      const page=Number(url.searchParams.get('page'));
      pages.push(page);
      const total=attempt===0&&page===1?3:2;
      const rows=[eciListed(page===0?'JR155839':'JR155840')];
      if(page===1)attempt+=1;
      return new Response(JSON.stringify({job_requisitions:rows,total_results:total}),{headers:{'content-type':'application/json'}});
    }
    const id=url.pathname.match(/(JR\d+)$/)?.[1]??'';
    throw new Error(`No debe consultarse Workday: ${id}`);
  }) as typeof fetch;
  const jobs=await fetchElCorteInglesOffers(checkedAt,()=>null,fetchImpl,1);
  assert.equal(jobs.length,2);
  assert.deepEqual(pages,[0,1,0,1]);
});

test('El Corte Inglés reintenta una vez fallos transitorios del listado',async()=>{
  let listingCalls=0;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.hostname==='empleo.elcorteingles.es'){
      listingCalls+=1;
      if(listingCalls===1)throw new TypeError('fetch failed');
      return new Response(JSON.stringify({job_requisitions:[eciListed('JR155839')],total_results:1}),{headers:{'content-type':'application/json'}});
    }
    throw new Error('No debe consultarse Workday');
  }) as typeof fetch;
  const jobs=await fetchElCorteInglesOffers(checkedAt,()=>null,fetchImpl);
  assert.equal(jobs.length,1);
  assert.equal(listingCalls,2);
});

test('El Corte Inglés rechaza destinos externos, duplicados y capturas incompletas',async()=>{
  assert.throws(()=>parseElCorteInglesListing({job_requisitions:[{...eciListed('JR155839'),external_url:'https://evil.test/job/JR155839'}],total_results:1},0),/URL El Corte Inglés/);
  const duplicate={job_requisitions:[eciListed('JR155839'),eciListed('JR155839')],total_results:2};
  await assert.rejects(()=>fetchElCorteInglesOffers(checkedAt,()=>null,(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.hostname==='empleo.elcorteingles.es')return new Response(JSON.stringify(duplicate),{headers:{'content-type':'application/json'}});
    throw new Error('No debe consultarse Workday');
  }) as typeof fetch,100),/repetido/i);
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
    'successfactors-vithas','successfactors-mapfre','successfactors-capgemini','successfactors-melia','successfactors-kpmg',
    'successfactors-deloitte','successfactors-ilunion',
  ]);
  for(const item of successFactorsBoards) {
    assert.match(item.hostname,/^[a-z0-9.-]+$/);
    assert.equal(new URL(item.listingPath,`https://${item.hostname}`).protocol,'https:');
    assert.ok(item.categoryLabel);
    assert.ok(item.employer);
  }
});

test('KPMG conserva una fuente única y sitúa solo su municipio español verificado',async()=>{
  const kpmg=successFactorsBoards.find(item=>item.sourceId==='successfactors-kpmg');
  assert.ok(kpmg);
  assert.equal(sourceRegistry.get(kpmg.sourceId)?.status,'active');
  const listing='<span class="paginationLabel">Resultados 1 – 1 de 1</span><table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-Auditoria/1444635133/">Auditor/a</a></td><td class="colLocation">Madrid, ES, 28046</td><td class="colDate">4 nov 2026</td></tr></table>';
  const detail='<meta itemprop="datePosted" content="2026-11-04"><h1 id="job-title">Auditor/a</h1><span itemprop="description"><p>Auditoría financiera en Madrid.</p></span>';
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    assert.equal(url.hostname,'carreras.kpmg.es');
    return new Response(url.pathname.startsWith('/job/')?detail:listing,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(kpmg,'2026-11-04T13:00:00Z',city=>city==='Madrid'?madridResolved:null,fetchImpl);
  assert.equal(jobs.length,1);
  assert.equal(jobs[0]?.sourceUrl,'https://carreras.kpmg.es/job/Madrid-Auditoria/1444635133/');
  assert.deepEqual(jobs[0]?.location?.point,[-3.7038,40.4168]);
});

test('KPMG omite fichas confirmadas como cubiertas o publicadas sin descripción',async()=>{
  const kpmg=successFactorsBoards.find(item=>item.sourceId==='successfactors-kpmg');
  assert.ok(kpmg);
  const row=(id:string)=>`<tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-Puesto/${id}/">Puesto ${id}</a></td><td class="colLocation">Madrid, ES, 28046</td></tr>`;
  const listing=`<span class="paginationLabel">Resultados 1 – 3 de 3</span><table>${row('1')}${row('2')}${row('3')}</table>`;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(!url.pathname.startsWith('/job/'))return new Response(listing,{headers:{'content-type':'text/html'}});
    const id=url.pathname.match(/\/(\d+)\/$/)?.[1];
    const html=id==='1'?'<div class="jobDisplayShell"><p><strong>Lo sentimos, esta posición ya está cubierta.</strong></p></div>'
      :id==='2'?'<div class="jobDisplayShell"><meta itemprop="datePosted" content="2026-11-04"><h1>Puesto 2</h1><span itemprop="description"><div></div></span></div>'
      :'<div class="jobDisplayShell"><meta itemprop="datePosted" content="2026-11-04"><h1>Puesto 3</h1><span itemprop="description"><p>Oferta completa.</p></span></div>';
    return new Response(html,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(kpmg,'2026-11-04T13:00:00Z',()=>null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.title),['Puesto 3']);
});

test('KPMG reintenta una respuesta 504 transitoria sin perder la ficha',async()=>{
  const kpmg=successFactorsBoards.find(item=>item.sourceId==='successfactors-kpmg');
  assert.ok(kpmg);
  const listing='<span class="paginationLabel">Resultados 1 – 1 de 1</span><table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-Puesto/1444635133/">Puesto</a></td><td class="colLocation">Madrid, ES, 28046</td></tr></table>';
  const detail='<meta itemprop="datePosted" content="2026-11-04"><h1 id="job-title">Puesto</h1><span itemprop="description"><p>Oferta completa.</p></span>';
  let detailCalls=0;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(!url.pathname.startsWith('/job/'))return new Response(listing,{headers:{'content-type':'text/html'}});
    detailCalls++;
    return detailCalls===1?new Response('',{status:504,headers:{'content-type':'text/html'}}):new Response(detail,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(kpmg,'2026-11-04T13:00:00Z',()=>null,fetchImpl);
  assert.equal(detailCalls,2);
  assert.equal(jobs.length,1);
});

test('SuccessFactors lee una sola ficha por tarjeta y valida las páginas de Deloitte',async()=>{
  const board:SuccessFactorsBoard={sourceId:'successfactors-deloitte',hostname:'empleo.es.deloitte.com',employer:'Deloitte',
    listingPath:'/search/?q=',jobPathPattern:/^\/job\/[^/]+\/\d+\/$/,category:'tecnologia',categoryLabel:'Tecnología y consultoría',
    sourceLabel:'Deloitte · empleo oficial',pageSize:1,maxPages:3,paginationOffsetParam:'startrow',listingFormat:'tile',
    paginationPath:'/tile-search-results/'};
  const tile=(id:string,index:number)=>`<li class="job-tile" data-row-index="${index}"><div class="sub-section-desktop"><a class="jobTitle-link" href="/job/Madrid-Puesto/${id}/">Puesto ${id}</a><div class="section-field location"><div>Madrid, ES</div></div></div><div class="sub-section-mobile"><a class="jobTitle-link" href="/job/Madrid-Puesto/${id}/">Puesto ${id}</a></div></li>`;
  const first=`<span id="tile-search-results-label">Mostrando 1 a 1 de 2 puestos</span><ul>${tile('1',1)}</ul>`;
  const second=tile('2',2);
  const requested:string[]=[];
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);requested.push(url.pathname+url.search);
    const html=url.pathname.startsWith('/job/')?`<meta itemprop="datePosted" content="2026-11-04"><h1 id="job-title">Puesto ${url.pathname.match(/\/(\d+)\/$/)?.[1]}</h1><span itemprop="description"><p>Trabajo en Madrid.</p></span>`:
      url.pathname.startsWith('/tile-search-results/')?second:first;
    return new Response(html,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(board,'2026-11-04T13:00:00Z',city=>city==='Madrid'?madridResolved:null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.id),['SUCCESSFACTORS-SUCCESSFACTORS-DELOITTE-1','SUCCESSFACTORS-SUCCESSFACTORS-DELOITTE-2']);
  assert.ok(requested.some(url=>url.startsWith('/tile-search-results/')&&url.includes('startrow=1')));
  assert.equal(jobs[0]?.location?.point[0],-3.7038);
});

test('SuccessFactors no confunde la etiqueta visual de una tarjeta con su localidad',()=>{
  const tileBoard:SuccessFactorsBoard={...successFactorsBoard,listingFormat:'tile'};
  const html='<span id="tile-search-results-label">Mostrando 1 a 1 de 1 puestos</span><ul><li class="job-tile"><a class="jobTitle-link" href="/job/Madrid-Puesto/1234567890/">Puesto</a><div class="section-field location"><span class="section-label">Ubicación</span><div>Madrid, ES</div></div></li></ul>';
  assert.equal(parseSuccessFactorsListing(html,tileBoard).offers[0]?.city,'Madrid');
});

test('SuccessFactors identifica el título de ILUNION dentro del encabezado de la ficha',()=>{
  const tileBoard:SuccessFactorsBoard={...successFactorsBoard,listingFormat:'tile'};
  const offer={url:'https://jobs.example.es/job/Madrid-Puesto/1234567890/',title:'Puesto',city:'Madrid',provinceHint:null,listedDate:'',ambiguousLocation:false};
  const html='<meta itemprop="datePosted" content="2026-11-04"><h1><span>PUESTO: </span><span itemprop="title">Puesto</span></h1><span itemprop="description"><p>Oferta vigente.</p></span>';
  assert.equal(adaptSuccessFactorsDetail(offer,html,'2026-11-04T13:00:00Z',()=>null,tileBoard).title,'Puesto');
});

test('Deloitte conserva el municipio de oficina pese a su texto genérico de teletrabajo',()=>{
  const board=successFactorsBoards.find(item=>item.sourceId==='successfactors-deloitte');
  assert.ok(board);
  const html='<span id="tile-search-results-label">Mostrando 1 a 1 de 1 puestos</span><ul><li class="job-tile"><a class="jobTitle-link" href="/job/Madrid-Puesto/1234567890/">Puesto</a><div class="section-field location"><span>Ubicación</span><div>Madrid, España</div></div></li></ul>';
  const offer=parseSuccessFactorsListing(html,board).offers[0]!;
  const detail='<meta itemprop="datePosted" content="2026-11-04"><h1 id="job-title">Puesto</h1><span itemprop="description"><p>En Madrid tendrás horario flexible y un buen equilibrio entre el teletrabajo y el trabajo en equipo en nuestras oficinas.</p></span>';
  const job=adaptSuccessFactorsDetail(offer,detail,'2026-11-04T13:00:00Z',city=>city==='Madrid'?madridResolved:null,board);
  assert.equal(job.city,'Madrid');
  assert.deepEqual(job.location?.point,[-3.7038,40.4168]);
});

test('ILUNION contabiliza pero no atribuye a la marca fichas de Fundación ONCE',async()=>{
  const board:SuccessFactorsBoard={...successFactorsBoards.find(item=>item.sourceId==='successfactors-ilunion')!,pageSize:2};
  const tile=(href:string,title:string,index:number)=>`<li class="job-tile" data-row-index="${index}"><a class="jobTitle-link" href="${href}">${title}</a><div class="section-field city"><span>Población</span><div>Madrid</div></div></li>`;
  const listing=`<span id="tile-search-results-label">Mostrando 1 a 2 de 2 puestos</span><ul>${tile('/job/Madrid-Puesto/1234567890/','Puesto',1)}${tile('/fundacion-once/job/Madrid-INSERTA/2234567890/','INSERTA',2)}</ul>`;
  const detail='<meta itemprop="datePosted" content="2026-11-04"><h1>Puesto</h1><span itemprop="description"><p>Oferta vigente.</p></span>';
  const requested:string[]=[];
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);requested.push(url.pathname);
    return new Response(url.pathname.startsWith('/job/')?detail:listing,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(board,'2026-11-04T13:00:00Z',()=>null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.title),['Puesto']);
  assert.equal(requested.some(path=>path.startsWith('/fundacion-once/')),false);
  assert.throws(()=>parseSuccessFactorsListing(listing.replace('/fundacion-once/job/Madrid-INSERTA/2234567890/','https://evil.test/fundacion-once/job/Madrid-INSERTA/2234567890/'),board),/URL/);
});

test('ILUNION omite una ficha retirada aunque siga en su listado',async()=>{
  const board:SuccessFactorsBoard={...successFactorsBoards.find(item=>item.sourceId==='successfactors-ilunion')!,pageSize:2};
  const row=(id:string)=>`<li class="job-tile"><a class="jobTitle-link" href="/job/Madrid-Puesto/${id}/">Puesto ${id}</a><div class="section-field city"><div>Madrid</div></div></li>`;
  const listing=`<span id="tile-search-results-label">Mostrando 1 a 2 de 2 puestos</span><ul>${row('1')}${row('2')}</ul>`;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    const html=url.pathname.endsWith('/2/')?'<div class="jobDisplayShell">Lo sentimos, esta posición ya está cubierta.</div>':
      url.pathname.endsWith('/1/')?'<meta itemprop="datePosted" content="2026-11-04"><h1>Puesto 1</h1><span itemprop="description"><p>Oferta vigente.</p></span>':listing;
    return new Response(html,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(board,'2026-11-04T13:00:00Z',()=>null,fetchImpl);
  assert.equal(jobs.length,1);
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

test('TalentClue conserva vacantes antiguas mientras sigan en el listado público', () => {
  const html = '<table><tr><td><a href="https://careers.talentclue.com/es/node/129742113/4590/modal">Personal de equipo</a></td><td>McDonald’s Rosaleda</td><td>Málaga</td><td>Málaga</td><td>Ventas</td><td>23/10/2026</td></tr><tr><td><a href="https://careers.talentclue.com/es/node/129742114/4590/modal">Gerencia de restaurante</a></td><td>McDonald’s Centro</td><td>Madrid</td><td>Madrid</td><td>Operaciones</td><td>23/10/2025</td></tr></table>';
  const jobs = adaptTalentClueListing(html,checkedAt,() => null);
  assert.equal(jobs.length,2);
  assert.equal(jobs[0]?.publishedAt,'2026-10-23');
  assert.equal(jobs[0]?.location,null);
  assert.equal(jobs[0]?.sourceUrl,'https://careers.talentclue.com/es/node/129742113/4590/modal');
  assert.equal(jobs[1]?.publishedAt,'2025-10-23');
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

test('SuccessFactors interpreta un contador de paginación en inglés',()=>{
  const listing='<span class="paginationLabel">Results <b>1 – 25</b> of <b>1,837</b></span><table><tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-Puesto/1234567890/">Puesto</a></td><td class="colLocation">Madrid, ES</td></tr></table>';
  const parsed=parseSuccessFactorsListing(listing,{...successFactorsBoard,pageSize:25,maxPages:80});
  assert.equal(parsed.totalCount,1837);
  assert.equal(parsed.pageCount,74);
});

test('SuccessFactors filtra países extranjeros y conserva España en ubicaciones múltiples',()=>{
  const listing='<table>'
    +'<tr class="data-row"><td><a class="jobTitle-link" href="/job/Dallas-Puesto/1234567890/">US</a></td><td class="colLocation">Dallas, TX, US +5 more…</td></tr>'
    +'<tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-Puesto/1234567891/">ES</a></td><td class="colLocation">Madrid, ES +2 more…</td></tr>'
    +'</table>';
  const parsed=parseSuccessFactorsListing(listing,successFactorsBoard);
  assert.deepEqual(parsed.offers.map(offer=>({title:offer.title,city:offer.city,ambiguous:offer.ambiguousLocation})),[
    {title:'ES',city:'Madrid',ambiguous:true},
  ]);
  assert.equal(parsed.observedUrls.length,2);
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

test('SuccessFactors puede recorrer un listado global y abrir solo fichas españolas',async()=>{
  const configured=successFactorsBoards.find(item=>item.sourceId==='successfactors-capgemini')!;
  const spanishBoard={...configured,listingPath:'/search/?q=&locationsearch=',pageSize:2,maxPages:2,paginationOffsetParam:'startrow' as const};
  const row=(id:string,title:string,city:string,country:string)=>`<tr class="data-row"><td><a class="jobTitle-link" href="/job/${city}-${id}/${id}/">${title}</a></td><td class="colLocation">${city}, ${country}</td></tr>`;
  const listingStarts:number[]=[];
  let detailCalls=0;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.pathname.startsWith('/job/')) {
      detailCalls+=1;
      return new Response(`<meta itemprop="datePosted" content="2026-11-05"><h1>${url.pathname.includes('111')?'Uno':'Dos'}</h1><span itemprop="description"><p>Oficio verificable.</p></span>`,{headers:{'content-type':'text/html'}});
    }
    const start=Number(url.searchParams.get('startrow')??0);
    listingStarts.push(start);
    const rows=start===0
      ?row('111','Uno','Madrid','ES')+row('901','Portugal uno','Lisboa','PT')
      :row('222','Dos','Barcelona','ES')+row('902','Portugal dos','Porto','PT');
    return new Response(`<span class="paginationLabel">Resultados 1 – 2 de 4</span><table>${rows}</table>`,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(spanishBoard,'2026-11-06T12:00:00Z',()=>null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.city),['Madrid','Barcelona']);
  assert.deepEqual(listingStarts,[0,2]);
  assert.equal(detailCalls,2);
});

test('Vithas pagina con startrow sin repetir la primera página',async()=>{
  const board=successFactorsBoards.find(item=>item.sourceId==='successfactors-vithas')!;
  const row=(id:string)=>`<tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-${id}/${id}/">Puesto ${id}</a></td><td class="colLocation">Madrid, ES</td></tr>`;
  const firstPage=Array.from({length:25},(_,index)=>row(String(100+index))).join('');
  const fetched:string[]=[];
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    fetched.push(url.href);
    if(url.pathname.startsWith('/job/')) return new Response(`<meta itemprop="datePosted" content="2026-10-24"><h1>Puesto ${url.pathname.match(/\/(\d+)\/$/)?.[1]}</h1><span itemprop="description"><p>Oferta vigente.</p></span>`,{headers:{'content-type':'text/html'}});
    return new Response(`<span class="paginationLabel">Resultados 1 – 25 de 26</span><table>${url.searchParams.get('startrow')==='25'?row('222'):firstPage}</table>`,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSuccessFactorsOffers(board,'2026-10-26T12:00:00Z',()=>null,fetchImpl);
  assert.equal(jobs.length,26);
  assert.equal(jobs.at(-1)?.title,'Puesto 222');
  assert.equal(fetched.filter(url=>url.includes('/search/')).length,2);
  assert.equal(new URL(fetched.find(url=>url.includes('startrow=25'))!).searchParams.get('sortDirection'),'desc');
});

test('Vithas rechaza un listado paginado que no contiene el total anunciado',async()=>{
  const board=successFactorsBoards.find(item=>item.sourceId==='successfactors-vithas')!;
  const row=(id:string)=>`<tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-${id}/${id}/">Puesto ${id}</a></td><td class="colLocation">Madrid, ES</td></tr>`;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.pathname.startsWith('/job/')) return new Response(`<meta itemprop="datePosted" content="2026-10-24"><h1>Puesto ${url.pathname.match(/\/(\d+)\/$/)?.[1]}</h1><span itemprop="description"><p>Oferta vigente.</p></span>`,{headers:{'content-type':'text/html'}});
    const rows=url.searchParams.get('startrow')==='25'?row('222'):Array.from({length:25},(_,index)=>row(String(100+index))).join('');
    return new Response(`<span class="paginationLabel">Resultados 1 – 25 de 27</span><table>${rows}</table>`,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  await assert.rejects(fetchSuccessFactorsOffers(board,'2026-10-26T12:00:00Z',()=>null,fetchImpl),/incompleta/);
});

test('Vithas rechaza un cambio del total durante la paginación',async()=>{
  const board=successFactorsBoards.find(item=>item.sourceId==='successfactors-vithas')!;
  const row=(id:string)=>`<tr class="data-row"><td><a class="jobTitle-link" href="/job/Madrid-${id}/${id}/">Puesto ${id}</a></td><td class="colLocation">Madrid, ES</td></tr>`;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.pathname.startsWith('/job/')) return new Response(`<meta itemprop="datePosted" content="2026-10-24"><h1>Puesto ${url.pathname.match(/\/(\d+)\/$/)?.[1]}</h1><span itemprop="description"><p>Oferta vigente.</p></span>`,{headers:{'content-type':'text/html'}});
    const second=url.searchParams.get('startrow')==='25';
    const rows=second?row('222'):Array.from({length:25},(_,index)=>row(String(100+index))).join('');
    return new Response(`<span class="paginationLabel">Resultados 1 – 25 de ${second?27:26}</span><table>${rows}</table>`,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  await assert.rejects(fetchSuccessFactorsOffers(board,'2026-10-26T12:00:00Z',()=>null,fetchImpl),/cambió/);
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
