// Preview-only Integrity calculations. Kept separate from the published grade scorer.
import {promiseScore,legalTrouble,ownTrades,tradeChecks,amountMid} from './grades.js';
import {assetKind} from './holdings.js';
import {SIZE_BRACKETS} from './donor-sizes.js';

export const INTEGRITY_WEIGHTS={honesty:.20,personalFinances:.20,fundraising:.25,showingUp:.15,conflicts:.20};
export const HILL_POWER=.745;
export const hill=(x,midpoint)=>Number.isFinite(x)&&x>=0&&Number.isFinite(midpoint)&&midpoint>0?x**HILL_POWER/(midpoint**HILL_POWER+x**HILL_POWER):null;
const clamp=(x,min=0,max=100)=>Math.max(min,Math.min(max,x));
const validScore=x=>Number.isFinite(x)&&x>=0&&x<=100;
const sourceUrl=x=>{const value=typeof x==='string'?x:x?.u||x?.url||null;return /^https?:\/\//i.test(value||'')?value:null;};
function reviewedMidpoint(text,reviewedValue,reviewedSource,explicitOpen=false){
  if(reviewedValue!=null&&String(reviewedValue).trim()!==''){
    const n=Number(reviewedValue);return Number.isFinite(n)&&n>=0&&sourceUrl(reviewedSource)?n:null;
  }
  if(explicitOpen||/over|or more|unreadable|unknown|less than|under \$|up to/i.test(String(text||'')))return null;
  return amountMid(text);
}

export function integrityOverall({honesty=null,personalFinances=null,fundraising=null,showingUp=null,conflicts=null,legalTrouble:nullLegal=null}={}){
  const values={honesty,personalFinances,fundraising,showingUp,conflicts};
  const used=Object.keys(INTEGRITY_WEIGHTS).filter(k=>validScore(values[k]));
  const legal=validScore(nullLegal)?nullLegal:null;
  if(used.length<2)return {pct:null,raw:null,weighted:null,used,missing:Object.keys(values).filter(k=>!used.includes(k)),legalTrouble:legal,why:'Needs two complete components'};
  if(legal==null)return {pct:null,raw:null,weighted:null,used,missing:Object.keys(values).filter(k=>!used.includes(k)),legalTrouble:null,why:'Sourced Legal Trouble review is missing'};
  const total=used.reduce((n,k)=>n+INTEGRITY_WEIGHTS[k],0);
  const weighted=used.reduce((n,k)=>n+INTEGRITY_WEIGHTS[k]*values[k],0)/total;
  const raw=clamp(weighted-legal);
  return {pct:Math.round(raw),raw,weighted,used,missing:Object.keys(values).filter(k=>!used.includes(k)),legalTrouble:legal,why:null};
}

export function honestyComponent(person,{promises=null,today=null}={}){
  const score=promiseScore(person?.statements,person?.promiseTrackers,promises??person?.promises??[],today);
  const value=score.clear>=3?score.points/score.clear*100:null;
  return {value,complete:value!=null,score,why:value==null?'Needs at least three counted, reviewed checks':null,
    sources:[...(person?.statements||[]).flatMap(x=>x.sources||[]),...(person?.promiseTrackers||[]).map(x=>x.src).filter(Boolean)]};
}

export function legalReviewComponent(person,{asOfYear=null,stockActCovered=false}={}){
  const review=person?.legalReview,reviewSources=(review?.sources||[]).filter(x=>sourceUrl(x));
  const reviewed=typeof person?.ethicsSearched==='string'&&person.ethicsSearched.trim().length>0&&isoDate(review?.checkedAt)&&reviewSources.length>0;
  const sourced=(person?.ethics||[]).every(e=>(e.sources||[]).some(x=>sourceUrl(x)));
  if(!reviewed||!sourced)return {value:null,reviewed:false,reviewedAt:review?.checkedAt||null,why:'No complete, dated, sourced Legal Trouble review is recorded',sources:[...reviewSources,...(person?.ethics||[]).flatMap(e=>e.sources||[])]};
  const legal=legalTrouble(person.ethics,{asOfYear});
  if(stockActCovered instanceof Set&&stockActCovered.size){
    for(const row of legal.rows){const item=person.ethics[row.i];if(item?.type==='STOCK Act'&&stockActCovered.has(item.tradeId)){row.covered=true;row.points=0;}}
    legal.total=legal.rows.reduce((sum,row)=>sum+row.points,0);legal.index=Math.min(100,Math.round(legal.total*100)/100);
  }
  return {value:legal.index,reviewed:true,reviewedAt:review.checkedAt,why:null,rows:legal.rows,sources:[...reviewSources,...(person?.ethics||[]).flatMap(e=>e.sources||[])]};
}

const isoDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function coversPeriod(filings,start,end){
  if(!isoDate(start)||!isoDate(end)||start>end||!Array.isArray(filings)||!filings.length)return false;
  const rows=filings.filter(f=>isoDate(f.start)&&isoDate(f.end)&&f.start<=f.end).slice().sort((a,b)=>a.start.localeCompare(b.start));
  let through=start;
  for(const f of rows){if(f.end<through)continue;if(f.start>through)return false;if(f.end>=end)return true;
    const next=new Date(Date.parse(f.end+'T00:00:00Z')+86400000).toISOString().slice(0,10);through=next;}
  return false;
}
const dedupeTrades=rows=>{
  const out=[],seen=new Set();
  for(const t of rows||[]){
    // Only a shared transaction ID proves two rows are the same trade. Identical dates and amounts can be distinct trades.
    if(t.id&&seen.has(t.id))continue;if(t.id)seen.add(t.id);out.push(t);
  }
  return out;
};
const trustContains=(row,trust)=>!!(trust?.verified&&trust?.id&&trust?.source&&trust?.effectiveDate&&isoDate(trust.effectiveDate)&&String(row.traded||'')>=trust.effectiveDate&&(row.inTrust===true||row.trustId===trust.id));

export function personalFinancesComponent(person,{snapshot=null,trust=null,trades=null,tradeCoverage=person?.tradeCoverage,insiderIndex=person?.insiderIndex,dodgerIndex=person?.dodgerIndex,covered=!!person?.bioguide&&!person?.office}={}){
  if(!covered)return {value:null,complete:false,why:'No congressional disclosure coverage',sources:[]};
  const report=snapshot;
  const reportSource=sourceUrl(report?.url||report?.src);
  if(!report||report.unreadable||!report.reviewed||!reportSource||!Array.isArray(report.assets))
    return {value:null,complete:false,why:'A sourced, reviewed annual holdings snapshot is required',sources:reportSource?[reportSource]:[]};
  const trustVerified=trust?.verified===true&&!!trust?.id&&isoDate(trust.effectiveDate)&&!!sourceUrl(trust.source);
  const stockAssets=report.assets.filter(a=>assetKind(a)==='stock'&&!(trustVerified&&a.trustId===trust.id&&report.year>=Number(trust.effectiveDate.slice(0,4))));
  const values=stockAssets.map(a=>reviewedMidpoint(a.value,a.reviewedValue,a.reviewedValueSource,a.openEnded));
  if(values.some(v=>!Number.isFinite(v)||v<0))
    return {value:null,complete:false,why:'An individual-stock value is open-ended or unreadable',sources:[reportSource]};
  const stockValue=values.reduce((a,b)=>a+b,0);
  const all=dedupeTrades(trades??person?.trades);
  if(!Array.isArray(trades??person?.trades)||!all.length&&!tradeCoverage?.reviewed)
    return {value:null,complete:false,why:'Reviewed transaction coverage is missing',sources:[reportSource]};
  if((tradeCoverage?.complete!==true)||tradeCoverage?.reviewed!==true||!isoDate(tradeCoverage.period?.start)||!isoDate(tradeCoverage.period?.end)||!sourceUrl(tradeCoverage.source)||person?.tradesTruncated||
    all.some(t=>t.reviewed!==true)||all.some(t=>!isoDate(t.traded)||t.traded<tradeCoverage.period.start||t.traded>tradeCoverage.period.end||!isoDate(t.filed)||t.filed<t.traded||!sourceUrl(t.official?.url||t.src?.u||t.source)))
    return {value:null,complete:false,why:'Trade coverage, transaction dates, filing dates, or sources are incomplete',sources:[reportSource]};
  const actual=all.filter(t=>!trustContains(t,trustVerified?trust:null));
  const actualValues=actual.map(t=>reviewedMidpoint(t.amount,t.reviewedValue,t.reviewedValueSource,t.openEnded));
  if(actual.some(t=>t.missing)||actualValues.some(v=>!Number.isFinite(v)))return {value:null,complete:false,why:'A reviewed trade amount or filing is unresolved',sources:[reportSource,...actual.map(t=>sourceUrl(t.official?.url||t.src?.u)).filter(Boolean)]};
  const checks=tradeChecks(actual,[]);
  const insider=insiderIndex, dodger=dodgerIndex;
  if(!validScore(insider)||!validScore(dodger))return {value:null,complete:false,why:'Insider Trading and Stock Disclosure Dodger indexes are not both available',sources:[reportSource]};
  const tradeValue=actualValues.reduce((sum,v)=>sum+v,0);
  const stockPenalty=20*hill(stockValue,400000),tradeCountPenalty=20*hill(actual.length,50),tradeValuePenalty=20*hill(tradeValue,1000000);
  const insiderPenalty=.20*insider,dodgerPenalty=.20*dodger;
  const value=clamp(100-stockPenalty-tradeCountPenalty-tradeValuePenalty-insiderPenalty-dodgerPenalty);
  return {value,complete:true,stockValue,holdingsYear:report.year||null,tradePeriod:tradeCoverage.period,tradeCount:actual.length,tradeValue,
    stockPenalty,tradeCountPenalty,tradeValuePenalty,insiderPenalty,dodgerPenalty,late:checks.late,trustExcluded:all.length-actual.length,
    sources:[reportSource,sourceUrl(tradeCoverage.source),...actual.map(t=>sourceUrl(t.official?.url||t.src?.u)).filter(Boolean)]};
}

export const FUNDRAISING={donorWeights:[14,10,6,3,2],unsortedWeight:5.2,selfWeight:1,jointWeight:1,pacRates:{corporate:2,lobbyist:1,trade:.2,membership:.2,cooperative:.2,political:.1,leadership:.1,party:.1,candidate:.1,unconnected:.1,other:.05,labor:.05}};
export function fundraisingComponent(person,{sizes=null,pacRows=null,pacReceipts=null,pacCoverage=false,pacPeriodMatches=false,earmarks=null,pledgePoints=0,pledgeSources=[],pledgesReviewed=false,receipts=person?.camp?.receipts}={}){
  const sources=[person?.camp?.src,sizes?.source,...(person?.pac?.filings||[]).map(f=>f.url),...(earmarks?.rows||[]).map(r=>sourceUrl(r.src)),...pledgeSources].filter(Boolean);
  if(!(receipts>0)||person?.camp?.missing)return {value:null,complete:false,why:'Campaign receipts for a matching reporting period are missing',sources};
  if(!sizes||!Array.isArray(sizes.brackets)||sizes.brackets.length!==SIZE_BRACKETS.length||sizes.brackets.some((b,i)=>b.size!==SIZE_BRACKETS[i].size)||sizes.start!==person.camp.start||sizes.end!==person.camp.end)
    return {value:null,complete:false,why:'A donor-size breakdown for the campaign receipts period is missing',sources};
  const by=sizes.brackets.map(x=>Number(x.total)),unsorted=Number(sizes.notSorted);
  if(by.some(x=>!Number.isFinite(x)||x<0)||!Number.isFinite(unsorted)||unsorted<0||!Number.isFinite(person.camp.indiv)||
    Math.abs(by.reduce((a,b)=>a+b,0)+unsorted-person.camp.indiv)>.02)
    return {value:null,complete:false,why:'Donor-size buckets are missing or do not reconcile to same-period individual receipts',sources};
  if(!Number.isFinite(person.camp.self)||!Number.isFinite(person.camp.transfers))return {value:null,complete:false,why:'Self-funding or joint-fundraising receipt data is missing',sources};
  const selfFunding=person.camp.self,joint=person.camp.transfers;
  const D=clamp(by.reduce((sum,n,i)=>sum+n/receipts*FUNDRAISING.donorWeights[i],0)+unsorted/receipts*FUNDRAISING.unsortedWeight+
    selfFunding/receipts*FUNDRAISING.selfWeight+joint/receipts*FUNDRAISING.jointWeight,0,14);
  if(!pacCoverage||!pacPeriodMatches||!Array.isArray(pacRows)||pacRows.some(r=>!Object.hasOwn(FUNDRAISING.pacRates,r.kind))||!Number.isFinite(pacReceipts)||!Number.isFinite(person.camp.pac)||Math.abs(pacReceipts-person.camp.pac)>.02||Math.abs(pacRows.reduce((a,r)=>a+r.amount,0)-pacReceipts)>.02)
    return {value:null,complete:false,D,why:'PAC categories do not fully reconcile to the same-period FEC PAC total',sources};
  const P=Math.min(30,pacRows.reduce((sum,r)=>sum+(r.amount/receipts*100)*(FUNDRAISING.pacRates[r.kind]??FUNDRAISING.pacRates.other),0));
  const R=10*hill(pacReceipts/receipts,.20);
  if(!earmarks?.complete||!Array.isArray(earmarks.rows)||earmarks.rows.some(r=>!sourceUrl(r.src)))return {value:null,complete:false,D,P,R,why:'Complete, sourced earmark coverage is not available',sources};
  const earmarkRows=[],earmarkIds=new Set();
  for(const row of earmarks.rows){if(row.sourceType==='direct-pac')continue;if(row.id&&earmarkIds.has(row.id))continue;if(row.id)earmarkIds.add(row.id);earmarkRows.push(row);}
  if(earmarkRows.some(r=>!Number.isFinite(r.amount)||r.amount<0))return {value:null,complete:false,D,P,R,why:'Earmark amounts are incomplete',sources};
  const E=Math.min(30,earmarkRows.filter(r=>!['actblue','winred'].includes(String(r.group||'').toLowerCase())).reduce((sum,r)=>sum+r.amount/receipts*100*4,0));
  if(!pledgesReviewed)return {value:null,complete:false,D,P,R,E,why:'Pledge categories have not been reviewed',sources};
  const value=clamp(75+D-P-R-E+pledgePoints);
  return {value,complete:true,D,P,R,E,pledgePoints,receipts,period:{start:person.camp.start,end:person.camp.end},sources};
}

export const CCI_PREVIEW_WEIGHTS={employees:.10,businessVotes:.35,lobbiedBills:.20};
export function previewCci({employees=null,businessVotes=null,lobbiedBills=null}={}){
  const parts={employees,businessVotes,lobbiedBills},used=Object.keys(CCI_PREVIEW_WEIGHTS).filter(k=>validScore(parts[k]));
  if(!used.length)return {index:null,used,why:'No implemented preview CCI component has sufficient evidence'};
  const w=used.reduce((n,k)=>n+CCI_PREVIEW_WEIGHTS[k],0),raw=used.reduce((n,k)=>n+CCI_PREVIEW_WEIGHTS[k]*parts[k],0)/w;
  return {index:Math.round(raw),raw,used,why:null};
}
export function workersPreview(legislative,cci){
  if(!validScore(legislative))return {pct:null,why:'Existing legislative-action evidence minimum is not met'};
  const raw=cci?.index==null?legislative:.75*legislative+.25*(100-cci.index);
  return {pct:Math.round(raw),raw,blended:cci?.index!=null};
}

const pledgeCategories=[['corporate-pac','corporate-pac'],['stock-trading','stock-trading'],['lobbying','lobbying'],['citizens-united','citizens-united']];
export function fundraisingPledgePoints(data,person){
  let points=0;const rows=[];
  for(const [category,kind] of pledgeCategories){
    const items=(person.statements||[]).filter(s=>s.pledge?.kind===kind),reviewed=items.filter(s=>['consistent','contradiction'].includes(s.assessment));
    let score=0,source='';
    if(reviewed.length){const x=reviewed.slice().sort((a,b)=>String(a.said?.date||'').localeCompare(String(b.said?.date||''))).at(-1);score=x.assessment==='consistent'?1:-1;source=(x.sources||[]).map(sourceUrl).filter(Boolean)[0]||'';}
    else if(!items.length){const bill=qualifyingCosponsor(data,person,category);if(bill){score=1;source=bill.url;}}
    points+=score;rows.push({category,score,source,awaiting:items.length>0&&!reviewed.length});
  }
  return {points,rows};
}
function qualifyingCosponsor(data,person,category){
  const reform=category==='stock-trading'?'stock-trading':category==='lobbying'?'lobbying':category==='citizens-united'?'citizens-united':null;
  if(!reform)return null;
  for(const bill of data.billIndex||[]){
    const action=(bill.cosponsors||[]).find(c=>c.person===person.id);if(!action||!(bill.reform||[]).includes(reform))continue;
    const match=/^(\d+)-([a-z]+)-(\d+)$/.exec(bill.id||''),paths={hr:'house-bill',s:'senate-bill',hjres:'house-joint-resolution',sjres:'senate-joint-resolution'};
    if(match&&paths[match[2]])return {bill,action,url:`https://www.congress.gov/bill/${match[1]}th-congress/${paths[match[2]]}/${match[3]}`};
  }
  return null;
}

// The years Showing Up and Get It Done count: from WINDOW_FROM through the current year (2018–2026 now).
export const WINDOW_FROM=2018,WINDOW_CONGRESS=Math.floor((WINDOW_FROM-1789)/2)+1;
// Showing Up: the share of roll-call votes a member missed while in office from WINDOW_FROM on
// (public/attendance.json, from Voteview), as 100 − 5 points per percentage point missed (2% missed is 90, 10% is 50,
// 20% or more is 0). Votes missed while campaigning count. An excused absence, a reviewed entry with a cited source in
// the person's "absences" (medical leave, a birth or adoption, a death in the family, military duty), is left out of
// both the votes and the misses for its dates. The record shows a missed vote, not where the member was.
export const SHOWING_UP_PER_POINT=5,SHOWING_UP_MIN_VOTES=50;
export const EXCUSED_ABSENCES={medical:'Medical leave',birth:'Birth or adoption',adoption:'Birth or adoption',bereavement:'Death in the family',military:'Military duty'};
const isDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''));
export function excusedAbsences(person){
  return (person?.absences||[]).filter(a=>EXCUSED_ABSENCES[a?.reason]&&isDay(a.from)&&isDay(a.to||a.from)&&String(a.from)<=String(a.to||a.from)&&sourceUrl(a.src))
    .map(a=>({from:a.from,to:a.to||a.from,reason:a.reason,label:EXCUSED_ABSENCES[a.reason],note:a.note||'',src:a.src}));
}
export function showingUpComponent(person,attendance,{asOfYear=null}={}){
  const rec=attendance?.people?.[person?.id];
  const none=why=>({complete:false,value:null,why,years:[],excused:[],missed:0,votes:0,rate:null,sources:[]});
  if(!rec)return none(person?.office?'Not graded for this office':`No roll-call votes on record since ${WINDOW_FROM} (not in Congress then, or the attendance file has not been built)`);
  const last=asOfYear||Math.max(...Object.keys(rec.years||{}).map(Number)),first=WINDOW_FROM,inRange=d=>Number(String(d).slice(0,4))>=first&&Number(String(d).slice(0,4))<=last;
  const years=Object.entries(rec.years||{}).filter(([y])=>Number(y)>=first&&Number(y)<=last).map(([year,y])=>({year:Number(year),votes:y.votes,missed:y.missed})).sort((a,b)=>b.year-a.year);
  let votes=years.reduce((n,y)=>n+y.votes,0),missed=years.reduce((n,y)=>n+y.missed,0);
  // Each excused period: the roll calls held on its days while the member served, and the ones they missed then.
  const excused=excusedAbsences(person).map(a=>{
    let held=0,gone=0;
    for(const [chamber,start,end] of rec.spans||[])for(const [d,n] of Object.entries(attendance.days?.[chamber]||{}))if(d>=a.from&&d<=a.to&&d>=start&&d<=end&&inRange(d))held+=n;
    for(const [d,n] of Object.entries(rec.missed||{}))if(d>=a.from&&d<=a.to&&inRange(d))gone+=n;
    return {...a,votes:held,missed:Math.min(gone,held)};
  });
  for(const a of excused){votes-=a.votes;missed-=a.missed;}
  votes=Math.max(0,votes);missed=Math.max(0,Math.min(missed,votes));
  const sources=[{t:'Voteview roll-call records',u:attendance.source||'https://voteview.com/data'},...excused.map(a=>a.src)];
  if(votes<SHOWING_UP_MIN_VOTES)return {...none(`Fewer than ${SHOWING_UP_MIN_VOTES} roll-call votes in office in ${first}–${last}`),years,excused,votes,missed,sources};
  const rate=missed/votes*100;
  return {complete:true,value:clamp(100-SHOWING_UP_PER_POINT*rate),rate,votes,missed,years,excused,first,last,sources,why:null};
}

