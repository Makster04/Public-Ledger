// The tracker cards on the Super PACs page (approved 2026-11-26): the share of the candidates a tracker's super PACs
// backed who won, and how it compares with the midterm before. The numbers come from public/midterm-trackers.json
// (scripts/build-midterm-trackers.mjs); public/app.js draws the cards.

// The share of the candidates they backed who won, of those whose race is called: {pct, n, open}, or null when none is.
export function winShare(x){
  const s=x?.supported,n=(s?.n||0)-(s?.open||0);
  return n>0?{pct:Math.round(100*s.won/n),n,open:s.open||0}:null;
}
// This midterm's share against the one before: {dir: 'up' | 'down' | 'same' | 'new', text}, or null without a midterm
// before it. 'new': the tracker's super PACs backed no candidate then.
export function versus(now,before,prevYear){
  if(!now||!prevYear)return null;
  if(!before)return {dir:'new',text:`New this midterm: none in ${prevYear}`};
  if(now.pct>before.pct)return {dir:'up',text:`Up from ${before.pct}% in ${prevYear}`};
  if(now.pct<before.pct)return {dir:'down',text:`Down from ${before.pct}% in ${prevYear}`};
  return {dir:'same',text:`Same as ${prevYear} (${before.pct}%)`};
}
// The midterms to offer: those with any tracker super PAC spending, newest first.
export const midtermYears=d=>Object.keys(d?.years||{}).filter(y=>Object.keys(d.years[y].trackers||{}).length).map(Number).sort((a,b)=>b-a);
// The midterm before one in the file (with or without spending), for the comparison.
export const prevMidterm=(d,year)=>{const all=Object.keys(d?.years||{}).map(Number).sort((a,b)=>b-a);return all[all.indexOf(Number(year))+1]??null;};
