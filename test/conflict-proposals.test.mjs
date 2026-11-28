// Every sitting member's annual reports for Conflicts of Interest (Nov. 28, 2026): the export takes everyone in office,
// the lookups go on from where they stopped, and each organization gets a proposed decision from its lookup, which
// counts only once approved.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {proposeDecision,proposeAll,approve,committeeLabel,ISSUE_NAMES,COMMITTEE_ISSUES} from '../scripts/match-conflicts.mjs';
import {whoToExport} from '../scripts/export-disclosures.mjs';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const names={HSPW:{name:'House Committee on Transportation and Infrastructure'},SSCM:{name:'Senate Committee on Commerce, Science, and Transportation'},SSAP:{name:'Senate Committee on Appropriations'}};
const none={lobbying:{match:null},contracts:null};

test('the export: the full profiles, then everyone in office, once each (not the president)',()=>{
  const research={members:[{id:'ossoff',name:'Jon Ossoff',chamber:'S'}],cands:[{id:'talarico',name:'James Talarico',chamber:'S'}],featured:[{id:'trump',office:'President'}]};
  const config={people:[{id:'ossoff',inOffice:true,chamber:'S'},{id:'britt',name:'Katie Boyd Britt',inOffice:true,chamber:'S'},{id:'begich',name:'Nick Begich',inOffice:true,chamber:'H'},{id:'newbie',elect:true,chamber:'H'}]};
  assert.deepEqual(whoToExport(research,config).map(p=>[p.id,p.full]),[['ossoff',true],['talarico',true],['britt',false],['begich',false]]);
});

test('a proposal: interested when it lobbied on an issue their committees handle, with the reason in words',()=>{
  const uber={lobbying:{match:['Uber Technologies'],issues:['ROD','TRA','TAX'],filings:37},contracts:null};
  const d=proposeDecision(uber,['HSPW','HSVR'],names);
  assert.deepEqual([d.interested,d.proposed],[true,true]);
  assert.equal(d.why,'Lobbied in 2024–2025 (37 filings) on roads and transportation, which Transportation and Infrastructure handles');
});

test('a proposal: interested when it holds contracts from an agency they oversee; Appropriations oversees any',()=>{
  const c={lobbying:{match:null},contracts:{agencies:{'Department of Transportation':120000}}};
  assert.equal(proposeDecision(c,['HSPW'],names).interested,true);
  assert.match(proposeDecision(c,['HSPW'],names).why,/federal contracts from Department of Transportation, which their committees oversee/);
  assert.equal(proposeDecision(c,['HSVR'],names).interested,false,'Veterans Affairs doesn\'t oversee Transportation');
  assert.match(proposeDecision({...c,contracts:{agencies:{'Department of the Interior':5000}}},['SSAP'],names).why,/which Appropriations funds/);
});

test('a proposal: not interested, saying why, as the reviewed decisions do',()=>{
  assert.equal(proposeDecision(none,['HSPW'],names).why,'No lobbying filings in 2024–2025; no federal contracts in fiscal 2024–2025');
  const bank={lobbying:{match:['First Bank'],issues:['BAN'],filings:4},contracts:{agencies:{'Department of the Interior':100}}};
  const d=proposeDecision(bank,['HSPW'],names);
  assert.equal(d.interested,false);
  assert.equal(d.why,'Lobbies only on banking, which their committees don’t handle; contracts only from Department of the Interior, which their committees don’t oversee');
  assert.equal(proposeDecision(undefined,['HSPW'],names),null,'never proposed without its lookup');
});

test('every issue code a committee handles has a name, and committee names are short',()=>{
  for(const codes of Object.values(COMMITTEE_ISSUES))for(const c of codes)assert.ok(ISSUE_NAMES[c],c);
  assert.equal(committeeLabel('HSPW',names),'Transportation and Infrastructure');
  assert.equal(committeeLabel('SSCM',names),'Commerce, Science, and Transportation');
  assert.equal(committeeLabel('XXXX',names),'XXXX');
});

test('proposals skip reviewed decisions and public employers, and list what is not looked up yet',()=>{
  const item=org=>({kind:'income',year:2025,x:{source:org}});
  const members=[{id:'pat',name:'Pat Doe',committees:['HSPW'],items:[item('Acme Corp'),item('Uber Technologies'),item('State of Ohio Retirement'),item('Mystery LLC')]}];
  const lookups={'Acme Corp':none,'Uber Technologies':{lobbying:{match:['Uber'],issues:['TRA'],filings:2},contracts:null}};
  const reviews={people:{pat:{orgs:{'Acme Corp':{interested:false,why:'reviewed'}}}}};
  const p=proposeAll(members,lookups,reviews,names).pat;
  assert.deepEqual(Object.keys(p.orgs),['Uber Technologies']);assert.deepEqual(p.pending,['Mystery LLC']);
});

test('approving: a member\'s proposals become reviewed decisions, never over a reviewed one, and only with nothing pending',()=>{
  const reviews={people:{pat:{name:'Pat Doe',committees:['HSPW'],orgs:{'Acme Corp':{interested:false,why:'reviewed by hand'}}}}};
  const proposals={people:{pat:{name:'Pat Doe',committees:['HSPW'],orgs:{'Acme Corp':{interested:true,why:'x',proposed:true},'Uber':{interested:true,why:'lobbied',proposed:true}},pending:[]},
    sam:{name:'Sam Roe',committees:['HSVR'],orgs:{},pending:['Mystery LLC']}}};
  const r=approve(reviews,proposals,['pat','sam','nobody'],'2026-12-01');
  assert.deepEqual(r.moved,['pat']);
  assert.deepEqual(r.skipped,['sam: 1 organization not looked up yet','nobody: no proposals']);
  assert.deepEqual(reviews.people.pat.orgs['Acme Corp'],{interested:false,why:'reviewed by hand'},'the reviewed decision stays');
  assert.deepEqual(reviews.people.pat.orgs.Uber,{interested:true,why:'lobbied',approved:'2026-12-01'});
  assert.ok(!proposals.people.pat&&proposals.people.sam,'approved ones leave the proposals');
});

test('the lookup saves as it goes and goes on from where it stopped; npm scripts for propose and approve',()=>{
  const src=read('../scripts/match-conflicts.mjs'),pkg=JSON.parse(read('../package.json'));
  assert.ok(src.includes("if(n%10===0)save();")&&src.includes("process.on('SIGINT',()=>{save();"));
  assert.ok(src.includes('!cache.orgs[org]&&!notAnInterest(org,nameOf[m.id]||m)'),'only what isn\'t looked up yet');
  assert.equal(pkg.scripts['conflicts:propose'],'node scripts/match-conflicts.mjs propose');
  assert.equal(pkg.scripts['conflicts:approve'],'node scripts/match-conflicts.mjs approve');
});
