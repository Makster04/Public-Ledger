// The six scores on each profile (Scores/06_SIX_GRADES_PROPOSAL.md): Ideology (a position from liberal to conservative,
// not a grade) and five letter grades, Keeps Their Word, Shows Up, Unbought, Above Board and People First. Each returns
// {pct or lean, parts, why, needs}: `parts` is the breakdown shown on the score card (one row per part, with its points or
// value and how it was figured), `why` says why a score isn't graded yet, and `needs` lists what grading requires and
// whether each is in hand. Missing data stays unknown: a score without its evidence is "Not graded", never a zero.
// Shared by the profile tabs (public/app.js) and the tests; nothing here fetches.
import {promiseScore,legalTrouble,tradeChecks,amountMid,ownTrades,disclosureDodger,oneCreditPerBill,ACTION_TYPES,MIN_CHECKS,MIN_PVP_ACTIONS,LATE_DAYS,HOLDINGS,letter} from './grades.js';
import {hill,showingUpComponent,getItDoneComponent,showingUpPart,conflictsComponent} from './integrity.js';
import {assetKind} from './holdings.js';
import {SIZE_BRACKETS} from './donor-sizes.js';

const clamp=(x,min=0,max=100)=>Math.max(min,Math.min(max,x));
const round1=x=>Math.round(x*10)/10;
const graded=pct=>pct==null?null:{pct:Math.round(pct),letter:letter(Math.round(pct))};
const isDay=d=>/^\d{4}-\d{2}-\d{2}/.test(String(d||''));
const DAY=86400000;

// ---------- 1. Ideology (a position, not a grade) ----------
// The scale, from −100 (most liberal) to +100 (most conservative), and its five bands.
export const LEAN_BANDS=[[-60,'Very liberal'],[-20,'Liberal'],[20,'Moderate'],[60,'Conservative'],[100,'Very conservative']];
export function leanLabel(v){
  if(v==null||!Number.isFinite(v))return null;
  return v<-60?'Very liberal':v<-20?'Liberal':v<=20?'Moderate':v<=60?'Conservative':'Very conservative';
}
export const IDEOLOGY={minIssues:3,statementWeight:0.5};
// Lean on each issue, from the reviewed record on it (the same evidence Your Match uses): votes, bills, cosponsorships
// and official acts, one credit per bill; statements only on an issue with no action. Each item took side A or B of the
// issue, and the issue says which side is the liberal one ("liberalSide"). An issue whose sides don't map onto liberal
// and conservative (liberalSide null: tariffs, Ukraine aid, war powers, Jan. 6, infrastructure, ethics) is shown with
// its counts but has no lean and isn't averaged.
//   lean = 100 × (conservative items − liberal items) ÷ (all items)
export function issueLeans(person,issues){
  const ev=person?.evidence||{};
  return (issues||[]).map(i=>{
    const all=ev[i.id]||[],rec=oneCreditPerBill(all.filter(e=>ACTION_TYPES.has(e.type))),st=all.filter(e=>e.type==='stated');
    const basis=rec.length?rec:st,by={A:basis.filter(e=>e.side==='A').length,B:basis.filter(e=>e.side==='B').length};
    const n=by.A+by.B,cross=!i.liberalSide,lib=i.liberalSide,con=lib==='A'?'B':'A';
    const lean=!cross&&n?100*(by[con]-by[lib])/n:null;
    return {id:i.id,label:i.label,cross,note:i.leanNote||null,n,basis:rec.length?'record':st.length?'statements':'none',
      liberal:cross?null:by[lib],conservative:cross?null:by[con],sides:by,lean:lean==null?null:Math.round(lean),items:basis};
  });
}
// Group ratings, as one number: a conservative group's score s (0–100) counts 2s − 100, a liberal group's −(2s − 100).
// Letter grades convert A 100, B 75, C 50, D 25, F 0. ratings: [{org, lean: 'conservative'|'liberal', score}].
const LETTER_SCORE={A:100,B:75,C:50,D:25,F:0};
export function ratingScore(r){
  if(Number.isFinite(r?.score))return r.score;
  const m=/^([ABCDF])/i.exec(String(r?.grade||''));return m?LETTER_SCORE[m[1].toUpperCase()]:null;
}
export function ratingsLean(ratings){
  const rows=(ratings||[]).map(r=>{const s=ratingScore(r);return s==null||!['conservative','liberal'].includes(r.lean)?null:{...r,points:(r.lean==='conservative'?1:-1)*(2*s-100)};}).filter(Boolean);
  return rows.length?{lean:Math.round(rows.reduce((t,r)=>t+r.points,0)/rows.length),rows}:{lean:null,rows:[]};
}
// DW-NOMINATE's first dimension (about −1 to +1, Voteview) on the same scale.
export const dwLean=ideo=>Number.isFinite(ideo?.dim1)?Math.round(100*ideo.dim1):null;
export function ideology(person,issues,{ratings=null}={}){
  const leans=issueLeans(person,issues),scored=leans.filter(x=>x.lean!=null);
  const overall=scored.length>=IDEOLOGY.minIssues?Math.round(scored.reduce((t,x)=>t+x.lean,0)/scored.length):null;
  const r=ratingsLean(ratings),dw=dwLean(person?.ideo);
  return {lean:overall,label:leanLabel(overall),issues:leans,scored:scored.length,ratings:r,dw,
    why:overall==null?`Needs a lean on at least ${IDEOLOGY.minIssues} left–right issues (${scored.length} so far)`:null,
    needs:[['Their record by issue',scored.length>=IDEOLOGY.minIssues],['DW-NOMINATE (Voteview)',dw!=null],['Group scorecards',r.rows.length>0]]};
}

