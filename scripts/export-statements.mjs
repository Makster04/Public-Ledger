// What the reviewed profiles said that the local refresh collected (floor speeches, press releases, Bluesky and Threads
// posts, in .local/records.sqlite), exported so it can be tagged to the alignment questions in a session that doesn't
// have the local database (scripts/question-statements.mjs reads the export alongside the campaign text).
//   npm run statements:export                  everyone with a profile, from config historyFrom on
//   npm run statements:export -- --read 500    read up to 500 more floor speeches in full this run (default 200)
//   npm run statements:export -- --since 2020  only statements from 2020 on
//   npm run statements:export -- --read 4000 --wait
//                                              when GovInfo says to slow down (about 1,000 reads an hour), save what's
//                                              read so far, wait an hour (or as long as GovInfo says) and go on, until
//                                              4,000 are read or none are left; without --wait the run stops there.
//                                              A page that times out is tried again and then skipped (read next run).
// Writes data/collected-statements/<id>.json: {about, person, name, built, since, counts, statements: [{date, source,
// where, url, sentences}]}, newest first. Only the sentences that name one of a question's search phrases are kept
// (data/question-search.json "any" and "said", without the "not" ones; scripts/question-statements.mjs topicSentences),
// so the files stay small and hold only what tagging needs; a statement with none is left out.
// Floor speeches: the Record lists each speech's title and speakers; the speaker's own words are read from the text the
// promise finder already saved (.local/speeches/), and up to --read more speeches are read from GovInfo with the
// Congress.gov key in .dev.vars, newest first, a page at a time with a pause between. Routine Record items (prayers,
// tributes, quorum calls) are skipped. YouTube is left out: no video or audio for now.
// --db, --out (a directory) and --speeches (the speech cache) point it elsewhere (the tests use them).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {requestSource} from '../src/sources.mjs';
import {statementsOf} from './find-promises.mjs';
import {recordText,speakerText,ROUTINE} from '../src/promise-finder.mjs';
import {searchTests,topicSentences} from './question-statements.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const KINDS=['crec-day','press','bluesky','threads'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const HOUR=60*60_000,MAX_PAUSES=24;
// A page that times out or fails on GovInfo's side (a 5xx, or no answer) is asked for again after these waits; one that
// still fails is skipped and read on the next run. This many skipped in a row means GovInfo isn't answering: with --wait
// the reading pauses (an hour) and goes on, without it it stops.
export const RETRY_WAITS=[15_000,60_000,300_000],MAX_SKIPPED=5,PAGE_TIMEOUT=60_000;
const passing=e=>e?.name==='TimeoutError'||e?.name==='AbortError'||/timeout|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket/i.test(String(e?.message||e?.cause?.code||''))||(e?.statusCode>=500&&e?.statusCode<600);
// Where a statement was said, as the tagged statement shows it.
export const whereOf=s=>s.source==='floor'?`Floor speech, Congressional Record: ${s.title||''}`.trim():s.source==='press'?`Press release: ${String(s.title||'').slice(0,140)}`:
  s.source==='threads'?'Threads post':'Bluesky post';
// The statements of each person, with their kept sentences: {person id: {counts, statements}}. statements: from
// statementsOf, with each floor speech's text (the speaker's own words) filled in or null; tests: searchTests.
export function exportStatements(statements,tests){
  const out={},seen=new Set();
  for(const s of statements){
    const key=`${s.person}|${s.url}|${s.granule||''}`;if(seen.has(key))continue;seen.add(key);
    const p=out[s.person]||(out[s.person]={counts:{floor:0,press:0,bluesky:0,threads:0},statements:[]});
    const kept=topicSentences(s.text,tests).map(x=>x.text);if(!kept.length)continue;
    p.counts[s.source]=(p.counts[s.source]||0)+1;
    p.statements.push({date:s.date,source:s.source,where:whereOf(s),url:s.url,sentences:[...new Set(kept)]});
  }
  for(const p of Object.values(out))p.statements.sort((a,b)=>b.date.localeCompare(a.date)||a.url.localeCompare(b.url));
  return out;
}

