// The four dark money sources: FEC electioneering communications and communication costs, LDA.gov lobbyists' gifts
// (LD-203) and lobbying coalitions' members (LD-1 affiliated organizations). Sample replies follow the live ones' shape.
import {withRemovedConfig} from './fixtures/with-removed.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import configFile from '../data/config.json' with {type:'json'};
const config=withRemovedConfig(configFile);
import {FEEDS,ecRow,ccRow,spendSummary,honoreeIs,honoreeQuery,lobbyistGiftRows,lobbyistGiftSummary,coalitionRow,personName,LD203_PAGES} from '../src/feeds.mjs';
import {initialize,getBills,statement} from '../src/refresh.mjs';
import {openDatabase} from '../scripts/sqlite.mjs';

const json=o=>new Response(JSON.stringify(o),{headers:{'content-type':'application/json'}});
const collins=config.people.find(p=>p.id==='collins');
async function run(kind,subject,args,routes,env={}){
  const calls=[];
  const e={FEC_API_KEY:'fk',...env,fetch:async u=>{calls.push(String(u));for(const [re,body] of routes)if(re.test(String(u)))return typeof body==='function'?json(body(String(u))):json(body);return new Response('missing route',{status:500});}};
  const job={id:kind==='lobby-coalitions'?kind:`${kind}:${subject}`,kind,subject,args:JSON.stringify(args),cursor:null,started_at:new Date().toISOString()};const rows=[];
  for(let i=0;i<60;i++){const r=await FEEDS[kind].page(job,args,e,config);rows.push(...r.rows);if(!r.next)break;job.cursor=r.next;}
  return {rows,snapshot:FEEDS[kind].summarize(rows,args,job,config),calls};
}
const ec=(o={})=>({sub_id:'1',committee_id:'C30003628',committee_name:'ALLIANCE FOR A BETTER FUTURE INC',candidate_id:'S6ME00159',communication_date:'2026-09-15',
  disbursement_date:'2026-09-10',disbursement_amount:110501,calculated_candidate_share:110501,number_of_candidates:1,purpose_description:'MEDIA PLACEMENT',report_year:2026,
  amendment_indicator:'N',election_type:'G',pdf_url:'https://docquery.fec.gov/cgi-bin/fecimg/?1',...o});

test('electioneering communications: each candidate\'s, by group, an amendment counted once, page by page',async()=>{
  assert.ok(collins.fecCand);
  const page1={pagination:{count:3,pages:2,per_page:100},results:[ec(),ec({sub_id:'2',amendment_indicator:'A'}),ec({sub_id:'3',disbursement_amount:2000,calculated_candidate_share:1000,number_of_candidates:2,disbursement_date:'2026-08-01',communication_date:'2026-08-02'})]};
  const page2={pagination:{count:4,pages:2,per_page:100},results:[ec({sub_id:'4',committee_id:'C00999999',committee_name:'OLD GROUP',report_year:2010}),ec({sub_id:'5',candidate_id:'H0XX00000'})]};
  const r=await run('electioneering','collins',{cand:collins.fecCand},[[/page=1&/,page1],[/page=2&/,page2]]);
  assert.match(r.calls[0],/electioneering\/\?candidate_id=S6ME00159&per_page=100&page=1/);assert.match(r.calls[0],/api_key=fk/);
  assert.equal(r.calls.length,2,'reads every page');
  assert.deepEqual(r.rows.map(x=>x.id),['1','2','3'],'an item before historyFrom and another candidate\'s are left out');
  assert.equal(r.snapshot.count,2,'the amendment repeats the first item');
  assert.equal(r.snapshot.total,111501,'the candidate\'s share of an ad that named two');
  assert.deepEqual(r.snapshot.groups.map(g=>[g.group,g.amount,g.n,g.fewDonors,g.first,g.last]),[['ALLIANCE FOR A BETTER FUTURE INC',111501,2,true,'2026-08-02','2026-09-15']]);
  assert.equal(ecRow(ec({committee_name:'SMITH, JOHN'})).group,'A person (name not shown)','a person who files Form 9 isn\'t named');
  assert.equal(personName('SMITH, JOHN'),true);assert.equal(personName('ALLIANCE FOR A BETTER FUTURE INC'),false);
});

