import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {electionDay,campaignSite,campaignYears,pageText,dropRepeated,issueLinks,indexPath,wayback,readCampaign,fecFacts} from '../scripts/collect-campaign-text.mjs';

test('election days and the years someone was on the ballot',()=>{
  assert.deepEqual([2016,2018,2020,2022,2024,2026].map(electionDay),['2016-11-08','2018-11-06','2020-11-03','2022-11-08','2024-11-05','2026-11-03']);
  // The FEC's years; a sitting House member's even years since they took office as well; a senator's seat years.
  assert.deepEqual(campaignYears({fecYears:[1996,2002,2008,2014,2020,2026],chamber:'S',inOffice:true},2016,2026),[2020,2026]);
  assert.deepEqual(campaignYears({fecYears:[2026],chamber:'H',inOffice:true,since:'U.S. Representative since January 2021'},2016,2026),[2020,2022,2024,2026]);
  assert.deepEqual(campaignYears({chamber:'S',seat:'Class 3 · on the ballot November 3, 2028',inOffice:true},2016,2026),[2016,2022]);
  assert.deepEqual(campaignYears({chamber:'S',inOffice:false,cycle:2026},2016,2026),[2026]);
});

test('campaign websites: from config or the FEC, never an official .gov site or a social media page',()=>{
  assert.deepEqual(campaignSite('WWW.SUSANCOLLINS.COM'),{root:'https://www.susancollins.com/',page:null,host:'susancollins.com'});
  assert.deepEqual(campaignSite('https://baisleyforsenate.com/issues/'),{root:'https://baisleyforsenate.com/',page:'https://baisleyforsenate.com/issues/',host:'baisleyforsenate.com'});
  for(const u of ['https://collins.house.gov/about','https://www.ricketts.senate.gov/','https://www.facebook.com/p/Eric-Flores','https://secure.actblue.com/donate/x','',null,'not an address'])assert.equal(campaignSite(u),null,String(u));
});

const HOME=`<html><head><title>Jon for Senate</title><script>var x=1</script></head><body>
<nav><a href="/">Home</a><a href="/issues">Issues</a><a href="/donate">Donate</a></nav>
<header><h1>Jon Smith for Senate</h1></header>
<p>Jon is running to put working families first and to clean up Washington.</p>
<a href="https://www.jonforsenate.com/issues/">On the Issues</a> <a href="/about">About Jon</a> <a href="/news/123">News</a>
<a href="https://other.org/issues">Elsewhere</a> <a href="/priorities?utm=1#top">Our Priorities</a> <a href="/files/plan.pdf">Plan (PDF)</a>
<form><input name="email"><button>Sign up</button></form>
<footer><p>Paid for by Jon for Senate. All rights reserved.</p></footer></body></html>`;
const ISSUES=`<html><head><title>Issues</title></head><body><h2>Where Jon stands</h2>
<a href="/issues/stock-trading">Ban stock trading</a><a href="/issues/health-care">Health care</a><a href="/volunteer">Volunteer</a>
<p>Jon will fight for the people of our state every single day.</p></body></html>`;
const STOCKS=`<html><head><title>Ban stock trading</title></head><body><h2>Ban Congressional Stock Trading</h2>
<p>As Senator, Jon will vote to ban members of Congress from trading individual stocks.</p>
<ul><li>Jon will introduce a bill to require blind trusts.</li><li>Short.</li></ul>
<p>Donate today to support the campaign.</p><p>Jon will fight for the people of our state every single day.</p></body></html>`;

test('a page as text: headings and paragraphs, without scripts, menus, forms, footers or donate lines',()=>{
  const t=pageText(HOME);
  assert.equal(t.title,'Jon for Senate');
  assert.equal(t.text,'## Jon Smith for Senate\nJon is running to put working families first and to clean up Washington.');
  assert.equal(pageText(STOCKS).text,'## Ban Congressional Stock Trading\nAs Senator, Jon will vote to ban members of Congress from trading individual stocks.\n- Jon will introduce a bill to require blind trusts.\nJon will fight for the people of our state every single day.');
  assert.equal(pageText('<p>Tom&rsquo;s plan &amp; the &#8220;deal&#8221; costs $5&nbsp;million now</p>').text,'Tom’s plan & the “deal” costs $5 million now');
  // A line most pages of a campaign repeat is the site's, not a position.
  const pages=dropRepeated([{text:'## A\nJon will fight for the people.\nOne'},{text:'## B\nJon will fight for the people.\nTwo'},{text:'## C\nJon will fight for the people.\nThree'}]);
  assert.deepEqual(pages.map(p=>p.text),['## A\nOne','## B\nTwo','## C\nThree']);
});

