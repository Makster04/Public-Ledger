// The cause groups (approved 2026-11-28): Pro-Union, Pro-Environment and Pro-Peace / Two-State + Palestine, followed like the
// eight lobbies but shown apart, with gray marks, and never part of the No lobby money bonus, the report card or the ticker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TRACKERS,TRACKER,LOBBIES,CAUSES,LOBBY_COUNT,CAUSE_COUNT,lookouts,trackerMoney,isTrackerPac} from '../public/trackers.js';
import {LABOR_PACS,NOT_UNIONS} from '../public/labor-pacs.js';
import {lobbySummary} from '../public/six-scores.js';
import {laborCommittee} from '../scripts/build-labor-pacs.mjs';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const app=read('../public/app.js');

test('eight lobbies and three cause groups; the lobbies alone by default',()=>{
  assert.deepEqual(LOBBIES.map(t=>t.key),['aipac','pharma','insurers','oil','tech','crypto','defense','wallstreet']);
  assert.deepEqual(CAUSES.map(t=>[t.key,t.name,t.icon]),[['union','Pro-Union','👷🎁'],['environment','Pro-Environment','🌳🎁'],['peace','Pro-Peace / Two-State + Palestine','🕊️🎁']]);
  assert.equal(LOBBY_COUNT,'eight');assert.equal(CAUSE_COUNT,'three');
  const inp={pacLines:[{cid:'C00011114',name:'AFSCME P E O P L E',amount:10000}],routed:{},routedKnown:true};
  assert.equal(lookouts(inp).length,8,'the lobbies');
  assert.deepEqual(lookouts(inp,CAUSES).map(x=>[x.key,x.status,x.total]),[['union','took',10000],['environment','none',0],['peace','none',0]]);
});

test('the No lobby money bonus follows the eight lobbies only: union money never costs it',()=>{
  const inp={pacLines:[{cid:'C00011114',name:'AFSCME P E O P L E',amount:10000},{cid:'C00252940',name:'LEAGUE OF CONSERVATION VOTERS ACTION FUND',amount:1000}],routed:{jstreet:5000},routedKnown:true,donors:{}};
  assert.equal(lobbySummary(lookouts(inp)).status,'none');
  assert.ok(app.includes('if(d?.money||period!==\'this\')return lobbySummary(lookouts(lookoutInputs(s,d,period)));'),'the bonus reads lookouts() with its default list');
  assert.ok(app.includes("trackers:inp?lookouts(inp).map(x=>"),'the report card: the lobbies');
  assert.ok(app.includes("const SEAT_BY=[['corporate','Corporate PACs'],...LOBBIES.map(t=>[t.key,t.name])];"),'the seating charts: the lobbies');
});

test('Pro-Union: every committee the FEC labels a union\'s, never the few it mislabels; by ID on the site, by the label in the scripts',()=>{
  assert.ok(LABOR_PACS.length>400&&LABOR_PACS.includes('C00011114')&&LABOR_PACS.includes('C00004036'),'AFSCME, SEIU');
  for(const id of NOT_UNIONS)assert.ok(!LABOR_PACS.includes(id),id);
  assert.ok(NOT_UNIONS.includes('C00113241')&&NOT_UNIONS.includes('C00406850'),'the National Apartment Association\'s; Blue Cross Blue Shield of South Carolina\'s');
  const u=TRACKER.union;
  assert.ok(isTrackerPac(u,{cid:'C00011114'})&&isTrackerPac(u,{cid:'C09999990',kind:'labor'}));
  assert.ok(!isTrackerPac(u,{cid:'C00406850',kind:'labor'})&&!isTrackerPac(u,{cid:'C09999990',kind:'corporate'}));
  assert.equal(laborCommittee('C00011114|AFSCME|x|x|x|x|DC|x|U|Q|x|M|L|AFSCME|'),'C00011114');
  assert.equal(laborCommittee('C00113241|NATIONAL APARTMENT ASSOCIATION PAC|x|x|x|x|VA|x|B|Q|x|M|L|NAA|'),null);
  assert.equal(laborCommittee('C00000001|SOME CORP PAC|x|x|x|x|VA|x|B|Q|x|M|C|SOME CORP|'),null);
  assert.ok(app.includes("mergePacLines(...lists).map(l=>({...l,kind:l.cid?pacKindOf(l.cid):null}))"),'the site passes each PAC line\'s kind where the committee is on file');
});

