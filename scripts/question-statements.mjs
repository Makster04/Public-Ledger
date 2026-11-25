// What politicians said, tagged to the alignment questions (public/questions.json) with the side it takes and its date.
//
// The statements come from what they told voters in each campaign (data/campaign-text/<id>.json: their campaign
// website's pages saved by the Wayback Machine, and their campaign-season Bluesky and Threads posts), from the floor
// speeches, press releases and posts the local refresh collected (data/collected-statements/<id>.json, exported by npm
// run statements:export), every sitting member's floor speeches (data/record-statements/<id>.json, npm run record:collect) and from the reviewed statements in public/research.json. Each one is tagged by hand in data/question-statements.json:
//   {person id: {question id: [[side index, "the quote", "YYYY-MM-DD", "link", "where it was said"], ...]}}
// A tag is only made when the words clearly take one side of the question; a statement that only explains a vote
// isn't a separate position, and anything unclear is left out. At most one statement per question per campaign (the
// clearest one), so a position repeated across a site's pages counts once; a later campaign that says it again is a new
// statement with its own date. A statement outside a campaign site belongs to the election its date leads up to. Each counts 1 point beside votes,
// bills or official acts on the question and 3 where there are none (public/question-scores.js, formula questions-3),
// cancelled when a later vote on the question went the other way. The same words on several pages count once, at the latest date they were seen.
//
//   npm run statements:find                      candidates for everyone with campaign text
//   npm run statements:find -- ossoff collins    just these people
// writes .local/statement-candidates/<id>.json: each sentence that names one of a question's search phrases
// (data/question-search.json "any", plus its "said" phrases for how people talk about it), once per wording, with the
// dates and links it was found at, and the questions it may be about. --print lists them compactly.
//   npm run statements:find -- --queue warren    for tagging (since Nov. 25, 2026): for each question, the person's
//                                               clearest sentences (stanceRank), clearest questions first; --top N
//                                               questions (default 20), --skip-tagged leaves out questions tagged already
//   npm run statements:record
// checks data/question-statements.json (known people and questions, a side, a quote, a date and a link) and writes
// public/question-statements.json for the site.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sentences,commitmentIn,surnameOf} from '../src/promise-finder.mjs';
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
// Statements the local refresh collected (data/collected-statements/<id>.json, npm run statements:export): floor
// speeches, press releases and posts, as documents of their kept sentences. Their campaign is the election they lead up
// to (campaignOf).
export function collectedDocs(c){
  return (c?.statements||[]).filter(x=>x.sentences?.length).map(x=>({text:x.sentences.join('\n'),date:x.date,url:x.url,where:x.where,year:Number(cycleOf(x.date))}));
}
// Each question's search as tests: its phrases (data/question-search.json "any" and "said") and the ones that rule a
// sentence out ("not").
export const searchTests=searches=>Object.entries(searches||{}).filter(([q])=>q!=='about').map(([q,s])=>({q,re:[...(s.any||[]),...(s.said||[])].map(phraseRe),not:(s.not||[]).map(phraseRe)}));
// The sentences of a text that name a question's phrases: [{text, questions}] (30 to 700 characters each).
export function topicSentences(text,tests){
  const out=[];
  for(const line of String(text||'').split(/\n+/))for(const sen of sentences(line)){
    if(sen.length<30||sen.length>700)continue;const t=lower(sen);
    const qs=tests.filter(x=>x.re.some(r=>r.test(t))&&!x.not.some(r=>r.test(t))).map(x=>x.q);if(qs.length)out.push({text:sen.trim(),questions:qs});
  }
  return out;
}
// The sentences of a person's documents that name a question's phrases, once per wording: [{text, questions, seen:
// [{date, url, where, year}]}], newest sighting first.
export function statementCandidates(docs,searches){
  const tests=searchTests(searches),by=new Map();
  for(const d of docs)for(const {text:sen,questions:qs} of topicSentences(d.text,tests)){
    const k=norm(sen),c=by.get(k)||by.set(k,{text:sen,questions:qs,seen:[]}).get(k);
    if(!c.seen.some(s=>s.url===d.url))c.seen.push({date:d.date,url:d.url,where:d.where,year:d.year});
  }
  const out=[...by.values()];for(const c of out)c.seen.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return out;
}
// How clearly a sentence takes a side, for ordering what's tagged first (since Nov. 25, 2026): 5 their own promise
// ("I will…", "I'll vote to…"), 4 their own stance ("I support…", "we oppose…"), 3 "we must / we need to / we cannot",
// 2 "should", "must" or "ought to", 1 anything else; a very long sentence one less. name: their surname.
export function stanceRank(sentence,name){
  const s=String(sentence||''),c=commitmentIn(s,name);let r=1;
  if(c&&!c.third&&!c.conditional&&(c.kind==='promise'||c.side!=='unclear'))r=c.kind==='promise'?5:4;
  else if(/\b(?:I|we)\s+(?:must|need to|have to|cannot|can['’]t|should|refuse to|will not|won['’]t)\b/i.test(s))r=3;
  else if(/\b(?:should|must|ought to|need to)\b/i.test(s))r=2;
  return Math.max(1,r-(s.length>400?1:0));
}
// The tagging queue: for each question a person's sentences name, the clearest two (stanceRank, then newest), the
// questions with the clearest sentences first, at most top of them. cands: statementCandidates' list.
export function tagQueue(cands,name,{top=20,skip=new Set()}={}){
  const byQ=new Map();
  for(const c of cands){const rank=stanceRank(c.text,name),date=c.seen[0]?.date||'';
    for(const q of c.questions){if(skip.has(q))continue;(byQ.get(q)||byQ.set(q,[]).get(q)).push({...c,rank,date});}}
  const out=[...byQ].map(([q,list])=>({q,best:list.sort((a,b)=>b.rank-a.rank||String(b.date).localeCompare(String(a.date))).slice(0,2)}));
  return out.sort((a,b)=>b.best[0].rank-a.best[0].rank||(b.best[1]?.rank||0)-(a.best[1]?.rank||0)||a.q.localeCompare(b.q)).slice(0,top);
}
// The election a date leads up to: the year itself when even, else the next ("2025-03-01" -> "2026").
export const cycleOf=date=>{const y=Number(String(date||'').slice(0,4));return y?String(y%2?y+1:y):'';};
// The campaign a statement belongs to: the one its source names ("Campaign website, 2020", "Bluesky post, 2026
// campaign"), else the election its date leads up to.
export const campaignOf=(where,date)=>/^Campaign website, (\d{4})\b/.exec(String(where||''))?.[1]||/, (\d{4}) campaign\b/.exec(String(where||''))?.[1]||cycleOf(date);
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
  const args=process.argv.slice(2),find=args.includes('--find')||args.includes('--queue'),queue=args.includes('--queue'),print=args.includes('--print'),only=args.filter((a,i)=>!a.startsWith('--')&&args[i-1]!=='--top');
  const Q=read('public/questions.json').questions,R=read('public/research.json');
  // The full profiles, and since Nov. 25, 2026 every sitting senator and House member (their floor speeches).
  const people=new Set([...R.members,...(R.cands||[]),...(R.featured||[]),...(read('public/senate.json').senators||[]),...(read('public/house.json').members||[])].map(p=>p.id));
  if(find){
    const searches=read('data/question-search.json');delete searches.about;
    const dir=path.join(ROOT,'.local','statement-candidates');fs.mkdirSync(dir,{recursive:true});
    const coded=fs.existsSync(path.join(ROOT,'data','question-statements.json'))?read('data/question-statements.json'):{};
    const files=dir=>fs.existsSync(path.join(ROOT,'data',dir))?fs.readdirSync(path.join(ROOT,'data',dir)).filter(f=>f.endsWith('.json')).map(f=>f.replace(/\.json$/,'')):[];
    const campaign=new Set(files('campaign-text')),collected=new Set(files('collected-statements')),record=new Set(files('record-statements').filter(f=>!f.startsWith('_')));
    for(const id of [...new Set([...campaign,...collected,...record])].sort()){
      if(only.length&&!only.includes(id))continue;
      const c=campaign.has(id)?read(`data/campaign-text/${id}.json`):null,k=collected.has(id)?read(`data/collected-statements/${id}.json`):null,r=record.has(id)?read(`data/record-statements/${id}.json`):null;
      const cands=statementCandidates([...campaignDocs(c),...collectedDocs(k),...collectedDocs(r)],searches);
      if(!cands.length)continue;
      if(queue){
        const name=c?.name||k?.name||r?.name||id,skip=args.includes('--skip-tagged')?new Set(Object.keys(coded[id]||{})):new Set();
        const list=tagQueue(cands,surnameOf({name}),{top:Number(args[args.indexOf('--top')+1])||20,skip});
        console.log(`## ${id} (${name})`);
        for(const x of list)for(const b of x.best)console.log(`${x.q} | ${b.rank} | ${b.date} | ${b.seen[0]?.url||''} | ${b.text.slice(0,420)}`);
        continue;
      }
      fs.writeFileSync(path.join(dir,`${id}.json`),JSON.stringify({person:id,name:c?.name||k?.name||r?.name||id,built:new Date().toISOString().slice(0,10),candidates:cands}));
      const done=Object.keys(coded[id]||{}).length;
      console.log(`${id}: ${cands.length} sentences on ${new Set(cands.flatMap(x=>x.questions)).size} questions${done?` (${done} questions tagged)`:''}`);
      if(print)for(const [i,x] of cands.entries())console.log(`  ${i} [${x.questions.join(',')}] ${x.seen.map(s=>s.year).filter((v,j,a)=>a.indexOf(v)===j).join('/')} ${x.text.slice(0,300)}`);
    }
    return;
  }
  const {problems,out}=checkStatements(read('data/question-statements.json'),{people,questions:Q});
  if(problems.length){console.error(problems.join('\n'));process.exit(1);}
  const n=Object.values(out).reduce((t,b)=>t+Object.values(b).reduce((u,l)=>u+l.length,0),0);
  fs.writeFileSync(path.join(ROOT,'public','question-statements.json'),JSON.stringify({about:'What each reviewed profile said, tagged to the alignment questions: {person id: {question id: [[side index, date, quote, link, where it was said]]}}, newest first. Each counts toward its side (1 point beside votes, bills or official acts on the question, 3 where there are none) unless a later vote on the question went the other way (public/question-scores.js). Tagged by hand in data/question-statements.json; written by scripts/question-statements.mjs.',
    built:new Date().toISOString().slice(0,10),people:out}));
  console.log(`${n} statements for ${Object.keys(out).length} people on ${new Set(Object.values(out).flatMap(Object.keys)).size} questions.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
