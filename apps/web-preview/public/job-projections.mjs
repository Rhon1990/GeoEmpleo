export const summaryFields=['id','kind','source','sourceId','title','employer','city','province','region','category','categoryLabel','regime','places','sourceUrl','publishedAt','checkedAt','closingDate','salary','applicationRegistration','selection','location'];
const mapFields=['id','kind','source','title','employer','city','sourceUrl','location'];

export function projectFields(job,fields) {
  return Object.fromEntries(fields.map(field=>[field,job[field]]));
}

export function mapSummaries(jobs) {
  return jobs.filter(job=>job.location?.point).map(job=>projectFields(job,mapFields));
}
