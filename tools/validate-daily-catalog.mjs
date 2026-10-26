import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

function option(name) {
  const index=process.argv.indexOf(name);
  return index<0?undefined:process.argv[index+1];
}

function validateCatalog(catalog,expectedCheckedAt) {
  if(!catalog||!Array.isArray(catalog.calls)||typeof catalog.checkedAt!=='string')throw new TypeError('El catálogo no tiene estructura válida');
  const ids=catalog.calls.map(call=>call?.id);
  if(ids.some(id=>typeof id!=='string'||id.length===0)||new Set(ids).size!==ids.length)throw new TypeError('El catálogo contiene IDs vacíos o duplicados');
  if(expectedCheckedAt&&catalog.checkedAt!==expectedCheckedAt)throw new TypeError('El checkedAt del catálogo no coincide con la captura validada');
  return catalog;
}

export function validateDailyRun(report,catalog,startedAt,now=Date.now()) {
  if(!report||!['success','partial'].includes(report.status))throw new TypeError('La captura no es publicable');
  if(!Array.isArray(report.sources)||report.sources.length===0||!report.sources.some(source=>source.status==='success'))throw new TypeError('La captura no contiene ninguna fuente actualizada');
  if(report.sources.some(source=>!['success','failed'].includes(source.status)))throw new TypeError('El informe contiene estados de fuente desconocidos');
  const checkedAt=Date.parse(report.checkedAt);
  const started=Date.parse(startedAt);
  if(!Number.isFinite(checkedAt)||!Number.isFinite(started)||checkedAt<started-5*60_000||checkedAt>now+5*60_000)throw new TypeError('El checkedAt no corresponde a esta ejecución');
  validateCatalog(catalog,report.checkedAt);
  if(report.published!==catalog.calls.length)throw new TypeError('El recuento publicado no coincide con el catálogo');
  return {status:report.status,checkedAt:report.checkedAt,offers:catalog.calls.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const catalogPath=option('--catalog');
  const reportPath=option('--report');
  const startedAt=option('--started-at');
  const expectedCheckedAt=option('--expected-checked-at');
  const remoteUrl=option('--url');

  try {
    if(remoteUrl) {
      const response=await fetch(remoteUrl,{headers:{'cache-control':'no-cache'}});
      if(!response.ok)throw new Error(`HTTPS devolvió ${response.status}`);
      const catalog=validateCatalog(await response.json(),expectedCheckedAt);
      console.log(`Catálogo HTTPS válido: ${catalog.calls.length} ofertas; ${catalog.checkedAt}; IDs únicos.`);
    } else {
      if(!catalogPath)throw new TypeError('Falta --catalog');
      const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
      if(reportPath) {
        if(!startedAt)throw new TypeError('Falta --started-at');
        const report=JSON.parse(await readFile(reportPath,'utf8'));
        const result=validateDailyRun(report,catalog,startedAt);
        console.log(`Captura ${result.status}: ${result.offers} ofertas, checkedAt ${result.checkedAt}, IDs únicos.`);
      } else {
        validateCatalog(catalog,expectedCheckedAt);
        console.log(`Catálogo válido: ${catalog.calls.length} ofertas; ${catalog.checkedAt}; IDs únicos.`);
      }
    }
  } catch(error) {
    console.error(`Validación diaria fallida: ${error.message}`);
    process.exitCode=1;
  }
}
