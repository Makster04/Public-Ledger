// The trackers' super PACs in each midterm (approved 2026-11-26), for the tracker cards on the Super PACs page: what
// they spent for and against House and Senate candidates, primaries and generals together, how much of it went to
// candidates who won in November, and how many of the candidates they backed won. Two kinds of card:
//   own     Crypto, Big Tech + AI and the Pro-Israel Lobby run super PACs of their own: their spending as filed.
//   funded  The other five run none (approved 2026-11-26): what their companies, those companies' PACs and their trade
//           groups gave to super PACs that spent in the midterm (the FEC's itemized receipts: itoth for PACs' checks,
//           itcont for companies' and groups' gifts, read as they download and never saved), and the tracker's share of
//           each one's spending: what it gave ÷ everything that super PAC raised (webk), times each of its
//           expenditures. The candidates counted are those a super PAC it gave FUNDED_CUTOFF or more backed. Gifts from
//           people who work for its companies (by employer) are shown beside, never counted, as in Tracking Lobby Money.
//           Money given through nonprofits that don't name their donors can't be traced, so these are floors.
//   Spending: the FEC's bulk file of independent expenditures for the cycle (independent_expenditure_<year>.csv), each
//     transaction once (build-super-pac-races.mjs latestVersions); a tracker's super PACs by committee ID or name
//     (public/trackers.js isOwnSuperPac). A record without a candidate ID takes the one the file's other records give
//     the same seat and last name, else the results file's candidate, else the site's nominee.
//   Who won: the FEC's official results (federalelections<year>.xlsx, its general-election winner column), which come
//     out about a year after the election. Until then, the site's own race calls: public/research.json's races and
//     liteRaces and public/members-elect.json's races, and a sitting House member whose seat nobody else won was
//     re-elected. The candidates of a race not called yet count as open: their money shows apart, and they're left out
//     of the share who won.
// Writes public/midterm-trackers.json:
//   {about, built, years: {year: {results: 'fec' | 'site', through, trackers: {tracker key: {kind: 'own' | 'funded', for,
//    against, forWon, forLost, againstWon, againstLost, supported: {n, won, open}, pacs: [{id, name, for, against,
//    supported}], and for a funded one: gave, employees, funded (super PACs given FUNDED_CUTOFF or more), each pac's
//    gave and share (% of its money)}}}}}
// 2018 has no tracker's own super PAC spending (the first, United Democracy Project, began in 2021), only the five
// funded cards. Run by npm run corporate:pacs for the current cycle when it's a midterm, or on its own:
//   npm run superpacs:midterms                every midterm in MIDTERMS (files kept in .local/fec-bulk/)
//   npm run superpacs:midterms -- 2026        one midterm, the others kept from the last file
//   npm run superpacs:midterms -- --refresh   downloads the files again now
//   npm run superpacs:midterms -- --own       only the trackers' own super PACs (skips the donor files, several GB each)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import {Readable,Transform} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {readIeRecords,latestVersions,seatOf,isoDate,download} from './build-super-pac-races.mjs';
import {xlsxSheets,unzip} from './xlsx.mjs';
import {TRACKERS,isOwnSuperPac} from '../public/trackers.js';
import {FUNDED_CUTOFF} from '../public/midterm-trackers.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE=process.env.FEC_BULK_BASE||'https://www.fec.gov/files/bulk-downloads';
const RESULTS_BASE='https://www.fec.gov/resources/cms-content/documents';
export const MIDTERMS=[2026,2022,2018],OUT='public/midterm-trackers.json';
export {FUNDED_CUTOFF};
export const SUPER_PAC_TYPES=new Set(['O','V','W']);
const STATES={Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY'};

// A last name to match on: "SMITH, JOHN JR" or "John Smith Jr." -> "SMITH".
export function lastName(n){
  const s=String(n||'').trim();
  const last=s.includes(',')?s.split(',')[0]:s.split(/\s+/).filter(w=>!/^(jr|sr|ii|iii|iv)\.?$/i.test(w)).pop();
  return String(last||'').toUpperCase().replace(/[^A-Z' -]/g,'').replace(/\s+(JR|SR|II|III|IV)$/,'').trim();
}
const seatKey=(chamber,state,district)=>seatOf(chamber,state,chamber==='H'?String(Number(district)||0):'');

// The FEC's results workbook: the general-election winners' candidate IDs, and every candidate by seat (for records
// without a candidate ID). Column names vary a little by year ("FEC ID" or "FEC ID#").
export function fecResults(sheets){
  const won=new Set(),seats=new Map();
  for(const s of sheets){
    const head=s.rows.find(r=>r.some(h=>/^FEC ID/i.test(String(h).trim())));if(!head)continue;
    const H=head.map(h=>String(h).trim().toUpperCase().replace(/^FEC ID#$/,'FEC ID')),ix=k=>H.indexOf(k);
    const iId=ix('FEC ID'),iW=ix('GE WINNER INDICATOR'),iSt=ix('STATE ABBREVIATION'),iD=ix('DISTRICT'),iLast=ix('CANDIDATE NAME (LAST)');
    if(iId<0||iW<0)continue;
    for(const r of s.rows){
      const id=String(r[iId]||'').trim();if(!/^[HS]\d/.test(id))continue;
      if(String(r[iW]||'').trim().toUpperCase()==='W')won.add(id);
      const seat=seatKey(id[0],String(r[iSt]||'').trim(),r[iD]);if(!seat)continue;
      (seats.get(seat)||seats.set(seat,[]).get(seat)).push({id,last:lastName(r[iLast])});
    }
  }
  return {won,seats};
}

// The site's own race calls, for a midterm the FEC hasn't published results for yet: {won, open (candidates of races
// not called yet), nominees: [[seat, last name, candidate ID]]}.
export function siteResults({research={},elect={},house={},senate={}}){
  const listOf=x=>Array.isArray(x)?x:x?.members||x?.senators||[];
  const people=[...(research.members||[]),...(research.cands||[]),...(research.featured||[]),...listOf(house),...listOf(senate),...(elect.members||[])];
  const fec=new Map();for(const p of people)if(p.id&&p.fecCand&&!fec.has(p.id))fec.set(p.id,p.fecCand);
  const won=new Set(),open=new Set(),decided=new Set(),nominees=[];
  const raceSeat=id=>{const m=/^([HS])-([A-Z]{2})(?:-(\d+))?$/.exec(id||'');return m?seatKey(m[1],m[2],m[3]):null;};
  for(const race of [...(research.races||[]),...(research.liteRaces||[]),...(elect.races||[])]){
    const seat=raceSeat(race.id),w=race.result?.winner;
    const ids=[...(race.nominees||[]).map(n=>n.fecCand),...(race.keys||[]).map(k=>fec.get(k))].filter(Boolean);
    for(const n of race.nominees||[])if(n.fecCand&&seat)nominees.push([seat,lastName(n.name),n.fecCand]);
    if(!w){for(const id of ids)open.add(id);continue;}
    const n=(race.nominees||[]).find(x=>(x.id||x.fecCand)===w),id=n?.fecCand||fec.get(w)||(/^[HS]\d/.test(w)?w:null);
    if(id)won.add(id);if(seat)decided.add(seat);
  }
  for(const p of people){
    if(!p.fecCand)continue;const st=p.state?.length===2?p.state:STATES[p.stateName];if(!st)continue;
    const seat=seatKey(p.fecCand[0],st,p.district??String(p.seat||'').split('-')[1]);if(seat)nominees.push([seat,lastName(p.name),p.fecCand]);
  }
  // A sitting House member whose seat had no race on file was re-elected (a seat with a member-elect is in elect.races).
  for(const m of listOf(house)){if(m.delegate||!m.fecCand||!m.state)continue;const seat=seatKey('H',m.state,m.district);if(seat&&!decided.has(seat))won.add(m.fecCand);}
  for(const id of won)open.delete(id);
  return {won,open,nominees};
}

const cents=n=>Math.round(n*100)/100;
// A candidate they backed counts once, however much was spent, and only when the net spending for them is above zero.
const count=m=>{const v=[...m.values()].filter(x=>x.amt>0);return {n:v.length,won:v.filter(x=>x.res===true).length,open:v.filter(x=>x.res===null).length};};
// The midterm's records -> each tracker's totals. won: the winners' candidate IDs; open: candidates whose race isn't
// called yet; seats (results file) and nominees (the site's) fill in a record without a candidate ID.
// The candidate a record is about: {seat, key, id} (key: the ID, else seat and last name), or null outside the House and
// Senate.
function candidateOf(recs,{seats=new Map(),nominees=[]}){
  const fileIds=new Map();
  for(const r of recs){const seat=seatOf(r.can_office,r.can_office_state,r.can_office_dis);if(seat&&r.cand_id)fileIds.set(`${seat}|${lastName(r.cand_name)}`,r.cand_id);}
  for(const [seat,last,id] of nominees)if(!fileIds.has(`${seat}|${last}`))fileIds.set(`${seat}|${last}`,id);
  return r=>{const seat=seatOf(r.can_office,r.can_office_state,r.can_office_dis);if(!seat)return null;const last=lastName(r.cand_name);
    const id=r.cand_id||fileIds.get(`${seat}|${last}`)||(seats.get(seat)||[]).find(x=>x.last===last)?.id||null;return {seat,last,id,key:id||`${seat}|${last}`};};
}
export function midtermTrackers(records,{won,open=new Set(),seats=new Map(),nominees=[]}){
  const recs=latestVersions(records),cand=candidateOf(recs,{seats,nominees});let through='';
  const by={};
  for(const r of recs){
    const t=TRACKERS.find(x=>x.superPacs.length&&isOwnSuperPac(x,{id:r.spe_id,name:r.spe_nam}));if(!t)continue;
    const c=cand(r);if(!c)continue;const {id}=c;
    const amt=Number(r.exp_amo)||0,so=String(r.sup_opp).toUpperCase()==='O'?'against':'for';
    const res=!id||open.has(id)?null:won.has(id);
    const T=by[t.key]||(by[t.key]={for:0,against:0,forWon:0,forLost:0,againstWon:0,againstLost:0,sup:new Map(),pacs:new Map()});
    const P=T.pacs.get(r.spe_id)||T.pacs.set(r.spe_id,{id:r.spe_id,name:String(r.spe_nam||'').trim(),for:0,against:0,sup:new Map()}).get(r.spe_id);
    T[so]+=amt;P[so]+=amt;
    if(res!==null)T[so+(res?'Won':'Lost')]+=amt;
    if(so==='for')for(const m of [T.sup,P.sup])m.set(c.key,{amt:(m.get(c.key)?.amt||0)+amt,res});
    const day=isoDate(r.exp_date)||isoDate(r.dissem_dt);if(day>through)through=day;
  }
  const trackers=Object.fromEntries(Object.entries(by).map(([k,T])=>[k,{kind:'own',for:cents(T.for),against:cents(T.against),forWon:cents(T.forWon),forLost:cents(T.forLost),
    againstWon:cents(T.againstWon),againstLost:cents(T.againstLost),supported:count(T.sup),
    pacs:[...T.pacs.values()].map(P=>({id:P.id,name:P.name,for:cents(P.for),against:cents(P.against),supported:count(P.sup)})).sort((a,b)=>(b.for+b.against)-(a.for+a.against))}]));
  return {through:through||null,trackers};
}

// ---------- The five lobbies without a super PAC of their own ----------
// Every super PAC's spending in the midterm, by candidate: Map(committee ID -> {id, name, cands: Map(candidate key ->
// {for, against, res})}). types: the FEC's committee types by ID (cm file).
export function superPacSpending(records,{types,won,open=new Set(),seats=new Map(),nominees=[]}){
  const recs=latestVersions(records),cand=candidateOf(recs,{seats,nominees}),out=new Map();
  for(const r of recs){
    const t=types.get(r.spe_id);if(!t||!SUPER_PAC_TYPES.has(t.type))continue;
    const c=cand(r);if(!c)continue;
    const S=out.get(r.spe_id)||out.set(r.spe_id,{id:r.spe_id,name:t.name||String(r.spe_nam||'').trim(),cands:new Map()}).get(r.spe_id);
    const x=S.cands.get(c.key)||S.cands.set(c.key,{for:0,against:0,res:!c.id||open.has(c.id)?null:won.has(c.id)}).get(c.key);
    x[String(r.sup_opp).toUpperCase()==='O'?'against':'for']+=Number(r.exp_amo)||0;
  }
  return out;
}
// One line of the FEC's itcont or itoth file as money a committee took in, or null (a memo line, money going out).
// Columns: CMTE_ID|AMNDT_IND|RPT_TP|TRANSACTION_PGI|IMAGE_NUM|TRANSACTION_TP|ENTITY_TP|NAME|CITY|STATE|ZIP_CODE|EMPLOYER|
// OCCUPATION|TRANSACTION_DT|TRANSACTION_AMT|OTHER_ID|TRAN_ID|FILE_NUM|MEMO_CD|MEMO_TEXT|SUB_ID.
export function giftOf(line){
  const v=String(line).split('|');if(v.length<19||v[18]==='X'||!/^[13]/.test(v[5]||''))return null;
  return {cmte:v[0],person:v[6]==='IND',name:String(v[7]||'').toUpperCase(),employer:String(v[11]||'').toUpperCase(),amount:Number(v[14])||0,other:v[15]||''};
}
const trackerRes=t=>({t,re:t.patterns.map(p=>p instanceof RegExp?p:new RegExp(p)),pacs:new Set(t.pacIds||[])});
// Whose a gift is: {key, counted}. A company, one of its PACs or its trade group counts; a person who works for one of
// its companies (by employer) is shown beside and not counted. null for anyone else.
export function giftTracker(g,matchers){
  for(const {t,re,pacs} of matchers){
    if(!g.person&&(pacs.has(g.other)||re.some(r=>r.test(g.name))))return {key:t.key,counted:true};
    if(g.person&&g.employer&&re.some(r=>r.test(g.employer)))return {key:t.key,counted:false};
  }
  return null;
}
export const fundedMatchers=(trackers=TRACKERS.filter(t=>!t.superPacs.length))=>trackers.map(trackerRes);
// Each funded tracker's card: its gifts (matched gifts, {cmte, amount, key, counted}) to the super PACs in spend, its
// share of each one's spending (gift ÷ receipts.get(cmte), at most all of it), and the candidates backed by super PACs
// it gave cutoff or more.
export function fundedTrackers(spend,{gifts,receipts,keys,cutoff=FUNDED_CUTOFF}){
  const out={};
  for(const key of keys){
    const byPac=new Map();let employees=0;
    for(const g of gifts){if(g.key!==key||!spend.has(g.cmte))continue;if(g.counted)byPac.set(g.cmte,(byPac.get(g.cmte)||0)+g.amount);else employees+=g.amount;}
    const T={kind:'funded',gave:0,employees:cents(employees),for:0,against:0,forWon:0,forLost:0,againstWon:0,againstLost:0},sup=new Map(),pacs=[];
    for(const [cm,gave] of byPac){
      if(!(gave>0))continue;const S=spend.get(cm),total=receipts.get(cm)||0,share=total>0?Math.min(1,gave/total):0;
      T.gave+=gave;const P={id:cm,name:S.name,gave:cents(gave),share:Math.round(share*1000)/10,for:0,against:0,sup:new Map()};
      for(const [k,c] of S.cands){
        for(const so of ['for','against']){const a=c[so]*share;T[so]+=a;P[so]+=a;if(c.res!==null)T[so+(c.res?'Won':'Lost')]+=a;}
        if(gave>=cutoff&&c.for>0){sup.set(k,{amt:c.for,res:c.res});P.sup.set(k,{amt:c.for,res:c.res});}
      }
      pacs.push(P);
    }
    for(const k of ['gave','for','against','forWon','forLost','againstWon','againstLost'])T[k]=cents(T[k]);
    out[key]={...T,supported:count(sup),funded:pacs.filter(p=>p.gave>=cutoff).length,
      pacs:pacs.sort((a,b)=>b.gave-a.gave).slice(0,12).map(p=>({id:p.id,name:p.name,gave:p.gave,share:p.share,for:cents(p.for),against:cents(p.against),supported:count(p.sup)}))};
  }
  return out;
}
// The first file inside a zip, read as it arrives: the local header is skipped and the rest inflated (the FEC's donor
// files are zip64, several gigabytes, so nothing is saved and the sizes aren't needed).
export function zipFirstEntry(source){
  let head=Buffer.alloc(0),started=false;const inflate=zlib.createInflateRaw();
  const strip=new Transform({transform(chunk,enc,cb){
    if(started)return cb(null,chunk);
    head=Buffer.concat([head,chunk]);if(head.length<30)return cb();
    if(head.readUInt32LE(0)!==0x04034b50)return cb(new Error('not a zip file'));
    const start=30+head.readUInt16LE(26)+head.readUInt16LE(28);if(head.length<start)return cb();
    started=true;cb(null,head.subarray(start));}});
  strip.on('error',e=>inflate.destroy(e));
  inflate.on('end',()=>source.destroy());
  source.pipe(strip).pipe(inflate);
  return inflate;
}
async function* remoteZipLines(url){
  const r=await fetch(url,{headers:{'User-Agent':'public-ledger-research'}});if(!r.ok)throw new Error(`Download failed (HTTP ${r.status}) for ${url}`);
  yield* readline.createInterface({input:zipFirstEntry(Readable.fromWeb(r.body)),crlfDelay:Infinity});
}
const zipText=file=>[...unzip(fs.readFileSync(file)).values()].find(Boolean)?.toString('utf8')||'';
// The funded trackers' cards for one midterm, from the FEC's files (downloads: cm and webk kept in dir; itoth and itcont
// read as they arrive).
async function buildFunded(year,records,results,{dir,refresh,log}){
  const yy=String(year).slice(2);
  const types=new Map();for(const l of zipText(await download(path.join(dir,`cm${yy}.zip`),`${BASE}/${year}/cm${yy}.zip`,refresh)).split('\n')){const v=l.split('|');if(v[0])types.set(v[0],{name:v[1],type:v[9]});}
  const receipts=new Map();for(const l of zipText(await download(path.join(dir,`webk${yy}.zip`),`${BASE}/${year}/webk${yy}.zip`,refresh)).split('\n')){const v=l.split('|');if(v[0])receipts.set(v[0],Number(v[5])||0);}
  const spend=superPacSpending(records,{types,...results}),matchers=fundedMatchers(),gifts=[];
  for(const f of ['oth','indiv']){
    let n=0;log(`  ${year}: reading ${f}${yy}.zip from the FEC (gifts to the ${spend.size} super PACs that spent; ${f==='indiv'?'several GB, ':''}not saved)…`);
    for await(const line of remoteZipLines(`${BASE}/${year}/${f}${yy}.zip`)){
      if(++n%10_000_000===0)log(`    ${(n/1e6).toFixed(0)}M lines…`);
      const cm=line.slice(0,line.indexOf('|'));if(!spend.has(cm))continue;
      const g=giftOf(line);if(!g)continue;const m=giftTracker(g,matchers);if(m)gifts.push({cmte:g.cmte,amount:g.amount,...m});
    }
  }
  return fundedTrackers(spend,{gifts,receipts,keys:matchers.map(m=>m.t.key)});
}

const readJson=f=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));}catch{return null;}};
// One midterm: its spending file and its results (the FEC's, else the site's race calls).
export async function buildMidterm(year,{dir,refresh=false,log=console.log,own=false,last=null}){
  const ie=await download(path.join(dir,`independent_expenditure_${year}.csv`),`${BASE}/${year}/independent_expenditure_${year}.csv`,refresh);
  let results=null;
  try{const f=await download(path.join(dir,`federalelections${year}.xlsx`),`${RESULTS_BASE}/federalelections${year}.xlsx`,refresh);results={...fecResults(xlsxSheets(fs.readFileSync(f))),open:new Set(),nominees:[],kind:'fec'};}
  catch(e){log(`  ${year}: no FEC results file yet (${e.message}); using the site's race calls.`);}
  if(!results||!results.won.size){
    const site=siteResults({research:readJson('public/research.json')||{},elect:readJson('public/members-elect.json')||{},house:readJson('public/house.json')||{},senate:readJson('public/senate.json')||{}});
    results={...site,seats:new Map(),kind:'site'};
  }
  const records=await readIeRecords(ie),out=midtermTrackers(records,results);
  log(`  ${year}: ${Object.keys(out.trackers).length} trackers with their own super PAC spending, results from ${results.kind==='fec'?'the FEC':'the site\'s race calls'}, through ${out.through||'—'}.`);
  // The five without their own: from the donor files, or the last file's when skipped or when a download fails.
  const kept=Object.fromEntries(Object.entries(last?.trackers||{}).filter(([,x])=>x.kind==='funded'));
  if(own)Object.assign(out.trackers,kept);
  else try{const funded=await buildFunded(year,records,results,{dir,refresh,log});Object.assign(out.trackers,funded);
    log(`  ${year}: ${Object.entries(funded).map(([k,x])=>`${k} gave ${Math.round(x.gave).toLocaleString('en-US')}`).join(', ')}.`);}
  catch(e){log(`  ${year}: couldn't read the donor files (${e.message}); the last file's cards for the five lobbies without their own super PACs are kept.`);Object.assign(out.trackers,kept);}
  return {results:results.kind,...out};
}
export async function writeMidtermTrackers({years=MIDTERMS,dir,refresh=false,own=false,log=console.log}={}){
  const last=readJson(OUT),out={about:'Each tracker\'s super PACs in each midterm: spending for and against House and Senate candidates (primaries and generals), the part that went to candidates who won in November, and how many of the candidates they backed won. Its own super PACs (kind own), or, for the lobbies that run none, its share of the super PACs its companies, PACs and trade groups gave to (kind funded). From the FEC\'s independent-expenditure, receipts and committee files and its official results (until those are out, the site\'s race calls). Written by npm run superpacs:midterms (scripts/build-midterm-trackers.mjs).',
    built:new Date().toISOString().slice(0,10),years:{...(last?.years||{})}};
  for(const y of years)out.years[y]=await buildMidterm(y,{dir,refresh,log,own,last:last?.years?.[y]});
  out.years=Object.fromEntries(Object.entries(out.years).filter(([y])=>MIDTERMS.includes(Number(y))).sort(([a],[b])=>b-a));
  fs.writeFileSync(path.join(ROOT,OUT),JSON.stringify(out)+'\n');
  log(`Wrote ${OUT} (${Object.keys(out.years).join(', ')}).`);
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const dir=process.env.FEC_BULK_DIR||path.join(ROOT,'.local','fec-bulk');fs.mkdirSync(dir,{recursive:true});
  const asked=process.argv.slice(2).filter(a=>/^\d{4}$/.test(a)).map(Number),bad=asked.filter(y=>!MIDTERMS.includes(y));
  if(bad.length){console.error(`Not a midterm here: ${bad.join(', ')} (${MIDTERMS.join(', ')}).`);process.exit(1);}
  writeMidtermTrackers({years:asked.length?asked:MIDTERMS,dir,refresh:process.argv.includes('--refresh'),own:process.argv.includes('--own')}).catch(e=>{console.error(e.message);process.exit(1);});
}
