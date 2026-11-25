// How much evidence each person has toward the 10-or-more goal (started Nov. 25, 2026): promises for Keeps Their Word,
// quotes tagged to the alignment questions, and issue stances for Ideology, with what each is still short of and the
// source most likely to fill it. Everyone the site shows: the full profiles (public/research.json), every senator and
// House member (public/senate.json, public/house.json) and the members-elect (public/members-elect.json).
//   promises  public/promises.json: the promises found for Keeps Their Word
//   quotes    public/question-statements.json: what they said, tagged to a question with its side
//   stances   the questions with evidence of where they stand: a vote, bill or official act
//             (public/question-stances.json, by bioguide ID) or a tagged quote
// Sources on hand for each: the Congressional Record (anyone sitting, by bioguide ID), their campaign sites
// (data/campaign-text/), the refresh's export (data/collected-statements/) and the Record collector's
// (data/record-statements/, npm run record:collect).
//   npm run coverage            writes data/coverage.json and prints the totals and who's furthest short
//   npm run coverage -- --all   prints everyone
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const GOAL=10,OUT='data/coverage.json';
const readIf=f=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));}catch{return null;}};
const has=(dir,id)=>fs.existsSync(path.join(ROOT,dir,`${id}.json`));
const listOf=x=>Array.isArray(x)?x:x?.members||x?.senators||[];

// Everyone the site shows, once each: a full profile first, then the chambers, then the members-elect.
export function everyone({research,senate,house,elect}){
  const by=new Map(),add=(p,kind)=>{if(!p?.id)return;const o=by.get(p.id);if(o){o.bioguide||=p.bioguide||null;return;}
    by.set(p.id,{id:p.id,name:p.name||p.id,party:p.party||null,state:p.state||null,kind,bioguide:p.bioguide||null,sitting:kind==='senate'||kind==='house'||(kind==='full'&&!!p.bioguide&&!p.office)});};
  for(const p of [...(research?.members||[]),...(research?.cands||[]),...(research?.featured||[])])add(p,'full');
  for(const p of listOf(senate))add(p,'senate');
  for(const p of listOf(house))add(p,'house');
  for(const p of listOf(elect))add(p,'elect');
  return [...by.values()];
}
// One person's counts and what they're short of.
export function personCoverage(p,{promises,statements,stances,files=()=>false,speeches={},goal=GOAL}){
  const prom=promises?.[p.id]||[],tagged=statements?.[p.id]||{},voted=p.bioguide?stances?.[p.bioguide]||{}:{};
  const quotes=Object.values(tagged).reduce((n,list)=>n+(list?.length||0),0);
  const voteQs=Object.entries(voted).filter(([,c])=>Array.isArray(c)&&c.some(n=>n>0)).map(([q])=>q);
  const stanceQs=new Set([...voteQs,...Object.keys(tagged).filter(q=>tagged[q]?.length)]);
  const sources={record:!!p.bioguide&&p.sitting,campaignText:files('data/campaign-text',p.id),collected:files('data/collected-statements',p.id),recordStatements:files('data/record-statements',p.id)};
  const short={promises:Math.max(0,goal-prom.length),quotes:Math.max(0,goal-quotes),stances:Math.max(0,goal-stanceQs.size)};
  const next=[];
  if(short.promises)next.push(sources.campaignText?'promises: read their campaign text for commitments':'promises: archived campaign sites (Wayback Machine)');
  if(short.quotes)next.push(sources.record?(sources.recordStatements?'quotes: tag their Record speeches':'quotes: Congressional Record'):'quotes: campaign sites, state legislature, interviews');
  if(short.stances)next.push(sources.record?'stances: more votes and cosponsorships, tagged speeches':'stances: campaign Issues pages, state legislature votes');
  return {id:p.id,name:p.name,party:p.party,state:p.state,kind:p.kind,sitting:p.sitting,promises:prom.length,quotes,quoteQuestions:Object.keys(tagged).length,
    voteQuestions:voteQs.length,stances:stanceQs.size,speeches:speeches[p.id]||0,short,sources,next};
}
export function coverage(files,{goal=GOAL}={}){
  const people=everyone(files).map(p=>personCoverage(p,{promises:files.promises?.people,statements:files.statements?.people,stances:files.stances?.people,files:files.has,speeches:files.speeches||{},goal}));
  const count=(k,kind)=>{const list=kind?people.filter(x=>x.kind===kind):people;return {met:list.filter(x=>x[k]>=goal).length,some:list.filter(x=>x[k]>0&&x[k]<goal).length,none:list.filter(x=>!x[k]).length,of:list.length};};
  const kinds=['full','senate','house','elect'];
  const totals=Object.fromEntries(['promises','quotes','stances'].map(k=>[k,{all:count(k),...Object.fromEntries(kinds.map(kd=>[kd,count(k,kd)]))}]));
  return {goal,totals,people};
}

// Floor speeches with kept sentences, per person, from the Record collector's files.
function recordSpeeches(){
  const dir=path.join(ROOT,'data/record-statements');if(!fs.existsSync(dir))return {};
  return Object.fromEntries(fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&!f.startsWith('_')).map(f=>[f.slice(0,-5),readIf(`data/record-statements/${f}`)?.counts?.speeches||0]));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const c=coverage({research:readIf('public/research.json'),senate:readIf('public/senate.json'),house:readIf('public/house.json'),elect:readIf('public/members-elect.json'),
    promises:readIf('public/promises.json'),statements:readIf('public/question-statements.json'),stances:readIf('public/question-stances.json'),has,speeches:recordSpeeches()});
  const out={about:'How much evidence each person has toward 10 or more promises, tagged quotes and issue stances, what they\'re short of and the source most likely to fill it. Written by npm run coverage (scripts/coverage.mjs).',
    built:new Date().toISOString().slice(0,10),...c,people:Object.fromEntries(c.people.map(({id,...x})=>[id,x]))};
  fs.writeFileSync(path.join(ROOT,OUT),JSON.stringify(out,null,1)+'\n');
  const line=(k)=>{const t=c.totals[k];return `${k.padEnd(9)} ${String(t.all.met).padStart(4)} have ${c.goal}+, ${String(t.all.some).padStart(4)} have some, ${String(t.all.none).padStart(4)} have none   (full profiles ${t.full.met}/${t.full.of}, senators ${t.senate.met}/${t.senate.of}, House ${t.house.met}/${t.house.of}, members-elect ${t.elect.met}/${t.elect.of} with ${c.goal}+)`;};
  console.log(`${c.people.length} people. With ${c.goal} or more:`);for(const k of ['promises','quotes','stances'])console.log('  '+line(k));
  const sp=c.people.filter(x=>x.sitting);console.log(`  floor speeches with sentences to tag: ${sp.filter(x=>x.speeches>=c.goal).length} of ${sp.length} sitting members have ${c.goal}+, ${sp.filter(x=>x.speeches>0&&x.speeches<c.goal).length} have some, ${sp.filter(x=>!x.speeches).length} none`);
  const list=process.argv.includes('--all')?c.people:c.people.filter(x=>x.kind==='full');
  console.log(`\n${process.argv.includes('--all')?'Everyone':'Full profiles'} (promises / quotes / stances):`);
  for(const x of list.sort((a,b)=>(a.promises+a.quotes)-(b.promises+b.quotes)))console.log(`  ${x.id.padEnd(16)} ${String(x.promises).padStart(3)} ${String(x.quotes).padStart(4)} ${String(x.stances).padStart(4)}  ${x.next.join('; ')}`);
  console.log(`\nWrote ${OUT}.`);
}