// Floor speeches in the speaker's own words (s.text): from the saved Record pages in cache, else read from GovInfo, newest
// first, up to maxRead this run, with a pause of gap between reads. A "slow down" (HTTP 429) ends the reading, or with
// wait pauses for as long as GovInfo asks (an hour when it doesn't say, at most MAX_PAUSES times) and reading goes on;
// onPause(ms, fetched) runs first, so what's read so far can be saved. A page that times out or fails on GovInfo's side is
// tried again (RETRY_WAITS) and then skipped for this run; MAX_SKIPPED skipped in a row is treated like a slow-down. A
// page GovInfo doesn't have is kept as empty, so it isn't asked for again. people: profile id -> {name, stateName}.
// Returns {fetched, waiting, stopped, pauses, skipped}.
export async function readSpeeches(floor,{cache,key,env,people,maxRead,wait=false,pause=sleep,onPause=null,gap=400}){
  const fileOf=g=>path.join(cache,`${String(g).replace(/[^\w.-]/g,'_')}.txt`);
  const fill=s=>{const f=fileOf(s.granule);s.text=fs.existsSync(f)?speakerText(fs.readFileSync(f,'utf8'),people.get(s.person))||'':null;};
  const missing=[];
  for(const s of floor){if(ROUTINE.test(s.title||'')){s.text='';continue;}fill(s);if(s.text==null&&!missing.includes(s.granule))missing.push(s.granule);}
  let fetched=0,stopped=null,pauses=0,skipped=0,inARow=0;
  const slowDown=async ms=>{if(!wait||pauses>=MAX_PAUSES)return false;pauses++;if(onPause)await onPause(ms,fetched);await pause(ms);return true;};
  for(const g of missing){
    if(!key||fetched>=maxRead)break;
    let tries=0;
    for(;;){
      try{fs.writeFileSync(fileOf(g),recordText(await requestSource(`https://api.govinfo.gov/packages/${g.slice(0,15)}/granules/${g}/htm`,env,{as:'text',timeout:PAGE_TIMEOUT})));fetched++;inARow=0;await pause(gap);break;}
      catch(e){
        if(e.statusCode===404){fs.writeFileSync(fileOf(g),'');inARow=0;break;}
        if(e.statusCode===429){if(await slowDown(e.retryAfter>0?e.retryAfter:HOUR))continue;stopped='GovInfo asked to slow down (HTTP 429)';break;}
        if(!passing(e)){stopped=e.message;break;}
        if(tries<RETRY_WAITS.length){await pause(RETRY_WAITS[tries++]);continue;}
        // Still failing: skip it for this run, unless GovInfo has stopped answering altogether.
        skipped++;inARow++;
        if(inARow>=MAX_SKIPPED){if(await slowDown(HOUR)){skipped--;inARow=0;tries=0;continue;}stopped=`GovInfo stopped answering (${inARow} pages in a row timed out or failed: ${e.message})`;}
        break;
      }
    }
    if(stopped)break;
    for(const s of floor)if(s.granule===g)fill(s);
  }
  return {fetched,waiting:floor.filter(s=>s.text==null).length,stopped,pauses,skipped};
}

