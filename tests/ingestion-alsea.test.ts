import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchAlseaOffers,parseAlseaListing} from '../packages/ingestion/src/connectors/alsea.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const checkedAt='2026-11-18T12:00:00.000Z';
const card=(id:number,title:string)=>`<li><a data-turbo="false" title="${title}" href="https://alseaespana.teamtailor.com/jobs/${id}-oferta"><span>${title}</span><span>Marketing · MADRID</span></a></li>`;
const listing=(cards:string,total:number)=>`<h2>${total} vacantes</h2><ul id="jobs_list_container">${cards}</ul>`;
const place=(city:string,country='ES')=>({address:{addressLocality:city,addressRegion:city,addressCountry:country}});
const detail=(id:number,title:string,locations:unknown)=>`<h1>${title}</h1><script type="application/ld+json">${JSON.stringify({
  '@type':'JobPosting',title,identifier:{value:String(id)},datePosted:'2026-11-17T09:00:00+01:00',
  description:'<p>Atención al cliente y gestión de campañas.</p>',jobLocation:locations,
})}</script>`;
const cities={
  Madrid:{city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.test/madrid',sourceUpdatedAt:null,note:'Municipio aproximado'}},
  Sevilla:{city:'Sevilla',province:'Sevilla',region:'Andalucía',location:{point:[-5.9,37.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.test/sevilla',sourceUpdatedAt:null,note:'Municipio aproximado'}},
};

test('Alsea registra el portal oficial y extrae el título del anuncio sin metadatos de tarjeta',()=>{
  assert.equal(sourceRegistry.get('teamtailor-alsea')?.status,'active');
  assert.deepEqual(parseAlseaListing(listing(card(8711972,'Técnico/a de Fidelización'),1)).offers,[
    {url:'https://alseaespana.teamtailor.com/jobs/8711972-oferta',title:'Técnico/a de Fidelización'},
  ]);
});

test('Alsea separa localidades verificables de una misma vacante con ID estable',async()=>{
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return new Response(url.pathname.startsWith('/jobs/8711972-')
      ? detail(8711972,'Técnico/a de Fidelización',[place('Madrid'),place('Sevilla'),place('Madrid')])
      : listing(card(8711972,'Técnico/a de Fidelización'),1),{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchAlseaOffers(checkedAt,city=>cities[city as keyof typeof cities]??null,fetchImpl);
  assert.equal(jobs.length,2);
  assert.deepEqual(jobs.map(job=>job.city),['Madrid','Sevilla']);
  assert.equal(new Set(jobs.map(job=>job.id)).size,2);
  assert.ok(jobs.every(job=>job.sourceId==='teamtailor-alsea'&&job.employer==='Alsea'&&job.location?.precision==='municipality'));
  assert.ok(jobs.every(job=>job.sourceUrl==='https://alseaespana.teamtailor.com/jobs/8711972-oferta'));
});

test('Alsea rechaza enlaces ajenos, fichas inconsistentes y paginación incompleta',async()=>{
  assert.throws(()=>parseAlseaListing(listing(card(1,'Puesto').replace('alseaespana.teamtailor.com','evil.test'),1)),/URL/);
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return new Response(url.pathname.startsWith('/jobs/1-')?detail(2,'Puesto',[place('Madrid')]):listing(card(1,'Puesto'),1),{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  await assert.rejects(()=>fetchAlseaOffers(checkedAt,()=>cities.Madrid,fetchImpl),/corresponde/);
  assert.throws(()=>parseAlseaListing(listing(card(1,'Puesto'),21)),/incomplet/);
});
