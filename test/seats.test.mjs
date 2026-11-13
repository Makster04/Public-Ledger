// The home page's seating charts of who takes corporate PAC money (public/seats.js), and the bulk-file reader behind
// them (scripts/build-corporate-pacs.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {seatLayout,seatOrder,seatChart,corporateStatus,tookShare,TERRITORIES,SEAT_COLORS} from '../public/seats.js';
import {committeeKind,corporateCheck,membersByCandidate,corporateTotals,trackersOf,trackerTotals,kindTotals,conduitList,earmarkTotals,paymentTotals,keptEarmarks,conduitPayments,slimPayment,candidateRow,pastCandidates} from '../scripts/build-corporate-pacs.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import senate from '../public/senate.json' with {type:'json'};
import house from '../public/house.json' with {type:'json'};

test('seats: rows of arcs, every seat once, in order from the left',()=>{
  for(const [n,rows] of [[435,12],[100,5],[7,2]]){
    const s=seatLayout(n,rows,40,100);
    assert.equal(s.length,n);assert.ok(s.every((p,i)=>i===0||p.a<=s[i-1].a),'by angle, left to right');
    assert.ok(s.every(p=>p.y<=1e-9&&Math.abs(Math.hypot(p.x,p.y)-p.r)<1e-6),'on its arc, above the bottom edge');
    assert.equal(new Set(s.map(p=>`${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size,n,'no two seats in one place');
  }
});

test('the order: Democrats from the left (none, took, not read), independents, vacant seats, Republicans to the right (not read, took, none)',()=>{
  const m=(id,party,st)=>({id,party,st,name:id,state:'XX'}),statusOf=x=>x.st;
  const list=[m('r1','R','none'),m('d1','D','took'),m('i1','I','none'),m('d2','D','none'),m('r2','R','took'),m('d3','D','waiting'),m('r3','R','waiting')];
  const o=seatOrder(list,9,statusOf);
  assert.deepEqual(o.map(x=>x?.id??null),['d2','d1','d3','i1',null,null,'r3','r2','r1']);
  assert.equal(corporateStatus([12500,3]),'took');assert.equal(corporateStatus([0,0]),'none');assert.equal(corporateStatus(undefined),'waiting');
});

test('a chamber\'s chart: a dot for each seat, linked to the profile, colored by status, the counts, a dashed line between the parties',()=>{
  const sen=senate.senators,st=x=>x.id==='collins'?'took':x.id==='booker'?'none':'waiting';
  const c=seatChart(sen,{total:100,rows:5,r0:44,r1:100,dot:5.6,label:'Senate',statusOf:st});
  assert.equal((c.svg.match(/<circle/g)||[]).length,100);assert.equal((c.svg.match(/<a href="#/g)||[]).length,100);
  assert.deepEqual(c.counts,{took:1,none:1,waiting:98,vacant:0});
  assert.deepEqual(c.parties,[['D',45],['I',2],['R',53]]);
  assert.match(c.svg,new RegExp(`<a href="#collins" tabindex="-1"><circle[^>]*fill="${SEAT_COLORS.took}"><title>Susan M\\. Collins \\(R-ME\\): took corporate PAC money this cycle</title>`));
  assert.match(c.svg,/stroke-dasharray="3 3"/);assert.match(c.svg,/>100<\/text>/);
  // The House: 435 seats for the voting members (delegates left off), the rest hollow.
  const voting=house.members.filter(x=>!TERRITORIES.has(x.state)),h=seatChart(voting,{total:435,rows:12,r0:66,r1:168,dot:4.3,label:'House',statusOf:()=>'waiting'});
  assert.equal((h.svg.match(/<circle/g)||[]).length,435);assert.equal(h.counts.vacant,435-voting.length);
  assert.equal((h.svg.match(/<title>Vacant seat<\/title>/g)||[]).length,435-voting.length);
  assert.ok(!voting.some(x=>['DC','PR','GU','VI','AS','MP'].includes(x.state)));
  const evil=seatChart([{id:'x"><script>',name:'<b>',party:'D',state:'ZZ'}],{total:3,rows:1,r0:20,r1:40,dot:4,label:'T',statusOf:()=>'none'});
  assert.doesNotMatch(evil.svg,/<script|<b>/);
});

// FEC bulk-file lines, as the files lay them out (pipe-separated): cm.txt and itpas2.txt.
const cm=(id,name,dsgn,type,org,cand='')=>[id,name,'TREASURER','1 MAIN ST','','CITY','ST','00000',dsgn,type,'','Q',org,'SPONSOR',cand].join('|');
const pas=(cmte,tp,amt,cand,memo='')=>{const c=new Array(22).fill('');c[0]=cmte;c[5]=tp;c[13]='10152025';c[14]=String(amt);c[16]=cand;c[19]=memo;return c.join('|');};

test('the bulk files: a corporation\'s PAC, its direct and in-kind checks to each member, refunds taken off',()=>{
  assert.deepEqual(committeeKind(cm('C00000001','ACME CORP PAC','U','Q','C')),['C00000001','corporate','ACME CORP PAC',null]);
  assert.deepEqual(committeeKind(cm('C00000005','NO STOCK CORP PAC','U','Q','W')).slice(0,2),['C00000005','corporate'],'a corporation without capital stock');
  assert.deepEqual(committeeKind(cm('C00000002','TEAMSTERS','U','Q','L')).slice(0,2),['C00000002','labor']);
  assert.deepEqual(committeeKind(cm('C00000004','A LEADERSHIP PAC','D','Q','C')).slice(0,2),['C00000004','leadership'],'a politician\'s PAC, even with a corporate sponsor listed');
  assert.deepEqual(committeeKind(cm('C00314575','COLLINS FOR SENATOR','P','S','','S6ME00159')),['C00314575','candidate','COLLINS FOR SENATOR','S6ME00159'],'a campaign committee knows its candidate');
  assert.equal(committeeKind('header|line'),null);
  const kinds=new Map([['C00000001','corporate'],['C00000002','labor'],['C00000004','leadership']]);
  assert.deepEqual(corporateCheck(pas('C00000001','24K',5000,'S6ME00159'),kinds),{cand:'S6ME00159',cmte:'C00000001',amount:5000,date:'10152025'});
  assert.equal(corporateCheck(pas('C00000001','24Z',750,'H2AK01083'),kinds).amount,750,'in-kind counts');
  assert.equal(corporateCheck(pas('C00000001','24E',90000,'S6ME00159'),kinds),null,'outside spending isn\'t a check');
  assert.equal(corporateCheck(pas('C00000001','24K',2000,'S6ME00159','X'),kinds),null,'a memo line repeats another');
  assert.equal(corporateCheck(pas('C00000002','24K',2500,'S6ME00159'),kinds),null,'a union\'s PAC');
  assert.equal(corporateCheck(pas('C00000004','24K',5000,'S6ME00159'),kinds),null,'a leadership PAC');
  const byCand=membersByCandidate({senators:[{id:'collins',fecCand:'S6ME00159'},{id:'newsen'}]},{members:[{id:'begich',fecCand:'H2AK01083'},{id:'quiet',fecCand:'H0XX00001'}]});
  assert.deepEqual([...byCand],[['S6ME00159','collins'],['H2AK01083','begich'],['H0XX00001','quiet']],'a senator without a candidate ID isn\'t read');
  const t=corporateTotals([{cand:'S6ME00159',cmte:'C1',amount:5000},{cand:'S6ME00159',cmte:'C1',amount:-1000},{cand:'S6ME00159',cmte:'C2',amount:2500},{cand:'H2AK01083',cmte:'C1',amount:750},{cand:'H2AK01083',cmte:'C3',amount:-750},{cand:'S9ZZ00000',cmte:'C1',amount:1}],byCand);
  assert.deepEqual(t,{collins:[6500,2],begich:[0,0],quiet:[0,0]},'net of refunds; a check refunded in full is none; someone not in Congress is left out');
});

test('each tracker\'s checks, matched as its Tracker matches PACs, with AIPAC\'s forwarded gifts',()=>{
  assert.deepEqual(trackersOf('C00797670','AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE'),['aipac'],'by committee ID');
  assert.deepEqual(trackersOf('C09999999','PFIZER INC. PAC'),['pharma'],'by name');
  assert.deepEqual(trackersOf('C09999998','EXXON MOBIL CORPORATION POLITICAL ACTION COMMITTEE'),['oil']);
  assert.deepEqual(trackersOf('C09999997','COINBASE INC PAC'),['crypto']);
  assert.deepEqual(trackersOf('C09999996','LOCAL BAKERY PAC'),[]);
  const byCand=new Map([['S6ME00159','collins'],['S8GA00180','ossoff'],['H2AK01083','begich']]);
  const routed={collins:3348020.18};
  const checks=[{cand:'S6ME00159',cmte:'C00797670',amount:10000,keys:['aipac']},{cand:'S8GA00180',cmte:'C09999999',amount:2500,keys:['pharma']},{cand:'S8GA00180',cmte:'C09999999',amount:-2500,keys:['pharma']},{cand:'H2AK01083',cmte:'C09999998',amount:1000,keys:['oil']}];
  const t=trackerTotals(checks,byCand,routed);
  assert.deepEqual(t.aipac,{collins:[10000,1,3348020.18]});assert.deepEqual(t.pharma,{},'refunded in full: none');assert.deepEqual(t.oil,{begich:[1000,1]});
  assert.deepEqual(Object.keys(t),['aipac','pharma','oil','tech','crypto','defense','wallstreet']);
  assert.deepEqual(trackerTotals([],byCand,{ossoff:250}).aipac,{ossoff:[0,0,250]},'routed gifts alone count');
});

test('every group\'s forwarded gifts: the reviewed profiles\' conduits and the others their search found, each committee once',()=>{
  const list=conduitList({conduits:{aipac:['C00797670'],cfg:['C00432260'],bad:['x']},names:{'fec:C00247403':'NORPAC','fec:C00432260':'CLUB FOR GROWTH PAC','other':'?'}});
  assert.deepEqual(list,[{key:'aipac',cmte:'C00797670'},{key:'cfg',cmte:'C00432260'},{key:'fec:C00247403',cmte:'C00247403'}]);
  assert.deepEqual(conduitList(undefined),[]);
});

test('a group\'s payments read as the reviewed profiles read them, added up by member',()=>{
  const byCand=new Map([['S6ME00159','collins'],['H2AK01083','begich']]),cmteCand=new Map([['C00314575','S6ME00159'],['C00700001','H2AK01083'],['C00700002','H2AK01083']]);
  const pay=(to,amt,desc,memo)=>({recipient_committee_id:to,disbursement_amount:amt,disbursement_description:desc,memo_code:memo?'X':null,disbursement_date:'2026-03-01'});
  const rows=[
    // Collins: forwarded gifts listed as memo entries, and the PAC's own $5,000 check (not forwarded)
    pay('C00314575',2500,'EARMARKED CONTRIBUTION',true),pay('C00314575',1000,'EARMARK',true),pay('C00314575',5000,'CONTRIBUTION',false),
    // Begich, two committees: one total line with its gifts as memos below it (the line counts, not both); memos only
    pay('C00700001',300,'EARMARKED CONTRIBUTIONS',false),pay('C00700001',200,'EARMARK',true),pay('C00700001',100,'EARMARK',true),pay('C00700002',800,'EARMARK',true),
    // someone not in Congress, a payment with no committee, an operating expense
    pay('C00999999',900,'EARMARK',true),pay(null,50,'EARMARK',true),{recipient_committee_id:null,disbursement_amount:1200,disbursement_description:'RENT'}];
  assert.deepEqual(paymentTotals(rows,cmteCand,byCand),{collins:{routed:3500,n:2,cmte:'C00314575'},begich:{routed:1100,n:3,cmte:'C00700002'}});
  assert.deepEqual(slimPayment({...rows[0],committee:{name:'x'},pdf_url:'u'}),{recipient_committee_id:'C00314575',disbursement_amount:2500,disbursement_date:'2026-03-01',disbursement_description:'EARMARKED CONTRIBUTION',memo_text:null,memo_code:'X',memoed_subtotal:null});
  const got=[{key:'aipac',byMember:{collins:{routed:3348020.18,n:2136,cmte:'C00314575'}}},{key:'cfg',byMember:{collins:{routed:0,n:0},begich:{routed:250,n:2,cmte:'C00700001'}}},{key:'aipac',byMember:{collins:{routed:0.1,n:1,cmte:'C9'}}}];
  assert.deepEqual(earmarkTotals(got),{collins:{aipac:[3348020.28,2137,'C00314575']},begich:{cfg:[250,2,'C00700001']}},'a group with two committees adds up; none is left out');
  // A group that couldn't be read keeps the last file's totals, only when that file was read from the payments.
  const prev={routed:{method:'payments',groups:['jstreet','scf']},earmarks:{ossoff:{jstreet:[309639.01,800,'C00740001'],aipac:[1,1,'C1']},collins:{cfg:[5,1,'C2']}}};
  assert.deepEqual(keptEarmarks(prev,['jstreet','scf','emily']),{jstreet:{ossoff:{jstreet:[309639.01,800,'C00740001']}},scf:{}},'read before with none: kept as none; never read: not kept');
  assert.deepEqual(keptEarmarks({routed:{aipac:true},earmarks:prev.earmarks},['jstreet']),{},'a file from the FEC\'s totals by recipient is never kept');
  assert.deepEqual(earmarkTotals([],keptEarmarks(prev,['jstreet'])),{ossoff:{jstreet:[309639.01,800,'C00740001']}});
});

test('a group\'s payments: page after page, saved so a stopped run picks up where it left off, waiting out the FEC\'s hourly limit',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'conduits-'));
  const pages=[[{recipient_committee_id:'C1',disbursement_amount:5,disbursement_description:'EARMARK',memo_code:'X'}],[{recipient_committee_id:'C2',disbursement_amount:7,disbursement_description:'EARMARK',memo_code:'X'}],[]];
  const page=url=>Number(new URL(url).searchParams.get('last_index')||0);
  const reply=i=>({results:pages[i],pagination:{last_indexes:pages[i].length?{last_index:String(i+1),last_disbursement_date:'2026-01-01'}:null}});
  // The first run reads one page, then the FEC refuses (not the hourly limit): it stops, keeping that page.
  let calls=[];const fail=async url=>{calls.push(page(url));if(page(url)===1){const e=new Error('api.open.fec.gov returned HTTP 500');e.statusCode=500;throw e;}return reply(page(url));};
  await assert.rejects(conduitPayments('C00797670',2026,{dir,get:fail,log:()=>{}}),/HTTP 500/);
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'C00797670.json'),'utf8'));
  assert.equal(saved.pages,1);assert.equal(saved.done,false);assert.ok(!/api_key/.test(saved.next),'no key in the saved link');
  // The next run picks up at page 2; the hourly limit once, waited out.
  calls=[];let waited=[],limited=false;
  const get=async url=>{calls.push(page(url));if(!limited&&page(url)===1){limited=true;const e=new Error('api.open.fec.gov returned HTTP 429');e.statusCode=429;e.retryAfter=0;throw e;}return reply(page(url));};
  const rows=await conduitPayments('C00797670',2026,{dir,get,wait:async ms=>{waited.push(ms);},log:()=>{}});
  assert.deepEqual(calls,[1,1,2],'resumed at page 2, which was asked for again after the wait');
  assert.deepEqual(waited,[600000],'no wait given: 10 minutes');
  assert.deepEqual(rows.map(r=>r.disbursement_amount),[5,7]);
  // Done and under a week old: from the saved file, no requests; over a week old, or with refresh: read again.
  calls=[];await conduitPayments('C00797670',2026,{dir,get,log:()=>{}});assert.deepEqual(calls,[]);
  await conduitPayments('C00797670',2026,{dir,get,refresh:true,log:()=>{}});assert.deepEqual(calls,[0,1,2]);
  calls=[];await conduitPayments('C00797670',2026,{dir,get,now:Date.now()+8*86400000,log:()=>{}});assert.deepEqual(calls,[0,1,2]);
  // The FEC timing out (HTTP 504): asked again after 30 seconds, 1 minute and 2 minutes, then it stops.
  const d2=fs.mkdtempSync(path.join(os.tmpdir(),'conduits-'));let slowWaits=[],timeouts=0;
  const flaky=async url=>{if(page(url)===1&&timeouts<2){timeouts++;const e=new Error('api.open.fec.gov returned HTTP 504');e.statusCode=504;throw e;}return reply(page(url));};
  assert.deepEqual((await conduitPayments('C00797670',2026,{dir:d2,get:flaky,wait:async ms=>{slowWaits.push(ms);},log:()=>{}})).map(r=>r.disbursement_amount),[5,7]);
  assert.deepEqual(slowWaits,[30000,60000],'two timeouts, then the page came through');
  const d3=fs.mkdtempSync(path.join(os.tmpdir(),'conduits-'));slowWaits=[];
  const down=async url=>{if(page(url)===1){const e=new Error('api.open.fec.gov returned HTTP 504');e.statusCode=504;throw e;}return reply(page(url));};
  await assert.rejects(conduitPayments('C00797670',2026,{dir:d3,get:down,wait:async ms=>{slowWaits.push(ms);},log:()=>{}}),/HTTP 504/);
  assert.deepEqual(slowWaits,[30000,60000,120000],'three tries, then it stops, keeping the pages read');
  assert.equal(JSON.parse(fs.readFileSync(path.join(d3,'C00797670.json'),'utf8')).pages,1);
  // The hourly limit more than 7 times in a row: it stops.
  const always=async()=>{const e=new Error('api.open.fec.gov returned HTTP 429');e.statusCode=429;throw e;};
  await assert.rejects(conduitPayments('C00432260',2026,{dir,get:always,wait:async()=>{},log:()=>{}}),/429/);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('each member\'s PAC checks by kind of PAC, for Big Money Independence on every profile',()=>{
  const byCand=new Map([['S6ME00159','collins'],['H2AK01083','begich']]);
  const k=kindTotals([{cand:'S6ME00159',kind:'corporate',amount:5000},{cand:'S6ME00159',kind:'labor',amount:2500},{cand:'S6ME00159',kind:'corporate',amount:-1000},
    {cand:'S6ME00159',kind:'party',amount:5000},{cand:'H2AK01083',kind:'trade',amount:1000},{cand:'H2AK01083',kind:'trade',amount:-1000},{cand:'H2AK01083',kind:null,amount:0.1+0.2},{cand:'S9ZZ00000',kind:'corporate',amount:1}],byCand);
  assert.deepEqual(k,{collins:{corporate:4000,labor:2500},begich:{other:0.3}},'net of refunds; party committees and kinds refunded in full left out; an unknown committee is "other"; someone not in Congress is left out');
});

test('the title\'s share: of everyone once all are read, else of those read so far, saying how many',()=>{
  assert.equal(tookShare({took:188,none:245,waiting:0,vacant:2}),'43%','vacant seats don\'t count');
  assert.equal(tookShare({took:14,none:2,waiting:417,vacant:2}),'88% of 16 read');
  assert.equal(tookShare({took:0,none:98,waiting:2}),'0% of 98 read');assert.equal(tookShare({took:1,none:432,waiting:0}),'<1%');
  assert.equal(tookShare({took:0,none:0,waiting:100}),'','no one read yet: nothing');
});

test('a member\'s other candidate IDs for the six years: the same committee in the same state, a House incumbent of the same name, or this cycle\'s Senate run under a new committee (same name, state and party); not a namesake\'s',()=>{
  const rows=[
    'S4NJ00466|KIM, ANDY|DEM|2024|NJ|S|00|O|C|C00648220','H8NJ03206|KIM, ANDY|DEM|2024|NJ|H|03|I|C|C00648220',
    'S4MI00470|SLOTKIN, ELISSA|DEM|2024|MI|S|00|O|C|C00834218','H8MI08102|SLOTKIN, ELISSA|DEM|2024|MI|H|07|I|C|C00650150',
    'H2NJ08232|MENENDEZ, ROBERT J.|DEM|2026|NJ|H|08|I|C|C00799767','H2NJ13075|MENENDEZ, ROBERT|DEM|2026|NJ|H|08|C|C|C00799767','S6NJ00289|MENENDEZ, ROBERT|IND|2024|NJ|S|00|I|C|C00264564',
    'H2OR06100|SALINAS, ANDREA|DEM|2024|OR|H|06|I|C|C00800000','H2NC07146|SOMEONE, ELSE|REP|2022|NC|H|07|C|C|C00800000',
    'H6NH01990|PAPPAS, CHRIS|DEM|2026|NH|H|01|I|C|C00630012','S6NH00141|PAPPAS, CHRIS|DEM|2026|NH|S|00|O|C|C00630012',
    'H8MI11264|STEVENS, HALEY|DEM|2026|MI|H|11|I|C|C00654111','S6MI00426|STEVENS, HALEY|DEM|2026|MI|S|00|O|C|C00915000',
    'S6MI00999|STEVENS, HALEY|REP|2026|MI|S|00|O|C|C00915999','S2MI00111|STEVENS, HALEY|DEM|2022|MI|S|00|C|C|C00811111'].map(candidateRow);
  assert.deepEqual(rows[0],{cand:'S4NJ00466',name:'KIM, ANDY',party:'DEM',year:2024,state:'NJ',office:'S',ici:'O',pcc:'C00648220'});
  const byCand=new Map([['S4NJ00466','kim'],['S4MI00470','slotkin'],['H2NJ08232','menendez'],['H2OR06100','salinas'],['H6NH01990','pappas'],['H8MI11264','stevens']]);
  assert.deepEqual(pastCandidates(rows,byCand,2022,2026),{kim:['H8NJ03206'],slotkin:['H8MI08102'],menendez:['H2NJ13075'],pappas:['S6NH00141'],stevens:['S6MI00426']},
    'Kim by his committee, Slotkin by name as the sitting House member, Menendez Jr. by his own committee (not his father\'s Senate ID), Pappas\'s 2026 Senate run, Stevens\'s 2026 Senate run under a new committee (not another party\'s namesake or an older Senate filing); not the other state\'s filing that lists Salinas\'s committee');
  assert.deepEqual(pastCandidates(rows,byCand,2022).stevens,undefined,'the Senate rule needs the latest cycle');
});
