/** Adds an accessible in-list search while keeping a native select as the value source. */
export function focusSearchOnOpen(search,{matchMedia=globalThis.matchMedia}={}) {
  if(typeof matchMedia==='function'&&matchMedia('(max-width:780px)').matches)return false;
  search.focus();
  return true;
}

export function enhanceSearchableSelect(select,{label,searchPlaceholder='Buscar…'}={}) {
  if(!select||!label)throw new TypeError('Selector y etiqueta requeridos');
  const wrapper=document.createElement('div');wrapper.className='searchable-select';
  select.parentNode.insertBefore(wrapper,select);wrapper.append(select);select.hidden=true;
  const trigger=document.createElement('button');trigger.type='button';trigger.className='searchable-select-trigger';
  trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.textContent=select.selectedOptions[0]?.textContent??'';
  const panel=document.createElement('div');panel.className='searchable-select-panel';panel.hidden=true;
  const search=document.createElement('input');search.type='search';search.className='searchable-select-search';search.placeholder=searchPlaceholder;
  search.setAttribute('aria-label',label);search.autocomplete='off';
  const list=document.createElement('div');list.className='searchable-select-options';list.setAttribute('role','listbox');
  const listId=`${select.id}-options`;list.id=listId;trigger.setAttribute('aria-controls',listId);search.setAttribute('aria-controls',listId);
  panel.append(search,list);wrapper.append(trigger,panel);
  let activeIndex=-1;
  function render(){
    const query=search.value.trim().toLocaleLowerCase('es');
    const options=[...select.options].filter(option=>option.textContent.toLocaleLowerCase('es').includes(query));
    list.replaceChildren();activeIndex=-1;
    for(const option of options){
      const button=document.createElement('button');button.type='button';button.className='searchable-select-option';
      button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===select.value));button.textContent=option.textContent;
      button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close();trigger.focus();});list.append(button);
    }
    if(!options.length){const empty=document.createElement('p');empty.className='searchable-select-empty';empty.textContent='No hay resultados';list.append(empty);}
  }
  function open(){render();panel.hidden=false;trigger.setAttribute('aria-expanded','true');search.value='';render();focusSearchOnOpen(search);}
  function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');}
  trigger.addEventListener('click',()=>panel.hidden?open():close());
  search.addEventListener('input',render);
  search.addEventListener('keydown',event=>{
    const options=[...list.querySelectorAll('[role="option"]')];
    if(event.key==='Escape'){event.preventDefault();close();trigger.focus();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();activeIndex=Math.max(0,Math.min(options.length-1,activeIndex+(event.key==='ArrowDown'?1:-1)));
      options.forEach((option,index)=>option.classList.toggle('active',index===activeIndex));options[activeIndex]?.scrollIntoView({block:'nearest'});
    }
    if(event.key==='Enter'&&options[activeIndex]){event.preventDefault();options[activeIndex].click();}
  });
  document.addEventListener('click',event=>{if(!wrapper.contains(event.target))close();});
  select.addEventListener('change',()=>{trigger.textContent=select.selectedOptions[0]?.textContent??'';});
  return {refresh(){trigger.textContent=select.selectedOptions[0]?.textContent??'';if(!panel.hidden)render();}};
}
