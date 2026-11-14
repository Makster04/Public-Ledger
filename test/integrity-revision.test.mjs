// The five-part Integrity (retired Nov. 7, 2026; its parts feed the six scores): Get It Done inside Showing Up, and Conflicts of Interest.
import test from 'node:test';
import assert from 'node:assert/strict';
import {getItDoneComponent,showingUpPart,showingUpComponent,incomeConflicts,lobbyistOverlap,contractsForDonors,foreignAgentFlag,giftsTravel,conflictsComponent,integrityPreview,INTEGRITY_WEIGHTS} from '../public/integrity.js';
import {countBills,medians,advanced,partyOf} from '../scripts/build-get-it-done.mjs';

const r1=x=>Number(x.toFixed(1));

test('the five weights add to 100%',()=>{
  assert.deepEqual(INTEGRITY_WEIGHTS,{honesty:.20,personalFinances:.20,fundraising:.25,showingUp:.15,conflicts:.20});
  assert.equal(Number(Object.values(INTEGRITY_WEIGHTS).reduce((a,b)=>a+b,0).toFixed(6)),1);
});

test('Get It Done: bills advanced against the typical member of their party in their chamber',()=>{
  // Counting: bills and joint resolutions only; advanced by the latest action.
  const items=[{congress:119,type:'S',latestAction:{text:'Read twice and referred to the Committee on Finance.'}},{congress:119,type:'S',latestAction:{text:'Became Public Law No: 119-12.'}},
    {congress:119,type:'SRES',latestAction:{text:'Submitted in the Senate. Resolution agreed to'}},{congress:118,type:'SJRES',latestAction:{text:'Placed on Senate Legislative Calendar under General Orders.'}},
    {congress:118,type:'HR',latestAction:{text:'Received in the Senate and Read twice and referred to the Committee on Commerce.'}},{congress:117,type:'S',latestAction:{text:'Became Public Law'}}];
  assert.deepEqual(countBills(items,[118,119]),{118:{sponsored:2,advanced:2},119:{sponsored:2,advanced:1}},'resolutions and earlier Congresses left out; arriving in the other chamber is advanced');
  assert.ok(advanced('Committee on Armed Services. Ordered to be reported with an amendment favorably.'));assert.ok(!advanced('Committee on Finance. Hearings held.'));assert.ok(!advanced('Referred to the Subcommittee on Health.'));
  assert.equal(partyOf(328),'D','independents are compared with the party they caucus with');
  const m=medians([{congress:119,chamber:'S',party:'D',sponsored:10,advanced:1},{congress:119,chamber:'S',party:'D',sponsored:20,advanced:4},{congress:119,chamber:'S',party:'D',sponsored:4,advanced:4},{congress:119,chamber:'S',party:'R',sponsored:8,advanced:2}]);
  assert.deepEqual(m,{medians:{119:{S:{D:0.15,R:0.25}}},counted:{119:{S:{D:2,R:1}}}},'the median of members with at least 5 bills');
  // The score: twice the typical rate is capped at 100; a quarter of it is 25.
  const data={medians:{118:{S:{D:0.1}},119:{S:{D:0.1}}},people:{a:{congresses:{118:{chamber:'S',party:'D',sponsored:20,advanced:4},119:{chamber:'S',party:'D',sponsored:20,advanced:4}}},
    b:{congresses:{119:{chamber:'S',party:'D',sponsored:40,advanced:1}}},few:{congresses:{119:{chamber:'S',party:'D',sponsored:6,advanced:6}}}}};
  assert.equal(getItDoneComponent({id:'a'},data).value,100);assert.equal(getItDoneComponent({id:'b'},data).value,25);
  assert.equal(getItDoneComponent({id:'few'},data).complete,false,'fewer than 10 bills');assert.equal(getItDoneComponent({id:'zz'},data).complete,false);
  // Showing Up: 75% attendance, 25% Get It Done; attendance alone without it; nothing without attendance.
  const att={complete:true,value:90,years:[],excused:[]};
  assert.equal(showingUpPart(att,{complete:true,value:100}).value,92.5);assert.equal(showingUpPart(att,{complete:false}).value,90);
  assert.equal(showingUpPart({complete:false,value:null},{complete:true,value:100}).complete,false);
});

