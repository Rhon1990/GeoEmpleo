import type { SuccessFactorsBoard } from './successfactors.ts';

const jobPathPattern=/^\/job\/[^/]+\/\d+\/$/;

export const successFactorsBoards: readonly SuccessFactorsBoard[] = [
  {
    sourceId:'successfactors-vithas',hostname:'empleo.vithas.es',employer:'Vithas',
    listingPath:'/search/?createNewAlert=false&q=&locationsearch=',jobPathPattern,
    category:'sanidad',categoryLabel:'Sanidad y salud',sourceLabel:'Vithas · empleo oficial',
    pageSize:25,maxPages:40,
    paginationOffsetParam:'startrow',
  },
  {
    sourceId:'successfactors-mapfre',hostname:'jobs.mapfre.com',employer:'MAPFRE',
    listingPath:'/go/PROFESIONALES/3296401/',jobPathPattern,
    category:'otros',categoryLabel:'Banca y seguros',sourceLabel:'MAPFRE · empleo oficial',
    pageSize:25,maxPages:40,
  },
  {
    sourceId:'successfactors-capgemini',hostname:'careers.capgemini.com',employer:'Capgemini',
    listingPath:'/search/?q=&locationsearch=',jobPathPattern,
    category:'tecnologia',categoryLabel:'Tecnología y consultoría',sourceLabel:'Capgemini · empleo oficial',
    pageSize:25,maxPages:80,paginationOffsetParam:'startrow',
  },
  {
    sourceId:'successfactors-melia',hostname:'careers.melia.com',employer:'Meliá Hotels International',
    listingPath:'/go/Profesionales-de-hotel/8861001/',jobPathPattern,
    category:'hosteleria',categoryLabel:'Turismo y hostelería',sourceLabel:'Meliá · empleo oficial',
    requireCityMentionInTitle:true,skipVerifiedClosed:true,pageSize:25,maxPages:40,
  },
  {
    sourceId:'successfactors-kpmg',hostname:'carreras.kpmg.es',employer:'KPMG',
    listingPath:'/search/?createNewAlert=false&q=&locationsearch=',jobPathPattern,
    category:'otros',categoryLabel:'Otros sectores',sourceLabel:'KPMG · empleo oficial',
    pageSize:100,maxPages:10,paginationOffsetParam:'startrow',skipVerifiedClosed:true,skipEmptyDescription:true,retryTransientErrors:true,
  },
  {
    sourceId:'successfactors-deloitte',hostname:'empleo.es.deloitte.com',employer:'Deloitte',
    listingPath:'/search/?q=',paginationPath:'/tile-search-results/?q=',jobPathPattern,
    category:'tecnologia',categoryLabel:'Tecnología y consultoría',sourceLabel:'Deloitte · empleo oficial',
    listingFormat:'tile',pageSize:25,maxPages:40,paginationOffsetParam:'startrow',retryTransientErrors:true,
    remoteFromDescription:false,
  },
  {
    sourceId:'successfactors-ilunion',hostname:'empleo.ilunion.com',employer:'ILUNION',
    listingPath:'/Ilunion/go/TODAS-LAS-OFERTAS-ILUNION/9135102/',
    paginationPath:'/Ilunion/tile-search-results/category/9135102/',jobPathPattern,
    category:'otros',categoryLabel:'Otros sectores',sourceLabel:'ILUNION · empleo oficial',
    listingFormat:'tile',pageSize:10,maxPages:80,paginationOffsetParam:'startrow',retryTransientErrors:true,skipVerifiedClosed:true,
    requireCityMentionInTitle:true,excludedJobPathPattern:/^\/fundacion-once\/job\/[^/]+\/\d+\/$/,
  },
  {
    sourceId:'stef-oficial',hostname:'apply.stef.jobs',employer:'STEF',
    listingPath:'/search/?createNewAlert=false&q=&locationsearch=',jobPathPattern,
    category:'transporte',categoryLabel:'Transporte y logística',sourceLabel:'STEF · empleo oficial',
    pageSize:20,maxPages:20,paginationOffsetParam:'startrow',
  },
];
