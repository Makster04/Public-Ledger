import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../src/worker.mjs';
import {initialize,runRefresh} from '../src/refresh.mjs';
import {HOSTS} from '../src/sources.mjs';
import {openDatabase} from './sqlite.mjs';
import {execFile} from 'node:child_process';
import {newestNews} from './news-file.mjs';
import {applyFixes,REPORT as LINK_REPORT} from './check-links.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.mkdir(path.join(root,'.local'),{recursive:true});
const db=openDatabase(path.join(root,'.local','records.sqlite'));
db.exec(await fs.readFile(path.join(root,'migrations','0001_initial.sql'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
// Every key and contact line named in sources.mjs, read from .dev.vars (or the environment).
const keys=Object.fromEntries([...new Set(Object.values(HOSTS).flatMap(h=>[...(h.keys||[]),...(h.agent?[h.agent]:[])]))].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const env={DB:db,LOCAL_MODE:true,...keys,ASSETS:{async fetch(req){
  const url=new URL(req.url);let relative;try{relative=decodeURIComponent(url.pathname);}catch{return new Response('Invalid path',{status:400});}
  // The news: whichever of public/news.json and the daily .local/news.json was built later (scripts/news-file.mjs).
  if(relative==='/news.json'){const n=newestNews(root);if(n)return new Response(JSON.stringify(n.news),{headers:{'Content-Type':mime['.json'],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});}
  const file=path.resolve(root,'public','.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(path.join(root,'public')+path.sep))return new Response('Not found',{status:404});
  try{
    let body=await fs.readFile(file);
    // Dead citation links swapped for their archived copies (npm run links:check, monthly), without touching the files.
    if(path.extname(file)==='.json'){const fixes=await linkFixes();if(fixes)body=applyFixes(body.toString('utf8'),fixes);}
    return new Response(body,{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Not found',{status:404});}
}}};
// The bundled seed is only read when this computer's database is new.
const seed=await fs.readFile(path.join(root,'data','seed.json'),'utf8').then(JSON.parse,()=>null);
await initialize(db,seed);
const port=Number(process.env.PORT||8787);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT must be an integer from 1024 to 65535');
const server=http.createServer(async(req,res)=>{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);res.end('Local requests only');return;}
  try{
    const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers});
    const result=await worker.fetch(request,env,{});res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Local server error');}
});
let running=false;
// Pages fetched per minute (LOCAL_STEPS in .dev.vars, 40 by default); each source still gets only its own share.
const steps=Math.max(1,Math.min(200,Number(process.env.LOCAL_STEPS)||40));
async function tick(){if(running)return;running=true;try{const r=await runRefresh(env,{steps});if(r.processed)console.log(`Refresh processed ${r.processed} source pages.`);}catch(e){console.error('Refresh failed:',e.message);}finally{running=false;}}
let timer,newsTimer,newsRunning=false,linksRunning=false,linkCache={mtime:0,fixes:null};
// The link check's replacements (.local/link-check.json), read again when the file changes.
async function linkFixes(){
  try{const st=await fs.stat(LINK_REPORT);if(st.mtimeMs!==linkCache.mtime){const r=JSON.parse(await fs.readFile(LINK_REPORT,'utf8'));linkCache={mtime:st.mtimeMs,fixes:Object.keys(r.fixes||{}).length?r.fixes:null};}}
  catch{linkCache={mtime:0,fixes:null};}
  return linkCache.fixes;
}
// The citation link check, once a month while this runs (scripts/check-links.mjs), in its own process.
async function checkLinks(){
  if(linksRunning)return;
  try{const r=JSON.parse(await fs.readFile(LINK_REPORT,'utf8'));if((Date.now()-Date.parse(r.checked))/864e5<30)return;}catch{}
  linksRunning=true;
  execFile(process.execPath,[path.join(root,'scripts','check-links.mjs')],{cwd:root,timeout:3*60*60_000},(error,stdout)=>{
    linksRunning=false;
    if(error)console.error('Link check failed:',error.message.split('\n')[0]);
    else{const line=String(stdout).split('\n').find(l=>/ dead: /.test(l));if(line)console.log('Link check:',line.trim());}
  });
}
// The site's news (grade changes, reviewed promise verdicts, the trackers' PAC checks and super PAC spending from the FEC
// bulk files on disk), rebuilt into .local/news.json once a day while this runs, in its own process so pages stay quick.
// The FEC bulk files themselves are downloaded again by npm run corporate:pacs and npm run superpacs:races.
function buildNews(){
  const today=new Date().toISOString().slice(0,10);
  if(newsRunning||newestNews(root)?.news?.built===today)return;
  newsRunning=true;
  execFile(process.execPath,[path.join(root,'scripts','build-news.mjs'),'--local'],{cwd:root,timeout:20*60_000},(error,stdout)=>{
    newsRunning=false;
    if(error)console.error('Latest updates rebuild failed:',String(error.message).split('\n')[0]);
    else console.log(`Latest updates rebuilt. ${String(stdout).trim().split('\n').at(-1)||''}`);
  });
}
// Conflicts of Interest, kept up to date with no one reviewing (since Nov. 28, 2026): once a day, every sitting member's
// annual reports the refresh has read (scripts/export-disclosures.mjs), each organization on them not looked up yet
// checked on lda.gov and USAspending.gov (scripts/match-conflicts.mjs lookup, which goes on from where it stopped), and
// public/conflicts.json rebuilt with the automatic decisions (match-conflicts.mjs build), which the grades read as soon
// as it's written. One after another, in their own processes; .local/conflicts-run.json keeps it to once a day.
const CONFLICTS_STAMP=path.join(root,'.local','conflicts-run.json');
let conflictsRunning=false;
const runScript=(args,timeout)=>new Promise(done=>execFile(process.execPath,['--no-warnings=ExperimentalWarning',...args],{cwd:root,timeout,maxBuffer:64*1024*1024},(error,stdout)=>done({error,out:String(stdout||'').trim()})));
const lastLine=x=>x.out.split('\n').filter(Boolean).at(-1)||'';
async function updateConflicts(){
  const today=new Date().toISOString().slice(0,10);
  if(conflictsRunning)return;
  try{if(JSON.parse(await fs.readFile(CONFLICTS_STAMP,'utf8')).date===today)return;}catch{}
  conflictsRunning=true;
  try{
    const exp=await runScript([path.join(root,'scripts','export-disclosures.mjs')],20*60_000);
    if(exp.error){console.error('Disclosure export failed:',String(exp.error.message).split('\n')[0]);return;}
    const look=await runScript([path.join(root,'scripts','match-conflicts.mjs'),'lookup'],6*60*60_000);
    if(look.error)console.error('Conflict lookups stopped for today (they go on tomorrow):',lastLine(look)||String(look.error.message).split('\n')[0]);
    const build=await runScript([path.join(root,'scripts','match-conflicts.mjs'),'build'],10*60_000);
    if(build.error)console.error('Conflicts of Interest rebuild failed:',String(build.error.message).split('\n')[0]);
    else console.log(`Conflicts of Interest rebuilt. ${lastLine(build)}`);
    await fs.writeFile(CONFLICTS_STAMP,JSON.stringify({date:today}));
  }finally{conflictsRunning=false;}
}
// Keeps Their Word, kept up to date with no one reviewing (since Nov. 28, 2026): once a week, the promise finder reads
// the statements collected since (scripts/find-promises.mjs), each sure item takes the finder's own verdict
// (scripts/review-promises.mjs --auto: the bill named, a clear final vote, nothing in doubt), and the promises are
// rebuilt (scripts/build-promises.mjs). Items that aren't sure yet stay in the queue, not counted, until the record
// settles them. .local/promises-run.json keeps it to once a week.
const PROMISES_STAMP=path.join(root,'.local','promises-run.json');
let promisesRunning=false;
async function updatePromises(){
  if(promisesRunning)return;
  try{if((Date.now()-Date.parse(JSON.parse(await fs.readFile(PROMISES_STAMP,'utf8')).at))/864e5<7)return;}catch{}
  promisesRunning=true;
  try{
    const find=await runScript([path.join(root,'scripts','find-promises.mjs')],2*60*60_000);
    if(find.error){console.error('Promise finder failed:',lastLine(find)||String(find.error.message).split('\n')[0]);return;}
    const review=await runScript([path.join(root,'scripts','review-promises.mjs'),'--auto'],10*60_000);
    if(review.error){console.error('Automatic promise verdicts failed:',String(review.error.message).split('\n')[0]);return;}
    const build=await runScript([path.join(root,'scripts','build-promises.mjs')],15*60_000);
    if(build.error)console.error('Promises rebuild failed:',String(build.error.message).split('\n')[0]);
    else console.log(`Promises updated. ${lastLine(review)}`);
    await fs.writeFile(PROMISES_STAMP,JSON.stringify({at:new Date().toISOString()}));
  }finally{promisesRunning=false;}
}
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. If Public Ledger is already running, open http://127.0.0.1:${port}. Otherwise choose another PORT in .dev.vars.`:error.message);db.close();process.exit(1);});
server.listen(port,'127.0.0.1',()=>{
  console.log(`Public Ledger is ready at http://127.0.0.1:${port}\nOfficial records refresh while this process is running. Stop with Ctrl+C.`);
  if(process.env.LOCAL_AUTORUN!=='false'){void tick();timer=setInterval(tick,60_000);buildNews();newsTimer=setInterval(()=>{buildNews();checkLinks();updateConflicts();updatePromises();},60*60_000);setTimeout(checkLinks,5*60_000);setTimeout(updateConflicts,10*60_000);setTimeout(updatePromises,20*60_000);}
});
process.on('SIGINT',()=>{clearInterval(timer);clearInterval(newsTimer);server.close(()=>{db.close();process.exit(0);});});
