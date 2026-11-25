// scripts/export-disclosures.mjs: each full profile's newest two reports whose parts were read, and why someone has none.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readReports,whyMissing} from '../scripts/export-disclosures.mjs';
import {SCHEDULES_READER} from '../src/schedules.mjs';

const parts=(v,read=true)=>({income:[{source:'Acme',type:'Salary',amounts:[1000,null],text:'Acme Salary $1,000.00'}],positions:[],agreements:[],gifts:[],travel:[],read,v});
const payload=(...years)=>{const [top,...rest]=years;return {...top,history:rest};};

test('the newest two reports read, one a year, without empty fields',()=>{
  const p=payload({id:'3',year:2025,filed:'2026-05-01',type:'O',schedules:parts(2)},{id:'2',year:2024,filed:'2025-05-01',type:'O',schedules:parts(2)},
    {id:'1',year:2023,filed:'2024-05-01',type:'O',schedules:parts(2)},{id:'0',year:2022,filed:'2023-05-01',type:'O',schedules:parts(2,false)});
  const r=readReports([p]);
  assert.deepEqual(r.map(x=>x.year),[2025,2024]);assert.deepEqual(r[0].income[0].amounts,[1000,null]);
});

test('why a person has no report read: none saved, waiting for the House re-read, or no text',()=>{
  assert.equal(whyMissing([],'net-worth-house'),'no annual report saved yet');
  const old=payload({id:'9',year:2025,filed:'2026-05-01',assets:[],schedules:{income:[],positions:[],agreements:[],gifts:[],travel:[],read:false}});
  assert.equal(whyMissing([old],'net-worth-house'),'waiting to be read again');
  const paper=payload({id:'9',year:2025,filed:'2026-05-01',assets:[],schedules:{...parts(SCHEDULES_READER,false)}});
  assert.equal(whyMissing([paper],'net-worth-house'),'report has no text (filed on paper?)');
  assert.equal(whyMissing([old],'net-worth-senate'),'report has no text (filed on paper?)','the Senate reader has no versions');
});

test('a report the reader failed on is named, with the reason',()=>{
  const bad=payload({id:'9',year:2025,filed:'2026-05-01',assets:[],schedules:{...parts(SCHEDULES_READER,false),income:[],readError:'Maximum call stack size exceeded'}});
  assert.equal(whyMissing([bad],'net-worth-house'),'the reader failed on its 2025 report: Maximum call stack size exceeded');
});
