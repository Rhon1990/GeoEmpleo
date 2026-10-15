import type {PublicCatalog,PublicJob} from './model.ts';
import {dateInSpain} from './normalize.ts';
/** Missing jobs retain their last observation until explicit expiry; outages never close them. */
export function reconcileSource(catalog:PublicCatalog,sourceId:string,incoming:PublicJob[],checkedAt:string):PublicCatalog {
  if(!incoming.length) throw new Error('Captura vacía: se conserva el catálogo anterior');
  const today=dateInSpain(checkedAt);
  const identities=new Set<string>();
  for(const job of incoming) {
    if(job.sourceId!==sourceId || !job.id || identities.has(job.id)) throw new TypeError('Identidad o fuente de oferta inválida');
    identities.add(job.id);
  }
  const retained=catalog.calls.filter(job=>job.sourceId!==sourceId || (!identities.has(job.id) && (job.closingDate===null || job.closingDate>=today)));
  const calls=[...retained,...incoming].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
  return {...catalog,checkedAt,mode:'daily_sources',publishedAt:calls[0]?.publishedAt??null,calls};
}
