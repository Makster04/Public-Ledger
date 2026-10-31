// How each party voted on the saved roll calls (public/research.json votes and hvotes), from the official Senate and
// House Clerk files (no key), for the Donor Loyalty Index: a person's vote is compared with the rest of their party's.
//   node scripts/build-vote-party.mjs          read the saved votes not in public/vote-party.json yet
//   node scripts/build-vote-party.mjs --all    read them all again
// Writes public/vote-party.json: {votes: {voteId: {R: {Yea, Nay, ...}, D: {...}, I: {...}}}}. A published roll call
// doesn't change, so this runs once, and again when votes are added to the research. New roll calls the refresh reads
// keep their own party totals too.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {requestSource,voteURL,normalizeVote} from '../src/sources.mjs';

const root=new URL('../',import.meta.url);
const OUT=new URL('public/vote-party.json',root);

// The official file's address arguments for a saved vote: Senate votes are "117-1-1" (Congress, session, number), House
// votes carry their year and roll number.
export function voteArgs(v,chamber){
  if(chamber==='H')return v.year&&v.roll?{chamber:'H',year:Number(v.year),number:Number(v.roll)}:null;
  const [congress,session,number]=String(v.id).split('-').map(Number);
  return congress&&session&&number?{chamber:'S',congress,session,number}:null;
}
export const savedVotes=research=>[...(research.votes||[]).map(v=>[v,'S']),...(research.hvotes||[]).map(v=>[v,'H'])].map(([v,ch])=>({id:v.id,args:voteArgs(v,ch)})).filter(v=>v.args);

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const research=JSON.parse(await fs.readFile(new URL('public/research.json',root),'utf8'));
  const old=process.argv.includes('--all')?null:JSON.parse(await fs.readFile(OUT,'utf8').catch(()=>'null'));
  const votes={...(old?.votes||{})},missing=[];
  const todo=savedVotes(research).filter(v=>!votes[v.id]);
  for(const [i,v] of todo.entries()){
    try{
      const doc=await requestSource(voteURL(v.args),{},{json:false});
      const byParty=normalizeVote(doc,v.args,[]).byParty;
      if(!Object.keys(byParty).length)throw new Error('no party on the member records');
      votes[v.id]=byParty;
    }catch(e){missing.push(v.id);console.warn(`${v.id}: ${e.message}`);}
    if(i<todo.length-1)await new Promise(r=>setTimeout(r,300));
  }
  const out={about:'How each party voted on the saved roll calls, for the Donor Loyalty Index. See scripts/build-vote-party.mjs.',
    source:'Senate.gov roll call votes and the House Clerk',built:new Date().toISOString().slice(0,10),votes,missing};
  await fs.writeFile(OUT,JSON.stringify(out,null,1)+'\n');
  console.log(`${Object.keys(votes).length} roll calls with party totals in public/vote-party.json (${todo.length-missing.length} read now)${missing.length?`; ${missing.length} could not be read: ${missing.join(', ')}`:''}.`);
}
