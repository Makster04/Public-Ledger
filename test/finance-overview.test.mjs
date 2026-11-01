import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openDatabase} from '../scripts/sqlite.mjs';
import {addJob,feedSignature,getProfile,statement} from '../src/refresh.mjs';
import {getFinanceOverview} from '../src/finance.mjs';

const migration=await fs.readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
function database(){
  const db=openDatabase(':memory:');db.exec(migration);
  db.exec(`INSERT INTO metadata VALUES ('initialized','test fixture'),('feeds','${feedSignature()}')`);
  return db;
}
async function snapshot(db,id,kind,subject,payload,checked='2026-11-01T12:00:00.000Z'){
  await addJob(db,id,kind,subject,{});
  await statement(db,'INSERT INTO snapshots(job_id,run_id,payload,updated_at) VALUES(?,?,?,?)',id,'run:'+id,JSON.stringify(payload),checked).run();
}

test('financial overview preserves annual ranges, periods and missing coverage without inventing zero records',async()=>{
  const db=database();
  try{
    const annual={year:2025,filed:'2026-05-01',url:'https://example.com/annual',low:1001,high:null,assets:[{name:'Example stock',type:'Stock',value:'Over $1,000'}],debts:[],unreadable:false};
    await snapshot(db,'annual:booker','net-worth-senate','booker',annual);
    await snapshot(db,'campaign:collins','campaign','collins',{receipts:42000,cash:10000,start:'2025-01-01',end:'2026-06-30'});
    await snapshot(db,'unknown','net-worth-senate','untracked-person',annual);
    const result=await getFinanceOverview({DB:db,fetch:()=>{throw new Error('No network request is permitted');}});
    assert.equal(result.people.booker.netWorth.low,1001);assert.equal(result.people.booker.netWorth.high,null);
    assert.deepEqual(result.people.booker.netWorth.assets,annual.assets);
    assert.deepEqual(result.people.booker.coverage,{netWorth:true,trades:false,campaign:false});
    assert.equal(result.people.collins.netWorth,null);assert.equal(result.people.collins.campaign.end,'2026-06-30');
    assert.deepEqual(result.people.collins.trades,[]);assert.equal(result.people['untracked-person'],undefined);
    assert.equal(result.checkedAt,'2026-11-01T12:00:00.000Z');
  }finally{db.close();}
});

test('trade aggregation matches individual profile merge priority and never assigns global filings across people',async()=>{
  const db=database();
  try{
    const base={id:'trade#1',traded:'2026-10-01',ticker:'EXM',type:'buy',low:1001,high:15000,amount:'$1,001 - $15,000',asset:'Example company'};
    const official={...base,source:'House Clerk',disclosed:'2026-10-04',official:{url:'https://example.com/official',filed:'2026-10-04'},owner:'Spouse'};
    await snapshot(db,'official:collins','trades-house','collins',{rows:[official],count:1,unread:[{url:'https://example.com/paper',why:'Scanned report'}]});
    await snapshot(db,'service:collins','trades-fmp','collins',{rows:[{...base,source:'Financial Modeling Prep',disclosed:'2026-10-05',asset:'Service description'}],count:1});
    await snapshot(db,'service:booker','trades-fmp','booker',{rows:[{...base,source:'Financial Modeling Prep',disclosed:'2026-10-08'}],count:1});
    await snapshot(db,'filings','house-fd','House',{byPerson:{collins:[{id:'filing',ptr:true,filed:'2026-10-08',url:'https://example.com/only-collins'}]}});
    await snapshot(db,'sectors','sec-sic','companies',{byTicker:{EXM:{sector:'Finance',industry:'Example industry'}}});
    const env={DB:db},result=await getFinanceOverview(env),profile=await getProfile(env,'collins');
    assert.deepEqual(result.people.collins.trades,profile.merged.trades);
    assert.equal(result.people.collins.trades.length,1);assert.equal(result.people.collins.trades[0].filed,'2026-10-04');
    assert.equal(result.people.collins.trades[0].owner,'Spouse');assert.equal(result.people.collins.trades[0].sector,'Finance');
    assert.ok(result.people.collins.trades[0].review.some(t=>t.includes('different disclosure date')));
    assert.equal(result.people.booker.trades[0].official,undefined);assert.equal(result.people.booker.trades[0].filed,'2026-10-08');
    assert.equal(result.people.collins.tradesUnread.length,1);assert.equal(result.people.collins.tradesTruncated,false);
  }finally{db.close();}
});

test('overview selects the latest annual report and reports bounded or upstream-truncated trade histories',async()=>{
  const db=database();
  try{
    await snapshot(db,'annual-old','net-worth-house','booker',{year:2024,filed:'2025-05-01',low:10,high:20},'2026-11-01T12:00:00.000Z');
    await snapshot(db,'annual-new','net-worth-senate','booker',{year:2025,filed:'2026-05-01',low:30,high:40},'2026-10-01T12:00:00.000Z');
    const rows=Array.from({length:1501},(_,i)=>({id:'t#'+i,traded:'2026-10-01',ticker:'T'+i,type:'buy',low:1,high:1000,source:'Bargo',disclosed:'2026-10-03'}));
    await snapshot(db,'trades:booker','trades-bargo','booker',{count:1501,rows});
    await snapshot(db,'trades:collins','trades-fmp','collins',{count:20,rows:[]});
    const result=await getFinanceOverview({DB:db});
    assert.equal(result.people.booker.netWorth.year,2025);assert.equal(result.people.booker.netWorth.low,30);
    assert.equal(result.people.booker.trades.length,1500);assert.equal(result.people.booker.tradesTruncated,true);
    assert.equal(result.people.collins.tradesTruncated,true);assert.equal(result.people.collins.coverage.trades,true);
  }finally{db.close();}
});
