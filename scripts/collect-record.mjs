// What every sitting member said on the floor, from the Congressional Record (started Nov. 25, 2026, toward 10 or more
// quotes, stances and promises for everyone; scripts/coverage.mjs). GovInfo's own public files, no key needed: the
// list of Record days (www.govinfo.gov/sitemap/CREC_<year>_sitemap.xml), each day's description of its pages
// (metadata/pkg/CREC-<day>/mods.xml: each page's title, chamber and the members speaking, by bioguide ID), and each
// page's text (content/pkg/CREC-<day>/html/<page>.htm). One request at a time per worker, with a pause between.
// Routine pages (prayers, tributes, "honoring", quorum calls: src/promise-finder.mjs ROUTINE) and the Daily Digest are
// skipped. From each speech it keeps the speaker's own words only (speakerText: their turns, without letters and
// articles they put in), and of those only the sentences that name one of a question's search phrases
// (data/question-search.json, as npm run statements:find reads them) or make a commitment ("I will", "I'll vote to",
// "we must pass": commitments), so the files hold only what tagging and the promise finder need.
// Writes data/record-statements/<id>.json in the shape of the refresh's export (data/collected-statements/), which
// npm run statements:find reads too: {about, person, name, built, counts, statements: [{date, source: "floor", where,
// title, url, sentences}]}, newest first. data/record-statements/_days.json records each day read, so a run picks up
// where the last left off; newest days first.
//   npm run record:collect                       every Record day of the 119th Congress (from 2025-01-03) not read yet
//   npm run record:collect -- --from 2023-01-03  further back
//   npm run record:collect -- --days 20          at most 20 days this run
// A 429 or 403 from GovInfo stops the run (what's read is saved); a timeout or 5xx is tried again, then the page skipped.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {recordText,speakerText,ROUTINE,commitments,surnameOf} from '../src/promise-finder.mjs';
import {searchTests,topicSentences} from './question-statements.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const DIR='data/record-statements',DAYS_FILE='data/record-statements/_days.json',FIRST_DAY='2025-01-03';
export const WORKERS=3,PAUSE=300,RETRY_WAITS=[10_000,60_000],TIMEOUT=60_000;
const AGENT={'User-Agent':'public-ledger-research'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const readIf=f=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));}catch{return null;}};
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'");

class Stop extends Error{}
async function get(url){
  for(let i=0;;i++){
    let r=null,err=null;
    try{r=await fetch(url,{headers:AGENT,signal:AbortSignal.timeout(TIMEOUT)});}catch(e){err=e;}
    if(r&&(r.status===429||r.status===403))throw new Stop(`GovInfo answered ${r.status} for ${url}: stopping here (what's read is saved)`);
    if(r&&r.status===404)return null;
    if(r?.ok)return r.text();
    if(i>=RETRY_WAITS.length)throw new Error(`${r?r.status:err?.message||'no answer'} ${url}`);
    await sleep(RETRY_WAITS[i]);
  }
}

// The Record days in a year, from GovInfo's sitemap: ["2025-11-20", …].
export const daysIn=xml=>[...new Set([...String(xml||'').matchAll(/CREC-(\d{4}-\d{2}-\d{2})</g)].map(m=>m[1]))].sort();
// A day's pages that someone speaks on: [{id, title, chamber, url, speakers: [bioguide]}], from its mods.xml.
export function speechPages(mods){
  const out=[];
  for(const part of String(mods||'').split(/<relatedItem type="constituent"/).slice(1)){
    const id=(/<accessId>([^<]+)</.exec(part)||[])[1];if(!id)continue;
    const cls=(/<granuleClass>([^<]+)</.exec(part)||[])[1]||'';if(/DIGEST/i.test(cls))continue;
    const speakers=[...new Set([...part.matchAll(/<congMember\b[^>]*\bbioGuideId="(\w+)"[^>]*\brole="SPEAKING"/g)].map(m=>m[1]))];if(!speakers.length)continue;
    const title=decode((/<searchTitle>([^<]+)</.exec(part)||/<title>([^<]+)</.exec(part)||[])[1]||'').replace(/;\s*Congressional Record\b.*$/i,'').trim();
    const url=(/displayLabel="HTML rendition">([^<]+)</.exec(part)||[])[1]||`https://www.govinfo.gov/content/pkg/${id.replace(/-pt\d.*$/,'')}/html/${id}.htm`;
    out.push({id,title,chamber:cls,url,speakers});
  }
  return out;
}
export const routine=title=>ROUTINE.test(String(title||'').trim());
// The sentences worth keeping from what one member said: those naming a question's phrases, and their commitments.
export function keptSentences(words,person,tests){
  const keep=new Map();
  for(const s of topicSentences(words,tests))keep.set(s.text,true);
  for(const c of commitments(words,surnameOf(person)))if(c.sentence&&c.sentence.length>=30&&c.sentence.length<=700)keep.set(c.sentence.trim(),true);
  return [...keep.keys()];
}
// Who's who by bioguide ID: everyone with a profile or a seat.
export function peopleByBioguide({research,senate,house}){
  const m=new Map(),list=x=>Array.isArray(x)?x:x?.members||x?.senators||[];
  for(const p of [...(research?.members||[]),...(research?.cands||[]),...list(senate),...list(house)])if(p?.bioguide&&p.id&&!m.has(p.bioguide))m.set(p.bioguide,{id:p.id,name:p.name,stateName:p.stateName||null});
  return m;
}

