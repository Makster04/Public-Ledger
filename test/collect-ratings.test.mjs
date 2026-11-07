import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readSba,readLcv,readRfa,matchPerson,stateCode,collect,READERS,probedGroups} from '../scripts/collect-ratings.mjs';
import {ratingsLean} from '../public/six-scores.js';

const sample=f=>fs.readFileSync(new URL(`../data/ratings-samples/${f}`,import.meta.url),'utf8');
const research=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
const people=[...research.members,...research.cands].map(p=>({id:p.id,name:p.name,short:p.short,state:stateCode(p.state)||stateCode(p.stateName),chamber:p.chamber,cand:!!p.cand}));
const of=(rows,id)=>rows.map(r=>[r,matchPerson(r,people)]).find(([,p])=>p?.id===id)?.[0];

test('SBA Pro-Life America: letter grades from its Senate and House tables (the page the probe saved)',()=>{
  const rows=readSba(sample('sba-1.html'));
  assert.ok(rows.length>=20);
  assert.deepEqual(rows[0],{name:'Tammy Baldwin',party:'Democrat',state:'WI',chamber:'S',grade:'F',status:'Current',url:'https://sbaprolife.org/senator/tammy-baldwin/'});
  assert.equal(of(rows,'collins').grade,'D');assert.equal(of(rows,'booker').grade,'F');
});

test('LCV: the year\'s score and the lifetime score, by state',()=>{
  const rows=readLcv(sample('lcv-2.html'));
  const o=of(rows,'ossoff');
  assert.deepEqual([o.state,o.score,o.year],['GA',94,2025]);assert.ok(o.lifetime!=null);
  assert.equal(of(rows,'marshall').score,0);
});

test('Reproductive Freedom for All: the latest year with a score, page by page',async()=>{
  const rows=readRfa(sample('rfa-1.html'));
  assert.equal(rows.length,20);
  assert.deepEqual([rows[0].name,rows[0].state,rows[0].chamber,rows[0].district,rows[0].score],['Alma Adams','NC','H','NC-12',100]);
  const pages={0:sample('rfa-1.html'),1:'<table class="votes1"></table>'};
  const got=await collect(READERS.find(r=>r.key==='rfa'),people,{fetchPage:async u=>pages[/pg=(\d+)/.exec(u)[1]]??'',wait:0});
  assert.equal(got.rows.length,20);
});

test('matching: the same last name and state, and the same first name or initial; never a near miss',()=>{
  assert.equal(matchPerson({name:'Jon Ossoff',state:'GA',chamber:'S'},people)?.id,'ossoff');
  assert.equal(matchPerson({name:'Jon Ossoff',state:'TX',chamber:'S'},people),null);
  assert.equal(matchPerson({name:'Rick Scott',state:'FL',chamber:'S'},people)?.id??null,null);
  assert.deepEqual(['GA','Georgia','OK-04','nowhere'].map(stateCode),['GA','GA','OK',null]);
});

test('the ratings become the Ratings lean; every group without a reader says why',()=>{
  assert.deepEqual(ratingsLean([{org:'SBA',lean:'conservative',grade:'F'},{org:'LCV',lean:'liberal',score:94},{org:'RFA',lean:'liberal',score:100}]).lean,-96);
  const g=probedGroups();
  for(const [k,x] of Object.entries(g))assert.ok(['blocked','none','states','no-list','permission','to-build'].includes(x.status),k);
  assert.equal(g.aflcio.status,'blocked');assert.equal(g.hrc.status,'permission');assert.equal(g.heritage.status,'to-build');
  for(const r of READERS)assert.ok(!g[r.key],`${r.key} has a reader`);
});
