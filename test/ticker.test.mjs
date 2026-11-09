// The ticker under the top bar (public/ticker.js) and the refresh's newest trades and disclosures for it
// (tickerRecent, tickerMerge in src/refresh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import research from '../public/research.json' with {type:'json'};
import log from '../public/score-presentation-log.json' with {type:'json'};
import house from '../public/house.json' with {type:'json'};
import senate from '../public/senate.json' with {type:'json'};
import {TICKER,raceItems,siteItems,ratingItems,liveItems,tickerItems,tickerHTML,shortDate,mountTicker} from '../public/ticker.js';
import {tickerRecent,tickerMerge,TICKER_KINDS} from '../src/refresh.mjs';

const people=new Map();for(const p of [...house.members,...senate.senators,...research.cands,...research.members])people.set(p.id,p);
const NOV9=Date.parse('2026-11-09T15:00:00Z');
const text=x=>x.parts.map(p=>typeof p==='string'?p:`${p.name} (${p.party})`).join('');

test('races: each call and count from the election results, for a while after the election',()=>{
  const items=raceItems(research,{now:NOV9,people});
  assert.ok(items.length>=20);
  const ak=items.find(x=>x.key==='race:S-AK');
  assert.deepEqual([ak.tag,ak.date,text(ak)],['Still counting','2026-11-04','Alaska Senate: Peltola (D) leads Sullivan (R) by 626 votes']);
  const ga=items.find(x=>x.key==='race:S-GA');
  assert.deepEqual([ga.tag,text(ga),ga.href],['Race called','Georgia Senate: Ossoff (D) wins · called by NBC News and CBS News','#ossoff']);
  assert.deepEqual(raceItems(research,{now:Date.parse('2027-01-15'),people}),[],'gone once the election is weeks past');
});

test('site updates: the log\'s entries that carry a headline, within a month; rule changes are left out',()=>{
  const items=siteItems(log.entries,{now:NOV9});
  assert.ok(items.every(x=>Date.parse(x.date)>=NOV9-31*864e5));
  assert.deepEqual(items.map(x=>[x.tag,text(x)]),[['Site update','Interest-group ratings are shown as letter grades']]);
  const rule={date:'2026-11-08',headline:'A rule',note:'Rule change: something'};
  assert.deepEqual(siteItems([rule],{now:NOV9}),[],'a rule change isn\'t shown, even with a headline');
  assert.ok(!items.some(x=>/Workers > Profit/.test(text(x))),'only entries with a headline: not the notes about grades since replaced');
  assert.ok(!items.some(x=>/ticker/i.test(text(x))),'the ticker doesn\'t announce itself');
});

test('ratings: how many groups were read and how many profiles they rate',()=>{
  const r={checked:'2026-11-08',groups:{a:{read:'2026-11-08'},b:{read:'2026-11-08'},c:{status:'blocked'}},people:{x:[],y:[],z:[]}};
  assert.deepEqual(ratingItems(r,{now:NOV9}).map(text),['Interest-group ratings read: 2 groups · 3 profiles rated']);
  assert.deepEqual(ratingItems({...r,checked:'2026-08-01'},{now:NOV9}),[]);
});

test('the refresh\'s newest trades and disclosures, named from the directories, each kind for its days',()=>{
  const live={items:[{kind:'trade',subject:'ossoff',disclosed:'2026-11-06',type:'sale',amount:'$1,001 - $15,000',ticker:'AAPL',owner:'spouse'},
    {kind:'trade',subject:'ossoff',disclosed:'2026-10-01',type:'purchase',amount:'$1,001 - $15,000',ticker:'MSFT'},
    {kind:'filing',subject:'begich',filed:'2026-10-20',year:2025},{kind:'trade',subject:'nobody-here',disclosed:'2026-11-06',type:'sale'}]};
  const items=liveItems(live,{now:NOV9,people});
  assert.deepEqual(items.map(text),['Ossoff (D) reported a sale of $1,001–$15,000 in AAPL (spouse)','Begich (R) filed their 2025 annual financial disclosure']);
  assert.deepEqual(items.map(x=>x.href),['#ossoff-aboveboard','#begich-aboveboard']);
});

