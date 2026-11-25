// The alignment and ideology questions (public/questions.json): their shape, so the pages and the scoring can rely on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import Q from '../public/questions.json' with {type:'json'};

test('17 categories, every question in one, no Trending',()=>{
  assert.deepEqual(Q.categories.map(c=>c.name),['Technology','National Security','Social','Governance','Environmental','Economic','Gun Policy','Healthcare','Infrastructure','Education','Electoral','Criminal','Foreign Policy','Immigration','Transportation','Science','Housing']);
  const cats=new Set(Q.categories.map(c=>c.id));
  for(const q of Q.questions)assert.ok(cats.has(q.cat),q.id);
  for(const c of Q.categories)assert.ok(Q.questions.some(q=>q.cat===c.id),`${c.name} has questions`);
});

test('each question: a unique id, its wording, two sides, a liberal side or none, a compass axis only with a liberal side',()=>{
  assert.equal(Q.questions.length,250);
  const ids=new Set();
  for(const q of Q.questions){
    assert.match(q.id,/^[a-z0-9]+(-[a-z0-9]+)*$/,q.id);assert.ok(!ids.has(q.id),`duplicate ${q.id}`);ids.add(q.id);
    assert.ok(q.q.length>15&&/\?$/.test(q.q),q.id);
    assert.ok(Array.isArray(q.sides)&&q.sides.length===2&&q.sides.every(s=>typeof s==='string'&&s.trim()),q.id);
    assert.ok([0,1,null].includes(q.liberal),q.id);
    assert.ok([null,'econ','auth'].includes(q.axis),q.id);
    if(q.axis)assert.ok([0,1].includes(q.axisSide),`${q.id}: an axis needs its side`);else assert.equal(q.axisSide,undefined,q.id);
    assert.ok(q.axisWeight===undefined||q.axisWeight===0.5,q.id);
    // (economic left is the liberal side wherever a question has one)
    if(q.axis==='econ'&&q.liberal!=null)assert.equal(q.axisSide,q.liberal,`${q.id}: economic left is its liberal side`);
  }
});

test('the questions we added for votes the quiz has no question for, and what was left out',()=>{
  assert.deepEqual(Q.questions.filter(q=>q.added).map(q=>q.id).sort(),['chips-industry','contraception','reject-electoral-votes','union-rights','war-powers']);
  assert.equal(Q.left_out.local.length,8);
  assert.ok(Q.questions.every(q=>!/\bcit(y|ies)\b.*\b(bike|congestion|relocate)\b/i.test(q.q)),'local questions are out');
  assert.match(Q.questions.find(q=>q.id==='usmca').q,/USMCA/,'NAFTA is now the USMCA');
  assert.match(Q.credit,/iSideWith/);
  // the two-sided questions keep their own sides
  const sides=id=>Q.questions.find(q=>q.id===id).sides;
  assert.deepEqual(sides('abortion'),['Pro-life','Pro-choice']);assert.deepEqual(sides('corporate-tax'),['Raise','Lower']);assert.deepEqual(sides('military-spending'),['Increase','Decrease']);
});

// My alignment's key questions (approved Nov. 25, 2026): the ten with the most coded bills and votes in a bigger category.
import {keyQuestions,KEY_PER_CATEGORY} from '../public/question-scores.js';
import fsK from 'node:fs';
test('each category\'s key questions: at most ten, the most coded first, ties in file order; small categories whole',()=>{
  const qs=[...Array(12)].map((_,i)=>({id:`a${i}`,cat:'a'})).concat([{id:'b0',cat:'b'},{id:'b1',cat:'b'}]);
  const coded={a11:50,a3:9,a5:9};
  const key=keyQuestions(qs,coded);
  assert.equal([...key].filter(x=>x.startsWith('a')).length,10);
  assert.ok(key.has('a11')&&key.has('a3')&&key.has('a5'),'the most coded');
  assert.ok(!key.has('a10')&&!key.has('a9'),'uncoded ties go by file order, so the last ones drop');
  assert.ok(key.has('b0')&&key.has('b1'),'a small category is all key');
  const S=JSON.parse(fsK.readFileSync(new URL('../public/question-stances.json',import.meta.url),'utf8'));
  const real=keyQuestions(Q.questions,S.coded);
  for(const c of Q.categories){const n=Q.questions.filter(q=>q.cat===c.id).length,k=Q.questions.filter(q=>q.cat===c.id&&real.has(q.id)).length;assert.equal(k,Math.min(n,KEY_PER_CATEGORY),c.id);}
});
