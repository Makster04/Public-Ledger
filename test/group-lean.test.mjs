// Each group's lean from where its money went (scripts/build-group-lean.mjs), and how a bill page shows it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sideOf,leanOf,LEAN_SHARE,LEAN_SET} from '../scripts/build-group-lean.mjs';
import {leanTag,LEAN} from '../public/legislation-page.js';

test('a gift or spending for a candidate helps their party; spending against them helps the other',()=>{
  assert.equal(sideOf('REP',true),'R');assert.equal(sideOf('DEM',true),'D');assert.equal(sideOf('DFL',true),'D');
  assert.equal(sideOf('REP',false),'D');assert.equal(sideOf('DEM',false),'R');
  assert.equal(sideOf('LIB',true),null);assert.equal(sideOf(undefined,true),null);
});
test('75% or more to one side is that side; anything between is bipartisan; a hand-set reason wins',()=>{
  assert.equal(LEAN_SHARE,75);
  assert.deepEqual(leanOf(75,25),{lean:'republican',rShare:75});
  assert.deepEqual(leanOf(25,75),{lean:'democrat',rShare:25});
  assert.equal(leanOf(74,26).lean,'bipartisan');
  assert.deepEqual(leanOf(0,0),{lean:null,rShare:null});
  assert.equal(leanOf(100,0,LEAN_SET.fairshake).lean,'bipartisan');
});
test('the bill page\'s color and hover text',()=>{
  assert.deepEqual(leanTag({lean:'republican',rShare:99.4},['2022','2026']),{cls:'lean-r',label:'Mostly helps Republicans',text:'Mostly helps Republicans: 99.4% of its money helped Republicans (2022–2026 cycles).'});
  assert.equal(leanTag({lean:'democrat',rShare:2.8}).text,'Mostly helps Democrats: 97.2% of its money helped Democrats.');
  assert.equal(leanTag({lean:'bipartisan',rShare:55.4}).text,'Bipartisan: 55.4% of its money helped Republicans and 44.6% Democrats.');
  assert.match(leanTag({lean:'bipartisan',rShare:100,why:'Set by hand.'}).text,/^Bipartisan\. Set by hand\.$/);
  assert.equal(leanTag(null),null);assert.equal(leanTag({lean:null}),null);
  assert.deepEqual(Object.keys(LEAN),['republican','democrat','libertarian','bipartisan']);
});
test('every group on file has a lean in public/group-lean.json',()=>{
  const groups=JSON.parse(fs.readFileSync('public/research.json','utf8')).groupPos.map(g=>g.key);
  const lean=JSON.parse(fs.readFileSync('public/group-lean.json','utf8'));
  for(const k of groups)assert.ok(LEAN[lean.groups[k]?.lean],`${k} has a lean`);
});
