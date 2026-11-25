// The fixes from the Nov. 19, 2026 audit: Big Money Independence's PAC part waits when the reviewed PAC lines cover
// too little of the PAC money, and a partial search for routed gifts is a floor; People First is provisional on the
// page; the banner's link and label; a not-found page; the retired Integrity section; the empty conflicts file; the
// removal script reaches every part of the tracker history; and People First stays out of the news.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {unbought,UNBOUGHT} from '../public/six-scores.js';
import {gradeNews} from '../scripts/build-news.mjs';
import {FILES} from '../scripts/remove-people.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('public/app.js'),live=read('public/live.js');

const camp={receipts:1000000,indiv:800000,itemized:400000,unitemized:400000,pac:245500,transfers:0,self:0,start:'2026-02-26',end:'2026-10-14'};
const person={id:'c',chamber:'H',camp};
const disclosure={snapshot:{assets:[],year:2025},inCongress:false};

test('Big Money Independence: PAC lines from only some reports, covering under 80% of the PAC money, leave the PAC part waiting',()=>{
  assert.equal(UNBOUGHT.pacCoverage,0.8);
  const sample=[{kind:'leadership',amount:15000}];
  const x=unbought(person,{...disclosure,pacRows:sample,pacSampled:{read:15000,window:'Feb 2026 – Jun 2026'}});
  assert.equal(x.pct,null);assert.match(x.why,/Their PAC lines read so far \(Feb 2026 – Jun 2026\) cover 6% of their PAC money; the PAC part waits until 80% is read/);
  const bonus=x.bonusItems.find(b=>b.label==='No corporate PAC money');
  assert.deepEqual([bonus.status,bonus.points],['waiting',0],'no bonus from a 6% sample');
  assert.equal(x.parts.find(p=>p.key==='pac').points,null);
  // The same lines with no sample flag (a whole-cycle total by type): graded as before.
  assert.ok(unbought(person,{...disclosure,pacRows:sample}).pct!=null);
  // On the page: a reviewed profile's lines under 80% give way to the bulk files' whole-cycle mix when it has one.
  assert.match(app,/if\(bs>=UNBOUGHT\.pacCoverage\*total&&bs<=1\.2\*total\)pacRows=bulk;else pacSampled=\{read,window:s\.pac\?\.window\|\|null\};/,'the bulk mix only when it is this campaign\'s money');
});

test('routed gifts from a partial search are a floor: "at least", and "so far" on the breakdown',()=>{
  const rows=[{kind:'corporate',amount:245500}];
  const part=(complete,earmarks)=>unbought(person,{...disclosure,pacRows:rows,earmarks,earmarksComplete:complete}).parts.find(p=>p.key==='earmarks');
  const p=part(false,[]);assert.equal(p.floor,true);assert.match(p.note,/^At least \$0 in gifts routed through groups found so far: not every group has been searched, so the penalty can only grow/);
  const c=part(true,[{group:'x',amount:50000}]);assert.equal(c.floor,false);assert.equal(c.points,-1);assert.match(c.note,/^\$50,000 .*every group the FEC shows/);
  assert.match(app,/\$\{p\.floor\?' <span class="muted">so far<\/span>':''\}/);
});

test('People First on the page: a provisional number with no letter, on the score card and the tiles',()=>{
  assert.match(app,/pv\?`<div class="st-big"><b>\$\{num1\(pv\.pct\)\}<\/b><span>%<\/span><\/div><div class="st-letter st-prov"><span>Provisional<\/span>/);
  assert.match(app,/pv\?`\$\{pct1\(pv\.pct\)\} · Provisional, no grade`/);
  assert.match(app,/pv\?`<b class="hc-prov">Provisional<\/b><span>\$\{pct1\(pv\.pct\)\}<\/span>`/);
  // The rankings and the Scores lists read pct, which a provisional result doesn't have.
  assert.match(app,/peoplefirst:x\.peoplefirst\.pct\}/);
  // A provisional People First isn't news.
  const now={a:{peoplefirst:{pct:100,provisional:true,actions:3}},b:{peoplefirst:{pct:80,actions:12}}};
  assert.deepEqual(gradeNews({},now,'2026-11-20').map(x=>x.id),['b']);
  assert.ok(!JSON.parse(read('public/news.json')).items.some(x=>x.kind==='grade'&&x.grade==='peoplefirst'));
});

test('the banner: one label, and a link that opens the latest official records instead of going nowhere',()=>{
  assert.ok(!live.includes('<b>Saved research:</b>'));
  assert.match(live,/pane\.querySelector\('#live-records'\)\?' <a href="#live-records" data-latest>See latest official records<\/a>\.':''/);
  assert.match(live,/querySelector\('\[data-latest\]'\)\?\.addEventListener\('click',e=>\{e\.preventDefault\(\);/);
  assert.match(live,/for\(let d=t\.closest\('details'\);d;d=d\.parentElement\?\.closest\('details'\)\)d\.open=true;/);
});

test('an address that matches nothing says so; old Races links still open the home page',()=>{
  assert.match(app,/else\{document\.body\.dataset\.page='notfound';app\.innerHTML=`<section class="section"><div class="page-eyebrow">PAGE NOT FOUND<\/div>/);
  assert.match(app,/else if\(m\[1\]==='races'\)\{location\.replace\('#home'\);\}/);
});

