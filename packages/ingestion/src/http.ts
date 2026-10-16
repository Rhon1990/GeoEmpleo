export type JsonEncoding='utf-8'|'windows-1252';
export interface FetchOptions {fetchImpl?:typeof fetch;timeoutMs?:number;maxBytes?:number;encoding?:JsonEncoding}
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
