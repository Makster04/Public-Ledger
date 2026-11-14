// The ticker under the top bar and the Latest updates page (public/ticker.js), and the refresh's newest trades and
// disclosures for them (tickerRecent, tickerMerge in src/refresh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import research from '../public/research.json' with {type:'json'};
import log from '../public/score-presentation-log.json' with {type:'json'};
import house from '../public/house.json' with {type:'json'};
import senate from '../public/senate.json' with {type:'json'};
import {TICKER,raceItems,siteItems,ratingItems,liveItems,newsItems,fecItems,allItems,mixKinds,tickerItems,tickerHTML,latestHTML,shortDate,mountTicker,isFresh,seatLabel,pagePeople} from '../public/ticker.js';
import {tickerRecent,tickerMerge,TICKER_KINDS} from '../src/refresh.mjs';

const people=new Map();for(const p of [...house.members,...senate.senators,...research.cands,...research.members])people.set(p.id,p);
const NOV9=Date.parse('2026-11-09T15:00:00Z'),NOV14=Date.parse('2026-11-14T15:00:00Z');
const text=x=>x.parts.map(p=>typeof p==='string'?p:p.grade?p.grade:`${p.name} (${p.party})`).join('');

test('the windows: the strip\'s 7 days, the page\'s 45; a timestamp exactly, a date alone counted from noon UTC that day',()=>{
  assert.deepEqual([TICKER.days,TICKER.fill,TICKER.pageDays,TICKER.lateDays],[7,6,45,45]);
  assert.equal(isFresh('2026-11-03T00:00:00Z',NOV9),true);assert.equal(isFresh('2026-11-02T14:00:00Z',NOV9),false,'7 days and an hour before');
  assert.equal(isFresh('2026-11-03',NOV9),true,'a date alone: from noon that day');assert.equal(isFresh('2026-11-02',NOV9),false,'noon 7 days and 3 hours before');
  assert.equal(isFresh('2026-11-08',NOV9,1),false,'a 1-day window: yesterday, past noon today');assert.equal(isFresh('2026-11-09',NOV9,1),true);
  assert.equal(isFresh('2026-11-12',NOV9),false,'a date to come');assert.equal(isFresh('',NOV9),false);
  assert.equal(isFresh('2026-09-27',NOV9,TICKER.pageDays),true);assert.equal(isFresh('2026-09-20',NOV9,TICKER.pageDays),false);
});

test('races: a race still counting stays on, pinned; a call within the window of its own date',()=>{
  const NOV13=Date.parse('2026-11-13T15:00:00Z'),items=raceItems(research,{now:NOV13,people,days:1});
  const ak=items.find(x=>x.key==='race:S-AK');
  assert.deepEqual([ak.tag,ak.date,text(ak),ak.href,ak.pinned],['Still counting','2026-11-11','Alaska Senate: Peltola (D) leads Sullivan (R) by 3,975 votes','#peltola',true]);
  assert.ok(items.length&&items.every(x=>x.tag==='Still counting'),'a day\'s window two days after the last call: only the races still counting');
  const all=raceItems(research,{now:NOV13,people});
  const ms=all.find(x=>x.key==='race:S-MS'),me=all.find(x=>x.key==='race:S-ME');
  assert.equal(text(ms),'Mississippi Senate: Colom (D) wins · called by the AP on Nov. 11; Cindy Hyde-Smith conceded','"Called" starts lower case');
  assert.ok(me&&/· Susan Collins conceded/.test(text(me)),'a name keeps its capital');
  const night=raceItems({...research,election:{...research.election,asof:'2026-11-04'}},{now:Date.parse('2026-11-04T20:00:00Z'),people});
  const ga=night.find(x=>x.key==='race:S-GA');
  assert.deepEqual([ga.tag,text(ga),ga.href],['Race called','Georgia Senate: Ossoff (D) wins · called by NBC News and CBS News','#ossoff']);
  assert.ok(night.some(x=>/^Arizona AZ-06: Mendoza \(D\) wins/.test(text(x))),'a House toss-up names its winner as the race lists them');
  assert.deepEqual(raceItems(research,{now:Date.parse('2027-01-15'),people}),[],'gone once the results are weeks old, even still counting');
});

