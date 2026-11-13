import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {compare,buildEntry,sixFiles,previousOf,formulaOf} from '../scripts/scores-monthly.mjs';
import {makeScorer,gradedPeople,sixContext,LOGGED_GRADES} from '../public/scoring.js';
const read=async f=>JSON.parse(await fs.readFile(new URL('../'+f,import.meta.url),'utf8'));
const research=await read('public/research.json');

test('each change in the monthly log says what moved and why',()=>{
  const was={a:{promises:{pct:67,kept:2,half:0,broken:1,counted:3},ethics:{pct:100,finding:0,open:0,closed:0,allegation:0,late:0,conflict:0},pvp:{pct:null,people:0,profit:0,actions:0}}};
  const now={a:{promises:{pct:67,kept:2,half:0,broken:1,counted:3},ethics:{pct:85,finding:0,open:1,closed:0,allegation:0,late:0,conflict:0},pvp:{pct:null,people:1,profit:0,actions:1}},
    b:{promises:{pct:null,kept:0,half:0,broken:0,counted:0},ethics:{pct:100,finding:0,open:0,closed:0,allegation:0,late:0,conflict:0},pvp:{pct:null,people:0,profit:0,actions:0}}};
  const c=compare(was,now);
  assert.deepEqual(c.find(x=>x.id==='a'&&x.grade==='ethics'),{id:'a',grade:'ethics',from:100,to:85,why:'+1 open investigation'});
  assert.equal(c.find(x=>x.id==='a'&&x.grade==='pvp').why,'+1 action for working people');
  assert.ok(!c.some(x=>x.id==='a'&&x.grade==='promises'),'an unchanged grade is not logged');
  assert.deepEqual(c.filter(x=>x.id==='b').map(x=>x.grade),['ethics'],'a new person is logged only where graded');
  assert.equal(compare({x:was.a},{}).at(-1).why,'No longer profiled');
});
test('the Ethics indexes are logged; an older entry without them reads as a rule change, not a broken count',()=>{
  const e=o=>({promises:{pct:null,kept:0,half:0,broken:0,counted:0},pvp:{pct:null,people:0,profit:0,actions:0},ethics:Object.assign({pct:80,finding:1,open:0,closed:0,allegation:0,late:0,conflict:0},o)});
  assert.equal(compare({a:e({})},{a:e({pct:90,legal:10,insider:null,dodger:null})})[0].why,'Rule or weight change');
  assert.equal(compare({a:e({pct:90,legal:10,insider:null,dodger:null})},{a:e({pct:80,legal:20,insider:null,dodger:null})})[0].why,'+10 Legal Trouble Index points');
  assert.equal(compare({a:e({legal:20,insider:null,dodger:null})},{a:e({legal:20,insider:0,dodger:null})}).length,0,'no data and 0 are the same');
});
test('the monthly log records the grades the profiles show, for every reviewed and basic profile',async()=>{
  const committees=await read('public/committees.json'),sectors=await read('public/committee-sectors.json'),config=await read('data/config.json');
  const tallies=(await read('public/vote-party.json')).votes,files=sixFiles();
  const e=buildEntry(research,committees,sectors,null,config,'2026-11-10',tallies,files);
  assert.equal(e.formula,'six');assert.deepEqual(e.grades,LOGGED_GRADES);assert.match(e.research,/^[0-9a-f]{12}$/);
  // The page's own path (public/app.js and boot.js, checked below): its scorer, its context and its basic profiles.
  const scorer=makeScorer(research,committees,sectors.committees,tallies),ctx=sixContext(files);
  const people=gradedPeople(research,{senate:files.senate.senators,house:files.house.members});
  assert.equal(Object.keys(e.scores).length,people.length);
  for(const s of people){const x=scorer.six(s,ctx);for(const g of LOGGED_GRADES)assert.equal(e.scores[s.id][g].pct,x[g].pct,`${s.id} · ${g}`);}
  for(const m of [...files.house.members,...files.senate.senators])assert.ok(e.scores[m.id],`${m.id} is logged`);
  for(const s of [...research.members,...research.cands,...(research.featured||[])])assert.ok(e.scores[s.id],`${s.id} is logged`);
  assert.ok(!('pvp' in e.scores.collins)&&!('ethics' in e.scores.collins)&&!('promises' in e.scores.collins),'the retired grades aren\'t logged any more');
  const pf=research.members.find(s=>s.id==='collins');
  assert.equal(e.scores.collins.peoplefirst.pct,scorer.six(pf,ctx).peoplefirst.pct);
});
test('the page scores the same way: its scorer, context and basic profiles come from public/scoring.js',async()=>{
  const app=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8'),boot=await fs.readFile(new URL('../public/boot.js',import.meta.url),'utf8');
  assert.match(app,/const SCORER=makeScorer\(DATA,COMMITTEES,COMMITTEE_SECTORS,window\.VOTE_PARTY\);/);
  assert.match(app,/const SIX_CTX=sixContext\(\{attendance:window\.ATTENDANCE,getItDone:window\.GET_IT_DONE,conflicts:window\.CONFLICTS,ratings:window\.GROUP_RATINGS,questions:QCTX\}\);/);
  // (the Ideology lean comes from the alignment questions: each person's stances are worked out once, before scoring)
  assert.match(app,/const QCTX=\{list:QUESTIONS\.questions,categories:QUESTIONS\.categories\};/);
  assert.match(app,/const sixOf=s=>\{if\(!sixCache\.has\(s\.id\)\)sixCache\.set\(s\.id,SCORER\.six\(withQ\(s\),SIX_CTX\)\)/);
  assert.match(app,/\[\.\.\.SENATE,\.\.\.HOUSE,\.\.\.ELECT\]\.filter\(x=>!byId\[x\.id\]\)\.map\(x=>\[x\.id,basicShape\(Object\.assign\(markBasic\(x\)/);
  // (basicShape only adds empty money parts, so the full design's tabs can draw; it changes no scored input)
  assert.match(app,/function basicShape\(x\)\{/);
  for(const f of ['research','committees','committee-sectors','vote-party','senate','house','attendance','get-it-done','conflicts','group-ratings','questions','question-stances'])assert.ok(boot.includes(`'/${f}.json'`),f);
  assert.match(boot,/window\.COMMITTEE_SECTORS=\(await sectors\)\?\.committees/);assert.match(boot,/window\.VOTE_PARTY=\(await voteParty\)\?\.votes/);
  assert.match(boot,/window\.SENATE=sen\?\.senators/);assert.match(boot,/window\.HOUSE=hs\?\.members/);
});
test('the six scores\' changes say why; a new entry is compared only with the last one of its formula',()=>{
  const g=(o={})=>({word:{pct:null,kept:0,half:0,broken:0,counted:0},showsup:{pct:80,missed:10,votes:100,getItDone:null},peoplefirst:{pct:50,people:1,profit:1,actions:2,cci:null},...o});
  const c=compare({a:g()},{a:g({showsup:{pct:77,missed:13,votes:120,getItDone:null}})});
  assert.deepEqual(c,[{id:'a',grade:'showsup',from:80,to:77,why:'+3 missed roll calls, +20 roll calls on record'}]);
  const retired={date:'2026-11-01',scores:{}},six={date:'2026-12-01',formula:'six',scores:{}};
  assert.equal(formulaOf(retired),'retired');
  assert.equal(previousOf([retired],{date:'2026-11-10',formula:'six'}),null,'not compared with the retired grades');
  assert.equal(previousOf([retired,six],{date:'2027-01-01',formula:'six'}),six);
  assert.equal(previousOf([retired,six],{date:'2026-12-01',formula:'six'}),null,'a second run the same day replaces that day\'s entry');
});
test('the committed log is well formed: each entry\'s grades are those of its formula, newest last',async()=>{
  const log=await read('public/score-log.json');
  assert.ok(log.entries.length>=1);
  for(const x of log.entries){
    assert.match(x.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(Array.isArray(x.changes));assert.ok(['six','retired'].includes(formulaOf(x)));
    const grades=formulaOf(x)==='six'?LOGGED_GRADES:['promises','ethics','pvp'];
    for(const s of Object.values(x.scores))for(const g of grades)assert.ok(s[g].pct===null||(s[g].pct>=0&&s[g].pct<=101),`${x.date} ${g}`);
  }
  assert.deepEqual(log.entries.map(x=>x.date),[...log.entries.map(x=>x.date)].sort(),'newest last');
});
