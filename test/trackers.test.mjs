// The trackers (public/trackers.js): the five approved lobbies, how a campaign's money from each is counted for the
// Summary of Major Lookouts (✕ took / ✓ none / … waiting), and the super PACs around each, plus where they show.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TRACKERS,TRACKER,isTrackerPac,researchPacLines,mergePacLines,trackerMoney,lookouts,trackerSuperPacs} from '../public/trackers.js';
import {bundledBox} from '../public/money-map.js';

const research=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const line=(name,amount,cid=null)=>({cid,name,amount});
const caught=(key,name)=>isTrackerPac(TRACKER[key],{name});

test('five trackers in the approved order, each with its PACs on file and none shared',()=>{
  assert.deepEqual(TRACKERS.map(t=>t.key),['aipac','pharma','oil','tech','crypto']);
  assert.deepEqual(TRACKERS.map(t=>t.name),['AIPAC','Big Pharma','Big Oil','Big Tech + AI','Crypto']);
  const ids=TRACKERS.flatMap(t=>t.pacIds);
  assert.equal(new Set(ids).size,ids.length,'no committee counts for two trackers by ID');
  for(const t of TRACKERS)for(const id of t.pacIds){
    const c=research.pacCommittees[id];assert.ok(c,`${t.key}: ${id} is on file`);
    assert.ok(t.patterns.some(r=>r.test(c[0])),`${t.key}: ${c[0]} matches its own patterns too`);
  }
});

test('who is in and who is out, as approved',()=>{
  // AIPAC alone: J Street and other pro-Israel PACs aren't in it.
  assert.ok(caught('aipac','AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE'));
  for(const n of ['J STREET PAC','NORPAC','PRO-ISRAEL AMERICA PAC'])assert.ok(!caught('aipac',n),n);
  // Oil: Koch, coal and mining, and gas utilities are out.
  for(const n of ['EXXON MOBIL CORPORATION POLITICAL ACTION COMMITTEE','CHEVRON EMPLOYEES POLITICAL ACTION COMMITTEE','AMERICAN PETROLEUM INSTITUTE PAC','VALERO ENERGY CORPORATION PAC'])assert.ok(caught('oil',n),n);
  for(const n of ['KOCH INDUSTRIES INC POLITICAL ACTION COMMITTEE (KOCHPAC)','PEABODY ENERGY PAC','NATIONAL MINING ASSOCIATION PAC','ATMOS ENERGY CORPORATION PAC','SHELLEY FOR CONGRESS'])assert.ok(!caught('oil',n),n);
  // Pharma: drugmakers and their groups; devices, distributors, PBMs and pharmacies are out.
  for(const n of ['PFIZER INC. PAC','AMGEN INC. POLITICAL ACTION COMMITTEE','PHARMACEUTICAL RESEARCH AND MANUFACTURERS OF AMERICA PAC'])assert.ok(caught('pharma',n),n);
  for(const n of ['MEDTRONIC INC PAC','MCKESSON CORPORATION EMPLOYEES POLITICAL FUND','CVS HEALTH CORPORATION PAC','WALGREEN CO PAC'])assert.ok(!caught('pharma',n),n);
  // Tech + AI: platforms, chips, Nvidia and Palantir; telecom and cable are out.
  for(const n of ['MICROSOFT CORPORATION POLITICAL ACTION COMMITTEE','GOOGLE LLC NETPAC','NVIDIA CORPORATION PAC','PALANTIR TECHNOLOGIES INC. PAC'])assert.ok(caught('tech',n),n);
  for(const n of ['AT&T INC. EMPLOYEE FEDERAL POLITICAL ACTION COMMITTEE','VERIZON COMMUNICATIONS INC. GOOD GOVERNMENT CLUB','COMCAST CORPORATION POLITICAL ACTION COMMITTEE'])assert.ok(!caught('tech',n),n);
  // Andreessen Horowitz counts for both Tech + AI and Crypto.
  assert.ok(caught('tech','ANDREESSEN HOROWITZ PAC')&&caught('crypto','ANDREESSEN HOROWITZ PAC'));
  assert.ok(caught('crypto','COINBASE INC. PAC')&&caught('crypto','BLOCKCHAIN ASSOCIATION POLITICAL ACTION COMMITTEE (BA PAC)'));
});

