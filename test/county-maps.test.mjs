// County maps on the Races page: the county outlines (public/maps/<ST>.json, scripts/build-maps.mjs), the readers for
// each state's results file (scripts/county-results.mjs: North Carolina's precinct file, Enhanced Voting's export for
// Georgia, a county table for Michigan, each told apart by what the file holds), and the saved county results
// (public/county-results.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {readNcsbe,readEnhanced,readTable,readAny,pageLinks,readHtmlTables,reportingIn,enhancedExport,probeOne,PROBE,readClarityXml,clarityElection,clarityOf,mapKey,botCheck,sampleOf,SAMPLES,readResultBoxes,countyNameIn,readClarityCountyXml,scriptAddresses,sampleOne,postBackForm,byCounty,countyKey,lastName,countyRace,raceCandidates,SOURCES} from '../scripts/county-results.mjs';
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
  await assert.rejects(readAny(zipOf('notes.pdf','x'),mi),/a ZIP file with no \.txt, \.tsv, \.csv, \.json or \.xml file/);
  await assert.rejects(readAny('<?xml version="1.0"?><Results/>',mi),/an XML file, which no reader here handles yet/);
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
  assert.match(none.lines.join('\n'),/^CHECK S-MI: couldn't read the county results\.\n.*Index\?type=C&electionDate=11-3-2026: a web page, with nothing to follow on its site\n\s+link: Precinct by Precinct Results → https:\/\/mvic\.sos\.state\.mi\.us\/votehistory\/Precincts\?officeCode=2\n[\s\S]*\s+table: Candidate \| Party \| Votes\n[\s\S]*open the county results for United States Senator, then save the page .* --file "S-MI=~\/Downloads\/<the saved file>"$/);
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

// Clarity's detail XML, as its sites publish it: each choice's votes by county under each vote type.
const CLARITY=`<?xml version="1.0" encoding="utf-8"?><ElectionResult><Timestamp>11/4/2026 3:00:00 PM MST</Timestamp><ElectionName>2026 General Election</ElectionName><ElectionDate>11/3/2026</ElectionDate><Region>CO</Region>
<Contest key="1" text="Governor" voteFor="1" precinctsParticipating="10" precinctsReported="10"><Choice key="1" text="Phil Weiser" party="DEM" totalVotes="9"><VoteType name="Mail" votes="9"><County name="Adams" votes="9" /></VoteType></Choice></Contest>
<Contest key="2" text="United States Senator" voteFor="1" countiesParticipating="64" countiesReported="64" precinctsParticipating="3200" precinctsReported="3150">
<ParticipatingCounties><County name="Adams" precinctsParticipating="300" precinctsReported="300" /></ParticipatingCounties>
<Choice key="3" text="John W. Hickenlooper" party="DEM" totalVotes="130"><VoteType name="Mail Ballots" votes="120"><County name="Adams" votes="100" /><County name="Denver" votes="20" /></VoteType><VoteType name="In Person" votes="10"><County name="Adams" votes="10" /></VoteType></Choice>
<Choice key="4" text="Janak Joshi" party="REP" totalVotes="80"><VoteType name="Mail Ballots" votes="80"><County name="Adams" votes="80" /><County name="Denver" votes="0" /></VoteType></Choice>
<Choice key="5" text="Caryn Ann Harlos" party="LBR" totalVotes="5"><VoteType name="Mail Ballots" votes="5"><County name="Denver" votes="5" /></VoteType></Choice></Contest>
<Contest key="3" text="State Senate District 21" voteFor="1"><Choice key="6" text="Someone" party="DEM"><VoteType name="Mail" votes="1"><County name="Adams" votes="1" /></VoteType></Choice></Contest></ElectionResult>`;

test("Clarity's detail XML: votes added up over vote types, by county, with precincts reporting",async()=>{
  const rows=readClarityXml(CLARITY,SOURCES['S-CO'].contest);
  assert.deepEqual(rows.filter(r=>r.county==='Adams').map(r=>[r.choice,r.votes]),[['John W. Hickenlooper',110],['Janak Joshi',80]],'mail and in-person added up; the Governor and the state senate left out');
  assert.deepEqual(rows.reporting,{n:3150,of:3200,unit:'precincts'});
  assert.equal((await readAny(zipOf('detail.xml',CLARITY),SOURCES['S-CO'])).rows.length,5,'the detail XML inside its ZIP');
  assert.throws(()=>readClarityXml(CLARITY.replace(/United States Senator/,'Treasurer'),SOURCES['S-CO'].contest),/no Senate contest .*contests: Governor; Treasurer; State Senate District 21/);
  assert.deepEqual(clarityOf('https://www.enr-scvotes.org/SC/127227/'),{base:'https://www.enr-scvotes.org',st:'SC',eid:'127227'});
  assert.deepEqual(clarityOf('https://results.enr.clarityelections.com//CO/125000/web.345435/#/summary'),{base:'https://results.enr.clarityelections.com',st:'CO',eid:'125000'});
  assert.equal(clarityOf('https://results.enr.clarityelections.com/CO/'),null);
  // The list of elections, laid out one way or another.
  assert.equal(clarityElection([{EID:'124001',ElectionName:'2026 Primary Election',ElectionDate:'6/30/2026'},{EID:'125600',ElectionName:'2026 General Election',ElectionDate:'11/3/2026'}]),'125600');
  assert.equal(clarityElection({elections:{items:[{id:125700,name:'November 3, 2026 General Election'}]}}),'125700');
  assert.throws(()=>clarityElection([{EID:'1240',ElectionName:'2026 Primary',ElectionDate:'6/30/2026'},{EID:'1300',ElectionName:'2026 Runoff'}]),/no November 3, 2026 election in the list \(newest: 1300 2026 Runoff; 1240 2026 Primary 6\/30\/2026\)/,'the newest named first');
  assert.equal(clarityElection({'124001':{name:'2026 Primary',date:'8/4/2026'},'127408':{name:'2026 General Election',date:'11/3/2026'}}),'127408','a list keyed by election number');
  assert.equal(clarityElection({'127409':'11/3/2026 General Election','124002':'8/4/2026 Primary'}),'127409');
});

test('a Clarity state: its November 3 election found in the list, then its current version and detail XML',async()=>{
  const maps=async st=>map(st),asked=[];
  const get=async u=>{asked.push(u);if(u.endsWith('/CO/elections.json'))return JSON.stringify([{EID:'125600',ElectionName:'2026 General Election',ElectionDate:'11/3/2026'}]);
    if(u.endsWith('/125600/current_ver.txt'))return '356001\n';if(u.endsWith('/125600/356001/reports/detailxml.zip'))return zipOf('detail.xml',CLARITY);throw new Error('HTTP 404');};
  const co=await countyRace(D,'S-CO',{maps,get});
  assert.deepEqual(asked,['https://results.enr.clarityelections.com/CO/elections.json','https://results.enr.clarityelections.com/CO/125600/current_ver.txt','https://results.enr.clarityelections.com/CO/125600/356001/reports/detailxml.zip']);
  const fips=n=>map('CO').counties.find(c=>c.name===n).fips;
  assert.deepEqual(Object.values(co.race.counties[fips('Adams')]).reduce((a,b)=>a+b,0),190);assert.equal(co.race.counties[fips('Denver')].other,5);
  assert.equal(co.race.reporting.of,3200);assert.equal(co.race.source.u,asked[2]);
  // South Carolina: its results page links to the election on its own Clarity site.
  const sc=[];const page='<html><a href="https://www.enr-scvotes.org/SC/127300/">Statewide General Election results</a> <a href="https://www.enr-scvotes.org/SC/127179/">U.S. Senate Special Republican Runoff</a>';
  await countyRace(D,'S-SC',{maps,get:async u=>{sc.push(u);if(u.endsWith('elections.json'))throw new Error('HTTP 404');if(u.includes('scvotes.gov/2026'))return page;if(u.endsWith('current_ver.txt'))return '9';throw new Error('HTTP 404');}});
  assert.ok(sc.includes('https://www.enr-scvotes.org/SC/127300/current_ver.txt')&&sc.includes('https://www.enr-scvotes.org/SC/127300/9/reports/detailxml.zip'),'the linked election is read');
});

test("Virginia: independent cities are told apart from counties of the same name",()=>{
  const va=map('VA'),cands=raceCandidates(D,'S-VA'),[a,b]=cands.map(c=>c.name);
  const rows=[['Richmond City',a,10],['Richmond County',b,7],['Fairfax County',a,5],['Fairfax City',b,3],['Norfolk',a,2]].map(([county,choice,votes])=>({county,choice,party:'',votes}));
  const r=byCounty(rows,cands,va),k=cands.map(c=>c.key);
  assert.deepEqual([r.counties['51760'],r.counties['51159'],r.counties['51059'],r.counties['51600'],r.counties['51710']],[{[k[0]]:10},{[k[1]]:7},{[k[0]]:5},{[k[1]]:3},{[k[0]]:2}]);
  assert.deepEqual(r.unmatched,[]);
  const keys=va.counties.map(mapKey);assert.equal(new Set(keys).size,keys.length,'every Virginia locality has its own name');
});

test("Virginia's race is named \"Member, United States Senate\"; a bot check is said as such; sample pages are kept lean",()=>{
  const va=SOURCES['S-VA'].contest;assert.ok(va.test('Member, United States Senate'));assert.ok(!va.test('Member, Senate of Virginia'));
  const data={localResults:[{name:'Richmond City',ballotItems:[{name:'Member, United States Senate',ballotOptions:[{name:'Mark R. Warner',politicalParty:'Democratic',voteCount:9}]},{name:'Member, Senate of Virginia (District 14)',ballotOptions:[{name:'X',voteCount:1}]}]}]};
  assert.deepEqual(readEnhanced(data,va).map(r=>r.votes),[9]);
  assert.ok(SOURCES['S-DE'].urls[0].startsWith('https://data.delaware.gov/resource/')&&/\$limit=/.test(SOURCES['S-DE'].urls[0]),"Delaware's CSV, all of its rows");
  assert.deepEqual(readTable('election_name,office_name,county_name,candidate_name,party,vote_count\n2026 General Election,UNITED STATES SENATOR,KENT,Chris Coons,DEM,"1,200"\n',SOURCES['S-DE'].contest),[{county:'KENT',choice:'Chris Coons',party:'DEM',votes:1200}],"an open-data CSV's column names");
  assert.ok(botCheck(403,'https://mvic.sos.state.mi.us/votehistory/','<title>Just a moment...</title>'));assert.ok(botCheck(200,'https://validate.perfdrive.com/?ssa=1',''));
  assert.ok(!botCheck(404,'https://example.gov/x','<title>Not Found</title>'));assert.ok(!botCheck(200,'https://example.gov/','<title>Just a moment</title>'),'a page that happens to say it');
  assert.match(SOURCES['S-MI'].help,/turned this one away, so use your browser: open https:\/\/mvic\.sos\.state\.mi\.us\/.*save the page .* --file "S-MI=~\/Downloads\/<the saved file>"/);
  assert.equal(sampleOf('<html><script>var a=1</script><style>p{}</style><!-- note --><p>Votes</p>\n\n\n<td>5</td></html>'),'<html><p>Votes</p>\n<td>5</td></html>');
  for(const list of Object.values(SAMPLES))for(const x of list){assert.match(typeof x==='string'?x:x.u,/^https:\/\//);if(typeof x!=='string')assert.ok(['raw','scripts','pdf','context'].includes(x.kind));}
});

// A county page on the county-page sites (Montana, Nebraska, New Mexico, Oregon, South Dakota), as they lay it out.
const box=(race,cands,{h1=true,prec='Precincts Fully: 502 / 728'}={})=>`<div class="display-results-box-wrapper"><div class="display-results-box-a"><h1>${race}</h1></div>
  <div class="col display-results-box-c"><div class="precinct-fully">${prec}</div></div>`+cands.map(([n,p,v])=>`<div class="section group"><img src="x.png" class="photo-display" />
  <div class="col display-results-box-d wide-28"><h1>${n}</h1><h2 class="${p}">${p}</h2></div><div class="col display-results-box-e"><div class="bar-graph-wrap"><div id="bar1"></div></div></div>
  <div class="col display-results-box-f">${h1?`<h1>${v}</h1>`:`<div>${v}</div>`}</div></div><hr />`).join('');
const countyPage=(county,body)=>`<html><head><title>Montana Secretary of State</title></head><body><span id="MainContent_lblCountyName" class="county-identifier-name">${county} County Results</span>${body}</body></html>`;

test('the county-page sites: each county page read for the Senate race, its county named on the page',async()=>{
  const mt=SOURCES['S-MT'].contest,page=countyPage('Beaverhead',box('UNITED STATES SENATOR',[['KURT ALME','Republican','2,794'],['ALANI BANKHEAD','Democrat','374']])+box('STATE SENATOR DISTRICT 36',[['X','Republican','9']]));
  assert.deepEqual(readResultBoxes(page,mt),{head:'UNITED STATES SENATOR',rows:[{choice:'KURT ALME',party:'Republican',votes:2794},{choice:'ALANI BANKHEAD',party:'Democrat',votes:374}],reporting:{n:502,of:728,unit:'precincts'}});
  assert.equal(countyNameIn(page),'Beaverhead');assert.equal(countyNameIn('<span class="county-identifier-name">Baker County, Oregon</span>'),'Baker');
  assert.equal(readResultBoxes(countyPage('X',box('STATE SENATOR DISTRICT 1',[['Y','R','1']])),mt),null,'a state senate race is not it');
  const or=readResultBoxes(box('US Senator',[['Jeff Merkley','Democrat, Working Families','864,436']],{h1:false,prec:'0 out of 1318 Precincts Reported'}),SOURCES['S-OR'].contest);
  assert.deepEqual([or.rows[0].votes,or.reporting],[864436,{n:0,of:1318,unit:'precincts'}],"Oregon's votes in a <div>");
  assert.ok(SOURCES['S-NE'].contest.test('For United States Senator - 6  Year Term'));
  // Montana: the list of county pages, each read; a page that fails is noted, the rest kept.
  const [alme,bankhead]=raceCandidates(D,'S-MT').filter(c=>/Alme|Bankhead/.test(c.name)).map(c=>c.name);
  const list='<html><a href="ResultsSW.aspx?type=CTYALL&amp;cty=01&amp;map=CTY">Beaverhead</a> <a href="ResultsSW.aspx?type=CTYALL&amp;cty=02&amp;map=CTY">Big Horn</a> <a href="ResultsSW.aspx?type=CTYALL&amp;cty=03&amp;map=CTY">Blaine</a> <a href="ResultsSW.aspx?type=FED&amp;map=CTY">Federal</a></html>';
  const asked=[],get=async u=>{asked.push(u);if(u.endsWith('ResultsList.aspx'))return list;if(u.includes('cty=03'))throw new Error('HTTP 500');
    return countyPage('x',box('UNITED STATES SENATOR',[[alme,'Republican',u.includes('cty=01')?'2,794':'1,000'],[bankhead,'Democrat','374']]));};
  const r=await countyRace(D,'S-MT',{maps:async st=>map(st),get});
  const f=n=>map('MT').counties.find(c=>c.name===n).fips;
  assert.equal(Object.values(r.race.counties[f('Beaverhead')]).reduce((a,b)=>a+b,0),3168);assert.equal(Object.keys(r.race.counties).length,2);
  assert.ok(r.lines.some(l=>/1 of 3 county pages couldn't be read \(.*cty=03.*HTTP 500\)/.test(l)));assert.deepEqual(r.race.reporting,{n:502,of:728,unit:'precincts'});
  assert.ok(!asked.some(u=>/type=FED/.test(u)),'only county pages');
  // Nebraska: numbered pages, each naming its county; Oregon's "0 of 1,318 precincts" with votes is left out.
  const ne=await countyRace(D,'S-NE',{maps:async st=>map(st),get:async u=>{const m=/cty=(\d+)/.exec(u);if(m[1]!=='01'&&m[1]!=='02')throw new Error('HTTP 404');
    const [a,b]=raceCandidates(D,'S-NE').map(c=>c.name);return countyPage(m[1]==='01'?'Douglas':'Lancaster',box('For United States Senator - 6 Year Term',[[a,'Republican','77,328'],[b,'By Petition','121,080']],{prec:'0 out of 1318 Precincts Reported'}));}});
  assert.equal(Object.keys(ne.race.counties).length,2);assert.equal(ne.race.reporting,undefined,'a zero precinct count with votes says nothing');
  assert.ok(SOURCES['S-MT'].slow&&SOURCES['S-IA'].slow,'many pages: read every fourth pass while watching');
});

test("Iowa: no statewide detail file, so each county's own Clarity detail file is read for its totals",async()=>{
  const [a,b]=raceCandidates(D,'S-IA').map(c=>c.name);
  const county=(n)=>zipOf('detail.xml',`<?xml version="1.0"?><ElectionResult><Contest key="1" text="United States Senator" precinctsParticipating="10" precinctsReported="${n}"><Choice key="1" text="${a}" party="DEM" totalVotes="${100*n}"><VoteType name="Election Day" votes="1"><Precinct name="P1" votes="1"/></VoteType></Choice><Choice key="2" text="${b}" party="REP" totalVotes="50"/></Contest></ElectionResult>`);
  const settings={settings:{electiondetails:{participatingcounties:['Adair|127078|384979|11/3/2026 10:57:28 PM CST|16','Black_Hawk|127084|384733|11/3/2026 9:39:16 PM CST|16','Polk|127150|385000|x|16']}}};
  const asked=[],get=async u=>{asked.push(u);if(u.endsWith('/IA/elections.json'))return JSON.stringify([{EID:'127077',ElectionName:'2026 General Election',Date:'11/3/2026 12:00:00 AM'}]);
    if(u.endsWith('/IA/127077/current_ver.txt'))return '385624';if(u.endsWith('/127077/385624/json/en/electionsettings.json'))return JSON.stringify(settings);
    if(u.includes('/IA/Adair/127078/384979/reports/detailxml.zip'))return county(10);if(u.includes('/IA/Black_Hawk/127084/384733/reports/detailxml.zip'))return county(4);throw new Error('HTTP 404');};
  const r=await countyRace(D,'S-IA',{maps:async st=>map(st),get});
  const f=n=>map('IA').counties.find(c=>c.name===n).fips,k=raceCandidates(D,'S-IA').map(c=>c.key);
  assert.deepEqual(r.race.counties[f('Adair')],{[k[0]]:1000,[k[1]]:50});assert.deepEqual(r.race.counties[f('Black Hawk')],{[k[0]]:400,[k[1]]:50},'"Black_Hawk" is Black Hawk County');
  assert.deepEqual(r.race.reporting,{n:14,of:20,unit:'precincts'},'precincts added up over the counties read');
  assert.ok(r.lines.some(l=>/1 of 3 counties' detail files couldn't be read \(.*Polk.*HTTP 404\)/.test(l)));
  assert.ok(asked.includes('https://results.enr.clarityelections.com/IA/127077/385624/reports/detailxml.zip'),'the statewide file is tried first');
  assert.deepEqual(readClarityCountyXml('<Contest text="Governor"></Contest>',SOURCES['S-IA'].contest,'Adair'),null);
});

test('the probe keeps what a reader needs: the addresses in a page\'s scripts, a page as served, a PDF\'s text',async()=>{
  assert.equal(countyKey('Lewis & Clark'),countyKey('Lewis and Clark'),"Montana's county, as the state writes it");
  assert.deepEqual(scriptAddresses(`fetch("/api/v1/election/2026/contests.json");const a='https://goelect.example.gov/api-ivis-system/api/s3/enr/election/57/county/'+id;x="/css/site.css";y="text/html";z='/static/logo.png'`),
    ['/api/v1/election/2026/contests.json','https://goelect.example.gov/api-ivis-system/api/s3/enr/election/57/county/']);
  const reply=(body,type='text/html')=>({status:200,url:'',text:async()=>body,arrayBuffer:async()=>new TextEncoder().encode(body).buffer,headers:{get:()=>type}});
  const get=async u=>u.endsWith('main.js')?reply('const u="/api/results/statewide.json";'):u.endsWith('.pdf')?reply('not a pdf'):reply('<html><input type="hidden" name="__VIEWSTATE" value="AAAA'+'x'.repeat(5000)+'" /><script src="https://cdn.example.net/main.js"></script><script>var k="/data/county.json"</script></html>');
  const s=await sampleOne({u:'https://example.gov/',kind:'scripts'},{get});
  assert.match(s.text,/^Scripts of https:\/\/example\.gov\/ \(HTTP 200\):\n  https:\/\/cdn\.example\.net\/main\.js: 0 KB, 1 addresses\n\n\/data\/county\.json\n\/api\/results\/statewide\.json\n$/,'scripts on other hosts too');
  const raw=await sampleOne({u:'https://example.gov/',kind:'raw'},{get});assert.ok(raw.text.length<300&&raw.text.includes('value="…"')&&raw.text.includes('<script'),'the hidden form field cut, the scripts kept');
  assert.equal((await sampleOne({u:'https://example.gov/a.pdf',kind:'pdf'},{get})).text,'(no text in the PDF)');
  assert.equal((await sampleOne('https://example.gov/',{get})).text.includes('<script'),false,'a plain sample has no scripts');
});

test("Oregon's statewide export: its ASP.NET form sent back with CSV chosen and the Statewide button pressed",async()=>{
  const html=`<form method="post" action="./ResultsExport.aspx" id="ctl01"><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="abc" /><input type="hidden" name="__EVENTVALIDATION" value="xyz" />
    <input id="MainContent_rblTypes_0" type="radio" name="ctl00$MainContent$rblTypes" value="1" /><input id="MainContent_rblTypes_1" type="radio" name="ctl00$MainContent$rblTypes" value="2" checked="checked" />
    <input type="hidden" name="ctl00$hidElectionDate" value="11/3/2026" /><input type="button" class="button" value="Election Resources" /></form>`;
  const f=postBackForm(html,'https://results.oregonvotes.gov/ResultsExport.aspx','ctl00$MainContent$Statewide',{'ctl00$MainContent$rblTypes':'1'});
  assert.equal(f.action,'https://results.oregonvotes.gov/ResultsExport.aspx');
  assert.deepEqual(f.fields,{__VIEWSTATE:'abc',__EVENTVALIDATION:'xyz','ctl00$MainContent$rblTypes':'1','ctl00$hidElectionDate':'11/3/2026',__EVENTTARGET:'ctl00$MainContent$Statewide',__EVENTARGUMENT:''},'CSV, not the checked Excel; buttons left out');
  const [a,b]=raceCandidates(D,'S-OR').map(c=>c.name),sent=[];
  const r=await countyRace(D,'S-OR',{maps:async st=>map(st),get:async()=>{throw new Error('not asked');},post:async(page,target,choices)=>{sent.push([page,target,choices]);
    return `County,Contest,Candidate,Party,Votes\nBaker,US Senator,${a},REP,"5,000"\nBaker,US Senator,${b},DEM,"2,000"\nBenton,US Senator,${b},DEM,"30,000"\nBaker,State Senator 30th District,X,REP,1\n`;}});
  assert.deepEqual(sent,[['https://results.oregonvotes.gov/ResultsExport.aspx','ctl00$MainContent$Statewide',{'ctl00$MainContent$rblTypes':'1'}]]);
  assert.equal(Object.keys(r.race.counties).length,2);assert.equal(r.race.total,37000);assert.equal(r.race.source.u,'https://results.oregonvotes.gov/ResultsExport.aspx');
  assert.ok(!SOURCES['S-OR'].contest.test('State Senator 30th District'));
});

test("the probe's context kind keeps the code around each data address, in the page and its scripts",async()=>{
  const reply=b=>({status:200,url:'',text:async()=>b,arrayBuffer:async()=>new TextEncoder().encode(b).buffer});
  const get=async u=>u.endsWith('main.js')?reply('x'.repeat(400)+'const url=base+"/static/data/election/"+id+"/Race.json";'+'y'.repeat(400)):reply('<html><script src="/main.js"></script><script src="https://www.googletagmanager.com/gtag/js?id=1"></script></html>');
  const s=await sampleOne({u:'https://results.example.gov/',kind:'context',patterns:['Race.json']},{get});
  assert.match(s.text,/^Code around Race\.json in the scripts of https:\/\/results\.example\.gov\/ \(HTTP 200\):\n\n== Race\.json in https:\/\/results\.example\.gov\/main\.js at \d+:\nx+const url=base\+"\/static\/data\/election\/"\+id\+"\/Race\.json";y+\n$/);
  assert.ok(!s.text.includes('googletagmanager'),'analytics scripts are skipped');
});
