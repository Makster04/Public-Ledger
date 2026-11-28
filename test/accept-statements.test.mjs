// Tagged statements go in with no one approving them (Nov. 28, 2026): each quote must be word for word in the member's
// saved speech (a "..." shortening only where every piece is there, in order), well formed, and the first for its
// question in that campaign; anything else stays out, with why.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {plain,quoteFound,acceptBatch,merge} from '../scripts/accept-statements.mjs';

const url='https://www.govinfo.gov/content/pkg/CREC-2026-11-10/html/x.htm';
const saved={statements:[{date:'2026-11-10',url,sentences:['It is my community, my neighbors and friends, who have been shipped off to fight a reckless war.','I take it personally.']}]};
const tag=(quote,extra={})=>[extra.side??1,quote,extra.date??'2026-11-10',extra.url??url,extra.where??'Floor speech, Congressional Record: X','high'];

test('the quote must be word for word in the speech with that date and link',()=>{
  assert.ok(quoteFound(saved,tag('who have been shipped off to fight a reckless war')));
  assert.ok(quoteFound(saved,tag('who have been shipped off to fight a reckless war'.replace("'",'’'))),'curly quotes read as plain ones');
  assert.ok(!quoteFound(saved,tag('who have been sent off to fight a reckless war')),'one word changed');
  assert.ok(!quoteFound(saved,tag('who have been shipped off to fight a reckless war',{date:'2026-11-11'})),'another day');
  assert.ok(!quoteFound(saved,tag('short')),'too short to be a quote');
  assert.equal(plain('A  “B” – c'),'a "b" - c');
});

test('a quote shortened with "..." counts only when every piece is there, in order',()=>{
  assert.ok(quoteFound(saved,tag('It is my community ... shipped off to fight a reckless war')));
  assert.ok(!quoteFound(saved,tag('shipped off to fight a reckless war ... It is my community')),'out of order');
  assert.ok(!quoteFound(saved,tag('It is my community ... shipped off to fight a just war')));
});

test('what moves in, and what stays out with why: unknown, not word for word, or a second tag for the same campaign',()=>{
  const coded={pat:{'war-with-iran':[[1,'earlier quote here, long enough','2026-03-01','https://x.gov/a','Floor speech, Congressional Record: Y']]}};
  const batch={people:{pat:{'war-with-iran':[tag('who have been shipped off to fight a reckless war')],'iran-deal':[tag('who have been shipped off to fight a reckless war')],'nope':[tag('who have been shipped off to fight a reckless war')]},
    sam:{'iran-deal':[tag('I take it personally when nothing happens')]},ghost:{'iran-deal':[tag('who have been shipped off to fight a reckless war')]}}};
  const r=acceptBatch(batch,coded,{savedOf:id=>id==='ghost'?null:saved,people:new Set(['pat','sam']),questions:new Set(['war-with-iran','iran-deal'])});
  assert.equal(r.moved,1);assert.deepEqual(Object.keys(r.add.pat),['iran-deal']);
  assert.deepEqual(r.add.pat['iran-deal'][0].length,5,'without the confidence');
  assert.deepEqual(r.left.map(x=>`${x.person} ${x.question}: ${x.why}`).sort(),['ghost iran-deal: not a person on the site','pat nope: not a question','pat war-with-iran: already tagged for the 2026 campaign','sam iran-deal: the quote isn\'t word for word in the speech']);
  merge(coded,r.add);assert.equal(coded.pat['iran-deal'].length,1);assert.equal(coded.pat['war-with-iran'].length,1);
});

test('the waiting batch went in automatically; npm run statements:accept',()=>{
  const b=JSON.parse(fs.readFileSync(new URL('../data/statement-batches/2026-11-25-record-all.json',import.meta.url),'utf8'));
  assert.match(b.status,/^accepted automatically 2026-11-28: 265 tags moved into data\/question-statements\.json$/);
  assert.equal(JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts['statements:accept'],'node scripts/accept-statements.mjs');
});
