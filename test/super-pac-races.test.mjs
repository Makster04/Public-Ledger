import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TRACKER,helpToWin,fecName,ELECTION_LABEL} from '../public/trackers.js';
import {parseCsv,isoDate,seatOf,partyOf,trackerOfSpender,superPacRaces} from '../scripts/build-super-pac-races.mjs';

const races=JSON.parse(fs.readFileSync(new URL('../public/super-pac-races.json',import.meta.url),'utf8'));

// A small races file: AIPAC's super PAC (UDP) and a crypto one, in a House seat (KY-04) and a California seat.
const UDP='C00799031',FS='C00835959';
const file=(cands,rows)=>({spenders:{[UDP]:['UNITED DEMOCRACY PROJECT (UDP)','aipac'],[FS]:['Fairshake','crypto']},cands,rows});
const KY={A:['ALPHA, ANN','H-KY-04','R','PG'],B:['BETA, BOB','H-KY-04','R','P'],C:['GAMMA, CY','H-KY-04','D','PG'],D:['DELTA, DEE','H-KY-04','R','P']};

test('help to win: for them, plus against their own party\'s opponents in the primary; not the other party\'s candidate there',()=>{
  const h=helpToWin(TRACKER.aipac,file(KY,[[UDP,'A','S','P',100],[UDP,'B','O','P',250],[UDP,'C','O','P',40],[FS,'B','O','P',999]]),['A']);
  assert.equal(h.forThem,100);assert.equal(h.againstRivals,250);assert.equal(h.help,350);assert.equal(h.againstThem,0);
  assert.deepEqual(h.rows.others.map(l=>l.cand),['C'],'a Democrat isn\'t in the Republican primary');
  assert.ok(!h.rows.rivals.some(l=>l.sp===FS),'another tracker\'s super PAC isn\'t counted');
});

test('help to win: against an opponent counts without spending for them only in a two-way race, and never when the same super PAC went after them too',()=>{
  const two={A:KY.A,B:KY.B};
  assert.equal(helpToWin(TRACKER.aipac,file(two,[[UDP,'B','O','P',500]]),['A']).help,500,'two candidates: against one helps the other');
  assert.equal(helpToWin(TRACKER.aipac,file(KY,[[UDP,'B','O','P',500]]),['A']).help,0,'three in the primary: not counted');
  assert.equal(helpToWin(TRACKER.aipac,file(two,[[UDP,'B','O','P',500],[UDP,'B','S','P',5]]),['A']).help,0,'it also backed the opponent');
  const both=helpToWin(TRACKER.aipac,file(KY,[[UDP,'A','S','P',100],[UDP,'A','O','P',30],[UDP,'B','O','P',250]]),['A']);
  assert.equal(both.help,100);assert.equal(both.againstThem,30);assert.deepEqual(both.rows.others.map(l=>l.cand),['B']);
  // The general: everyone in the seat is an opponent.
  const g=helpToWin(TRACKER.aipac,file(KY,[[UDP,'A','S','G',10],[UDP,'C','O','G',70]]),['A']);
  assert.equal(g.help,80);assert.equal(g.rows.rivals[0].ele,'G');
});

test('help to win: one person under two IDs, top-two primaries, and nothing without the file or their IDs',()=>{
  const dup={A:KY.A,A2:['ALPHA, ANN M.','H-KY-04','','P'],B:KY.B};
  const h=helpToWin(TRACKER.aipac,file(dup,[[UDP,'A2','S','P',60],[UDP,'B','O','P',40]]),['A']);
  assert.equal(h.forThem,60,'the same name in the same seat is them');assert.equal(h.againstRivals,40,'still a two-way race');
  const CA={E:['EPSILON, EVE','H-CA-12','D','PG'],F:['ZETA, FAY','H-CA-12','R','PG'],G:['ETA, GUS','H-CA-12','D','P']};
  assert.equal(helpToWin(TRACKER.aipac,file(CA,[[UDP,'E','S','P',1],[UDP,'F','O','P',9]]),['E']).help,10,'California: one primary for every party');
  assert.equal(helpToWin(TRACKER.aipac,null,['A']),null);assert.equal(helpToWin(TRACKER.aipac,file(KY,[]),['Z']),null);
  assert.equal(helpToWin(TRACKER.oil,file(KY,[[UDP,'A','S','P',1]]),['A']),null,'a tracker without its own super PACs');
});

