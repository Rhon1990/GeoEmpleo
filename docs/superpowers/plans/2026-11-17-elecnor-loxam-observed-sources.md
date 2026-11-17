# Elecnor and Loxam Observed Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a transparent, expiring snapshot of current Elecnor and Loxam job cards with concrete LinkedIn destinations and verified municipal geography.

**Architecture:** Add a strict local-snapshot adapter with a distinct `observed_listing` source kind. The daily runner validates the entire versioned snapshot, filters expired rows, reconciles valid empty snapshots to remove stale records, and never refreshes an offer's observation timestamp unless the snapshot changes.

**Tech Stack:** Node.js 24, TypeScript 7, Node test runner, existing GeoEmpleo ingestion runner and national gazetteer.

---

## File structure

- Create `packages/ingestion/src/connectors/observed-employers.ts`: strict parsing, expiry and `PublicJob` adaptation.
- Create `packages/ingestion/data/observed-employer-offers.json`: ten manually verified LinkedIn job destinations observed on 17 November 2026.
- Create `tests/ingestion-observed-employers.test.ts`: unit contract for validation, dates, neutral text and geography.
- Modify `packages/ingestion/src/model.ts`: add the explicit `observed_listing` source kind.
- Modify `packages/ingestion/src/catalog.ts`: allow an explicitly authorized empty snapshot.
- Modify `packages/ingestion/src/registry.ts`: register Elecnor and Loxam as active observed sources.
- Modify `packages/ingestion/src/runner.ts`: dispatch both sources and reconcile their intentional expiry.
- Modify `tests/ingestion-catalog.test.ts`: protect the default empty-snapshot failure and the opt-in removal path.
- Modify `tests/ingestion-runner.test.ts`: cover runner integration and source isolation.
- Modify `tests/ingestion-employer-source-eligibility.test.ts`: assert registry identity and kind.
- Modify `tests/web-employer-brand.test.ts`: assert both sources keep the neutral GeoEmpleo360 mark.
- Modify `docs/fuentes-de-ofertas.md` and `docs/project-context.md`: document partial observed coverage and the 14-day expiry.

### Task 1: Add the observed snapshot contract

**Files:**
- Create: `tests/ingestion-observed-employers.test.ts`
- Create: `packages/ingestion/src/connectors/observed-employers.ts`
- Modify: `packages/ingestion/src/model.ts:8-15`

- [ ] **Step 1: Write the failing parser and adapter tests**

Create `tests/ingestion-observed-employers.test.ts` with focused fixtures:

