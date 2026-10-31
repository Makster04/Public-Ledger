// The Bills page's list (research.json "billIndex"): every bill behind a saved roll call or on file for Workers > Profit,
// one entry per bill family (a bill, its versions in other Congresses and its companion measures), with the saved votes on
// it and every group position on file for it. Kept apart from app.js so the tests can check it against the research.
import {BILL_GROUPS} from './grades.js';
import {voteBill} from './scoring.js';

// Groups that took sides on bills but give no campaign money tracked here.
export const EXTRA_GROUPS={
  heritage:{org:'Heritage Action for America',about:'Conservative advocacy group, the Heritage Foundation\'s lobbying arm. It scores members of Congress on its key votes.'},
  aclu:{org:'ACLU',about:'Civil-liberties advocacy group. It scores members of Congress on the votes it lobbies on.'}};

// A group's name, whether it has PACs on file, and what those PACs and its outside spending put into the campaigns on
// this site (from each person's funders, research.json funderPos).
export function groupInfo(data,key){
  const gp=(data.groupPos||[]).find(g=>g.key===key);
  let pac=0,out=0;const people=new Set();
  for(const p of [...(data.members||[]),...(data.cands||[]),...(data.featured||[])])for(const f of p.funderPos||[]){
    if(f.key!==key)continue;const a=(f.pac||0),b=(f.for||0)+(f.against||0);pac+=a;out+=b;if(a+b>0)people.add(p.id);}
  return {key,org:gp?.org||BILL_GROUPS[key]?.org||EXTRA_GROUPS[key]?.org||key,about:EXTRA_GROUPS[key]?.about||null,
    pacs:gp?.fecIds?.length||0,pac,out,people:people.size};
}

// Each group's wanted vote on each saved roll call, from the funder comparisons (their scorecards and key-vote letters).
function wantedByVote(data){
  const by=new Map();
  for(const p of [...(data.members||[]),...(data.cands||[]),...(data.featured||[])])for(const f of p.funderPos||[])for(const c of f.compared||[]){
    if(c.wanted!=='Yea'&&c.wanted!=='Nay')continue;
    const m=by.get(c.voteId)||by.set(c.voteId,new Map()).get(c.voteId);if(!m.has(f.key))m.set(f.key,c);}
  return by;
}

// The families, with their votes (newest first) and positions. scored: the Workers > Profit bills with their scores.
export function billFamilies(data,scored=data.bills||[]){
  const keyOf=new Map(),out=[];
  for(const b of data.billIndex||[]){
    const work=scored.find(x=>x.id===b.id)||null;
    const keys=[...new Set([b.id,...(b.versions||[]),...(work?.versions||[])])];
    const e={...b,keys,work,votes:[],positions:[]};out.push(e);
    for(const k of keys)if(!keyOf.has(k))keyOf.set(k,e);
  }
  for(const [list,chamber] of [[data.votes||[],'Senate'],[data.hvotes||[],'House']])for(const v of list){
    const k=voteBill(v),e=k&&keyOf.get(k);if(e)e.votes.push({...v,chamber,billKey:k});}
  const wanted=wantedByVote(data);
  for(const e of out){
    e.votes.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    // The researched positions first, then the Workers > Profit sides, then the scorecards on file; one per group.
    const seen=new Set(),add=p=>{if(seen.has(p.group))return;seen.add(p.group);e.positions.push(p);};
    for(const p of e.groups||[])add({...p,from:'research'});
    for(const p of e.work?.sides||[])add({...p,from:'bill'});
    for(const v of e.votes)for(const [group,c] of wanted.get(v.id)||[])add({group,pos:c.wanted==='Yea'?'support':'oppose',date:v.date,src:c.src||null,from:c.basis==='key_vote_alert'?'key vote':'scorecard',vote:v.id,
      why:`${c.basis==='key_vote_alert'?'Key-vote letter: urged a':'Scorecard: counted a'} ${c.wanted==='Yea'?'yes':'no'} vote in the ${v.chamber} as the right one.`});
    e.when=e.status==='law'?e.date:(e.votes[0]?.date||e.date||'');
    e.area=e.area||e.votes[0]?.area||null;
    e.summary=e.summary||e.votes.find(v=>v.bill?.summary)?.bill.summary||null;
    e.summarySrc=e.summarySrc||e.votes.find(v=>v.bill?.summary)?.bill.summarySrc||null;
  }
  return out.sort((a,b)=>String(b.when).localeCompare(String(a.when)));
}

// Saved roll calls on bills that aren't in the list (the tests keep this empty). Nominations, objections and impeachment
// articles aren't bills.
export function unlisted(data){
  const keys=new Set(billFamilies(data).flatMap(e=>e.keys));
  return [...(data.votes||[]),...(data.hvotes||[])].map(v=>[v.id,voteBill(v)]).filter(([,k])=>k&&!/-[hs]res-/.test(k)&&!keys.has(k));
}
