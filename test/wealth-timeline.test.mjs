// Net worth, stocks held and trades over time on the Unbought tab (public/wealth-timeline.js and its charts in
// public/charts.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {wealthTimeline,headerWealth,tradeRange,tradeSize,tradeSide,tradeDelay,stocksHeld} from '../public/wealth-timeline.js';
import {annualSummary} from '../src/feeds.mjs';
import {holdingsSnapshot} from '../src/feeds.mjs';
import {drawNetWorthYears,drawStocksTrades,drawTradeStrip} from '../public/charts.js';

globalThis.document??={querySelector:()=>null};
const report=(year,assets,debts=[],extra={})=>({...holdingsSnapshot({year,filed:`${year+1}-05-15`,url:`https://example.org/${year}`},{assets,debts}),id:String(year),...extra});

test('a trade\'s range, size, side and delay, from the official reports\' fields or a reviewed row\'s',()=>{
  assert.deepEqual(tradeRange({low:1001,high:15000}),[1001,15000]);
  assert.deepEqual(tradeRange({amount:'$15,001 - $50,000'}),[15001,50000]);
  assert.deepEqual(tradeRange({amount:'Over $50,000,000'}),[50000001,null]);
  assert.equal(tradeRange({amount:'unknown'}),null);
  assert.deepEqual([tradeSize({low:1001,high:15000}),tradeSize({low:15001,high:50000}),tradeSize({low:50001,high:100000}),tradeSize({amount:'Over $1,000,000'})],[0,1,2,2]);
  assert.deepEqual(['purchase','sale','Sale (Partial)','exchange',undefined].map(type=>tradeSide({type})),['buy','sell','sell','other','other']);
  assert.deepEqual(tradeDelay({traded:'2024-01-02',filed:'2024-02-01'}),{days:30,late:false,never:false});
  assert.deepEqual(tradeDelay({traded:'2024-01-02',filed:'2024-03-01'}),{days:59,late:true,never:false});
  assert.deepEqual(tradeDelay({traded:'2024-01-02',missing:true}),{days:null,late:true,never:true},'never reported counts as late');
  assert.deepEqual(tradeDelay({traded:'2024-01-02'}),{days:null,late:false,never:false},'no report date: not called late');
});

test('stocks held: the middle of the added-up ranges; none when a report read in full lists none; unknown otherwise',()=>{
  assert.deepEqual(stocksHeld({stocks:{low:1001,high:15000,count:1}}),{value:8000.5,low:1001,high:15000,count:1,open:false});
  assert.equal(stocksHeld({stocks:{low:50000001,high:null,count:2}}).open,true);
  assert.deepEqual(stocksHeld({stocks:null,assets:[{name:'Savings account',type:'Bank Deposit',value:'$15,001 - $50,000'}]}).value,0);
  assert.equal(stocksHeld({stocks:null}),null,'no asset list to check: unknown, not zero');
  assert.equal(stocksHeld({unreadable:true,stocks:null}),null,'a paper report stays unknown');
});

test('the timeline: one entry a year from the first report or trade to the last, with buys and sells added up',()=>{
  const apple={name:'Apple Inc. (AAPL)',type:'Stock',value:'$15,001 - $50,000'},bank={name:'Checking',type:'Bank Deposit',value:'$100,001 - $250,000'};
  const nw=annualSummary([report(2021,[apple,bank]),report(2023,[bank]),report(2022,[],[],{unreadable:true})]);
  const trades=[{traded:'2022-03-01',filed:'2022-03-20',type:'purchase',low:1001,high:15000,ticker:'AAPL'},
    {traded:'2022-06-01',filed:'2022-09-01',type:'sale',low:15001,high:50000,ticker:'MSFT'},
    {traded:'2024-01-10',filed:'2024-01-30',type:'purchase',amount:'$50,001 - $100,000',asset:'NVIDIA Corp'},
    {traded:'2024-02-10',filed:'2024-02-20',type:'exchange',low:1001,high:15000,ticker:'X'},{traded:'bad',type:'sale'}];
  const tl=wealthTimeline(nw,trades);
  assert.deepEqual(tl.years.map(y=>y.year),[2021,2022,2023,2024]);
  assert.equal(tl.from,2021);assert.equal(tl.to,2024);
  const y21=tl.years[0],y22=tl.years[1],y23=tl.years[2],y24=tl.years[3];
  assert.deepEqual([y21.worth.low,y21.worth.high],[115002,300000]);
  assert.equal(y21.worth.stocks.value,32500.5,'the middle of Apple\'s range');
  assert.equal(y22.worth.unreadable,true);assert.equal(y22.worth.stocks,null);
  assert.equal(y23.worth.stocks.value,0,'a report read in full with no stocks: none');
  assert.equal(y24.worth,null,'no report that year: left blank');
  assert.deepEqual(y22.bought,{n:1,unread:0,mid:8000.5,low:1001,high:15000});
  assert.deepEqual(y22.sold,{n:1,unread:0,mid:32500.5,low:15001,high:50000});
  assert.equal(y24.bought.mid,75000.5);assert.equal(y24.other,1,'an exchange is neither bought nor sold');
  assert.deepEqual(tl.counts,{trades:4,buys:2,sells:1,late:1,reports:3});
  assert.equal(tl.trades[1].late,true);assert.equal(tl.trades[2].name,'NVIDIA Corp');
  assert.equal(tl.latest.year,2023);assert.equal(tl.first.year,2021);
  assert.equal(wealthTimeline(null,[]),null,'nothing read: nothing to show');
  assert.deepEqual(wealthTimeline(null,trades.slice(0,1)).years.map(y=>y.worth),[null],'trades alone still draw');
});

