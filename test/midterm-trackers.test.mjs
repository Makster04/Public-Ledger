// The trackers' super PACs in the midterms (Nov. 26, 2026): the builder (scripts/build-midterm-trackers.mjs), the card
// helpers (public/midterm-trackers.js), the file the page reads and where the cards show.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {Readable} from 'node:stream';
import {lastName,fecResults,siteResults,midtermTrackers,superPacSpending,giftOf,giftTracker,fundedMatchers,fundedTrackers,zipFirstEntry,legislatorResults,ELECTIONS} from '../scripts/build-midterm-trackers.mjs';
import {winShare,versus,electionYears,prevElection,orderTrackers,SORTS,hadMoney,MIN_CANDIDATES,FUNDED_CUTOFF,trendColor,trendPoints,TREND_FULL} from '../public/midterm-trackers.js';
import {TRACKER} from '../public/trackers.js';

const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const UDP='C00799031';

test('last names to match on, from the FEC\'s "LAST, FIRST" and from the site\'s "First Last Jr."',()=>{
  assert.deepEqual(['BROWN, SHONTEL','Brown, Shontel','Shontel Brown','Bennie G. Thompson Jr.','SMITH JR, JOHN'].map(lastName),['BROWN','BROWN','BROWN','THOMPSON','SMITH']);
});

test('the FEC\'s results workbook: the general-election winners, whichever way the year labels its columns',()=>{
  const head=['1','STATE ABBREVIATION','STATE','DISTRICT','FEC ID#','(I)','CANDIDATE NAME (First)','CANDIDATE NAME (Last)','CANDIDATE NAME','TOTAL VOTES','PARTY','GE WINNER INDICATOR'];
  const {won,seats}=fecResults([{name:'House',rows:[head,['2','OH','Ohio','11','H2OH11169','(I)','Shontel','Brown','Brown, Shontel','','D','W'],['3','OH','Ohio','11','H2OH11999','','Nina','Turner','Turner, Nina','','D',''],['4','OH','Ohio','','n/a']]},
    {name:'Senate',rows:[head.map(h=>h==='FEC ID#'?'FEC ID':h),['2','PA','Pennsylvania','S','S2PA00000','','John','Fetterman','Fetterman, John','','D','W']]},{name:'Notes',rows:[['nothing here']]}]);
  assert.deepEqual([...won].sort(),['H2OH11169','S2PA00000']);
  assert.deepEqual(seats.get('H-OH-11').map(x=>x.last),['BROWN','TURNER']);
});

test('the site\'s race calls until the FEC\'s results are out: called races, open ones, and House members nobody else beat',()=>{
  const r=siteResults({
    research:{members:[{id:'ossoff',name:'Jon Ossoff',fecCand:'S8GA00180',state:'GA'}],races:[{id:'S-GA',keys:['ossoff','other'],result:{winner:'ossoff'}}],
      liteRaces:[{id:'H-AZ-06',nominees:[{name:'Juan Ciscomani',fecCand:'H2AZ02360'},{name:'JoAnna Mendoza',fecCand:'H6AZ06099'}],result:{winner:'H6AZ06099'}},
        {id:'H-CA-13',nominees:[{name:'Adam Gray',fecCand:'H2CA13000'},{name:'Someone Else',fecCand:'H6CA13000'}]}]},
    elect:{races:[{id:'H-AL-01',nominees:[{id:'carl',name:'Jerry Carl',fecCand:'H0AL01055'}],result:{winner:'carl'}}]},
    house:{members:[{id:'moore',name:'Barry Moore',state:'AL',district:1,fecCand:'H0AL02087'},{id:'kaptur',name:'Marcy Kaptur',state:'OH',district:9,fecCand:'H2OH09031'},{id:'del',delegate:true,state:'DC',district:0,fecCand:'H0DC00058'}]},
    senate:{senators:[]}});
  assert.deepEqual([...r.won].sort(),['H0AL01055','H2OH09031','H6AZ06099','S8GA00180'],'called winners, and Kaptur, whose seat had no race on file');
  assert.ok(!r.won.has('H0AL02087'),'Moore\'s seat went to a member-elect');
  assert.deepEqual([...r.open].sort(),['H2CA13000','H6CA13000'],'a race not called yet');
  assert.ok(r.nominees.some(([seat,last,id])=>seat==='H-AZ-06'&&last==='MENDOZA'&&id==='H6AZ06099'));
});

