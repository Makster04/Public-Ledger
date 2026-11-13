// What politicians said, tagged to the alignment questions (public/questions.json) with the side it takes and its date.
//
// The statements come from what they told voters in each campaign (data/campaign-text/<id>.json: their campaign
// website's pages saved by the Wayback Machine, and their campaign-season Bluesky and Threads posts) and from the
// reviewed statements in public/research.json. Each one is tagged by hand in data/question-statements.json:
//   {person id: {question id: [[side index, "the quote", "YYYY-MM-DD", "link", "where it was said"], ...]}}
// A tag is only made when the words clearly take one side of the question; a statement that only explains a vote
// isn't a separate position, and anything unclear is left out. At most one statement per question per campaign (the
// clearest one), so a position repeated across a site's pages counts once; a later campaign that says it again is a new
// statement with its own date. Each counts 3 points (public/question-scores.js), cancelled when a later vote on the
// question went the other way. The same words on several pages count once, at the latest date they were seen.
//
//   npm run statements:find                      candidates for everyone with campaign text
//   npm run statements:find -- ossoff collins    just these people
// writes .local/statement-candidates/<id>.json: each sentence that names one of a question's search phrases
// (data/question-search.json "any", plus its "said" phrases for how people talk about it), once per wording, with the
// dates and links it was found at, and the questions it may be about. --print lists them compactly.
//   npm run statements:record
// checks data/question-statements.json (known people and questions, a side, a quote, a date and a link) and writes
// public/question-statements.json for the site.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sentences} from '../src/promise-finder.mjs';
import {phraseRe} from './question-bills.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const lower=s=>String(s||'').toLowerCase();
const norm=s=>lower(s).replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();

// Every page and post in one person's campaign text: [{text, date, url, where}].
export function campaignDocs(c){
  const out=[];
  for(const k of c?.campaigns||[]){
    for(const p of k.pages||[])if(p.text)out.push({text:p.text,date:p.date||k.capture?.date||k.electionDay,url:p.url,where:`Campaign website, ${k.year}${p.title?`: ${p.title}`:''}`,year:k.year});
    for(const p of k.posts||[])if(p.text)out.push({text:p.text,date:p.date,url:p.url,where:`${p.source==='threads'?'Threads':'Bluesky'} post, ${k.year} campaign`,year:k.year});
  }
  return out;
}
// The sentences of a person's documents that name a question's phrases, once per wording: [{text, questions, seen:
// [{date, url, where, year}]}], newest sighting first.
export function statementCandidates(docs,searches){
  const tests=Object.entries(searches).map(([q,s])=>({q,re:[...(s.any||[]),...(s.said||[])].map(phraseRe),not:(s.not||[]).map(phraseRe)}));
  const by=new Map();
  for(const d of docs)for(const line of String(d.text).split(/\n+/))for(const sen of sentences(line)){
    if(sen.length<30||sen.length>700)continue;const t=lower(sen);
    const qs=tests.filter(x=>x.re.some(r=>r.test(t))&&!x.not.some(r=>r.test(t))).map(x=>x.q);if(!qs.length)continue;
    const k=norm(sen),c=by.get(k)||by.set(k,{text:sen.trim(),questions:qs,seen:[]}).get(k);
    if(!c.seen.some(s=>s.url===d.url))c.seen.push({date:d.date,url:d.url,where:d.where,year:d.year});
  }
  const out=[...by.values()];for(const c of out)c.seen.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return out;
}
// The campaign a statement belongs to: the year its source names ("Campaign website, 2020", "Bluesky post, 2026
// campaign"), else the year it was said.
export const campaignOf=(where,date)=>/\b(?:19|20)\d{2}\b/.exec(String(where||''))?.[0]||String(date||'').slice(0,4);
// The coded statements, checked: problems as text, and the site's copy {person: {question: [[side, date, quote, link,
// where]]}}.
export function checkStatements(coded,{people,questions}){
  const problems=[],out={},qs=new Map(questions.map(q=>[q.id,q]));
  for(const [pid,byQ] of Object.entries(coded)){
    if(pid==='about')continue;if(!people.has(pid)){problems.push(`unknown person ${pid}`);continue;}
    for(const [qid,list] of Object.entries(byQ)){
      if(!qs.has(qid)){problems.push(`${pid}: unknown question ${qid}`);continue;}
      const years=new Set();
      for(const s of list){
        const [side,quote,date,url,where]=s;
        if(![0,1].includes(side))problems.push(`${pid} ${qid}: side must be 0 or 1`);
        if(!quote||String(quote).length<15)problems.push(`${pid} ${qid}: the quote is missing`);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))problems.push(`${pid} ${qid}: a date (YYYY-MM-DD) is needed`);
        if(!/^https?:\/\//.test(String(url)))problems.push(`${pid} ${qid}: a link is needed`);
        const y=campaignOf(where,date);if(years.has(y))problems.push(`${pid} ${qid}: two statements from the ${y} campaign`);years.add(y);
        ((out[pid]||={})[qid]||=[]).push([side,date,quote,url,where||null]);
      }
      out[pid]?.[qid]?.sort((a,b)=>String(b[1]).localeCompare(String(a[1])));
    }
  }
  return {problems,out};
}

