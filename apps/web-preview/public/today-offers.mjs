const spainDateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});

export function dayInSpain(value=new Date()) {
  return spainDateFormatter.format(value);
}

export function isOfferOnDay(call,day) {
  const publishedAt=call?.publishedAt;
  if(typeof publishedAt!=='string')return false;
  if(/^\d{4}-\d{2}-\d{2}$/.test(publishedAt))return publishedAt===day;
  const timestamp=Date.parse(publishedAt);
  return Number.isFinite(timestamp)&&dayInSpain(new Date(timestamp))===day;
}

export function newestOfferFirst(left,right) {
  const leftDate=Date.parse(left.publishedAt??'');
  const rightDate=Date.parse(right.publishedAt??'');
  return (Number.isFinite(rightDate)?rightDate:0)-(Number.isFinite(leftDate)?leftDate:0);
}

export function readTodayFilter(params) {
  const days=params.getAll('day');
  const onlyValues=params.getAll('onlyToday');
  if(days.length>1||onlyValues.length>1||onlyValues.length&&onlyValues[0]!=='1')throw new TypeError('Parámetros del día inválidos');
  const day=days[0]??null;
  if(day!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day))throw new TypeError('Día inválido');
  const onlyToday=onlyValues.length===1;
  if(onlyToday&&!day)throw new TypeError('Falta el día');
  return {day,onlyToday};
}
