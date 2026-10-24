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
  {id:'segovia-1',title:'Operario rural',employer:'Empresa real',city:'Villacastín',province:'Segovia',region:'Castilla y León',category:'industria',categoryLabel:'Industria',source:'ECYL',sourceId:'ecyl-castilla-leon',location:point(-4.1,40.7),paragraphs:['Texto original']},
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
  assert.equal(result.jobs[0].paragraphs,undefined);
  assert.deepEqual(result.mapJobs.map((item:{id:string})=>item.id),['segovia-1']);
  assert.equal(result.checkedAt,catalog.checkedAt);
  const detail=await (await fetchData('/api/job?id=segovia-1')).json();
  assert.deepEqual(detail.paragraphs,['Texto original']);
  const localities=await (await fetchData('/api/places?q=San%20Isidro')).json();
  assert.equal(localities.places[0].name,'Coto de San Isidro');
  assert.equal(catalogLoads,1);
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

test('el despliegue estático publica búsqueda y localidades, sin ofrecer un formulario inoperante', async () => {
  const root=await mkdtemp(join(tmpdir(),'geoempleo-static-'));
  const source=join(root,'public');
  await mkdir(join(source,'data'),{recursive:true});
  await writeFile(join(source,'index.html'),'<html lang="es"><script nonce="__CSP_NONCE__" src="/app.mjs"></script><a href="/publicar">Publicar oferta</a></html>');
  await writeFile(join(source,'publish.html'),'No se debe publicar');
  await writeFile(join(source,'app.mjs'),'export {};');
  await writeFile(join(source,'data','calls.json'),JSON.stringify(catalog));
  const placesPath=join(root,'places.json.gz');
  await writeFile(placesPath,gzipSync(JSON.stringify({places})));
  const output=join(root,'hosting');
  await buildStaticSite({sourceDir:source,placesGzipPath:placesPath,outputDir:output,config:{googleMapsApiKey:'key-restricted',googleMapsMapId:'DEMO_MAP_ID'}});
  const html=await readFile(join(output,'index.html'),'utf8');
  assert.match(html,/data-delivery="static"/);
  assert.doesNotMatch(html,/href="\/publicar"|__CSP_NONCE__/);
  assert.rejects(readFile(join(output,'publish.html')));
  assert.equal(JSON.parse(await readFile(join(output,'data','place-shards','sa.json'),'utf8'))[0].name,'Coto de San Isidro');
  assert.equal(JSON.parse(await readFile(join(output,'config.json'),'utf8')).googleMapsApiKey,'key-restricted');
});

test('un fallo del mapa no invalida los resultados reales ya cargados', () => {
  let failed=false;
  assert.equal(updateMapWithoutLosingJobs({update(){throw new Error('Maps quota');}},jobs,null,null,()=>{failed=true;}),false);
  assert.equal(failed,true);
});
