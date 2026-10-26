import {fileURLToPath} from 'node:url';
import {createSubmissionStore} from './submissions.mjs';
const [action,id]=process.argv.slice(2);
const store=createSubmissionStore(process.env.GEOEMPLEO_SUBMISSIONS_DB||fileURLToPath(new URL('../../var/submissions/private.sqlite',import.meta.url)));
try{
 if(action==='list')console.log(JSON.stringify(store.pending(),null,2));
 else if(['approve','reject'].includes(action)&&id){store.review(id,action==='approve'?'published':'rejected');console.log('Revisión guardada.');}
 else throw new Error('Uso: node apps/web-preview/moderate.mjs list | approve ID | reject ID');
}catch(error){console.error(error.message);process.exitCode=1;}finally{store.close();}