test('site updates and ratings: within the window; rule changes and entries without a headline left out',()=>{
  const nov8=Date.parse('2026-11-08T20:00:00Z');
  assert.deepEqual(siteItems(log.entries,{now:nov8,days:1}).map(x=>[x.tag,text(x)]),[['Site update','Interest-group ratings are shown as letter grades']]);
  assert.deepEqual(siteItems([{date:'2026-11-08',headline:'A rule',note:'Rule change: something'}],{now:nov8}),[],'a rule change isn\'t shown');
  assert.ok(siteItems(log.entries,{now:NOV14}).length>=2,'the page keeps 45 days');
  const r={checked:'2026-11-09',groups:{a:{read:'2026-11-09'},b:{read:'2026-11-09'},c:{status:'blocked'}},people:{x:[],y:[],z:[]}};
  assert.deepEqual(ratingItems(r,{now:NOV9}).map(text),['Interest-group ratings read: 2 groups · 3 profiles rated']);
  assert.deepEqual(ratingItems({...r,checked:'2026-08-07'},{now:NOV9}),[]);
});

test('the refresh\'s trades (with how late they were filed) and annual reports (with net worth, against the year before)',()=>{
  const live={items:[{kind:'trade',subject:'ossoff',disclosed:'2026-11-06',traded:'2026-08-20',seen:'2026-11-09T09:00:00Z',type:'sale',amount:'$1,001 - $15,000',ticker:'AAPL',owner:'spouse'},
    {kind:'trade',subject:'ossoff',disclosed:'2026-11-05',traded:'2026-10-20',type:'purchase',ticker:'MSFT'},
    {kind:'filing',subject:'begich',filed:'2026-11-09',seen:null,year:2025,worth:[1100000,3600000],was:[900000,2400000],wasYear:2024},
    {kind:'filing',subject:'collins',filed:'2026-11-08',year:2025},{kind:'trade',subject:'nobody-here',disclosed:'2026-11-09',type:'sale'}]};
  const items=liveItems(live,{now:NOV9,people});
  assert.deepEqual(items.map(text),['Ossoff (D) reported a sale of $1,001–$15,000 in AAPL (spouse) · filed 33 days late','Ossoff (D) reported a purchase in MSFT',
    'Begich (R) filed their 2025 annual report: net worth $1.10M–$3.60M, up from $900K–$2.40M in 2024','Collins (R) filed their 2025 annual financial disclosure']);
  assert.deepEqual(items.map(x=>[x.tag,x.href]),[['Stock trade','#ossoff-unbought'],['Stock trade','#ossoff-unbought'],['Net worth','#begich-unbought'],['Disclosure','#collins-unbought']]);
});

