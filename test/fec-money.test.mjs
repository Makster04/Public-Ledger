// The FEC money read beyond the cycle's totals (public/fec-money.js, the refresh feeds in src/feeds.mjs, and the
// earmark finder in scripts/build-bundled.mjs): PAC lines by cycle, PAC money not yet processed, gifts by state, joint
// fundraising credited back to donors, and the Big Money Independence grade over more than one cycle.
import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../data/config.json' with {type:'json'};
import {sizeBand,pacLine,pacCycleSummary,efileRows,efileSummary,stateSummary,statePie,jfcPage,jfcCycleSummary,periodCycles,periodOptions,periodLabel,combinePeriod} from '../public/fec-money.js';
import {FEEDS} from '../src/feeds.mjs';
import {unbought} from '../public/six-scores.js';
import {givers,maybeConduits,recipientURL} from '../scripts/build-bundled.mjs';

const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
const CMTE='C00718866';

test('gift sizes by the amount itself, as the FEC groups them',()=>{
  assert.deepEqual([0,200,200.01,499.99,500,999.99,1000,1999.99,2000,3300].map(sizeBand),[0,0,1,1,2,2,3,3,4,4]);
});

test('PAC lines: each PAC once, with its type from the FEC\'s own record; memo entries left out',()=>{
  const r=(id,cid,name,amt,ct,dsg,org,memo)=>({sub_id:id,contributor_id:cid,contributor_name:name,contribution_receipt_amount:amt,contribution_receipt_date:'2024-03-01T00:00:00',memo_code:memo?'X':null,
    contributor:{committee_id:cid,name,committee_type:ct,designation:dsg,organization_type:org}});
  const rows=[r(1,'C00000001','ACME CORP PAC',5000,'Q','B','C'),r(2,'C00000001','ACME CORP PAC',2500,'Q','B','C'),r(3,'C00000002','STEELWORKERS PAC',1000,'Q','B','L'),
    r(4,'C00000003','A LEADERSHIP PAC',2000,'N','D',null),r(5,'C00000001','ACME CORP PAC',999,'Q','B','C',true)].map(pacLine);
  assert.equal(rows[0].cid,'C00000001');assert.deepEqual(rows[0].type,['ACME CORP PAC','Q','B','C']);
  const s=pacCycleSummary(rows);
  assert.equal(s.total,10500);assert.equal(s.n,4);assert.equal(s.committees[0].amount,7500);assert.equal(s.committees[0].n,2);
  assert.deepEqual(s.byKind,{corporate:7500,leadership:2000,labor:1000});
  // Without a type on the record, a PAC is listed but not typed.
  const bare=pacCycleSummary([pacLine({sub_id:9,contributor_id:'C00000009',contributor_name:'X PAC',contribution_receipt_amount:100})]);
  assert.equal(bare.committees[0].kind,null);assert.equal(bare.typed,0);
});

test('not yet processed: line 11C only, after the processed totals end; an amended report replaces the original',()=>{
  const e=(tx,file,amt,line='SA11C',date='2026-10-20',memo=null)=>({committee_id:CMTE,transaction_id:tx,file_number:file,line_number:line,contribution_receipt_amount:amt,contribution_receipt_date:date,contributor_name:'ACME CORP PAC',memo_code:memo});
  const rows=efileRows([e('A1',100,5000),e('A1',101,4000),e('B1',100,1000,'SA11AI'),e('C1',100,2500,'SA11C','2026-09-01'),e('D1',100,300,'SA11C','2026-10-21','X')],{since:'2026-10-15'});
  assert.deepEqual(rows.map(r=>[r.key,r.file]),[['t:A1',100],['t:A1',101]],'individuals, older dates and memo entries left out');
  const s=efileSummary(rows,{since:'2026-10-15',committee:CMTE});
  assert.equal(s.count,1);assert.equal(s.total,4000,'the amendment\'s amount');assert.equal(s.rows[0].file,101);
  assert.match(s.rows[0].url,/docquery\.fec\.gov\/cgi-bin\/forms\/C00718866\/101\/sa\/11C/);assert.match(s.source,/data_type=efiling/);
});

