// What a member's latest annual financial disclosure shows about how they hold investments (step 8): a qualified blind
// trust, individual stocks, or neither. Read from the asset list the net-worth refresh keeps (src/feeds.mjs,
// "net-worth-house" and "net-worth-senate"). It is a lead: the Integrity grade uses only the reviewed status in
// research.json ("holdings", see HOLDINGS in public/grades.js), which a person confirms from the report or a cited source.
import {HOLDINGS} from './grades.js';
import {valueRange} from './net-worth.js';

// The House's asset-type codes (the bracketed code after each asset on the form), by kind. EQ is "excepted or qualified
// blind trust": only one named as a blind trust counts as one; an excepted trust is a different arrangement.
const HOUSE_KIND={ST:'stock',OP:'stock',RS:'stock',SA:'stock',EQ:'trust',TR:'trust',MA:'managed',BK:'managed',
  MF:'fund',EF:'fund',ET:'fund',RE:'fund',HE:'fund',HN:'fund',IC:'fund',IR:'fund',IH:'fund','4K':'fund','5C':'fund','5F':'fund','5P':'fund',
  DB:'fund',PE:'fund',VA:'fund',FN:'fund',VI:'fund',WU:'fund',GS:'bond',CS:'bond',AB:'bond',BA:'cash',
  PS:'private',OL:'private',OI:'private',RP:'property',FA:'property',MO:'property',DS:'property'};
// One asset -> 'blind' | 'stock' | 'trust' | 'managed' | 'fund' | 'bond' | 'cash' | 'private' | 'property' | 'other'.
export function assetKind(a){
  const name=String(a?.name||''),type=String(a?.type||'');
  if(/qualified\s+blind\s+trust|\bQBT\b/i.test(`${name} ${type}`))return 'blind';
  if(a?.code){const k=HOUSE_KIND[String(a.code).toUpperCase()]||'other';return k==='trust'&&/blind/i.test(name)?'blind':k;}
  const t=type||name;
  if(/non-?public|not publicly traded|private/i.test(t))return 'private';
  if(/option|\bstock|\bshares?\b|common|ADR/i.test(t)&&!/fund|etf|index/i.test(t))return 'stock';
  if(/managed|brokerage/i.test(t))return 'managed';
  if(/fund|etf|retirement|401|\bira\b|529|pension|annuity|insurance|thrift savings|\btsp\b/i.test(t))return 'fund';
  if(/bond|securit|treasury|note|municipal/i.test(t))return 'bond';
  if(/bank|deposit|cash|money market|checking|savings|\bcd\b/i.test(t))return 'cash';
  if(/business|llc|partnership|farm|real estate|property|land/i.test(t))return 'property';
  if(/trust/i.test(t))return 'trust';
  return 'other';
}
// The lead from one annual report (a net-worth snapshot: {year, url, assets: [...]}), or null when nothing was read.
//   status 'blind-trust'  a qualified blind trust is listed (individual stocks outside it are counted too)
//   status 'no-stocks'    no individual stocks or stock options listed
//   status 'stocks'       individual stocks or stock options listed
export function holdingsLead(x){
  const assets=x?.assets||[];if(x?.unreadable||!assets.length)return null;
  const by={};for(const a of assets){const k=assetKind(a);(by[k]||=[]).push(a);}
  const n=k=>(by[k]||[]).length,names=k=>(by[k]||[]).map(a=>a.name).filter(Boolean);
  const status=n('blind')?'blind-trust':n('stock')?'stocks':'no-stocks';
  return {status,year:x.year||null,url:x.url||null,n:assets.length,stocks:n('stock'),stockNames:names('stock'),blindTrusts:names('blind'),
    managed:n('managed'),funds:n('fund')+n('bond')+n('cash'),private:n('private'),other:n('other')+n('trust'),
    label:status==='stocks'?`${n('stock')} individual stock${n('stock')===1?'':'s'} or option${n('stock')===1?'':'s'} listed`:HOLDINGS[status]};
}
// The reviewed status compared with the latest report's lead: 'agrees', 'differs' (the report suggests another status, so
// the reviewed one needs another look), 'lead' (no reviewed status yet, and the report suggests one worth confirming), or
// null when there's nothing to compare.
export function holdingsReview(reviewed,lead){
  if(!lead)return null;
  const r=reviewed?.status;
  if(!r)return lead.status==='stocks'?null:'lead';
  return r===lead.status?'agrees':'differs';
}
// Turn a reviewed note into display data independently of the live annual-report import. A missing snapshot must not
// hide existing research or be mistaken for evidence that the person owns no stocks.
export function reviewedHoldingsSummary(reviewed){
  if(!reviewed||!HOLDINGS[reviewed.status])return null;
  return {label:HOLDINGS[reviewed.status],since:reviewed.since||null,note:reviewed.note||null,
    source:reviewed.src||null,also:reviewed.also||null};
}
// Official source coverage is separate from the presence or absence of rows. Only a recent, successfully published
// import supports saying that the source was checked; every other state leaves activity unknown.
export function officialDisclosureCoverage(job){
  if(!job)return {complete:false,reason:'No official disclosure import is configured for this profile.'};
  if(job.status==='ready'&&!job.stale)return {complete:true,reason:null};
  return {complete:false,reason:job.error||'The latest official disclosure import has not completed.'};
}
// Reviewed trades in individual stocks after a "no-stocks" status began: the status can't be right as written.
export function stockTradesSince(holdings,trades){
  if(holdings?.status!=='no-stocks'||!holdings.since)return [];
  return (trades||[]).filter(t=>(t.asset||'stock')==='stock'&&String(t.traded||'')>=String(holdings.since));
}

// The individual stocks and options on one annual report, added up: {low, high, count} (high null when one has no upper
// limit), or null when the report lists none or a value can't be read. A history entry carries it already ("stocks").
export function stockRange(report){
  if(!report)return null;
  if(!Array.isArray(report.assets)||!report.assets.length)return report.stocks??null;
  const ranges=report.assets.filter(a=>assetKind(a)==='stock').map(a=>valueRange(a.value));
  if(!ranges.length||ranges.some(r=>!r))return null;
  return {low:ranges.reduce((n,r)=>n+r[0],0),high:ranges.some(r=>r[1]===null)?null:ranges.reduce((n,r)=>n+r[1],0),count:ranges.length};
}
// One year of a member's annual reports, for the history kept with their net worth: the report's range, its parts and its
// stocks, without the asset list.
export function annualEntry(r){
  return {id:r.id??r.doc??null,year:r.year??null,filed:r.filed??null,url:r.url??null,type:r.type??null,low:r.low??null,high:r.high??null,
    assetsLow:r.assetsLow??null,assetsHigh:r.assetsHigh??null,debtsLow:r.debtsLow??null,debtsHigh:r.debtsHigh??null,
    nAssets:r.nAssets??0,nDebts:r.nDebts??0,unread:r.unread??0,unreadable:!!r.unreadable,stocks:stockRange(r)};
}
