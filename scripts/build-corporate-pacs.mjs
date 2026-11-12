// Who took corporate PAC money this cycle, and money from each tracker (AIPAC, Big Pharma, Big Oil, Big Tech + AI,
// Crypto): every sitting member of the House and the Senate, for the home page's seating charts (public/seats.js) and
// their filter. From two FEC bulk files for the cycle (no API key):
//   pas2  "Contributions from committees to candidates & independent expenditures": each PAC check, with the committee
//         that gave it and the candidate it went to
//   cm    the committee master file: each committee's registration (committee type, designation, the sponsoring
//         organization's type)
// A check counts when it's a direct or in-kind contribution (24K, 24Z; memo lines left out, refunds subtracted) from a
// committee public/pac-types.js calls a corporate PAC (sponsored by a corporation, or a corporation without capital
// stock), the same rule as the site's "Corporate PAC" label. Members are matched by their FEC candidate ID
// (public/senate.json and public/house.json fecCand). A tracker's checks are those from its PACs, matched as its
// Tracker matches them (public/trackers.js isTrackerPac: by committee ID or name).
// Some groups also forward their donors' gifts to campaigns (earmarked, "routed"): AIPAC, Club for Growth, EMILY's List,
// J Street, the Senate Conservatives Fund, and every other group the reviewed profiles' search found doing it
// (public/research.json "bundled": conduits and names, from scripts/build-bundled.mjs). For each, the FEC's totals of
// its PAC's payments to each campaign committee this cycle (schedules/schedule_b/by_recipient_id, a few requests a
// group): the memo entries, which list each forwarded gift, else what's beyond its PAC's own checks in pas2 (for a party
// committee, the memo entries only). Read when FEC_API_KEY is in .dev.vars. Writes public/corporate-pacs.json:
//   people: {id: [corporate PAC dollars, number of corporate PACs]} for every member whose candidate ID is known; a
//   member who isn't listed hasn't been read.
//   trackers: {key: {id: [PAC dollars, number of its PACs, routed dollars (AIPAC)]}}, only members who took some;
//   routed: {aipac: true when its routed gifts were read, groups: [the groups read], failed: [groups that couldn't be]}.
//   earmarks: {id: {group: [routed dollars, the campaign committee they went to]}}, only members some group forwarded
//   gifts to; group is research.json's key ("aipac", "cfg", …) or "fec:" and the committee ID, as on the full profiles.
//   kinds: {id: {kind: dollars}}, each member's PAC checks by the kind of PAC that gave (public/pac-types.js pacKind;
//   party committees left out, as the FEC's PAC total leaves them out), so Big Money Independence can weigh PAC money by
//   type for every member, not only the profiles with reviewed PAC lines.
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
import {TRACKERS,isTrackerPac} from '../public/trackers.js';
import {requestSource,fecNext} from '../src/sources.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE=process.env.FEC_BULK_BASE||'https://www.fec.gov/files/bulk-downloads';
const WEEK=7*86400000;

