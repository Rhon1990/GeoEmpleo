import assert from 'node:assert/strict';
import {test} from 'node:test';
import {bizneoBoards,parseBizneoListing} from '../packages/ingestion/src/connectors/bizneo.ts';
import {adaptAccentureDetail,fetchAccentureOffers,parseAccentureListing} from '../packages/ingestion/src/connectors/accenture.ts';
import {createNationalCityResolver} from '../packages/ingestion/src/national-geography.ts';
import {sourceRegistry} from '../packages/ingestion/src/registry.ts';

const checkedAt='2026-10-28T12:00:00.000Z';
const resolveCity=createNationalCityResolver([
  {id:'madrid',name:'Madrid',province:'Madrid',municipality:'Madrid',latitude:40.42,longitude:-3.70,sourceUrl:'https://example.org/madrid',precision:'locality'},
  {id:'palma',name:'Palma',province:'Illes Balears',municipality:'Palma',latitude:39.57,longitude:2.65,sourceUrl:'https://example.org/palma',precision:'locality'},
]);

test('Covirán e ISS se registran como tablones Bizneo oficiales',()=>{
  assert.equal(sourceRegistry.get('bizneo-coviran')?.status,'active');
  assert.equal(sourceRegistry.get('bizneo-iss')?.status,'active');
  assert.equal(bizneoBoards.find(board=>board.sourceId==='bizneo-coviran')?.hostname,'jobs.coviran.com');
  assert.equal(bizneoBoards.find(board=>board.sourceId==='bizneo-iss')?.hostname,'jobs.iss.es');
});

test('Covirán excluye autocandidaturas sin vacante concreta',()=>{
  const board=bizneoBoards.find(item=>item.sourceId==='bizneo-coviran')!;
  const card=(title:string,slug:string)=>`<a class="job-card" href="https://jobs.coviran.com/jobs/${slug}"><div class="title">${title}</div><div class="details"><span>Madrid</span><span>Presencial</span></div></a>`;
  const html=`<div id="job-board">${card('Preparador/a de pedidos','preparador-a-123')}${card('Autocandidatura - Tiendas','autocandidatura-tiendas-456')}</div>`;
  assert.deepEqual(parseBizneoListing(html,board).offers.map(offer=>offer.title),['Preparador/a de pedidos']);
});

test('Accenture solo acepta resultados con país España y ciudad única',()=>{
  assert.equal(sourceRegistry.get('workday-accenture')?.status,'active');
  const listing=parseAccentureListing({total:1,jobPostings:[{title:'Consultor/a',externalPath:'/job/Madrid/Consultora_R00346700',bulletFields:['R00346700','Madrid']}]});
  assert.equal(listing.offers.length,1);
  const detail={jobPostingInfo:{title:'Consultor/a',jobDescription:'<p>Trabajo de consultoría.</p>',location:'Madrid, Castellana 85',additionalLocations:[],startDate:'2026-10-28',jobReqId:'R00346700',country:{descriptor:'Spain'},jobRequisitionLocation:{country:{alpha2Code:'ES'}},externalUrl:'https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/Madrid/Consultora_R00346700',posted:true}};
  const job=adaptAccentureDetail(listing.offers[0]!,detail,checkedAt,resolveCity);
  assert.equal(job?.id,'ACCENTURE-R00346700');
  assert.deepEqual(job?.location?.point,[-3.70,40.42]);
  assert.equal(adaptAccentureDetail(listing.offers[0]!,{jobPostingInfo:{...detail.jobPostingInfo,country:{descriptor:'Portugal'},jobRequisitionLocation:{country:{alpha2Code:'PT'}}}},checkedAt,resolveCity),null);
  assert.equal(adaptAccentureDetail(listing.offers[0]!,{jobPostingInfo:{...detail.jobPostingInfo,additionalLocations:['Barcelona']}},checkedAt,resolveCity)?.location,null);
});