// ---------- 2. Keeps Their Word ----------
//   100 × (kept + ½ × (partly kept + changed)) ÷ counted checks, at least 3.
export function keepsTheirWord(person){
  const p=promiseScore(person?.statements,person?.promiseTrackers);
  const g=graded(p.pct);
  return {...g,pct:g?.pct??null,score:p,
    parts:[{key:'kept',label:'Kept',value:p.kept},{key:'half',label:'Partly kept or changed',value:p.half},{key:'broken',label:'Broken',value:p.broken},{key:'clear',label:'Counted checks',value:p.clear}],
    why:g?null:`Needs at least ${MIN_CHECKS} counted checks (${p.clear} so far)`,
    needs:[[`At least ${MIN_CHECKS} counted promise checks`,p.clear>=MIN_CHECKS]]};
}

// ---------- 3. Shows Up ----------
//   0.75 × Attendance + 0.25 × Get It Done; Attendance alone without Get It Done.
export function showsUp(person,{attendance=null,getItDone=null,asOfYear=null}={}){
  const x=showingUpPart(showingUpComponent(person,attendance,{asOfYear}),getItDoneComponent(person,getItDone));
  const g=x.complete?graded(x.value):null,a=x.attendance||{},d=x.getItDone||{};
  return {...g,pct:g?.pct??null,detail:x,
    parts:[{key:'attendance',label:'Attendance',value:a.complete?round1(a.value):null,weight:d.complete?0.75:1,note:a.complete?`${a.missed.toLocaleString('en-US')} of ${a.votes.toLocaleString('en-US')} votes missed (${a.rate.toFixed(1)}%)`:a.why},
      {key:'getItDone',label:'Get It Done',value:d.complete?round1(d.value):null,weight:d.complete?0.25:0,note:d.complete?`${(d.rate*100).toFixed(1)}% of their bills advanced; their party's typical rate ${(d.typical*100).toFixed(1)}%`:d.why}],
    why:g?null:a.why||'No roll-call record',
    needs:[['Roll-call record from 2018 on (Voteview)',!!a.complete],['Sponsored bills and how far they got (Congress.gov)',!!d.complete]]};
}

