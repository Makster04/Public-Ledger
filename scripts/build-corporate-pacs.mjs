// Who took corporate PAC money this cycle, and money from each tracker (AIPAC, Big Pharma + Insurance, Big Oil, Big
// Tech + AI, Crypto, Big Defense, Wall Street): every sitting member of the House and the Senate, for the home page's seating charts (public/seats.js) and
// their filter. From two FEC bulk files for the cycle (no API key):
//   pas2  "Contributions from committees to candidates & independent expenditures": each PAC check, with the committee
//         that gave it and the candidate it went to
//   cm    the committee master file: each committee's registration (committee type, designation, the sponsoring
//         organization's type)
// A check counts when it's a direct or in-kind contribution (24K, 24Z; memo lines left out, refunds subtracted) from a
// committee public/pac-types.js calls a corporate PAC (sponsored by a corporation, or a corporation without capital
// stock), the same rule as the site's "Corporate PAC" label. Members are matched by their FEC candidate ID
// (public/senate.json and public/house.json fecCand) and their other candidate IDs (linkedCandidates: a House member now
// in the Senate, or running for it in 2026, files under a new ID). A tracker's checks are those from its PACs, matched as its
// Tracker matches them (public/trackers.js isTrackerPac: by committee ID or name).
// Some groups also forward their donors' gifts to campaigns (earmarked, "routed"): AIPAC, Club for Growth, EMILY's List,
// J Street, the Senate Conservatives Fund, and every other group the reviewed profiles' search found doing it
// (public/research.json "bundled": conduits and names, from scripts/build-bundled.mjs). For each, every payment its PAC
// made this cycle (FEC Schedule B, 100 a page), read the way the reviewed profiles' search reads them
// (scripts/build-bundled.mjs conduitTotals: a payment that says "earmark" is a forwarded gift, the total line when there
// is one, else the memo entries), and added up by the campaign committee it went to. The FEC's totals by recipient
// leave most forwarded gifts out, so they aren't used. Read when FEC_API_KEY is in .dev.vars: several hundred requests
// in all (AIPAC's and the Senate Conservatives Fund's run to tens of thousands of payments), so a run can pass the FEC's
// hourly limit; it then waits and goes on. The pages read are saved in .local/fec-conduits/ (re-read when over a week
// old, or with --refresh), so a run that stops picks up where it left off, and a group that still can't be read keeps
// the totals of the last file. Writes public/corporate-pacs.json:
//   people: {id: [corporate PAC dollars, number of corporate PACs]} for every member whose candidate ID is known; a
//   member who isn't listed hasn't been read.
//   trackers: {key: {id: [PAC dollars, number of its PACs, routed dollars (AIPAC)]}}, only members who took some;
//   routed: {method: "payments", aipac: true when its forwarded gifts are in, groups: [the groups read], kept: [groups
//   that couldn't be read this time, with the last file's totals], failed: [groups that couldn't be, with none kept]}.
//   earmarks: {id: {group: [forwarded dollars, gifts, the campaign committee they went to]}}, only members some group
//   forwarded gifts to; group is research.json's key ("aipac", "cfg", …) or "fec:" and the committee ID, as on the full
//   profiles. (A file without method "payments" was made from the FEC's totals by recipient, and the page ignores its
//   forwarded gifts.)
//   kinds: {id: {kind: dollars}}, each member's PAC checks by the kind of PAC that gave (public/pac-types.js pacKind;
//   party committees left out, as the FEC's PAC total leaves them out), so Big Money Independence can weigh PAC money by
//   type for every member, not only the profiles with reviewed PAC lines.
//
// It also writes public/tracker-history.json, each member's career totals from each tracker, for the Career Totals page
// (approved 2026-11-13, in place of the Tiers): the same PAC checks from every cycle's pas2 and cm files back to 1980
// (the first the FEC's bulk files have), matched to the members the same way, under every candidate ID they've had: the
// FEC IDs congress-legislators lists for them (legislators-current.json, by their bioguide ID; a House member now in the
// Senate filed under a House ID before), and the IDs the FEC's candidate files (cn) link to them (pastCandidates: the
// same principal campaign committee in the same state, a House incumbent's ID with the same name and state, or this
// cycle's Senate run). For AIPAC, also the gifts it collected from donors and passed on, in every cycle since its PAC
// began giving (2022), read from its payments like this cycle's (with FEC_API_KEY; the pages are saved in
// .local/fec-conduits/<cycle>/, and a past cycle's are read once). A cycle that can't be read keeps the last file's.
//   {about, built, cycles: [1980, …, 2026], from, through, people: {id: 1} for every member read,
//    trackers: {key: {id: [PAC dollars, number of its PACs, first cycle, last cycle]}}, only members who took some,
//    routed: {aipac: {cycle: {id: dollars}}} for the cycles read, routedCycles: [the cycles read],
//    routedMissing: [the cycles since 2022 not read], linked: {id: [their other candidate IDs]}}
// Files for cycles before the last three are downloaded once (delete them from .local/fec-bulk/ to read them again);
// all the cycles' pas2 files come to about 300 MB.
// At the end it updates public/news.json (scripts/build-news.mjs), the ticker's news, from the same files.
//
//   npm run corporate:pacs               downloads into .local/fec-bulk/ (the pas2 file is shared with
//                                        scripts/build-funder-history.mjs) and writes the file; files over a week old
//                                        are downloaded again
//   npm run corporate:pacs -- --refresh  downloads them again now, and reads every group's payments again
//   FEC_BULK_BASE=<url> npm run ...      a mirror of https://www.fec.gov/files/bulk-downloads
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pacKind} from '../public/pac-types.js';
import {writeSuperPacRaces} from './build-super-pac-races.mjs';
import {TRACKERS,isTrackerPac} from '../public/trackers.js';
import {requestSource,fecNext} from '../src/sources.mjs';
import {conduitTotals} from './build-bundled.mjs';

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
// The groups whose forwarded gifts are read: research.json "bundled" conduits ({group: [committee IDs]}) and the other
// committees its search found forwarding gifts (names: {"fec:C…": name}). [{key, cmte}], each committee once.
export function conduitList(bundled){
  const out=[],seen=new Set(),add=(key,cmte)=>{if(/^C\d{8}$/.test(cmte||'')&&!seen.has(cmte)){seen.add(cmte);out.push({key,cmte});}};
  for(const [key,ids] of Object.entries(bundled?.conduits||{}))for(const id of ids||[])add(key,id);
  for(const key of Object.keys(bundled?.names||{}))if(key.startsWith('fec:'))add(key,key.slice(4));
  return out;
}
// One group's payments (FEC Schedule B rows) added up by member: each campaign committee's rows read as the reviewed
// profiles' search reads them (conduitTotals), then a member's committees together. {id: {routed, n, cmte: the committee
// that got the most}}. cmteCand: campaign committee -> candidate ID.
export function paymentTotals(rows,cmteCand,byCand){
  const byCmte=new Map();
  for(const r of rows||[]){const c=r.recipient_committee_id;if(!c||!byCand.has(cmteCand.get(c)))continue;if(!byCmte.has(c))byCmte.set(c,[]);byCmte.get(c).push(r);}
  const out={};
  for(const [c,list] of byCmte){
    const t=conduitTotals(list);if(!(t.routed>0))continue;
    const id=byCand.get(cmteCand.get(c)),o=out[id];
    out[id]=o?{routed:Math.round((o.routed+t.routed)*100)/100,n:o.n+t.n,cmte:t.routed>o.best?c:o.cmte,best:Math.max(o.best,t.routed)}:{routed:t.routed,n:t.n,cmte:c,best:t.routed};
  }
  for(const o of Object.values(out))delete o.best;
  return out;
}
// The fields of a payment that are kept in the page cache (the rest of a Schedule B row isn't needed).
export const slimPayment=r=>({recipient_committee_id:r.recipient_committee_id??null,disbursement_amount:r.disbursement_amount,disbursement_date:r.disbursement_date,
  disbursement_description:r.disbursement_description??null,memo_text:r.memo_text??null,memo_code:r.memo_code??null,memoed_subtotal:r.memoed_subtotal??null});
