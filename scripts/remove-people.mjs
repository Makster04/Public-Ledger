// Takes the people listed in data/removed.json off the site: their profiles, their records in every data file, and
// their place in the refresh. Race results keep them: a race keeps its winner's profile and, for each removed
// candidate, a short record (name, party, FEC ID; their photo stays) so the result shows them without a profile link,
// and outside spending aimed at them still counts for or against the winner. County results are untouched.
// The directory builders (build-house, build-senate) and build-ids read data/removed.json too, so a removed member
// isn't added back from the official rosters before they leave office.
//   node scripts/remove-people.mjs             remove everyone listed (again: it's safe to run twice)
//   node scripts/remove-people.mjs --dry-run   say what would be removed, write nothing
// Since Nov. 19, 2026: everyone who lost the Nov. 3, 2026 general election (the site's "Lost" status).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function removedList(root=ROOT){
  try{const d=JSON.parse(fs.readFileSync(path.join(root,'data','removed.json'),'utf8'));
    return {ids:new Set((d.people||[]).map(p=>p.id)),bioguides:new Set((d.people||[]).map(p=>p.bioguide).filter(Boolean)),fec:new Set((d.people||[]).map(p=>p.fecCand).filter(Boolean)),people:d.people||[]};}
  catch{return {ids:new Set(),bioguides:new Set(),fec:new Set(),people:[]};}
}
const drop=(obj,keys)=>{let n=0;if(obj&&typeof obj==='object')for(const k of Object.keys(obj))if(keys.has(k)){delete obj[k];n++;}return n;};

// The research (public/research.json), changed in place. Returns counts.
export function removeFromResearch(D,{ids,bioguides}){
  const c={profiles:0,races:0,votes:0,bundled:0};
  const gone=new Map();
  for(const list of ['members','cands']){
    D[list]=(D[list]||[]).filter(p=>{if(!ids.has(p.id))return true;c.profiles++;
      gone.set(p.id,{name:p.name,short:p.short||String(p.name||'').split(/\s+/).pop(),party:p.party,fecCand:p.fecCand||null,...(p.bioguide?{bioguide:p.bioguide}:{})});return false;});
  }
  for(const r of D.races||[])for(const k of r.keys||[])if(ids.has(k)){
    const g=gone.get(k)||r.gone?.[k];if(!g)continue;(r.gone||={})[k]={...g,...(r.inc===k?{incumbent:true}:{})};c.races++;}
  for(const v of [...(D.votes||[]),...(D.hvotes||[])])c.votes+=drop(v.pos,ids)+drop(v.pos,bioguides);
  if(D.bundled){c.bundled+=drop(D.bundled.people,ids)+drop(D.bundled.listed,ids);}
  return c;
}

// Every other file: [file, what to remove from it].
export const FILES=[
  ['data/config.json',(d,R)=>{const n=d.people.length;d.people=d.people.filter(p=>!R.ids.has(p.id));return n-d.people.length;}],
  ['data/promise-reviews.json',(d,R)=>drop(d.people,R.ids)],
  ['data/question-statements.json',(d,R)=>drop(d.people||d,R.ids)],
  ['public/attendance.json',(d,R)=>drop(d.people,R.ids)],
  ['public/committees.json',(d,R)=>drop(d.people,R.ids)],
  ['public/consistency.json',(d,R)=>drop(d.people,R.ids)],
  ['public/corporate-pacs.json',(d,R)=>drop(d.people,R.ids)+Object.values(d.trackers||{}).reduce((t,x)=>t+drop(x,R.ids)+drop(x?.people,R.ids),0)+drop(d.kinds,R.ids)],
  ['public/funder-history.json',(d,R)=>drop(d.people,R.ids)],
  ['public/get-it-done.json',(d,R)=>drop(d.people,R.ids)],
  ['public/group-ratings.json',(d,R)=>drop(d.people,R.ids)],
  ['public/house.json',(d,R)=>{const n=d.members.length;d.members=d.members.filter(m=>!R.ids.has(m.id)&&!R.bioguides.has(m.bioguide));return n-d.members.length;}],
  ['public/senate.json',(d,R)=>{const n=d.senators.length;d.senators=d.senators.filter(m=>!R.ids.has(m.id)&&!R.bioguides.has(m.bioguide));return n-d.senators.length;}],
  ['public/integrity-preview-log.json',(d,R)=>(d.entries||[]).reduce((t,e)=>{const n=drop(e.scores,R.ids);const before=(e.changes||[]).length;e.changes=(e.changes||[]).filter(x=>!R.ids.has(x.id));return t+n+before-e.changes.length;},0)],
  ['public/score-log.json',(d,R)=>(d.entries||[]).reduce((t,e)=>{const n=drop(e.scores,R.ids);const before=(e.changes||[]).length;e.changes=(e.changes||[]).filter(x=>!R.ids.has(x.id));return t+n+before-e.changes.length;},0)],
  ['public/news.json',(d,R)=>{const n=d.items.length;d.items=d.items.filter(x=>!(x.id&&R.ids.has(x.id))&&!(x.ids||[]).some(i=>R.ids.has(i)));return n-d.items.length;}],
  ['public/promises.json',(d,R)=>drop(d.people,R.ids)],
  ['public/question-stances.json',(d,R)=>drop(d.people,R.bioguides)+drop(d.people,R.ids)],
  ['public/question-statements.json',(d,R)=>drop(d.people,R.ids)],
  ['public/tracker-history.json',(d,R)=>drop(d.people,R.ids)+Object.values(d.trackers||{}).reduce((t,x)=>t+drop(x,R.ids)+drop(x?.people,R.ids),0)],
];
// Files kept one a person: their record evidence (by Bioguide ID) and their campaign site text.
const perPersonFiles=R=>[...[...R.bioguides].map(b=>`public/question-evidence/${b}.json`),...[...R.ids].map(id=>`data/campaign-text/${id}.json`)];

async function main(){
  const dry=process.argv.includes('--dry-run'),R=removedList();
  if(!R.ids.size){console.log('data/removed.json lists nobody.');return;}
  const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
  // Each file keeps its own layout (indent) when written back.
  const indentOf=f=>{const t=fs.readFileSync(path.join(ROOT,f),'utf8');const m=/^\{\n( +)"/.exec(t);return m?m[1].length:0;};
  const write=(f,d)=>{if(!dry)fs.writeFileSync(path.join(ROOT,f),JSON.stringify(d,null,indentOf(f)||undefined)+(fs.readFileSync(path.join(ROOT,f),'utf8').endsWith('\n')?'\n':''));};
  const D=read('public/research.json'),c=removeFromResearch(D,R);write('public/research.json',D);
  console.log(`public/research.json: ${c.profiles} profiles removed; ${c.races} race places kept as results only; ${c.votes} roll-call positions and ${c.bundled} routed-gift records removed`);
  for(const [f,fn] of FILES){if(!fs.existsSync(path.join(ROOT,f)))continue;const d=read(f),n=fn(d,R);if(n){write(f,d);console.log(`${f}: ${n} removed`);}}
  let files=0;for(const f of perPersonFiles(R))if(fs.existsSync(path.join(ROOT,f))){if(!dry)fs.unlinkSync(path.join(ROOT,f));files++;}
  console.log(`${files} per-person files deleted (record evidence, campaign site text).${dry?' Dry run: nothing written.':''}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
