import type {PublicCatalog,PublicJob} from './model.ts';
import {dateInSpain} from './normalize.ts';
export interface ReconcilePolicy {missingRetentionDays?:number;retainMissingUntilClosingDate?:boolean;supersededSourceIds?:readonly string[]}

function retainMissing(job:PublicJob,today:string,checkedAt:string,policy:ReconcilePolicy):boolean {
  if(job.closingDate!==null&&policy.retainMissingUntilClosingDate!==false) return job.closingDate>=today;
  if(policy.missingRetentionDays===undefined) return true;
  if(!Number.isInteger(policy.missingRetentionDays)||policy.missingRetentionDays<0) throw new TypeError('Retención de ausentes inválida');
  const previous=Date.parse(job.checkedAt),current=Date.parse(checkedAt);
  if(!Number.isFinite(previous)||!Number.isFinite(current)) throw new TypeError('Fecha de comprobación inválida');
  return current-previous<=policy.missingRetentionDays*86_400_000;
}
/** Missing jobs retain their last observation until explicit expiry; outages never close them. */
export function reconcileSource(catalog:PublicCatalog,sourceId:string,incoming:PublicJob[],checkedAt:string,policy:ReconcilePolicy={}):PublicCatalog {
  if(!incoming.length) throw new Error('Captura vacía: se conserva el catálogo anterior');
  const today=dateInSpain(checkedAt);
  const identities=new Set<string>();
  for(const job of incoming) {
    if(job.sourceId!==sourceId || !job.id || identities.has(job.id)) throw new TypeError('Identidad o fuente de oferta inválida');
    identities.add(job.id);
  }
  const superseded=new Set(policy.supersededSourceIds??[]);
  if(superseded.has(sourceId)||[...superseded].some(id=>!id))throw new TypeError('Fuente sustituida inválida');
  const retained=catalog.calls.filter(job=>!superseded.has(job.sourceId)&&
    (job.sourceId!==sourceId || (!identities.has(job.id) && retainMissing(job,today,checkedAt,policy))));
  const previousById=new Map(catalog.calls.filter(job=>job.sourceId===sourceId).map(job=>[job.id,job]));
  const current=incoming.map(job=>{
    const previous=previousById.get(job.id);
    return job.dateKind==='observed'&&previous?.dateKind==='observed'
      ? {...job,publishedAt:previous.publishedAt}:job;
  });
  const calls=[...retained,...current].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
  return {...catalog,checkedAt,mode:'daily_sources',publishedAt:calls[0]?.publishedAt??null,calls};
}
