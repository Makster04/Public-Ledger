// The Legislation tab (#legislation, approved Nov. 17, 2026 from the mockup): a card for each bill the site follows, the
// way the People tab has a card for each politician, and a page for each bill (#legislation-<bill id>, drawn in app.js).
// Built on the Bills list (public/bills.js billFamilies: a bill, its versions, its saved roll calls and every group's
// position on file). This file adds what the cards and pages show: the bill's number and status, each roll call's party
// split (public/vote-party.json), the groups on each side with the money they put into the races tracked here (each
// profile's funder records), whether any of them lists few donors, its People First score, and whether the lawmakers a
// group helped voted its way. Money in a race isn't proof it changed a vote; the pages say so.
import {billFamilies} from './bills.js';
import {ISSUE_ICON,topicCategory} from './issue-icons.js';

export const LEG={summaryLines:3};
// ---------- Each bill's issues (since Nov. 25, 2026): the site's issue categories (public/questions.json) ----------
// First, the categories of the alignment questions the bill is coded to (public/bill-questions.js, from
// data/question-bills.json), each with those questions. Then its subject area's categories (below). A bill with neither
// gets the category its title, then its area, names (issue-icons.js topicCategory), if any. Shown and filtered by only;
// nothing here is used in a grade.
export const AREA_ISSUES={'Government ethics':['governance'],'Government oversight & accountability':['governance'],'Ethics & money in politics':[],
  'Finance & crypto':['economic'],'Banking & finance':['economic'],'Labor & workers':['economic'],'Trade & tariffs':['economic'],'Budget & fiscal policy':['economic'],
  'Budget, taxes & health':['economic','healthcare'],'Economy & public health':['economic','healthcare'],'Climate, health & taxes':['environmental','healthcare','economic'],
  'Health care':['healthcare'],'Social Security & Medicare':['domestic'],'Foreign policy & defense':['foreign'],'Elections & voting':['electoral'],
  'Immigration & border':['immigration'],'Reproductive rights':['social'],'Civil rights':['social'],'Civil liberties':[],
  'Technology & industrial policy':['technology','economic'],'Guns & public safety':['domestic'],'Infrastructure & transportation':['infrastructure','transportation'],
  'Criminal justice & policing':['criminal'],Housing:['housing']};