// One cm.txt line -> [committee id, kind (pacKind of [name, committee type, designation, organization type]), name,
// the candidate it's a campaign committee of (principal or authorized), or null].
export function committeeKind(line){
  const c=String(line).split('|');if(c.length<13||!/^C\d{8}$/.test(c[0]))return null;
  return [c[0],pacKind([c[1],c[9],c[8],c[12]]),c[1],['P','A'].includes(c[8])&&/^[HSP]\d[A-Z0-9]+$/.test(c[14]||'')?c[14]:null];
}
// One itpas2.txt line -> {cand, cmte, amount, date} for a committee's direct or in-kind contribution to a candidate,
// or null.
export function committeeCheck(line){
  const c=String(line).split('|');
  if(c.length<22)return null;
  if(c[5]!=='24K'&&c[5]!=='24Z')return null;          // direct or in-kind contributions only, not outside spending
  if(c[19])return null;                               // memo line: detail of another entry, not new money
  const amount=Number(c[14]);if(!Number.isFinite(amount)||amount===0)return null;
  const cand=c[16];if(!/^[HSP]\d[A-Z0-9]+$/.test(cand||''))return null;
  return {cand,cmte:c[0],amount,date:c[13]};
}
// The same, for a corporate PAC's check only (kinds: committee id -> kind).
export function corporateCheck(line,kinds){const x=committeeCheck(line);return x&&kinds.get(x.cmte)==='corporate'?x:null;}
// The trackers a giving committee belongs to (by its ID or its name, as each Tracker matches its PACs).
export const trackersOf=(cmte,name)=>TRACKERS.filter(t=>isTrackerPac(t,{cid:cmte,name})).map(t=>t.key);
// AIPAC's routed gifts by member, from its PAC's payments by recipient committee (the FEC's totals: total, and
// memo_total for gifts listed as memo entries): the memo entries when there are some, else what's beyond its PAC's own
// checks to them (direct: member id -> dollars). cmteCand: campaign committee -> candidate ID.
// memoOnly: the memo entries alone (a party committee, whose other payments aren't forwarded gifts). recipients, when
// given, gets each member's campaign committee that got the most.
export function routedByMember(results,cmteCand,byCand,direct=new Map(),{memoOnly=false,recipients=null}={}){
  const out={},best={};
  for(const r of results||[]){
    const id=byCand.get(cmteCand.get(r.recipient_id));if(!id)continue;
    const memo=Number(r.memo_total)||0,total=Number(r.total)||0,routed=memo>0||memoOnly?memo:Math.max(0,total-(direct.get(id)||0));
    if(routed>0){out[id]=Math.round(((out[id]||0)+routed)*100)/100;if(!(best[id]>=routed)){best[id]=routed;if(recipients)recipients[id]=r.recipient_id;}}
  }
  return out;
}
// The groups whose forwarded gifts are read: research.json "bundled" conduits ({group: [committee IDs]}) and the other
// committees its search found forwarding gifts (names: {"fec:C…": name}). [{key, cmte}], each committee once.
export function conduitList(bundled){
  const out=[],seen=new Set(),add=(key,cmte)=>{if(/^C\d{8}$/.test(cmte||'')&&!seen.has(cmte)){seen.add(cmte);out.push({key,cmte});}};
  for(const [key,ids] of Object.entries(bundled?.conduits||{}))for(const id of ids||[])add(key,id);
  for(const key of Object.keys(bundled?.names||{}))if(key.startsWith('fec:'))add(key,key.slice(4));
  return out;
}
// Each member's routed dollars from each group, with the campaign committee that got the most (for the FEC link):
// got: [{key, byMember: {id: dollars}, recipients: {id: committee}}].
export function earmarkTotals(got){
  const out={};
  for(const g of got)for(const [id,v] of Object.entries(g.byMember||{})){if(!(v>0))continue;const o=out[id]||(out[id]={}),prev=o[g.key];o[g.key]=[Math.round(((prev?.[0]||0)+v)*100)/100,prev?.[1]||g.recipients?.[id]||null];}
  return out;
}
// Each member's PAC checks by kind of PAC (checks: {cand, kind, amount}), refunds subtracted, party committees left out.
export function kindTotals(checks,byCand){
  const out={};
  for(const x of checks){const id=byCand.get(x.cand);if(!id||x.kind==='party')continue;const k=x.kind||'other',o=out[id]||(out[id]={});o[k]=(o[k]||0)+x.amount;}
  for(const o of Object.values(out))for(const k of Object.keys(o)){o[k]=Math.round(o[k]*100)/100;if(!(o[k]>0))delete o[k];}
  return out;
}
// Each tracker's totals, only for members who took some: [PAC dollars, its PACs that gave, routed dollars].
export function trackerTotals(checks,byCand,routed={}){
  const out={};
  for(const t of TRACKERS){
    const pac=corporateTotals(checks.filter(x=>x.keys.includes(t.key)),byCand),list={};
    for(const [id,v] of Object.entries(pac)){const r=t.key==='aipac'?routed[id]||0:0;if(v[0]>0||r>0)list[id]=t.key==='aipac'?[v[0],v[1],r]:v;}
    out[t.key]=list;
  }
  return out;
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
  const kinds=new Map(),names=new Map(),cmteCand=new Map();
  for await(const line of lines(cm.file,'cm.txt')){const k=committeeKind(line);if(!k)continue;kinds.set(k[0],k[1]);names.set(k[0],k[2]);if(k[3])cmteCand.set(k[0],k[3]);}
  const conduits=conduitList(read('research.json').bundled),conduitIds=new Set(conduits.map(c=>c.cmte));
  const checks=[],tracked=[],byKind=[],fromConduits=[],keysOf=new Map();let through='';const today=new Date().toISOString().slice(0,10);
  for await(const line of lines(pas2.file,'itpas2.txt')){
    const x=committeeCheck(line);if(!x||!byCand.has(x.cand))continue;
    if(!keysOf.has(x.cmte))keysOf.set(x.cmte,trackersOf(x.cmte,names.get(x.cmte)));
    const keys=keysOf.get(x.cmte),corp=kinds.get(x.cmte)==='corporate';byKind.push({cand:x.cand,kind:kinds.get(x.cmte)||'other',amount:x.amount});if(conduitIds.has(x.cmte))fromConduits.push(x);if(!corp&&!keys.length)continue;
    if(corp)checks.push(x);if(keys.length)tracked.push({...x,keys});
    const d=iso(x.date);if(d>through&&d<=today)through=d;
  }
  const people=corporateTotals(checks,byCand),vals=Object.values(people);
  // Each group's forwarded gifts, with the FEC key; without it, the groups' PAC checks alone (and the page says so).
  let routed={},routedRead=false;const got=[],groupsRead=new Set(),groupsFailed=new Set();
  if(process.env.FEC_API_KEY){
    for(const c of conduits){
      try{
        const rows=[];let url=`https://api.open.fec.gov/v1/schedules/schedule_b/by_recipient_id/?committee_id=${c.cmte}&cycle=${cycle}&per_page=100&sort=-total`,i=0;
        for(;url&&i<50;i++){const d=await requestSource(url,process.env);rows.push(...(d.results||[]));url=fecNext(url,d);}
        if(url)throw new Error('more than 50 pages');
        const direct=new Map(Object.entries(corporateTotals(fromConduits.filter(x=>x.cmte===c.cmte),byCand)).map(([id,v])=>[id,v[0]]));
        const recipients={},byMember=routedByMember(rows,cmteCand,byCand,direct,{memoOnly:kinds.get(c.cmte)==='party',recipients});
        got.push({key:c.key,byMember,recipients});groupsRead.add(c.key);
        if(c.key==='aipac'){for(const [id,v] of Object.entries(byMember))routed[id]=Math.round(((routed[id]||0)+v)*100)/100;routedRead=true;}
      }catch(e){groupsFailed.add(c.key);console.log(`${names.get(c.cmte)||c.key}'s forwarded gifts couldn't be read (${e.message}).`);}
    }
    // (a group with two committees is read only when both were)
    for(const k of groupsFailed)groupsRead.delete(k);
    if(groupsFailed.has('aipac')){routed={};routedRead=false;}
    console.log(`Forwarded gifts: ${groupsRead.size} of ${new Set(conduits.map(c=>c.key)).size} groups read; ${Object.keys(earmarkTotals(got.filter(g=>groupsRead.has(g.key)))).length} members got some.`);
  }else console.log('No FEC_API_KEY in .dev.vars: gifts forwarded by groups (AIPAC and others) aren\'t read, only their PAC checks.');
  const trackers=trackerTotals(tracked,byCand,routed);
  const out={about:'Corporate PAC money to each sitting member of Congress this cycle, from FEC bulk files. See scripts/build-corporate-pacs.mjs.',
    built:new Date().toISOString().slice(0,10),cycle,through:through||null,
    sources:[{file:path.basename(cm.file),downloaded:cm.downloaded,url:`${BASE}/${cycle}/cm${yy}.zip`},{file:path.basename(pas2.file),downloaded:pas2.downloaded,url:`${BASE}/${cycle}/pas2${yy}.zip`}],
    people,trackers,routed:{aipac:routedRead,groups:[...groupsRead],failed:[...groupsFailed]},kinds:kindTotals(byKind,byCand),
    earmarks:earmarkTotals(got.filter(g=>groupsRead.has(g.key)))};
  fs.writeFileSync(path.join(ROOT,'public','corporate-pacs.json'),JSON.stringify(out));
  console.log(`Wrote public/corporate-pacs.json: ${vals.length} members read, ${vals.filter(v=>v[0]>0).length} took corporate PAC money, ${vals.filter(v=>!v[0]).length} took none (${checks.length} checks, through ${through||'?'}).`);
  for(const t of TRACKERS)console.log(`  ${t.name}: ${Object.keys(trackers[t.key]).length} took some`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exit(1);});
