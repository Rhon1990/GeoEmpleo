import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCoverageReport} from '../packages/ingestion/src/coverage.ts';
const checkedAt='2026-10-19T10:44:19.243Z';
const job=(id:string,province:string,location:unknown=null)=>({id,province,location,sourceId:'example',checkedAt});
const catalog=(calls:unknown[])=>({checkedAt,calls});
test('coverage includes every province and autonomous city even when empty',()=>{
 const report=buildCoverageReport(catalog([]));
 assert.equal(report.territories.length,52);
 assert.equal(new Set(report.territories.map(row=>row.province)).size,52);
 assert.ok(report.territories.some(row=>row.province==='Ceuta'));
 assert.ok(report.territories.some(row=>row.province==='Melilla'));
 assert.equal(report.summary.withoutPostings,52);
});
test('coverage combines provincial aliases and separates mapped from unmapped postings',()=>{
 const report=buildCoverageReport(catalog([job('1','Araba',{point:[-2.67,42.85]}),job('2','Álava')]));
 const row=report.territories.find(row=>row.province==='Álava');
 assert.equal(row?.postings,2);assert.equal(row?.mapped,1);
 assert.deepEqual(row?.sources,[{sourceId:'example',postings:2,mapped:1,oldestCheckedAt:checkedAt,newestCheckedAt:checkedAt}]);
 assert.equal(report.summary.withPostings,1);
});
test('unknown province remains visible in totals without a fabricated province',()=>{
 const report=buildCoverageReport(catalog([job('1','Desconocida')]));
 assert.equal(report.summary.totalPostings,1);
 assert.equal(report.unassigned.postings,1);
 assert.equal(report.summary.withPostings,0);
});
test('invalid coordinates are never counted as points',()=>{
 const report=buildCoverageReport(catalog([job('1','Madrid',{point:[200,40]}),job('2','Madrid',{point:['-3',40]}),job('3','Madrid',{point:[-3,40,0]})]));
 assert.equal(report.summary.mapped,0);assert.equal(report.summary.invalidLocations,3);
});
test('duplicate IDs cannot silently inflate coverage',()=>{
 assert.throws(()=>buildCoverageReport(catalog([job('1','Madrid'),job('1','Segovia')])),/duplicad/);
});
test('bad structure and dates fail instead of producing a misleading report',()=>{
 for(const input of [null,{},catalog([{}]),{checkedAt:'bad',calls:[]},catalog([{...job('1','Madrid'),checkedAt:'bad'}])]) assert.throws(()=>buildCoverageReport(input));
});
test('source observation dates distinguish retained postings from newer observations',()=>{
 const report=buildCoverageReport(catalog([job('1','Madrid'),{...job('2','Madrid'),checkedAt:'2026-10-17T00:00:00.000Z'}]));
 assert.equal(report.territories.find(row=>row.province==='Madrid')?.sources[0]?.oldestCheckedAt,'2026-10-17T00:00:00.000Z');
});
test('accepts existing BOE timestamps without milliseconds and normalizes observations',()=>{
 const report=buildCoverageReport(catalog([{...job('BOE-1','Madrid'),checkedAt:'2026-10-14T11:34:41Z'}]));
 assert.equal(report.territories.find(row=>row.province==='Madrid')?.sources[0]?.oldestCheckedAt,'2026-10-14T11:34:41.000Z');
});
