// Each full profile's PAC lines for its whole money period, from the FEC (FEC_API_KEY in .dev.vars), for the profiles
// whose saved lines cover too little of their PAC money for Big Money Independence to weigh it (under 80% of the FEC's
// PAC total, UNBOUGHT.pacCoverage; since Nov. 24, 2026). The saved lines came from a few reports (often Jan–Jun 2026);
// this reads every report in the period the campaign's money figures cover (camp.start to camp.end):
//   1. The campaign committee's reports (the latest version of each) in that period, with each one's PAC total
//      (line 11C, "other political committees").
//   2. The FEC's processed PAC contributions (Schedule A, line 11C) in those reports, one row per check; memo lines
//      left out.
// Each check's PAC is matched to the saved PAC list (research.json pacNames, by FEC committee ID, then by name) or added
// to it, with its FEC registration (pacCommittees) and a sector: the one it already has on another profile, else from
// its type and name. The profile's pac is rewritten (window, filings, rows, subtotal, retrieved, coverage, byCat, nPacs)
// with gap noting where the lines came from. A profile that can't be read in full keeps its saved lines.
//   npm run pacs:lines                       the profiles under 80%
//   npm run pacs:lines -- --only=brown,hern  just these
//   npm run pacs:lines -- --check            say what it would change, writing nothing
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {requestSource,fecNext} from '../src/sources.mjs';
import {normName} from './build-funders.mjs';
import {lookupCommittees} from './build-pac-types.mjs';
import {pacKind} from '../public/pac-types.js';
import {spenderSector} from '../public/influence.js';
import {UNBOUGHT} from '../public/six-scores.js';

const FEC='https://api.open.fec.gov/v1/';
// The FEC's report codes, as the saved filings name them.
const REPORT={Q1:'APR Q',Q2:'JUL Q',Q3:'OCT Q',YE:'YEAR-END','12P':'PRE-PRIMARY','12G':'PRE-GENERAL','12R':'PRE-RUNOFF','12S':'PRE-SPECIAL','12C':'PRE-CONVENTION',
  '30G':'POST-GENERAL','30R':'POST-RUNOFF','30S':'POST-SPECIAL',TER:'TERMINATION',M2:'FEB M',M3:'MAR M',M4:'APR M',M5:'MAY M',M6:'JUN M',M7:'JUL M',M8:'AUG M',M9:'SEP M',M10:'OCT M',M11:'NOV M',M12:'DEC M'};
const reportName=r=>`${REPORT[r.report_type]||r.report_type} ${r.report_year||String(r.coverage_end_date||'').slice(0,4)}`.trim();
const day=d=>String(d||'').slice(0,10);
const people=data=>[...(data.members||[]),...(data.cands||[]),...(data.featured||[])];
const mon=d=>new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
export const pacRead=p=>(p.pac?.rows||[]).reduce((t,r)=>t+(r[1]>0?r[1]:0),0);
// The profiles to read: a campaign committee, PAC money on file, and saved lines under the coverage bar.
export const thin=p=>!!p.fecCmte&&Number(p.camp?.pac)>0&&!!p.camp?.start&&pacRead(p)<UNBOUGHT.pacCoverage*Number(p.camp.pac);
// The election cycles a period touches (an odd year belongs to the cycle ending the next year).
export const cyclesIn=(start,end)=>{const out=new Set();for(let y=Number(start.slice(0,4));y<=Number(end.slice(0,4));y++)out.add(y%2?y+1:y);return [...out];};

