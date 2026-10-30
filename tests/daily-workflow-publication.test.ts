import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('la comprobación HTTPS reintenta mientras Firebase propaga el catálogo',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/daily-offers.yml',import.meta.url),'utf8');
  assert.match(workflow,/for attempt in 1 2 3 4 5 6;/);
  assert.match(workflow,/sleep 10/);
  assert.match(workflow,/if \[ "\$attempt" -eq 6 \]; then/);
});