// Each member's forwarded gifts from each group: got [{key, byMember: paymentTotals}] -> {id: {group: [dollars, gifts,
// committee]}}; a group with two committees adds up. kept: {group: the last file's earmarks}, for a group that couldn't
// be read this time.
export function earmarkTotals(got,kept={}){
  const out={};
  const add=(id,key,routed,n,cmte)=>{if(!(routed>0))return;const o=out[id]||(out[id]={}),p=o[key];o[key]=[Math.round(((p?.[0]||0)+routed)*100)/100,(p?.[1]||0)+(n||0),p?.[2]||cmte||null];};
  for(const g of got)for(const [id,v] of Object.entries(g.byMember||{}))add(id,g.key,v.routed,v.n,v.cmte);
  for(const [key,prev] of Object.entries(kept))for(const [id,groups] of Object.entries(prev||{})){const v=groups?.[key];if(v)add(id,key,v[0],v[1],v[2]);}
  return out;
}
// The last file's forwarded gifts for these groups ({group: {id: {group: [...]}}}), when it was read from the payments.
export function keptEarmarks(prev,groups){
  if(prev?.routed?.method!=='payments')return {};
  const out={};for(const key of groups){const by={};for(const [id,g] of Object.entries(prev.earmarks||{}))if(g?.[key])by[id]={[key]:g[key]};if(Object.keys(by).length||(prev.routed.groups||[]).includes(key))out[key]=by;}
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

async function download(name,cycle,dir,refresh,maxAge=WEEK){
  const file=path.join(dir,name);
  if(maxAge===Infinity)refresh=false;
  const old=fs.existsSync(file)&&Date.now()-fs.statSync(file).mtimeMs>maxAge;
  if((refresh||old)&&fs.existsSync(file))fs.rmSync(file);
  if(!fs.existsSync(file)){
    console.log(`Downloading ${BASE}/${cycle}/${name}…`);
    const r=await fetch(`${BASE}/${cycle}/${name}`);
    if(!r.ok)throw new Error(`Download failed (HTTP ${r.status}) for ${name}`);
    fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));
  }
  return {file,downloaded:fs.statSync(file).mtime.toISOString().slice(0,10)};
}
export async function* lines(zip,inner){
  const p=spawn('unzip',['-p',zip,inner]);
  let err='';p.stderr.on('data',d=>err+=d);
  yield* readline.createInterface({input:p.stdout,crlfDelay:Infinity});
  const code=await new Promise(res=>p.on('close',res));
  if(code)throw new Error(`unzip failed for ${zip}: ${err}`);
}

