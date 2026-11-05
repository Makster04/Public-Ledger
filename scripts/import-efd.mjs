// Senate eFD reports saved by hand, for when efdsearch.senate.gov turns the refresh away (HTTP 403). Save each report
// page from a browser into efd-downloads/ (one folder per person, named by their id on this site, is easiest:
// efd-downloads/ossoff/), then run this. Senate candidates' reports (their Candidate Report) are read the same way, for
// the candidates profiled here; a candidate's page often has no "The Honorable" line, so their folder says whose it is. Trade reports (Periodic Transaction Reports) become the senator's official
// trades, and the newest annual report becomes their net worth and holdings, exactly as the refresh would have saved
// them (src/feeds.mjs efdTrades, efdAnnualHoldings). Run npm start once first, so the local database exists.
//   npm run efd:import                  read efd-downloads/
//   npm run efd:import -- --dry-run     only list what would be imported
//   npm run efd:import -- --list        the reports still to save, for the senators and candidates in 2026 races, with a
//                                       folder made for each in efd-downloads/
// Saving a page: open the report on efdsearch.senate.gov, then in Chrome File > Save Page As > "Webpage, HTML Only",
// or in Safari File > Save As > Format "Page Source". A report filed on paper is a scanned image: it is listed, not read.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import config from '../data/config.json' with {type:'json'};
import {FEEDS,efdSavedReport,officialRows,officialSummary,holdingsSnapshot} from '../src/feeds.mjs';
import {addJob,statement} from '../src/refresh.mjs';
import {openDatabase} from './sqlite.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z]/g,'');
// Sitting senators, and the profiled Senate candidates, who file their reports on Senate eFD too.
const SENATORS=()=>config.people.filter(p=>p.chamber==='S'&&(p.inOffice||p.ids));
const surname=p=>p.name.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i,'').trim().split(/\s+/).pop();

// Whose report a saved page is: the folder it's in when that's a senator's id, otherwise the name on the page.
export function senatorFor(file,report,people=SENATORS()){
  const folder=path.basename(path.dirname(file)).toLowerCase(),byFolder=people.find(p=>p.id===folder);
  const byName=report.name?people.filter(p=>fold(surname(p))===fold(report.name.last)&&[p.name.split(/\s+/)[0],...(p.nicknames||[])].some(f=>fold(report.name.first).startsWith(fold(f).slice(0,3))||fold(f).startsWith(fold(report.name.first).slice(0,3)))):[];
  if(byFolder){
    const clash=report.name&&byName.length&&!byName.includes(byFolder);
    return {person:byFolder,warn:clash?`the page names ${report.name.full}, not ${byFolder.name}; filed under the folder's senator`:null};
  }
  if(byName.length===1)return {person:byName[0],warn:null};
  return {person:null,warn:report.name?`no single senator or Senate candidate matches ${report.name.full}; put it in a folder named after the person's id`:'no senator\'s name found on the page; put it in a folder named after the senator\'s id'};
}

// The reports still to save: each senator and Senate candidate in a 2026 race without an imported annual or candidate
// report, with what to search for on eFD and the folder to save it in. have: the ids with a net worth on file.
// The people whose Senate annual report is already saved in the local database (by the refresh or an earlier import).
export async function savedAnnuals(db){
  const {results}=await statement(db,"SELECT job_id FROM snapshots WHERE job_id LIKE 'net-worth-senate:%'").all();
  return new Set((results||[]).map(r=>String(r.job_id).split(':')[1]));
}
export function toSave(have=new Set(),people=SENATORS().filter(p=>p.race)){
  return people.filter(p=>!have.has(p.id)).map(p=>({id:p.id,name:p.name,state:p.state,senator:!!p.inOffice,folder:`efd-downloads/${p.id}/`,
    search:p.inOffice?`Last Name "${surname(p)}", Filer Type "Senator", Report Type "Annual"; open the newest Annual Report`
      :`Last Name "${surname(p)}", Filer Type "Candidate", any report type; open the newest Candidate Report (or Annual Report)`}));
}

