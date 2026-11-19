// The state legislative records of the House members-elect who served in a state legislature (since Nov. 19, 2026):
// their chambers and years from their Wikipedia article's infobox (scripts/build-members-elect.mjs), an entry in
// data/config.json (elect: true) that gets only the Open States and LegiScan checks, the entry becoming their basic
// profile with the same ID once the new House is read, and the service shown on their profile. Also the full profiles
// whose state legislature is another state's (Ojeda: West Virginia), and names written as initials.
import {withRemovedConfig} from './fixtures/with-removed.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import configFile from '../data/config.json' with {type:'json'};
import electFile from '../public/members-elect.json' with {type:'json'};
import research from '../public/research.json' with {type:'json'};
import {stateLegBody,stateLegTerms,stateLegEntries,legislatureState,addStateLeg,electConfig,newMembers} from '../scripts/build-members-elect.mjs';
import {stateLegYears} from '../scripts/build-ids.mjs';
import {addMembers} from '../scripts/build-house.mjs';
import {FEEDS,sameName,STATE_COVERAGE_FROM} from '../src/feeds.mjs';
import {initialize,statement} from '../src/refresh.mjs';
import {openDatabase} from '../scripts/sqlite.mjs';
const config=withRemovedConfig(configFile);
const migration=await fs.readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');

// An infobox as the articles write it: the House seat they won, leadership posts, a seat field, a second term without an
// office of its own, an end hidden in a comment, a city office and a U.S. office.
const BOX=`{{Infobox officeholder
| name               = Pat Example
| office             = Member-elect of the [[U.S. House of Representatives]]
| term_start         = January 3, 2027
| term_end           =
| office1            = Majority Leader of the [[Michigan Senate]]
| term_start1        = January 11, 2023
| term_end1          = <!-- January 3, 2027 -->
| office2            = Member of the [[Michigan Senate]]
| term_start2        = January 1, 2019
| term_end2          = <!-- January 3, 2027 -->
| state_house3       = Michigan
| term_start3        = January 1, 2011
| term_end3          = December 31, 2014
| term_start4        = January 1, 2005
| term_end4          = December 31, 2008
| office5            = Member of the [[Lansing City Council]]
| term_start5        = 2001
| term_end5          = 2004
| office6            = Member of the [[United States House of Representatives]]
| term_start6        = 1995
| term_end6          = 1997
}}
'''Pat Example''' is a politician.`;

test('the chambers and years come from the infobox: leadership posts join the seat, a term without an office is the one above',()=>{
  const terms=stateLegTerms(BOX,'Michigan');
  assert.deepEqual(terms,[{chamber:'Michigan House of Representatives',from:2005,to:2008},{chamber:'Michigan House of Representatives',from:2011,to:2014},{chamber:'Michigan Senate',from:2019,to:null}]);
  assert.deepEqual(stateLegEntries(terms),['Michigan Senate, 2019–present','Michigan House of Representatives, 2005–2008, 2011–2014'],'newest first, in the research\'s form');
  assert.deepEqual(stateLegYears(stateLegEntries(terms),2026),[2005,2026],'read back the way the full profiles are');
  assert.deepEqual(stateLegTerms('No infobox here.','Michigan'),[]);
  // A seat field names the state ("California State"), and West Virginia's legislature isn't Virginia's.
  assert.deepEqual(stateLegTerms('{{Infobox officeholder\n| state_senate1 = California State\n| term_start1 = December 5, 1994\n| term_end1 = December 31, 2000\n| state_assembly2 = California\n| term_start2 = 1992\n| term_end2 = 1994\n}}','California').map(t=>t.chamber),['California State Assembly','California State Senate']);
  assert.deepEqual(stateLegTerms('{{Infobox officeholder\n| office1 = Member of the [[West Virginia Senate]]\n| term_start1 = 2016\n| term_end1 = 2019\n}}','Virginia'),[]);
});

test('who served: the background names a chamber of their own state\'s legislature, not Congress or another state',()=>{
  assert.deepEqual(stateLegBody('Michigan Senate ; Michigan House of Representatives','Michigan'),['Michigan Senate','Michigan House of Representatives']);
  assert.deepEqual(stateLegBody('Majority Leader of the Nevada State Assembly','Nevada'),['Majority Leader of the Nevada State Assembly']);
  assert.deepEqual(stateLegBody('U.S. House of Representatives ; Mobile County Commission','Alabama'),[]);
  assert.deepEqual(stateLegBody('West Virginia Senate','Virginia'),[]);
  assert.deepEqual(stateLegBody('Mayor of Hartford','Connecticut'),[]);
  assert.equal(legislatureState(['West Virginia Senate, District 7, December 2016–January 2019 (resigned)']),'WV');
  assert.equal(legislatureState(['Maine Senate (District 1), 2016–2024']),'ME');
  assert.equal(legislatureState(['Mayor of Evanston']),null);
});

