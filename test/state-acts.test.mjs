// State legislature records as stances (Nov. 26, 2026): the export from the local database
// (scripts/export-state-records.mjs), the tags (scripts/state-acts.mjs) and how they count (public/question-scores.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {mergeBills,billNumber,stateBillKey,exportStateRecords} from '../scripts/export-state-records.mjs';
import {billQuestions,billActions,buildStateActs} from '../scripts/state-acts.mjs';
import {searchTests} from '../scripts/question-statements.mjs';
import {personStances,stateItems} from '../public/question-scores.js';

const root=new URL('../',import.meta.url);
const os1={id:'ocd-bill/1',state:'AZ',session:'56th-2nd-regular',identifier:'HB 2045',title:'Raise the state minimum wage to $18',role:'sponsor',date:'2024-03-02',url:'https://openstates.org/az/bills/56th-2nd-regular/HB2045/',
  votes:[{date:'2024-03-01',motion:'Third reading',option:'yes',result:'pass'}]};
const ls1={id:'ls-9',state:'AZ',session:'2024 Regular',year:'2024',identifier:'HB2045',title:'Minimum wage; increase',date:'2024-03-02',url:'https://legiscan.com/AZ/bill/HB2045/2024'};
const ls2={id:'ls-10',state:'AZ',session:'2023 Regular',year:'2023',identifier:'SB1001',title:'Border security; funding',date:'2023-02-10',url:'https://legiscan.com/AZ/bill/SB1001/2023'};

test('bills from both sources are merged once, Open States first, markers left out',()=>{
  assert.equal(billNumber('H.B. 2045'),'HB2045');
  const bills=mergeBills([{kind:'state-openstates',r:os1},{kind:'state-openstates',r:{id:'os-person',person:'x'}},{kind:'state-legiscan',r:ls1},{kind:'state-legiscan',r:ls2},{kind:'state-legiscan',r:{id:'ls-person',person:9}}]);
  assert.deepEqual(bills.map(b=>[b.key,b.source,b.role]),[['AZ-HB2045-2024','Open States','sponsor'],['AZ-SB1001-2023','LegiScan',null]]);
  assert.equal(stateBillKey({state:'az',identifier:'SB 1001',year:'2023'}),'AZ-SB1001-2023');
});

test('the export reads the published records of both feeds into one file a person',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'state-')),db=new DatabaseSync(path.join(dir,'r.sqlite'));
  db.exec(fs.readFileSync(new URL('migrations/0001_initial.sql',root),'utf8'));
  db.prepare("INSERT INTO jobs (id,kind,subject,args,published_run) VALUES (?,?,?,?,?)").run('state-openstates:shah','state-openstates','shah','{}','r1');
  db.prepare("INSERT INTO jobs (id,kind,subject,args,published_run) VALUES (?,?,?,?,?)").run('state-legiscan:shah','state-legiscan','shah','{}','r2');
  db.prepare("INSERT INTO records (run_id,id,payload) VALUES (?,?,?)").run('r1','a',JSON.stringify(os1));
  db.prepare("INSERT INTO records (run_id,id,payload) VALUES (?,?,?)").run('r2','b',JSON.stringify(ls1));
  db.prepare("INSERT INTO records (run_id,id,payload) VALUES (?,?,?)").run('r2','c',JSON.stringify(ls2));
  const out=path.join(dir,'out'),written=exportStateRecords({db,names:{shah:'Amish Shah'},out,today:'2026-11-26'});
  assert.deepEqual(written,[['shah',2]]);
  const f=JSON.parse(fs.readFileSync(path.join(out,'shah.json'),'utf8'));
  assert.equal(f.name,'Amish Shah');assert.deepEqual(f.counts,{bills:2,votes:1});
});

test('a bill title names a question by its search phrases; what they did gives their side',()=>{
  const tests=searchTests({minimum_wage:{any:['minimum wage']},border:{any:['border security'],not:['northern border']}});
  assert.deepEqual(billQuestions('Raise the state minimum wage to $18',tests),['minimum_wage']);
  assert.deepEqual(billQuestions('Northern border security study',tests),[]);
  const b={state:'AZ',identifier:'HB 2045',year:'2024',title:'Raise the state minimum wage',role:'sponsor',date:'2024-03-02',url:'u',
    votes:[{date:'2024-03-01',option:'yes'},{date:'2024-03-05',option:'no'},{date:'2024-03-06',option:'absent'}]};
  assert.deepEqual(billActions(b,0).map(x=>[x[0],x[1],x[2]]),[[0,'s','2024-03-02'],[0,'state','2024-03-01'],[1,'state','2024-03-05']]);
  assert.match(billActions(b,0)[0][5],/Sponsored it in the Arizona legislature/);
});

test('tags are checked against the questions and the exported bills',()=>{
  const records=id=>id==='shah'?{bills:mergeBills([{kind:'state-openstates',r:os1}])}:null;
  const questions=[{id:'minimum-wage'}];
  const ok=buildStateActs({shah:{'minimum-wage':[[0,'AZ-HB2045-2024']]}},{questions,records});
  assert.deepEqual(ok.problems,[]);
  assert.deepEqual(ok.out.shah['minimum-wage'].map(x=>[x[0],x[1]]),[[0,'s'],[0,'state']]);
  const bad=buildStateActs({shah:{nope:[[0,'AZ-HB2045-2024']],'minimum-wage':[[2,'AZ-HB2045-2024'],[0,'AZ-XX1-2020']]},nobody:{}},{questions,records});
  assert.equal(bad.problems.length,4);
});

test('state actions count like Congress\'s bills and votes, one credit per bill',()=>{
  const state={'minimum-wage':[[0,'s','2024-03-02','AZ HB 2045 (2024): Raise the state minimum wage','u','Sponsored it in the Arizona legislature.'],[0,'state','2024-03-01','AZ HB 2045 (2024): Raise the state minimum wage','u','Voted yes.']]};
  assert.equal(stateItems(state)['minimum-wage'].length,2);
  const p=personStances(null,null,{state});
  assert.equal(p['minimum-wage'].a,1.5,'the sponsorship (1.5) is the bill\'s one credit');
  assert.equal(p['minimum-wage'].carried.items[0].kind,'s');
  const two=personStances(null,null,{state:{'minimum-wage':[...state['minimum-wage'],[1,'state','2023-02-10','AZ SB 9 (2023): Freeze the wage','u2','Voted yes.']]}});
  assert.deepEqual([two['minimum-wage'].a,two['minimum-wage'].b],[1.5,1]);
});
