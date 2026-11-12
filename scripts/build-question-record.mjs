// Each member's record on the alignment questions, from the bills coded to them (data/question-bills.json), the bill
// index (.local/bills/, npm run bills:index) and Voteview's roll calls:
//   sponsored a coded bill       -> "s" on the bill's side (its introduction date)
//   cosponsored it (not withdrawn) -> "c" on the bill's side (the date they signed on)
//   voted on it                  -> "y" (Yea: the bill's side) or "n" (Nay: the other side), on a vote that decides the
//                                   bill: passage, suspension, agreeing to the resolution or conference report,
//                                   concurring, cloture, the motion to proceed, a veto override. Motions to recommit,
//                                   amendments, tabling and other procedure don't count (what a Yea means there varies).
// Writes .local/question-record.json: {built, questions: {question: {bills: {bill: {side, why, title}}}},
// people: {bioguide: {question: [[bill, kind, date, side]]}}}, and prints how many sitting members each question reaches.
//   npm run bills:record
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {voteviewFiles} from '../src/voteview.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// The votes that decide a bill, by Voteview's vote_question.
const DECIDES=/^(on (motion to suspend the rules and (pass|agree)|passage|the (joint |concurrent )?resolution|the resolution|agreeing to the (resolution|conference report)|the conference report|motion to concur|concurring|the cloture motion|cloture on the motion to proceed|the motion to proceed|overriding the veto|the bill)|passage, objections)/i;
const PROCEDURE=/recommit|table|previous question|agreeing to the amendment|the amendment$|reconsider|waive|point of order|quorum|adjourn|instruct/i;
export const decidesBill=q=>DECIDES.test(String(q||'').trim())&&!PROCEDURE.test(String(q||''));
export const castSide=(cast,side)=>Number(cast)===1?side:Number(cast)===6?1-side:null;

// One member's items from one coded bill: their sponsorship or cosponsorship. (Votes are added from Voteview.)
export function billItems(bill,side){
  const out=[];
  if(bill.sponsor?.id)out.push([bill.sponsor.id,'s',bill.intro]);
  for(const c of bill.cosponsors||[])if(!c.out)out.push([c.id,'c',c.date||bill.intro]);
  return out.map(([id,kind,date])=>({id,kind,date,side}));
}

async function main(){
  const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
  const coded=read('data/question-bills.json'),Q=read('public/questions.json');
  const want=new Set();for(const [q,bills] of Object.entries(coded))if(q!=='about')for(const id of Object.keys(bills))want.add(id);
  const bills=new Map(),dir=path.join(ROOT,'.local','bills');
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')))
    for await(const line of readline.createInterface({input:fs.createReadStream(path.join(dir,f)),crlfDelay:Infinity})){
      if(!line)continue;const id=line.slice(7,line.indexOf('"',7));if(want.has(id))bills.set(id,JSON.parse(line));
    }
  const missing=[...want].filter(id=>!bills.has(id));if(missing.length)console.log(`Not in the bill index: ${missing.join(', ')}`);
  // Voteview: each needed Congress and chamber once.
  const need=new Set();for(const b of bills.values())for(const v of b.votes||[])need.add(`${v.ch}${v.c}`);
  const vv={};
  for(const k of need){
    const f=await voteviewFiles(Number(k.slice(1)),process.env,k[0]);
    const roll=new Map(),bio=new Map(),cast=new Map();
    for(const r of f.rollcalls)roll.set(`${r.session}-${r.clerk_rollnumber}`,r);
    for(const m of f.members)if(m.bioguide_id)bio.set(m.icpsr,m.bioguide_id);
    for(const v of f.votes){const a=cast.get(v.rollnumber)||[];a.push([v.icpsr,v.cast_code]);cast.set(v.rollnumber,a);}
    vv[k]={roll,bio,cast};console.log(`Voteview ${k}: ${f.rollcalls.length} roll calls`);
  }
  const people={},questions={};let votesUsed=0,votesSkipped=0;
  const add=(id,q,item)=>{((people[id]||={})[q]||=[]).push(item);};
  for(const [q,list] of Object.entries(coded)){
    if(q==='about')continue;questions[q]={bills:{}};
    for(const [id,[side,why]] of Object.entries(list)){
      const b=bills.get(id);if(!b)continue;questions[q].bills[id]={side,why,title:b.short?.[0]||b.title};
      for(const it of billItems(b,side))add(it.id,q,[id,it.kind,it.date,it.side]);
      for(const v of b.votes||[]){
        const f=vv[`${v.ch}${v.c}`],r=f?.roll.get(`${v.session}-${v.roll}`);
        if(!r||!decidesBill(r.vote_question)){votesSkipped++;continue;}votesUsed++;
        for(const [icpsr,code] of f.cast.get(r.rollnumber)||[]){const s=castSide(code,side),bg=f.bio.get(icpsr);if(s==null||!bg)continue;add(bg,q,[`${id}#${v.ch}${v.c}-${r.rollnumber}`,Number(code)===1?'y':'n',r.date,s]);}
      }
    }
  }
  fs.writeFileSync(path.join(ROOT,'.local','question-record.json'),JSON.stringify({built:new Date().toISOString().slice(0,10),questions,people}));
  // How far each question reaches among sitting members.
  const sitting=[...read('public/senate.json').senators,...read('public/house.json').members].map(m=>m.bioguide).filter(Boolean);
  console.log(`${votesUsed} deciding votes used, ${votesSkipped} procedural or unmatched votes left out.`);
  for(const q of Object.keys(questions)){
    const reached=sitting.filter(id=>people[id]?.[q]);let a=0,b=0;
    for(const id of reached){const items=people[id][q];const s=items.reduce((t,[,,,side])=>t+(side===0?1:-1),0);if(s>0)a++;else if(s<0)b++;}
    const sides=Q.questions.find(x=>x.id===q)?.sides||['A','B'];
    console.log(`${q}: ${Object.keys(questions[q].bills).length} bills; ${reached.length} of ${sitting.length} sitting members have a record (${a} lean ${sides[0]}, ${b} lean ${sides[1]}).`);
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exit(1);});
