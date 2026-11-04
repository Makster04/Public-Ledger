// County-by-county results for the maps on the Races page: public/county-results.json, from each state's own election
// office (no key needed). Each race lists where its results come from:
//   urls   the results file's address (tried in order)
//   pages  a results page whose links to data files are tried next, county files first
//   help   what to do by hand when none of them works
// A file is read by what it turns out to be, whatever its name says: a ZIP (the .txt, .tsv, .csv or .json inside), the
// "media export" JSON of the Enhanced Voting results sites (Georgia's), North Carolina's precinct file, or any CSV or
// tab-separated table with a row per county and candidate (Michigan's ".xls" county file is tab-separated text).
//   npm run counties:update                      every race below
//   npm run counties:update -- --only S-GA       just these races
//   npm run counties:update -- --file "S-MI=~/Downloads/mi-county-results.txt"   a file saved from the state's site
//   npm run counties:update -- --file "S-GA=https://…"   an address instead: a data file, or an Enhanced Voting results page
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
    page:'https://er.ncsbe.gov/',
    source:'North Carolina State Board of Elections, precinct results file'},
  'S-GA':{state:'GA',contest:/^(u\.?\s?s\.?|united states)\s+senat/i,
    urls:['https://results.sos.ga.gov/cdn/results/Georgia/export-2026NovGen.json'],
    page:'https://sos.ga.gov/page/georgia-election-results',
    help:'Open the November 3 results from https://sos.ga.gov/page/georgia-election-results, copy the results page\'s address from your browser, then: npm run counties:update -- --file "S-GA=<that address>" (or save the page\'s media export or results download and give that file instead)',
    source:'Georgia Secretary of State, results export'},
  'S-MI':{state:'MI',contest:/united states senator|^u\.?\s?s\.?\s+senat/i,
    urls:['https://mielections.us/election/results/DATA/2026GEN_MI_CENR_BY_COUNTY.xls','https://mielections.us/election/results/DATA/2026GEN_MI_CENR_BY_COUNTY.txt'],
    pages:['https://mielections.us/election/results/2026GEN_CENR.html'],
    page:'https://mielections.us/election/results/2026GEN_CENR.html',
    help:'Open https://mielections.us/election/results/2026GEN_CENR.html (or the November 3 results from the Michigan Secretary of State\'s site), right-click the county results download and copy its link, then: npm run counties:update -- --file "S-MI=<that link>" (or save the file and give it instead)',
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

// What a downloaded file holds, by its first bytes rather than its name: {rows} of the Senate race, or {page} for a web
// page, whose links are tried next. Excel workbooks can't be read here (save them as CSV); Michigan's ".xls" is text.
const EXCEL="an Excel workbook, which this script can't read: open it, save it as CSV or tab-delimited text, and give that file";
const isZip=b=>b[0]===0x50&&b[1]===0x4b&&b[2]===3&&b[3]===4,isOle=b=>b[0]===0xd0&&b[1]===0xcf&&b[2]===0x11&&b[3]===0xe0;
export async function readAny(raw,src){
  const bytes=typeof raw==='string'?new TextEncoder().encode(raw):raw;
  if(isOle(bytes))throw new Error(EXCEL);
  let text;
  if(isZip(bytes)){
    if(await unzipFile(bytes,/^xl\/workbook\.xml$/).then(()=>true,()=>false))throw new Error(EXCEL);
    text=await unzipFile(bytes,/\.(txt|tsv|csv|json)$/i).catch(()=>{throw new Error('a ZIP file with no .txt, .tsv, .csv or .json file in it');});
  }else text=new TextDecoder().decode(bytes);
  text=text.replace(/^\uFEFF/,'');const head=text.trimStart().slice(0,300);
  if(/^[{[]/.test(head)){let data;try{data=JSON.parse(text);}catch(e){throw new Error(`a JSON file that doesn't read (${e.message})`);}return {rows:readEnhanced(data,src.contest)};}
  if(/^<(!doctype\s+html|html|head|body|!--)/i.test(head))return {page:text};
  if(/^</.test(head))throw new Error('an XML file, which no reader here handles yet');
  return {rows:src.reader==='ncsbe'?readNcsbe(text,src.contest):readTable(text,src.contest)};
}
// The links on a results page to data files on the same site, county files first.
export function dataLinks(html,base){
  let host;try{host=new URL(base).host;}catch{return [];}
  const out=[];
  for(const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)){
    let u;try{u=new URL(m[1].replace(/&amp;/g,'&').trim(),base);}catch{continue;}
    if(u.host===host&&/\.(txt|tsv|csv|xls|xlsx|zip|json)$/i.test(u.pathname)&&!out.includes(u.href))out.push(u.href);
  }
  const county=u=>/count|cnty/i.test(u.split('/').pop());
  return [...out.filter(county),...out.filter(u=>!county(u))];
}
// An Enhanced Voting results page (…/results/public/Georgia/elections/2026NovGen) → its media export
// (…/cdn/results/Georgia/export-2026NovGen.json); any other address or file is left as it is.
export const enhancedExport=u=>{const m=/^(https?:\/\/[^/]+)\/results\/public\/([^/]+)\/elections\/([^/?#]+)/i.exec(u);return m?`${m[1]}/cdn/results/${m[2]}/export-${m[3]}.json`:u;};

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
// One race: read its rows (a file or address given by hand, or each of the race's addresses and then its pages' links),
// add them up by county, and say what was found.
export async function countyRace(research,id,{get,file=null,maps}){
  const src=SOURCES[id],map=await maps(src.state),cands=raceCandidates(research,id);
  const queue=file?[enhancedExport(file)]:[...src.urls,...(src.pages||[])],tried=[];let rows=null,from=null;
  for(let i=0;i<queue.length&&!rows;i++){
    const u=queue[i];
    try{
      const got=await readAny(await get(u),src);
      if(got.page){const links=dataLinks(got.page,u).filter(l=>!queue.includes(l)).slice(0,8);queue.push(...links);
        tried.push(`${u}: a web page, ${links.length?`linking to ${links.length} data ${links.length===1?'file':'files'}, tried next`:'not a results file, with no links to data files on its site'}`);continue;}
      rows=got.rows;from=u;
    }catch(e){tried.push(`${u}: ${e.message}`);}
  }
  if(!rows)return {lines:[`CHECK ${id}: couldn't read the county results.`,...tried.map(t=>`      ${t}`),
    `      ${src.help||`Open ${src.page||src.urls[0]}, copy the address of the county results file (or save the file), then: npm run counties:update -- --file "${id}=<that address or file>"`}`]};
  const b=byCounty(rows,cands,map);
  const lines=[`${b.unmatched.length||b.missing.length||b.mapped<b.of?'CHECK':'NEW  '} ${id}: ${b.mapped} of ${b.of} counties, ${b.total.toLocaleString('en-US')} votes · `+
    cands.map(c=>`${c.name} ${pct(b.totals[c.key]||0,b.total)}`).join(' · ')+(b.totals.other?` · others ${pct(b.totals.other,b.total)}`:'')+` (from ${from})`];
  if(b.mapped<b.of)lines.push(`      ${b.of-b.mapped} of the state's counties have no results in the file yet`);
  if(b.unmatched.length)lines.push(`      counties not on the map, left out: ${b.unmatched.join(', ')}`);
  if(b.missing.length)lines.push(`      no votes found for ${b.missing.join(', ')} (their name may be written differently in the file)`);
  const isUrl=/^https?:/.test(from);
  return {lines,race:{state:src.state,fetched:new Date().toISOString(),source:{t:src.source,u:isUrl?from:(src.page||src.urls[0])},
    candidates:[...cands.map(c=>({key:c.key,name:c.name,party:c.party})),{key:'other',name:'Other candidates'}],total:b.total,counties:b.counties}};
}

// A file on this computer, or an address: its bytes, or why they couldn't be had.
async function fetchRaw(u){
  if(!/^https?:/.test(u))return new Uint8Array(await fs.readFile(u.replace(/^~(?=\/)/,os.homedir())));
  let res;
  try{res=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (compatible; PublicLedger/1.0; county results)'},signal:AbortSignal.timeout(180000)});}
  catch(e){throw new Error(`couldn't connect (${e.cause?.code||e.cause?.message||e.message})`);}
  if(!res.ok)throw new Error(`HTTP ${res.status}${res.redirected?` (after a redirect to ${res.url})`:''}`);
  return new Uint8Array(await res.arrayBuffer());
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),arg=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};
  const only=arg('--only')?new Set(arg('--only').split(',')):null,files=Object.fromEntries(args.flatMap((a,i)=>a==='--file'&&args[i+1]?[args[i+1].split(/=(.*)/s).slice(0,2)]:[]));
  for(const id of Object.keys(files))if(!SOURCES[id])console.log(`No county results source for ${id} (there are: ${Object.keys(SOURCES).join(', ')})`);
  const research=JSON.parse(await fs.readFile(new URL('public/research.json',root),'utf8'));
  const outFile=new URL('public/county-results.json',root);
  const out=await fs.readFile(outFile,'utf8').then(JSON.parse,()=>({races:{}}));
  const maps=async st=>JSON.parse(await fs.readFile(new URL(`public/maps/${st}.json`,root),'utf8'));
  let changed=0;
  // A file given by hand reads just its own race, unless --only names more.
  const pick=only||(Object.keys(files).length?new Set(Object.keys(files)):null);
  for(const id of Object.keys(SOURCES).filter(x=>!pick||pick.has(x)||files[x])){
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