// Get It Done, inside Showing Up: the share of the bills and joint resolutions they sponsored that advanced (reported by
// a committee, placed on a calendar, passed a chamber, sent to the other, signed or law), against the typical member of
// their party in their chamber (public/get-it-done.json, npm run getitdone:build), over the Congresses from WINDOW_FROM:
// 100 × min(1, their rate ÷ the typical rate, weighted by their own bills in each Congress). At least 10 bills.
export const GET_IT_DONE_MIN_BILLS=10,SHOWING_UP_PARTS={attendance:.75,getItDone:.25};
export function getItDoneComponent(person,data){
  const rec=data?.people?.[person?.id];
  const none=why=>({complete:false,value:null,why,sponsored:0,advanced:0,rate:null,typical:null,congresses:[]});
  if(!rec)return none('No sponsored bills on record for these Congresses (not in Congress then, or the Get It Done file has not been built)');
  const congresses=Object.entries(rec.congresses||{}).filter(([c])=>Number(c)>=WINDOW_CONGRESS).map(([c,x])=>({congress:Number(c),...x,typical:data.medians?.[c]?.[x.chamber]?.[x.party]??null})).sort((a,b)=>b.congress-a.congress);
  const sponsored=congresses.reduce((n,c)=>n+c.sponsored,0),advanced=congresses.reduce((n,c)=>n+c.advanced,0);
  if(sponsored<GET_IT_DONE_MIN_BILLS)return {...none(`Fewer than ${GET_IT_DONE_MIN_BILLS} sponsored bills in these Congresses`),sponsored,advanced,congresses};
  const weighed=congresses.filter(c=>c.sponsored&&c.typical!=null),w=weighed.reduce((n,c)=>n+c.sponsored,0);
  const typical=w?weighed.reduce((n,c)=>n+c.sponsored*c.typical,0)/w:null,rate=advanced/sponsored;
  if(!typical)return {...none('No typical rate for their party in their chamber'),sponsored,advanced,congresses};
  return {complete:true,value:100*Math.min(1,rate/typical),rate,typical,sponsored,advanced,congresses,why:null};
}
// Showing Up: 75% Attendance and 25% Get It Done; Attendance alone when Get It Done isn't available. Attendance is
// required. The attendance details (years, excused absences) stay on the result for the page.
export function showingUpPart(attendance,getItDone){
  if(!attendance?.complete)return {...attendance,attendance,getItDone,complete:false,value:null};
  const value=getItDone?.complete?SHOWING_UP_PARTS.attendance*attendance.value+SHOWING_UP_PARTS.getItDone*getItDone.value:attendance.value;
  return {...attendance,attendance,getItDone,value,complete:true};
}

