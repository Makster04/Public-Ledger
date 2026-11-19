// The home cards' Net worth, Stocks owned and Stock trades (src/finance.mjs cardWealth): from the newest annual
// disclosure the refresh read and the trade reports, as the profile reads them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cardWealth} from '../src/finance.mjs';

const annual=(o={})=>({year:2025,filed:'2026-05-15',low:1100000,high:3600000,url:'https://efdsearch.senate.gov/x',
  assets:[{name:'Apple Inc. (AAPL)',type:'Stock',value:'$15,001 - $50,000'},{name:'Microsoft Corp',type:'Stock',value:'$1,001 - $15,000'},{name:'Vanguard 500 Index Fund',type:'Mutual Fund',value:'$100,001 - $250,000'}],
  history:[{year:2025,low:1100000,high:3600000},{year:2024,low:900000,high:2400000}],...o});
const trade=(id,traded,disclosed,o={})=>({id:`${id}#1`,source:'House Clerk',traded,disclosed,ticker:'AAPL',type:'purchase',low:1001,high:15000,official:{filed:disclosed},...o});

test('net worth: the newest report\'s range and the year before\'s',()=>{
  const w=cardWealth({'net-worth-senate':annual()},{cycle:2026});
  assert.deepEqual(w.netWorth,{year:2025,low:1100000,high:3600000,url:'https://efdsearch.senate.gov/x',was:{year:2024,low:900000,high:2400000}});
  assert.equal(cardWealth({},{cycle:2026}).netWorth,null,'nothing read');
});
test('stocks owned: individual stocks only, at the middle of each range; a blind trust says so',()=>{
  const w=cardWealth({'net-worth-senate':annual()},{cycle:2026});
  assert.deepEqual([w.stocks.value,w.stocks.count,w.stocks.year],[32500.5+8000.5,2,2025],'the fund is left out');
  const bt=cardWealth({'net-worth-senate':annual({assets:[{name:'Qualified Blind Trust',type:'Trust',value:'$1,000,001 - $5,000,000'}]})},{cycle:2026});
  assert.equal(bt.stocks.blindTrust,true);
  const open=cardWealth({'net-worth-senate':annual({assets:[{name:'Apple Inc.',type:'Stock',value:'Over $50,000,000'}]})},{cycle:2026});
  assert.equal(open.stocks.value,null);assert.match(open.stocks.why,/open-ended/);
});
test('stock trades: this cycle\'s, with those reported more than 45 days after the trade',()=>{
  const rows=[trade('a','2025-03-01','2025-03-20'),trade('b','2025-06-01','2025-09-01'),trade('c','2024-11-01','2024-11-10')];
  const w=cardWealth({'trades-house':{rows}},{cycle:2026});
  assert.deepEqual([w.trades.n,w.trades.late,w.trades.since,w.trades.official],[2,1,'2025-01-01',true],'a trade before the cycle is left out');
  assert.equal(cardWealth({'net-worth-house':annual()},{cycle:2026}).trades,null,'no trade report read');
});

test('Big Money Independence on the cards: the records the profile reads, trimmed to what the grade uses',async()=>{
  const {cardBmi}=await import('../src/finance.mjs');
  const sizes={brackets:[{total:5}],notSorted:0,start:'2025-01-01',end:'2026-09-30',cycles:{2024:{brackets:[]}}};
  const job={status:'ready',stale:false};
  const own={'donor-sizes':sizes,'net-worth-senate':annual(),'trades-senate':{rows:[trade('a','2025-03-01','2025-03-20',{source:'Senate eFD'}),trade('b','2024-06-01','2024-06-20',{source:'Senate eFD'})]}};
  const b=cardBmi(own,{chamber:'S',job,cycle:2026,officialFrom:'2016-01-01'});
  assert.deepEqual(Object.keys(b.sizes).sort(),['brackets','end','notSorted','start'],'past cycles left out');
  assert.deepEqual(b.snapshot.assets.map(a=>a.name),['Apple Inc. (AAPL)','Microsoft Corp'],'stocks only');
  assert.deepEqual(b.trades,{rows:[['2025-03-01',1001,15000,null]],covered:true,why:null},'this cycle\'s official trades');
  assert.match(cardBmi(own,{chamber:'S',job:{status:'ready',stale:true},cycle:2026}).trades.why,/hasn't finished/);
  // A complete read stays counted for two weeks while the daily re-read waits, runs or fails, with the day it was read.
  const day=n=>new Date(Date.now()-n*864e5).toISOString();
  const recent=cardBmi(own,{chamber:'S',job:{status:'pending',stale:true,last_success:day(3)},cycle:2026}).trades;
  assert.equal(recent.covered,true);assert.equal(recent.asOf,day(3).slice(0,10));
  assert.equal(cardBmi(own,{chamber:'S',job:{status:'error',stale:true,last_success:day(5),error:'eFD refused'},cycle:2026}).trades.covered,true);
  assert.match(cardBmi(own,{chamber:'S',job:{status:'error',stale:true,last_success:day(20),error:'eFD refused'},cycle:2026}).trades.why,/eFD refused/);
  assert.match(cardBmi(own,{chamber:'S',job:{status:'pending',stale:true,last_success:day(20)},cycle:2026}).trades.why,/last read in full on .*, over 14 days ago/);
  assert.match(cardBmi({},{chamber:'H',job,cycle:2026}).trades.why,/haven't been read/);
  assert.match(cardBmi({'trades-house':{rows:[],unread:['x','y']}},{chamber:'H',job,cycle:2026}).trades.why,/2 trade reports were filed on paper/);
  assert.equal(cardBmi({},{chamber:'H'}).snapshot,null);
});
