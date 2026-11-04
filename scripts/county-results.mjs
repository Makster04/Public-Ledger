// County-by-county results for the maps on the Races page: public/county-results.json, from each state's own election
// office (no key needed). Each race lists where its results come from:
//   urls   the results file's address (tried in order)
//   pages  a results page: its tables are read, then its links to county results and data files are followed
//   help   what to do by hand when none of them works
//   clarity  a state on a Clarity Elections results site: the November 3 election is found in the state's list of
//            elections, and its detail XML (votes by county and vote type) is read
// A file is read by what it turns out to be, whatever its name says: a ZIP (the .txt, .tsv, .csv, .json or .xml inside),
// the "media export" JSON of the Enhanced Voting results sites (Georgia's, Idaho's, Virginia's), Clarity's detail XML,
// North Carolina's precinct file, any CSV or tab-separated table with a row per county and candidate, or a web page's
// tables of votes by county (Michigan's).
// What is read counts only when it has votes in the state's counties for the race's own candidates; otherwise the next
// address is tried.
//   npm run counties:update                      every race below
//   npm run counties:update -- --only S-GA       just these races
//   npm run counties:update -- --file "S-MI=~/Downloads/mi-county-results.txt"   a file saved from the state's site
//   npm run counties:update -- --file "S-GA=https://…"   an address instead: a data file, or an Enhanced Voting results page
//   npm run counties:update -- --probe           for the states without a reader yet: what each one's results site serves
//                                                (status, links, tables, the data addresses in its scripts), saved to
//                                                data/county-probe.txt, so a reader can be written for the real thing
//   npm run counties:update -- --watch           read them all again every 15 minutes (or --watch 5), until Ctrl+C; the
//                                                Races page shows each new read within two minutes, without reloading
// Each candidate is matched to the race's own candidates by last name; everyone else counts as "other". Each county is
// matched by name to the outlines in public/maps/<ST>.json. A county the outlines don't know is listed and left out.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import {unzipFile} from '../src/sources.mjs';

