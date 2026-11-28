// Tracking Lobby Money in two columns (approved 2026-11-28): what each lobby gave the campaign (which alone sets the mark)
// and what its own super PACs spent this cycle, + to help them win and − against them, — when it runs none.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LOBBIES,CAUSES,TRACKER,trackerMoney} from '../public/trackers.js';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const app=read('../public/app.js'),css=read('../public/remake.css');

test('two column heads over the lobbies and over the cause groups',()=>{
  assert.ok(app.includes(`const cols='<div class="lk-cols" aria-hidden="true"><span></span><span>Gave the campaign</span><span>Super PACs spent</span></div>';`));
  assert.ok(app.includes('<h3>Tracking Lobby Money</h3>${cols}<ul class="lk-list">'));
  assert.ok(app.includes('${cols}<ul class="lk-list lk-causes">'));
  assert.ok(!app.includes('No PAC money or gifts from'),'short names: the column head says what is counted');
  assert.ok(!/const (helpLine|spLine)=/.test(app),'the old one-line super PAC sentences are gone');
});

test('the second column: + for them, − against them, $0, or — with no super PAC of its own or another period',()=>{
  assert.ok(app.includes("if(!t?.superPacs.length||!thisCycle)return null;"));
  assert.ok(app.includes("title=\"${!t?.superPacs.length?'No super PAC of its own':'This cycle only'}\">—</span>"));
  assert.ok(app.includes('<b class="num lk-for" title="${esc(fmtFull(v.help))} spent to help them win">+${sm(v.help)}</b>'));
  assert.ok(app.includes('<b class="num lk-against" title="${esc(fmtFull(v.against))} spent against them">−${sm(v.against)}</b>'));
  assert.ok(app.includes('${spentCell(x)}${split}${rivalsLine(x)}${tierTag(x)}</li>'),'spending against an opponent splits out under the row');
  // Who gets a figure and who gets —.
  const own=[...LOBBIES,...CAUSES].filter(t=>t.superPacs.length).map(t=>t.key);
  for(const k of ['aipac','crypto','tech'])assert.ok(own.includes(k),k);
  for(const k of ['pharma','insurers','oil','defense','wallstreet'])assert.ok(!own.includes(k),k+' shows —');
});

test('only the first column sets the mark: super PAC spending never does',()=>{
  assert.equal(trackerMoney(TRACKER.crypto,{pacLines:[]}).status,'none');
  assert.ok(app.includes('Only this column sets the mark.'));
});

test('four columns on every width, the + purple and the − amber',()=>{
  assert.match(css,/\.lk-list li \{ display: grid; grid-template-columns: 18px minmax\(0, 1fr\) 5\.4rem 5\.4rem;/);
  assert.match(css,/\.lk-cols \{ display: grid; grid-template-columns: 18px minmax\(0, 1fr\) 5\.4rem 5\.4rem;/);
  assert.ok(css.includes('.lookouts .lk-for { color: #9085e9; }')&&css.includes('.lookouts .lk-against { color: #c98500; }'));
});
