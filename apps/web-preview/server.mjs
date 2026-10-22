import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { previewAsset,resolvePreviewPath } from './routing.mjs';
import { publicMapConfig } from './config.mjs';
import { parseEnv } from 'node:util';
import {createJobStore} from './job-store.mjs';
import {createPlacesStore} from './places-store.mjs';
import { randomBytes } from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createSubmissionStore} from './submissions.mjs';
import {createSubmissionHandler} from './submission-api.mjs';

const root = new URL('./public/', import.meta.url);
const submissions=createSubmissionStore(process.env.GEOEMPLEO_SUBMISSIONS_DB||fileURLToPath(new URL('../../var/submissions/private.sqlite',import.meta.url)));
const handleSubmission=createSubmissionHandler(submissions);
const jobStore=createJobStore(new URL('./public/data/calls.json',import.meta.url),()=>submissions.publicJobs());
const placesStore=createPlacesStore(new URL('./data/spain-places.json.gz',import.meta.url));
const server = createServer(async (request,response) => {
  if(await handleSubmission(request,response))return;
  if (!['GET','HEAD'].includes(request.method)) {
    response.writeHead(405, {'Allow':'GET, HEAD'}); response.end(); return;
  }
  const path = resolvePreviewPath(request.url);
  if (path === null) {response.writeHead(400); response.end('Solicitud incorrecta'); return;}
  if(path==='/api/jobs' || path==='/api/job' || path==='/api/places') {
    try {
      const params=new URL(request.url,'http://127.0.0.1').searchParams;
      if(path==='/api/job' && params.getAll('id').length!==1) throw new TypeError('ID inválido');
      const result=path==='/api/places'?await placesStore.query(params):path==='/api/jobs'?await jobStore.query(params):await jobStore.detail(params.get('id'));
      const status=result===null?404:200;
      response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(request.method==='HEAD'?undefined:JSON.stringify(result??{error:'Oferta no disponible'}));
    } catch(error) {
      response.writeHead(error instanceof TypeError?400:503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(request.method==='HEAD'?undefined:JSON.stringify({error:error instanceof TypeError?'Parámetros inválidos':'Catálogo temporalmente no disponible'}));
    }
    return;
  }
  if (path === '/config.json') {
    try {
      let environment = {};
      try {environment = parseEnv(await readFile(process.env.GEOEMPLEO_ENV_FILE || new URL('../../.env.local',import.meta.url),'utf8'));}
      catch(error) {if(error.code !== 'ENOENT') throw error;}
      const body = JSON.stringify(publicMapConfig(environment));
      response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {response.writeHead(503); response.end('Configuración no disponible');}
    return;
  }
  const asset = previewAsset(path);
  if (!asset) {response.writeHead(404); response.end('No encontrado'); return;}
  try {
    const nonce = randomBytes(18).toString('base64');
    let body = await readFile(new URL(asset[0], root));
    if (asset[0].endsWith('.html')) body = Buffer.from(body.toString().replaceAll('__CSP_NONCE__',nonce));
    response.writeHead(200, {
      'Content-Type':asset[1], 'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
      'Content-Security-Policy':`default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com; connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.google.com; font-src https://fonts.gstatic.com; frame-src https://*.google.com; worker-src blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {response.writeHead(500); response.end('Vista no disponible');}
});
server.on('error',error => {console.error(`No se pudo iniciar la vista local: ${error.message}`); process.exitCode = 1;});
server.listen(4310,'127.0.0.1',() => console.log('GeoEmpleo local: http://127.0.0.1:4310'));