test('the news build\'s items: grade changes, promise checks, the trackers\' PAC checks and super PAC filings',()=>{
  const news={items:[
    {key:'g1',kind:'grade',id:'marshall',grade:'word',from:67,to:85,fromLetter:'D',toLetter:'B',why:'10 more promises checked, 1 broken',date:'2026-11-14',seen:null},
    {key:'g2',kind:'grade',id:'ossoff',grade:'word',from:null,to:74,fromLetter:null,toLetter:'C',why:'23 promises decided',date:'2026-11-14',seen:null},
    {key:'g3',kind:'grade',id:'collins',grade:'showsup',from:88,to:null,fromLetter:'B',toLetter:null,why:'their record changed',date:'2026-11-14',seen:null},
    {key:'p1',kind:'promise',id:'booker',promise:'decriminalize-drugs@2021-04-21',status:'partly',quote:'I support decriminalization',date:'2026-11-13'},
    {key:'l1',kind:'lobby',tracker:'defense',pac:'THE BOEING COMPANY PAC',amount:5000,date:'2026-10-07',seen:'2026-11-12T10:00:00Z',ids:['clyburn','moolenaar','meng','hagerty','nobody','tonko']},
    {key:'l2',kind:'lobby',tracker:'pharma',pac:'PERATON CORP. PAC (A.K.A. \'PERATON PAC\')',amount:1000,date:'2026-10-12',ids:['clark']},
    {key:'s1',kind:'superpac',tracker:'crypto',spender:'DEFEND AMERICAN JOBS',cand:'S4NE00207',name:'OSBORN, DAN',party:'I',seat:'S-NE',so:'O',amount:2650335.68,date:'2026-10-27'},
    {key:'s2',kind:'superpac',tracker:'aipac',spender:'UNITED DEMOCRACY PROJECT (UDP)',cand:'H0XX00000',name:'SMITH, JANE',party:'R',seat:'H-TX-09',so:'S',amount:73834.08,date:'2026-10-29'},
    {key:'old',kind:'promise',id:'booker',promise:'x@2020-01-01',status:'kept',date:'2026-08-01'}]};
  const items=newsItems(news,{now:NOV14,people});
  assert.deepEqual(items.map(text),[
    'Marshall (R) Keeps Their Word D → B (67% → 85%): 10 more promises checked, 1 broken','Ossoff (D) Keeps Their Word: C (74%), 23 promises decided',
    'Collins (R) Shows Up: no longer graded (their record changed)','Booker (D) “I support decriminalization” (Apr 2021): Partially kept',
    'Big Defense 🪖 · The Boeing Company PAC gave $5,000 each to Clyburn (D), Moolenaar (R), Meng (D), Hagerty (R) and 1 more',
    'Big Pharma + Insurance 💊 · Peraton Corp. PAC gave $1,000 to Clark (D)',
    'Crypto 🤑 · Defend American Jobs spent $2.65M against Osborn (I), Nebraska Senate',
    'AIPAC 🇮🇱 · United Democracy Project spent $73,834 for Smith (R), TX-9']);
  assert.deepEqual(items.map(x=>x.tag),['Grade change','Newly graded','Grade change','Promise check','Lobby money','Lobby money','Super PAC','Super PAC']);
  assert.deepEqual(items.map(x=>x.href),['#marshall-word','#ossoff-word','#collins-showsup','#booker-word','#trackers-defense','#clark-unbought','#osborn-unbought','#superpacs']);
  assert.equal(items[4].at,'2026-11-12T10:00:00Z','placed by when it was first read');
  assert.ok(!items.some(x=>x.key==='old'),'past the page\'s 45 days');
  assert.deepEqual([seatLabel('S-MI'),seatLabel('H-NY-12'),seatLabel('H-WY-00')],['Michigan Senate','NY-12','WY-AL']);
});

test('FEC reports: one item a report date, with how many campaigns and who raised most',()=>{
  const r={members:[{id:'collins',short:'Collins',party:'R',camp:{end:'2026-10-14',receipts:22465217}},{id:'ossoff',short:'Ossoff',party:'D',camp:{end:'2026-10-14',receipts:30100000}},{id:'x',camp:{end:'2026-07-15',receipts:9}}],cands:[{id:'y',camp:{missing:true,end:'2026-10-14'}}]};
  const items=fecItems(r,{now:NOV14,people});
  assert.deepEqual(items.map(text),['Reports through Oct 14 read for 2 campaigns · most raised: Ossoff (D) $30.1M this cycle']);
  assert.deepEqual([items[0].tag,items[0].href,items[0].date],['FEC reports','#rankings','2026-10-14']);
});

