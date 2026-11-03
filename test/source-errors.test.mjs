// What a failed check records (describeFailure): the kind of failure and, for a bug in our code, the file and line,
// never an error's own text, which can hold a request URL with a key. Plus two source fixes: ProPublica's 404 for a
// name that isn't a nonprofit, and the larger size allowed for a whole day of the Congressional Record.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {describeFailure,requestSource} from '../src/sources.mjs';
import {FEEDS} from '../src/feeds.mjs';
import {openDatabase} from '../scripts/sqlite.mjs';
import {addJob,feedSignature,runRefresh,statement} from '../src/refresh.mjs';
import config from '../data/config.json' with {type:'json'};
const migration=await fs.readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
const KEY='SECRETKEY-9f8e7d';

test('each kind of failure gets its own plain message, with no key or address in it',()=>{
  const net=(code,extra={})=>Object.assign(new TypeError('fetch failed'),{cause:Object.assign(new Error(`connect ${code} https://api.open.fec.gov/v1/x?api_key=${KEY}`),{code,...extra})});
  const cases=[
    [new DOMException('The operation was aborted due to timeout','TimeoutError'),/^Timed out: no complete reply within 20 seconds/],
    [net('ECONNRESET'),/^Could not connect \(ECONNRESET\): the connection failed or was dropped/],
    [net('UND_ERR_CONNECT_TIMEOUT'),/^Could not connect: the source did not answer/],
    [Object.assign(new TypeError('fetch failed'),{cause:new Error('unexpected redirect')}),/^Source redirected unexpectedly/],
    [(()=>{try{JSON.parse(`{"k":"${KEY}"`);}catch(e){return e;}})(),/^The reply could not be read/],
    [(()=>{try{null.results;}catch(e){return e;}})(),/^Unexpected reply or a bug in our reader: the reply was missing an expected field \(results\)/],
    [new TypeError(`Failed to parse URL from https://x.gov/?api_key=${KEY}`),/^Unexpected reply or a bug in our reader: the reply had an unexpected shape/],
    [Object.assign(new Error(`database is locked ${KEY}`),{code:'ERR_SQLITE_ERROR'}),/^Local database error \(ERR_SQLITE_ERROR\)/],
    [new RangeError(`Invalid array length ${KEY}`),/^Unexpected RangeError/],
    [Object.assign(new Error(KEY),{name:`<b>${KEY}</b>`}),/^Unexpected Unknown/]];
  for(const [error,expected] of cases){const m=describeFailure(error);assert.match(m,expected);assert.ok(!m.includes(KEY)&&!/https?:|api_key/.test(m),m);assert.match(m,/previous data retained$/);}
});

test('a bug in our own code names the file and line it came from',()=>{
  const e=new TypeError("Cannot read properties of undefined (reading 'organizations')");
  e.stack=`TypeError: ${e.message}\n    at page (file:///Users/x/Public-Ledger/src/feeds.mjs:931:29)\n    at runRefresh (file:///Users/x/Public-Ledger/src/refresh.mjs:160:9)`;
  assert.equal(describeFailure(e),'Unexpected reply or a bug in our reader: the reply was missing an expected field (organizations) at feeds.mjs:931; previous data retained');
});

test('the refresh saves the new message on the check and in its history',async()=>{
  const db=openDatabase(':memory:');db.exec(migration);db.exec(`INSERT INTO metadata VALUES ('initialized','test fixture'),('feeds','${feedSignature()}')`);
  await addJob(db,'campaign:a','campaign','a',{committee:'C00314575',cycle:2026});
  await runRefresh({DB:db,FEC_API_KEY:KEY,fetch:async()=>{throw new DOMException('The operation was aborted due to timeout','TimeoutError');}},{steps:1});
  const job=await statement(db,"SELECT status,error FROM jobs WHERE id='campaign:a'").first(),hist=await statement(db,"SELECT message FROM refresh_history WHERE job_id='campaign:a'").first();
  assert.equal(job.status,'error');assert.match(job.error,/^Timed out/);assert.equal(hist.message,job.error);db.close();
});

