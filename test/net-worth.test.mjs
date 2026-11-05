// Net worth from the latest annual financial disclosure (public/net-worth.js and the 'net-worth-house' and
// 'net-worth-senate' refresh jobs in src/feeds.mjs): every value on the form is a range, so the result is one.
import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../data/config.json' with {type:'json'};
import {valueRange,netWorth,rangeText} from '../public/net-worth.js';
import {FEEDS,houseAnnualHoldings,efdAnnualHoldings,annualSummary,annualRows} from '../src/feeds.mjs';

test('values as written on the forms',()=>{
  assert.deepEqual(valueRange('$15,001 - $50,000'),[15001,50000]);
  assert.deepEqual(valueRange('$1,001 -\n $15,000'),[1001,15000],'a range that wraps');
  assert.deepEqual(valueRange('Over $50,000,000'),[50000001,null]);
  assert.deepEqual(valueRange('Spouse/DC Over $1,000,000'),[1000001,null]);
  assert.deepEqual(valueRange('None (or less than $1,001)'),[0,1000]);
  assert.equal(valueRange('Undetermined'),null);assert.equal(valueRange(''),null);
});

test('the range: assets at the bottom minus debts at the top, and the reverse; an open-ended value leaves that end open',()=>{
  const x=netWorth([{value:'$15,001 - $50,000'},{value:'$100,001 - $250,000'},{value:'Undetermined'}],[{amount:'$10,001 - $15,000'}]);
  assert.equal(x.low,115002-15000);assert.equal(x.high,300000-10001);assert.equal(x.nAssets,2);assert.equal(x.unread,1);
  const y=netWorth([{value:'Spouse/DC Over $1,000,000'}],[]);assert.equal(y.low,1000001);assert.equal(y.high,null);
  const z=netWorth([{value:'$1,001 - $15,000'}],[{amount:'Over $50,000,000'}]);assert.equal(z.low,null,'a debt with no top leaves the bottom open');
  const m=v=>'$'+Math.round(v/1000)+'K';
  assert.equal(rangeText({low:100000,high:250000},m),'$100K – $250K');assert.equal(rangeText({low:1000001,high:null},m),'$1000K or more');
  assert.equal(netWorth([],[]).low,0,'nothing listed: zero, shown with the count of assets read');
});

test('a House annual report: assets by their codes, the value right after the owner, and the liabilities',()=>{
  const text=`Schedule A: Assets and "Unearned" Income
Asset Owner Value of Asset Income Type(s) Income Current Year to Filing Income Preceding Year
Apple Inc. (AAPL) [ST] SP $15,001 - $50,000 Dividends $201 - $1,000 $201 - $1,000
Wells Fargo checking [BA] JT $50,001 - $100,000 Interest $1 - $200 $1 - $200
Rental house, Anytown [RP] $250,001 - $500,000 Rent $15,001 - $50,000 $15,001 - $50,000
Location: Anytown, ME, US
Big Fund [MF] Spouse/DC Over $1,000,000 Capital Gains None None
Schedule B: Transactions
Apple Inc. (AAPL) [ST] SP 01/05/2025 P $1,001 - $15,000
Schedule C: Earned Income
Schedule D: Liabilities
Owner Creditor Date Incurred Type Amount of Liability
JT Bank of Maine March 2015 Mortgage on rental property $100,001 - $250,000
Sallie Mae June 2010 Student loan $15,001 - $50,000
Schedule E: Positions`;
  const h=houseAnnualHoldings(text);
  assert.deepEqual(h.assets.map(a=>[a.code,a.owner,a.value]),[['ST','spouse','$15,001 - $50,000'],['BA','joint','$50,001 - $100,000'],['RP','self','$250,001 - $500,000'],['MF','self','Spouse/DC Over $1,000,000']],
    'the income ranges and the transactions in Schedule B are left out');
  assert.equal(h.assets[0].name,'Apple Inc. (AAPL)');
  assert.deepEqual(h.debts.map(d=>[d.owner,d.amount]),[['joint','$100,001 - $250,000'],['self','$15,001 - $50,000']]);
  const x=netWorth(h.assets,h.debts);assert.equal(x.low,15001+50001+250001+1000001-300000);assert.equal(x.high,null);
  assert.deepEqual(houseAnnualHoldings('Schedule A: Assets\nNone disclosed.\nSchedule D: Liabilities\nNone disclosed.\nSchedule E'),{assets:[],debts:[]});
  assert.deepEqual(houseAnnualHoldings(''),{assets:[],debts:[]},'a paper report has no text');
});