function main(){
  const args=process.argv.slice(2),find=args.includes('--find'),print=args.includes('--print'),only=args.filter(a=>!a.startsWith('--'));
  const Q=read('public/questions.json').questions,R=read('public/research.json');
  const people=new Set([...R.members,...(R.cands||[]),...(R.featured||[])].map(p=>p.id));
  if(find){
    const searches=read('data/question-search.json');delete searches.about;
    const dir=path.join(ROOT,'.local','statement-candidates');fs.mkdirSync(dir,{recursive:true});
    const coded=fs.existsSync(path.join(ROOT,'data','question-statements.json'))?read('data/question-statements.json'):{};
    for(const f of fs.readdirSync(path.join(ROOT,'data','campaign-text')).filter(f=>f.endsWith('.json'))){
      const id=f.replace(/\.json$/,'');if(only.length&&!only.includes(id))continue;
      const c=read(`data/campaign-text/${f}`),cands=statementCandidates(campaignDocs(c),searches);
      if(!cands.length)continue;
      fs.writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({person:id,name:c.name,built:new Date().toISOString().slice(0,10),candidates:cands}));
      const done=Object.keys(coded[id]||{}).length;
      console.log(`${id}: ${cands.length} sentences on ${new Set(cands.flatMap(x=>x.questions)).size} questions${done?` (${done} questions tagged)`:''}`);
      if(print)for(const [i,x] of cands.entries())console.log(`  ${i} [${x.questions.join(',')}] ${x.seen.map(s=>s.year).filter((v,j,a)=>a.indexOf(v)===j).join('/')} ${x.text.slice(0,300)}`);
    }
    return;
  }
  const {problems,out}=checkStatements(read('data/question-statements.json'),{people,questions:Q});
  if(problems.length){console.error(problems.join('\n'));process.exit(1);}
  const n=Object.values(out).reduce((t,b)=>t+Object.values(b).reduce((u,l)=>u+l.length,0),0);
  fs.writeFileSync(path.join(ROOT,'public','question-statements.json'),JSON.stringify({about:'What each reviewed profile said, tagged to the alignment questions: {person id: {question id: [[side index, date, quote, link, where it was said]]}}, newest first. Each counts 3 points toward its side unless a later vote on the question went the other way (public/question-scores.js). Tagged by hand in data/question-statements.json; written by scripts/question-statements.mjs.',
    built:new Date().toISOString().slice(0,10),people:out}));
  console.log(`${n} statements for ${Object.keys(out).length} people on ${new Set(Object.values(out).flatMap(Object.keys)).size} questions.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
