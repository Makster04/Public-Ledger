// The ticker under the top bar (public/ticker.js) and the refresh's newest trades and disclosures for it
// (tickerRecent, tickerMerge in src/refresh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import research from '../public/research.json' with {type:'json'};
import log from '../public/score-presentation-log.json' with {type:'json'};
import house from '../public/house.json' with {type:'json'};
import senate from '../public/senate.json' with {type:'json'};
import {TICKER,raceItems,siteItems,ratingItems,liveItems,tickerItems,tickerHTML,shortDate,mountTicker,isFresh} from '../public/ticker.js';
import {tickerRecent,tickerMerge,TICKER_KINDS} from '../src/refresh.mjs';

const people=new Map();for(const p of [...house.members,...senate.senators,...research.cands,...research.members])people.set(p.id,p);
const NOV9=Date.parse('2026-11-09T15:00:00Z');
const text=x=>x.parts.map(p=>typeof p==='string'?p:`${p.name} (${p.party})`).join('');

test('only the last 24 hours: a timestamp exactly, a date alone counted from noon UTC that day',()=>{
  assert.equal(TICKER.hours,24);
  assert.equal(isFresh('2026-11-09T00:00:00Z',NOV9),true);assert.equal(isFresh('2026-11-08T14:00:00Z',NOV9),false,'25 hours before');
  assert.equal(isFresh('2026-11-09',NOV9),true,'today');assert.equal(isFresh('2026-11-08',NOV9),false,'yesterday, past noon today');
  assert.equal(isFresh('2026-11-08',Date.parse('2026-11-09T10:00:00Z')),true,'yesterday, before noon today');
  assert.equal(isFresh('2026-11-12',NOV9),false,'a date to come');assert.equal(isFresh('2026-11-09',Date.parse('2026-11-09T01:00:00Z')),true,'today, early in the day');assert.equal(isFresh('',NOV9),false);
});

test('races: a race still counting stays on; a call only within 24 hours of its own date',()=>{
  const NOV13=Date.parse('2026-11-13T15:00:00Z'),items=raceItems(research,{now:NOV13,people});
  const ak=items.find(x=>x.key==='race:S-AK');
  assert.deepEqual([ak.tag,ak.date,text(ak),ak.href],['Still counting','2026-11-11','Alaska Senate: Peltola (D) leads Sullivan (R) by 3,975 votes','#peltola']);
  assert.ok(items.length&&items.every(x=>x.tag==='Still counting'),'two days after the last call, only the races still counting');
  // On the day of a call, that call (a results-only race too); the calls of election night stay off.
  const nov11={...research,election:{...research.election,asof:'2026-11-11'}};
  const fresh=raceItems(nov11,{now:Date.parse('2026-11-11T20:00:00Z'),people});
  const ms=fresh.find(x=>x.key==='race:S-MS');
  assert.equal(text(ms),'Mississippi Senate: Colom (D) wins · called by the AP on Nov. 11; Cindy Hyde-Smith conceded');
  assert.ok(!fresh.some(x=>x.key==='race:S-GA'),'a call from Nov. 4 isn\'t news on Nov. 11');
  const nov4={...research,election:{...research.election,asof:'2026-11-04'}};
  const night=raceItems(nov4,{now:Date.parse('2026-11-04T20:00:00Z'),people});
  const ga=night.find(x=>x.key==='race:S-GA');
  assert.deepEqual([ga.tag,text(ga),ga.href],['Race called','Georgia Senate: Ossoff (D) wins · called by NBC News and CBS News','#ossoff']);
  const az=night.find(x=>x.key==='race:H-AZ-06');
  assert.ok(az&&/^Arizona AZ-06: Mendoza \(D\) wins/.test(text(az)),'a House toss-up names its winner as the race lists them');
  assert.deepEqual(raceItems(research,{now:Date.parse('2027-01-15'),people}),[],'gone once the results are weeks old, even still counting');
});

test('site updates: the log\'s entries that carry a headline, within 24 hours; rule changes are left out',()=>{
  const nov8=Date.parse('2026-11-08T20:00:00Z'),items=siteItems(log.entries,{now:nov8});
  assert.deepEqual(items.map(x=>[x.tag,text(x)]),[['Site update','Interest-group ratings are shown as letter grades']]);
  assert.deepEqual(siteItems(log.entries,{now:NOV9}),[],'a day later, gone');
  const rule={date:'2026-11-08',headline:'A rule',note:'Rule change: something'};
  assert.deepEqual(siteItems([rule],{now:nov8}),[],'a rule change isn\'t shown, even with a headline');
  assert.ok(!items.some(x=>/Workers > Profit/.test(text(x))),'only entries with a headline: not the notes about grades since replaced');
  assert.ok(!items.some(x=>/ticker/i.test(text(x))),'the ticker doesn\'t announce itself');
});

test('ratings: how many groups were read and how many profiles they rate, within 24 hours',()=>{
  const r={checked:'2026-11-09',groups:{a:{read:'2026-11-09'},b:{read:'2026-11-09'},c:{status:'blocked'}},people:{x:[],y:[],z:[]}};
  assert.deepEqual(ratingItems(r,{now:NOV9}).map(text),['Interest-group ratings read: 2 groups · 3 profiles rated']);
  assert.deepEqual(ratingItems({...r,checked:'2026-11-07'},{now:NOV9}),[]);
});