test('the strip: races still counting first, then the last 7 days, each kind in turn, filled to 6 from older news',()=>{
  const n=(key,kind,date,extra={})=>({key,kind,tag:kind,date,order:2,parts:[key],...extra});
  assert.deepEqual(mixKinds([n('g1','grade','2026-11-13'),n('g2','grade','2026-11-12'),n('g3','grade','2026-11-11'),n('p1','promise','2026-11-10'),n('t1','trade','2026-11-09'),n('p2','promise','2026-11-08')]).map(x=>x.key),
    ['g1','p1','t1','g2','p2','g3'],'one of each kind in turn, the newest kind first');
  const items=tickerItems({research,log:log.entries,ratings:null,people,news:{items:[{key:'g',kind:'grade',id:'marshall',grade:'word',from:67,to:85,fromLetter:'D',toLetter:'B',why:'x',date:'2026-11-14'}]}},{now:NOV14});
  assert.equal(items[0].tag,'Still counting');assert.ok(items.length<=TICKER.limit);
  assert.ok(items.some(x=>x.kind==='grade'),'this week\'s grade change');
  // A quiet week: filled to 6 with the newest older news.
  const quiet=tickerItems({research:{races:[]},log:[],ratings:null,people,news:{items:[1,2,3,4,5,6,7,8].map(i=>({key:`p${i}`,kind:'promise',id:'booker',promise:'a@2021-04-21',status:'kept',quote:`q${i}`,date:`2026-10-${10+i}`}))}},{now:NOV14});
  assert.deepEqual(quiet.map(x=>x.key),['p8','p7','p6','p5','p4','p3']);
  assert.deepEqual(tickerItems({research:{races:[]},log:[],ratings:null,people},{now:Date.parse('2027-03-01')}),[],'nothing in 45 days: no ticker');
  assert.equal(shortDate('2026-11-04'),'Nov 4');assert.equal(shortDate('2026-11-09T09:00:00Z'),'Nov 9');
});

test('the strip\'s markup: escaped text, grades as letters, the loop\'s second copy hidden, the link to the Latest updates page',()=>{
  const items=[{key:'a',kind:'site',tag:'Site update',date:'2026-11-08',order:3,href:'#method',parts:['<script>x</script> & more']},
    {key:'b',kind:'grade',tag:'Grade change',date:'2026-11-14',order:2,href:'#ossoff-word',parts:[{name:'Ossoff',party:'D'},' ',{grade:'B'}]}];
  const html=tickerHTML(items);
  assert.ok(!html.includes('<script>')&&html.includes('&lt;script&gt;x&lt;/script&gt; &amp; more'));
  assert.match(html,/<b class="tk-d">Ossoff \(D\)<\/b> <b class="gr-B">B<\/b>/);
  assert.match(html,/<span class="tk-tag tk-grade"><span aria-hidden="true">🎓<\/span>Grade change<\/span>/);
  assert.match(html,/Latest · 7 days/);assert.match(html,/class="tk-all" href="#latest"/);
  assert.match(html,/<div class="tk-set" aria-hidden="true">.*tabindex="-1"/s);
  assert.equal((html.match(/class="tk-item"/g)||[]).length,4,'two copies of each');
  assert.equal(tickerHTML([]),'');
});

