import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adaptDiaDetail} from '../packages/ingestion/src/connectors/teamtailor.ts';

test('DIA reconoce entidades HTML en el título estructurado sin cambiar la identidad de la oferta',()=>{
  const title="Cajero/a en Sant Joan d'Alacant";
  const offer={url:'https://empleo.dia.es/jobs/8623898-cajero-a',title};
  const posting={'@type':'JobPosting',identifier:{value:'8623898'},title:'Cajero/a en Sant Joan d&#39;Alacant',datePosted:'2026-10-27T12:00:00Z',description:'Atención al cliente.'};
  const html=`<h1>Cajero/a en Sant Joan d&#39;Alacant</h1><script type="application/ld+json">${JSON.stringify(posting)}</script><div class="prose"><p>Atención al cliente.</p></div>`;
  const job=adaptDiaDetail(offer,html,'2026-10-27T13:00:00Z',()=>null);
  assert.equal(job.id,'TEAMTAILOR-DIA-8623898');
  assert.equal(job.title,title);
  assert.equal(job.sourceUrl,offer.url);
  assert.throws(()=>adaptDiaDetail({...offer,url:'https://empleo.dia.es/jobs/1234567-cajero-a'},html,'2026-10-27T13:00:00Z',()=>null),/no corresponde/);
});
