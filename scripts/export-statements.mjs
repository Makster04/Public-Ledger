// What the reviewed profiles said that the local refresh collected (floor speeches, press releases, Bluesky and Threads
// posts, in .local/records.sqlite), exported so it can be tagged to the alignment questions in a session that doesn't
// have the local database (scripts/question-statements.mjs reads the export alongside the campaign text).
//   npm run statements:export                  everyone with a profile, from config historyFrom on
//   npm run statements:export -- --read 500    read up to 500 more floor speeches in full this run (default 200)
//   npm run statements:export -- --since 2020  only statements from 2020 on
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

async function main(){
  const arg=(name,d)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:d;};
  const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  const config=read('data/config.json'),research=read('public/research.json'),searches=read('data/question-search.json');
  const since=Number(arg('--since',config.historyFrom||2016)),maxRead=Number(arg('--read',200)),env=process.env;
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

  // Floor speeches: the speaker's own words, from the saved text or read now (newest first).
  fs.mkdirSync(cache,{recursive:true});
  const key=env.GOVINFO_API_KEY||env.CONGRESS_API_KEY;let fetched=0,stopped=null,waiting=0;
  const floor=all.filter(s=>s.source==='floor').sort((a,b)=>b.date.localeCompare(a.date)),pages=new Map();
  for(const s of floor){
    if(ROUTINE.test(s.title||'')){s.text='';continue;}
    const file=path.join(cache,`${String(s.granule).replace(/[^\w.-]/g,'_')}.txt`);
    if(!pages.has(s.granule)){
      if(fs.existsSync(file))pages.set(s.granule,fs.readFileSync(file,'utf8'));
      else if(key&&!stopped&&fetched<maxRead){
        try{const t=recordText(await requestSource(`https://api.govinfo.gov/packages/${s.granule.slice(0,15)}/granules/${s.granule}/htm`,env,{as:'text'}));fs.writeFileSync(file,t);pages.set(s.granule,t);fetched++;await sleep(400);}
        // A page GovInfo doesn't have is kept as empty, so it isn't asked for again.
        catch(e){if(e.statusCode===404){fs.writeFileSync(file,'');pages.set(s.granule,'');}else stopped=e.statusCode===429?'GovInfo asked to slow down (HTTP 429)':e.message;}
      }
    }
    const t=pages.get(s.granule);if(t==null){waiting++;s.text='';continue;}
    s.text=t?speakerText(t,people.get(s.person)):'';
  }

  const out=exportStatements(all,searchTests(searches)),built=new Date().toISOString().slice(0,10);
  fs.mkdirSync(outDir,{recursive:true});let files=0,n=0,bytes=0;
  for(const [id,x] of Object.entries(out)){
    if(!x.statements.length)continue;
    const body=JSON.stringify({about:'What this person said that the local refresh collected (floor speeches in their own words, press releases, Bluesky and Threads posts), keeping only the sentences that name an alignment question\'s search phrases, for tagging to the questions (data/question-statements.json). From scripts/export-statements.mjs.',
      person:id,name:people.get(id)?.name||id,built,since,counts:x.counts,statements:x.statements},null,1)+'\n';
    fs.writeFileSync(path.join(outDir,`${id}.json`),body);files++;n+=x.statements.length;bytes+=body.length;
  }
  const by={};for(const s of all)by[s.source]=(by[s.source]||0)+1;
  console.log(`Collected from ${since} on: ${Object.entries(by).map(([k,v])=>`${k==='floor'?'floor speeches':k==='press'?'press releases':`${k} posts`} ${v.toLocaleString()}`).join(', ')||'nothing yet'}.`);
  console.log(`Floor speeches read now: ${fetched}${waiting?`; ${waiting} still to read (run again${key?'':': needs CONGRESS_API_KEY in .dev.vars'})`:''}.${stopped?` Stopped reading: ${stopped}.`:''}`);
  console.log(`Wrote ${n.toLocaleString()} statements on the questions' topics for ${files} people to ${path.relative(root,outDir)||outDir} (${Math.round(bytes/1024).toLocaleString()} KB).`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exit(1);});
