import test from 'node:test';
import assert from 'node:assert/strict';
import {renderConsistency,renderStatementConsistency,loadConsistency,mountConsistency} from '../public/consistency.js';
import {getConsistency,selectConsistencyReport} from '../src/consistency.mjs';
import worker from '../src/worker.mjs';

const action=(category='consistent',extra={})=>({action:{id:'action:1',text:'Voted for the specified provision.',date:'2026-02-03',kind:'vote',sources:[{url:'https://example.org/vote',title:'Official roll call'}]},classification:category,status:'complete',review_status:'resolved',probabilities:{consistent:0.91,inconsistent:0.06,not_relevant:0.03},confidence:0.91,temporal_relation:'after',model:'test-model',model_version:'v1',rubric_version:'v1',classified_at:'2026-03-04',...extra});
const report={statement:{id:'statement:1',person_id:'bioguide:EX1',text:'I support this specified policy.',date:'2026-01-01',sources:[{url:'https://example.org/statement',title:'Statement'}]},counts:{consistent:1,inconsistent:1,not_relevant:1,review:1,context_only:1},percentage:50,coverage:{candidate_count:5,evaluated_count:4,resolved_relevant_count:2,resolved_relevant_fraction:0.4,total_action_count:20},narrative:'One evaluated action supports the statement and one conflicts.',actions:[action(),action('inconsistent'),action('not_relevant'),action('consistent',{review_status:'needs_review',review_reasons:['low_confidence']}),action('consistent',{temporal_relation:'before'})]};
const data={schema_version:1,generated_at:'2026-03-04',methodology:{version:'v1',rubric_version:'v1',min_resolved:1},provider:{api_key:'must-not-be-returned'},people:{example:{profile_id:'example',person_id:'bioguide:EX1',statements:[report]}}};

test('consistency renders scored, irrelevant, unresolved and earlier evidence with counts and sources',()=>{
  const html=renderConsistency(selectConsistencyReport(data,'example'));
  assert.match(html,/50%/);assert.match(html,/✓ 1 consistent/);assert.match(html,/✕ 1 inconsistent/);assert.match(html,/— 1 not relevant/);assert.match(html,/\? 1 need review/);
  assert.match(html,/context only/);assert.match(html,/Before statement/);assert.match(html,/Provisional classification: Consistent/);
  assert.match(html,/4 of 5 selected action candidates evaluated/);assert.match(html,/40% of selected candidates/);assert.match(html,/not every action/);
  assert.match(html,/href="https:\/\/example.org\/vote"/);assert.match(html,/Uncalibrated model-estimated category scores/);assert.match(html,/not calibrated probabilities/);assert.match(html,/91%/);assert.match(html,/separate from the reviewed Promises Delivered grade/);
});

test('insufficient and absent evidence never becomes a perfect or zero score',()=>{
  const html=renderStatementConsistency({...report,percentage:null,counts:{},actions:[],coverage:{candidate_count:0,evaluated_count:0,resolved_relevant_count:0},narrative:''});
  assert.match(html,/Insufficient evidence/);assert.doesNotMatch(html,/class="consistency-score">(?:0|100)%/);assert.match(html,/No related action candidates/);
  assert.match(renderConsistency({person:null}),/No saved consistency assessments/);
});

test('action roles retain actual vote position and candidate caps are disclosed',()=>{
  const html=renderStatementConsistency({...report,statement:{...report.statement,title:'Specific policy commitment'},coverage:{...report.coverage,retrieval_truncated:true,candidate_pool_count:30},actions:[action('inconsistent',{action:{...action().action,role:'On passage',position:'Nay'}})]});
  assert.match(html,/Specific policy commitment/);assert.match(html,/On passage · Position: <strong>Nay<\/strong>/);assert.match(html,/5 of 30 possible related actions/);
});

