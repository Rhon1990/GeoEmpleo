import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSuccessFactorsListing,
  type SuccessFactorsBoard,
} from '../packages/ingestion/src/connectors/successfactors.ts';
import { successFactorsBoards } from '../packages/ingestion/src/connectors/successfactors-boards.ts';
import { sourceRegistry } from '../packages/ingestion/src/registry.ts';

const stefBoard:SuccessFactorsBoard={
  sourceId:'stef-oficial',hostname:'apply.stef.jobs',employer:'STEF',
  listingPath:'/search/?createNewAlert=false&q=&locationsearch=',jobPathPattern:/^\/job\/[^/]+\/\d+\/$/,
  category:'transporte',categoryLabel:'Transporte y logística',sourceLabel:'STEF · empleo oficial',
  pageSize:20,maxPages:20,paginationOffsetParam:'startrow',
};

test('STEF reconoce el total francés del listado antes de paginar',()=>{
  const html='<span class="paginationLabel">Résultats <b>1 – 20</b> sur <b>266</b></span><table><tr class="data-row"><td><a class="jobTitle-link" href="/job/MADRID-OPERARIO/1455864533/">OPERARIO</a></td><td class="colLocation">MADRID, Madrid, ES, 28001</td><td class="colDate">11 nov. 2026</td></tr></table>';

  const listing=parseSuccessFactorsListing(html,stefBoard);

  assert.equal(listing.totalCount,266);
  assert.equal(listing.pageCount,14);
  assert.equal(listing.offers[0]?.city,'MADRID');
});

test('STEF queda configurada como fuente SuccessFactors española activa',()=>{
  const board=successFactorsBoards.find(item=>item.sourceId==='stef-oficial');

  assert.ok(board);
  assert.equal(board.hostname,'apply.stef.jobs');
  assert.equal(board.listingPath,'/search/?createNewAlert=false&q=&locationsearch=');
  assert.equal(sourceRegistry.get('stef-oficial')?.status,'active');
});
