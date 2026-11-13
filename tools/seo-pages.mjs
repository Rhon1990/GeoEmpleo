const origin='https://geoempleo360.com';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const slug=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const validSource=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)&&!Number.isNaN(Date.parse(value));

function groupsOf(calls,key,labelOf,pathOf,searchOf){
  const groups=new Map();
  for(const call of calls){
    const label=labelOf(call);
    if(!label||!slug(label)||!validSource(call.sourceUrl)||!call.title||!call.employer)continue;
    if(key==='region'&&label.toLocaleLowerCase('es')==='españa')continue;
    const id=key==='region'?label:call.category;
    if(!id)continue;
    if(!groups.has(id))groups.set(id,{label,offers:[]});
    groups.get(id).offers.push(call);
  }
  return [...groups].filter(([,group])=>group.offers.length>=10).map(([id,group])=>({
    label:group.label,
    path:pathOf(id),
    search:searchOf(id),
    offers:group.offers.sort((a,b)=>String(b.publishedAt??'').localeCompare(String(a.publishedAt??''))||String(a.id).localeCompare(String(b.id))),
    type:key,
  }));
}

function pageHtml(page,checkedAt){
  const place=page.type==='region'?`en ${page.label}`:`de ${page.label}`;
  const title=`Ofertas de empleo ${place} | GeoEmpleo360`;
  const description=`Explora ${page.offers.length.toLocaleString('es-ES')} ofertas de empleo ${place}. Consulta empresa, localidad, fecha y fuente original; busca también en el mapa de GeoEmpleo360.`;
  const canonical=`${origin}${page.path}`;
  const items=page.offers.slice(0,20).map(call=>{
    const label=validDate(call.publishedAt)?`${call.dateKind==='observed'?'Detectada':'Publicada'} ${escapeHtml(call.publishedAt.slice(0,10))}`:'Fecha no indicada';
    return `<li><h2><a href="/?oferta=${encodeURIComponent(call.id)}">${escapeHtml(call.title)}</a></h2><p>${escapeHtml(call.employer)} · ${escapeHtml(call.city||call.province||page.label)}</p><p>${label} · ${escapeHtml(call.source||'Fuente original')}</p><a href="${escapeHtml(call.sourceUrl)}" rel="noopener noreferrer" target="_blank">Ver anuncio en la fuente original ↗</a></li>`;
  }).join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><link rel="icon" type="image/png" href="/favicon.png"><meta property="og:type" content="website"><meta property="og:site_name" content="GeoEmpleo360"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/geoempleo360-logo.png"><link rel="stylesheet" href="/seo.css"></head><body><header><a href="/" class="brand"><img src="/geoempleo360-logo.png" width="235" height="67" alt="GeoEmpleo360"></a><a href="/">Explorar mapa y ofertas</a></header><main><p class="eyebrow">EMPLEO EN ESPAÑA</p><h1>${escapeHtml(title.replace(' | GeoEmpleo360',''))}</h1><p>${escapeHtml(description)}</p><p>Catálogo comprobado el ${escapeHtml(checkedAt.slice(0,10))}. La disponibilidad varía por fuente y localidad; comprueba la vigencia de cada anuncio en su origen. Los puntos del mapa representan municipios aproximados, no direcciones exactas.</p><a class="primary" href="/${page.search}">Ver todas las ofertas en el mapa ↗</a><h2>Ofertas recientes</h2><ul class="offers">${items}</ul><a class="primary" href="/${page.search}">Continuar la búsqueda</a></main><footer><a href="/">GeoEmpleo360</a> · Ofertas sin registro · <a href="/privacy.html">Privacidad</a></footer></body></html>`;
}

export function seoPages(calls,checkedAt){
  const pages=[
    ...groupsOf(calls,'region',call=>call.region,id=>`/empleo/${slug(id)}/`,id=>`?${new URLSearchParams({city:id})}`),
    ...groupsOf(calls,'sector',call=>call.categoryLabel,id=>`/empleo/sector/${slug(id)}/`,id=>`?${new URLSearchParams({category:id})}`),
  ].sort((a,b)=>a.label.localeCompare(b.label,'es'));
  const paths=new Set();
  for(const page of pages){if(paths.has(page.path))throw new TypeError(`Ruta SEO duplicada: ${page.path}`);paths.add(page.path);}
  const lastmod=validDate(checkedAt)?`<lastmod>${checkedAt.slice(0,10)}</lastmod>`:'';
  const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/',...pages.map(page=>page.path)].map(path=>`<url><loc>${origin}${path}</loc>${lastmod}</url>`).join('\n')}\n</urlset>\n`;
  return {pages:pages.map(page=>({path:page.path,html:pageHtml(page,checkedAt)})),sitemap};
}
