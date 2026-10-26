import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {basename,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {shardPlaces} from '../apps/web-preview/public/static-data.mjs';
import {publicAdSenseConfig,publicMapConfig} from '../apps/web-preview/config.mjs';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const excluded=new Set(['publish.html','publish.mjs','manage.html','manage.mjs','submission.css']);

export async function buildStaticSite({sourceDir,placesGzipPath,outputDir,config}) {
  if(resolve(outputDir)===resolve(sourceDir)||resolve(sourceDir).startsWith(resolve(outputDir)+'/'))throw new TypeError('Destino de publicación inválido');
  const catalog=JSON.parse(await readFile(join(sourceDir,'data','calls.json'),'utf8'));
  if(!Array.isArray(catalog.calls)||!catalog.checkedAt||new Set(catalog.calls.map(job=>job.id)).size!==catalog.calls.length)throw new TypeError('Catálogo público inválido');
  const {places}=JSON.parse(gunzipSync(await readFile(placesGzipPath)).toString('utf8'));
  if(!Array.isArray(places)||places.length===0)throw new TypeError('Localidades nacionales inválidas');
  if(!config?.googleMapsApiKey)throw new TypeError('La clave restringida de Google Maps es necesaria para publicar el mapa');
  const analyticsConfigPath=join(projectRoot,'apps','web-preview','firebase-web-config.json');
  let analyticsConfig=null;
  try{analyticsConfig=JSON.parse(await readFile(analyticsConfigPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  await rm(outputDir,{recursive:true,force:true});
  await cp(sourceDir,outputDir,{recursive:true,filter:path=>!excluded.has(basename(path))});
  const indexPath=join(outputDir,'index.html');
  const index=await readFile(indexPath,'utf8');
  if(!index.includes('<html lang="es">')||!index.includes('href="/publicar"'))throw new TypeError('Estructura de la página no reconocida');
  await writeFile(indexPath,index.replace('<html lang="es">','<html lang="es" data-delivery="static">').replace(/ nonce="__CSP_NONCE__"/g,'').replace('<a href="/publicar">Publicar oferta</a>','').replaceAll('El área visible se consulta al servidor','El área visible filtra el catálogo'));
  const publisherId=config?.adsense?.publisherId;
  const slotId=config?.adsense?.slotId;
  const validPublisher=typeof publisherId==='string'&&/^ca-pub-\d{16}$/.test(publisherId);
  const enabled=config?.adsense?.enabled===true&&validPublisher&&typeof slotId==='string'&&/^\d{6,20}$/.test(slotId);
  const adsense={enabled,...(validPublisher?{publisherId}:{}),...(enabled?{slotId}:{})};
  const publicConfig={...config,adsense};
  await writeFile(join(outputDir,'config.json'),JSON.stringify(analyticsConfig?{...publicConfig,firebaseAnalytics:analyticsConfig}:publicConfig));
  const adsTxtPath=join(outputDir,'ads.txt');
  if(validPublisher)await writeFile(adsTxtPath,`google.com, ${publisherId.replace(/^ca-/,'')}, DIRECT, f08c47fec0942fa0\n`);
  else await rm(adsTxtPath,{force:true});
  const shardDir=join(outputDir,'data','place-shards');
  await mkdir(shardDir,{recursive:true});
  const shards=shardPlaces(places);
  await Promise.all([...shards].map(([key,items])=>writeFile(join(shardDir,`${key}.json`),JSON.stringify(items))));
  return {jobs:catalog.calls.length,places:places.length,shards:shards.size,checkedAt:catalog.checkedAt};
}

if(import.meta.main) {
  const envFile=process.env.GEOEMPLEO_ENV_FILE||join(projectRoot,'.env.local');
  const environment={...parseEnv(await readFile(envFile,'utf8')),...process.env};
  const summary=await buildStaticSite({
    sourceDir:join(projectRoot,'apps','web-preview','public'),
    placesGzipPath:join(projectRoot,'apps','web-preview','data','spain-places.json.gz'),
    outputDir:join(projectRoot,'var','public-site'),
    config:{...publicMapConfig(environment),adsense:publicAdSenseConfig(environment)},
  });
  console.log(`Sitio listo: ${summary.jobs} ofertas reales, ${summary.places} localidades, ${summary.shards} archivos de consulta; catálogo ${summary.checkedAt}`);
}
