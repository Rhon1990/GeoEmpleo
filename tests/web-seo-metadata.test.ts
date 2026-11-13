import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';

const publicDir=new URL('../apps/web-preview/public/',import.meta.url);

test('la portada publica identidad y descripción rastreables',async()=>{
  const html=await readFile(new URL('index.html',publicDir),'utf8');
  assert.match(html,/<title>Ofertas de empleo en España \| GeoEmpleo360<\/title>/);
  assert.match(html,/<link rel="canonical" href="https:\/\/geoempleo360\.com\/">/);
  assert.match(html,/<meta name="description" content="Busca ofertas de empleo en España/);
  assert.match(html,/<meta property="og:image" content="https:\/\/geoempleo360\.com\/geoempleo360-logo\.png">/);
  assert.match(html,/"@type": "WebSite"/);
  assert.match(html,/<link rel="icon" type="image\/png" href="\/favicon\.png">/);
  assert.doesNotMatch(html,/cobertura[^<.]*parcial/i);
});

test('el icono es un PNG cuadrado y accesible por una URL estable',async()=>{
  const icon=await readFile(new URL('favicon.png',publicDir));
  assert.equal(icon.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=icon.readUInt32BE(16),height=icon.readUInt32BE(20);
  assert.equal(width,height);
  assert.ok(width>=48);
});

test('robots anuncia el sitemap canónico',async()=>{
  const robots=await readFile(new URL('robots.txt',publicDir),'utf8');
  assert.match(robots,/Sitemap: https:\/\/geoempleo360\.com\/sitemap\.xml/);
});
