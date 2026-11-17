// The API updates tab's key table (public/live.js KEYS) lists every key the refresh can use: each key of a source that
// isn't turned off. A source switched back on (Eulerpool, Nov. 17, 2026) once ran without its key showing there.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HOSTS} from '../src/sources.mjs';
import {FEEDS,RETIRED_FEEDS,FEED_KINDS} from '../src/feeds.mjs';

test('every key a source in use reads is on the API updates tab, and no turned-off source\'s key is',()=>{
  const live=fs.readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
  const listed=new Set([...live.matchAll(/\['([A-Z_]+)','https?:/g)].map(m=>m[1]));
  const used=new Set(FEED_KINDS.map(k=>FEEDS[k].host)),off=new Set(RETIRED_FEEDS.map(k=>FEEDS[k].host).filter(h=>!used.has(h)));
  const keys=[...new Set(Object.entries(HOSTS).filter(([h])=>!off.has(h)).flatMap(([,h])=>[...(h.keys||[]),...(h.agent?[h.agent]:[])]))];
  for(const k of keys)assert.ok(listed.has(k),`${k} is missing from the API updates tab's key table`);
  for(const h of off)for(const k of HOSTS[h]?.keys||[])assert.ok(!listed.has(k),`${k} belongs to a turned-off source`);
  assert.ok(listed.has('EULERPOOL_API_KEY'));
});