// ---------- 4. Unbought (IntegrityIndex.us's published formula) ----------
//   75 + Donor − PAC Penalty − PAC Reliance − Earmark Penalty − Stock Penalty − Trade Penalty + Bonuses + Pledges, never below 0.
// House and Senate weights differ. Numbers their page leaves out are filled in here and labeled on the page.
export const UNBOUGHT={
  base:75,
  H:{donor:[16,12,6,3,2],unitemized:16,unsorted:4.04,self:1,joint:1,donorCap:16,
     pac:{corporate:0.000015,lobbyist:0.000008,trade:0.000002,political:0.000001,ideological:0.000001,union:0.00000075,other:0.00000075}},
  S:{donor:[14,10,6,3,2],unitemized:14,unsorted:5.2,self:1,joint:1,donorCap:14,
     pac:{corporate:0.00001,lobbyist:0.000005,trade:0.000001,political:0.0000005,ideological:0.0000005,union:0.00000025,other:0.00000025}},
  earmark:0.00002,
  reliance:{max:10,midpoint:0.20},        // their page gives the maximum; the 20% midpoint is ours
  pacFloor:30,                            // their page says the PAC penalty is floored but gives no number; ours
  stocks:{max:20,midpoint:400000},
  trades:{countMax:20,countMidpoint:50,valueMax:0.00001,valueMidpoint:8000},   // the value maximum is copied as published
  bonus:{noCorporatePac:5,corporatePacPledge:1,noStocks:1},
  pledge:1,
};
// The FEC's PAC types (public/pac-types.js) in their formula's groups.
export const UNBOUGHT_PAC_GROUP={corporate:'corporate',lobbyist:'lobbyist',trade:'trade',membership:'trade',cooperative:'trade',
  leadership:'political',party:'political',candidate:'political',unconnected:'ideological',labor:'union',joint:'other',other:'other'};
