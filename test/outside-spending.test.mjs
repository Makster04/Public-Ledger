// The outside-spending refresh (scripts/build-outside-spending.mjs, npm run outside:update): the research's rows kept and
// matched to FEC transactions, amendments taking their latest version, rows that repeat a counted transaction dropped,
// new transactions added only after the research's own coverage, and the summaries worked out with its rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {csvLine,parseBulk,raceOf,rootFiles,transactions,outSummary,refreshOutside,refreshElect,committeeTypes,COMPILED_END} from '../scripts/build-outside-spending.mjs';

const head='cand_id,cand_name,spe_id,spe_nam,ele_type,can_office_state,can_office_dis,can_office,cand_pty_aff,exp_amo,exp_date,agg_amo,sup_opp,pur,pay,file_num,amndt_ind,tran_id,image_num,receipt_dat,fec_election_yr,prev_file_num,dissem_dt';
const line=o=>head.split(',').map(k=>`"${o[k]??''}"`).join(',');
const B=(o)=>({cand_id:'S6ME00159',cand_name:'COLLINS, SUSAN',spe_id:'C1',spe_nam:'GOOD PAC',ele_type:'G',can_office_state:'ME',can_office_dis:'',can_office:'S',exp_amo:'100',sup_opp:'S',pur:'MAILER',file_num:'10',amndt_ind:'N',tran_id:'SE.1',receipt_dat:'05-SEP-26',dissem_dt:'04-SEP-26',...o});

test('reading the bulk file: quoted fields, race keys, amendments back to their report',()=>{
  assert.deepEqual(csvLine('"a","b, c","d ""e"""'),['a','b, c','d "e"']);
  const rows=parseBulk([head,line(B({})),line(B({file_num:'11',amndt_ind:'A1',prev_file_num:'10'})),line(B({file_num:'12',amndt_ind:'A2',prev_file_num:'11'}))].join('\n'));
  assert.equal(rows.length,3);assert.equal(rows[0].spe_nam,'GOOD PAC');
  assert.deepEqual([raceOf(rows[0]),raceOf({can_office:'H',can_office_state:'NC',can_office_dis:'11'}),raceOf({can_office:'H',can_office_state:'AK',can_office_dis:'0'})],['S-ME','H-NC-11','H-AK-00']);
  const root=rootFiles(rows);assert.deepEqual([root('12'),root('11'),root('10')],['10','10','10']);
  const tx=transactions(rows,new Set(['S-ME']));assert.equal(tx.size,1,'one item in three versions');assert.equal([...tx.values()][0].length,3);
  // The same ID in two unrelated reports: two items (committees restart at SE.1 in each 24/48-hour report).
  assert.equal(transactions(parseBulk([head,line(B({})),line(B({file_num:'20'}))].join('\n')),new Set(['S-ME'])).size,2);
  // Only general-election support or opposition, in a tracked race.
  assert.equal(transactions(parseBulk([head,line(B({ele_type:'P'})),line(B({can_office_state:'TX'})),line(B({sup_opp:''}))].join('\n')),new Set(['S-ME'])).size,0);
  assert.equal(committeeTypes('C1|GOOD PAC|x|x|x|x|x|x|x|O\nC2|PARTY|x|x|x|x|x|x|x|Y').get('C2'),'Y');
});

// A small research file: Collins (S6ME00159) against Jackson (S6ME00464), one other candidate (S6ME00373).
const research=()=>({ie_asof:'2026-09-30',
  ie:{asof:'2026-09-30',cm:[['C1','Good PAC','super_pac',null,null,1],['C2','Other PAC','super_pac',null,null,1]],purp:['MAILER'],cands:{S6ME00159:'Susan M. Collins'},
    rows:{'S-ME':[
      ['2026-09-04',0,'S6ME00159','S',100,0,'10','','2026-09-05'],          // SE.1, amended later to 150
      ['2026-09-04',0,'S6ME00159','S',100,0,'10','','2026-09-05'],          // SE.2: the same cost, another item
      ['2026-09-30',1,'S6ME00464','O',40,0,'30','p','2026-09-29'],          // a date capped at Sept. 30; really Oct. 3
      ['2026-09-04',0,'S6ME00159','S',150,0,'11','','2026-09-20'],          // SE.1's amendment, also on file: a double count
      ['2026-09-10',1,'S6ME00373','O',9,0,'40','','2026-09-11']]},          // no FEC match: kept as it is
    raceTotal:{'S-ME':399},source:'x'},
  races:[{id:'S-ME',keys:['collins','jackson'],ieTotal:399}],liteRaces:[],
  members:[{id:'collins',race:'S-ME',fecCand:'S6ME00159',camp:{end:'2026-09-30',receipts:1000},
    out:{start:'2025-01-01',end:'2026-09-30',multi:false,incomplete:[],for:{},against:{},parts:{},rivals:[],others:[],excludedPre:{n:0,amount:0},n:5,uncertain:0,cms:[],same:{},dupRemoved:{n:0,amount:0},possibleRepeat:0,pinned:1}}],
  cands:[{id:'jackson',race:'S-ME',fecCand:'S6ME00464',camp:null}]});
