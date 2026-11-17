// Where the site's news (scripts/build-news.mjs) is kept. public/news.json is the copy you commit, written by
// npm run news:build (and at the end of npm run corporate:pacs and npm run promises:build). .local/news.json is the copy
// npm start rebuilds by itself once a day; it isn't tracked by git, so a pull never conflicts with it. The local server
// serves whichever of the two was built later, and each build carries the newer one's "seen" stamps forward.
import fs from 'node:fs';
import path from 'node:path';

export const NEWS_FILES={committed:path.join('public','news.json'),local:path.join('.local','news.json')};

// The later of two news files: by the day each was built, then (built the same day) by when it was written.
// Each argument: {news, mtime} or null.
export function laterNews(a,b){
  if(!a?.news)return b?.news?b:null;
  if(!b?.news)return a;
  const da=String(a.news.built||''),db=String(b.news.built||'');
  if(da!==db)return da>db?a:b;
  return (b.mtime||0)>(a.mtime||0)?b:a;
}
const readNews=f=>{try{return {news:JSON.parse(fs.readFileSync(f,'utf8')),mtime:fs.statSync(f).mtimeMs,file:f};}catch{return null;}};
// {news, mtime, file} for the later of the two files under root, or null when neither can be read.
export function newestNews(root){
  return laterNews(readNews(path.join(root,NEWS_FILES.committed)),readNews(path.join(root,NEWS_FILES.local)));
}
