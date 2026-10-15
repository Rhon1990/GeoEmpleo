import {fileURLToPath} from 'node:url';
import {runDaily} from './runner.ts';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));
try {
 const report=await runDaily({catalogPath:path('../../../apps/web-preview/public/data/calls.json'),placesPath:path('../../../apps/web-preview/public/data/places.json'),reportPath:path('../../../var/ingestion/latest.json')});
 console.log(`OK ${report.sourceId}: ${report.received} ofertas activas, ${report.mapped} con ubicación; catálogo ${report.published}`);
}catch {console.error('La ingesta no terminó correctamente. Consulta var/ingestion/latest.json; revisa la fuente antes de reintentar.');process.exitCode=1;}
