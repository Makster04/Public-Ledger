import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLegislation,filterLegislation,legislationCoverage} from '../public/legislation.js';

test('legislative records join reviewed and refreshed versions of the same bill without counting twice',()=>{
  const person={id:'example',bills:[{congress:119,num:'S. 123',title:'Reviewed title',date:'2025-01-01',url:'https://www.congress.gov/bill/119th-congress/senate-bill/123'}]};
  const rows=collectLegislation(person,{}, {legislation:{congress:119,count:1,rows:[{id:'119-S-123',measure:'S.123',title:'Official title',date:'2025-01-01',latestAction:'Referred to committee',source:'https://www.congress.gov/bill/119th-congress/senate-bill/123'}]}});
  assert.equal(rows.sponsored.length,1);assert.equal(rows.sponsored[0].reviewed,true);assert.equal(rows.sponsored[0].refreshed,true);assert.equal(rows.sponsored[0].title,'Official title');
  assert.equal(rows.sponsored[0].status,'Status not recorded');
});

test('cosponsors keep their actual Congress, dates, and role; versions are not silently collapsed',()=>{
  const data={billIndex:[{id:'119-s-2',title:'A reform bill',status:'not',cosponsors:[{person:'example',bill:'118-s-1',date:'2023-02-10'},{person:'example',bill:'119-s-2',date:'2025-02-10'},{person:'other',bill:'119-s-2',sponsor:true}]}]};
  const rows=collectLegislation({id:'example',bills:[]},data);
  assert.equal(rows.sponsored.length,0);assert.equal(rows.cosponsored.length,2);
  assert.equal(rows.cosponsored[0].congress,119);assert.equal(rows.cosponsored[1].congress,118);
  assert.equal(rows.cosponsored[1].status,'Status not recorded');assert.equal(rows.cosponsored[1].actedOn,'2023-02-10');
  assert.equal(filterLegislation(rows.cosponsored,{congress:'118',query:'reform'}).length,1);
  assert.equal(filterLegislation(rows.cosponsored,{query:'absent query'}).length,0);
});

test('unsafe source links are not propagated and absent snapshots do not fabricate bill rows',()=>{
  assert.deepEqual(collectLegislation({id:'example'},{}),{sponsored:[],cosponsored:[]});
  const row=collectLegislation({id:'example',bills:[{title:'Record',url:'javascript:alert(1)'}]},{}).sponsored[0];
  assert.equal(row.source,'');assert.equal(row.status,'Status not recorded');
});

test('source reporting coverage and Congress totals remain separate from loaded cards',()=>{
  const text=legislationCoverage({since:2016,count:220,byCongress:{118:120,119:100},rows:[{},{}]});
  assert.match(text,/Coverage since 2016/);
  assert.match(text,/119th Congress: 100/);
  assert.match(text,/118th Congress: 120/);
  assert.match(text,/2 records supplied/);
  assert.equal(legislationCoverage(null),'');
});