test('the step: each member-elect who served gets their service and its source; config entries are added, kept and dropped',async()=>{
  const rows=newMembers(`== House of Representatives ==
{| class="wikitable"
|-
! {{ushr|MI|11|X}}
| [[File:x.jpg]]
| {{party shading/Democratic}} |{{sortname|Pat|Example|Pat Example (politician)}} (D)
| [[2026 elections|No]]<br />{{small|Open seat; replacing Someone (D)}}
| [[Michigan Senate]]
| 1980
| <ref>{{cite web|url=https://example.org/win|title=Example wins|date=November 4, 2026}}</ref>
|}
====Non-voting delegates====`);
  assert.equal(rows[0].page,'Pat Example (politician)','the article the name links to');
  const members=[{id:'example',name:'Pat Example',short:'Example',state:'MI',stateName:'Michigan',district:11,seat:'MI-11',background:'Michigan Senate'},
    {id:'other',name:'Lee Other',short:'Other',state:'TX',stateName:'Texas',district:9,seat:'TX-9',background:'Community organizer'}];
  const asked=[];
  const found=await addStateLeg(members,rows,{read:async t=>{asked.push(t);return BOX;},now:2026});
  assert.deepEqual(asked,['Pat_Example_(politician)'],'only those who served are read');
  assert.equal(found.length,1);
  assert.deepEqual(members[0].stateLeg,['Michigan Senate, 2019–present','Michigan House of Representatives, 2005–2008, 2011–2014']);
  assert.deepEqual(members[0].stateLegYears,[2005,2026]);
  assert.deepEqual(members[0].stateLegSrc,{t:'Wikipedia: Pat Example (politician)',u:'https://en.wikipedia.org/wiki/Pat_Example_(politician)'});
  assert.equal(members[1].stateLeg,undefined);
  // Config: added as elect and light with no FEC or congressional IDs; a hand-set Open States ID stays; a member-elect who
  // left the file is dropped; someone else's ID is never taken over.
  const cfg={people:[{id:'example',elect:true,openstates:'ocd-person/x',nicknames:['Patty']},{id:'gone',elect:true},{id:'collins',name:'Susan Collins'}]};
  const extra={id:'collins',name:'Pat Collins',short:'Collins',state:'MI',stateName:'Michigan',district:5,seat:'MI-5',stateLeg:['Michigan Senate, 2019–2023'],stateLegYears:[2019,2023]};
  const r=electConfig(cfg,[...members,extra]);
  assert.deepEqual(r,{added:[],dropped:['gone']});
  const e=cfg.people.find(p=>p.id==='example');
  assert.deepEqual(e,{id:'example',name:'Pat Example',short:'Example',bioguide:null,lis:null,fecCand:null,fecCmte:null,chamber:'H',state:'MI',district:11,race:null,
    elect:true,light:true,stateLeg:'MI',stateLegYears:[2005,2026],openstates:'ocd-person/x',legiscan:null,nicknames:['Patty']});
  assert.equal(cfg.people.find(p=>p.id==='collins').name,'Susan Collins');
  assert.deepEqual(electConfig({people:[]},members),{added:['example'],dropped:[]});
});

