import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {focusSearchOnOpen} from '../apps/web-preview/public/searchable-select.mjs';

test('al abrir una lista buscable en móvil no enfoca la caja de búsqueda',()=>{
 let focused=false;
 const search={focus(){focused=true;}};
 const matchMedia=((query:string)=>({matches:query==='(max-width:780px)'})) as unknown as typeof globalThis.matchMedia;

 assert.equal(focusSearchOnOpen(search,{matchMedia}),false);
 assert.equal(focused,false);
});

test('en escritorio conserva el foco automático y el teclado aparece al buscar',()=>{
 let focused=false;
 const search={focus(){focused=true;}};
 const matchMedia=(()=>({matches:false})) as unknown as typeof globalThis.matchMedia;

 assert.equal(focusSearchOnOpen(search,{matchMedia}),true);
 assert.equal(focused,true);
});

test('todas las listas buscables comparten la decisión de foco al abrirse',async()=>{
 const searchable=await readFile(new URL('../apps/web-preview/public/searchable-select.mjs',import.meta.url),'utf8');
 const hierarchy=await readFile(new URL('../apps/web-preview/public/place-hierarchy.mjs',import.meta.url),'utf8');

 assert.match(searchable,/focusSearchOnOpen\(search\)/);
 assert.match(hierarchy,/focusSearchOnOpen\(search\)/);
 assert.equal((searchable.match(/search\.focus\(\)/g)??[]).length,1);
 assert.doesNotMatch(hierarchy,/search\.focus\(\)/);
});
