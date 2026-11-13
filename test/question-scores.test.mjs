// Stances on the alignment questions and what's built from them (public/question-scores.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {stanceNet,familyOf,recordRows,creditItems,recordPoints,applyStatements,ratingPoints,ratingScore,ratingItems,stanceOf,stanceWord,questionLean,ideologyLeans,compassFrom,matchFrom,legacyEvidence,personStances,MIN_POINTS} from '../public/question-scores.js';
import QFILE from '../public/questions.json' with {type:'json'};
import GR from '../public/group-ratings.json' with {type:'json'};

test('one credit per bill: the higher value once, and several votes on a bill count once (the latest)',()=>{
  const c=creditItems([
    {ref:'117-hr-1',kind:'s',date:'2021-01-04',side:0},{ref:'117-hr-1#H117-50',kind:'y',date:'2021-03-01',side:0},
    {ref:'117-hr-2#H117-60',kind:'y',date:'2021-04-01',side:0},{ref:'117-hr-2#S117-90',kind:'n',date:'2021-06-01',side:1},
    {ref:'118-hr-3',kind:'c',date:'2023-02-01',side:1},{ref:'vote:H117-9',kind:'y',date:'2021-01-06',side:1},{ref:'x',kind:'other',side:0}]);
  const by=Object.fromEntries(c.map(x=>[x.ref.split('#')[0],x]));
  assert.equal(c.length,4);assert.equal(by['117-hr-1'].kind,'s');assert.equal(by['117-hr-1'].pts,1.5);
  assert.equal(by['117-hr-2'].side,1,'the later vote on the same bill');assert.equal(by['118-hr-3'].pts,1);assert.equal(by['vote:H117-9'].pts,1);
  const p=recordPoints(c);assert.deepEqual([p.a,p.b],[1.5,3]);assert.equal(p.firstB,'2021-01-06');assert.equal(p.lastB,'2021-06-01');assert.equal(p.lastA,'','a sponsorship is not a vote');
});

test('the contradiction rule: a statement is cancelled by a later vote the other way; one after an opposite vote counts as a change',()=>{
  const rec={firstA:'',lastA:'',firstB:'2022-05-01',lastB:'2022-05-01'};
  const r=applyStatements([{side:0,date:'2020-02-01'},{side:0,date:'2024-03-01'},{side:1,date:'2021-01-01'},{side:0}],rec);
  assert.deepEqual(r.rows.map(x=>x.status),['cancelled','changed','counted','counted']);
  assert.equal(r.a,6);assert.equal(r.b,3);
});

test('stance: at least 3 points; Yes / Leans yes / Mixed / Leans no / No or the question\'s own sides',()=>{
  assert.equal(stanceOf(2,0.5).s,null);assert.equal(MIN_POINTS,3);
  assert.equal(stanceOf(3,1).s,0.5);assert.equal(stanceOf(0,4).s,-1);
  assert.equal(stanceWord(null),'Not on record');assert.equal(stanceWord(0.8),'Yes');assert.equal(stanceWord(0.3),'Leans yes');
  assert.equal(stanceWord(0.1),'Mixed');assert.equal(stanceWord(-0.3),'Leans no');assert.equal(stanceWord(-1),'No');
  assert.equal(stanceWord(-0.4,['Pro-life','Pro-choice']),'Leans pro-choice');
  assert.equal(ratingPoints(100),3);assert.equal(ratingPoints(50),0);assert.equal(ratingPoints(0),3);assert.equal(ratingPoints(75),1.5);
});

const Q=[{id:'wage',cat:'econ',q:'Raise it?',sides:['Yes','No'],liberal:0,axis:'econ'},{id:'tax',cat:'econ',q:'Tax?',sides:['Yes','No'],liberal:0,axis:'econ'},
  {id:'guns',cat:'social',q:'Limits?',sides:['Yes','No'],liberal:0,axis:'social'},{id:'ab',cat:'health',q:'Abortion?',sides:['Pro-life','Pro-choice'],liberal:1,axis:'social'},
  {id:'ukr',cat:'foreign',q:'Aid?',sides:['Yes','No'],liberal:null,axis:null}];
const C=[{id:'econ',name:'Economic'},{id:'social',name:'Social'},{id:'health',name:'Healthcare'},{id:'foreign',name:'Foreign Policy'}];

test('leans: a question\'s lean is conservative-positive; categories average their questions; overall needs 3 categories',()=>{
  assert.equal(questionLean(1,Q[0]),-100);assert.equal(questionLean(1,Q[3]),100);assert.equal(questionLean(0.5,Q[4]),null);assert.equal(questionLean(null,Q[0]),null);
  const st={wage:{s:-1,a:0,b:4},tax:{s:-0.5,a:1,b:3},guns:{s:-1},ab:{s:1},ukr:{s:1}};
  const L=ideologyLeans(st,Q,C);
  const by=Object.fromEntries(L.categories.map(c=>[c.id,c]));
  assert.equal(by.econ.lean,75);assert.equal(by.econ.n,2);assert.equal(by.social.lean,100);assert.equal(by.health.lean,100);assert.equal(by.foreign.lean,null);assert.equal(by.foreign.onRecord,1);
  assert.equal(L.scored,3);assert.equal(L.lean,92);
  assert.equal(ideologyLeans({wage:{s:-1},guns:{s:1}},Q,C).lean,null,'two categories are too few');
  assert.deepEqual(compassFrom(st,Q),{x:75,y:100,nx:2,ny:2});
});

