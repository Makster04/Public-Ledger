// The crypto and AI industry card (public/industries.js and the "industry-gifts" refresh read): the approved lists,
// how gifts are matched to companies and executives, and the super PAC spending on file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import config from '../data/config.json' with {type:'json'};
import {SUPER_PACS,COMPANIES,EXECUTIVES,normEmployer,companyByEmployer,executiveFor,industryQueries,industryRow,industryGifts,industrySuperPacs} from '../public/industries.js';
import {FEEDS} from '../src/feeds.mjs';

const research=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
const gift=(o)=>({sub_id:'1',committee_id:'C00000001',contribution_receipt_amount:500,contribution_receipt_date:'2025-06-01T00:00:00',...o});

test('the approved lists: every executive works at a listed company, every key is unique, each industry known',()=>{
  const keys=new Set(COMPANIES.map(c=>c.key));
  assert.equal(keys.size,COMPANIES.length);assert.equal(new Set(EXECUTIVES.map(e=>e.key)).size,EXECUTIVES.length);
  for(const e of EXECUTIVES)assert.ok(keys.has(e.company),e.name);
  for(const x of [...COMPANIES,...SUPER_PACS])assert.ok(['crypto','ai','both'].includes(x.industry),x.name);
  assert.ok(COMPANIES.some(c=>c.key==='nvidia')&&COMPANIES.some(c=>c.key==='palantir'),'Nvidia and Palantir count as AI');
  assert.ok(!COMPANIES.some(c=>/google|microsoft|meta|amazon|apple/i.test(c.name)),'Big Tech is left out');
  // The FEC takes at most ten names a request.
  for(const q of industryQueries())assert.ok(q.values.length<=10);
});

test('employers: the company\'s spellings count after normalizing, and a look-alike does not',()=>{
  assert.equal(normEmployer('OpenAI OpCo, LLC'),'OPENAI OPCO');
  assert.deepEqual(['Coinbase, Inc.','COINBASE GLOBAL INC','Open AI','NVIDIA Corporation','AH Capital Management, L.L.C.','Palantir Technologies Inc.'].map(companyByEmployer),['coinbase','coinbase','openai','nvidia','a16z','palantir']);
  assert.deepEqual(['Gemini Health','Circle K','Ripple Effect Consulting','Self-employed',''].map(companyByEmployer),[null,null,null,null,null]);
});

test('executives: the same last name, a matching first name and an employer on their list',()=>{
  assert.equal(executiveFor(gift({contributor_last_name:'ARMSTRONG',contributor_first_name:'BRIAN',contributor_employer:'COINBASE'}))?.key,'armstrong');
  assert.equal(executiveFor(gift({contributor_last_name:'ARMSTRONG',contributor_first_name:'BRIAN',contributor_employer:'ACME PLUMBING'})),null,'another Brian Armstrong');
  assert.equal(executiveFor(gift({contributor_name:'MUSK, ELON',contributor_employer:'SPACEX'}))?.key,'musk','his other employers count');
  assert.equal(executiveFor(gift({contributor_name:'MUSK, KIMBAL',contributor_employer:'TESLA'})),null);
  assert.equal(executiveFor(gift({contributor_last_name:'LUBIN',contributor_first_name:'JOSEPH',contributor_employer:'CONSENSYS SOFTWARE INC'}))?.key,'lubin');
  assert.equal(executiveFor(gift({contributor_last_name:'AMODEI',contributor_first_name:'DANIELA',contributor_employer:'ANTHROPIC PBC'}))?.key,'daamodei');
});

test('kept rows hold only the company, the executive, the amount and the date; memo entries and strangers are dropped',()=>{
  const r=industryRow(gift({contributor_name:'DOE, JANE',contributor_first_name:'JANE',contributor_last_name:'DOE',contributor_employer:'Anthropic',contributor_city:'SF'}));
  assert.deepEqual(r,{id:'1',co:'anthropic',ex:null,amount:500,date:'2025-06-01'});
  assert.ok(!JSON.stringify(r).includes('DOE'),'no donor name is kept');
  assert.equal(industryRow(gift({contributor_employer:'ACME'})),null);
  assert.equal(industryRow(gift({contributor_employer:'COINBASE',memo_code:'X'})),null);
  // Musk listing SpaceX still counts for xAI, as an executive.
  assert.deepEqual(industryRow(gift({sub_id:'2',contributor_name:'MUSK, ELON',contributor_employer:'SPACEX'})),{id:'2',co:'xai',ex:'musk',amount:500,date:'2025-06-01'});
});

