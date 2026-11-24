// The bills of this Congress scored for People First on Nov. 21, 2026, each from groups on both sides, with their roll
// calls and every member's position on file.
import {withRemovedResearch} from './fixtures/with-removed.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {billScore,BILL_GROUPS} from '../public/grades.js';
import {voteBill} from '../public/scoring.js';
const D=withRemovedResearch(JSON.parse(await fs.readFile(new URL('../public/research.json',import.meta.url),'utf8')));
const config=JSON.parse(await fs.readFile(new URL('../data/config.json',import.meta.url),'utf8'));
const ADDED={'119-hr-5408':100,'119-hconres-14':-100,'119-hr-4':-100,'119-hr-3633':-100,'119-hr-1968':-100,'119-sjres-18':-100,'119-s-1582':-100};
const VOTES={'119-hconres-14':['h-119-1-050','119-1-191','h-119-1-100'],'119-sjres-18':['119-1-153','h-119-1-096'],'119-hr-3633':['h-119-1-199','119-2-234'],'119-hr-5408':['h-119-2-216']};

test('each added bill is scored from a worker group and a business group, with cited sources',()=>{
  for(const [id,score] of Object.entries(ADDED)){
    const b=D.bills.find(x=>x.id===id);assert.ok(b,id);
    const s=billScore(b);assert.equal(s.status,'scored',id);assert.equal(s.score,score,id);
    assert.ok(s.worker!=null&&s.business!=null,`${id} has both sides`);
    for(const x of b.sides){assert.ok(BILL_GROUPS[x.group],`${id}: ${x.group}`);assert.match(x.src.u,/^https:\/\//);assert.ok(x.why&&x.date,`${id} ${x.group}`);}
  }
  assert.ok(D.bills.find(b=>b.id==='119-sjres-18').consumer,'the overdraft-rule repeal is a consumer-finance measure');
});

test('the added roll calls link to their bills, are selected, and list every member',()=>{
  const all=[...D.votes,...D.hvotes];
  for(const [bill,ids] of Object.entries(VOTES))for(const id of ids){
    const v=all.find(x=>x.id===id);assert.ok(v,id);assert.equal(voteBill(v),bill,id);
    assert.ok(config.selectedVotes.some(x=>x.id===id),`${id} is in selectedVotes`);
    assert.ok(Object.keys(v.pos).length>=(id.startsWith('h-')?380:90),`${id} has positions for every member`);
    assert.ok(Object.values(v.pos).every(p=>['Yea','Nay','Not voting','Not Voting','Not in office','Present'].includes(p)),id);
  }
  for(const k of Object.keys(VOTES))assert.ok(config.keyBills.includes(k),`${k} is a key bill`);
});

test('the added roll calls are mapped to an issue, or say why not',()=>{
  const all=[...D.votes,...D.hvotes],V=id=>all.find(v=>v.id===id),ISS=new Set(D.issues.map(i=>i.id));
  for(const id of ['h-119-1-050','119-1-191','h-119-1-100'])assert.deepEqual(V(id).codes.map(c=>c.issue+c.yea),['taxesB'],id);
  assert.deepEqual(V('h-119-2-216').codes.map(c=>c.issue+c.yea),['laborA']);
  for(const ids of Object.values(VOTES))for(const id of ids){const v=V(id);
    if(v.codes.length){assert.equal(v.excluded,null,id);for(const c of v.codes){assert.ok(ISS.has(c.issue),id);assert.ok(c.why,id);}}
    else assert.ok(v.excluded&&!/People First \(added/.test(v.excluded),id+' says why it is not mapped');}
});