```ts
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {adaptObservedEmployerSnapshot} from '../packages/ingestion/src/connectors/observed-employers.ts';

const observedAt='2026-11-17T17:40:00.000Z';
const expiresAt='2026-12-01T17:40:00.000Z';
const base={
  sourceId:'observed-loxam',id:'LOXAM-4489472800',title:'Técnico/a electromecánico/a',
  employer:'Loxam',city:'Burgos',province:'Burgos',provider:'LinkedIn',
  sourceUrl:'https://es.linkedin.com/jobs/view/example-4489472800',observedAt,expiresAt,
};
const resolved={city:'Burgos',province:'Burgos',region:'Castilla y León',location:{point:[-3.7,42.34] as [number,number],precision:'municipality' as const,sourceUrl:'https://ine.es/burgos',sourceUpdatedAt:null,note:'original'}};

test('adapta una observación vigente sin inventar descripción, salario o fecha editorial',()=>{
  const jobs=adaptObservedEmployerSnapshot({offers:[base]},'observed-loxam','2026-11-18T08:00:00.000Z',()=>resolved);
  assert.equal(jobs.length,1);
  assert.deepEqual(jobs[0],{
    kind:'job',sourceId:'observed-loxam',source:'Loxam · oferta observada en LinkedIn',
    id:'LOXAM-4489472800',title:'Técnico/a electromecánico/a',employer:'Loxam',city:'Burgos',
    province:'Burgos',region:'Castilla y León',category:'industria',categoryLabel:'Industria y producción',
    regime:'Oferta de empleo observada',places:null,
    paragraphs:['Oferta observada en LinkedIn.','Consulta la descripción, los requisitos y la vigencia en la ficha original.'],
    sourceUrl:base.sourceUrl,publishedAt:'2026-11-17',dateKind:'observed',checkedAt:observedAt,
    closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,
    location:{...resolved.location,note:'Ubicación municipal aproximada; no es una dirección exacta.'},
  });
});

test('filtra una fila caducada solo después de validar toda la instantánea',()=>{
  assert.deepEqual(adaptObservedEmployerSnapshot({offers:[base]},'observed-loxam','2026-12-01T17:40:00.001Z',()=>resolved),[]);
  assert.throws(()=>adaptObservedEmployerSnapshot({offers:[{...base,title:''}]},'observed-loxam','2026-12-02T00:00:00.000Z',()=>resolved),/inválida/i);
});

test('rechaza fuente, empresa, URL, identidad, propiedades y vigencia no autorizadas',()=>{
  const invalid=[
    {...base,sourceId:'observed-elecnor'},
    {...base,employer:'Otra empresa'},
    {...base,sourceUrl:'http://example.com/job'},
    {...base,id:'LOXAM-OTHER'},
    {...base,extra:true},
    {...base,expiresAt:'2026-12-02T17:40:00.000Z'},
  ];
  for(const offer of invalid) assert.throws(()=>adaptObservedEmployerSnapshot({offers:[offer]},'observed-loxam','2026-11-18T00:00:00.000Z',()=>resolved));
});

test('rechaza IDs y destinos duplicados y deja sin punto una ubicación ambigua',()=>{
  assert.throws(()=>adaptObservedEmployerSnapshot({offers:[base,{...base}]},'observed-loxam','2026-11-18T00:00:00.000Z',()=>resolved),/duplicad/i);
  const [job]=adaptObservedEmployerSnapshot({offers:[{...base,city:'Ubicación no indicada',province:'Sin verificar'}]},'observed-loxam','2026-11-18T00:00:00.000Z',()=>null);
  assert.equal(job?.location,null);
  assert.equal(job?.region,'España');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/ingestion-observed-employers.test.ts
```

Expected: FAIL because `observed-employers.ts` does not exist.

- [ ] **Step 3: Extend the source kind**

Change `SourceDefinition.kind` in `packages/ingestion/src/model.ts` to:

```ts
kind: 'open_data' | 'partner_api' | 'ats' | 'agreement' | 'observed_listing';
```

- [ ] **Step 4: Implement the strict adapter**

Create `packages/ingestion/src/connectors/observed-employers.ts` with:

```ts
import {readFile} from 'node:fs/promises';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import type {CityResolver} from './bizneo.ts';
import {approximateMunicipalNote} from './shared.ts';

export const observedEmployerSourceIds=['observed-elecnor','observed-loxam'] as const;
export type ObservedEmployerSourceId=typeof observedEmployerSourceIds[number];
const sourceConfig={
  'observed-elecnor':{employer:'Elecnor',label:'Elecnor'},
  'observed-loxam':{employer:'Loxam',label:'Loxam'},
} as const;
const allowedKeys=new Set(['sourceId','id','title','employer','city','province','provider','sourceUrl','observedAt','expiresAt']);
const utc=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type ObservedOffer={sourceId:ObservedEmployerSourceId;id:string;title:string;employer:string;city:string;province:string;provider:string;sourceUrl:string;observedAt:string;expiresAt:string};

function validatedOffer(value:unknown,sourceId:ObservedEmployerSourceId):ObservedOffer {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Oferta observada inválida');
  const row=value as Record<string,unknown>;
  if(Object.keys(row).some(key=>!allowedKeys.has(key))||Object.keys(row).length!==allowedKeys.size)throw new TypeError('Oferta observada inválida');
  if(Object.values(row).some(item=>typeof item!=='string'||!item.trim()))throw new TypeError('Oferta observada inválida');
  const offer=row as unknown as ObservedOffer,config=sourceConfig[sourceId];
  const url=new URL(offer.sourceUrl);
  const observed=Date.parse(offer.observedAt),expires=Date.parse(offer.expiresAt);
  if(offer.sourceId!==sourceId||offer.employer!==config.employer||!offer.id.startsWith(sourceId==='observed-elecnor'?'ELECNOR-':'LOXAM-')||
    !utc.test(offer.observedAt)||!utc.test(offer.expiresAt)||!Number.isFinite(observed)||!Number.isFinite(expires)||expires<=observed||expires-observed>14*86_400_000||
    url.protocol!=='https:'||url.port||url.username||url.password||!['es.linkedin.com','elecnor.epreselec.com'].includes(url.hostname))throw new TypeError('Oferta observada inválida');
  return offer;
}

export function adaptObservedEmployerSnapshot(input:unknown,sourceId:ObservedEmployerSourceId,checkedAt:string,resolveCity:CityResolver):PublicJob[] {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input as object).length!==1||!Array.isArray((input as {offers?:unknown}).offers))throw new TypeError('Instantánea observada inválida');
  const all=(input as {offers:unknown[]}).offers.map(row=>validatedOffer(row,sourceId));
  const ids=new Set<string>(),urls=new Set<string>();
  for(const offer of all){if(ids.has(offer.id)||urls.has(offer.sourceUrl))throw new TypeError('Oferta observada duplicada');ids.add(offer.id);urls.add(offer.sourceUrl);}
  const now=Date.parse(checkedAt);if(!Number.isFinite(now))throw new TypeError('Fecha de ejecución inválida');
  return all.filter(offer=>Date.parse(offer.expiresAt)>=now).map(offer=>{
    const province=canonicalSpanishProvince(offer.province),resolved=province?resolveCity(offer.city,province.name):null;
    const coherent=resolved?.province===province?.name;
    return {kind:'job',sourceId,source:`${sourceConfig[sourceId].label} · oferta observada en ${offer.provider}`,id:offer.id,title:offer.title,
      employer:offer.employer,city:offer.city,province:province?.name??'Sin verificar',region:province?.region??'España',category:'industria',categoryLabel:'Industria y producción',
      regime:'Oferta de empleo observada',places:null,paragraphs:[`Oferta observada en ${offer.provider}.`,'Consulta la descripción, los requisitos y la vigencia en la ficha original.'],
      sourceUrl:offer.sourceUrl,publishedAt:offer.observedAt.slice(0,10),dateKind:'observed',checkedAt:offer.observedAt,closingDate:null,salary:null,
      applicationRegistration:'external_required',selection:null,location:coherent&&resolved?.location?{...resolved.location,note:approximateMunicipalNote}:null};
  });
}

export async function loadObservedEmployerOffers(sourceId:ObservedEmployerSourceId,checkedAt:string,resolveCity:CityResolver):Promise<PublicJob[]> {
  const input=JSON.parse(await readFile(new URL('../../data/observed-employer-offers.json',import.meta.url),'utf8')) as unknown;
  if(!input||typeof input!=='object'||Array.isArray(input)||!Array.isArray((input as {offers?:unknown}).offers))throw new TypeError('Instantánea observada inválida');
  const offers=(input as {offers:unknown[]}).offers.filter(row=>
    row!==null&&typeof row==='object'&&!Array.isArray(row)&&(row as Record<string,unknown>).sourceId===sourceId);
  return adaptObservedEmployerSnapshot({offers},sourceId,checkedAt,resolveCity);
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run `node --test tests/ingestion-observed-employers.test.ts`.

Expected: 4 tests pass.

- [ ] **Step 6: Commit the contract**

```bash
git add packages/ingestion/src/model.ts packages/ingestion/src/connectors/observed-employers.ts tests/ingestion-observed-employers.test.ts
git commit -m "feat: add observed employer snapshot contract"
```

### Task 2: Add the verified Elecnor and Loxam snapshot

**Files:**
- Create: `packages/ingestion/data/observed-employer-offers.json`
- Modify: `tests/ingestion-observed-employers.test.ts`

- [ ] **Step 1: Add a failing repository-data test**

Append this test, importing `readFile` and `canonicalSpanishProvince`:

```ts
test('la instantánea versionada contiene cinco destinos concretos por empresa',async()=>{
  const input=JSON.parse(await readFile(new URL('../packages/ingestion/data/observed-employer-offers.json',import.meta.url),'utf8'));
  const resolver=(city:string,province:string)=>{
    const canonical=canonicalSpanishProvince(province);
    if(!canonical||city==='Ubicación no indicada')return null;
    return {city,province:canonical.name,region:canonical.region,location:{point:[-3.7,40.4] as [number,number],precision:'municipality' as const,sourceUrl:'https://ine.es/fixture',sourceUpdatedAt:null,note:'fixture'}};
  };
  const elecnor=adaptObservedEmployerSnapshot({offers:input.offers.filter((row:{sourceId:string})=>row.sourceId==='observed-elecnor')},'observed-elecnor','2026-11-18T08:00:00.000Z',resolver);
  const loxam=adaptObservedEmployerSnapshot({offers:input.offers.filter((row:{sourceId:string})=>row.sourceId==='observed-loxam')},'observed-loxam','2026-11-18T08:00:00.000Z',resolver);
  assert.equal(elecnor.length,5);assert.equal(loxam.length,5);
  assert.equal(elecnor.filter(job=>job.location).length,3);
  assert.equal(loxam.filter(job=>job.location).length,4);
  assert.equal(new Set([...elecnor,...loxam].map(job=>job.id)).size,10);
  for(const job of [...elecnor,...loxam])assert.match(job.sourceUrl,/^https:\/\/es\.linkedin\.com\/jobs\/view\//);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run `node --test tests/ingestion-observed-employers.test.ts`.

Expected: FAIL with `ENOENT` for `observed-employer-offers.json`.

- [ ] **Step 3: Add the ten verified rows**

Create `packages/ingestion/data/observed-employer-offers.json` using `observedAt: 2026-11-17T17:40:00.000Z` and `expiresAt: 2026-12-01T17:40:00.000Z` for these exact identities and canonical destinations:

```json
{
  "offers": [
    {"sourceId":"observed-elecnor","id":"ELECNOR-4491120916","title":"Supervisor de Obra - Seguridad Electrónica (h/m)","employer":"Elecnor","city":"Ubicación no indicada","province":"Sin verificar","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/supervisor-de-obra-seguridad-electr%C3%B3nica-h-m-at-elecnor-sistemas-4491120916","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-elecnor","id":"ELECNOR-4489470295","title":"Ingeniero civil senior - Subestaciones","employer":"Elecnor","city":"Madrid","province":"Madrid","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/ingeniero-civil-senior-subestaciones-at-elecnor-group-4489470295","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-elecnor","id":"ELECNOR-4487742400","title":"Ing. Eléctrico JR (h/m)","employer":"Elecnor","city":"Ubicación no indicada","province":"Sin verificar","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/ing-el%C3%A9ctrico-jr-h-m-at-elecnor-group-4487742400","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-elecnor","id":"ELECNOR-4473651841","title":"Jefe Obra - Instalaciones BT (h/m)","employer":"Elecnor","city":"Madrid","province":"Madrid","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/jefe-obra-instalaciones-bt-h-m-at-elecnor-group-4473651841","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-elecnor","id":"ELECNOR-4486232171","title":"Ingeniero Oficina técnica Distribución-Madrid (h/m)","employer":"Elecnor","city":"Madrid","province":"Madrid","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/ingeniero-oficina-t%C3%A9cnica-distribuci%C3%B3n-madrid-h-m-at-elecnor-group-4486232171","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-loxam","id":"LOXAM-4489472800","title":"Técnico/a electromecánico/a – Maquinaria generalista y de elevación (Burgos)","employer":"Loxam","city":"Burgos","province":"Burgos","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/t%C3%A9cnico-a-electromec%C3%A1nico-a-%E2%80%93-maquinaria-generalista-y-de-elevaci%C3%B3n-burgos-at-loxam-espa%C3%B1a-4489472800","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-loxam","id":"LOXAM-4488874744","title":"Técnico/a electromecánico/a Grupos Electrógenos","employer":"Loxam","city":"Ciempozuelos","province":"Madrid","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/t%C3%A9cnico-a-electromec%C3%A1nico-a-grupos-electr%C3%B3genos-at-loxam-espa%C3%B1a-4488874744","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-loxam","id":"LOXAM-4490653604","title":"Técnico/a comercial - Huelva","employer":"Loxam","city":"Huelva","province":"Huelva","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/t%C3%A9cnico-a-comercial-huelva-at-loxam-espa%C3%B1a-4490653604","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-loxam","id":"LOXAM-4488839248","title":"Técnico/a electromecánico/a – Grupos electrógenos","employer":"Loxam","city":"Ubicación no indicada","province":"Sin verificar","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/t%C3%A9cnico-a-electromec%C3%A1nico-a-%E2%80%93-grupos-electr%C3%B3genos-at-loxam-espa%C3%B1a-4488839248","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"},
    {"sourceId":"observed-loxam","id":"LOXAM-4489958777","title":"Técnico/a electromecánico/a Oficial 1ª, 2ª y/o 3ª – Maquinaria generalista y de elevación","employer":"Loxam","city":"Arafo","province":"Santa Cruz de Tenerife","provider":"LinkedIn","sourceUrl":"https://es.linkedin.com/jobs/view/t%C3%A9cnico-a-electromec%C3%A1nico-a-oficial-1%C2%AA-2%C2%AA-y-o-3%C2%AA-%E2%80%93-maquinaria-generalista-y-de-elevaci%C3%B3n-at-loxam-espa%C3%B1a-4489958777","observedAt":"2026-11-17T17:40:00.000Z","expiresAt":"2026-12-01T17:40:00.000Z"}
  ]
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Expected: all observed-employer tests pass with five jobs per source.

- [ ] **Step 5: Commit the snapshot**

```bash
git add packages/ingestion/data/observed-employer-offers.json tests/ingestion-observed-employers.test.ts
git commit -m "data: add current Elecnor and Loxam offers"
```

### Task 3: Integrate expiry-safe reconciliation and the daily runner

**Files:**
- Modify: `packages/ingestion/src/catalog.ts:2-40`
- Modify: `packages/ingestion/src/registry.ts`
- Modify: `packages/ingestion/src/runner.ts`
- Modify: `tests/ingestion-catalog.test.ts`
- Modify: `tests/ingestion-runner.test.ts`
- Modify: `tests/ingestion-employer-source-eligibility.test.ts`

- [ ] **Step 1: Write failing catalog tests for intentional empty snapshots**

Add this test using the existing catalog/job fixtures in `tests/ingestion-catalog.test.ts`:

```ts
test('solo una instantánea explícitamente caducable puede reconciliarse vacía',()=>{
  const observed={...job('LOXAM-OLD','observed-loxam'),dateKind:'observed' as const,checkedAt:'2026-11-17T17:40:00.000Z'};
  const other=job('ECYL-KEEP','ecyl-castilla-leon');
  const input={checkedAt:'2026-11-17T17:40:00.000Z',publishedAt:observed.publishedAt,mode:'daily_sources' as const,sourceConditions:'fixture',calls:[observed,other]};
  assert.throws(()=>reconcileSource(input,'observed-loxam',[],'2026-12-02T08:00:00.000Z'),/Captura vacía/);
  const output=reconcileSource(input,'observed-loxam',[],'2026-12-02T08:00:00.000Z',{allowEmptySnapshot:true,missingRetentionDays:0});
  assert.deepEqual(output.calls.map(item=>item.id),['ECYL-KEEP']);
});
```

- [ ] **Step 2: Run the catalog tests and verify RED**

Run `node --test tests/ingestion-catalog.test.ts`.

Expected: FAIL because `allowEmptySnapshot` is not defined.

- [ ] **Step 3: Implement the opt-in empty policy**

Extend `ReconcilePolicy`:

```ts
export interface ReconcilePolicy {
  missingRetentionDays?:number;
  retainMissingUntilClosingDate?:boolean;
  supersededSourceIds?:readonly string[];
  allowEmptySnapshot?:boolean;
}
```

Change the empty guard to:

```ts
if(!incoming.length&&!policy.allowEmptySnapshot) throw new Error('Captura vacía: se conserva el catálogo anterior');
```

- [ ] **Step 4: Register both observed sources**

Add definitions with `kind:'observed_listing'`, `status:'active'`, the user-supplied ePreSelec URL for Elecnor and Google Jobs query URL for Loxam, and `licenseUrl:null`.

- [ ] **Step 5: Write failing runner and registry tests**

Append this registry assertion:

```ts
test('Elecnor y Loxam quedan registradas como fuentes observadas y caducables',()=>{
  for(const sourceId of ['observed-elecnor','observed-loxam']) {
    const source=sourceRegistry.get(sourceId);
    assert.equal(source?.status,'active');
    assert.equal(source?.kind,'observed_listing');
    assert.match(source?.endpoint??'',/^https:\/\//);
  }
});
```

Add this runner test (the existing file already imports every referenced Node helper):

```ts
test('runner publica y caduca de forma aislada las ofertas observadas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'geoempleo-observed-'));
 try {
  const catalogPath=join(dir,'calls.json'),placesPath=join(dir,'places.json');
  const nationalPlacesPath=join(dir,'spain-places.json.gz'),reportPath=join(dir,'latest.json');
  const other={kind:'job',sourceId:'ecyl-castilla-leon',source:'ECYL',id:'ECYL-KEEP',title:'Oferta previa',employer:'Empresa',city:'Segovia',province:'Segovia',region:'Castilla y León',category:'otros',categoryLabel:'Otros',regime:'Oferta de empleo',places:null,paragraphs:['Texto'],sourceUrl:'https://empleo.jcyl.es/keep',publishedAt:'2026-11-01',checkedAt:'2026-11-17T08:00:00.000Z',closingDate:null,salary:null,applicationRegistration:'external_required',selection:null,location:null};
  await writeFile(catalogPath,JSON.stringify({checkedAt:'2026-11-17T08:00:00.000Z',publishedAt:'2026-11-01',mode:'daily_sources',sourceConditions:'fixture',calls:[other]}));
  await writeFile(placesPath,JSON.stringify({places:[]}));
  const locations=[['madrid','Madrid','Madrid',40.4168,-3.7038],['burgos','Burgos','Burgos',42.3439,-3.6969],['ciempozuelos','Ciempozuelos','Madrid',40.1591,-3.6210],['huelva','Huelva','Huelva',37.2614,-6.9447],['arafo','Arafo','Santa Cruz de Tenerife',28.3397,-16.4224]];
  await writeFile(nationalPlacesPath,gzipSync(JSON.stringify({retrievedAt:'2026-11-17',license:'test',places:locations.map(([id,name,province,latitude,longitude])=>({id,name,province,municipality:name,latitude,longitude,sourceUrl:`https://ine.es/${id}`,precision:'locality'}))})));
  const sourceIds=['observed-elecnor','observed-loxam'];
  const report=await runDaily({catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds,checkedAt:'2026-11-18T08:00:00.000Z'});
  assert.deepEqual(report.sources.map(source=>[source.sourceId,source.status,source.received]),[
   ['observed-elecnor','success',5],['observed-loxam','success',5],
  ]);
  const published=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.equal(published.calls.filter((job:{sourceId:string})=>job.sourceId.startsWith('observed-')).length,10);
  await runDaily({catalogPath,placesPath,nationalPlacesPath,reportPath,sourceIds,checkedAt:'2026-12-01T17:40:00.001Z'});
  const expired=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.equal(expired.calls.some((job:{sourceId:string})=>job.sourceId.startsWith('observed-')),false);
  assert.ok(expired.calls.some((job:{sourceId:string})=>job.sourceId==='ecyl-castilla-leon'));
 } finally {await rm(dir,{recursive:true,force:true});}
});
```

- [ ] **Step 6: Run the runner tests and verify RED**

Run:

```bash
node --test tests/ingestion-runner.test.ts tests/ingestion-employer-source-eligibility.test.ts
```

Expected: FAIL with `source_unavailable` for both observed IDs.

- [ ] **Step 7: Dispatch the observed adapter from the runner**

Import `loadObservedEmployerOffers` and `observedEmployerSourceIds`, include the IDs in `implementedSourceIds`, and dispatch before `fetchOpenSource`:

```ts
: observedEmployerSourceIds.includes(sourceId as ObservedEmployerSourceId)
  ? await loadObservedEmployerOffers(sourceId as ObservedEmployerSourceId,checkedAt,national?.resolveCity??(()=>null))
: await fetchOpenSource(...)
```

Set these reconciliation options for `observed_listing`:

```ts
missingRetentionDays:0,
allowEmptySnapshot:true,
```

- [ ] **Step 8: Run focused tests and typecheck**

Run:

```bash
node --test tests/ingestion-catalog.test.ts tests/ingestion-observed-employers.test.ts tests/ingestion-runner.test.ts tests/ingestion-employer-source-eligibility.test.ts
npm run typecheck
```

Expected: all focused tests and typecheck pass.

- [ ] **Step 9: Commit runner integration**

```bash
git add packages/ingestion/src/catalog.ts packages/ingestion/src/registry.ts packages/ingestion/src/runner.ts tests/ingestion-catalog.test.ts tests/ingestion-runner.test.ts tests/ingestion-employer-source-eligibility.test.ts
git commit -m "feat: run observed employer sources daily"
```

### Task 4: Preserve neutral presentation and document the limitation

**Files:**
- Modify: `tests/web-employer-brand.test.ts`
- Modify: `docs/fuentes-de-ofertas.md`
- Modify: `docs/project-context.md`

- [ ] **Step 1: Write a failing neutral-brand regression test**

Add:

```ts
for(const sourceId of ['observed-elecnor','observed-loxam']) {
  assert.deepEqual(employerBrand({sourceId}),neutralBrand);
}
```

Run `node --test tests/web-employer-brand.test.ts`; if it already passes because unknown sources are neutral, keep the assertion as characterization and do not modify presentation code.

- [ ] **Step 2: Update source inventory**

Replace the Elecnor candidate row in `docs/fuentes-de-ofertas.md` and add Loxam. State: five manually observed LinkedIn destinations each, observed 17/11/2026, expiry 01/12/2026, partial coverage, no copied descriptions, no automatic Google/LinkedIn scraping.

- [ ] **Step 3: Update project context**

Add this dated section and remove the stale sentence that says Elecnor has no verified channel:

```markdown
## Elecnor y Loxam observadas — 17/11/2026

GeoEmpleo360 publica una instantánea parcial de cinco fichas concretas de Elecnor y cinco de Loxam observadas en Google Jobs y enlazadas a sus destinos LinkedIn. Se clasifican como `observed_listing`: no existe captura automática de Google, LinkedIn ni ePreSelec, no se copian descripciones completas y la identidad visual permanece neutral. Las filas conservan la hora real de observación y caducan el 01/12/2026 si no se revisan de nuevo. Madrid, Burgos, Ciempozuelos, Huelva y Arafo solo reciben punto cuando el nomenclátor confirma el municipio; las ofertas de ámbito España permanecen sin marcador.
```

- [ ] **Step 4: Run documentation and presentation checks**

Run:

```bash
node --test tests/web-employer-brand.test.ts
git diff --check
```

Expected: tests pass and no whitespace errors.

- [ ] **Step 5: Commit docs and regression test**

```bash
git add tests/web-employer-brand.test.ts docs/fuentes-de-ofertas.md docs/project-context.md
git commit -m "docs: record observed Elecnor and Loxam coverage"
```

### Task 5: Full verification, publication and production QA

**Files:**
- Verify all modified files.
- No new production files expected.

- [ ] **Step 1: Run complete local verification**

```bash
npm test
npm run typecheck
git diff --check
```

Expected: all tests pass, TypeScript emits no diagnostics, and diff check is clean.

- [ ] **Step 2: Run an isolated two-source ingestion**

Run the isolated runner test created in Task 3:

```bash
node --test --test-name-pattern="runner publica y caduca de forma aislada" tests/ingestion-runner.test.ts
```

Expected: one test passes, reporting five Elecnor and five Loxam records before expiry and none after expiry while preserving the unrelated ECYL fixture.

- [ ] **Step 3: Review the final diff and commit any verification-only correction**

Run `git status --short` and `git diff origin/main...HEAD`. Do not commit generated catalogs or temporary reports.

- [ ] **Step 4: Push and merge through the normal GitHub review path**

Push `codex/elecnor-loxam-observed`, open a PR to `main`, include test evidence and the partial-coverage warning, then merge after confirming the PR diff contains only planned files.

- [ ] **Step 5: Run the daily publication workflow**

Trigger `.github/workflows/daily-offers.yml` on `main`, wait for completion, and inspect the source summary for both IDs. The workflow may be partial if an unrelated source fails, but both observed sources must report success with five records each.

- [ ] **Step 6: Verify production**

On `https://geoempleo360.com` verify:

- total catalog increased by ten relative to the preserved pre-deploy baseline;
- searching `Elecnor` and `Loxam` returns five cards each;
- opening a card shows the observation warning and a LinkedIn destination;
- Madrid/Burgos/Ciempozuelos/Huelva/Arafo map points are municipal approximations;
- national-only rows remain list-only;
- desktop and 390×844 mobile layouts remain usable.

- [ ] **Step 7: Record exact publication evidence**

Update `docs/project-context.md` only if production counts or mapped totals differ from the verified plan, then commit and publish that documentation correction through the same review path.