test('temporal scopes distinguish position agreement from future and retrospective commitments',()=>{
  const earlier=action('consistent',{temporal_relation:'before',included_in_percentage:true});
  let html=renderStatementConsistency({...report,statement:{...report.statement,temporal_scope:'position'},counts:{consistent:1},actions:[earlier]});
  assert.match(html,/Policy position · compares dated actions before and after/);assert.match(html,/Before statement/);assert.doesNotMatch(html,/Earlier actions provide context and do not enter|Outside the statement’s time scope/);
  html=renderStatementConsistency({...report,statement:{...report.statement,temporal_scope:'forward_commitment'},actions:[{...earlier,included_in_percentage:false}]});
  assert.match(html,/Forward commitment/);assert.match(html,/Outside the statement’s time scope · context only/);assert.match(html,/outside time scope/);
  html=renderStatementConsistency({...report,statement:{...report.statement,temporal_scope:'retrospective'},actions:[action('consistent',{temporal_relation:'after',included_in_percentage:false})]});
  assert.match(html,/Retrospective statement/);assert.match(html,/Outside the statement’s time scope · context only/);
});

test('source links and all evidence/metadata escape untrusted content',()=>{
  const bad='<img src=x onerror=alert(1)>';
  const html=renderStatementConsistency({...report,statement:{text:bad,date:bad,sources:[{url:'javascript:alert(1)',title:'Bad'}]},narrative:bad,actions:[action('consistent',{action:{text:bad,id:bad,sources:[{url:'data:text/html,x',title:bad},{url:'https://example.org/',title:bad}]},review_reasons:[bad],model:bad})]});
  assert.doesNotMatch(html,/<img|javascript:|data:text/);assert.match(html,/&lt;img/);assert.match(html,/noopener noreferrer/);
});

test('read-only API selects only requested profile without exposing provider config or calling model',async()=>{
  const calls=[];const env={ASSETS:{fetch:async request=>{calls.push(new URL(request.url).pathname);return Response.json(data);}}};
  const result=await getConsistency(env,'example','https://ledger.example');
  assert.equal(result.person.person_id,'bioguide:EX1');assert.equal(result.provider,undefined);assert.equal(result.people,undefined);
  assert.deepEqual(calls,['/consistency.json']);
  assert.equal((await getConsistency(env,'../../secret')).available,false);assert.equal(calls.length,1);
  const response=await worker.fetch(new Request('https://ledger.example/api/consistency?id=example'),env,{});
  assert.equal(response.status,200);assert.equal((await response.json()).person.profile_id,'example');
  const unsupported=await worker.fetch(new Request('https://ledger.example/api/consistency?id=example',{method:'POST'}),env,{});
  assert.equal(unsupported.status,404);assert.equal(calls.length,2);
});

test('report endpoint handles absent profiles/assets and rejects unknown report schemas',async()=>{
  assert.equal(selectConsistencyReport(data,'toString').person,null);
  assert.equal((await getConsistency({ASSETS:{fetch:async()=>new Response('',{status:404})}},'example')).available,false);
  assert.throws(()=>selectConsistencyReport({schema_version:2,people:{}},'example'),/Unsupported/);
});

test('frontend uses saved API first and static export fallback without POST requests',async()=>{
  const calls=[];
  let r=await loadConsistency('example',async(url,options)=>{calls.push([url,options]);return Response.json(selectConsistencyReport(data,'example'));});
  assert.equal(r.person.profile_id,'example');assert.equal(calls.length,1);
  calls.length=0;
  r=await loadConsistency('example',async(url,options)=>{calls.push([url,options]);return url.startsWith('/api/')?new Response('<html>static fallback</html>'):Response.json(data);});
  assert.equal(r.person.profile_id,'example');assert.equal(calls.length,2);assert.equal(calls[1][0],'/consistency.json');assert.ok(calls.every(([,options])=>!options.method));
});

test('stale navigation responses do not overwrite a new mount',async()=>{
  const host={isConnected:true,innerHTML:'',setAttribute(){},removeAttribute(){}};
  let resolve;const slow=new Promise(r=>{resolve=r;});
  const first=mountConsistency(host,'first',()=>slow);
  await mountConsistency(host,'example',async()=>Response.json(selectConsistencyReport(data,'example')));
  resolve(Response.json({schema_version:1,person:null}));await first;
  assert.match(host.innerHTML,/50%/);assert.doesNotMatch(host.innerHTML,/No saved consistency/);
});
