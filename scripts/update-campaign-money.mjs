// Brings each profiled person's campaign money (public/research.json "camp" and "cycleLabel") up to their latest FEC
// report, and the toss-up nominees' money (liteRaces), from the FEC's totals (FEC_API_KEY in .dev.vars). About 90
// requests, well under the FEC's hourly limit; run it while npm start is stopped or an hour after other FEC scripts.
//   npm run money:update -- --dry-run   list what would change, write nothing
//   npm run money:update                write public/research.json, then review the changes and commit
// A figure never goes back to an earlier reporting period, and a report whose parts don't add up to its receipts is
// left out and listed. The president is not updated (his figures are set by hand).
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import config from '../data/config.json' with {type:'json'};
import {requestSource} from '../src/sources.mjs';

const file=new URL('../public/research.json',import.meta.url);
const n=v=>v==null||v===''?null:Number(v);
const cents=v=>v==null?null:Math.round(v*100)/100;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const periodLabel=(start,end)=>{const m=d=>`${MONTHS[Number(d.slice(5,7))-1]} ${d.slice(0,4)}`;return `${m(start)} – ${m(end)}`;};
const day=v=>String(v||'').slice(0,10)||null;

// One committee's FEC totals for the cycle → the research's "camp" fields. old: the camp on file (its committee name,
// ID, source link and note are kept). Returns {camp} or {problem}.
export function campFromTotals(r,old){
  const receipts=n(r?.receipts),start=day(r?.coverage_start_date),end=day(r?.coverage_end_date);
  if(receipts==null||!start||!end)return {problem:'the FEC totals have no receipts or reporting dates'};
  if(old?.end&&!old.missing&&end<old.end)return {problem:`the FEC's latest totals end ${end}, before the ${old.end} figures on file`};
  if(old?.end&&!old.missing&&end===old.end)return {same:true};
  // Within a cycle, money raised only adds up; clearly less than on file means another committee or period.
  if(old?.receipts&&!old.missing&&receipts<old.receipts*0.98)return {problem:`the FEC's latest totals show ${Math.round(receipts).toLocaleString('en-US')} raised, less than the ${Math.round(old.receipts).toLocaleString('en-US')} on file`};
  const indiv=n(r.individual_contributions)??0,party=n(r.political_party_committee_contributions)??0,pac=n(r.other_political_committee_contributions)??0;
  const transfers=n(r.transfers_from_other_authorized_committee)??0,candidate=n(r.candidate_contribution),candLoans=n(r.loans_made_by_candidate);
  const parts=indiv+party+pac+transfers+(candidate??0)+(candLoans??0),other=cents(receipts-parts);
  if(other<-1)return {problem:`its parts add up to ${cents(parts)}, more than its ${receipts} in receipts`};
  const self=cents((candidate??0)+(candLoans??0));
  return {camp:{...old,receipts:cents(receipts),indiv:cents(indiv),itemized:cents(n(r.individual_itemized_contributions)),unitemized:cents(n(r.individual_unitemized_contributions)),
    party:cents(party),pac:cents(pac),transfers:cents(transfers),candidate:cents(candidate),loans:cents(candLoans),
    disbursements:cents(n(r.disbursements)),cash:cents(n(r.last_cash_on_hand_end_period)),debts:cents(n(r.last_debts_owed_by_committee)),
    start,end,missing:false,note:old?.missing?'':(old?.note||''),other:Math.max(0,other),loansKnown:candLoans!=null,self,selfShare:receipts?Math.round(self/receipts*1000)/10:0}};
}
// A toss-up nominee's candidate totals → their receipts, cash and reporting date.
export function nomineeFromTotals(r,old){
  const receipts=n(r?.receipts),through=day(r?.coverage_end_date);
  if(receipts==null||!through)return {problem:'the FEC totals have no receipts or reporting date'};
  if(old?.through&&through<old.through)return {problem:`the FEC's latest totals end ${through}, before the ${old.through} figures on file`};
  if(old?.through===through)return {same:true};
  // First figures for someone who had none: the note saying they weren't found no longer applies.
  return {nominee:{...old,receipts:cents(receipts),cash:cents(n(r.last_cash_on_hand_end_period)),through,...(old?.receipts==null?{campNote:''}:{})}};
}

