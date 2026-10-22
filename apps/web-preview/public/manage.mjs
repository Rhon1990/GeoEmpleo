function parseCredentials(hash) {
  const params=new URLSearchParams(hash.startsWith('#')?hash.slice(1):hash);
  const id=params.get('id');
  const token=params.get('token');
  if(!id||id.length>200||!token||!/^[a-f0-9]{64}$/.test(token))throw new TypeError('El enlace de gestión no es válido o está incompleto.');
  return {id,token};
}

export function consumeManagementCredentials(locationLike,historyLike) {
  const credentials=parseCredentials(locationLike.hash??'');
  historyLike.replaceState(null,'',`${locationLike.pathname}${locationLike.search??''}`);
  return credentials;
}

async function responseJson(response,fallback) {
  let body={};
  try{body=await response.json();}catch{}
  if(!response.ok)throw new Error(typeof body.error==='string'?body.error:fallback);
  return body;
}

export async function loadSubmissionStatus(credentials,fetchImpl=fetch) {
  const response=await fetchImpl(`/api/submissions/status?id=${encodeURIComponent(credentials.id)}`,{
    method:'GET',headers:{Authorization:`Bearer ${credentials.token}`},
  });
  const result=await responseJson(response,'No se pudo consultar el estado.');
  if(result.id!==credentials.id||typeof result.title!=='string'||typeof result.state!=='string')throw new Error('Respuesta de estado no válida.');
  return /** @type {{id:string,title:string,state:string}} */ (result);
}

export async function withdrawSubmission(credentials,confirmed,fetchImpl=fetch) {
  if(confirmed!==true)throw new TypeError('Debes confirmar expresamente la retirada.');
  const response=await fetchImpl('/api/submissions/withdraw',{
    method:'POST',
    headers:{Authorization:`Bearer ${credentials.token}`,'Content-Type':'application/json'},
    body:JSON.stringify({id:credentials.id}),
  });
  const result=await responseJson(response,'No se pudo retirar la oferta.');
  if(result.id!==credentials.id||result.state!=='withdrawn')throw new Error('Respuesta de retirada no válida.');
  return /** @type {{id:string,state:'withdrawn'}} */ (result);
}

const stateLabels={
  pending_review:'Pendiente de revisión. Todavía no aparece en el buscador.',
  published:'Publicada. La oferta aparece en las consultas que incluyen su ubicación.',
  rejected:'No publicada tras la revisión.',
  withdrawn:'Retirada. Ya no aparece en nuevas consultas.',
};

export async function initializeManagement(doc=document,{fetchImpl=fetch,locationLike=window.location,historyLike=window.history}={}) {
  const status=doc.querySelector('#management-status');
  const panel=doc.querySelector('#withdraw-panel');
  const confirmation=doc.querySelector('#confirm-withdraw');
  const button=doc.querySelector('#withdraw');
  let credentials;
  const render=result=>{
    doc.querySelector('#offer-title').textContent=result.title??'Tu oferta';
    status.textContent=stateLabels[result.state]??'Estado no reconocido.';
    panel.hidden=!['pending_review','published'].includes(result.state);
    confirmation.checked=false;button.disabled=true;
  };
  try{
    credentials=consumeManagementCredentials(locationLike,historyLike);
    render(await loadSubmissionStatus(credentials,fetchImpl));
  }catch(error){status.textContent=error.message;panel.hidden=true;return;}
  confirmation.addEventListener('change',()=>{button.disabled=!confirmation.checked;});
  button.addEventListener('click',async()=>{
    if(!confirmation.checked)return;
    button.disabled=true;status.textContent='Retirando la oferta…';
    try{
      const result=await withdrawSubmission(credentials,confirmation.checked,fetchImpl);
      render({...result,title:doc.querySelector('#offer-title').textContent});
    }catch(error){status.textContent=error.message;button.disabled=!confirmation.checked;}
  });
}

if(typeof document!=='undefined')void initializeManagement();
