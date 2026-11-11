import test from 'node:test';
import assert from 'node:assert/strict';
import {groupSimilarOffers} from '../apps/web-preview/public/catalog.mjs';

test('agrupa títulos equivalentes de la misma empresa y localidad sin ocultar IDs',()=>{
  const jobs=[
    {id:'a',title:'Vendedor/a',employer:'Empresa',city:'Madrid'},
    {id:'b',title:'VENDEDOR/A',employer:'Empresa',city:'Madrid'},
    {id:'c',title:'Vendedor/a',employer:'Otra empresa',city:'Madrid'},
    {id:'d',title:'Vendedor/a',employer:'Empresa',city:'Toledo'},
  ];
  const groups=groupSimilarOffers(jobs);
  assert.deepEqual(groups.map(group=>group.map(job=>job.id)),[['a','b'],['c'],['d']]);
  assert.deepEqual(groups.flat().map(job=>job.id).sort(),jobs.map(job=>job.id).sort());
});
