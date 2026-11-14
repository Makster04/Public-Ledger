// Career Totals (the Trackers page's second tab, approved 2026-11-13, in place of the Tiers): every sitting member of
// each chamber ranked by what their campaigns have taken from one tracker over their whole career, in dollar clubs:
//   club    the Million Dollar Club: $1,000,000 or more
//   half    the Half-Million Club: $500,000 to $999,999
//   six     the Six-Figure Club: $100,000 to $499,999
//   under   under $100,000
//   none    none in their career
// A member's career total is every check the tracker's PACs gave their campaigns in every cycle since 1980 (the first in
// the FEC's bulk files), under every candidate ID they've had, plus, for AIPAC, the gifts it collected from donors and
// passed on since its PAC began giving (2022), and, for the Pro-Israel Lobby, the named donors' own checks to their
// campaigns ("donors"), from public/tracker-history.json (scripts/build-corporate-pacs.mjs). Super
// PAC spending isn't in it: the campaign never takes it. Shown only; no grade uses it.
export const CLUB_KEYS=['club','half','six','under','none'];
export const CLUB_LABEL={club:'Million Dollar Club',half:'Half-Million Club',six:'Six-Figure Club',under:'Under $100,000',none:'None, ever'};
export const CLUB_RANGE={club:'$1,000,000 or more',half:'$500,000 – $999,999',six:'$100,000 – $499,999',under:'$1 – $99,999',none:'$0 in their career'};
export const CLUB_MIN={club:1e6,half:5e5,six:1e5};
const cents=n=>Math.round(n*100)/100;

// The club for a career total (null: not read).
export function clubOf(total){
  if(total==null)return null;
  return total>=CLUB_MIN.club?'club':total>=CLUB_MIN.half?'half':total>=CLUB_MIN.six?'six':total>0?'under':'none';
}
// A member's career money from a tracker: {pac, pacs (how many of its PACs gave), routed, donors (the named donors' own
// checks), total, first, last (the first and last cycles with some)}, or null when the file hasn't read them.
export function careerAmount(h,key,id){
  if(!h?.people?.[id])return null;
  const v=h.trackers?.[key]?.[id],pac=v?Math.max(0,Number(v[0])||0):0;
  const cycles=key==='aipac'?Object.entries(h.routed?.aipac||{}).filter(([,m])=>Number(m?.[id])>0):[];
  const routed=cents(cycles.reduce((a,[,m])=>a+Number(m[id]),0));
  const given=Object.entries(h.donors?.[key]?.[id]||{}).map(([c,m])=>[Number(c),Object.values(m||{}).reduce((a,x)=>a+(Number(x)||0),0)]).filter(([,a])=>a>0);
  const donors=cents(given.reduce((a,[,x])=>a+x,0));
  const years=[...(v&&pac>0?[v[2],v[3]]:[]),...cycles.map(([c])=>Number(c)),...given.map(([c])=>c)].filter(Number.isFinite);
  return {pac,pacs:v?Number(v[1])||0:0,routed,donors,total:cents(pac+routed+donors),first:years.length?Math.min(...years):null,last:years.length?Math.max(...years):null};
}
// AIPAC's passed-on gifts: the cycles the file has, and those since 2022 it doesn't have yet.
export const routedStatus=h=>({read:h?.routedCycles||[],missing:h?.routedMissing||[]});
// One chamber's ranking for one tracker. members: [{id, name, ...}]. Returns {rows (largest first, then by name, each
// {m, ...careerAmount, rank, club}: members with the same total share a rank), clubs: {club: [rows], ...}, byId: {id:
// row}, read, took, notRead: [members]}.
export function chamberCareer(h,key,members){
  const all=(members||[]).map(m=>({m,a:careerAmount(h,key,m.id)}));
  const rows=all.filter(r=>r.a).map(({m,a})=>({m,...a,club:clubOf(a.total)}))
    .sort((x,y)=>y.total-x.total||String(x.m.name).localeCompare(String(y.m.name)));
  rows.forEach((r,i)=>{r.rank=i&&rows[i-1].total===r.total?rows[i-1].rank:i+1;});
  const clubs=Object.fromEntries(CLUB_KEYS.map(k=>[k,rows.filter(r=>r.club===k)]));
  return {rows,clubs,byId:Object.fromEntries(rows.map(r=>[r.m.id,r])),read:rows.length,took:rows.filter(r=>r.total>0).length,notRead:all.filter(r=>!r.a).map(r=>r.m)};
}
