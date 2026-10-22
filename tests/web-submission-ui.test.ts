import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildManagementLink,
  buildSubmissionPayload,
  createLocationPicker,
  createPointSelection,
  salaryFieldState,
  searchReferencePlaces,
  submitSubmission,
} from '../apps/web-preview/public/publish.mjs';
import {
  consumeManagementCredentials,
  loadSubmissionStatus,
  withdrawSubmission,
} from '../apps/web-preview/public/manage.mjs';

const baseValues={
  title:'Operario de producción',
  employer:'Empresa de prueba',
  description:'Preparación de pedidos en el centro indicado.',
  city:'Villacastín',
  province:'Segovia',
  region:'Castilla y León',
  address:'Centro de trabajo',
  managerEmail:'privado@example.org',
  contactEmail:'empleo@example.org',
  contactPhone:'',
  consent:true,
  locationConfirmed:true,
  period:'month',
  basis:'gross',
  payments:'14',
};

test('alterna los campos requeridos de salario fijo, rango y no publicado',()=>{
  assert.deepEqual(salaryFieldState('fixed'),{fieldsHidden:false,minRequired:true,maxVisible:false,maxRequired:false});
  assert.deepEqual(salaryFieldState('range'),{fieldsHidden:false,minRequired:true,maxVisible:true,maxRequired:true});
  assert.deepEqual(salaryFieldState('unknown'),{fieldsHidden:true,minRequired:false,maxVisible:false,maxRequired:false});
  assert.throws(()=>salaryFieldState('otro'),RangeError);
});

test('serializa salario fijo, rango y no publicado sin anualizar importes',()=>{
  assert.deepEqual(buildSubmissionPayload({...baseValues,salaryMode:'fixed',salaryMin:'1500'},[-4.412,40.779]).salary,{
    minMinor:150000,maxMinor:150000,currency:'EUR',period:'month',basis:'gross',paymentsPerYear:14,
  });
  assert.deepEqual(buildSubmissionPayload({...baseValues,salaryMode:'range',salaryMin:'1500',salaryMax:'1700'},[-4.412,40.779]).salary,{
    minMinor:150000,maxMinor:170000,currency:'EUR',period:'month',basis:'gross',paymentsPerYear:14,
  });
  assert.equal(buildSubmissionPayload({...baseValues,salaryMode:'unknown'},[-4.412,40.779]).salary,null);
  assert.throws(()=>buildSubmissionPayload({...baseValues,salaryMode:'range',salaryMin:'1700',salaryMax:'1500'},[-4.412,40.779]),/salario/i);
});

test('bloquea el envío hasta confirmar un punto ajustado por mapa',()=>{
  const changes:unknown[]=[];
  const selection=createPointSelection(value=>changes.push(value));
  selection.select([-4.41357,40.7796]);
  selection.confirm();
  assert.deepEqual(selection.snapshot(),{point:[-4.41357,40.7796],confirmed:true});
  selection.select([-4.412,40.78]);
  assert.deepEqual(selection.snapshot(),{point:[-4.412,40.78],confirmed:false});
  assert.throws(()=>buildSubmissionPayload({...baseValues,salaryMode:'unknown',locationConfirmed:false},selection.snapshot().point),/ubicación/i);
  assert.equal(changes.length,3);
});

test('busca y selecciona localidades únicamente mediante /api/places',async()=>{
  let requested='';
  const places=await searchReferencePlaces('Villacastín',async url=>{
    requested=String(url);
    return Response.json({query:'Villacastín',places:[{name:'Villacastín',province:'Segovia',longitude:-4.41357,latitude:40.7796}]});
  });
  assert.equal(requested,'/api/places?q=Villacast%C3%ADn');
  assert.equal(places[0].name,'Villacastín');
});