test('the links to where they stand: same site, issue pages first, no donate, news, files or other sites',()=>{
  // (/issues and https://www.jonforsenate.com/issues/ are one page)
  assert.deepEqual(issueLinks(HOME,'https://jonforsenate.com/').map(l=>l.url),['https://jonforsenate.com/issues','https://jonforsenate.com/priorities']);
  assert.deepEqual(issueLinks(ISSUES,'https://jonforsenate.com/issues',{under:'/issues'}).map(l=>l.url),['https://jonforsenate.com/issues/stock-trading','https://jonforsenate.com/issues/health-care']);
  assert.deepEqual(['https://x.com/issues','https://x.com/our-priorities','https://x.com/issues/health','https://x.com/about'].map(indexPath),['/issues','/our-priorities',null,null]);
});

// A pretend Wayback Machine: saved copies of a few pages, and the requests made to it.
function fakeWayback(saved){
  const calls=[];
  const fetch=async u=>{u=new URL(String(u));calls.push(u.href);
    if(u.pathname==='/cdx/search/cdx'){const page=u.searchParams.get('url').replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''),to=u.searchParams.get('to');
      const hits=(saved[page]||[]).filter(s=>s.ts.slice(0,8)<=to&&s.ts.slice(0,8)>=u.searchParams.get('from'));
      // (with no saved copy, an empty answer, as the Wayback Machine can send)
      return hits.length?Response.json([['timestamp','original'],...hits.map(s=>[s.ts,`https://${page}`])]):new Response('',{status:200});}
    const m=/^\/web\/(\d{14})id_\/https?:\/\/(?:www\.)?(.+?)\/?$/.exec(u.pathname);
    const hit=m&&(saved[m[2]]||[]).find(s=>s.ts===m[1]);
    return hit?new Response(hit.html,{status:200}):new Response('',{status:404});};
  return {fetch,calls};
}

test('one campaign read from the Wayback Machine: the last copy before election day, its issue pages and those under them',async()=>{
  const cache=fs.mkdtempSync(path.join(os.tmpdir(),'wayback-'));
  const w=fakeWayback({
    'jonforsenate.com':[{ts:'20200915120000',html:HOME.replace('working families','farmers')},{ts:'20201101120000',html:HOME},{ts:'20201210120000',html:'<p>After the election, a thank-you page only.</p>'}],
    'jonforsenate.com/issues':[{ts:'20201020000000',html:ISSUES}],
    'jonforsenate.com/issues/stock-trading':[{ts:'20200801000000',html:STOCKS}],
  });
  const c=await readCampaign(wayback({fetch:w.fetch},{wait:0,cache}),campaignSite('jonforsenate.com'),2020);
  assert.deepEqual([c.saved,c.capture.date,c.electionDay],[true,'2020-11-01','2020-11-03']);
  assert.deepEqual(c.pages.map(p=>[p.date,new URL(p.original).pathname]),[['2020-11-01','/'],['2020-10-20','/issues'],['2020-08-01','/issues/stock-trading']]);
  assert.match(c.pages[0].text,/working families first/);
  assert.match(c.pages[2].text,/ban members of Congress from trading individual stocks/);
  assert.equal(c.pages[0].url,'https://web.archive.org/web/20201101120000/https://jonforsenate.com');
  // Pages that were never saved are listed, not invented.
  assert.deepEqual(c.notSaved,['https://jonforsenate.com/issues/health-care','https://jonforsenate.com/priorities']);
  // A second read comes from the pages kept on this computer.
  const before=w.calls.filter(u=>u.includes('id_')).length;
  await readCampaign(wayback({fetch:w.fetch},{wait:0,cache}),campaignSite('jonforsenate.com'),2020);
  assert.equal(w.calls.filter(u=>u.includes('id_')).length,before);
  // No copy before election day: said so.
  const none=await readCampaign(wayback({fetch:w.fetch},{wait:0,cache}),campaignSite('jonforsenate.com'),2016);
  assert.deepEqual([none.saved,none.pages],[false,[]]);
  fs.rmSync(cache,{recursive:true,force:true});
});

test('the FEC: the campaign committee\'s website and the years on the ballot, only with a key',async()=>{
  assert.equal(await fecFacts({fecCmte:'C1',fecCand:'S1'},{}),null);
  const env={FEC_API_KEY:'k',fetch:async u=>Response.json(String(u).includes('/committee/')?{results:[{website:'WWW.JONFORSENATE.COM'}]}:{results:[{election_years:[2020,2026]}]})};
  assert.deepEqual(await fecFacts({fecCmte:'C1',fecCand:'S1'},env),{website:'WWW.JONFORSENATE.COM',years:[2020,2026]});
});
