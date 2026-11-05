// Senate eFD reports saved by hand (scripts/import-efd.mjs): each saved page is matched to a senator by its folder or the
// name on it, trade reports become the senator's official trades and the newest annual report their net worth, a second
// import of the same pages counts them once, and the eFD checks say how to import when the site refuses (HTTP 403).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDatabase} from '../scripts/sqlite.mjs';
import {importEfd,senatorFor,toSave,savedAnnuals} from '../scripts/import-efd.mjs';
import {efdSavedReport,FEEDS,EFD_REFUSED,WEEK} from '../src/feeds.mjs';
import {statement} from '../src/refresh.mjs';
import config from '../data/config.json' with {type:'json'};
const migration=fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');

const PTR_ID='1a2b3c4d-1111-2222-3333-444455556666';
const ptr=(who='The Honorable Jon Ossoff (Ossoff, Jon)',saved=true)=>`${saved?`<!-- saved from url=(0089)https://efdsearch.senate.gov/search/view/ptr/${PTR_ID}/ -->\n`:''}<html><body><div class="container">
<h1 class="mb-2">Periodic Transaction Report for 09/15/2026</h1><h2 class="filedReport">${who}</h2><p class="muted font-weight-bold">Filed 09/30/2026 @ 4:12 PM</p>
<table class="table"><thead><tr><th>#</th><th>Transaction Date</th><th>Owner</th><th>Ticker</th><th>Asset Name</th><th>Asset Type</th><th>Type</th><th>Amount</th><th>Comment</th></tr></thead>
<tbody><tr><td>1</td><td>09/02/2026</td><td>Spouse</td><td><a href="https://finance.yahoo.com/q?s=NVDA">NVDA</a></td><td>NVIDIA Corporation</td><td>Stock</td><td>Purchase</td><td>$1,001 - $15,000</td><td>--</td></tr>
<tr><td>2</td><td>09/05/2026</td><td>Self</td><td>--</td><td>Vanguard Total Bond Market</td><td>Other Securities</td><td>Sale (Full)</td><td>$15,001 - $50,000</td><td>--</td></tr></tbody></table></div></body></html>`;
const annual=year=>`<html><body><h1>Annual Report for CY ${year}</h1><h2 class="filedReport">The Honorable Jon Ossoff (Ossoff, Jon)</h2><p>Filed 05/15/${year+1} @ 9:00 AM</p>
<table><thead><tr><th>#</th><th>Asset</th><th>Asset Type</th><th>Owner</th><th>Value</th><th>Income Type</th><th>Income Amount</th></tr></thead>
<tbody><tr><td>1</td><td>Ossoff Qualified Blind Trust</td><td>Trust</td><td>Self</td><td>$1,000,001 - $5,000,000</td><td>None</td><td>None</td></tr>
<tr><td>2</td><td>Checking</td><td>Bank Deposit</td><td>Joint</td><td>$15,001 - $50,000</td><td>Interest</td><td>$1 - $200</td></tr></tbody></table>
<table><thead><tr><th>#</th><th>Incurred</th><th>Debtor</th><th>Type</th><th>Points</th><th>Term</th><th>Creditor</th><th>Amount</th></tr></thead>
<tbody><tr><td>1</td><td>2020</td><td>Joint</td><td>Mortgage</td><td>--</td><td>30 years</td><td>Example Bank</td><td>$250,001 - $500,000</td></tr></tbody></table></body></html>`;

test('a saved report page gives its kind, filer, filing date and eFD address',()=>{
  const r=efdSavedReport(ptr());
  assert.equal(r.kind,'ptr');assert.equal(r.doc,PTR_ID);assert.equal(r.url,`https://efdsearch.senate.gov/search/view/ptr/${PTR_ID}/`);
  assert.equal(r.filed,'2026-09-30');assert.deepEqual(r.name,{full:'Jon Ossoff',last:'Ossoff',first:'Jon'});
  assert.equal(r.trades.length,2);assert.equal(r.trades[0].ticker,'NVDA');assert.equal(r.trades[0].owner,'spouse');
  const a=efdSavedReport(annual(2025));
  assert.equal(a.kind,'annual');assert.equal(a.year,2025);assert.equal(a.filed,'2026-05-15');assert.equal(a.holdings.assets.length,2);assert.equal(a.holdings.debts.length,1);
  assert.equal(efdSavedReport('<html><body>Search results</body></html>').kind,null);
  assert.equal(efdSavedReport(ptr(undefined,false)).doc,null,'no address on the page: none made up');
});

test('a page is matched to a senator by its folder, or else by the name on it',()=>{
  const r=efdSavedReport(ptr()),people=config.people.filter(p=>p.inOffice&&p.chamber==='S');
  assert.equal(senatorFor('/x/ossoff/a.html',r,people).person.id,'ossoff');
  assert.equal(senatorFor('/x/misc/a.html',r,people).person.id,'ossoff');
  assert.match(senatorFor('/x/collins/a.html',r,people).warn,/names Jon Ossoff, not Susan M\. Collins/);
  const nobody=efdSavedReport(ptr('The Honorable Pat Nobody (Nobody, Pat)'));
  assert.equal(senatorFor('/x/misc/a.html',nobody,people).person,null);
});

