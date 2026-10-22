export function createSubmissionHandler(store){
 const attempts=new Map();
 return async(request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(!['/api/submissions','/api/submissions/status','/api/submissions/withdraw'].includes(url.pathname))return false;
  const send=(status,body)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));return true;};
  const read=url.pathname.endsWith('/status');
  if(request.method!==(read?'GET':'POST'))return send(405,{error:'Método no permitido'});
  // This server is loopback-only. Reject DNS rebinding hosts and cross-origin writes.
  if(! /^(127\.0\.0\.1|localhost):\d+$/.test(request.headers.host??''))return send(403,{error:'Origen no permitido'});
  if(!read&&request.headers.origin!==`http://${request.headers.host}`)return send(403,{error:'Origen no permitido'});
  const now=Date.now();for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
  const key=request.socket.remoteAddress,limit=attempts.get(key)??{count:0,until:now+60000};limit.count++;attempts.set(key,limit);
  if(limit.count>30)return send(429,{error:'Demasiadas solicitudes. Espera un minuto.'});
  try{
   if(read)return send(200,store.status(url.searchParams.get('id'),request.headers.authorization?.replace(/^Bearer /,'')));
   if(request.headers['content-type']?.split(';')[0]!=='application/json')return send(415,{error:'Se requiere JSON'});
   const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>24576)return send(413,{error:'La oferta es demasiado larga'});chunks.push(chunk);}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(url.pathname.endsWith('/withdraw'))return send(200,store.withdraw(body.id,request.headers.authorization?.replace(/^Bearer /,'')));
   return send(201,store.create(body));
  }catch(error){return send(error instanceof TypeError||error instanceof SyntaxError?400:503,{error:error instanceof TypeError?error.message:error instanceof SyntaxError?'JSON inválido':'No se pudo guardar. Inténtalo de nuevo.'});}
 };
}