test('a lookout: PAC checks and routed gifts take it; employees\' gifts are shown but don\'t',()=>{
  const t=TRACKER.oil,lines=[line('PHILLIPS 66 PAC',5000),line('CHEVRON EMPLOYEES POLITICAL ACTION COMMITTEE',1500,'C00035006'),line('CHEVRON EMPLOYEES PAC',1000,'C00035006'),line('NATIONAL ASSOCIATION OF REALTORS PAC',5000)];
  const x=trackerMoney(t,{pacLines:lines});
  assert.equal(x.status,'took');assert.equal(x.total,7500);assert.equal(x.pac,7500);
  assert.deepEqual(x.pacs.map(p=>[p.name,p.amount,p.n]),[['PHILLIPS 66 PAC',5000,1],['CHEVRON EMPLOYEES POLITICAL ACTION COMMITTEE',2500,2]],'one committee\'s checks together, by its ID');
  assert.equal(trackerMoney(t,{pacLines:[line('NATIONAL ASSOCIATION OF REALTORS PAC',5000)]}).status,'none');
  assert.equal(trackerMoney(t,{pacLines:null}).status,'waiting','PAC lines not read: never shown as none');
  const tech=TRACKER.tech,e=trackerMoney(tech,{pacLines:[],employees:{ai:2500,both:1000,crypto:9999}});
  assert.equal(e.status,'none','employee gifts alone don\'t flip the mark');assert.equal(e.employees,3500,'AI and both, not crypto');assert.equal(e.total,0);
  assert.equal(trackerMoney(TRACKER.pharma,{pacLines:[],employees:{ai:5}}).employees,null,'no employee read for this tracker yet');
});

test('AIPAC: routed gifts count, its own PAC checks fill in missing PAC lines once, and unsearched gifts wait',()=>{
  const t=TRACKER.aipac;
  const a=trackerMoney(t,{pacLines:[],routed:{aipac:819771.19,other:5},routedKnown:true,direct:{aipac:10000}});
  assert.equal(a.status,'took');assert.equal(a.routed,819771.19);assert.equal(a.pac,10000);assert.equal(a.total,829771.19);
  assert.ok(a.pacs[0].own,'marked as from AIPAC\'s own reports');
  const b=trackerMoney(t,{pacLines:[line('AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE',5000,'C00797670')],routed:{},routedKnown:true,direct:{aipac:10000}});
  assert.equal(b.pac,10000,'the same checks counted once, at the larger amount');
  const c=trackerMoney(t,{pacLines:[line('AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE',10000,'C00797670')],direct:{aipac:5000},routedKnown:true});
  assert.equal(c.pac,10000);assert.ok(!c.pacs[0].own);
  assert.equal(trackerMoney(t,{pacLines:[],routed:{},routedKnown:false}).status,'waiting','not every routed gift searched: no ✓');
  assert.equal(trackerMoney(t,{pacLines:[],routed:{},routedKnown:true}).status,'none');
  assert.equal(trackerMoney(TRACKER.oil,{pacLines:[],routedKnown:false}).status,'none','routed gifts only matter where the tracker has a group');
});

test('lookouts: one line a tracker, in order',()=>{
  const L=lookouts({pacLines:[line('PFIZER INC. PAC',5000)],routed:{aipac:100},routedKnown:true});
  assert.deepEqual(L.map(x=>[x.key,x.status,x.total]),[['aipac','took',100],['pharma','took',5000],['oil','none',0],['tech','none',0],['crypto','none',0]]);
});

test('PAC lines: research.json\'s with full committee names, merged with the refresh\'s at the larger amount',()=>{
  const s=research.members.find(p=>p.id==='lawler');
  const L=researchPacLines(research,s);
  assert.equal(L.length,s.pac.rows.filter(r=>r[1]>0).length);
  assert.ok(L.every(l=>typeof l.name==='string'&&l.amount>0));
  assert.ok(L.some(l=>l.cid&&l.name===research.pacCommittees[l.cid]?.[0]),'names from the committee record');
  const m=mergePacLines([line('PFIZER INC. PAC',5000,'C1'),line('A PAC',100)],[line('PFIZER INC PAC',7500,'C1'),line('A PAC',50),line('B PAC',0)]);
  assert.deepEqual(m.map(l=>[l.cid,l.amount]),[['C1',7500],[null,100]]);
  // Two checks from one PAC in the same read add up (a primary and a general check), and only then is the larger read kept.
  const two=mergePacLines([line('PHILLIPS 66 PAC',2500,'C2'),line('PHILLIPS 66 PAC',2500,'C2')],[line('PHILLIPS 66 PAC',4000,'C2')]);
  assert.deepEqual(two.map(l=>[l.cid,l.amount]),[['C2',5000]]);
  // Lawler's own lines merged with nothing else give the same tracker totals as the lines themselves.
  const ln=researchPacLines(research,s);
  for(const t of TRACKERS)assert.equal(trackerMoney(t,{pacLines:mergePacLines(ln,[])}).pac,trackerMoney(t,{pacLines:ln}).pac,t.key);
});

