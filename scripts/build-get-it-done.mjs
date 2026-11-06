// Get It Done, for the Showing Up part of Integrity: how many of the bills each member sponsored advanced, against the
// typical member of their party in their chamber. For each Congress from 2018 (WINDOW_FROM in public/integrity.js)
// through the current year (the 115th to the 119th for 2018–2026), every member of each chamber (Voteview's member lists give their Bioguide IDs and parties) and
// the bills and joint resolutions each one sponsored (Congress.gov, with CONGRESS_API_KEY from .dev.vars).
//   npm run getitdone:build                 from 2018 through this year
//   npm run getitdone:build -- --from 2016  from another year
// Writes public/get-it-done.json:
//   medians  {118: {S: {D: rate, R: rate}, H: {...}}}   the typical advanced rate of each party in each chamber
//   counted  {118: {S: {D: members, R: members}, ...}}  how many members each median is taken from
//   people   {id: {congresses: {118: {chamber, party, sponsored, advanced}}}}   the people on the site
// A bill advanced when its latest action shows a committee reporting it, a calendar placement, passage of either
// chamber, its arrival in the other chamber, presentment, signing or law. Simple and concurrent resolutions are left
// out. A party's median is taken over its members with at least 5 such bills that Congress; independents are compared
// with the party they caucus with (the Democrats, for the independents of these Congresses).
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {requestSource} from '../src/sources.mjs';
import {voteviewFiles} from '../src/voteview.mjs';
import {congressesBetween,fromYear,trackedIds} from './build-attendance.mjs';

const root=new URL('../',import.meta.url),OUT=new URL('public/get-it-done.json',root);
export const COUNTED=new Set(['HR','S','HJRES','SJRES']);
// The latest actions that mean a bill moved past introduction and referral.
export const ADVANCED=/became public law|signed by (the )?president|presented to (the )?president|passed (the )?(house|senate)|passed\/agreed to|agreed to in (the )?(house|senate)|ordered to be reported|reported (by|with|without|to|favorably)|placed on (the )?(senate legislative |union |house )?calendar|received in the (house|senate)|message on (house|senate) action|resolving differences|conference report|cleared for white house|vetoed|veto message|held at the desk|discharged (from|by)/i;
export const advanced=text=>ADVANCED.test(String(text||''));
export const MEDIAN_MIN=5;
// Voteview's party codes: 100 Democrat, 200 Republican; independents (328) are compared with the Democrats.
export const partyOf=code=>({'100':'D','200':'R','328':'D'})[String(code)]||null;

