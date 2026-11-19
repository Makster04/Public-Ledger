// The citation link check (scripts/check-links.mjs) and the key scrubber for saved pages (scripts/scrub-keys.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {linksIn,verdict,applyFixes,checkAll,archived,FILES} from '../scripts/check-links.mjs';
import {scrubKeys} from '../scripts/scrub-keys.mjs';

test('links: every http(s) link in a data file, once; dead only on 404, 410 or a domain that is gone',()=>{
  assert.deepEqual(linksIn('{"a":"https://x.gov/1","b":["https://x.gov/1","http://y.org/p?q=1"],"c":"not a link https://z"}'),['https://x.gov/1','http://y.org/p?q=1']);
  assert.deepEqual([404,410,200,301,403,429,500,0].map(status=>verdict({status})),['dead','dead','ok','ok','unchecked','unchecked','unchecked','unchecked']);
  assert.equal(verdict({status:0,code:'ENOTFOUND'}),'dead');assert.equal(verdict({status:0,code:'ECONNRESET'}),'unchecked');
  for(const f of FILES)assert.ok(fs.existsSync(new URL(`../${f}`,import.meta.url)),f);
});

test('a dead link is replaced as a whole JSON string, so a longer link that starts the same is left alone',()=>{
  const text='{"u":"https://a.com","v":"https://a.com/page","w":["https://a.com"]}';
  assert.equal(applyFixes(text,{'https://a.com':'https://web.archive.org/web/1/https://a.com'}),'{"u":"https://web.archive.org/web/1/https://a.com","v":"https://a.com/page","w":["https://web.archive.org/web/1/https://a.com"]}');
  assert.equal(applyFixes(text,{'https://a.com':null}),text,'no archived copy: unchanged');
});

test('checking: archives skipped, each site paced, every link answered',async()=>{
  const asked=[];
  const res=await checkAll(['https://a.gov/1','https://a.gov/2','https://b.org/x','https://web.archive.org/web/1/https://c.com'],{check:async u=>{asked.push(u);return {status:u.endsWith('2')?404:200};},pace:0,wait:async()=>{}});
  assert.deepEqual([...res.keys()].sort(),['https://a.gov/1','https://a.gov/2','https://b.org/x']);
  assert.equal(verdict(res.get('https://a.gov/2')),'dead');assert.ok(!asked.some(u=>u.includes('web.archive.org')));
  // The archive's answer: its closest copy, over https, or null.
  const json=d=>async()=>({ok:true,json:async()=>d});
  assert.equal(await archived('https://byrdforsenate.com',{fetchImpl:json({archived_snapshots:{closest:{available:true,status:'200',url:'http://web.archive.org/web/20261114044457/https://www.byrdforsenate.com/'}}})}),'https://web.archive.org/web/20261114044457/https://www.byrdforsenate.com/');
  assert.equal(await archived('https://x.com',{fetchImpl:json({archived_snapshots:{}})}),null);
  assert.equal(await archived('https://x.com',{fetchImpl:async()=>{throw new Error('offline');}}),null);
});

test('the two dead links from the audit point at their archived copies',()=>{
  const q=fs.readFileSync(new URL('../public/question-statements.json',import.meta.url),'utf8'),r=fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8');
  assert.ok(!q.includes('"https://bsky.app/profile/booker.senate.gov/post/3mknwhhyans2d"')&&q.includes('web.archive.org/web/20260622102901/https://bsky.app/profile/booker.senate.gov/post/3mknwhhyans2d'));
  // (Byrd's profile, which had the other one, was taken off the site with everyone who lost in 2026.)
  assert.ok(!r.includes('"https://byrdforsenate.com"'));
});

test('saved pages: key-like values are stripped, the page around them kept',()=>{
  const fake='AIza'+'Sy'+'A'.repeat(33);
  assert.equal(scrubKeys(`<script>var k="${fake}";</script>`),'<script>var k="REDACTED";</script>');
  assert.equal(scrubKeys('{"apiKey":"abcdefghijklmnopqrstuvwxyz0123","title":"Scorecard"}'),'{"apiKey":"REDACTED","title":"Scorecard"}');
  assert.equal(scrubKeys('<div data-sitekey="0x4AAAAAAAAbcdefghijklmnopqrstuv">'),'<div data-sitekey="REDACTED">');
  assert.equal(scrubKeys('https://maps.example.com/js?key=abcdefghijklmnop1234&v=3'),'https://maps.example.com/js?key=REDACTED&v=3');
  assert.equal(scrubKeys('<h1>Key votes</h1><a href="/elon-musk-one-big-beautiful-bill">'),'<h1>Key votes</h1><a href="/elon-musk-one-big-beautiful-bill">','ordinary words and slugs stay');
  // Nothing key-like is left in the committed samples.
  for(const dir of ['../data/ratings-samples/','../data/county-samples/'])for(const f of fs.readdirSync(new URL(dir,import.meta.url))){
    const t=fs.readFileSync(new URL(dir+f,import.meta.url),'utf8');assert.equal(scrubKeys(t),t,f);}
});
