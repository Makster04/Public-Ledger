// State legislature records as stances on the alignment questions (Nov. 26, 2026): what members-elect, and profiles
// who served in a state legislature, did there, from their bills (data/state-records/<id>.json, npm run state:export).
//
// Each bill is tagged by hand with the question it decides and the side passing it would take, in
// data/question-state-acts.json: {about, people: {person: {question: [[side the bill takes, bill key]]}}}. What the
// person did then gives their side: sponsoring or cosponsoring it takes the bill's side; a yes vote takes it and a no
// vote the other side; other votes (absent, not voting) count for nothing. Their actions count like a member of
// Congress's (public/question-scores.js QPOINTS: sponsored 1.5, cosponsored 1, a state vote 1; one credit per bill).
//   npm run state:acts -- --queue shah ortiz   for tagging: each bill whose title names a question's search phrases
//                                              (data/question-search.json), with the questions it may be about
//   npm run state:acts                         checks the tags and writes public/question-state.json for the site:
//                                              {person: {question: [[side, kind, date, title, link, why]]}}
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {searchTests} from './question-statements.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const readIf=f=>{try{return read(f);}catch{return null;}};
export const TAGS='data/question-state-acts.json',OUT='public/question-state.json',RECORDS='data/state-records';
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};

// The questions a bill's title may be about: those whose search phrases it names, without the ones that rule it out.
export function billQuestions(title,tests){
  const t=String(title||'').toLowerCase();if(!t)return [];
  return tests.filter(x=>x.re.some(r=>r.test(t))&&!x.not.some(r=>r.test(t))).map(x=>x.q);
}
const VOTE={yes:'yes',yea:'yes',aye:'yes',y:'yes',no:'no',nay:'no',n:'no'};
// What one person did on one tagged bill, as stance items: [[side, kind, date, title, link, why]].
export function billActions(bill,side){
  const out=[],st=STATES[bill.state]||bill.state,title=`${bill.state} ${bill.identifier}${bill.year?` (${bill.year})`:''}${bill.title?`: ${bill.title}`:''}`;
  if(bill.role==='sponsor'||bill.role==='cosponsor')out.push([side,bill.role==='sponsor'?'s':'c',bill.date||null,title,bill.url||null,`${bill.role==='sponsor'?'Sponsored':'Cosponsored'} it in the ${st} legislature.`]);
  for(const v of bill.votes||[]){const o=VOTE[String(v.option||'').toLowerCase()];if(!o)continue;
    out.push([o==='yes'?side:1-side,'state',v.date||null,title,bill.url||null,`Voted ${o} in the ${st} legislature${v.motion?` on: ${String(v.motion).slice(0,120)}`:''}.`]);}
  return out;
}
// Checks the tags against the questions and the exported bills; {problems, out} with out as public/question-state.json's people.
export function buildStateActs(tags,{questions,records}){
  const problems=[],out={},qs=new Set(questions.map(q=>q.id));
  for(const [pid,byQ] of Object.entries(tags||{})){
    const rec=records(pid);if(!rec){problems.push(`${pid}: no exported state records (npm run state:export)`);continue;}
    const bills=new Map(rec.bills.map(b=>[b.key,b]));
    for(const [qid,list] of Object.entries(byQ)){
      if(!qs.has(qid)){problems.push(`${pid}: unknown question ${qid}`);continue;}
      for(const [side,key] of list){
        if(![0,1].includes(side)){problems.push(`${pid} ${qid}: side must be 0 or 1`);continue;}
        const b=bills.get(key);if(!b){problems.push(`${pid} ${qid}: no bill ${key} in their records`);continue;}
        const items=billActions(b,side);if(items.length)((out[pid]||={})[qid]||=[]).push(...items);
      }
      out[pid]?.[qid]?.sort((a,b)=>String(b[2]).localeCompare(String(a[2])));
    }
  }
  return {problems,out};
}

function main(){
  const args=process.argv.slice(2);
  if(args.includes('--queue')){
    const searches=read('data/question-search.json');delete searches.about;const tests=searchTests(searches);
    const dir=path.join(ROOT,RECORDS),only=args.filter(a=>!a.startsWith('--'));
    const ids=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).filter(id=>!only.length||only.includes(id)):[];
    if(!ids.length){console.log('No exported state records yet: run npm run state:export on the computer that runs npm start, and push data/state-records/.');return;}
    for(const id of ids.sort()){
      const r=read(`${RECORDS}/${id}.json`),lines=[];
      for(const b of r.bills){const qs=billQuestions(b.title,tests);if(!qs.length)continue;
        const did=[b.role,...(b.votes||[]).map(v=>`voted ${v.option}`)].filter(Boolean).join(', ')||'listed';
        lines.push(`${qs.join(',')} | ${b.key} | ${did} | ${b.date||b.year||''} | ${String(b.title||'').slice(0,300)}`);}
      console.log(`## ${id} (${r.name}): ${lines.length} of ${r.bills.length} bills name a question's topic`);for(const l of lines)console.log(l);
    }
    return;
  }
  const tags=readIf(TAGS)?.people||{};
  const {problems,out}=buildStateActs(tags,{questions:read('public/questions.json').questions,records:id=>readIf(`${RECORDS}/${id}.json`)});
  if(problems.length){console.error(problems.join('\n'));process.exit(1);}
  fs.writeFileSync(path.join(ROOT,OUT),JSON.stringify({about:'What members-elect, and profiles who served in a state legislature, did there on the alignment questions: {person: {question: [[side, kind (s sponsored, c cosponsored, state a vote), date, bill, link, what they did]]}}. Each bill tagged by hand in data/question-state-acts.json with the side it takes; written by npm run state:acts (scripts/state-acts.mjs). Counted in public/question-scores.js like a member of Congress\'s bills and votes.',
    built:new Date().toISOString().slice(0,10),people:out}));
  const n=Object.values(out).reduce((t,b)=>t+Object.values(b).reduce((u,l)=>u+l.length,0),0);
  console.log(`${n} state actions for ${Object.keys(out).length} people on ${new Set(Object.values(out).flatMap(Object.keys)).size} questions.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
