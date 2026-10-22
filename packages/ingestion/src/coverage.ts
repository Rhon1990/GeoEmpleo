import {canonicalSpanishProvince,listSpanishProvinces} from './national-geography.ts';

interface SourceCoverage {sourceId:string;postings:number;mapped:number;oldestCheckedAt:string;newestCheckedAt:string}
interface TerritoryCoverage {province:string;region:string;postings:number;mapped:number;sources:SourceCoverage[]}

function record(input:unknown):Record<string,unknown> {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new TypeError('Registro de cobertura inválido');
  return input as Record<string,unknown>;
}
function text(input:unknown):string {
  if(typeof input!=='string'||!input.trim()) throw new TypeError('Texto de cobertura requerido');
  return input.trim();
}
function timestamp(input:unknown):string {
  const raw=text(input);
  const value=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(raw)?raw.replace(/Z$/,'.000Z'):raw;
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value) throw new TypeError('Fecha de cobertura inválida');
  return value;
}
function validPoint(location:unknown):boolean {
  if(!location||typeof location!=='object') return false;
  const point=(location as Record<string,unknown>).point;
  return Array.isArray(point)&&point.length===2
    &&point.every(value=>typeof value==='number'&&Number.isFinite(value))
    &&point[0]>=-18.5&&point[0]<=4.5&&point[1]>=27.5&&point[1]<=44.5;
}

/** Counts observed postings, not unique vacancies or certified current openings. */
export function buildCoverageReport(input:unknown) {
  const catalog=record(input);
  const catalogCheckedAt=timestamp(catalog.checkedAt);
  if(!Array.isArray(catalog.calls)) throw new TypeError('Catálogo de cobertura inválido');
  const territories:TerritoryCoverage[]=listSpanishProvinces().map(province=>({province:province.name,region:province.region,postings:0,mapped:0,sources:[]}));
  const byProvince=new Map(territories.map(row=>[row.province,row]));
  const unassigned={postings:0,mapped:0};
  const seen=new Set<string>();let mapped=0;let invalidLocations=0;
  for(const raw of catalog.calls) {
    const job=record(raw);const id=text(job.id);
    if(seen.has(id)) throw new TypeError('ID duplicado en catálogo');
    seen.add(id);
    const sourceId=text(job.sourceId);const checkedAt=timestamp(job.checkedAt);
    const province=canonicalSpanishProvince(text(job.province));
    const hasPoint=validPoint(job.location);
    if(job.location!=null&&!hasPoint) invalidLocations++;
    if(hasPoint) mapped++;
    const row=province?byProvince.get(province.name):undefined;
    if(!row){unassigned.postings++;if(hasPoint)unassigned.mapped++;continue;}
    row.postings++;if(hasPoint)row.mapped++;
    let source=row.sources.find(source=>source.sourceId===sourceId);
    if(!source){source={sourceId,postings:0,mapped:0,oldestCheckedAt:checkedAt,newestCheckedAt:checkedAt};row.sources.push(source);}
    source.postings++;if(hasPoint)source.mapped++;
    if(checkedAt<source.oldestCheckedAt)source.oldestCheckedAt=checkedAt;
    if(checkedAt>source.newestCheckedAt)source.newestCheckedAt=checkedAt;
  }
  for(const row of territories)row.sources.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
  const withPostings=territories.filter(row=>row.postings>0).length;
  return {
    catalogCheckedAt,
    note:'Publicaciones conservadas, no vacantes únicas ni cobertura suficiente. Los puntos no acreditan direcciones exactas; las fechas de observación no certifican vigencia.',
    summary:{totalPostings:seen.size,mapped,invalidLocations,territories:territories.length,withPostings,withoutPostings:territories.length-withPostings},
    unassigned,territories,
  };
}