// (crypto is Technology, where the alignment questions put it)
const CRYPTO=/crypto|stablecoin|digital asset/i;
// [{id, name, icon, questions: [question text]}]. billQuestions: public/bill-questions.js; questions and categories:
// public/questions.json's.
export function billIssues(b,{billQuestions={},questions=[],categories=[]}={}){
  const qById=new Map(questions.map(q=>[q.id,q])),name=new Map(categories.map(c=>[c.id,c.name])),out=new Map();
  const add=(c,q)=>{if(!c||!name.has(c))return;if(!out.has(c))out.set(c,[]);if(q&&!out.get(c).includes(q))out.get(c).push(q);};
  for(const id of billQuestions[b.id]||[]){const q=qById.get(id);if(q)add(q.cat,q.q);}
  for(const c of AREA_ISSUES[b.area]||[])add(c);
  if(CRYPTO.test(b.title||''))add('technology');
  if(!out.size)add(topicCategory(b.title||'')||topicCategory(b.area||''));
  return [...out].map(([id,qs])=>({id,name:name.get(id),icon:ISSUE_ICON[id]||'',questions:qs}));
}
// The issues the bills fall under, with how many bills each: the filter's choices.
export function issueChoices(bills){
  const m=new Map();for(const b of bills)for(const i of b.issues||[]){const x=m.get(i.id)||{...i,n:0};x.n++;m.set(i.id,x);}
  return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
const issueTip=i=>i.questions.length?`Coded to the question${i.questions.length===1?'':'s'}: ${i.questions.join(' · ')}`:`From the bill's subject`;
// A bill's issue chips; clicking one shows the bills under that issue (app.js).
export const issueChips=b=>(b.issues||[]).length?`<div class="lg-issues">${b.issues.map(i=>`<button type="button" class="lg-issue" data-issue="${esc(i.id)}" title="${esc(issueTip(i))}" aria-label="${esc(`Show ${i.name} bills. ${issueTip(i)}`)}"><span aria-hidden="true">${i.icon}</span> ${esc(i.name)}</button>`).join('')}</div>`:'';
export const STATUS=[['','Any status'],['law','Became law'],['passed','Passed one chamber'],['not','Didn\'t pass']];
export const SORTS=[['money','Most money behind it'],['newest','Newest'],['pf','People First score']];
const TYPE={hr:'H.R.',s:'S.',hjres:'H.J.Res.',sjres:'S.J.Res.',hres:'H.Res.',sres:'S.Res.',hconres:'H.Con.Res.',sconres:'S.Con.Res.',samdt:'S.Amdt.',hamdt:'H.Amdt.'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export const money=n=>!n?'$0':n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1e4?`$${Math.round(n/1e3)}K`:`$${Math.round(n).toLocaleString('en-US')}`;
const day=d=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):(d||'');
export const ordinal=n=>`${n}${n%100>=11&&n%100<=13?'th':['th','st','nd','rd'][n%10]||'th'}`;

// "119-hr-1" -> {num: "H.R. 1", congress: 119}.
export function billNumber(id){
  const m=/^(\d+)-([a-z]+)-(\d+)$/.exec(id||'');return m?{num:`${TYPE[m[2]]||m[2].toUpperCase()} ${m[3]}`,congress:Number(m[1])}:{num:String(id||''),congress:null};
}
// Where it stands: became law, passed one chamber, or didn't pass (with the stage's own words for which).
export function billStatus(e){
  if(e?.status==='law')return {key:'law',label:'Became law'};
  const s=String(e?.stage||''),first=s.split(/;\s|\.\s(?=[A-Z])/)[0];
  if(/^(Passed the House|The House passed)/i.test(first))return {key:'passed',label:'Passed the House'};
  if(/^(Passed the Senate|The Senate passed)/i.test(first))return {key:'passed',label:'Passed the Senate'};
  if(/fell short|rejected|failed/i.test(first))return {key:'not',label:/House/.test(first)&&!/Senate/.test(first)?'Failed in the House':'Failed in the Senate'};
  if(/committee/i.test(first)&&/approved/i.test(first))return {key:'not',label:'Through committee'};
  if(/^Introduced/i.test(first))return {key:'not',label:'Introduced'};
  return {key:'not',label:'Didn\'t pass'};
}
// The first clause of the stage, for a card's footer.
export const stageLine=e=>{const s=String(e?.stage||'').split(/;\s|\.\s(?=[A-Z])/)[0].trim();return s.length>90?s.slice(0,89).replace(/\s+\S*$/,'')+'…':s;};
// "R 50–3 · D 0–45 · I 0–2" from a roll call's party tally ({R: {Yea, Nay, …}, …}).
export function partySplit(t){
  if(!t)return '';return ['R','D','I'].filter(p=>t[p]&&((t[p].Yea||0)+(t[p].Nay||0))).map(p=>`${p} ${t[p].Yea||0}–${t[p].Nay||0}`).join(' · ');
}
const norm=x=>x==='Aye'?'Yea':x==='No'?'Nay':x;
export const normVote=norm;
// The vote a group wanted on a roll call: its own wanted vote when its position came from that roll call; otherwise Yea
// for a group that supports the bill and Nay for one that opposes it, on a vote whose Yea moves the bill (not a motion
// to table, recommit or postpone, where Yea can mean the opposite).
export function wantedOn(v,p){
  if(p?.vote&&p.vote===v.id)return p.pos==='support'?'Yea':'Nay';
  if(/table|recommit|postpone|reconsider/i.test(String(v.question||'')))return null;
  return p?.pos==='support'?'Yea':p?.pos==='oppose'?'Nay':null;
}

// Each group's money in the races tracked here, from every profile's funder records (research.json funderPos): spent
// to help, spent against, members' gifts it forwarded, its PACs' gifts; the lawmakers it helped and opposed; and whether
// any outside spender behind it files as a group, not a PAC (an FEC ID starting C9: it lists only gifts given for its
// ads, so most of its money's sources aren't public).
export function groupMoney(data){
  const form5=new Set((data.ie?.cm||[]).filter(c=>/^C9/.test(c[0]||'')).map(c=>String(c[1]||'').toLowerCase()));
  const out=new Map();
  for(const p of [...(data.members||[]),...(data.cands||[]),...(data.featured||[])])for(const f of p.funderPos||[]){
    const g=out.get(f.key)||out.set(f.key,{for:0,against:0,routed:0,pac:0,helped:new Set(),opposed:new Set(),fewDonors:false}).get(f.key);
    g.for+=f.for||0;g.against+=f.against||0;g.routed+=f.routed||0;g.pac+=f.pac||0;
    if((f.for||0)+(f.routed||0)+(f.pac||0)>0)g.helped.add(p.id);if((f.against||0)>0)g.opposed.add(p.id);
    if((f.spenders||[]).some(s=>form5.has(String(s).toLowerCase())))g.fewDonors=true;
  }
  return out;
}
export const moneyTotal=m=>m?m.for+m.against+m.routed+m.pac:0;

// Every bill with what its card and page show. data: research.json; scored: the People First bills with their scores
// (app.js PVP_BILLS); voteParty: public/vote-party.json "votes"; orgOf(key): a group's name.
export function legislationModel(data,{scored=data?.bills||[],voteParty=null,orgOf=k=>k,billQuestions={},questions=[],categories=[]}={}){
  const gm=groupMoney(data||{});
  return billFamilies(data||{},scored).map(e=>{
    const n=billNumber(e.id),st=billStatus(e);
    const votes=[...e.votes].map(v=>({...v,party:voteParty?.[v.id]||null}));
    const sides={for:[],against:[]};
    for(const p of e.positions){const m=gm.get(p.group)||null;(p.pos==='support'?sides.for:sides.against).push({...p,org:orgOf(p.group),money:m});}
    const byMoney=(a,b)=>moneyTotal(b.money)-moneyTotal(a.money)||String(a.org).localeCompare(String(b.org));
    sides.for.sort(byMoney);sides.against.sort(byMoney);
    const pf=e.work&&(e.work.status==='scored'||e.work.status==='even')?e.work.score:null;
    return {...e,num:n.num,congress:n.congress,st,votes,sides,pf,issues:billIssues(e,{billQuestions,questions,categories}),
      moneyFor:sides.for.reduce((t,g)=>t+moneyTotal(g.money),0),moneyAgainst:sides.against.reduce((t,g)=>t+moneyTotal(g.money),0),
      fewDonors:[...sides.for,...sides.against].filter(g=>g.money?.fewDonors).length};
  });
}
// Of the lawmakers a group helped who voted on this bill, how many voted its way: each one's newest roll call on it
// where they cast Yea or Nay and the group's wanted vote is known.
export function helpedVoted(bill,g){
  let n=0,ok=0;
  for(const id of g.money?.helped||[]){
    const v=bill.votes.find(x=>/^(Yea|Nay)$/.test(norm(x.pos?.[id]))&&wantedOn(x,g));if(!v)continue;
    n++;if(norm(v.pos[id])===wantedOn(v,g))ok++;
  }
  return {n,ok};
}
// The bills a search, issue, status and sort pick out. bills: legislationModel().
export function filterBills(bills,{q='',area='',issue='',status='',sort='money'}={}){
  const words=String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const text=b=>[b.title,b.num,...(b.keys||[]),b.area,...(b.issues||[]).map(i=>i.name),b.summary,...b.sides.for.map(g=>g.org),...b.sides.against.map(g=>g.org)].join(' ').toLowerCase();
  const list=bills.filter(b=>(!area||b.area===area)&&(!issue||(b.issues||[]).some(i=>i.id===issue))&&(!status||b.st.key===status)&&words.every(w=>text(b).includes(w)));
  const when=b=>String(b.when||b.date||'');
  const cmp={money:(a,b)=>(b.moneyFor+b.moneyAgainst)-(a.moneyFor+a.moneyAgainst)||when(b).localeCompare(when(a)),
    newest:(a,b)=>when(b).localeCompare(when(a)),pf:(a,b)=>(b.pf??-999)-(a.pf??-999)||when(b).localeCompare(when(a))}[sort]||((a,b)=>0);
  return list.sort(cmp);
}
export const pfText=pf=>pf==null?null:pf>0?`+${pf} for working people`:pf<0?`${pf} for the wealthy`:'Even';

const head=(icon,title,sub)=>`<div class="hc-sh"><h4><i class="rc" aria-hidden="true">${icon}</i>${title}</h4><p>${sub}</p></div>`;
// A bill's card on the Legislation tab.
export function cardHTML(b){
  const last=b.votes.slice(0,2),f=b.sides.for.length,a=b.sides.against.length;
  const signed=b.status==='law'&&b.date?`Signed ${day(b.date)}`:null;
  return `<article class="card sen-card hc lg-card" tabindex="0" role="link" data-bill="${esc(b.id)}" aria-label="Open ${esc(b.title)}">
    <div class="lg-top"><div class="row" style="gap:5px"><span class="chip">${esc(b.num)}${b.congress?` · ${ordinal(b.congress)} Congress`:''}</span><span class="chip lg-st lg-${b.st.key}">${esc(b.st.label)}</span></div>
      <a class="name lg-name" href="#legislation-${esc(b.id)}">${esc(b.title)}</a><div class="hc-sub">${esc([b.area,signed].filter(Boolean).join(' · '))}</div>${issueChips(b)}</div>
    ${b.summary?`<p class="lg-sum">${esc(b.summary)}</p>`:''}
    ${head('🗳','Votes','The roll calls on record, and how each party voted')}
    <div class="lg-votes">${last.length?last.map(v=>`<div class="lg-v"><b>${esc(v.chamber)} · ${esc(v.result||'')}</b><span>${esc([day(v.date),partySplit(v.party)].filter(Boolean).join(' · '))}</span></div>`).join(''):'<div class="lg-v"><span>No roll call on record</span></div>'}</div>
    ${head('$','Money &amp; Influence','Groups that took a side, and the money they put into the races tracked here')}
    <div class="hc-money">
      <div class="hc-mt"><b>${f} for · ${a} against</b><span>Groups on record</span><small>${f+a?'statements, key-vote letters, scorecards':'none found yet'}</small></div>
      <div class="hc-mt"><b class="hc-two"><i class="sw lg-sw-for"></i>${money(b.moneyFor)} <em>its backers</em><br><i class="sw lg-sw-against"></i>${money(b.moneyAgainst)} <em>its opponents</em></b><span>Their money in these races</span></div>
    </div>
    <div class="lg-flags">${pfText(b.pf)?`<span class="lg-flag">People First: ${esc(pfText(b.pf))}</span>`:''}${b.fewDonors?`<span class="lg-flag lg-dark">◐ ${b.fewDonors} group${b.fewDonors===1?'':'s'} on a side list${b.fewDonors===1?'s':''} few donors</span>`:''}</div>
    <div class="hc-ft"><span>${esc(b.status==='law'?(b.law||'Public law'):stageLine(b))}</span><span>Open →</span></div>
  </article>`;
}
// The tab's main page: heading, search and filters, and the cards. state: {q, issue, status, sort}.
export function gridHTML(bills,state={},{issues=issueChoices(bills)}={}){
  const list=filterBills(bills,state),law=bills.filter(b=>b.st.key==='law').length;
  return `<section class="lg-page"><div class="directory-heading"><div><div class="page-eyebrow">THE BILLS BEHIND THE RECORD</div><h1 class="lg-h1">Legislation</h1>
    <p class="lg-lede">Every bill the site follows: where it stands, how each party voted, which groups took sides, and the money those groups put into the races tracked here. Money in a race isn't proof it changed a vote.</p></div>
    <span class="small muted" id="lg-count">${list.length===bills.length?`${bills.length} bills · ${law} became law`:`${list.length} of ${bills.length} bills`}</span></div>
    <div class="lg-filters"><input class="lg-in" id="lg-q" type="search" placeholder="Search by bill name, number, issue or group" aria-label="Search bills" value="${esc(state.q||'')}">
      <select class="lg-sel" data-lg="issue" aria-label="Issue"><option value="">All issues</option>${issues.map(i=>`<option value="${esc(i.id)}"${i.id===state.issue?' selected':''}>${i.icon} ${esc(i.name)} (${i.n})</option>`).join('')}</select>
      <select class="lg-sel" data-lg="status" aria-label="Status">${STATUS.map(([k,l])=>`<option value="${k}"${k===(state.status||'')?' selected':''}>${esc(l)}</option>`).join('')}</select>
      <select class="lg-sel" data-lg="sort" aria-label="Sort">${SORTS.map(([k,l])=>`<option value="${k}"${k===(state.sort||'money')?' selected':''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="grid hc-grid" id="lg-cards">${list.length?list.map(cardHTML).join(''):'<p class="muted">No bill matches.</p>'}</div></section>`;
}

// ---------- Each group's lean, for coloring its name (public/group-lean.json, scripts/build-group-lean.mjs) ----------
export const LEAN={republican:{cls:'lean-r',label:'Republican / conservative',money:'Mostly helps Republicans',card:'Conservative scorecard'},
  democrat:{cls:'lean-d',label:'Democratic / liberal',money:'Mostly helps Democrats',card:'Liberal scorecard'},
  libertarian:{cls:'lean-l',label:'Libertarian',money:'Libertarian',card:'Libertarian'},bipartisan:{cls:'lean-b',label:'Bipartisan',money:'Bipartisan',card:'Bipartisan'}};
// The class and the line added to a group's hover text. x: group-lean.json's entry for it; years: its "cycles".
export function leanTag(x,years=[]){
  const l=x&&LEAN[x.lean];if(!l)return null;
  if(x.basis==='scorecard')return {cls:l.cls,label:l.label,text:x.lean==='bipartisan'?'Bipartisan: its scorecard takes neither a liberal nor a conservative side.'
    :`${l.card}: it rates ${x.lean==='republican'?'conservative':'liberal'} votes higher. It has no political money on file here.`};
  if(x.basis==='set')return {cls:l.cls,label:l.label,text:`${l.label}. ${x.why||''}`.trim()};
  const span=years.length?` (${years[0]}–${years.at(-1)} cycles)`:'';
  const share=x.rShare==null?'':x.lean==='republican'?`: ${x.rShare}% of its money helped Republicans${span}`
    :x.lean==='democrat'?`: ${Math.round((100-x.rShare)*10)/10}% of its money helped Democrats${span}`
    :x.why?'':`: ${x.rShare}% of its money helped Republicans and ${Math.round((100-x.rShare)*10)/10}% Democrats${span}`;
  return {cls:l.cls,label:l.label,text:`${l.money}${share}.${x.why?` ${x.why}`:''}`};
}
export const leanLegendHTML=()=>`<div class="lean-key small">${Object.values(LEAN).map(l=>`<span class="${l.cls}"><i></i>${l.label}</span>`).join('')}</div>`;
