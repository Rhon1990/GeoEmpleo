import type {CityResolver} from './bizneo.ts';
import type {PublicJob} from '../model.ts';
import {canonicalSpanishProvince} from '../national-geography.ts';
import {attribute,descendants,documentOf,textOf} from './html-dom.ts';
import {dateFromSpanish} from './shared.ts';

export const quironsaludListingUrl='https://careers.talentclue.com/es/company/102ba0383b7d45e10c9679e94613c9a9/jsoffers/modal?op=1';
const sourceId='talentclue-quironsalud';

export function adaptQuironsaludListing(html:string,checkedAt:string,resolveCity:CityResolver):PublicJob[] {
  const rows=descendants(documentOf(html),element=>element.tagName==='tr');
  if(!rows.length)throw new TypeError('Listado Quirónsalud vacío');
  const jobs:PublicJob[]=[];
  const seen=new Set<string>();
  for(const row of rows){
    const cells=descendants(row,element=>element.tagName==='td');
    if(cells.length!==6)continue;
    const employer=textOf(cells[2]!);
    if(!/quir[oó]nsalud/i.test(employer))continue;
    const link=descendants(cells[1]!,element=>element.tagName==='a')[0];
    const raw=link&&attribute(link,'href');
    const match=raw&&/^https:\/\/careers\.talentclue\.com\/es\/node\/(\d+)\/4590\/modal$/.exec(raw);
    if(!match)throw new TypeError('URL Quirónsalud no autorizada');
    const id=match[1]!;
    if(seen.has(id))throw new TypeError('Oferta Quirónsalud duplicada');
    seen.add(id);
    const title=textOf(link!);
    const city=textOf(cells[3]!);
    const provinceRaw=textOf(cells[4]!);
    const publishedAt=dateFromSpanish(textOf(cells[5]!),'Quirónsalud');
    if(!title||!city)continue;
    const province=canonicalSpanishProvince(provinceRaw);
    if(!province&&provinceRaw!=='-')continue;
    const resolved=resolveCity(city,province?.name);
    if(!province&&!resolved)continue;
    jobs.push({kind:'job',sourceId,source:'Quirónsalud · empleo oficial',id:`QUIRONSALUD-${id}`,
      title,employer:'Quirónsalud',city:resolved?.city??city,province:province?.name??resolved!.province,
      region:province?.region??resolved!.region,category:'sanidad',categoryLabel:'Sanidad y salud',
      regime:'Oferta de empleo',places:null,
      paragraphs:[`Oferta publicada por Quirónsalud en ${city}.`,'Consulta la descripción y los requisitos completos en la ficha original.'],
      sourceUrl:raw!,publishedAt,checkedAt,closingDate:null,salary:null,
      applicationRegistration:'external_required',selection:null,location:resolved?.location??null});
  }
  if(!jobs.length)throw new TypeError('Quirónsalud sin ofertas españolas verificables');
  return jobs;
}

export async function fetchQuironsaludOffers(checkedAt:string,resolveCity:CityResolver,fetchImpl:typeof fetch=fetch):Promise<PublicJob[]> {
  const response=await fetchImpl(quironsaludListingUrl,{headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(40_000)});
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('html'))throw new Error('Listado Quirónsalud no disponible');
  const html=await response.text();
  if(html.length>3_000_000)throw new TypeError('Listado Quirónsalud demasiado grande');
  return adaptQuironsaludListing(html,checkedAt,resolveCity);
}