test('outdated text: the retired Integrity grade, people taken off the site, the Races page',()=>{
  assert.ok(!app.includes('The current grading interface consolidates'));
  assert.match(app,/<h2 id="method-integrity">Integrity \(retired\)<\/h2>/);
  assert.ok(!app.includes('${integrityPreviewLog()}'),'the preview log with its unrounded values is off the page');
  assert.ok(!/Husted \(appointed in January 2025\) and Sen\. Pete Ricketts are profiled/.test(app));
  assert.ok(!app.includes('Mary Peltola and Mariannette Miller-Meeks'));
  assert.ok(!app.includes('key 2026 races'));
  assert.notEqual(JSON.parse(read('public/research.json')).asof,'October 2, 2026');
  assert.ok(!fs.existsSync(new URL('../Public Ledger.html',import.meta.url)),'the October snapshot with people taken off the site is gone');
});

test('the conflicts file holds only reviewed records, each with its report, review date and every item marked',()=>{
  const c=JSON.parse(read('public/conflicts.json'));
  for(const r of Object.values(c.people)){assert.ok(r.report?.year&&r.reviewed?.at);
    for(const k of ['income','positions','agreements','gifts','travel'])for(const x of r[k])assert.equal(typeof x.interested,'boolean');}
});

test('the removal script reaches the tracker history\'s routed gifts, named donors and linked campaigns',()=>{
  const fn=FILES.find(([f])=>f==='public/tracker-history.json')[1];
  const d={people:{x:1,k:1},trackers:{aipac:{x:1}},routed:{aipac:{2022:{x:5,k:2}}},donors:{aipac:{x:{2024:{a:1}},k:{}}},linked:{x:['H0'],k:[]}};
  assert.equal(fn(d,{ids:new Set(['x'])}),5);
  assert.deepEqual(d,{people:{k:1},trackers:{aipac:{}},routed:{aipac:{2022:{k:2}}},donors:{aipac:{k:{}}},linked:{k:[]}});
});

test('the home page draws its cards a batch at a time, and the page stays put as each batch is added',()=>{
  const css=read('public/remake.css');
  assert.match(app,/const HOME_FIRST=24,HOME_BATCH=48;/);
  assert.match(app,/function homeCards\(cards,list\)\{/);
  assert.match(app,/\$\('#profile-count'\)\.textContent=`\$\{list\.length\} profiles · reviewed and basic coverage labeled`;\n    homeCards\(cards,list\);/,'the count is the whole list, not the cards drawn so far');
  assert.match(app,/<div class="hc-more" id="cards-more" hidden><button type="button"/,'a button when scrolling doesn\'t load them');
  assert.match(app,/cards\.appendChild\(wrap\);fillBasic\(wrap\);fillWealth\(wrap\);/,'each batch\'s tiles are filled');
  assert.match(app,/ob\.unobserve\(more\);ob\.observe\(more\);/,'checked again after each batch');
  assert.match(css,/\.hc-batch \{ display: contents; \}/);
  assert.match(css,/\.hc-more, \.hc-more ~ \*, body > footer \{ overflow-anchor: none; \}/);
  assert.ok(!app.includes('Three primary grades: Your Match, Integrity, and People First'));
});
