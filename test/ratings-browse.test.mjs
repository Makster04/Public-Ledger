// The browser probe for the groups whose scorecards are drawn by their pages' scripts (scripts/ratings-browse.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {PAGES,blocked,isData,redact,shapeOf} from '../scripts/ratings-browse.mjs';
import {probedGroups} from '../scripts/collect-ratings.mjs';

test('it opens the groups whose readers are still to be written, and only those',()=>{
  const g=probedGroups();
  for(const p of PAGES)assert.equal(g[p.key]?.status,'to-build',p.key);
  assert.deepEqual(PAGES.map(p=>p.key).sort(),Object.entries(g).filter(([,x])=>x.status==='to-build').map(([k])=>k).sort());
});

test('a bot check is told from what the page shows; data answers are told from pictures, styles and scripts',()=>{
  assert.equal(blocked('Just a moment...',''),'Just a moment');
  assert.equal(blocked('Congressional Scorecard','Susan Collins 31%'),null);
  assert.ok(isData('application/json','fetch')&&isData('text/csv','document')&&isData('','xhr'));
  assert.ok(!isData('text/html','document')&&!isData('image/png','xhr')&&!isData('application/javascript','script'));
});

test('a key or token in an address is blanked out; a JSON answer is described by its keys',()=>{
  assert.equal(redact('https://x.example/1/q?x-algolia-api-key=abc&page=2'),'https://x.example/1/q?x-algolia-api-key=hidden&page=2');
  assert.equal(redact('https://x.example/scores?token=t&year=2025'),'https://x.example/scores?token=hidden&year=2025');
  assert.equal(shapeOf({data:[{name:'A',score:1}],total:1}),'keys: data, total; "data" is a list of 1, first item\'s keys: name, score');
  assert.equal(shapeOf([{a:1}]),'a list of 1; first item\'s keys: a');
});
