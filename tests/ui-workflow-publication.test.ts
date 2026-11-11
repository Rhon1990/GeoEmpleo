import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('la publicación manual de interfaz conserva el catálogo vigente en ambos dominios',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/deploy-ui.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/group: daily-offers-production/);
  assert.match(workflow,/node tools\/prepare-daily-refresh\.mjs/);
  assert.doesNotMatch(workflow,/npm run ingest:daily/);
  const prepare=workflow.indexOf('node tools/prepare-daily-refresh.mjs');
  const build=workflow.indexOf('npm run build:web:static');
  const deploy=workflow.indexOf('FirebaseExtended/action-hosting-deploy@v0');
  assert.ok(prepare>=0&&prepare<build&&build<deploy);
  assert.match(workflow,/--catalog apps\/web-preview\/public\/data\/calls\.json/);
  assert.match(workflow,/--catalog var\/public-site\/data\/calls\.json/);
  assert.match(workflow,/--matches-url/);
  assert.match(workflow,/for origin in https:\/\/geoempleo360\.com https:\/\/geoempleo-49978\.web\.app;/);
  assert.match(workflow,/\$origin\/data\/calls\.json/);
  assert.match(workflow,/channelId: live/);
  assert.match(workflow,/cmp -s var\/public-site\/index\.html/);
});

test('el despliegue de interfaz no reemplaza la actualización diaria de futuras ofertas',async()=>{
  const daily=await readFile(new URL('../.github/workflows/daily-offers.yml',import.meta.url),'utf8');
  const ui=await readFile(new URL('../.github/workflows/deploy-ui.yml',import.meta.url),'utf8');
  assert.match(daily,/schedule:/);
  assert.match(daily,/npm run ingest:daily/);
  assert.match(daily,/group: daily-offers-production/);
  assert.match(ui,/group: daily-offers-production/);
  assert.doesNotMatch(ui,/schedule:|npm run ingest:daily/);
});
