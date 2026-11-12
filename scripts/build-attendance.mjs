// Showing Up, for the Integrity grade: how many roll-call votes each member missed while in office, from Voteview (UCLA's
// archive of every roll call in both chambers: free files, no key). For each Congress from 2018 (WINDOW_FROM in
// public/integrity.js) through the current year (the 115th to the 119th for 2018–2026) and each chamber, its roll calls (their dates), its members (their Bioguide IDs)
// and every member's vote on each.
//   npm run attendance:build               from 2018 through this year
//   npm run attendance:build -- --from 2016 from another year
// Writes public/attendance.json:
//   days    {S: {date: roll calls that day}, H: {...}}  the votes held, for leaving out an excused period exactly
//   people  {id: {years: {2025: {votes, missed}}, missed: {date: count}, spans: [[chamber, first date, last date]]}}
// Voteview's vote codes: 1 Yea, 6 Nay and 7–8 Present are votes cast or a member answering; 2–5 (paired or announced)
// and 9 (not voting) are votes missed, as the official record has them; 0 means not a member then, and doesn't count.
// The record shows that a vote was missed, not where the member was. Excused absences (medical leave, a birth or
// adoption, a death in the family, military duty) are reviewed entries in research.json, left out when the grade is
// figured (public/integrity.js), never here.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {voteviewFiles} from '../src/voteview.mjs';
import {WINDOW_FROM} from '../public/integrity.js';

const root=new URL('../',import.meta.url),OUT=new URL('public/attendance.json',root);
export const MISSED=new Set(['2','3','4','5','9']),CAST=new Set(['1','6','7','8']);
// The Congress sitting in a year (the 118th is 2023–24) and the Congresses covering the last n years up to `year`.
export const congressOf=year=>Math.floor((year-1789)/2)+1;
export const congressesFor=(year,n=4)=>[...new Set(Array.from({length:n},(_,i)=>congressOf(year-i)))].sort((a,b)=>a-b);
// The Congresses sitting from one year through another (2018–2026: the 115th to the 119th).
export const congressesBetween=(from,to)=>{const out=[];for(let c=congressOf(from);c<=congressOf(to);c++)out.push(c);return out;};
// The first year to read: --from YEAR, or WINDOW_FROM.
export const fromYear=argv=>{const i=argv.indexOf('--from'),y=i>=0?Number(argv[i+1]):NaN;return Number.isInteger(y)&&y>=1990?y:WINDOW_FROM;};

// One chamber's files for one Congress -> the days it voted and each tracked member's votes and misses, by year and date.
// ids: Bioguide ID -> this site's id. from: the first year counted.
export function tally({rollcalls,members,votes},chamber,ids,from,out={days:{S:{},H:{}},people:{}}){
  const date=new Map(rollcalls.map(r=>[String(r.rollnumber),String(r.date||'').slice(0,10)]));
  // Members of the chamber only (Voteview's lists also carry the President, whose positions aren't votes).
  const who=new Map(members.filter(m=>ids.has(m.bioguide_id)&&!/president/i.test(m.chamber||'')).map(m=>[String(Number(m.icpsr)),ids.get(m.bioguide_id)]));
  for(const d of date.values())if(Number(d.slice(0,4))>=from)out.days[chamber][d]=(out.days[chamber][d]||0)+1;
  for(const v of votes){
    const id=who.get(String(Number(v.icpsr))),d=date.get(String(v.rollnumber)),code=String(v.cast_code).trim();
    if(!id||!d||Number(d.slice(0,4))<from||!(MISSED.has(code)||CAST.has(code)))continue;
    const p=out.people[id]||(out.people[id]={years:{},missed:{},spans:[]}),y=p.years[d.slice(0,4)]||(p.years[d.slice(0,4)]={votes:0,missed:0});
    y.votes++;
    if(MISSED.has(code)){y.missed++;p.missed[d]=(p.missed[d]||0)+1;}
    const span=p.spans.find(s=>s[0]===chamber);
    if(!span)p.spans.push([chamber,d,d]);else{if(d<span[1])span[1]=d;if(d>span[2])span[2]=d;}
  }
  return out;
}
// The people tracked: everyone on the site with a Bioguide ID (sitting members, and members running for another office).
export function trackedIds(config,research){
  const ids=new Map();
  for(const p of [...(config.people||[]),...(research.members||[]),...(research.cands||[])])if(p.bioguide&&p.id&&!ids.has(p.bioguide))ids.set(p.bioguide,p.id);
  return ids;
}
// Keys in order, so the file changes only when the record does.
const sorted=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const read=async f=>JSON.parse(await fs.readFile(new URL(f,root),'utf8'));
  const config=await read('data/config.json'),research=await read('public/research.json');
  const year=config.year||new Date().getFullYear(),from=fromYear(process.argv),congresses=congressesBetween(from,year);
  const ids=trackedIds(config,research),out={days:{S:{},H:{}},people:{}},problems=[];
  console.log(`Reading Voteview's roll calls for Congresses ${congresses.join(', ')} (${from}–${year}), both chambers, for ${ids.size} people…`);
  for(const congress of congresses)for(const chamber of ['S','H']){
    try{const files=await voteviewFiles(congress,{},chamber);tally(files,chamber,ids,from,out);console.log(`  ${chamber}${congress}: ${files.rollcalls.length} roll calls`);}
    catch(e){problems.push(`${chamber}${congress}: ${e.message}`);console.log(`  ${chamber}${congress}: couldn't read (${e.message})`);}
  }
  out.days={S:sorted(out.days.S),H:sorted(out.days.H)};
  for(const p of Object.values(out.people)){p.years=sorted(p.years);p.missed=sorted(p.missed);}
  const file={about:'Roll-call votes each member missed while in office, from Voteview (voteview.com), for the Showing Up part of Integrity (public/integrity.js). A missed vote is shown as missed; the record does not say where the member was.',
    source:'https://voteview.com/data',built:new Date().toISOString().slice(0,10),from,to:year,days:out.days,people:sorted(out.people)};
  if(!Object.keys(file.people).length){console.log('\nNothing read, so nothing written.'+(problems.length?` ${problems.join('; ')}`:''));process.exit(1);}
  await fs.writeFile(OUT,JSON.stringify(file)+'\n');
  const rates=Object.entries(file.people).map(([id,p])=>{const t=Object.values(p.years).reduce((a,y)=>({votes:a.votes+y.votes,missed:a.missed+y.missed}),{votes:0,missed:0});return [id,t.votes?t.missed/t.votes*100:0,t];}).sort((a,b)=>b[1]-a[1]);
  console.log(`\nWrote public/attendance.json: ${rates.length} people.${problems.length?` Not read: ${problems.join('; ')}.`:''}\nMissed the most:`);
  for(const [id,r,t] of rates.slice(0,8))console.log(`  ${id.padEnd(14)} ${r.toFixed(1)}% (${t.missed} of ${t.votes})`);
  console.log('\nRun npm test, then commit and push public/attendance.json.');
}