test('the Latest updates page: a filter for each kind with its count, still counting first, then each day',()=>{
  const items=allItems({research,log:log.entries,ratings:null,people,news:{items:[{key:'g',kind:'grade',id:'marshall',grade:'word',from:67,to:85,fromLetter:'D',toLetter:'B',why:'x',date:'2026-11-14'},
    {key:'p',kind:'promise',id:'booker',promise:'a@2021-04-21',status:'kept',quote:'q',date:'2026-11-13'}]}},{now:NOV14});
  const html=latestHTML(items,{now:NOV14});
  assert.match(html,/data-group="" aria-pressed="true">All<small>\d+<\/small>/);
  assert.match(html,/data-group="grade" aria-pressed="false"><span aria-hidden="true">🎓<\/span> Grades<small>1<\/small>/);
  assert.ok(html.indexOf('Still counting</h2>')<html.indexOf('Today, Nov 14')&&html.indexOf('Today, Nov 14')<html.indexOf('Yesterday, Nov 13'));
  const grades=latestHTML(items,{group:'grade',now:NOV14});
  assert.equal((grades.match(/class="lu-row"/g)||[]).length,1);assert.match(grades,/href="#marshall-word"/);
  assert.match(latestHTML([],{now:NOV14}),/Nothing new in the last 45 days/);
  const w={HOUSE:[{id:'a'}],SENATE:[{id:'b'}],DATA:{cands:[{id:'c'}],members:[{id:'b',short:'B'}]}};
  assert.deepEqual([...pagePeople(w).keys()],['a','b','c']);
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

test('the refresh keeps each check\'s newest trades (with the date traded) and disclosures (with net worth), stamped with when first read',()=>{
  const now=NOV9;
  assert.deepEqual(TICKER_KINDS,['trades-house','trades-senate','net-worth-house','net-worth-senate']);
  const trades=tickerRecent('trades-house','begich',{rows:[{id:'1',disclosed:'2026-11-05',traded:'2026-10-20',type:'purchase',ticker:'NVDA',amount:'$1,001 - $15,000',asset:'NVIDIA'},
    {id:'2',disclosed:'2026-09-01',type:'sale',ticker:'AAPL'},{id:'3',disclosed:'2026-11-07',type:'sale',ticker:null,asset:'US Treasury Note'}]},{now});
  assert.deepEqual(trades.map(x=>[x.id,x.disclosed,x.traded,x.ticker,x.asset]),[['3','2026-11-07',null,null,'US Treasury Note'],['1','2026-11-05','2026-10-20','NVDA',null]]);
  assert.deepEqual(tickerRecent('net-worth-senate','ossoff',{filed:'2026-10-25T00:00:00Z',year:2025},{now}),[{kind:'filing',subject:'ossoff',filed:'2026-10-25',year:2025,seen:null}]);
  assert.deepEqual(tickerRecent('net-worth-house','begich',{filed:'2026-10-25',year:2025,low:1100000,high:3600000,history:[{year:2025,low:1100000,high:3600000},{year:2024,low:900000,high:2400000}]},{now}),
    [{kind:'filing',subject:'begich',filed:'2026-10-25',year:2025,worth:[1100000,3600000],was:[900000,2400000],wasYear:2024,seen:null}],'the range, and the year before\'s');
  assert.deepEqual(tickerRecent('net-worth-senate','ossoff',{filed:'2026-05-15',year:2025},{now}),[],'an old filing');
  const merged=tickerMerge([trades,[{kind:'filing',subject:'ossoff',filed:'2026-11-08',year:2025}],[{kind:'trade',subject:'x',disclosed:'2026-10-01'}]],{now});
  assert.deepEqual(merged.map(x=>x.disclosed||x.filed),['2026-11-08','2026-11-07','2026-11-05'],'newest first; one past its days dropped');
  assert.ok(trades.every(x=>x.seen===null),'a check\'s first list');
  const later=now+6*36e5,again=tickerRecent('trades-house','begich',{rows:[{id:'4',disclosed:'2026-11-06',type:'purchase',ticker:'MSFT'},{id:'1',disclosed:'2026-11-05',type:'purchase',ticker:'NVDA'}]},{now:later,previous:trades});
  assert.deepEqual(again.map(x=>[x.id,x.seen]),[['4',new Date(later).toISOString()],['1',null]],'the new one stamped; the one on the last list keeps its stamp');
  const third=tickerRecent('trades-house','begich',{rows:[{id:'4',disclosed:'2026-11-06',type:'purchase',ticker:'MSFT'}]},{now:later+36e5,previous:again});
  assert.equal(third[0].seen,new Date(later).toISOString(),'read again: still the first time');
});
