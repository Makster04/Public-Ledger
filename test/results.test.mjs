// November 3, 2026 results (public/results.js and the "result" on each race in public/research.json): every covered race
// has a result with a source, a winner is one of the race's own candidates, a race not called yet marks nobody as having
// won or lost, and the seat notes say when winners take office and how long a losing incumbent serves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OUTCOME,raceResult,outcomeOf,seatNote,resultCounts,termAfter} from '../public/results.js';
const D=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
const race=id=>D.races.find(r=>r.id===id)||D.liteRaces.find(r=>r.id===id);

test('every covered race has a result with a source, and its winner or leader is one of its candidates',()=>{
  assert.match(D.election.date,/^2026-11-03$/);assert.match(D.election.asof,/^\d{4}-\d{2}-\d{2}$/);assert.match(D.election.note,/[Uu]nofficial/);
  for(const r of [...D.races,...D.liteRaces]){
    const x=r.result,keys=r.keys||r.nominees.map(n=>n.fecCand);
    assert.ok(x,`${r.id} has a result`);assert.match(x.src?.u||'',/^https:\/\//,`${r.id} has a source`);assert.ok(x.src.t,r.id);
    if(x.winner)assert.ok(keys.includes(x.winner),`${r.id}: the winner runs in the race`);
    else{assert.ok(x.how,`${r.id}: a race not called yet says why`);assert.doesNotMatch(x.how,/^Not called yet/,'the label is added on the page');}
    if(x.leader)assert.ok(keys.includes(x.leader)&&!x.winner,`${r.id}: a leader only while not called`);
  }
});

test('a decided race has one winner and everyone else lost; a race not called yet marks nobody',()=>{
  const me=race('S-ME');
  assert.equal(outcomeOf(me,'jackson'),'won');assert.equal(outcomeOf(me,'collins'),'lost');
  const mt=race('S-MT');assert.deepEqual(mt.keys.map(k=>outcomeOf(mt,k)),['lost','won','lost'],'two lost in Montana');
  const ak=race('S-AK');assert.equal(raceResult(ak).decided,false);
  assert.deepEqual(ak.keys.map(k=>outcomeOf(ak,k)),['pending','pending']);
  const va=race('H-VA-02');assert.equal(outcomeOf(va,'H6VA02198'),'won','toss-up nominees are known by their FEC ID');assert.equal(outcomeOf(va,'H2VA02064'),'lost');
  assert.equal(outcomeOf({id:'x',keys:['a']},'a'),null,'no result on file');
  for(const o of ['won','lost','pending'])assert.ok(OUTCOME[o].label&&OUTCOME[o].cls);
});

test('the seat notes: who takes office when, and how long a losing incumbent serves',()=>{
  assert.equal(seatNote(race('S-ME'),'collins',{incumbent:true}),'Serves until Jan. 3, 2027');
  assert.equal(seatNote(race('S-ME'),'jackson'),'Takes office Jan. 3, 2027');
  assert.equal(seatNote(race('S-GA'),'ossoff',{incumbent:true}),'Re-elected');
  assert.equal(seatNote(race('S-GA'),'mcollins'),'','a challenger who lost holds no seat');
  // Ohio's special election: the winner takes the seat once the result is certified.
  assert.equal(seatNote(race('S-OH'),'brown'),'Takes the seat once the state certifies the result');
  assert.equal(seatNote(race('S-OH'),'husted',{incumbent:true,winner:'Sherrod Brown'}),'Serves until Sherrod Brown is sworn in, after the state certifies the result');
  assert.equal(seatNote(race('S-AK'),'sullivan',{incumbent:true}),'','nothing while not called');
});

test('the 2026 line under a name turns past tense once the race is decided',()=>{
  assert.equal(termAfter('Seeking a 6th term','lost'),'Sought a 6th term');assert.equal(termAfter('Seeking a 2nd term','won'),'Won a 2nd term');
  assert.equal(termAfter('Running for an open Senate seat','won'),'Won an open Senate seat');assert.equal(termAfter('Running for an open Senate seat','lost'),'Ran for an open Senate seat');
  assert.equal(termAfter('Challenging Sen. Susan M. Collins','won'),'Defeated Sen. Susan M. Collins');assert.equal(termAfter('Challenging Rep. Kathy Castor','lost'),'Challenged Rep. Kathy Castor');
  assert.equal(termAfter('Appointed 2025; in the special election','lost'),'Appointed 2025; lost the special election');
  assert.equal(termAfter('Seeking a 3rd term','pending'),'Seeking a 3rd term','unchanged while not called');assert.equal(termAfter('Seeking a 3rd term',null),'Seeking a 3rd term');
  // Every profiled person's line has a past tense, so none is left saying "Seeking" after a decided race.
  for(const p of [...D.members,...D.cands]){const r=D.races.find(x=>x.keys.includes(p.id));const o=outcomeOf(r,p.id);
    if(o==='won'||o==='lost')assert.doesNotMatch(termAfter(p.term,o),/^(Seeking|Running|Challenging)|in the special/,p.id);}
});

test('the count of called races names the ones not called yet',()=>{
  const c=resultCounts([...D.races,...D.liteRaces]);
  assert.equal(c.total,43);assert.equal(c.missing,0);assert.equal(c.decided+c.pending.length,43);
  assert.deepEqual(c.pending.map(r=>r.id).sort(),['H-MI-07','H-WA-03','S-AK']);
});

test('the races page, profiles and home cards show the results, and the methodology explains them',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/import \{OUTCOME,raceResult,outcomeOf,seatNote,resultCounts,termAfter\} from '\.\/results\.js'/);assert.match(app,/termNow\(s\)/);
  assert.match(app,/\$\{resultBanner\(r,k=>byId\[k\]\)\}/);assert.match(app,/\$\{resultBanner\(r,k=>N\.find\(n=>n\.fecCand===k\)\)\}/);
  assert.match(app,/November 3, 2026 result/);assert.match(app,/res=personResult\(s\)/);
  assert.match(app,/id="method-results"/);assert.match(app,/no grade uses the results/);
});
