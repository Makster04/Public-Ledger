// County maps on the Races page: the county outlines (public/maps/<ST>.json, scripts/build-maps.mjs), the readers for
// each state's results file (scripts/county-results.mjs: North Carolina's precinct file, Enhanced Voting's export for
// Georgia, a county table for Michigan, each told apart by what the file holds), and the saved county results
// (public/county-results.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {readNcsbe,readEnhanced,readTable,readAny,pageLinks,readHtmlTables,reportingIn,enhancedExport,probeOne,PROBE,byCounty,countyKey,lastName,countyRace,raceCandidates,SOURCES} from '../scripts/county-results.mjs';
const json=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const D=json('../public/research.json'),C=json('../public/county-results.json');
const map=st=>json(`../public/maps/${st}.json`);
// A ZIP file holding one file.
const zipOf=(file,text)=>{
  const data=zlib.deflateRawSync(Buffer.from(text)),name=Buffer.from(file),size=Buffer.byteLength(text);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(8,8);local.writeUInt32LE(data.length,18);local.writeUInt32LE(size,22);local.writeUInt16LE(name.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(8,10);central.writeUInt32LE(data.length,20);central.writeUInt32LE(size,24);central.writeUInt16LE(name.length,28);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(46+name.length,12);end.writeUInt32LE(30+name.length+data.length,16);
  return new Uint8Array(Buffer.concat([local,name,data,central,name,end]));
};
const MI_TSV=['ElectionDate\tOfficeCode(Text)\tDistrictCode(Text)\tStatusCode\tCountyCode\tCountyName\tOfficeDescription\tPartyOrder\tPartyName\tPartyDescription\tCandidateID\tCandidateLastName\tCandidateFirstName\tCandidateMiddleName\tCandidateFormerName\tCandidateVotes',
  '11/3/2026\t5\t00000\t0\t74\tST. CLAIR\tUnited States Senator 6 Year Term (1) Position\t1\tDEM\tDemocratic\t1\tEl-Sayed\tAbdul\t\t\t30000',
  '11/3/2026\t5\t00000\t0\t74\tST. CLAIR\tUnited States Senator 6 Year Term (1) Position\t2\tREP\tRepublican\t2\tRogers\tMike\t\t\t52000',
  '11/3/2026\t5\t00000\t0\t82\tWAYNE\tUnited States Senator 6 Year Term (1) Position\t3\tLIB\tLibertarian\t3\tSmith\tPat\t\t\t900',
  '11/3/2026\t6\t00000\t0\t82\tWAYNE\tState Senator 1st District\t1\tDEM\tDemocratic\t4\tDoe\tJane\t\t\t1'].join('\n');

test('every state with a Senate race on the page has county outlines (Alaska reports by district instead)',()=>{
  const states=new Set([...D.races,...D.liteRaces].filter(r=>r.chamber==='S'&&r.state!=='AK').map(r=>r.state));
  for(const st of states){const m=map(st);assert.equal(m.state,st);assert.ok(m.width===400&&m.height>0,st);
    assert.ok(m.counties.length>0&&m.counties.every(c=>c.fips.startsWith(m.fips)&&/^M/.test(c.d)&&c.name),st);assert.match(m.outline,/^M/);}
  assert.deepEqual(['NC','GA','MI'].map(st=>map(st).counties.length),[100,159,83]);
  for(const st of ['NC','GA','MI']){const names=map(st).counties.map(c=>countyKey(c.name));assert.equal(new Set(names).size,names.length,`${st}: county names are unique once simplified`);}
});

test('names: counties match whatever way a state writes them, candidates by last name',()=>{
  assert.equal(countyKey('St. Clair County'),countyKey('ST CLAIR'));assert.equal(countyKey('McDowell'),countyKey('MCDOWELL'));
  assert.equal(countyKey('DeKalb County'),'dekalb');assert.equal(countyKey('Saint Joseph'),countyKey('St. Joseph'));
  assert.equal(lastName('Jon Ossoff (I) (Dem)'),'ossoff');assert.equal(lastName('Abdul El-Sayed'),'elsayed');assert.equal(lastName('Robert P. Bresnahan, Jr.'),'bresnahan');
});

test("North Carolina's precinct file is read by its own column names, and only the Senate race is kept",()=>{
  const head='County\tElection Date\tPrecinct\tContest Group ID\tContest Type\tContest Name\tChoice\tChoice Party\tVote For\tElection Day\tEarly Voting\tAbsentee by Mail\tProvisional\tTotal Votes\tReal Precinct';
  const text=[head,'WAKE\t11/03/2026\t01-01\t1383\tS\tUS SENATE\tRoy Cooper\tDEM\t1\t500\t700\t20\t1\t1221\tY',
    'WAKE\t11/03/2026\t01-02\t1383\tS\tUS SENATE\tRoy Cooper\tDEM\t1\t1\t1\t1\t0\t3\tY','MCDOWELL\t11/03/2026\tP1\t1383\tS\tUS SENATE\tMichael Whatley\tREP\t1\t9\t9\t0\t0\t18\tY',
    'WAKE\t11/03/2026\t01-01\t1322\tS\tNC STATE SENATE DISTRICT 14\tSomeone\tDEM\t1\t1\t1\t1\t1\t4\tY'].join('\n');
  const rows=readNcsbe(text,SOURCES['S-NC'].contest);assert.equal(rows.length,3);
  assert.deepEqual(rows.reporting,{n:3,of:3,unit:'precincts'},'precincts reporting: the real precincts with votes in the race');
  const later=readNcsbe(text+'\nWAKE\t11/03/2026\t09-09\t1383\tS\tUS SENATE\tRoy Cooper\tDEM\t1\t0\t0\t0\t0\t0\tY\nWAKE\t11/03/2026\tABSENTEE\t1383\tS\tUS SENATE\tRoy Cooper\tDEM\t1\t0\t0\t9\t0\t9\tN',SOURCES['S-NC'].contest);
  assert.deepEqual(later.reporting,{n:3,of:4,unit:'precincts'},'a precinct with no votes yet has not reported; the absentee tally is not a precinct');
  const b=byCounty(rows,raceCandidates(D,'S-NC'),map('NC'));
  assert.deepEqual(b.counties['37183'],{cooper:1224},'Wake: both precincts added up');assert.deepEqual(b.counties['37111'],{whatley:18},'McDowell');
  assert.equal(b.total,1242);assert.deepEqual(b.unmatched,[]);
  assert.deepEqual(byCounty([...rows,{county:'WAKE',choice:'Shannon W. Bray',party:'LIB',votes:7},{county:'WAKE',choice:'Write-In',party:'',votes:0}],raceCandidates(D,'S-NC'),map('NC')).others,
    [{name:'Shannon W. Bray',party:'LIB',votes:7}],'the other candidates by name, statewide');
  assert.throws(()=>readNcsbe('County\tChoice\n',/x/),/no "Contest Name" column/);
});

test("Georgia's results export is read by locality; a state senate race and a missing locality list are told apart",()=>{
  const opt=(name,party,v)=>({id:name,name,politicalParty:party,voteCount:v});
  const data={electionName:'2026 November General',results:{ballotItems:[{id:'1',name:'US Senate',ballotOptions:[opt('Jon Ossoff (I)','Dem',3000),opt('Mike Collins','Rep',3300)]}]},
    localResults:[{name:'Appling',ballotItems:[{id:'1',name:'US Senate',ballotOptions:[opt('Jon Ossoff (I)','Dem',1000),opt('Mike Collins','Rep',2000),opt('Write-in','',3)]},{id:'9',name:'State Senate - District 1',ballotOptions:[opt('Jon Ossoff','Dem',99)]}]},
      {name:'DeKalb County',ballotItems:[{id:'1',name:'US Senate',ballotOptions:[opt('Jon Ossoff (I)','Dem',2000),opt('Mike Collins','Rep',1300)]}]}]};
  const rows=readEnhanced(data,SOURCES['S-GA'].contest);assert.equal(rows.length,5,'the state senate race is left out');
  assert.equal(rows.reporting,undefined,'no precinct counts in this export');
  const withCounts=structuredClone(data);Object.assign(withCounts.results.ballotItems[0],{precinctsReporting:2600,precinctsParticipating:2654});
  assert.deepEqual(readEnhanced(withCounts,SOURCES['S-GA'].contest).reporting,{n:2600,of:2654,unit:'precincts'},'from the statewide ballot item');
  const byLoc=structuredClone(data);delete byLoc.results;byLoc.localResults.forEach((l,i)=>Object.assign(l.ballotItems[0],{precinctsReporting:10+i,precinctsParticipating:12}));
  assert.deepEqual(readEnhanced(byLoc,SOURCES['S-GA'].contest).reporting,{n:21,of:24,unit:'precincts'},'added up over the localities');
  const b=byCounty(rows,raceCandidates(D,'S-GA'),map('GA'));
  assert.deepEqual(b.counties['13001'],{ossoff:1000,mcollins:2000,other:3});assert.deepEqual(b.counties['13089'],{ossoff:2000,mcollins:1300},'DeKalb County, by name');
  assert.throws(()=>readEnhanced({results:{ballotItems:[]}},/senate/i),/no localResults \(top-level keys: results\)/);
  assert.throws(()=>readEnhanced({localResults:[{name:'Appling',ballotItems:[{name:'Governor'}]}]},SOURCES['S-GA'].contest),/no ballot item matches.*Governor/);
});

test("Michigan's county table: a header row names the columns, in tab- or comma-separated files",()=>{
  const rows=readTable(MI_TSV,SOURCES['S-MI'].contest);assert.equal(rows.length,3,'a state senator race is left out');
  const b=byCounty(rows,raceCandidates(D,'S-MI'),map('MI'));
  assert.deepEqual(b.counties['26147'],{elsayed:30000,rogers:52000},'St. Clair');assert.deepEqual(b.counties['26163'],{other:900},'Wayne');
  const csv='County,Contest,Candidate,Party,Votes\n"Kent","U.S. Senate","Abdul El-Sayed","DEM","1,234"\n';
  assert.deepEqual(readTable(csv,SOURCES['S-MI'].contest),[{county:'Kent',choice:'Abdul El-Sayed',party:'DEM',votes:1234}]);
  assert.throws(()=>readTable('<!DOCTYPE html><html>',/x/),/a web page, not a results file/);
  assert.throws(()=>readTable('A,B\n1,2',/x/),/can't find the county, contest, candidate and votes columns \(the header is: A \| B\)/);
});

test('a file is read by what it holds, whatever its name says',async()=>{
  const mi=SOURCES['S-MI'],ga=SOURCES['S-GA'];
  assert.equal((await readAny(MI_TSV,mi)).rows.length,3,"Michigan's \".xls\" is tab-separated text");
  assert.equal((await readAny(zipOf('2026GEN_MI_CENR_BY_COUNTY.txt',MI_TSV),mi)).rows.length,3,'a ZIP: the table inside');
  const ev=JSON.stringify({localResults:[{name:'Appling',ballotItems:[{name:'US Senate',ballotOptions:[{name:'Jon Ossoff',voteCount:5}]}]}]});
  assert.deepEqual((await readAny(ev,ga)).rows,[{county:'Appling',choice:'Jon Ossoff',party:'',votes:5}],'JSON: an Enhanced Voting export');
  assert.deepEqual((await readAny(zipOf('export.json',ev),ga)).rows.length,1,'a ZIP holding the export');
  assert.match((await readAny('\n<!DOCTYPE html><html><a href="x.txt">',mi)).page,/x\.txt/,'a web page is handed back for its links');
  await assert.rejects(readAny(new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]),mi),/an Excel workbook.*save it as CSV/);
  await assert.rejects(readAny(zipOf('xl/workbook.xml','<workbook/>'),mi),/an Excel workbook/,'an .xlsx is a ZIP too');
  await assert.rejects(readAny(zipOf('notes.pdf','x'),mi),/a ZIP file with no \.txt, \.tsv, \.csv or \.json file/);
  await assert.rejects(readAny('<?xml version="1.0"?><ElectionResult/>',mi),/an XML file/);
  await assert.rejects(readAny('{"localResults":',ga),/a JSON file that doesn't read/);
  await assert.rejects(readAny('{"results":{}}',ga),/no localResults/);
});

// Michigan's results pages, as the script would find them: the election's page with the statewide races, each linking
// to its county results, and the Senate race's county results.
const MI_INDEX=`<html><head><title>2026 Michigan Election Results</title></head><body><nav><a href="/votehistory/">Home</a></nav>
  <h3>Governor</h3><table><tr><th>Candidate</th><th>Party</th><th>Votes</th></tr><tr><td>Jocelyn Benson</td><td>DEM</td><td>2,400,000</td></tr></table>
  <a href="/votehistory/CountyResults?officeCode=2&amp;electionDate=11-3-2026">County Results</a> <a href="/votehistory/Precincts?officeCode=2">Precinct by Precinct Results</a>
  <h3>United States Senator</h3><table><tr><th>Candidate</th><th>Party</th><th>Votes</th></tr><tr><td>Abdul El-Sayed</td><td>DEM</td><td>2,500,000</td></tr><tr><td>Mike Rogers</td><td>REP</td><td>2,100,000</td></tr></table>
  <a href="/votehistory/CountyResults?officeCode=5&amp;electionDate=11-3-2026">County Results</a> <a href="/votehistory/Precincts?officeCode=5">Precinct by Precinct Results</a>
  <a href="javascript:void(0)">County results</a> <a href="https://example.com/county.csv">elsewhere</a></body></html>`;
const MI_COUNTY=`<html><h2>United States Senator &ndash; County Results</h2><table><thead><tr><th>County</th><th>Abdul El-Sayed (DEM)</th><th>Mike Rogers (REP)</th><th>Pat Smith (LIB)</th><th>Total Votes</th><th>Percent</th></tr></thead>
  <tbody><tr><td>ST. CLAIR</td><td>30,000</td><td>52,000</td><td>1,000</td><td>83,000</td><td>1.6%</td></tr><tr><td>Wayne</td><td>500,000</td><td>200,000</td><td>900</td><td>700,900</td><td>14%</td></tr>
  <tr><td>Total</td><td>530,000</td><td>252,000</td><td>1,900</td><td>783,900</td><td>100%</td></tr></tbody></table></html>`;

test("a results page: its links to county results after the Senate race first, then data files, all on its own site",()=>{
  const base='https://mvic.sos.state.mi.us/votehistory/Index?type=C&electionDate=11-3-2026';
  assert.deepEqual(pageLinks(MI_INDEX,base),['https://mvic.sos.state.mi.us/votehistory/CountyResults?officeCode=5&electionDate=11-3-2026',
    'https://mvic.sos.state.mi.us/votehistory/CountyResults?officeCode=2&electionDate=11-3-2026'],"the Senate race's county results first; precinct pages and other sites left out");
  const html=`<a href="DATA/2026_PRECINCTS.zip">Precincts</a> <a href='DATA/2026GEN_MI_CENR_BY_COUNTY.xls'>Counties</a> <a href="DATA/file.csv?x=1&amp;y=2">query</a> <a href="DATA/2026GEN_MI_CENR_BY_COUNTY.xls#top">again</a>`;
  assert.deepEqual(pageLinks(html,'https://mielections.us/election/results/2026GEN_CENR.html'),['https://mielections.us/election/results/DATA/2026GEN_MI_CENR_BY_COUNTY.xls',
    'https://mielections.us/election/results/DATA/2026_PRECINCTS.zip','https://mielections.us/election/results/DATA/file.csv?x=1&y=2']);
  assert.deepEqual(pageLinks(html,'~/Downloads/page.html'),[],'a saved page has no site to follow');
  assert.equal(enhancedExport('https://results.sos.ga.gov/results/public/Georgia/elections/11032026GeneralAndSpecialElection?tab=1'),'https://results.sos.ga.gov/cdn/results/Georgia/export-11032026GeneralAndSpecialElection.json');
  assert.equal(enhancedExport(SOURCES['S-GA'].page),SOURCES['S-GA'].urls[0],"Georgia's page and its export agree");
  assert.equal(enhancedExport('~/Downloads/ga.json'),'~/Downloads/ga.json');
});

test('how much has reported, as a page says it',()=>{
  assert.deepEqual(reportingIn('Updated 11/4/2026 2:19 PM · 82 of 83 counties reporting'),{n:82,of:83,unit:'counties'});
  assert.deepEqual(reportingIn('Precincts reporting: 2,650 of 2,660'),{n:2650,of:2660,unit:'precincts'});
  assert.deepEqual(reportingIn('2,650/2,660 precincts reported'),{n:2650,of:2660,unit:'precincts'});
  assert.equal(reportingIn('Total votes 2,650 of 2,660'),null);assert.equal(reportingIn('90 of 83 counties reporting'),null,'more than all of them');
});

test("a page's tables of votes: by county and candidate, in any of three layouts, without totals or percentages",()=>{
  assert.deepEqual(readHtmlTables(MI_COUNTY).rows,[{county:'ST. CLAIR',choice:'Abdul El-Sayed (DEM)',party:'',votes:30000},{county:'ST. CLAIR',choice:'Mike Rogers (REP)',party:'',votes:52000},
    {county:'ST. CLAIR',choice:'Pat Smith (LIB)',party:'',votes:1000},{county:'Wayne',choice:'Abdul El-Sayed (DEM)',party:'',votes:500000},{county:'Wayne',choice:'Mike Rogers (REP)',party:'',votes:200000},{county:'Wayne',choice:'Pat Smith (LIB)',party:'',votes:900}]);
  const long='<table><tr><th>County</th><th>Candidate</th><th>Party</th><th>Votes</th></tr><tr><td>Kent</td><td>Mike Rogers</td><td>REP</td><td>1,234</td></tr></table>';
  assert.deepEqual(readHtmlTables(long).rows,[{county:'Kent',choice:'Mike Rogers',party:'REP',votes:1234}]);
  const each='<h4>Alcona County</h4><table><tr><th>Candidate</th><th>Votes</th></tr><tr><td>Mike Rogers</td><td>4,000</td></tr><tr><td>Total</td><td>4,000</td></tr></table><h4>St. Joseph County</h4><table><tr><th>Candidate</th><th>Votes</th></tr><tr><td>Mike Rogers</td><td>9</td></tr></table>';
  assert.deepEqual(readHtmlTables(each,map('MI').counties.map(c=>c.name)).rows.map(r=>[r.county,r.votes]),[['Alcona',4000],['St. Joseph',9]],'a table per county, named above it');
  assert.deepEqual(readHtmlTables(each).rows,[],'without the county names, nothing is guessed');
  const two='<h3>Governor</h3><table><tr><th>County</th><th>Benson</th></tr><tr><td>Kent</td><td>5</td></tr></table><h3>U.S. Senator</h3><table><tr><th>County</th><th>Rogers</th></tr><tr><td>Kent</td><td>7</td></tr></table>';
  assert.deepEqual(readHtmlTables(two).rows,[{county:'Kent',choice:'Rogers',party:'',votes:7}],'only the tables after the Senate race is named');
  assert.deepEqual(readHtmlTables(MI_INDEX).tables.slice(0,1),['Candidate | Party | Votes']);
});

test('a race is read from the first address that works, then its page\'s links, and says what to do by hand when none does',async()=>{
  const maps=async st=>map(st),ok={localResults:[{name:'Appling',ballotItems:[{name:'US Senate',ballotOptions:[{name:'Jon Ossoff',voteCount:5},{name:'Mike Collins',voteCount:7}]}]}]};
  const got=await countyRace(D,'S-GA',{maps,get:async u=>{if(u.includes('export-11032026GeneralAndSpecialElection'))return JSON.stringify(ok);throw new Error('HTTP 404');}});
  assert.equal(got.race.counties['13001'].mcollins,7);assert.match(got.lines[0],/^CHECK S-GA: 1 of 159 counties/,'a partial map is a CHECK');
  assert.match(got.lines[0],/\(from https:\/\/results\.sos\.ga\.gov\/cdn\/results\/Georgia\/export-11032026GeneralAndSpecialElection\.json\)$/);
  // Michigan: the election's page is read (its statewide tables have no counties), then the Senate race's county results.
  const asked=[];
  const mi=await countyRace(D,'S-MI',{maps,get:async u=>{asked.push(u);if(u.includes('Index?'))return MI_INDEX;if(u.includes('officeCode=5'))return MI_COUNTY;throw new Error('HTTP 404');}});
  assert.deepEqual(asked,[SOURCES['S-MI'].pages[0],'https://mvic.sos.state.mi.us/votehistory/CountyResults?officeCode=5&electionDate=11-3-2026']);
  assert.deepEqual(mi.race.counties['26147'],{elsayed:30000,rogers:52000,other:1000});assert.deepEqual(mi.race.counties['26163'],{elsayed:500000,rogers:200000,other:900});
  assert.equal(mi.race.total,783900,'the Total row is left out');assert.equal(mi.race.source.u,asked[1]);
  // Votes by county for other candidates (the Governor's race) don't count, and the next link is tried.
  const gov=MI_COUNTY.replace('United States Senator','Governor').replace('Abdul El-Sayed','Jocelyn Benson').replace('Mike Rogers','John James');
  const two=await countyRace(D,'S-MI',{maps,get:async u=>u.includes('Index?')?MI_INDEX:u.includes('officeCode=5')?gov:MI_COUNTY});
  assert.match(two.lines[0],/^CHECK S-MI: 2 of 83 counties/);assert.match(two.race.source.u,/officeCode=2/);
  const none=await countyRace(D,'S-MI',{maps,get:async u=>u.includes('Index?')?MI_INDEX.replace(/<a [^>]*CountyResults[^>]*>County Results<\/a>/g,''):gov});
  assert.equal(none.race,undefined);
  assert.match(none.lines.join('\n'),/^CHECK S-MI: couldn't read the county results\.\n.*Index\?type=C&electionDate=11-3-2026: a web page, with nothing to follow on its site\n\s+link: Precinct by Precinct Results → https:\/\/mvic\.sos\.state\.mi\.us\/votehistory\/Precincts\?officeCode=2\n[\s\S]*\s+table: Candidate \| Party \| Votes\n[\s\S]*open the county results for United States Senator, copy that page's address \(or a download link on it\), then: npm run counties:update -- --file "S-MI=<that address>"$/);
  const byHand=await countyRace(D,'S-MI',{maps,file:'https://mvic.sos.state.mi.us/votehistory/CountyResults?officeCode=2',get:async()=>gov});
  assert.match(byHand.lines[1],/officeCode=2: a web page, its votes by county are for other candidates \(Jocelyn Benson \(DEM\), John James \(REP\), Pat Smith \(LIB\)\); with nothing to follow/);
  // An address given by hand: an Enhanced Voting results page stands for its media export.
  const seen=[];await countyRace(D,'S-GA',{maps,file:SOURCES['S-GA'].page,get:async u=>{seen.push(u);return JSON.stringify(ok);}});
  assert.deepEqual(seen,[SOURCES['S-GA'].urls[0]]);
  for(const [id,s] of Object.entries(SOURCES))assert.ok(s.help||s.page,`${id}: what to do by hand`);
});

test('the saved county results fit their race and map, and add up',()=>{
  assert.match(C.about,/Unofficial/);
  for(const [id,r] of Object.entries(C.races)){
    const race=D.races.find(x=>x.id===id)||D.liteRaces.find(x=>x.id===id);assert.ok(race,id);assert.equal(r.state,race.state,id);
    const m=map(r.state),fips=new Set(m.counties.map(c=>c.fips)),keys=new Set([...(race.keys||race.nominees.map(n=>n.fecCand||n.id)),'other']);
    assert.deepEqual(r.candidates.map(c=>c.key).filter(k=>!keys.has(k)),[],id);
    let sum=0;for(const [f,v] of Object.entries(r.counties)){assert.ok(fips.has(f),`${id}: ${f} is on the map`);for(const [k,n] of Object.entries(v)){assert.ok(keys.has(k),`${id}: ${k}`);assert.ok(Number.isInteger(n)&&n>=0);sum+=n;}}
    assert.equal(sum,r.total,id);assert.match(r.source.u,/^https:\/\//);assert.match(r.fetched,/^\d{4}-\d{2}-\d{2}T/);
    if(r.reporting){const {n,of,unit}=r.reporting;assert.ok(Number.isInteger(n)&&Number.isInteger(of)&&n>=0&&n<=of&&of>0,id);assert.ok(['precincts','counties'].includes(unit),id);}
  }
  const nc=C.races['S-NC'];assert.equal(Object.keys(nc.counties).length,100);assert.equal(nc.total,4203181,"the state's own total");
  assert.equal(nc.reporting.unit,'precincts');assert.ok(nc.reporting.of>2000,'North Carolina has over 2,000 precincts');
  const share=k=>Object.values(nc.counties).reduce((a,v)=>a+(v[k]||0),0)/nc.total*100;
  const tally=D.races.find(r=>r.id==='S-NC').result.tally;assert.ok(Math.abs(share('cooper')-tally.shares.cooper)<0.01&&Math.abs(share('whatley')-tally.shares.whatley)<0.01,'the card and the map agree');
});

test('the races page draws the maps and the methodology explains them',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/async function fillMaps\(root\)/);assert.match(app,/<div class="cm-box"><svg viewBox="0 0 \$\{m\.width\} \$\{m\.height\}" preserveAspectRatio="xMidYMid meet"/,'every map in the same box');
  assert.match(app,/\$\{reportingBar\(res,m\)\}/);
  assert.match(app,/COUNTY\.poll\?\?=setInterval\(/,'the page looks for a new read while the Races page is open');assert.match(app,/box\.innerHTML=resultCard\(race,ct\)/,"the card takes the state's count");
  const script=fs.readFileSync(new URL('../scripts/county-results.mjs',import.meta.url),'utf8');assert.match(script,/--watch/);assert.match(script,/Math\.max\(2,Number\(args\[wi\+1\]\)\|\|15\)/,'every 15 minutes, never under 2');assert.match(app,/role="progressbar"/);
  assert.match(fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),/\.cm-box\{width:100%;aspect-ratio:4\/3\}/);assert.match(app,/fillMaps\(\$\('#rlist'\)\)/);assert.match(app,/id="method-county-maps"/);
});

