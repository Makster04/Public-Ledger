// The trackers' own super PACs in each midterm (approved 2026-11-26), for the tracker cards on the Super PACs page: what
// they spent for and against House and Senate candidates, primaries and generals together, how much of it went to
// candidates who won in November, and how many of the candidates they backed won.
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
//   {about, built, years: {year: {results: 'fec' | 'site', through, trackers: {tracker key: {for, against, forWon,
//    forLost, againstWon, againstLost, supported: {n, won, open}, pacs: [{id, name, for, against, supported}]}}}}}
// 2018 has no tracker super PAC spending (the first, United Democracy Project, began in 2021); it's there so 2022 can
// say so. Run by npm run corporate:pacs for the current cycle when it's a midterm, or on its own:
//   npm run superpacs:midterms                every midterm in MIDTERMS (files kept in .local/fec-bulk/)
//   npm run superpacs:midterms -- 2026        one midterm, the others kept from the last file
//   npm run superpacs:midterms -- --refresh   downloads the files again now
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readIeRecords,latestVersions,seatOf,isoDate,download} from './build-super-pac-races.mjs';
import {xlsxSheets} from './xlsx.mjs';
import {TRACKERS,isOwnSuperPac} from '../public/trackers.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE=process.env.FEC_BULK_BASE||'https://www.fec.gov/files/bulk-downloads';
const RESULTS_BASE='https://www.fec.gov/resources/cms-content/documents';
export const MIDTERMS=[2026,2022,2018],OUT='public/midterm-trackers.json';
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
// The midterm's records -> each tracker's totals. won: the winners' candidate IDs; open: candidates whose race isn't
// called yet; seats (results file) and nominees (the site's) fill in a record without a candidate ID.
export function midtermTrackers(records,{won,open=new Set(),seats=new Map(),nominees=[]}){
  const recs=latestVersions(records),fileIds=new Map();let through='';
  for(const r of recs){const seat=seatOf(r.can_office,r.can_office_state,r.can_office_dis);if(seat&&r.cand_id)fileIds.set(`${seat}|${lastName(r.cand_name)}`,r.cand_id);}
  for(const [seat,last,id] of nominees)if(!fileIds.has(`${seat}|${last}`))fileIds.set(`${seat}|${last}`,id);
  const by={};
  for(const r of recs){
    const t=TRACKERS.find(x=>x.superPacs.length&&isOwnSuperPac(x,{id:r.spe_id,name:r.spe_nam}));if(!t)continue;
    const seat=seatOf(r.can_office,r.can_office_state,r.can_office_dis);if(!seat)continue;
    const last=lastName(r.cand_name);
    const id=r.cand_id||fileIds.get(`${seat}|${last}`)||(seats.get(seat)||[]).find(x=>x.last===last)?.id||null;
    const amt=Number(r.exp_amo)||0,so=String(r.sup_opp).toUpperCase()==='O'?'against':'for';
    const res=!id||open.has(id)?null:won.has(id);
    const T=by[t.key]||(by[t.key]={for:0,against:0,forWon:0,forLost:0,againstWon:0,againstLost:0,sup:new Map(),pacs:new Map()});
    const P=T.pacs.get(r.spe_id)||T.pacs.set(r.spe_id,{id:r.spe_id,name:String(r.spe_nam||'').trim(),for:0,against:0,sup:new Map()}).get(r.spe_id);
    T[so]+=amt;P[so]+=amt;
    if(res!==null)T[so+(res?'Won':'Lost')]+=amt;
    if(so==='for'){const k=id||`${seat}|${last}`;for(const m of [T.sup,P.sup])m.set(k,{amt:(m.get(k)?.amt||0)+amt,res});}
    const day=isoDate(r.exp_date)||isoDate(r.dissem_dt);if(day>through)through=day;
  }
  // A candidate they backed counts once, however much was spent, and only when the net spending for them is above zero.
  const count=m=>{const v=[...m.values()].filter(x=>x.amt>0);return {n:v.length,won:v.filter(x=>x.res===true).length,open:v.filter(x=>x.res===null).length};};
  const trackers=Object.fromEntries(Object.entries(by).map(([k,T])=>[k,{for:cents(T.for),against:cents(T.against),forWon:cents(T.forWon),forLost:cents(T.forLost),
    againstWon:cents(T.againstWon),againstLost:cents(T.againstLost),supported:count(T.sup),
    pacs:[...T.pacs.values()].map(P=>({id:P.id,name:P.name,for:cents(P.for),against:cents(P.against),supported:count(P.sup)})).sort((a,b)=>(b.for+b.against)-(a.for+a.against))}]));
  return {through:through||null,trackers};
}

const readJson=f=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));}catch{return null;}};
// One midterm: its spending file and its results (the FEC's, else the site's race calls).
export async function buildMidterm(year,{dir,refresh=false,log=console.log}){
  const ie=await download(path.join(dir,`independent_expenditure_${year}.csv`),`${BASE}/${year}/independent_expenditure_${year}.csv`,refresh);
  let results=null;
  try{const f=await download(path.join(dir,`federalelections${year}.xlsx`),`${RESULTS_BASE}/federalelections${year}.xlsx`,refresh);results={...fecResults(xlsxSheets(fs.readFileSync(f))),open:new Set(),nominees:[],kind:'fec'};}
  catch(e){log(`  ${year}: no FEC results file yet (${e.message}); using the site's race calls.`);}
  if(!results||!results.won.size){
    const site=siteResults({research:readJson('public/research.json')||{},elect:readJson('public/members-elect.json')||{},house:readJson('public/house.json')||{},senate:readJson('public/senate.json')||{}});
    results={...site,seats:new Map(),kind:'site'};
  }
  const out=midtermTrackers(await readIeRecords(ie),results);
  log(`  ${year}: ${Object.keys(out.trackers).length} trackers with super PAC spending, results from ${results.kind==='fec'?'the FEC':'the site\'s race calls'}, through ${out.through||'—'}.`);
  return {results:results.kind,...out};
}
export async function writeMidtermTrackers({years=MIDTERMS,dir,refresh=false,log=console.log}={}){
  const last=readJson(OUT),out={about:'Each tracker\'s own super PACs in each midterm: spending for and against House and Senate candidates (primaries and generals), the part that went to candidates who won in November, and how many of the candidates they backed won. From the FEC\'s independent-expenditure files and its official results (until those are out, the site\'s race calls). Written by npm run superpacs:midterms (scripts/build-midterm-trackers.mjs).',
    built:new Date().toISOString().slice(0,10),years:{...(last?.years||{})}};
  for(const y of years)out.years[y]=await buildMidterm(y,{dir,refresh,log});
  out.years=Object.fromEntries(Object.entries(out.years).filter(([y])=>MIDTERMS.includes(Number(y))).sort(([a],[b])=>b-a));
  fs.writeFileSync(path.join(ROOT,OUT),JSON.stringify(out)+'\n');
  log(`Wrote ${OUT} (${Object.keys(out.years).join(', ')}).`);
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const dir=process.env.FEC_BULK_DIR||path.join(ROOT,'.local','fec-bulk');fs.mkdirSync(dir,{recursive:true});
  const asked=process.argv.slice(2).filter(a=>/^\d{4}$/.test(a)).map(Number),bad=asked.filter(y=>!MIDTERMS.includes(y));
  if(bad.length){console.error(`Not a midterm here: ${bad.join(', ')} (${MIDTERMS.join(', ')}).`);process.exit(1);}
  writeMidtermTrackers({years:asked.length?asked:MIDTERMS,dir,refresh:process.argv.includes('--refresh')}).catch(e=>{console.error(e.message);process.exit(1);});
}