test('el mapa ajusta el punto por clic y arrastre y exige reconfirmarlo',async()=>{
  const mapListeners=new Map<string,(event:any)=>void>();
  const markerListeners=new Map<string,(event:any)=>void>();
  class FakeMap{
    constructor(_host:unknown,_options:unknown){}
    addListener(name:string,listener:(event:any)=>void){mapListeners.set(name,listener);}
    setCenter(_point:unknown){}
    setZoom(_zoom:number){}
  }
  class FakeMarker{
    position:any;
    constructor(options:any){this.position=options.position;assert.equal(options.gmpDraggable,true);}
    addListener(name:string,listener:(event:any)=>void){markerListeners.set(name,listener);}
  }
  const google={maps:{
    importLibrary:async(name:string)=>name==='maps'?{Map:FakeMap}:{AdvancedMarkerElement:FakeMarker},
  }};
  const selection=createPointSelection();
  await createLocationPicker({}, {googleMapsApiKey:'test',googleMapsMapId:'map'},selection,[-4.41357,40.7796],async()=>google);
  selection.confirm();
  mapListeners.get('click')?.({latLng:{lng:()=>-4.412,lat:()=>40.78}});
  assert.deepEqual(selection.snapshot(),{point:[-4.412,40.78],confirmed:false});
  selection.confirm();
  markerListeners.get('dragend')?.({latLng:{lng:()=>-4.411,lat:()=>40.781}});
  assert.deepEqual(selection.snapshot(),{point:[-4.411,40.781],confirmed:false});
});

test('crea la oferta por POST y construye el enlace privado una sola vez',async()=>{
  let request:{url:string,options:RequestInit}|undefined;
  const result=await submitSubmission({title:'Oferta'},async(url,options)=>{
    request={url:String(url),options:options??{}};
    return Response.json({id:'direct-abc',token:'a'.repeat(64),state:'pending_review'},{status:201});
  });
  assert.equal(request?.url,'/api/submissions');
  assert.equal(request?.options.method,'POST');
  assert.equal(request?.options.headers instanceof Headers?request.options.headers.get('Content-Type'):(request?.options.headers as Record<string,string>)['Content-Type'],'application/json');
  assert.deepEqual(result,{id:'direct-abc',token:'a'.repeat(64),state:'pending_review'});
  assert.equal(buildManagementLink('http://127.0.0.1:4310',result),'http://127.0.0.1:4310/gestionar#id=direct-abc&token='+ 'a'.repeat(64));
});

test('consume id y token del fragmento y lo retira de la barra',()=>{
  const replaced:string[]=[];
  const credentials=consumeManagementCredentials(
    {hash:`#id=direct-abc&token=${'b'.repeat(64)}`,pathname:'/gestionar',search:'?vista=privada'},
    {replaceState(_state:unknown,_title:string,url:string){replaced.push(url);}},
  );
  assert.deepEqual(credentials,{id:'direct-abc',token:'b'.repeat(64)});
  assert.deepEqual(replaced,['/gestionar?vista=privada']);
  assert.throws(()=>consumeManagementCredentials({hash:'#id=direct-abc',pathname:'/gestionar',search:''},{replaceState(){}}),/enlace/i);
});

test('GET consulta el estado con Bearer y nunca retira la oferta',async()=>{
  const calls:Array<{url:string,options:RequestInit}>=[];
  const credentials={id:'direct-abc',token:'c'.repeat(64)};
  const status=await loadSubmissionStatus(credentials,async(url,options)=>{
    calls.push({url:String(url),options:options??{}});
    return Response.json({id:'direct-abc',title:'Operario',state:'pending_review'});
  });
  assert.equal(status.state,'pending_review');
  assert.equal(calls[0].url,'/api/submissions/status?id=direct-abc');
  assert.equal(calls[0].options.method,'GET');
  assert.deepEqual(calls[0].options.headers,{Authorization:`Bearer ${credentials.token}`});
  assert.equal(calls.some(call=>call.url.includes('withdraw')),false);
});

test('la retirada solo hace POST después de una confirmación explícita',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return Response.json({id:'direct-abc',state:'withdrawn'});};
  const credentials={id:'direct-abc',token:'d'.repeat(64)};
  await assert.rejects(()=>withdrawSubmission(credentials,false,fetchImpl),/confirmar/i);
  assert.equal(calls,0);
  const result=await withdrawSubmission(credentials,true,fetchImpl);
  assert.deepEqual(result,{id:'direct-abc',state:'withdrawn'});
  assert.equal(calls,1);
});