export const UNBOUGHT_PAC_LABEL={corporate:'Corporate',lobbyist:'Lobbyist',trade:'Trade, membership and cooperative',political:'Political (leadership, party, candidate)',ideological:'Ideological',union:'Union and labor',other:'Other and unclassified'};
const PLEDGE_KINDS=[['corporate-pac','No corporate PAC money'],['lobbying','Ban lobbying by former members'],['stock-trading','Ban congressional stock trading'],['citizens-united','Overturn Citizens United']];
// Their pledge and bill points: per category, a pledge counts (one reviewed as broken doesn't; it counts as broken in
// Keeps Their Word), otherwise a cosponsored bill on it, otherwise nothing. The corporate-PAC pledge is its own +1 bonus.
export function unboughtPledges(person,billIndex=[]){
  return PLEDGE_KINDS.map(([kind,label])=>{
    const items=(person?.statements||[]).filter(s=>s.pledge?.kind===kind),broken=items.some(s=>s.assessment==='contradiction'),took=items.some(s=>s.assessment!=='contradiction');
    const bill=kind==='corporate-pac'?null:(billIndex||[]).find(b=>(b.reform||[]).includes(kind)&&(b.cosponsors||[]).some(c=>c.person===person?.id));
    const points=took?1:bill?1:0;
    return {kind,label,points,via:took?'pledge':bill?'bill':broken?'broken':null,bill:bill?.id||null,title:bill?.title||null};
  });
}
// Stocks held: the total of the value-range midpoints of the individual stocks and options on their latest annual
// report (funds, bonds, property and cash left out). null with the reason when the report can't be read for this.
export function stockHoldings(snapshot,holdings){
  if(holdings?.status==='blind-trust')return {value:0,blindTrust:true,count:0,why:null};
  if(!snapshot||snapshot.unreadable||!Array.isArray(snapshot.assets))return {value:null,why:'Their latest annual financial disclosure hasn\'t been read yet'};
  const stocks=snapshot.assets.filter(a=>assetKind(a)==='stock');
  const values=stocks.map(a=>/over|or more/i.test(String(a.value||''))?null:amountMid(a.value));
  if(values.some(v=>v==null))return {value:null,count:stocks.length,why:'A stock on their annual report has an open-ended or unreadable value'};
  return {value:values.reduce((t,v)=>t+v,0),count:stocks.length,year:snapshot.year||null,url:snapshot.url||null,why:null};
}
// Their trades over the campaign's reporting period, from the official trade reports read so far.
// trades: {rows, covered, why}; a trade's value is the midpoint of its disclosed range.
export function tradesIn(trades,start,end){
  if(!trades?.covered)return {count:null,value:null,why:trades?.why||'Their stock trade reports haven\'t been read yet'};
  const rows=(trades.rows||[]).filter(t=>isDay(t.traded)&&(!start||t.traded>=start)&&(!end||t.traded<=end));
  const mid=t=>Number.isFinite(t.low)?(t.low+(Number.isFinite(t.high)?t.high:t.low))/2:amountMid(t.amount);
  return {count:rows.length,value:rows.reduce((n,t)=>n+(mid(t)||0),0),rows,why:null};
}
// sizes: the FEC's gift sizes for the cycle (public/donor-sizes.js); pacRows: [{kind, amount}] from the itemized PAC lines
// with their FEC types; earmarks: [{group, amount}] gifts routed through conduit groups; snapshot: the latest annual
// report; trades: {rows, covered, why}; pledges: unboughtPledges().
export function unbought(person,{sizes=null,pacRows=null,earmarks=[],snapshot=null,trades=null,pledges=[],jfc=null,earmarksComplete=false}={}){
  const c=person?.camp||{},R=c.receipts,W=UNBOUGHT[person?.chamber==='S'?'S':'H'];
  const needs=[['The cycle\'s FEC report',R>0&&!c.missing],['Their financial disclosure read (holdings and trades)',false]];
  if(person?.office)return {pct:null,why:'Not graded for a president: there is no 2026 campaign to compare',parts:[],needs};
  if(!(R>0)||c.missing)return {pct:null,why:'No FEC report for this cycle yet',parts:[],needs};
  const share=n=>Number.isFinite(n)?n/R:0;
  // Donor: each gift-size band's share of receipts × its weight, when the FEC's gift sizes reconcile to what
  // individuals gave; otherwise the small gifts reported only as a total at the small weight and the itemized gifts at
  // the not-yet-sorted weight, as their formula scores gifts the FEC hasn't sorted.
  const bandsOk=sizes&&Array.isArray(sizes.brackets)&&sizes.brackets.length===SIZE_BRACKETS.length&&Number.isFinite(c.indiv)&&c.indiv>0&&
    Math.abs(sizes.brackets.reduce((t,b)=>t+(Number(b.total)||0),0)+(Number(sizes.notSorted)||0)-c.indiv)<=Math.max(1,c.indiv*0.02);
  let donorRaw,donorNote;
  if(bandsOk){
    donorRaw=sizes.brackets.reduce((t,b,i)=>t+share(Number(b.total))*W.donor[i],0)+share(Number(sizes.notSorted)||0)*W.unsorted;
    donorNote=`gift sizes from the FEC, ${sizes.start||'?'} – ${sizes.end||'?'}`;
  }else{
    donorRaw=share(c.unitemized)*W.unitemized+share(c.itemized)*W.unsorted;
    donorNote='the FEC\'s gift-size split isn\'t read for this period, so itemized gifts count at the not-yet-sorted rate';
  }
  // Joint fundraising: the money a joint fundraising committee passed on is credited back to the people who gave it, by
  // the size of each one's share (public/fec-money.js, jfcCycleSummary); committees' shares, and transfers from other
  // committees, stay at the joint fundraising weight. Without that read, every transfer counts at that weight.
  const transfers=Number(c.transfers)||0,jt=jfc&&jfc.transferred>0&&transfers>0?Math.min(1,transfers/jfc.transferred):0;
  if(jt){
    donorRaw+=jfc.bands.reduce((t,b,i)=>t+share(b*jt)*W.donor[i],0)+share(transfers-jfc.people*jt)*W.joint;
    donorNote+=`; $${Math.round(jfc.people*jt).toLocaleString('en-US')} through joint fundraising credited to the people who gave it`;
  }else donorRaw+=share(transfers)*W.joint;
  donorRaw+=share(c.self)*W.self;
  const donor=clamp(donorRaw,0,W.donorCap);
  // PAC: each type's dollars × its rate. The itemized PAC lines read so far give each type's share of PAC money, which
  // is applied to the FEC's PAC total for the period, so every PAC dollar counts.
  const pacTotal=Number(c.pac)||0,rows=(pacRows||[]).filter(r=>Number.isFinite(r.amount)&&r.amount>0),read=rows.reduce((t,r)=>t+r.amount,0);
  // PAC money not yet sorted by type leaves the PAC part (and the no-corporate-PAC bonus) waiting; the rest still shows.
  const pacKnown=!(pacTotal>0&&!read);
  let pac=null,pacBy={};
  for(const r of rows){const g=UNBOUGHT_PAC_GROUP[r.kind]||'other';pacBy[g]=(pacBy[g]||0)+r.amount/read*pacTotal;}
  if(pacKnown)pac=Math.min(UNBOUGHT.pacFloor,Object.entries(pacBy).reduce((t,[g,amt])=>t+amt*W.pac[g],0));
  const reliance=UNBOUGHT.reliance.max*(hill(pacTotal/R,UNBOUGHT.reliance.midpoint)||0);
  const earmarked=(earmarks||[]).filter(r=>Number.isFinite(r.amount)&&!/^(actblue|winred)$/i.test(String(r.group||''))).reduce((t,r)=>t+r.amount,0);
  const earmark=earmarked*UNBOUGHT.earmark;
  // The disclosure: holdings and trades. Without them the grade waits; the stock terms are never dropped.
  const held=stockHoldings(snapshot,person?.holdings),traded=tradesIn(trades,c.start,c.end);
  const disclosed=held.value!=null&&traded.count!=null;
  needs[1][1]=disclosed;
  const stocks=held.value==null?null:held.blindTrust?0:UNBOUGHT.stocks.max*(hill(held.value,UNBOUGHT.stocks.midpoint)||0);
  const tradePts=traded.count==null?null:UNBOUGHT.trades.countMax*(hill(traded.count,UNBOUGHT.trades.countMidpoint)||0)+UNBOUGHT.trades.valueMax*(hill(traded.value,UNBOUGHT.trades.valueMidpoint)||0);
  const corporate=pacBy.corporate||0;
  const pl=pledges||[],corp=pl.find(p=>p.kind==='corporate-pac');
  // Every bonus is listed, earned or not, with why: status 'yes', 'no' or 'waiting' (on a record not read yet).
  const bonusItems=[
    {label:'No corporate PAC money',max:UNBOUGHT.bonus.noCorporatePac,status:!pacKnown?'waiting':corporate===0?'yes':'no',
      why:!pacKnown?'their PAC money isn\'t sorted by type yet':corporate===0?(pacTotal?'none of their PAC money is from corporate PACs':'no PAC money at all'):`about $${Math.round(corporate).toLocaleString('en-US')} from corporate PACs`},
    {label:'Pledged not to take corporate PAC money',max:UNBOUGHT.bonus.corporatePacPledge,status:corp?.via==='pledge'?'yes':'no',
      why:corp?.via==='pledge'?'signed the pledge':corp?.via==='broken'?'pledge reviewed as broken':'no pledge on file'},
    {label:'Holds no individual stocks',max:UNBOUGHT.bonus.noStocks,status:held.value==null?'waiting':!held.blindTrust&&held.count===0?'yes':'no',
      why:held.value==null?'their annual disclosure isn\'t read yet':held.blindTrust?'holdings are in a blind trust':held.count===0?'none on their latest report':`${held.count} on their latest report`}];
  for(const b of bonusItems)b.points=b.status==='yes'?b.max:0;
  const bonus=bonusItems.reduce((t,b)=>t+b.points,0);
  const pledgeItems=pl.filter(p=>p.kind!=='corporate-pac').map(p=>({...p,status:p.points?'yes':'no',why:p.via==='pledge'?'signed the pledge':p.via==='bill'?`cosponsored ${p.title||p.bill}`:p.via==='broken'?'pledge reviewed as broken, and no bill':'no pledge or cosponsored bill on file'}));
  const pledgePts=pledgeItems.reduce((t,p)=>t+p.points,0);
  const list=items=>items.map(b=>`${b.status==='yes'?'✓':b.status==='waiting'?'…':'✕'} ${b.label}${b.status==='yes'?` +${b.points}`:''} (${b.why})`).join(' · ');
  const parts=[
    {key:'donor',label:'Donor',points:round1(donor),note:donorNote},
    {key:'pac',label:'PAC Penalty',points:pac==null?null:-round1(pac),note:!pacKnown?'Their PAC money isn\'t sorted by type yet':`${pacTotal?`$${Math.round(pacTotal).toLocaleString('en-US')} from PACs, by type`:'No PAC money'}`,by:pacBy},
    {key:'reliance',label:'PAC Reliance',points:-round1(reliance),note:`${(share(pacTotal)*100).toFixed(1)}% of receipts from PACs`},
    {key:'earmarks',label:'Earmark Penalty',points:-round1(earmark),note:`$${Math.round(earmarked).toLocaleString('en-US')} in gifts routed through groups${earmarksComplete?' (every group the FEC shows forwarding gifts to them)':' (partial: not every group searched for yet)'}`},
    {key:'stocks',label:'Stock Penalty',points:stocks==null?null:-round1(stocks),note:held.blindTrust?'In a qualified blind trust: no penalty':held.value==null?held.why:`$${Math.round(held.value).toLocaleString('en-US')} in ${held.count} individual stock${held.count===1?'':'s'}`},
    {key:'trades',label:'Trade Penalty',points:tradePts==null?null:-round1(tradePts),note:traded.count==null?traded.why:`${traded.count} trade${traded.count===1?'':'s'} in this period`},
    {key:'bonuses',label:'Bonuses',points:bonus,note:list(bonusItems),items:bonusItems},
    {key:'pledges',label:'Pledges and bills',points:pledgePts,note:list(pledgeItems),items:pledgeItems},
  ];
  const raw=UNBOUGHT.base+donor-(pac||0)-reliance-earmark-(stocks||0)-(tradePts||0)+bonus+pledgePts;
  const base={parts,needs,pacBy,held,traded,bonusItems,pledgeItems};
  if(!pacKnown)return {...base,pct:null,raw:null,why:'Their PAC money hasn\'t been sorted by type yet'};
  if(!disclosed)return {...base,pct:null,raw:null,why:held.value==null?held.why:traded.why};
  const pct=Math.max(0,Math.round(raw));
  return {...base,pct,letter:letter(Math.min(100,pct)),raw,why:null};
}