test('a tracker\'s midterm: spending by side and result, each backed candidate once, records without a candidate ID filled in',()=>{
  const r=o=>({spe_id:UDP,spe_nam:'UNITED DEMOCRACY PROJECT (UDP)',cand_id:'H1',cand_name:'ALPHA, ANN',can_office:'H',can_office_state:'OH',can_office_dis:'11',sup_opp:'S',exp_amo:'100',exp_date:'01-MAY-22',file_num:'1',tran_id:'t1',image_num:'i1',...o});
  const records=[
    r({}),r({tran_id:'t2',exp_amo:'50'}),                                                    // Ann, twice: one candidate
    r({tran_id:'t3',cand_id:'',cand_name:'ALPHA, ANN M',exp_amo:'25'}),                      // no ID: the file's other records give it
    r({tran_id:'t4',cand_id:'H2',cand_name:'BETA, BOB',can_office_dis:'09',exp_amo:'300'}),  // lost
    r({tran_id:'t5',cand_id:'H3',cand_name:'GAMMA, CY',sup_opp:'O',exp_amo:'80'}),            // opposed, lost: not a backed candidate
    r({tran_id:'t6',cand_id:'H4',cand_name:'DELTA, DEE',can_office_dis:'03',exp_amo:'40'}),   // race not called yet
    r({tran_id:'t7',cand_id:'H5',cand_name:'EPS, ED',can_office_dis:'04',exp_amo:'60'}),r({tran_id:'t8',cand_id:'H5',cand_name:'EPS, ED',can_office_dis:'04',exp_amo:'-60'}), // refunded: no candidate
    r({spe_id:'C9',spe_nam:'SOME OTHER PAC',tran_id:'t9',exp_amo:'1000'}),                    // not a tracker's
    r({tran_id:'t10',can_office:'P',can_office_state:'US',exp_amo:'5000'})];                  // not a House or Senate race
  const {trackers,through}=midtermTrackers(records,{won:new Set(['H1']),open:new Set(['H4'])});
  const t=trackers.aipac;
  assert.deepEqual(Object.keys(trackers),['aipac']);assert.equal(through,'2022-05-01');
  assert.deepEqual([t.for,t.forWon,t.forLost,t.against,t.againstWon,t.againstLost],[515,175,300,80,0,80]);
  assert.deepEqual(t.supported,{n:3,won:1,open:1},'Ann won, Bob lost, Dee\'s race is open; Ed\'s money was refunded');
  assert.deepEqual(t.pacs.map(p=>[p.id,p.for,p.against]),[[UDP,515,80]]);
});

test('the winners of an earlier election before the FEC\'s results are out: a House or Senate term starting the January 3 after it',()=>{
  const people=[{id:{fec:['H4NY16087']},terms:[{type:'rep',start:'2023-01-03'},{type:'rep',start:'2025-01-03'}]},
    {id:{fec:['H8CA28111','S4CA00694']},terms:[{type:'rep',start:'2023-01-03'},{type:'sen',start:'2025-01-03'}]},
    {id:{fec:['H2NY99999']},terms:[{type:'rep',start:'2023-01-03'}]},{id:{},terms:[{type:'rep',start:'2025-01-03'}]}];
  assert.deepEqual([...legislatorResults(2024,people).won].sort(),['H4NY16087','H8CA28111','S4CA00694'],'every FEC ID of a winner; someone who left in 2024 isn\'t one');
  assert.equal(legislatorResults(2022,people).won.size,4,'2022: the terms starting Jan. 3, 2023');assert.equal(legislatorResults(2020,people).won.size,0);
});

