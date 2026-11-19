// Taking people off the site (data/removed.json, scripts/remove-people.mjs): on Nov. 19, 2026, everyone who lost the
// Nov. 3 general election. Their profiles and records are gone; their races keep the result.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {removedList,removeFromResearch,moveToLost,lostSeatOf} from '../scripts/remove-people.mjs';
import {addMembers} from '../scripts/build-house.mjs';
import {addSenators} from '../scripts/build-senate.mjs';

const read=f=>JSON.parse(fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8'));
const R=removedList();

test('the list: everyone the site marked Lost on Nov. 19, 2026, each with what identifies them',()=>{
  assert.equal(R.people.length,64,'59; Sen. Dan Sullivan once Alaska was called (Nov. 17); and four House members whose races were called after Nov. 12');
  for(const p of R.people)assert.ok(p.id&&p.name&&['S','H'].includes(p.chamber),p.id);
  for(const id of ['collins','marshall','husted','hydesmith','perry','lawler','paxton','fitzpatrick','sullivan','boebert','mthompson','gmurphy','desjarlais'])assert.ok(R.ids.has(id),id);
  for(const id of ['ossoff','peltola','booker'])assert.ok(!R.ids.has(id),`${id} stays (won)`);
});

test('nobody on the list is left in the data the site serves or the refresh reads',()=>{
  const D=read('public/research.json');
  for(const p of [...D.members,...D.cands])assert.ok(!R.ids.has(p.id),p.id);
  for(const p of read('data/config.json').people)assert.ok(!R.ids.has(p.id),`config: ${p.id}`);
  for(const m of read('public/house.json').members)assert.ok(!R.ids.has(m.id)&&!R.bioguides.has(m.bioguide),`house: ${m.id}`);
  for(const m of read('public/senate.json').senators)assert.ok(!R.ids.has(m.id)&&!R.bioguides.has(m.bioguide),`senate: ${m.id}`);
  for(const f of ['public/attendance.json','public/promises.json','public/group-ratings.json','public/question-statements.json','public/get-it-done.json','public/tracker-history.json'])
    for(const id of Object.keys(read(f).people||{}))assert.ok(!R.ids.has(id),`${f}: ${id}`);
  for(const b of R.bioguides)assert.ok(!fs.existsSync(new URL(`../public/question-evidence/${b}.json`,import.meta.url)),b);
});

test('their races keep the result: the winner\'s profile, and the loser\'s name, party and FEC ID without a profile',()=>{
  const D=read('public/research.json'),ids=new Set([...D.members,...D.cands].map(p=>p.id));
  const me=D.races.find(r=>r.id==='S-ME');
  assert.deepEqual(me.gone.collins,{name:'Susan M. Collins',short:'Collins',party:'R',fecCand:'S6ME00159',bioguide:'C001035',incumbent:true});
  for(const r of D.races)for(const k of r.keys)assert.ok(ids.has(k)||r.gone?.[k],`${r.id}: ${k} is a profile or kept as a result`);
  // Done again, nothing changes.
  const again=structuredClone(D);removeFromResearch(again,R);assert.deepEqual(again,D);
});

test('the directory builders leave out the removed members though the official roster still lists them',()=>{
  const term=(type,state,district)=>[{type,state,district,start:'2025-01-03',end:'2027-01-03'}];
  const rep=(bioguide,last)=>({id:{bioguide,fec:[]},name:{first:'A',last},terms:term('rep','PA','1')});
  const config={people:[]},research={members:[],cands:[],featured:[]};
  const h=addMembers([rep('F000466','Fitzpatrick'),rep('X000001','Keeps')],config,research,R.bioguides);
  assert.deepEqual(h.members.map(m=>m.bioguide),['X000001']);assert.ok(!config.people.some(p=>p.bioguide==='F000466'));
  assert.deepEqual(h.lostSeats,[{state:'PA',district:1,party:null,until:'2027-01-03'}],'their seat stays on the seating chart until the term ends, with no name');
  const sen=(bioguide,last)=>({id:{bioguide,fec:[],lis:'S1'},name:{first:'A',last},terms:term('sen','ME')});
  const s=addSenators([sen('C001035','Collins'),sen('K000383','King')],{people:[]},research,R.bioguides);
  assert.deepEqual(s.senators.map(m=>m.bioguide),['K000383']);assert.deepEqual(s.lostSeats,[{state:'ME',party:null,until:'2027-01-03'}]);
  // Taking someone out of a directory file moves their seat to lostSeats, once.
  const d={members:[{id:'fitzpatrick',bioguide:'F000466',name:'Brian Fitzpatrick',state:'PA',district:1,party:'R',termEnd:'2027-01-03'},{id:'keeps',bioguide:'X000001',state:'PA',district:2,party:'D'}]};
  assert.equal(moveToLost(d,'members',R),1);assert.deepEqual(d.lostSeats,[{state:'PA',district:1,party:'R',until:'2027-01-03'}]);assert.deepEqual(d.members.map(m=>m.id),['keeps']);
  d.members.push({id:'fitzpatrick',bioguide:'F000466',state:'PA',district:1,party:'R',termEnd:'2027-01-03'});moveToLost(d,'members',R);assert.equal(d.lostSeats.length,1,'not twice');
  assert.equal(lostSeatOf({state:'OH',party:'R',termEnd:'2026-11-03'}).until,null,'an appointed senator\'s term "ends" on the special election\'s day, but they serve until the winner is sworn in');
});

test('the page: race results show a removed candidate unlinked, and there is no "Lost" filter left',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/if\(r\?\.keys\)return byId\[k\]\|\|\(r\.gone\?\.\[k\]\?\{id:k,\.\.\.r\.gone\[k\],gone:true\}:null\);/);
  assert.match(app,/byId\[k\]\?\{\.\.\.byId\[k\],href:'#'\+k\}:\{id:k,name:k,\.\.\.\(r\.gone\?\.\[k\]\|\|\{\}\),href:''\}/);
  assert.doesNotMatch(app,/\['lost','Lost','Lost a 2026 race'\]/);
});

