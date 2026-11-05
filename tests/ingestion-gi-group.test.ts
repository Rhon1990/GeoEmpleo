import assert from 'node:assert/strict';
import {test} from 'node:test';
import {adaptGiGroupDetail,fetchGiGroupOffers,parseGiGroupListing} from '../packages/ingestion/src/connectors/gi-group.ts';
import type {CityResolver} from '../packages/ingestion/src/connectors/bizneo.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const at='2026-11-05T12:00:00.000Z';
const url='https://es.gigroup.com/ofertas-de-trabajo-detalle/madrid-oferta/104837/';
const resolve:CityResolver=(city,province)=>city==='Madrid'&&province==='Madrid'
  ? {city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',location:{point:[40.42,-3.7],precision:'municipality',sourceUrl:'https://example.org/madrid',sourceUpdatedAt:null,note:'Municipio aproximado'}}
  : null;
const listing=(items:string,pages='')=>`<html><head>${pages}</head><body>${items}</body></html>`;
const card=(id:string,href:string)=>`<a class="ggp-job-title-url" href="${href}"><h2>Oferta ${id}</h2></a>`;
const detail=(overrides:Record<string,unknown>={})=>`<html><script type="application/ld+json">${JSON.stringify({
  '@context':'https://schema.org','@type':'JobPosting',identifier:{value:'104837'},
  title:'Operario/a',datePosted:'2026-11-04',validThrough:'2026-12-04',
  description:'<p>Turno de mañana.</p><p>Contrato temporal.</p>',
  jobLocation:{address:{addressLocality:'Madrid',addressRegion:'Madrid'}},...overrides,
})}</script></html>`;

test('Gi Group listado acepta fichas oficiales únicas y última página',()=>{
  const html=listing(card('104837','/ofertas-de-trabajo-detalle/madrid-oferta/104837/'),
    '<link rel="next" href="https://es.gigroup.com/ofertas-de-trabajo/?npage=2"><a href="?npage=3">3</a>');
  assert.deepEqual(parseGiGroupListing(html,1),{offers:[{id:'104837',url}],lastPage:3});
});

test('Gi Group rechaza IDs duplicados y enlaces externos',()=>{
  assert.throws(()=>parseGiGroupListing(listing(card('1','/ofertas-de-trabajo-detalle/a/1/')+card('1','/ofertas-de-trabajo-detalle/a/1/')),1));
  assert.throws(()=>parseGiGroupListing(listing(card('1','https://evil.example/ofertas-de-trabajo-detalle/a/1/')),1));
});

test('Gi Group adapta datos reales, localidad verificada y enlace público',()=>{
  const job=adaptGiGroupDetail({id:'104837',url},detail(),at,resolve);
  assert.equal(job?.id,'GIGROUP-104837');
  assert.equal(job?.sourceUrl,url);
  assert.equal(job?.province,'Madrid');
  assert.deepEqual(job?.location?.point,[40.42,-3.7]);
  assert.deepEqual(job?.paragraphs,['Turno de mañana.','Contrato temporal.']);
});

test('Gi Group deja sin punto la localidad ambigua y excluye provincia ajena o ficha caducada',()=>{
  const ambiguous=adaptGiGroupDetail({id:'104837',url},detail({jobLocation:{address:{addressLocality:'Pueblo',addressRegion:'Madrid'}}}),at,resolve);
  assert.equal(ambiguous?.location,null);
  assert.equal(adaptGiGroupDetail({id:'104837',url},detail({jobLocation:{address:{addressLocality:'Porto',addressRegion:'Porto'}}}),at,resolve),null);
  assert.equal(adaptGiGroupDetail({id:'104837',url},detail({validThrough:'2026-11-01'}),at,resolve),null);
});

test('Gi Group respeta país explícito y no sitúa teletrabajo sin centro confirmado',()=>{
  assert.equal(adaptGiGroupDetail({id:'104837',url},detail({jobLocation:{address:{addressLocality:'Madrid',addressRegion:'Madrid',addressCountry:'PT'}}}),at,resolve),null);
  const remote=adaptGiGroupDetail({id:'104837',url},detail({jobLocationType:'TELECOMMUTE'}),at,resolve);
  assert.equal(remote?.location,null);
});

test('Gi Group no confunde una página 200 inesperada con un fin de resultados',()=>{
  assert.throws(()=>parseGiGroupListing('<html><title>Verificación de seguridad</title></html>',23));
});

test('Gi Group recorre páginas hasta dos finales vacías y abre cada ficha pública',async()=>{
  const urls=[
    giPage(1),giPage(2),giPage(3),giPage(4),
    url,'https://es.gigroup.com/ofertas-de-trabajo-detalle/madrid-otra/104838/',
  ];
  const pages=new Map<string,string>([
    [urls[0]!,listing(card('104837','/ofertas-de-trabajo-detalle/madrid-oferta/104837/'),'<a href="?npage=4">4</a>')],
    [urls[1]!,listing(card('104838','/ofertas-de-trabajo-detalle/madrid-otra/104838/'),'<a href="?npage=4">4</a>')],
    [urls[2]!,emptyListing()],
    [urls[3]!,emptyListing()],
    [urls[4]!,detail()],
    [urls[5]!,detail({identifier:{value:'104838'}})],
  ]);
  const seen:string[]=[];
  const fetchStub=(async(input:URL|string)=>{
    const key=String(input);seen.push(key);
    const body=pages.get(key);
    return new Response(body??'missing',{status:body?200:404,headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchGiGroupOffers(at,resolve,fetchStub);
  assert.deepEqual(jobs.map(job=>job.id),['GIGROUP-104837','GIGROUP-104838']);
  assert.equal(new Set(seen).size,6);
});

test('Gi Group rechaza una página intermedia fallida y no publica una captura parcial',async()=>{
  const fetchStub=(async(input:URL|string)=>{
    const key=String(input);
    const body=key===giPage(1)?listing(card('104837','/ofertas-de-trabajo-detalle/madrid-oferta/104837/'),'<a href="?npage=3">3</a>'):'';
    return new Response(body,{status:body?200:404,headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  await assert.rejects(()=>fetchGiGroupOffers(at,resolve,fetchStub));
});

function giPage(page:number):string {return page===1?'https://es.gigroup.com/ofertas-de-trabajo/':`https://es.gigroup.com/ofertas-de-trabajo/?npage=${page}`;}
function emptyListing():string {return '<div class="ggp-job-results">Lo sentimos, tu búsqueda no ha generado resultados. Inténtalo de nuevo.</div>';}

test('Gi Group confirma dos páginas vacías aunque la primera ventana de paginación sea corta',async()=>{
  const pages=new Map([
    [giPage(1),listing(card('104837','/ofertas-de-trabajo-detalle/madrid-oferta/104837/'),'<a href="?npage=2">2</a>')],
    [giPage(2),listing(card('104838','/ofertas-de-trabajo-detalle/madrid-otra/104838/'),'<a href="?npage=3">3</a>')],
    [giPage(3),emptyListing()],
    [giPage(4),emptyListing()],
    [url,detail()],
    ['https://es.gigroup.com/ofertas-de-trabajo-detalle/madrid-otra/104838/',detail({identifier:{value:'104838'}})],
  ]);
  const seen:string[]=[];
  const fetchStub=(async(input:URL|string)=>{
    const key=String(input);seen.push(key);
    const body=pages.get(key);
    return new Response(body??'missing',{status:body?200:404,headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchGiGroupOffers(at,resolve,fetchStub);
  assert.deepEqual(jobs.map(job=>job.id),['GIGROUP-104837','GIGROUP-104838']);
  assert.ok(seen.includes(giPage(3)));
  assert.ok(seen.includes(giPage(4)));
});

test('Gi Group figura como fuente activa española del portal oficial',()=>{
  const source=sourceRegistry.get('gigroup-oficial');
  assert.equal(source?.status,'active');
  assert.equal(source?.countryCode,'ES');
  assert.equal(source?.endpoint,giPage(1));
});
