// Keeps Their Word with no one reviewing (Nov. 28, 2026): a sure item takes the promise finder's draft verdict; the rest
// wait in the queue, not counted; npm start runs the finder, the automatic verdicts and the rebuild once a week.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {autoVerdict} from '../scripts/review-promises.mjs';

const item=(o={})=>({confidence:'high',debate:false,draft:{assessment:'consistent',why:'Voted for it'},...o});

test('a sure item takes the draft verdict; anything less sure waits, not counted',()=>{
  assert.equal(autoVerdict(item()),'consistent');
  assert.equal(autoVerdict(item({draft:{assessment:'contradiction'}})),'contradiction');
  assert.equal(autoVerdict(item({confidence:'medium'})),null);
  assert.equal(autoVerdict(item({debate:true})),null,'said in debate: shown, not scored');
  assert.equal(autoVerdict(item({draft:{assessment:'pending'}})),null,'no vote on it yet');
  assert.equal(autoVerdict(item({draft:{assessment:'unclear'}})),null);
  assert.equal(autoVerdict(null),null);
});

test('npm start runs the finder, the automatic verdicts and the rebuild once a week',()=>{
  const local=fs.readFileSync(new URL('../scripts/local.mjs',import.meta.url),'utf8'),rev=fs.readFileSync(new URL('../scripts/review-promises.mjs',import.meta.url),'utf8');
  assert.ok(local.includes("const find=await runScript([path.join(root,'scripts','find-promises.mjs')],2*60*60_000);"));
  assert.ok(local.includes("const review=await runScript([path.join(root,'scripts','review-promises.mjs'),'--auto'],10*60_000);"));
  assert.ok(local.includes("const build=await runScript([path.join(root,'scripts','build-promises.mjs')],15*60_000);"));
  assert.ok(local.includes('/864e5<7)return;')&&local.includes('setTimeout(updatePromises,20*60_000);'));
  assert.ok(rev.includes("decisions[item.id]={decision:v,at:today,auto:true};")&&rev.includes('st.found.auto=true;'),'marked as decided automatically');
});
