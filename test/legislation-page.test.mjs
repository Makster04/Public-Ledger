// The Legislation tab (public/legislation-page.js): bill numbers and status, party splits, which vote a group wanted, each
// group's money and whether it lists few donors, whether the lawmakers it helped voted its way, the filters, and the
// card; checked against the site's own research too.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {billNumber,billStatus,stageLine,partySplit,wantedOn,groupMoney,moneyTotal,legislationModel,helpedVoted,filterBills,cardHTML,gridHTML,pfText,normVote} from '../public/legislation-page.js';

test('a bill\'s number, and where it stands in its own words',()=>{
  assert.deepEqual(billNumber('119-hr-1'),{num:'H.R. 1',congress:119});
  assert.deepEqual(billNumber('119-sjres-77'),{num:'S.J.Res. 77',congress:119});
  assert.deepEqual(billNumber('117-samdt-1858'),{num:'S.Amdt. 1858',congress:117});
  assert.equal(billStatus({status:'law'}).key,'law');
  assert.deepEqual(billStatus({status:'not',stage:'Passed the House 220–208 on Apr. 10, 2025; the Senate never voted.'}),{key:'passed',label:'Passed the House'});
  assert.deepEqual(billStatus({status:'not',stage:'The Senate passed S.J.Res. 77 (50–46, Oct. 28, 2025). The House never took it up.'}),{key:'passed',label:'Passed the Senate'});
  assert.equal(billStatus({status:'not',stage:'Fell short of 60 votes in the Senate twice in 2022.'}).label,'Failed in the Senate');
  assert.equal(billStatus({status:'not',stage:'Approved 8–7 by the Homeland Security committee on July 30, 2025.'}).label,'Through committee');
  assert.equal(billStatus({status:'not',stage:'Introduced Sept. 3, 2025, with 16 original cosponsors.'}).label,'Introduced');
  assert.equal(billStatus({status:'not'}).label,'Didn\'t pass');
  assert.equal(stageLine({stage:'Passed the House 231–195 on Dec. 11, 2025; the Senate never voted.'}),'Passed the House 231–195 on Dec. 11, 2025','an abbreviation like "Dec." doesn\'t end the line');
});

test('party splits, House Aye and No, and the vote a group wanted',()=>{
  assert.equal(partySplit({R:{Yea:50,Nay:3},D:{Nay:45},I:{Nay:2}}),'R 50–3 · D 0–45 · I 0–2');
  assert.equal(partySplit(null),'');
  assert.deepEqual(['Aye','No','Yea','Present'].map(normVote),['Yea','Nay','Yea','Present']);
  const passage={id:'119-1-372',question:'On passage'},table={id:'x',question:'On the motion to table'};
  assert.equal(wantedOn(passage,{pos:'support'}),'Yea');assert.equal(wantedOn(passage,{pos:'oppose'}),'Nay');
  assert.equal(wantedOn(table,{pos:'support'}),null,'on a motion to table, Yea can mean the opposite: not counted');
  assert.equal(wantedOn(table,{pos:'oppose',vote:'x'}),'Nay','unless the group\'s side came from that very roll call');
});

const data={ie:{cm:[['C90011111','Some Action Fund','other'],['C00222222','Big Super PAC','super_pac']]},
  members:[{id:'a',funderPos:[{key:'g1',for:1000,pac:5000,spenders:['Some Action Fund']},{key:'g2',against:700}]},{id:'b',funderPos:[{key:'g1',routed:200},{key:'g2',for:50,spenders:['Big Super PAC']}]}],
  cands:[],featured:[],groupPos:[],
  billIndex:[{id:'119-hr-9',title:'Test Act',status:'not',stage:'Passed the House 1–0 on Jan. 2, 2025.',area:'Housing',groups:[{group:'g1',pos:'support'},{group:'g2',pos:'oppose'}]},
    {id:'119-s-3',title:'Other Act',status:'law',law:'Public Law 119-3',date:'2025-03-01',area:'Labor & workers',groups:[]}],
  votes:[],hvotes:[{id:'h-119-1-001',date:'2025-01-02',bill:{measure:'H.R. 9 (119th Congress)'},question:'On passage',result:'Passed 1-0',pos:{a:'Aye',b:'No'}}]};