test('by state: in the home state, from other states, and with no state given',()=>{
  const s=stateSummary([{state:'GA',state_full:'Georgia',total:600,count:6},{state:'NY',state_full:'New York',total:300,count:3},{state:null,total:100,count:1}],'GA');
  assert.deepEqual([s.total,s.inState,s.outState,s.unknown],[1000,600,300,100]);
  assert.equal(s.states[0].share,60);
});

test('the pie of where gifts come from: home state, the five largest others, the rest together, and no state given',()=>{
  const rows=[['TX','Texas',900],['GA','Georgia',2000],['NY','New York',1200],['CA','California',1000],['FL','Florida',700],['IL','Illinois',500],['OH','Ohio',300],['VT','Vermont',100],[null,null,300]]
    .map(([state,state_full,total])=>({state,state_full,total,count:1}));
  const x=stateSummary(rows,'GA'),pie=statePie(x);
  assert.deepEqual(pie.map(p=>p.label),['Georgia','New York','California','Texas','Florida','Illinois','All other states','No state given']);
  assert.equal(pie[0].home,true,'the home state first, marked');
  assert.deepEqual(pie.map(p=>p.total),[2000,1200,1000,900,700,500,400,300]);
  assert.equal(pie.reduce((t,p)=>t+p.total,0),x.total,'every dollar in exactly one slice');
  assert.equal(pie[0].share,Math.round(2000/7000*1000)/10);
  // No more states than fit: no "All other states" slice; none without a state: no such slice.
  const few=statePie(stateSummary(rows.slice(0,3),'GA'));
  assert.deepEqual(few.map(p=>p.key),['GA','NY','TX']);
  // Home state with no gifts from it: the six largest others aren't pushed out by an empty home slice.
  const away=statePie(stateSummary(rows,'WY'));
  assert.equal(away.some(p=>p.home),false);assert.deepEqual(away.slice(0,5).map(p=>p.key),['GA','NY','CA','TX','FL']);
  assert.equal(away.reduce((t,p)=>t+p.total,0),7000);
  assert.deepEqual(statePie(stateSummary([],'GA')),[],'nothing given: no pie');
});

test('joint fundraising: shares credited back by size, the unlisted remainder counted as small gifts, no names kept',()=>{
  const line={sub_id:'1',transaction_id:'T1',contributor_id:'C00999999',contributor_name:'OSSOFF VICTORY FUND',contribution_receipt_amount:10000,contributor:{designation:'J'}};
  const m=(id,amt,ind=true)=>({sub_id:id,memo_code:'X',back_reference_transaction_id:'T1',entity_type:ind?'IND':'PAC',contributor_name:ind?'DOE, JANE':'SOME PAC',contribution_receipt_amount:amt});
  const other={sub_id:'9',transaction_id:'T9',contributor_id:'C00888888',contributor_name:'OSSOFF FOR SENATE 2020',contribution_receipt_amount:500,contributor:{designation:'P'}};
  const page=jfcPage([line,m('2',3000),m('3',600),m('4',1000,false),other]);
  assert.ok(!JSON.stringify(page).includes('DOE'),'donors\' names are never kept');
  const s=jfcCycleSummary(page);
  assert.equal(s.transferred,10000,'only the joint fundraiser\'s transfer');
  assert.deepEqual(s.bands,[5400,0,600,0,3000],'$3,000 and $600 by size; $5,400 not listed counts as small gifts');
  assert.equal(s.committees,1000);assert.equal(s.people,9000);assert.equal(s.shares,2);assert.equal(s.from[0].name,'OSSOFF VICTORY FUND');
  // Shares listed before the committee's costs can add up to more than it passed on: each is scaled to fit.
  const over=jfcCycleSummary(jfcPage([{...line,contribution_receipt_amount:3000},m('2',3000),m('3',1000,false)]));
  assert.deepEqual([over.bands[4],over.committees,over.unlisted,over.scaled],[2250,750,0,true]);
});