test("the probe says what a state's results site serves, for writing its reader",async()=>{
  const have=new Set(Object.values(SOURCES).map(s=>s.state)),senate=new Set([...D.races,...D.liteRaces].filter(r=>r.chamber==='S'&&r.state!=='AK').map(r=>r.state));
  for(const st of senate)assert.ok(have.has(st)||PROBE[st]?.length,`${st}: a reader, or somewhere to look`);
  for(const urls of Object.values(PROBE))for(const u of urls)assert.match(u,/^https:\/\//);
  const page=`<html><head><title>Election Night Results</title><script src="/static/app.js"></script></head><body><a href="/results/2026-11-03/county.csv">County results (CSV)</a> <a href="/about">About us</a>
    <table><tr><th>County</th><th>Risch</th></tr><tr><td>Ada</td><td>5</td></tr></table></body></html>`;
  const reply=(body,type)=>({status:200,redirected:false,url:'',headers:{get:()=>type},arrayBuffer:async()=>new TextEncoder().encode(body).buffer,text:async()=>body});
  const get=async u=>u.endsWith('app.js')?reply('fetch(`/api/elections/${id}/summary.json`);const x="/cdn/results/export.json"','text/javascript'):u.endsWith('.json')?reply('{"localResults":[{"name":"Ada","ballotItems":[]}],"results":{}}','application/json'):reply(page,'text/html');
  const lines=await probeOne('https://example.gov/results/',{get});
  assert.match(lines[0],/^https:\/\/example\.gov\/results\/ → HTTP 200, text\/html, 0 KB$/);
  assert.ok(lines.includes('    link: County results (CSV) → https://example.gov/results/2026-11-03/county.csv'));assert.ok(!lines.some(l=>/About us/.test(l)));
  assert.ok(lines.includes('    table: County | Risch'));assert.match(lines.at(-1),/^    data addresses in its scripts: .*\/api\/elections\/\$\{id\}\/summary\.json · \/cdn\/results\/export\.json$/,'from the page and from its own script');
  const json=await probeOne('https://example.gov/x.json',{get});assert.equal(json[1],'    JSON: keys: localResults, results');assert.equal(json[2],"    localResults: a list of 1; first item's keys: name, ballotItems");
  assert.match((await probeOne('https://example.gov/',{get:async()=>{throw Object.assign(new Error('fetch failed'),{cause:{code:'ENOTFOUND'}});}}))[0],/couldn't connect \(ENOTFOUND\)/);
});
