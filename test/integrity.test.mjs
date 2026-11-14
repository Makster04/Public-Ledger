import test from 'node:test';
import assert from 'node:assert/strict';
import {integrityOverall,hill,honestyComponent,legalReviewComponent,personalFinancesComponent,fundraisingComponent,previewCci,workersPreview,fundraisingPledgePoints,coversPeriod} from '../public/integrity.js';
import {makeScorer} from '../public/scoring.js';
import {letter} from '../public/grades.js';
import {donorSizes} from '../public/donor-sizes.js';
import {previewChanges} from '../scripts/integrity-preview-monthly.mjs';
import data from '../public/research.json' with {type:'json'};

test('overall Integrity normalizes available weights, requires two components and sourced legal review, and rounds only after the legal deduction',()=>{
  // Honesty 20%, Personal Finances 20%, Fundraising 25%, Showing Up 15%, Conflicts of Interest 20% (the worked example
  // from the retired Integrity grade).
  const r=integrityOverall({honesty:80,personalFinances:74,fundraising:70,showingUp:92.5,conflicts:55,legalTrouble:5});
  assert.equal(Number(r.weighted.toFixed(4)),73.175);assert.equal(Number(r.raw.toFixed(4)),68.175);assert.equal(r.pct,68);assert.equal(letter(r.pct),'D');
  const four=integrityOverall({honesty:80,personalFinances:74,fundraising:70,showingUp:92.5,legalTrouble:5});
  assert.equal(Number(four.weighted.toFixed(4)),Number(((16+14.8+17.5+13.875)/0.8).toFixed(4)),'Conflicts missing: the other four rescaled');assert.deepEqual(four.missing,['conflicts']);
  const two=integrityOverall({honesty:80,personalFinances:90,legalTrouble:10});
  assert.equal(two.weighted,85);assert.equal(two.raw,75);assert.deepEqual(two.used,['honesty','personalFinances']);
  assert.equal(integrityOverall({honesty:99,legalTrouble:0}).pct,null);
  assert.equal(integrityOverall({honesty:99,fundraising:100}).pct,null,'unknown legal review is not zero');
  assert.equal(integrityOverall({honesty:0,personalFinances:0,legalTrouble:100}).pct,0);
  assert.equal(integrityOverall({honesty:99,personalFinances:101,fundraising:100,legalTrouble:0}).used.length,2);
});

test('Honesty reuses Promise calculation, its minimum, pending exclusion, and tracker handling',()=>{
  const a=honestyComponent({statements:[{assessment:'consistent'},{assessment:'partial'},{assessment:'contradiction'},{assessment:'pending'},{assessment:'unclear'}]});
  assert.equal(a.value,(1+0.5)/3*100,'kept 1, partially kept 1/2, broken 0');assert.equal(a.complete,true);assert.equal(a.score.clear,3);
  const fractional=honestyComponent({statements:[{assessment:'consistent'},{assessment:'consistent'},{assessment:'contradiction'}]});
  assert.ok(Math.abs(fractional.value-200/3)<1e-10,'component keeps fractional precision for the weighted overall grade');
  assert.equal(honestyComponent({statements:[{assessment:'consistent'},{assessment:'partial'}]}).value,null);
  const p=honestyComponent({statements:[],promiseTrackers:[{counts:{kept:2,compromise:2,broken:0,stalled:8}}]});
  assert.equal(p.value,75);assert.equal(p.score.clear,4);
});

test('Legal Trouble requires explicit sourced review and excludes covered STOCK Act cases only when requested',()=>{
  const person={ethicsSearched:'Reviewed legal and official sources.',legalReview:{checkedAt:'2026-10-01',sources:[{u:'https://example.org/review'}]},ethics:[{status:'finding',kind:'ethics',type:'STOCK Act',sources:[{u:'https://example.org/case'}]}]};
  assert.equal(legalReviewComponent(person).value,20);
  assert.equal(legalReviewComponent({...person,ethics:[{...person.ethics[0],tradeId:'T1'}]},{stockActCovered:new Set(['T1'])}).value,0);
  assert.equal(legalReviewComponent({...person,ethics:[{...person.ethics[0],tradeId:'T2'}]},{stockActCovered:new Set(['T1'])}).value,20,'only a linked disclosure already included in Dodger is excluded');
  assert.equal(legalReviewComponent({...person,legalReview:null}).value,null,'a search note without a cited review does not establish a clean result');
  assert.equal(legalReviewComponent({...person,ethicsSearched:''}).value,null);
  assert.equal(legalReviewComponent({...person,ethics:[{status:'finding'}]}).value,null);
});