const listFiles=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?listFiles(path.join(dir,e.name)):[path.join(dir,e.name)]):[];

// Reads the folder and writes the snapshots. Returns one line per file and per senator, for printing (and the tests).
export async function importEfd({dir,db,dryRun=false,now=new Date()}){
  const files=listFiles(dir).filter(f=>!path.basename(f).startsWith('.')),lines=[],bySenator=new Map();
  for(const file of files){
    const rel=path.relative(dir,file),ext=path.extname(file).toLowerCase();
    if(ext==='.webarchive'){lines.push(`SKIP  ${rel}: a Safari web archive; save it again with Format "Page Source"`);continue;}
    if(!['.html','.htm'].includes(ext)){lines.push(`SKIP  ${rel}: not a saved web page (.html)`);continue;}
    const report=efdSavedReport(fs.readFileSync(file,'utf8'));
    if(!report.kind){lines.push(`SKIP  ${rel}: no trade table or annual report found; is it a report page?`);continue;}
    const {person,warn}=senatorFor(file,report);
    if(!person){lines.push(`SKIP  ${rel}: ${warn}`);continue;}
    // Without its eFD address, a report is known by its contents, so saving it twice still counts once.
    const doc=report.doc||'saved-'+crypto.createHash('sha256').update(JSON.stringify([report.kind,report.filed,report.year,report.trades,report.holdings])).digest('hex').slice(0,16);
    const f={doc,filed:report.filed,url:report.url||'https://efdsearch.senate.gov/search/',paper:report.kind==='paper',year:report.year,file:rel};
    const s=bySenator.get(person.id)||bySenator.set(person.id,{person,ptr:[],annual:[]}).get(person.id);
    const list=report.kind==='annual'?s.annual:s.ptr;
    // The same report saved twice (two files, one report) is read once.
    if(list.some(x=>x.f.doc===doc)){lines.push(`SAME  ${rel}: the same report as another file; read once`);continue;}
    list.push({f,report});
    const what=report.kind==='annual'?`annual report${report.year?` for ${report.year}`:''}, ${report.holdings.assets.length} assets, ${report.holdings.debts.length} debts`:report.kind==='paper'?'paper report (a scanned image; check it by hand)':`trade report, ${report.trades.length} trade${report.trades.length===1?'':'s'}`;
    lines.push(`OK    ${rel}: ${person.name}, ${what}, filed ${report.filed||'(date not found)'}${report.doc?'':' (no eFD address on the page)'}${warn?` — ${warn}`:''}`);
  }
  const stamp=now.toISOString(),runId=`import-${stamp}`,later=now.getTime()+7*86400000,summary=[];
  for(const {person,ptr,annual} of bySenator.values()){
    if(ptr.length){
      const id=`trades-senate:${person.id}`,old=dryRun?null:await statement(db,'SELECT payload FROM snapshots WHERE job_id=?',id).first();
      const last=old?JSON.parse(old.payload):null,fresh=new Set(ptr.map(x=>x.f.doc));
      const kept=[...(last?.rows||[]),...(last?.unread||[]).map(u=>({id:`unread:${u.doc}`,doc:u.doc,unread:u}))].filter(r=>!fresh.has(r.doc));
      const rows=[...kept,...ptr.flatMap(({f,report})=>f.paper?[{id:`unread:${f.doc}`,doc:f.doc,unread:{doc:f.doc,filed:f.filed,url:f.url,why:'Filed on paper (a scanned image); check the report'}}]
        :officialRows('Senate eFD',f,report.trades,'No trades could be read from this report; check the report'))];
      const snap={...officialSummary(rows),imported:stamp};
      summary.push(`${person.name}: ${ptr.length} trade report${ptr.length===1?'':'s'} imported, ${snap.count} trades on file${snap.unread.length?`, ${snap.unread.length} to check by hand`:''}`);
      if(!dryRun)await save(db,id,'trades-senate',person,snap,runId,stamp,later,`Imported ${ptr.length} report${ptr.length===1?'':'s'} saved by hand`);
    }
    if(annual.length){
      const best=annual.sort((x,y)=>(y.f.year||0)-(x.f.year||0)||String(y.f.filed).localeCompare(String(x.f.filed)))[0];
      const year=best.f.year||(best.f.filed?Number(best.f.filed.slice(0,4))-1:null);
      const snap={...holdingsSnapshot({...best.f,year,type:'annual',url:best.f.url},best.report.holdings),imported:stamp};
      summary.push(`${person.name}: annual report for ${year||'an unknown year'} imported${snap.unreadable?' (nothing could be read)':''}`);
      if(!dryRun)await save(db,`net-worth-senate:${person.id}`,'net-worth-senate',person,snap,runId,stamp,later,'Imported an annual report saved by hand');
    }
  }
  return {lines,summary,files:files.length};
}

