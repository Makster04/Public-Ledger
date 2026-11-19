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
  assert.equal(R.people.length,59);
  for(const p of R.people)assert.ok(p.id&&p.name&&['S','H'].includes(p.chamber),p.id);
  for(const id of ['collins','marshall','husted','hydesmith','perry','lawler','paxton','fitzpatrick'])assert.ok(R.ids.has(id),id);
  for(const id of ['ossoff','sullivan','peltola','booker'])assert.ok(!R.ids.has(id),`${id} stays (won, or Alaska not called)`);
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