const bulk=()=>parseBulk([head,
  line(B({tran_id:'SE.1'})),line(B({tran_id:'SE.2'})),
  line(B({tran_id:'SE.1',file_num:'11',amndt_ind:'A1',prev_file_num:'10',exp_amo:'150',receipt_dat:'20-SEP-26'})),
  line(B({spe_id:'C2',cand_id:'S6ME00464',cand_name:'JACKSON, TROY',sup_opp:'O',exp_amo:'40',file_num:'30',tran_id:'E-1',receipt_dat:'29-SEP-26',dissem_dt:'03-OCT-26'})),
  // After the research's latest filing (Sept. 29): new items. One dated after Sept. 30 is added; one dated by then is
  // left to the research; one from 2024 counts as excluded; a new spender comes in with its own record.
  line(B({tran_id:'SE.9',file_num:'50',receipt_dat:'20-OCT-26',dissem_dt:'18-OCT-26',exp_amo:'500'})),
  line(B({tran_id:'SE.8',file_num:'50',receipt_dat:'20-OCT-26',dissem_dt:'28-SEP-26',exp_amo:'77'})),
  line(B({tran_id:'SE.7',file_num:'50',receipt_dat:'20-OCT-26',dissem_dt:'01-NOV-24',exp_amo:'5'})),
  line(B({spe_id:'C3',spe_nam:'NEW SUPER PAC',cand_id:'S6ME00464',cand_name:'JACKSON, TROY',sup_opp:'S',tran_id:'1',file_num:'60',receipt_dat:'02-NOV-26',dissem_dt:'01-NOV-26',exp_amo:'300',pur:'TV'})),
  // A later report listing the Oct. 18 item again under another ID: a possible repeat, marked.
  line(B({tran_id:'X-4',file_num:'70',receipt_dat:'10-NOV-26',dissem_dt:'18-OCT-26',exp_amo:'500'}))].join('\n'));