test('the races file: each tracker\'s super PACs, Stevens and Gallrein (AIPAC), Husted and Brown (crypto), Lasher and Bores (Big Tech + AI)',()=>{
  assert.ok(races.through>='2026-10-01'&&races.cycle===2026);
  assert.deepEqual([...new Set(Object.values(races.spenders).map(s=>s[1]))].sort(),['aipac','crypto','tech']);
  for(const [sp,c,so,e,a] of races.rows){assert.ok(races.spenders[sp]&&races.cands[c],`${sp} ${c}`);assert.ok(['S','O'].includes(so)&&ELECTION_LABEL[e]&&a!==0);}
  const h=(k,ids)=>helpToWin(TRACKER[k],races,ids);
  const stevens=h('aipac',['H8MI11254','S6MI00426']);
  assert.ok(stevens.forThem>10e6&&stevens.againstRivals>20e6&&stevens.againstThem===0,'for her, and against El-Sayed in the primary');
  assert.ok(stevens.rows.rivals.every(l=>l.cand==='S6MI00418'&&l.ele==='P'));
  assert.ok(h('aipac',['S6MI00418']).againstThem>20e6&&h('aipac',['S6MI00418']).help===0);
  const gal=h('aipac',['H6KY04171']),mas=h('aipac',['H2KY04121']);
  assert.ok(gal.forThem>0&&gal.againstRivals===mas.againstThem&&mas.help===0,'against Massie counts for Gallrein');
  const husted=h('crypto',['S6OH00304']),brown=h('crypto',['S6OH00163']);
  assert.ok(husted.forThem>30e6&&husted.againstRivals===brown.againstThem&&brown.help===0,'Brown\'s two IDs are one opponent');
  const lasher=h('tech',['H6NY12172']),bores=h('tech',['H6NY12214']);
  assert.ok(lasher.forThem===0&&lasher.againstRivals===bores.againstThem&&bores.forThem>10e6,'super PACs on both sides of NY-12, each judged on its own');
});

test('the builder: CSV fields, dates, seats, parties, the latest version of each transaction, and only the trackers\' super PACs',()=>{
  assert.deepEqual(parseCsv('a,"b, ""c""",,d'),['a','b, "c"','','d']);
  assert.equal(isoDate('15-MAY-26'),'2026-05-15');assert.equal(isoDate('2026-05-15'),'');
  assert.equal(seatOf('H','KY','4'),'H-KY-04');assert.equal(seatOf('S','MI','00'),'S-MI');assert.equal(seatOf('P','US',''),null);
  assert.deepEqual(['DEMOCRATIC PARTY','Republican Party','INDEPENDENT','LIBERTARIAN',''].map(partyOf),['D','R','I','L','']);
  assert.equal(trackerOfSpender('C1','UNITED DEMOCRACY PROJECT (UDP)'),'aipac');assert.equal(trackerOfSpender('C00836221','x'),'crypto','by committee ID');assert.equal(trackerOfSpender('C1','Fairshake'),'crypto');assert.equal(trackerOfSpender('C1','Some PAC'),null);
  const r=(o)=>({spe_id:UDP,spe_nam:'UNITED DEMOCRACY PROJECT (UDP)',cand_id:'H1',cand_name:'ALPHA, ANN',can_office:'H',can_office_state:'KY',can_office_dis:'04',cand_pty_aff:'REPUBLICAN PARTY',sup_opp:'S',ele_type:'P2026',exp_amo:'100',exp_date:'01-MAY-26',file_num:'1',tran_id:'t1',...o});
  const out=superPacRaces([r({}),r({file_num:'2',exp_amo:'150'}),r({tran_id:'t2',sup_opp:'O',cand_id:'H2',cand_name:'BETA, BOB',exp_amo:'50',exp_date:'20-JUN-26'}),
    r({spe_id:'C9',spe_nam:'OTHER PAC',tran_id:'t3',cand_id:'H3',cand_name:'GAMMA, CY',cand_pty_aff:'DEMOCRATIC PARTY',ele_type:'G2026',exp_amo:'7'}),
    r({spe_id:'C9',spe_nam:'OTHER PAC',tran_id:'t4',cand_id:'H4',cand_name:'DELTA, DEE',can_office_state:'OH',exp_amo:'7'})]);
  assert.deepEqual(out.rows,[[UDP,'H1','S','P',150],[UDP,'H2','O','P',50]],'the amendment replaces the original; another spender\'s lines are left out');
  assert.deepEqual(out.cands.H3,['GAMMA, CY','H-KY-04','D','G'],'other candidates in the seat are kept, for the race\'s field');
  assert.equal(out.cands.H4,undefined,'not a seat the tracker\'s super PACs spent in');
  assert.equal(out.through,'2026-06-20');assert.deepEqual(out.spenders,{[UDP]:['UNITED DEMOCRACY PROJECT (UDP)','aipac']});
});

test('FEC names as people write them',()=>{
  assert.equal(fecName('EL-SAYED, ABDUL'),'Abdul El-Sayed');assert.equal(fecName("O'ROURKE, BETO"),"Beto O'Rourke");assert.equal(fecName('Lasher, Micah'),'Micah Lasher');
});