// The snapshot the site reads, and the check marked done for a week (a refusal after that keeps this data).
async function save(db,id,kind,person,snap,runId,stamp,later,message){
  // A candidate has no check of their own until their report is imported: it gets one, searching for candidates.
  const job=FEEDS[kind].jobs(config).find(j=>j.subject===person.id)||{args:{last:surname(person),first:[person.name.split(/\s+/)[0],...(person.nicknames||[])],candidate:true}};
  await addJob(db,id,kind,person.id,job.args);
  await statement(db,'INSERT INTO snapshots(job_id,run_id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET run_id=excluded.run_id,payload=excluded.payload,updated_at=excluded.updated_at',id,runId,JSON.stringify(snap),stamp).run();
  await statement(db,"UPDATE jobs SET status='ready',last_success=?,next_due=?,failures=0,error=NULL,cursor=NULL,run_id=NULL,page=0 WHERE id=?",stamp,later,id).run();
  await statement(db,'INSERT INTO refresh_history(job_id,status,at,message,row_count) VALUES(?,?,?,?,?)',id,'success',stamp,message,snap.count||snap.nAssets||0).run();
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const dir=path.join(root,'efd-downloads'),dbFile=path.join(root,'.local','records.sqlite'),dryRun=process.argv.includes('--dry-run');
  if(process.argv.includes('--list')){
    let have=new Set();
    if(fs.existsSync(dbFile)){const d=openDatabase(dbFile);try{have=await savedAnnuals(d);}finally{d.close();}}
    const list=toSave(have);
    for(const x of list)fs.mkdirSync(path.join(root,x.folder),{recursive:true});
    console.log(list.length?`${list.length} reports to save. On https://efdsearch.senate.gov/search/home/ tick the box to agree, then for each one search as below, open the report, and save the page (Safari: File, Save As, Format "Page Source"; Chrome: File, Save Page As, "Webpage, HTML Only") into its folder, which is made for you:\n`:'Every senator and Senate candidate in a 2026 race has a report imported.');
    for(const x of list)console.log(`${x.folder.padEnd(28)} ${x.name} (${x.state}, ${x.senator?'senator':'candidate'}): ${x.search}`);
    if(list.length)console.log('\nThen stop npm start, run npm run efd:import, and start it again. Run --list again any time to see what is left.');
    process.exit(0);
  }
  if(!fs.existsSync(dir)){fs.mkdirSync(dir,{recursive:true});console.log(`Made the folder efd-downloads/. Save the senators' report pages there (one folder per senator, e.g. efd-downloads/ossoff/), then run this again.`);process.exit(0);}
  if(!dryRun&&!fs.existsSync(dbFile)){console.log('No local database yet (.local/records.sqlite). Run npm start once, stop it, then run this again.');process.exit(1);}
  const db=dryRun?null:openDatabase(dbFile);
  try{
    const r=await importEfd({dir,db,dryRun});
    if(!r.files)console.log('efd-downloads/ is empty.');
    for(const l of r.lines)console.log(l);
    if(r.summary.length)console.log(`\n${dryRun?'Would import':'Imported'}:\n  ${r.summary.join('\n  ')}`);
    if(!dryRun&&r.summary.length)console.log('\nStart the site (npm start) to see them on each person\'s profile.');
  }finally{db?.close();}
}
