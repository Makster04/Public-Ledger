// Cross-profile financial views read completed snapshots; they never refresh sources or score records.
import config from '../data/config.json' with {type:'json'};
import {initialize,statement} from './refresh.mjs';
import {mergeTrades} from './merge.mjs';
import {SINCE} from './feeds.mjs';

const TRADE_KINDS=['trades-house','trades-senate','trades-bargo','trades-eulerpool','trades-fmp'];
const ANNUAL_KINDS=['net-worth-house','net-worth-senate'];
const KINDS=['campaign',...ANNUAL_KINDS,...TRADE_KINDS,'house-fd','sec-sic'];
const latest=(a,b)=>!a?b:!b?a:a>b?a:b;
const newerAnnual=(a,b)=>Number(a.year||0)-Number(b.year||0)||String(a.filed||'').localeCompare(String(b.filed||''))||String(a.checkedAt||'').localeCompare(String(b.checkedAt||''));

/** One bounded, local query for the same finance records already available on individual profiles. */
export async function getFinanceOverview(env){
  await initialize(env.DB);
  const rows=(await statement(env.DB,`SELECT j.subject,j.kind,s.payload,s.updated_at FROM snapshots s JOIN jobs j ON j.id=s.job_id WHERE j.kind IN (${KINDS.map(()=>'?').join(',')}) ORDER BY s.updated_at,s.job_id`,...KINDS).all()).results;
  const known=new Set(config.people.map(p=>p.id)),sections=new Map(),filings=new Map();
  let sectors={};
  for(const row of rows){
    const data=JSON.parse(row.payload);
    if(row.kind==='sec-sic'){
      sectors={...sectors,...data.byTicker};
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
      checkedAt:ownChecked,
      coverage:{netWorth:annuals.length>0,trades:tradeSources.length>0,campaign:!!own.campaign},
      tradesTruncated:merged.length>1500||tradeSources.some(s=>Number(s.count)>(s.rows||[]).length||Number(s.more)>0)
    };
    if(own.campaign)entry.campaign=own.campaign;
    people[id]=entry;checkedAt=latest(checkedAt,ownChecked);
  }
  return {people,checkedAt};
}
