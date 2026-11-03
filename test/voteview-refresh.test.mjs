// Senate roll calls from Voteview when Senate.gov turns scripts away (HTTP 403): the same record shape as the official
// file, senators matched by Bioguide ID, party totals that must add up to Voteview's own counts, a six-hour pause on
// Senate.gov after a refusal, and the Senate's list of new votes from Voteview too.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openDatabase} from '../scripts/sqlite.mjs';
import {addJob,feedSignature,runRefresh,statement,resetSenateRefusal} from '../src/refresh.mjs';
import {voteviewSenateVote,voteviewSenateIndex,csvRows,voteviewPage} from '../src/voteview.mjs';
import config from '../data/config.json' with {type:'json'};
const migration=await fs.readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');

// The 119th Congress, session 2: roll call 253 (Voteview's roll 912) is 2 Yea (R), 1 Nay (D), one paired; roll 254 adds up wrong.
const CSV={
  rollcalls:'congress,chamber,rollnumber,date,session,clerk_rollnumber,yea_count,nay_count,bill_number,vote_result,vote_desc,vote_question\n'+
    '119,Senate,912,2026-09-30,2,253,2,1,HR7008,Cloture Motion Rejected,"Stop Insider Trading Act, cloture",On the Cloture Motion\n'+
    '119,Senate,913,2026-10-01,2,254,40,1,S1,Passed,Something,On Passage\n'+
    '119,Senate,500,2025-12-18,1,700,1,0,,Agreed to,First session vote,On the Motion\n',
  members:'congress,chamber,icpsr,party_code,bioguide_id\n119,Senate,1,200,C001035\n119,Senate,2,200,S001198\n119,Senate,3,100,O000174\n119,Senate,4,100,X000001\n119,President,99,200,T000000\n',
  votes:'congress,chamber,rollnumber,icpsr,cast_code\n119,Senate,912,1,1\n119,Senate,912,2,1\n119,Senate,912,3,6\n119,Senate,912,4,2\n119,Senate,913,1,1\n119,Senate,913,3,6\n119,Senate,500,1,1\n'};
const files=Object.fromEntries(Object.entries(CSV).map(([k,v])=>[k,csvRows(v)]));
const args={id:'119-2-253',chamber:'S',congress:119,session:2,number:253};

test('a Voteview roll call has the official record\'s shape, matched by Bioguide ID',()=>{
  const v=voteviewSenateVote(files,args,config.people,'https://www.senate.gov/official.xml');
  assert.equal(v.id,'s-119-2-253');assert.equal(v.date,'2026-09-30');assert.equal(v.result,'Cloture Motion Rejected');assert.equal(v.question,'On the Cloture Motion');
  assert.equal(v.positions.collins,'Yea');assert.equal(v.positions.sullivan,'Yea');assert.equal(v.positions.ossoff,'Nay');
  assert.ok(!('marshall' in v.positions),'no vote recorded: no position');
  assert.deepEqual(v.byParty,{R:{Yea:2},D:{Nay:1,'Not Voting':1}});
  assert.equal(v.source,'https://www.senate.gov/official.xml');assert.equal(v.via,'Voteview');assert.equal(v.voteview,voteviewPage(119,912));
  assert.equal(voteviewPage(119,912),'https://voteview.com/rollcall/RS1190912');
  assert.throws(()=>voteviewSenateVote(files,{...args,number:254},config.people,''),/do not add up/);
  assert.throws(()=>voteviewSenateVote(files,{...args,number:999},config.people,''),/not in Voteview yet/);
  assert.deepEqual(voteviewSenateIndex(files,{congress:119,session:2}).map(v=>v.number),[254,253],'this session only, newest first');
});

function refreshEnv(seen){
  return {DB:null,fetch:async u=>{u=String(u);seen.push(u);
    if(/senate\.gov/.test(u))return new Response('Forbidden',{status:403});
    const kind=u.match(/out\/(\w+)\/S119_/)?.[1];return kind?new Response(CSV[kind]):new Response('missing',{status:404});}};
}
async function db(){const d=openDatabase(':memory:');d.exec(migration);d.exec(`INSERT INTO metadata VALUES ('initialized','test fixture'),('feeds','${feedSignature()}')`);return d;}

test('when Senate.gov refuses, the refresh reads the roll call from Voteview and asks Senate.gov no more for a while',async()=>{
  resetSenateRefusal();
  const d=await db(),seen=[],env={...refreshEnv(seen),DB:d};
  await addJob(d,'vote:S:119:2:253','vote','119-2-253',args);
  await runRefresh(env,{steps:5});
  const job=await statement(d,"SELECT status,error FROM jobs WHERE id='vote:S:119:2:253'").first();
  assert.equal(job.status,'ready',job.error||'');
  const snap=JSON.parse((await statement(d,"SELECT payload FROM snapshots WHERE job_id='vote:S:119:2:253'").first()).payload);
  assert.equal(snap.positions.ossoff,'Nay');assert.equal(snap.via,'Voteview');assert.match(snap.source,/senate\.gov\/legislative\/LIS\/roll_call_votes\/vote1192\/vote_119_2_00253\.xml$/);
  assert.equal(seen.filter(u=>/senate\.gov/.test(u)).length,1,'Senate.gov asked once');
  // A second roll call right after: straight to Voteview.
  await addJob(d,'vote:S:119:2:254','vote','119-2-254',{...args,id:'119-2-254',number:254});
  const before=seen.length;await runRefresh(env,{steps:5});
  assert.ok(!seen.slice(before).some(u=>/senate\.gov/.test(u)),'no new Senate.gov request during the pause');
  const bad=await statement(d,"SELECT status,error FROM jobs WHERE id='vote:S:119:2:254'").first();
  assert.equal(bad.status,'error');assert.match(bad.error,/do not add up/,'a vote whose totals don\'t add up is not published');
  d.close();resetSenateRefusal();
});

test('the Senate\'s list of new votes comes from Voteview too, and adds a check for each',async()=>{
  resetSenateRefusal();
  const d=await db(),seen=[],env={...refreshEnv(seen),DB:d};
  await addJob(d,'senate-index','senate-index','Senate',{congress:119,session:2});
  await runRefresh(env,{steps:5});
  const job=await statement(d,"SELECT status,error FROM jobs WHERE id='senate-index'").first();assert.equal(job.status,'ready',job.error||'');
  const added=(await statement(d,"SELECT id FROM jobs WHERE kind='vote' ORDER BY id").all()).results.map(r=>r.id);
  assert.ok(added.includes('vote:S:119:2:253')&&added.includes('vote:S:119:2:254'));
  d.close();resetSenateRefusal();
});

test('other Senate.gov errors are not sent to Voteview',async()=>{
  resetSenateRefusal();
  const d=await db(),seen=[];
  const env={DB:d,fetch:async u=>{seen.push(String(u));return new Response('busy',{status:503});}};
  await addJob(d,'vote:S:119:2:253','vote','119-2-253',args);
  await runRefresh(env,{steps:5});
  const job=await statement(d,"SELECT status,error FROM jobs WHERE id='vote:S:119:2:253'").first();
  assert.equal(job.status,'error');assert.match(job.error,/HTTP 503/);assert.ok(!seen.some(u=>/voteview/.test(u)));
  d.close();
});
