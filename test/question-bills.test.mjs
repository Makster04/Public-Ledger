// Candidate bills for the alignment questions (scripts/question-bills.mjs): how a bill is matched to a question's search.
import test from 'node:test';
import assert from 'node:assert/strict';
import {matches,candidates,phraseRe} from '../scripts/question-bills.mjs';

const bill=(id,o={})=>({id,c:118,n:Number(id.split('-')[2]),title:'',short:[],subjects:[],area:null,summary:null,cosponsors:[],votes:[],...o});
const MW={any:['minimum wage'],subjects:['Wages and earnings'],not:['minimum wage for tipped employees in Guam']};

test('a phrase in the title or a short title is enough; in the summary, only with one of the question\'s subjects',()=>{
  assert.ok(matches(bill('118-hr-1',{title:'Raise the Wage Act',short:['Raise the Minimum Wage Act']}),MW));
  assert.ok(matches(bill('118-hr-2',{title:'A bill on wages',summary:'This bill increases the federal minimum wage.',subjects:['Wages and earnings']}),MW));
  assert.ok(!matches(bill('118-hr-3',{title:'Omnibus',summary:'Section 9 adjusts the minimum wage.',subjects:['Appropriations']}),MW),'in the summary of an unrelated bill: no');
  assert.ok(matches(bill('118-hr-4',{title:'A bill',summary:'Raises the minimum-wage floor.',area:'Wages and earnings'}),MW),'policy area counts as a subject; hyphens and spaces alike');
  assert.ok(!matches(bill('118-hr-5',{title:'Minimum wage for tipped employees in Guam'}),MW),'ruled out by "not"');
  assert.ok(matches(bill('118-hr-6',{summary:'Sets a minimum wage.'}),{any:['minimum wage']}),'no subjects listed: the summary alone is enough');
});

test('phrases match whole words',()=>{
  assert.ok(phraseRe('ICE').test('abolish ice now'));assert.ok(!phraseRe('ice').test('lower drug prices'));
  assert.ok(phraseRe('right to work').test('national right-to-work act'));
});

test('candidates: became law first, then recorded votes, then cosponsors; already-coded ones marked',()=>{
  const list=candidates([
    bill('118-hr-7',{title:'Minimum wage study',cosponsors:[{id:'A'},{id:'B'}]}),
    bill('118-hr-8',{title:'Raise the minimum wage',votes:[{ch:'H',roll:1}]}),
    bill('118-hr-9',{title:'Minimum wage act',law:true}),
    bill('118-hr-10',{title:'Unrelated'})],MW,{'118-hr-8':[0,'Raises it to $17.']});
  assert.deepEqual(list.map(c=>c.id),['118-hr-9','118-hr-8','118-hr-7']);
  assert.deepEqual(list[1].coded,[0,'Raises it to $17.']);assert.equal(list[0].law,true);assert.equal(list[2].cosponsors,2);
});

import {decidesBill,castSide,billItems,billRollcalls,voteviewBill,voteKey,isAmendment,amendmentRollcalls} from '../scripts/build-question-record.mjs';
test('the votes that decide a bill count; procedure doesn\'t',()=>{
  for(const q of ['On Passage','On Motion to Suspend the Rules and Pass, as Amended','On the Cloture Motion','On Agreeing to the Conference Report','On Motion to Concur in the Senate Amendment','On the Joint Resolution','On Overriding the Veto','Passage, Objections of the President Notwithstanding','On the Motion to Proceed','On Agreeing to the Resolution'])assert.ok(decidesBill(q),q);
  for(const q of ['On Motion to Recommit with Instructions','On Agreeing to the Amendment','On Ordering the Previous Question','On Motion to Table','On the Motion to Table the Motion to Reconsider','Election of the Speaker','',null])assert.ok(!decidesBill(q),String(q));
});
test('a Yea takes the bill\'s side, a Nay the other, anything else nothing; sponsors and cosponsors (not withdrawn) take the bill\'s side',()=>{
  assert.equal(castSide(1,0),0);assert.equal(castSide(6,0),1);assert.equal(castSide(6,1),0);for(const c of [2,3,4,5,7,8,9,0])assert.equal(castSide(c,0),null);
  const items=billItems({intro:'2019-01-16',sponsor:{id:'S000522'},cosponsors:[{id:'A1',date:'2019-01-16'},{id:'B2',date:'2019-02-01',out:'2019-03-01'}]},0);
  assert.deepEqual(items,[{id:'S000522',kind:'s',date:'2019-01-16',side:0},{id:'A1',kind:'c',date:'2019-01-16',side:0}]);
  assert.deepEqual(billItems({intro:'2019-02-25',sponsor:{id:'M000355'},cosponsors:[]},0,{sponsor:false}),[],'a sponsor who brought it up only to vote it down');
});