test('the cards in the order picked: A to Z, the arrow\'s points, the share who won or the money, cards without the number last',()=>{
  const T=[{key:'a',name:'Alpha'},{key:'b',name:'Beta'},{key:'c',name:'Gamma'},{key:'d',name:'Delta'}];
  const sup=(n,won)=>({n,won,open:0});
  const Y={a:{for:10,against:0,supported:sup(10,4)},b:{for:5,against:20,supported:sup(10,9)},c:{for:1,against:0,supported:sup(3,3)}};
  const P={a:{for:1,against:0,supported:sup(10,8)},b:{for:1,against:0,supported:sup(10,5)}};
  const order=how=>orderTrackers(T,Y,P,how).map(t=>t.key).join('');
  assert.deepEqual(SORTS.map(([k])=>k),['az','increase','decline','most','least','money','little']);
  assert.equal(order('az'),'abdc','A to Z: Alpha, Beta, Delta, Gamma');assert.equal(order('nonsense'),'abdc');
  assert.equal(order('increase'),'badc','Beta +40 before Alpha -40; Gamma (new) and Delta (none) after, A to Z');
  assert.equal(order('decline'),'abdc');
  assert.equal(order('most'),'badc','Gamma\'s 3 candidates are too few to rank');assert.equal(order('least'),'abdc');
  assert.equal(order('money'),'bacd');assert.equal(order('little'),'cabd');
});

test('the card: the share who won of the called races, at least 5 candidates, and the arrow against the midterm before',()=>{
  assert.equal(MIN_CANDIDATES,5);
  assert.deepEqual(winShare({supported:{n:9,won:7,open:0}}),{pct:78,n:9,open:0,few:false});
  assert.deepEqual(winShare({supported:{n:8,won:3,open:1}}),{pct:43,n:7,open:1,few:false});
  assert.equal(winShare({supported:{n:3,won:2,open:0}}).few,true,'3 candidates are too few to say');
  assert.equal(versus(winShare({supported:{n:3,won:2,open:0}}),{pct:50},2022),null,'too few now: nothing to compare');
  assert.deepEqual(versus({pct:41},{pct:100,few:true},2022,true),{dir:'few',text:'Too few candidates in 2022 to compare'});
  assert.deepEqual(versus({pct:41},null,2022,true),{dir:'few',text:'Too few candidates in 2022 to compare'},'money then, but no candidates to count');
  assert.equal(hadMoney({for:0,against:0,gave:5}),true);assert.equal(hadMoney({for:0,against:0}),false);assert.equal(hadMoney(undefined),false);
  assert.equal(winShare({supported:{n:2,won:0,open:2}}),null);assert.equal(winShare(undefined),null);
  const now={pct:43},before={pct:78};
  assert.deepEqual(versus(now,before,2022),{dir:'down',delta:-35,text:'Down from 78% in 2022'});
  // The arrow: greener up, redder down, stronger the bigger the move; the points under it.
  assert.equal(TREND_FULL,30);
  assert.equal(trendColor(-35),'color-mix(in oklab, var(--crit) 100%, var(--ink-2))');
  assert.equal(trendColor(3),'color-mix(in oklab, var(--good) 42%, var(--ink-2))');
  assert.equal(trendColor(0),null);
  assert.deepEqual([trendPoints(-35),trendPoints(12),trendPoints(1)],['−35 pts','+12 pts','+1 pt']);
  assert.equal(versus(before,now,2022).dir,'up');assert.equal(versus(now,now,2022).dir,'same');
  assert.deepEqual(versus(now,null,2022),{dir:'new',text:'New this election: none in 2022'});
  assert.equal(versus(now,before,null),null);
  const d={years:{2018:{trackers:{}},2022:{trackers:{aipac:{}}},2026:{trackers:{aipac:{},crypto:{}}}}};
  assert.deepEqual(electionYears(d),[2026,2022],'a year with no tracker super PAC money isn\'t offered');
  assert.deepEqual([prevElection(d,2026),prevElection(d,2022),prevElection(d,2018)],[2022,2018,null]);
});

