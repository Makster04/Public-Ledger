// SAM.gov (company federal IDs) allows about 10 requests a day: each organization is looked up once and the answer shared
// across people for 30 days, the check runs monthly, one page makes at most one request, and a refusal (HTTP 429) waits
// six hours instead of one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDatabase} from '../scripts/sqlite.mjs';
import {addJob,feedSignature,runRefresh,statement} from '../src/refresh.mjs';
import {FEEDS,DAY} from '../src/feeds.mjs';
import {requestSource,DAILY_LIMIT_WAIT} from '../src/sources.mjs';
const migration=fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');

function setup(){
  const db=openDatabase(':memory:');db.exec(migration);db.exec(`INSERT INTO metadata VALUES ('initialized','test fixture'),('feeds','${feedSignature()}')`);
  const asked=[],env={DB:db,SAM_API_KEY:'sk',fetch:async u=>{const name=new URL(String(u)).searchParams.get('legalBusinessName');asked.push(name);
    return new Response(JSON.stringify({totalRecords:1,entityData:[{entityRegistration:{ueiSAM:`UEI-${name.replace(/\W/g,'')}`,legalBusinessName:name}}]}));}};
  return {db,env,asked};
}
async function until(db,env,ids){for(let n=0;n<40;n++){await runRefresh(env,{steps:5});const left=(await statement(db,`SELECT COUNT(*) n FROM jobs WHERE id IN (${ids.map(()=>'?').join(',')}) AND status!='ready'`,...ids).first()).n;if(!left)return;}throw new Error('jobs did not finish');}
const snap=async(db,id)=>JSON.parse((await statement(db,'SELECT payload FROM snapshots WHERE job_id=?',id).first()).payload);

test('an organization is looked up once and shared, and each answer is dated',async()=>{
  const {db,env,asked}=setup();
  await addJob(db,'sam:collins','sam','collins',{orgs:['ACME CORP','BETA LLC']});
  await until(db,env,['sam:collins']);
  await addJob(db,'sam:booker','sam','booker',{orgs:['Acme Corp.','GAMMA INC']});
  await until(db,env,['sam:booker']);
  assert.deepEqual(asked,['ACME CORP','BETA LLC','GAMMA INC'],'Acme is asked once for both people');
  const b=await snap(db,'sam:booker');
  assert.deepEqual(b.rows.map(r=>[r.org,r.uei]),[['Acme Corp.','UEI-ACMECORP'],['GAMMA INC','UEI-GAMMAINC']]);
  assert.ok(b.rows.every(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.checked)));
  db.close();
});

test('one page makes at most one request; known names are filled in on the way',async()=>{
  const {db,env,asked}=setup();
  await addJob(db,'sam:collins','sam','collins',{orgs:['ACME CORP']});await until(db,env,['sam:collins']);
  const job={kind:'sam',subject:'marshall',cursor:null},args={orgs:['ACME CORP','NEW ONE','ANOTHER']};
  const first=await FEEDS.sam.page(job,args,env);
  assert.deepEqual(first.rows.map(r=>r.org),['ACME CORP','NEW ONE'],'Acme from the saved answer, then one request');
  assert.equal(first.next,'2');assert.deepEqual(asked,['ACME CORP','NEW ONE']);
  db.close();
});

test('an answer older than 30 days is looked up again; the check itself runs monthly',async()=>{
  const {db,env,asked}=setup();
  const old=new Date(Date.now()-31*DAY).toISOString().slice(0,10);
  db.exec(`INSERT INTO jobs(id,kind,subject,args) VALUES ('sam:collins','sam','collins','{"orgs":["ACME CORP"]}')`);
  db.exec(`INSERT INTO snapshots VALUES ('sam:collins','r1','${JSON.stringify({rows:[{id:'ACME CORP',org:'ACME CORP',uei:'OLD',checked:old}]})}','${old}')`);
  const r=await FEEDS.sam.page({kind:'sam',subject:'booker',cursor:null},{orgs:['ACME CORP']},env);
  assert.deepEqual(asked,['ACME CORP']);assert.equal(r.rows[0].uei,'UEI-ACMECORP');
  assert.equal(FEEDS.sam.every,30*DAY);
  db.close();
});

test('a SAM.gov refusal waits six hours, since its limit is a daily allowance',async()=>{
  const env={SAM_API_KEY:'sk',fetch:async()=>new Response('API rate limit exceeded',{status:429})};
  await assert.rejects(requestSource('https://api.sam.gov/entity-information/v3/entities?legalBusinessName=X',env),e=>e.statusCode===429&&e.retryAfter===DAILY_LIMIT_WAIT&&/daily allowance/.test(e.message));
  // Another source's 429 keeps the usual wait; a Retry-After is followed.
  await assert.rejects(requestSource('https://api.nytimes.com/svc/x',{NYT_API_KEY:'n',fetch:async()=>new Response('slow down',{status:429})}),e=>e.retryAfter===0);
  await assert.rejects(requestSource('https://api.sam.gov/x',{SAM_API_KEY:'sk',fetch:async()=>new Response('',{status:429,headers:{'Retry-After':'120'}})}),e=>e.retryAfter===120000);
  // In the refresh: the check and every other SAM.gov check wait the six hours.
  const {db}=setup(),started=Date.now();
  await addJob(db,'sam:collins','sam','collins',{orgs:['ACME CORP']});await addJob(db,'sam:booker','sam','booker',{orgs:['GAMMA INC']});
  await runRefresh({DB:db,...env},{steps:5});
  const jobs=(await statement(db,"SELECT status,error,next_due FROM jobs WHERE kind='sam'").all()).results;
  assert.ok(jobs.every(j=>j.next_due>=started+DAILY_LIMIT_WAIT),'all SAM.gov checks wait');
  assert.ok(jobs.some(j=>/daily allowance is used up/.test(j.error||'')));
  db.close();
});