test('match: (1 + your side × their stance) ÷ 2, weighted by importance, over the questions where both have a position',()=>{
  const st={wage:{s:1},tax:{s:-1},guns:{s:0}};
  const m=matchFrom({wage:{side:0,w:5},tax:{side:0,w:1},guns:{side:1,w:2},ab:{side:0,w:3},nope:{side:0,w:3}},st,Q);
  assert.equal(m.nChosen,4);assert.equal(m.nCov,3);assert.equal(m.score,Math.round(100*(5*1+1*0+2*0.5)/8));
  assert.equal(m.rows.find(r=>r.q.id==='ab').status,'none');assert.equal(m.byCat.econ.score,Math.round(100*5/6));
  assert.equal(matchFrom({},st,Q).score,null);
  // their record has to cover at least 3 of your answers (all of them if fewer) and half your importance
  assert.equal(matchFrom({wage:{side:0,w:1},tax:{side:0,w:1},guns:{side:0,w:1},ab:{side:0,w:1}},{wage:{s:1}},Q).score,null);
  assert.equal(matchFrom({wage:{side:0,w:1}},{wage:{s:1}},Q).score,100);
  assert.equal(matchFrom({wage:{side:0,w:1},tax:{side:0,w:1},guns:{side:0,w:1},ab:{side:0,w:5}},st,Q).score,null,'under half the importance');
});

test('carried-over evidence: statements, state votes and official acts; congressional items only without a record',()=>{
  const ev={abortion:[{type:'stated',side:'A',date:'2020-01-01',title:'Speech'},{type:'house_vote',side:'B',ref:'r1',date:'2021-01-01'}],
    guns:[{type:'state_vote',side:'A',ref:'s1',date:'2019-01-01'}],civil:[{type:'stated',side:'A'}]};
  const a=legacyEvidence(ev);assert.deepEqual(a.abortion.statements.map(x=>x.side),[1],'abortion side A (protect access) is Pro-choice');
  assert.equal(a.abortion.items.length,1);assert.equal(a['gun-purchase-limits'].items[0].kind,'state');assert.equal(a.civil,undefined);
  assert.equal(legacyEvidence(ev,{hasRecord:true}).abortion.items.length,0);
  // a statement for Pro-choice in 2020, then a record vote toward Pro-life in 2022: the statement is cancelled
  const p=personStances({abortion:[4,0,'2022-03-01','2022-03-01','','']},{abortion:[{type:'stated',side:'A',date:'2020-01-01',title:'Speech'}]});
  assert.equal(p.abortion.statements[0].status,'cancelled');assert.deepEqual([p.abortion.a,p.abortion.b],[4,0]);assert.equal(p.abortion.s,1);
  const q=personStances(null,{guns:[{type:'stated',side:'A',date:'2020-01-01'},{type:'state_vote',side:'A',ref:'s1',date:'2019-01-01'}]});
  assert.equal(q['gun-purchase-limits'].a,2,'a statement beside a state vote counts 1');assert.equal(q['gun-purchase-limits'].statementPoints,1);
  // with nothing done on the question, a statement counts 3 and the stance reads as from statements only
  const r=personStances(null,{guns:[{type:'stated',side:'A',date:'2020-01-01'}]});
  assert.deepEqual([r['gun-purchase-limits'].a,r['gun-purchase-limits'].s,r['gun-purchase-limits'].statementsOnly],[3,1,true]);
});

test('group ratings: a topic group counts on its question, toward its side above 50 and the other side below, up to 3',()=>{
  const qs=[{id:'ab',sides:['Pro-life','Pro-choice'],groups:{sba:0,rfa:1}},{id:'clim',sides:['Yes','No'],groups:{lcv:0}},{id:'none',sides:['Yes','No']}];
  assert.equal(ratingScore({grade:'A+'}),100);assert.equal(ratingScore({grade:'F-',score:12}),12);assert.equal(ratingScore({grade:'?'}),null);
  const r=ratingItems([{group:'sba',org:'SBA',grade:'F'},{group:'rfa',org:'RFA',score:100,year:2025},{group:'lcv',org:'LCV',score:75},
    {group:'lcv',org:'LCV',score:50},{group:'heritage',org:'Heritage',score:0},{group:'humane',org:'Humane',score:105}],qs);
  assert.deepEqual(Object.keys(r).sort(),['ab','clim'],'an overall group is on no question; a 50 counts nothing');
  assert.deepEqual(r.ab.map(x=>[x.group,x.side,x.pts]),[['sba',1,3],['rfa',1,3]],'an F from a pro-life group counts toward Pro-choice');
  assert.deepEqual(r.clim.map(x=>[x.side,x.pts]),[[0,1.5]]);
  // with the record: points add to the record's, and a question with only ratings gets a stance too
  const p=personStances({ab:[0,1]},null,{ratings:[{group:'sba',org:'SBA',grade:'A'},{group:'lcv',org:'LCV',score:90}],questions:qs});
  assert.deepEqual([p.ab.a,p.ab.b],[3,1]);assert.equal(p.ab.ratings.length,1);assert.deepEqual(p.ab.ratingPoints,{a:3,b:0});
  assert.equal(p.clim.a,2.4);assert.equal(p.clim.s,null,'2.4 points is under the 3 a stance needs');
  assert.deepEqual(Object.keys(personStances(null,null)),[],'no ratings, no record: nothing');
});

