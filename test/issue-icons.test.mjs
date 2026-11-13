// The issue emojis (public/issue-icons.js): one for each alignment-question category, and a category for every reviewed
// check's topic, matching where the questions put the same subject.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ISSUE_ICON,PLEDGE_CATEGORY,topicCategory} from '../public/issue-icons.js';
import {TRACKERS} from '../public/trackers.js';

const read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));

test('each question category has its approved emoji',()=>{
  const cats=read('../public/questions.json').categories.map(c=>c.id);
  assert.deepEqual(Object.keys(ISSUE_ICON).sort(),[...cats].sort());
  assert.deepEqual([ISSUE_ICON.technology,ISSUE_ICON['national-security'],ISSUE_ICON.economic,ISSUE_ICON.healthcare,ISSUE_ICON.foreign,ISSUE_ICON.housing],['💻','🛡️','📈','🏥','🌎','🏠']);
});

test('every reviewed check\'s topic gets a category, the way the questions file them',()=>{
  const r=read('../public/research.json');
  for(const s of [...r.members,...(r.cands||[]),...(r.featured||[])])for(const x of s.statements||[])assert.ok(topicCategory(x.topic),`${s.id}: "${x.topic}" has no category`);
  for(const [topic,cat] of [['Medical debt relief','healthcare'],['Gun policy','domestic'],['Congressional stock trading ban','domestic'],['Right to repair','technology'],['Property taxes','housing'],
    ['Abortion rights after Dobbs','social'],['Voter ID and the SAVE Act','electoral'],['Laken Riley Act','immigration'],['Iran war','foreign'],['NSA surveillance and privacy','national-security'],
    ['Rail safety after East Palestine','transportation'],['Tariffs on Canada','economic'],['2025 government shutdown and ACA tax credits','healthcare'],['Government shutdowns','governance']])assert.equal(topicCategory(topic),cat,topic);
  assert.equal(topicCategory('Something else entirely'),null,'no match: no emoji');
});

test('each tracker has its emojis, shown after its name',()=>{
  assert.deepEqual(Object.fromEntries(TRACKERS.map(t=>[t.key,t.icon])),{aipac:'🇮🇱🎁',pharma:'💊🎁',oil:'🛢️🎁',tech:'🤖🎁',crypto:'🤑🎁',defense:'🪖🎁',wallstreet:'💰🎁'});
  for(const t of TRACKERS)assert.equal(t.emoji+'🎁',t.icon,`${t.key}: the report card's emoji is its icon without the 🎁`);
  assert.deepEqual(Object.fromEntries(Object.entries(PLEDGE_CATEGORY).map(([k,c])=>[k,ISSUE_ICON[c]])),{lobbying:'🏛️','stock-trading':'🇺🇸','citizens-united':'🗳️'});
});
