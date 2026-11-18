// Nonprofits' tax returns (scripts/irs990.mjs, scripts/build-990.mjs, public/nonprofits.js): the IRS index, reading one
// return out of a zip, the parts kept, and what the pages say. (Deflate64 was checked against a live IRS zip: the
// return read byte for byte matched another copy of the same file.)
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {indexRow,newestReturns,zipEnd,zipDirectory,zipFile,inflate,parse990,normEIN,zipURL,indexURL} from '../scripts/irs990.mjs';
import {assemble,batchParts,normName} from '../scripts/build-990.mjs';
import {npOf,npLine,npChip,npDetails,normName as pageNorm} from '../public/nonprofits.js';

test('the IRS index: each EIN\'s newest return, an amended one over the first, a name with commas kept whole',()=>{
  const r=indexRow(',EFILE,530045720,202412,2025,Chamber of Commerce, of the USA,990,93493317930337,202543179349303374,2025_TEOS_XML_11B');
  assert.deepEqual(r,{ein:'530045720',period:'202412',name:'Chamber of Commerce, of the USA',form:'990',objectId:'202543179349303374',batch:'2025_TEOS_XML_11B'});
  assert.equal(indexRow('RETURN_ID,FILING_TYPE,EIN,TAX_PERIOD,SUB_DATE,TAXPAYER_NAME,RETURN_TYPE,DLN,OBJECT_ID,XML_BATCH_ID'),null);
  assert.equal(indexRow(',EFILE,42702867,202506,2025,A,990EZ,1,202513519349200201,2025_TEOS_XML_12A').ein,'042702867','EINs keep their leading zero');
  const rows=[['1','202312','990','202400000000000001'],['1','202412','990','202500000000000001'],['1','202412','990','202500000000000009'],['1','202512','990T','202600000000000001'],['2','202406','990PF','202500000000000002']]
    .map(([e,p,f,o])=>({ein:e,period:p,form:f,objectId:o}));
  const best=newestReturns(rows);
  assert.equal(best.get('1').objectId,'202500000000000009','the latest period, then the latest filed; a 990-T isn\'t one of the forms');
  assert.equal(best.get('2').form,'990PF');
  assert.equal(zipURL('2026_TEOS_XML_05A'),'https://apps.irs.gov/pub/epostcard/990/xml/2026/2026_TEOS_XML_05A.zip');
  assert.equal(indexURL(2025),'https://apps.irs.gov/pub/epostcard/990/xml/2025/index_2025.csv');
  assert.deepEqual(batchParts('2026_TEOS_XML_05A').slice(0,3),['2026_TEOS_XML_05A','2026_TEOS_XML_05B','2026_TEOS_XML_05C'],'a month posted in parts');
});

