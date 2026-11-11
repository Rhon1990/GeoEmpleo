import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchSacyrOffers,parseSacyrListing} from '../packages/ingestion/src/connectors/sacyr.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const checkedAt='2026-11-11T12:00:00.000Z';
const madrid={
  city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',
  location:{point:[-3.7038,40.4168] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.test/madrid',sourceUpdatedAt:null,note:'Municipio aproximado'},
};
const card=(id:number,title:string)=>`<li><a data-turbo="false" href="https://sacyrpeople.sacyr.com/jobs/${id}-${title.toLocaleLowerCase('es-ES').replace(/[^a-z0-9]+/g,'-')}">${title}</a></li>`;
const listing=(cards:string,total:number)=>`<h2>${total} vacantes <span>(de ${total})</span></h2><ul id="jobs_list_container">${cards}</ul>`;
const detail=(id:number,title:string,locations:unknown)=>`<h1>${title}</h1><script type="application/ld+json">${JSON.stringify({
  '@type':'JobPosting',title,identifier:{value:String(id)},datePosted:'2026-11-11T09:00:00+01:00',
  description:'<p>Trabajo en obra civil.</p>',employmentType:'FULL_TIME',jobLocation:locations,
})}</script>`;
const place=(city:string,country='ES')=>({address:{addressLocality:city,addressRegion:city,addressCountry:country}});

test('Sacyr figura como fuente activa del portal oficial',()=>{
  assert.equal(sourceRegistry.get('sacyr-oficial')?.status,'active');
});

test('Sacyr captura todas las fichas españolas con identidad y municipio verificados',async()=>{
  const title='Oficial de 1ª Madrid';
  const html=listing(card(8703655,title),1);
  assert.deepEqual(parseSacyrListing(html).offers,[{url:'https://sacyrpeople.sacyr.com/jobs/8703655-oficial-de-1-madrid',title}]);
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    const body=url.pathname.startsWith('/jobs/8703655-')?detail(8703655,title,[place('Madrid'),place('Madrid')]):html;
    return new Response(body,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSacyrOffers(checkedAt,name=>name==='Madrid'?madrid:null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.id),['TEAMTAILOR-SACYR-8703655']);
  assert.equal(jobs[0]?.employer,'Sacyr');
  assert.equal(jobs[0]?.sourceUrl,'https://sacyrpeople.sacyr.com/jobs/8703655-oficial-de-1-madrid');
  assert.deepEqual(jobs[0]?.location?.point,[-3.7038,40.4168]);
});

test('Sacyr rechaza una ficha extranjera y conserva las multiubicación sin marcador',async()=>{
  const title='Puesto verificado';
  const html=listing(card(11,title)+card(22,'Puesto extranjero'),2);
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    const body=url.pathname.startsWith('/jobs/11-')?detail(11,title,[place('Madrid'),place('Sevilla')])
      :url.pathname.startsWith('/jobs/22-')?detail(22,'Puesto extranjero',[place('Lisboa','PT')]):html;
    return new Response(body,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  await assert.rejects(()=>fetchSacyrOffers(checkedAt,name=>name==='Madrid'?madrid:null,fetchImpl),/España|país/i);

  const onlySpain=listing(card(11,title),1);
  const onlySpainFetch=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return new Response(url.pathname.startsWith('/jobs/11-')?detail(11,title,[place('Madrid'),place('Sevilla')]):onlySpain,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchSacyrOffers(checkedAt,name=>name==='Madrid'?madrid:null,onlySpainFetch);
  assert.equal(jobs[0]?.city,'Varias ubicaciones');
  assert.equal(jobs[0]?.location,null);
});

test('Sacyr rechaza enlaces externos y paginación incompleta',async()=>{
  assert.throws(()=>parseSacyrListing(listing(card(8703655,'Puesto').replace('sacyrpeople.sacyr.com','evil.test'),1)),/URL/);
  const first=listing(card(1,'Uno'),21)+`<a data-turbo-stream="true" href="/jobs/show_more?country=Spain&page=2">Mostrar 20 más</a>`;
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return new Response(url.pathname==='/jobs/show_more'?'<turbo-stream action="append" target="jobs_list_container"><template></template></turbo-stream>':first,{headers:{'content-type':url.pathname==='/jobs/show_more'?'text/vnd.turbo-stream.html':'text/html'}});
  }) as typeof fetch;
  await assert.rejects(()=>fetchSacyrOffers(checkedAt,()=>null,fetchImpl),/página|incomplet[oa]/i);
});
