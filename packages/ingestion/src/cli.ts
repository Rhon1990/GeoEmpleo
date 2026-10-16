import {fileURLToPath} from 'node:url';
import {formatRunReportLines,runDaily,type RunOptions,type RunReportSummary} from './runner.ts';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));

export async function runCli(
 run:(options:RunOptions)=>Promise<RunReportSummary>=runDaily,
 output:Pick<Console,'log'|'error'>=console,
):Promise<number> {
 try {
  const report=await run({catalogPath:path('../../../apps/web-preview/public/data/calls.json'),placesPath:path('../../../apps/web-preview/public/data/places.json'),nationalPlacesPath:path('../../../apps/web-preview/data/spain-places.json.gz'),reportPath:path('../../../var/ingestion/latest.json')});
  for(const line of formatRunReportLines(report)) output.log(line);
  return report.status==='success'?0:1;
 }catch {
  output.error('La ingesta no terminó correctamente. Consulta var/ingestion/latest.json; revisa la fuente antes de reintentar.');
  return 1;
 }
}

if(import.meta.main) process.exitCode=await runCli();