// A zip with one file, the way the IRS's are laid out (local header, data, directory, end record).
function oneFileZip(name,data,method){
  const body=method===8?zlib.deflateRawSync(data):data,n=Buffer.from(name);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(method,8);local.writeUInt32LE(body.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(n.length,26);
  const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(method,10);cd.writeUInt32LE(body.length,20);cd.writeUInt32LE(data.length,24);cd.writeUInt16LE(n.length,28);cd.writeUInt32LE(0,42);
  const head=Buffer.concat([local,n,body]),dir=Buffer.concat([cd,n]);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(head.length,16);
  return Buffer.concat([head,dir,end]);
}
test('one file read out of a zip by its directory, stored or deflated; the inflater matches zlib',()=>{
  const xml=Buffer.from('<Return>'+'<A>x</A>'.repeat(5000)+'</Return>');
  for(const method of [0,8]){
    const zip=oneFileZip('202500000000000001_public.xml',xml,method);
    const end=zipEnd(zip.subarray(-200)),dir=zipDirectory(zip.subarray(end.offset,end.offset+end.size)),e=dir['202500000000000001_public.xml'];
    assert.ok(e,'listed in the directory');assert.equal(e.method,method);
    assert.ok(zipFile(zip.subarray(e.offset,e.offset+30+200+e.csize),e).equals(xml));
  }
  for(let i=0;i<5;i++){const data=Buffer.concat([crypto.randomBytes(3000),Buffer.from('repeat '.repeat(4000)),crypto.randomBytes(500)]);
    for(const level of [0,1,9])assert.ok(inflate(zlib.deflateRawSync(data,{level})).equals(data),`level ${level}`);}
  assert.throws(()=>zipEnd(Buffer.from('nothing here')),/end-of-directory/);
});

const RETURN=`<Return><ReturnHeader><ReturnTypeCd>990</ReturnTypeCd><TaxPeriodEndDt>2024-12-31</TaxPeriodEndDt><Filer><EIN>264486735</EIN><BusinessName><BusinessNameLine1Txt>SIXTEEN THIRTY FUND</BusinessNameLine1Txt></BusinessName></Filer><TaxYr>2024</TaxYr></ReturnHeader>
<ReturnData><IRS990><Organization501cInd organization501cTypeTxt="4">X</Organization501cInd><CYContributionsGrantsAmt>275156582</CYContributionsGrantsAmt><CYTotalRevenueAmt>282241759</CYTotalRevenueAmt><CYTotalExpensesAmt>310782035</CYTotalExpensesAmt></IRS990>
<IRS990ScheduleC><PoliticalExpendituresAmt>78008755</PoliticalExpendituresAmt><TotalExemptFunctionExpendAmt>78008755</TotalExemptFunctionExpendAmt>
<Section527PoliticalOrgGrp><OrganizationBusinessName><BusinessNameLine1Txt>FUTURE FORWARD USA PAC</BusinessNameLine1Txt></OrganizationBusinessName><EIN>830791921</EIN><PaidInternalFundsAmt>3000000</PaidInternalFundsAmt><ContributionsRcvdDlvrAmt>0</ContributionsRcvdDlvrAmt></Section527PoliticalOrgGrp>
<Section527PoliticalOrgGrp><OrganizationBusinessName><BusinessNameLine1Txt>YOUR COMMUNITY PAC INC</BusinessNameLine1Txt></OrganizationBusinessName><EIN>934865071</EIN><PaidInternalFundsAmt>6695000</PaidInternalFundsAmt></Section527PoliticalOrgGrp>
<NonDeductibleLbbyngPltclCYAmt>1200</NonDeductibleLbbyngPltclCYAmt></IRS990ScheduleC>
<IRS990ScheduleI><RecipientTable><RecipientBusinessName><BusinessNameLine1Txt>LEAGUE OF CONSERVATION VOTERS</BusinessNameLine1Txt></RecipientBusinessName><RecipientEIN>521733698</RecipientEIN><IRCSectionDesc>501(C)(4)</IRCSectionDesc><CashGrantAmt>11796000</CashGrantAmt><NonCashAssistanceAmt>0</NonCashAssistanceAmt><PurposeOfGrantTxt>ADVOCACY</PurposeOfGrantTxt></RecipientTable>
<RecipientTable><RecipientBusinessName><BusinessNameLine1Txt>AMERICA VOTES &amp; FRIENDS</BusinessNameLine1Txt></RecipientBusinessName><RecipientEIN>264568349</RecipientEIN><IRCSectionDesc>501(C)(4)</IRCSectionDesc><CashGrantAmt>27850000</CashGrantAmt></RecipientTable></IRS990ScheduleI>
<IRS990ScheduleR><IdRelatedTaxExemptOrgGrp><DisregardedEntityName><BusinessNameLine1Txt>A RELATED FUND</BusinessNameLine1Txt></DisregardedEntityName><EIN>111111111</EIN><ExemptCodeSectionTxt>501(c)(3)</ExemptCodeSectionTxt></IdRelatedTaxExemptOrgGrp></IRS990ScheduleR></ReturnData></Return>`;

test('a return\'s parts: totals, political spending and the political groups paid, grants largest first, related organizations',()=>{
  const p=parse990(RETURN);
  assert.equal(p.ein,'264486735');assert.equal(p.name,'SIXTEEN THIRTY FUND');assert.equal(p.form,'990');assert.equal(p.taxYear,2024);assert.equal(p.subsection,'4');
  assert.equal(p.revenue,282241759);assert.equal(p.contributions,275156582);assert.equal(p.expenses,310782035);assert.equal(p.lobbying,1200);
  assert.equal(p.political.spent,78008755);assert.equal(p.political.toPoliticalOrgs,9695000);
  assert.deepEqual(p.political.orgs.map(o=>[o.name,o.paid]),[['YOUR COMMUNITY PAC INC',6695000],['FUTURE FORWARD USA PAC',3000000]]);
  assert.deepEqual(p.grants.top.map(g=>[g.name,g.ein,g.amount]),[['AMERICA VOTES & FRIENDS','264568349',27850000],['LEAGUE OF CONSERVATION VOTERS','521733698',11796000]]);
  assert.equal(p.grants.total,39646000);assert.deepEqual(p.related,[{name:'A RELATED FUND',ein:'111111111',section:'501(c)(3)'}]);
  assert.throws(()=>parse990('<html>not a return</html>'),/Not an IRS e-file return/);
  const pf=parse990('<Return><ReturnHeader><ReturnTypeCd>990PF</ReturnTypeCd><Filer><EIN>1</EIN></Filer><TaxYr>2024</TaxYr></ReturnHeader><GrantOrContributionPdDurYrGrp><RecipientPersonNm>A PERSON</RecipientPersonNm><Amt>500</Amt></GrantOrContributionPdDurYrGrp><GrantOrContributionPdDurYrGrp><RecipientBusinessName><BusinessNameLine1Txt>A CHARITY</BusinessNameLine1Txt></RecipientBusinessName><Amt>9000</Amt><RecipientFoundationStatusTxt>PC</RecipientFoundationStatusTxt></GrantOrContributionPdDurYrGrp></Return>');
  assert.equal(pf.subsection,'PF');assert.deepEqual(pf.grants.top.map(g=>g.name),['A CHARITY'],'a foundation\'s grant to a person is left out');
});

test('the site\'s file: tracked groups, names, and grants between the nonprofits followed',()=>{
  const lcv={...parse990(RETURN),ein:'521733698',name:'LEAGUE OF CONSERVATION VOTERS INC',grants:{total:0,n:0,top:[]},political:{spent:1,toPoliticalOrgs:0,passedThrough:0,orgs:[]}};
  const out=assemble(new Map([['264486735',parse990(RETURN)],['521733698',lcv]]),{why:new Map([['521733698',new Set(['A tracked group\'s nonprofit arm'])]]),groups:{lcv:'521733698'},names:{'sixteen thirty fund':'264486735'},years:[2025],built:'2026-11-18'});
  assert.deepEqual(out.orgs['521733698'].fundedBy,[{ein:'264486735',name:'SIXTEEN THIRTY FUND',amount:11796000,year:2024}]);
  assert.deepEqual(out.orgs['521733698'].groups,['lcv']);
  assert.equal(out.orgs['264486735'].url,'https://projects.propublica.org/nonprofits/organizations/264486735');
  assert.equal(npOf(out,{group:'lcv'}).name,'LEAGUE OF CONSERVATION VOTERS INC');
  assert.equal(npOf(out,{name:'Sixteen Thirty Fund, Inc.'}).ein,'264486735','found by name, the way the build script wrote it');
  assert.equal(npOf(out,{ein:'26-4486735'}).ein,'264486735');assert.equal(npOf(out,{group:'nra'}),null);
  assert.equal(normName('The Sixteen Thirty Fund, Inc.'),pageNorm('Sixteen Thirty Fund'),'the page and the script read names the same way');
  const line=npLine(npOf(out,{name:'sixteen thirty fund'}));
  assert.match(line,/2024 tax return \(501\(c\)\(4\) social welfare group\): \$78\.0M on politics · \$9\.7M to political groups \(Your Community PAC Inc \$6\.7M, Future Forward USA PAC \$3\.0M\) · \$39\.6M in grants to 2 organizations/);
  assert.match(npLine(npOf(out,{group:'lcv'})),/grants from Sixteen Thirty Fund \$11\.8M/);
  assert.match(npChip(npOf(out,{group:'lcv'})),/501\(c\)\(4\) · doesn't name its donors/);
  assert.match(npDetails(npOf(out,{group:'lcv'})),/Grants it got from other nonprofits followed here/);
  assert.equal(npLine(null),'');assert.equal(npChip(null),'');
});

test('public/nonprofits.json: every tracked group with a nonprofit arm on file has its return',()=>{
  const hand=JSON.parse(fs.readFileSync('data/nonprofit-eins.json','utf8')),d=JSON.parse(fs.readFileSync('public/nonprofits.json','utf8'));
  for(const [k,g] of Object.entries(hand.groups)){assert.equal(d.groups[k],normEIN(g.ein),k);assert.ok(d.orgs[normEIN(g.ein)],`${k}'s return was read`);}
  for(const o of Object.values(d.orgs))assert.ok(o.taxYear>=2022&&o.form&&o.political&&o.grants,o.ein);
});
