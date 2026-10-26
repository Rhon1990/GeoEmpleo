import type { SuccessFactorsBoard } from './successfactors.ts';

const jobPathPattern=/^\/job\/[^/]+\/\d+\/$/;

export const successFactorsBoards: readonly SuccessFactorsBoard[] = [
  {
    sourceId:'successfactors-vithas',hostname:'empleo.vithas.es',employer:'Vithas',
    listingPath:'/search/?createNewAlert=false&q=&locationsearch=',jobPathPattern,
    category:'sanidad',categoryLabel:'Sanidad y salud',sourceLabel:'Vithas · empleo oficial',
    pageSize:25,maxPages:40,
  },
  {
    sourceId:'successfactors-mapfre',hostname:'jobs.mapfre.com',employer:'MAPFRE',
    listingPath:'/go/PROFESIONALES/3296401/',jobPathPattern,
    category:'otros',categoryLabel:'Banca y seguros',sourceLabel:'MAPFRE · empleo oficial',
    pageSize:25,maxPages:40,
  },
  {
    sourceId:'successfactors-capgemini',hostname:'careers.capgemini.com',employer:'Capgemini',
    listingPath:'/search/?q=&locationsearch=Spain',jobPathPattern,
    category:'tecnologia',categoryLabel:'Tecnología y consultoría',sourceLabel:'Capgemini · empleo oficial',
    pageSize:25,maxPages:40,
  },
];
