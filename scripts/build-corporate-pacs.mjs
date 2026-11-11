// Who took corporate PAC money this cycle: every sitting member of the House and the Senate, for the home page's
// seating charts (public/seats.js). From two FEC bulk files for the cycle (no API key):
//   pas2  "Contributions from committees to candidates & independent expenditures": each PAC check, with the committee
//         that gave it and the candidate it went to
//   cm    the committee master file: each committee's registration (committee type, designation, the sponsoring
//         organization's type)
// A check counts when it's a direct or in-kind contribution (24K, 24Z; memo lines left out, refunds subtracted) from a
// committee public/pac-types.js calls a corporate PAC (sponsored by a corporation, or a corporation without capital
// stock), the same rule as the site's "Corporate PAC" label. Members are matched by their FEC candidate ID
// (public/senate.json and public/house.json fecCand). Writes public/corporate-pacs.json:
//   people: {id: [corporate PAC dollars, number of corporate PACs]} for every member whose candidate ID is known; a
//   member who isn't listed hasn't been read.
//
//   npm run corporate:pacs               downloads into .local/fec-bulk/ (the pas2 file is shared with
//                                        scripts/build-funder-history.mjs) and writes the file; files over a week old
//                                        are downloaded again
//   npm run corporate:pacs -- --refresh  downloads them again now
//   FEC_BULK_BASE=<url> npm run ...      a mirror of https://www.fec.gov/files/bulk-downloads
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pacKind} from '../public/pac-types.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE=process.env.FEC_BULK_BASE||'https://www.fec.gov/files/bulk-downloads';
const WEEK=7*86400000;

// One cm.txt line -> [committee id, kind] (pacKind of [name, committee type, designation, organization type]).
export function committeeKind(line){
  const c=String(line).split('|');if(c.length<13||!/^C\d{8}$/.test(c[0]))return null;
  return [c[0],pacKind([c[1],c[9],c[8],c[12]])];
}
// One itpas2.txt line -> {cand, cmte, amount} for a corporate PAC's direct or in-kind contribution, or null.
export function corporateCheck(line,kinds){
  const c=String(line).split('|');
  if(c.length<22)return null;
  if(c[5]!=='24K'&&c[5]!=='24Z')return null;          // direct or in-kind contributions only, not outside spending
  if(c[19])return null;                               // memo line: detail of another entry, not new money
  if(kinds.get(c[0])!=='corporate')return null;
  const amount=Number(c[14]);if(!Number.isFinite(amount)||amount===0)return null;
  const cand=c[16];if(!/^[HSP]\d[A-Z0-9]+$/.test(cand||''))return null;
  return {cand,cmte:c[0],amount,date:c[13]};
}
// The members, by candidate ID: every senator and every House member with one.
export function membersByCandidate(senate,house){
  const m=new Map();
  for(const p of [...(senate?.senators||[]),...(house?.members||[])])for(const id of [p.fecCand,...(p.fecCandPast||[])])if(id)m.set(id,p.id);
  return m;
}
// The totals by member: [dollars (net of refunds), corporate PACs that gave], 0 for a member with none.
export function corporateTotals(checks,byCand){
  const people={},pacs={};
  for(const id of new Set(byCand.values()))people[id]=[0,0];
  for(const x of checks){const id=byCand.get(x.cand);if(!id)continue;people[id][0]+=x.amount;(pacs[id]||=new Map()).set(x.cmte,((pacs[id].get(x.cmte))||0)+x.amount);}
  for(const [id,by] of Object.entries(pacs))people[id][1]=[...by.values()].filter(v=>v>0).length;
  for(const v of Object.values(people)){v[0]=Math.max(0,Math.round(v[0]*100)/100);if(!v[0])v[1]=0;}
  return people;
}
// MMDDYYYY -> YYYY-MM-DD ('' if not a date)
const iso=dt=>/^\d{8}$/.test(dt||'')?`${dt.slice(4)}-${dt.slice(0,2)}-${dt.slice(2,4)}`:'';

async function download(name,cycle,dir,refresh){
  const file=path.join(dir,name);
  const old=fs.existsSync(file)&&Date.now()-fs.statSync(file).mtimeMs>WEEK;
  if((refresh||old)&&fs.existsSync(file))fs.rmSync(file);
  if(!fs.existsSync(file)){
    console.log(`Downloading ${BASE}/${cycle}/${name}…`);
    const r=await fetch(`${BASE}/${cycle}/${name}`);
    if(!r.ok)throw new Error(`Download failed (HTTP ${r.status}) for ${name}`);
    fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));
  }
  return {file,downloaded:fs.statSync(file).mtime.toISOString().slice(0,10)};
}
async function* lines(zip,inner){
  const p=spawn('unzip',['-p',zip,inner]);
  let err='';p.stderr.on('data',d=>err+=d);
  yield* readline.createInterface({input:p.stdout,crlfDelay:Infinity});
  const code=await new Promise(res=>p.on('close',res));
  if(code)throw new Error(`unzip failed for ${zip}: ${err}`);
}

async function main(argv){
  const config=JSON.parse(fs.readFileSync(path.join(ROOT,'data','config.json'),'utf8'));
  const cycle=Number(argv[argv.indexOf('--cycle')+1])||Number(config.cycle)||2026,yy=String(cycle).slice(2),refresh=argv.includes('--refresh');
  const dir=process.env.FEC_BULK_DIR||path.join(ROOT,'.local','fec-bulk');fs.mkdirSync(dir,{recursive:true});
  const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,'public',f),'utf8'));
  const byCand=membersByCandidate(read('senate.json'),read('house.json'));
  const cm=await download(`cm${yy}.zip`,cycle,dir,refresh),pas2=await download(`pas2${yy}.zip`,cycle,dir,refresh);
  const kinds=new Map();
  for await(const line of lines(cm.file,'cm.txt')){const k=committeeKind(line);if(k)kinds.set(k[0],k[1]);}
  const checks=[];let through='';
  for await(const line of lines(pas2.file,'itpas2.txt')){const x=corporateCheck(line,kinds);if(!x||!byCand.has(x.cand))continue;checks.push(x);const d=iso(x.date);if(d>through&&d<=new Date().toISOString().slice(0,10))through=d;}
  const people=corporateTotals(checks,byCand),vals=Object.values(people);
  const out={about:'Corporate PAC money to each sitting member of Congress this cycle, from FEC bulk files. See scripts/build-corporate-pacs.mjs.',
    built:new Date().toISOString().slice(0,10),cycle,through:through||null,
    sources:[{file:path.basename(cm.file),downloaded:cm.downloaded,url:`${BASE}/${cycle}/cm${yy}.zip`},{file:path.basename(pas2.file),downloaded:pas2.downloaded,url:`${BASE}/${cycle}/pas2${yy}.zip`}],
    people};
  fs.writeFileSync(path.join(ROOT,'public','corporate-pacs.json'),JSON.stringify(out));
  console.log(`Wrote public/corporate-pacs.json: ${vals.length} members read, ${vals.filter(v=>v[0]>0).length} took corporate PAC money, ${vals.filter(v=>!v[0]).length} took none (${checks.length} checks, through ${through||'?'}).`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exit(1);});
