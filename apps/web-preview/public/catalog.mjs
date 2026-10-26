import {matchesGeography} from './geography.mjs';

/**
 * @typedef {object} Call
 * @property {string} id
 * @property {string} title
 * @property {string} employer
 * @property {string} city
 * @property {string} province
 * @property {string} region
 * @property {string} category
 * @property {string} categoryLabel
 * @property {{point?:number[]|null}} location
 */
const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();

export function employerFacet(value) {
  const normalized=normalize(value);
  if(/^mcdonald(?:['´’]?s?)(?:\s|$)/u.test(normalized))return {id:'mcdonalds',label:'McDonald’s'};
  return {id:normalized.replace(/[^\p{L}\p{N}]+/gu,'-'),label:value};
}

/** @param {Call[]} calls @param {{q?:string, city?:string, category?:string, employer?:string,origin?:number[]|null,radiusKm?:number|null,bounds?:number[]|null}} filters */
export function searchCalls(calls, filters = {}) {
  const terms = normalize(filters.q ?? '').split(/\s+/).filter(Boolean);
  const territory = normalize(filters.city ?? '');
  const employer = normalize(filters.employer ?? '');
  return calls.filter(call => {
    const text = normalize([call.title, call.employer, call.city, call.province, call.region].join(' '));
    return terms.every(term => text.includes(term))
      && (!territory || [call.city, call.province, call.region].some(value => normalize(value) === territory))
      && (!employer || employerFacet(call.employer).id === employerFacet(employer).id)
      && (!filters.category || call.category === filters.category)
      && matchesGeography(call,filters);
  });
}