// A PAC's sector for a new line: the one its name already has on another profile, else from its FEC type, else its name.
export function sectorOf(name,committee,known){
  const k=known.get(normName(name));if(k)return k;
  const kind=committee?pacKind(committee):null;
  if(kind==='leadership'||kind==='candidate')return 'lead';
  if(kind==='labor')return 'labor';
  const s=spenderSector(name,null);
  return s==='ideo'?(kind==='unconnected'?'ideo':'other'):s;
}
// The new pac for one profile. reports: the committee's reports [{file_number, report_type, report_year,
// coverage_start_date, coverage_end_date, other_political_committee_contributions_period, most_recent}]; records: its
// Schedule A line 11C rows. data: research.json (pacNames, pacIds, pacCommittees are added to in place); committees: {id:
// [name, type, designation, organization type]} for the PACs not on file yet. Returns {pac, added} (the PACs added).
export function pacLines(person,reports,records,data,committees={}){
  const {start,end}=person.camp;
  const inPeriod=r=>day(r.coverage_end_date)>=start&&day(r.coverage_start_date)<=end;
  const latest=new Map();
  for(const r of reports.filter(inPeriod)){const k=`${r.report_type}|${r.report_year}|${day(r.coverage_start_date)}`,o=latest.get(k);if(!o||Number(r.file_number)>Number(o.file_number))latest.set(k,r);}
  const reps=[...latest.values()].sort((a,b)=>day(a.coverage_start_date).localeCompare(day(b.coverage_start_date)));
  const fileIndex=new Map(reps.map((r,i)=>[String(r.file_number),i]));
  // Sectors already given, by name; and the saved PAC list's IDs and names.
  const known=new Map();for(const p of people(data))for(const r of p.pac?.rows||[])if(r[2])known.set(normName(data.pacNames[r[0]]),r[2]);
  const byId=new Map(),byName=new Map();
  (data.pacIds||[]).forEach((id,i)=>{if(id&&!byId.has(id))byId.set(id,i);});
  data.pacNames.forEach((n,i)=>{const k=normName(n);if(k&&!byName.has(k))byName.set(k,i);});
  const added=[],rows=[],seen=new Set();
  for(const r of records){
    if(r.memo_code==='X')continue;
    const fi=fileIndex.get(String(r.file_number));if(fi==null)continue;       // a superseded version, or outside the period
    const key=`${r.file_number}|${r.transaction_id||r.sub_id}`;if(seen.has(key))continue;seen.add(key);
    const amount=Math.round(Number(r.contribution_receipt_amount)*100)/100;if(!amount)continue;
    const id=/^C\d{8}$/.test(r.contributor_id||'')?r.contributor_id:null,name=String(r.contributor_name||'').trim();
    let i=id&&byId.has(id)?byId.get(id):byName.get(normName(name));
    if(i==null){
      i=data.pacNames.length;data.pacNames.push(name);data.pacIds.push(id);byName.set(normName(name),i);if(id)byId.set(id,i);
      if(id&&committees[id])(data.pacCommittees||={})[id]=committees[id];
      added.push({name,id});
    }else if(id&&!data.pacIds[i]){data.pacIds[i]=id;byId.set(id,i);if(committees[id])(data.pacCommittees||={})[id]=committees[id];}
    const committee=data.pacIds[i]&&(data.pacCommittees||{})[data.pacIds[i]];
    rows.push([i,amount,sectorOf(data.pacNames[i],committee,known),fi]);
  }
  rows.sort((a,b)=>a[3]-b[3]||b[1]-a[1]);
  const filings=reps.map((r,i)=>{const got=rows.filter(x=>x[3]===i),retrieved=Math.round(got.reduce((t,x)=>t+x[1],0)*100)/100,subtotal=Math.round(Number(r.other_political_committee_contributions_period||0)*100)/100;
    return {report:reportName(r),start:day(r.coverage_start_date),end:day(r.coverage_end_date),filing:String(r.file_number),subtotal,retrieved,n:got.length,over:retrieved>subtotal+1,url:`https://docquery.fec.gov/cgi-bin/forms/${person.fecCmte}/${r.file_number}/sa/11C`};});
  const subtotal=Math.round(filings.reduce((t,f)=>t+f.subtotal,0)*100)/100,retrieved=Math.round(rows.reduce((t,x)=>t+x[1],0)*100)/100;
  const byCat=[...rows.reduce((m,x)=>m.set(x[2],(m.get(x[2])||0)+x[1]),new Map())].map(([k,v])=>[k,Math.round(v*100)/100]).sort((a,b)=>b[1]-a[1]);
  // A report with PAC money but no rows yet: the FEC hasn't processed it (it takes a few weeks after filing).
  const unprocessed=filings.filter(f=>f.subtotal>0&&!f.n);
  const usd=n=>`$${Math.round(n).toLocaleString('en-US')}`;
  const pac={window:filings.length?`${mon(filings[0].start)} – ${mon(filings.at(-1).end)}`:'',filings,rows,subtotal,retrieved,
    coverage:subtotal>0?Math.round(retrieved/subtotal*100):null,periodTotal:subtotal,byCat,nPacs:new Set(rows.map(x=>x[0])).size,
    gap:`Every report from ${mon(start)} to ${mon(end)}, from the FEC's processed PAC contributions (Schedule A, line 11C), read ${new Date().toISOString().slice(0,10)} (npm run pacs:lines).`
      +(unprocessed.length?` Not processed by the FEC yet, so not itemized here: ${unprocessed.map(f=>`the ${f.report} report (${usd(f.subtotal)} from PACs)`).join(', ')}.`:'')};
  return {pac,added,unprocessed};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const file=new URL('../public/research.json',import.meta.url),raw=await fs.readFile(file,'utf8'),data=JSON.parse(raw);
  const check=process.argv.includes('--check'),only=(process.argv.find(a=>a.startsWith('--only='))||'').slice(7).split(',').filter(Boolean);
  const env=process.env,sleep=ms=>new Promise(r=>setTimeout(r,ms));
  if(!env.FEC_API_KEY){console.log('FEC_API_KEY is needed (in .dev.vars).');process.exit(1);}
  const get=async u=>{for(let k=0;;k++){await sleep(300);try{return await requestSource(u,env);}catch(e){if(k>=2)throw e;await sleep(2000*3**k);}}};
  const list=people(data).filter(p=>only.length?only.includes(p.id):thin(p));
  if(!list.length){console.log('Every full profile\'s PAC lines cover 80% or more of its PAC money.');process.exit(0);}
  let changed=0;
  for(const p of list){
    try{
      const reports=[],records=[];
      for(const cycle of cyclesIn(p.camp.start,p.camp.end)){
        let url=`${FEC}committee/${p.fecCmte}/reports/?cycle=${cycle}&per_page=100&sort=-coverage_end_date`;
        for(let page=1;url&&page<10;page++){const d=await get(url);reports.push(...(d.results||[]));url=d.pagination?.pages>page?`${FEC}committee/${p.fecCmte}/reports/?cycle=${cycle}&per_page=100&sort=-coverage_end_date&page=${page+1}`:null;}
        url=`${FEC}schedules/schedule_a/?committee_id=${p.fecCmte}&two_year_transaction_period=${cycle}&line_number=F3-11C&per_page=100&sort=-contribution_receipt_date`;
        for(let page=0;url&&page<100;page++){const d=await get(url);records.push(...(d.results||[]));url=fecNext(url,d);}
      }
      // The PACs not on file yet: their FEC registration, for their type.
      const ids=[...new Set(records.map(r=>r.contributor_id).filter(id=>/^C\d{8}$/.test(id||'')&&!(data.pacCommittees||{})[id]))];
      const committees=ids.length?await lookupCommittees(ids,get):{};
      const before=pacRead(p),{pac,added,unprocessed}=pacLines(p,reports,records,data,committees),total=Number(p.camp.pac);
      const share=x=>`${Math.round(x/total*100)}%`;
      console.log(`${p.id}: ${pac.filings.length} reports (${pac.window}), ${pac.rows.length} checks, $${Math.round(pac.retrieved).toLocaleString()} of the FEC's $${Math.round(total).toLocaleString()} PAC total (${share(pac.retrieved)}; was ${share(before)}); ${added.length} PACs added`);
      if(unprocessed.length)console.log(`  not processed by the FEC yet: ${unprocessed.map(f=>`${f.report} ($${Math.round(f.subtotal).toLocaleString()})`).join(', ')}; run this again in a few weeks`);
      if(pac.retrieved<UNBOUGHT.pacCoverage*total)console.log(`  still under ${Math.round(UNBOUGHT.pacCoverage*100)}%, so its Big Money Independence PAC part keeps waiting`);
      if(pac.retrieved<=before){console.log(`  kept the saved lines (the read found no more)`);continue;}
      if(!check){p.pac=pac;changed++;}
    }catch(e){console.log(`${p.id}: ${e.message}; its saved lines are kept`);}
  }
  if(changed&&!check){await fs.writeFile(file,JSON.stringify(data,null,2)+(raw.endsWith('\n')?'\n':''));}
  console.log(`\n${check?'Check only: nothing written.':`${changed} profile${changed===1?'':'s'} updated in public/research.json.`}`);
}