// Every payment one committee made in a cycle (Schedule B, 100 a page, newest first), with each page saved in dir so a
// run that stops picks up where it left off; a saved read over a week old (or with refresh) is read again. When the
// FEC's hourly limit is reached (HTTP 429), it waits (what the FEC says, else 10 minutes) and goes on, up to 7 times.
// When the FEC times out (HTTP 502, 503 or 504, common on a big committee's later pages), it asks again after 30
// seconds, then 1 and 2 minutes, before stopping; any other error stops it at once.
export async function conduitPayments(cmte,cycle,{dir,refresh=false,label=cmte,get=url=>requestSource(url,process.env),wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now(),log=console.log,maxAge=WEEK}={}){
  const file=path.join(dir,`${cmte}.json`);
  let saved=null;try{saved=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
  // (a past cycle's payments are final: a complete read is kept, and an unfinished one goes on from where it stopped)
  if(saved&&(maxAge===Infinity?refresh&&!saved.done:refresh||!(now-Date.parse(saved.started)<=maxAge)))saved=null;
  if(saved?.done)return saved.rows;
  const st=saved||{cmte,cycle,started:new Date(now).toISOString(),rows:[],next:`https://api.open.fec.gov/v1/schedules/schedule_b/?committee_id=${cmte}&two_year_transaction_period=${cycle}&per_page=100&sort=-disbursement_date`,pages:0,done:false};
  log(`Reading ${label}'s payments${st.pages?` (picking up at page ${st.pages+1})`:''}…`);
  let tries=0,slow=0;
  while(st.next){
    let d;
    try{d=await get(st.next);tries=0;slow=0;}
    catch(e){
      if([502,503,504].includes(e.statusCode)&&++slow<=3){
        const ms=30000*2**(slow-1);log(`  The FEC timed out reading ${label} (page ${st.pages+1}); asking again in ${ms<60000?`${ms/1000} seconds`:`${ms/60000} minute${ms===60000?'':'s'}`}.`);
        await wait(ms);continue;
      }
      if(e.statusCode!==429||++tries>7)throw e;
      const ms=e.retryAfter||600000;log(`  The FEC's hourly limit was reached reading ${label} (page ${st.pages+1}); waiting ${Math.round(ms/60000)} minutes, then going on.`);
      await wait(ms);continue;
    }
    st.rows.push(...(d.results||[]).map(slimPayment));st.next=fecNext(st.next,d);st.pages++;st.done=!st.next;
    fs.writeFileSync(file,JSON.stringify(st));
    if(st.pages%25===0)log(`  ${label}: ${st.pages} pages, ${st.rows.length} payments so far…`);
  }
  return st.rows;
}

// One cn.txt line (the FEC's candidate file) -> {cand, name, party, year, state, office, ici, pcc}, or null.
export function candidateRow(line){
  const c=String(line).split('|');if(c.length<10||!/^[HSP]\d[A-Z0-9]+$/.test(c[0]))return null;
  return {cand:c[0],name:c[1],party:c[2],year:Number(c[3])||0,state:c[4],office:c[5],ici:c[7],pcc:c[9]||null};
}
// "BUDD, THEODORE P." -> "BUDD|THEODORE": the last name and the first word of the first.
const nameKey=n=>{const [last,first]=String(n||'').toUpperCase().split(',');return `${(last||'').replace(/[^A-Z]/g,'')}|${String(first||'').trim().split(/\s+/)[0].replace(/[^A-Z]/g,'')}`;};
// Each member's other candidate IDs: those naming the same principal campaign committee as a current ID of theirs, in
// the same state (a House member now in the Senate, or running for it); House IDs with the same name and state that
// ran as an incumbent from the first of these cycles on (one who opened a new committee for the Senate); and Senate IDs
// in the latest cycle with the same name, state and party that aren't the incumbent's (a House member running for the
// Senate under a new committee, like Haley Stevens). The rules leave out a namesake's IDs (Rob Menendez Jr. and his
// father's Senate and old House IDs) and a filing that lists another state's committee. rows: candidate rows from every
// cycle read; byCand: current candidate ID -> member; from, latest: the first and last cycles. {member id: [other IDs]}.
export function pastCandidates(rows,byCand,from=0,latest=Infinity){
  const pcc=new Map(),who=new Map();
  for(const r of rows){if(byCand.has(r.cand)){const id=byCand.get(r.cand);if(r.pcc)pcc.set(`${r.pcc}|${r.state}`,id);who.set(`${nameKey(r.name)}|${r.state}`,id);who.set(`${nameKey(r.name)}|${r.state}|${r.party}`,id);}}
  const out={};
  for(const r of rows){
    if(byCand.has(r.cand)||!['H','S'].includes(r.office))continue;
    const id=(r.pcc&&pcc.get(`${r.pcc}|${r.state}`))||(r.office==='H'&&r.ici==='I'&&r.year>=from?who.get(`${nameKey(r.name)}|${r.state}`):null)
      ||(r.office==='S'&&r.ici!=='I'&&r.year>=latest&&r.party?who.get(`${nameKey(r.name)}|${r.state}|${r.party}`):null);
    if(id&&!(out[id]||=[]).includes(r.cand))out[id].push(r.cand);
  }
  return out;
}
// The last three cycles (six years): the candidate files read for links, and the bulk files downloaded again when over a
// week old (an older cycle's are downloaded once).
export const HISTORY_CYCLES=3;
export const historyCycles=cycle=>Array.from({length:HISTORY_CYCLES},(_,i)=>cycle-2*(HISTORY_CYCLES-1-i));
// Each member's other candidate IDs, from the candidate files of the last three cycles: {linked: {member id: [IDs]},
// both: byCand with those IDs added}. Used for this cycle's totals (a House member running for the Senate in 2026
// files under a new ID) and the career totals (with congress-legislators' IDs).
export async function linkedCandidates({cycle,dir,refresh=false,byCand}){
  const cycles=historyCycles(cycle),rows=[];
  for(const cy of cycles){const cn=await download(`cn${String(cy).slice(2)}.zip`,cy,dir,refresh);for await(const line of lines(cn.file,'cn.txt')){const r=candidateRow(line);if(r)rows.push(r);}}
  const linked=pastCandidates(rows,byCand,cycles[0],cycles.at(-1)),both=new Map(byCand);
  for(const [id,ids] of Object.entries(linked))for(const c of ids)both.set(c,id);
  return {linked,both};
}
// The career's cycles: every one in the FEC's bulk files, 1980 to this one.
export const CAREER_FROM=1980;
export const careerCycles=cycle=>Array.from({length:Math.floor((cycle-CAREER_FROM)/2)+1},(_,i)=>CAREER_FROM+2*i);
// AIPAC's PAC began giving in the 2022 cycle (it was set up in December 2021), so its passed-on gifts are read from then.
export const AIPAC_FROM=2022,AIPAC_PAC='C00797670';
// Each member's FEC candidate IDs from congress-legislators (legislators-current.json: id.bioguide, id.fec), by the
// bioguide ID senate.json and house.json give them. {member id: [IDs]}.
export function legislatorIds(people,legislators){
  const by=new Map((legislators||[]).map(x=>[x?.id?.bioguide,x]));const out={};
  for(const p of people||[]){const ids=(by.get(p.bioguide)?.id?.fec||[]).filter(id=>/^[HSP]\d[A-Z0-9]+$/.test(id));if(ids.length)out[p.id]=ids;}
  return out;
}
// Every candidate ID of each member over their career: their current and past IDs (byCand), the links found in the
// candidate files (linked) and congress-legislators' (legIds). An ID two members claim is left with the one it was
// first given to. {both: Map(ID -> member), linked: {member: [the IDs other than their current ones]}}.
export function careerIds(byCand,linked={},legIds={}){
  const both=new Map(byCand),own=new Set(byCand.keys()),out={};
  for(const src of [linked,legIds])for(const [id,ids] of Object.entries(src||{}))for(const c of ids||[]){if(!both.has(c))both.set(c,id);if(both.get(c)===id&&!own.has(c)&&!(out[id]||=[]).includes(c))out[id].push(c);}
  return {both,linked:out};
}
// Career sums from each cycle's tracker checks: add(checks, cycle) for one cycle's [{cand, cmte, amount, keys}], then
// totals() -> {key: {id: [PAC dollars, its PACs that gave, first cycle, last cycle]}}, only members who took some (refunds
// subtracted; a cycle counts for first and last when it left them with money from the tracker).
export function careerSums(byCand){
  const acc=Object.fromEntries(TRACKERS.map(t=>[t.key,new Map()]));
  return {
    add(checks,cycle){
      const by=new Map();
      for(const x of checks){const id=byCand.get(x.cand);if(!id)continue;for(const k of x.keys){const key=`${k}|${id}`,o=by.get(key)||{k,id,amount:0,pacs:new Map()};o.amount+=x.amount;o.pacs.set(x.cmte,(o.pacs.get(x.cmte)||0)+x.amount);by.set(key,o);}}
      for(const o of by.values()){const m=acc[o.k],p=m.get(o.id)||{amount:0,pacs:new Map(),first:null,last:null};p.amount+=o.amount;for(const [c,v] of o.pacs)p.pacs.set(c,(p.pacs.get(c)||0)+v);
        if(o.amount>0){p.first=p.first==null?cycle:Math.min(p.first,cycle);p.last=p.last==null?cycle:Math.max(p.last,cycle);}m.set(o.id,p);}
    },
    totals(){
      const out={};
      for(const [k,m] of Object.entries(acc)){out[k]={};for(const [id,p] of m){const v=Math.round(p.amount*100)/100;if(v>0)out[k][id]=[v,[...p.pacs.values()].filter(x=>x>0).length,p.first,p.last];}}
      return out;
    }};
}
// AIPAC's passed-on gifts by cycle: this run's (got: {cycle: {id: dollars}}) and, for a cycle this run couldn't read, the
// last file's. {routed: {aipac: {cycle: {...}}}, routedCycles, routedMissing}.
export function careerRouted(got,prev,cycles){
  const want=cycles.filter(c=>c>=AIPAC_FROM),aipac={};
  for(const c of want){const v=got?.[c]??prev?.routed?.aipac?.[c];if(v)aipac[c]=v;}
  const read=want.filter(c=>aipac[c]);
  return {routed:{aipac},routedCycles:read,routedMissing:want.filter(c=>!aipac[c])};
}
// Reads every cycle since 1980 and returns the career file's contents. routedNow: this cycle's AIPAC gifts by member
// (null when they weren't read); prev: the last file; legIds: congress-legislators' IDs by member.
export async function careerHistory({cycle,dir,refresh=false,byCand,through='',links,legIds={},routedNow=null,prev=null,apiKey=false,log=console.log}){
  const cycles=careerCycles(cycle),recent=new Set(cycles.slice(-HISTORY_CYCLES));let last=through;
  const {both,linked}=careerIds(byCand,links?.linked,legIds),sums=careerSums(both),got={};
  if(routedNow)got[cycle]=routedNow;
  const today=new Date().toISOString().slice(0,10);
  for(const cy of cycles){
    const yy=String(cy).slice(2),age=recent.has(cy)?WEEK:Infinity;
    const cm=await download(`cm${yy}.zip`,cy,dir,refresh,age),pas2=await download(`pas2${yy}.zip`,cy,dir,refresh,age),names=new Map(),cmteCand=new Map(),keysOf=new Map(),checks=[];
    for await(const line of lines(cm.file,'cm.txt')){const k=committeeKind(line);if(!k)continue;names.set(k[0],k[2]);if(k[3])cmteCand.set(k[0],k[3]);}
    for await(const line of lines(pas2.file,'itpas2.txt')){
      const x=committeeCheck(line);if(!x||!both.has(x.cand))continue;
      if(!keysOf.has(x.cmte))keysOf.set(x.cmte,trackersOf(x.cmte,names.get(x.cmte)));
      const keys=keysOf.get(x.cmte);if(!keys.length)continue;checks.push({...x,keys});
      if(cy===cycle){const d=iso(x.date);if(d>last&&d<=today)last=d;}
    }
    sums.add(checks,cy);
    // AIPAC's passed-on gifts in an earlier cycle since 2022, from its payments that cycle.
    if(cy>=AIPAC_FROM&&cy<cycle&&apiKey){
      try{
        const cacheDir=path.join(ROOT,'.local','fec-conduits',String(cy));fs.mkdirSync(cacheDir,{recursive:true});
        const rows=await conduitPayments(AIPAC_PAC,cy,{dir:cacheDir,refresh,label:`AIPAC (${cy-1}–${cy})`,maxAge:Infinity});
        got[cy]=Object.fromEntries(Object.entries(paymentTotals(rows,cmteCand,both)).map(([id,v])=>[id,v.routed]));
      }catch(e){log(`AIPAC's ${cy-1}–${cy} payments couldn't all be read (${e.message}); the pages read so far are saved for the next run.`);}
    }
    if(cy%10===0||cy===cycle)log(`  Career totals: read through ${cy-1}–${cy}.`);
  }
  return {about:'Each sitting member\'s career totals from each tracker: PAC checks in every cycle since 1980 (the FEC\'s bulk files), under every candidate ID they\'ve had, and the gifts AIPAC passed on since its PAC began giving (2022), for the Career Totals page. See scripts/build-corporate-pacs.mjs.',
    built:today,cycles,from:`${cycles[0]-1}-01-01`,through:last||null,
    people:Object.fromEntries([...new Set(byCand.values())].map(id=>[id,1])),trackers:sums.totals(),...careerRouted(got,prev,cycles),linked};
}
const LEGISLATORS='https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json';
// congress-legislators' current members file (public domain), saved in .local/legislators/ and read again when over a
// week old. null when it can't be had (the candidate files' links are used alone).
async function legislatorsFile(refresh){
  const dir=path.join(ROOT,'.local','legislators'),file=path.join(dir,'legislators-current.json');fs.mkdirSync(dir,{recursive:true});
  const fresh=fs.existsSync(file)&&Date.now()-fs.statSync(file).mtimeMs<=WEEK;
  if(!fresh||refresh){try{const r=await fetch(LEGISLATORS,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}
    catch(e){console.warn(`Couldn't download congress-legislators (${e.message})${fs.existsSync(file)?'; using the saved copy':''}.`);}}
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
}

async function main(argv){
  const config=JSON.parse(fs.readFileSync(path.join(ROOT,'data','config.json'),'utf8'));
  const cycle=Number(argv[argv.indexOf('--cycle')+1])||Number(config.cycle)||2026,yy=String(cycle).slice(2),refresh=argv.includes('--refresh');
  const dir=process.env.FEC_BULK_DIR||path.join(ROOT,'.local','fec-bulk');fs.mkdirSync(dir,{recursive:true});
  const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,'public',f),'utf8'));
  const members=membersByCandidate(read('senate.json'),read('house.json'));
  // Each member's other candidate IDs count this cycle too (a House member running for the Senate in 2026 files under a
  // new ID): byCand has them; the career totals use the same links.
  const links=await linkedCandidates({cycle,dir,refresh,byCand:members}),byCand=links.both;
  if(Object.keys(links.linked).length)console.log(`Other candidate IDs linked for ${Object.keys(links.linked).length} members (a House member now in the Senate, or running for it).`);
  const cm=await download(`cm${yy}.zip`,cycle,dir,refresh),pas2=await download(`pas2${yy}.zip`,cycle,dir,refresh);
  const kinds=new Map(),names=new Map(),cmteCand=new Map();
  for await(const line of lines(cm.file,'cm.txt')){const k=committeeKind(line);if(!k)continue;kinds.set(k[0],k[1]);names.set(k[0],k[2]);if(k[3])cmteCand.set(k[0],k[3]);}
  const conduits=conduitList(read('research.json').bundled);
  const checks=[],tracked=[],byKind=[],keysOf=new Map();let through='';const today=new Date().toISOString().slice(0,10);
  for await(const line of lines(pas2.file,'itpas2.txt')){
    const x=committeeCheck(line);if(!x||!byCand.has(x.cand))continue;
    if(!keysOf.has(x.cmte))keysOf.set(x.cmte,trackersOf(x.cmte,names.get(x.cmte)));
    const keys=keysOf.get(x.cmte),corp=kinds.get(x.cmte)==='corporate';byKind.push({cand:x.cand,kind:kinds.get(x.cmte)||'other',amount:x.amount});if(!corp&&!keys.length)continue;
    if(corp)checks.push(x);if(keys.length)tracked.push({...x,keys});
    const d=iso(x.date);if(d>through&&d<=today)through=d;
  }
  const people=corporateTotals(checks,byCand),vals=Object.values(people);
  // Each group's forwarded gifts, from every payment its PAC made this cycle, with the FEC key; without it, the
  // groups' PAC checks alone (and the page says so).
  let routed={};const got=[],readOk=new Set(),failed=new Set(),keys=[...new Set(conduits.map(c=>c.key))];
  let prev=null;try{prev=JSON.parse(fs.readFileSync(path.join(ROOT,'public','corporate-pacs.json'),'utf8'));}catch{}
  if(process.env.FEC_API_KEY){
    const cacheDir=path.join(ROOT,'.local','fec-conduits',String(cycle));fs.mkdirSync(cacheDir,{recursive:true});
    for(const c of conduits){
      try{
        const rows=await conduitPayments(c.cmte,cycle,{dir:cacheDir,refresh,label:names.get(c.cmte)||c.key});
        got.push({key:c.key,byMember:paymentTotals(rows,cmteCand,byCand)});
      }catch(e){failed.add(c.key);console.log(`${names.get(c.cmte)||c.key}'s payments couldn't all be read (${e.message}); the pages read so far are saved for the next run.`);}
    }
    for(const k of keys)if(!failed.has(k))readOk.add(k);
  }else console.log('No FEC_API_KEY in .dev.vars: gifts forwarded by groups (AIPAC and others) aren\'t read, only their PAC checks.');
  // (a group with two committees counts only when both were read; one that wasn't keeps the last file's totals)
  const kept=keptEarmarks(prev,[...failed]),earmarks=earmarkTotals(got.filter(g=>readOk.has(g.key)),kept);
  for(const [id,g] of Object.entries(earmarks))if(g.aipac)routed[id]=g.aipac[0];
  const aipacIn=readOk.has('aipac')||'aipac' in kept;
  if(process.env.FEC_API_KEY)console.log(`Forwarded gifts: ${readOk.size} of ${keys.length} groups read${Object.keys(kept).length?`, ${Object.keys(kept).length} kept from the last file`:''}; ${Object.keys(earmarks).length} members got some.`);
  const trackers=trackerTotals(tracked,byCand,routed);
  // Career totals: every cycle since 1980, under every candidate ID each member has had.
  const sitting=[...(read('senate.json').senators||[]),...(read('house.json').members||[])],leg=await legislatorsFile(refresh);
  let prevHistory=null;try{prevHistory=JSON.parse(fs.readFileSync(path.join(ROOT,'public','tracker-history.json'),'utf8'));}catch{}
  const history=await careerHistory({cycle,dir,refresh,byCand:members,through,links,legIds:legislatorIds(sitting,leg),
    routedNow:aipacIn?routed:null,prev:prevHistory?.routed?prevHistory:null,apiKey:!!process.env.FEC_API_KEY});
  fs.writeFileSync(path.join(ROOT,'public','tracker-history.json'),JSON.stringify(history));
  console.log(`Wrote public/tracker-history.json: career totals ${history.cycles[0]-1}–${cycle}, through ${history.through}; AIPAC's passed-on gifts for ${history.routedCycles.length?history.routedCycles.map(c=>`${c-1}–${String(c).slice(2)}`).join(', '):'no cycle yet'}${history.routedMissing.length?` (not read: ${history.routedMissing.map(c=>`${c-1}–${String(c).slice(2)}`).join(', ')})`:''}.`);
  // The trackers' super PACs in this cycle's races, primaries and generals (scripts/build-super-pac-races.mjs). A failed
  // download keeps the last file and doesn't stop the rest.
  try{await writeSuperPacRaces({cycle,dir,refresh});}
  catch(e){console.warn(`Couldn't build public/super-pac-races.json (${e.message}); the last file is kept. Try again with npm run superpacs:races.`);}
  const out={about:'Corporate PAC money to each sitting member of Congress this cycle, from FEC bulk files. See scripts/build-corporate-pacs.mjs.',
    built:new Date().toISOString().slice(0,10),cycle,through:through||null,
    sources:[{file:path.basename(cm.file),downloaded:cm.downloaded,url:`${BASE}/${cycle}/cm${yy}.zip`},{file:path.basename(pas2.file),downloaded:pas2.downloaded,url:`${BASE}/${cycle}/pas2${yy}.zip`}],
    people,trackers,routed:{method:'payments',aipac:aipacIn,groups:[...readOk],kept:Object.keys(kept),failed:[...failed].filter(k=>!(k in kept))},kinds:kindTotals(byKind,byCand),earmarks};
  fs.writeFileSync(path.join(ROOT,'public','corporate-pacs.json'),JSON.stringify(out));
  console.log(`Wrote public/corporate-pacs.json: ${vals.length} members read, ${vals.filter(v=>v[0]>0).length} took corporate PAC money, ${vals.filter(v=>!v[0]).length} took none (${checks.length} checks, through ${through||'?'}).`);
  for(const t of TRACKERS)console.log(`  ${t.name}: ${Object.keys(trackers[t.key]).length} took some`);
  // The ticker's news from the same files: the trackers' newest PAC checks and super PAC filings, and grade changes.
  try{const {writeNews}=await import('./build-news.mjs');await writeNews({dir});}
  catch(e){console.warn(`Couldn't update public/news.json (${e.message}); run npm run news:build.`);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exit(1);});
