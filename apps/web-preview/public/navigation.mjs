const guide=document.querySelector('#search-guide');
for(const button of document.querySelectorAll('[data-guide-open]'))button.addEventListener('click',()=>guide.showModal());
for(const id of ['guide-close','guide-start'])document.getElementById(id).addEventListener('click',()=>guide.close());
guide.addEventListener('click',event=>{if(event.target===guide){const r=guide.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)guide.close();}});

const menuToggle=document.querySelector('#site-menu-toggle');
const menuPanel=document.querySelector('#site-menu-panel');
menuPanel.addEventListener('beforetoggle',event=>{
  if(event.newState==='open'){
    const rect=menuToggle.getBoundingClientRect();
    const width=Math.min(240,window.innerWidth-24);
    menuPanel.style.left=`${Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12))}px`;
    menuPanel.style.top=`${rect.bottom+8}px`;
    menuPanel.style.maxHeight=`${Math.max(0,window.innerHeight-rect.bottom-20)}px`;
  }
  const expanded=event.newState==='open';
  menuToggle.setAttribute('aria-expanded',String(expanded));
  menuToggle.setAttribute('aria-label',expanded?'Cerrar menú de navegación':'Abrir menú de navegación');
});
menuPanel.addEventListener('click',event=>{if(event.target.closest('a,button'))menuPanel.hidePopover();},true);
window.addEventListener('resize',()=>{if(menuPanel.matches(':popover-open'))menuPanel.hidePopover();});
