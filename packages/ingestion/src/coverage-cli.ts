import {readFile} from 'node:fs/promises';
import {buildCoverageReport} from './coverage.ts';

const catalogUrl=new URL('../../../apps/web-preview/public/data/calls.json',import.meta.url);
try {
  const report=buildCoverageReport(JSON.parse(await readFile(catalogUrl,'utf8')));
  console.log(JSON.stringify(report,null,2));
} catch(error) {
  console.error(`No se pudo comprobar la cobertura: ${error instanceof Error?error.message:'catálogo inválido'}`);
  process.exitCode=1;
}
