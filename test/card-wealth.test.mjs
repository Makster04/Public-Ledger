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