const money=v=>v==null?'—':`$${Math.round(v).toLocaleString('en-US')}`;
// A report ending this long before the newest one found is probably an old campaign's committee (a candidate ID from
// an earlier run), not this race's: it is listed as CHECK and not saved.
export const STALE_DAYS=120;
// Every update, as lines to print. totals(kind, id) gives the FEC result for a committee or a candidate (or null).
export async function updateMoney(research,totals,{cycle=config.cycle}={}){
  const lines=[],people=[...research.members,...research.cands],updates=[];let changed=0;
  for(const p of people){
    const old=p.camp;if(!old?.cmteId){lines.push(`SKIP  ${p.name}: no campaign committee on file`);continue;}
    const r=await totals('committee',old.cmteId,cycle);
    if(!r){lines.push(`SAME  ${p.name}: no FEC totals for ${cycle} yet`);continue;}
    const u=campFromTotals(r,old);
    if(u.problem){lines.push(`CHECK ${p.name}: ${u.problem}; left as is`);continue;}
    if(u.same){lines.push(`SAME  ${p.name}: already through ${old.end}`);continue;}
    const label=p.cycleLabel;updates.push({end:u.camp.end,who:p.name,undo:()=>{p.camp=old;p.cycleLabel=label;}});
    p.camp=u.camp;p.cycleLabel=periodLabel(u.camp.start,u.camp.end);changed++;
    const pacMove=old.pac!=null&&u.camp.pac!==old.pac?`, PACs ${money(old.pac)} → ${money(u.camp.pac)}`:'';
    lines.push(`NEW   ${p.name}: ${old.missing?'first report':`through ${old.end} →`} ${u.camp.end}, raised ${old.missing?'':`${money(old.receipts)} → `}${money(u.camp.receipts)}${pacMove}, cash ${money(u.camp.cash)}${u.camp.note?` (note kept: "${u.camp.note.slice(0,90)}"; check it still fits)`:''}`);
  }
  for(const race of research.liteRaces||[])for(const [i,nm] of (race.nominees||[]).entries()){
    if(!nm.fecCand)continue;
    const r=await totals('candidate',nm.fecCand,cycle);
    if(!r){lines.push(`SAME  ${nm.name} (${race.label}): no FEC totals for ${cycle} yet`);continue;}
    const u=nomineeFromTotals(r,nm);
    if(u.problem){lines.push(`CHECK ${nm.name} (${race.label}): ${u.problem}; left as is`);continue;}
    if(u.same)continue;
    updates.push({end:u.nominee.through,who:`${nm.name} (${race.label})`,undo:()=>{race.nominees[i]=nm;}});
    race.nominees[i]=u.nominee;changed++;
    lines.push(`NEW   ${nm.name} (${race.label}): through ${nm.through||'—'} → ${u.nominee.through}, raised ${money(nm.receipts)} → ${money(u.nominee.receipts)}`);
  }
  const newest=updates.map(x=>x.end).sort().at(-1);
  for(const x of updates)if(Date.parse(newest)-Date.parse(x.end)>STALE_DAYS*864e5){
    x.undo();changed--;
    const at=lines.findIndex(l=>l.startsWith(`NEW   ${x.who}:`));
    lines[at]=`CHECK ${x.who}: the FEC's report ends ${x.end}, long before the others (${newest}); probably an old campaign's committee, so left as is`;
  }
  return {lines,changed};
}

// The FEC's totals for one committee or candidate in a cycle, retried twice when the FEC asks to slow down.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fecTotals(kind,id,cycle){
  const url=kind==='committee'?`https://api.open.fec.gov/v1/committee/${id}/totals/?cycle=${cycle}&per_page=20`:`https://api.open.fec.gov/v1/candidate/${id}/totals/?cycle=${cycle}&election_full=false&per_page=20`;
  for(let k=0;;k++){
    try{
      const d=await requestSource(url,process.env);await sleep(300);
      return (d.results||[]).find(r=>Number(r.cycle)===Number(cycle)&&(kind!=='committee'||r.committee_id===id))||null;
    }catch(e){if(e.statusCode===429&&k<2){await sleep(2000*3**k*10);continue;}throw e;}
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.env.FEC_API_KEY){console.log('Set FEC_API_KEY in .dev.vars first.');process.exit(1);}
  const dry=process.argv.includes('--dry-run'),research=JSON.parse(await fs.readFile(file,'utf8'));
  const {lines,changed}=await updateMoney(research,fecTotals);
  for(const l of lines)console.log(l);
  console.log(`\n${changed} ${changed===1?'figure':'figures'} ${dry?'would change':'updated'}.`);
  if(!dry&&changed){await fs.writeFile(file,JSON.stringify(research,null,2));console.log('Wrote public/research.json. Look over the CHECK lines and any kept notes, run npm test, then commit and push it.');}
}
