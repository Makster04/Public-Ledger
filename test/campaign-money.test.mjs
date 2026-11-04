// Campaign money brought up to the latest FEC report (scripts/update-campaign-money.mjs): the FEC's totals map onto the
// research's fields, the parts still add up to receipts, a figure never goes back to an earlier period, a first report
// replaces "not filed yet", toss-up nominees update too, and the president is left alone. A committee that raised almost
// nothing while the FEC lists a newer principal committee is left as is, a part lower than on file is listed, and the
// hand research's note on the old figures is kept as researchNote.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {campFromTotals,nomineeFromTotals,updateMoney,periodLabel} from '../scripts/update-campaign-money.mjs';
// The research with the people these tests use set back to fixed figures from before an update, so the tests pass
// whichever figures are on file (before or after npm run money:update).
function research(){
  const r=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
  const camp=(id,o)=>{const p=[...r.members,...r.cands].find(x=>x.id===id);const {researchNote,...c}=p.camp;p.camp={...c,...o};};
  camp('ossoff',{cmteId:'C00718866',cmte:'Jon Ossoff for Senate',start:'2025-01-01',end:'2026-06-30',receipts:77279766,pac:920316,missing:false,note:'Coverage 2025-01-01..2026-06-30 (hand research).'});
  camp('jackson',{cmteId:'C00955609',missing:true,note:'Committee registered after June 30; first report due Oct. 15.',start:null,end:null,receipts:null});
  camp('moore',{end:'2026-06-30',receipts:3765805,indiv:2800000,pac:881598,party:0,transfers:0,candidate:0,loans:0,missing:false,totalsFrom:undefined,internalTransfers:undefined,cmteId:'C00720375',cmte:'Barry Moore For U.S. Senate'});
  camp('bankhead',{end:'2026-06-30',receipts:58829.06,indiv:45679.62,pac:6627.29,party:0,missing:false});
  const nominee=(fec,o)=>{for(const race of r.liteRaces)for(const [i,n] of race.nominees.entries())if(n.fecCand===fec)race.nominees[i]={...n,...o};};
  nominee('H2AZ02360',{through:'2026-07-01',receipts:6172867});
  nominee('H6VA02198',{through:null,receipts:null,cash:null});
  nominee('H6NC11321',{through:null,receipts:null,cash:null,campNote:'No FEC committee found yet.'});
  return r;
}

const totals=(o={})=>({cycle:2026,committee_id:'C00718866',coverage_start_date:'2025-01-01T00:00:00',coverage_end_date:'2026-10-14T00:00:00',
  receipts:90000000,individual_contributions:80000000,individual_itemized_contributions:33000000,individual_unitemized_contributions:47000000,
  political_party_committee_contributions:11000,other_political_committee_contributions:1000000,transfers_from_other_authorized_committee:8000000,
  candidate_contribution:0,loans_made_by_candidate:0,disbursements:70000000,last_cash_on_hand_end_period:20000000,last_debts_owed_by_committee:0,...o});

test('the FEC totals map onto the research fields, and the parts add up to receipts',()=>{
  const old=research().members.find(p=>p.id==='ossoff').camp;
  const {camp}=campFromTotals(totals(),old);
  assert.equal(camp.end,'2026-10-14');assert.equal(camp.start,'2025-01-01');assert.equal(camp.receipts,90000000);assert.equal(camp.pac,1000000);
  assert.equal(camp.other,989000,'receipts minus the listed parts');
  assert.equal(camp.cmte,'Jon Ossoff for Senate');assert.equal(camp.cmteId,'C00718866');assert.equal(camp.missing,false);
  assert.equal(camp.self,0);assert.equal(camp.loansKnown,true);
  assert.equal(camp.note,"Figures from the FEC's committee totals through 2026-10-14 (npm run money:update).");
  assert.deepEqual(camp.researchNote,{through:'2026-06-30',text:'Coverage 2025-01-01..2026-06-30 (hand research).'},'the hand research note is kept, with the date of the figures it describes');
  const again=campFromTotals(totals({coverage_end_date:'2026-12-31'}),camp).camp;assert.deepEqual(again.researchNote,camp.researchNote,'a later update keeps the first research note');
  const parts=['indiv','party','pac','transfers','candidate','loans','other'].reduce((t,k)=>t+(camp[k]||0),0);
  assert.equal(Math.round(parts*100)/100,camp.receipts);
  assert.equal(periodLabel(camp.start,camp.end),'Jan 2025 – Oct 2026');
});

