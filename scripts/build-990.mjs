// Nonprofits' own tax returns (IRS Form 990), for following dark money: public/nonprofits.json. For each nonprofit the
// site has reason to follow, its newest return's totals, political spending and payments to political organizations
// (Schedule C, super PACs and other 527 groups by name), grants to other organizations (Schedule I), related tax-exempt
// organizations (Schedule R), and which of the others followed here gave it grants. Donors (Schedule B) are blacked out
// of public copies, so the trail stops at the last organization that reports. Shown, never graded.
// Which nonprofits:
//   the tracked groups' nonprofit arms           data/nonprofit-eins.json
//   outside spenders found to be nonprofits      the refresh's "Groups behind outside spending" (.local/records.sqlite)
//   groups that ran ads naming a candidate       the refresh's electioneering filers, matched by name to the IRS index
//   super PACs' largest organization donors      the refresh's Super PACs page, gifts of $100,000 or more, by name
//   one step further                             each of those's grants of $1 million or more to a 501(c)(4), (5),
//                                                (6) or 527 group, read the same way
// From the IRS's own downloads (scripts/irs990.mjs): the yearly e-file indexes for the last three years (about 90 MB
// each, kept in .local/irs-990/ and downloaded again after a week), then each return read out of its monthly zip with
// byte ranges (each return kept once read; a return doesn't change).
//   npm run nonprofits:990
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {indexURL,zipURL,indexRow,newestReturns,zipEnd,zipDirectory,zipFile,parse990,normEIN} from './irs990.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIR=path.join(ROOT,'.local','irs-990'),WEEK=7*864e5;
export const DONOR_MIN=100000,HOP_MIN=1e6,HOP_SECTIONS=/\b(4|5|6|527)\b/;
// A name as the IRS index and the FEC write it, for matching: lower case, no punctuation, no "inc" or "the".
export const normName=n=>String(n||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\b(inc|incorporated|the|corp|corporation|co|llc)\b/g,' ').replace(/\s+/g,' ').trim();
const readJSON=(f,d=null)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return d;}};

// What the refresh found (this computer's database): EINs of outside spenders that are nonprofits, and names to look up.
async function fromRefresh(){
  const file=path.join(ROOT,'.local','records.sqlite'),out={eins:new Map(),names:new Map()};
  if(!fs.existsSync(file))return out;
  const {openDatabase}=await import('./sqlite.mjs'),db=openDatabase(file);
  const rows=async kind=>(await db.prepare("SELECT j.subject,s.payload FROM snapshots s JOIN jobs j ON j.id=s.job_id WHERE j.kind=?").bind(kind).all()).results.map(r=>({subject:r.subject,x:JSON.parse(r.payload)}));
  try{
    for(const {x} of await rows('outside-groups'))for(const r of x.rows||[])if(r.ein)out.eins.set(normEIN(r.ein),{why:'Spent for or against a candidate',name:r.name});
    for(const {x} of await rows('electioneering'))for(const g of x.groups||[])if(!/^A person/.test(g.group))out.names.set(normName(g.group),{name:g.group,why:'Ran ads naming a candidate near an election'});
    for(const {x} of await rows('super-pacs'))for(const s of x.superPacs||[])for(const o of s.donors?.orgs||[])if(o.amount>=DONOR_MIN)out.names.set(normName(o.name),{name:o.name,why:`Gave $100,000 or more to a super PAC (${s.name})`});
  }finally{db.close();}
  return out;
}
// A yearly index, downloaded again when over a week old (one from two years back is kept once read). Null when the IRS
// hasn't posted that year's yet.
async function indexFile(year,now){
  const file=path.join(DIR,`index_${year}.csv`);
  const fresh=fs.existsSync(file)&&(year<new Date(now).getUTCFullYear()-1||now-fs.statSync(file).mtimeMs<WEEK);
  if(fresh)return file;
  const r=await fetch(indexURL(year));
  if(r.status===404)return fs.existsSync(file)?file:null;
  if(!r.ok)throw new Error(`IRS index ${year}: HTTP ${r.status}`);
  fs.writeFileSync(file+'.part',Buffer.from(await r.arrayBuffer()));fs.renameSync(file+'.part',file);
  console.log(`Downloaded the IRS's ${year} e-file index.`);
  return file;
}
// Each index line for these EINs, and the EINs filing under these names (by normalized name).
async function scanIndexes(files,eins,names){
  const rows=[],byName=new Map();
  for(const f of files){
    const rl=readline.createInterface({input:fs.createReadStream(f,'utf8'),crlfDelay:Infinity});
    for await(const line of rl){const r=indexRow(line);if(!r)continue;
      if(eins.has(r.ein))rows.push(r);
      const n=names.size?normName(r.name):null;if(n&&names.has(n))(byName.get(n)||byName.set(n,new Set()).get(n)).add(r.ein);}
  }
  return {rows,byName};
}
// One return's text: kept on disk once read; otherwise its zip's directory (read once a run) and its bytes, by range.
const dirs=new Map();
async function range(url,from,to){
  const r=await fetch(url,{headers:{Range:from<0?`bytes=${from}`:`bytes=${from}-${to}`}});
  if(r.status!==206)throw new Error(`${url}: byte ranges not served (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}
// A month's zip directory, or null when there's no such zip.
async function zipDir(batch){
  if(!dirs.has(batch)){
    const url=zipURL(batch),head=await fetch(url,{method:'HEAD'});
    if(head.status===404){dirs.set(batch,null);return null;}
    const end=zipEnd(await range(url,-70000));dirs.set(batch,zipDirectory(await range(url,end.offset,end.offset+end.size-1)));
  }
  return dirs.get(batch);
}
// The index names one zip a month ("2026_TEOS_XML_05A"), but a large month is posted in parts (05A, 05B…): the return is
// looked for in the named zip, then in the next parts while they exist.
export const batchParts=batch=>/[A-Z]$/.test(batch)?[batch,...'BCDEFGH'.split('').filter(l=>l>batch.at(-1)).map(l=>batch.slice(0,-1)+l)]:[batch];
async function returnXML(r){
  const file=path.join(DIR,'xml',`${r.objectId}.xml`);
  if(fs.existsSync(file))return fs.readFileSync(file,'utf8');
  let e=null,batch=null;
  for(const b of batchParts(r.batch)){const d=await zipDir(b);if(!d)break;if(d[`${r.objectId}_public.xml`]){e=d[`${r.objectId}_public.xml`];batch=b;break;}}
  if(!e)throw new Error(`${r.objectId} isn't in ${r.batch} or its later parts`);
  const xml=zipFile(await range(zipURL(batch),e.offset,e.offset+30+1024+e.csize),e).toString('utf8');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,xml);
  return xml;
}
// The site's file from the parsed returns: which tracked group each is, and who among them gave whom grants.
export function assemble(parsed,{why,groups,names,years,built}){
  const orgs={};
  for(const [ein,p] of parsed)orgs[ein]={...p,ein,why:[...(why.get(ein)||[])],groups:Object.entries(groups).filter(([,e])=>e===ein).map(([k])=>k),
    url:`https://projects.propublica.org/nonprofits/organizations/${Number(ein)}`};
  for(const [ein,o] of Object.entries(orgs))for(const g of o.grants.top)if(g.ein&&orgs[g.ein]&&g.ein!==ein)(orgs[g.ein].fundedBy||=[]).push({ein,name:o.name,amount:g.amount,year:o.taxYear});
  for(const o of Object.values(orgs))if(o.fundedBy)o.fundedBy.sort((a,b)=>b.amount-a.amount);
  return {about:'Nonprofits\' own tax returns (IRS Form 990): totals, political spending, payments to political organizations, grants and related organizations. See scripts/build-990.mjs. Donors are blacked out of public copies.',
    built,indexYears:years,groups,names,orgs};
}