const report={year:2025,reviewed:true,url:'https://example.gov/annual',assets:[{name:'ACME',type:'Stock',value:'$100,000 - $200,000'}]};
const trade=(id,overrides={})=>({id,reviewed:true,traded:'2025-01-01',filed:'2025-02-01',type:'purchase',asset:'stock',amount:'$10,001 - $15,000',source:'https://example.gov/trade',...overrides});
const tradeCoverage={reviewed:true,complete:true,period:{start:'2021-01-01',end:'2025-12-31'},source:'https://example.gov/reports'};
test('Personal Finances scores total stock midpoints and actual trades, validates dates, and keeps disclosure periods separate',()=>{
  const person={bioguide:'X',tradeCoverage,trades:[trade('t1'),trade('t2',{traded:'2025-01-01',amount:'$10,001 - $15,000'})]};
  const result=personalFinancesComponent(person,{snapshot:report,trades:person.trades,tradeCoverage:person.tradeCoverage,insiderIndex:10,dodgerIndex:20});
  assert.equal(result.complete,true);assert.equal(result.stockValue,150000);assert.equal(result.tradeCount,2);assert.equal(result.tradeValue,25001);
  assert.equal(result.holdingsYear,2025);assert.equal(result.tradePeriod,person.tradeCoverage.period);
  const late=personalFinancesComponent(person,{snapshot:report,trades:[trade('late',{filed:'2025-02-16'})],tradeCoverage,insiderIndex:0,dodgerIndex:20});
  assert.equal(late.late,1,'a disclosure filed more than 45 days after the trade is reported as late');
  assert.equal(personalFinancesComponent(person,{snapshot:report,trades:[trade('bad',{filed:null})],tradeCoverage:person.tradeCoverage,insiderIndex:0,dodgerIndex:0}).value,null,'missing filing date never means timely');
  assert.equal(personalFinancesComponent(person,{snapshot:report,trades:[trade('bad',{filed:'2024-12-31'})],tradeCoverage,insiderIndex:0,dodgerIndex:0}).value,null,'a filing date before the trade is invalid');
  assert.equal(personalFinancesComponent({...person,office:true},{snapshot:report}).value,null,'president has no congressional F component');
  assert.equal(personalFinancesComponent(person,{snapshot:{...report,assets:[{name:'Open',type:'Stock',value:'Over $1,000'}]},trades:person.trades,tradeCoverage:person.tradeCoverage,insiderIndex:0,dodgerIndex:0}).value,null);
  const resolved=personalFinancesComponent(person,{snapshot:{...report,assets:[{name:'Open',type:'Stock',value:'Over $1,000',openEnded:true,reviewedValue:5000,reviewedValueSource:'https://example.gov/valuation'}]},trades:person.trades,tradeCoverage:person.tradeCoverage,insiderIndex:0,dodgerIndex:0});
  assert.equal(resolved.complete,true);assert.equal(resolved.stockValue,5000);
  assert.equal(personalFinancesComponent(person,{snapshot:{...report,reviewed:false},trades:person.trades,tradeCoverage:person.tradeCoverage,insiderIndex:0,dodgerIndex:0}).value,null);
});

test('Personal Finances deduplicates only authoritative duplicate IDs and excludes only verified post-effective trust assets/trades',()=>{
  const trust={verified:true,id:'qbt-1',effectiveDate:'2022-01-01',source:'https://example.gov/trust'};
  const snapshot={...report,assets:[{name:'Outside',type:'Stock',value:'$10,001 - $15,000'},{name:'Inside trust',type:'Stock',value:'$50,001 - $100,000',trustId:'qbt-1'}]};
  const person={bioguide:'X',tradeCoverage,trades:[trade('same'),trade('same'),trade('distinct',{traded:'2025-01-01',amount:'$10,001 - $15,000'}),
    trade('inside',{traded:'2023-01-01',trustId:'qbt-1'}),trade('flagged',{traded:'2024-01-01',inTrust:true}),trade('before',{traded:'2021-01-01',trustId:'qbt-1'})]};
  const r=personalFinancesComponent(person,{snapshot,trades:person.trades,tradeCoverage:person.tradeCoverage,trust,insiderIndex:0,dodgerIndex:0});
  assert.equal(r.stockValue,12500.5);assert.equal(r.tradeCount,3);assert.equal(r.trustExcluded,2);
  const unverified=personalFinancesComponent(person,{snapshot,trades:person.trades,tradeCoverage:person.tradeCoverage,trust:{...trust,verified:false},insiderIndex:0,dodgerIndex:0});
  assert.equal(unverified.stockValue,87501);assert.equal(unverified.tradeCount,5);
});

