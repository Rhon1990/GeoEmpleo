import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {employerBrand,neutralBrand,setBrandImageFallback} from '../apps/web-preview/public/presentation.mjs';

const publicBrands={
  'talentclue-mcdonalds':['/brands/mcdonalds.svg','McDonald’s'],
  'bizneo-burger-king':['/brands/burger-king.svg','Burger King'],
  'amrest-kfc':['/brands/kfc.svg','KFC'],
  'lever-jobandtalent':['/brands/jobandtalent.png','Job&Talent'],
  'lever-skydance':['/brands/skydance.jpg','Skydance'],
  'bizneo-plenergy':['/brands/plenergy.png','Plenergy'],
  'bizneo-telepizza':['/brands/telepizza.svg','Telepizza'],
  'successfactors-vithas':['/brands/vithas.png','Vithas'],
  'successfactors-mapfre':['/brands/mapfre.png','MAPFRE'],
  'successfactors-capgemini':['/brands/capgemini.png','Capgemini'],
  'successfactors-melia':['/brands/melia.svg','Meliá Hotels International'],
  'teamtailor-dia':['/brands/dia.png','DIA'],
  'carrefour-talentforjobs':['/brands/carrefour.svg','Carrefour'],
  'lidl-search-api':['/brands/lidl.svg','Lidl'],
  'disa-empleo':['/brands/disa.png','Grupo DISA'],
};

test('cada portal empresarial verificado muestra un asset local de su marca', () => {
  for(const [sourceId,[src,alt]] of Object.entries(publicBrands)) {
    assert.deepEqual(employerBrand({sourceId}),{src,alt});
    const asset=resolve('apps/web-preview/public',`.${src}`);
    assert.ok(existsSync(asset),`${sourceId} debe tener ${src}`);
    const content=readFileSync(asset);
    if(src.endsWith('.svg'))assert.match(content.toString('utf8'),/<svg[\s>]/u);
    else if(src.endsWith('.png'))assert.deepEqual([...content.subarray(0,8)],[137,80,78,71,13,10,26,10],`${sourceId} debe ser PNG válido`);
    else assert.deepEqual([...content.subarray(0,3)],[255,216,255],`${sourceId} debe ser JPEG válido`);
  }
});

test('fuentes públicas y anuncios directos muestran la identidad neutra de GeoEmpleo', () => {
  assert.deepEqual(employerBrand({sourceId:'ecyl-castilla-leon',employer:'McDonald’s'}),neutralBrand);
  assert.deepEqual(employerBrand({sourceId:'direct-employer',employer:'KFC'}),neutralBrand);
});

test('un error al cargar un logo cambia una sola vez a la marca neutral local',()=>{
 const image:{src:string;alt:string;onerror:(()=>void)|null}={src:'/brands/dia.png',alt:'',onerror:null};
 setBrandImageFallback(image);
 image.onerror?.();
 assert.deepEqual(image,{src:neutralBrand.src,alt:neutralBrand.alt,onerror:null});
});
