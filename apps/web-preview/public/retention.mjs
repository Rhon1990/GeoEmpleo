import {shareableSearchUrl} from './search-share.mjs';

const storageKey='geoempleo-retention-v1';
const maxSearches=10;
const maxOffers=100;
const spainDay=value=>{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const part=type=>parts.find(item=>item.type===type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

/** Guardados públicos del dispositivo; no almacena GPS ni perfiles.
 * @param {{storage?:Pick<Storage,'getItem'|'setItem'>,now?:()=>Date}} options
 */
export function createRetentionStore({storage=globalThis.localStorage,now=()=>new Date()}={}) {
  /** @type {{lastVisitAt:string|null,searches:Array<{href:string,label:string}>,offers:Array<{id:string,title:string,employer:string,city:string,province:string,source:string}>}} */
  let state={lastVisitAt:null,searches:[],offers:[]};
  try {
    const saved=JSON.parse(storage?.getItem(storageKey)??'null');
    if(saved&&typeof saved==='object')state={
      lastVisitAt:typeof saved.lastVisitAt==='string'&&!Number.isNaN(Date.parse(saved.lastVisitAt))?saved.lastVisitAt:null,
      searches:Array.isArray(saved.searches)?saved.searches.filter(item=>typeof item?.href==='string'&&item.href.startsWith('/?')&&typeof item.label==='string').slice(0,maxSearches):[],
      offers:Array.isArray(saved.offers)?saved.offers.filter(item=>typeof item?.id==='string'&&item.id.length<=120).map(item=>({
        id:item.id,
        title:typeof item.title==='string'?item.title.slice(0,200):'',
        employer:typeof item.employer==='string'?item.employer.slice(0,200):'',
        city:typeof item.city==='string'?item.city.slice(0,200):'',
        province:typeof item.province==='string'?item.province.slice(0,200):'',
        source:typeof item.source==='string'?item.source.slice(0,200):'',
      })).slice(0,maxOffers):[],
    };
  }catch{}
  const previousVisit=state.lastVisitAt;
  const persist=()=>{try{storage?.setItem(storageKey,JSON.stringify(state));}catch{}};
  const searchEntry=url=>{
    const safe=shareableSearchUrl(url);
    if(!safe)return null;
    const parsed=new URL(safe);
    if(parsed.pathname!=='/')return null;
    const href=`/${parsed.search}`;
    const label=['q','city','category','employer'].map(key=>parsed.searchParams.get(key)).filter(Boolean).join(' · ');
    return {href,label};
  };
  return {
    previousVisitAt:()=>previousVisit,
    savedSearches:()=>state.searches.slice(),
    savedOffers:()=>state.offers.slice(),
    isSearchSaved:url=>{const entry=searchEntry(url);return Boolean(entry&&state.searches.some(item=>item.href===entry.href));},
    saveSearch(url) {
      const entry=searchEntry(url);
      if(!entry)return false;
      state.searches=[entry,...state.searches.filter(item=>item.href!==entry.href)].slice(0,maxSearches);
      persist();return true;
    },
    removeSearch(href) {state.searches=state.searches.filter(item=>item.href!==href);persist();},
    isOfferSaved:id=>state.offers.some(item=>item.id===id),
    toggleOffer(call) {
      if(typeof call?.id!=='string'||!call.id||call.id.length>120)return false;
      if(state.offers.some(item=>item.id===call.id)){
        state.offers=state.offers.filter(item=>item.id!==call.id);persist();return false;
      }
      const safeText=value=>typeof value==='string'?value.slice(0,200):'';
      state.offers=[{id:call.id,title:safeText(call.title),employer:safeText(call.employer),city:safeText(call.city),province:safeText(call.province),source:safeText(call.source)},...state.offers].slice(0,maxOffers);
      persist();return true;
    },
    isNew(call) {
      if(!previousVisit||typeof call?.publishedAt!=='string')return false;
      if(/^\d{4}-\d{2}-\d{2}$/.test(call.publishedAt))return call.publishedAt>spainDay(previousVisit);
      const published=Date.parse(call.publishedAt);
      return Number.isFinite(published)&&published>Date.parse(previousVisit);
    },
    markVisit() {state.lastVisitAt=new Date(now()).toISOString();persist();},
  };
}