// One member's sponsored bills in the window's Congresses: {congress: {sponsored, advanced}}.
export function countBills(items,congresses){
  const out={};
  for(const b of items||[]){
    const c=Number(b.congress),type=String(b.type||'').toUpperCase().replace(/[^A-Z]/g,'');
    if(!congresses.includes(c)||!COUNTED.has(type))continue;
    const x=out[c]||(out[c]={sponsored:0,advanced:0});x.sponsored++;if(advanced(b.latestAction?.text))x.advanced++;
  }
  return out;
}
const median=a=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
// Each party's typical rate in each chamber and Congress, over its members with at least MEDIAN_MIN bills.
// members: [{congress, chamber, party, sponsored, advanced}]
export function medians(members){
  const groups={};
  for(const m of members){if(!m.party||m.sponsored<MEDIAN_MIN)continue;((groups[m.congress]||={})[m.chamber]||={})[m.party]||=[];groups[m.congress][m.chamber][m.party].push(m.advanced/m.sponsored);}
  const rates={},counted={};
  for(const [c,chambers] of Object.entries(groups))for(const [ch,parties] of Object.entries(chambers))for(const [p,list] of Object.entries(parties)){
    ((rates[c]||={})[ch]||={})[p]=Number(median(list).toFixed(6));((counted[c]||={})[ch]||={})[p]=list.length;}
  return {medians:rates,counted};
}
// Every page of a member's sponsored legislation (newest first), until the window's first Congress is passed.
async function sponsoredBills(bioguide,first,env){
  const items=[];let url=`https://api.congress.gov/v3/member/${bioguide}/sponsored-legislation?format=json&limit=250`;
  for(let page=0;url&&page<20;page++){
    const d=await requestSource(url,env);
    const got=Array.isArray(d.sponsoredLegislation)?d.sponsoredLegislation:[];items.push(...got);
    if(!got.length||got.every(b=>Number(b.congress)<first))break;
    const next=d.pagination?.next;if(!next)break;const u=new URL(next);u.searchParams.set('format','json');url=u.href;
  }
  return items;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const env=process.env;
  if(!env.CONGRESS_API_KEY){console.log('This needs CONGRESS_API_KEY in .dev.vars (the Congress.gov key the refresh uses).');process.exit(1);}
  const read=async f=>JSON.parse(await fs.readFile(new URL(f,root),'utf8'));
  const config=await read('data/config.json'),research=await read('public/research.json');
  const year=config.year||new Date().getFullYear(),from=fromYear(process.argv),congresses=congressesBetween(from,year);
  const site=new Map([...trackedIds(config,research)]);
  // Every member of each chamber in each Congress, with their party then.
  const roster=new Map();
  for(const congress of congresses)for(const chamber of ['S','H']){
    const files=await voteviewFiles(congress,{},chamber);
    for(const m of files.members){if(/president/i.test(m.chamber||'')||!m.bioguide_id)continue;
      const r=roster.get(m.bioguide_id)||roster.set(m.bioguide_id,[]).get(m.bioguide_id);r.push({congress,chamber,party:partyOf(m.party_code)});}
    console.log(`  ${chamber}${congress}: ${files.members.length} members`);
  }
  console.log(`Reading the sponsored bills of ${roster.size} members of Congress ${congresses.join(' and ')} from Congress.gov; this takes several minutes…`);
  const members=[],people={},problems=[];let done=0;
  const ids=[...roster.keys()];
  for(let k=0;k<ids.length;k+=4)await Promise.all(ids.slice(k,k+4).map(async bioguide=>{
    try{
      const counts=countBills(await sponsoredBills(bioguide,congresses[0],env),congresses);
      for(const s of roster.get(bioguide)){const c=counts[s.congress]||{sponsored:0,advanced:0};members.push({...s,...c});
        const id=site.get(bioguide);if(id)((people[id]||={congresses:{}}).congresses[s.congress]={chamber:s.chamber,party:s.party,sponsored:c.sponsored,advanced:c.advanced});}
    }catch(e){problems.push(`${bioguide}: ${e.message}`);}
    if(++done%50===0)console.log(`  ${done} of ${ids.length}`);
  }));
  const {medians:rates,counted}=medians(members);
  const file={about:'Bills and joint resolutions each member sponsored, and how many advanced past introduction, against the typical member of their party in their chamber, for the Get It Done part of Showing Up (public/integrity.js). From Congress.gov and Voteview.',
    source:'https://api.congress.gov',built:new Date().toISOString().slice(0,10),from,to:year,congresses,medians:rates,counted,
    people:Object.fromEntries(Object.entries(people).sort(([a],[b])=>a.localeCompare(b)))};
  if(!Object.keys(file.people).length){console.log(`\nNothing read, so nothing written.${problems.length?` First problems: ${problems.slice(0,3).join('; ')}`:''}`);process.exit(1);}
  await fs.writeFile(OUT,JSON.stringify(file)+'\n');
  console.log(`\nWrote public/get-it-done.json: ${Object.keys(file.people).length} people on the site; typical rates:`);
  for(const c of congresses)for(const ch of ['S','H'])console.log(`  ${c} ${ch==='S'?'Senate':'House'}: ${Object.entries(rates[c]?.[ch]||{}).map(([p,r])=>`${p} ${(r*100).toFixed(1)}% (of ${counted[c][ch][p]} members)`).join(', ')}`);
  if(problems.length)console.log(`\n${problems.length} members couldn't be read (${problems.slice(0,2).join('; ')}).`);
  console.log('\nRun npm test, then commit and push public/get-it-done.json.');
}
