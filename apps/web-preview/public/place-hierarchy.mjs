import {normalizePlaceSearchText,placeCommunities,placeProvinces} from './place-suggestions.mjs?v=20261118-place-hierarchy';
import {focusSearchOnOpen} from './searchable-select.mjs?v=20261125-mobile-search-focus';

export function createPlaceHierarchy({panel,onSelect,onSelectTerritory=()=>{},fetchImpl=fetch,documentRef=globalThis.document}) {
  let community='';
  let province='';
  let selectedPlaceId='';
  let selectedPlaceName='';
  let openLevel='';
  let revision=0;
  let timer;
  let controller;
  const columns={};
  for(const [level,title,placeholder] of [
    ['community','Comunidad','Buscar comunidad'],
    ['province','Provincia','Buscar provincia'],
    ['locality','Localidad o barrio','Buscar localidad o código postal'],
  ]) {
    const column=documentRef.createElement('section');column.className='place-hierarchy-column';column.dataset.level=level;
    const trigger=documentRef.createElement('button');trigger.type='button';trigger.className='place-hierarchy-trigger';
    trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',`place-hierarchy-${level}-menu`);
    const caption=documentRef.createElement('span');caption.textContent=title;
    const value=documentRef.createElement('strong');trigger.append(caption,value);
    const menu=documentRef.createElement('div');menu.id=`place-hierarchy-${level}-menu`;menu.className='place-hierarchy-menu';menu.hidden=true;
    const search=documentRef.createElement('input');search.type='search';search.placeholder=placeholder;search.autocomplete='off';search.setAttribute('aria-label',placeholder);
    const options=documentRef.createElement('div');options.className='place-hierarchy-options';
    menu.append(search,options);column.append(trigger,menu);panel.append(column);
    columns[level]={trigger,value,menu,search,options};
    trigger.addEventListener('click',()=>toggleMenu(level));
  }

  function cancelSearch(){revision++;clearTimeout(timer);controller?.abort();controller=null;}
  function closeMenus(){
    openLevel='';cancelSearch();
    for(const {trigger,menu} of Object.values(columns)){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}
  }
  function toggleMenu(level){
    if(openLevel===level){closeMenus();return;}
    closeMenus();openLevel=level;
    const {trigger,menu,search}=columns[level];menu.hidden=false;trigger.setAttribute('aria-expanded','true');focusSearchOnOpen(search);
    if(level==='locality'&&search.value.trim().length>=2)void searchLocalities();
  }
  function updateTriggers(){
    columns.community.value.textContent=community||'Todas';
    columns.province.value.textContent=province||'Opcional';
    columns.locality.value.textContent=selectedPlaceName||'Opcional';
    columns.province.trigger.disabled=!community;
    columns.locality.trigger.disabled=!province;
  }

  function message(level,value){
    const note=documentRef.createElement('p');note.className='place-hierarchy-empty';note.textContent=value;
    columns[level].options.replaceChildren(note);
  }
  function renderButtons(level,items,action){
    const options=columns[level].options;options.replaceChildren();
    if(!items.length){message(level,'No hay coincidencias');return;}
    for(const item of items){
      const button=documentRef.createElement('button');button.type='button';button.className='place-hierarchy-option';
      if(level!=='locality')button.setAttribute('aria-pressed',String(item===(level==='community'?community:province)));
      button.textContent=item;button.addEventListener('click',()=>action(item));options.append(button);
    }
  }
  const filtered=(items,query)=>items.filter(item=>normalizePlaceSearchText(item).includes(normalizePlaceSearchText(query)));
  function renderCommunities(){renderButtons('community',filtered(placeCommunities(),columns.community.search.value),selectCommunity);}
  function renderProvinces(){
    if(!community){message('province','Primero elige una comunidad');return;}
    renderButtons('province',filtered(placeProvinces(community),columns.province.search.value),selectProvince);
  }
  async function searchLocalities(){
    cancelSearch();
    const query=columns.locality.search.value.trim();
    if(!province){message('locality','Primero elige una provincia');return;}
    if(query.length<2){message('locality','Escribe al menos dos letras o un código postal');return;}
    const current=revision;
    controller=new AbortController();
    message('locality','Buscando localidades…');
    try{
      const response=await fetchImpl(`/api/places?${new URLSearchParams({q:query,province})}`,{signal:controller.signal});
      if(!response.ok)throw new Error('Consulta no disponible');
      const result=await response.json();
      if(current!==revision||result.query!==query)return;
      const options=columns.locality.options;options.replaceChildren();
      if(!result.places.length){message('locality','No hay coincidencias en esta provincia');return;}
      for(const place of result.places){
        const button=documentRef.createElement('button');button.type='button';button.className='place-hierarchy-option';
        button.setAttribute('aria-pressed',String((place.id??place.label)===selectedPlaceId));
        const name=documentRef.createElement('strong');name.textContent=place.name;
        const detail=documentRef.createElement('span');detail.textContent=place.label.slice(place.name.length).replace(/^\s*[—·,]?\s*/,'')||place.province;
        button.append(name,detail);button.addEventListener('click',()=>{
          selectedPlaceId=place.id??place.label;selectedPlaceName=place.name;
          updateTriggers();closeMenus();onSelect(place);
        });options.append(button);
      }
    }catch(error){if(current===revision&&error.name!=='AbortError')message('locality','No se pudieron consultar las localidades. Reintenta.');}
  }
  function selectCommunity(value){
    community=value;province='';selectedPlaceId='';selectedPlaceName='';cancelSearch();columns.province.search.value='';columns.locality.search.value='';
    renderCommunities();renderProvinces();message('locality','Primero elige una provincia');updateTriggers();closeMenus();
    onSelectTerritory({community,province:''});
  }
  function selectProvince(value){
    province=value;selectedPlaceId='';selectedPlaceName='';cancelSearch();columns.locality.search.value='';
    renderProvinces();message('locality','Escribe al menos dos letras o un código postal');updateTriggers();closeMenus();
    onSelectTerritory({community,province});
  }
  columns.community.search.addEventListener('input',renderCommunities);
  columns.province.search.addEventListener('input',renderProvinces);
  columns.locality.search.addEventListener('input',()=>{cancelSearch();timer=setTimeout(()=>void searchLocalities(),220);});
  documentRef.addEventListener('click',event=>{if(!event.composedPath().includes(panel))closeMenus();});
  panel.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&event.target.matches('input[type="search"]')){
      event.preventDefault();columns[openLevel]?.options.querySelector('button')?.click();
    }
    if(event.key==='Escape'&&openLevel){event.stopPropagation();const trigger=columns[openLevel].trigger;closeMenus();trigger.focus();}
  });
  updateTriggers();renderCommunities();renderProvinces();message('locality','Primero elige una provincia');
  return {cancel:cancelSearch,close:closeMenus,setTerritory(value){
    community=placeCommunities().includes(value)?value:placeCommunities().find(item=>placeProvinces(item).includes(value))??'';
    province=community&&community!==value?value:'';
    selectedPlaceId='';selectedPlaceName='';updateTriggers();renderProvinces();
  },reset(){
    closeMenus();community='';province='';selectedPlaceId='';selectedPlaceName='';
    for(const {search} of Object.values(columns))search.value='';
    updateTriggers();renderCommunities();renderProvinces();message('locality','Primero elige una provincia');
  }};
}
