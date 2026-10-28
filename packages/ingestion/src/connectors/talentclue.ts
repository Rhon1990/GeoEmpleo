import type { PlaceResolver } from '../geography.ts';
import type { PublicJob } from '../model.ts';
import { canonicalSpanishProvince } from '../national-geography.ts';
import { dateFromSpanish } from './shared.ts';
import { attribute, descendants, documentOf, textOf } from './html-dom.ts';

const listingUrl='https://careers.talentclue.com/es/company/6285677f44a78f103ce17087c20ecee7/jsoffers/modal?order=Fecha&sort=asc';

/** Only rows currently listed by McDonald's with verified Spanish locations are published. */
export function adaptTalentClueListing(html:string,checkedAt:string,resolve:PlaceResolver):PublicJob[] {
  const document=documentOf(html);
  const rows=descendants(document,element=>element.tagName==='tr');
  if(rows.length===0) throw new TypeError('Listado TalentClue vacío');
  const jobs:PublicJob[]=[];
  const seen=new Set<string>();
  for(const row of rows){
    const cells=descendants(row,element=>element.tagName==='td');
    if(cells.length!==6) continue;
    const link=descendants(cells[0]!,element=>element.tagName==='a')[0];
    const raw=link?attribute(link,'href'):null;
    const match=raw&&/^https:\/\/careers\.talentclue\.com\/(?:es|en)\/node\/(\d+)\/4590\/modal$/.exec(raw);
    if(!match) throw new TypeError('URL TalentClue no autorizada');
    const id=match[1]!;
    if(seen.has(id)) throw new TypeError('Oferta TalentClue duplicada');
    seen.add(id);
    const title=textOf(link!);
    const employer=textOf(cells[1]!);
    const city=textOf(cells[2]!);
    const province=canonicalSpanishProvince(textOf(cells[3]!));
    const publishedAt=dateFromSpanish(textOf(cells[5]!),'TalentClue');
    if(!title||!city||!province) continue;
    const location=/\b(remoto|varias|nacional)\b/i.test(city)?null:resolve(city,province.name);
    jobs.push({kind:'job',sourceId:'talentclue-mcdonalds',source:"McDonald's · TalentClue",
      id:`TALENTCLUE-MCDONALDS-${id}`,title,employer:employer||"McDonald's",
      city,province:province.name,region:province.region,category:'hosteleria',categoryLabel:'Turismo y hostelería',
      regime:'Oferta de empleo',places:null,
      paragraphs:[`Oferta publicada por ${employer||"McDonald's"} en ${city}.`,
        'La descripción, requisitos y condiciones completos están disponibles en la ficha pública de la empresa.'],
      sourceUrl:raw!,publishedAt,checkedAt,closingDate:null,salary:null,
      applicationRegistration:'external_required',selection:null,location});
  }
  if(!jobs.length) throw new TypeError('TalentClue sin ofertas españolas verificables');
  return jobs;
}

export async function fetchTalentClueListing(fetchImpl:typeof fetch=fetch):Promise<string> {
  const response=await fetchImpl(listingUrl,{headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(40_000)});
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('html')) throw new Error('Listado TalentClue no disponible');
  const html=await response.text();
  if(html.length>2_000_000) throw new TypeError('Listado TalentClue demasiado grande');
  return html;
}

export const talentClueListingUrl=listingUrl;