test('the refresh\'s trades and disclosures: within 24 hours of when it first read them, showing the date reported',()=>{
  const live={items:[{kind:'trade',subject:'ossoff',disclosed:'2026-11-06',seen:'2026-11-09T09:00:00Z',type:'sale',amount:'$1,001 - $15,000',ticker:'AAPL',owner:'spouse'},
    {kind:'trade',subject:'ossoff',disclosed:'2026-11-09',seen:'2026-11-07T09:00:00Z',type:'purchase',ticker:'MSFT'},
    {kind:'filing',subject:'begich',filed:'2026-11-09',seen:null,year:2025},{kind:'trade',subject:'ossoff',disclosed:'2026-11-05',type:'sale',ticker:'X'},
    {kind:'trade',subject:'nobody-here',disclosed:'2026-11-09',type:'sale'}]};
  const items=liveItems(live,{now:NOV9,people});
  assert.deepEqual(items.map(text),['Ossoff (D) reported a sale of $1,001–$15,000 in AAPL (spouse)','Begich (R) filed their 2025 annual financial disclosure'],
    'read 6 hours ago though reported Nov 6: shown; read two days ago: not; no time read: its own date');
  assert.deepEqual(items.map(x=>[x.date,x.href]),[['2026-11-06','#ossoff-aboveboard'],['2026-11-09','#begich-aboveboard']]);
});

test('all of it, newest first by when it reached the site, at most the limit; races still counting are all that\'s left after a day',()=>{
  const items=tickerItems({research,log:log.entries,ratings:{checked:'2026-11-09',groups:{a:{read:'x'}},people:{p:[]}},people},{now:NOV9});
  assert.ok(items.length<=TICKER.limit);
  assert.equal(items[0].tag,'Ratings','today\'s first');
  assert.ok(items.slice(1).every(x=>x.tag==='Still counting'));
  assert.deepEqual(tickerItems({research,log:log.entries,ratings:null,people},{now:Date.parse('2026-11-20T12:00:00Z')}).map(x=>x.tag).filter(t=>t!=='Still counting'),[],'old updates gone');
  assert.deepEqual(tickerItems({research,log:[],ratings:null,people},{now:Date.parse('2027-03-01')}),[],'nothing recent: no ticker');
  assert.equal(shortDate('2026-11-04'),'Nov 4');assert.equal(shortDate('2026-11-09T09:00:00Z'),'Nov 9');
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

test('the refresh keeps each check\'s newest trades and disclosures small, stamped with when first read, and merges them by date',()=>{
  const now=NOV9;
  assert.deepEqual(TICKER_KINDS,['trades-house','trades-senate','net-worth-house','net-worth-senate']);
  const trades=tickerRecent('trades-house','begich',{rows:[{id:'1',disclosed:'2026-11-05',traded:'2026-10-20',type:'purchase',ticker:'NVDA',amount:'$1,001 - $15,000',asset:'NVIDIA'},
    {id:'2',disclosed:'2026-09-01',type:'sale',ticker:'AAPL'},{id:'3',disclosed:'2026-11-07',type:'sale',ticker:null,asset:'US Treasury Note'}]},{now});
  assert.deepEqual(trades.map(x=>[x.id,x.disclosed,x.ticker,x.asset]),[['3','2026-11-07',null,'US Treasury Note'],['1','2026-11-05','NVDA',null]]);
  assert.deepEqual(tickerRecent('net-worth-senate','ossoff',{filed:'2026-10-25T00:00:00Z',year:2025},{now}),[{kind:'filing',subject:'ossoff',filed:'2026-10-25',year:2025,seen:null}]);
  assert.deepEqual(tickerRecent('net-worth-senate','ossoff',{filed:'2026-05-15',year:2025},{now}),[],'an old filing');
  const merged=tickerMerge([trades,[{kind:'filing',subject:'ossoff',filed:'2026-11-08',year:2025}],[{kind:'trade',subject:'x',disclosed:'2026-10-01'}]],{now});
  assert.deepEqual(merged.map(x=>x.disclosed||x.filed),['2026-11-08','2026-11-07','2026-11-05'],'newest first; one past its days dropped');
  // When each was first read: nothing on a check's first list is news; on later lists, a new item is stamped with the time.
  assert.ok(trades.every(x=>x.seen===null),'a check\'s first list');
  const later=now+6*36e5,again=tickerRecent('trades-house','begich',{rows:[{id:'4',disclosed:'2026-11-06',type:'purchase',ticker:'MSFT'},{id:'1',disclosed:'2026-11-05',type:'purchase',ticker:'NVDA'}]},{now:later,previous:trades});
  assert.deepEqual(again.map(x=>[x.id,x.seen]),[['4',new Date(later).toISOString()],['1',null]],'the new one stamped; the one on the last list keeps its stamp');
  const third=tickerRecent('trades-house','begich',{rows:[{id:'4',disclosed:'2026-11-06',type:'purchase',ticker:'MSFT'}]},{now:later+36e5,previous:again});
  assert.equal(third[0].seen,new Date(later).toISOString(),'read again: still the first time');
});
