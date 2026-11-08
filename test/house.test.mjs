// Every member of the House (scripts/build-house.mjs): the directory, the basic members in the config, the lighter set
// of checks the refresh makes for them, and their checks going when they leave.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import config from '../data/config.json' with {type:'json'};
import house from '../public/house.json' with {type:'json'};
import {addMembers,memberEntry,houseFecId,seatOf,isDelegate} from '../scripts/build-house.mjs';
import {initialize,statement,LIGHT_KINDS} from '../src/refresh.mjs';
import {openDatabase} from '../scripts/sqlite.mjs';

const migration=await fs.readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
const leg=(bio,last,state,district,extra={})=>({id:{bioguide:bio,fec:[`H0${state}0${district}000`]},name:{first:'Pat',last,official_full:`Pat ${last}`},
  terms:[{type:'rep',state,district,party:'Democrat',start:'2023-01-03',end:'2027-01-03',url:`https://${last.toLowerCase()}.house.gov`}],...extra});

test('the directory: every member, with their seat; the delegates marked; full profiles linked',()=>{
  assert.ok(house.members.length>=430&&house.members.length<=441,`${house.members.length} members`);
  assert.equal(new Set(house.members.map(m=>m.id)).size,house.members.length,'ids are unique');
  assert.equal(house.members.filter(m=>m.delegate).length,6);
  for(const m of house.members){assert.match(m.id,/^[a-z0-9]+$/);assert.match(m.bioguide,/^[A-Z]\d{6}$/);}
  const ids=new Set(config.people.map(p=>p.id));
  for(const m of house.members)assert.ok(ids.has(m.id),`${m.name} is in the config`);
  assert.ok(house.members.some(m=>m.profiled&&m.id==='perry'),'a member with a full profile links to it');
  assert.deepEqual([seatOf('GA',5),seatOf('AK',0),isDelegate('DC'),isDelegate('TX')],['GA-5','AK at large',true,false]);
});

test('build: members without a profile join the config as basic and light; one who has left goes',()=>{
  const cfg={people:[{id:'perry',bioguide:'P000605',chamber:'H'},{id:'gone',name:'Old Member',bioguide:'X000001',chamber:'H',basic:true,light:true},{id:'smith',bioguide:'S000001',chamber:'S',basic:true}]};
  const research={members:[{id:'perry',bioguide:'P000605'}],cands:[]};
  const r=addMembers([leg('P000605','Perry','PA',10),leg('N000001','Smith','TX',7),leg('N000002','Lee','DC',0)],cfg,research);
  assert.deepEqual(r.removed,['Old Member']);assert.equal(r.added,2);
  const added=cfg.people.filter(p=>p.light);
  assert.deepEqual(added.map(p=>[p.id,p.chamber,p.basic,p.fecCand]),[['lee','H',true,'H0DC00000'],['psmith','H',true,'H0TX07000']],'listed by state; "smith" is taken by a senator');
  assert.ok(!cfg.people.some(p=>p.id==='gone'));
  assert.ok(r.members.find(m=>m.id==='perry').profiled);
  assert.equal(memberEntry(leg('N000003','Ray','AK',0),'ray',false).seat,'AK at large');
  assert.equal(houseFecId(leg('N000004','Kim','CA',3)),'H0CA03000');
});

test('refresh: a House basic profile gets only the lighter set of checks',async()=>{
  const db=openDatabase(':memory:');db.exec(migration);db.exec("INSERT INTO metadata VALUES ('initialized','test')");
  await initialize(db);
  const p=config.people.find(x=>x.light&&x.fecCand);assert.ok(p);
  const kinds=new Set((await statement(db,'SELECT kind FROM jobs WHERE subject=?',p.id).all()).results.map(r=>r.kind));
  for(const k of LIGHT_KINDS)if(k!=='trades-house'||p.inOffice!==false)assert.ok(kinds.has(k)||k==='trades-house',`${k} for ${p.id}`);
  assert.ok(kinds.has('committee')&&kinds.has('legislation'),'campaign committee and sponsored bills');
  for(const k of ['press','bluesky','news-gdelt','news-nyt','courts','doj','fec-legal','factcheck','outside','pac','youtube'])assert.ok(!kinds.has(k),`no ${k}`);
  // A full profile still gets everything.
  const full=new Set((await statement(db,"SELECT kind FROM jobs WHERE subject='collins'").all()).results.map(r=>r.kind));
  for(const k of ['press','news-gdelt','courts','donors'])assert.ok(full.has(k),k);
});

test('refresh: when someone leaves the config, their own checks and results go; global checks stay',async()=>{
  const db=openDatabase(':memory:');db.exec(migration);db.exec("INSERT INTO metadata VALUES ('initialized','test')");
  await initialize(db);
  await statement(db,"INSERT INTO jobs (id,kind,subject,args,next_due) VALUES ('cosponsored:gonehouse','cosponsored','gonehouse','{}',0)").run();
  await statement(db,"INSERT INTO snapshots (job_id,run_id,payload,updated_at) VALUES ('cosponsored:gonehouse','r1','{}','2026-01-01')").run();
  await statement(db,"INSERT INTO jobs (id,kind,subject,args,next_due) VALUES ('legislation:gonehouse','legislation','gonehouse','{}',0)").run();
  await statement(db,"UPDATE metadata SET value='stale' WHERE key='feeds'").run();
  await initialize(db);
  const left=(await statement(db,"SELECT id FROM jobs WHERE subject='gonehouse'").all()).results;
  assert.deepEqual(left,[]);assert.equal((await statement(db,"SELECT COUNT(*) n FROM snapshots WHERE job_id='cosponsored:gonehouse'").first()).n,0);
  assert.ok((await statement(db,"SELECT id FROM jobs WHERE id='house-fd'").first()),'a global check stays');
});
