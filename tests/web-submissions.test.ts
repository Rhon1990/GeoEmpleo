import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSubmissionStore} from '../apps/web-preview/submissions.mjs';
const input={title:'Operario de producción',employer:'Empresa de prueba',description:'Trabajo de producción y preparación de pedidos en el centro indicado.',city:'Villacastín',province:'Segovia',region:'Castilla y León',address:'Centro de trabajo',point:[-4.412,40.779],locationConfirmed:true,managerEmail:'privado@example.org',contactEmail:'empleo@example.org',contactPhone:'',consent:true,salary:{minMinor:150000,maxMinor:170000,currency:'EUR',period:'month',basis:'gross',paymentsPerYear:14,hoursPerWeek:null,paidWeeksPerYear:null}};
async function fixture(run:any){const dir=await mkdtemp(join(tmpdir(),'geo-submissions-'));const path=join(dir,'private.sqlite');const store=createSubmissionStore(path);try{await run(store,path);}finally{store.close();await rm(dir,{recursive:true,force:true});}}
test('pending stays private; approval publishes only public fields; withdrawal persists and cannot be reversed',()=>fixture((store:any,path:string)=>{
 const created=store.create(input);assert.equal(store.publicJobs().length,0);
 assert.throws(()=>store.status(created.id,'bad'));assert.equal(store.status(created.id,created.token).state,'pending_review');
 store.review(created.id,'published');const publicJob=store.publicJobs()[0];assert.equal(publicJob.salary.minMinor,150000);assert.deepEqual(publicJob.location.point,input.point);
 assert.equal(JSON.stringify(publicJob).includes('privado@example.org'),false);assert.equal(JSON.stringify(publicJob).includes(created.token),false);
 assert.throws(()=>store.withdraw(created.id,'bad'));store.withdraw(created.id,created.token);store.withdraw(created.id,created.token);assert.equal(store.publicJobs().length,0);assert.throws(()=>store.review(created.id,'published'));
 const reopened=createSubmissionStore(path);assert.equal(reopened.status(created.id,created.token).state,'withdrawn');reopened.close();
}));
test('reject invalid salary, missing contacts, unconfirmed or invalid coordinates',()=>fixture((store:any)=>{
 for(const invalid of [{salary:{...input.salary,maxMinor:1}},{contactEmail:'',contactPhone:''},{point:[200,100]},{locationConfirmed:false},{consent:false},{managerEmail:'bad'}])assert.throws(()=>store.create({...input,...invalid}));
 const created=store.create({...input,salary:null});assert.equal(store.status(created.id,created.token).state,'pending_review');
}));
test('a credential cannot manage another offer and GET status never withdraws',()=>fixture((store:any)=>{
 const a=store.create(input),b=store.create(input);assert.throws(()=>store.withdraw(b.id,a.token));assert.equal(store.status(a.id,a.token).state,'pending_review');assert.equal(store.status(a.id,a.token).state,'pending_review');
}));
test('una oferta rechazada conserva la decisión de moderación',()=>fixture((store:any)=>{
 const created=store.create(input);store.review(created.id,'rejected');
 assert.throws(()=>store.withdraw(created.id,created.token),/no se puede retirar/i);
 assert.equal(store.status(created.id,created.token).state,'rejected');
}));