function folder(files){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'efd-'));
  for(const [name,text] of Object.entries(files)){const f=path.join(dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text);}
  return dir;
}
const db=()=>{const d=openDatabase(':memory:');d.exec(migration);return d;};
const snap=async(d,id)=>{const r=await statement(d,'SELECT payload FROM snapshots WHERE job_id=?',id).first();return r?JSON.parse(r.payload):null;};

test('importing saves the trades and the newest annual report, and a second import counts them once',async()=>{
  const dir=folder({'ossoff/ptr-2026-09.html':ptr(),'ossoff/annual-2024.html':annual(2024),'ossoff/annual-2025.htm':annual(2025),
    'misc/unknown.html':ptr('The Honorable Pat Nobody (Nobody, Pat)'),'misc/search.html':'<html>Search</html>','ossoff/report.webarchive':'x','ossoff/scan.pdf':'%PDF'});
  const d=db(),now=new Date('2026-11-03T12:00:00Z');
  const r=await importEfd({dir,db:d,now});
  assert.equal(r.lines.filter(l=>l.startsWith('OK')).length,3);
  assert.ok(r.lines.some(l=>/unknown\.html: no single senator or Senate candidate matches Pat Nobody/.test(l)));
  assert.ok(r.lines.some(l=>/report\.webarchive: a Safari web archive/.test(l)));assert.ok(r.lines.some(l=>/scan\.pdf: not a saved web page/.test(l)));
  assert.ok(r.lines.some(l=>/search\.html: no trade table or annual report found/.test(l)));
  const t=await snap(d,'trades-senate:ossoff');
  assert.equal(t.count,2);assert.equal(t.reports,1);assert.equal(t.imported,now.toISOString());
  assert.ok(t.rows.every(x=>x.source==='Senate eFD'&&x.official.doc===PTR_ID&&x.disclosed==='2026-09-30'));
  const w=await snap(d,'net-worth-senate:ossoff');
  assert.equal(w.year,2025,'the newest annual report');assert.equal(w.nAssets,2);assert.equal(w.nDebts,1);assert.equal(w.unreadable,false);
  const job=await statement(d,"SELECT status,error,next_due FROM jobs WHERE id='trades-senate:ossoff'").first();
  assert.equal(job.status,'ready');assert.equal(job.error,null);assert.equal(job.next_due,now.getTime()+7*86400000);
  assert.deepEqual(w.history.map(h=>[h.year,h.nAssets,h.low]),[[2025,2,w.low],[2024,2,w.low]],'every year saved is kept, newest first');
  assert.match(r.summary.join('\n'),/Jon Ossoff: 2 annual reports imported \(2025, 2024\), 2 years on file/);
  await importEfd({dir,db:d,now});
  assert.equal((await snap(d,'trades-senate:ossoff')).count,2,'the same report imported again counts once');
  assert.equal((await snap(d,'net-worth-senate:ossoff')).history.length,2,'and the same years once');
  // A later import of a new year adds it; the years on file stay.
  await importEfd({dir:folder({'ossoff/annual-2026.html':annual(2026)}),db:d,now});
  assert.deepEqual((await snap(d,'net-worth-senate:ossoff')).history.map(h=>h.year),[2026,2025,2024]);
  // A page saved without its address is known by its contents, so it also counts once.
  const dir2=folder({'ossoff/a.html':ptr(undefined,false),'ossoff/b.html':ptr(undefined,false)}),d2=db();
  await importEfd({dir:dir2,db:d2,now});assert.equal((await snap(d2,'trades-senate:ossoff')).count,2);
  d.close();d2.close();
});

test('a dry run lists the files and writes nothing',async()=>{
  const dir=folder({'ossoff/ptr.html':ptr()});
  const r=await importEfd({dir,db:null,dryRun:true});
  assert.equal(r.lines.length,1);assert.match(r.summary[0],/Jon Ossoff: 1 trade report imported, 2 trades on file/);
});

test('when eFD refuses (HTTP 403), its checks wait a week and say how to import the reports by hand',async()=>{
  const env={fetch:async()=>new Response('Forbidden',{status:403})};
  for(const kind of ['trades-senate','net-worth-senate']){
    const job=FEEDS[kind].jobs(config).find(j=>j.subject==='ossoff');
    await assert.rejects(FEEDS[kind].page({kind,subject:'ossoff',cursor:null},job.args,env,config),e=>e.message===EFD_REFUSED&&e.retryAfter===WEEK&&e.statusCode===403);
  }
  assert.match(EFD_REFUSED,/npm run efd:import/);
});

