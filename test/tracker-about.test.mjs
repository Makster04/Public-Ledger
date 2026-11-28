// The Trackers page's About view (public/tracker-about.js): drawn from the same tracker lists the site counts with.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {TRACKERS} from '../public/trackers.js';
import {trackerAboutHTML,trackerPanel,kinds,human,PAC_NAMES,LEFT_OUT,NOTES,executivesOf,listCompanies,titleCase} from '../public/tracker-about.js';

test('every tracker has its left-out list and a name for each PAC on file',()=>{
  for(const t of TRACKERS){
    assert.ok(LEFT_OUT[t.key]?.length,`${t.key} left out`);assert.ok(NOTES[t.key],`${t.key} note`);
    // (Pro-Union's are every committee the FEC labels a labor organization's, listed by that label, not by name)
    if(!t.kinds)for(const id of t.pacIds)assert.ok(PAC_NAMES[id],`${t.key}: ${id} has a name`);
  }
});
test('name patterns read in plain words',()=>{
  assert.deepEqual(human(/^AIPAC\b/),['AIPAC']);
  assert.deepEqual(human(/CVS HEALTH|\bAETNA\b|CAREMARK/),['CVS HEALTH','AETNA','CAREMARK']);
  assert.deepEqual(human(/JOHNSON (AND|&) JOHNSON/),['JOHNSON (AND / &) JOHNSON']);
  assert.deepEqual(human(/\bBOEING\b(?!.*CREDIT UNION)/),['BOEING']);
  assert.equal(titleCase('META PLATFORMS, INC. PAC'),'Meta Platforms, Inc. PAC');
});
test('the kinds of data name the trackers that read each, from their settings',()=>{
  const k=Object.fromEntries(kinds(TRACKERS).map(x=>[x.name,x.who]));
  assert.equal(k['PAC checks'],`All ${TRACKERS.length} trackers`);
  assert.equal(k['Gifts passed on'],'Pro-Israel Lobby and Pro-Peace / Two-State + Palestine');
  assert.equal(k["Employees' and executives' gifts"],'Big Tech + AI and Crypto');
  assert.match(k['Super PAC spending'],/Pro-Israel Lobby/);
});
test('the view lists every tracker, with its counts or "Waits", and opens the chosen one',()=>{
  const counts={aipac:{took:293,read:488,career:null},crypto:{took:66,read:488,career:105}};
  const html=trackerAboutHTML(TRACKERS,counts,'crypto',{read:488,through:'Oct 14, 2026'});
  for(const t of TRACKERS)assert.ok(html.includes(`data-ab="${t.key}"`),t.key);
  assert.match(html,/293 of 488/);assert.match(html,/>Waits</);assert.match(html,/aria-labelledby="ta-h-crypto"/);
  assert.match(html,new RegExp(`All ${TRACKERS.length} at a glance`));
  const tech=TRACKERS.find(t=>t.key==='tech');
  assert.ok(listCompanies(tech).some(c=>c.name==='OpenAI'));assert.ok(executivesOf(tech).some(e=>e.companyName==='Anthropic'));
  const p=trackerPanel(TRACKERS.find(t=>t.key==='aipac'),counts.aipac);
  assert.match(p,/Miriam Adelson/);assert.match(p,/fec\.gov\/data\/committee\/C00797670/);assert.match(p,/J Street/);
});
test('the Trackers page has an About view',async()=>{
  const app=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/\['trackers-about','About'\]/);assert.match(app,/if\(m\[2\]==='about'\)renderTrackerAbout\(\)/);
});
