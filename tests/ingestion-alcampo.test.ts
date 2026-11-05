import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchAlcampoOffers,parseAlcampoListing} from '../packages/ingestion/src/connectors/alcampo.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const checkedAt='2026-11-05T08:00:00Z';
const card=(token:string,title:string,city:string)=>`<div class="list-group-item corpt4j"><h4>${title}</h4><div class="ubicacion">${city}</div><a class="solicitar" href="https://talentforjobs.com/ofertas/trabajo.aspx?j=${token}">Solicitar</a></div>`;
const page=(number:number,total:number,cards:string)=>`<form id="form1" action="./ofertas-empleo.aspx"><input name="ctl00$ph$hdnPg" value="${number-1}"><div id="ph_divPag">${number} / ${total}${number<total?`<a onclick="$('#ph_hdnPg').val('${number}');$('#ph_btnBO').click();">Siguiente →</a>`:''}</div>${cards}</form>`;
const detail=(title:string)=>`<title>Alcampo Trabajo - ${title}</title><div id="contDescPuesto"><p>Trabajo de atención al cliente.</p></div>`;
const city={city:'Toledo',province:'Toledo',region:'Castilla-La Mancha',location:{point:[-4.02,39.86] as [number,number],precision:'municipality' as const,sourceUrl:'https://example.org/toledo',sourceUpdatedAt:null,note:'aproximado'}};

test('Alcampo recorre páginas y usa el ID estable de la ficha, no el token del listado',async()=>{
  assert.equal(sourceRegistry.get('talentforjobs-alcampo')?.status,'active');
  const first=page(1,2,card('token-a','Cajero/a','Toledo'));
  const second=page(2,2,card('token-b','Reponedor/a','Toledo'));
  assert.equal(parseAlcampoListing(first).next,1);
  const fetchImpl=(async(input:string|URL|Request,init?:RequestInit)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.pathname.endsWith('ofertas-empleo.aspx'))return new Response(init?.method==='POST'?second:first,{headers:{'content-type':'text/html'}});
    if(url.pathname==='/ofertas/trabajo.aspx')return new Response(null,{status:302,headers:{location:`https://talentforjobs.com/ofertas/empleos/alcampo/trabajo.aspx?j=${url.searchParams.get('j')==='token-a'?'100':'200'}&e=x&p=y`}});
    return new Response(detail(url.searchParams.get('j')==='100'?'Cajero/a':'Reponedor/a'),{headers:{'content-type':'text/html'}});
  }) as typeof fetch;
  const jobs=await fetchAlcampoOffers(checkedAt,name=>name==='Toledo'?city:null,fetchImpl);
  assert.deepEqual(jobs.map(job=>job.id),['ALCAMPO-100','ALCAMPO-200']);
  assert.deepEqual(jobs[0]?.location?.point,[-4.02,39.86]);
});

test('Alcampo rechaza enlaces ajenos y redirecciones fuera del portal oficial',async()=>{
  assert.throws(()=>parseAlcampoListing(page(1,1,card('x','Puesto','Toledo').replace('talentforjobs.com','evil.test'))),/URL/);
  const html=page(1,1,card('x','Puesto','Toledo'));
  const fetchImpl=(async(input:string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:input);
    return url.pathname.endsWith('ofertas-empleo.aspx')?new Response(html,{headers:{'content-type':'text/html'}}):
      new Response(null,{status:302,headers:{location:'https://evil.test/job'}});
  }) as typeof fetch;
  await assert.rejects(()=>fetchAlcampoOffers(checkedAt,()=>null,fetchImpl),/Redirección/);
});
