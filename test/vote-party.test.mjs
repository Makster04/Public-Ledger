import test from 'node:test';
import assert from 'node:assert/strict';
import {voteArgs,savedVotes} from '../scripts/build-vote-party.mjs';
import {voteURL} from '../src/sources.mjs';

test('each saved vote maps to its official roll-call file',()=>{
  assert.deepEqual(voteArgs({id:'119-1-372'},'S'),{chamber:'S',congress:119,session:1,number:372});
  assert.deepEqual(voteArgs({id:'h-119-1-023',year:2025,roll:23},'H'),{chamber:'H',year:2025,number:23});
  assert.equal(voteArgs({id:'bad'},'S'),null);
  const v=savedVotes({votes:[{id:'119-1-372'}],hvotes:[{id:'h-119-1-023',year:2025,roll:23}]});
  assert.deepEqual(v.map(x=>voteURL(x.args)),['https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00372.xml','https://clerk.house.gov/evs/2025/roll023.xml']);
});
