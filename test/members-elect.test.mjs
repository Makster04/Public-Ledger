// The House members-elect (scripts/build-members-elect.mjs, public/members-elect.json) and how the page shows them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {districtOf,newMembers,electionBox,districtSection,nameFits,outOf,campOf} from '../scripts/build-members-elect.mjs';
const read=f=>JSON.parse(fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8'));
const E=read('public/members-elect.json'),D=read('public/research.json'),house=read('public/house.json').members,senate=read('public/senate.json').senators;
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('districts, names and counts are read from Wikipedia\'s markup',()=>{
  assert.equal(districtOf('! {{ushr|NC|9|X}}'),'NC-09');assert.equal(districtOf("![[Arizona's 6th congressional district|Arizona 6]]"),'AZ-06');
  assert.equal(districtOf('! {{ushr|WY|AL|X}}'),'WY-AL');assert.equal(districtOf('! nothing'),null);
  const page=`== House of Representatives ==\n{| class="wikitable"\n! District\n! Representative\n|-\n! {{ushr|NC|9|X}}\n| [[File:x.jpg]]\n| {{party shading/Democratic}} | {{sortname|Richard|Ojeda}} (D)\n| [[x|Yes]]<br>{{small|Defeated [[Richard Hudson (American politician)|Richard Hudson]] (R)}}\n| [[West Virginia Senate]]\n| 1970\n| <ref>{{cite web|url=https://example.org/ojeda|title=Ojeda wins|website=[[WFAE]]|date=November 4, 2026}}</ref>\n|-\n! {{ushr|MN|2|X}}\n| \n| {{party shading/DFL}}| {{sortname|Matt|Little}} (DFL)\n| [[x|No]]<br>{{small|Open seat; replacing [[Angie Craig]] (DFL)}}\n| Lawyer\n| 1984\n| \n|}\n====Non-voting delegates====`;
  const rows=newMembers(page);
  assert.deepEqual(rows.map(r=>[r.district,r.first,r.last,r.party,r.switched,r.how,r.born]),[['NC-09','Richard','Ojeda','D',true,'Defeated Richard Hudson (R)','1970'],['MN-02','Matt','Little','D',false,'Open seat; replacing Angie Craig (DFL)','1984']]);
  assert.deepEqual(rows[0].ref,{u:'https://example.org/ojeda',t:'Ojeda wins',site:'WFAE',date:'November 4, 2026'});
  const sec=districtSection('==District 8==\nx\n==District 9==\n{{Infobox election\n| reporting = 99\n| candidate1 = [[Richard Ojeda]]\n| party1 = Democratic Party (United States)\n| popular_vote1 = \'\'\'138,707\'\'\'\n| percentage1 = \'\'\'51.1%\'\'\'\n| nominee2 = Amy Chai\n| party2 = Republican Party (United States)\n| popular_vote2 = \n| percentage2 = \n}}\n==District 10==\ny','09');
  assert.deepEqual(electionBox(sec),{nominees:[{name:'Richard Ojeda',party:'D',votes:138707,pct:51.1},{name:'Amy Chai',party:'R',votes:null,pct:null}],reporting:99,updated:null},'an empty count stays empty');
  assert.ok(nameFits('TRONE GARRIOTT, SARAH','Sarah Trone Garriott'));assert.ok(nameFits('HAYNES, FREDERICK D III','Frederick Haynes III'));
  assert.ok(!nameFits('JONES, ERIC','Eric Johnson'));
});

test('their money: the principal committee\'s totals, and outside spending for and against them through Sept. 30',()=>{
  const T={principal:new Map([['H1','C1']]),totals:new Map([['C1',{CMTE_NM:'OJEDA FOR NC',TTL_RECEIPTS:'100',INDV_CONTB:'80',INDV_ITEM_CONTB:'50',INDV_UNITEM_CONTB:'30',OTH_CMTE_CONTB:'10',PTY_CMTE_CONTB:'0',TRANF_FROM_OTHER_AUTH_CMTE:'5',CAND_CNTB:'0',CAND_LOAN:'0',TTL_DISB:'60',COH_COP:'40',DEBTS_OWED_BY_CMTE:'0',CVG_START_DT:'20250101',CVG_END_DT:'20261014'}]]),
    committees:new Map([['S1',{type:'O'}],['P1',{type:'X'}]]),
    byCand:new Map([['H1',[{spe_id:'S1',tran_id:'a',file_num:'1',exp_amo:'10',sup_opp:'S',dissem_dt:'01-SEP-26'},{spe_id:'S1',tran_id:'a',file_num:'2',exp_amo:'12',sup_opp:'S',dissem_dt:'01-SEP-26'},{spe_id:'S1',tran_id:'b',file_num:'3',exp_amo:'99',sup_opp:'S',dissem_dt:'02-OCT-26'}]],
      ['H2',[{spe_id:'P1',tran_id:'c',file_num:'4',exp_amo:'7',sup_opp:'O',dissem_dt:'03-SEP-26'}]]])};
  const c=campOf(T,'H1');assert.deepEqual([c.receipts,c.itemized,c.unitemized,c.other,c.cmte,c.start,c.end],[100,50,30,5,'Ojeda For NC','2025-01-01','2026-10-14']);
  const o=outOf(T,'H1',['H2']);
  assert.deepEqual([o.for.super_pac,o.for.party,o.for.total,o.against.total,o.n],[12,7,19,0,2],'the latest version of an item, after Sept. 30 left out, opposing the rival counts for them');
});

test('the members-elect file: each a basic profile with its race, none already on the site',()=>{
  assert.match(E.about,/Unofficial/);assert.ok(E.members.length>50&&E.races.length>=E.members.length);
  const taken=new Set([...D.members,...D.cands,...house,...senate].map(x=>x.id)),covered=new Set([...D.races,...D.liteRaces].map(r=>r.id));
  const ids=new Set();
  for(const m of E.members){
    assert.ok(/^[a-z0-9]+$/.test(m.id)&&!taken.has(m.id)&&!ids.has(m.id),m.id);ids.add(m.id);
    assert.ok(m.elect&&m.name&&['D','R','I'].includes(m.party)&&/^[A-Z]{2}-(\d+|AL)$/.test(m.seat),m.id);
    const r=E.races.find(x=>x.id===m.race);assert.ok(r,m.id+' has a race');assert.equal(r.result.winner,m.id);
    assert.ok(m.call?.u?.startsWith('http'),m.id+': a source for the win');
    if(m.camp)assert.ok(m.camp.receipts>=0&&m.camp.end&&m.camp.cmteId,m.id);
  }
  for(const r of E.races){
    assert.ok(!covered.has(r.id),r.id+' is already on the Races page');
    const keys=r.nominees.map(n=>n.id||n.fecCand);assert.ok(keys.includes(r.result.winner),r.id);
    for(const k of Object.keys(r.result.tally?.shares||{}))assert.ok(keys.includes(k),`${r.id}: ${k}`);
    if(r.held)assert.ok(['D','R','I'].includes(r.held.party),r.id);
    const w=r.nominees.find(n=>(n.id||n.fecCand)===r.result.winner);assert.ok(w.id?ids.has(w.id):D.cands.some(c=>c.id===w.profile),r.id+': the winner has a profile');
  }
  const skip=read('data/members-elect-skip.json').skip;for(const d of Object.keys(skip))assert.ok(!E.races.some(r=>r.district===d),d+' is left out');
});

test('the page shows them: basic profiles, the House page list and the Races page section',()=>{
  assert.match(app,/const ELECT=\(window\.MEMBERS_ELECT\|\|\[\]\)/);assert.match(app,/\[\.\.\.SENATE,\.\.\.HOUSE,\.\.\.ELECT\]/);
  assert.match(app,/function electBlock\(\)/);assert.match(app,/Other House races with a new member/);assert.match(app,/HOUSE · MEMBER-ELECT/);
  assert.ok(app.indexOf('${electBlock()}')>app.indexOf('function renderHouse('),'on the House page');
  assert.match(fs.readFileSync(new URL('../public/boot.js',import.meta.url),'utf8'),/members-elect\.json/);
});