test('Fundraising applies donor buckets, PAC rates and caps, same-period reconciliation, earmarks, and pledge points',()=>{
  const receipts=1_000_000,person={camp:{receipts,indiv:300_000,pac:100_000,self:0,transfers:0,start:'2025-01-01',end:'2025-06-30'}};
  const sizes={start:person.camp.start,end:person.camp.end,notSorted:0,brackets:[0,200,500,1000,2000].map((size,i)=>({size,total:[200_000,100_000,0,0,0][i]}))};
  const result=fundraisingComponent(person,{sizes,pacRows:[{amount:100_000,kind:'corporate'}],pacReceipts:100_000,pacCoverage:true,pacPeriodMatches:true,
    earmarks:{complete:true,rows:[{group:'Civic Group',amount:10_000,src:'https://example.org/earmark'},{group:'ActBlue',amount:50_000,src:'https://example.org/ab'}]},pledgePoints:2,pledgesReviewed:true});
  assert.equal(result.complete,true);assert.ok(Math.abs(result.D-3.8)<1e-10);assert.equal(result.P,20);assert.equal(result.E,4);assert.equal(result.pledgePoints,2);
  assert.equal(result.R,10*hill(.1,.20));assert.equal(result.value,75+3.8-20-result.R-4+2);
  const kinds=['corporate','lobbyist','trade','membership','cooperative','political','leadership','party','candidate','unconnected','labor','other'];
  const ratePerson={camp:{...person.camp,pac:kinds.length*10_000}};
  const rateRows=kinds.map(kind=>({kind,amount:10_000}));
  const rates=fundraisingComponent(ratePerson,{sizes,pacRows:rateRows,pacReceipts:ratePerson.camp.pac,pacCoverage:true,pacPeriodMatches:true,
    earmarks:{complete:true,rows:[]},pledgesReviewed:true});
  assert.ok(Math.abs(rates.P-4.2)<1e-10,'all published per-point PAC category rates are applied');
  const capped=fundraisingComponent({camp:{receipts:100_000,indiv:100_000,pac:100_000,self:0,transfers:0,start:'2025-01-01',end:'2025-06-30'}},
    {sizes:{...sizes,brackets:[0,200,500,1000,2000].map((size,i)=>({size,total:i===0?100_000:0}))},pacRows:[{kind:'corporate',amount:100_000}],pacReceipts:100_000,pacCoverage:true,pacPeriodMatches:true,
      earmarks:{complete:true,rows:[{amount:1_000_000,group:'Large donors',src:'https://example.org/earmark'}]},pledgesReviewed:true});
  assert.equal(capped.D,14);assert.equal(capped.P,30);assert.equal(capped.E,30);
  assert.equal(fundraisingComponent(person,{sizes,pacRows:[{amount:99_000,kind:'corporate'}],pacReceipts:99_000,pacCoverage:false,pacPeriodMatches:true,earmarks:{complete:true,rows:[]},pledgesReviewed:true}).complete,false);
  assert.equal(fundraisingComponent(person,{sizes:null,earmarks:{complete:true,rows:[]},pledgesReviewed:true}).value,null,'a failed donor-size fetch is not unsorted gifts');
  assert.equal(fundraisingComponent(person,{sizes:{...sizes,end:'2025-03-31'},earmarks:{complete:true,rows:[]},pledgesReviewed:true}).value,null,'mismatched periods do not combine');
  assert.equal(fundraisingComponent({...person,camp:{...person.camp,self:null}},{sizes,pacRows:[],pacReceipts:0,pacCoverage:true,pacPeriodMatches:true,earmarks:{complete:true,rows:[]},pledgesReviewed:true}).value,null,'missing self-funding is not assumed zero');
  assert.equal(fundraisingComponent(person,{sizes, pacRows:[],pacReceipts:0,pacCoverage:true,pacPeriodMatches:true,earmarks:{complete:false,rows:[]},pledgesReviewed:true}).value,null,'partial earmark data is not zero');
  assert.equal(fundraisingComponent(person,{sizes,pacRows:[],pacReceipts:0,pacCoverage:true,pacPeriodMatches:true,earmarks:{complete:true,rows:[]},pledgesReviewed:false}).value,null,'unreviewed pledges are not a neutral inferred score');
  const fec=donorSizes([{size:0,total:100,count:1},{size:200,total:200,count:1}],{individual_itemized_contributions:200,individual_unitemized_contributions:100,coverage_start_date:person.camp.start,coverage_end_date:person.camp.end});
  assert.equal(fec.brackets[0].total,100);assert.equal(fec.unitemizedIncluded,true);
});

