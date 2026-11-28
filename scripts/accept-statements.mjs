// Tagged statements go in with no one approving them (since Nov. 28, 2026): a batch of tags from the Congressional
// Record (data/statement-batches/<file>.json, {person: {question: [[side, quote, date, link, where, confidence]]}}) is
// checked automatically and moved into data/question-statements.json, then npm run statements:record writes the site's
// copy and the promises built from it. The checks, in place of a reviewer:
//   the quote   word for word in that member's saved speech with the same date and link (data/record-statements/<id>.json,
//               npm run record:collect), so nothing is put in their mouth; one shortened with "..." needs every piece
//               there, in order
//   the form    a side (0 or 1), a quote, a date and a link, for a known person and question
//   once        at most one statement per question per campaign: a question already tagged for that campaign keeps its tag
// What fails a check stays out and is listed. The batch file is marked with what moved in.
//   npm run statements:accept -- data/statement-batches/2026-11-25-record-all.json
//   npm run statements:accept -- <file> --dry-run      only print what would move in
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {campaignOf} from './question-statements.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const readIf=f=>{try{return JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));}catch{return null;}};
export const CODED='data/question-statements.json';
// Text compared the way it reads: curly quotes and dashes as plain ones, spaces collapsed, case ignored.
export const plain=s=>String(s||'').replace(/[‘’ʼ]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
// Is the quote in their saved speech with that date and link? A quote shortened with "..." counts when every piece of
// it is there word for word, in order.
export function quoteFound(saved,[,quote,date,url]){
  const pieces=plain(quote).split(/\s*(?:\.\.\.|…)\s*/).map(x=>x.replace(/^[\s,.;:-]+|[\s,;:-]+$/g,'')).filter(Boolean);
  if(pieces.join(' ').length<15)return false;
  return (saved?.statements||[]).some(s=>{if(s.date!==date||s.url!==url)return false;
    const text=plain((s.sentences||[]).join(' '));let at=0;
    for(const p of pieces){const i=text.indexOf(p,at);if(i<0)return false;at=i+p.length;}
    return true;});
}
// A batch, checked against the saved speeches and what's already tagged: the tags that move in (without their
// confidence), and the ones that don't, with why.
export function acceptBatch(batch,coded,{savedOf,people,questions}){
  const add={},left=[];
  for(const [pid,byQ] of Object.entries(batch?.people||{})){
    const saved=savedOf(pid);
    for(const [qid,list] of Object.entries(byQ||{}))for(const t of list||[]){
      const [side,quote,date,url,where]=t,why=
        !people.has(pid)?'not a person on the site':!questions.has(qid)?'not a question':![0,1].includes(side)?'no side':!/^\d{4}-\d{2}-\d{2}$/.test(String(date))?'no date'
        :!/^https?:\/\//.test(String(url))?'no link':!saved?'their speeches aren\'t saved':!quoteFound(saved,t)?'the quote isn\'t word for word in the speech'
        :[...(coded[pid]?.[qid]||[]),...(add[pid]?.[qid]||[])].some(x=>campaignOf(x[4],x[2])===campaignOf(where,date))?`already tagged for the ${campaignOf(where,date)} campaign`:null;
      if(why){left.push({person:pid,question:qid,quote:String(quote||'').slice(0,80),why});continue;}
      ((add[pid]||={})[qid]||=[]).push([side,quote,date,url,where||null]);
    }
  }
  return {add,left,moved:Object.values(add).reduce((n,q)=>n+Object.values(q).reduce((k,l)=>k+l.length,0),0)};
}
export function merge(coded,add){
  for(const [pid,byQ] of Object.entries(add))for(const [qid,list] of Object.entries(byQ)){const to=((coded[pid]||={})[qid]||=[]);to.push(...list);}
  return coded;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const file=process.argv.slice(2).find(a=>!a.startsWith('--')),dry=process.argv.includes('--dry-run');
  if(!file){console.log('Name the batch: npm run statements:accept -- data/statement-batches/<file>.json');process.exit(1);}
  const batch=readIf(file);if(!batch?.people){console.log(`No tags in ${file}.`);process.exit(1);}
  const coded=readIf(CODED)||{},Q=readIf('public/questions.json').questions,R=readIf('public/research.json');
  const people=new Set([...R.members,...(R.cands||[]),...(R.featured||[]),...(readIf('public/senate.json')?.senators||[]),...(readIf('public/house.json')?.members||[]),...(readIf('public/members-elect.json')?.members||[])].map(p=>p.id));
  const r=acceptBatch(batch,coded,{savedOf:id=>readIf(`data/record-statements/${id}.json`),people,questions:new Set(Q.map(q=>q.id))});
  const by={};for(const x of r.left)by[x.why]=(by[x.why]||0)+1;
  console.log(`${r.moved} tags for ${Object.keys(r.add).length} members move in${r.left.length?`; ${r.left.length} stay out: ${Object.entries(by).map(([w,n])=>`${n} ${w}`).join('; ')}`:''}.`);
  for(const x of r.left)console.log(`  ${x.person} · ${x.question}: ${x.why} ("${x.quote}…")`);
  if(dry)process.exit(0);
  fs.writeFileSync(path.join(root,CODED),JSON.stringify(merge(coded,r.add),null,1)+'\n');
  batch.status=`accepted automatically ${new Date().toISOString().slice(0,10)}: ${r.moved} tags moved into ${CODED}${r.left.length?`, ${r.left.length} left out (failed a check)`:''}`;
  fs.writeFileSync(path.join(root,file),JSON.stringify(batch,null,1)+'\n');
  console.log(`Wrote ${CODED}. Then: npm run statements:record`);
}
