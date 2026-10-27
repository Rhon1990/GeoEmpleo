import {appendFile,rename,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateCatalog} from './validate-daily-catalog.mjs';

const catalogUrl='https://geoempleo-49978.web.app/data/calls.json';
const madridDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});

export async function prepareDailyRefresh({catalogPath,now=Date.now(),force=false,fetchImpl=fetch}) {
  const response=await fetchImpl(`${catalogUrl}?refreshCheck=${now}`,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error(`No se pudo recuperar el catálogo publicado: HTTP ${response.status}`);
  const catalog=validateCatalog(await response.json());
  const checkedAt=Date.parse(catalog.checkedAt);
  if(!Number.isFinite(checkedAt)||checkedAt>now+300_000)throw new TypeError('Fecha del catálogo publicado inválida');
  if(!catalog.calls.length)throw new TypeError('El catálogo publicado está vacío');
  const required=force||madridDate.format(checkedAt)!==madridDate.format(now);
  if(required) {
    const temporary=`${catalogPath}.refresh.tmp`;
    await writeFile(temporary,JSON.stringify(catalog));
    await rename(temporary,catalogPath);
  }
  return {required,checkedAt:catalog.checkedAt,offers:catalog.calls.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const result=await prepareDailyRefresh({catalogPath:'apps/web-preview/public/data/calls.json',force:process.env.GITHUB_EVENT_NAME==='workflow_dispatch'});
    if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`required=${result.required}\n`);
    const message=result.required?`Se actualizará desde el último catálogo público: ${result.offers} ofertas; ${result.checkedAt}.`:`El catálogo público ya está actualizado hoy: ${result.checkedAt}. Se omite la captura de respaldo.`;
    console.log(message);
    if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`${message}\n`);
  } catch(error) {
    console.error(`Preparación fallida; se conserva la web pública: ${error.message}`);
    process.exitCode=1;
  }
}
