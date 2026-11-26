// The state legislature bills of everyone who served in one (the members-elect and profiles with "stateLeg" in
// data/config.json), as the local refresh collected them (.local/records.sqlite: Open States' bills they sponsored or
// cosponsored, with their votes on them, and LegiScan's list of bills they sponsored), exported so a session without
// the local database can match them to the alignment questions (npm run state:acts -- --queue) (Nov. 26, 2026).
//   npm run state:export
//   npm run state:export -- --legiscan   also fill in the bills LegiScan's sponsored list gives only by number (no
//                                        title, no role): its dataset for each session they served in (one request
//                                        a session, kept in .local/legiscan/ until LegiScan's hash for it changes),
//                                        with each bill's title, whether they were its primary sponsor or a
//                                        cosponsor, and their recorded votes on it. Needs LEGISCAN_API_KEY.
// Writes data/state-records/<id>.json: {about, person, name, built, counts, bills: [{key, state, session, year,
// identifier, title, role, date, url, source, votes: [{date, motion, option, result}]}]}, newest first. A bill both
// sources list is kept once (Open States', which has their role and votes), matched by state, number and year.
// --db and --out point it elsewhere (the tests use them).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {unzip} from './xlsx.mjs';

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
// ---------- LegiScan's datasets ----------
// A LegiScan dataset's bills, by number ("HB0040"), from its zip of bill/<n>.json and vote/<roll call>.json files:
// {number: {title, sponsors: [{people_id, sponsor_type_id}], votes: [{roll_call_id, date, desc}]}}, and the roll calls by id.
export function datasetBills(zipBytes){
  const files=unzip(zipBytes,n=>/\/(bill|vote)\/[^/]+\.json$/.test(n)),bills=new Map(),rolls=new Map();
  for(const [name,buf] of files){if(!buf)continue;let j;try{j=JSON.parse(buf.toString('utf8'));}catch{continue;}
    if(/\/bill\//.test(name)&&j.bill)bills.set(billNumber(j.bill.bill_number||j.bill.number),j.bill);
    else if(/\/vote\//.test(name)&&j.roll_call)rolls.set(Number(j.roll_call.roll_call_id),j.roll_call);}
  return {bills,rolls};
}
const VOTE_TEXT={yea:'yes',aye:'yes',yes:'yes',nay:'no',no:'no'};
// A bill LegiScan listed by number only, filled in from its dataset for the person (their LegiScan people_id).
export function fillFromDataset(bill,ds,personId){
  const b=ds.bills.get(billNumber(bill.identifier));if(!b)return bill;
  const sp=(b.sponsors||[]).find(x=>Number(x.people_id)===Number(personId));
  const role=sp?(Number(sp.sponsor_type_id)===2?'cosponsor':'sponsor'):bill.role;
  const votes=[];
  for(const v of b.votes||[]){const rc=ds.rolls.get(Number(v.roll_call_id));const mine=rc?.votes?.find(x=>Number(x.people_id)===Number(personId));if(!mine)continue;
    const t=String(mine.vote_text||'').toLowerCase();votes.push({date:rc.date||v.date||null,motion:String(rc.desc||v.desc||'').slice(0,200),option:VOTE_TEXT[t]||t,result:rc.passed===1?'pass':rc.passed===0?'fail':null});}
  return {...bill,title:bill.title||b.title||b.description||null,role,date:bill.date||b.status_date||b.last_action_date||null,url:bill.url||b.state_link||b.url||null,votes:bill.votes?.length?bill.votes:votes};
}
// Fills in one person's LegiScan-only bills: the state's dataset list, then each needed session's dataset.
export async function legiscanFill(bills,{personId,get,cacheDir,log=()=>{}}){
  const need=bills.filter(b=>b.source==='LegiScan'&&!b.title);if(!need.length||!personId)return bills;
  const byState=new Map();for(const b of need)(byState.get(b.state)||byState.set(b.state,new Set()).get(b.state)).add(b.session);
  const filled=new Map();
  for(const [state,sessions] of byState){
    const list=(await get(`https://api.legiscan.com/?op=getDatasetList&state=${state}`))?.datasetlist||[];
    for(const name of sessions){
      const d=list.find(x=>x.session_name===name||x.session_title===name);if(!d){log(`  no LegiScan dataset for ${state} ${name}`);continue;}
      const file=path.join(cacheDir,`${d.session_id}-${d.dataset_hash}.zip`);let bytes=null;
      if(fs.existsSync(file))bytes=fs.readFileSync(file);
      else{try{const z=await get(`https://api.legiscan.com/?op=getDataset&id=${d.session_id}&access_key=${d.access_key}`);
          if(z?.dataset?.zip){bytes=Buffer.from(z.dataset.zip,'base64');fs.mkdirSync(cacheDir,{recursive:true});fs.writeFileSync(file,bytes);}}
        catch(e){log(`  ${state} ${name}: ${e.message}`);}}
      if(!bytes)continue;
      const ds=datasetBills(bytes);for(const b of need)if(b.state===state&&b.session===name)filled.set(b.key,fillFromDataset(b,ds,personId));
    }
  }
  return bills.map(b=>filled.get(b.key)||b);
}

export async function exportStateRecords({db,names={},out,today=new Date().toISOString().slice(0,10),fill=null}){
  const rows=db.prepare(`SELECT j.kind,j.subject,r.payload FROM jobs j JOIN records r ON r.run_id=j.published_run WHERE j.kind IN (${KINDS.map(()=>'?').join(',')})`).all(...KINDS);
  const by=new Map();for(const x of rows){let r;try{r=JSON.parse(x.payload);}catch{continue;}(by.get(x.subject)||by.set(x.subject,[]).get(x.subject)).push({kind:x.kind,r});}
  fs.mkdirSync(out,{recursive:true});const written=[];
  for(const [id,list] of [...by].sort()){
    let bills=mergeBills(list);if(!bills.length)continue;
    const personId=list.find(x=>x.r?.id==='ls-person')?.r?.person??null;
    if(fill)bills=await fill(bills,{id,personId});
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
  let fill=null;
  if(process.argv.includes('--legiscan')){
    if(!process.env.LEGISCAN_API_KEY){console.log('No LEGISCAN_API_KEY in .dev.vars: run it without --legiscan, or add the key.');process.exit(1);}
    const {requestSource}=await import('../src/sources.mjs');
    const get=url=>requestSource(url,process.env,{maxChars:40_000_000});
    fill=(bills,{id,personId})=>{const n=bills.filter(b=>b.source==='LegiScan'&&!b.title).length;if(n)console.log(`  ${id}: filling in ${n} bills from LegiScan's datasets…`);
      return legiscanFill(bills,{personId,get,cacheDir:path.join(root,'.local','legiscan'),log:console.log});};
  }
  const written=await exportStateRecords({db:new DatabaseSync(dbFile,{readOnly:true}),names,out,fill});
  for(const [id,n] of written)console.log(`  ${id.padEnd(16)} ${n} bills`);
  console.log(`Wrote data/state-records/ (${written.length} people). Commit and push it so the bills can be matched to the questions.`);
}
