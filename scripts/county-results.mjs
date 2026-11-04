// County-by-county results for the maps on the Races page: public/county-results.json, from each state's own election
// office (no key needed). Each race lists where its results come from:
//   urls   the results file's address (tried in order)
//   pages  a results page: its tables are read, then its links to county results and data files are followed
//   help   what to do by hand when none of them works
// A file is read by what it turns out to be, whatever its name says: a ZIP (the .txt, .tsv, .csv or .json inside), the
// "media export" JSON of the Enhanced Voting results sites (Georgia's), North Carolina's precinct file, any CSV or
// tab-separated table with a row per county and candidate, or a web page's tables of votes by county (Michigan's).
// What is read counts only when it has votes in the state's counties for the race's own candidates; otherwise the next
// address is tried.
//   npm run counties:update                      every race below
//   npm run counties:update -- --only S-GA       just these races
//   npm run counties:update -- --file "S-MI=~/Downloads/mi-county-results.txt"   a file saved from the state's site
//   npm run counties:update -- --file "S-GA=https://…"   an address instead: a data file, or an Enhanced Voting results page
//   npm run counties:update -- --watch           read them all again every 15 minutes (or --watch 5), until Ctrl+C; the
//                                                Races page shows each new read within two minutes, without reloading
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
  // The results site names the election "11032026GeneralAndSpecialElection"; it is also served from Enhanced Voting's own host.
  'S-GA':{state:'GA',contest:/^(u\.?\s?s\.?|united states)\s+senat/i,
    urls:['https://results.sos.ga.gov/cdn/results/Georgia/export-11032026GeneralAndSpecialElection.json',
      'https://app.enhancedvoting.com/cdn/results/Georgia/export-11032026GeneralAndSpecialElection.json'],
    page:'https://results.sos.ga.gov/results/public/Georgia/elections/11032026GeneralAndSpecialElection',
    help:'Open https://results.sos.ga.gov/results/public/Georgia/elections/11032026GeneralAndSpecialElection in your browser, save its media export (or its results download) and give that file: npm run counties:update -- --file "S-GA=<the file>"',
    source:'Georgia Secretary of State, results export'},
  // Michigan's results moved from mielections.us to the Voter Information Center: the election's page lists the statewide
  // races, each with a link to its county results.
  'S-MI':{state:'MI',contest:/united states senator|^u\.?\s?s\.?\s+senat/i,
    urls:[],
    pages:['https://mvic.sos.state.mi.us/votehistory/Index?type=C&electionDate=11-3-2026'],
    page:'https://mvic.sos.state.mi.us/votehistory/Index?type=C&electionDate=11-3-2026',
    help:'Open https://mvic.sos.state.mi.us/votehistory/Index?type=C&electionDate=11-3-2026, open the county results for United States Senator, copy that page\'s address (or a download link on it), then: npm run counties:update -- --file "S-MI=<that address>"',
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
  // Precincts reporting: the real precincts (not the absentee and early-voting tallies) with votes in the race.
  const pc=head.indexOf('Precinct'),real=head.indexOf('Real Precinct'),all=new Set(),voted=new Set();
  for(const l of lines.slice(1)){const f=l.split('\t');if(!contest.test(f[c.contest]||''))continue;
    const votes=Number(f[c.votes])||0;rows.push({county:f[c.county],choice:f[c.choice],party:(f[c.party]||'').trim(),votes});
    if(pc>=0&&real>=0&&f[real]==='Y'){const k=f[c.county]+'|'+f[pc];all.add(k);if(votes>0)voted.add(k);}}
  if(all.size)rows.reporting={n:voted.size,of:all.size,unit:'precincts'};
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
  // Precincts reporting, when the export gives them: on the statewide ballot item, or added up over the localities.
  const race=bi=>contest.test(String(bi.name||'').trim())&&!/state senat/i.test(bi.name);
  const count=(bi,re)=>{const k=Object.keys(bi||{}).find(x=>re.test(x));const v=k==null?NaN:Number(bi[k]);return Number.isFinite(v)?v:null;};
  const pair=bi=>({n:count(bi,/^precincts?report(ed|ing)$/i),of:count(bi,/^(precincts?participating|totalprecincts|precincts?total)$/i)});
  const top=(data?.results?.ballotItems||[]).find(race),local=locs.flatMap(l=>(l.ballotItems||[]).filter(race)).map(pair);
  let rp=top?pair(top):{n:null,of:null};
  if((rp.n==null||!rp.of)&&local.length&&local.every(x=>x.n!=null&&x.of))rp={n:local.reduce((a,x)=>a+x.n,0),of:local.reduce((a,x)=>a+x.of,0)};
  if(rp.n!=null&&rp.of>0&&rp.n<=rp.of)rows.reporting={...rp,unit:'precincts'};
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
// page, with {rows} from its tables when it has any. Excel workbooks can't be read here (save them as CSV).
// counties: the state's county names, for a page with a table per county.
const EXCEL="an Excel workbook, which this script can't read: open it, save it as CSV or tab-delimited text, and give that file";
const isZip=b=>b[0]===0x50&&b[1]===0x4b&&b[2]===3&&b[3]===4,isOle=b=>b[0]===0xd0&&b[1]===0xcf&&b[2]===0x11&&b[3]===0xe0;
export async function readAny(raw,src,counties=[]){
  const bytes=typeof raw==='string'?new TextEncoder().encode(raw):raw;
  if(isOle(bytes))throw new Error(EXCEL);
  let text;
  if(isZip(bytes)){
    if(await unzipFile(bytes,/^xl\/workbook\.xml$/).then(()=>true,()=>false))throw new Error(EXCEL);
    text=await unzipFile(bytes,/\.(txt|tsv|csv|json)$/i).catch(()=>{throw new Error('a ZIP file with no .txt, .tsv, .csv or .json file in it');});
  }else text=new TextDecoder().decode(bytes);
  text=text.replace(/^\uFEFF/,'');const head=text.trimStart().slice(0,300);
  if(/^[{[]/.test(head)){let data;try{data=JSON.parse(text);}catch(e){throw new Error(`a JSON file that doesn't read (${e.message})`);}return {rows:readEnhanced(data,src.contest)};}
  if(/^<(!doctype\s+html|html|head|body|!--)/i.test(head)){const t=readHtmlTables(text,counties);
    if(t.rows.length){const r=reportingIn(strip(text));if(r)t.rows.reporting=r;}
    return {page:text,rows:t.rows.length?t.rows:null,tables:t.tables};}
  if(/^</.test(head))throw new Error('an XML file, which no reader here handles yet');
  return {rows:src.reader==='ncsbe'?readNcsbe(text,src.contest):readTable(text,src.contest)};
}
// Web pages: text without tags, and the links and tables in them.
const ENTITY={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):Number(e.slice(1))):ENTITY[e.toLowerCase()]??m);
const strip=h=>decode(String(h).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
// A Senate race named anywhere in a page's text.
const SENATE=/\b(united states senat|u\.\s?s\.\s?senat|us senat)/i;
// "2,650 of 2,660 precincts reporting" (or counties) in a page's text.
export function reportingIn(text){
  const m=/([\d,]+)\s*(?:of|\/)\s*([\d,]+)\s+(precincts|counties)\s+(?:reporting|reported|have reported)/i.exec(text)
    ||/(precincts|counties)\s+reporting:?\s*([\d,]+)\s*(?:of|\/)\s*([\d,]+)/i.exec(text);
  if(!m)return null;
  const [n,of,unit]=/^\d/.test(m[1])?[m[1],m[2],m[3]]:[m[2],m[3],m[1]],a=Number(n.replace(/,/g,'')),b=Number(of.replace(/,/g,''));
  return b>0&&a<=b?{n:a,of:b,unit:unit.toLowerCase()}:null;
}
// The links on a results page worth following, on the same site: first the links to county results that follow a mention
// of the Senate race, closest first; then data files, county files first; then other links to county results.
export function pageLinks(html,base){
  let host;try{host=new URL(base).host;}catch{return [];}
  const senate=[...html.matchAll(new RegExp(SENATE.source,'gi'))].map(m=>m.index),found=[];
  for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1];if(!href||/^(#|javascript:|mailto:)/i.test(href.trim()))continue;
    let u;try{u=new URL(decode(href).trim(),base);}catch{continue;}
    if(u.host!==host)continue;u.hash='';
    const text=strip(m[2]),file=/\.(txt|tsv|csv|xls|xlsx|zip|json)$/i.test(u.pathname),about=`${text} ${decode(u.pathname+u.search)}`;
    const county=/count|cnty/i.test(about),results=county&&(file||/result|vote|download|export|csv/i.test(about));
    if(!file&&!results)continue;
    // How far the link comes after the closest mention of the Senate race before it.
    const since=m.index-Math.max(-Infinity,...senate.filter(x=>x<m.index));
    found.push({u:u.href,rank:results&&since<Infinity?0:file&&county?1:results?2:3,since,pos:m.index});
  }
  found.sort((a,b)=>a.rank-b.rank||(a.rank===0?a.since-b.since:a.pos-b.pos));
  return [...new Set(found.map(f=>f.u))];
}
// The links on a page, as "text → address", for a CHECK line when nothing on it could be read.
export function linkList(html,base,n=8){
  const out=[];
  for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1],text=strip(m[2]);
    if(href&&text&&/count|result|senat|download|export|csv/i.test(text+' '+href))out.push(`${text.slice(0,40)} → ${(()=>{try{return new URL(decode(href),base).href;}catch{return href;}})()}`);
    if(out.length>=n)break;
  }
  return out;
}
// A page's tables of votes: a row per county with a column per candidate, a row per county and candidate, or a table
// per county (named just above it) with a row per candidate. When some tables come right after the Senate race is named,
// only those are read. Totals and percentages are left out. tables: each table's header, for a CHECK line.
export function readHtmlTables(html,counties=[]){
  const num=x=>/^\d[\d,]*$/.test(x.trim())?Number(x.replace(/,/g,'')):null,keys=counties.map(n=>[countyKey(n),n]);
  const found=[];let last=0;
  for(const m of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)){
    const before=strip(html.slice(Math.max(last,m.index-4000),m.index)),cap=strip(/<caption\b[\s\S]*?<\/caption>/i.exec(m[0])?.[0]||'');last=m.index+m[0].length;
    const trs=[...m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(t=>[...t[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c=>strip(c[1])));
    const at=trs.findIndex(r=>r.length>=2);if(at<0)continue;
    found.push({head:trs[at],body:trs.slice(at+1).filter(r=>r.length===trs[at].length),near:`${before.slice(-300)} ${cap}`});
  }
  const senate=found.filter(t=>SENATE.test(t.near)),use=senate.length?senate:found,rows=[];
  const skip=/^(total|statewide|state total|all counties)/i,meta=/total|%|percent|precinct|registered|turnout|ballots|reporting|county|candidate|party|votes|name|choice/i;
  for(const t of use){
    const h=t.head.map(x=>x.toLowerCase()),col=re=>h.findIndex(x=>re.test(x));
    const cc=col(/county|jurisdiction|locality/),cand=col(/candidate|choice|name/),votes=col(/^votes?$|vote total|total votes|^votes/),party=col(/party/);
    const numeric=i=>t.body.length&&t.body.filter(r=>num(r[i])!=null).length>=t.body.length*0.8;
    if(cc>=0&&cand>=0&&votes>=0){for(const r of t.body)if(!skip.test(r[cc]))rows.push({county:r[cc],choice:r[cand],party:party>=0?r[party]:'',votes:num(r[votes])||0});continue;}
    if(cc>=0){const cols=h.map((x,i)=>i).filter(i=>i!==cc&&!meta.test(h[i])&&numeric(i));
      for(const r of t.body)if(!skip.test(r[cc]))for(const i of cols)rows.push({county:r[cc],choice:t.head[i],party:'',votes:num(r[i])||0});continue;}
    if(cand>=0&&votes>=0&&keys.length){
      const near=countyKey(t.near.slice(-200)),hit=keys.filter(([k])=>k&&near.endsWith(k)).sort((a,b)=>b[0].length-a[0].length)[0]
        ||keys.map(([k,n])=>[k,n,t.near.toLowerCase().lastIndexOf(n.toLowerCase())]).filter(x=>x[2]>=0).sort((a,b)=>b[2]-a[2])[0];
      if(hit)for(const r of t.body)if(!skip.test(r[cand]))rows.push({county:hit[1],choice:r[cand],party:party>=0?r[party]:'',votes:num(r[votes])||0});}
  }
  return {rows,tables:found.slice(0,4).map(t=>t.head.join(' | '))};
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
  const counties={},unmatched=new Set(),names=new Map(),others=new Map();
  for(const r of rows){
    const f=fips.get(countyKey(r.county));if(!f){unmatched.add(r.county);continue;}
    const key=last.get(lastName(r.choice))||'other';if(key!=='other')names.set(key,r.choice);
    else if(r.votes){const o=others.get(r.choice)||others.set(r.choice,{name:r.choice,party:r.party||'',votes:0}).get(r.choice);o.votes+=r.votes;}
    const c=counties[f]||(counties[f]={});c[key]=(c[key]||0)+r.votes;
  }
  const totals={};for(const c of Object.values(counties))for(const [k,v] of Object.entries(c))totals[k]=(totals[k]||0)+v;
  const missing=cands.filter(c=>!names.has(c.key)).map(c=>c.name);
  // The other candidates by name, statewide, largest first (the six largest; the rest stay in "other").
  const named=[...others.values()].sort((a,b)=>b.votes-a.votes).slice(0,6);
  return {counties,totals,others:named,total:Object.values(totals).reduce((a,b)=>a+b,0),unmatched:[...unmatched],missing,
    mapped:Object.keys(counties).length,of:map.counties.length};
}

const pct=(v,t)=>t?(v/t*100).toFixed(2)+'%':'—';
// One race: read its rows (a file or address given by hand, or each of the race's addresses and then its pages' links),
// add them up by county, and say what was found.
export async function countyRace(research,id,{get,file=null,maps}){
  const src=SOURCES[id],map=await maps(src.state),cands=raceCandidates(research,id);
  const queue=file?[enhancedExport(file)]:[...src.urls,...(src.pages||[])],tried=[],names=map.counties.map(c=>c.name);let rows=null,from=null,b=null;
  for(let i=0;i<queue.length&&i<20&&!rows;i++){
    const u=queue[i];
    try{
      const got=await readAny(await get(u),src,names),notes=[];
      // What was read counts only with votes in the state's counties for at least one of the race's candidates.
      if(got.rows){const c=byCounty(got.rows,cands,map);
        if(c.mapped&&c.missing.length<cands.length){rows=got.rows;from=u;b=c;break;}
        notes.push(c.mapped?`its votes by county are for other candidates (${[...new Set(got.rows.map(r=>r.choice))].slice(0,4).join(', ')})`:'no votes by county in it');}
      if(!got.page)throw new Error(notes[0]);
      const links=pageLinks(got.page,u).filter(l=>!queue.includes(l)).slice(0,8);queue.push(...links);
      tried.push(`${u}: a web page, ${[...notes,links.length?`linking to ${links.length} county results or data ${links.length===1?'page':'pages'}, tried next`:'with nothing to follow on its site'].join('; ')}`);
      if(!links.length){for(const l of linkList(got.page,u))tried.push(`        link: ${l}`);for(const t of got.tables||[])tried.push(`        table: ${t.slice(0,150)}`);}
    }catch(e){tried.push(`${u}: ${e.message}`);}
  }
  if(!rows)return {lines:[`CHECK ${id}: couldn't read the county results.`,...tried.map(t=>`      ${t}`),
    `      ${src.help||`Open ${src.page||src.urls[0]}, copy the address of the county results file (or save the file), then: npm run counties:update -- --file "${id}=<that address or file>"`}`]};
  const lines=[`${b.unmatched.length||b.missing.length||b.mapped<b.of?'CHECK':'NEW  '} ${id}: ${b.mapped} of ${b.of} counties, ${b.total.toLocaleString('en-US')} votes · `+
    cands.map(c=>`${c.name} ${pct(b.totals[c.key]||0,b.total)}`).join(' · ')+(b.totals.other?` · others ${pct(b.totals.other,b.total)}`:'')+
    (rows.reporting?` · ${rows.reporting.n.toLocaleString('en-US')} of ${rows.reporting.of.toLocaleString('en-US')} ${rows.reporting.unit} reporting`:'')+` (from ${from})`];
  if(b.mapped<b.of)lines.push(`      ${b.of-b.mapped} of the state's counties have no results in the file yet`);
  if(b.unmatched.length)lines.push(`      counties not on the map, left out: ${b.unmatched.join(', ')}`);
  if(b.missing.length)lines.push(`      no votes found for ${b.missing.join(', ')} (their name may be written differently in the file)`);
  const isUrl=/^https?:/.test(from);
  return {lines,race:{state:src.state,fetched:new Date().toISOString(),source:{t:src.source,u:isUrl?from:(src.page||src.urls[0])},
    candidates:[...cands.map(c=>({key:c.key,name:c.name,party:c.party})),{key:'other',name:'Other candidates'}],total:b.total,
    ...(rows.reporting?{reporting:rows.reporting}:{}),...(b.others.length?{others:b.others}:{}),counties:b.counties}};
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
  // A file given by hand reads just its own race, unless --only names more.
  const pick=only||(Object.keys(files).length?new Set(Object.keys(files)):null),ids=Object.keys(SOURCES).filter(x=>!pick||pick.has(x)||files[x]);
  const wi=args.indexOf('--watch'),watch=wi<0?0:Math.max(2,Number(args[wi+1])||15);
  // One pass over the races: each one read again replaces what was saved; one that can't be read keeps its last read.
  const pass=async()=>{
    let read=0,moved=0;
    for(const id of ids){
      console.log(`Reading ${id}…`);
      const r=await countyRace(research,id,{get:fetchRaw,file:files[id]||null,maps});
      for(const l of r.lines)console.log(l);
      if(!r.race)continue;
      const old=out.races[id],same=old&&JSON.stringify({...old,fetched:0})===JSON.stringify({...r.race,fetched:0});
      if(old&&same)console.log('      same counts as the last read');else moved++;
      out.races[id]=r.race;read++;
    }
    out.about='County results for the maps on the Races page, from each state\'s election office (scripts/county-results.mjs). Unofficial until each state certifies.';
    out.races=Object.fromEntries(Object.entries(out.races).sort(([a],[b])=>a.localeCompare(b)));
    if(read)await fs.writeFile(outFile,JSON.stringify(out)+'\n');
    return {read,moved};
  };
  if(!watch){
    const {read}=await pass();
    if(read)console.log(`\nWrote public/county-results.json (${read} ${read===1?'race':'races'}). Look over any CHECK lines, run npm test, then commit and push it.`);
    else console.log('\nNothing written.');
  }else{
    console.log(`Watching ${ids.length} ${ids.length===1?'race':'races'}: reading ${ids.length===1?'it':'them'} again every ${watch} minutes. Leave this running (npm start in another window shows the site); stop with Ctrl+C.`);
    for(;;){
      console.log(`\n— ${new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})} —`);
      const {read,moved}=await pass();
      console.log(read?`Saved public/county-results.json: ${moved?`new counts for ${moved} ${moved===1?'race':'races'}`:'no new counts'}. Next read at ${new Date(Date.now()+watch*60000).toLocaleTimeString('en-US',{timeStyle:'short'})}.`:'Nothing could be read this time; trying again later.');
      await new Promise(r=>setTimeout(r,watch*60000));
    }
  }
}