test('a bill\'s roll calls: from its own actions and from Voteview\'s bill_number, each once',()=>{
  const r1={rollnumber:590,clerk_rollnumber:'143',session:'2'},r2={rollnumber:619,clerk_rollnumber:'172',session:'2'},r3={rollnumber:40,clerk_rollnumber:'40',session:'2'};
  const vv={H117:{roll:new Map([['2-143',r1],['2-172',r2]]),byBill:new Map([['HRES1096',[r2]]])},S117:{roll:new Map(),byBill:new Map([['HRES1096',[r3]]])}};
  const bill={c:117,t:'hres',n:1096,votes:[{ch:'H',c:117,session:2,roll:143},{ch:'H',c:117,session:2,roll:999}]};
  assert.equal(voteviewBill(bill),'HRES1096');
  assert.deepEqual(billRollcalls(bill,vv).map(x=>`${x.k}-${x.r.rollnumber}`),['H117-590','H117-619','S117-40']);
  assert.deepEqual(billRollcalls({c:118,t:'hr',n:1,votes:[]},vv),[],'a Congress not loaded: nothing');
  assert.deepEqual(billRollcalls(bill,vv,['H117-619']).map(x=>x.r.rollnumber),[619],'only the roll calls named for a reused bill number');
});

test('a roll call coded on its own: "vote:" then chamber, Congress and Voteview roll number',()=>{
  assert.deepEqual(voteKey('vote:H117-9'),{k:'H117',roll:9});assert.deepEqual(voteKey('vote:S117-2'),{k:'S117',roll:2});
  for(const x of ['117-hr-1','vote:X117-9','vote:H117','H117-9'])assert.equal(voteKey(x),null,x);
});

test('an amendment\'s roll calls: only those whose direction is known, each once, matched by session and clerk number',()=>{
  const r1={rollnumber:258,clerk_rollnumber:'258',session:'2'},r2={rollnumber:300,clerk_rollnumber:'42',session:'1'};
  const vv={H113:{roll:new Map([['2-258',r1],['1-42',r2]])}};
  const a={votes:[{ch:'H',c:113,session:2,roll:258,yea:true},{ch:'H',c:113,session:2,roll:258,yea:true},{ch:'H',c:113,session:1,roll:42,yea:false},{ch:'H',c:113,session:1,roll:43,yea:null},{ch:'S',c:113,session:1,roll:7,yea:true}]};
  assert.deepEqual(amendmentRollcalls(a,vv).map(x=>[x.k,x.r.rollnumber,x.yea]),[['H113',258,true],['H113',300,false]]);
  assert.deepEqual(amendmentRollcalls(a,vv,['H113-300']).map(x=>x.r.rollnumber),[300]);
  assert.ok(isAmendment('113-hamdt-748'));assert.ok(isAmendment('114-samdt-2910'));for(const x of ['113-hr-748','vote:H113-1','113-amdt-1'])assert.ok(!isAmendment(x),x);
});

import fs from 'node:fs';
test('the coded bills file: every question exists, every entry is [side, why, optional {votes}] on a real bill or roll call id',()=>{
  const B=JSON.parse(fs.readFileSync(new URL('../data/question-bills.json',import.meta.url),'utf8'));
  const S=JSON.parse(fs.readFileSync(new URL('../data/question-search.json',import.meta.url),'utf8'));
  const Q=JSON.parse(fs.readFileSync(new URL('../public/questions.json',import.meta.url),'utf8'));
  const ids=new Set(Q.questions.map(q=>q.id));
  assert.equal(typeof B.about,'string');
  for(const [q,list] of Object.entries(B)){if(q==='about')continue;
    assert.ok(ids.has(q),`unknown question ${q}`);assert.ok(S[q],`${q} has a search`);
    for(const [id,v] of Object.entries(list)){
      assert.ok(/^\d{3}-(hr|s|hjres|sjres|hconres|sconres|hres|sres|hamdt|samdt)-\d+$/.test(id)||voteKey(id),`${q}: bad id ${id}`);
      assert.ok(Array.isArray(v)&&(v.length===2||v.length===3),`${q} ${id}`);
      assert.ok(v[0]===0||v[0]===1,`${q} ${id}: side`);assert.ok(typeof v[1]==='string'&&v[1].length>10,`${q} ${id}: why`);
      if(v.length===3){const o=v[2];assert.ok(o&&typeof o==='object'&&Object.keys(o).length&&Object.keys(o).every(k=>['votes','sponsor'].includes(k)),`${q} ${id}: options`);
        if('votes' in o){assert.ok(Array.isArray(o.votes),`${q} ${id}: votes`);for(const r of o.votes)assert.match(r,/^[HS]\d+-\d+$/,`${q} ${id}`);}
        if('sponsor' in o)assert.equal(o.sponsor,false,`${q} ${id}: sponsor`);}
    }}
  for(const [q,s] of Object.entries(S)){if(q==='about')continue;assert.ok(ids.has(q),`search for unknown question ${q}`);assert.ok(Array.isArray(s.any)&&s.any.length,q);}
});
