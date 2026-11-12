// Candidate bills for each alignment question (public/questions.json), from the bill index (.local/bills/, built by
// npm run bills:index). Each question's search (data/question-search.json) lists:
//   any:      phrases; a bill is a candidate when one is in its title or a short title, or in its summary when it also
//             has one of the question's subjects (or the question lists none)
//   subjects: Congress.gov legislative subjects or policy areas the question belongs to
//   not:      phrases that rule a bill out (another meaning of the same words)
// A candidate is only that: whether a bill takes a side, and which, is coded by hand in data/question-bills.json
// ({question: {bill id: [side index, "why"]}}), and a bill that isn't clearly on one side is left out.
//
// Writes .local/question-candidates/<question>.json: the candidates, most consequential first (became law, then
// recorded votes, then cosponsors), each with its titles, the start of its summary, its sponsor's party, how many
// cosponsors and recorded votes it has, and whether it is already coded; and the amendments with a recorded vote whose
// stated purpose has one of the phrases (and none of the "not" ones), from .local/amendments/.
//   npm run bills:candidates                      every question with a search
//   npm run bills:candidates -- minimum-wage      just these questions
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lower=s=>String(s||'').toLowerCase();
// A phrase matches on word boundaries ("ice" doesn't match "price").
export const phraseRe=p=>new RegExp(`(^|[^a-z0-9])${lower(p).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'[\\s-]+')}($|[^a-z0-9])`);
export function matches(bill,search){
  const heads=lower([bill.title,...(bill.short||[])].join(' | ')),sum=lower(bill.summary),subs=new Set([...(bill.subjects||[]),bill.area].filter(Boolean));
  const re=(search.any||[]).map(phraseRe),not=(search.not||[]).map(phraseRe);
  if(not.some(r=>r.test(heads)))return false;
  if(re.some(r=>r.test(heads)))return true;
  const inSubject=!(search.subjects||[]).length||search.subjects.some(s=>subs.has(s));
  return inSubject&&re.some(r=>r.test(sum))&&!not.some(r=>r.test(sum));
}
const rank=b=>(b.law?1e6:0)+(b.votes?.length||0)*1e3+(b.cosponsors?.length||0);
export function candidates(bills,search,coded={}){
  return bills.filter(b=>matches(b,search)).sort((a,b)=>rank(b)-rank(a)||b.c-a.c||a.n-b.n).map(b=>({
    id:b.id,title:b.title,short:b.short?.[0]||null,intro:b.intro,party:b.sponsor?.party||null,cosponsors:b.cosponsors?.length||0,votes:b.votes?.length||0,
    ...(b.law?{law:true}:{}),summary:b.summary?b.summary.slice(0,400):null,...(coded[b.id]?{coded:coded[b.id]}:{})}));
}

// Amendments with at least one roll call whose direction is known and whose purpose matches the search.
export function amendmentCandidates(amdts,search,coded={}){
  const re=(search.any||[]).map(phraseRe),not=(search.not||[]).map(phraseRe);
  return amdts.filter(a=>(a.votes||[]).some(v=>v.yea!=null)).filter(a=>{const p=lower(a.purpose);return re.some(r=>r.test(p))&&!not.some(r=>r.test(p));})
    .sort((a,b)=>b.votes.length-a.votes.length||String(b.intro).localeCompare(String(a.intro)))
    .map(a=>({id:a.id,purpose:a.purpose,bill:a.bill,intro:a.intro,party:a.sponsor?.party||null,cosponsors:a.cosponsors?.length||0,
      votes:a.votes.map(v=>`${v.ch}${v.c} ${v.date} ${v.yea==null?'?':v.yea?'Yea=for':'Yea=against'}: ${v.text.slice(0,90)}`),...(coded[a.id]?{coded:coded[a.id]}:{})}));
}

async function readIndex(dir){
  const out=[];if(!fs.existsSync(dir))return out;
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')).sort()){
    for await(const line of readline.createInterface({input:fs.createReadStream(path.join(dir,f)),crlfDelay:Infinity}))if(line.trim())out.push(JSON.parse(line));
  }
  return out;
}

async function main(argv){
  const read=f=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));}catch{return null;}};
  const questions=read('public/questions.json')?.questions||[],searches=read('data/question-search.json')||{},coded=read('data/question-bills.json')||{};
  const want=argv.filter(a=>!a.startsWith('-'));
  const bills=await readIndex(path.join(ROOT,'.local','bills')),amdts=await readIndex(path.join(ROOT,'.local','amendments'));
  if(!bills.length){console.error('No bill index yet: run npm run bills:index first.');process.exit(1);}
  const out=path.join(ROOT,'.local','question-candidates');fs.mkdirSync(out,{recursive:true});
  let n=0;
  for(const q of questions){
    if(want.length&&!want.includes(q.id))continue;const s=searches[q.id];if(!s)continue;
    const list=candidates(bills,s,coded[q.id]||{}),am=amendmentCandidates(amdts,s,coded[q.id]||{});n++;
    fs.writeFileSync(path.join(out,`${q.id}.json`),JSON.stringify({question:q.q,sides:q.sides,search:s,count:list.length,candidates:list,amendments:am},null,1));
    console.log(`${q.id}: ${list.length} candidates (${list.filter(c=>c.coded).length} coded), ${am.length} amendments with roll calls (${am.filter(c=>c.coded).length} coded)`);
  }
  console.log(`${n} questions searched across ${bills.length} bills.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exit(1);});
