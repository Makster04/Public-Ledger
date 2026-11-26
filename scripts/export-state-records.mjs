// The state legislature bills of everyone who served in one (the members-elect and profiles with "stateLeg" in
// data/config.json), as the local refresh collected them (.local/records.sqlite: Open States' bills they sponsored or
// cosponsored, with their votes on them, and LegiScan's list of bills they sponsored), exported so a session without
// the local database can match them to the alignment questions (npm run state:acts -- --queue) (Nov. 26, 2026).
//   npm run state:export
// Writes data/state-records/<id>.json: {about, person, name, built, counts, bills: [{key, state, session, year,
// identifier, title, role, date, url, source, votes: [{date, motion, option, result}]}]}, newest first. A bill both
// sources list is kept once (Open States', which has their role and votes), matched by state, number and year.
// --db and --out point it elsewhere (the tests use them).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const root=fileURLToPath(new URL('../',import.meta.url));
export const KINDS=['state-openstates','state-legiscan'],MARKERS=new Set(['os-person','ls-person','coverage']);
// "HB 2045", "H.B. 2045", "HB2045" -> "HB2045".
export const billNumber=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const yearOf=r=>String(r.year||r.date||'').slice(0,4)||null;
// A bill's key: state, number and year ("AZ-HB2045-2024").
export const stateBillKey=b=>`${String(b.state||'').toUpperCase()}-${billNumber(b.identifier)}-${b.year||'?'}`;
// One person's bills from the rows of both sources: Open States first, then LegiScan's not already listed (same state
// and number, in the same or the next year: a session that spans two).
export function mergeBills(rows){
  const os=[],ls=[];
  for(const {kind,r} of rows){if(!r||MARKERS.has(r.id)||!r.identifier)continue;(kind==='state-openstates'?os:ls).push(r);}
  const out=new Map();
  const add=(r,source)=>{const b={state:String(r.state||'').toUpperCase(),session:r.session||null,year:yearOf(r),identifier:r.identifier,title:r.title||null,
    role:r.role||null,date:r.date||null,url:r.url||null,source,votes:(r.votes||[]).filter(v=>v&&v.option)};b.key=stateBillKey(b);if(!out.has(b.key))out.set(b.key,b);};
  for(const r of os)add(r,'Open States');
  for(const r of ls){const n=billNumber(r.identifier),y=Number(yearOf(r));
    const dup=[...out.values()].some(b=>b.state===String(r.state||'').toUpperCase()&&billNumber(b.identifier)===n&&(Number(b.year)===y||Number(b.year)===y+1));
    if(!dup)add(r,'LegiScan');}
  return [...out.values()].sort((a,b)=>String(b.date||b.year||'').localeCompare(String(a.date||a.year||''))||a.key.localeCompare(b.key));
}
export function exportStateRecords({db,names={},out,today=new Date().toISOString().slice(0,10)}){
  const rows=db.prepare(`SELECT j.kind,j.subject,r.payload FROM jobs j JOIN records r ON r.run_id=j.published_run WHERE j.kind IN (${KINDS.map(()=>'?').join(',')})`).all(...KINDS);
  const by=new Map();for(const x of rows){let r;try{r=JSON.parse(x.payload);}catch{continue;}(by.get(x.subject)||by.set(x.subject,[]).get(x.subject)).push({kind:x.kind,r});}
  fs.mkdirSync(out,{recursive:true});const written=[];
  for(const [id,list] of [...by].sort()){
    const bills=mergeBills(list);if(!bills.length)continue;
    fs.writeFileSync(path.join(out,`${id}.json`),JSON.stringify({about:'The state legislature bills this person sponsored or cosponsored, with their votes on them, from Open States and LegiScan as the local refresh collected them. Written by npm run state:export (scripts/export-state-records.mjs); matched to the alignment questions with npm run state:acts.',
      person:id,name:names[id]||id,built:today,counts:{bills:bills.length,votes:bills.reduce((n,b)=>n+b.votes.length,0)},bills},null,1)+'\n');
    written.push([id,bills.length]);
  }
  return written;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
  const dbFile=arg('--db',path.join(root,'.local','records.sqlite')),out=arg('--out',path.join(root,'data','state-records'));
  if(!fs.existsSync(dbFile)){console.log('No local database yet: run npm start once (it collects the state records), then this.');process.exit(1);}
  const read=f=>{try{return JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));}catch{return {};}};
  const names=Object.fromEntries([...(read('data/config.json').people||[]),...(read('public/members-elect.json').members||[])].map(p=>[p.id,p.name]));
  const written=exportStateRecords({db:new DatabaseSync(dbFile,{readOnly:true}),names,out});
  for(const [id,n] of written)console.log(`  ${id.padEnd(16)} ${n} bills`);
  console.log(`Wrote data/state-records/ (${written.length} people). Commit and push it so the bills can be matched to the questions.`);
}