test('communication costs: for and against by corporation or union, a deleted entry left out',async()=>{
  const cc=(o={})=>({sub_id:'1',committee_id:'C70001722',committee_name:'A STATE LABOR FEDERATION, AFL-CIO',candidate_id:'S6ME00159',support_oppose_indicator:'S',transaction_amount:13860,
    transaction_date:'2026-10-23',communication_type:'DM',primary_general_indicator:'G',cycle:2026,action_code:'A',pdf_url:'https://docquery.fec.gov/pdf/1.pdf',...o});
  const r=await run('communication-costs','collins',{cand:collins.fecCand},[[/communication_costs/,{pagination:{count:3,page:1,pages:1},results:[cc(),cc({sub_id:'2',support_oppose_indicator:'O',transaction_amount:500,committee_id:'C70000002',committee_name:'A COMPANY',communication_type:'EM'}),cc({sub_id:'3',action_code:'D'})]}]]);
  assert.match(r.calls[0],/communication_costs\/\?candidate_id=S6ME00159/);
  assert.equal(r.snapshot.count,2);assert.equal(r.snapshot.for,13860);assert.equal(r.snapshot.against,500);
  assert.deepEqual(r.snapshot.rows.map(x=>x.how),['Direct mail','Email']);
  assert.equal(ccRow({sub_id:'9',committee_id:'C7',action_code:'D'}),null);
});

test('lobbyists\' gifts: only items honoring the person; lobbyists added up, organizations named; an amended report replaces the first',async()=>{
  assert.equal(honoreeQuery(collins),'Susan Collins');
  for(const t of ['Susan Collins','Sen. Susan Collins','Senator Susan M. Collins','Collins, Susan','The Honorable Susan Collins','Sue Collins'])assert.ok(honoreeIs(t,collins),t);
  for(const t of ['Susan Collinsworth','Mike Collins','Collins Victory Committee',''])assert.ok(!honoreeIs(t,collins),t);
  const filing=(o={})=>({filing_uuid:'a',filer_type:'lobbyist',filing_year:2025,filing_period:'mid_year',dt_posted:'2025-07-01T10:00:00-04:00',
    registrant:{id:1,name:'A LOBBYING FIRM, LLC'},lobbyist:{id:77,first_name:'PRIVATE',last_name:'PERSON'},filing_document_url:'https://lda.gov/filings/public/contribution/a/print/',
    contribution_items:[{contribution_type:'feca',honoree_name:'Susan Collins',payee_name:'COLLINS FOR SENATOR',amount:'500.00',date:'2025-06-14'},
      {contribution_type:'feca',honoree_name:'Steve Womack',payee_name:'WOMACK FOR CONGRESS',amount:'1000.00',date:'2025-04-01'}],...o});
  const rows=lobbyistGiftRows([filing(),filing({filing_uuid:'b',dt_posted:'2025-08-01T10:00:00-04:00',filing_period:'mid_year',contribution_items:[{contribution_type:'feca',honoree_name:'Sen. Susan Collins',payee_name:'COLLINS FOR SENATOR',amount:'750.00',date:'2025-06-14'}]}),
    filing({filing_uuid:'c',filer_type:'organization',lobbyist:null,registrant:{id:2,name:'A TRADE ASSOCIATION'},contribution_items:[{contribution_type:'he',honoree_name:'Collins, Susan',payee_name:'AN EVENT',amount:'2500.00',date:'2025-05-01'}]})],collins);
  assert.equal(rows.length,3,'Womack\'s gift is left out');
  assert.ok(rows.every(r=>!JSON.stringify(r).includes('PRIVATE')&&!JSON.stringify(r).includes('PERSON')),'a lobbyist\'s name is never kept');
  const s=lobbyistGiftSummary(rows);
  assert.equal(s.lobbyists.amount,750,'the amended report replaces the first');assert.equal(s.lobbyists.people,1);
  assert.deepEqual(s.organizations.map(o=>[o.name,o.amount]),[['A TRADE ASSOCIATION',2500]]);
  assert.equal(s.total,3250);assert.deepEqual(s.types,{feca:750,he:2500});
});

