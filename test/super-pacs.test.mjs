// The Super PACs page (public/super-pacs.js and the site-wide "super-pacs" refresh check): every super PAC's spending
// for and against each candidate from the FEC's totals, the committee types that make a super PAC, and their largest gifts.
import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../data/config.json' with {type:'json'};
import {SUPER_PAC_TYPES,ieRow,typeRow,donorRow,superPacSummary} from '../public/super-pacs.js';
import {FEEDS} from '../src/feeds.mjs';

const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
const ie=(cmte,cand,so,total,name='X')=>({committee_id:cmte,committee_name:name,candidate_id:cand,candidate_name:`Cand ${cand}`,support_oppose_indicator:so,total,count:3,cycle:2026});

test('rows: the FEC\'s totals by committee and candidate; a malformed row is left out',()=>{
  assert.deepEqual(ieRow(ie('C00000001','S6OH00001','S',1000)),{id:'ie:C00000001:S6OH00001:S',cmte:'C00000001',cmteName:'X',cand:'S6OH00001',candName:'Cand S6OH00001',so:'S',total:1000,count:3});
  assert.equal(ieRow(ie('bad','S6OH00001','S',1)),null);assert.equal(ieRow(ie('C00000001','S6OH00001','?',1)),null);
  assert.deepEqual(typeRow({committee_id:'C00000001',name:'A PAC',committee_type:'o',designation:'U'}),{id:'cm:C00000001',cmte:'C00000001',name:'A PAC',type:'O',designation:'U'});
  assert.ok(SUPER_PAC_TYPES.has('O')&&SUPER_PAC_TYPES.has('V')&&!SUPER_PAC_TYPES.has('X'));
});

test('donors: groups by name, people added up without names, memo entries left out',()=>{
  const d=donorRow('C00000001',[{entity_type:'ORG',contributor_name:'ACME INC',contribution_receipt_amount:5e6},{entity_type:'ORG',contributor_name:'ACME INC',contribution_receipt_amount:1e6},
    {entity_type:'IND',contributor_name:'DOE, JANE',contribution_receipt_amount:2e6},{entity_type:'PAC',contributor_name:'UNION PAC',contribution_receipt_amount:3e5},{entity_type:'ORG',contributor_name:'MEMO CO',contribution_receipt_amount:9e9,memo_code:'X'}]);
  assert.deepEqual(d.orgs.map(o=>[o.name,o.amount,o.n]),[['ACME INC',6e6,2],['UNION PAC',3e5,1]]);
  assert.deepEqual(d.indiv,{total:2e6,n:1});assert.ok(!JSON.stringify(d).includes('DOE'),'no person\'s name');
});

test('the page\'s data: super PACs only, each with what it spent for and against each candidate',()=>{
  const rows=[ieRow(ie('C00000001','S6OH00001','S',1000)),ieRow(ie('C00000001','S6OH00002','O',500)),ieRow(ie('C00000002','H6GA05001','S',300)),ieRow(ie('C00000003','S6OH00001','O',9000)),
    typeRow({committee_id:'C00000001',name:'Big Super PAC',committee_type:'O'}),typeRow({committee_id:'C00000002',name:'Hybrid',committee_type:'V'}),typeRow({committee_id:'C00000003',name:'A Party',committee_type:'Y'}),
    donorRow('C00000001',[{entity_type:'ORG',contributor_name:'ACME',contribution_receipt_amount:100}])];
  const s=superPacSummary(rows,{cycle:2026});
  assert.deepEqual(s.superPacs.map(o=>[o.name,o.type,o.total,o.for,o.against]),[['Big Super PAC','O',1500,1000,500],['Hybrid','V',300,300,0]]);
  assert.deepEqual([s.count,s.total,s.for,s.against],[2,1800,1300,500]);
  assert.deepEqual(s.others,{count:1,total:9000,top:[{id:'C00000003',name:'A Party',type:'Y',total:9000}]},'a party committee is kept apart');
  assert.equal(s.superPacs[0].donors.orgs[0].name,'ACME');assert.equal(s.superPacs[1].donors,null);
});

test('refresh: totals page by page, then committee types, then the biggest super PACs\' largest gifts',async()=>{
  const a={cycle:2026},calls=[];
  const env={FEC_API_KEY:'fk',fetch:async u=>{u=String(u);calls.push(u);
    if(/schedule_e\/by_candidate/.test(u)){const page=Number(new URL(u).searchParams.get('page'));
      return json({results:page===1?[ie('C00000001','S6OH00001','S',1000),ie('C00000003','S6OH00001','O',9000)]:[ie('C00000001','S6OH00002','O',500)],pagination:{page,pages:2}});}
    if(/\/committees\//.test(u))return json({results:[{committee_id:'C00000001',name:'Big Super PAC',committee_type:'O'},{committee_id:'C00000003',name:'A Party',committee_type:'Y'}],pagination:{}});
    if(/schedule_a/.test(u))return json({results:[{committee_id:'C00000001',entity_type:'ORG',contributor_name:'ACME',contribution_receipt_amount:100}],pagination:{}});
    throw new Error('unexpected '+u);}};
  const jobs=FEEDS['super-pacs'].jobs({...config,cycle:2026});assert.deepEqual(jobs.map(j=>j.id),['super-pacs']);
  let job={kind:'super-pacs',subject:'Super PACs',args:JSON.stringify(a),cursor:null},rows=[];
  for(let k=0;k<10;k++){const r=await FEEDS['super-pacs'].page(job,a,env,config);rows.push(...r.rows);if(!r.next)break;job={...job,cursor:r.next};}
  assert.equal(calls.filter(u=>/by_candidate/.test(u)).length,2);
  const types=new URL(calls.find(u=>/\/committees\//.test(u)));assert.deepEqual(types.searchParams.getAll('committee_id').sort(),['C00000001','C00000003']);
  assert.equal(calls.filter(u=>/schedule_a/.test(u)).length,1,'only super PACs\' gifts are read');
  const snap=FEEDS['super-pacs'].summarize(rows,a);
  assert.equal(snap.superPacs[0].total,1500);assert.equal(snap.superPacs[0].donors.orgs[0].name,'ACME');
  assert.ok(!JSON.stringify(snap).includes('fk'),'no key saved');
});
