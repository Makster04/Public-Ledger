// Conflicts of Interest without anyone reviewing (Nov. 28, 2026): every sitting member's annual reports are exported,
// each organization on them is decided from its lda.gov and USAspending.gov lookup (a decision made by hand wins), and
// npm start runs the export, the lookups and the build once a day, so the grades follow the records on their own.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {autoDecision,decisionsFor,buildRecord,committeeLabel,ISSUE_NAMES,COMMITTEE_ISSUES} from '../scripts/match-conflicts.mjs';
import {whoToExport} from '../scripts/export-disclosures.mjs';
import {conflictsComponent} from '../public/integrity.js';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const names={HSPW:{name:'House Committee on Transportation and Infrastructure'},SSCM:{name:'Senate Committee on Commerce, Science, and Transportation'},SSAP:{name:'Senate Committee on Appropriations'}};
const none={lobbying:{match:null},contracts:null};

test('the export: the full profiles, then everyone in office, once each (not the president)',()=>{
  const research={members:[{id:'ossoff',name:'Jon Ossoff',chamber:'S'}],cands:[{id:'talarico',name:'James Talarico',chamber:'S'}],featured:[{id:'trump',office:'President'}]};
  const config={people:[{id:'ossoff',inOffice:true,chamber:'S'},{id:'britt',name:'Katie Boyd Britt',inOffice:true,chamber:'S'},{id:'begich',name:'Nick Begich',inOffice:true,chamber:'H'},{id:'newbie',elect:true,chamber:'H'}]};
  assert.deepEqual(whoToExport(research,config).map(p=>[p.id,p.full]),[['ossoff',true],['talarico',true],['britt',false],['begich',false]]);
});

test('interested when it lobbied on an issue their committees handle, with the reason in words',()=>{
  const uber={lobbying:{match:['Uber Technologies'],issues:['ROD','TRA','TAX'],filings:37},contracts:null};
  const d=autoDecision(uber,['HSPW','HSVR'],names);
  assert.deepEqual([d.interested,d.auto],[true,true]);
  assert.equal(d.why,'Lobbied in 2024–2025 (37 filings) on roads and transportation, which Transportation and Infrastructure handles');
});

test('interested when it holds contracts from an agency they oversee; Appropriations oversees any',()=>{
  const c={lobbying:{match:null},contracts:{agencies:{'Department of Transportation':120000}}};
  assert.equal(autoDecision(c,['HSPW'],names).interested,true);
  assert.match(autoDecision(c,['HSPW'],names).why,/federal contracts from Department of Transportation, which their committees oversee/);
  assert.equal(autoDecision(c,['HSVR'],names).interested,false,'Veterans Affairs doesn\'t oversee Transportation');
  assert.match(autoDecision({...c,contracts:{agencies:{'Department of the Interior':5000}}},['SSAP'],names).why,/which Appropriations funds/);
});

test('not interested, saying why as the hand-reviewed decisions do; nothing decided without a lookup',()=>{
  assert.equal(autoDecision(none,['HSPW'],names).why,'No lobbying filings in 2024–2025; no federal contracts in fiscal 2024–2025');
  const bank={lobbying:{match:['First Bank'],issues:['BAN'],filings:4},contracts:{agencies:{'Department of the Interior':100}}};
  assert.equal(autoDecision(bank,['HSPW'],names).why,'Lobbies only on banking, which their committees don’t handle; contracts only from Department of the Interior, which their committees don’t oversee');
  assert.equal(autoDecision(undefined,['HSPW'],names),null);
});

test('it agrees with every decision reviewed by hand',()=>{
  const reviews=JSON.parse(read('../data/conflict-reviews.json')),lookups=JSON.parse(read('../data/conflict-lookups.json')).orgs,cm=JSON.parse(read('../public/committees.json')).committees;
  let n=0;
  for(const [id,p] of Object.entries(reviews.people))for(const [org,d] of Object.entries(p.orgs)){const x=autoDecision(lookups[org],p.committees,cm);if(!x)continue;n++;assert.equal(x.interested,d.interested,`${id}: ${org}`);}
  assert.ok(n>=30,`${n} compared`);
});

test('every issue code a committee handles has a name, and committee names are short',()=>{
  for(const codes of Object.values(COMMITTEE_ISSUES))for(const c of codes)assert.ok(ISSUE_NAMES[c],c);
  assert.equal(committeeLabel('HSPW',names),'Transportation and Infrastructure');
  assert.equal(committeeLabel('SSCM',names),'Commerce, Science, and Transportation');
  assert.equal(committeeLabel('XXXX',names),'XXXX');
});

test('a member is scored with no review: hand decisions win, the rest automatic, marked auto; held back while one isn\'t looked up',()=>{
  const item=org=>({kind:'income',year:2025,x:{source:org,type:'Salary',amounts:[50000,null]}});
  const m={id:'pat',name:'Pat Doe',committees:['HSPW'],report:{year:2025,url:'https://example.gov/r'},items:[item('Acme Corp'),item('Uber Technologies'),item('State of Ohio Retirement')]};
  const lookups={'Acme Corp':none,'Uber Technologies':{lobbying:{match:['Uber Technologies'],as:'Uber Technologies',issues:['TRA'],filings:2},contracts:null}};
  const dec=decisionsFor(m,{'Acme Corp':{interested:true,why:'by hand'}},lookups,names);
  assert.equal(dec['Acme Corp'].why,'by hand');assert.equal(dec['Uber Technologies'].auto,true);
  const rec=buildRecord(m,dec,'2026-11-28',{name:'Pat Doe'},lookups);
  assert.deepEqual(rec.income.map(x=>[x.source,x.interested,!!x.auto]),[['Acme Corp',true,false],['Uber Technologies',true,true],['State of Ohio Retirement',false,false]]);
  assert.equal(rec.reviewed.src.t,'Matched automatically against lda.gov lobbying filings and USAspending.gov contracts');
  assert.equal(conflictsComponent({id:'pat'},{people:{pat:rec}}).complete,true,'it counts in the grade');
  const later={...m,items:[...m.items,item('Mystery LLC')]};
  assert.deepEqual(buildRecord(later,decisionsFor(later,{},lookups,names),'2026-11-28',{name:'Pat Doe'},lookups),{missing:['Mystery LLC']});
});

test('npm start runs the export, the lookups and the build once a day; the lookup saves as it goes',()=>{
  const local=read('../scripts/local.mjs'),src=read('../scripts/match-conflicts.mjs'),pkg=JSON.parse(read('../package.json'));
  assert.ok(local.includes("const exp=await runScript([path.join(root,'scripts','export-disclosures.mjs')],20*60_000);"));
  assert.ok(local.includes("const look=await runScript([path.join(root,'scripts','match-conflicts.mjs'),'lookup'],6*60*60_000);"));
  assert.ok(local.includes("const build=await runScript([path.join(root,'scripts','match-conflicts.mjs'),'build'],10*60_000);"));
  assert.ok(local.includes("updateConflicts();},60*60_000);")&&local.includes('setTimeout(updateConflicts,10*60_000);'));
  assert.ok(src.includes('if(n%10===0)save();')&&src.includes("process.on('SIGTERM',stop(143));"));
  assert.ok(!pkg.scripts['conflicts:approve']&&!src.includes("mode==='approve'"),'no approval step');
});