test('Big Money Independence: joint fundraising money credited to donors\' sizes instead of the joint fundraising rate',()=>{
  const p={id:'x',chamber:'S',camp:{receipts:100000,indiv:50000,itemized:30000,unitemized:20000,pac:0,transfers:50000,self:0,start:'2025-01-01',end:'2026-09-30'}};
  const a=unbought(p,{}),b=unbought(p,{jfc:{transferred:50000,people:50000,committees:0,bands:[50000,0,0,0,0]}});
  const donor=x=>x.parts.find(q=>q.key==='donor').points;
  assert.ok(donor(b)>donor(a),'small gifts through joint fundraising count as small gifts');
  assert.match(b.parts.find(q=>q.key==='donor').note,/joint fundraising credited/);
  assert.match(unbought(p,{earmarksComplete:true}).parts.find(q=>q.key==='earmarks').note,/every group/);
});

test('periods: this cycle, wider spans, single earlier cycles; the inputs added up over the cycles',()=>{
  assert.deepEqual(periodOptions(2026,[2024,2022]).map(o=>[o.value,o.label]),[['this','2025–2026 (this cycle)'],['since:2024','2023–2026'],['since:2022','2021–2026'],['cycle:2024','2023–2024 only'],['cycle:2022','2021–2022 only']]);
  assert.deepEqual(periodCycles('since:2022',2026,[2024,2022,2020]),[2026,2024,2022]);assert.deepEqual(periodCycles('cycle:2024',2026,[]),[2024]);assert.equal(periodLabel('since:2022',2026),'2021–2026');
  const band=t=>({brackets:[t,0,0,0,0].map(total=>({total})),notSorted:0});
  const cur={camp:{receipts:1000,indiv:600,itemized:400,unitemized:200,pac:400,transfers:0,self:0,start:'2025-01-01',end:'2026-06-30'},sizes:band(600),pacRows:[{kind:'corporate',amount:100}],earmarks:[{group:'aipac',amount:50}],jfc:null};
  const past={camp:{2024:{receipts:2000,indiv:1000,itemized:500,unitemized:500,pac:1000,transfers:0,self:0,start:'2023-01-01',end:'2024-12-31'}},sizes:{2024:band(1000)},
    pacs:{2024:{committees:[{kind:'labor',amount:10},{kind:null,cid:'C1',amount:10}]}},earmarks:{2024:[{group:'aipac',amount:25}]},jfc:{}};
  const c=combinePeriod([2026,2024],2026,cur,past,{typeOf:cid=>cid==='C1'?'corporate':null});
  assert.deepEqual([c.camp.receipts,c.camp.pac,c.camp.start,c.camp.end],[3000,1400,'2023-01-01','2026-06-30']);
  assert.equal(c.sizes.brackets[0].total,1600);
  // Each cycle's PAC shares applied to that cycle's PAC total: 2026's $400 all corporate; 2024's $1,000 half labor, half corporate (typed from the PAC table).
  const by={};for(const r of c.pacRows)by[r.kind]=(by[r.kind]||0)+r.amount;assert.deepEqual(by,{corporate:900,labor:500});
  assert.equal(c.earmarks.reduce((t,r)=>t+r.amount,0),75);assert.equal(c.jfc,null,'joint fundraising only when every cycle has it');
  assert.match(combinePeriod([2026,2022],2026,cur,past).why,/2021–2022 aren't read yet/);
});

test('refresh: not-yet-processed PAC money starts where the processed totals end',async()=>{
  const p=config.people.find(x=>x.fecCmte),a={committee:p.fecCmte,cycle:2026},calls=[];
  const env={FEC_API_KEY:'fk',fetch:async u=>{u=String(u);calls.push(u);
    if(/\/totals\//.test(u))return json({results:[{committee_id:a.committee,cycle:2026,coverage_end_date:'2026-09-30T00:00:00'}],pagination:{}});
    if(/schedule_a\/efile/.test(u))return json({results:[{committee_id:a.committee,transaction_id:'A',file_number:5,line_number:'SA11C',contribution_receipt_amount:2500,contribution_receipt_date:'2026-10-05',contributor_name:'ACME PAC'}],pagination:{pages:1,page:1}});
    throw new Error('unexpected '+u);}};
  const job={kind:'pac-efile',subject:p.id,args:JSON.stringify(a),cursor:null};
  const r1=await FEEDS['pac-efile'].page(job,a,env,config);
  assert.deepEqual(JSON.parse(r1.next),{since:'2026-10-01',page:1});
  const r2=await FEEDS['pac-efile'].page({...job,cursor:r1.next},a,env,config);
  assert.equal(r2.next,null);assert.match(calls[1],/min_date=2026-10-01/);
  const snap=FEEDS['pac-efile'].summarize([...r1.rows,...r2.rows],a);
  assert.deepEqual([snap.since,snap.count,snap.total],['2026-10-01',1,2500]);
  assert.ok(!JSON.stringify(snap).includes('fk'),'the key is never saved');
});

test('refresh: joint fundraising and gifts by state, cycle by cycle',async()=>{
  const p=config.people.find(x=>x.fecCmte&&x.state),a={committee:p.fecCmte,cycle:2026,state:p.state};
  const env={FEC_API_KEY:'fk',fetch:async u=>{u=String(u);
    if(/line_number=F3-12/.test(u))return json({results:[{committee_id:a.committee,sub_id:'1',transaction_id:'T1',contributor_name:'VICTORY FUND',contribution_receipt_amount:1000,contributor:{designation:'J'}},
      {committee_id:a.committee,sub_id:'2',memo_code:'X',back_reference_transaction_id:'T1',entity_type:'IND',contribution_receipt_amount:3000}],pagination:{last_indexes:null}});
    if(/by_state/.test(u))return json({results:[{committee_id:a.committee,cycle:Number(new URL(u).searchParams.get('cycle')),state:p.state,state_full:'Home',total:700,count:7},{committee_id:a.committee,cycle:Number(new URL(u).searchParams.get('cycle')),state:'ZZ',state_full:'Elsewhere',total:300,count:3}],pagination:{}});
    throw new Error('unexpected '+u);}};
  const job={kind:'joint-fundraising',subject:p.id,args:JSON.stringify(a),cursor:null};
  const r=await FEEDS['joint-fundraising'].page(job,a,env,config);
  assert.equal(JSON.parse(r.next).todo[0],2026);
  const j=FEEDS['joint-fundraising'].summarize(r.rows,a);
  assert.equal(j.cycles[2026].transferred,1000);assert.equal(j.cycles[2026].bands[4],1000,'a $3,000 share scaled to the $1,000 passed on');
  const st={...job,kind:'donor-states'},s1=await FEEDS['donor-states'].page(st,a,env,config),s2=await FEEDS['donor-states'].page({...st,cursor:s1.next},a,env,config);
  const s=FEEDS['donor-states'].summarize([...s1.rows,...s2.rows],a);
  assert.deepEqual([s.cycle,s.inState,s.outState],[2026,700,300]);assert.equal(s.cycles[2024].total,1000);
});

test('earmarks: every committee that may be forwarding gifts, found from the FEC\'s totals by recipient',()=>{
  const list=givers([{committee_id:'C00797670',committee_name:'AIPAC PAC',total:500000,count:900},{committee_id:'C00401224',committee_name:'ACTBLUE',total:9e6,count:9e4},
    {committee_id:'C00000001',committee_name:'ACME CORP PAC',total:10000,count:2},{committee_id:'C00000002',committee_name:'COUNCIL FOR A LIVABLE WORLD',total:80000,count:120},
    {committee_id:'C00000003',committee_name:'MEMO ONLY PAC',total:0,count:0,memo_total:5000,memo_count:12},{committee_id:'bad',total:1e6}]);
  assert.equal(list.length,5,'a malformed ID is left out');
  assert.deepEqual(maybeConduits(list,new Set(['C00797670'])).map(c=>c.committee),['C00000002','C00000003'],'the known groups, ActBlue and a PAC within the direct limit left out');
  assert.equal(new URL(recipientURL(CMTE,2024)).pathname,'/v1/schedules/schedule_b/by_recipient_id/');
});