test('a name ProPublica answers with 404 is recorded as not found as a nonprofit, not a failure',async()=>{
  const env={fetch:async u=>/search\.json/.test(String(u))?new Response('not found',{status:404}):new Response('{}',{status:500})};
  const job={kind:'outside-groups',subject:'collins',cursor:null};
  const r=await FEEDS['outside-groups'].page(job,{groups:['Senate Leadership Fund']},env,config);
  assert.equal(r.rows.length,1);assert.equal(r.rows[0].group,'Senate Leadership Fund');assert.equal(r.rows[0].ein,null);
  assert.match(r.rows[0].review,/Not found as a nonprofit/);
});

test('a reply over 12 MB fails unless the request allows more, and never over 40 MB',async()=>{
  const big='x'.repeat(13_000_000),env={GOVINFO_API_KEY:'gk',fetch:async()=>new Response(big)};
  await assert.rejects(requestSource('https://api.govinfo.gov/packages/CREC-2026-01-01/mods',env,{as:'text'}),/exceeds safe page size/);
  assert.equal((await requestSource('https://api.govinfo.gov/packages/CREC-2026-01-01/mods',env,{as:'text',maxChars:40_000_000})).length,13_000_000);
  await assert.rejects(requestSource('https://api.govinfo.gov/x',{GOVINFO_API_KEY:'gk',fetch:async()=>new Response('x'.repeat(40_000_001))},{as:'text',maxChars:90_000_000}),/exceeds safe page size/);
});

test('FEC enforcement search leaves out type, which the FEC rejects as "all"',async()=>{
  const seen=[],env={FEC_API_KEY:'fk',fetch:async u=>{seen.push(String(u));return new Response(JSON.stringify({murs:[],admin_fines:[],adrs:[],advisory_opinions:[]}));}};
  await FEEDS['fec-legal'].page({kind:'fec-legal',subject:'collins',cursor:null},{name:'Susan M. Collins',committee:'C00314575'},env,config);
  assert.equal(seen.length,1);assert.doesNotMatch(seen[0],/[?&]type=/);assert.match(seen[0],/q=%22Susan/);
});

test('top donors by month asks for at most 10 employer names at a time, skips "NULL", and counts a gift once',async()=>{
  const names=Array.from({length:23},(_,i)=>`EMPLOYER ${i}`);names[2]='APOLLO';names[12]='APOLLO GLOBAL MANAGEMENT';names.splice(5,0,'NULL');
  const db=openDatabase(':memory:');db.exec(migration);db.exec(`INSERT INTO metadata VALUES ('initialized','test fixture'),('feeds','${feedSignature()}')`);
  await addJob(db,'donor-months:collins','donor-months','collins',{committee:'C00314575',cycle:2026,orgs:names});
  const asked=[];
  const fetch=async u=>{const url=new URL(String(u)),emp=url.searchParams.getAll('contributor_employer');asked.push(emp);
    if(url.searchParams.get('two_year_transaction_period')!=='2026')return new Response('{"results":[],"pagination":{}}');
    const rows=[{sub_id:`9${asked.length}`,committee_id:'C00314575',contributor_employer:emp[0],contribution_receipt_date:'2026-03-04',contribution_receipt_amount:100}];
    if(emp.some(e=>/^APOLLO/.test(e)))rows.push({sub_id:'77',committee_id:'C00314575',contributor_employer:'APOLLO GLOBAL MANAGEMENT',contribution_receipt_date:'2026-03-20',contribution_receipt_amount:1000});
    return new Response(JSON.stringify({results:rows,pagination:{}}));};
  for(let i=0;i<20;i++){await runRefresh({DB:db,FEC_API_KEY:'fk',fetch},{steps:40});if((await statement(db,"SELECT status FROM jobs WHERE id='donor-months:collins'").first()).status==='ready')break;}
  const job=await statement(db,"SELECT status,error FROM jobs WHERE id='donor-months:collins'").first();
  assert.equal(job.status,'ready',job.error||'');
  assert.ok(asked.length&&asked.every(e=>e.length>=1&&e.length<=10),'never more than 10 names in one request');
  assert.ok(!asked.some(e=>e.includes('NULL')),'"NULL" is not an employer');
  const all=asked.flat();for(const n of names.filter(n=>n!=='NULL'))assert.ok(all.includes(n),`${n} is asked for`);
  const snap=JSON.parse((await statement(db,"SELECT payload FROM snapshots WHERE job_id='donor-months:collins'").first()).payload);
  assert.deepEqual(snap.months['APOLLO GLOBAL MANAGEMENT'],{'2026-03':1000},'found under APOLLO and under APOLLO GLOBAL MANAGEMENT, counted once');
  db.close();
});
