// Bundled ("earmarked") gifts: donors' own gifts a group forwards to a campaign through its PAC (scripts/build-bundled.mjs),
// added to each person's funders as "routed" (scripts/build-funders.mjs) and counted in the money-weighted indexes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {conduitTotals,conduitURL,conduitLink,readPages,conduitsToRead,searchPerson,LIMITS,recipientURL} from '../scripts/build-bundled.mjs';
import {personFunders,funderChanges} from '../scripts/build-funders.mjs';
import {donorLoyalty,voteDonorAlignment} from '../public/influence.js';
import {groupInfo} from '../public/bills.js';
const D=JSON.parse(await fs.readFile(new URL('../public/research.json',import.meta.url),'utf8'));

test('forwarded gifts are counted once, whether reported as one total line or as memo entries only',()=>{
  // A total line with each gift listed below it as a memo entry: the line counts, the memos don't add to it.
  const a=conduitTotals([{disbursement_amount:3000,disbursement_description:'EARMARKED CONTRIBUTIONS FORWARDED',disbursement_date:'2026-04-02T00:00:00'},
    {disbursement_amount:1000,disbursement_description:'EARMARKED CONTRIBUTION',memo_code:'X',disbursement_date:'2026-03-30'},{disbursement_amount:2000,memo_text:'Earmarked for candidate',memo_code:'X',disbursement_date:'2026-04-01'},
    {disbursement_amount:5000,disbursement_description:'CONTRIBUTION',disbursement_date:'2026-01-15'}]);
  assert.deepEqual(a,{routed:3000,n:2,direct:5000,byMonth:{'2026-04':3000}},'the PAC\'s own $5,000 check is kept apart, and the months follow the line counted');
  // Memo entries only.
  const b=conduitTotals([{disbursement_amount:250,disbursement_description:'Earmarked',memoed_subtotal:true,disbursement_date:'2025-02-03'},{disbursement_amount:750,disbursement_description:'earmarked',memo_code:'X',disbursement_date:'2025-03-01'},
    {disbursement_amount:-250,disbursement_description:'Earmarked refund',memo_code:'X',disbursement_date:'2025-03-20'}]);
  assert.deepEqual(b,{routed:750,n:3,direct:0,byMonth:{'2025-02':250,'2025-03':500}},'a refund comes off, in its own month');
  assert.deepEqual(conduitTotals([]),{routed:0,n:0,direct:0,byMonth:{}});
  // A memo entry that isn't an earmark is neither bundled nor a check.
  assert.deepEqual(conduitTotals([{disbursement_amount:99,memo_code:'X',disbursement_description:'IN-KIND'}]),{routed:0,n:0,direct:0,byMonth:{}});
  const u=new URL(conduitURL('C00797670','C00540500',2026));
  assert.equal(u.pathname,'/v1/schedules/schedule_b/');assert.equal(u.searchParams.get('recipient_committee_id'),'C00540500');assert.equal(u.searchParams.get('two_year_transaction_period'),'2026');
  assert.match(conduitLink('C00797670','C00540500',2026),/^https:\/\/www\.fec\.gov\/data\/disbursements\/\?/);
});

test('the groups that bundle are marked, with their PACs\' committee IDs',()=>{
  const c=Object.fromEntries(D.groupPos.filter(g=>g.conduits).map(g=>[g.key,g.conduits]));
  assert.deepEqual(Object.keys(c).sort(),['aipac','cfg','emily','jstreet','scf']);
  for(const ids of Object.values(c))for(const id of ids)assert.match(id,/^C\d{8}$/);
  assert.ok(!JSON.stringify(c).includes('C00401224')&&!JSON.stringify(c).includes('C00694323'),'ActBlue and WinRed are not conduits here');
});

