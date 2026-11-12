import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchMercadonaOffers} from '../packages/ingestion/src/connectors/mercadona.ts';

const row=(id:string,title:string,city:string,description:string)=>`<article class="article article--result"><h3><a class="link" href="https://mercadona.avature.net/es_ES/Careers/JobDetail/Puesto/${id}">${title} - ${city}</a></h3><span class="list-item-town">${city}</span><div class="article__content light">${description}</div></article>`;
const page=(rows:string[],total:number)=>`<option value="243" selected="1">España</option><div class="list-controls__text__legend" aria-label="${total} resultados"></div>${rows.join('')}`;

test('Mercadona captura todas las páginas España sin abrir cada ficha',async()=>{
 const requested:string[]=[];
 const fetchImpl=(async(input:string|URL|Request)=>{const url=new URL(input instanceof Request?input.url:input);requested.push(url.href);const offset=url.searchParams.get('jobOffset');return new Response(offset==='6'?page([row('2','Repartidor','Lugo','Reparto.')],7):page([row('1','Médico/a','Lugo','Atención.'),...['3','4','5','6','7'].map(id=>row(id,'Personal','Lugo','Venta.'))],7),{headers:{'content-type':'text/html'}});}) as typeof fetch;
 const jobs=await fetchMercadonaOffers('2026-11-12T10:00:00.000Z',city=>city==='Lugo'?{city:'Lugo',province:'Lugo',region:'Galicia',location:{point:[-7.56,43.01],precision:'municipality',sourceUrl:'https://example.org',sourceUpdatedAt:null,note:'approx'}}:null,fetchImpl);
 assert.equal(jobs.length,7);assert.equal(jobs[0]?.id,'MERCADONA-1');assert.equal(jobs[0]?.dateKind,'observed');assert.ok(requested.some(url=>new URL(url).searchParams.get('jobOffset')==='6'));
});
