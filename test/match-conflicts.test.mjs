import test from 'node:test';
import assert from 'node:assert/strict';
import {orgOf,nameCandidates,notAnInterest,itemAmount,buildRecord,fullCommittee} from '../scripts/match-conflicts.mjs';
import {conflictsComponent} from '../public/integrity.js';

test('organization names keep every word; lookups try the name without the city', ()=>{
  assert.equal(orgOf({source:'Emory Healthcare Atlanta, GA'}),'Emory Healthcare Atlanta, GA');
  assert.equal(orgOf({terms:'Penguin Random House LLC New York, New York · Royalty Agreement · Advance'}),'Penguin Random House LLC New York, New York');
  assert.deepEqual(nameCandidates('Emory Healthcare Atlanta, GA'),['Emory Healthcare Atlanta','Emory Healthcare']);
  assert.ok(nameCandidates("St. Martin's Publishing Group New York, NY").includes("St. Martin's Publishing Group"));
  assert.ok(nameCandidates('Chipotle Mexican Grill, Inc. Newport Beach, CA').includes('Chipotle Mexican Grill, Inc.'));
  assert.deepEqual(nameCandidates('Aspen Institute'),['Aspen Institute']);
  assert.equal(fullCommittee('SSAF13'),'SSAF');
});

test('public employers, own trusts and churches are never interested', ()=>{
  assert.ok(notAnInterest('Colorado PERA DC Plan Denver, CO',{name:'John Hickenlooper'}));
  assert.ok(notAnInterest("2001 Grandchildren's Trust FBO Omaha, NE",{name:'Pete Ricketts'}));
  assert.ok(notAnInterest('First Methodist Church',{name:'A B'}));
  assert.equal(notAnInterest('Chipotle Mexican Grill, Inc. Newport Beach, CA',{name:'John Hickenlooper'}),null);
});

test('Senate spouse income "over $1,000" has no amount', ()=>{
  assert.equal(itemAmount('income',{amounts:[1000],text:'Spouse · Salary · Emory · &gt; $1,000 · n/a'}),null);
  assert.equal(itemAmount('income',{amounts:[12000,500],text:'Board fees'}),12500);
  assert.equal(itemAmount('gifts',{value:7609.61}),7609.61);
  assert.equal(itemAmount('travel',{}),null);
});

const member={id:'x',name:'Pat Doe',report:{year:2025,url:'https://example.gov/r'},items:[
  {kind:'income',year:2025,x:{source:'Acme Corp Denver, CO',type:'Director fees',amounts:[40000],text:'Acme · $40,000'}},
  {kind:'positions',year:2025,x:{position:'Director',org:'Acme Corp Denver, CO'}},
  {kind:'travel',year:2024,x:{source:'Aspen Institute',from:'04/18/2024',to:'04/26/2024'}},
  {kind:'positions',year:2025,x:{position:'Trustee',org:'Doe Family Trust'}}]};

test('a record is built only when every organization has a decision', ()=>{
  assert.deepEqual(buildRecord(member,{'Acme Corp Denver, CO':{interested:true,why:'lobbies AGR'}},'2026-11-25',{name:'Pat Doe'}),{missing:['Aspen Institute']});
  const rec=buildRecord(member,{'Acme Corp Denver, CO':{interested:true,why:'lobbies AGR'},'Aspen Institute':{interested:false,why:'no lobbying'}},'2026-11-25',{name:'Pat Doe'});
  assert.equal(rec.income[0].amount,40000);
  assert.equal(rec.positions.filter(p=>p.interested).length,1);
  assert.equal(rec.positions[1].interested,false);
  assert.equal(rec.travel[0].dates,'04/18/2024 – 04/26/2024');
  const x=conflictsComponent({id:'x'},{people:{x:rec}});
  assert.equal(x.complete,true);
  assert.ok(x.value<100&&x.value>0);
});

test('an interested income source with no amount counts 20, like a board seat', ()=>{
  const x=conflictsComponent({id:'h'},{people:{h:{report:{year:2025},reviewed:{at:'2026-11-25'},
    income:[{source:'A',amount:null,interested:true},{source:'B',amount:null,interested:true},{source:'C',amount:null,interested:false}],positions:[],agreements:[],gifts:[],travel:[]}}});
  assert.equal(x.income.unstated,2);
  assert.equal(x.outside,40);
  assert.equal(x.value,76);
});