test('lobbyists\' gifts: the cycle\'s two years, page by page, marked when capped',async()=>{
  const p=collins.fecCmte?collins:config.people.find(x=>x.fecCmte);
  const results=[{filing_uuid:'x',filer_type:'lobbyist',filing_year:2026,filing_period:'mid_year',dt_posted:'2026-07-01',registrant:{id:1,name:'F'},lobbyist:{id:5},
    contribution_items:[{contribution_type:'feca',honoree_name:honoreeQuery(p),amount:'100',date:'2026-02-01'}]}];
  const r=await run('lobbyist-gifts',p.id,{name:honoreeQuery(p),cycle:2026},[[/filing_year=2026/,u=>({results,next:'more'})],[/filing_year=2025/,{results:[],next:null}]],{LDA_API_KEY:'lk'});
  assert.match(r.calls[0],/contributions\/\?contribution_honoree=/);
  assert.equal(r.calls.filter(u=>/filing_year=2026/.test(u)).length,LD203_PAGES,'stops at the page cap');
  assert.deepEqual(r.snapshot.capped,[2026]);assert.equal(r.snapshot.lobbyists.gifts,1,'the same report on every page counts once');
});

test('lobbying coalitions: each key-bill client\'s registration read once, with the members it lists',async()=>{
  const row=coalitionRow('64249',[{client:{id:64249,name:'AMERICA WINS: COALITION AGAINST GLOBAL DOUBLE TAXATION'},affiliated_organizations:[{name:'LIBERTY MUTUAL GROUP'},{name:'A SECOND MEMBER'},{name:'LIBERTY MUTUAL GROUP'}],filing_document_url:'https://lda.gov/filings/public/filing/1/print/'}]);
  assert.deepEqual(row.members,['LIBERTY MUTUAL GROUP','A SECOND MEMBER']);
  assert.deepEqual(coalitionRow('5',[]).members,[]);
  const db=openDatabase(':memory:');db.exec(await fs.readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  await initialize(db,null);
  await statement(db,"INSERT OR REPLACE INTO jobs(id,kind,subject,args,status) VALUES('bill-lobbying:119-hr-1','bill-lobbying','119-hr-1','{}','ready')").run();
  await statement(db,'INSERT OR REPLACE INTO snapshots(job_id,run_id,payload,updated_at) VALUES(?,?,?,?)','bill-lobbying:119-hr-1','r1',JSON.stringify({total:3,clients:[{id:'64249',name:'AMERICA WINS'},{id:'5',name:'A COMPANY'}]}),'2026-11-18T00:00:00Z').run();
  const r=await run('lobby-coalitions','Congress',{},[[/client_id=64249/,{results:[{client:{id:64249,name:'AMERICA WINS'},affiliated_organizations:[{name:'LIBERTY MUTUAL GROUP'}]}]}],[/client_id=5&/,{results:[{client:{id:5,name:'A COMPANY'},affiliated_organizations:[]}]}]],{DB:db});
  assert.equal(r.calls.length,2);assert.match(r.calls[0],/filing_type=RR/);
  assert.deepEqual(r.snapshot.clients,{64249:{client:'AMERICA WINS',members:['LIBERTY MUTUAL GROUP'],url:null}});
  await statement(db,"INSERT OR REPLACE INTO jobs(id,kind,subject,args,status) VALUES('lobby-coalitions','lobby-coalitions','Congress','{}','ready')").run();
  await statement(db,'INSERT OR REPLACE INTO snapshots(job_id,run_id,payload,updated_at) VALUES(?,?,?,?)','lobby-coalitions','r2',JSON.stringify(r.snapshot),'2026-11-18T00:00:00Z').run();
  const bills=await getBills({DB:db});
  assert.deepEqual(bills.coalitions.clients['64249'].members,['LIBERTY MUTUAL GROUP'],'the bill pages get the coalitions');
  assert.deepEqual(bills.lobbying['119-hr-1'].clients.map(c=>c.id),['64249','5']);
});

test('the key bills\' lobbying keeps each named report\'s client, for the coalitions',async()=>{
  const f=(id,client,cid)=>({filing_uuid:id,filing_year:2025,client:{id:cid,name:client},registrant:{name:'R'},lobbying_activities:[{description:'H.R. 1, the budget bill'}],filing_document_url:'https://lda.gov/x'});
  const job={kind:'bill-lobbying',cursor:null};const rows=[];
  const env={fetch:async()=>json({count:2,results:[f('1','AMERICA WINS',64249),f('2','A UNION',7)],next:null})};
  for(let i=0;i<10;i++){const r=await FEEDS['bill-lobbying'].page(job,{bill:'119-hr-1'},env,config);rows.push(...r.rows);if(!r.next)break;job.cursor=r.next;}
  const s=FEEDS['bill-lobbying'].summarize(rows,{bill:'119-hr-1'});
  assert.deepEqual(s.clients,[{id:'64249',name:'AMERICA WINS'},{id:'7',name:'A UNION'}]);
});