test('self-funding is the candidate\'s own money plus their loans, as a share to one decimal',()=>{
  const {camp}=campFromTotals(totals({receipts:1000000,individual_contributions:300000,political_party_committee_contributions:0,other_political_committee_contributions:0,
    transfers_from_other_authorized_committee:0,candidate_contribution:50000,loans_made_by_candidate:600000}),{end:'2026-06-30',missing:false});
  assert.equal(camp.self,650000);assert.equal(camp.selfShare,65);assert.equal(camp.other,50000);
});

test('a figure never goes back to an earlier period; parts over receipts are listed, not saved',()=>{
  assert.match(campFromTotals(totals({coverage_end_date:'2026-03-31'}),{end:'2026-06-30',missing:false}).problem,/before the 2026-06-30 figures/);
  assert.equal(campFromTotals(totals({coverage_end_date:'2026-06-30'}),{end:'2026-06-30',missing:false}).same,true);
  assert.match(campFromTotals(totals({receipts:100}),{end:'2026-06-30'}).problem,/more than its 100 in receipts/);
  assert.match(campFromTotals(totals(),{end:'2026-06-30',missing:false,receipts:95000000}).problem,/less than the 95,000,000 on file/,'money raised only adds up within a cycle');
  assert.match(campFromTotals({receipts:null},{}).problem,/no receipts/);
});