test('Accenture conserva variantes Workday del mismo requisition ID como publicaciones distintas',()=>{
  const result=parseAccentureListing({total:2,jobPostings:[
    {title:'Consultor/a',externalPath:'/job/Madrid/Consultora_R00363265',bulletFields:['R00363265','Madrid']},
    {title:'Consultor/a',externalPath:'/job/Madrid/Consultora_R00363265-1',bulletFields:['R00363265','Madrid']},
  ]});
  assert.deepEqual(result.offers.map(offer=>offer.id),['R00363265','R00363265-1']);
  const detail={jobPostingInfo:{title:'Consultor/a',jobDescription:'<p>Trabajo de consultoría.</p>',location:'Madrid',additionalLocations:[],startDate:'2026-10-28',jobReqId:'R00363265',country:{descriptor:'Spain'},jobRequisitionLocation:{country:{alpha2Code:'ES'}},externalUrl:'https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/Madrid/Consultora_R00363265-1',posted:true}};
  assert.equal(adaptAccentureDetail(result.offers[1]!,detail,checkedAt,resolveCity)?.id,'ACCENTURE-R00363265-1');
});

test('Accenture admite identificadores numéricos publicados por su Workday',()=>{
  const result=parseAccentureListing({total:1,jobPostings:[
    {title:'Técnico/a de recursos humanos',externalPath:'/job/Merida/Tecnico-de-recursos-humanos_14835658'},
  ]});
  assert.equal(result.offers[0]?.id,'14835658');
  const detail={jobPostingInfo:{title:'Técnico/a de recursos humanos',jobDescription:'<p>Vacante real.</p>',location:'Madrid',startDate:'2026-10-28',jobReqId:'14835658',country:{descriptor:'Spain'},jobRequisitionLocation:{country:{alpha2Code:'ES'}},externalUrl:'https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/Merida/Tecnico-de-recursos-humanos_14835658',posted:true}};
  assert.equal(adaptAccentureDetail(result.offers[0]!,detail,checkedAt,resolveCity)?.id,'ACCENTURE-14835658');
});

test('Accenture distingue una fila Workday sin título ni enlace de una oferta verificable',()=>{
  const listing=parseAccentureListing({total:2,jobPostings:[
    {title:'Consultor/a',externalPath:'/job/Madrid/Consultora_R00346700'},
    {bulletFields:['R00348384','Madrid, Castellana 85']},
  ]});
  assert.deepEqual(listing.offers.map(offer=>offer.id),['R00346700']);
  assert.deepEqual(listing.unlinkedIds,['R00348384']);
  assert.throws(()=>parseAccentureListing({total:1,jobPostings:[{title:'Consultor/a',bulletFields:['R00348384']}]}));
  assert.throws(()=>parseAccentureListing({total:2,jobPostings:[
    {bulletFields:['R00348384']},{bulletFields:['R00348385']},
  ]}),/sin enlace/);
});

test('Accenture admite una última página formada por la única fila sin enlace',async()=>{
  const mock=async(url:string|URL|Request,init?:RequestInit)=>{
    const path=String(url);
    if(path.endsWith('/jobs')){
      const body=JSON.parse(String(init?.body));
      const data=!body.appliedFacets.locationCountry
        ? {facets:[{facetParameter:'locationMainGroup',values:[{facetParameter:'locationCountry',values:[{descriptor:'Spain',id:'es'}]}]}]}
        : body.offset===0
          ? {total:21,jobPostings:Array.from({length:20},(_,index)=>({title:`Puesto ${index}`,externalPath:`/job/Madrid/Puesto-${index}_${14800000+index}`}))}
          : {total:0,jobPostings:[{bulletFields:['R00348384','Madrid, Castellana 85']}]};
      return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
    }
    const id=path.match(/_(\d+)$/)?.[1];
    return new Response(JSON.stringify({jobPostingInfo:{title:`Puesto ${Number(id)-14800000}`,jobDescription:'<p>Oferta concreta.</p>',location:'Madrid',startDate:'2026-10-28',jobReqId:id,country:{descriptor:'Spain'},jobRequisitionLocation:{country:{alpha2Code:'ES'}},externalUrl:path.replace('/wday/cxs/accenture',''),posted:true}}),{headers:{'content-type':'application/json'}});
  };
  const jobs=await fetchAccentureOffers(checkedAt,resolveCity,mock as typeof fetch);
  assert.equal(jobs.length,20);
});

