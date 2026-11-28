import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createStaticDataFetch, placeShardKey, shardPlaces} from '../apps/web-preview/public/static-data.mjs';
import {buildStaticSite} from '../tools/build-static-site.mjs';
import {updateMapWithoutLosingJobs} from '../apps/web-preview/public/map-search.mjs';
import {mkdtemp,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

const point = (longitude:number,latitude:number) => ({point:[longitude,latitude]});
const jobs = [
  {id:'segovia-1',title:'Operario rural',employer:'Empresa real',city:'Villacastín',province:'Segovia',region:'Castilla y León',category:'industria',categoryLabel:'Industria',source:'ECYL',sourceId:'ecyl-castilla-leon',sourceUrl:'https://example.com/segovia-1',places:1,salary:null,location:point(-4.1,40.7),paragraphs:['Texto original'],dateKind:'observed',publishedAt:'2026-10-20',checkedAt:'2026-10-23T09:00:00Z'},
  {id:'madrid-1',title:'Técnico',employer:'Empresa real',city:'Madrid',province:'Madrid',region:'Comunidad de Madrid',category:'tecnologia',categoryLabel:'Tecnología',source:'ECYL',sourceId:'ecyl-castilla-leon',location:point(-3.7,40.4),paragraphs:['Otro texto']},
];
const catalog = {checkedAt:'2026-10-24T08:00:00Z',calls:jobs};
const places = [
  {name:'Coto de San Isidro',label:'Coto de San Isidro · Ituero y Lama, Segovia (40151)',aliases:['Coto San Isidro'],postalCodes:['40151'],province:'Segovia',longitude:-4.37,latitude:40.80},
  {name:'Madrid',label:'Madrid, Madrid (28001)',aliases:[],postalCodes:['28001'],province:'Madrid',longitude:-3.7,latitude:40.4},
];

test('el índice estático incluye pueblos por nombre, palabra interior y código postal', () => {
  assert.equal(placeShardKey('San Isidro'),'sa');
  assert.equal(placeShardKey('40151'),'40');
  const shards=shardPlaces(places);
  assert.equal(shards.get('sa')?.[0]?.name,'Coto de San Isidro');
  assert.equal(shards.get('40')?.[0]?.name,'Coto de San Isidro');
});

test('la búsqueda estática acota localidades a la provincia seleccionada',async()=>{
 const candidates=[
  {name:'San Isidro',label:'San Isidro · Segovia',province:'Segovia',longitude:-4.3,latitude:40.8},
  {name:'San Isidro',label:'San Isidro · Madrid',province:'Madrid',longitude:-3.7,latitude:40.4},
 ];
 const shards=shardPlaces(candidates);
 const fetchData=createStaticDataFetch({fetchImpl:async(url:string|URL|Request)=>url==='/data/place-shards/sa.json'?new Response(JSON.stringify(shards.get('sa'))):new Response('',{status:404})});
 const result=await(await fetchData('/api/places?q=san&province=Segovia')).json();
 assert.equal(result.places.length,1);
 assert.equal(result.places[0].province,'Segovia');
});

test('la búsqueda estática combina duplicados postales sin ocultar otros lugares',async()=>{
 const coslada={id:'city-coslada',name:'Coslada',label:'Coslada · Madrid (28821, 28822, 28823)',province:'Madrid',municipality:'Coslada',postalCodes:['28821','28822','28823'],latitude:40.42378,longitude:-3.56129,precision:'locality',sourceUrl:'https://www.geonames.org/3124408'};
 const postal={id:'postal-coslada',name:'Coslada',label:'Coslada · Madrid (28820)',province:'Madrid',municipality:'',postalCodes:['28820'],latitude:40.4238,longitude:-3.5613,precision:'postal_locality',sourceUrl:'https://example.test/postal-coslada'};
 const neighborhood={id:'coslada-norte',name:'Coslada Norte',label:'Coslada Norte · Madrid (28823)',province:'Madrid',municipality:'Coslada',postalCodes:['28823'],latitude:40.43,longitude:-3.56,precision:'locality',sourceUrl:'https://example.test/coslada-norte'};
 const shards=shardPlaces([coslada,postal,neighborhood]);
 const fetchData=createStaticDataFetch({fetchImpl:async(url:string|URL|Request)=>url==='/data/place-shards/co.json'?new Response(JSON.stringify(shards.get('co'))):new Response('',{status:404})});
 const result=await(await fetchData('/api/places?q=Coslada')).json();
 const cosladaOptions=result.places.filter((place:{name:string})=>place.name.startsWith('Coslada'));
 assert.equal(cosladaOptions.length,2);
 assert.deepEqual(cosladaOptions.find((place:{id:string})=>place.id==='city-coslada')?.postalCodes,['28820','28821','28822','28823']);
 assert.ok(cosladaOptions.some((place:{id:string})=>place.id==='coslada-norte'));
});

test('la búsqueda estática prioriza la ciudad de Ávila y presenta su ubicación completa',async()=>{
 const postal={id:'postal-avila-mediana',name:'Avila',label:'Avila · Mediana de Voltoya, Ávila (05194)',province:'Ávila',municipality:'Mediana de Voltoya',postalCodes:['05194'],latitude:40.69,longitude:-4.60,precision:'postal_locality'};
 const city={id:'city-avila',name:'Ávila',label:'Ávila (05001)',province:'Ávila',municipality:'Ávila',postalCodes:['05001'],latitude:40.65,longitude:-4.69,precision:'locality'};
 const shards=shardPlaces([postal,city]);
 const fetchData=createStaticDataFetch({fetchImpl:async(url:string|URL|Request)=>url==='/data/place-shards/av.json'?new Response(JSON.stringify(shards.get('av'))):new Response('',{status:404})});
 const result=await(await fetchData('/api/places?q=avila')).json();
 assert.equal(result.places[0]?.id,'city-avila');
 assert.equal(result.places[0]?.label,'Ávila — Castilla y León / CP 05001');
});

test('el catálogo estático devuelve solo ofertas del área y conserva el detalle original', async () => {
  let catalogLoads=0;
  const fetchImpl=async (url:string|URL|Request) => {
    if(url==='/data/calls.json') {catalogLoads++;return new Response(JSON.stringify(catalog));}
    if(url==='/data/place-shards/sa.json') return new Response(JSON.stringify(places.slice(0,1)));
    return new Response('',{status:404});
  };
  const fetchData=createStaticDataFetch({fetchImpl});
  const result=await (await fetchData('/api/jobs?bounds=-4.5,40.6,-4,40.9')).json();
  assert.equal(result.total,1);
  assert.equal(result.jobs[0].id,'segovia-1');
  assert.equal(result.jobs[0].dateKind,'observed');
  assert.equal(result.jobs[0].checkedAt,'2026-10-23T09:00:00Z');
  assert.equal(result.jobs[0].paragraphs,undefined);
  assert.deepEqual(result.mapJobs.map((item:{id:string})=>item.id),['segovia-1']);
  assert.deepEqual(
    {
      sourceId:result.mapJobs[0].sourceId,
      sourceUrl:result.mapJobs[0].sourceUrl,
      province:result.mapJobs[0].province,
      category:result.mapJobs[0].category,
      categoryLabel:result.mapJobs[0].categoryLabel,
      places:result.mapJobs[0].places,
      publishedAt:result.mapJobs[0].publishedAt,
      dateKind:result.mapJobs[0].dateKind,
      checkedAt:result.mapJobs[0].checkedAt,
      salary:result.mapJobs[0].salary,
    },
    {
      sourceId:'ecyl-castilla-leon',
      sourceUrl:'https://example.com/segovia-1',
      province:'Segovia',
      category:'industria',
      categoryLabel:'Industria',
      places:1,
      publishedAt:'2026-10-20',
      dateKind:'observed',
      checkedAt:'2026-10-23T09:00:00Z',
      salary:null,
    },
  );
  assert.equal(result.mapJobs[0].paragraphs,undefined);
  assert.equal(result.checkedAt,catalog.checkedAt);
  const detail=await (await fetchData('/api/job?id=segovia-1')).json();
  assert.deepEqual(detail.paragraphs,['Texto original']);
  const localities=await (await fetchData('/api/places?q=San%20Isidro')).json();
  assert.equal(localities.places[0].name,'Coto de San Isidro');
  assert.equal(catalogLoads,1);
});

test('el total nacional no cambia al activar el mapa y distingue ofertas sin punto', async () => {
  const data={checkedAt:catalog.checkedAt,calls:[
    jobs[0],jobs[1],
    {...jobs[0],id:'sin-punto',title:'Operario rural',location:null},
  ]};
  const fetchData=createStaticDataFetch({fetchImpl:async()=>new Response(JSON.stringify(data))});
  const scoped=await (await fetchData('/api/jobs?bounds=-4.5,40.6,-4,40.9')).json();
  assert.equal(scoped.total,1);
  assert.equal(scoped.catalogTotal,3);
  assert.equal(scoped.catalogMappedTotal,2);
  assert.deepEqual(scoped.mapJobs.map((item:{id:string})=>item.id),['segovia-1']);
  const unbounded=await (await fetchData('/api/jobs')).json();
  assert.equal(unbounded.catalogTotal,3);
  assert.equal(unbounded.catalogMappedTotal,2);
  const filtered=await (await fetchData('/api/jobs?q=Operario&bounds=-4.5,40.6,-4,40.9')).json();
  assert.equal(filtered.catalogTotal,2);
  assert.equal(filtered.catalogMappedTotal,1);
});
test('el catálogo estático cuenta y filtra ofertas del día sin usar la última visita',async()=>{
 const data={checkedAt:'2026-10-22',calls:[
  {...jobs[0],id:'old',publishedAt:'2026-10-01'},
  {...jobs[0],id:'checked-today',publishedAt:'2026-10-20',checkedAt:'2026-10-21T09:00:00Z'},
  {...jobs[0],id:'today-observed',publishedAt:'2026-10-21',dateKind:'observed'},
  {...jobs[0],id:'today-published',publishedAt:'2026-10-21',dateKind:undefined},
 ]};
 const fetchData=createStaticDataFetch({fetchImpl:async()=>new Response(JSON.stringify(data))});
 const all=await(await fetchData('/api/jobs?day=2026-10-21')).json();
 assert.equal(all.total,4);assert.equal(all.todayTotal,2);
 const today=await(await fetchData('/api/jobs?day=2026-10-21&onlyToday=1')).json();
 assert.equal(today.total,2);
 assert.deepEqual(today.jobs.map((item:{id:string})=>item.id),['today-observed','today-published']);
 assert.deepEqual(today.mapJobs.map((item:{id:string})=>item.id),['today-observed','today-published']);
 await assert.rejects(fetchData('/api/jobs?onlyToday=1'),/día/i);
 await assert.rejects(fetchData('/api/jobs?day=2026-02-31'),/día/i);
});

test('el filtro de empresa agrupa McDonald’s y presenta DIA sin coincidencias de Jandía', async () => {
  const companyCatalog={checkedAt:catalog.checkedAt,calls:[
    {...jobs[0],id:'dia-1',employer:'DIA',title:'Cajero en Ávila'},
    {...jobs[0],id:'melia-1',employer:'Meliá Hotels International',title:'Recepcionista en Jandía'},
    {...jobs[0],id:'mcd-1',employer:"McDonald's Parets",title:'Cajero'},
    {...jobs[0],id:'mcd-2',employer:'McDonald´s Sabadell',title:'Encargado'},
    {...jobs[0],id:'mcd-3',employer:"McDonald`s Moncada",title:'Personal de equipo'},
    {...jobs[0],id:'mchire',employer:'McHire',title:'Personal de equipo'},
    {...jobs[0],id:'mcd-publisher-1',sourceId:'talentclue-mcdonalds',employer:'AGUSTÍN SOLER DRÓPEZ',title:"McDonald's Lleida Nord"},
    {...jobs[0],id:'mcd-publisher-2',sourceId:'talentclue-mcdonalds',employer:'MONICA SANCHEZ',title:"McDonald's Zubiarte"},
    {...jobs[0],id:'person-other-source',sourceId:'boe',employer:'MONICA SANCHEZ',title:'Publicación ajena'},
    {...jobs[0],id:'randstad-1',employer:'Randstad Digital',title:'Consultor'},
    {...jobs[0],id:'randstad-2',employer:'Randstad Trabajo Temporal',title:'Operario'},
  ]};
  const fetchData=createStaticDataFetch({fetchImpl:async()=>new Response(JSON.stringify(companyCatalog))});
  const result=await (await fetchData('/api/jobs?employer=dia')).json();
  assert.equal(result.total,1);
  assert.equal(result.jobs[0].id,'dia-1');
  assert.deepEqual(result.facets.employers.find((item:{id:string})=>item.id==='mcdonalds'),{id:'mcdonalds',label:'McDonald’s'});
  assert.deepEqual(result.facets.employers.find((item:{id:string})=>item.id==='randstad'),{id:'randstad',label:'Randstad'});
  assert.equal(result.facets.employers.filter((item:{id:string;label:string})=>item.label.startsWith('Randstad')).length,1);
  assert.equal(result.facets.employers.some((item:{id:string})=>item.id==='mchire'),false);
  assert.equal(result.facets.employers.some((item:{id:string})=>item.id==='agustin-soler-dropez'),false);
  assert.equal(result.facets.employers.find((item:{id:string})=>item.id==='monica-sanchez')?.label,'MONICA SANCHEZ');
  const mcdonalds=await (await fetchData('/api/jobs?employer=mcdonalds')).json();
  assert.deepEqual(mcdonalds.jobs.map((job:{id:string})=>job.id),['mcd-1','mcd-2','mcd-3','mchire','mcd-publisher-1','mcd-publisher-2']);
  assert.equal(mcdonalds.jobs.find((job:{id:string})=>job.id==='mchire')?.employer,'McHire');
  const randstad=await (await fetchData('/api/jobs?employer=randstad')).json();
  assert.deepEqual(randstad.jobs.map((job:{id:string})=>job.id),['randstad-1','randstad-2']);
  assert.equal(randstad.jobs.find((job:{id:string})=>job.id==='randstad-1')?.employer,'Randstad Digital');
});

test('la entrega estática conserva todos los puntos del área aunque limite la lista', async () => {
  const many={checkedAt:catalog.checkedAt,calls:Array.from({length:350},(_,index)=>({...jobs[0],id:`segovia-${index}`}))};
  const fetchData=createStaticDataFetch({fetchImpl:async () => new Response(JSON.stringify(many))});
  const result=await (await fetchData('/api/jobs?bounds=-4.5,40.6,-4,40.9')).json();
  assert.equal(result.jobs.length,300);
  assert.equal(result.mapJobs.length,350);
  assert.equal(result.truncated,true);
});

test('si falla una descarga no se guarda un catálogo vacío como éxito', async () => {
  let attempts=0;
  const fetchData=createStaticDataFetch({fetchImpl:async () => {
    attempts++;
    return attempts===1?new Response('',{status:503}):new Response(JSON.stringify(catalog));
  }});
  await assert.rejects(()=>fetchData('/api/jobs'));
  assert.equal((await (await fetchData('/api/jobs')).json()).total,2);
  assert.equal(attempts,2);
});

for(const includePublishLink of [true,false])test(`el despliegue estático publica búsqueda y localidades, sin ofrecer un formulario inoperante (enlace publicar ${includePublishLink?'presente':'ausente'})`, async () => {
  const root=await mkdtemp(join(tmpdir(),'geoempleo-static-'));
  const source=join(root,'public');
  await mkdir(join(source,'data'),{recursive:true});
  await writeFile(join(source,'index.html'),`<html lang="es"><script nonce="__CSP_NONCE__" src="/app.mjs"></script>${includePublishLink?'<a href="/publicar">Publicar oferta</a>':''}</html>`);
  await writeFile(join(source,'privacy.html'),'<html lang="es">Política de privacidad</html>');
  await writeFile(join(source,'publish.html'),'No se debe publicar');
  await writeFile(join(source,'manage.html'),'No se debe publicar');
  await writeFile(join(source,'app.mjs'),'export {};');
  await writeFile(join(source,'data','calls.json'),JSON.stringify(catalog));
  const placesPath=join(root,'places.json.gz');
  await writeFile(placesPath,gzipSync(JSON.stringify({places})));
  const output=join(root,'hosting');
  await buildStaticSite({sourceDir:source,placesGzipPath:placesPath,outputDir:output,config:{googleMapsApiKey:'key-restricted',googleMapsMapId:'DEMO_MAP_ID'}});
  const html=await readFile(join(output,'index.html'),'utf8');
  assert.match(html,/data-delivery="static"/);
  assert.doesNotMatch(html,/href="\/publicar"|__CSP_NONCE__/);
  assert.doesNotMatch(html,/Publicación próximamente|Publicación directa próximamente/);
  await assert.rejects(readFile(join(output,'publish.html')));
  await assert.rejects(readFile(join(output,'manage.html')));
  assert.equal(await readFile(join(output,'privacy.html'),'utf8'),'<html lang="es">Política de privacidad</html>');
  assert.equal(JSON.parse(await readFile(join(output,'data','place-shards','sa.json'),'utf8'))[0].name,'Coto de San Isidro');
  const publicConfig=JSON.parse(await readFile(join(output,'config.json'),'utf8'));
  assert.equal(publicConfig.googleMapsApiKey,'key-restricted');
  assert.deepEqual(publicConfig.adsense,{enabled:false});
  await assert.rejects(readFile(join(output,'ads.txt')));
});

test('AdSense publica ads.txt solo con un editor real y mantiene el bloque apagado',async()=>{
  const root=await mkdtemp(join(tmpdir(),'geoempleo-adsense-'));
  const source=join(root,'public');
  await mkdir(join(source,'data'),{recursive:true});
  await writeFile(join(source,'index.html'),'<html lang="es"><a href="/publicar">Publicar oferta</a></html>');
  await writeFile(join(source,'privacy.html'),'<html lang="es"></html>');
  await writeFile(join(source,'data','calls.json'),JSON.stringify(catalog));
  const placesPath=join(root,'places.json.gz');
  await writeFile(placesPath,gzipSync(JSON.stringify({places})));
  const output=join(root,'hosting');
  await buildStaticSite({sourceDir:source,placesGzipPath:placesPath,outputDir:output,config:{googleMapsApiKey:'key-restricted',adsense:{enabled:false,publisherId:'ca-pub-1234567890123456'}}});
  assert.equal(await readFile(join(output,'ads.txt'),'utf8'),'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  assert.deepEqual(JSON.parse(await readFile(join(output,'config.json'),'utf8')).adsense,{enabled:false,publisherId:'ca-pub-1234567890123456'});
});

test('Firebase comparte solo el origen en solicitudes de terceros para la CMP europea',async()=>{
  const firebase=JSON.parse(await readFile(new URL('../firebase.json',import.meta.url),'utf8'));
  const hostingHeaders=firebase.hosting.headers.find((rule:{source:string})=>rule.source==='**').headers;
  assert.equal(hostingHeaders.find((header:{key:string})=>header.key==='Referrer-Policy')?.value,'strict-origin-when-cross-origin');
});

test('Hosting permite cargar la etiqueta oficial de Analytics',async()=>{
  const firebase=JSON.parse(await readFile(new URL('../firebase.json',import.meta.url),'utf8'));
  const headers=firebase.hosting.headers.find((rule:{source:string})=>rule.source==='**').headers;
  const csp=headers.find((header:{key:string})=>header.key==='Content-Security-Policy')?.value??'';
  const scriptSources=csp.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1]?.split(/\s+/)??[];
  assert.ok(scriptSources.includes('https://www.googletagmanager.com'));
});

test('un fallo del mapa no invalida los resultados reales ya cargados', () => {
  let failed=false;
  assert.equal(updateMapWithoutLosingJobs({update(){throw new Error('Maps quota');}},jobs,null,null,()=>{failed=true;}),false);
  assert.equal(failed,true);
});
