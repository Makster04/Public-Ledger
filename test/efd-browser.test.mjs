import test from 'node:test';
import assert from 'node:assert/strict';
import {searchesFor,searchForm,reportsIn,fileFor,savedPage,blockedBy,backAtTerms,looksRight,EFD,allSenators,remember,remembered,fromYear,sharedSearch,searchDone,newestAnnual,pageBudget,BatchFull} from '../scripts/efd-browser.mjs';
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
  assert.match(blockedBy(200,'Just a moment...\nVerify you are human by completing the action below.'),/bot check.*Verify you are human/);
  assert.match(blockedBy(200,'Request Rejected\nThe requested URL was rejected.'),/bot check.*Request Rejected/);
  assert.equal(blockedBy(200,'eFD: Search\nSearch Reports Filer Type Senator'),null,'the search page as a visitor sees it');
  assert.equal(blockedBy(200,'<h1>Periodic Transaction Report</h1>'),null);assert.equal(blockedBy(502,''),null,'a server error is not a block');
  assert.ok(backAtTerms('<form><input id="agree_statement" type="checkbox" name="prohibition_agreement"></form>'));
  assert.ok(!backAtTerms('<h3>Transactions</h3><table></table>'));
  assert.ok(looksRight('ptr','<h3>Transactions</h3>'));assert.ok(looksRight('annual','<h3>Part 3. Assets</h3>'));assert.ok(!looksRight('ptr','<h1>Search</h1>'));
});

test('annual reports only (--annual); all senators searched together, with no name',()=>{
  assert.deepEqual(searchesFor(senator,2020,{annual:true}).map(s=>s.label),['annual']);
  assert.deepEqual(searchesFor(candidate,2020,{annual:true}).map(s=>s.label),['candidate'],'a candidate\'s one search has their candidate report');
  const f=searchForm(allSenators('trade',2020),200,'tok');
  assert.deepEqual([f.start,f.report_types,f.filer_types,f.last_name,f.submitted_start_date],['200','[11]','[1]','','01/01/2020 00:00:00']);
  // Their reports out of all senators' results are the same as from a search of their own.
  const rows=[['Jon','Ossoff','Senator',`<a href="/search/view/annual/${PTR}/">Annual Report for CY 2024</a>`,'05/15/2025'],['Susan M','Collins','Senator',`<a href="/search/view/annual/${PAPER}/">Annual Report for CY 2024</a>`,'05/15/2025']];
  assert.deepEqual(reportsIn(rows,searchesFor(senator,2020)[0]).map(r=>r.doc),[PTR]);
});

test('searches are remembered for a week, for the year asked or a later one',()=>{
  const s=searchesFor(senator,2020)[0],now=new Date('2026-11-11T12:00:00Z');
  const reports=[{kind:'annual',doc:PTR,url:`${EFD}/search/view/annual/${PTR}/`,title:'Annual Report for CY 2018',filed:'2019-05-15',skip:false},
    {kind:'annual',doc:PAPER,url:`${EFD}/search/view/annual/${PAPER}/`,title:'Annual Report for CY 2024',filed:'2025-05-15',skip:false}];
  const memory=remember({},{...s,since:2016},reports,now);
  assert.equal(memory.annual.reports[0].url,undefined,'the address is made again from the site asked of');
  assert.deepEqual(remembered(memory,s,{now,base:'http://mock'}).map(r=>[r.doc,r.url]),[[PAPER,`http://mock/search/view/annual/${PAPER}/`]],'searched since 2016, asked since 2020');
  assert.equal(remembered(memory,{...s,since:2010},{now}),null,'a search from a later year than asked isn\'t enough');
  assert.equal(remembered(memory,s,{now:new Date('2026-11-19T12:00:00Z')}),null,'a week later, searched again');
  assert.equal(remembered(memory,searchesFor(senator,2020)[1],{now}),null,'the trade search wasn\'t made');
  assert.deepEqual(fromYear(reports,2020).map(r=>r.doc),[PAPER]);
  // All senators' search, page by page: kept within the week, so a batch that ended partway through goes on.
  const st={at:'2026-11-10T12:00:00Z',since:2020,rows:[['a']],next:100,total:850};
  assert.equal(sharedSearch(st,2020,now),st);assert.ok(!searchDone(st));
  assert.deepEqual(sharedSearch(st,2020,new Date('2026-11-18T12:00:00Z')).rows,[],'past its week');
  assert.deepEqual(sharedSearch(st,2016,now).next,0,'asked for earlier years');
  assert.ok(searchDone({total:850,next:900}));assert.ok(searchDone({total:0,next:100}),'no results');
});

test('everyone\'s newest annual report first: the latest year (an amendment over the original), not a trade report',()=>{
  const r=(kind,title,filed,skip=false)=>({kind,doc:title+filed,title,filed,skip});
  const list=[r('annual','Annual Report for CY 2023','2024-05-15'),r('annual','Annual Report for CY 2024','2025-05-14'),r('annual','Annual Report for CY 2024 (Amendment 1)','2025-08-01'),
    r('annual','Annual Report for CY 2022 (Amendment)','2025-09-01'),r('ptr','Periodic Transaction Report for 01/02/2026','2026-01-20'),r('annual','Annual Report for CY 2025','2026-05-15',true)];
  assert.equal(newestAnnual(list).title,'Annual Report for CY 2024 (Amendment 1)','the scanned 2025 report isn\'t saved');
  assert.equal(newestAnnual([r('annual','Candidate Report','2026-06-01'),r('annual','Candidate Report','2024-06-01')]).filed,'2026-06-01','a candidate report goes by its filing date');
  assert.equal(newestAnnual([r('ptr','Periodic Transaction Report','2026-01-20')]),null);
});

test('a batch counts every page asked of eFD, and its first page always goes',()=>{
  const b=pageBudget(5);b.spend();b.spend(2);b.spend(2);assert.equal(b.asked,5);
  assert.throws(()=>b.spend(),BatchFull);assert.equal(b.asked,5,'the page that didn\'t fit wasn\'t asked for');
  b.reset();b.spend(8);assert.equal(b.asked,8,'a batch\'s first step goes even when bigger');
  const all=pageBudget(Infinity);for(let i=0;i<1000;i++)all.spend();assert.equal(all.asked,1000);
});
