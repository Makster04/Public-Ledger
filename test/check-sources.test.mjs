// The source check's description of Eulerpool's replies (npm run check:sources -- --only eulerpool): the list wherever it
// sits, the fields of a trade in either of the spellings its docs show, and whether a search by name was honored.
import test from 'node:test';
import assert from 'node:assert/strict';
import {eulerpoolTrades,eulerpoolLines} from '../scripts/check-sources.mjs';

const ref={politician:'Scott Perry',symbol:'NVDA',transaction_type:'Purchase',amount_from:1001,amount_to:15000,transaction_date:'2026-03-02T00:00:00Z',filing_date:'2026-03-20',chamber:'House'};
const promo={politician:'Nancy Pelosi',chamber:'House',ticker:'AAPL',type:'Sale',amountMin:250001,amountMax:500000,transactionDate:'2026-02-10',disclosureDate:'2026-02-28'};

test('Eulerpool: the list is found as a plain list, in "data" or in "trades"',()=>{
  assert.equal(eulerpoolTrades([ref]).length,1);assert.equal(eulerpoolTrades({data:[ref,promo]}).length,2);assert.equal(eulerpoolTrades({trades:[promo]}).length,1);
  assert.deepEqual(eulerpoolTrades({error:'Unauthorized'}),[]);
  assert.match(eulerpoolLines({error:'Unauthorized',status:401})[0],/No list of trades in the reply; it has: error, status/);
  assert.deepEqual(eulerpoolLines(null),['  No JSON in the reply.']);
});

const live={id:1,politician_id:'x',tx_date:'2026-10-30',filing_date:'2026-11-13',symbol:'AVGO',asset_description:'Broadcom Inc.',asset_type:'Stock',tx_type:'Sale',tx_amount_low:1001,tx_amount_high:15000,owner:'Spouse',politician:'David J. Taylor',party:'R',chamber:'house'};
test('Eulerpool: the spelling its live replies use (tx_date, tx_type, tx_amount_low) is read too',()=>{
  assert.equal(eulerpoolLines([live])[2],'  David J. Taylor (house): Sale AVGO, traded 2026-10-30, filed 2026-11-13, owner Spouse, $1001 to $15000');
});

test('Eulerpool: a trade is described in either spelling, and a search by name says whether the name was honored',()=>{
  const lines=eulerpoolLines({data:[ref,promo]});
  assert.equal(lines[0],'  2 trades, in "data"');
  assert.match(lines[1],/fields of a trade: politician, symbol, transaction_type/);
  assert.equal(lines[2],'  Scott Perry (House): Purchase NVDA, traded 2026-03-02, filed 2026-03-20, $1001 to $15000');
  assert.equal(lines[3],'  Nancy Pelosi (House): Sale AAPL, traded 2026-02-10, filed 2026-02-28, $250001 to $500000');
  assert.match(eulerpoolLines([ref],{name:'Perry'}).at(-1),/1 of 1 are Perry's, so the search by name works/);
  assert.match(eulerpoolLines([ref,promo],{name:'Perry'}).at(-1),/1 of 2 are Perry's, so the name was ignored/);
});
