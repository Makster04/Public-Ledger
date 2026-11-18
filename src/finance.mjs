// Cross-profile financial views read completed snapshots; they never refresh sources or score records.
import config from '../data/config.json' with {type:'json'};
import {getStatus,statement} from './refresh.mjs';
import {mergeTrades} from './merge.mjs';
import {SINCE} from './feeds.mjs';
import {stockHoldings} from '../public/six-scores.js';
import {holdingsLead,assetKind} from '../public/holdings.js';
import {LATE_DAYS} from '../public/grades.js';

const TRADE_KINDS=['trades-house','trades-senate','trades-bargo','trades-eulerpool','trades-fmp'];
const ANNUAL_KINDS=['net-worth-house','net-worth-senate'];
const KINDS=['campaign','donor-sizes',...ANNUAL_KINDS,...TRADE_KINDS,'house-fd','sec-sic'];
const latest=(a,b)=>!a?b:!b?a:a>b?a:b;
const newerAnnual=(a,b)=>Number(a.year||0)-Number(b.year||0)||String(a.filed||'').localeCompare(String(b.filed||''))||String(a.checkedAt||'').localeCompare(String(b.checkedAt||''));

/** One bounded, local query for the same finance records already available on individual profiles. */
export async function getFinanceOverview(env){
  const sourceStatus=await getStatus(env);
  const sourceCoverage={};
  for(const job of sourceStatus.jobs){
    if(!config.people.some(p=>p.id===job.subject)||!ANNUAL_KINDS.concat(TRADE_KINDS).includes(job.kind))continue;
    (sourceCoverage[job.subject]||={})[job.kind]={status:job.status,stale:job.stale,last_success:job.last_success,error:job.error};
  }
  const rows=(await statement(env.DB,`SELECT j.subject,j.kind,s.payload,s.updated_at FROM snapshots s JOIN jobs j ON j.id=s.job_id WHERE j.kind IN (${KINDS.map(()=>'?').join(',')}) ORDER BY s.updated_at,s.job_id`,...KINDS).all()).results;
  const known=new Set(config.people.map(p=>p.id)),sections=new Map(),filings=new Map();
  let sectors={};
  for(const row of rows){
    const data=JSON.parse(row.payload);
    if(row.kind==='sec-sic'){
      sectors={...sectors,...data.byTicker};
      continue;
    }
    if(row.kind==='trades-eulerpool'){
      // One list for everyone (src/feeds.mjs): each member's matched trades, as their own trade source.
      for(const [id,list] of Object.entries(data.byPerson||{}))if(known.has(id)&&Array.isArray(list)){
        const own=sections.get(id)||{};own[row.kind]={rows:list,count:list.length,checkedAt:row.updated_at};sections.set(id,own);
      }
      continue;
    }
    if(row.kind==='house-fd'){
      // The yearly House index is global; only its explicitly keyed records belong to each person.
      for(const [id,list] of Object.entries(data.byPerson||{}))if(known.has(id)&&Array.isArray(list)){
        const own=filings.get(id)||[];own.push(...list);filings.set(id,own);
      }
      continue;
    }
    if(!known.has(row.subject))continue;
    const own=sections.get(row.subject)||{};
    own[row.kind]={...data,checkedAt:row.updated_at};sections.set(row.subject,own);
  }
  const people={};let checkedAt=null;
  for(const [id,own] of sections){
    const annuals=ANNUAL_KINDS.map(kind=>own[kind]).filter(Boolean).sort(newerAnnual);
    const official=['trades-house','trades-senate'].filter(kind=>own[kind]);
    const tradeSources=TRADE_KINDS.map(kind=>own[kind]).filter(Boolean);
    const merged=tradeSources.length?mergeTrades(tradeSources.map(s=>s.rows||[]),filings.get(id)||[],sectors,{officialFrom:official.length?`${SINCE(config)}-01-01`:null}):[];
    const ownChecked=Object.values(own).reduce((at,s)=>latest(at,s.checkedAt),null);
    const entry={
      netWorth:annuals.at(-1)||null,
      trades:merged.slice(0,1500),
      tradesUnread:official.flatMap(kind=>own[kind].unread||[]),
      // For the Rankings page's Big Money Independence and Plays by the Rules: the donor sizes, and whether older trade
      // reports are still being read (as each profile's disclosure says).
      sizes:own['donor-sizes']||null,tradesMore:official.some(kind=>Number(own[kind].more)>0),
      checkedAt:ownChecked,
      coverage:{netWorth:annuals.length>0,trades:tradeSources.length>0,campaign:!!own.campaign},
      tradesTruncated:merged.length>1500||tradeSources.some(s=>Number(s.count)>(s.rows||[]).length||Number(s.more)>0)
    };
    if(own.campaign)entry.campaign=own.campaign;
    people[id]=entry;checkedAt=latest(checkedAt,ownChecked);
  }
  // Return explicit empty sections for configured people even when their imports have never completed. The separate
  // sourceCoverage map explains those absences; an empty record list is never presented as a no-activity finding.
  for(const person of config.people)people[person.id]||={netWorth:null,trades:[],tradesUnread:[],sizes:null,tradesMore:false,checkedAt:null,
    coverage:{netWorth:false,trades:false,campaign:false},tradesTruncated:false,campaign:null};
  return {people,sourceCoverage,checkedAt};
}

