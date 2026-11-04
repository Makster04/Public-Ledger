// Brings each profiled person's campaign money (public/research.json "camp" and "cycleLabel") up to their latest FEC
// report, and the toss-up nominees' money (liteRaces), from the FEC's totals (FEC_API_KEY in .dev.vars). About 90
// requests, well under the FEC's hourly limit; run it while npm start is stopped or an hour after other FEC scripts.
//   npm run money:update -- --dry-run   list what would change, write nothing
//   npm run money:update                write public/research.json, then review the changes and commit
//   npm run money:update -- --only moore,H6VA02198   just these people (profile IDs) or toss-up nominees (FEC IDs)
// A person whose campaign moved to a new committee mid-cycle has camp.totalsFrom "candidate": their figures come from
// the FEC's candidate totals (all of the candidate's authorized committees) instead of one committee's. Money moved
// between those committees is left out of receipts and spending (camp.internalTransfers), so none counts twice.
// A figure never goes back to an earlier reporting period, and a report whose parts don't add up to its receipts is
// left out and listed, as is a committee that raised almost nothing while the FEC lists a newer principal committee.
// The hand research's note on the old figures is kept as researchNote. The president is not updated (his figures are
// set by hand).
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
// ID and source link are kept). The note becomes where the figures came from; the hand research's note on the earlier
// figures moves to researchNote {through, text} (once: a later update keeps the first one), and a "not filed yet"
// note simply goes. Returns {camp} or {problem}.
export function campFromTotals(r,old){
  const all=old?.totalsFrom==='candidate';
  // Across all of a candidate's committees, a transfer between two of them is money one of them already took in.
  const internal=all?{in:n(r?.transfers_from_other_authorized_committee)??0,out:n(r?.transfers_to_other_authorized_committee)??0}:null;
  const gross=n(r?.receipts),receipts=gross==null?null:all?gross-internal.in:gross,start=day(r?.coverage_start_date),end=day(r?.coverage_end_date);
  if(receipts==null||!start||!end)return {problem:'the FEC totals have no receipts or reporting dates'};
  if(old?.end&&!old.missing&&end<old.end)return {problem:`the FEC's latest totals end ${end}, before the ${old.end} figures on file`};
  // The same report again is nothing new, unless candidate totals on file still count the transfers twice.
  const stale=all&&!old.internalTransfers;
  if(old?.end&&!old.missing&&end===old.end&&!stale)return {same:true};
  // Within a cycle, money raised only adds up; clearly less than on file means another committee or period.
  const onFile=old?.receipts==null?null:stale?old.receipts-(old.transfers||0):old.receipts;
  if(onFile&&!old.missing&&receipts<onFile*0.98)return {problem:`the FEC's latest totals show ${Math.round(receipts).toLocaleString('en-US')} raised, less than the ${Math.round(onFile).toLocaleString('en-US')} on file`};
  const indiv=n(r.individual_contributions)??0,party=n(r.political_party_committee_contributions)??0,pac=n(r.other_political_committee_contributions)??0;
  const transfers=all?0:n(r.transfers_from_other_authorized_committee)??0,candidate=n(r.candidate_contribution),candLoans=n(r.loans_made_by_candidate);
  const parts=indiv+party+pac+transfers+(candidate??0)+(candLoans??0),other=cents(receipts-parts);
  if(other<-1)return {problem:`its parts add up to ${cents(parts)}, more than its ${receipts} in receipts`};
  const self=cents((candidate??0)+(candLoans??0));
  const researchNote=old?.researchNote||(old?.note&&!old.missing?{through:old.end,text:old.note}:null);
  const from=old?.totalsFrom==='candidate'?"the FEC's candidate totals (all of the candidate's authorized committees)":"the FEC's committee totals";
  const spent=n(r.disbursements);
  return {camp:{...old,...(researchNote?{researchNote}:{}),...(internal?{internalTransfers:{in:cents(internal.in),out:cents(internal.out)}}:{}),receipts:cents(receipts),indiv:cents(indiv),itemized:cents(n(r.individual_itemized_contributions)),unitemized:cents(n(r.individual_unitemized_contributions)),
    party:cents(party),pac:cents(pac),transfers:cents(transfers),candidate:cents(candidate),loans:cents(candLoans),
    disbursements:cents(spent==null?null:all?spent-internal.out:spent),cash:cents(n(r.last_cash_on_hand_end_period)),debts:cents(n(r.last_debts_owed_by_committee)),
    start,end,missing:false,note:`Figures from ${from} through ${end}${internal?`, leaving out ${money(internal.in)} moved between those committees`:''} (npm run money:update).`,other:Math.max(0,other),loansKnown:candLoans!=null,self,selfShare:receipts?Math.round(self/receipts*1000)/10:0}};
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
// A part of the money (individuals, PACs, parties) clearly lower than on file: the FEC's totals count it differently
// from the hand research (ActBlue's earmarked gifts, say). The FEC's figure is used and the change listed.
const PARTS=[['indiv','individuals'],['pac','PACs'],['party','party committees']];
const lowerParts=(old,camp)=>PARTS.filter(([k])=>old[k]!=null&&camp[k]!=null&&old[k]-camp[k]>1000&&camp[k]<old[k]*0.98);
// Raising less than this share more over LITTLE_DAYS or longer is checked against the FEC's principal committee.
export const LITTLE_SHARE=0.02,LITTLE_DAYS=60;
// Every update, as lines to print. totals(kind, id) gives the FEC result for a committee or a candidate, or for
// kind 'principal' a candidate's principal campaign committees for the cycle ([{id, name}]); null when there is none.
// progress(done, total, name) is called before each request.
// only: a set of profile IDs and toss-up nominees' FEC IDs to update, leaving everyone else out (null: everyone).
export async function updateMoney(research,totals,{cycle=config.cycle,progress=()=>{},only=null}={}){
  const lines=[],updates=[];let changed=0;
  const people=[...research.members,...research.cands].filter(p=>!only||only.has(p.id));
  const nominees=(research.liteRaces||[]).flatMap(race=>(race.nominees||[]).map((nm,i)=>({race,nm,i}))).filter(x=>x.nm.fecCand&&(!only||only.has(x.nm.fecCand)));
  const asks=people.filter(p=>p.camp?.cmteId).length+nominees.length;let asked=0;
  for(const p of people){
    const old=p.camp;if(!old?.cmteId){lines.push(`SKIP  ${p.name}: no campaign committee on file`);continue;}
    progress(++asked,asks,p.name);
    const all=old.totalsFrom==='candidate'&&p.fecCand;
    const r=all?await totals('candidate',p.fecCand,cycle):await totals('committee',old.cmteId,cycle);
    if(!r){lines.push(`SAME  ${p.name}: no FEC totals for ${cycle} yet`);continue;}
    const u=campFromTotals(r,old);
    if(u.problem){lines.push(`CHECK ${p.name}: ${u.problem}; left as is`);continue;}
    if(u.same){lines.push(`SAME  ${p.name}: already through ${old.end}`);continue;}
    if(all&&!old.internalTransfers&&old.end===u.camp.end){p.camp=u.camp;changed++;
      lines.push(`NEW   ${p.name}: still through ${old.end}; raised ${money(old.receipts)} → ${money(u.camp.receipts)}, leaving out ${money(u.camp.internalTransfers.in)} moved between the candidate's own committees`);continue;}
    // Almost nothing raised over months can mean the campaign moved to a new principal committee (a House member's
    // committee after a Senate run began, say): that committee's figures would leave out the new money.
    const grew=old.missing?null:u.camp.receipts-(old.receipts||0),days=old.missing?0:(Date.parse(u.camp.end)-Date.parse(old.end))/864e5;
    let little='';
    if(!all&&grew!=null&&days>=LITTLE_DAYS&&grew<(old.receipts||0)*LITTLE_SHARE){
      const newer=p.fecCand?((await totals('principal',p.fecCand,cycle))||[]).filter(c=>c.id!==old.cmteId):[];
      if(newer.length){lines.push(`CHECK ${p.name}: ${old.cmte||old.cmteId} (${old.cmteId}) raised only ${money(grew)} from ${old.end} to ${u.camp.end}, and the FEC lists ${newer.map(c=>`${c.name} (${c.id})`).join(' and ')} as the principal campaign committee; left as is`);continue;}
      little=` (only ${money(grew)} raised since ${old.end})`;
    }
    const label=p.cycleLabel;updates.push({end:u.camp.end,who:p.name,undo:()=>{p.camp=old;p.cycleLabel=label;}});
    p.camp=u.camp;p.cycleLabel=periodLabel(u.camp.start,u.camp.end);changed++;
    const pacMove=old.pac!=null&&u.camp.pac!==old.pac?`, PACs ${money(old.pac)} → ${money(u.camp.pac)}`:'';
    lines.push(`NEW   ${p.name}: ${old.missing?'first report':`through ${old.end} →`} ${u.camp.end}, raised ${old.missing?'':`${money(old.receipts)} → `}${money(u.camp.receipts)}${little}${pacMove}, cash ${money(u.camp.cash)}`);
    if(all&&u.camp.internalTransfers.in)lines[lines.length-1]+=`, leaving out ${money(u.camp.internalTransfers.in)} moved between the candidate's own committees`;
    if(!old.missing)for(const [k,label] of lowerParts(old,u.camp))lines.push(`WATCH ${p.name}: money from ${label} is lower than on file (${money(old[k])} → ${money(u.camp[k])}); the FEC counts it differently from the hand research, and its figure is used`);
  }
  for(const {race,nm,i} of nominees){
    progress(++asked,asks,nm.name);
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
    for(let k=lines.length-1;k>at;k--)if(lines[k].startsWith(`WATCH ${x.who}:`))lines.splice(k,1);
  }
  return {lines,changed};
}

// The FEC's totals for one committee or candidate in a cycle (or a candidate's principal committees), retried twice
// when the FEC asks to slow down.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const URLS={committee:(id,c)=>`https://api.open.fec.gov/v1/committee/${id}/totals/?cycle=${c}&per_page=20`,
  candidate:(id,c)=>`https://api.open.fec.gov/v1/candidate/${id}/totals/?cycle=${c}&election_full=false&per_page=20`,
  principal:(id,c)=>`https://api.open.fec.gov/v1/candidate/${id}/committees/?cycle=${c}&designation=P&per_page=20`};
