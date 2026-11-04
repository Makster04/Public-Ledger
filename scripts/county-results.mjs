// County-by-county results for the maps on the Races page: public/county-results.json, from each state's own election
// office (no key needed). Each race lists where its results come from and how to read them:
//   ncsbe     North Carolina's precinct results file (a ZIP of tab-separated rows), added up by county
//   enhanced  the "media export" JSON of the Enhanced Voting results sites (Georgia, Virginia, Idaho), read by locality
//   table     a CSV or tab-separated file with a row per county and candidate (Michigan's county file)
//   npm run counties:update                      every race below
//   npm run counties:update -- --only S-GA       just these races
//   npm run counties:update -- --file S-MI=~/Downloads/mi-county-results.txt   a file saved from the state's site
// Each candidate is matched to the race's own candidates by last name; everyone else counts as "other". Each county is
// matched by name to the outlines in public/maps/<ST>.json. A county the outlines don't know is listed and left out.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import {unzipFile} from '../src/sources.mjs';

const root=new URL('..',import.meta.url);
export const SOURCES={
  'S-NC':{state:'NC',reader:'ncsbe',contest:/^US SENATE$/,
    urls:['https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip'],
    source:'North Carolina State Board of Elections, precinct results file'},
  'S-GA':{state:'GA',reader:'enhanced',contest:/^(u\.?\s?s\.?|united states)\s+senat/i,
    urls:['https://results.sos.ga.gov/cdn/results/Georgia/export-2026NovGen.json'],
    page:'https://results.sos.ga.gov/results/public/Georgia/elections/2026NovGen',
    source:'Georgia Secretary of State, results export'},
  'S-MI':{state:'MI',reader:'table',contest:/united states senator|^u\.?\s?s\.?\s+senat/i,
    urls:['https://mielections.us/election/results/DATA/2026GEN_MI_CENR_BY_COUNTY.xls','https://mielections.us/election/results/DATA/2026GEN_MI_CENR_BY_COUNTY.txt'],
    page:'https://mvic.sos.state.mi.us/votehistory/',
    source:'Michigan Department of State, county results file'},
};

// A name reduced to letters, for matching ("St. Clair County" and "ST CLAIR" are the same; "El-Sayed" and "El Sayed").
const letters=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z]/g,'');
export const countyKey=s=>letters(String(s||'').replace(/\b(county|parish|borough|city and county)\b/ig,'').replace(/\bsaint\b/ig,'st'));
// A candidate's last name, without suffixes and the party or incumbent marks some states add: "Jon Ossoff (I) (Dem)".
export function lastName(name){
  const words=String(name||'').replace(/\([^)]*\)/g,' ').replace(/,?\s+(jr|sr|ii|iii|iv)\.?\s*$/i,'').trim().split(/\s+/);
  return letters(words.at(-1));
}

// North Carolina: County, Contest Name, Choice, Choice Party, Total Votes on each precinct row.
export function readNcsbe(text,contest){
  const lines=text.split(/\r?\n/).filter(Boolean),head=lines[0].split('\t'),at=n=>{const i=head.indexOf(n);if(i<0)throw new Error(`the NC file has no "${n}" column (it has: ${head.join(', ')})`);return i;};
  const c={county:at('County'),contest:at('Contest Name'),choice:at('Choice'),party:at('Choice Party'),votes:at('Total Votes')},rows=[];
  for(const l of lines.slice(1)){const f=l.split('\t');if(!contest.test(f[c.contest]||''))continue;rows.push({county:f[c.county],choice:f[c.choice],party:(f[c.party]||'').trim(),votes:Number(f[c.votes])||0});}
  return rows;
}
// Enhanced Voting's export: results.ballotItems statewide, and localResults (or results.localResults) per locality, each
// with its own ballotItems; a ballot item's ballotOptions carry the candidate's name, party and voteCount.
export function readEnhanced(data,contest){
  const locs=data?.localResults||data?.results?.localResults||[];
  if(!locs.length)throw new Error(`the export has no localResults (top-level keys: ${Object.keys(data||{}).join(', ')})`);
  const rows=[];let found=0;
  for(const loc of locs){
    const county=loc.name??loc.localityName??loc.locality??loc.countyName;
    for(const bi of loc.ballotItems||[]){
      if(!contest.test(String(bi.name||'').trim())||/state senat/i.test(bi.name))continue;found++;
      for(const o of bi.ballotOptions||[])rows.push({county,choice:String(o.name||'').trim(),party:String(o.politicalParty||'').trim(),votes:Number(o.voteCount)||0});
    }
  }
  if(!found)throw new Error('no ballot item matches the Senate race in localResults (first locality has: '+(locs[0]?.ballotItems||[]).slice(0,8).map(b=>b.name).join('; ')+')');
  return rows;
}
// A CSV or tab-separated file: a county column, a contest column, the candidate (or first and last name) and votes.
const PICK={county:['countyname','county','countydescription'],contest:['officedescription','contestname','office','contest','racename','race'],
  choice:['candidate','choice','candidatename','name'],last:['candidatelastname','lastname'],first:['candidatefirstname','firstname'],
  party:['partyname','party','choiceparty','partydescription'],votes:['candidatevotes','totalvotes','votes','total']};