test('the charts draw every year, a paper report as a dashed box, open-ended tops with an arrow, and late trades ringed',()=>{
  const nw=annualSummary([report(2020,[{name:'A',type:'Stock',value:'Over $50,000,000'}]),report(2021,[],[],{unreadable:true}),report(2022,[{name:'B',type:'Stock',value:'$1,001 - $15,000'}])]);
  const tl=wealthTimeline(nw,[{traded:'2022-04-01',filed:'2022-08-01',type:'purchase',low:1001,high:15000,ticker:'AAPL'},{traded:'2022-05-01',filed:'2022-05-10',type:'sale',low:15001,high:50000,ticker:'MSFT'}]);
  const el=()=>({clientWidth:520,innerHTML:'',querySelectorAll:()=>[]});
  const a=el(),b=el(),c=el();drawNetWorthYears(a,tl);drawStocksTrades(b,tl);drawTradeStrip(c,tl);
  assert.match(a.innerHTML,/class="cx-gapbox"/);assert.match(a.innerHTML,/class="cx-open"/);assert.match(a.innerHTML,/filed on paper/);
  for(const y of ['2020','2021','2022'])assert.match(a.innerHTML,new RegExp(`>${y}<`));
  assert.match(b.innerHTML,/class="cx-line"|class="cx-dot held"/);assert.match(b.innerHTML,/bought about \$8\.0K in 1 trade/);assert.match(b.innerHTML,/annual report filed on paper/);
  assert.match(c.innerHTML,/cx-dot buy late-ring/);assert.match(c.innerHTML,/reported after 122 days \(late\)/);assert.match(c.innerHTML,/cx-dot sell"/);
  const none=el();drawTradeStrip(none,{...tl,trades:[]});assert.match(none.innerHTML,/No trades in the reports read so far/);
});

test('the profile header\'s Net worth, Stocks held and Stock trades: the timeline\'s own figures, never a guess',()=>{
  assert.equal(headerWealth(null),null,'nothing read');
  const nw={year:2025,filed:'2026-05-15',url:'https://example.org/2025',low:-200000,high:3400000,assets:[],
    history:[{year:2025,filed:'2026-05-15',url:'https://example.org/2025',low:-200000,high:3400000,stocks:{low:250000,high:null,count:23}},{year:2019,low:1,high:2,stocks:{low:5,high:6,count:1}}]};
  const trades=[{traded:'2019-03-01',filed:'2019-03-20',type:'purchase',low:1001,high:15000},{traded:'2024-06-01',filed:'2024-09-01',type:'sale',low:1001,high:15000},{traded:'2025-01-02',filed:'2025-01-10',type:'purchase',low:15001,high:50000}];
  const tl=wealthTimeline(nw,trades),h=headerWealth(tl);
  // The same as the boxes over the timeline: the latest readable report, its stocks, and every trade read.
  assert.deepEqual(h.net,{low:tl.latest.low,high:tl.latest.high});assert.deepEqual(h.stocks,tl.latest.stocks);
  assert.deepEqual([h.year,h.url,h.trades.trades,h.trades.buys,h.trades.sells,h.trades.late,h.trades.since,h.trades.partial],[2025,'https://example.org/2025',3,2,1,1,2019,false]);
  assert.equal(h.stocks.open,true,'an open-ended stock range stays open (shown with a +)');
  assert.equal(headerWealth(tl,{tradesWhy:'Their older trade reports are still being read'}).trades.partial,true);
  // Only unreadable reports: no net worth or stocks, but the count of reports says one was read.
  const bad=headerWealth(wealthTimeline({year:2025,history:[{year:2025,unreadable:true}]},[]));
  assert.deepEqual([bad.net,bad.stocks,bad.reports],[null,null,1]);
  // Trades but no annual report: trades counted, the rest not read.
  const tOnly=headerWealth(wealthTimeline(null,trades));assert.deepEqual([tOnly.net,tOnly.trades.trades],[null,3]);
  // On the page: three boxes under the campaign boxes, the same grid, "~" for the stocks' middle value, linked to the timeline.
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../public/remake.css',import.meta.url),'utf8');
  assert.match(app,/\$\{s\.office\?'':wealthRowHTML\(s,'loading'\)\}/);
  assert.match(app,/if\(overview&&!s\.office\)fillWealthHeader\(s\);/);
  assert.match(app,/headerWealth\(wealthTimeline\(d\.netWorth,timelineTrades\(s,d\)\)/,'from the timeline\'s own records');
  assert.match(app,/box\('Net worth',[\s\S]*box\('Stocks held',[\s\S]*box\('Stock trades',/);
  assert.match(app,/html:`~\$\{fmt\$\(k\.value\)\}/);assert.doesNotMatch(app.slice(app.indexOf('function wealthRowHTML'),app.indexOf('async function fillWealthHeader')),/about \$\{fmt/);
  assert.match(app,/timeline:\['unbought','u-timeline'\]/);
  assert.match(css,/\.profile-hero \.profile-facts\.profile-wealth \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css,/\.profile-wealth \.profile-fact \{ container-type: inline-size; text-align: center; \}/,'centered');
  assert.match(css,/\.profile-wealth \.profile-fact > span \{ font-weight: 700; \}/,'bold titles');
});
