// Covers every member of the House, from the congress-legislators project (https://github.com/unitedstates/congress-legislators,
// public domain, no key), as scripts/build-senate.mjs does for the Senate.
//   npm run house:build                 download the current files
//   npm run house:build -- --dir <dir>  use copies already downloaded (same file names, .json)
// Writes public/house.json, the directory of every member (the six non-voting delegates marked), and adds each member
// with no reviewed profile in public/research.json to data/config.json, marked basic: true and light: true, so the
// refresh collects the lighter set of records for them (src/refresh.mjs, LIGHT_KINDS). A basic member no longer in the
// House is taken out of data/config.json, so the run after a new Congress is sworn in (January 3, 2027) swaps the
// departing members for the new ones. Then it fills in everyone's IDs and committee assignments, as scripts/build-ids.mjs
// does.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadFiles,buildIds,writeIds} from './build-ids.mjs';
import {assignIds,nextElectionOf,STATE_NAMES} from './build-senate.mjs';

const root=new URL('../',import.meta.url);
const PARTY={Democrat:'D',Republican:'R',Independent:'I'};
// The delegates' places, which have no state in STATE_NAMES.
export const PLACE_NAMES={...STATE_NAMES,DC:'District of Columbia',PR:'Puerto Rico',GU:'Guam',VI:'U.S. Virgin Islands',AS:'American Samoa',MP:'Northern Mariana Islands'};
export const isDelegate=state=>!STATE_NAMES[state];
// A member's FEC candidate ID: the House one for their state, if congress-legislators lists it.
export const houseFecId=x=>(x.id.fec||[]).filter(f=>f.startsWith('H')&&f.slice(2,4)===x.terms.at(-1).state).at(-1)||null;
// "GA-5", or "AK at large" for a state with one seat (district 0).
export const seatOf=(state,district)=>Number(district)?`${state}-${Number(district)}`:`${state} at large`;

export function memberEntry(x,id,profiled){
  const t=x.terms.at(-1),house=x.terms.filter(s=>s.type==='rep');
  return {id,profiled,name:x.name.official_full||`${x.name.first} ${x.name.last}`,short:x.name.last,party:PARTY[t.party]||t.party?.[0]||null,
    state:t.state,stateName:PLACE_NAMES[t.state]||t.state,district:Number(t.district)||0,seat:seatOf(t.state,t.district),...(isDelegate(t.state)?{delegate:true}:{}),
    bioguide:x.id.bioguide,since:house[0]?.start||t.start,termEnd:t.end,nextElection:nextElectionOf(t.end),site:t.url||null,fecCand:houseFecId(x)};
}

// Adds the members without a profile to config.people, takes out the basic members who have left, and returns the
// directory.
export function addMembers(current,config,research){
  const members=current.filter(x=>x.terms.at(-1).type==='rep').sort((a,b)=>a.terms.at(-1).state.localeCompare(b.terms.at(-1).state)||(Number(a.terms.at(-1).district)||0)-(Number(b.terms.at(-1).district)||0));
  const now=new Set(members.map(x=>x.id.bioguide));
  const leaving=config.people.filter(p=>p.basic&&p.chamber==='H'&&!now.has(p.bioguide));
  config.people=config.people.filter(p=>!leaving.includes(p));
  const profiles=new Map([...research.members,...research.cands,...(research.featured||[])].filter(s=>s.bioguide).map(s=>[s.bioguide,s.id]));
  const inConfig=new Map(config.people.filter(p=>p.bioguide).map(p=>[p.bioguide,p]));
  const fresh=members.filter(x=>!profiles.has(x.id.bioguide)&&!inConfig.has(x.id.bioguide));
  const ids=assignIds(fresh,config.people.map(p=>p.id));
  for(const x of fresh){
    const t=x.terms.at(-1);
    config.people.push({id:ids.get(x.id.bioguide),name:x.name.official_full||`${x.name.first} ${x.name.last}`,short:x.name.last,bioguide:x.id.bioguide,lis:null,
      fecCand:houseFecId(x),fecCmte:null,chamber:'H',state:t.state,district:Number(t.district)||0,race:null,basic:true,light:true});
  }
  const idOf=x=>profiles.get(x.id.bioguide)||inConfig.get(x.id.bioguide)?.id||ids.get(x.id.bioguide);
  return {added:fresh.length,removed:leaving.map(p=>p.name),members:members.map(x=>memberEntry(x,idOf(x),profiles.has(x.id.bioguide)))};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=process.argv.indexOf('--dir'),files=await loadFiles(arg>0?process.argv[arg+1]:null);
  const config=JSON.parse(await fs.readFile(new URL('data/config.json',root),'utf8'));
  const research=JSON.parse(await fs.readFile(new URL('public/research.json',root),'utf8'));
  const {added,removed,members}=addMembers(files[0],config,research);
  const {committees,summary}=await buildIds(files,config,research);
  await writeIds(config,committees);
  const out={congress:config.congress,checked:new Date().toISOString().slice(0,10),source:'https://github.com/unitedstates/congress-legislators',
    note:'Every member of the House, with the six non-voting delegates marked. Those with a reviewed profile link to it; the rest have a basic profile with their records from the refresh.',members};
  await fs.writeFile(new URL('public/house.json',root),JSON.stringify(out,null,1)+'\n');
  console.log(`${members.length} members in public/house.json (${members.filter(m=>m.delegate).length} delegates); ${added} added to data/config.json${removed.length?`; ${removed.length} who left taken out: ${removed.join(', ')}`:''}. ${summary}`);
}
