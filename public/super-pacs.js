// Super PACs: every independent expenditure in the cycle, by committee and candidate, from the FEC's own totals
// (schedules/schedule_e/by_candidate), with each spender's committee type and, for the biggest super PACs, their largest
// gifts. Shared by the refresh (src/feeds.mjs, "super-pacs"), which reads it, and the Super PACs page, which shows it.
// Organizations that give are named; individuals are only added up, as everywhere on this site.

// The FEC's committee types that are super PACs: O (independent expenditure-only) and V, W (hybrid PACs with a
// non-contribution account). Other spenders (parties, ordinary PACs, people and groups filing on their own) are
// kept apart.
export const SUPER_PAC_TYPES=new Set(['O','V','W']);
export const TYPE_LABEL={O:'Super PAC',V:'Hybrid PAC',W:'Hybrid PAC',U:'Single-candidate super PAC',I:'Independent spender',X:'Party committee',Y:'Party committee',Z:'Party committee',Q:'PAC',N:'PAC',C:'Communication cost filer',E:'Electioneering communication filer'};
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const cents=n=>Math.round(n*100)/100;

// One row of the FEC's totals by committee and candidate, as the refresh keeps it.
export function ieRow(r){
  const so=String(r?.support_oppose_indicator||'').toUpperCase();
  if(!/^C\d{8}$/.test(r?.committee_id||'')||!r?.candidate_id||!['S','O'].includes(so))return null;
  return {id:`ie:${r.committee_id}:${r.candidate_id}:${so}`,cmte:r.committee_id,cmteName:String(r.committee_name||'').trim()||null,cand:r.candidate_id,candName:String(r.candidate_name||'').trim()||null,
    so,total:cents(num(r.total)),count:num(r.count)};
}
// A committee record's type, from the FEC's committee list.
export const typeRow=c=>/^C\d{8}$/.test(c?.committee_id||'')?{id:`cm:${c.committee_id}`,cmte:c.committee_id,name:String(c.name||'').trim(),type:String(c.committee_type||'').toUpperCase()||null,designation:c.designation||null}:null;
// A super PAC's largest gifts on one page of its receipts: organizations by name, individuals added up without names.
export function donorRow(cmte,results){
  const orgs=new Map();let indiv=0,n=0;
  for(const r of results||[]){
    if(String(r?.memo_code||'').toUpperCase()==='X')continue;
    const amt=num(r.contribution_receipt_amount);if(!(amt>0))continue;
    const ent=String(r.entity_type||'').toUpperCase();
    if(ent==='IND'||r.is_individual===true){indiv+=amt;n++;continue;}
    const name=String(r.contributor_name||'').trim();if(!name)continue;
    const o=orgs.get(name)||{name,amount:0,n:0};o.amount=cents(o.amount+amt);o.n++;orgs.set(name,o);
  }
  return {id:`don:${cmte}`,cmte,orgs:[...orgs.values()].sort((a,b)=>b.amount-a.amount).slice(0,25),indiv:{total:cents(indiv),n},read:(results||[]).length};
}
// The page's data: each super PAC with what it spent for and against each candidate, its type and its largest gifts.
export function superPacSummary(rows,{cycle,limit=300}={}){
  const types=new Map(),donors=new Map(),by=new Map();
  for(const r of rows||[]){
    if(r.id?.startsWith('cm:'))types.set(r.cmte,r);
    else if(r.id?.startsWith('don:'))donors.set(r.cmte,r);
  }
  for(const r of rows||[]){
    if(!r.id?.startsWith('ie:'))continue;
    const o=by.get(r.cmte)||{id:r.cmte,name:types.get(r.cmte)?.name||r.cmteName||r.cmte,type:types.get(r.cmte)?.type||null,total:0,for:0,against:0,count:0,cands:new Map()};
    o.total+=r.total;o[r.so==='S'?'for':'against']+=r.total;o.count+=r.count;
    const c=o.cands.get(r.cand)||{cand:r.cand,name:r.candName,for:0,against:0};c[r.so==='S'?'for':'against']+=r.total;o.cands.set(r.cand,c);
    by.set(r.cmte,o);
  }
  const all=[...by.values()].map(o=>({...o,total:cents(o.total),for:cents(o.for),against:cents(o.against),
    cands:[...o.cands.values()].map(c=>({...c,for:cents(c.for),against:cents(c.against)})).sort((a,b)=>b.for+b.against-(a.for+a.against)).slice(0,60),
    donors:donors.get(o.id)?{orgs:donors.get(o.id).orgs,indiv:donors.get(o.id).indiv,read:donors.get(o.id).read}:null})).sort((a,b)=>b.total-a.total);
  const supers=all.filter(o=>SUPER_PAC_TYPES.has(o.type)),others=all.filter(o=>!SUPER_PAC_TYPES.has(o.type));
  const sum=(l,k)=>cents(l.reduce((t,o)=>t+o[k],0));
  return {cycle,superPacs:supers.slice(0,limit),count:supers.length,total:sum(supers,'total'),for:sum(supers,'for'),against:sum(supers,'against'),
    others:{count:others.length,total:sum(others,'total'),top:others.slice(0,25).map(o=>({id:o.id,name:o.name,type:o.type,total:o.total}))},untyped:all.filter(o=>!o.type).length};
}