test('the refresh: research rows matched and kept, amendments, a double count dropped, new items only after Sept. 30',()=>{
  const {research:D,stats}=refreshOutside(research(),bulk(),{types:new Map([['C3','O']])});
  const rows=D.ie.rows['S-ME'];
  assert.deepEqual([stats.matched,stats.amended,stats.undated,stats.dropped,stats.added,stats.leftToResearch,stats.repeats],[3,1,1,1,3,1,1]);
  assert.equal(rows.filter(r=>r[2]==='S6ME00159'&&r[0]==='2026-09-04').map(r=>r[4]).sort().join(),'100,150','SE.1 at its amended 150 and SE.2 at 100; the amendment row on file is not counted again');
  assert.deepEqual(rows.find(r=>r[2]==='S6ME00464'&&r[3]==='O').slice(0,1).concat(rows.find(r=>r[2]==='S6ME00464'&&r[3]==='O')[7]),['2026-10-03',''],'the capped date restored');
  assert.ok(rows.some(r=>r[2]==='S6ME00373'&&r[9]===''),'a row the FEC file doesn\'t have stays, without an ID');
  assert.ok(!rows.some(r=>r[4]===77),'dated by Sept. 30 but filed later: left to the research');
  assert.ok(rows.every(r=>r.length===10));
  const rep=rows.filter(r=>r[4]===500);assert.deepEqual(rep.map(r=>r[7]).sort(),['D','d']);
  assert.equal(D.ie.cm[2][1],'New Super Pac');assert.equal(D.ie.cm[2][2],'super_pac');assert.equal(D.ie.cands.S6ME00464,'Troy Jackson');
  assert.equal(D.ie.raceTotal['S-ME'],c2(rows.reduce((t,r)=>t+r[4],0)));assert.equal(D.races[0].ieTotal,D.ie.raceTotal['S-ME']);
  assert.equal(D.ie.asof,'2026-11-10');assert.equal(D.ie_asof,'2026-11-10');
  // Collins's summary: for = supporting her + opposing Jackson; against = opposing her + supporting Jackson.
  const o=D.members[0].out;
  assert.deepEqual([o.for.total,o.against.total,o.end,o.pinned,o.possibleRepeat],[c2(150+100+40+500+500),300,'2026-11-10',0,500]);
  assert.deepEqual(o.others,[{cand:'S6ME00373',S:0,O:9}]);
  assert.deepEqual([o.excludedPre,o.dupRemoved],[{n:1,amount:5},{n:1,amount:150}]);
  assert.deepEqual(o.same,{end:'2026-09-30',receipts:1000,forBy:{super_pac:250,other:0,party:0},forAfter:{super_pac:1040,other:0,party:0},for:250,after:1040});
  // A second run changes nothing.
  const again=refreshOutside(D,bulk(),{types:new Map([['C3','O']])});
  assert.deepEqual([again.stats.added,again.stats.amended,again.stats.dropped],[0,0,0]);
  assert.deepEqual(again.research.ie.rows,D.ie.rows);
});
const c2=v=>Math.round(v*100)/100;

test('the summary rules reproduce the research\'s own summaries from its own rows',()=>{
  // The saved data was refreshed with these rules, so a summary worked out from the saved rows is the saved summary.
  const D=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8')),ie=D.ie;
  const kindOf=ci=>ie.cm[ci][2]==='super_pac'?'super_pac':ie.cm[ci][2]==='party'?'party':'other';
  const people=[...D.members,...D.cands],byId=Object.fromEntries(people.map(p=>[p.id,p]));let n=0;
  for(const s of people){if(!s.out||!s.fecCand||!ie.rows[s.race])continue;
    const race=D.races.find(r=>r.id===s.race),rivals=race?race.keys.filter(k=>k!==s.id).map(k=>byId[k]?.fecCand).filter(Boolean):(D.liteRaces.find(r=>r.id===s.race)?.nominees||[]).map(x=>x.fecCand).filter(c=>c&&c!==s.fecCand);
    if(!race&&!D.liteRaces.some(r=>r.id===s.race))continue;
    const x=outSummary(ie.rows[s.race],{me:s.fecCand,rivals,multi:!!s.out.multi,start:s.out.start,end:s.out.end,camp:s.camp,kindOf});
    assert.deepEqual([x.for,x.against,x.n],[s.out.for,s.out.against,s.out.n],s.id);n++;}
  assert.ok(n>=60,`${n} summaries`);
  assert.equal(ie.asof,D.ie_asof);assert.ok(ie.asof>COMPILED_END,'past the research\'s own coverage');
  for(const rows of Object.values(ie.rows))for(const r of rows)assert.equal(r.length,10);
});

test('members-elect: each winner\'s outside spending again through the same date, nothing else changed',()=>{
  const E={members:[{id:'m',fecCand:'H6AL01000',race:'H-AL-01',out:{for:{total:0}},name:'Keep'}],races:[{id:'H-AL-01',nominees:[{fecCand:'H6AL01000'},{fecCand:'H6AL01999'}]}]};
  const rows=parseBulk([head,line(B({cand_id:'H6AL01000',can_office:'H',can_office_state:'AL',can_office_dis:'01',dissem_dt:'01-NOV-26',receipt_dat:'02-NOV-26'})),
    line(B({cand_id:'H6AL01999',can_office:'H',can_office_state:'AL',can_office_dis:'01',sup_opp:'O',tran_id:'SE.5',exp_amo:'20'}))].join('\n'));
  const {elect,n}=refreshElect(E,rows,new Map([['C1','O']]),'2026-11-17');
  assert.equal(n,1);assert.equal(elect.members[0].name,'Keep');assert.deepEqual([elect.members[0].out.for.total,elect.members[0].out.end],[120,'2026-11-17']);
});
