// The trackers' super PACs in the midterms (Nov. 26, 2026): the builder (scripts/build-midterm-trackers.mjs), the card
// helpers (public/midterm-trackers.js), the file the page reads and where the cards show.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lastName,fecResults,siteResults,midtermTrackers,MIDTERMS} from '../scripts/build-midterm-trackers.mjs';
import {winShare,versus,midtermYears,prevMidterm} from '../public/midterm-trackers.js';

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

test('the card: the share who won of the called races, and the arrow against the midterm before',()=>{
  assert.deepEqual(winShare({supported:{n:9,won:7,open:0}}),{pct:78,n:9,open:0});
  assert.deepEqual(winShare({supported:{n:8,won:3,open:1}}),{pct:43,n:7,open:1});
  assert.equal(winShare({supported:{n:2,won:0,open:2}}),null);assert.equal(winShare(undefined),null);
  const now={pct:43},before={pct:78};
  assert.deepEqual(versus(now,before,2022),{dir:'down',text:'Down from 78% in 2022'});
  assert.equal(versus(before,now,2022).dir,'up');assert.equal(versus(now,now,2022).dir,'same');
  assert.deepEqual(versus(now,null,2022),{dir:'new',text:'New this midterm: none in 2022'});
  assert.equal(versus(now,before,null),null);
  const d={years:{2018:{trackers:{}},2022:{trackers:{aipac:{}}},2026:{trackers:{aipac:{},crypto:{}}}}};
  assert.deepEqual(midtermYears(d),[2026,2022],'2018 has no tracker super PAC spending, so it isn\'t offered');
  assert.deepEqual([prevMidterm(d,2026),prevMidterm(d,2022),prevMidterm(d,2018)],[2022,2018,null]);
});

test('the file the page reads: 2026, 2022 and 2018, with the numbers checked against the FEC files',()=>{
  const d=JSON.parse(read('public/midterm-trackers.json'));
  assert.deepEqual(MIDTERMS,[2026,2022,2018]);
  assert.deepEqual(Object.keys(d.years).sort(),['2018','2022','2026']);
  assert.deepEqual(d.years['2018'].trackers,{},'no tracker had a super PAC in 2018');
  assert.equal(d.years['2022'].results,'fec');
  const u=d.years['2022'].trackers.aipac;assert.deepEqual(u.supported,{n:9,won:7,open:0});assert.ok(Math.abs(u.for+u.against-26.1e6)<0.2e6,`UDP 2022: ${u.for+u.against}`);
  for(const k of ['aipac','crypto','tech'])assert.ok(d.years['2026'].trackers[k],`2026 ${k}`);
  for(const [y,v] of Object.entries(d.years))for(const [k,t] of Object.entries(v.trackers)){
    assert.ok(t.forWon+t.forLost<=t.for+0.01&&t.againstWon+t.againstLost<=t.against+0.01,`${y} ${k}: won and lost fit in the totals`);
    assert.ok(t.supported.won+t.supported.open<=t.supported.n,`${y} ${k}: counts`);}
});

test('where the cards show: the top of the Super PACs page, before the cycle\'s list; built by npm run superpacs:midterms and monthly',()=>{
  const app=read('public/app.js'),css=read('public/remake.css'),pkg=JSON.parse(read('package.json'));
  assert.match(app,/<div id="sp-midterms"><\/div><div id="sp-body">/);
  assert.match(app,/renderMidtermTrackers\(\);/);
  assert.match(app,/from '\.\/midterm-trackers\.js'/);
  assert.match(app,/<span class="kw-open"><\/span><\/summary><h4>Biggest spenders<\/h4>/,'Open at the bottom of each card lists its super PACs');
  assert.match(css,/\.mt-sec \{ --mt-won: #9085e9; --mt-lost: #c98500;/);
  assert.equal(pkg.scripts['superpacs:midterms'],'node scripts/build-midterm-trackers.mjs');
  assert.match(read('scripts/build-corporate-pacs.mjs'),/writeMidtermTrackers\(\{years:\[Number\(cycle\)\],dir,refresh\}\)/);
});
