import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const executable = process.env.GEOEMPLEO_PYTHON ?? fileURLToPath(new URL(
  process.platform === 'win32' ? '../../../.venv/Scripts/python.exe' : '../../../.venv/bin/python',
  import.meta.url,
));
const result = spawnSync(executable, [fileURLToPath(new URL('../python/check_fixtures.py', import.meta.url))], {
  stdio: 'inherit',
});
if (result.error) {
  console.error('No se pudo ejecutar Python. Prepara .venv según README o define GEOEMPLEO_PYTHON.');
  process.exit(1);
}
process.exit(result.status ?? 1);