test('each group\'s money in the tracked races, the lawmakers it helped, and whether it lists few donors',()=>{
  const m=groupMoney(data),g1=m.get('g1'),g2=m.get('g2');
  assert.deepEqual([g1.for,g1.pac,g1.routed,moneyTotal(g1)],[1000,5000,200,6200]);assert.deepEqual([...g1.helped],['a','b']);
  assert.equal(g1.fewDonors,true,'an outside spender behind it files as a group (C9), listing only gifts given for its ads');
  assert.deepEqual([[...g2.helped],[...g2.opposed],g2.fewDonors],[['b'],['a'],false]);
});

test('the bills, with their sides, money, status, votes and whether the lawmakers a group helped voted its way',()=>{
  const bills=legislationModel(data,{scored:[],voteParty:{'h-119-1-001':{R:{Yea:1}}},orgOf:k=>k.toUpperCase()});
  const b=bills.find(x=>x.id==='119-hr-9');
  assert.deepEqual([b.num,b.congress,b.st.label,b.votes.length,b.votes[0].party.R.Yea],['H.R. 9',119,'Passed the House',1,1]);
  assert.deepEqual([b.sides.for.map(g=>g.org),b.sides.against.map(g=>g.org),b.moneyFor,b.moneyAgainst,b.fewDonors],[['G1'],['G2'],6200,750,1]);
  assert.deepEqual(helpedVoted(b,b.sides.for[0]),{n:2,ok:1},'a voted Aye, as g1 wanted; b voted No');
  assert.deepEqual(helpedVoted(b,b.sides.against[0]),{n:1,ok:1},'g2 helped b, who voted No, as g2 wanted');
  assert.deepEqual(filterBills(bills,{status:'law'}).map(x=>x.id),['119-s-3']);
  assert.deepEqual(filterBills(bills,{q:'g2'}).map(x=>x.id),['119-hr-9'],'search finds a bill by a group on its side');
  assert.deepEqual(filterBills(bills,{area:'Labor & workers'}).map(x=>x.id),['119-s-3']);
  assert.deepEqual(filterBills(bills,{sort:'money'}).map(x=>x.id),['119-hr-9','119-s-3']);
  assert.deepEqual(filterBills(bills,{sort:'newest'}).map(x=>x.id),['119-s-3','119-hr-9']);
});

test('a card: its number, status, link, votes, money and flags, with names escaped',()=>{
  const [b]=legislationModel({...data,billIndex:[{...data.billIndex[0],title:'A <b> Act'}]},{scored:[],orgOf:k=>k});
  const h=cardHTML({...b,pf:-100});
  assert.match(h,/H\.R\. 9 · 119th Congress/);assert.match(h,/Passed the House/);assert.match(h,/href="#legislation-119-hr-9"/);
  assert.match(h,/A &lt;b&gt; Act/);assert.match(h,/1 for · 1 against/);assert.match(h,/\$6,200 <em>its backers<\/em>/);
  assert.match(h,/People First: -100 for the wealthy/);assert.match(h,/1 group on a side lists few donors/);
  assert.match(gridHTML([b],{status:'law'}),/0 of 1 bills/);
  assert.deepEqual([pfText(75),pfText(-50),pfText(0),pfText(null)],['+75 for working people','-50 for the wealthy','Even',null]);
});

test('the site\'s own research: every bill has a number and status, and its roll calls are matched',()=>{
  const research=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
  const bills=legislationModel(research,{scored:[],orgOf:k=>k});
  assert.equal(bills.length,(research.billIndex||[]).length);
  for(const b of bills){assert.ok(b.num&&b.congress,`${b.id} has a number`);assert.ok(['law','passed','not'].includes(b.st.key));}
  const ob=bills.find(b=>b.id==='119-hr-1');assert.ok(ob.votes.length>=3,'the One Big Beautiful Bill Act\'s House and Senate roll calls');
  assert.ok(ob.sides.for.length&&ob.sides.against.length);
});
