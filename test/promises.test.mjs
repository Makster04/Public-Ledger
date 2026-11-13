// Keeps Their Word: which statements are promises, how each is judged against what they did afterward
// (scripts/build-promises.mjs), and how the grade counts them (public/grades.js promiseScore).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {promiseWords,fullSentence,officeWindow,judge,buildPromises,addMonths,activityIndex,chamberOfRef,GRACE_MONTHS,STATUSES} from '../scripts/build-promises.mjs';
import {promiseScore,promiseStatus,PROMISE_WEIGHT} from '../public/grades.js';

const read=f=>JSON.parse(fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8'));
const today='2026-11-13';
// An action: [question, bill, kind, date, side].
const act=(date,side,bill='119-s-1',kind='c',q='minimum-wage')=>[q,bill,kind,date,side];
const promise={date:'2020-11-03',qs:[['minimum-wage',0]]};
const office={from:'2021-01-03',to:today,current:true,chamber:'S'};

test('promise wording: "I will", "I\'ll", "I support", the campaign about them; not their record or others',()=>{
  for(const t of ['I will support the Equality Act.','I’ll vote to crack down on price gouging by drug companies.','I support a ban on the sale of semi-automatic rifles.',
    'He will support an increase in the federal minimum wage.','Jon will defend Planned Parenthood in Congress.','We will cancel student debt.','I want to end the blanket tariffs.'])
    assert.ok(promiseWords(t,['Ossoff','Jon']),t);
  for(const t of ['Congressman Marshall also supported a food stamp work requirement.','I supported efforts in Congress to block taxpayer funding.',
    'The President should pause these operations.','Sen. Ossoff tried to ban Senators from trading stocks.','He has consistently delivered for Georgia.'])
    assert.equal(promiseWords(t,['Marshall','Ossoff','Jon']),null,t);
  assert.equal(promiseWords('Jon will oppose legislation that undermines strong encryption.',['Jon']).reactive,true,'a promise to oppose');
  assert.equal(promiseWords('I stand with America’s Police and pledge to oppose any bill to defund them.',[]).reactive,true);
  assert.equal(promiseWords('I will work to reverse the militarization of local police forces.',[]).reactive,false);
});

test('a short quote is read in its full sentence, which has to make the promise',()=>{
  const docs=[{text:'In the Senate, I will fight for reform. I will work to reverse the militarization of local police forces, ban private prisons, and legalize cannabis.'}];
  assert.equal(fullSentence('legalize cannabis',docs),'I will work to reverse the militarization of local police forces, ban private prisons, and legalize cannabis.');
  assert.equal(fullSentence('I will fight for reform. And more words to make this a long enough quote',docs),null,'a full sentence is its own');
  assert.equal(fullSentence('repeal the estate tax',docs),null);
});

test('verdicts: kept, broken, a reversal, unclear when actions go both ways; earlier actions are background',()=>{
  assert.equal(judge(promise,[act('2021-02-01',0),act('2023-05-01',0,'118-s-2')],office,{today}).status,'kept');
  assert.equal(judge(promise,[act('2021-02-01',1)],office,{today}).status,'broken');
  const before=judge(promise,[act('2019-01-01',1),act('2021-02-01',0)],office,{today});
  assert.deepEqual([before.status,before.before.length,before.acts.length],['kept',1,1],'an action before the promise is background');
  const rev=judge(promise,[act('2021-02-01',0),act('2024-03-01',1,'118-s-9'),act('2025-03-01',1,'119-s-9')],office,{today});
  assert.deepEqual([rev.status,rev.rule],['broken','reversal']);
  assert.deepEqual(Object.values((({status,rule})=>({status,rule}))(judge(promise,[act('2021-02-01',0),act('2024-03-01',1,'118-s-9')],office,{today}))),['unclear','mixed'],'one bill against is for a reviewer');
  assert.equal(judge(promise,[act('2021-02-01',1),act('2024-03-01',0,'118-s-9'),act('2025-03-01',1,'119-s-9')],office,{today}).status,'unclear','against, then for, then against: not a clean reversal');
  // A cosponsorship and a vote on the same bill count once.
  const one=judge(promise,[act('2021-02-01',0,'117-s-53','c'),act('2021-03-05',0,'117-s-53#S117-74','y')],office,{today});
  assert.deepEqual([one.forN,one.acts.length],[1,2]);
});

test('no action: broken after 6 months in office; within them "no action yet"; candidates and promises to oppose are not tested',()=>{
  assert.equal(GRACE_MONTHS,6);
  const none=judge(promise,[],office,{today,activity:()=>12});
  assert.deepEqual([none.status,none.rule],['broken','no-action']);assert.match(none.why,/other members of the Senate acted on it 12 times/);
  // Nobody else in their chamber acted on it either: the records may have no bill on it then, so a reviewer decides.
  const quiet=judge(promise,[],office,{today,activity:()=>0});
  assert.deepEqual([quiet.status,quiet.rule],['unclear','no-record']);
  const fresh=judge({date:'2026-08-01',qs:promise.qs},[],office,{today});
  assert.deepEqual([fresh.status,fresh.deadline],['no-action','2027-02-01']);
  assert.equal(judge({...promise,date:'2026-10-01'},[],{from:null,to:null,current:false,takes:true},{today}).status,'not-tested','a member-elect');
  // A 2026 winner who served before is still checked on promises made while they served.
  assert.equal(judge({...promise,date:'2021-02-01'},[],{from:'2007-01-03',to:'2024-12-20',current:false,takes:true,chamber:'S'},{today,activity:()=>3}).status,'broken');
  assert.match(judge({...promise,date:'2026-02-01'},[],{from:'2007-01-03',to:'2024-12-20',current:false,takes:true},{today}).why,/Won in 2026/);
  assert.equal(judge(promise,[],{from:null,to:null,current:false},{today}).status,'not-tested','never in Congress');
  assert.equal(judge({...promise,date:'2026-05-01'},[],{from:'2019-01-03',to:'2025-01-03',current:false},{today}).status,'not-tested','made after leaving');
  assert.equal(judge({...promise,reactive:true},[],office,{today}).rule,'nothing-to-oppose');
  // The clock starts when they take office, for a promise made as a candidate.
  assert.equal(judge({...promise,date:'2024-11-01'},[],{from:'2025-01-03',to:'2025-05-01',current:true},{today:'2025-05-01'}).status,'no-action');
  assert.equal(addMonths('2025-08-31',6),'2026-02-28');
});

test('a reviewer settles a promise: first step, compromise, or any other verdict, with the reason shown',()=>{
  const r=judge(promise,[act('2021-02-01',0),act('2024-03-01',1,'118-s-9')],office,{today,review:{status:'step',why:'Voted for $12, not $15.',date:'2026-11-13'}});
  assert.deepEqual([r.status,r.rule,r.why],['step','reviewed','Voted for $12, not $15.']);
});

test('office window: sitting members from the directory, former members from their record, members-elect from January',()=>{
  const ev={q:[['119-s-1','c','2019-04-01',0],['119-hr-2#S119-5','y','2024-06-01',0]]};
  assert.deepEqual(officeWindow({bioguide:'X'},{dirs:new Map([['X',{since:'2021-01-03',chamber:'S'}]]),evidence:ev,today}),{from:'2019-04-01',to:today,current:true,chamber:'S'});
  assert.deepEqual(officeWindow({bioguide:'Y'},{dirs:new Map(),evidence:ev,today}),{from:'2019-04-01',to:'2024-06-01',current:false,chamber:'S'});
  assert.equal(officeWindow({},{dirs:new Map(),evidence:{},elect:true,today}).takes,true);
  assert.deepEqual(['117-s-53','117-samdt-972','117-hr-5376#S117-853','117-hr-5376','118-hres-9#H118-4','119-sjres-1'].map(chamberOfRef),['S','S','S','H','H','S']);
  const act=activityIndex({A:{q:[['119-s-1','c','2025-02-01',0],['119-hr-1','c','2025-03-01',0]]},B:{q:[['119-s-2','c','2025-04-01',1]]}});
  assert.deepEqual([act(['q'],'S','2025-01-01','2026-01-01'),act(['q'],'S','2025-01-01','2026-01-01','A'),act(['q'],'H','2025-01-01','2026-01-01'),act(['q'],'S','2025-03-15','2026-01-01')],[2,1,1,1]);
});

test('the grade: kept 1, first step 3/4, compromise 1/2, broken 0; waiting promises aren\'t counted; a passed deadline is broken',()=>{
  assert.deepEqual(PROMISE_WEIGHT,{kept:1,step:0.75,compromise:0.5,broken:0});
  const P=(status,extra={})=>({status,qs:[['q',0]],...extra});
  const s=promiseScore([],[],[P('kept'),P('kept'),P('step'),P('compromise'),P('broken'),P('unclear'),P('not-tested'),P('no-action',{deadline:'2027-01-01'})],today);
  assert.deepEqual([s.kept,s.step,s.compromise,s.broken,s.clear,s.open,s.pct],[2,1,1,1,5,3,Math.round((2+0.75+0.5)/5*100)]);
  assert.equal(promiseStatus(P('no-action',{deadline:'2026-11-01'}),today),'broken');
  assert.equal(promiseStatus(P('no-action',{deadline:'2027-11-01'}),today),'no-action');
  // A promise on the question of a reviewed stock-trading pledge is left to the reviewed check.
  const dup=promiseScore([{assessment:'unclear',pledge:{kind:'stock-trading'}}],[],[{status:'broken',qs:[['congress-stock-trading',1]]}],today);
  assert.equal(dup.broken,0);
});

test('public/promises.json: every promise has a known status, a reason, a dated source and its questions',()=>{
  const P=read('public/promises.json'),Q=new Set(read('public/questions.json').questions.map(q=>q.id));
  const R=read('public/research.json'),ids=new Set([...R.members,...R.cands,...(R.featured||[])].map(p=>p.id));
  assert.equal(P.graceMonths,GRACE_MONTHS);
  for(const [id,list] of Object.entries(P.people)){
    assert.ok(ids.has(id),`${id} has a profile`);
    for(const p of list){
      assert.ok(STATUSES.includes(p.status),`${id} ${p.key}: ${p.status}`);
      assert.ok(p.why&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&p.quote&&p.where,`${id} ${p.key}`);
      for(const [q,side] of p.qs)assert.ok(Q.has(q)&&(side===0||side===1),`${id} ${p.key}: ${q}`);
      if(p.status==='no-action')assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(p.deadline),`${id} ${p.key}: a deadline`);
      for(const a of p.acts)assert.ok(a[3]>p.date,`${id} ${p.key}: actions after the promise`);
    }
  }
  const reviews=read('data/promise-reviews.json').people;
  for(const [id,r] of Object.entries(reviews))for(const [key,v] of Object.entries(r)){
    assert.ok([...STATUSES,'not-a-promise','promise'].includes(v.status)&&v.why,`${id} ${key}`);
    if(!['not-a-promise'].includes(v.status))assert.ok(P.people[id]?.some(p=>p.key===key),`${id} ${key} matches a promise`);
  }
});

test('buildPromises: one promise per quote and date, tagged to several questions; not-a-promise reviews leave it out',()=>{
  const statements={x:{'minimum-wage':[[0,'I will raise the minimum wage.','2020-11-03','u','Campaign website, 2020']],'paid-leave':[[0,'I will raise the minimum wage.','2020-11-03','u','Campaign website, 2020'],[0,'He has fought for paid leave.','2020-11-03','u','Campaign website, 2020']],
    'tariffs':[[1,'I will end the tariffs.','2020-11-03','u','Campaign website, 2020']]}};
  const out=buildPromises({statements,people:[{id:'x',name:'Pat X',short:'X',bioguide:'B1'}],dirs:new Map([['B1',{since:'2021-01-03',chamber:'S'}]]),today,
    evidence:()=>({'minimum-wage':[['117-s-53','c','2021-01-26',0]]}),campaign:()=>null,elect:()=>null,reviews:{x:{'tariffs@2020-11-03':{status:'not-a-promise',why:'x'}}}});
  const l=out.people.x;
  assert.equal(l.length,1);assert.deepEqual(l[0].qs,[['minimum-wage',0],['paid-leave',0]]);assert.equal(l[0].status,'kept');assert.equal(l[0].kind,'campaign');
});
