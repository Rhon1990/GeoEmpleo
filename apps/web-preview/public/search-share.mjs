const allowedParameters=['q','city','category','employer'];

/** @param {string} currentUrl */
export function shareableSearchUrl(currentUrl) {
  const current=new URL(currentUrl);
  const url=new URL(current.pathname,current.origin);
  for(const key of allowedParameters){
    const value=current.searchParams.get(key)?.trim();
    if(value)url.searchParams.set(key,value);
  }
  return url.searchParams.size?url.href:null;
}

const validOfferId=id=>typeof id==='string'&&id.length>0&&id.length<=120?id:null;

/** Enlace público a un único anuncio, sin filtros ni coordenadas del visitante. */
export function shareableOfferUrl(currentUrl,id) {
  const offerId=validOfferId(id);
  if(!offerId)return null;
  const url=new URL('/',new URL(currentUrl).origin);
  url.searchParams.set('oferta',offerId);
  return url.href;
}

export function offerIdFromUrl(currentUrl) {
  try {
    const ids=new URL(currentUrl).searchParams.getAll('oferta');
    return ids.length===1?validOfferId(ids[0]):null;
  }catch{return null;}
}

export function offerShareMessage(offer) {
  const city=offer.city?.trim()||'';
  const province=offer.province?.trim()||'';
  const location=[city,province.toLocaleLowerCase('es')===city.toLocaleLowerCase('es')?'':province].filter(Boolean).join(', ');
  return ['Creemos que esta oferta te puede interesar:','',offer.title,location?`Ubicación: ${location}`:''].filter((line,index)=>line||index===1).join('\n');
}

export async function shareOffer(offer,url,device) {
  const text=offerShareMessage(offer);
  if(device.share){await device.share({title:offer.title,text,url});return;}
  await device.clipboard.writeText(`${text}\n${url}`);
}