async function main(){
  const arg=(name,d)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:d;};
  const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  const config=read('data/config.json'),research=read('public/research.json'),searches=read('data/question-search.json');
  const since=Number(arg('--since',config.historyFrom||2016)),maxRead=Number(arg('--read',200)),wait=process.argv.includes('--wait'),env=process.env;
  const dbFile=path.resolve(arg('--db',path.join(root,'.local','records.sqlite')));
  const outDir=path.resolve(arg('--out',path.join(root,'data','collected-statements'))),cache=path.resolve(arg('--speeches',path.join(path.dirname(dbFile),'speeches')));
  if(!fs.existsSync(dbFile)){console.log('No local database yet (.local/records.sqlite). Run npm start once (it collects the statements), then run this again.');process.exit(1);}
  const people=new Map();
  for(const p of config.people||[])people.set(p.id,{...p});
  const profiled=[...research.members,...(research.cands||[]),...(research.featured||[])];
  for(const p of profiled)people.set(p.id,{...(people.get(p.id)||{}),...p,stateName:p.stateName||people.get(p.id)?.stateName});
  const ids=new Set(profiled.map(p=>p.id));
  const db=new DatabaseSync(dbFile,{readOnly:true});
  const rows=db.prepare(`SELECT j.kind,j.subject,r.payload FROM jobs j JOIN records r ON r.run_id=j.published_run WHERE j.kind IN (${KINDS.map(()=>'?').join(',')})`).all(...KINDS);
  db.close();
  const all=rows.flatMap(x=>statementsOf(x.kind,x.subject,JSON.parse(x.payload))).filter(s=>ids.has(s.person)&&Number(s.date.slice(0,4))>=since);

  // What's been read so far, written out: each person's statements with their kept sentences.
  const built=new Date().toISOString().slice(0,10),tests=searchTests(searches);
  const write=()=>{
    const out=exportStatements(all.map(s=>({...s,text:s.text??''})),tests);fs.mkdirSync(outDir,{recursive:true});let files=0,n=0,bytes=0;
    for(const [id,x] of Object.entries(out)){
      if(!x.statements.length)continue;
      const body=JSON.stringify({about:'What this person said that the local refresh collected (floor speeches in their own words, press releases, Bluesky and Threads posts), keeping only the sentences that name an alignment question\'s search phrases, for tagging to the questions (data/question-statements.json). From scripts/export-statements.mjs.',
        person:id,name:people.get(id)?.name||id,built,since,counts:x.counts,statements:x.statements},null,1)+'\n';
      fs.writeFileSync(path.join(outDir,`${id}.json`),body);files++;n+=x.statements.length;bytes+=body.length;
    }
    return {files,n,bytes};
  };
  // Floor speeches: the speaker's own words, from the saved text or read now (newest first).
  fs.mkdirSync(cache,{recursive:true});
  const key=env.GOVINFO_API_KEY||env.CONGRESS_API_KEY;
  const floor=all.filter(s=>s.source==='floor').sort((a,b)=>b.date.localeCompare(a.date));
  const onPause=(ms,fetched)=>{const w=write(),until=new Date(Date.now()+ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    console.log(`GovInfo asked to slow down or stopped answering after ${fetched.toLocaleString()} read this run. Saved ${w.n.toLocaleString()} statements so far; going on at ${until}.`);};
  const {fetched,waiting,stopped,pauses,skipped}=await readSpeeches(floor,{cache,key,env,people,maxRead,wait,onPause});
  const {files,n,bytes}=write();
  const by={};for(const s of all)by[s.source]=(by[s.source]||0)+1;
  console.log(`Collected from ${since} on: ${Object.entries(by).map(([k,v])=>`${k==='floor'?'floor speeches':k==='press'?'press releases':`${k} posts`} ${v.toLocaleString()}`).join(', ')||'nothing yet'}.`);
  console.log(`Floor speeches read now: ${fetched.toLocaleString()}${pauses?` (after ${pauses} pause${pauses===1?'':'s'})`:''}${skipped?`; ${skipped.toLocaleString()} skipped because GovInfo didn't answer (read next run)`:''}${waiting?`; ${waiting.toLocaleString()} still to read (run again${key?'':': needs CONGRESS_API_KEY in .dev.vars'})`:'; none left to read'}.${stopped?` Stopped reading: ${stopped}.`:''}`);
  console.log(`Wrote ${n.toLocaleString()} statements on the questions' topics for ${files} people to ${path.relative(root,outDir)||outDir} (${Math.round(bytes/1024).toLocaleString()} KB).`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exit(1);});