test('a first report replaces "not filed yet", and its old note goes',()=>{
  const old=research().cands.find(p=>p.id==='jackson').camp;assert.equal(old.missing,true);
  const {camp}=campFromTotals(totals({committee_id:'C00955609',coverage_start_date:'2026-07-07',coverage_end_date:'2026-09-30'}),old);
  assert.equal(camp.missing,false);assert.match(camp.note,/^Figures from the FEC's committee totals through 2026-09-30/);assert.equal(camp.researchNote,undefined,'a "not filed yet" note is not kept');assert.equal(camp.end,'2026-09-30');
});

test('the whole update: people and toss-up nominees, the president left alone, and a list of what changed',async()=>{
  const r=research(),asked=[];
  const lookup=async(kind,id)=>{asked.push(`${kind}:${id}`);
    if(kind==='committee'&&id==='C00718866')return totals();
    if(kind==='committee'&&id==='C00955609')return totals({committee_id:id,coverage_start_date:'2026-07-07',coverage_end_date:'2026-09-30',receipts:2000000,individual_contributions:1900000,other_political_committee_contributions:50000,transfers_from_other_authorized_committee:0,political_party_committee_contributions:0});
    if(kind==='candidate'&&id==='H2AZ02360')return {cycle:2026,receipts:9000000,last_cash_on_hand_end_period:3000000,coverage_end_date:'2026-10-14T00:00:00'};
    return null;};
  const out=await updateMoney(r,lookup);
  assert.equal(out.changed,3);
  const o=r.members.find(p=>p.id==='ossoff');assert.equal(o.camp.end,'2026-10-14');assert.equal(o.cycleLabel,'Jan 2025 – Oct 2026');
  const j=r.cands.find(p=>p.id==='jackson');assert.equal(j.camp.missing,false);assert.equal(j.cycleLabel,'Jul 2026 – Sep 2026');
  const az=r.liteRaces.find(x=>x.id==='H-AZ-06').nominees.find(x=>x.fecCand==='H2AZ02360');assert.equal(az.receipts,9000000);assert.equal(az.through,'2026-10-14');
  assert.ok(!asked.some(a=>a.includes(r.featured[0].camp?.cmteId||'none')),'the president is not looked up');
  assert.ok(out.lines.some(l=>/^NEW {3}Jon Ossoff: through 2026-06-30 → 2026-10-14, raised \$77,279,766 → \$90,000,000/.test(l)));
  assert.ok(out.lines.some(l=>/^NEW {3}Troy Jackson: first report 2026-09-30/.test(l)));
  assert.ok(out.lines.some(l=>/^SAME  .*no FEC totals for 2026 yet/.test(l)));
  assert.equal(nomineeFromTotals({receipts:1,coverage_end_date:'2026-01-01'},{through:'2026-06-30'}).problem.includes('before'),true);
});

test('a report ending long before the others is left out, and first figures clear the old note',async()=>{
  const r=research();
  const lookup=async(kind,id)=>{
    if(kind==='committee'&&id==='C00718866')return totals();
    if(kind==='candidate'&&id==='H6VA02198')return {cycle:2026,receipts:591,last_cash_on_hand_end_period:0,coverage_end_date:'2025-07-15T00:00:00'};
    if(kind==='candidate'&&id==='H6NC11321')return {cycle:2026,receipts:399492,last_cash_on_hand_end_period:100000,coverage_end_date:'2026-10-14T00:00:00'};
    return null;};
  const out=await updateMoney(r,lookup);
  const nominee=name=>r.liteRaces.flatMap(x=>x.nominees).find(x=>x.name===name);
  assert.equal(nominee('Elaine Luria').receipts,null,'an old committee\'s $591 from July 2025 is not saved');
  assert.ok(out.lines.some(l=>l.startsWith("CHECK Elaine Luria (Virginia VA-02): the FEC's report ends 2025-07-15, long before the others (2026-10-14)")));
  assert.equal(nominee('Jennifer Balkcom').receipts,399492);assert.equal(nominee('Jennifer Balkcom').campNote,'','the "not found" note goes with her first figures');
  assert.equal(out.changed,2);
});

test('little raised over months while the FEC lists a newer principal committee: left as is; otherwise listed',async()=>{
  const r=research(),moore=r.cands.find(p=>p.id==='moore'),old=moore.camp;
  const t=(id,o={})=>totals({committee_id:id,coverage_start_date:'2025-01-01',coverage_end_date:'2026-10-14',receipts:old.receipts+24109,individual_contributions:2850000,
    other_political_committee_contributions:904598,political_party_committee_contributions:0,transfers_from_other_authorized_committee:0,candidate_contribution:0,loans_made_by_candidate:0,...o});
  const run=async principal=>{const x=research(),asked=[];
    const out=await updateMoney(x,async(kind,id)=>{asked.push(kind);if(kind==='committee'&&id===old.cmteId)return t(id);if(kind==='principal'&&id===moore.fecCand)return principal;return null;});
    return {x,out,asked};};
  const moved=await run([{id:'C00954974',name:'BARRY MOORE FOR SENATE'},{id:old.cmteId,name:'old'}]);
  assert.ok(moved.out.lines.some(l=>/^CHECK Barry Moore: .*raised only \$24,109 from 2026-06-30 to 2026-10-14, and the FEC lists BARRY MOORE FOR SENATE \(C00954974\) as the principal campaign committee; left as is$/.test(l)));
  assert.equal(moved.x.cands.find(p=>p.id==='moore').camp.end,'2026-06-30','not updated');
  const same=await run([{id:old.cmteId,name:'same'}]);
  assert.ok(same.out.lines.some(l=>/^NEW {3}Barry Moore: .* \(only \$24,109 raised since 2026-06-30\)/.test(l)),'the same committee: updated, with the small amount pointed out');
  assert.equal(same.asked.filter(k=>k==='principal').length,1,'only the one with little new money is checked');
});

test('a part lower than on file is listed as WATCH and the FEC figure used; progress counts every request',async()=>{
  const r=research(),b=r.cands.find(p=>p.id==='bankhead');
  const seen=[];
  const out=await updateMoney(r,async(kind,id)=>kind==='committee'&&id===b.camp.cmteId?totals({committee_id:id,coverage_start_date:'2025-10-01',coverage_end_date:'2026-10-14',receipts:190565,individual_contributions:185000,
    other_political_committee_contributions:525,political_party_committee_contributions:0,transfers_from_other_authorized_committee:0}):null,{progress:(i,n,who)=>seen.push([i,n,who])});
  assert.ok(out.lines.includes('WATCH Alani Bankhead: money from PACs is lower than on file ($6,627 → $525); the FEC counts it differently from the hand research, and its figure is used'));
  assert.equal(r.cands.find(p=>p.id==='bankhead').camp.pac,525);
  const people=[...r.members,...r.cands].filter(p=>p.camp?.cmteId).length,nominees=r.liteRaces.flatMap(x=>x.nominees).filter(x=>x.fecCand).length;
  assert.equal(seen.length,people+nominees);assert.deepEqual(seen.at(-1).slice(0,2),[people+nominees,people+nominees]);
});

test('candidate totals for a campaign that moved committees leave out transfers between them; --only for one person',async()=>{
  const r=research(),moore=r.cands.find(p=>p.id==='moore');moore.camp.totalsFrom='candidate';
  const fec=o=>totals({committee_id:null,coverage_start_date:'2025-01-01',coverage_end_date:'2026-10-14',receipts:6000000,individual_contributions:4200000,
    other_political_committee_contributions:1100000,political_party_committee_contributions:0,transfers_from_other_authorized_committee:600000,transfers_to_other_authorized_committee:600000,
    candidate_contribution:0,loans_made_by_candidate:0,disbursements:5000000,...o});
  const asked=[];
  const out=await updateMoney(r,async(kind,id)=>{asked.push(`${kind}:${id}`);return kind==='candidate'&&id===moore.fecCand?fec():null;},{only:new Set(['moore'])});
  assert.deepEqual(asked,['candidate:S6AL00476'],'only Moore, from the candidate totals, and no principal-committee check');
  const c=r.cands.find(p=>p.id==='moore').camp;
  assert.equal(c.receipts,5400000,'the $600,000 moved between his committees counts once');assert.equal(c.transfers,0);assert.equal(c.disbursements,4400000);
  assert.deepEqual(c.internalTransfers,{in:600000,out:600000});assert.equal(c.other,100000,'the parts still add up to receipts');
  assert.match(c.note,/candidate totals \(all of the candidate's authorized committees\) through 2026-10-14, leaving out \$600,000 moved between those committees/);
  assert.ok(out.lines.some(l=>/^NEW {3}Barry Moore: .*leaving out \$600,000 moved between the candidate's own committees$/.test(l)));
  assert.equal(out.changed,1);
  // Candidate totals saved before the transfers were left out: the same report is read again and fixed, then it's SAME.
  const r2=research(),m2=r2.cands.find(p=>p.id==='moore');
  m2.camp={...m2.camp,totalsFrom:'candidate',end:'2026-10-14',receipts:6000000,transfers:600000,disbursements:5000000};
  const again=await updateMoney(r2,async kind=>kind==='candidate'?fec():null,{only:new Set(['moore'])});
  assert.equal(r2.cands.find(p=>p.id==='moore').camp.receipts,5400000);
  assert.ok(again.lines.includes("NEW   Barry Moore: still through 2026-10-14; raised $6,000,000 → $5,400,000, leaving out $600,000 moved between the candidate's own committees"));
  const third=await updateMoney(r2,async kind=>kind==='candidate'?fec():null,{only:new Set(['moore'])});
  assert.equal(third.changed,0);assert.ok(third.lines[0].startsWith('SAME  Barry Moore'));
});
