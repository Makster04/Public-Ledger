// What each tracker's own super PACs (AIPAC's United Democracy Project; the crypto industry's Fairshake, Defend
// American Jobs, Protect Progress and Fellowship PAC; the AI industry's Leading the Future network) spent in this
// cycle's races, primaries and generals: for and against each candidate, with every other candidate in those races, so
// each profile can show what a tracker's super PACs spent to help them win (for them, and against their opponents in
// the same election). From the FEC's bulk file of independent expenditures (independent_expenditure_<cycle>.csv, every
// filing, the 24- and 48-hour notices included): each transaction once, in its latest version (the highest file number
// for a spender's transaction ID); a tracker's super PACs by committee ID or name (public/trackers.js isOwnSuperPac).
// Writes public/super-pac-races.json:
//   {about, built, cycle, through, spenders: {committee id: [name, tracker key]},
//    cands: {candidate id: [name, seat ("H-KY-04", "S-MI"), party ("D", "R", …), elections ("PG": primary, general)]}
//      for every candidate with outside spending (from anyone) in a seat a tracker's super PAC spent in,
//    rows: [[committee id, candidate id, "S" for them | "O" against them, election (P, G, R runoff, S special, O other,
//      C convention), dollars]]}
// Run by npm run corporate:pacs, or on its own:
//   npm run superpacs:races               downloads the file into .local/fec-bulk/ (again when over a week old)
//   npm run superpacs:races -- --refresh  downloads it again now
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {TRACKERS,isOwnSuperPac} from '../public/trackers.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE=process.env.FEC_BULK_BASE||'https://www.fec.gov/files/bulk-downloads';
const WEEK=7*86400000;
const MONTHS={JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};

// One CSV line -> its fields (quoted fields may hold commas and doubled quotes).
export function parseCsv(line){
  const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const c=line[i];
    if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
    else if(c==='"')q=true;else if(c===','){out.push(cur);cur='';}else cur+=c;}
  out.push(cur);return out;
}
// "15-MAY-26" -> "2026-05-15" ('' if not a date).
export const isoDate=d=>{const m=/^(\d{2})-([A-Z]{3})-(\d{2})$/.exec(String(d||'').toUpperCase());return m&&MONTHS[m[2]]?`20${m[3]}-${MONTHS[m[2]]}-${m[1]}`:'';};
// The seat a record is about: "H-KY-04", "S-MI" (null for the presidency or a record without one).
export function seatOf(office,state,district){
  if(office==='S'&&/^[A-Z]{2}$/.test(state||''))return `S-${state}`;
  if(office==='H'&&/^[A-Z]{2}$/.test(state||''))return `H-${state}-${String(Number(district)||0).padStart(2,'0')}`;
  return null;
}
export const partyOf=aff=>{const a=String(aff||'').toUpperCase();return /^DEMOCRAT/.test(a)?'D':/^REPUBLICAN/.test(a)?'R':/^INDEPENDENT/.test(a)?'I':a?a[0]:'';};
// The tracker whose own super PAC a spender is, or null.
export const trackerOfSpender=(id,name)=>TRACKERS.find(t=>t.superPacs.length&&isOwnSuperPac(t,{id,name}))?.key||null;