test('Conflicts of Interest: the worked example, and only reviewed matches count',()=>{
  const src={t:'Report',u:'https://efdsearch.senate.gov/search/view/annual/x/'};
  const inc=incomeConflicts({income:[{payer:'Acme Lobbying Client',amount:80000,interested:true,src},{payer:'Book publisher',amount:30000,interested:false}],positions:[{org:'Acme',interested:true}],agreements:[]});
  assert.equal(r1(inc.value),55.2);assert.equal(inc.money,80000,'a payer not matched as interested is left out');
  assert.equal(r1(lobbyistOverlap(15)),40.6);assert.equal(r1(contractsForDonors(3)),40.6);assert.equal(foreignAgentFlag(0),0);assert.equal(foreignAgentFlag(5),100);
  assert.equal(r1(giftsTravel({travel:[{sponsor:'Industry group',value:7000,interested:true},{sponsor:'Industry group',value:5000,interested:true}]}).value),52);
  const data={people:{x:{report:{year:2025,url:src.u},reviewed:{at:'2026-11-05',src},income:[{amount:80000,interested:true}],positions:[{interested:true}],agreements:[],
    lobbyistOverlap:{sharePct:15},contractsForDonors:{companies:3},foreignAgent:{filings:0},travel:[{value:7000,interested:true},{value:5000,interested:true}],gifts:[]}}};
  const c=conflictsComponent({id:'x'},data);
  assert.equal(c.complete,true);assert.equal(r1(c.outside),40.3);assert.equal(r1(c.gifts),52);assert.equal(r1(c.value),55);
  // Not reviewed: not graded. Nothing interested: 100.
  assert.equal(conflictsComponent({id:'x'},{people:{x:{...data.people.x,reviewed:null}}}).complete,false);
  assert.equal(conflictsComponent({id:'y'},{people:{y:{report:{year:2025},reviewed:{at:'2026-11-05'},income:[{amount:999999}],positions:[],agreements:[],gifts:[],travel:[]}}}).value,100);
  assert.match(conflictsComponent({id:'nobody'},{}).why,/No reviewed annual or candidate report/);
});

test('the Integrity preview carries all five parts',()=>{
  const attendance={days:{S:{'2025-06-01':500}},people:{a:{years:{2025:{votes:500,missed:10}},missed:{'2025-06-01':10},spans:[['S','2025-01-01','2025-12-31']]}}};
  const getItDone={medians:{119:{S:{D:0.1}}},people:{a:{congresses:{119:{chamber:'S',party:'D',sponsored:20,advanced:4}}}}};
  const p=integrityPreview({id:'a',statements:[]},{asOfYear:2026,attendance,getItDone,conflicts:{}});
  assert.equal(p.showingUp.attendance.value,90);assert.equal(p.showingUp.getItDone.value,100);assert.equal(p.showingUp.value,92.5);
  assert.equal(p.conflicts.complete,false);assert.ok(p.overall.missing.includes('conflicts'));
});

test('Shows Up leaves out delegates and the Resident Commissioner, who can\'t vote on most House roll calls',async()=>{
  const {showingUpComponent,NON_VOTING}=await import('../public/integrity.js');
  const attendance={people:{d:{years:{2025:{votes:900,missed:900}},spans:[],missed:{}}}};
  for(const st of ['DC','PR','GU','VI','AS','MP']){
    const r=showingUpComponent({id:'d',state:st,chamber:'H'},attendance);
    assert.equal(r.complete,false);assert.match(r.why,/delegates and the Resident Commissioner/);
  }
  assert.deepEqual([...NON_VOTING].sort(),['AS','DC','GU','MP','PR','VI']);
  assert.equal(showingUpComponent({id:'d',state:'NY',chamber:'H'},attendance).complete,true,'a voting member is still graded');
});