// ---------- 5. Above Board ----------
//   100 − (0.35 × Outside Income & Conflicts + 0.20 × Gifts & Travel + 0.25 × Trade Conflicts
//          + 0.20 × Stock Disclosure Dodger) − Legal Trouble, with missing indexes left out and the rest rescaled.
export const ABOVE_BOARD={weights:{outside:0.35,gifts:0.20,tradeConflicts:0.25,dodger:0.20}};
export const TRADE_CONFLICTS={weights:{committees:0.45,nearVotes:0.30,donors:0.25},minTrades:5};
const pctOf=(n,d)=>d?n/d*100:0;
// A trade's kind: a reviewed trade's `asset` ('stock', 'fund' …), or an official report's `assetType`.
const KINDS=new Set(['stock','option','fund','bond','other']);
export const tradeKind=r=>r?.assetType||(KINDS.has(r?.asset)?r.asset:'stock');
// Trade Conflicts (the Insider Trading Index without its single-stock activity part, since Unbought counts how much they
// trade): the share of their individual-stock dollars in sectors their committees oversee, of trades within 30 days of
// a related vote, and of trades in donors' companies. rows: tradeChecks() rows. A part the records can't tell yet is left
// out and the others rescaled: trades read automatically from the official reports carry no near-vote review
// (known.nearVotes false), and a stock whose company isn't matched to an industry is left out of the committee part.
export function tradeConflicts(rows,{covered=true,inDonors=0,why='Their stock trade reports haven\'t been read yet',known={nearVotes:true,donors:true}}={}){
  rows=rows||[];
  if(!covered)return {index:null,why,n:0,parts:null};
  if(!rows.length)return {index:0,why:null,n:0,parts:{committees:0,nearVotes:0,donors:0},none:true};
  const single=rows.filter(r=>['stock','option'].includes(tradeKind(r))&&(r.sector||r.conflict)),dollars=single.map(r=>amountMid(r.amount)),byDollar=dollars.length&&dollars.every(v=>v!=null);
  const parts={committees:!single.length?null:byDollar?pctOf(single.reduce((t,r,i)=>t+(r.conflict?dollars[i]:0),0),dollars.reduce((t,v)=>t+v,0)):pctOf(single.filter(r=>r.conflict).length,single.length),
    nearVotes:known.nearVotes===false?null:pctOf(rows.filter(r=>r.flag||r.nearVote).length,rows.length),donors:known.donors===false?null:pctOf(Math.min(inDonors,rows.length),rows.length)};
  if(rows.length<TRADE_CONFLICTS.minTrades)return {index:null,why:`Fewer than ${TRADE_CONFLICTS.minTrades} trades`,n:rows.length,parts};
  const W=TRADE_CONFLICTS.weights,used=Object.keys(W).filter(k=>parts[k]!=null),w=used.reduce((t,k)=>t+W[k],0);
  if(!used.length)return {index:null,why:'Their trades aren\'t matched to industries yet',n:rows.length,parts};
  return {index:Math.round(used.reduce((t,k)=>t+W[k]*parts[k],0)/w),why:null,n:rows.length,parts,used,byDollar,unmatched:rows.filter(r=>['stock','option'].includes(tradeKind(r))&&!r.sector&&!r.conflict).length};
}
// person: the profile; ethics review: person.ethicsSearched (the dated note of what was searched) and person.ethics.
// trades: {rows, covered, why, overseen, inDonors}; conflicts: public/conflicts.json.
export function aboveBoard(person,{trades=null,conflicts=null,asOfYear=null}={}){
  const reviewed=typeof person?.ethicsSearched==='string'&&person.ethicsSearched.trim().length>0;
  // Trades from the official reports name the company in `asset` and its kind in `assetType`; reviewed ones use `asset` for
  // the kind. Both become {company, asset: kind} for the checks.
  const norm=(trades?.rows||[]).map(r=>({...r,company:r.company||(KINDS.has(r.asset)?null:r.asset),asset:tradeKind(r)}));
  const checked=tradeChecks(ownTrades(norm,person?.holdings),trades?.overseen||[]);
  const covered=!!trades?.covered;
  const legal=legalTrouble(person?.ethics,{asOfYear,stockActCovered:covered&&checked.rows.length>0});
  const tc=tradeConflicts(checked.rows,{covered,inDonors:trades?.inDonors||0,why:trades?.why,known:trades?.known});
  const dodger=disclosureDodger(checked.rows,person?.annualDisclosures||[],{covered,why:trades?.why});
  if(covered&&!checked.rows.length){dodger.index=null;dodger.why='No trades to report';}
  const coi=conflictsComponent(person,conflicts);
  const idx={outside:coi.complete?coi.outside:null,gifts:coi.complete?coi.gifts:null,tradeConflicts:tc.index,dodger:dodger.index};
  const W=ABOVE_BOARD.weights,used=Object.keys(W).filter(k=>Number.isFinite(idx[k])),wsum=used.reduce((t,k)=>t+W[k],0);
  const deduction=used.length?used.reduce((t,k)=>t+W[k]*idx[k],0)/wsum:null;
  const parts=[
    {key:'outside',label:'Outside Income & Conflicts',index:idx.outside,points:idx.outside==null?null:-round1(W.outside/wsum*idx.outside),note:coi.complete?null:coi.why},
    {key:'gifts',label:'Gifts & Travel',index:idx.gifts,points:idx.gifts==null?null:-round1(W.gifts/wsum*idx.gifts),note:coi.complete?null:coi.why},
    {key:'tradeConflicts',label:'Trade Conflicts',index:tc.index,points:tc.index==null?null:-round1(W.tradeConflicts/wsum*tc.index),note:tc.why||(tc.none?'No trades in the reports read':`${tc.n} trades`)},
    {key:'dodger',label:'Stock Disclosure Dodger',index:dodger.index,points:dodger.index==null?null:-round1(W.dodger/wsum*dodger.index),note:dodger.why||`${dodger.late||0} late or missing of ${checked.rows.length} trade reports (due within ${LATE_DAYS} days)`},
    {key:'legal',label:'Legal Trouble',index:reviewed?legal.index:null,points:reviewed?-round1(legal.index):null,note:reviewed?`${legal.finding} confirmed, ${legal.open} open, ${legal.closed} closed without a finding`:'Not reviewed yet'},
  ];
  const needs=[['Financial disclosures read (income, gifts, trips, trades and filing dates)',covered||coi.complete],['Connections checked (lobbying, contracts, foreign-agent filings, committees, votes)',coi.complete],['Legal records reviewed (court, ethics and enforcement cases)',reviewed]];
  const base={parts,needs,legal,tradeConflicts:tc,dodger,conflicts:coi,checked,used};
  if(!reviewed)return {...base,pct:null,why:'The legal record hasn\'t been reviewed yet'};
  if(!used.length)return {...base,pct:null,why:'None of the four indexes has its records read yet, and legal records alone aren\'t enough'};
  const raw=clamp(100-deduction-legal.index);
  return {...base,...graded(raw),raw,why:null};
}

