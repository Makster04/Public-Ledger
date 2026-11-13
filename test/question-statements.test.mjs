// What politicians said, tagged to the alignment questions (scripts/question-statements.mjs), and how it counts
// (public/question-scores.js personStances).
import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignDocs,statementCandidates,checkStatements} from '../scripts/question-statements.mjs';
import {personStances,taggedStatements} from '../public/question-scores.js';
import CODED from '../data/question-statements.json' with {type:'json'};
import Q from '../public/questions.json' with {type:'json'};
import R from '../public/research.json' with {type:'json'};

test('candidates: sentences naming a question\'s phrases, once per wording, with every page they were on, newest first',()=>{
  const c={campaigns:[
    {year:2020,pages:[{url:'https://w/1',date:'2020-10-01',title:'Issues',text:'Home\nI will fight to raise the minimum wage to $15. We love our state.'}],posts:[]},
    {year:2026,pages:[{url:'https://w/2',date:'2026-10-01',title:'Issues',text:'I will fight to raise the minimum wage to $15.  The ICE cream social is Friday at noon downtown.'}],
      posts:[{date:'2026-09-01',source:'bluesky',url:'https://b/1',text:'Ban assault weapons now, before another school is attacked.'}]}]};
  const docs=campaignDocs(c);assert.equal(docs.length,3);assert.match(docs[2].where,/Bluesky post, 2026 campaign/);
  const out=statementCandidates(docs,{'minimum-wage':{any:['minimum wage']},'assault-weapons':{any:['assault weapons']},'abolish-ice':{any:['ice'],not:['ice cream']}});
  assert.equal(out.length,2,'one per wording; "ICE cream" is ruled out');
  const w=out.find(x=>x.questions.includes('minimum-wage'));assert.deepEqual(w.seen.map(s=>s.date),['2026-10-01','2020-10-01']);
});

test('the tags are checked: a known person and question, a side, a quote, a date, a link, one per question per campaign',()=>{
  const people=new Set(['a']),questions=[{id:'minimum-wage'}];
  const ok=checkStatements({a:{'minimum-wage':[[0,'I will raise the minimum wage.','2020-10-01','https://w/1','Campaign website, 2020'],[0,'Raise the wage, I say again.','2026-10-01','https://w/2','Campaign website, 2026']]}},{people,questions});
  assert.deepEqual(ok.problems,[]);assert.deepEqual(ok.out.a['minimum-wage'].map(x=>x[1]),['2026-10-01','2020-10-01'],'newest first');
  const bad=checkStatements({b:{},a:{nope:[],'minimum-wage':[[2,'short','2020','x','Campaign website, 2020'],[0,'I will raise the minimum wage.','2020-10-01','https://w/1','Campaign website, 2020: Jobs'],[0,'I will raise the minimum wage again.','2020-11-01','https://w/3','Bluesky post, 2020 campaign']]}},{people,questions});
  assert.equal(bad.problems.length,8,"an unknown person and question, a bad side, quote, date and link, and two more from the 2020 campaign");
});

test('a tagged statement counts toward its side (1 beside a record), falls under the contradiction rule, and counts once beside a carried-over copy',()=>{
  const said={'minimum-wage':[[0,'2026-10-01','I will raise the minimum wage.','https://w/2','Campaign website, 2026']],abortion:[[1,'2020-10-01','I support the right to choose.','https://w/1','Campaign website, 2020']]};
  const t=taggedStatements(said);assert.equal(t.abortion[0].src.t,'The saved campaign page');assert.equal(t.abortion[0].why,'"I support the right to choose."');
  // a 2022 vote toward Pro-life after the 2020 statement cancels it; the carried-over statement with the same link counts once
  const p=personStances({abortion:[0,1,'2022-03-01','2022-03-01','',''],'minimum-wage':[1,0,'2019-01-01','2019-01-01','','']},
    {abortion:[{type:'stated',side:'A',date:'2020-10-01',title:'Same page',src:{u:'https://w/1'}}]},{said});
  assert.equal(p.abortion.statements.length,1);assert.equal(p.abortion.statements[0].status,'cancelled');assert.deepEqual([p.abortion.a,p.abortion.b],[0,1]);
  assert.equal(p['minimum-wage'].statements[0].status,'counted');assert.equal(p['minimum-wage'].a,2,'1 point beside a vote');
});

test('the coded statements on file pass the checks',()=>{
  const people=new Set([...R.members,...(R.cands||[]),...(R.featured||[])].map(p=>p.id));
  assert.deepEqual(checkStatements(CODED,{people,questions:Q.questions}).problems,[]);
});
