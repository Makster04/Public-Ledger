// The Big Money Independence tab's timeline of a member's own money, from their official disclosures as the refresh reads them:
//   - net worth by year: each annual report's range (public/net-worth.js), lowest to highest possible;
//   - the value of their individual stocks by year: the middle of the added-up ranges on that report;
//   - how much they bought and sold each year, added up from the middle of each trade's range;
//   - each trade, with its size and whether it was reported late (after LATE_DAYS) or never.
// Shown only, no grade uses it. A report filed on paper, or a value that can't be read, stays unknown: it is left out,
// never counted as zero.
import {valueRange} from './net-worth.js';
import {assetKind} from './holdings.js';
import {LATE_DAYS} from './grades.js';

const DAY=864e5;
const isDay=d=>/^\d{4}-\d{2}-\d{2}/.test(String(d||''));
// A trade's amount as [low, high] (high null when open-ended, "Over $50,000,000"), or null when it can't be read.
export function tradeRange(t){
  if(Number.isFinite(t?.low))return [t.low,Number.isFinite(t.high)?t.high:null];
  return valueRange(t?.amount);
}
const middle=r=>r?(r[1]==null?r[0]:(r[0]+r[1])/2):null;
// Its size, for the dot: 0 up to $15,000, 1 up to $50,000, 2 above (or open-ended).
export const TRADE_SIZES=['$1,001–$15,000','$15,001–$50,000','over $50,000'];
export function tradeSize(t){const r=tradeRange(t);if(!r)return null;const top=r[1]??Infinity;return top<=15000?0:top<=50000?1:2;}
// A purchase, a sale, or neither (an exchange, or a type the report doesn't say).
export function tradeSide(t){const x=String(t?.type||'').toLowerCase();return /^(purchase|buy|p\b)/.test(x)?'buy':/^(sale|sell|s\b)/.test(x)?'sell':'other';}
// Days from the trade to its report; late when over the deadline, or never reported ("missing").
export function tradeDelay(t,lateDays=LATE_DAYS){
  if(t?.missing)return {days:null,late:true,never:true};
  const filed=t?.filed||t?.disclosed;if(!isDay(filed)||!isDay(t?.traded))return {days:null,late:false,never:false};
  const days=Math.round((Date.parse(String(filed).slice(0,10))-Date.parse(String(t.traded).slice(0,10)))/DAY);
  return {days,late:days>lateDays,never:false};
}
// The value of the individual stocks on one year's report: {value (the middle), low, high, count}, value 0 when a report
// read in full lists none, null when it can't be known (filed on paper, or a stock's value can't be read).
export function stocksHeld(entry,assets){
  if(!entry||entry.unreadable)return null;
  const st=entry.stocks;
  if(st&&Number.isFinite(st.low))return {value:middle([st.low,st.high??null]),low:st.low,high:st.high??null,count:st.count??null,open:st.high==null};
  const list=Array.isArray(entry.assets)?entry.assets:assets;
  if(Array.isArray(list)&&list.length&&!list.some(a=>assetKind(a)==='stock'))return {value:0,low:0,high:0,count:0,open:false};
  return null;
}
// Bought or sold in one year: how many trades, and the total of the middles, lows and highs (high null when one is
// open-ended). Trades whose amount can't be read are counted but not added up ("unread").
function total(list){
  const known=list.map(t=>t.range).filter(Boolean);
  return {n:list.length,unread:list.length-known.length,mid:known.reduce((s,x)=>s+middle(x),0),
    low:known.reduce((s,x)=>s+x[0],0),high:known.some(x=>x[1]==null)?null:known.reduce((s,x)=>s+x[1],0)};
}
// netWorth: the refresh's net-worth snapshot (its newest report, with "history", one entry a year); trades: the trades
// read from their reports ({traded, filed, type, low, high or amount, ticker, asset}). Returns null with nothing to show.
// The profile header's Net worth, Stocks held and Stock trades: the same figures as the boxes over the Big Money Independence tab's
// timeline (tl: wealthTimeline()), so the two always agree. null when nothing has been read. net: the latest readable
// report's range (null when none can be read; reports: how many were read at all); stocks: stocksHeld() for it (null
// when its stock values can't be read); trades: the counts, the first year, and partial when the refresh says not every
// trade report is read (tradesWhy).
export function headerWealth(tl,{tradesWhy=null}={}){
  if(!tl)return null;
  const L=tl.latest;
  return {year:L?.year??null,url:L?.url??null,reports:tl.counts.reports,net:L?{low:L.low,high:L.high}:null,stocks:L?L.stocks:null,
    trades:{...tl.counts,since:tl.trades[0]?.year??null,partial:!!tradesWhy}};
}
export function wealthTimeline(netWorth,trades,{lateDays=LATE_DAYS}={}){
  const hist=netWorth?.history?.length?netWorth.history:netWorth?.year!=null?[netWorth]:[];
  const reports=new Map();
  for(const h of hist){const y=Number(h?.year);if(!Number.isInteger(y)||reports.has(y))continue;
    const own=y===Number(netWorth?.year)?netWorth.assets:null;
    reports.set(y,{year:y,low:h.low??null,high:h.high??null,unreadable:!!h.unreadable,url:h.url||null,filed:h.filed||null,stocks:stocksHeld(h,own)});}
  const rows=(trades||[]).filter(t=>isDay(t?.traded)).map(t=>{const d=tradeDelay(t,lateDays);
    return {traded:String(t.traded).slice(0,10),year:Number(String(t.traded).slice(0,4)),side:tradeSide(t),size:tradeSize(t),range:tradeRange(t),
      name:t.ticker||t.company||(t.asset&&!['stock','option','fund','bond','other'].includes(t.asset)?t.asset:null)||'a stock',owner:t.owner||null,...d};})
    .sort((a,b)=>a.traded.localeCompare(b.traded));
  const ys=[...reports.keys(),...rows.map(r=>r.year)];
  if(!ys.length)return null;
  const from=Math.min(...ys),to=Math.max(...ys),years=[];
  for(let y=from;y<=to;y++){const t=rows.filter(r=>r.year===y);
    years.push({year:y,worth:reports.get(y)||null,bought:total(t.filter(r=>r.side==='buy')),sold:total(t.filter(r=>r.side==='sell')),other:t.filter(r=>r.side==='other').length});}
  const latest=[...reports.values()].sort((a,b)=>b.year-a.year).find(r=>!r.unreadable)||null;
  const first=[...reports.values()].sort((a,b)=>a.year-b.year).find(r=>!r.unreadable)||null;
  return {from,to,years,trades:rows,latest,first,
    counts:{trades:rows.length,buys:rows.filter(r=>r.side==='buy').length,sells:rows.filter(r=>r.side==='sell').length,late:rows.filter(r=>r.late).length,reports:reports.size}};
}