test('a cycle\'s gifts: by industry and company, executives inside their company, each gift once',()=>{
  const g=industryGifts([{id:'1',co:'coinbase',ex:'armstrong',amount:3500,date:'2025-01-01'},{id:'1',co:'coinbase',ex:'armstrong',amount:3500,date:'2025-01-01'},
    {id:'2',co:'coinbase',ex:null,amount:250,date:'2025-02-01'},{id:'3',co:'a16z',ex:null,amount:1000,date:'2025-03-01'},{id:'4',co:'nvidia',ex:null,amount:300,date:'2025-04-01'}]);
  assert.equal(g.total,5050);assert.equal(g.n,4);
  const c=g.industries.crypto.companies[0];assert.deepEqual([c.key,c.total,c.n,c.exec,c.execN],['coinbase',3750,2,3500,1]);
  assert.equal(g.industries.crypto.executives[0].name,'Brian Armstrong');
  assert.equal(g.industries.both.total,1000,'a16z counted once, under both');assert.equal(g.industries.ai.total,300);
});

test('super PAC spending on file: the listed super PACs by FEC ID or exact name, never a look-alike',()=>{
  const cm=[['C00836221','Defend American Jobs','super_pac'],['C00999999','Think Big America','super_pac'],['C00888888','THINK BIG','super_pac']];
  const sp=industrySuperPacs({cms:[[0,1000,0],[1,500,0],[2,0,250]]},cm);
  assert.deepEqual(sp.rows.map(r=>[r.name,r.industry,r.for,r.against]),[['Defend American Jobs','crypto',1000,0],['Think Big','ai',0,250]]);
  assert.deepEqual(sp.byIndustry,{crypto:{for:1000,against:0},ai:{for:0,against:250}});
  // On the data on file: Defend American Jobs in Ohio.
  const husted=research.members.find(p=>p.id==='husted')||research.cands.find(p=>p.id==='husted');
  assert.ok(industrySuperPacs(husted.out,research.ie.cm).byIndustry.crypto.for>1e7);
});

test('refresh: employers then executives\' names, ten at a time, keeping only the matches',async()=>{
  const p=config.people.find(x=>x.fecCmte),a={committee:p.fecCmte,cycle:2026},calls=[];
  const env={FEC_API_KEY:'fk',fetch:async u=>{u=String(u);calls.push(u);
    return json({results:[gift({committee_id:a.committee,sub_id:String(calls.length),contributor_name:'ROE, RICHARD',contributor_employer:calls.length===1?'Coinbase Inc':'ACME'})],pagination:{last_indexes:null}});}};
  const job={kind:'industry-gifts',subject:p.id,args:JSON.stringify(a),cursor:null};
  let r=await FEEDS['industry-gifts'].page(job,a,env,config),rows=[...r.rows];
  const u0=new URL(calls[0]);assert.equal(u0.searchParams.getAll('contributor_employer').length,10);assert.equal(u0.searchParams.get('two_year_transaction_period'),'2026');
  while(r.next&&JSON.parse(r.next).at!==undefined&&JSON.parse(r.next).i===0){r=await FEEDS['industry-gifts'].page({...job,cursor:r.next},a,env,config);rows.push(...r.rows);}
  assert.equal(calls.length,industryQueries().length,'one request per group of names for the cycle');
  assert.ok(calls.slice(-1)[0].includes('contributor_name='));
  const snap=FEEDS['industry-gifts'].summarize(rows,a);
  assert.equal(snap.total,500);assert.equal(snap.industries.crypto.companies[0].key,'coinbase');
  assert.ok(!JSON.stringify(snap).includes('ROE')&&!JSON.stringify(snap).includes('fk'),'no donor name and no key saved');
});