// A Senate candidate's report on eFD: a Candidate Report, whose heading has no "The Honorable".
const candidate=(who='James Talarico (Talarico, James)')=>`<!-- saved from url=(0092)https://efdsearch.senate.gov/search/view/annual/9f8e7d6c-1111-2222-3333-444455556666/ -->
<html><body><h1>Candidate Report for 2026</h1><h2 class="filedReport">${who}</h2><p>Filed 05/15/2026 @ 9:00 AM</p>
<table><thead><tr><th>#</th><th>Asset</th><th>Asset Type</th><th>Owner</th><th>Value</th><th>Income Type</th><th>Income Amount</th></tr></thead>
<tbody><tr><td>1</td><td>Apple Inc. (AAPL)</td><td>Stock</td><td>Self</td><td>$15,001 - $50,000</td><td>Dividends</td><td>$201 - $1,000</td></tr>
<tr><td>2</td><td>Teacher Retirement System of Texas</td><td>Pension</td><td>Self</td><td>$50,001 - $100,000</td><td>None</td><td>None</td></tr></tbody></table></body></html>`;

test("a Senate candidate's report is imported too: matched by name or folder, with a check of its own",async()=>{
  const report=efdSavedReport(candidate());
  assert.deepEqual([report.kind,report.year,report.filed,report.name],['annual',2026,'2026-05-15',{full:'James Talarico',last:'Talarico',first:'James'}],'a Candidate Report reads like an annual one');
  assert.equal(senatorFor('efd-downloads/misc/x.html',report).person?.id,'talarico','a profiled Senate candidate, by the name on the page');
  assert.equal(senatorFor('efd-downloads/talarico/x.html',efdSavedReport(candidate('Candidate (no name)'))).person?.id,'talarico','or by the folder');
  const dir=folder({'talarico/candidate-2026.html':candidate()}),d=db(),now=new Date('2026-11-05T12:00:00Z');
  const r=await importEfd({dir,db:d,now});
  assert.ok(r.lines.some(l=>/^OK +talarico\/candidate-2026\.html: James Talarico, annual report for 2026, 2 assets, 0 debts/.test(l)),r.lines.join('\n'));
  const w=await snap(d,'net-worth-senate:talarico');assert.equal(w.nAssets,2);assert.equal(w.year,2026);
  const job=await statement(d,"SELECT kind,subject,args,status FROM jobs WHERE id='net-worth-senate:talarico'").first();
  assert.deepEqual([job.kind,job.subject,job.status],['net-worth-senate','talarico','ready']);
  assert.deepEqual(JSON.parse(job.args),{last:'Talarico',first:['James'],candidate:true},'searches for candidates when eFD lets it');
  assert.ok(!FEEDS['net-worth-senate'].jobs(config).some(j=>j.subject==='talarico'),'no check of its own until a report is imported');
  d.close();
});

test('the list of reports still to save: every senator and Senate candidate in a 2026 race, with a search and a folder',()=>{
  const all=toSave(),ids=all.map(x=>x.id);
  const D=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
  const inRaces=config.people.filter(p=>p.chamber==='S'&&p.race&&(p.inOffice||p.ids)).map(p=>p.id);
  assert.deepEqual(ids.slice().sort(),inRaces.slice().sort());assert.ok(ids.includes('ossoff')&&ids.includes('talarico'));
  assert.ok(!ids.includes('schumer'),'a senator not on the 2026 ballot is left off the list');
  assert.ok([...D.races,...D.liteRaces].length>0);
  const o=all.find(x=>x.id==='ossoff'),t=all.find(x=>x.id==='talarico');
  assert.deepEqual([o.folder,o.senator,t.senator],['efd-downloads/ossoff/',true,false]);
  assert.match(o.search,/Filer Type "Senator", Report Type "Annual"/);assert.match(t.search,/^Last Name "Talarico", Filer Type "Candidate"/);
  assert.ok(!toSave(new Set(['ossoff'])).some(x=>x.id==='ossoff'),'one already imported is done');
});

test('the list reads who is already saved from the local database itself',async()=>{
  const d=db();
  try{
    assert.deepEqual([...await savedAnnuals(d)],[],'an empty database: everyone is still to save');
    d.exec("INSERT INTO jobs(id,kind,subject,args) VALUES('net-worth-senate:ossoff','net-worth-senate','ossoff','{}'),('trades-senate:ossoff','trades-senate','ossoff','{}')");
    d.exec("INSERT INTO snapshots(job_id,run_id,payload,updated_at) VALUES('net-worth-senate:ossoff','r','{}','2026-11-05'),('trades-senate:ossoff','r','{}','2026-11-05')");
    const have=await savedAnnuals(d);
    assert.deepEqual([...have],['ossoff'],'only annual reports count, not trade reports');
    assert.ok(!toSave(have).some(x=>x.id==='ossoff'));
  }finally{d.close();}
});