test('every reviewed profile gets a mark for each tracker from the files on hand, and Lawler\'s add up',()=>{
  const people=[...research.members,...research.cands].filter(s=>s.fecCand);
  for(const s of people){
    const b=research.bundled?.people?.[s.id]||{};
    const L=lookouts({pacLines:s.pac?researchPacLines(research,s):null,routed:Object.fromEntries(Object.entries(b).map(([g,v])=>[g,v.routed])),routedKnown:true,direct:Object.fromEntries(Object.entries(b).map(([g,v])=>[g,v.direct]))});
    for(const x of L){assert.ok(['took','none','waiting'].includes(x.status));assert.ok(x.total>=0);if(!s.pac&&x.total===0)assert.equal(x.status,'waiting',`${s.id} ${x.key}: no PAC lines, no ✓`);}
  }
  const s=research.members.find(p=>p.id==='lawler'),b=research.bundled.people.lawler.aipac;
  const x=trackerMoney(TRACKER.aipac,{pacLines:researchPacLines(research,s),routed:{aipac:b.routed},routedKnown:true,direct:{aipac:b.direct}});
  assert.equal(x.total,Math.round((b.routed+b.direct)*100)/100);
});

test('super PACs: its own by name, and those its companies gave to, with spending for and against the person',()=>{
  const data={superPacs:[
    {id:'C1',name:'United Democracy Project',total:5e6,cands:[{cand:'H4NY17000',for:0,against:250000}],donors:{orgs:[],indiv:{total:0,n:0},read:10}},
    {id:'C2',name:'Leading the Future',total:2e6,cands:[{cand:'H4NY17000',for:90000,against:0}],donors:{orgs:[{name:'OPENAI',amount:100000,n:1},{name:'ANDREESSEN HOROWITZ',amount:300000,n:1}],indiv:{total:600000,n:3},read:20}},
    {id:'C3',name:'Some Other Fund',total:1e6,cands:[],donors:{orgs:[{name:'MICROSOFT CORPORATION',amount:50000,n:1},{name:'ACME',amount:10,n:1}],indiv:{total:0,n:0},read:5}}]};
  const a=trackerSuperPacs(TRACKER.aipac,data,'H4NY17000');
  assert.deepEqual(a.named.map(o=>[o.name,o.for,o.against]),[['United Democracy Project',0,250000]]);assert.deepEqual(a.funded,[]);
  const t=trackerSuperPacs(TRACKER.tech,data,'H4NY17000');
  assert.deepEqual(t.named.map(o=>[o.name,o.for]),[['Leading the Future',90000]],'its own super PAC by name');
  assert.deepEqual(t.funded.map(o=>[o.name,o.given,o.for,o.against]),[['Some Other Fund',50000,0,0]],'its own isn\'t listed twice');
  assert.deepEqual(trackerSuperPacs(TRACKER.tech,{},'X'),{named:[],funded:[]});
});

test('where they show: the lookouts beside the score, the tracker tabs, the Trackers page, and the bundled box keeps AIPAC',()=>{
  const app=read('../public/app.js'),html=read('../public/index.html'),css=read('../public/remake.css');
  assert.match(app,/from '\.\/trackers\.js'/);
  assert.match(app,/<h3>Summary of Major Lookouts<\/h3>/);
  assert.match(app,/No PAC money or gifts from \$\{esc\(x\.name\)\}/);
  assert.match(app,/bundledBox\(s,mm\)\+lookoutsBox\(/,'the lookouts go right under "Bundled through groups"');
  assert.match(app,/else if\(m\[1\]==='trackers'\)\{renderTrackers\(/);
  assert.match(app,/<th class="r">PAC checks<\/th><th class="r">Gifts routed<\/th>/,'every tracker has the Gifts routed column');
  assert.match(app,/'<span class="muted small">Not updated yet<\/span>'/,'blank, saying so, where routed gifts aren\'t read yet');
  assert.doesNotMatch(app,/function industryCard\(/,'the old crypto and AI card is replaced by the Crypto and Tech + AI trackers');
  assert.match(html,/<a href="#trackers" data-route="trackers">Trackers<\/a>/);
  for(const c of ['.lk-list','.lk-took','.lk-none','.lk-waiting','.tr-tabs','.tr-panel','.tr-page-tabs'])assert.ok(css.includes(c),c);
  // AIPAC's routed gifts stay in "Bundled through groups" too.
  const s=research.members.find(p=>p.id==='lawler');
  const box=bundledBox(s,{bundled:research.bundled.people.lawler,groups:{...Object.fromEntries((research.groupPos||[]).map(g=>[g.key,g.org])),...(research.bundled?.names||{})},categories:research.categories||{},pacNames:research.pacNames||[],pacType:()=>null});
  assert.match(box,/AIPAC/);
});
