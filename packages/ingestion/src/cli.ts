import {fileURLToPath} from 'node:url';
import {runDaily} from './runner.ts';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));
try {
 const report=await runDaily({catalogPath:path('../../../apps/web-preview/public/data/calls.json'),placesPath:path('../../../apps/web-preview/public/data/places.json'),nationalPlacesPath:path('../../../apps/web-preview/data/spain-places.json.gz'),reportPath:path('../../../var/ingestion/latest.json')});
 console.log(`${report.status.toUpperCase()}: catálogo ${report.published}`);
 for(const source of report.sources) console.log(`${source.sourceId}: ${source.status}, ${source.received} ofertas, ${source.mapped} con ubicación${source.reason?`, ${source.reason}`:''}`);
}catch {console.error('La ingesta no terminó correctamente. Consulta var/ingestion/latest.json; revisa la fuente antes de reintentar.');process.exitCode=1;}
