// Each member's record on the alignment questions, from the bills coded to them (data/question-bills.json), the bill
// index (.local/bills/, npm run bills:index) and Voteview's roll calls:
//   sponsored a coded bill       -> "s" on the bill's side (its introduction date)
//   cosponsored it (not withdrawn) -> "c" on the bill's side (the date they signed on)
//   voted on it                  -> "y" (Yea: the bill's side) or "n" (Nay: the other side), on a vote that decides the
//                                   bill: passage, suspension, agreeing to the resolution or conference report,
//                                   concurring, cloture, the motion to proceed, a veto override. Motions to recommit,
//                                   amendments, tabling and other procedure don't count (what a Yea means there varies).
//                                   The votes come from the bill's own actions and from Voteview's roll calls that name
//                                   the bill (Voteview's bill_number), each roll call once.
// A question may also code a roll call that belongs to no bill ("vote:H117-9", e.g. an objection to a state's electoral
// votes): a Yea takes the coded side, a Nay the other.
// A coded bill may name the only roll calls that count for it ([side, why, {votes: ["H117-549"]}]), for a bill number
// that was later reused as the vehicle for something else.
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
// How Voteview names a bill in its roll calls: "HR842", "SJRES8", "HRES1096".
// "vote:H117-9" -> {k: "H117", roll: 9}; anything else -> null.
export function voteKey(id){const m=/^vote:([HS]\d+)-(\d+)$/.exec(String(id));return m?{k:m[1],roll:Number(m[2])}:null;}
export const voteviewBill=b=>`${String(b.t).toUpperCase()}${b.n}`;
// A bill's roll calls, each once: those its actions list (matched by session and clerk roll number) and those Voteview
// files under the bill. vv: {"H117": {roll: Map("session-clerk" -> roll call), byBill: Map(bill -> [roll calls])}}.
export function billRollcalls(bill,vv,only=null){
  const out=[],seen=new Set(),take=(k,r)=>{const key=`${k}-${r.rollnumber}`;if(seen.has(key)||(only&&!only.includes(key)))return;seen.add(key);out.push({k,r});};
  for(const v of bill.votes||[]){const k=`${v.ch}${v.c}`,r=vv[k]?.roll.get(`${v.session}-${v.roll}`);if(r)take(k,r);}
  for(const ch of ['H','S']){const k=`${ch}${bill.c}`;for(const r of vv[k]?.byBill?.get(voteviewBill(bill))||[])take(k,r);}
  return out;
}

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
  const want=new Set();const voteKeys=new Set();
  for(const [q,bills] of Object.entries(coded))if(q!=='about')for(const id of Object.keys(bills)){const v=voteKey(id);if(v)voteKeys.add(v.k);else want.add(id);}
  const bills=new Map(),dir=path.join(ROOT,'.local','bills');
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')))
    for await(const line of readline.createInterface({input:fs.createReadStream(path.join(dir,f)),crlfDelay:Infinity})){
      if(!line)continue;const id=line.slice(7,line.indexOf('"',7));if(want.has(id))bills.set(id,JSON.parse(line));
    }
  const missing=[...want].filter(id=>!bills.has(id));if(missing.length)console.log(`Not in the bill index: ${missing.join(', ')}`);
  // Voteview: each needed Congress and chamber once.
  const need=new Set();for(const b of bills.values()){need.add(`H${b.c}`);need.add(`S${b.c}`);for(const v of b.votes||[])need.add(`${v.ch}${v.c}`);}
  for(const k of voteKeys)need.add(k);
  const vv={};
  for(const k of need){
    const f=await voteviewFiles(Number(k.slice(1)),process.env,k[0]);
    // (some years' vote files write member IDs as "14009.0", so they're matched as numbers)
    const roll=new Map(),byBill=new Map(),byNumber=new Map(),bio=new Map(),cast=new Map();
    for(const r of f.rollcalls){byNumber.set(Number(r.rollnumber),r);roll.set(`${r.session}-${r.clerk_rollnumber}`,r);if(r.bill_number){const a=byBill.get(r.bill_number)||[];a.push(r);byBill.set(r.bill_number,a);}}
    for(const m of f.members)if(m.bioguide_id)bio.set(Number(m.icpsr),m.bioguide_id);
    for(const v of f.votes){const a=cast.get(v.rollnumber)||[];a.push([v.icpsr,v.cast_code]);cast.set(v.rollnumber,a);}
    vv[k]={roll,byBill,byNumber,bio,cast};console.log(`Voteview ${k}: ${f.rollcalls.length} roll calls`);
  }
  const people={},questions={};let votesUsed=0,votesSkipped=0;
  const add=(id,q,item)=>{((people[id]||={})[q]||=[]).push(item);};
  for(const [q,list] of Object.entries(coded)){
    if(q==='about')continue;questions[q]={bills:{}};
    for(const [id,[side,why,opt]] of Object.entries(list)){
      const vk=voteKey(id);
      if(vk){const f=vv[vk.k],r=f?.byNumber.get(vk.roll);if(!r){console.log(`Roll call not found: ${id}`);continue;}
        questions[q].bills[id]={side,why,title:r.vote_desc||why};votesUsed++;
        for(const [icpsr,code] of f.cast.get(r.rollnumber)||[]){const s=castSide(code,side),bg=f.bio.get(Number(icpsr));if(s==null||!bg)continue;add(bg,q,[id,Number(code)===1?'y':'n',r.date,s]);}
        continue;}
      const b=bills.get(id);if(!b)continue;questions[q].bills[id]={side,why,title:b.short?.[0]||b.title};
      for(const it of billItems(b,side))add(it.id,q,[id,it.kind,it.date,it.side]);
      for(const {k,r} of billRollcalls(b,vv,opt?.votes||null)){
        if(!decidesBill(r.vote_question)){votesSkipped++;continue;}votesUsed++;const f=vv[k];
        for(const [icpsr,code] of f.cast.get(r.rollnumber)||[]){const s=castSide(code,side),bg=f.bio.get(Number(icpsr));if(s==null||!bg)continue;add(bg,q,[`${id}#${k}-${r.rollnumber}`,Number(code)===1?'y':'n',r.date,s]);}
      }
    }
  }
  fs.writeFileSync(path.join(ROOT,'.local','question-record.json'),JSON.stringify({built:new Date().toISOString().slice(0,10),questions,people}));
  // How far each question reaches among sitting members.
  const sitting=[...read('public/senate.json').senators,...read('public/house.json').members].map(m=>m.bioguide).filter(Boolean);
  console.log(`${votesUsed} deciding votes used, ${votesSkipped} procedural votes left out.`);
  for(const q of Object.keys(questions)){
    const reached=sitting.filter(id=>people[id]?.[q]);let a=0,b=0;
    for(const id of reached){const items=people[id][q];const s=items.reduce((t,[,,,side])=>t+(side===0?1:-1),0);if(s>0)a++;else if(s<0)b++;}
    const sides=Q.questions.find(x=>x.id===q)?.sides||['A','B'];
    console.log(`${q}: ${Object.keys(questions[q].bills).length} bills; ${reached.length} of ${sitting.length} sitting members have a record (${a} lean ${sides[0]}, ${b} lean ${sides[1]}).`);
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exit(1);});