test('the files: every member-elect who served has their entry, with the same state and years; nobody else is marked elect',()=>{
  const served=electFile.members.filter(m=>m.stateLeg?.length),elect=configFile.people.filter(p=>p.elect);
  assert.ok(served.length>=25,`${served.length} members-elect served in a state legislature`);
  assert.deepEqual(elect.map(p=>p.id).sort(),served.map(m=>m.id).sort());
  for(const m of served){
    const p=elect.find(x=>x.id===m.id);
    assert.equal(p.stateLeg,m.state,m.id);assert.deepEqual(p.stateLegYears,m.stateLegYears,m.id);
    assert.ok(p.light&&!p.fecCand&&!p.fecCmte&&!p.bioguide&&!p.ids,m.id);
    assert.match(m.stateLegSrc.u,/^https:\/\/en\.wikipedia\.org\/wiki\//);
    for(const e of m.stateLeg)assert.match(e,/, \d{4}–(\d{4}|present)/,m.id);
  }
  // Solis served 1992–2000, before Open States and LegiScan cover California: not searched, said so.
  assert.ok(configFile.people.find(p=>p.id==='solis').stateLegYears[1]<STATE_COVERAGE_FROM);
  // The full profiles: Ojeda served in West Virginia's legislature, Trone Garriott in Iowa's, from their own research.
  const ent=id=>[...research.members,...research.cands].find(s=>s.id===id).stateLeg;
  assert.deepEqual([configFile.people.find(p=>p.id==='ojeda').stateLeg,configFile.people.find(p=>p.id==='ojeda').stateLegYears],[legislatureState(ent('ojeda')),stateLegYears(ent('ojeda'))]);
  assert.deepEqual([configFile.people.find(p=>p.id==='tronegarriott').stateLeg,configFile.people.find(p=>p.id==='tronegarriott').stateLegYears[0]],['IA',2021]);
});

test('refresh: a member-elect gets the Open States and LegiScan checks, and nothing else',async()=>{
  const db=openDatabase(':memory:');db.exec(migration);db.exec("INSERT INTO metadata VALUES ('initialized','test')");
  await initialize(db);
  for(const id of ['moss','fordin']){
    const kinds=(await statement(db,'SELECT kind FROM jobs WHERE subject=?',id).all()).results.map(r=>r.kind).sort();
    assert.deepEqual(kinds,['state-legiscan','state-openstates'],id);
  }
  const a=FEEDS['state-legiscan'].jobs(config).find(j=>j.subject==='moss').args;
  assert.deepEqual([a.state,a.name,a.last,a.years],['MI','Jeremy Moss','Moss',[2015,2026]]);
  const o=FEEDS['state-openstates'].jobs(config).find(j=>j.subject==='ojeda').args;
  assert.equal(o.state,'wv','Ojeda is searched in West Virginia');
  // A member-elect without state service has no entry and no checks.
  assert.equal((await statement(db,"SELECT COUNT(*) n FROM jobs WHERE subject='carl'").first()).n,0);
});

test('names written as initials match however a list writes them',()=>{
  const ford={name:'J. D. Ford'};
  assert.ok(sameName('J.D.','Ford',ford));assert.ok(sameName('JD','Ford',ford));assert.ok(sameName('J. D.','Ford',ford));
  assert.ok(!sameName('Jeremy','Ford',ford));assert.ok(!sameName('A.J.','Ford',ford));
  assert.ok(sameName('Raymond','Smith',{name:'Raymond Smith Jr.'}));assert.ok(!sameName('R.','Smith',{name:'Raymond Smith Jr.'}));
});

test('once the new House is read, a member-elect\'s entry becomes their basic profile with the same ID and state record',()=>{
  const leg=(bio,first,last,state,district)=>({id:{bioguide:bio,fec:[`H6${state}0${district}000`]},name:{first,last,official_full:`${first} ${last}`},
    terms:[{type:'rep',state,district,party:'Democrat',start:'2027-01-03',end:'2029-01-03',url:'https://x.house.gov'}]});
  const cfg={people:[{id:'moss',name:'Jeremy Moss',short:'Moss',bioguide:null,chamber:'H',state:'MI',district:11,elect:true,light:true,stateLeg:'MI',stateLegYears:[2015,2026],openstates:'ocd-person/m',legiscan:null},
    {id:'mossx',name:'Other Moss',bioguide:'M000009',chamber:'H',state:'TX',district:1,basic:true,light:true}]};
  const r=addMembers([leg('M000001','Jeremy','Moss','MI',11),leg('M000009','Other','Moss','TX',1),leg('N000001','Kim','Moss','CA',3)],cfg,{members:[],cands:[]});
  const moss=cfg.people.filter(p=>p.state==='MI');
  assert.equal(moss.length,1,'the elect entry is replaced');
  assert.deepEqual([moss[0].id,moss[0].bioguide,moss[0].basic,moss[0].elect,moss[0].stateLeg,moss[0].stateLegYears,moss[0].openstates],['moss','M000001',true,undefined,'MI',[2015,2026],'ocd-person/m']);
  assert.equal(cfg.people.find(p=>p.state==='CA').stateLeg,undefined,'a new member who wasn\'t a member-elect with an entry gets none');
  assert.notEqual(cfg.people.find(p=>p.state==='CA').id,'moss');
  assert.equal(r.members.find(m=>m.bioguide==='M000001').id,'moss');
});

test('the page: a basic profile shows the service and the State legislative record; a sitting legislator is labeled so',async()=>{
  const app=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/function stateServiceBlock\(s\)/);
  assert.match(app,/<div id="rec-state">\$\{stateRecordBlock\(s\)\|\|stateServiceBlock\(s\)\}<\/div>/,'in the record on the Ideology tab');
  assert.match(app,/\['crs','official-acts','stateBills','committees','votes'\]\);/,'which reads the state record');
  assert.match(app,/if\(!s\.elect\|\|!\(s\.stateLeg\|\|\[\]\)\.length\)return '';/,'members-elect only: the full profiles have their reviewed state record');
  assert.match(app,/\(s\.stateLegYears\|\|\[\]\)\[1\]<2010\?`Open States and LegiScan cover state legislatures from about 2010/,'a career before then says so');
  const live=await fs.readFile(new URL('../public/live.js',import.meta.url),'utf8');
  assert.match(live,/e\?\.status===404\?'<div class="live-empty">The refresh doesn\\'t read official records for this profile yet/,'a member-elect the refresh doesn\'t read yet');
  assert.match(app,/\(s\.stateLeg\|\|\[\]\)\.some\(e=>\/present\/i\.test\(e\)\)\?'State legislator':'Former state legislator'/);
});
