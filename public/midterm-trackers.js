// The tracker cards on the Super PACs page (approved 2026-11-26): the share of the candidates a tracker's super PACs
// backed who won, and how it compares with the midterm before. The numbers come from public/midterm-trackers.json
// (scripts/build-midterm-trackers.mjs); public/app.js draws the cards.

// A share from fewer candidates than this says "Too few candidates to say" instead (approved 2026-11-26).
export const MIN_CANDIDATES=5;
// For a lobby without its own super PACs, a super PAC counts as backing its candidates once it gave this much.
export const FUNDED_CUTOFF=100000;
// The share of the candidates they backed who won, of those whose race is called: {pct, n, open, few}, or null when
// none is. few: under MIN_CANDIDATES, so not shown as a share.
export function winShare(x,min=MIN_CANDIDATES){
  const s=x?.supported,n=(s?.n||0)-(s?.open||0);
  return n>0?{pct:Math.round(100*s.won/n),n,open:s.open||0,few:n<min}:null;
}
// This midterm's share against the one before: {dir: 'up' | 'down' | 'same' | 'new' | 'few', delta (percentage points, for
// up, down and same), text}, or null when there's
// nothing to compare (no midterm before, or too few candidates now). before: the earlier share; hadBefore: the tracker
// had super PAC money that midterm (so no share then means too few candidates, not none).
export function versus(now,before,prevYear,hadBefore=!!before){
  if(!now||now.few||!prevYear)return null;
  if(!before||before.few)return hadBefore?{dir:'few',text:`Too few candidates in ${prevYear} to compare`}:{dir:'new',text:`New this midterm: none in ${prevYear}`};
  const delta=now.pct-before.pct;
  if(delta>0)return {dir:'up',delta,text:`Up from ${before.pct}% in ${prevYear}`};
  if(delta<0)return {dir:'down',delta,text:`Down from ${before.pct}% in ${prevYear}`};
  return {dir:'same',delta:0,text:`Same as ${prevYear} (${before.pct}%)`};
}
// The midterms to offer: those with any tracker super PAC money, newest first.
export const midtermYears=d=>Object.keys(d?.years||{}).filter(y=>Object.keys(d.years[y].trackers||{}).length).map(Number).sort((a,b)=>b-a);
// The midterm before one in the file (with or without money), for the comparison.
export const prevMidterm=(d,year)=>{const all=Object.keys(d?.years||{}).map(Number).sort((a,b)=>b-a);return all[all.indexOf(Number(year))+1]??null;};
// The arrow's color (approved 2026-11-26): greener the more the share went up, redder the more it went down, from a
// light tint at 1 point to the full color at TREND_FULL points or more. A CSS color for the arrow and its label.
export const TREND_FULL=30;
export function trendColor(delta){
  if(!delta)return null;
  const k=Math.round(35+65*Math.min(1,Math.abs(delta)/TREND_FULL));
  return `color-mix(in oklab, var(${delta>0?'--good':'--crit'}) ${k}%, var(--ink-2))`;
}
// Points as the label under the arrow shows them: "+12 pts", "−35 pts".
export const trendPoints=delta=>`${delta>0?'+':'−'}${Math.abs(delta)} pt${Math.abs(delta)===1?'':'s'}`;
// Whether a tracker had any super PAC money in a midterm: its own super PACs spent, or its companies gave.
export const hadMoney=x=>!!x&&((x.for||0)+(x.against||0)+(x.gave||0)>0);
// Names the FEC files under initials, as people know them.
export const SUPER_PAC_NAMES={C00571703:'Senate Leadership Fund',C00504530:'Congressional Leadership Fund',C00495028:'House Majority PAC',
  C00484642:'Senate Majority PAC',C00865444:'WinSenate',C00892471:'MAGA Inc.',C00825851:'Make America Great Again Inc.',
  C00687103:'Americans for Prosperity Action',C00799031:'United Democracy Project',C00669259:'Future Forward PAC',C00492140:'American Bridge 21st Century'};
