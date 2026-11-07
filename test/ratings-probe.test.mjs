import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUPS,probe,tablesOf,namesOn} from '../scripts/ratings-probe.mjs';

const page=`<html><head><title>2025 Scorecard</title><script src="/js/app.js"></script></head><body>
<a href="/members-of-congress">Members of Congress</a><a href="https://facebook.com/x">Share</a><a href="/download/scores-2025.csv">Download</a>
<table><tr><th>Member</th><th>State</th><th>Score</th></tr><tr><td>Ossoff, Jon</td><td>GA</td><td>97%</td></tr></table></body></html>`;
const fake=async(u)=>{u=String(u);
  if(u.endsWith('/js/app.js'))return new Response('fetch("/api/scorecard/members.json")',{status:200});
  if(u.includes('blocked'))return new Response('<html><title>Just a moment...</title></html>',{status:403});
  if(u.includes('data'))return Response.json([{name:'Ossoff',score:97}]);
  return new Response(page,{status:200,headers:{'content-type':'text/html'}});};

test('a scorecard page: its title, the members named, the links to the ratings, its tables and its scripts\' data addresses',async()=>{
  const r=await probe('https://scorecard.example.org/',{get:fake,surnames:['Ossoff','Collins']});
  const text=r.lines.join('\n');
  assert.match(text,/HTTP 200/);assert.match(text,/title: 2025 Scorecard/);
  assert.match(text,/profiled members named on the page: 1 \(Ossoff\)/);
  assert.match(text,/link: Members of Congress → https:\/\/scorecard\.example\.org\/members-of-congress/);
  assert.match(text,/link: Download → https:\/\/scorecard\.example\.org\/download\/scores-2025\.csv/);
  assert.doesNotMatch(text,/facebook/);
  assert.match(text,/table: 2 rows; first: Member \| State \| Score; second: Ossoff, Jon \| GA \| 97%/);
  assert.match(text,/data addresses in its scripts: .*\/api\/scorecard\/members\.json/);
  assert.equal(r.sample.ext,'html');
});

test('a bot check is recorded and left alone; JSON is described by its keys',async()=>{
  const b=await probe('https://blocked.example.org/',{get:fake});
  assert.match(b.lines.join('\n'),/bot check, not the page: .* left out/);assert.equal(b.sample,null);
  const j=await probe('https://data.example.org/scores.json',{get:fake});
  assert.match(j.lines.join('\n'),/JSON: a list of 1; first item's keys: name, score/);
});

test('every group has a side, an issue and addresses; ACLU and HRC wait on permission',()=>{
  for(const g of GROUPS){assert.ok(['conservative','liberal'].includes(g.lean),g.key);assert.ok(g.issue&&g.urls.length,g.key);for(const u of g.urls)assert.match(u,/^https:\/\//);}
  assert.deepEqual(GROUPS.filter(g=>g.permission).map(g=>g.key).sort(),['aclu','hrc']);
  assert.equal(new Set(GROUPS.map(g=>g.key)).size,GROUPS.length);
  assert.deepEqual(tablesOf('<p>none</p>'),[]);
  assert.deepEqual(namesOn('Sen. Booker voted',['Booker','Lee']),['Booker']);
});
