import test from 'node:test';
import assert from 'node:assert/strict';
import {dayInSpain,isOfferOnDay,readTodayFilter} from '../apps/web-preview/public/today-offers.mjs';

test('el día de las ofertas sigue el calendario de España incluso al cruzar la medianoche UTC',()=>{
  assert.equal(dayInSpain(new Date('2026-11-17T23:30:00Z')),'2026-11-18');
  assert.equal(isOfferOnDay({publishedAt:'2026-11-17T23:30:00Z'},'2026-11-18'),true);
  assert.equal(isOfferOnDay({publishedAt:'2026-11-17',checkedAt:'2026-11-18T06:00:00Z'},'2026-11-18'),false);
  assert.equal(isOfferOnDay({publishedAt:'2026-11-18',dateKind:'observed'},'2026-11-18'),true);
});

test('el filtro del día exige una fecha real y un único indicador de activación',()=>{
  assert.deepEqual(readTodayFilter(new URLSearchParams({day:'2026-11-17',onlyToday:'1'})),{day:'2026-11-17',onlyToday:true});
  for(const query of ['day=2026-02-31','day=2026-11-17&day=2026-11-18','onlyToday=1','day=2026-11-17&onlyToday=0']){
    assert.throws(()=>readTodayFilter(new URLSearchParams(query)),/día/i);
  }
});
