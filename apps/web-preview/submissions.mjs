import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
const hash=token=>createHash('sha256').update(token).digest();
const text=(value,max,required=true)=>{if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw new TypeError('Revisa los campos obligatorios.');return value.trim();};
function validate(input){
 if(!input||input.consent!==true||input.locationConfirmed!==true)throw new TypeError('Confirma la ubicación y el permiso de publicación.');
 const data={};
 for(const [name,max] of [['title',160],['employer',160],['description',10000],['city',120],['province',120],['region',120],['address',300],['managerEmail',254]])data[name]=text(input[name],max);
 data.contactEmail=text(input.contactEmail,254,false);data.contactPhone=text(input.contactPhone,30,false);
 const email=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
 if(!email.test(data.managerEmail)||(data.contactEmail&&!email.test(data.contactEmail))||(!data.contactEmail&&!data.contactPhone)||(data.contactPhone&&!/^\+?[\d ()-]{7,30}$/.test(data.contactPhone)))throw new TypeError('Indica correos válidos y al menos un contacto público.');
 const p=input.point;
 if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<-18.3||p[0]>4.4||p[1]<27.5||p[1]>43.9)throw new TypeError('Selecciona un punto dentro de España.');
 data.point=[...p];data.salary=null;
 if(input.salary!==null){
  const s=input.salary;
  if(!s||s.currency!=='EUR'||!['hour','month','year'].includes(s.period)||!['gross','net'].includes(s.basis)||![s.minMinor,s.maxMinor].every(v=>Number.isSafeInteger(v)&&v>0&&v<=10000000000)||s.minMinor>s.maxMinor||(s.paymentsPerYear!==null&&(!Number.isInteger(s.paymentsPerYear)||s.paymentsPerYear<1||s.paymentsPerYear>24||s.period!=='month')))throw new TypeError('Revisa el importe, rango y periodo del salario.');
  data.salary={minMinor:s.minMinor,maxMinor:s.maxMinor,currency:'EUR',period:s.period,basis:s.basis,paymentsPerYear:s.paymentsPerYear,hoursPerWeek:null,paidWeeksPerYear:null};
 }
 return data;
}
export function createSubmissionStore(path){
 mkdirSync(dirname(path),{recursive:true,mode:0o700});const db=new DatabaseSync(path);chmodSync(path,0o600);
 db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY, token_hash BLOB NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);`);
 const get=id=>db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
 function authorize(id,token){
  if(typeof id!=='string'||typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))throw new TypeError('Enlace de gestión no válido.');
  const row=get(id);if(!row||!timingSafeEqual(hash(token),row.token_hash))throw new TypeError('Enlace de gestión no válido.');return row;
 }
 return {
  create(input){const data=validate(input),id=`direct-${randomBytes(16).toString('hex')}`,token=randomBytes(32).toString('hex'),now=new Date().toISOString();db.prepare('INSERT INTO submissions VALUES(?,?,?,?,?,?)').run(id,hash(token),'pending_review',JSON.stringify(data),now,now);return{id,token,state:'pending_review'};},
  status(id,token){const row=authorize(id,token);return{id:row.id,title:JSON.parse(row.data).title,state:row.state};},
  withdraw(id,token){const row=authorize(id,token);if(row.state==='withdrawn')return{id,state:'withdrawn'};if(!['pending_review','published'].includes(row.state))throw new TypeError('Esta oferta no se puede retirar en su estado actual.');db.prepare("UPDATE submissions SET state='withdrawn',updated_at=? WHERE id=? AND state IN ('pending_review','published')").run(new Date().toISOString(),id);return{id,state:'withdrawn'};},
  review(id,state){if(!['published','rejected'].includes(state))throw new TypeError('Decisión inválida.');const result=db.prepare("UPDATE submissions SET state=?,updated_at=? WHERE id=? AND state='pending_review'").run(state,new Date().toISOString(),id);if(result.changes!==1)throw new TypeError('La oferta ya no está pendiente.');},
  pending(){return db.prepare("SELECT id,data,created_at FROM submissions WHERE state='pending_review'").all().map(row=>({id:row.id,...JSON.parse(row.data),createdAt:row.created_at}));},
  publicJobs(){return db.prepare("SELECT * FROM submissions WHERE state='published'").all().map(row=>{const d=JSON.parse(row.data);return{id:row.id,kind:'job',sourceId:'direct-employer',source:'Anunciante en GeoEmpleo',title:d.title,employer:d.employer,city:d.city,province:d.province,region:d.region,category:'otros',categoryLabel:'Otras oportunidades',regime:'Consulta la descripción',places:null,paragraphs:[d.description,`Centro de trabajo declarado: ${d.address}`,`Contacto: ${[d.contactEmail,d.contactPhone].filter(Boolean).join(' · ')}`],sourceUrl:null,publishedAt:row.created_at,checkedAt:row.updated_at,closingDate:null,salary:d.salary,applicationRegistration:'unknown',selection:null,location:{point:d.point,precision:'employer_declared',sourceUrl:null,sourceUpdatedAt:row.created_at,note:'Punto declarado por el anunciante; no verificado de forma independiente.'}};});},
  close(){db.close();}
 };
}