// ---------- 6. People First ----------
//   0.75 × Legislative Action + 0.25 × (100 − CCI); the CCI keeps only its behavior parts:
//   0.65 × business-funder voting + 0.35 × donor-lobbied bills (rescaled over what's available).
export const PEOPLE_FIRST={action:0.75,cci:0.25,cciWeights:{businessVotes:0.65,lobbiedBills:0.35},minLobbied:3};
export function behaviorCci({businessVotes=null,lobbied=null}={}){
  const parts={businessVotes:Number.isFinite(businessVotes?.index)?businessVotes.index:null,lobbiedBills:lobbied&&lobbied.n>=PEOPLE_FIRST.minLobbied?pctOf(lobbied.profit,lobbied.n):null};
  const W=PEOPLE_FIRST.cciWeights,used=Object.keys(W).filter(k=>parts[k]!=null);
  if(!used.length)return {index:null,parts,used,why:'Not enough votes compared with business funders yet'};
  const w=used.reduce((t,k)=>t+W[k],0);
  return {index:Math.round(used.reduce((t,k)=>t+W[k]*parts[k],0)/w),parts,used,why:null};
}
// v: pvpScore() of their actions on scored bills ({pct, nPeople, nProfit, n, people, profit}); cci: behaviorCci().
export function peopleFirst(v,cci){
  const bills=v?.pct??null,on=bills!=null&&cci?.index!=null;
  const raw=bills==null?null:on?PEOPLE_FIRST.action*bills+PEOPLE_FIRST.cci*(100-cci.index):bills;
  return {...graded(raw),pct:raw==null?null:Math.round(raw),raw,bills,cci,blended:on,v,
    parts:[{key:'action',label:'Legislative Action',value:bills,weight:on?PEOPLE_FIRST.action:1,note:v?.n?`${v.nPeople} for working people, ${v.nProfit} for profit, of ${v.n} scored actions`:'No scored actions yet'},
      {key:'cci',label:'CCI (Corporation Compromised Index)',value:cci?.index??null,weight:on?PEOPLE_FIRST.cci:0,note:cci?.why||`100 − ${cci.index} counts`}],
    why:raw==null?`Needs at least ${MIN_PVP_ACTIONS} scored actions (${v?.n||0} so far)`:null,
    needs:[['Votes and bills, each scored by who gains and which groups took sides',!!v?.n],['Business funders\' positions and the bills they lobbied on',cci?.index!=null],['How they voted against their own party on those votes',cci?.parts?.businessVotes!=null]]};
}

export const SIX=[
  {key:'ideology',name:'Ideology',tag:'POLITICAL POSITION',q:'Where they stand from liberal to conservative, overall and issue by issue.',grade:false},
  {key:'word',name:'Keeps Their Word',tag:'PROMISES',q:'The share of their promises they kept, judged by what they did afterward.',grade:true},
  {key:'showsup',name:'Shows Up',tag:'JOB PERFORMANCE',q:'Whether they cast their votes and move the bills they sponsor.',grade:true},
  {key:'unbought',name:'Unbought',tag:'MONEY & INDEPENDENCE',q:'How independent their money is from special interests. It doesn\'t measure how they vote.',grade:true},
  {key:'aboveboard',name:'Above Board',tag:'CONFLICTS & DISCLOSURE',q:'Whether their own money is tied to the power of their office, whether they follow the disclosure rules, and whether they\'re in legal trouble.',grade:true},
  {key:'peoplefirst',name:'People First',tag:'VOTES & WORKERS',q:'Whether their votes and bills favor working people or business interests.',grade:true},
];
export {HOLDINGS};
