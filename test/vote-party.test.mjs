import test from 'node:test';
import assert from 'node:assert/strict';
import {voteArgs,savedVotes,csvRows,resultCounts,totalsAgree,voteviewParty} from '../scripts/build-vote-party.mjs';
import {voteURL} from '../src/sources.mjs';

test('each saved vote maps to its official roll-call file',()=>{
  assert.deepEqual(voteArgs({id:'119-1-372'},'S'),{chamber:'S',congress:119,session:1,number:372});
  assert.deepEqual(voteArgs({id:'h-119-1-023',year:2025,roll:23},'H'),{chamber:'H',year:2025,number:23});
  assert.equal(voteArgs({id:'bad'},'S'),null);
  const v=savedVotes({votes:[{id:'119-1-372'}],hvotes:[{id:'h-119-1-023',year:2025,roll:23}]});
  assert.deepEqual(v.map(x=>voteURL(x.args)),['https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00372.xml','https://clerk.house.gov/evs/2025/roll023.xml']);
});

test('CSV rows are read by their header, with quoted commas and quotes',()=>{
  const rows=csvRows('congress,chamber,bioname,party_code\r\n119,Senate,"SMITH, Pat ""PJ""",100\n119,Senate,LEE,200\n');
  assert.deepEqual(rows,[{congress:'119',chamber:'Senate',bioname:'SMITH, Pat "PJ"',party_code:'100'},{congress:'119',chamber:'Senate',bioname:'LEE',party_code:'200'}]);
});

test('a saved result\'s yeas and nays check the party totals, allowing one for the Vice President',()=>{
  assert.deepEqual(resultCounts('Not sustained, 6-93'),{yea:6,nay:93});
  assert.equal(resultCounts('Agreed to by voice vote'),null);
  const t={R:{Yea:50},D:{Nay:47},I:{Nay:2,'Not Voting':1}};
  assert.equal(totalsAgree(t,'Passed 50-49'),true);
  assert.equal(totalsAgree(t,'Passed 51-49 (VP tie-break)'),true);
  assert.equal(totalsAgree(t,'Rejected 49-50'),false);
  assert.equal(totalsAgree(t,'Agreed to by voice vote'),true,'nothing to check against');
});

test('Voteview rows give party totals by the official session and roll number, and a mismatch is left out',()=>{
  // Made-up rows in Voteview's layout. Voteview numbers a Congress's votes straight through, so its roll number 401 is
  // the official second-session vote 5.
  const rollcalls=[{congress:'119',chamber:'Senate',rollnumber:'401',date:'2026-01-08',session:'2',clerk_rollnumber:'5'},
    {congress:'119',chamber:'Senate',rollnumber:'402',date:'2026-01-09',session:'2',clerk_rollnumber:'6'}];
  const members=[[1,200],[2,200],[3,100],[4,328],[5,100]].map(([icpsr,party_code])=>({congress:'119',chamber:'Senate',icpsr:String(icpsr),party_code:String(party_code)}))
    .concat({congress:'119',chamber:'President',icpsr:'99',party_code:'200'});
  const cast=(roll,codes)=>codes.map((c,i)=>({congress:'119',chamber:'Senate',rollnumber:String(roll),icpsr:String(i+1),cast_code:String(c)}));
  const votes=[...cast(401,[1,1,6,6,9]),...cast(402,[1,6,6,6,3])];
  const w=(id,o={})=>({id,date:null,result:'',args:voteArgs({id},'S'),...o});
  const out=voteviewParty({rollcalls,members,votes},[w('119-2-5',{date:'2026-01-08',result:'Agreed to 2-2'}),w('119-2-6',{result:'Passed 3-1'}),w('119-2-7'),w('119-2-5b')].filter(x=>x.args));
  assert.deepEqual(out.votes,{'119-2-5':{R:{Yea:2},D:{Nay:1,'Not Voting':1},I:{Nay:1}}});
  assert.match(out.problems['119-2-6'],/don't match/,'the saved result says 3-1, Voteview has 1-3');
  assert.equal(out.problems['119-2-7'],'not in Voteview yet');
  const late=voteviewParty({rollcalls,members,votes},[w('119-2-5',{date:'2026-02-20'})]);
  assert.match(late.problems['119-2-5'],/dates it/,'a different day means a different vote');
});