test('the home filters: the Senate and the House as they sit from Jan. 3, 2027, races not called yet apart, and who leaves then',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/if\(c==='C'\)return nextOf\(s\)===null;/,'Not called yet: a race still counting, in a recount or a runoff');
  assert.match(app,/if\(st==='current'\|\|st==='leaving'\)return sitsNow\(s,c\);/,'Current and Leaving: the chamber they sit in now');
  assert.match(app,/return nextOf\(s\)===c;/,'All: the chamber from Jan. 3');
  assert.match(app,/\['leaving','Leaving Jan\. 3','In office now, not in the next Congress'\]/);
  assert.match(app,/if\(sen\)next=Number\(sen\.nextElection\)>2026\|\|\(o==='won'&&race\.chamber==='S'\)\?'S':o==='pending'\?null:false;/,'a senator not up in 2026, or re-elected');
  assert.match(app,/next=wonHouseSeat\(s\.id\)\?'H':seats\[seatKey\(rep\.state,rep\.district\)\]\?\.pending\?null:false;/,'a House member who won a seat, wherever it is');
  assert.match(app,/const electLabel=c=>c==='S'\?'Senator-elect':'House member-elect';/);
  assert.match(fs.readFileSync(new URL('../public/boot.js',import.meta.url),'utf8'),/fetch\('\/house-seats\.json'/);
  // The data behind it: the next Senate is the 65 senators not up in 2026 and the 35 winners of 2026's races.
  const D=read('public/research.json'),S=read('public/senate.json');
  const up=S.senators.filter(m=>Number(m.nextElection)>2026).length,senateRaces=[...D.races,...D.liteRaces].filter(r=>r.chamber==='S');
  assert.equal(up,65);assert.equal(senateRaces.length,35);assert.ok(senateRaces.every(r=>r.result?.winner),'every 2026 Senate race called (Alaska on Nov. 17)');
  // The House: every seat's winner is someone on the site, once, or the seat waits.
  const seats=read('public/house-seats.json').seats,ids=Object.values(seats).map(x=>x.id).filter(Boolean);
  assert.equal(Object.keys(seats).length,435);assert.equal(new Set(ids).size,ids.length,'nobody holds two seats');
  assert.ok(Object.values(seats).every(x=>x.id||x.pending),'a winner without a profile here would leave a seat out');
  assert.deepEqual([seats['CA-3'].id,seats['FL-20'].id,seats['TX-22'].id],['bera','wassermanschultz','nehlstx'],'members who moved districts, and Troy Nehls\'s seat to his brother');
});