test('Accenture publica las ofertas enlazables aunque Workday incluya una fila sin enlace',async()=>{
  const mock=async(url:string|URL|Request,init?:RequestInit)=>{
    const path=String(url);
    if(path.endsWith('/jobs')){
      const body=JSON.parse(String(init?.body));
      const data=body.appliedFacets.locationCountry
        ? {total:2,jobPostings:[{title:'Consultor/a',externalPath:'/job/Madrid/Consultora_R00346700'}, {bulletFields:['R00348384','Madrid, Castellana 85']}]}
        : {facets:[{facetParameter:'locationMainGroup',values:[{facetParameter:'locationCountry',values:[{descriptor:'Spain',id:'es'}]}]}]};
      return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({jobPostingInfo:{title:'Consultor/a',jobDescription:'<p>Oferta concreta.</p>',location:'Madrid',startDate:'2026-10-28',jobReqId:'R00346700',country:{descriptor:'Spain'},jobRequisitionLocation:{country:{alpha2Code:'ES'}},externalUrl:'https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/Madrid/Consultora_R00346700',posted:true}}),{headers:{'content-type':'application/json'}});
  };
  const jobs=await fetchAccentureOffers(checkedAt,resolveCity,mock as typeof fetch);
  assert.deepEqual(jobs.map(job=>job.id),['ACCENTURE-R00346700']);
});

test('Accenture pagina cuando Workday informa total cero después de la primera página',async()=>{
  const listing=(offset:number)=>({total:offset===0?21:0,jobPostings:Array.from({length:offset===0?20:1},(_,i)=>({title:`Puesto ${offset+i}`,externalPath:`/job/Madrid/Puesto-${offset+i}_${14800000+offset+i}`}))});
  const mock=async(url:string|URL|Request,init?:RequestInit)=>{
    const path=String(url);
    if(path.endsWith('/jobs')){
      const body=JSON.parse(String(init?.body));
      const data=body.appliedFacets.locationCountry?listing(body.offset):{facets:[{facetParameter:'locationMainGroup',values:[{facetParameter:'locationCountry',values:[{descriptor:'Spain',id:'es'}]}]}]};
      return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
    }
    const id=path.match(/_(\d+)$/)?.[1];
    return new Response(JSON.stringify({jobPostingInfo:{title:`Puesto ${Number(id)-14800000}`,jobDescription:'<p>Oferta concreta.</p>',location:'Madrid',startDate:'2026-10-28',jobReqId:id,country:{descriptor:'Spain'},jobRequisitionLocation:{country:{alpha2Code:'ES'}},externalUrl:path.replace('/wday/cxs/accenture',''),posted:true}}),{headers:{'content-type':'application/json'}});
  };
  const jobs=await fetchAccentureOffers(checkedAt,resolveCity,mock as typeof fetch);
  assert.equal(jobs.length,21);
  assert.equal(new Set(jobs.map(job=>job.id)).size,21);
});

test('Accenture repite una captura cuando Workday entrega una instantánea transitoria inválida',async()=>{
  let filteredAttempts=0;
  const mock=async(url:string|URL|Request,init?:RequestInit)=>{
    const path=String(url);
    if(path.endsWith('/jobs')){
      const body=JSON.parse(String(init?.body));
      if(!body.appliedFacets.locationCountry){
        return new Response(JSON.stringify({facets:[{facetParameter:'locationMainGroup',values:[{facetParameter:'locationCountry',values:[{descriptor:'Spain',id:'es'}]}]}]}),{headers:{'content-type':'application/json'}});
      }
      filteredAttempts+=1;
      const externalPath=filteredAttempts===1?'/job/Madrid/Instantanea-sin-id':'/job/Madrid/Consultora_R00346700';
      return new Response(JSON.stringify({total:1,jobPostings:[{title:'Consultor/a',externalPath}]}),{headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({jobPostingInfo:{title:'Consultor/a',jobDescription:'<p>Trabajo de consultoría.</p>',location:'Madrid',startDate:'2026-10-28',jobReqId:'R00346700',country:{descriptor:'Spain'},jobRequisitionLocation:{country:{alpha2Code:'ES'}},externalUrl:'https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/Madrid/Consultora_R00346700',posted:true}}),{headers:{'content-type':'application/json'}});
  };
  const jobs=await fetchAccentureOffers(checkedAt,resolveCity,mock as typeof fetch);
  assert.equal(filteredAttempts,2);
  assert.deepEqual(jobs.map(job=>job.id),['ACCENTURE-R00346700']);
});