test('all of it, newest first, still counting ahead of the calls of the same day, at most the limit',()=>{
  const items=tickerItems({research,log:log.entries,ratings:{checked:'2026-11-09',groups:{a:{read:'x'}},people:{p:[]}},people},{now:NOV9});
  assert.ok(items.length<=TICKER.limit);
  for(let i=1;i<items.length;i++)assert.ok(Date.parse(items[i-1].date)>=Date.parse(items[i].date),'newest first');
  const nov4=items.filter(x=>x.date==='2026-11-04');assert.equal(nov4[0].tag,'Still counting');
  assert.deepEqual(tickerItems({research,log:[],ratings:null,people},{now:Date.parse('2027-03-01')}),[],'nothing recent: no ticker');
  assert.equal(shortDate('2026-11-04'),'Nov 4');
});

test('the strip: escaped text, the loop\'s second copy hidden from screen readers and the keyboard; nothing to show, nothing drawn',()=>{
  const items=[{key:'a',kind:'site',tag:'Site update',date:'2026-11-08',order:3,href:'#method',parts:['<script>x</script> & more']},{key:'b',kind:'call',tag:'Race called',date:'2026-11-04',order:1,href:'#ossoff',parts:['Georgia: ',{name:'Ossoff',party:'D'},' wins']}];
  const html=tickerHTML(items);
  assert.ok(!html.includes('<script>')&&html.includes('&lt;script&gt;x&lt;/script&gt; &amp; more'));
  assert.match(html,/<b class="tk-d">Ossoff \(D\)<\/b>/);
  assert.match(html,/<div class="tk-set" aria-hidden="true">.*tabindex="-1"/s);
  assert.equal((html.match(/class="tk-item"/g)||[]).length,4,'two copies of each');
  assert.equal(tickerHTML([]),'');
});

test('mounted: drawn at once from what the page has, again when the refresh\'s records arrive; hidden when empty',async()=>{
  const host={dataset:{},innerHTML:'',hidden:true};
  let answer;const live=new Promise(r=>answer=r);
  mountTicker(host,{research:{races:[]},log:[],ratings:null,people,fetchLive:()=>live});
  assert.equal(host.hidden,true,'nothing yet');
  answer({items:[{kind:'trade',subject:'ossoff',disclosed:new Date().toISOString().slice(0,10),type:'sale',ticker:'AAPL'}]});
  await live;await new Promise(r=>setTimeout(r,0));
  assert.equal(host.hidden,false);assert.match(host.innerHTML,/Ossoff \(D\)<\/b> reported a sale in AAPL/);
});

test('the refresh keeps each check\'s newest trades and disclosures small, and the ticker merges them by date',()=>{
  const now=NOV9;
  assert.deepEqual(TICKER_KINDS,['trades-house','trades-senate','net-worth-house','net-worth-senate']);
  const trades=tickerRecent('trades-house','begich',{rows:[{id:'1',disclosed:'2026-11-05',traded:'2026-10-20',type:'purchase',ticker:'NVDA',amount:'$1,001 - $15,000',asset:'NVIDIA'},
    {id:'2',disclosed:'2026-09-01',type:'sale',ticker:'AAPL'},{id:'3',disclosed:'2026-11-07',type:'sale',ticker:null,asset:'US Treasury Note'}]},{now});
  assert.deepEqual(trades.map(x=>[x.id,x.disclosed,x.ticker,x.asset]),[['3','2026-11-07',null,'US Treasury Note'],['1','2026-11-05','NVDA',null]]);
  assert.deepEqual(tickerRecent('net-worth-senate','ossoff',{filed:'2026-10-25T00:00:00Z',year:2025},{now}),[{kind:'filing',subject:'ossoff',filed:'2026-10-25',year:2025}]);
  assert.deepEqual(tickerRecent('net-worth-senate','ossoff',{filed:'2026-05-15',year:2025},{now}),[],'an old filing');
  const merged=tickerMerge([trades,[{kind:'filing',subject:'ossoff',filed:'2026-11-08',year:2025}],[{kind:'trade',subject:'x',disclosed:'2026-10-01'}]],{now});
  assert.deepEqual(merged.map(x=>x.disclosed||x.filed),['2026-11-08','2026-11-07','2026-11-05'],'newest first; one past its days dropped');
});