async function fecTotals(kind,id,cycle){
  for(let k=0;;k++){
    try{
      const d=await requestSource(URLS[kind](id,cycle),process.env);await sleep(300);
      if(kind==='principal')return (d.results||[]).map(c=>({id:c.committee_id,name:c.name}));
      return (d.results||[]).find(r=>Number(r.cycle)===Number(cycle)&&(kind!=='committee'||r.committee_id===id))||null;
    }catch(e){
      if(e.statusCode===429&&k<2){const wait=2000*3**k*10;process.stderr.write(`\rThe FEC asked to slow down; waiting ${wait/1000} seconds…\x1b[K`);await sleep(wait);continue;}
      throw e;
    }
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.env.FEC_API_KEY){console.log('Set FEC_API_KEY in .dev.vars first.');process.exit(1);}
  const dry=process.argv.includes('--dry-run'),research=JSON.parse(await fs.readFile(file,'utf8'));
  const at=process.argv.indexOf('--only'),only=at>0&&process.argv[at+1]?new Set(process.argv[at+1].split(',').map(x=>x.trim()).filter(Boolean)):null;
  // Progress on one line while the requests run (a minute or two), so it doesn't look stuck.
  const tty=process.stderr.isTTY;
  console.log('Asking the FEC for the latest totals. This takes a minute or two; leave it running until the list appears.');
  const progress=(i,total,who)=>{if(tty)process.stderr.write(`\rAsking the FEC: ${i} of ${total} (${who})\x1b[K`);else if(i%20===0)process.stderr.write(`Asked the FEC about ${i} of ${total}\n`);};
  const {lines,changed}=await updateMoney(research,fecTotals,{progress,only});
  if(only&&!lines.length)console.log(`No one matches --only ${[...only].join(',')}: use profile IDs (moore) or toss-up nominees' FEC IDs (H6VA02198).`);
  if(tty)process.stderr.write('\r\x1b[K');
  for(const l of lines)console.log(l);
  console.log(`\n${changed} ${changed===1?'figure':'figures'} ${dry?'would change':'updated'}.`);
  if(!dry&&changed){await fs.writeFile(file,JSON.stringify(research,null,2));console.log('Wrote public/research.json. Look over the CHECK and WATCH lines, run npm test, then commit and push it.');}
}
