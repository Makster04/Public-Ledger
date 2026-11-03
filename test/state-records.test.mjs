// State legislative records (Open States and LegiScan): a career before 2010 is "not covered" rather than a failed
// check, Open States is searched without a middle initial and then through the bills a former legislator sponsored,
// LegiScan reads the sessions from the years they served, the House disclosure index matches legal first names, and the
// years served come from the research's own entries.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FEEDS,sameName,firstNames,STATE_COVERAGE_FROM} from '../src/feeds.mjs';
import {stateLegYears} from '../scripts/build-ids.mjs';
import config from '../data/config.json' with {type:'json'};
const json=x=>new Response(JSON.stringify(x));
const person=id=>config.people.find(p=>p.id===id);
const args=(kind,id)=>FEEDS[kind].jobs(config).find(j=>j.subject===id).args;
async function run(kind,id,routes){
  const calls=[],env={OPENSTATES_API_KEY:'ok',LEGISCAN_API_KEY:'lk',fetch:async u=>{calls.push(String(u));for(const [re,body] of routes)if(re.test(String(u)))return json(body);return new Response('missing',{status:404});}};
  const job={kind,subject:id,cursor:null},a=args(kind,id),rows=[];
  for(let i=0;i<30;i++){const r=await FEEDS[kind].page(job,a,env,config);rows.push(...r.rows);if(!r.next)break;job.cursor=r.next;}
  return {rows,calls,snapshot:FEEDS[kind].summarize(rows,a,job,config)};
}

test('years served come from the research entries, "present" being this year',()=>{
  assert.deepEqual(stateLegYears(['Texas House of Representatives, District 50, 2023–present','Texas House of Representatives, District 52, 2018–2023'],2026),[2018,2026]);
  assert.deepEqual(stateLegYears(['Ohio House of Representatives, August 2016–January 2025 (District 47, 2016–2022']),[2016,2025]);
  assert.equal(stateLegYears([]),null);
  assert.deepEqual(person('brown').stateLegYears,[1975,1982]);assert.deepEqual(person('talarico').stateLegYears,[2018,2026]);
});

test('a career that ended before 2010 is not covered, and no request is sent',async()=>{
  for(const kind of ['state-openstates','state-legiscan']){
    const r=await run(kind,'brown',[]);
    assert.equal(r.calls.length,0);assert.match(r.snapshot.notCovered,/1975–1982, before Open States and LegiScan cover it/);assert.equal(r.snapshot.count??r.snapshot.rows.length,0);
  }
  for(const id of ['cooper','rogers','peltola','pappas'])assert.ok(person(id).stateLegYears[1]<STATE_COVERAGE_FROM,id);
  assert.ok(person('husted').stateLegYears[1]>=STATE_COVERAGE_FROM,'Husted served into 2011');
});

test('Open States: the name without a middle initial, then a former legislator through their bills',async()=>{
  const bill=(person,name)=>({id:'ocd-bill/9',identifier:'HB 9',session:'2013',title:'A bill',openstates_url:'https://openstates.org/x',latest_action_date:'2013-04-01',sponsorships:[{person:{id:person,name},name,primary:true}]});
  // Sitting legislator found only without the middle initial.
  const m=await run('state-openstates','millermeeks',[[/people\?.*name=Mariannette%20Miller-Meeks/,{results:[{id:'ocd-person/mm'}]}],[/people\?/,{results:[]}],[/bills\?.*sponsor=ocd-person/,{results:[],pagination:{max_page:1}}]]);
  assert.equal(m.snapshot.person,'ocd-person/mm');
  // Former legislator: nobody in the people search; their sponsored bills give the ID (another Paxton is left out).
  const p=await run('state-openstates','paxton',[[/people\?/,{results:[]}],[/bills\?.*sponsor=Paxton/,{results:[bill('ocd-person/kp','Ken Paxton'),bill('ocd-person/ap','Angela Paxton')]}],
    [/bills\?.*sponsor=ocd-person%2Fkp/,{results:[bill('ocd-person/kp','Ken Paxton')],pagination:{max_page:1}}]]);
  assert.equal(p.snapshot.person,'ocd-person/kp');assert.equal(p.snapshot.rows.length,1);assert.equal(p.snapshot.notCovered,null);
  await assert.rejects(run('state-openstates','paxton',[[/people\?/,{results:[]}],[/bills\?/,{results:[]}]]),/No Open States person matches/);
});

test('LegiScan reads the sessions from the years they served and matches nicknames',async()=>{
  const sessions=[2026,2024,2022,2020,2018,2016,2014,2012,2010].map((y,i)=>({session_id:100+i,year_start:y,year_end:y+1,special:0}));
  const asked=[];
  const r=await run('state-legiscan','paxton',[[/getSessionList/,{status:'OK',sessions}],
    [/getSessionPeople&id=(\d+)/,{status:'OK',sessionpeople:{people:[{people_id:5,first_name:'Warren',nickname:'Ken',last_name:'Paxton'}]}}],
    [/getSponsoredList/,{status:'OK',sponsoredbills:{sessions:[],bills:[]}}]]);
  const peopleCalls=r.calls.filter(u=>/getSessionPeople/.test(u)).map(u=>Number(u.match(/id=(\d+)/)[1]));
  assert.deepEqual(peopleCalls,[106],'the newest session he served in (2014–15), found by his nickname');
  assert.equal(r.snapshot.person,5);
});

test('the House disclosure index matches legal first names and two-word last names',()=>{
  assert.ok(sameName('Michael V.','Lawler',person('lawler')));assert.ok(!sameName('Michelle','Lawler',person('lawler')));
  assert.ok(sameName('Marie','Gluesenkamp Perez',person('mgp')));assert.ok(sameName('Garland Hale','Barr',person('barr')));
  assert.ok(sameName('Felix Barry','Moore',person('moore')));assert.ok(sameName('Kathleen','Castor',person('castor')));
  assert.ok(firstNames(person('barr')).includes('garland'),'a legal first name from data/config.json');
});

test('checks made before this version get the new details and the House index is read again',async()=>{
  const fs=await import('node:fs');const {openDatabase}=await import('../scripts/sqlite.mjs');
  const {addJob,getStatus,statement}=await import('../src/refresh.mjs');
  const db=openDatabase(':memory:');db.exec(fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  db.exec(`INSERT INTO metadata VALUES ('initialized','test fixture'),('feeds','an older version')`);
  await addJob(db,'state-openstates:brown','state-openstates','brown',{state:'oh',name:'Sherrod Brown',openstates:null},Date.now()+86400000);
  await addJob(db,'donor-months:collins','donor-months','collins',{committee:'C00314575',cycle:2026,orgs:['ACME CORP']});
  await addJob(db,'house-fd:2024','house-fd','House',{year:2024},Date.now()+86400000);
  await getStatus({DB:db});
  const os=await statement(db,"SELECT args,next_due FROM jobs WHERE id='state-openstates:brown'").first();
  assert.deepEqual(JSON.parse(os.args).years,[1975,1982]);assert.equal(os.next_due,0);
  assert.deepEqual(JSON.parse((await statement(db,"SELECT args FROM jobs WHERE id='donor-months:collins'").first()).args).orgs,['ACME CORP'],'details another check filled in are kept');
  assert.equal((await statement(db,"SELECT next_due FROM jobs WHERE id='house-fd:2024'").first()).next_due,0,'the House index is read again');
  db.close();
});
