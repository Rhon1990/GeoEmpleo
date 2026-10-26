import {readFile, writeFile, chmod} from 'node:fs/promises';
import {resolve} from 'node:path';

const envPath = resolve(process.argv[2] ?? '.env.local');
let key = '';

for await (const chunk of process.stdin) key += chunk;
key = key.trim();

if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(key)) {
  throw new Error('El portapapeles no contiene una clave web de Google válida.');
}

let contents = '';
try {
  contents = await readFile(envPath, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const line = `GEOEMPLEO_GOOGLE_MAPS_API_KEY=${key}`;
contents = /^GEOEMPLEO_GOOGLE_MAPS_API_KEY=.*$/m.test(contents)
  ? contents.replace(/^GEOEMPLEO_GOOGLE_MAPS_API_KEY=.*$/m, line)
  : `${contents.replace(/\s*$/, '')}${contents.trim() ? '\n' : ''}${line}\n`;

await writeFile(envPath, contents, {encoding: 'utf8', mode: 0o600});
await chmod(envPath, 0o600);
process.stdout.write('Clave local configurada sin mostrar su valor.\n');
