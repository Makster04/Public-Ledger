// Lobbied Bills inside People First's Corporation Compromised (public/lobbied.js, scripts/build-lobbied-bills.mjs): the
// scored bills a top business donor lobbied on, directly or through a coalition, and the side they took on each.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {orgWords,sameOrg,topBusinessDonors,lobbiedBills} from '../public/lobbied.js';
import {searches,pageClients,billEntries,COALITION} from '../scripts/build-lobbied-bills.mjs';
import {makeScorer} from '../public/scoring.js';
import {pvpScore} from '../public/grades.js';

const read=f=>JSON.parse(fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8'));

test('a PAC\'s name, cut off at 39 characters, comes down to the organization\'s own words',()=>{
  const pac=n=>orgWords(n,{pac:true}).join(' ');
  assert.equal(pac('Chevron Employees Political Action Comm'),'chevron');
  assert.equal(pac('Employees of RTX Corp PAC'),'rtx');
  assert.equal(pac('Merck & CO. Inc. Employees Political Ac'),'merck');
  assert.equal(pac('Jpmorgan Chase & CO. Federal Political'),'jpmorgan chase');
  assert.equal(pac('National Assoc of Convenience Stores PA'),'national association of convenience stores');
  assert.equal(pac('Chugach Alaska Corporation PAC (cac PAC'),'chugach alaska','an unclosed parenthesis goes too');
  assert.equal(pac('Union Pacific Corp. Fund for Effective'),'union pacific');
  assert.equal(orgWords('AT&T SERVICES, INC.').join(' '),'att');
  assert.equal(orgWords('CHEVRON U.S.A. INC.').join(' '),'chevron');
  assert.equal(orgWords('U.S. Chamber of Commerce').join(' '),orgWords('CHAMBER OF COMMERCE OF THE U.S.A.').join(' '));
});

test('a donor and a lobbying client are the same only when the names say so',()=>{
  const d=n=>orgWords(n,{pac:true});
  assert.ok(sameOrg(d('Chevron Employees Political Action Comm'),'CHEVRON U.S.A. INC.'));
  assert.ok(sameOrg(d('Conocophillips Spirit PAC'),'CONOCOPHILLIPS'),'the client\'s name starts the donor\'s');
  assert.ok(sameOrg(d('BAE Systems USA PAC'),'BAE SYSTEMS INC. ELECTRONIC SYSTEMS'),'a two-word donor starts the client\'s');
  assert.ok(sameOrg(d('The Boeing Company PAC'),'THE BOEING COMPANY'));
  assert.ok(!sameOrg(d('The Williams Companies, Inc. Political'),'WILLIAMS-SONOMA, INC.'),'one word must match exactly');
  assert.ok(sameOrg(d('The Williams Companies, Inc. Political'),'THE WILLIAMS COMPANIES, INC.'));
  assert.ok(!sameOrg(d('American Airlines Inc. Political Action'),'AMERICAN'),'a common word alone says nothing');
  assert.ok(!sameOrg(d('National Association of Realtors PAC'),'NATIONAL ASSOCIATION OF HOME BUILDERS'));
  assert.ok(!sameOrg(d('National Association of Realtors PAC'),'NATIONAL ASSOCIATION'));
  assert.ok(!sameOrg([],'ANYONE'));
});

test('their top business donors: business PACs and the business groups compared, largest first',()=>{
  const names=['Boeing Company PAC','Teamsters DRIVE','Exxonmobil PAC','Boeing Company PAC'];
  const business=(i,cat)=>cat!=='labor';
  const rows=[[0,5000,'defense'],[1,9000,'labor'],[2,7000,'oil'],[0,4000,'defense'],[2,0,'oil']];
  const top=topBusinessDonors(rows,names,business,[{org:'U.S. Chamber of Commerce',pac:0,routed:1000},{org:'Nobody',pac:0,routed:0}],2);
  assert.deepEqual(top.map(d=>[d.org,d.amount]),[['Boeing Company PAC',9000],['Exxonmobil PAC',7000]],'gifts add up; the union and the top-2 cut leave the rest out');
  assert.deepEqual(topBusinessDonors(rows,names,business,[{org:'U.S. Chamber of Commerce',pac:0,routed:1000}]).at(-1).words,['chamber','of','commerce']);
  const both=topBusinessDonors([[0,3000,'finance']],['Mortgage Bankers Association PAC'],business,[{org:'Mortgage Bankers Association',pac:2000,routed:0}]);
  assert.deepEqual(both.map(d=>[d.org,d.amount]),[['Mortgage Bankers Association PAC',5000]],'a group and its PAC are one donor');
});

test('Lobbied Bills: the bills a donor lobbied on, directly or through a coalition, and the side they took',()=>{
  const donors=topBusinessDonors([[0,5000,'oil']],['Exxonmobil PAC'],()=>true);
  const lobbying={bills:{a:{clients:[['EXXON MOBIL CORPORATION',null]]},b:{clients:[['EXXONMOBIL',null]]},c:{clients:[['EXXONMOBIL','ENERGY COALITION']]},d:{clients:[['SHELL USA',null]]}}};
  const scored=[{credit:'a',took:'profit'},{credit:'b',took:'profit'},{credit:'c',took:'people'},{credit:'d',took:'profit'},{credit:'e',took:'profit'}];
  const lob=lobbiedBills(scored,donors,lobbying);
  assert.deepEqual([lob.n,lob.profit],[3,2],'"Exxon Mobil" is "ExxonMobil"; the coalition\'s member counts; Shell isn\'t a donor');
  assert.deepEqual(lob.bills.map(b=>b.bill),['a','b','c']);
  assert.equal(lob.bills[2].by[0].via,'ENERGY COALITION');
  assert.equal(lobbiedBills(scored,donors,null),null,'no file: not counted');
});

test('the build: each version\'s two years and both spellings, a search LDA.gov ignored stops, coalitions\' members',()=>{
  const s=searches([{id:'119-hr-1'},{id:'117-hr-842',versions:['118-hr-20','117-samdt-9']}],2025);
  assert.deepEqual(s.filter(x=>x.key==='119-hr-1').map(x=>[x.year,x.text]),[[2025,'"H.R. 1"'],[2025,'"H.R.1"']],'2026 isn\'t here yet');
  assert.deepEqual([...new Set(s.filter(x=>x.credit==='117-hr-842').map(x=>x.key))],['117-hr-842','118-hr-20'],'amendments aren\'t searched');
  const f=(id,desc,client='ACME')=>({filing_uuid:id,client:{id:1,name:client},lobbying_activities:[{description:desc}]});
  const q={key:'119-hr-1',congress:119,text:'"H.R. 1"',year:2025};
  assert.deepEqual(pageClients([f('1','H.R. 1, tax provisions'),f('2','Issues in HR 1'),f('3','H.R. 10')],q).map(r=>r.id),['1','2']);
  assert.throws(()=>pageClients(Array.from({length:10},(_,i)=>f(String(i),'appropriations')),q),/did not filter/);
  assert.ok(COALITION.test('Coalition for Affordable Energy')&&COALITION.test('THE ALLIANCE FOR SAFE ROADS')&&!COALITION.test('ALLIANZ'));
  const donors=[orgWords('Exxonmobil PAC',{pac:true}),orgWords('Boeing Company PAC',{pac:true})];
  assert.deepEqual(billEntries({EXXONMOBIL:'1','ENERGY COALITION':'2',SHELL:'3'},{2:{members:['The Boeing Company','Shell USA']}},donors),[['EXXONMOBIL',null],['The Boeing Company','ENERGY COALITION']]);
});

test('on the profiles: Lobbied Bills joins Corporation Compromised once 3 bills count',()=>{
  const r=read('public/research.json'),sc=makeScorer(r,read('public/committees.json'),read('public/committee-sectors.json').committees||{},read('public/vote-party.json').votes);
  // Someone with business donors and at least 3 scored bills; their largest donor lobbies on every one of them.
  const s=[...r.members,...r.cands].find(p=>sc.businessDonors(p).length&&pvpScore(sc.actionsOf(p)).scored.length>=3);
  assert.ok(s,'a profile to try');
  const scored=pvpScore(sc.actionsOf(s)).scored,donor=sc.businessDonors(s)[0];
  const lobbying={bills:Object.fromEntries(scored.map(a=>[a.credit,{clients:[[donor.words.join(' ').toUpperCase(),null]]}]))};
  const cci=sc.six(s,{lobbying}).peoplefirst.cci;
  assert.equal(cci.lobbied.n,scored.length);
  assert.ok(Math.abs(cci.parts.lobbiedBills-scored.filter(a=>a.took==='profit').length/scored.length*100)<1e-9);
  assert.ok(cci.used.includes('lobbiedBills'));
  assert.equal(sc.six(s,{}).peoplefirst.cci.parts.lobbiedBills,null,'without the file it waits');
});