async function main(){
  const now=Date.now(),year=new Date(now).getUTCFullYear(),years=[year-2,year-1,year];
  fs.mkdirSync(DIR,{recursive:true});
  const hand=readJSON(path.join(ROOT,'data','nonprofit-eins.json'),{groups:{}}),why=new Map(),add=(ein,w)=>(why.get(ein)||why.set(ein,new Set()).get(ein)).add(w);
  const groups=Object.fromEntries(Object.entries(hand.groups).map(([k,g])=>[k,normEIN(g.ein)]));
  for(const [k,e] of Object.entries(groups))add(e,'A tracked group\'s nonprofit arm');
  const ref=await fromRefresh();for(const [e,x] of ref.eins)add(e,x.why);
  const files=[];for(const y of years){const f=await indexFile(y,now);if(f)files.push(f);}
  // Names first: the IRS index's filers whose name is exactly one of the names, when only one EIN has it.
  const first=await scanIndexes(files,new Set(why.keys()),ref.names),names={};
  for(const [n,set] of first.byName)if(set.size===1){const ein=[...set][0];names[n]=ein;add(ein,ref.names.get(n).why);}
  const scan=Object.keys(names).length?await scanIndexes(files,new Set(why.keys()),new Map()):first;
  const parsed=new Map(),fail=[];
  const read=async rows=>{for(const r of newestReturns(rows).values()){if(parsed.has(r.ein))continue;
    try{parsed.set(r.ein,{...parse990(await returnXML(r)),objectId:r.objectId,batch:r.batch});}catch(e){fail.push(`${r.ein} ${r.name}: ${e.message}`);}}};
  await read(scan.rows);
  // One step further: large grants to political nonprofits and 527 groups.
  const hop=new Set();for(const p of parsed.values())for(const g of p.grants.top)if(g.ein&&g.amount>=HOP_MIN&&HOP_SECTIONS.test(g.section||'')&&!parsed.has(g.ein)){hop.add(g.ein);add(g.ein,`Got a grant of $1 million or more from ${p.name}`);}
  if(hop.size)await read((await scanIndexes(files,hop,new Map())).rows);
  const out=assemble(parsed,{why,groups,names,years:files.map(f=>Number(/index_(\d{4})/.exec(f)[1])),built:new Date(now).toISOString().slice(0,10)});
  out.notFound={groups:Object.keys(hand.notFound||{}),einsWithoutReturn:[...why.keys()].filter(e=>!parsed.has(e)).length,namesLookedUp:ref.names.size,namesMatched:Object.keys(names).length};
  fs.writeFileSync(path.join(ROOT,'public','nonprofits.json'),JSON.stringify(out));
  console.log(`Wrote public/nonprofits.json: ${parsed.size} nonprofits' returns (${Object.values(groups).filter(e=>parsed.has(e)).length} tracked groups' arms, ${hop.size} reached through grants)${fail.length?`; ${fail.length} couldn't be read:\n  ${fail.slice(0,10).join('\n  ')}`:''}.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exit(1);});
