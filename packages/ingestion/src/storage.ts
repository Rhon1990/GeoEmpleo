import {mkdir,rename,writeFile,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
export async function writeJsonAtomic(path:string,value:unknown):Promise<void> {
  const serialized=`${JSON.stringify(value,null,2)}\n`;
  await mkdir(dirname(path),{recursive:true});
  const temporary=`${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary,serialized,{encoding:'utf8',mode:0o644,flag:'wx'});
    await rename(temporary,path);
  } finally {await rm(temporary,{force:true});}
}