// Each transaction once: a spender's transaction ID, at its highest file number (an amendment replaces the original).
export function latestVersions(records){
  const latest=new Map();
  for(const r of records){
    const k=`${r.spe_id}|${r.tran_id}`,f=Number(r.file_num)||0,o=latest.get(k);
    if(!o||f>=o.f)latest.set(k,{f,r});
  }
  return [...latest.values()].map(({r})=>r);
}
// The independent-expenditure file's records (objects by its header).
export async function readIeRecords(file){
  const rl=readline.createInterface({input:fs.createReadStream(file,'utf8'),crlfDelay:Infinity});
  let head=null;const records=[];
  for await(const line of rl){if(!line)continue;const v=parseCsv(line);if(!head){head=v;continue;}records.push(Object.fromEntries(head.map((h,i)=>[h,v[i]])));}
  return records;
}
// The file's records (objects by header) -> the races file's contents.
export function superPacRaces(records,{cycle=2026}={}){
  const all=latestVersions(records).map(r=>({spe:r.spe_id,speName:r.spe_nam,cand:r.cand_id,name:r.cand_name,seat:seatOf(r.can_office,r.can_office_state,r.can_office_dis),
    party:partyOf(r.cand_pty_aff),so:r.sup_opp==='O'?'O':'S',ele:String(r.ele_type||'').toUpperCase()[0]||'',amount:Number(r.exp_amo)||0,date:isoDate(r.exp_date)||isoDate(r.dissem_dt)})).filter(x=>x.cand&&x.seat&&x.ele);
  const spenders={},seats=new Set(),sums=new Map();let through='';
  for(const x of all){
    const key=trackerOfSpender(x.spe,x.speName);if(!key)continue;
    spenders[x.spe]=[x.speName,key];seats.add(x.seat);
    const k=[x.spe,x.cand,x.so,x.ele].join('|');sums.set(k,(sums.get(k)||0)+x.amount);
    if(x.date>through)through=x.date;
  }
  const cands={};
  for(const x of all)if(seats.has(x.seat)){const c=cands[x.cand]||(cands[x.cand]=[x.name,x.seat,x.party,'']);if(!c[3].includes(x.ele))c[3]+=x.ele;if(!c[2]&&x.party)c[2]=x.party;}
  const rows=[...sums].map(([k,v])=>{const [s,c,so,e]=k.split('|');return [s,c,so,e,Math.round(v*100)/100];}).filter(r=>r[4]!==0).sort((a,b)=>b[4]-a[4]);
  return {about:'Each tracker\'s own super PACs\' spending in this cycle\'s races, primaries and generals, for and against each candidate, with the other candidates in those races. From the FEC bulk file of independent expenditures. See scripts/build-super-pac-races.mjs.',
    built:new Date().toISOString().slice(0,10),cycle,through:through||null,spenders,cands,rows};
}

async function download(file,url,refresh){
  const old=fs.existsSync(file)&&Date.now()-fs.statSync(file).mtimeMs>WEEK;
  if((refresh||old)&&fs.existsSync(file))fs.rmSync(file);
  if(!fs.existsSync(file)){
    console.log(`Downloading ${url}…`);
    const r=await fetch(url);if(!r.ok)throw new Error(`Download failed (HTTP ${r.status}) for ${url}`);
    fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));
  }
  return file;
}
// Reads (downloading when needed) the cycle's file and writes public/super-pac-races.json. Returns the file's contents.
export async function writeSuperPacRaces({cycle,dir,refresh=false,log=console.log}){
  const file=await download(path.join(dir,`independent_expenditure_${cycle}.csv`),`${BASE}/${cycle}/independent_expenditure_${cycle}.csv`,refresh);
  const out=superPacRaces(await readIeRecords(file),{cycle});
  fs.writeFileSync(path.join(ROOT,'public','super-pac-races.json'),JSON.stringify(out));
  log(`Wrote public/super-pac-races.json: ${Object.keys(out.spenders).length} tracker super PACs, ${out.rows.length} lines, ${Object.keys(out.cands).length} candidates in their races, through ${out.through}.`);
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const config=JSON.parse(fs.readFileSync(path.join(ROOT,'data','config.json'),'utf8'));
  const dir=process.env.FEC_BULK_DIR||path.join(ROOT,'.local','fec-bulk');fs.mkdirSync(dir,{recursive:true});
  writeSuperPacRaces({cycle:Number(config.cycle)||2026,dir,refresh:process.argv.includes('--refresh')}).catch(e=>{console.error(e.message);process.exit(1);});
}
