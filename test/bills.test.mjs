// The Bills page's list (research.json "billIndex", public/bills.js): every bill on file is listed once, with a status
// and cited group positions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {billFamilies,groupInfo,unlisted,EXTRA_GROUPS} from '../public/bills.js';
import {makeScorer} from '../public/scoring.js';
const D=JSON.parse(await fs.readFile(new URL('../public/research.json',import.meta.url),'utf8'));
const KEY=/^\d{3}-(hr|s|hjres|sjres|hconres|sconres|samdt|hamdt)-\d+$/;

test('each listed bill has a valid number, a status, and cited positions from known groups',()=>{
  const ids=new Set();
  for(const b of D.billIndex){
    assert.match(b.id,KEY,b.id);assert.ok(!ids.has(b.id),`${b.id} listed twice`);ids.add(b.id);
    for(const k of b.versions||[])assert.match(k,KEY,`${b.id} version ${k}`);
    assert.ok(b.title,b.id);
    if(b.status==='law'){assert.match(b.law,/^Public Law \d{3}-\d+$/,b.id);assert.match(b.date,/^\d{4}-\d{2}-\d{2}$/,b.id);}
    else{assert.equal(b.status,'not',b.id);assert.ok(b.stage&&b.stage.length>20,b.id);}
    for(const g of b.groups||[]){
      assert.notEqual(groupInfo(D,g.group).org,g.group,`${b.id}: unknown group ${g.group}`);
      assert.ok(['support','oppose'].includes(g.pos),`${b.id} ${g.group}`);
      assert.match(g.src?.u||'',/^https:\/\//,`${b.id} ${g.group} needs a source`);assert.ok(g.why,`${b.id} ${g.group}`);
    }
    for(const x of [b.summarySrc,b.statusSrc,...(b.steps||[]).map(s=>s.src)].filter(Boolean))assert.match(x.u,/^https:\/\//,b.id);
  }
});

test('every bill behind a saved roll call and every Workers > Profit bill is on the list',()=>{
  assert.deepEqual(unlisted(D),[],'saved roll calls on bills missing from the list');
  const keys=new Set(billFamilies(D).flatMap(e=>e.keys));
  for(const b of D.bills)assert.ok(keys.has(b.id),`${b.id} is scored but not listed`);
  // A bill and its versions belong to one entry only.
  const seen=new Map();for(const e of billFamilies(D))for(const k of e.keys){assert.ok(!seen.has(k),`${k} is in ${seen.get(k)} and ${e.id}`);seen.set(k,e.id);}
});

test('families gather the votes and positions: researched first, then bill sides, then scorecards, one per group',()=>{
  const F=billFamilies(D,makeScorer(D).bills),by=id=>F.find(e=>e.id===id);
  const rfma=by('117-hr-8404');
  assert.equal(rfma.status,'law');assert.equal(rfma.votes[0].id,'117-2-362');
  assert.deepEqual(rfma.positions.filter(p=>p.from==='research').map(p=>`${p.group}:${p.pos}`),['heritage:oppose','aclu:support','hrc:support']);
  assert.ok(rfma.positions.some(p=>p.group==='lcv'&&p.pos==='support'&&p.from==='scorecard'),'LCV\'s scorecard position comes from the funder research');
  const save=by('119-hr-22');assert.ok(save.keys.includes('118-hr-8281'));
  assert.equal(new Set(save.positions.map(p=>p.group)).size,save.positions.length,'one position per group');
  const pro=by('117-hr-842');assert.ok(pro.work&&pro.keys.includes('116-hr-2474'),'versions come from the Workers > Profit bill too');
  assert.deepEqual(pro.votes.map(v=>v.id),['h-117-1-070','h-116-2-050'],'newest vote first');
  assert.ok(pro.positions.some(p=>p.group==='aflcio'&&p.from==='bill'));
  assert.deepEqual(by('117-s-2938').positions.map(p=>`${p.group}:${p.pos}`),['nra:oppose','giffords:support','everytown:support'],'the NRA opposed the gun-safety law; the gun-safety groups backed it');
  // Each group's positions on saved votes come from its funder record, with the kind of source.
  const ira=by('117-hr-5376');
  assert.ok(ira.positions.some(p=>p.group==='phrma'&&p.pos==='oppose'&&p.from==='statement'&&p.vote==='117-2-325'));
  assert.ok(ira.positions.some(p=>p.group==='cfg'&&p.pos==='oppose'&&p.from==='key vote'));
  const war=by('119-sjres-98');assert.equal(war.votes.length,4,'all four Venezuela war powers votes');
  // Laws come first by signing date; the rest by their latest vote.
  assert.ok(F.filter(e=>e.status==='law').every((e,i,a)=>!i||a[i-1].when>=e.when));
  assert.equal(by('115-s-2155').votes.length,0);assert.ok(by('115-s-2155').steps.length,'a bill with no saved vote lists its steps');
});

test('group details: advocacy groups have no PAC; PAC money and outside spending add up from the funders on file',()=>{
  for(const k of Object.keys(EXTRA_GROUPS)){assert.ok(!D.groupPos.some(g=>g.key===k),`${k} has a funder record`);const g=groupInfo(D,k);assert.equal(g.pacs,0);assert.equal(g.pac+g.out,0);assert.ok(g.about);}
  for(const g of D.groupPos)assert.ok(groupInfo(D,g.key).about,`${g.key} needs a description in orgs.js`);
  const her=groupInfo(D,'heritage');assert.ok(her.pacs>0&&her.out>0&&her.pac===0,'Heritage Action spends through its super PAC and gives no PAC money');
  const lcv=groupInfo(D,'lcv');assert.ok(lcv.pacs>0&&lcv.out>0&&lcv.people>0);
  let pac=0;for(const p of [...D.members,...D.cands,...(D.featured||[])])for(const f of p.funderPos||[])if(f.key==='chamber')pac+=f.pac||0;
  assert.equal(groupInfo(D,'chamber').pac,pac);
  assert.equal(groupInfo(D,'epi').org,'Economic Policy Institute','Workers > Profit groups are named too');
});