test('a Senate eFD annual report: the asset and liability tables, not the gifts or transactions',()=>{
  const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const html=table(['#','Asset','Asset Type','Owner','Value','Income Type','Income Amount'],[['1','<strong>Vanguard 500</strong>','Mutual Funds','Spouse','$100,001 - $250,000','Dividends','$2,501 - $5,000'],['2','Checking','Bank Deposit','Self','$15,001 - $50,000','Interest','$1 - $200']])
    +table(['#','Transaction Date','Owner','Ticker','Asset Name','Type','Amount'],[['1','01/02/2025','Self','AAPL','Apple','Purchase','$1,001 - $15,000']])
    +table(['#','Date','Recipient','Value','Source'],[['1','03/01/2025','Self','$500','A friend']])
    +table(['#','Date Incurred','Debtor','Type','Points','Term Rate','Amount','Creditor'],[['1','2019','Joint','Mortgage','','30 years','$250,001 - $500,000','Big Bank']]);
  const h=efdAnnualHoldings(html);
  assert.deepEqual(h.assets.map(a=>[a.name,a.owner,a.value]),[['Vanguard 500','spouse','$100,001 - $250,000'],['Checking','self','$15,001 - $50,000']]);
  assert.deepEqual(h.debts.map(d=>[d.creditor,d.owner,d.amount]),[['Big Bank','joint','$250,001 - $500,000']]);
});

test("the House job reads every year's report once (an amendment over the original), keeps them all, and lists a paper report as unreadable",async()=>{
  const p=config.people.find(x=>x.inOffice&&x.chamber==='H');assert.ok(p);
  assert.ok(FEEDS['net-worth-house'].jobs(config).some(j=>j.id===`net-worth-house:${p.id}`));
  assert.ok(FEEDS['net-worth-senate'].jobs(config).every(j=>config.people.find(x=>x.id===j.subject).chamber==='S'));
  const filings=[{id:'1',type:'O',year:2024,filed:'2024-05-15',url:'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2024/1.pdf'},
    {id:'2',type:'O',year:2025,filed:'2025-05-15',url:'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2025/2.pdf'},
    {id:'3',type:'A',year:2025,filed:'2025-06-01',url:'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2025/3.pdf'},
    {id:'4',type:'P',year:2025,filed:'2025-07-01',url:'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/4.pdf'}];
  // The House index (all) and the snapshot saved last time (first), as the refresh's database answers them.
  let saved=null;const urls=[];
  const env={DB:{prepare:()=>({bind:()=>({all:async()=>({results:[{payload:JSON.stringify({byPerson:{[p.id]:filings}})}]}),first:async()=>saved?{payload:JSON.stringify(saved)}:null})})},
    fetch:async u=>{urls.push(String(u));return new Response(new Uint8Array([1,2,3]));}};
  // One run: the first page lists what to read, then a page a report; the summary is built from all of them.
  const run=async()=>{let cursor=null,rows=[];do{const r=await FEEDS['net-worth-house'].page({kind:'net-worth-house',subject:p.id,args:'{}',cursor,started_at:new Date().toISOString()},{},env,config);rows.push(...r.rows);cursor=r.next;}while(cursor);
    return FEEDS['net-worth-house'].summarize(rows);};
  let snap=await run();
  assert.deepEqual(urls,[filings[2].url,filings[0].url],'the 2025 amendment, then 2024; never the trade report');
  assert.equal(snap.year,2025);assert.equal(snap.unreadable,true,'no text: filed on paper, checked by hand');assert.equal(snap.url,filings[2].url);
  assert.deepEqual(snap.history.map(h=>[h.year,h.id,h.unreadable]),[[2025,'3',true],[2024,'1',true]],'every year kept, newest first');
  // The next run reads nothing it has read; a new year's report is read, and the years before stay.
  saved=snap;urls.length=0;
  snap=await run();assert.deepEqual(urls,[],'nothing new: nothing read');assert.equal(snap.history.length,2);
  filings.push({id:'5',type:'O',year:2026,filed:'2026-05-15',url:'https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2026/5.pdf'});
  saved=snap;snap=await run();
  assert.deepEqual(urls,[filings[4].url],'only the new year');assert.deepEqual(snap.history.map(h=>h.year),[2026,2025,2024]);assert.equal(snap.year,2026);
});

