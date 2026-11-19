// November 3, 2026 results (public/results.js and the "result" on each race in public/research.json): every covered race
// has a result with a source, a winner is one of the race's own candidates, a race not called yet marks nobody as having
// won or lost, and the seat notes say when winners take office and how long a losing incumbent serves.
import {withRemovedResearch,withRemovedSenate} from './fixtures/with-removed.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OUTCOME,raceResult,outcomeOf,seatNote,resultCounts,termAfter,tallyOf,sharePct,nomineeKey,seatChange} from '../public/results.js';
// Alaska's race as the site had it on Nov. 11, still counting (called Nov. 17), for the rules on a race not called yet.
import akCountingFile from './fixtures/alaska-counting-2026-11-11.json' with {type:'json'};
const AK_COUNTING=akCountingFile.result;
const D=withRemovedResearch(JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8')));
const race=id=>D.races.find(r=>r.id===id)||D.liteRaces.find(r=>r.id===id);

test('every covered race has a result with a source, and its winner or leader is one of its candidates',()=>{
  assert.match(D.election.date,/^2026-11-03$/);assert.match(D.election.asof,/^\d{4}-\d{2}-\d{2}$/);assert.match(D.election.note,/[Uu]nofficial/);
  for(const r of [...D.races,...D.liteRaces]){
    const x=r.result,keys=r.keys||r.nominees.map(nomineeKey);
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
  const ak=race('S-AK');assert.equal(raceResult(ak).decided,true,'called for Peltola on Nov. 17');
  assert.deepEqual(ak.keys.map(k=>outcomeOf(ak,k)),['lost','won']);
  const counting={...ak,result:AK_COUNTING};assert.equal(raceResult(counting).decided,false);
  assert.deepEqual(counting.keys.map(k=>outcomeOf(counting,k)),['pending','pending'],'a race not called yet: as Alaska was on Nov. 11');
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
  assert.equal(seatNote({...race('S-AK'),result:AK_COUNTING},'sullivan',{incumbent:true}),'','nothing while not called');
  assert.equal(seatNote(race('S-AK'),'sullivan',{incumbent:true}),'Serves until Jan. 3, 2027');assert.equal(seatNote(race('S-AK'),'peltola'),'Takes office Jan. 3, 2027');
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

test('every race has a vote count with a source: a share for each candidate, the winner or leader ahead, and nothing over 100%',()=>{
  for(const r of [...D.races,...D.liteRaces]){
    const t=tallyOf(r),x=r.result;
    assert.ok(t,r.id);assert.match(t.src?.u||'',/^https:\/\//,r.id);assert.match(t.asof,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(t.rows.every(y=>typeof y.pct==='number'&&y.pct>0&&y.pct<100),`${r.id}: a share for each candidate`);
    const top=t.rows[0].key;assert.equal(top,x.winner||x.leader,`${r.id}: the ${x.winner?'winner':'leader'} has the largest share`);
    assert.ok(t.rows.reduce((a,y)=>a+y.pct,0)+t.others.reduce((a,o)=>a+o.pct,0)<=100.6,r.id);
  }
  // A source that gave neither the votes counted nor how much was in is shown as such, not left blank.
  const without=[...D.races,...D.liteRaces].filter(r=>{const t=tallyOf(r);return t.total==null&&!t.counted;}).map(r=>r.id);
  assert.ok(without.length<=4,`turnout missing for ${without.join(', ')}`);
});

test('turnout: the source\'s total, or the sum of all votes only when every candidate\'s votes were given',()=>{
  const race=(id,tally,keys=['a','b'])=>({id,keys,result:{winner:'a',tally}});
  assert.equal(tallyOf(race('x',{shares:{a:50.8,b:46.1},votes:{a:643244,b:583403},others:[{name:'L',pct:3.1,votes:38759}]})).total,1265406);
  assert.equal(tallyOf(race('x',{shares:{a:52.5,b:45.5},votes:{a:2497852,b:2162890}})).total,null,'2% unnamed: no sum');
  assert.equal(tallyOf(race('x',{shares:{a:52.5,b:45.5},votes:{a:2497852,b:2162890}})).rest,2);
  assert.equal(tallyOf(race('x',{shares:{a:60,b:40},total:5000})).total,5000);
  assert.deepEqual(tallyOf(race('x',{shares:{a:40,b:60}})).rows.map(y=>y.key),['b','a'],'highest share first');
  assert.equal(sharePct(54,true),'54%');assert.equal(sharePct(48),'48.0%');assert.equal(sharePct(50.01),'50.0%');assert.equal(sharePct(null),'—');
  assert.equal(tallyOf(race('x',{shares:{a:54,b:46}})).whole,true);assert.equal(tallyOf(race('x',{shares:{a:48,b:47.7}})).whole,false,'48.0 next to 47.7 keeps its decimal');
});

test('the count of called races names the ones not called yet',()=>{
  const c=resultCounts([...D.races,...D.liteRaces]);
  const n=D.races.length+D.liteRaces.length;
  assert.equal(c.total,n);assert.equal(c.missing,0);assert.equal(c.decided+c.pending.length,n);
  assert.deepEqual(c.pending.map(r=>r.id).sort(),[],'every race called (Alaska last, on Nov. 17)');
  const was=resultCounts([...D.races.map(r=>r.id==='S-AK'?{...r,result:AK_COUNTING}:r),...D.liteRaces]);
  assert.deepEqual(was.pending.map(r=>r.id),['S-AK'],'a race still counting is named');
});

test('the Races page is gone (Nov. 19, 2026); profiles and home cards keep the results, and the methodology explains them',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(app,/import \{OUTCOME,raceResult,outcomeOf,seatNote,resultCounts,termAfter,tallyOf,sharePct,nomineeKey,seatChange\} from '\.\/results\.js'/);assert.match(app,/termNow\(s\)/);
  assert.doesNotMatch(app,/function renderRaces|function resultCard|function countyMap|county-results\.json/,'the page, its cards and its county maps');
  assert.doesNotMatch(html,/href="#races"/,'no Races tab');assert.doesNotMatch(app,/href="#races"/,'no links to it');
  assert.match(app,/else if\(m\[1\]==='races'\)\{location\.replace\('#home'\);\}/,'an old link opens the home page');
  assert.match(app,/November 3, 2026 result/);assert.match(app,/res=personResult\(s\)/);
  assert.match(app,/id="method-results"/);assert.match(app,/no grade uses the results/);assert.match(app,/<b>The Races page:<\/b> taken down on Nov\. 19, 2026/);
  for(const f of ['public/county-results.json','public/maps','scripts/county-results.mjs','data/county-samples'])assert.ok(!fs.existsSync(new URL('../'+f,import.meta.url)),f);
});

test('every 2026 Senate seat has its race on file: profiled, or results only with its sitting senator linked',()=>{
  const S=withRemovedSenate(JSON.parse(fs.readFileSync(new URL('../public/senate.json',import.meta.url),'utf8'))).senators;
  const states=new Set([...D.races,...D.liteRaces].filter(r=>r.chamber==='S').map(r=>r.state));
  for(const x of S.filter(y=>y.nextElection===2026))assert.ok(states.has(x.state),`${x.name}'s seat (${x.state}) has a race`);
  const lite=D.liteRaces.filter(r=>r.chamber==='S');assert.equal(lite.length,14);
  for(const r of lite){
    assert.ok(!D.races.some(x=>x.chamber==='S'&&x.state===r.state),`${r.state} is not also a profiled race`);
    for(const n of r.nominees){assert.ok(nomineeKey(n),r.id);if(n.incumbent)assert.ok(S.some(x=>x.id===n.id),`${n.name} is a sitting senator, known by their directory ID`);else assert.match(n.id,/^[a-z]{2}-[a-z]+$/,n.name);}
  }
  assert.equal(S.find(x=>x.id==='moody').nextElection,2026,'an appointed senator\'s special election counts as their next election');
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/The rest of the 2026 Senate races/);assert.match(app,/function seatRace\(s\)/);
});

test('flip or hold: the winner against the party that held the seat before the election',()=>{
  const S=withRemovedSenate(JSON.parse(fs.readFileSync(new URL('../public/senate.json',import.meta.url),'utf8'))).senators,people=[...D.members,...D.cands];
  for(const r of [...D.races,...D.liteRaces]){
    assert.ok(['D','R','I'].includes(r.held?.party)&&r.held.by,`${r.id}: who held the seat`);
    const inc=r.inc?people.find(p=>p.id===r.inc):r.nominees?.find(n=>n.incumbent);
    if(inc)assert.deepEqual([r.held.party,r.held.by],[inc.party,inc.name],`${r.id}: the incumbent who ran holds it`);
    else if(r.chamber==='S'){const out=S.find(x=>x.state===r.state&&x.nextElection===2026);assert.equal(r.held.by,out.name,`${r.id}: the outgoing senator`);}
  }
  assert.deepEqual(seatChange(race('S-ME'),'D'),{flip:true,from:'R',to:'D',label:'Flip +1',detail:'Democrats take the seat from Republicans'});
  assert.equal(seatChange(race('S-GA'),'D').label,'Remains Blue');assert.equal(seatChange(race('S-AL'),'R').label,'Remains Red');
  assert.equal(seatChange(race('S-IA'),'D').label,'Flip +1','an open seat: Joni Ernst held it');
  assert.equal(seatChange(race('H-FL-22'),'D').label,'Remains Blue','a redrawn district: its current member is a Democrat');
  assert.equal(seatChange({...race('S-AK'),result:AK_COUNTING},'D'),null,'nothing until the race is called');
  assert.equal(seatChange(race('S-AK'),'D').label,'Flip +1','Peltola takes the seat Dan Sullivan held');
});

