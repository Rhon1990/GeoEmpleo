import assert from 'node:assert/strict';
import {test} from 'node:test';
import {adaptEulenTaleoDetail,fetchEulenTaleoOffers} from '../packages/ingestion/src/connectors/eulen-taleo.ts';
import type {CityResolver} from '../packages/ingestion/src/connectors/bizneo.ts';

const checkedAt='2026-11-03T10:00:00.000Z';
const resolveCity:CityResolver=(city,province)=> city.toLowerCase()==='alhama de murcia'&&province==='Murcia'
  ? {city:'Alhama de Murcia',province:'Murcia',region:'Región de Murcia',location:{point:[-1.42,37.85],precision:'municipality',sourceUrl:'https://example.org/alhama',sourceUpdatedAt:null,note:'Municipio aproximado'}}
  :null;
const offer={jobId:'711848',contestNo:'260007QU',column:['260007QU','Peón Jardinero/a','["Murcia"]']};
const detail=(sites:string)=>`<div id="requisitionDescriptionInterface.ID1315.row1"><span id="requisitionDescriptionInterface.reqTitleLinkAction.row1">Peón Jardinero/a</span></div>
  <div id="requisitionDescriptionInterface.ID1404.row1">Trabajo en espacios verdes.</div>
  <div id="requisitionDescriptionInterface.ID1462.row1">Experiencia deseable.</div>
  <div id="requisitionDescriptionInterface.ID1477.row1"><span id="requisitionDescriptionInterface.reqMainLocation.row1">Murcia</span></div>
  <div id="requisitionDescriptionInterface.ID1577.row1">${sites}</div>
  <div id="requisitionDescriptionInterface.ID2067.row1"><span id="requisitionDescriptionInterface.reqPostingDate.row1">03/11/2026, 09:40:32</span></div>`;
const site=(city:string,zip:string,row=1)=>`<span id="requisitionDescriptionInterface.reqSiteName.row${row}">${zip} - ${city}</span><span id="requisitionDescriptionInterface.reqSiteCity.row${row}">${city}</span><span id="requisitionDescriptionInterface.reqSiteZipCode.row${row}">${zip}</span>`;

test('Eulen Taleo usa la localidad de la ficha, el ID y el enlace oficial',()=>{
  const job=adaptEulenTaleoDetail(offer,detail(site('ALHAMA DE MURCIA','30840')),checkedAt,resolveCity);
  assert.equal(job?.id,'EULEN-TALEO-260007QU');
  assert.equal(job?.sourceUrl,'https://eulen.taleo.net/careersection/eul_career_site/jobdetail.ftl?job=260007QU&lang=es');
  assert.equal(job?.city,'Alhama de Murcia');
  assert.deepEqual(job?.location?.point,[-1.42,37.85]);
  assert.equal(job?.publishedAt,'2026-11-03');
});

test('Eulen Taleo conserva la ficha pero no inventa punto para varias localidades',()=>{
  const job=adaptEulenTaleoDetail(offer,detail(site('ALHAMA DE MURCIA','30840')+site('MURCIA','30001',2)),checkedAt,resolveCity);
  assert.equal(job?.id,'EULEN-TALEO-260007QU');
  assert.equal(job?.location,null);
});

test('Eulen Taleo rechaza un identificador o ficha no verificable',()=>{
  assert.throws(()=>adaptEulenTaleoDetail({...offer,contestNo:'../evil'},detail(site('ALHAMA DE MURCIA','30840')),checkedAt,resolveCity));
  assert.equal(adaptEulenTaleoDetail(offer,'<html>Sin oferta</html>',checkedAt,resolveCity),null);
});

test('Eulen Taleo captura todas las páginas con una sesión pública',async()=>{
  const pages:number[]=[];
  const mock=async(url:string|URL|Request,init?:RequestInit):Promise<Response>=>{
    const target=String(url);
    if(target.includes('jobsearch.ftl'))return new Response('<html>Buscar ofertas</html>',{headers:{'content-type':'text/html','set-cookie':'JSESSIONID=public123; Path=/careersection/; Secure; HttpOnly'}});
    if(target.includes('/rest/jobboard/searchjobs')){
      assert.equal(init?.method,'POST');
      assert.match(String(new Headers(init?.headers).get('cookie')),/JSESSIONID=public123/);
      const body=JSON.parse(String(init?.body));
      pages.push(body.pageNo);
      const number=body.pageNo;
      return Response.json({pagingData:{currentPageNo:number,pageSize:1,totalCount:2},requisitionList:[{...offer,jobId:String(711847+number),contestNo:number===1?'260007QU':'260007QV'}]});
    }
    assert.match(target,/jobdetail\.ftl\?job=260007Q[UV]&lang=es/);
    return new Response(detail(site('ALHAMA DE MURCIA','30840')),{headers:{'content-type':'text/html'}});
  };
  const jobs=await fetchEulenTaleoOffers(checkedAt,resolveCity,mock as typeof fetch);
  assert.deepEqual(pages,[1,2]);
  assert.deepEqual(jobs.map(job=>job.id),['EULEN-TALEO-260007QU','EULEN-TALEO-260007QV']);
});

test('Eulen Taleo no publica una paginación duplicada o incompleta',async()=>{
  const mock=async(url:string|URL|Request,init?:RequestInit):Promise<Response>=>{
    const target=String(url);
    if(target.includes('jobsearch.ftl'))return new Response('<html>Buscar ofertas</html>',{headers:{'content-type':'text/html','set-cookie':'JSESSIONID=public123; Path=/careersection/'}});
    if(target.includes('/rest/jobboard/searchjobs')){
      const page=JSON.parse(String(init?.body)).pageNo;
      return Response.json({pagingData:{currentPageNo:page,pageSize:1,totalCount:2},requisitionList:[offer]});
    }
    throw new Error('No debe consultar fichas si la lista está duplicada');
  };
  await assert.rejects(fetchEulenTaleoOffers(checkedAt,resolveCity,mock as typeof fetch),/duplicad|incompleta/i);
});