test('annual reports over the years: the newest in full, one entry a year with its range and stocks',()=>{
  const r=(id,year,filed,assets,extra={})=>({id,year,filed,url:`u${id}`,type:'annual',...netWorth(assets,[]),unreadable:false,assets,debts:[],...extra});
  const apple={name:'Apple Inc.',type:'Stock',value:'$15,001 - $50,000'},fund={name:'Vanguard 500',type:'Mutual Funds',value:'$100,001 - $250,000'};
  const s=annualSummary([r('a',2023,'2023-05-10',[fund]),r('b',2024,'2024-05-10',[fund,apple]),r('c',2024,'2024-08-01',[fund,apple,apple])]);
  assert.equal(s.id,'c','an amendment (filed later) over the original');assert.equal(s.assets.length,3);
  assert.deepEqual(s.history.map(h=>[h.year,h.id,h.low,h.stocks?.count??0]),[[2024,'c',130003,2],[2023,'a',100001,0]]);
  assert.ok(!('assets' in s.history[0]),'history entries carry no asset list');
  // Carried into the next read: the full newest and the other years; the same report read again replaces its entry.
  const rows=annualRows(s);assert.deepEqual(rows.map(x=>[x.id,Array.isArray(x.assets)]),[['c',true],['a',false]]);
  const again=annualSummary([...rows,r('c',2024,'2024-08-01',[fund])]);assert.equal(again.assets.length,3,'the carried full report and the same report read again: one of them, with its assets');
  assert.deepEqual(annualSummary([]),{});assert.deepEqual(annualRows(null),[]);
});


test('the Ethics tab lists net worth by year when more than one year is on file',async()=>{
  const {netWorthYears}=await import('../public/live.js');
  const x={year:2025,history:[{year:2025,low:100000,high:500000,stocks:{low:1001,high:15000,count:1},url:'https://efdsearch.senate.gov/search/view/annual/a/'},{year:2024,low:-50000,high:250000,stocks:null},{year:2023,unreadable:true}]};
  const html=netWorthYears(x);
  assert.match(html,/Net worth by year \(3 annual reports\)/);
  assert.match(html,/<td>2025<\/td><td class="r">\$100K – \$500K<\/td><td class="r">\$1K – \$15K in 1<\/td>/);
  assert.match(html,/<td>2024<\/td><td class="r">−\$50K – \$250K<\/td><td class="r">none listed<\/td>/);
  assert.match(html,/<td>2023<\/td><td class="r">not readable \(filed on paper\)<\/td>/);
  assert.equal(netWorthYears({history:[{year:2025}]}),'','one year: nothing to compare');assert.equal(netWorthYears({}),'');
  assert.ok(!/<script/i.test(netWorthYears({history:[{year:'<script>',low:1,high:2},{year:2024,low:1,high:2,url:'javascript:alert(1)'}]})),'escaped, and only https links');
});
