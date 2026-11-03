// Voteview (UCLA's roll-call archive: free files, no key) for Senate votes when Senate.gov turns scripts away (HTTP 403).
// One Congress's three Senate files give each vote's official session and roll number (rollcalls), each senator's party
// and Bioguide ID (members) and every senator's vote (votes). Used by the refresh (src/sources.mjs) and by
// scripts/build-vote-party.mjs and scripts/fill-vote-positions.mjs.
import {requestSource,SourceError,partyTally} from './sources.mjs';

export const VOTEVIEW='https://voteview.com/static/data/out';
// Voteview's codes (voteview.com/articles/data_help_votes): 1 Yea, 6 Nay, 7–8 Present; paired and announced votes
// (2–5) and 9 are not cast on the floor, as in the official record. 0 means not a member then. Parties: 100 Democrat,
// 200 Republican, 328 Independent.
export const CAST={1:'Yea',2:'Not Voting',3:'Not Voting',4:'Not Voting',5:'Not Voting',6:'Nay',7:'Present',8:'Present',9:'Not Voting'};
export const PARTY={100:'D',200:'R',328:'I'};

// A CSV file as one object per row, keyed by the header line. Quoted fields may hold commas, quotes and line breaks.
export function csvRows(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;continue;}
    if(c==='"')quoted=true;
    else if(c===','){row.push(field);field='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(f=>f!==''))rows.push(row);row=[];}
    else field+=c;
  }
  row.push(field);if(row.some(f=>f!==''))rows.push(row);
  const [head=[],...body]=rows;
  return body.map(r=>Object.fromEntries(head.map((h,i)=>[h.trim(),r[i]??''])));
}

// One Congress's three Senate files, parsed. The refresh keeps them for six hours, so the votes of one Congress share a
// single download.
const KEEP=6*60*60_000,cache=new Map();
export async function voteviewFiles(congress,env={}){
  const hit=cache.get(congress);if(hit&&Date.now()-hit.at<KEEP&&!env.fetch)return hit.files;
  const files={};
  for(const kind of ['rollcalls','members','votes'])files[kind]=csvRows(await requestSource(`${VOTEVIEW}/${kind}/S${congress}_${kind}.csv`,env,{as:'text',maxChars:40_000_000}));
  if(!env.fetch)cache.set(congress,{at:Date.now(),files});
  return files;
}
export const clearVoteviewCache=()=>cache.clear();

const n=Number;
const senateRolls=files=>files.rollcalls.filter(r=>r.chamber==='Senate');
// Voteview's own page for a roll call: R, the chamber, the Congress and its four-digit roll number in that Congress.
export const voteviewPage=(congress,rollnumber)=>`https://voteview.com/rollcall/RS${congress}${String(rollnumber).padStart(4,'0')}`;

// One Senate roll call in the shape src/sources.mjs normalizeVote gives for the official file, from Voteview. Senators are
// matched by Bioguide ID; someone with no vote recorded (not a senator then) gets no position, as in the official file.
// The party totals must add up to Voteview's own yea and nay counts.
export function voteviewSenateVote(files,args,people,officialURL){
  const r=senateRolls(files).find(x=>n(x.congress)===n(args.congress)&&n(x.session)===n(args.session)&&n(x.clerk_rollnumber)===n(args.number));
  if(!r)throw new SourceError('Senate vote not in Voteview yet');
  const members=new Map(files.members.filter(m=>m.chamber==='Senate').map(m=>[n(m.icpsr),m]));
  const cast=files.votes.filter(v=>v.chamber==='Senate'&&n(v.rollnumber)===n(r.rollnumber)&&CAST[n(v.cast_code)]);
  if(!cast.length)throw new SourceError('Voteview has no senators\' votes for this roll call');
  const byIcpsr=new Map(cast.map(v=>[n(v.icpsr),CAST[n(v.cast_code)]])),positions={};
  const icpsrOf=new Map([...members.values()].filter(m=>m.bioguide_id).map(m=>[m.bioguide_id,n(m.icpsr)]));
  for(const p of people.filter(p=>p.bioguide)){const pos=byIcpsr.get(icpsrOf.get(p.bioguide));if(pos)positions[p.id]=pos;}
  const byParty=partyTally(cast.map(v=>[PARTY[n(members.get(n(v.icpsr))?.party_code)]||'',CAST[n(v.cast_code)]]));
  // Voteview's counts may or may not include paired and announced votes (codes 2–5), so either reading is accepted.
  const codes=cast.map(v=>n(v.cast_code)),count=(...c)=>codes.filter(x=>c.includes(x)).length;
  const agrees=(field,floor,all)=>r[field]===''||[floor,all].includes(n(r[field]));
  if(!agrees('yea_count',count(1),count(1,2,3))||!agrees('nay_count',count(6),count(4,5,6)))throw new SourceError('Voteview party totals do not add up to its yea and nay counts');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date))throw new SourceError('Voteview vote date invalid');
  return {id:`s-${args.congress}-${args.session}-${args.number}`,chamber:'S',number:n(args.number),date:r.date,
    title:r.vote_desc||r.bill_number||r.vote_question||null,question:r.vote_question||null,result:r.vote_result||null,positions,byParty,
    source:officialURL,via:'Voteview',voteview:voteviewPage(args.congress,r.rollnumber)};
}

// The newest Senate roll calls of one session, as the Senate.gov vote list gives them (src/sources.mjs senate-index).
export function voteviewSenateIndex(files,args){
  return senateRolls(files).filter(r=>n(r.congress)===n(args.congress)&&n(r.session)===n(args.session)&&n(r.clerk_rollnumber)>0)
    .map(r=>({id:String(n(r.clerk_rollnumber)),number:n(r.clerk_rollnumber)})).sort((a,b)=>b.number-a.number).slice(0,30);
}