test('the five lobbies without their own super PACs: gifts matched by company, PAC and employer, and their share of what those super PACs spent',()=>{
  // itcont/itoth lines: memo lines and money going out are left out.
  const line=(o)=>{const v=Array(21).fill('');Object.entries(o).forEach(([i,x])=>v[i]=x);return v.join('|');};
  assert.deepEqual(giftOf(line({0:'C1',5:'15',6:'ORG',7:'Chevron Corporation',14:'500000'})),{cmte:'C1',person:false,name:'CHEVRON CORPORATION',employer:'',amount:500000,other:''});
  assert.equal(giftOf(line({0:'C1',5:'15',6:'ORG',7:'X',14:'5',18:'X'})),null,'a memo line');
  assert.equal(giftOf(line({0:'C1',5:'24K',6:'PAC',7:'X',14:'5'})),null,'money going out');
  const m=fundedMatchers([TRACKER.oil,TRACKER.wallstreet]);
  assert.deepEqual(giftTracker({person:false,name:'AMERICAN PETROLEUM INSTITUTE',other:''},m),{key:'oil',counted:true},'a trade group counts');
  assert.deepEqual(giftTracker({person:false,name:'SOME PAC',other:TRACKER.oil.pacIds[0]},m),{key:'oil',counted:true},'one of its PACs, by committee ID');
  assert.deepEqual(giftTracker({person:true,name:'DOE, JANE',employer:'GOLDMAN SACHS'},m),{key:'wallstreet',counted:false},'an employee: shown, not counted');
  assert.equal(giftTracker({person:false,name:'ACME WIDGETS',other:''},m),null);
  // Two super PACs: SLF raised $1,000; Oil gave it $100 (10%), so it gets 10% of each of SLF's expenditures.
  const r=o=>({spe_id:'C1',spe_nam:'SLF PAC',cand_id:'S1',cand_name:'A, B',can_office:'S',can_office_state:'GA',can_office_dis:'',sup_opp:'O',exp_amo:'5000',file_num:'1',tran_id:'t',image_num:'i',...o});
  const records=[r({}),r({tran_id:'t2',cand_id:'S2',cand_name:'C, D',can_office_state:'OH',sup_opp:'S',exp_amo:'2000'}),r({spe_id:'C2',spe_nam:'OTHER',tran_id:'t3',cand_id:'S3',cand_name:'E, F',sup_opp:'S',exp_amo:'900'}),r({spe_id:'C9',spe_nam:'A PARTY',tran_id:'t4'})];
  const spend=superPacSpending(records,{types:new Map([['C1',{name:'SLF PAC',type:'O'}],['C2',{name:'OTHER',type:'V'}],['C9',{name:'A PARTY',type:'Y'}]]),won:new Set(['S1','S3'])});
  assert.deepEqual([...spend.keys()],['C1','C2'],'super PACs only (FEC types O, V and W)');
  const gifts=[{cmte:'C1',amount:60000,key:'oil',counted:true},{cmte:'C1',amount:40000,key:'oil',counted:true},{cmte:'C2',amount:50,key:'oil',counted:true},{cmte:'C1',amount:999,key:'oil',counted:false},{cmte:'C7',amount:1e6,key:'oil',counted:true}];
  const out=fundedTrackers(spend,{gifts,receipts:new Map([['C1',1_000_000],['C2',1000]]),keys:['oil','wallstreet']}).oil;
  assert.equal(FUNDED_CUTOFF,100000);
  assert.deepEqual([out.kind,out.gave,out.employees,out.funded],['funded',100050,999,1],'a super PAC that spent nothing in the midterm is left out');
  assert.deepEqual([out.for,out.against,out.forWon,out.forLost,out.againstWon,out.againstLost],[245,500,45,200,500,0],'10% of SLF\'s, 5% of the other\'s');
  assert.deepEqual(out.supported,{n:1,won:0,open:0},'only the super PAC it gave $100,000 or more counts for candidates');
  assert.deepEqual(out.pacs.map(p=>[p.id,p.gave,p.share]),[['C1',100000,10],['C2',50,5]]);
});

test('the donor files are read as they download: the first file in a zip, past its local header',async()=>{
  const text='C1|a\nC2|b\n',data=zlib.deflateRawSync(Buffer.from(text)),name=Buffer.from('itcont.txt');
  const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(8,8);head.writeUInt16LE(name.length,26);
  const zip=Buffer.concat([head,name,data,Buffer.from('PK\u0001\u0002 the central directory follows')]);
  const chunks=[];for await(const c of zipFirstEntry(Readable.from([zip.subarray(0,12),zip.subarray(12)])))chunks.push(c);
  assert.equal(Buffer.concat(chunks).toString(),text);
});