// Conflicts of Interest: 100 − (60% Outside Income & Conflicts + 40% Gifts & Travel), from the person's latest annual
// (or candidate) report and the reviewed matches of the organizations on it (public/conflicts.json). An interested
// organization lobbied on a bill sent to one of their committees, is a company in a sector their committees oversee, or
// received contracts from an agency their committees oversee; a candidate's lobbied the chamber they're running for.
// Only reviewed matches are marked "interested"; an unreviewed name is a lead and counts for nothing.
export const CONFLICT_WEIGHTS={income:.40,lobbyistOverlap:.25,contractsForDonors:.20,foreignAgent:.15},CONFLICT_PARTS={outside:.60,giftsTravel:.40};
const interested=list=>(list||[]).filter(x=>x?.interested===true);
const amount=x=>Number.isFinite(Number(x?.amount??x?.value))?Number(x.amount??x.value):0;
// I: income, board seats and agreements (latest report year): 60 × Hill(income from interested organizations, $50,000)
// + 20 a board seat or officer position with one (at most 40) + 40 for an agreement with one, capped at 100.
export function incomeConflicts({income=[],positions=[],agreements=[]}={}){
  const money=interested(income).reduce((n,x)=>n+amount(x),0),seats=interested(positions).length,deals=interested(agreements).length;
  return {value:clamp((money>0?60*hill(money,50000):0)+Math.min(40,20*seats)+(deals?40:0)),money,seats,deals};
}
export const lobbyistOverlap=sharePct=>Number.isFinite(sharePct)&&sharePct>=0?100*(sharePct>0?hill(sharePct,25):0):null;
export const contractsForDonors=companies=>Number.isFinite(companies)&&companies>=0?100*(companies>0?hill(companies,5):0):null;
export const foreignAgentFlag=filings=>Number.isFinite(filings)&&filings>=0?Math.min(100,25*filings):null;
// Gifts & Travel (latest two report years): 60 × Hill(value from interested organizations, $10,000) + 10 a gift or
// trip (at most 40), capped at 100.
export function giftsTravel({gifts=[],travel=[]}={}){
  const items=[...interested(gifts),...interested(travel)],value=items.reduce((n,x)=>n+amount(x),0);
  return {value:clamp((value>0?60*hill(value,10000):0)+Math.min(40,10*items.length)),total:value,count:items.length};
}
// The weighted parts over the ones available; null when the required one is missing.
const weightedOver=(parts,weights,required)=>{
  if(parts[required]==null)return null;
  const used=Object.keys(weights).filter(k=>Number.isFinite(parts[k])),total=used.reduce((n,k)=>n+weights[k],0);
  return used.reduce((n,k)=>n+weights[k]*parts[k],0)/total;
};
export function conflictsComponent(person,data){
  const rec=data?.people?.[person?.id];
  const none=why=>({complete:false,value:null,why,outside:null,gifts:null,parts:{},sources:[]});
  if(!rec)return none('No reviewed annual or candidate report on file for Conflicts of Interest yet');
  if(!rec.report?.year||!rec.reviewed?.at)return none('The latest report and its organization matches have not been reviewed yet');
  const inc=rec.income||rec.positions||rec.agreements?incomeConflicts(rec):null;
  const parts={income:inc?.value??null,lobbyistOverlap:lobbyistOverlap(rec.lobbyistOverlap?.sharePct),contractsForDonors:contractsForDonors(rec.contractsForDonors?.companies),foreignAgent:foreignAgentFlag(rec.foreignAgent?.filings)};
  const outside=weightedOver(parts,CONFLICT_WEIGHTS,'income');
  const gt=rec.gifts||rec.travel?giftsTravel(rec):null;
  if(outside==null&&gt==null)return {...none('Nothing from the report read yet'),parts};
  const value=outside!=null&&gt!=null?100-(CONFLICT_PARTS.outside*outside+CONFLICT_PARTS.giftsTravel*gt.value):100-(outside??gt.value);
  const sources=[rec.report?.url?{t:`${rec.report.year} report`,u:rec.report.url}:null,rec.reviewed?.src||null,...[...(rec.income||[]),...(rec.positions||[]),...(rec.agreements||[]),...(rec.gifts||[]),...(rec.travel||[])].map(x=>x?.src)].filter(x=>sourceUrl(x));
  return {complete:true,value:clamp(value),outside,gifts:gt?.value??null,income:inc,giftsTravel:gt,parts,report:rec.report,reviewed:rec.reviewed,sources,why:null};
}

