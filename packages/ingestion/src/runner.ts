import {readFile,mkdir,open,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {adaptAndaluciaOffers} from './connectors/andalucia.ts';
import {adaptCylOffers} from './connectors/cyl.ts';
import {adaptLanbideOffers} from './connectors/lanbide.ts';
import {adaptLeverOffers,leverBoards} from './connectors/lever.ts';
import {adaptMurciaOffers} from './connectors/murcia.ts';
import {bizneoBoards,fetchBizneoOffers} from './connectors/bizneo.ts';
import {adaptTalentClueListing,fetchTalentClueListing} from './connectors/talentclue.ts';
import {fetchKfcOffers} from './connectors/kfc.ts';
import {fetchDisaOffers} from './connectors/disa.ts';
import {fetchSuccessFactorsOffers} from './connectors/successfactors.ts';
import {fetchDiaOffers} from './connectors/teamtailor.ts';
import {fetchCarrefourOffers} from './connectors/carrefour.ts';
import {fetchLidlOffers} from './connectors/lidl.ts';
import {fetchQuironsaludOffers} from './connectors/quironsalud.ts';
import {fetchEulenOffers} from './connectors/eulen.ts';
import {fetchRandstadOffers} from './connectors/randstad.ts';
import {fetchCleceOffers} from './connectors/clece.ts';
import {fetchDomusViOffers} from './connectors/domusvi.ts';
import {fetchIndraOffers} from './connectors/indra.ts';
import {successFactorsBoards} from './connectors/successfactors-boards.ts';
import {reconcileSource} from './catalog.ts';
import {createPlaceResolver,type PlaceResolver} from './geography.ts';
import {fetchJson,type JsonEncoding} from './http.ts';
import {createNationalCityResolver,createNationalPlaceResolver,loadNationalGazetteer} from './national-geography.ts';
import {sourceRegistry} from './registry.ts';
import {writeJsonAtomic} from './storage.ts';
import type {PublicCatalog,PublicJob} from './model.ts';

const implementedSourceIds=['sef-murcia','ecyl-castilla-leon','lanbide-euskadi','andalucia-entidades',...leverBoards.map(board=>board.sourceId),...bizneoBoards.map(board=>board.sourceId),...successFactorsBoards.map(board=>board.sourceId),'talentclue-mcdonalds','amrest-kfc','disa-empleo','teamtailor-dia','carrefour-talentforjobs','lidl-search-api','talentclue-quironsalud','selectminds-eulen','randstad-oficial','successfactors-clece','bizneo-domusvi','successfactors-indra'] as const;
type ImplementedSourceId=string;
export interface SourceRunReport {sourceId:string;status:'success'|'failed';received:number;mapped:number;reason:string|null}
export interface RunReportSummary {status:'success'|'partial'|'failed';published:number;sources:readonly SourceRunReport[]}
export interface RunOptions {catalogPath:string;placesPath:string;nationalPlacesPath?:string;reportPath:string;sourceIds?:readonly string[];checkedAt?:string;fetchImpl?:typeof fetch}

export function formatRunReportLines(report:RunReportSummary):string[] {
  return [
    `${report.status.toUpperCase()}: catálogo ${report.published}`,
    ...report.sources.map(source=>`${source.sourceId}: ${source.status}, ${source.received} ofertas, ${source.mapped} con ubicación${source.reason?`, ${source.reason}`:''}`),
  ];
}

function isImplementedSourceId(sourceId:string):sourceId is ImplementedSourceId {
  return (implementedSourceIds as readonly string[]).includes(sourceId);
}

async function loadMurciaResolver(placesPath:string):Promise<PlaceResolver> {
  const places=JSON.parse(await readFile(placesPath,'utf8')) as {places?:unknown};
  if(!Array.isArray(places.places)) throw new TypeError('Geografía local inválida');
  return createPlaceResolver(places.places);
}

async function loadNationalResolver(path:string|undefined) {
  if(!path) throw new TypeError('Ruta de geografía nacional requerida');
  const places=(await loadNationalGazetteer(path)).places;
  return {resolve:createNationalPlaceResolver(places),resolveCity:createNationalCityResolver(places)};
}

function adaptSource(sourceId:ImplementedSourceId,input:unknown,checkedAt:string,resolve:PlaceResolver):PublicJob[] {
  const leverBoard=leverBoards.find(board=>board.sourceId===sourceId);
  if(leverBoard) return adaptLeverOffers(input,checkedAt,resolve,leverBoard);
  if(sourceId==='sef-murcia') return adaptMurciaOffers(input,checkedAt,resolve);
  if(sourceId==='ecyl-castilla-leon') return adaptCylOffers(input,checkedAt,resolve);
  if(sourceId==='andalucia-entidades') return adaptAndaluciaOffers(input,checkedAt,resolve);
  if(sourceId==='lanbide-euskadi') return adaptLanbideOffers(input,checkedAt,resolve);
  throw new TypeError('Fuente sin adaptador');
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
    const needsNational=sourceIds.some(sourceId=>sourceId!=='sef-murcia');
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
        const board=bizneoBoards.find(item=>item.sourceId===sourceId);
        const successFactorsBoard=successFactorsBoards.find(item=>item.sourceId===sourceId);
        const national=nationalResolver.status==='fulfilled'?nationalResolver.value:null;
        const jobs=board
          ? await fetchBizneoOffers(board,checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
          : successFactorsBoard
            ? await fetchSuccessFactorsOffers(successFactorsBoard,checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
          : sourceId==='talentclue-mcdonalds'
            ? adaptTalentClueListing(await fetchTalentClueListing(options.fetchImpl),checkedAt,national?.resolve??(()=>null))
            : sourceId==='amrest-kfc'
              ? await fetchKfcOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='disa-empleo'
              ? await fetchDisaOffers(checkedAt,national?.resolve??(()=>null),options.fetchImpl)
            : sourceId==='teamtailor-dia'
              ? await fetchDiaOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='carrefour-talentforjobs'
              ? await fetchCarrefourOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='lidl-search-api'
              ? await fetchLidlOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='talentclue-quironsalud'
              ? await fetchQuironsaludOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='selectminds-eulen'
              ? await fetchEulenOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='randstad-oficial'
              ? await fetchRandstadOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='successfactors-clece'
              ? await fetchCleceOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='bizneo-domusvi'
              ? await fetchDomusViOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : sourceId==='successfactors-indra'
              ? await fetchIndraOffers(checkedAt,national?.resolveCity??(()=>null),options.fetchImpl)
            : adaptSource(sourceId,await fetchJson(source.endpoint,{fetchImpl:options.fetchImpl,encoding:encodingFor(sourceId)}),checkedAt,
              sourceId==='sef-murcia'?murciaResolver.status==='fulfilled'&&murciaResolver.value!==null?murciaResolver.value:()=>null
                :national?.resolve??(()=>null));
        next=reconcileSource(next,sourceId,jobs,checkedAt,sourceId==='sef-murcia'?{}:{missingRetentionDays:source.kind==='ats'?0:7});
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
