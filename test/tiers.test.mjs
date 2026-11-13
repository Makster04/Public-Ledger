// Tiers (public/tiers.js): each sitting member's money from a tracker against the typical member of their chamber who
// took some (the median): far above 3 ×, above 1.5 to 3 ×, about half to 1.5 ×, below half, none.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TIER_KEYS,TIER_LABEL,trackerAmount,median,tierOf,chamberTiers} from '../public/tiers.js';

const read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));

test('the five tiers and their lines',()=>{
  assert.deepEqual(TIER_KEYS.map(k=>TIER_LABEL[k]),['Far Above Average','Above Average','About Average','Below Average','None']);
  assert.equal(median([3,1,2]),2);assert.equal(median([4,1,2,3]),2.5);assert.equal(median([]),null);
  const t=16500;
  assert.deepEqual([241200,49501,49500,30000,24751,24750,16500,8250,8249,1,0].map(a=>tierOf(a,t)),['far','far','above','above','above','about','about','about','below','below','none']);
  assert.equal(tierOf(null,t),null,'not read: not placed');assert.equal(tierOf(500,null),'about','nobody else took any');
});

test('a member\'s amount: PAC checks plus, for AIPAC, the gifts it passed on; not read is null',()=>{
  const cp={people:{a:[0,0],b:[0,0]},trackers:{aipac:{a:[5000,1,120000]},oil:{}}};
  assert.equal(trackerAmount(cp,'aipac','a'),125000);assert.equal(trackerAmount(cp,'oil','a'),0);assert.equal(trackerAmount(cp,'oil','zz'),null);
});

test('one chamber: the typical amount is the median of those who took some; tiers largest first; not read left out',()=>{
  const cp={people:{a:[],b:[],c:[],d:[],e:[],g:[]},trackers:{oil:{a:[40000,3],b:[10000,1],c:[3000,1],d:[0,0],g:[20000,2]}}};
  const m=['a','b','c','d','e','f','g'].map(id=>({id,name:id.toUpperCase()}));
  const T=chamberTiers(cp,'oil',m);
  assert.equal(T.typical,15000);assert.equal(T.took,4);assert.equal(T.read,6);
  assert.deepEqual(Object.fromEntries(TIER_KEYS.map(k=>[k,T.tiers[k].map(r=>r.m.id)])),{far:[],above:['a'],about:['g','b'],below:['c'],none:['d','e']});
  assert.deepEqual(T.notRead.map(x=>x.id),['f']);assert.equal(T.byId.a,'above');assert.equal(T.byId.f,undefined);
});

test('the real file: every sitting member read is placed once, each chamber on its own',()=>{
  const cp=read('../public/corporate-pacs.json'),S=read('../public/senate.json').senators,H=read('../public/house.json').members.filter(x=>!x.delegate);
  for(const key of Object.keys(cp.trackers))for(const list of [S,H]){
    const T=chamberTiers(cp,key,list),placed=TIER_KEYS.flatMap(k=>T.tiers[k]);
    assert.equal(placed.length,T.read,key);assert.equal(new Set(placed.map(r=>r.m.id)).size,placed.length,key);
    assert.equal(T.read+T.notRead.length,list.length,key);
    for(const r of T.tiers.none)assert.equal(r.amount,0);
  }
  const d=chamberTiers(cp,'defense',H);assert.ok(TIER_KEYS.every(k=>d.tiers[k].length),'Big Defense spreads across all five in the House');
});

test('the six years (tracker-history.json): three cycles of PAC checks, the same members and trackers, at least this cycle\'s money',()=>{
  const h=read('../public/tracker-history.json'),cp=read('../public/corporate-pacs.json');
  assert.deepEqual(h.cycles,[cp.cycle-4,cp.cycle-2,cp.cycle]);assert.equal(h.from,`${cp.cycle-5}-01-01`);
  assert.deepEqual(Object.keys(h.trackers).sort(),Object.keys(cp.trackers).sort());
  assert.deepEqual(Object.keys(h.people).sort(),Object.keys(cp.people).sort(),'the same members read');
  let n=0,lower=0;
  for(const [key,list] of Object.entries(cp.trackers))for(const [id,v] of Object.entries(list)){n++;const six=trackerAmount(h,key,id);if(six<v[0])lower++;}
  assert.ok(lower/n<0.02,`six years at least this cycle's PAC checks for nearly everyone (${lower} of ${n} lower, from refunds of earlier gifts)`);
  for(const list of Object.values(h.trackers))for(const v of Object.values(list))assert.equal(v.length,2,'PAC dollars and PACs only: no passed-on gifts');
  const H=read('../public/house.json').members.filter(x=>!x.delegate);
  assert.ok(chamberTiers(h,'wallstreet',H).typical>chamberTiers(cp,'wallstreet',H).typical,'six years\' typical amount is larger');
});