// The home cards' Net worth, Stocks owned and Stock trades tiles, for everyone at once (/api/cards): from each person's
// newest annual financial disclosure read by the refresh, and their trades from the official reports and the services
// (merged as on the profile). Trades count this cycle's (from January 1 of the cycle's first year); one is late when
// reported more than LATE_DAYS after the trade.
export function cardWealth(own,{cycle=config.cycle,officialFrom=null}={}){
  const annual=ANNUAL_KINDS.map(k=>own[k]).filter(Boolean).sort(newerAnnual).at(-1)||null;
  const was=annual?(annual.history||[]).find(h=>h&&h.year!=null&&annual.year!=null&&Number(h.year)<Number(annual.year)&&h.low!=null):null;
  const netWorth=annual&&annual.low!=null?{year:annual.year??null,low:annual.low,high:annual.high??null,url:annual.url||null,was:was?{year:was.year,low:was.low,high:was.high??null}:null}:null;
  const lead=annual?holdingsLead(annual):null,held=annual?stockHoldings(annual,lead?.status==='blind-trust'?{status:'blind-trust'}:null):null;
  const stocks=annual?{value:held.value,count:held.count??lead?.stocks??null,year:annual.year??null,blindTrust:!!held.blindTrust,why:held.why||null}:null;
  const sources=TRADE_KINDS.map(k=>own[k]).filter(Boolean);
  let trades=null;
  if(sources.length){
    const since=`${Number(cycle)-1}-01-01`,merged=mergeTrades(sources.map(x=>x.rows||[]),[],{},{officialFrom});
    const rows=merged.filter(t=>String(t.traded||'')>=since),late=rows.filter(t=>{const f=t.filed||t.disclosed;return !f||(Date.parse(f)-Date.parse(t.traded))/864e5>LATE_DAYS;});
    trades={n:rows.length,late:late.length,since,official:['trades-house','trades-senate'].some(k=>own[k])};
  }
  return {netWorth,stocks,trades};
}
// What Big Money Independence reads from the refresh, as a profile's Overview gets it (public/live.js disclosure), so a
// home card's grade is the profile's: the FEC's gift sizes for the cycle, the stocks on the annual report (the House's
// when there is one, as the profile reads it), and the official trades since the cycle began, with whether their trade
// reports are read completely. A trade is [traded, low, high, amount]. job: their chamber's trade-report job with its
// status (getStatus).
export function cardBmi(own,{chamber,job=null,cycle=config.cycle,officialFrom=null}={}){
  const sz=own['donor-sizes'],sizes=sz?(({cycles,...rest})=>rest)(sz):null;
  const snap=own['net-worth-house']||own['net-worth-senate']||null;
  const snapshot=snap?{year:snap.year??null,url:snap.url||null,unreadable:!!snap.unreadable,assets:Array.isArray(snap.assets)?snap.assets.filter(a=>assetKind(a)==='stock').map(a=>({name:a.name,type:a.type,value:a.value})):null}:null;
  const kind=chamber==='S'?'trades-senate':'trades-house',sec=own[kind]||null;
  const official=['trades-house','trades-senate'].filter(k=>own[k]),unread=official.flatMap(k=>own[k].unread||[]).length;
  const ready=!!job&&job.status==='ready'&&!job.stale;
  const why=!sec?'Their stock trade reports haven\'t been read yet':sec.more?'Their older trade reports are still being read':unread?`${unread} trade report${unread===1?' was':'s were'} filed on paper and can't be read automatically`:!ready?(job?.error||'The latest read of their trade reports hasn\'t finished'):null;
  const lists=TRADE_KINDS.map(k=>own[k]?.rows).filter(Boolean),since=`${Number(cycle)-1}-01-01`;
  const rows=lists.length?mergeTrades(lists,[],{},{officialFrom}).slice(0,1500).filter(t=>t.official&&String(t.traded||'')>=since).map(t=>[t.traded,t.low??null,t.high??null,t.amount??null]):[];
  return {sizes,snapshot,trades:{rows,covered:!why,why}};
}
export async function getCardWealth(env){
  const kinds=[...ANNUAL_KINDS,...TRADE_KINDS,'donor-sizes'];
  const rows=(await statement(env.DB,`SELECT j.subject,j.kind,s.payload FROM snapshots s JOIN jobs j ON j.id=s.job_id WHERE j.kind IN (${kinds.map(()=>'?').join(',')})`,...kinds).all()).results;
  const jobs=new Map((await getStatus(env)).jobs.filter(j=>j.kind==='trades-house'||j.kind==='trades-senate').map(j=>[`${j.kind}:${j.subject}`,j]));
  const chamberOf=new Map(config.people.map(p=>[p.id,p.chamber]));
  const known=new Set(config.people.map(p=>p.id)),by=new Map();
  for(const r of rows){const d=JSON.parse(r.payload);
    if(r.kind==='trades-eulerpool'){for(const [id,list] of Object.entries(d.byPerson||{}))if(known.has(id)&&Array.isArray(list)){const o=by.get(id)||{};o[r.kind]={rows:list};by.set(id,o);}continue;}
    if(!known.has(r.subject))continue;const o=by.get(r.subject)||{};o[r.kind]=d;by.set(r.subject,o);}
  const people={};
  for(const [id,own] of by){
    const official=['trades-house','trades-senate'].some(k=>own[k]),officialFrom=official?`${SINCE(config)}-01-01`:null,chamber=chamberOf.get(id);
    people[id]={...cardWealth(own,{officialFrom}),bmi:cardBmi(own,{chamber,job:jobs.get(`${chamber==='S'?'trades-senate':'trades-house'}:${id}`)||null,officialFrom})};
  }
  return {people};
}
