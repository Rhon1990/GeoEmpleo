import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchLeroyMerlinOffers,parseLeroyMerlinListing} from '../packages/ingestion/src/connectors/leroy-merlin.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const checkedAt='2026-11-04T18:00:00.000Z';
const city={city:'Cuenca',province:'Cuenca',region:'Castilla-La Mancha',location:{point:[-2.1374,40.0704] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org/cuenca',sourceUpdatedAt:null,note:'Municipio aproximado'}};
const card=(id:number,title:string)=>`<li><a data-turbo="false" href="https://empleo.leroymerlin.es/jobs/${id}-puesto"><span title="${title}">${title.slice(0,8)}...</span></a></li>`;
const listing=(cards:string,total:number)=>`<h2>${total} vacantes</h2><ul id="jobs_list_container">${cards}</ul>`;
const detail=(id:number,title:string,locations:unknown)=>`<h1>${title}</h1><script type="application/ld+json">${JSON.stringify({
  '@type':'JobPosting',title,identifier:{value:String(id)},datePosted:'2026-11-04T09:00:00+01:00',
  description:'<p>Atención al cliente en tienda.</p>',employmentType:'FULL_TIME',jobLocation:locations,
})}</script>`;
const place=(cityName:string,country='ES')=>({address:{addressLocality:cityName,addressRegion:'Cuenca',addressCountry:country}});

test('Leroy Merlin publica solo fichas españolas con ID oficial y municipio único',async()=>{
  assert.equal(sourceRegistry.get('teamtailor-leroy')?.status,'active');
  const html=listing(card(111,'Vendedor/a Cuenca')+card(222,'Vendedor/a varias sedes'),2);
  const parsed=parseLeroyMerlinListing(html);
  assert.equal(parsed.total,2);
  assert.equal(parsed.offers[0]?.title,'Vendedor/a Cuenca');
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    const body=url.pathname.endsWith('/111-puesto')?detail(111,'Vendedor/a Cuenca',[place('Cuenca')]):
      url.pathname.endsWith('/222-puesto')?detail(222,'Vendedor/a varias sedes',[place('Cuenca'),place('Madrid')]):html;
    return new Response(body,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchLeroyMerlinOffers(checkedAt,name=>name==='Cuenca'?city:null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.id),['TEAMTAILOR-LEROY-111','TEAMTAILOR-LEROY-222']);
  assert.deepEqual(jobs[0]?.location?.point,[-2.1374,40.0704]);
  assert.equal(jobs[1]?.location,null);
});

test('Leroy Merlin rechaza un enlace ajeno y un país que no sea España',async()=>{
  assert.throws(()=>parseLeroyMerlinListing(listing(card(111,'Puesto').replace('empleo.leroymerlin.es','evil.test'),1)),/URL/);
  const html=listing(card(111,'Puesto'),1);
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return new Response(url.pathname.startsWith('/jobs/111-')?detail(111,'Puesto',[place('Lisboa','PT')]):html,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  await assert.rejects(()=>fetchLeroyMerlinOffers(checkedAt,()=>null,fetchImpl),/país|España/i);
});

test('Leroy Merlin prioriza el municipio explícito del título sobre una ciudad estructurada distinta',async()=>{
  const html=listing(card(333,'Vendedor/a Massanassa'),1);
  const valencia={city:'Valencia',province:'Valencia',region:'Comunidad Valenciana',location:{point:[-0.38,39.47] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org/valencia',sourceUpdatedAt:null,note:'Municipio aproximado'}};
  const massanassa={...valencia,city:'Massanassa',location:{...valencia.location,point:[-0.4,39.41] as [number,number]}};
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return new Response(url.pathname.startsWith('/jobs/333-')?detail(333,'Vendedor/a Massanassa',[{address:{addressLocality:'Valencia',addressRegion:'Valencia',addressCountry:'ES'}}]):html,{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchLeroyMerlinOffers(checkedAt,name=>name==='Massanassa'?massanassa:name==='Valencia'?valencia:null,fetchImpl);
  assert.equal(jobs[0]?.city,'Massanassa');
  assert.deepEqual(jobs[0]?.location?.point,[-0.4,39.41]);
});
