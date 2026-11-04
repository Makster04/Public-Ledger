// Campaign money brought up to the latest FEC report (scripts/update-campaign-money.mjs): the FEC's totals map onto the
// research's fields, the parts still add up to receipts, a figure never goes back to an earlier period, a first report
// replaces "not filed yet", toss-up nominees update too, and the president is left alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {campFromTotals,nomineeFromTotals,updateMoney,periodLabel} from '../scripts/update-campaign-money.mjs';
const research=()=>JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));

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
  assert.equal(camp.missing,false);assert.equal(camp.note,'');assert.equal(camp.end,'2026-09-30');
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
