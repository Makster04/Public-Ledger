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
