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

/** @param {Call[]} calls @param {{q?:string, city?:string, category?:string,origin?:number[]|null,radiusKm?:number|null,bounds?:number[]|null}} filters */
export function searchCalls(calls, filters = {}) {
  const terms = normalize(filters.q ?? '').split(/\s+/).filter(Boolean);
  const territory = normalize(filters.city ?? '');
  return calls.filter(call => {
    const text = normalize([call.title, call.employer, call.city, call.province, call.region].join(' '));
    return terms.every(term => text.includes(term))
      && (!territory || [call.city, call.province, call.region].some(value => normalize(value) === territory))
      && (!filters.category || call.category === filters.category)
      && matchesGeography(call,filters);
  });
}
