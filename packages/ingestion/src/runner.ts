import {readFile,mkdir,open,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {adaptCylOffers} from './connectors/cyl.ts';
import {adaptLanbideOffers} from './connectors/lanbide.ts';
import {adaptMurciaOffers} from './connectors/murcia.ts';
import {reconcileSource} from './catalog.ts';
import {createPlaceResolver,type PlaceResolver} from './geography.ts';
import {fetchJson,type JsonEncoding} from './http.ts';
import {createNationalPlaceResolver,loadNationalGazetteer} from './national-geography.ts';
import {sourceRegistry} from './registry.ts';
import {writeJsonAtomic} from './storage.ts';
import type {PublicCatalog,PublicJob} from './model.ts';

const implementedSourceIds=['sef-murcia','ecyl-castilla-leon','lanbide-euskadi'] as const;
type ImplementedSourceId=typeof implementedSourceIds[number];
export interface SourceRunReport {sourceId:string;status:'success'|'failed';received:number;mapped:number;reason:string|null}
export interface RunOptions {catalogPath:string;placesPath:string;nationalPlacesPath?:string;reportPath:string;sourceIds?:readonly string[];checkedAt?:string;fetchImpl?:typeof fetch}

function isImplementedSourceId(sourceId:string):sourceId is ImplementedSourceId {
  return (implementedSourceIds as readonly string[]).includes(sourceId);
}

async function loadMurciaResolver(placesPath:string):Promise<PlaceResolver> {
  const places=JSON.parse(await readFile(placesPath,'utf8')) as {places?:unknown};
  if(!Array.isArray(places.places)) throw new TypeError('Geografía local inválida');
  return createPlaceResolver(places.places);
}

async function loadNationalResolver(path:string|undefined):Promise<PlaceResolver> {
  if(!path) throw new TypeError('Ruta de geografía nacional requerida');
  return createNationalPlaceResolver((await loadNationalGazetteer(path)).places);
}

function adaptSource(sourceId:ImplementedSourceId,input:unknown,checkedAt:string,resolve:PlaceResolver):PublicJob[] {
  if(sourceId==='sef-murcia') return adaptMurciaOffers(input,checkedAt,resolve);
  if(sourceId==='ecyl-castilla-leon') return adaptCylOffers(input,checkedAt,resolve);
  return adaptLanbideOffers(input,checkedAt,resolve);
}

function encodingFor(sourceId:ImplementedSourceId):JsonEncoding {
  return sourceId==='lanbide-euskadi'?'windows-1252':'utf-8';
}

export async function runDaily(options:RunOptions) {
  const {catalogPath,placesPath,reportPath}=options;
  const checkedAt=options.checkedAt??new Date().toISOString();
  await mkdir(dirname(reportPath),{recursive:true});
  let lock;
  try {lock=await open(reportPath+'.lock','wx',0o600);}
  catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST') throw new Error('Ya hay una ejecución de ingesta en curso');throw error;}
  let failedReportWritten=false;
  try {
    const catalog=JSON.parse(await readFile(catalogPath,'utf8')) as PublicCatalog;
    if(!Array.isArray(catalog.calls)) throw new TypeError('Catálogo local inválido');
    const sourceIds=options.sourceIds??implementedSourceIds;
    const needsMurcia=sourceIds.includes('sef-murcia');
    const needsNational=sourceIds.some(sourceId=>sourceId==='ecyl-castilla-leon'||sourceId==='lanbide-euskadi');
    const [murciaResolver,nationalResolver]=await Promise.allSettled([
      needsMurcia?loadMurciaResolver(placesPath):Promise.resolve(null),
      needsNational?loadNationalResolver(options.nationalPlacesPath):Promise.resolve(null),
    ]);
    const sources:SourceRunReport[]=[];
    let next=catalog;
    let successes=0;
    for(const sourceId of sourceIds) {
      const source=sourceRegistry.get(sourceId);
      if(!source?.endpoint||source.status!=='active'||!isImplementedSourceId(sourceId)) {
        sources.push({sourceId,status:'failed',received:0,mapped:0,reason:'source_unavailable'});
        continue;
      }
      try {
        const resolverResult=sourceId==='sef-murcia'?murciaResolver:nationalResolver;
        if(resolverResult.status==='rejected'||resolverResult.value===null) throw new TypeError('Geografía no disponible');
        const input=await fetchJson(source.endpoint,{fetchImpl:options.fetchImpl,encoding:encodingFor(sourceId)});
        const jobs=adaptSource(sourceId,input,checkedAt,resolverResult.value);
        next=reconcileSource(next,sourceId,jobs,checkedAt,sourceId==='sef-murcia'?{}:{missingRetentionDays:7});
        sources.push({sourceId,status:'success',received:jobs.length,mapped:jobs.filter(job=>job.location!==null).length,reason:null});
        successes+=1;
      } catch {
        sources.push({sourceId,status:'failed',received:0,mapped:0,reason:'source_fetch_or_validation_failed'});
      }
    }
    if(successes===0) {
      const report={status:'failed' as const,checkedAt,sources,published:catalog.calls.length};
      await writeJsonAtomic(reportPath,report);
      failedReportWritten=true;
      throw new Error('Todas las fuentes de ingesta fallaron');
    }
    await writeJsonAtomic(catalogPath,next);
    const status=successes===sources.length?'success' as const:'partial' as const;
    const legacy=sources.length===1?{sourceId:sources[0]?.sourceId,received:sources[0]?.received,mapped:sources[0]?.mapped}:{};
    const report={status,checkedAt,sources,published:next.calls.length,...legacy};
    await writeJsonAtomic(reportPath,report);
    return report;
  }catch(error){
    if(!failedReportWritten) await writeJsonAtomic(reportPath,{status:'failed',checkedAt,sources:[],reason:'catalog_or_publication_failed'});
    throw error;
  }finally {await lock.close();await rm(reportPath+'.lock',{force:true});}
}
