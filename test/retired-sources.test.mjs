// Sources that were turned off (Vote Smart, Eulerpool, Financial Modeling Prep): no checks are created for them, the ones
// an earlier version created are deleted with their saved results, and their keys aren't asked for on the Updates page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openDatabase} from '../scripts/sqlite.mjs';
import {addJob,getStatus,statement,ALL_KINDS} from '../src/refresh.mjs';
import {FEEDS,FEED_KINDS,RETIRED_FEEDS} from '../src/feeds.mjs';
const migration=await fs.readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');

test('turned-off sources make no checks, and checks made before are deleted with their results',async()=>{
  assert.deepEqual(RETIRED_FEEDS,['votesmart','trades-eulerpool','trades-fmp']);
  for(const k of RETIRED_FEEDS){assert.ok(FEEDS[k],`${k}'s reader is kept`);assert.ok(!FEED_KINDS.includes(k));assert.ok(!ALL_KINDS.includes(k));}
  const db=openDatabase(':memory:');db.exec(migration);db.exec(`INSERT INTO metadata VALUES ('initialized','test fixture'),('feeds','an older version')`);
  await addJob(db,'votesmart:collins','votesmart','collins',{candidate:'379'});
  await addJob(db,'trades-fmp:perry','trades-fmp','perry',{last:'Perry'});
  await addJob(db,'trades-eulerpool:perry','trades-eulerpool','perry',{last:'Perry'});
  db.exec(`INSERT INTO snapshots VALUES ('trades-fmp:perry','run-1','{}','2026-11-01'),('trades-bargo:perry','run-2','{}','2026-11-01')`);
  db.exec(`INSERT INTO records VALUES ('run-1','a','{}'),('run-2','b','{}')`);
  db.exec(`INSERT INTO refresh_history(job_id,status,at,message) VALUES ('trades-fmp:perry','error','2026-11-01','financialmodelingprep.com returned HTTP 402')`);
  const status=await getStatus({DB:db});
  const left=(await statement(db,"SELECT COUNT(*) n FROM jobs WHERE kind IN ('votesmart','trades-eulerpool','trades-fmp')").first()).n;
  assert.equal(left,0,'no checks left for the turned-off sources');
  assert.ok(!status.jobs.some(j=>RETIRED_FEEDS.includes(j.kind)));
  assert.equal((await statement(db,"SELECT COUNT(*) n FROM snapshots WHERE job_id='trades-fmp:perry'").first()).n,0);
  assert.equal((await statement(db,"SELECT COUNT(*) n FROM records WHERE run_id='run-1'").first()).n,0);
  assert.equal((await statement(db,"SELECT COUNT(*) n FROM records WHERE run_id='run-2'").first()).n,1,'other sources keep their results');
  assert.equal((await statement(db,"SELECT COUNT(*) n FROM refresh_history WHERE job_id='trades-fmp:perry'").first()).n,0);
  assert.ok(status.jobs.some(j=>j.kind==='trades-bargo'),'Bargo still runs');
  for(const k of ['VOTESMART_API_KEY','EULERPOOL_API_KEY','FMP_API_KEY'])assert.ok(!(k in status.keys),`${k} isn't asked for`);
  assert.ok('BARGO_API_KEY' in status.keys&&'FEC_API_KEY' in status.keys);
  db.close();
});