test('Pro-Environment and Pro-Peace: their committees, and J Street\'s passed-on gifts counted as AIPAC\'s are',()=>{
  const e=TRACKER.environment,p=TRACKER.peace;
  for(const n of ['LEAGUE OF CONSERVATION VOTERS ACTION FUND','SIERRA CLUB POLITICAL COMMITTEE','NRDC ACTION FUND INC PAC'])assert.ok(isTrackerPac(e,{name:n}),n);
  assert.ok(!isTrackerPac(e,{name:'DEFUND SIERRA CLUB PAC'})&&!isTrackerPac(e,{name:'AMERICAN CLEAN POWER PAC'}));
  assert.ok(e.superPacIds.includes('C00486845'),'the LCV Victory Fund');
  assert.ok(isTrackerPac(p,{name:'JSTREETPAC'})&&isTrackerPac(p,{cid:'C00453704'})&&!isTrackerPac(TRACKER.aipac,{name:'JSTREETPAC'}));
  assert.deepEqual(p.routed,['jstreet']);
  const x=trackerMoney(p,{pacLines:[],routed:{jstreet:309639.01},routedKnown:{aipac:false,peace:true}});
  assert.deepEqual([x.status,x.pac,x.routed,x.total],['took',0,309639.01,309639.01]);
  // whether passed-on gifts were read is told per tracker: AIPAC's unread doesn't hold up J Street's
  assert.equal(trackerMoney(p,{pacLines:[],routed:{},routedKnown:{aipac:false,peace:true}}).status,'none');
  assert.equal(trackerMoney(TRACKER.aipac,{pacLines:[],routed:{},routedKnown:{aipac:false,peace:true},donors:{}}).status,'waiting');
  const ids=TRACKERS.flatMap(t=>t.superPacIds||[]);assert.equal(new Set(ids).size,ids.length,'no super PAC counts for two trackers');
});

test('the page: a "Cause groups" section that opens and closes, gray marks, and a label before their tabs, menu options and cards',()=>{
  assert.ok(app.includes('<details class="lk-causes-d" data-keep="causes"><summary><h4>Cause groups</h4>'),'closed at first, with how many took some');
  assert.ok(app.includes("mark=x.status==='took'?(cause?'●':'✕'):x.status==='none'?(cause?'○':'✓'):'…'"));
  assert.ok(app.includes('${cols}<ul class="lk-list lk-causes">'),'the same two columns as the lobbies');
  assert.ok(app.includes("(t.cause&&!TRACKERS[i-1]?.cause?'<span class=\"tr-group-label\">Cause groups</span>':'')"),'the profile\'s Trackers tabs');
  assert.ok(app.includes("'<div class=\"hdd-group\" role=\"presentation\">Cause groups</div>'"),'the Career Totals menu');
  assert.ok(app.includes('<h3 class="mt-group">Cause groups</h3>'),'the Super PACs page');
  assert.ok(app.includes("${t.cause?'Career totals from':'How highly bought &amp; paid for by'} ${pick}"),'a neutral heading');
  const css=read('../public/remake.css');
  assert.match(css,/li\.lk-cause \.lk-mark, \.lk-mark\.lk-cause-mark \{ color: var\(--ink-2\); \}/);
  assert.match(css,/\.lk-causes-d\[open\] > summary::after/);
});

test('the ticker follows the lobbies only',()=>{
  const news=read('../scripts/build-news.mjs');
  assert.ok(news.includes('const lobbyKey=k=>!!k&&!TRACKER[k]?.cause;'));
  assert.ok(news.includes('trackersOf(x.cmte,names.get(x.cmte)).filter(lobbyKey)')&&news.includes('if(!lobbyKey(tracker)||!date'));
});
