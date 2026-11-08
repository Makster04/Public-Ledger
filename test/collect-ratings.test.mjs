import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readSba,readLcv,readRfa,readHeritage,readClubForGrowth,cfgLatest,congressLabel,congressOf,matchPerson,stateCode,collect,READERS,probedGroups} from '../scripts/collect-ratings.mjs';
import {ratingsLean} from '../public/six-scores.js';

const sample=f=>fs.readFileSync(new URL(`../data/ratings-samples/${f}`,import.meta.url),'utf8');
const research=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
const people=[...research.members,...research.cands].map(p=>({id:p.id,name:p.name,short:p.short,state:stateCode(p.state)||stateCode(p.stateName),chamber:p.chamber,bioguide:p.bioguide||null,cand:!!p.cand}));
const of=(rows,id)=>rows.map(r=>[r,matchPerson(r,people)]).find(([,p])=>p?.id===id)?.[0];

test('SBA Pro-Life America: letter grades from its Senate and House tables, for the Congress the page names',()=>{
  const rows=readSba(sample('sba-1.html'));
  assert.ok(rows.length>=20);
  assert.deepEqual(rows[0],{name:'Tammy Baldwin',party:'Democrat',state:'WI',chamber:'S',grade:'F',status:'Current',url:'https://sbaprolife.org/senator/tammy-baldwin/',year:'119th Congress'});
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

test('Heritage Action: every member\'s score for the sitting Congress, from the page\'s members list, matched on Bioguide ID',async()=>{
  const rows=readHeritage(sample('heritage-2.html'));
  assert.ok(rows.length>=200,'a page cut short still reads');
  const c=rows.find(r=>r.bioguide==='C001035');
  assert.deepEqual(c,{name:'Susan Collins',state:'ME',chamber:'S',party:'R',district:null,bioguide:'C001035',score:31,url:'https://heritageaction.com/scorecard/members/C001035'});
  assert.equal(matchPerson(c,people)?.id,'collins');
  assert.ok(!rows.some(r=>r.name==='Clay Fuller'),'a member scored "N/A" (too new) is left out');
  assert.equal(matchPerson(rows.find(r=>r.name==='Mike Collins'),people)?.id,'mcollins','the other Collins, by their own ID');
  // Early in a new Congress, before any scores are posted, the one before.
  const asked=[],pages={120:'<div :members="[]"></div>',119:sample('heritage-2.html')};
  const got=await collect(READERS.find(r=>r.key==='heritage'),people,{fetchPage:async u=>{asked.push(u);return pages[/members\/(\d+)/.exec(u)[1]];},wait:0,today:new Date('2027-01-10')});
  assert.deepEqual(asked,['https://heritageaction.com/scorecard/members/120','https://heritageaction.com/scorecard/members/119']);
  assert.ok(got.matched.some(m=>m.id==='collins'&&m.row.year==='119th Congress'));
  assert.deepEqual([congressOf(2025),congressOf(2026),congressOf(2027)],[119,119,120]);
  assert.deepEqual([119,121,122,123,111,112,113].map(congressLabel),['119th Congress','121st Congress','122nd Congress','123rd Congress','111th Congress','112th Congress','113th Congress']);
});

test('Club for Growth: the newest year\'s Senate and House tables, the year\'s score and the lifetime score',async()=>{
  const latest=cfgLatest(sample('clubforgrowth-1.html'));
  assert.equal(latest.year,2025);
  assert.deepEqual(latest.pages,[{chamber:'S',url:'https://www.clubforgrowth.org/scorecards/app/?party=all&chamber=S&yr=2025&state=all&rep'},{chamber:'H',url:'https://www.clubforgrowth.org/scorecards/app/?party=all&chamber=H&yr=2025&state=all&rep'}]);
  const sen=readClubForGrowth(sample('clubforgrowth-2.html'),{chamber:'S',year:2025});
  assert.equal(sen.length,100);
  assert.deepEqual(sen.find(r=>r.bioguide==='C001035'),{name:'Susan Collins',state:'ME',chamber:'S',party:'R',bioguide:'C001035',score:43,lifetime:34,year:2025,url:'https://www.clubforgrowth.org/scorecards/legislator/C001035/Susan-Collins'});
  assert.ok(readClubForGrowth(sample('clubforgrowth-3.html'),{chamber:'H',year:2025}).length>=100,'a House page cut short still reads');
  const pages={'https://www.clubforgrowth.org/scorecards/':sample('clubforgrowth-1.html'),[latest.pages[0].url]:sample('clubforgrowth-2.html'),[latest.pages[1].url]:sample('clubforgrowth-3.html')};
  const got=await collect(READERS.find(r=>r.key==='clubforgrowth'),people,{fetchPage:async u=>pages[u],wait:0});
  const ossoff=got.matched.find(m=>m.id==='ossoff');assert.ok(ossoff&&ossoff.row.chamber==='S'&&ossoff.row.year===2025);
  await assert.rejects(collect(READERS.find(r=>r.key==='clubforgrowth'),people,{fetchPage:async()=>'<p>nothing</p>',wait:0}),/no scorecard year/);
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
  assert.equal(g.aflcio.status,'blocked');assert.equal(g.hrc.status,'permission');assert.equal(g.afp.status,'to-build');assert.ok(!g.heritage&&!g.clubforgrowth,'Heritage Action and Club for Growth have readers');
  for(const r of READERS)assert.ok(!g[r.key],`${r.key} has a reader`);
});
