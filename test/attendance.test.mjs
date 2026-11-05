// Showing Up, the Integrity part for missed roll-call votes: the Voteview files counted (scripts/build-attendance.mjs) and
// the score figured from them (public/integrity.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tally,congressOf,congressesFor,trackedIds} from '../scripts/build-attendance.mjs';
import {showingUpComponent,excusedAbsences,integrityPreview} from '../public/integrity.js';

test("Voteview's files counted: each member's votes and misses by year and day, the chamber's roll calls by day",()=>{
  const files={rollcalls:[{rollnumber:'1',date:'2025-01-03'},{rollnumber:'2',date:'2025-01-03'},{rollnumber:'3',date:'2025-02-10'},{rollnumber:'4',date:'2022-12-01'}],
    members:[{icpsr:'10',bioguide_id:'X000001',chamber:'Senate'},{icpsr:'20',bioguide_id:'Y000002',chamber:'Senate'},{icpsr:'30',bioguide_id:'Z000003',chamber:'Senate'},{icpsr:'99',bioguide_id:'P000001',chamber:'President'}],
    votes:[{rollnumber:'1',icpsr:'10',cast_code:'1'},{rollnumber:'2',icpsr:'10',cast_code:'9'},{rollnumber:'3',icpsr:'10',cast_code:'6'},{rollnumber:'4',icpsr:'10',cast_code:'9'},
      {rollnumber:'1',icpsr:'20',cast_code:'0'},{rollnumber:'2',icpsr:'20',cast_code:'7'},{rollnumber:'3',icpsr:'20',cast_code:'2'},{rollnumber:'1',icpsr:'30',cast_code:'9'},{rollnumber:'1',icpsr:'99',cast_code:'9'}]};
  const out=tally(files,'S',new Map([['X000001','x'],['Y000002','y'],['P000001','pres']]),2023);
  assert.deepEqual(out.days.S,{'2025-01-03':2,'2025-02-10':1},'roll calls before the first year are left out');
  assert.deepEqual(out.people.x,{years:{2025:{votes:3,missed:1}},missed:{'2025-01-03':1},spans:[['S','2025-01-03','2025-02-10']]});
  assert.deepEqual(out.people.y.years,{2025:{votes:2,missed:1}},'not a member yet (0) is not counted; Present counts as there; a paired vote is missed');
  assert.ok(!out.people.z,'only the people on the site');assert.ok(!out.people.pres,'the President is not a member of the chamber');
  assert.equal(congressOf(2023),118);assert.equal(congressOf(2026),119);assert.deepEqual(congressesFor(2026,4),[118,119]);assert.deepEqual(congressesFor(2026,6),[117,118,119]);
  assert.deepEqual([...trackedIds({people:[{id:'ossoff',bioguide:'O000174'},{id:'nobio'}]},{members:[{id:'perry',bioguide:'P000605'}],cands:[]})],[['O000174','ossoff'],['P000605','perry']]);
});

const attendance={source:'https://voteview.com/data',days:{S:{'2024-05-01':30,'2025-03-04':10,'2025-06-01':460,'2024-06-01':470,'2021-01-05':50}},
  people:{a:{years:{2021:{votes:50,missed:50},2024:{votes:500,missed:30},2025:{votes:500,missed:10}},missed:{'2021-01-05':50,'2024-05-01':30,'2025-03-04':10},spans:[['S','2021-01-01','2025-12-31']]},
    few:{years:{2026:{votes:20,missed:1}},missed:{},spans:[['S','2026-01-01','2026-02-01']]}}};

test('Showing Up: 100 − 5 points per percentage point of votes missed over the last four years',()=>{
  const s=showingUpComponent({id:'a'},attendance,{asOfYear:2026});
  assert.equal(s.complete,true);assert.equal(s.votes,1000);assert.equal(s.missed,40);assert.equal(s.rate,4);assert.equal(s.value,80);
  assert.deepEqual(s.years.map(y=>[y.year,y.votes,y.missed]),[[2025,500,10],[2024,500,30]],'2021 is more than four years back');
  assert.equal(showingUpComponent({id:'a'},{...attendance,people:{a:{...attendance.people.a,years:{2025:{votes:100,missed:25}}}}},{asOfYear:2026}).value,0,'20% or more missed is 0');
  assert.equal(showingUpComponent({id:'few'},attendance,{asOfYear:2026}).complete,false,'fewer than 50 votes is not enough');
  assert.match(showingUpComponent({id:'nobody'},attendance).why,/No roll-call votes on record/);
});

test('an excused absence with a cited source leaves its days out; campaigning and uncited reasons do not',()=>{
  const src={t:'Office statement',u:'https://example.gov/statement'};
  const person={id:'a',absences:[{from:'2024-05-01',to:'2024-05-01',reason:'medical',src},{from:'2025-03-04',reason:'campaign',src},{from:'2025-03-04',reason:'military'},{from:'2025-06-02',to:'2025-06-01',reason:'birth',src}]};
  assert.deepEqual(excusedAbsences(person).map(a=>[a.from,a.label]),[['2024-05-01','Medical leave']],'only a listed reason, with a source and valid dates');
  const s=showingUpComponent(person,attendance,{asOfYear:2026});
  assert.equal(s.votes,970);assert.equal(s.missed,10);assert.equal(Number(s.value.toFixed(2)),94.85);
  assert.deepEqual(s.excused.map(a=>[a.label,a.votes,a.missed]),[['Medical leave',30,30]]);
  assert.ok(s.sources.some(x=>x.u==='https://example.gov/statement'));
});

test('Showing Up joins the Integrity preview; the saved attendance file, when built, fits it',()=>{
  const p=integrityPreview({id:'a',statements:[]},{asOfYear:2026,attendance});
  assert.equal(p.showingUp.value,80);assert.ok(p.overall.missing.includes('honesty'),'other parts stay unknown without their data');
  const file=new URL('../public/attendance.json',import.meta.url);
  if(!fs.existsSync(file))return;
  const a=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.ok(a.from<=a.to&&a.days.S&&a.days.H);
  for(const [id,p] of Object.entries(a.people)){
    for(const [y,v] of Object.entries(p.years))assert.ok(v.missed<=v.votes&&Number(y)>=a.from,`${id} ${y}`);
    assert.equal(Object.values(p.missed).reduce((n,x)=>n+x,0),Object.values(p.years).reduce((n,v)=>n+v.missed,0),`${id}: misses by day add up to misses by year`);
  }
});
