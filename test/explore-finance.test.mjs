import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankingRows,stockHoldingRange,collectStockData,filterStockRows} from '../public/explore-finance.js';

const people=[
  {id:'a',name:'Member A',party:'D',state:'NJ',stateName:'New Jersey',chamber:'S',camp:{receipts:1000,pac:100,start:'2025-01-01',end:'2026-06-30'},pac:{rows:[[0,50],[1,20],[2,30]],window:'2025–26'}},
  {id:'b',name:'Member B',party:'R',state:'ME',stateName:'Maine',chamber:'H',camp:{receipts:2000,pac:0}},
  {id:'c',name:'Unknown',party:'I',state:'VT',chamber:'S',camp:{missing:true}},
];
const data={pacIds:['corporation','trade','unknown'],pacCommittees:{corporation:['Company PAC','Q','','C'],trade:['Trade PAC','Q','','T']}};

test('rankings use available receipts, real filters and strictly corporate FEC categories',()=>{
  assert.deepEqual(buildRankingRows(people,data,{},'raised').map(r=>r.person.id),['b','a']);
  assert.deepEqual(buildRankingRows(people,data,{},'raised',{state:'NJ',party:'D',chamber:'S'}).map(r=>r.person.id),['a']);
  const corporate=buildRankingRows(people,data,{},'corporate');
  assert.equal(corporate.find(r=>r.person.id==='a').value,50,'trade association and unmatched PACs are not mislabeled corporate');
  assert.equal(corporate.find(r=>r.person.id==='b').value,0,'a reported zero is preserved');
  assert.ok(!corporate.some(r=>r.person.id==='c'),'missing is not zero');
});

test('wealth and stock holdings keep disclosed ranges and sort lower bounds',()=>{
  const snapshots={people:{a:{netWorth:{low:100,high:1000000,year:2025,assets:[{name:'Stock A',code:'ST',value:'$1,001 - $15,000'},{name:'Fund',code:'MF',value:'$100,001 - $250,000'}]}},b:{netWorth:{low:200,high:null,year:2024,assets:[{name:'Other',code:'MF',value:'$1,001 - $15,000'}]}}}};
  const rows=buildRankingRows(people,data,snapshots,'networth');
  assert.deepEqual(rows.map(r=>r.person.id),['b','a']);assert.match(rows[0].display,/or more/);assert.equal(rows[1].value,100);
  assert.deepEqual(stockHoldingRange(snapshots.people.a.netWorth),{low:1001,high:15000,count:1});
  assert.deepEqual(stockHoldingRange(snapshots.people.b.netWorth),{low:0,high:0,count:0},'a read report with only funds has no individual stock positions');
  assert.equal(stockHoldingRange({assets:[]}),null);assert.equal(stockHoldingRange({assets:[{code:'ST',value:'Undetermined'}]}),null);
});

test('stock views retain actual transaction ranges, dates and distinct official records',()=>{
  const trades=[{id:'one',ticker:'ABC',asset:'Example Inc.',traded:'2026-01-01',filed:'2026-01-20',type:'purchase',low:1001,high:15000,amount:'$1,001–$15,000',official:{url:'https://example.gov/report'},owner:'self'},
    {id:'two',ticker:'ABC',asset:'Example Inc.',traded:'2026-01-01',filed:'2026-01-20',type:'purchase',low:1001,high:15000,amount:'$1,001–$15,000',owner:'self'}];
  const snapshot={people:{a:{trades,netWorth:{year:2025,url:'https://example.gov/annual',assets:[{name:'Example Inc.',ticker:'ABC',code:'ST',value:'$15,001 - $50,000',owner:'spouse'},{name:'Index ETF',code:'MF',value:'$50,001 - $100,000'}]}}}};
  const result=collectStockData(people,snapshot);
  assert.equal(result.trades.length,2,'same-date distinct official IDs are not collapsed');
  assert.equal(result.trades[0].filed,'2026-01-20');assert.equal(result.trades[0].source,'https://example.gov/report');
  assert.equal(result.trades[0].amountText,'$1,001–$15,000');assert.equal(result.trades[0].type,'Buy');
  assert.equal(result.holdings.length,1);assert.equal(result.holdings[0].owner,'spouse');assert.equal(result.holdings[0].year,2025);
  assert.equal(filterStockRows(result.trades,{query:'example',party:'D'}).length,2);assert.equal(filterStockRows(result.trades,{query:'ABC',chamber:'H'}).length,0);
  assert.deepEqual(collectStockData(people,{}),{trades:[],holdings:[]});
});

test('presidential trades are not included in congressional comparisons and unsafe links are discarded',()=>{
  const p={id:'president',name:'President',party:'R',chamber:'P',office:'president',trades:[{ticker:'ABC'}]};
  assert.equal(buildRankingRows([p],data,{},'raised').length,0);assert.equal(collectStockData([p]).trades.length,0);
  const result=collectStockData([{...people[0],trades:[{ticker:'ABC',company:'Example',traded:'2026-01-01',url:'javascript:alert(1)'}]}]);
  assert.equal(result.trades[0].source,'');
});