test('bundled gifts add a funder entry of their own, kept apart from PAC checks, and count in the money-weighted indexes',()=>{
  const p=[...D.members,...D.cands].find(x=>x.id==='booker');
  const data={...D,bundled:{asOf:'2026-11-01',conduits:{aipac:['C00797670']},people:{booker:{aipac:{routed:900000,n:850,direct:5000,cycles:[2026],src:'https://www.fec.gov/data/disbursements/'}}}}};
  const F=personFunders(data,p),a=F.find(f=>f.key==='aipac');
  assert.ok(a,'an AIPAC entry from bundled gifts');assert.equal(a.routed,900000);assert.equal(a.routedN,850);
  assert.equal(F[0].key,'aipac','largest money first, bundled gifts included');
  assert.equal(a.routedBy,undefined,'read from the FEC');
  // No FEC reading for the group: the total researched by hand from the filings stands, less the PAC's own check in it.
  const h=personFunders({...D,bundled:{people:{}}},p).find(f=>f.key==='aipac');
  assert.equal(h.routed,707803-5000);assert.equal(h.routedBy,'hand');assert.match(h.routedPeriod,/2025/);
  assert.equal(personFunders({...D,bundled:{people:{}}},{...p,conduit:{status:'not_measured',rows:[]}}).find(f=>f.key==='aipac')?.routed,undefined,'nothing read, nothing researched: no routed amount');
  assert.ok(funderChanges({...data,members:[],cands:[{...p}],featured:[]}).some(l=>/AIPAC.*routed \$[\d,.]+ → \$900,?000|\+ AIPAC.*bundled \$900,?000/.test(l)));
  // The indexes weight each funder by money: bundled gifts count; a funder with only bundled gifts is a donor.
  const f=[{org:'Group',key:'g',pac:0,routed:1000,for:0,against:0,compared:[{voteId:'v1',wanted:'Yea',cast:'Yea',match:true}]}];
  assert.equal(voteDonorAlignment(f).n,1);
  const dl=donorLoyalty(f,'D',{v1:{D:{Yea:10,Nay:10}}});assert.equal(dl.rows[0].money,1000);
});

test('the Bills page adds up bundled gifts apart from PAC checks and outside spending',()=>{
  const p=[...D.members,...D.cands].find(x=>x.id==='booker');
  const data={...D,members:D.members.map(m=>m.id==='booker'?{...m,funderPos:[{key:'aipac',org:'AIPAC',pac:5000,routed:900000,for:0,against:0,compared:[]}]}:m),
    cands:D.cands.map(m=>m.id==='booker'?{...m,funderPos:[{key:'aipac',org:'AIPAC',pac:5000,routed:900000,for:0,against:0,compared:[]}]}:m)};
  assert.ok(p);const g=groupInfo(data,'aipac');assert.ok(g.routed>=900000);assert.ok(g.people>=1);
  assert.ok(groupInfo(D,'aipac').routed>0,'the bundled gifts on file');
});

// A fake FEC for the earmark search: each cycle's list of who gave to the campaign (numbered pages, as the FEC's totals
// page), and each committee's payments to it (cursor pages that end with an empty page, as Schedule B does).
function fakeFec({givers={},payments={},fail=new Set()}={}){
  const calls=[];
  const get=async u=>{calls.push(u);const x=new URL(u);
    if(/by_recipient_id/.test(x.pathname)){const pages=givers[x.searchParams.get('cycle')]||[[]],page=Number(x.searchParams.get('page')||1);
      return {results:pages[page-1]||[],pagination:{page,pages:pages.length}};}
    const c=x.searchParams.get('committee_id');if(fail.has(c))throw new Error('HTTP 500');
    const pages=payments[`${c}:${x.searchParams.get('two_year_transaction_period')}`]||[],i=Number(x.searchParams.get('last_index')||0),rows=pages[i]||[];
    return {results:rows,pagination:{last_indexes:rows.length?{last_index:String(i+1)}:null}};};
  return {get,calls};
}
const CAMPAIGN='C00000099',AIPAC='C00000001';
const gift=(amt,date='2026-03-01')=>({disbursement_amount:amt,disbursement_description:'EARMARKED CONTRIBUTION',disbursement_date:date,recipient_committee_id:CAMPAIGN});
const gave=(id,name,total=50000,count=20)=>({committee_id:id,committee_name:name,total,count});
const person={id:'x',fecCmte:CAMPAIGN},groups=[{key:'aipac',org:'AIPAC',conduits:[AIPAC]}];
const search=(fec,o={})=>searchPerson(person,{get:fec.get,groups,known:new Set([AIPAC]),allCycles:[2026],current:2026,...o});

test('a list read up to its page limit says whether the FEC had more, checking the page after a cursor list\'s last',async()=>{
  const pages=n=>({payments:{[`${AIPAC}:2026`]:Array.from({length:n},(_,i)=>[gift(100+i)])}});
  const url=conduitURL(AIPAC,CAMPAIGN,2026);
  const exact=await readPages(fakeFec(pages(3)).get,url,3);
  assert.equal(exact.capped,false,'exactly the limit: the page after it is empty, so nothing was cut');assert.equal(exact.rows.length,3);
  const over=await readPages(fakeFec(pages(4)).get,url,3);
  assert.equal(over.capped,true,'one page more than the limit');assert.equal(over.rows.length,4);
  const under=fakeFec(pages(2));assert.deepEqual((await readPages(under.get,url,3)).capped,false);assert.equal(under.calls.length,3,'two pages and the empty one after');
  const list=n=>fakeFec({givers:{2026:Array.from({length:n},(_,i)=>[gave(`C0000010${i}`,`PAC ${i}`,500,1)])}});
  assert.equal((await readPages(list(5).get,recipientURL(CAMPAIGN,2026),5)).capped,false,'a numbered list of exactly 5 pages');
  assert.equal((await readPages(list(7).get,recipientURL(CAMPAIGN,2026),5)).capped,true,'7 pages, 5 read');
});

