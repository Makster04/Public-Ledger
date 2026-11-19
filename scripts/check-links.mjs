// The citation link check (from the Nov. 18, 2026 audit: 2 of 24 sampled links were dead). Every http(s) link in the
// site's data files is checked; one is dead only when its site answers 404 or 410, or its domain no longer exists, on
// two tries a minute apart. A site that refuses scripts (403, 429) or doesn't answer is "not checked", never dead.
// For each dead link the Internet Archive is asked for its latest copy (the Wayback availability API), and the link is
// replaced by that copy.
//   npm run links:check            check, and save the replacements in .local/link-check.json; npm start applies them
//                                  to the data it serves (scripts/local.mjs), so the tracked files never change on the
//                                  Mac and a git pull never conflicts. npm start runs this once a month by itself.
//   npm run links:check -- --apply also write the replacements into the data files themselves (to commit them)
//   npm run links:check -- --only <host>   just one site's links
// Archived copies (web.archive.org) and the site's own pages aren't checked. Each site is asked at most once every
// PACE ms, several sites at a time.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const FILES=['public/research.json','public/question-statements.json','public/promises.json','public/members-elect.json','data/question-statements.json'];
export const REPORT=path.join(ROOT,'.local','link-check.json');
export const PACE=1500,HOSTS_AT_ONCE=6,TIMEOUT=20_000;
const UA='PublicLedger-linkcheck/1.0 (citation link check for a nonprofit scorecard)';
const SKIP=/^(web\.archive\.org|archive\.org|localhost|127\.0\.0\.1)$/i;

// Every link in a data file's text, once each.
export function linksIn(text){
  const out=new Set();for(const m of String(text).matchAll(/"(https?:\/\/[^"\s\\]+)"/g))out.add(m[1]);return [...out];
}
// What an answer means: dead (404, 410, the domain gone), ok, or not checked (refused, throttled, server trouble, no answer).
export function verdict({status=0,code=''}={}){
  if(status===404||status===410||/ENOTFOUND|EAI_AGAIN_DEAD/.test(code))return 'dead';
  if(status>=200&&status<400)return 'ok';
  return 'unchecked';
}
async function ask(url){
  const go=async method=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT);
    try{const r=await fetch(url,{method,redirect:'follow',signal:c.signal,headers:{'User-Agent':UA,...(method==='GET'?{Range:'bytes=0-2047'}:{})}});
      try{await r.body?.cancel();}catch{}return {status:r.status};}
    catch(e){return {status:0,code:String(e?.cause?.code||e?.code||e?.name||'')};}
    finally{clearTimeout(t);}};
  const h=await go('HEAD');
  // Many sites answer HEAD wrongly (405, 403, 404 on a page that exists): ask again with GET before deciding.
  return h.status>=200&&h.status<400?h:await go('GET');
}
// The Internet Archive's latest copy of a page, or null.
export async function archived(url,{fetchImpl=fetch}={}){
  try{const r=await fetchImpl(`https://archive.org/wayback/available?url=${encodeURIComponent(url.replace(/^https?:\/\//,''))}`,{headers:{'User-Agent':UA}});
    if(!r.ok)return null;const d=await r.json(),c=d?.archived_snapshots?.closest;
    return c?.available&&String(c.status)==='200'&&c.url?c.url.replace(/^http:/,'https:'):null;}
  catch{return null;}
}
// Replacements into a file's text: each dead link, as a whole JSON string, by its archived copy.
export function applyFixes(text,fixes){
  let out=String(text);for(const [from,to] of Object.entries(fixes||{}))if(to)out=out.split(`"${from}"`).join(`"${to}"`);return out;
}

// Check links, host by host, at most HOSTS_AT_ONCE hosts at a time, each host PACE apart.
export async function checkAll(urls,{check=ask,pace=PACE,wait=ms=>new Promise(r=>setTimeout(r,ms)),log=()=>{}}={}){
  const byHost=new Map();for(const u of urls){let h;try{h=new URL(u).hostname;}catch{continue;}if(SKIP.test(h))continue;(byHost.get(h)||byHost.set(h,[]).get(h)).push(u);}
  const hosts=[...byHost.keys()],res=new Map();let done=0;
  const worker=async()=>{for(let h=hosts.shift();h;h=hosts.shift())for(const u of byHost.get(h)){const s=Date.now();res.set(u,{...(await check(u))});
    if(++done%100===0)log(`  ${done} checked`);await wait(pace-(Date.now()-s));}};
  await Promise.all(Array.from({length:HOSTS_AT_ONCE},worker));
  return res;
}

async function main(){
  const apply=process.argv.includes('--apply'),only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1]:null;
  const texts=Object.fromEntries(FILES.filter(f=>fs.existsSync(path.join(ROOT,f))).map(f=>[f,fs.readFileSync(path.join(ROOT,f),'utf8')]));
  let urls=[...new Set(Object.values(texts).flatMap(linksIn))];
  if(only)urls=urls.filter(u=>{try{return new URL(u).hostname===only;}catch{return false;}});
  console.log(`Checking ${urls.length} links…`);
  const first=await checkAll(urls,{log:console.log});
  const maybe=[...first].filter(([,r])=>verdict(r)==='dead').map(([u])=>u);
  if(maybe.length){console.log(`${maybe.length} look dead; checking them again in a minute…`);await new Promise(r=>setTimeout(r,60_000));}
  const second=maybe.length?await checkAll(maybe):new Map();
  const dead=maybe.filter(u=>verdict(second.get(u))==='dead');
  const fixes={},rows=[];
  for(const u of dead){const a=await archived(u);fixes[u]=a;rows.push({url:u,status:second.get(u)?.status||second.get(u)?.code||null,archived:a,files:Object.keys(texts).filter(f=>texts[f].includes(`"${u}"`))});
    await new Promise(r=>setTimeout(r,1000));}
  const count=v=>[...first.values()].filter(r=>verdict(r)===v).length;
  const report={checked:new Date().toISOString().slice(0,10),links:urls.length,ok:count('ok'),unchecked:count('unchecked'),dead:rows,fixes:Object.fromEntries(Object.entries(fixes).filter(([,v])=>v))};
  fs.mkdirSync(path.dirname(REPORT),{recursive:true});
  // A month's earlier fixes are kept (a link swapped then is no longer in the files to be found dead again).
  try{const was=JSON.parse(fs.readFileSync(REPORT,'utf8'));report.fixes={...(was.fixes||{}),...report.fixes};}catch{}
  fs.writeFileSync(REPORT,JSON.stringify(report,null,1)+'\n');
  console.log(`${report.ok} fine, ${report.unchecked} not checked (the site refused or didn't answer), ${rows.length} dead: ${rows.filter(r=>r.archived).length} with an archived copy.`);
  for(const r of rows)console.log(`  ${r.url}\n    -> ${r.archived||'no archived copy'}`);
  if(apply){for(const [f,t] of Object.entries(texts)){const n=applyFixes(t,report.fixes);if(n!==t){fs.writeFileSync(path.join(ROOT,f),n);console.log(`Updated ${f}`);}}}
  else console.log('Saved in .local/link-check.json; npm start serves the data with the archived copies.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exit(1);});
