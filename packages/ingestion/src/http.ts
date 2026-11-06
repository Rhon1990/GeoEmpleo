export type JsonEncoding='utf-8'|'windows-1252';
export interface FetchOptions {fetchImpl?:typeof fetch;timeoutMs?:number;maxBytes?:number;encoding?:JsonEncoding}
export async function retryTransient<T>(operation:()=>Promise<T>):Promise<T> {
  try {return await operation();}
  catch(error) {
    if(!(error instanceof Error)||!(['fetch failed'].includes(error.message)||
      error.name==='AbortError'||error.name==='TimeoutError'||/^HTTP (?:429|5\d\d)$/.test(error.message))) throw error;
    return operation();
  }
}
export async function fetchStatus(url:string,options:FetchOptions={}):Promise<number> {
  const address=new URL(url);
  if(address.protocol!=='https:'||address.username||address.password) throw new TypeError('URL HTTPS requerida');
  const response=await (options.fetchImpl??fetch)(address,{
    headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(options.timeoutMs??40_000),
  });
  await response.body?.cancel();
  return response.status;
}
export interface HtmlProbe {status:number;prefix:string}
export async function fetchHtmlProbe(url:string,options:FetchOptions={}):Promise<HtmlProbe> {
  const address=new URL(url);
  if(address.protocol!=='https:'||address.username||address.password) throw new TypeError('URL HTTPS requerida');
  const response=await (options.fetchImpl??fetch)(address,{
    headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(options.timeoutMs??40_000),
  });
  if(response.status<200||response.status>=300) {
    await response.body?.cancel();
    return {status:response.status,prefix:''};
  }
  const contentType=response.headers.get('content-type')?.toLowerCase();
  if(contentType&&!contentType.includes('html')) {
    await response.body?.cancel();
    throw new TypeError('La fuente no devolvió HTML');
  }
  if(!response.body) return {status:response.status,prefix:''};
  const limit=options.maxBytes??16_384;
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  try {
    while(size<limit) {
      const {done,value}=await reader.read();
      if(done) break;
      const remaining=limit-size;
      chunks.push(value.byteLength<=remaining?value:value.subarray(0,remaining));
      size+=Math.min(value.byteLength,remaining);
      if(size===limit) await reader.cancel();
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return {status:response.status,prefix:new TextDecoder('utf-8').decode(bytes)};
}
export async function fetchHtml(url:string,options:FetchOptions={}):Promise<string> {
  const address=new URL(url);
  if(address.protocol!=='https:'||address.username||address.password) throw new TypeError('URL HTTPS requerida');
  const response=await (options.fetchImpl??fetch)(address,{headers:{accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(options.timeoutMs??40_000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  if(!response.headers.get('content-type')?.toLowerCase().includes('html')) throw new TypeError('La fuente no devolvió HTML');
  const html=await response.text();
  if(html.length>(options.maxBytes??2_000_000)) throw new TypeError('HTML demasiado grande');
  return html;
}
export async function fetchJson(url:string,options:FetchOptions={}):Promise<unknown> {
  if(options.encoding!==undefined&&options.encoding!=='utf-8'&&options.encoding!=='windows-1252') throw new TypeError('Codificación JSON no permitida');
  const address=new URL(url);
  if(address.protocol!=='https:' || address.username || address.password) throw new TypeError('URL HTTPS requerida');
  const maxBytes=options.maxBytes??8_000_000;
  const response=await (options.fetchImpl??fetch)(address,{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(options.timeoutMs??40_000)});
  if(!response.ok) {await response.body?.cancel();throw new Error(`HTTP ${response.status}`);}
  if(!response.headers.get('content-type')?.toLowerCase().includes('json')) {await response.body?.cancel();throw new Error('La fuente no devolvió JSON');}
  if(Number(response.headers.get('content-length')??0)>maxBytes) {await response.body?.cancel();throw new Error('La respuesta supera el tamaño permitido');}
  if(!response.body) throw new Error('Respuesta sin cuerpo JSON');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('La respuesta supera el tamaño permitido');}chunks.push(value);}}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder(options.encoding??'utf-8').decode(bytes));
}