test('the file the page reads: every House and Senate election from 2018 to 2026, with the numbers checked against the FEC files',()=>{
  const d=JSON.parse(read('public/midterm-trackers.json'));
  assert.deepEqual(ELECTIONS,[2026,2024,2022,2020,2018],'presidential years included (approved 2026-11-26)');
  assert.deepEqual(Object.keys(d.years).sort(),['2018','2020','2022','2024','2026']);
  for(const y of ['2018','2020'])assert.ok(Object.values(d.years[y].trackers).every(t=>t.kind==='funded'),`no tracker had its own super PAC in ${y}; the five funded others`);
  assert.equal(d.years['2022'].results,'fec');assert.equal(d.years['2020'].results,'fec');
  assert.ok(['fec','legislators'].includes(d.years['2024'].results),'2024: the FEC\'s results, or who took office in January 2025');
  for(const k of ['aipac','crypto'])assert.equal(d.years['2024'].trackers[k]?.kind,'own',`2024 ${k}: United Democracy Project and Fairshake spent`);
  const u=d.years['2022'].trackers.aipac;assert.deepEqual(u.supported,{n:9,won:7,open:0});assert.ok(Math.abs(u.for+u.against-26.1e6)<0.2e6,`UDP 2022: ${u.for+u.against}`);
  for(const k of ['aipac','crypto','tech'])assert.equal(d.years['2026'].trackers[k]?.kind,'own',`2026 ${k}`);
  for(const k of ['pharma','insurers','oil','defense','wallstreet'])assert.equal(d.years['2026'].trackers[k]?.kind,'funded',`2026 ${k}: the super PACs its companies gave to`);
  assert.ok(d.years['2026'].trackers.oil.gave>40e6,'Big Oil\'s companies and trade groups gave tens of millions');
  for(const [y,v] of Object.entries(d.years))for(const [k,t] of Object.entries(v.trackers)){
    assert.ok(t.forWon+t.forLost<=t.for+0.05&&t.againstWon+t.againstLost<=t.against+0.05,`${y} ${k}: won and lost fit in the totals`);
    assert.ok(t.supported.won+t.supported.open<=t.supported.n,`${y} ${k}: counts`);}
});

test('where the cards show: the top of the Super PACs page, before the cycle\'s list; built by npm run superpacs:midterms and monthly',()=>{
  const app=read('public/app.js'),css=read('public/remake.css'),pkg=JSON.parse(read('package.json'));
  assert.match(app,/<div id="sp-midterms"><\/div><div id="sp-body">/);
  assert.match(app,/renderMidtermTrackers\(\);/);
  assert.match(app,/role="group" aria-label="Election"/);assert.match(app,/The trackers' super PACs in the \$\{mtYear\} elections/);
  assert.match(app,/const order=orderTrackers\(TRACKERS,Y,P,mtSort\);/,'in the order picked, A to Z by default');assert.match(app,/<select id="mt-sort"/);
  assert.match(app,/from '\.\/midterm-trackers\.js'/);
  assert.match(app,/<details class="mt-more"><summary><span class="kw-open"><\/span><\/summary>\$\{list\}<\/details>/,'Open at the bottom of each card lists its super PACs');
  assert.match(app,/'Super PACs it funds':'Its own super PACs'/);assert.match(app,/<h4>Super PACs it funded<\/h4>/);assert.match(app,/People who work for its companies gave/);
  assert.match(app,/<span class="mt-trend" style="--mt-trend:\$\{trendColor\(vs\.delta\)\}"/,'the arrow takes its color from the size of the change');
  assert.match(css,/\.mt-sec \{ --mt-won: #9085e9; --mt-lost: #c98500;/);
  assert.equal(pkg.scripts['superpacs:midterms'],'node scripts/build-midterm-trackers.mjs');
  assert.match(read('scripts/build-corporate-pacs.mjs'),/writeMidtermTrackers\(\{years:\[Number\(cycle\)\],dir,refresh\}\)/);
});