const splitRow=(l,sep)=>{if(sep==='\t')return l.split('\t');const out=[];let cur='',q=false;for(const ch of l){if(ch==='"'){q=!q;continue;}if(ch===','&&!q){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out;};
export function readTable(text,contest){
  const lines=text.replace(/^﻿/,'').split(/\r?\n/).filter(l=>l.trim());if(!lines.length)throw new Error('the file is empty');
  if(/^\s*<(!doctype|html)/i.test(lines[0]))throw new Error('this is a web page, not a results file');
  const sep=lines[0].includes('\t')?'\t':',',head=splitRow(lines[0],sep).map(letters);
  const col=k=>PICK[k].map(n=>head.indexOf(n)).find(i=>i>=0)??-1,c=Object.fromEntries(Object.keys(PICK).map(k=>[k,col(k)]));
  if(c.county<0||c.contest<0||c.votes<0||(c.choice<0&&c.last<0))throw new Error(`can't find the county, contest, candidate and votes columns (the header is: ${splitRow(lines[0],sep).join(' | ')})`);
  const rows=[];
  for(const l of lines.slice(1)){const f=splitRow(l,sep);if(!contest.test((f[c.contest]||'').trim())||/state senat/i.test(f[c.contest]))continue;
    const choice=c.choice>=0?f[c.choice]:`${c.first>=0?f[c.first]:''} ${f[c.last]}`;
    rows.push({county:(f[c.county]||'').trim(),choice:String(choice||'').trim(),party:c.party>=0?(f[c.party]||'').trim():'',votes:Number(String(f[c.votes]).replace(/,/g,''))||0});}
  if(!rows.length)throw new Error('no rows for the Senate race (contests in the file: '+[...new Set(lines.slice(1,400).map(l=>splitRow(l,sep)[c.contest]))].slice(0,8).join('; ')+')');
  return rows;
}

// The race's candidates ({key, name, party}), from the profiles or the results-only nominees.
export function raceCandidates(research,id){
  const race=research.races.find(r=>r.id===id),people=[...research.members,...research.cands];
  if(race)return race.keys.map(k=>{const p=people.find(x=>x.id===k);return {key:k,name:p.name,party:p.party};});
  const lite=research.liteRaces.find(r=>r.id===id);if(!lite)throw new Error('no race '+id);
  return lite.nominees.map(n=>({key:n.fecCand||n.id,name:n.name,party:n.party}));
}
// Rows → votes by county FIPS and candidate key. map: the state's outlines (public/maps/<ST>.json).
export function byCounty(rows,cands,map){
  const fips=new Map(map.counties.map(c=>[countyKey(c.name),c.fips])),last=new Map(cands.map(c=>[lastName(c.name),c.key]));
  const counties={},unmatched=new Set(),names=new Map();
  for(const r of rows){
    const f=fips.get(countyKey(r.county));if(!f){unmatched.add(r.county);continue;}
    const key=last.get(lastName(r.choice))||'other';if(key!=='other')names.set(key,r.choice);
    const c=counties[f]||(counties[f]={});c[key]=(c[key]||0)+r.votes;
  }
  const totals={};for(const c of Object.values(counties))for(const [k,v] of Object.entries(c))totals[k]=(totals[k]||0)+v;
  const missing=cands.filter(c=>!names.has(c.key)).map(c=>c.name);
  return {counties,totals,total:Object.values(totals).reduce((a,b)=>a+b,0),unmatched:[...unmatched],missing,
    mapped:Object.keys(counties).length,of:map.counties.length};
}

const pct=(v,t)=>t?(v/t*100).toFixed(2)+'%':'—';
// One race: read its rows (a saved file, or each URL in turn), add them up by county, and say what was found.
export async function countyRace(research,id,{get,file=null,maps}){
  const src=SOURCES[id],map=await maps(src.state),cands=raceCandidates(research,id);
  const read=src.reader==='ncsbe'?async raw=>readNcsbe(typeof raw==='string'?raw:await unzipFile(raw,/\.txt$/i),src.contest)
    :src.reader==='enhanced'?async raw=>readEnhanced(typeof raw==='string'?JSON.parse(raw):JSON.parse(new TextDecoder().decode(raw)),src.contest)
    :async raw=>readTable(typeof raw==='string'?raw:new TextDecoder().decode(raw),src.contest);
  const tried=[];let rows=null,from=null;
  for(const u of file?[file]:src.urls){try{rows=await read(await get(u,src.reader));from=u;break;}catch(e){tried.push(`${u}: ${e.message}`);}}
  if(!rows)return {lines:[`CHECK ${id}: couldn't read the county results.`,...tried.map(t=>`      ${t}`),
    ...(src.page?[`      Open ${src.page}, download the county results (CSV or text), then: npm run counties:update -- --file ${id}=<the file>`]:[])]};
  const b=byCounty(rows,cands,map);
  const lines=[`${b.unmatched.length||b.missing.length||b.mapped<b.of?'CHECK':'NEW  '} ${id}: ${b.mapped} of ${b.of} counties, ${b.total.toLocaleString('en-US')} votes · `+
    cands.map(c=>`${c.name} ${pct(b.totals[c.key]||0,b.total)}`).join(' · ')+(b.totals.other?` · others ${pct(b.totals.other,b.total)}`:'')];
  if(b.mapped<b.of)lines.push(`      ${b.of-b.mapped} of the state's counties have no results in the file yet`);
  if(b.unmatched.length)lines.push(`      counties not on the map, left out: ${b.unmatched.join(', ')}`);
  if(b.missing.length)lines.push(`      no votes found for ${b.missing.join(', ')} (their name may be written differently in the file)`);
  const isUrl=/^https?:/.test(from);
  return {lines,race:{state:src.state,fetched:new Date().toISOString(),source:{t:src.source,u:isUrl?from:(src.page||src.urls[0])},
    candidates:[...cands.map(c=>({key:c.key,name:c.name,party:c.party})),{key:'other',name:'Other candidates'}],total:b.total,counties:b.counties}};
}

async function fetchRaw(u,reader){
  if(!/^https?:/.test(u)){const p=u.replace(/^~(?=\/)/,os.homedir());return reader==='ncsbe'?new Uint8Array(await fs.readFile(p)):await fs.readFile(p,'utf8');}
  const res=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (compatible; PublicLedger/1.0; county results)'},signal:AbortSignal.timeout(180000)});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),arg=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};
  const only=arg('--only')?new Set(arg('--only').split(',')):null,files=Object.fromEntries((arg('--file')?[arg('--file')]:[]).map(x=>x.split(/=(.*)/s).slice(0,2)));
  const research=JSON.parse(await fs.readFile(new URL('public/research.json',root),'utf8'));
  const outFile=new URL('public/county-results.json',root);
  const out=await fs.readFile(outFile,'utf8').then(JSON.parse,()=>({races:{}}));
  const maps=async st=>JSON.parse(await fs.readFile(new URL(`public/maps/${st}.json`,root),'utf8'));
  let changed=0;
  for(const id of Object.keys(SOURCES).filter(x=>!only||only.has(x)||files[x])){
    console.log(`Reading ${id}…`);
    const r=await countyRace(research,id,{get:fetchRaw,file:files[id]||null,maps});
    for(const l of r.lines)console.log(l);
    if(r.race){out.races[id]=r.race;changed++;}
  }
  out.about='County results for the maps on the Races page, from each state\'s election office (scripts/county-results.mjs). Unofficial until each state certifies.';
  out.races=Object.fromEntries(Object.entries(out.races).sort(([a],[b])=>a.localeCompare(b)));
  if(changed){await fs.writeFile(outFile,JSON.stringify(out)+'\n');console.log(`\nWrote public/county-results.json (${changed} ${changed===1?'race':'races'}). Look over any CHECK lines, run npm test, then commit and push it.`);}
  else console.log('\nNothing written.');
}
