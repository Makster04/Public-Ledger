// Each full profile's latest annual financial disclosures, as the refresh read them (src/schedules.mjs), into
// data/disclosure-items.json, for the Conflicts of Interest matching (scripts/match-conflicts.mjs): earned income,
// positions held outside government, agreements, gifts and travel paid by others, from the newest two reports that were
// read (gifts and travel count over the latest two report years). Run on the computer that runs npm start, where the
// refresh keeps the reports (.local/records.sqlite). It reads only; nothing is fetched.
//   npm run disclosures:export
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {annualRows} from '../src/feeds.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const PARTS=['income','positions','agreements','gifts','travel'];
// A report's parts without the raw text the reader keeps for checking (each item keeps its own line as read).
const partsOf=s=>Object.fromEntries(PARTS.map(k=>[k,(s?.[k]||[]).map(x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!=null&&v!=='')))]));
// One person's reports, newest first: the ones whose parts were read, at most two.
export function readReports(payloads){
  const all=payloads.flatMap(p=>annualRows(p)).filter(r=>r?.schedules?.read);
  const seen=new Set(),out=[];
  for(const r of all.sort((a,b)=>Number(b.year||0)-Number(a.year||0)||String(b.filed||'').localeCompare(String(a.filed||'')))){
    const k=`${r.year}|${r.type||''}`;if(seen.has(k))continue;seen.add(k);
    out.push({year:r.year??null,filed:r.filed||null,type:r.type||null,url:r.url||null,...partsOf(r.schedules)});
    if(out.length===2)break;
  }
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const dbFile=path.join(root,'.local','records.sqlite');
  if(!fs.existsSync(dbFile)){console.log('No local database yet: run npm start once first.');process.exit(1);}
  const research=JSON.parse(fs.readFileSync(path.join(root,'public','research.json'),'utf8'));
  const full=[...research.members,...research.cands,...(research.featured||[])].filter(p=>!p.office);
  const db=new DatabaseSync(dbFile,{readOnly:true});
  const rows=db.prepare("SELECT j.subject,s.payload FROM snapshots s JOIN jobs j ON j.id=s.job_id WHERE j.kind IN ('net-worth-house','net-worth-senate')").all();
  db.close();
  const by=new Map();for(const r of rows){try{(by.get(r.subject)||by.set(r.subject,[]).get(r.subject)).push(JSON.parse(r.payload));}catch{}}
  const people={},missing=[];
  for(const p of full){
    const reports=readReports(by.get(p.id)||[]);
    if(reports.length)people[p.id]={name:p.name,chamber:p.chamber,reports};else missing.push(p.id);
  }
  const out={about:'Each full profile\'s latest annual financial disclosures as the refresh read them (src/schedules.mjs): earned income, positions held outside government, agreements, gifts and paid travel, from the newest two reports read. Written by npm run disclosures:export; matched by scripts/match-conflicts.mjs.',
    built:new Date().toISOString().slice(0,10),people};
  fs.writeFileSync(path.join(root,'data','disclosure-items.json'),JSON.stringify(out,null,1)+'\n');
  const n=Object.values(people).reduce((t,x)=>t+PARTS.reduce((u,k)=>u+(x.reports[0]?.[k]?.length||0),0),0);
  console.log(`${Object.keys(people).length} of ${full.length} full profiles have a report whose parts were read (${n} items in the latest reports).`);
  if(missing.length)console.log(`Not read yet (no annual report, filed on paper, or not refreshed): ${missing.join(', ')}`);
  console.log('Wrote data/disclosure-items.json.');
}