test('the questions name only groups that are read, each once, with a side; overall groups are on no question',()=>{
  const seen=new Map();
  for(const q of QFILE.questions)for(const [g,side] of Object.entries(q.groups||{})){
    assert.ok(GR.groups[g],`${q.id}: ${g} is a known group`);assert.ok([0,1].includes(side),q.id);
    assert.notEqual(GR.groups[g].issue,'Overall',`${g} rates across topics`);seen.set(g,(seen.get(g)||0)+1);}
  for(const [g,n] of seen)assert.equal(n,1,`${g} counts on one question`);
  const side=(id,g)=>QFILE.questions.find(q=>q.id===id).groups[g];
  assert.equal(side('abortion','sba'),0);assert.equal(side('abortion','rfa'),1);assert.equal(side('gun-purchase-limits','goa'),1);assert.equal(side('climate-regulations','lcv'),0);
});

test('the net points beside a stance: + toward the liberal side, − toward the conservative side, no sign without one',()=>{
  const ab={sides:['Pro-life','Pro-choice'],liberal:1},yes={sides:['Yes','No'],liberal:0},isr={sides:['Yes','No'],liberal:null};
  assert.deepEqual(stanceNet({a:0,b:30.8},ab),{lead:1,net:31,sign:'+'},'Pro-choice is the liberal side');
  assert.deepEqual(stanceNet({a:95.5,b:0},ab),{lead:0,net:96,sign:'−'});
  assert.deepEqual(stanceNet({a:6,b:5},yes),{lead:0,net:1,sign:'+'});assert.deepEqual(stanceNet({a:2,b:12},yes),{lead:1,net:10,sign:'−'});
  assert.deepEqual(stanceNet({a:16,b:0},isr),{lead:0,net:16,sign:''});assert.equal(stanceNet({a:3,b:3},yes).sign,'','even');
});

test('repeats count once: a reintroduced bill (co)sponsored again, and votes on one bill family in one Congress',()=>{
  assert.equal(familyOf('117-hr-5','Equality Act of 2021'),familyOf('118-hr-15','Equality Act'));assert.equal(familyOf('118-s-5','Equality Act'),familyOf('118-hr-15','Equality Act'));
  assert.notEqual(familyOf('118-hr-15','Equality Act'),familyOf('118-hr-16','Fairness for All Act'));
  assert.equal(familyOf('113-hamdt-748','Amendment to cut funds'),'113-hamdt-748','an amendment is its own family');assert.equal(familyOf('117-hr-9',''),'117-hr-9');
  const titles={'116-hr-5':'Equality Act','117-hr-5':'Equality Act of 2021','118-hr-15':'Equality Act','117-s-393':'Equality Act','117-hjres-1':'Some resolution'};
  const family=id=>familyOf(id,titles[id]);
  const items=[{ref:'116-hr-5',kind:'c',date:'2019-03-01',side:0},{ref:'117-hr-5',kind:'c',date:'2021-02-01',side:0},{ref:'118-hr-15',kind:'s',date:'2023-06-01',side:0},
    {ref:'117-hr-5#H117-39',kind:'y',date:'2021-02-25',side:0},{ref:'117-s-393#S117-90',kind:'y',date:'2021-09-01',side:0},{ref:'118-hr-15#H118-5',kind:'y',date:'2023-07-01',side:0},
    {ref:'117-hjres-1#H117-2',kind:'n',date:'2021-03-01',side:1}];
  const c=creditItems(items,{family});
  assert.deepEqual(c.map(x=>x.ref).sort(),['117-hjres-1#H117-2','117-s-393#S117-90','118-hr-15'].sort(),
    'the (co)sponsorships are one, at the sponsorship; the 117th Congress votes on the House and Senate bills are one, the later; the 118th vote is on the sponsored bill');
  assert.equal(creditItems(items).length,5,'without families: one per bill, as before');
  const rows=recordRows(items.map(x=>[x.ref,x.kind,x.date,x.side]),Object.fromEntries(Object.entries(titles).map(([k,t])=>[k,[0,'why',t]])));
  const why=Object.fromEntries(rows.map(r=>[r.ref,r.repeat]));
  assert.equal(why['116-hr-5'],'reintroduced');assert.equal(why['117-hr-5#H117-39'],'congress');assert.equal(why['118-hr-15#H118-5'],'bill');assert.equal(why['118-hr-15'],null);
});