test('a person is searched completely only when no read failed and no limit cut anything short',async()=>{
  // Everything fits: complete.
  const ok=await search(fakeFec({givers:{2026:[[gave(AIPAC,'AIPAC PAC')]]},payments:{[`${AIPAC}:2026`]:[[gift(1000),gift(2000)]]}}));
  assert.equal(ok.complete,true);assert.equal(ok.entries.aipac.routed,3000);assert.deepEqual([ok.failed,ok.capped],[[],[]]);
  // A group's payments past the page limit: cut short, so partial; the earlier saved total is kept.
  const many={givers:{2026:[[gave(AIPAC,'AIPAC PAC')]]},payments:{[`${AIPAC}:2026`]:[[gift(1000)],[gift(1000)],[gift(1000)]]}},limits={...LIMITS,conduit:2};
  const kept=await search(fakeFec(many),{limits,prev:{aipac:{routed:9999,n:9}}});
  assert.equal(kept.complete,false);assert.deepEqual(kept.entries.aipac,{routed:9999,n:9});assert.match(kept.capped[0],/AIPAC: more than 200 payments.*kept the earlier \$9,999/);
  const lower=await search(fakeFec(many),{limits});
  assert.equal(lower.entries.aipac.partial,true,'nothing saved before: the total read so far, marked as a lower bound');assert.equal(lower.entries.aipac.routed,3000);
  // More possible conduits than are read from a list: the rest are named, earlier totals for them kept, and it's partial.
  const others={givers:{2026:[[gave(AIPAC,'AIPAC PAC'),gave('C00000011','Group One',90000),gave('C00000012','Group Two',80000),gave('C00000013','Group Three',70000)]]},
    payments:{[`${AIPAC}:2026`]:[[gift(500)]],'C00000011:2026':[[gift(700)]],'C00000012:2026':[[gift(300)]]}};
  const names={},past=await search(fakeFec(others),{limits:{...LIMITS,found:2},names,prev:{'fec:C00000013':{routed:4200,n:3}}});
  assert.equal(past.complete,false);assert.deepEqual(Object.keys(past.entries).sort(),['aipac','fec:C00000011','fec:C00000012','fec:C00000013']);
  assert.deepEqual(past.entries['fec:C00000013'],{routed:4200,n:3},'the one past the limit keeps its earlier total');
  assert.match(past.capped.at(-1),/1 more committee that may forward gifts, past the 2 read.*Group Three/);assert.equal(names['fec:C00000011'],'Group One');
  assert.deepEqual([...conduitsToRead({2026:[{committee:'C00000011',name:'A',total:20000,count:1,memoTotal:0,memoCount:0},{committee:'C00000012',name:'B',total:500,count:1,memoTotal:0,memoCount:0}]},new Set(),1).skipped.keys()],[],
    'a committee that gave less than a PAC may give directly is not a possible conduit, so nothing is skipped');
  // The list of who gave longer than its page limit: some committees may be missing, so partial.
  const long=await search(fakeFec({givers:{2026:[[gave(AIPAC,'AIPAC PAC')],[gave('C00000021','Small PAC',1000,1)],[gave('C00000022','Small PAC 2',1000,1)]]},payments:{[`${AIPAC}:2026`]:[[gift(100)]]}}),{limits:{...LIMITS,recipients:2}});
  assert.equal(long.complete,false);assert.match(long.capped[0],/committees that gave in 2026: more than 200/);
  // A failed read: partial, earlier total kept, as before.
  const failed=await search(fakeFec({givers:{2026:[[gave(AIPAC,'AIPAC PAC')]]},fail:new Set([AIPAC])}),{prev:{aipac:{routed:5000,n:4}}});
  assert.equal(failed.complete,false);assert.deepEqual(failed.entries.aipac,{routed:5000,n:4});assert.match(failed.failed[0],/AIPAC: HTTP 500 \(kept the earlier \$5,000\)/);
});
