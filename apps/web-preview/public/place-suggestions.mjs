import {distanceKm} from './geography.mjs';

const provinceCatalog=[
  ['A Coruña','Galicia','Coruña, A','La Coruña'],['Álava','País Vasco','Araba','Araba/Álava'],
  ['Albacete','Castilla-La Mancha'],['Alicante','Comunidad Valenciana','Alacant','Alicante/Alacant'],
  ['Almería','Andalucía'],['Asturias','Principado de Asturias'],['Ávila','Castilla y León'],
  ['Badajoz','Extremadura'],['Barcelona','Cataluña'],['Burgos','Castilla y León'],['Cáceres','Extremadura'],
  ['Cádiz','Andalucía'],['Cantabria','Cantabria'],['Castellón','Comunidad Valenciana','Castelló','Castellón/Castelló'],
  ['Ceuta','Ciudad Autónoma de Ceuta'],['Ciudad Real','Castilla-La Mancha'],['Córdoba','Andalucía'],
  ['Cuenca','Castilla-La Mancha'],['Girona','Cataluña','Gerona'],['Granada','Andalucía'],
  ['Guadalajara','Castilla-La Mancha'],['Guipúzcoa','País Vasco','Gipuzkoa'],['Huelva','Andalucía'],
  ['Huesca','Aragón'],['Illes Balears','Islas Baleares','Baleares'],['Jaén','Andalucía'],
  ['La Rioja','La Rioja','Rioja, La'],['Las Palmas','Canarias','Palmas, Las'],['León','Castilla y León'],
  ['Lleida','Cataluña','Lérida'],['Lugo','Galicia'],['Madrid','Comunidad de Madrid'],['Málaga','Andalucía'],
  ['Melilla','Ciudad Autónoma de Melilla'],['Murcia','Región de Murcia'],
  ['Navarra','Comunidad Foral de Navarra'],['Ourense','Galicia','Orense'],['Palencia','Castilla y León'],
  ['Pontevedra','Galicia'],['Salamanca','Castilla y León'],['Santa Cruz de Tenerife','Canarias'],
  ['Segovia','Castilla y León'],['Sevilla','Andalucía'],['Soria','Castilla y León'],['Tarragona','Cataluña'],
  ['Teruel','Aragón'],['Toledo','Castilla-La Mancha'],['Valencia','Comunidad Valenciana','València','Valencia/València'],
  ['Valladolid','Castilla y León'],['Vizcaya','País Vasco','Bizkaia'],['Zamora','Castilla y León'],['Zaragoza','Aragón'],
];
const provinceRegions=new Map();
const provinceCanonical=new Map();
for(const [province,region,...aliases] of provinceCatalog)for(const name of [province,...aliases]){
  const key=normalizePlaceSearchText(name);
  provinceRegions.set(key,region);provinceCanonical.set(key,normalizePlaceSearchText(province));
}

export function placeCommunities(){return [...new Set(provinceCatalog.map(([,region])=>region))].sort((a,b)=>a.localeCompare(b,'es'));}
export function placeProvinces(region){return provinceCatalog.filter(([,itemRegion])=>itemRegion===region).map(([province])=>province).sort((a,b)=>a.localeCompare(b,'es'));}
export function samePlaceProvince(left,right){
  const key=value=>{const normalized=normalizePlaceSearchText(value);return provinceCanonical.get(normalized)??normalized;};
  return key(left)===key(right);
}

export function normalizePlaceSearchText(value) {
  return String(value??'').trim().normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

export function placeRegion(place) {
  return provinceRegions.get(normalizePlaceSearchText(place?.province))??'';
}

export function placeSearchText(place) {
  return [place.name,place.label,place.municipality,place.province,placeRegion(place),...(place.aliases??[]),...(place.postalCodes??[])].join(' ');
}

export function formatPlaceSuggestion(place) {
  const region=placeRegion(place);
  const context=[place.name,place.municipality,place.province,region].filter(Boolean);
  const parts=context.filter((value,index)=>context.findIndex(item=>normalizePlaceSearchText(item)===normalizePlaceSearchText(value))===index);
  const postalCodes=place.postalCodes??[];
  const postalSummary=postalCodes.length>8?`${postalCodes.slice(0,3).join(', ')} y ${postalCodes.length-3} más`:postalCodes.join(', ');
  return `${parts.join(' — ')}${postalCodes.length?` / CP ${postalSummary}`:''}`;
}

function suggestionScore(place,value) {
  const names=[place.name,...(place.aliases??[])].map(normalizePlaceSearchText);
  const exactName=names.includes(value);
  const exactMunicipality=normalizePlaceSearchText(place.municipality)===value;
  if(exactName&&exactMunicipality&&place.precision==='locality')return 0;
  if(exactName&&place.precision==='locality')return 1;
  if(exactName)return 2;
  if(exactMunicipality)return 3;
  if(place.postalCodes?.includes(value))return 4;
  if(names.some(name=>name.startsWith(value)))return 5;
  return 6;
}

export function rankPlaceSuggestions(places,query) {
  const value=normalizePlaceSearchText(query);
  return places.map((place,index)=>({place,index,score:suggestionScore(place,value)}))
    .sort((a,b)=>a.score-b.score||a.place.label.localeCompare(b.place.label,'es')||a.index-b.index)
    .map(item=>item.place);
}

function samePlace(a,b) {
  return normalizePlaceSearchText(a.name)===normalizePlaceSearchText(b.name)
    &&normalizePlaceSearchText(a.province)===normalizePlaceSearchText(b.province)
    &&distanceKm([a.longitude,a.latitude],[b.longitude,b.latitude])<=0.1;
}

function combined(primary,secondary) {
  const postalCodes=[...new Set([...(primary.postalCodes??[]),...(secondary.postalCodes??[])])].sort((a,b)=>a.localeCompare(b,'es'));
  const aliases=[...new Set([...(primary.aliases??[]),...(secondary.aliases??[])])];
  const label=(primary.label??`${primary.name} · ${primary.province}`).replace(/\s*\([^()]*\)\s*$/,'');
  return {
    ...primary,
    ...(postalCodes.length?{postalCodes}:{}),
    ...(aliases.length?{aliases}:{}),
    label:postalCodes.length?`${label} (${postalCodes.join(', ')})`:label,
  };
}

export function mergeEquivalentPlaces(places) {
  const merged=[];
  const groups=new Map();
  for(const place of places) {
    const key=`${normalizePlaceSearchText(place.name)}\u0000${normalizePlaceSearchText(place.province)}`;
    const candidates=key!=='\u0000'?(groups.get(key)??[]):[];
    const group=candidates.find(candidate=>samePlace(candidate.place,place));
    if(!group){
      const next={place,index:merged.length};
      merged.push(place);
      if(key!=='\u0000'){
        candidates.push(next);
        groups.set(key,candidates);
      }
      continue;
    }
    const current=merged[group.index];
    const primary=current.precision==='locality'||place.precision!=='locality'?current:place;
    const secondary=primary===current?place:current;
    merged[group.index]=combined(primary,secondary);
    group.place=merged[group.index];
  }
  return merged;
}
