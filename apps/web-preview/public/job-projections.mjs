export const summaryFields=['id','kind','source','sourceId','title','employer','city','province','region','category','categoryLabel','regime','places','sourceUrl','publishedAt','dateKind','checkedAt','closingDate','salary','applicationRegistration','selection','location'];
const mapFields=['id','kind','source','title','employer','city','sourceUrl','location'];
const hasMapPoint=job=>Boolean(job.location?.point);

export function projectFields(job,fields) {
  return Object.fromEntries(fields.map(field=>[field,job[field]]));
}

export function mapSummaries(jobs) {
  return jobs.filter(hasMapPoint).map(job=>projectFields(job,mapFields));
}

export function countMappedJobs(jobs) {
  return jobs.reduce((count,job)=>count+(hasMapPoint(job)?1:0),0);
}