const root=new URL('..',import.meta.url);
// What to do for a site that turns scripts away with a bot check: save the page from a browser, which reads it as any
// visitor does, and give the saved file.
const SAVED_PAGE=(id,page,what)=>`This site checks for scripts and turned this one away, so use your browser: open ${page}, ${what}, then save the page (in Safari: File, Save As, Format "Page Source"; in Chrome: File, Save Page As, "Webpage, HTML Only") and run: npm run counties:update -- --file "${id}=~/Downloads/<the saved file>"`;
// The U.S. Senate race, as a state may name it.
const SENATE_CONTEST=/^(u\.?\s?s\.?|united states)\s+senat|^us senat/i;
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
    help:SAVED_PAGE('S-MI','https://mvic.sos.state.mi.us/votehistory/Index?type=C&electionDate=11-3-2026','open the county results for United States Senator'),
    source:'Michigan Department of State, county results file'},
  // Idaho's statewide results run on Enhanced Voting, as Georgia's do (jurisdiction "id", election "nov2026").
  'S-ID':{state:'ID',contest:/^(u\.?\s?s\.?|united states)\s+senat/i,
    urls:['https://app.enhancedvoting.com/cdn/results/id/export-nov2026.json'],
    page:'https://app.enhancedvoting.com/results/public/id/elections/nov2026',
    help:'Open https://app.enhancedvoting.com/results/public/id/elections/nov2026 in your browser, save its media export (or its results download) and give that file: npm run counties:update -- --file "S-ID=<the file>"',
    source:'Idaho Secretary of State, results export'},
  // Virginia's results run on Enhanced Voting too; its localities are counties and independent cities.
  'S-VA':{state:'VA',contest:/united states senat/i,
    urls:['https://enr.elections.virginia.gov/cdn/results/virginia/export-2026-November-General.json','https://enr.elections.virginia.gov/cdn/results/Virginia/export-2026-November-General.json'],
    page:'https://enr.elections.virginia.gov/results/public/virginia/elections/2026-November-General',
    help:'Open https://enr.elections.virginia.gov/results/public/virginia/elections/2026-November-General in your browser, save its media export (or its results download) and give that file: npm run counties:update -- --file "S-VA=<the file>"',
    source:'Virginia Department of Elections, results export'},
  // States on Clarity Elections results sites.
  'S-CO':{state:'CO',contest:SENATE_CONTEST,clarity:{base:'https://results.enr.clarityelections.com',st:'CO'},urls:[],page:'https://results.enr.clarityelections.com/CO/',source:'Colorado Secretary of State, election night results (Clarity)'},
  'S-IA':{state:'IA',contest:SENATE_CONTEST,clarity:{base:'https://results.enr.clarityelections.com',st:'IA'},urls:[],page:'https://electionresults.iowa.gov/IA/',source:'Iowa Secretary of State, election night results (Clarity)'},
  'S-KS':{state:'KS',contest:SENATE_CONTEST,clarity:{base:'https://results.enr.clarityelections.com',st:'KS'},urls:[],page:'https://results.enr.clarityelections.com/KS/',source:'Kansas Secretary of State, election night results (Clarity)'},
  'S-WV':{state:'WV',contest:SENATE_CONTEST,clarity:{base:'https://results.enr.clarityelections.com',st:'WV'},urls:[],page:'https://results.enr.clarityelections.com/WV/',source:'West Virginia Secretary of State, election night results (Clarity)'},
  // South Carolina's results page links to its Clarity site (enr-scvotes.org) for each election.
  'S-SC':{state:'SC',contest:SENATE_CONTEST,clarity:{base:'https://www.enr-scvotes.org',st:'SC'},urls:[],pages:['https://scvotes.gov/2026-general-election-results/'],page:'https://scvotes.gov/2026-general-election-results/',source:'South Carolina Election Commission, election night results (Clarity)'},
  // States whose results pages are read for their tables of votes by county, or for the exports and county pages they
  // link to. What each one holds is checked on the first run.
  // Delaware's results page links to its results as a CSV on the state's open-data site (a Socrata dataset).
  'S-DE':{state:'DE',contest:/united states senat|^u\.?\s?s\.?\s+senat|^us senat/i,urls:['https://data.delaware.gov/resource/yg7x-kgjc.csv?election_name=2026%20General%20Election&$limit=50000'],pages:['https://elections.delaware.gov/results/enr/GE2026.html'],page:'https://elections.delaware.gov/results/enr/GE2026.html',source:'Delaware Department of Elections, unofficial results'},
  'S-WY':{state:'WY',contest:SENATE_CONTEST,urls:[],pages:['https://sos.wyo.gov/Elections/Docs/2026/2026GeneralResults.aspx'],page:'https://sos.wyo.gov/Elections/Docs/2026/2026GeneralResults.aspx',source:'Wyoming Secretary of State, unofficial results'},
  'S-MT':{state:'MT',contest:SENATE_CONTEST,urls:[],pages:['https://electionresults.mt.gov/ResultsExport.aspx','https://electionresults.mt.gov/resultsSW.aspx?type=FED&map=CTY'],page:'https://electionresults.mt.gov/resultsSW.aspx?type=FED&map=CTY',source:'Montana Secretary of State, election results'},
  'S-NE':{state:'NE',contest:SENATE_CONTEST,urls:[],pages:['https://electionresults.nebraska.gov/ResultsExport.aspx','https://electionresults.nebraska.gov/resultsSW.aspx?type=SW&map=CTY'],page:'https://electionresults.nebraska.gov/resultsSW.aspx?type=SW&map=CTY',source:'Nebraska Secretary of State, election results'},
  'S-NM':{state:'NM',contest:SENATE_CONTEST,urls:[],pages:['https://electionresults.sos.nm.gov/ResultsExport.aspx','https://electionresults.sos.nm.gov/resultsSW.aspx?type=FED&map=CTY'],page:'https://electionresults.sos.nm.gov/resultsSW.aspx?type=FED&map=CTY',source:'New Mexico Secretary of State, election results'},
  'S-OR':{state:'OR',contest:SENATE_CONTEST,urls:[],pages:['https://results.oregonvotes.gov/ResultsExport.aspx','https://results.oregonvotes.gov/resultsSW.aspx?type=FED&map=CTY'],page:'https://results.oregonvotes.gov/resultsSW.aspx?type=FED&map=CTY',source:'Oregon Secretary of State, election results'},
  'S-SD':{state:'SD',contest:SENATE_CONTEST,urls:[],pages:['https://electionresults.sd.gov/ResultsExport.aspx','https://electionresults.sd.gov/resultsSW.aspx?type=SWR&map=CTY'],page:'https://electionresults.sd.gov/resultsSW.aspx?type=SWR&map=CTY',source:'South Dakota Secretary of State, election results'},
  'S-MN':{state:'MN',contest:SENATE_CONTEST,urls:[],pages:['https://electionresults.sos.mn.gov/Results/Index?ErsElectionId=201&officeInElectionIdList=38485&officeInElectionIdList=-1&scenario=USSenate&electionDate=11%2F03%2F2026%2000%3A00%3A00'],page:'https://electionresults.sos.mn.gov/',help:SAVED_PAGE('S-MN','https://electionresults.sos.mn.gov/','open U.S. Senate and its results by county'),source:'Minnesota Secretary of State, election results'},
  'S-TN':{state:'TN',contest:SENATE_CONTEST,urls:[],pages:['https://elections.tn.gov/county-breakdown/United%20States%20Senate','https://elections.tn.gov/county-breakdown/U.S.%20Senate','https://elections.tn.gov/county-breakdown/US%20Senate','https://elections.tn.gov/categories/federal/offices'],page:'https://elections.tn.gov/',source:'Tennessee Secretary of State, election night results'},
  'S-TX':{state:'TX',contest:SENATE_CONTEST,urls:[],pages:['https://electionresults.sos.state.tx.us/results.html'],page:'https://electionresults.sos.state.tx.us/results.html',source:'Texas Secretary of State, election results'},
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
const PICK={county:['countyname','county','countydescription','jurisdiction','jurisdictionname'],
  contest:['officedescription','contestname','officename','office','contest','contesttitle','racename','racetitle','race'],
  choice:['candidate','choice','candidatename','candidatefullname','ballotname','name'],last:['candidatelastname','lastname'],first:['candidatefirstname','firstname'],
  party:['partyname','party','choiceparty','partydescription','partycode'],votes:['candidatevotes','totalvotes','votes','votecount','votetotal','total']};
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
    text=await unzipFile(bytes,/\.(txt|tsv|csv|json|xml)$/i).catch(()=>{throw new Error('a ZIP file with no .txt, .tsv, .csv, .json or .xml file in it');});
  }else text=new TextDecoder().decode(bytes);
  text=text.replace(/^\uFEFF/,'');const head=text.trimStart().slice(0,300);
  if(/^[{[]/.test(head)){let data;try{data=JSON.parse(text);}catch(e){throw new Error(`a JSON file that doesn't read (${e.message})`);}return {rows:readEnhanced(data,src.contest)};}
  if(/^<(!doctype\s+html|html|head|body|!--)/i.test(head)||/<html\b/i.test(head)){const t=readHtmlTables(text,counties);
    if(t.rows.length){const r=reportingIn(strip(text));if(r)t.rows.reporting=r;}
    return {page:text,rows:t.rows.length?t.rows:null,tables:t.tables};}
  if(/^</.test(head)){if(/<ElectionResult\b/.test(text.slice(0,4000)))return {rows:readClarityXml(text,src.contest)};throw new Error('an XML file, which no reader here handles yet');}
  return {rows:src.reader==='ncsbe'?readNcsbe(text,src.contest):readTable(text,src.contest)};
}
// Clarity's detail XML: <Contest text> holds <Choice text party>, each with <VoteType> totals by <County name votes>.
// The votes of every vote type (election day, early, absentee …) are added up; precincts reporting come from the contest.
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
export function readClarityXml(xml,contest){
  const rows=[],names=[];let reporting=null;
  for(const c of xml.matchAll(/<Contest\b([^>]*)>([\s\S]*?)<\/Contest>/g)){
    const a=attrs(c[1]);names.push(a.text);if(!contest.test(String(a.text||'').trim())||/state senat/i.test(a.text))continue;
    const n=Number(a.precinctsReported),of=Number(a.precinctsParticipating);if(of>0&&n<=of)reporting={n,of,unit:'precincts'};
    for(const ch of c[2].matchAll(/<Choice\b([^>]*)>([\s\S]*?)<\/Choice>/g)){
      const b=attrs(ch[1]),by={};
      for(const v of ch[2].matchAll(/<County\b([^>]*?)\/?>/g)){const x=attrs(v[1]);if(x.name)by[x.name]=(by[x.name]||0)+(Number(x.votes)||0);}
      for(const [county,votes] of Object.entries(by))rows.push({county,choice:String(b.text||'').trim(),party:String(b.party||'').trim(),votes});
    }
  }
  if(!rows.length)throw new Error('no Senate contest with votes by county in the detail XML (contests: '+names.slice(0,8).join('; ')+')');
  if(reporting)rows.reporting=reporting;
  return rows;
}
// A Clarity election's address (…/CO/123456/… or …/SC/127227/): its site, state and election number.
export const clarityOf=u=>{const m=/^(https?:\/\/[^/]+)\/+([A-Z]{2})\/+(\d{4,})(?:[/?#]|$)/.exec(String(u));return m?{base:m[1],st:m[2],eid:m[3]}:null;};
// The November 3, 2026 election in a Clarity site's list of elections, which may be laid out in several ways: the
// object with an election number whose name or date says November 3, 2026.
export function clarityElection(list){
  const found=[],walk=(o,depth=0)=>{if(!o||typeof o!=='object'||depth>6)return;
    if(!Array.isArray(o)){const idKey=Object.keys(o).find(k=>/^(eid|electionid|id)$/i.test(k)&&/^\d{4,}$/.test(String(o[k])));
      if(idKey){const text=Object.values(o).filter(v=>typeof v!=='object').join(' ');found.push({eid:String(o[idKey]),text});}
      // A list keyed by election number: {"127408": {"name": …, "date": …}} or {"127408": "11/3/2026 General Election"}.
      for(const [k,v] of Object.entries(o))if(/^\d{4,}$/.test(k)&&!found.some(f=>f.eid===k)){
        const text=v&&typeof v==='object'?Object.values(v).filter(x=>typeof x!=='object').join(' '):String(v??'');found.push({eid:k,text});}}
    for(const v of Object.values(o))walk(v,depth+1);};
  walk(list);
  const day=/\b11\/0?3\/2026\b|2026-11-03|november 0?3,? 2026|20261103/i;
  const best=found.filter(f=>day.test(f.text)).sort((a,b)=>(/general/i.test(b.text)?1:0)-(/general/i.test(a.text)?1:0))[0];
  // None found: name the newest ones in the list (the highest numbers), to see what it holds.
  const newest=found.slice().sort((a,b)=>Number(b.eid)-Number(a.eid)).slice(0,5);
  if(!best)throw new Error(`no November 3, 2026 election in the list (newest: ${newest.map(f=>(f.text.includes(f.eid)?f.text:`${f.eid} ${f.text}`).slice(0,70)).join('; ')||'nothing that reads as an election'})`);
  return best.eid;
}
const asText=x=>typeof x==='string'?x:new TextDecoder().decode(x);
// A Clarity election's detail XML address: the election's current version, then its reports/detailxml.zip.
async function clarityDetail({base,st,eid},get){
  const ver=asText(await get(`${base}/${st}/${eid}/current_ver.txt`)).trim();
  if(!/^\d+$/.test(ver))throw new Error(`current_ver.txt for election ${eid} reads "${ver.slice(0,40)}"`);
  return `${base}/${st}/${eid}/${ver}/reports/detailxml.zip`;
}
// The state's November 3 election on its Clarity site, from the list of elections.
async function clarityFind({base,st},get){
  const errs=[];
  for(const u of [`${base}/${st}/elections.json`,`${base}/${st}/elections.json?v=1`]){
    let list;try{list=JSON.parse(asText(await get(u)));}catch(e){errs.push(`${u}: ${/JSON/.test(e.message)?'not a list of elections':e.message}`);continue;}
    try{return await clarityDetail({base,st,eid:clarityElection(list)},get);}catch(e){errs.push(`${u}: ${e.message}`);break;}
  }
  throw new Error(errs.join(' · '));
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
    const clarity=clarityOf(u.href);if(u.host!==host&&!clarity)continue;u.hash='';
    const text=strip(m[2]),file=/\.(txt|tsv|csv|xls|xlsx|zip|json)$/i.test(u.pathname),about=`${text} ${decode(u.pathname+u.search)}`;
    const county=/count|cnty/i.test(about),results=!!clarity||county&&(file||/result|vote|download|export|csv|breakdown/i.test(about));
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

// A county outline's name for matching. Virginia's independent cities (FIPS 51500 and up) share names with counties
// (Fairfax, Franklin, Richmond, Roanoke), so they are matched as "<name> city", as the state writes them.
export const mapKey=c=>countyKey(c.name)+(c.fips.startsWith('51')&&Number(c.fips.slice(2))>=500?'city':'');

// The race's candidates ({key, name, party}), from the profiles or the results-only nominees.
export function raceCandidates(research,id){
  const race=research.races.find(r=>r.id===id),people=[...research.members,...research.cands];
  if(race)return race.keys.map(k=>{const p=people.find(x=>x.id===k);return {key:k,name:p.name,party:p.party};});
  const lite=research.liteRaces.find(r=>r.id===id);if(!lite)throw new Error('no race '+id);
  return lite.nominees.map(n=>({key:n.fecCand||n.id,name:n.name,party:n.party}));
}
// Rows → votes by county FIPS and candidate key. map: the state's outlines (public/maps/<ST>.json).
export function byCounty(rows,cands,map){
  const fips=new Map(map.counties.map(c=>[mapKey(c),c.fips])),last=new Map(cands.map(c=>[lastName(c.name),c.key]));
  // A county written without "city" when only the independent city has the name ("Norfolk" for Norfolk city).
  const find=name=>{const k=countyKey(name);return fips.get(k)??fips.get(k+'city');};
  const counties={},unmatched=new Set(),names=new Map(),others=new Map();
  for(const r of rows){
    const f=find(r.county);if(!f){unmatched.add(r.county);continue;}
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
  // A Clarity state: find the November 3 election first.
  if(src.clarity&&!file){try{queue.unshift(await clarityFind(src.clarity,get));}catch(e){tried.push(`${src.clarity.base}/${src.clarity.st}/ (list of elections): ${e.message}`);}}
  for(let i=0;i<queue.length&&i<20&&!rows;i++){
    let u=queue[i];
    try{
      // The address of a Clarity election (a page, not a file): its detail XML.
      const c=clarityOf(u);if(c&&!/\.(zip|xml|txt|json)$/i.test(new URL(u).pathname)){u=await clarityDetail(c,get);queue[i]=u;}
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

// Where each Senate state without a reader posts (or links to) its results, for --probe: the official results sites as
// best known, some of them guesses. What the probe finds there decides each state's reader.
export const PROBE={
  AL:['https://www2.alabamavotes.gov/electionnight/','https://www.sos.alabama.gov/alabama-votes/voter/election-information'],
  AR:['https://enr.totalresults.com/arkansas','https://www.sos.arkansas.gov/elections/research/election-results'],
  CO:['https://results.enr.clarityelections.com/CO/','https://www.coloradosos.gov/pubs/elections/Results/Archives.html'],
  DE:['https://elections.delaware.gov/results/html/index.shtml','https://elections.delaware.gov/'],
  FL:['https://results.elections.myflorida.com/','https://fldoselectionfiles.elections.myflorida.com/enightfilespublic/20261103_ElecResultsFL.txt'],
  IA:['https://electionresults.iowa.gov/','https://results.enr.clarityelections.com/IA/','https://sos.iowa.gov/elections/results/'],
  IL:['https://www.elections.il.gov/','https://www.elections.il.gov/electionoperations/ElectionVoteTotals.aspx'],
  KS:['https://sos.ks.gov/elections/elections-results.html','https://results.enr.clarityelections.com/KS/'],
  KY:['https://elect.ky.gov/results/','https://results.enr.clarityelections.com/KY/'],
  LA:['https://voterportal.sos.la.gov/graphical','https://voterportal.sos.la.gov/ElectionResults/ElectionResults/Index'],
  MA:['https://electionstats.state.ma.us/','https://www.sec.state.ma.us/divisions/elections/'],
  ME:['https://www.maine.gov/sos/cec/elec/results/','https://www.maine.gov/sos/elections-voting/election-results'],
  MN:['https://electionresults.sos.mn.gov/','https://electionresultsfiles.sos.mn.gov/20261103/'],
  MS:['https://www.sos.ms.gov/elections-voting/election-results','https://www.sos.ms.gov/'],
  MT:['https://electionresults.mt.gov/','https://sosmt.gov/elections/results/'],
  NE:['https://electionresults.nebraska.gov/','https://sos.nebraska.gov/elections/election-results'],
  NH:['https://www.sos.nh.gov/elections/results','https://www.sos.nh.gov/'],
  NJ:['https://www.nj.gov/state/elections/election-information-results.shtml','https://www.nj.gov/state/elections/'],
  NM:['https://electionresults.sos.nm.gov/','https://www.sos.nm.gov/voting-and-elections/election-results/'],
  OH:['https://liveresults.ohiosos.gov/','https://www.ohiosos.gov/elections/election-results-and-data/'],
  OK:['https://results.okelections.us/','https://oklahoma.gov/elections/election-results.html'],
  OR:['https://results.oregonvotes.gov/','https://sos.oregon.gov/elections/Pages/electionhistory.aspx'],
  RI:['https://electionresults.ri.gov/','https://vote.sos.ri.gov/'],
  SC:['https://scvotes.gov/election-results/','https://results.enr.clarityelections.com/SC/'],
  SD:['https://electionresults.sd.gov/','https://sdsos.gov/elections-voting/election-resources/election-history/'],
  TN:['https://elections.tn.gov/','https://sos.tn.gov/elections/results'],
  TX:['https://electionresults.sos.state.tx.us/results.html','https://results.texas-election.com/'],
  VA:['https://enr.elections.virginia.gov/','https://www.elections.virginia.gov/resultsreports/election-results/'],
  WV:['https://results.enr.clarityelections.com/WV/','https://sos.wv.gov/elections/Pages/ElectionResults.aspx'],
  WY:['https://sos.wyo.gov/Elections/State/Results.aspx','https://sos.wyo.gov/Elections/'],
};
const UA='Mozilla/5.0 (compatible; PublicLedger/1.0; county results)';
// Pages the probe also saves, without their scripts and styles, to data/county-samples/, for the states whose results
// pages don't use plain tables: one county's page and the race's page.
export const SAMPLES={
  MT:['https://electionresults.mt.gov/ResultsSW.aspx?type=CTYALL&cty=01&map=CTY','https://electionresults.mt.gov/resultsSW.aspx?type=FED&map=CTY'],
  NE:['https://electionresults.nebraska.gov/resultsSW.aspx?type=CTYALL&map=CTY&cty=01','https://electionresults.nebraska.gov/resultsSW.aspx?type=SW&map=CTY'],
  NM:['https://electionresults.sos.nm.gov/resultsSW.aspx?type=CTYALL&map=CTY&cty=02&name=Bernalillo','https://electionresults.sos.nm.gov/resultsSW.aspx?type=FED&map=CTY'],
  OR:['https://results.oregonvotes.gov/ResultsSW.aspx?type=CTYALL&cty=20&map=CTY','https://results.oregonvotes.gov/resultsSW.aspx?type=FED&map=CTY'],
  SD:['https://electionresults.sd.gov/ResultsSW.aspx?type=CTYALL&cty=10&map=CTY','https://electionresults.sd.gov/resultsSW.aspx?type=SWR&map=CTY'],
  TN:['https://elections.tn.gov/county-breakdown/Governor'],
  WY:['https://sos.wyo.gov/Elections/Docs/2026/2026GeneralResults.aspx'],
  DE:['https://elections.delaware.gov/results/enr/GE2026.html'],
  KS:['https://results.enr.clarityelections.com/KS/elections.json'],
  WV:['https://results.enr.clarityelections.com/WV/elections.json'],
  IA:['https://results.enr.clarityelections.com/IA/elections.json','https://results.enr.clarityelections.com/IA/127077/385624/json/en/electionsettings.json'],
};
// A page as saved for a sample: no scripts, styles or comments, at most 150 KB.
export const sampleOf=text=>String(text).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\n\s*\n+/g,'\n').slice(0,150000);
// What one address serves: its status, kind and size, and for a web page its title, links, tables and the data
// addresses named in its own scripts; for JSON its keys.
export async function probeOne(u,{get=fetch}={}){
  let res;try{res=await get(u,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(45000)});}catch(e){return [`${u} → couldn't connect (${e.cause?.code||e.message})`];}
  const type=(res.headers.get('content-type')||'').split(';')[0],bytes=new Uint8Array(await res.arrayBuffer()),text=new TextDecoder().decode(bytes.subarray(0,3e6));
  const out=[`${u} → HTTP ${res.status}${res.redirected?` (now ${res.url})`:''}, ${type||'no type'}, ${Math.round(bytes.length/1024)} KB`],base=res.url||u;
  if(/^\s*[{[]/.test(text.slice(0,200))){
    try{const j=JSON.parse(text),first=Array.isArray(j)?j[0]:j,keys=o=>o&&typeof o==='object'?Object.keys(o).slice(0,20).join(', '):'';
      out.push(`    JSON: ${Array.isArray(j)?`a list of ${j.length}; first item's keys: `:'keys: '}${keys(first)}`);
      for(const [k,v] of Object.entries(first||{}).slice(0,20))if(v&&typeof v==='object')out.push(`    ${k}: ${Array.isArray(v)?`a list of ${v.length}; first item's keys: ${keys(v[0])}`:`keys: ${keys(v)}`}`);}
    catch{out.push('    JSON that does not read (cut off?)');}
    return out;
  }
  if(!/^\s*</.test(text.slice(0,300))){out.push(`    starts: ${text.slice(0,240).replace(/\s+/g,' ')}`);return out;}
  out.push(`    title: ${strip(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1]||'(none)').slice(0,100)} · ${strip(text).length.toLocaleString('en-US')} characters of text`);
  const seen=new Set();
  for(const m of text.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1],t=strip(m[2]);if(!href||/^(#|javascript:|mailto:)/i.test(href))continue;
    let a;try{a=new URL(decode(href),base).href;}catch{continue;}
    if(seen.has(a)||!/2026|nov|general|result|count|senat|download|export|csv|json|xml|zip|txt|report/i.test(t+' '+a))continue;
    seen.add(a);out.push(`    link: ${t.slice(0,50)||'(no text)'} → ${a}`);if(seen.size>=14)break;
  }
  for(const t of readHtmlTables(text).tables)out.push(`    table: ${t.slice(0,160)}`);
  // A page filled in by its scripts: the addresses those scripts ask for.
  const scripts=[...text.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(m=>{try{return new URL(decode(m[1]),base);}catch{return null;}}).filter(x=>x&&x.host===new URL(base).host).slice(0,3);
  const found=new Set();
  for(const src of [null,...scripts]){
    let code=text;if(src){try{const r=await get(src.href,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(45000)});code=await r.text();}catch{continue;}}
    for(const m of code.matchAll(/["'`]((?:https?:\/\/[\w.-]+)?\/?[\w.\/{}$-]*(?:api|\.json|export|feed|results|data)[\w.\/?=&{}$-]*)["'`]/gi)){
      const v=m[1];if(v.length<6||v.length>160||/\.(css|png|svg|woff2?|jpg|gif|ico)$/i.test(v))continue;found.add(v);if(found.size>=16)break;}
  }
  if(found.size)out.push(`    data addresses in its scripts: ${[...found].join(' · ')}`);
  return out;
}

// A reply that is a bot check ("Just a moment…", a captcha) rather than the page: the site turns scripts away. It is said
// as such, and the way around it is a page saved from a browser, never a disguise.
export const botCheck=(status,url,head)=>/perfdrive\.com|captcha|__cf_chl/i.test(url||'')||(status===403||status===429||status===503||status===202)&&/just a moment|attention required|captcha|cf-chl|radware|challenge-platform/i.test(head||'');

// A file on this computer, or an address: its bytes, or why they couldn't be had.
async function fetchRaw(u){
  if(!/^https?:/.test(u))return new Uint8Array(await fs.readFile(u.replace(/^~(?=\/)/,os.homedir())));
  let res;
  try{res=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (compatible; PublicLedger/1.0; county results)'},signal:AbortSignal.timeout(180000)});}
  catch(e){throw new Error(`couldn't connect (${e.cause?.code||e.cause?.message||e.message})`);}
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(botCheck(res.status,res.url,new TextDecoder().decode(bytes.subarray(0,4000))))throw new Error(`the site answered with a bot check (HTTP ${res.status}), not the results`);
  if(!res.ok)throw new Error(`HTTP ${res.status}${res.redirected?` (after a redirect to ${res.url})`:''}`);
  return bytes;
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
  if(args.includes('--probe')){
    // The states with no county results saved yet: their known addresses, and their source's own when they have one.
    const saved=new Set(Object.values(out.races).map(r=>r.state)),own=Object.fromEntries(Object.values(SOURCES).map(x=>[x.state,[...x.urls,...(x.pages||[])]]));
    const states=[...new Set([...Object.keys(PROBE),...Object.keys(own)])].sort().filter(st=>!saved.has(st)&&(!only||only.has(st)||only.has('S-'+st)))
      .map(st=>[st,[...new Set([...(own[st]||[]),...(PROBE[st]||[])])]]);
    const lines=[`County results probe, ${new Date().toISOString()}: what each state's results site serves, for writing its reader.`];
    console.log(`Looking at the results sites of ${states.length} states; this takes a few minutes.`);
    for(const [st,urls] of states){lines.push('',`${st}`);console.log(`${st}…`);for(const u of urls)lines.push(...(await probeOne(u)).map(l=>'  '+l));
      for(const [i,u] of (SAMPLES[st]||[]).entries()){
        const file=`data/county-samples/${st}-${i+1}.${/\.json(\?|$)/.test(u)?'json':'html'}`;
        try{const r=await fetch(u,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(45000)}),t=await r.text();
          await fs.mkdir(new URL('data/county-samples/',root),{recursive:true});await fs.writeFile(new URL(file,root),sampleOf(t));lines.push(`  saved ${u} (HTTP ${r.status}) as ${file}`);}
        catch(e){lines.push(`  couldn't save ${u} (${e.cause?.code||e.message})`);}
      }}
    await fs.writeFile(new URL('data/county-probe.txt',root),lines.join('\n')+'\n');
    console.log(`\nSaved data/county-probe.txt (${lines.length} lines) and the sample pages in data/county-samples/. Commit and push them so the readers can be written from them.`);
    process.exit(0);
  }
  // One pass over the races: each one read again replaces what was saved; one that can't be read keeps its last read.
  const failed=new Set();let passes=0;
  const pass=async()=>{
    let read=0,moved=0;passes++;
    for(const id of ids){
      // While watching, a race that couldn't be read is tried again every fourth pass, not every time.
      if(watch&&failed.has(id)&&passes%4!==1)continue;
      console.log(`Reading ${id}…`);
      const r=await countyRace(research,id,{get:fetchRaw,file:files[id]||null,maps});
      for(const l of r.lines)console.log(l);
      if(!r.race){failed.add(id);continue;}failed.delete(id);
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
