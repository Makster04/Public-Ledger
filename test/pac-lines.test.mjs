// scripts/fill-pac-lines.mjs: a full profile's PAC lines for its whole money period, from the FEC's reports and its
// processed PAC contributions (Schedule A, line 11C).
import test from 'node:test';
import assert from 'node:assert/strict';
import {pacLines,thin,cyclesIn,sectorOf} from '../scripts/fill-pac-lines.mjs';

const person=()=>({id:'x',fecCmte:'C00000001',camp:{start:'2025-01-01',end:'2026-10-14',pac:100000},pac:{rows:[[0,5000,'lead',0]]}});
const data=()=>({pacNames:['Blue Hen Federal PAC','ACME CORP PAC'],pacIds:[null,'C00000099'],pacCommittees:{C00000099:['ACME CORP PAC','Q','B','C']},members:[person()]});
const rep=(type,start,end,file,amt)=>({report_type:type,report_year:Number(end.slice(0,4)),coverage_start_date:`${start}T00:00:00`,coverage_end_date:`${end}T00:00:00`,file_number:file,other_political_committee_contributions_period:amt});
const reports=[rep('Q1','2026-01-01','2026-03-31',101,20000),rep('Q1','2026-01-01','2026-03-31',100,20000),rep('Q3','2026-07-01','2026-09-30',300,30000),rep('12G','2026-10-01','2026-10-14',400,50000),rep('Q4','2024-10-01','2024-12-31',50,999)];
const rec=(file,name,id,amt,extra={})=>({file_number:file,contributor_name:name,contributor_id:id,contribution_receipt_amount:amt,transaction_id:`${file}-${name}-${amt}`,...extra});

test('the profiles read: PAC money on file and saved lines under 80% of it; the cycles a period touches',()=>{
  assert.ok(thin(person()));
  assert.ok(!thin({...person(),pac:{rows:[[0,90000,'lead',0]]}}));
  assert.ok(!thin({...person(),fecCmte:null}));
  assert.deepEqual(cyclesIn('2025-01-01','2026-10-14'),[2026]);assert.deepEqual(cyclesIn('2024-11-06','2026-10-14'),[2024,2026]);
});
test('each check from the latest version of each report in the period, matched to the saved PACs or added',()=>{
  const d=data(),p=d.members[0];
  const records=[rec(101,'ACME CORP PAC','C00000099',10000),rec(100,'ACME CORP PAC','C00000099',10000),             // the superseded version is skipped
    rec(101,'BLUE HEN FEDERAL PAC',null,10000),rec(300,'NEW UNION PAC','C00000077',25000),rec(300,'MEMO PAC','C00000066',5000,{memo_code:'X'}),
    rec(50,'OLD PAC','C00000055',999)];                                                                                  // outside the period
  const {pac,added,unprocessed}=pacLines(p,reports,records,d,{C00000077:['NEW UNION PAC','Q','','L']});
  assert.deepEqual(pac.filings.map(f=>[f.report,f.filing,f.n]),[['APR Q 2026','101',2],['OCT Q 2026','300',1],['PRE-GENERAL 2026','400',0]]);
  assert.equal(pac.retrieved,45000);assert.equal(pac.subtotal,100000);assert.equal(pac.coverage,45);
  assert.deepEqual(added,[{name:'NEW UNION PAC',id:'C00000077'}]);assert.equal(d.pacIds[2],'C00000077');assert.deepEqual(d.pacCommittees.C00000077[3],'L');
  const byName=Object.fromEntries(pac.rows.map(r=>[d.pacNames[r[0]],r]));
  assert.equal(byName['ACME CORP PAC'][0],1,'matched by FEC ID');assert.equal(byName['Blue Hen Federal PAC'][2],'lead','the sector it has on another profile');
  assert.equal(byName['NEW UNION PAC'][2],'labor','a new PAC\'s sector from its FEC type');
  assert.deepEqual(unprocessed.map(f=>f.report),['PRE-GENERAL 2026']);
  assert.match(pac.gap,/Not processed by the FEC yet.*PRE-GENERAL 2026 report \(\$50,000 from PACs\)/);
  assert.equal(pac.window,'Jan 2026 – Oct 2026');assert.equal(pac.nPacs,3);
  assert.match(pac.filings[0].url,/docquery\.fec\.gov\/cgi-bin\/forms\/C00000001\/101\/sa\/11C/);
});
test('a new PAC\'s sector: leadership and candidate committees are leadership PACs; others by name, else unclassified',()=>{
  const none=new Map();
  assert.equal(sectorOf('SOME PAC',['SOME PAC','Q','D',''],none),'lead');
  assert.equal(sectorOf('NATIONAL ASSOCIATION OF REALTORS PAC',['X','Q','B','T'],none),'realestate');
  assert.equal(sectorOf('XYZ HOLDINGS PAC',['X','Q','B','C'],none),'other');
  assert.equal(sectorOf('CITIZENS FOR GOOD',['X','N','',''],none),'ideo');
});
