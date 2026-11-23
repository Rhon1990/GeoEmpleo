import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {placeCommunities,placeProvinces,samePlaceProvince} from '../apps/web-preview/public/place-suggestions.mjs';

const source=fileURLToPath(new URL('../apps/web-preview/data/spain-places.json.gz',import.meta.url));
const target=fileURLToPath(new URL('../apps/web-preview/public/territory-views.mjs',import.meta.url));
const {places}=JSON.parse(gunzipSync(await readFile(source)).toString('utf8'));
const communities=placeCommunities();
const provinces=communities.flatMap(community=>placeProvinces(community));
const extents=new Map(provinces.map(province=>[province,[Infinity,Infinity,-Infinity,-Infinity]]));

for(const place of places){
  const province=provinces.find(name=>samePlaceProvince(name,place.province));
  if(!province||!Number.isFinite(place.longitude)||!Number.isFinite(place.latitude))continue;
  const bounds=extents.get(province);
  bounds[0]=Math.min(bounds[0],place.longitude);bounds[1]=Math.min(bounds[1],place.latitude);
  bounds[2]=Math.max(bounds[2],place.longitude);bounds[3]=Math.max(bounds[3],place.latitude);
}

function usable(bounds){
  if(!bounds.every(Number.isFinite))throw new Error('Faltan referencias para un territorio');
  const [west,south,east,north]=bounds;
  const lonPadding=Math.max(0,(0.12-(east-west))/2);
  const latPadding=Math.max(0,(0.12-(north-south))/2);
  return [west-lonPadding,south-latPadding,east+lonPadding,north+latPadding].map(value=>Number(value.toFixed(4)));
}

const entries=[];
for(const community of communities){
  const memberBounds=placeProvinces(community).map(province=>extents.get(province));
  entries.push([community,usable([
    Math.min(...memberBounds.map(bounds=>bounds[0])),Math.min(...memberBounds.map(bounds=>bounds[1])),
    Math.max(...memberBounds.map(bounds=>bounds[2])),Math.max(...memberBounds.map(bounds=>bounds[3])),
  ])]);
  for(const province of placeProvinces(community))entries.push([province,usable(extents.get(province))]);
}
const lines=entries.map(([name,bounds])=>`  ${JSON.stringify(name)}:${JSON.stringify(bounds)},`).join('\n');
await writeFile(target,`// Derived from spain-places.json.gz; regenerate with node tools/generate-territory-views.mjs.\nconst areas={\n${lines}\n};\n\nexport function territoryBounds(name){return areas[name]??null;}\n`);
console.log(`Generated ${entries.length} territory views`);
