import {readFile,mkdir,open,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {adaptMurciaOffers} from './connectors/murcia.ts';
import {reconcileSource} from './catalog.ts';
import {createPlaceResolver} from './geography.ts';
import {fetchJson} from './http.ts';
import {sourceRegistry} from './registry.ts';
import {writeJsonAtomic} from './storage.ts';
import type {PublicCatalog} from './model.ts';
export interface RunOptions {catalogPath:string;placesPath:string;reportPath:string;checkedAt?:string;fetchImpl?:typeof fetch}
export async function runDaily(options:RunOptions) {
  const {catalogPath,placesPath,reportPath}=options;
  const checkedAt=options.checkedAt??new Date().toISOString();
  await mkdir(dirname(reportPath),{recursive:true});
  let lock;
  try {lock=await open(reportPath+'.lock','wx',0o600);}
  catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST') throw new Error('Ya hay una ejecución de ingesta en curso');throw error;}
  try {
    const source=sourceRegistry.get('sef-murcia');
    if(!source?.endpoint || source.status!=='active') throw new Error('Fuente inactiva');
    const [catalogText,placesText,input]=await Promise.all([readFile(catalogPath,'utf8'),readFile(placesPath,'utf8'),fetchJson(source.endpoint,{fetchImpl:options.fetchImpl})]);
    const catalog=JSON.parse(catalogText) as PublicCatalog;
    if(!Array.isArray(catalog.calls)) throw new TypeError('Catálogo local inválido');
    const places=JSON.parse(placesText);
    if(!Array.isArray(places.places)) throw new TypeError('Geografía local inválida');
    const jobs=adaptMurciaOffers(input,checkedAt,createPlaceResolver(places.places));
    const next=reconcileSource(catalog,source.id,jobs,checkedAt);
    await writeJsonAtomic(catalogPath,next);
    const report={status:'success',checkedAt,sourceId:source.id,received:jobs.length,mapped:jobs.filter(job=>job.location).length,published:next.calls.length};
    await writeJsonAtomic(reportPath,report);
    return report;
  }catch(error){
    await writeJsonAtomic(reportPath,{status:'failed',checkedAt,sourceId:'sef-murcia',reason:'source_or_catalog_validation_failed'});
    throw error;
  }finally {await lock.close();await rm(reportPath+'.lock',{force:true});}
}