test('PAC period coverage requires continuous filings across the receipt window',()=>{
  assert.equal(coversPeriod([{start:'2025-01-01',end:'2025-03-31'},{start:'2025-04-01',end:'2025-06-30'}],'2025-01-01','2025-06-30'),true);
  assert.equal(coversPeriod([{start:'2025-01-01',end:'2025-03-30'},{start:'2025-04-01',end:'2025-06-30'}],'2025-01-01','2025-06-30'),false);
  assert.equal(coversPeriod([{start:'2025-01-01',end:'2025-03-31'}],'2025-01-01','2025-06-30'),false);
});

test('Pledge scoring is one point per reviewed category and never falls back while a pledge is pending',()=>{
  const p={id:'person',statements:[{pledge:{kind:'corporate-pac'},assessment:'consistent'},{pledge:{kind:'stock-trading'},assessment:'unclear'}]};
  const r=fundraisingPledgePoints({billIndex:[]},p);
  assert.equal(r.rows.find(x=>x.category==='corporate-pac').score,1);
  assert.equal(r.rows.find(x=>x.category==='stock-trading').score,0);
  assert.equal(r.rows.find(x=>x.category==='stock-trading').awaiting,true);
  assert.equal(r.points,1);
  const fallback=fundraisingPledgePoints({billIndex:[{id:'119-hr-123',reform:['stock-trading'],cosponsors:[{person:'x'}]}]},{id:'x',statements:[]});
  assert.equal(fallback.points,1);assert.equal(fallback.rows.find(x=>x.category==='stock-trading').source,'https://www.congress.gov/bill/119th-congress/house-bill/123');
  // A bill they introduced counts the same, from their own list of sponsored bills.
  assert.equal(fundraisingPledgePoints({billIndex:[{id:'119-hr-123',reform:['stock-trading']}]},{id:'x',statements:[],bills:[{congress:119,num:'H.R. 123'}]}).points,1);
});

test('Preview CCI drops direct PAC share, renormalizes implemented parts, and does not alter published grade calculation',()=>{
  const c=previewCci({employees:null,businessVotes:80,lobbiedBills:null});assert.equal(c.index,80);assert.deepEqual(c.used,['businessVotes']);
  assert.equal(previewCci({}).index,null);
  assert.deepEqual(workersPreview(60,c),{pct:50,raw:50,blended:true});
  assert.deepEqual(workersPreview(60,{index:null}),{pct:60,raw:60,blended:false});
  const scorer=makeScorer(data,{committees:{},people:{}},{},null),s=data.members[0];
  const published=()=>({promises:scorer.promises(s),ethics:scorer.ethics(s),pvp:scorer.pvp(s)}),before=published();
  previewCci({businessVotes:0});honestyComponent(s);integrityOverall({honesty:99,personalFinances:90,legalTrouble:10});
  assert.deepEqual(published(),before,'preview calculations cannot change any published grade');
});

test('monthly preview comparisons track components in their own log without treating unavailable values as changes',()=>{
  const before={x:{integrity:{pct:null,honesty:75,personalFinances:null,fundraising:null,legalTrouble:10},workers:{pct:60}}};
  const after={x:{integrity:{pct:null,honesty:80,personalFinances:null,fundraising:null,legalTrouble:10},workers:{pct:60}}};
  assert.deepEqual(previewChanges(before,after),[{id:'x',grade:'Honesty',from:75,to:80,why:'Preview calculation changed'}]);
  assert.deepEqual(previewChanges({},after).map(x=>x.grade),['Honesty','Legal Trouble','People First comparison']);
});

