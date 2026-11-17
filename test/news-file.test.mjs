// The two copies of the site's news: the committed public/news.json and the daily .local/news.json (scripts/news-file.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {laterNews,NEWS_FILES} from '../scripts/news-file.mjs';

test('the news served and carried forward is the one built later',()=>{
  const old={news:{built:'2026-11-14'},mtime:5},daily={news:{built:'2026-11-17'},mtime:1};
  assert.equal(laterNews(old,daily),daily,'a later day wins, even if the other file was written after (a git pull)');
  assert.equal(laterNews(daily,old),daily);
  const same={news:{built:'2026-11-17'},mtime:9};
  assert.equal(laterNews(daily,same),same,'the same day: the one written last');
  assert.equal(laterNews(null,old),old);assert.equal(laterNews(old,null),old);assert.equal(laterNews(null,null),null);
  assert.equal(laterNews({news:null},daily),daily);
  assert.ok(NEWS_FILES.local.startsWith('.local'),'the daily copy is in the folder git ignores');
});
