// The tracker cards on the Super PACs page (approved 2026-11-26): the share of the candidates a tracker's super PACs
// backed who won, and how it compares with the election before (two years earlier). The numbers come from public/midterm-trackers.json
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
// This election's share against the one before: {dir: 'up' | 'down' | 'same' | 'new' | 'few', delta (percentage points, for
// up, down and same), text}, or null when there's
// nothing to compare (no election before, or too few candidates now). before: the earlier share; hadBefore: the tracker
// had super PAC money in that election (so no share then means too few candidates, not none).
export function versus(now,before,prevYear,hadBefore=!!before){
  if(!now||now.few||!prevYear)return null;
  if(!before||before.few)return hadBefore?{dir:'few',text:`Too few candidates in ${prevYear} to compare`}:{dir:'new',text:`New this election: none in ${prevYear}`};
  const delta=now.pct-before.pct;
  if(delta>0)return {dir:'up',delta,text:`Up from ${before.pct}% in ${prevYear}`};
  if(delta<0)return {dir:'down',delta,text:`Down from ${before.pct}% in ${prevYear}`};
  return {dir:'same',delta:0,text:`Same as ${prevYear} (${before.pct}%)`};
}
// The elections to offer: those with any tracker super PAC money, newest first.
export const electionYears=d=>Object.keys(d?.years||{}).filter(y=>Object.keys(d.years[y].trackers||{}).length).map(Number).sort((a,b)=>b-a);
// The election before one in the file (with or without money), for the comparison.
export const prevElection=(d,year)=>{const all=Object.keys(d?.years||{}).map(Number).sort((a,b)=>b-a);return all[all.indexOf(Number(year))+1]??null;};
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
// Whether a tracker had any super PAC money in an election: its own super PACs spent, or its companies gave.
export const hadMoney=x=>!!x&&((x.for||0)+(x.against||0)+(x.gave||0)>0);
// The orders a reader can pick for the cards (approved 2026-11-27).
export const SORTS=[['az','A to Z'],['increase','Biggest increase'],['decline','Biggest decline'],['most','Highest % won'],['least','Lowest % won'],['money','Most money'],['little','Least money']];
// The trackers in the order picked, for one election (Y: its trackers; P: the election before's). By the arrow's points,
// the share who won (not one from too few candidates) or the money the bars show (spent, or a funded tracker's share).
// A card without that number goes after the others; ties and those go A to Z.
export function orderTrackers(trackers,Y,P,how='az'){
  const az=(a,b)=>a.name.localeCompare(b.name);
  if(!SORTS.some(([k])=>k===how)||how==='az')return [...trackers].sort(az);
  const val=t=>{const x=Y?.[t.key];if(!hadMoney(x))return null;const w=winShare(x);
    if(how==='increase'||how==='decline'){const v=versus(w,P?winShare(P[t.key]):null,'before',hadMoney(P?.[t.key]));return typeof v?.delta==='number'?v.delta:null;}
    if(how==='most'||how==='least')return w&&!w.few?w.pct:null;
    return (x.for||0)+(x.against||0);};
  const dir=['decline','least','little'].includes(how)?1:-1;
  return [...trackers].sort((a,b)=>{const x=val(a),y=val(b);if(x==null&&y==null)return az(a,b);if(x==null)return 1;if(y==null)return -1;return dir*(x-y)||az(a,b);});
}
// Names the FEC files under initials, as people know them.
export const SUPER_PAC_NAMES={C00571703:'Senate Leadership Fund',C00504530:'Congressional Leadership Fund',C00495028:'House Majority PAC',
  C00484642:'Senate Majority PAC',C00865444:'WinSenate',C00892471:'MAGA Inc.',C00825851:'Make America Great Again Inc.',
  C00687103:'Americans for Prosperity Action',C00799031:'United Democracy Project',C00669259:'Future Forward PAC',C00492140:'American Bridge 21st Century'};