async function main(){
  const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
  const from=arg('--from',FIRST_DAY),maxDays=Number(arg('--days',Infinity)),today=new Date().toISOString().slice(0,10);
  const who=peopleByBioguide({research:readIf('public/research.json'),senate:readIf('public/senate.json'),house:readIf('public/house.json')});
  const tests=searchTests(readIf('data/question-search.json'));
  fs.mkdirSync(path.join(ROOT,DIR),{recursive:true});
  const done=readIf(DAYS_FILE)||{about:'The Record days npm run record:collect has read, with how many speeches it read and kept that day.',days:{}};
  const files=new Map(),load=id=>{if(!files.has(id))files.set(id,readIf(`${DIR}/${id}.json`)||{statements:[]});return files.get(id);};
  const touched=new Set();
  const save=()=>{
    for(const id of touched){const f=load(id),p=[...who.values()].find(x=>x.id===id);
      f.statements.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.url).localeCompare(String(b.url)));
      const out={about:'What this member said on the floor, from the Congressional Record: their own words only, and of those the sentences that name an alignment question\'s phrases or make a commitment. Written by npm run record:collect (scripts/collect-record.mjs).',
        person:id,name:p?.name||id,built:today,counts:{speeches:f.statements.length,sentences:f.statements.reduce((n,s)=>n+s.sentences.length,0)},statements:f.statements};
      fs.writeFileSync(path.join(ROOT,DIR,`${id}.json`),JSON.stringify(out,null,1)+'\n');}
    touched.clear();fs.writeFileSync(path.join(ROOT,DAYS_FILE),JSON.stringify(done,null,1)+'\n');
  };
  const years=[];for(let y=Number(today.slice(0,4));y>=Number(from.slice(0,4));y--)years.push(y);
  let days=[];for(const y of years)days.push(...daysIn(await get(`https://www.govinfo.gov/sitemap/CREC_${y}_sitemap.xml`)));
  days=days.filter(d=>d>=from&&d<=today&&!done.days[d]).sort().reverse().slice(0,maxDays);
  console.log(`${days.length} Record days to read, newest first (${who.size} members known by bioguide ID).`);
  let n=0;
  try{
    for(const day of days){
      const mods=await get(`https://www.govinfo.gov/metadata/pkg/CREC-${day}/mods.xml`);
      const pages=speechPages(mods).filter(p=>!routine(p.title)&&p.speakers.some(b=>who.has(b)));
      let read=0,kept=0,skipped=0;const queue=[...pages];
      const work=async()=>{for(let p=queue.shift();p;p=queue.shift()){
        let html;try{html=await get(p.url);}catch(e){if(e instanceof Stop)throw e;skipped++;continue;}
        await sleep(PAUSE);if(!html)continue;read++;
        const text=recordText(html);
        for(const b of p.speakers){const person=who.get(b);if(!person)continue;
          const sentences=keptSentences(speakerText(text,person),person,tests);if(!sentences.length)continue;
          const f=load(person.id);if(f.statements.some(s=>s.url===p.url))continue;
          f.statements.push({date:day,source:'floor',where:`Floor speech, Congressional Record: ${p.title}`.slice(0,200),title:p.title,url:p.url,sentences});touched.add(person.id);kept++;}
      }};
      await Promise.all(Array.from({length:WORKERS},work));
      if(skipped){console.log(`  ${day}: ${skipped} page(s) didn't answer; the day will be read again next run`);save();continue;}
      done.days[day]={pages:pages.length,read,kept};n++;
      if(n%5===0)save();
      console.log(`  ${day}: ${read} speeches read, ${kept} kept`);
    }
  }catch(e){save();console.log(e instanceof Stop?e.message:`Stopped: ${e.message}`);process.exitCode=e instanceof Stop?0:1;return;}
  save();
  console.log(`Read ${n} day(s). ${Object.keys(done.days).length} Record days read in all.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
