// The promise finder's run: every statement the refresh collected (floor speeches, press releases, Bluesky and Threads
// posts, YouTube titles), the commitments in them, the bill each is about and what the person then did on it
// (src/promise-finder.mjs). Writes the review queue, data/promise-queue.json; nothing counts on the site until it is
// reviewed with npm run promises:review. Run npm start at least once first, so the local database has the statements.
//   npm run promises:find                   read everything collected
//   npm run promises:find -- --speeches 500 read up to 500 new floor speeches in full this run (default 300)
//   npm run promises:find -- --no-voteview  only the roll calls saved in public/research.json
//   npm run promises:find -- --since 2020   only statements from 2020 on (default: config historyFrom)
// Floor speeches: the Record lists each speech's title and speakers; the finder reads in full (from GovInfo, with the
// Congress.gov key in .dev.vars) only the speeches whose title points to a bill the speaker voted on, keeps their text
// in .local/speeches/, and reads only the speaker's own words. Every roll call they cast comes from Voteview (free
// files, no key), as for npm run attendance:build.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {requestSource} from '../src/sources.mjs';
import {voteviewFiles,CAST} from '../src/voteview.mjs';
import {billKey} from '../public/grades.js';
import * as F from '../src/promise-finder.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const QUEUE=path.join(root,'data','promise-queue.json'),DECISIONS=path.join(root,'data','promise-decisions.json');
const SOURCES={'crec-day':'Floor speeches',press:'Press releases',bluesky:'Bluesky posts',threads:'Threads posts',youtube:'YouTube videos'};
const ABBR={hr:'H.R.',s:'S.',hjres:'H.J.Res.',sjres:'S.J.Res.',hres:'H.Res.',sres:'S.Res.',hconres:'H.Con.Res.',sconres:'S.Con.Res.'};
// How a bill key is written: "119-hr-1" -> "H.R. 1".
export const measureOf=key=>{const m=/^(\d+)-([a-z]+)-(\d+)$/.exec(String(key||''));return m&&ABBR[m[2]]?`${ABBR[m[2]]} ${m[3]}`:'';};
const titleCase=s=>String(s||'').toLowerCase().replace(/\b([a-z])/g,c=>c.toUpperCase()).replace(/\b(Of|And|The|For|To|In|On|A|An|By|With)\b/g,w=>w.toLowerCase()).replace(/^./,c=>c.toUpperCase());

