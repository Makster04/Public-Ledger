import test from 'node:test';
import assert from 'node:assert/strict';
import {searchesFor,searchForm,reportsIn,fileFor,savedPage,blockedBy,backAtTerms,looksRight,EFD} from '../scripts/efd-browser.mjs';
import {efdSavedReport} from '../src/feeds.mjs';

const senator={id:'ossoff',name:'Jon Ossoff',state:'GA',chamber:'S',inOffice:true};
const candidate={id:'smith',name:'Pat Smith',state:'GA',chamber:'S',nicknames:['Patty']};
const PTR='11111111-2222-3333-4444-555555555555',PAPER='99999999-2222-3333-4444-555555555555';

test('a senator\'s annual and trade reports; a candidate\'s reports of any type',()=>{
  assert.deepEqual(searchesFor(senator,2016).map(s=>[s.label,s.types,s.filer,s.last]),[['annual','[7]','[1]','Ossoff'],['trade','[11]','[1]','Ossoff']]);
  assert.deepEqual(searchesFor(candidate,2020).map(s=>[s.label,s.types,s.filer,s.first]),[['candidate','[]','[4]',['Pat','Patty']]]);
  const f=searchForm(searchesFor(senator,2016)[1],100,'tok');
  assert.deepEqual([f.start,f.length,f.report_types,f.filer_types,f.submitted_start_date,f.last_name,f.csrfmiddlewaretoken],['100','100','[11]','[1]','01/01/2016 00:00:00','Ossoff','tok']);
});

test('the search results that are theirs: same last name, first name when two share it; paper only for trade reports',()=>{
  const trade=searchesFor(senator,2016)[1],annual=searchesFor(senator,2016)[0];
  const rows=[['Jon','Ossoff','Senator',`<a href="/search/view/ptr/${PTR}/" target="_blank">Periodic Transaction Report for 03/01/2025</a>`,'03/20/2025'],
    ['Jon','Ossoff','Senator',`<a href="/search/view/paper/${PAPER}/">Periodic Transaction Report</a>`,'1/2/2019'],
    ['Jon','Ossoffy','Senator',`<a href="/search/view/ptr/${PTR}/">x</a>`,'01/01/2020'],
    ['Jon','Ossoff','Senator','<a href="/search/view/extension-notice/abc/">Extension</a>','01/01/2020']];
  const got=reportsIn(rows,trade);
  assert.deepEqual(got.map(r=>[r.kind,r.filed,r.skip]),[['ptr','2025-03-20',false],['paper','2019-01-02',false]]);
  assert.equal(got[0].url,`${EFD}/search/view/ptr/${PTR}/`);assert.equal(got[0].title,'Periodic Transaction Report for 03/01/2025');
  assert.equal(reportsIn(rows.slice(1,2),annual)[0].skip,true,'a paper annual report is counted, not saved');
  const two=[['Jon','Smith','Candidate',`<a href="/search/view/annual/${PTR}/">Candidate Report</a>`,'05/01/2024'],['Pat','Smith','Candidate',`<a href="/search/view/annual/${PAPER}/">Candidate Report</a>`,'05/01/2024']];
  assert.deepEqual(reportsIn(two,searchesFor(candidate,2020)[0]).map(r=>r.doc),[PAPER],'another filer with the same last name is left out');
});

test('a saved report carries its address (and a paper report its filing date), so the import knows it',()=>{
  assert.equal(fileFor('ossoff',{kind:'ptr',doc:PTR}),`efd-downloads/ossoff/ptr-${PTR}.html`);
  const url=`${EFD}/search/view/paper/${PAPER}/`,page=savedPage(url,'<img src="a.gif">','2019-01-02');
  const r=efdSavedReport(page);
  assert.deepEqual([r.kind,r.doc,r.url,r.filed],['paper',PAPER,url,'2019-01-02']);
  assert.ok(!/hidden/.test(savedPage(url,'<p>Filed 01/02/2019 @ 1:00 PM</p>','2019-01-02')),'a page with its own date gets none added');
});

test('a bot check, captcha or refusal stops it; the terms page again means agree again',()=>{
  assert.match(blockedBy(403),/HTTP 403/);assert.match(blockedBy(429),/HTTP 429/);
  assert.match(blockedBy(200,'<div class="g-recaptcha"></div>'),/bot check/);
  assert.match(blockedBy(200,'<h1>Request Rejected</h1>'),/bot check/);
  assert.equal(blockedBy(200,'<h1>Periodic Transaction Report</h1>'),null);assert.equal(blockedBy(502,''),null,'a server error is not a block');
  assert.ok(backAtTerms('<form><input id="agree_statement" type="checkbox" name="prohibition_agreement"></form>'));
  assert.ok(!backAtTerms('<h3>Transactions</h3><table></table>'));
  assert.ok(looksRight('ptr','<h3>Transactions</h3>'));assert.ok(looksRight('annual','<h3>Part 3. Assets</h3>'));assert.ok(!looksRight('ptr','<h1>Search</h1>'));
});