export function integrityPreview(person,{asOfYear=null,attendance=null,getItDone=null,conflicts=null,finance=null,sizes=null,pacRows=null,pacReceipts=null,pacCoverage=false,pacPeriodMatches=false,earmarks=null,pledgePoints=0,pledgeSources=[],pledgesReviewed=false,trust=null}={}){
  const h=honestyComponent(person),covered=!!person?.bioguide&&!person?.office;
  const ethics=person?.ethicsResult||{};
  const usedTradeIds=new Set(tradeChecks(person?.trades||[],[]).rows.filter(t=>t.late).map(t=>t.id).filter(Boolean));
  const legal=legalReviewComponent(person,{asOfYear,stockActCovered:usedTradeIds});
  const financeWithIndexes=personalFinancesComponent(person,{snapshot:finance?.netWorth,trust,trades:person?.trades,tradeCoverage:person?.tradeCoverage,
    insiderIndex:ethics.insider?.index,dodgerIndex:ethics.dodger?.index,covered});
  const m=fundraisingComponent(person,{sizes,pacRows,pacReceipts,pacCoverage,pacPeriodMatches,earmarks,pledgePoints,pledgeSources,pledgesReviewed});
  const showing=showingUpPart(showingUpComponent(person,attendance,{asOfYear}),getItDoneComponent(person,getItDone));
  const conflict=conflictsComponent(person,conflicts);
  const overall=integrityOverall({honesty:h.complete?h.value:null,personalFinances:financeWithIndexes.complete?financeWithIndexes.value:null,fundraising:m.complete?m.value:null,showingUp:showing.complete?showing.value:null,conflicts:conflict.complete?conflict.value:null,legalTrouble:legal.value});
  return {overall,honesty:h,personalFinances:financeWithIndexes,fundraising:m,showingUp:showing,conflicts:conflict,legal};
}