// One collected record as a statement: {person, source, title, text, date, url, srcTitle}. A floor speech has no text
// yet (only its title); it is read later if its title points to a bill. Records without a date or words are left out.
export function statementsOf(kind,subject,r){
  if(!r||!/^\d{4}-\d{2}-\d{2}/.test(String(r.date||''))||!r.url)return [];
  const one=(text,title,srcTitle)=>text?[{person:subject,source:kind,title:title||null,text,date:r.date.slice(0,10),url:r.url,srcTitle}]:[];
  if(kind==='press')return one([r.title,r.summary].filter(Boolean).join('. '),r.title,`Press release: ${String(r.title||'').slice(0,120)}`);
  if(kind==='bluesky')return one(r.text,null,`Bluesky post (@${r.handle})`);
  if(kind==='threads')return one(r.text,null,`Threads post (@${r.user})`);
  if(kind==='youtube')return one(r.title,r.title,`YouTube video: ${String(r.title||'').slice(0,120)}`);
  if(kind==='crec-day')return (r.people||[]).map(person=>({person,source:'floor',title:titleCase(r.title),text:null,granule:r.id,date:r.date.slice(0,10),url:r.url,
    srcTitle:`Congressional Record, ${new Date(r.date.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})}: ${titleCase(r.title).slice(0,100)}`}));
  return [];
}
// Every roll call one chamber held in a Congress, from Voteview, as each tracked person's actions; roll calls already
// saved in research.json are left to those (their titles and summaries are fuller). people: [{id, bioguide}].
export function voteviewActs(files,chamber,congress,people,saved=[]){
  const ours=new Map(),out=new Map(),docs=[],titles=[];
  for(const m of files.members)if(m.bioguide_id&&!/president/i.test(m.chamber||'')){const p=people.find(x=>x.bioguide===m.bioguide_id);if(p)ours.set(String(m.icpsr),p.id);}
  const have=new Set(saved.filter(v=>v.chamber===chamber&&v.congress===congress).map(v=>`${v.session}-${v.number}`));
  const rolls=new Map();
  for(const r of files.rollcalls){
    const date=String(r.date||'').slice(0,10),session=Number(r.session)||(Number(date.slice(0,4))%2?1:2),number=Number(r.clerk_rollnumber||r.rollnumber);
    if(!date||have.has(`${session}-${number}`))continue;
    const b=/^(HR|S|HJRES|SJRES|HCONRES|SCONRES|HRES|SRES)(\d+)$/i.exec(String(r.bill_number||'').replace(/[\s.]/g,''));
    const key=b?billKey(congress,b[1]+b[2]):`roll:${chamber}${congress}-${r.rollnumber}`;
    const what=String(r.vote_desc||r.dtl_desc||'').trim();
    rolls.set(String(r.rollnumber),{key,date,question:String(r.vote_question||'').trim(),what:what.slice(0,200),measure:measureOf(key),chamber,congress,session,number,
      url:chamber==='S'?`https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${String(number).padStart(5,'0')}.htm`:`https://clerk.house.gov/Votes/${date.slice(0,4)}${number}`});
    docs.push({key,text:`${r.vote_desc||''} ${r.dtl_desc||''}`});
    // A House roll call's description is often the bill's short title ("Laken Riley Act").
    if(b&&/\bAct\b/.test(what)&&what.split(/\s+/).length<=12)titles.push({key,title:what});
  }
  for(const v of files.votes){
    const id=ours.get(String(v.icpsr)),r=id&&rolls.get(String(v.rollnumber)),cast=CAST[Number(v.cast_code)];
    if(!r||!cast)continue;(out.get(id)||out.set(id,[]).get(id)).push({kind:'vote',...r,vote:cast});
  }
  return {acts:out,docs,titles};
}
// Texts that tell what a bill is about, from public/research.json: the reasons groups gave for their positions on it.
const reasons=b=>[...(b.groups||[]),...(b.sides||[])].map(g=>g.why).filter(Boolean).join(' ')+' '+(b.gains?.why||'');

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=(name,d)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:d;};
  const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  const config=read('data/config.json'),research=read('public/research.json');
  const since=Number(arg('--since',config.historyFrom||2016)),maxSpeeches=Number(arg('--speeches',300)),env=process.env;
  // --db and --out: another database and queue file (the tests use them).
  const dbFile=path.resolve(arg('--db',path.join(root,'.local','records.sqlite'))),queueFile=path.resolve(arg('--out',QUEUE));
  if(!fs.existsSync(dbFile)){console.log('No local database yet (.local/records.sqlite). Run npm start once (it collects the statements), then run this again.');process.exit(1);}
  const db=new DatabaseSync(dbFile,{readOnly:true});
  const records=kinds=>db.prepare(`SELECT j.kind,j.subject,r.payload FROM jobs j JOIN records r ON r.run_id=j.published_run WHERE j.kind IN (${kinds.map(()=>'?').join(',')})`).all(...kinds).map(x=>({...x,r:JSON.parse(x.payload)}));
  const researchPeople=[...research.members,...research.cands,...(research.featured||[])];
  const personOf=new Map([...config.people.map(p=>[p.id,{...p}])]);
  for(const p of researchPeople){const o=personOf.get(p.id)||{};personOf.set(p.id,{...p,...o,stateName:p.stateName||o.stateName,bioguide:o.bioguide||p.bioguide,statements:p.statements||[],bills:p.bills||[]});}

  // The statements.
  const statements=[];const bySource={};
  for(const {kind,subject,r} of records(Object.keys(SOURCES)))for(const s of statementsOf(kind,subject,r))
    if(personOf.has(s.person)&&Number(s.date.slice(0,4))>=since){statements.push(s);bySource[s.source]=(bySource[s.source]||0)+1;}
  // The same post or release can be in several runs' records: once each.
  const seen=new Set(),unique=statements.filter(s=>{const k=`${s.person}|${s.url}`;if(seen.has(k))return false;seen.add(k);return true;});
  console.log(`Statements collected from ${since} on: ${Object.entries(bySource).map(([k,n])=>`${k==='floor'?'floor speeches':k} ${n.toLocaleString()}`).join(', ')||'none'}.`);
  if(!unique.length){console.log('Nothing to read yet: run npm start and let the refresh collect statements first.');process.exit(1);}

  // What they did: every roll call they cast, the bills they sponsored and cosponsored.
  const saved=F.savedVotes(research),acts=new Map(),docs=saved.map(v=>({key:v.key,text:v.text})),titles=saved.map(v=>({key:v.key,title:v.what}));
  const add=(id,a)=>(acts.get(id)||acts.set(id,[]).get(id)).push(a);
  const speakers=[...new Set(unique.map(s=>s.person))].map(id=>personOf.get(id));
  for(const p of speakers)for(const a of F.votesOf(p.id,saved))add(p.id,a);
  const first=F.congressOn(unique.reduce((m,s)=>s.date<m?s.date:m,'9999')),last=F.congressOn(new Date().toISOString());
  if(!process.argv.includes('--no-voteview')){
    const bio=speakers.filter(p=>p.bioguide);
    for(let c=Math.max(first,F.congressOn(`${since}-06-01`));c<=last;c++)for(const ch of ['S','H']){
      try{const v=voteviewActs(await voteviewFiles(c,{},ch),ch,c,bio,saved);for(const [id,l] of v.acts)for(const a of l)add(id,a);docs.push(...v.docs);titles.push(...v.titles);
        console.log(`  Voteview ${ch==='S'?'Senate':'House'} ${c}th Congress: read`);}
      catch(e){console.log(`  Voteview ${ch==='S'?'Senate':'House'} ${c}th Congress: couldn't read (${e.message}); only the saved roll calls for it`);}
    }
  }
  for(const {subject,r} of records(['cosponsored']))if(r.bill&&r.date){add(subject,{kind:'cosponsored',key:r.bill,date:r.date,what:r.title,measure:measureOf(r.bill),url:r.source});titles.push({key:r.bill,title:r.title});}
  for(const p of speakers)for(const b of p.bills||[]){const key=billKey(b.congress,b.num);if(key&&b.date){add(p.id,{kind:'sponsored',key,date:b.date,what:b.title,measure:b.num,url:b.url});titles.push({key,title:b.title});}}
  for(const l of acts.values())l.sort((a,b)=>a.date.localeCompare(b.date));
  // What each bill is about: titles, summaries, the reasons groups gave, and the CRS reports on it.
  for(const b of [...research.billIndex,...research.bills]){titles.push({key:b.id,title:b.title});docs.push({key:b.id,text:`${b.title} ${reasons(b)}`});}
  for(const {subject,r} of records(['bill']))if(r.id==='detail'||r.id==='summary')docs.push({key:subject,text:`${r.title||''} ${r.summary||''}`});
  for(const {r} of records(['crs']))for(const b of r.bills||[])docs.push({key:b,text:r.title});
  const names=F.billNames(titles),index=F.subjectIndex(docs);
  const titleOf=new Map();for(const t of titles)if(t.title&&!titleOf.has(t.key))titleOf.set(t.key,String(t.title).replace(/\s*\((?:House|Senate|final|\d{4}).*?\)\s*$/i,''));

  // Floor speeches: read in full the ones whose title points to a bill the speaker voted on.
  const cache=path.join(path.dirname(dbFile),'speeches');fs.mkdirSync(cache,{recursive:true});
  const pointsToBill=s=>{const mine=acts.get(s.person)||[],named=F.actsAfter(mine,s.date,F.NAMED_DAYS);
    if(F.namedBills(s.title,s.date,names).some(k=>named.some(a=>a.key===k)))return 10;
    const title=F.prepare(s.title);
    return Math.max(0,...[...new Set(F.actsAfter(mine,s.date,F.CONTEXT_DAYS).map(a=>a.key))].map(k=>{const f=F.subjectFit(title,k,index);return f.anchor&&f.score>=F.MIN_SUBJECT?f.score:0;}));};
  const speeches=unique.filter(s=>s.source==='floor'&&!F.ROUTINE.test(s.title)).map(s=>({s,score:pointsToBill(s)})).filter(x=>x.score>0).sort((a,b)=>b.s.date.localeCompare(a.s.date));
  let fetched=0,cached=0,noTurns=0,stopped=null;
  const key=env.GOVINFO_API_KEY||env.CONGRESS_API_KEY;
  for(const {s} of speeches){
    const file=path.join(cache,`${s.granule.replace(/[^\w.-]/g,'_')}.txt`);let text=null;
    if(fs.existsSync(file)){text=fs.readFileSync(file,'utf8');cached++;}
    else if(key&&!stopped&&fetched<maxSpeeches){
      try{text=F.recordText(await requestSource(`https://api.govinfo.gov/packages/${s.granule.slice(0,15)}/granules/${s.granule}/htm`,env,{as:'text'}));fs.writeFileSync(file,text);fetched++;}
      // A page GovInfo doesn't have is kept as empty, so it isn't asked for again.
      catch(e){if(e.statusCode===404){text='';fs.writeFileSync(file,'');}else if(e.statusCode===429)stopped='GovInfo asked to slow down (HTTP 429)';else stopped=e.message;}
    }
    if(text!=null){s.text=text?F.speakerText(text,personOf.get(s.person)):'';if(text&&!s.text)noTurns++;}
  }
  const waiting=speeches.filter(x=>x.s.text==null).length;
  console.log(`Floor speeches about a bill the speaker voted on: ${speeches.length.toLocaleString()} (read before ${cached}, read now ${fetched}${waiting?`, still to read ${waiting} (next run${key?'':': needs CONGRESS_API_KEY in .dev.vars'})`:''}${noTurns?`; ${noTurns} where the speaker's own words couldn't be told apart`:''}).${stopped?` Stopped reading: ${stopped}.`:''}`);

  // Commitments, linked to bills and actions.
  const found=[];let commitments=0;
  for(const s of unique){if(!s.text)continue;const p=personOf.get(s.person),surname=F.surnameOf(p);
    commitments+=F.commitments(s.text,surname).length;found.push(...F.linkStatement(s,{acts:acts.get(s.person)||[],names,index,surname}));}
  const decisionsFile=path.resolve(arg('--decisions',DECISIONS)),decisions=fs.existsSync(decisionsFile)?JSON.parse(fs.readFileSync(decisionsFile,'utf8')):{};
  const grouped=F.groupFindings(found);
  const onFile=grouped.filter(x=>F.checkedBills(personOf.get(x.person),saved).has(x.bill)),decided=grouped.filter(x=>decisions[x.id]&&!onFile.includes(x));
  const items=grouped.filter(x=>!onFile.includes(x)&&!decided.includes(x)).map(x=>({...x,name:personOf.get(x.person)?.name||x.person,measure:measureOf(x.bill),title:titleOf.get(x.bill)||'',did:x.did.slice(-8)}))
    .sort((a,b)=>b.said.date.localeCompare(a.said.date));
  const tally=(l,f)=>l.reduce((o,x)=>{const k=f(x);o[k]=(o[k]||0)+1;return o;},{});
  fs.writeFileSync(queueFile,JSON.stringify({about:'Commitments found in collected statements, linked to the bill each is about and what the person did on it, waiting for review (npm run promises:review). Nothing here counts on the site until it is reviewed. From scripts/find-promises.mjs.',
    built:new Date().toISOString().slice(0,10),since,counts:{statements:unique.length,commitments,linked:grouped.length,onFile:onFile.length,decided:decided.length,queued:items.length},items},null,1)+'\n');
  console.log(`\nCommitments found: ${commitments.toLocaleString()}. Linked to a bill they then acted on: ${grouped.length} (by name ${grouped.filter(x=>x.link.how==='named').length}, by subject ${grouped.filter(x=>x.link.how==='subject').length}); already reviewed on the site ${onFile.length}; decided before ${decided.length}.`);
  console.log(`Wrote ${queueFile.startsWith(root)?path.relative(root,queueFile):queueFile}: ${items.length} to review. Draft verdicts: ${Object.entries(tally(items,x=>x.draft.label)).map(([k,n])=>`${k} ${n}`).join(', ')||'none'}.`);
  for(const x of items.slice(0,8))console.log(`\n  ${x.name}, ${x.said.date} (${x.said.source}): "${x.said.text.slice(0,180)}"\n    → ${x.measure||x.bill}${x.title?` ${x.title}`:''} [${x.link.how==='named'?'named':`subject: ${(x.link.words||[]).slice(0,4).join(', ')}`}] · draft: ${x.draft.label} (${x.draft.why})${x.flags.length?`\n    check: ${x.flags.join(', ')}`:''}`);
  console.log('\nNext: npm run promises:review (or npm run promises:review -- --list to only print them).');
}
