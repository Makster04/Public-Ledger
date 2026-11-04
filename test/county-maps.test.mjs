// County maps on the Races page: the county outlines (public/maps/<ST>.json, scripts/build-maps.mjs), the readers for
// each state's results file (scripts/county-results.mjs: North Carolina's precinct file, Enhanced Voting's export for
// Georgia, a county table for Michigan), and the saved county results (public/county-results.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readNcsbe,readEnhanced,readTable,byCounty,countyKey,lastName,countyRace,raceCandidates,SOURCES} from '../scripts/county-results.mjs';
const json=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const D=json('../public/research.json'),C=json('../public/county-results.json');
const map=st=>json(`../public/maps/${st}.json`);
const FIPS={NC:'37',GA:'13',MI:'26'};

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
  const b=byCounty(rows,raceCandidates(D,'S-NC'),map('NC'));
  assert.deepEqual(b.counties['37183'],{cooper:1224},'Wake: both precincts added up');assert.deepEqual(b.counties['37111'],{whatley:18},'McDowell');
  assert.equal(b.total,1242);assert.deepEqual(b.unmatched,[]);
  assert.throws(()=>readNcsbe('County\tChoice\n',/x/),/no "Contest Name" column/);
});

test("Georgia's results export is read by locality; a state senate race and a missing locality list are told apart",()=>{
  const opt=(name,party,v)=>({id:name,name,politicalParty:party,voteCount:v});
  const data={electionName:'2026 November General',results:{ballotItems:[{id:'1',name:'US Senate',ballotOptions:[opt('Jon Ossoff (I)','Dem',3000),opt('Mike Collins','Rep',3300)]}]},
    localResults:[{name:'Appling',ballotItems:[{id:'1',name:'US Senate',ballotOptions:[opt('Jon Ossoff (I)','Dem',1000),opt('Mike Collins','Rep',2000),opt('Write-in','',3)]},{id:'9',name:'State Senate - District 1',ballotOptions:[opt('Jon Ossoff','Dem',99)]}]},
      {name:'DeKalb County',ballotItems:[{id:'1',name:'US Senate',ballotOptions:[opt('Jon Ossoff (I)','Dem',2000),opt('Mike Collins','Rep',1300)]}]}]};
  const rows=readEnhanced(data,SOURCES['S-GA'].contest);assert.equal(rows.length,5,'the state senate race is left out');
  const b=byCounty(rows,raceCandidates(D,'S-GA'),map('GA'));
  assert.deepEqual(b.counties['13001'],{ossoff:1000,mcollins:2000,other:3});assert.deepEqual(b.counties['13089'],{ossoff:2000,mcollins:1300},'DeKalb County, by name');
  assert.throws(()=>readEnhanced({results:{ballotItems:[]}},/senate/i),/no localResults \(top-level keys: results\)/);
  assert.throws(()=>readEnhanced({localResults:[{name:'Appling',ballotItems:[{name:'Governor'}]}]},SOURCES['S-GA'].contest),/no ballot item matches.*Governor/);
});

test("Michigan's county table: a header row names the columns, in tab- or comma-separated files",()=>{
  const tsv=['ElectionDate\tOfficeCode(Text)\tDistrictCode(Text)\tStatusCode\tCountyCode\tCountyName\tOfficeDescription\tPartyOrder\tPartyName\tPartyDescription\tCandidateID\tCandidateLastName\tCandidateFirstName\tCandidateMiddleName\tCandidateFormerName\tCandidateVotes',
    '11/3/2026\t5\t00000\t0\t74\tST. CLAIR\tUnited States Senator 6 Year Term (1) Position\t1\tDEM\tDemocratic\t1\tEl-Sayed\tAbdul\t\t\t30000',
    '11/3/2026\t5\t00000\t0\t74\tST. CLAIR\tUnited States Senator 6 Year Term (1) Position\t2\tREP\tRepublican\t2\tRogers\tMike\t\t\t52000',
    '11/3/2026\t5\t00000\t0\t82\tWAYNE\tUnited States Senator 6 Year Term (1) Position\t3\tLIB\tLibertarian\t3\tSmith\tPat\t\t\t900',
    '11/3/2026\t6\t00000\t0\t82\tWAYNE\tState Senator 1st District\t1\tDEM\tDemocratic\t4\tDoe\tJane\t\t\t1'].join('\n');
  const rows=readTable(tsv,SOURCES['S-MI'].contest);assert.equal(rows.length,3,'a state senator race is left out');
  const b=byCounty(rows,raceCandidates(D,'S-MI'),map('MI'));
  assert.deepEqual(b.counties['26147'],{elsayed:30000,rogers:52000},'St. Clair');assert.deepEqual(b.counties['26163'],{other:900},'Wayne');
  const csv='County,Contest,Candidate,Party,Votes\n"Kent","U.S. Senate","Abdul El-Sayed","DEM","1,234"\n';
  assert.deepEqual(readTable(csv,SOURCES['S-MI'].contest),[{county:'Kent',choice:'Abdul El-Sayed',party:'DEM',votes:1234}]);
  assert.throws(()=>readTable('<!DOCTYPE html><html>',/x/),/a web page, not a results file/);
  assert.throws(()=>readTable('A,B\n1,2',/x/),/can't find the county, contest, candidate and votes columns \(the header is: A \| B\)/);
});

test('a race is read from the first address that works, and says how to use a saved file when none does',async()=>{
  const maps=async st=>map(st),ok={localResults:[{name:'Appling',ballotItems:[{name:'US Senate',ballotOptions:[{name:'Jon Ossoff',voteCount:5},{name:'Mike Collins',voteCount:7}]}]}]};
  const got=await countyRace(D,'S-GA',{maps,get:async u=>{if(u.includes('2026NovGen'))return JSON.stringify(ok);throw new Error('HTTP 404');}});
  assert.equal(got.race.counties['13001'].mcollins,7);assert.match(got.lines[0],/^CHECK S-GA: 1 of 159 counties/,'a partial map is a CHECK');
  const none=await countyRace(D,'S-MI',{maps,get:async()=>{throw new Error('HTTP 404');}});
  assert.equal(none.race,undefined);assert.match(none.lines.join('\n'),/couldn't read the county results[\s\S]*HTTP 404[\s\S]*npm run counties:update -- --file S-MI=<the file>/);
});

test('the saved county results fit their race and map, and add up',()=>{
  assert.match(C.about,/Unofficial/);
  for(const [id,r] of Object.entries(C.races)){
    const race=D.races.find(x=>x.id===id)||D.liteRaces.find(x=>x.id===id);assert.ok(race,id);assert.equal(r.state,race.state,id);
    const m=map(r.state),fips=new Set(m.counties.map(c=>c.fips)),keys=new Set([...(race.keys||race.nominees.map(n=>n.fecCand||n.id)),'other']);
    assert.deepEqual(r.candidates.map(c=>c.key).filter(k=>!keys.has(k)),[],id);
    let sum=0;for(const [f,v] of Object.entries(r.counties)){assert.ok(fips.has(f),`${id}: ${f} is on the map`);for(const [k,n] of Object.entries(v)){assert.ok(keys.has(k),`${id}: ${k}`);assert.ok(Number.isInteger(n)&&n>=0);sum+=n;}}
    assert.equal(sum,r.total,id);assert.match(r.source.u,/^https:\/\//);assert.match(r.fetched,/^\d{4}-\d{2}-\d{2}T/);
  }
  const nc=C.races['S-NC'];assert.equal(Object.keys(nc.counties).length,100);assert.equal(nc.total,4203181,"the state's own total");
  const share=k=>Object.values(nc.counties).reduce((a,v)=>a+(v[k]||0),0)/nc.total*100;
  const tally=D.races.find(r=>r.id==='S-NC').result.tally;assert.ok(Math.abs(share('cooper')-tally.shares.cooper)<0.01&&Math.abs(share('whatley')-tally.shares.whatley)<0.01,'the card and the map agree');
});

test('the races page draws the maps and the methodology explains them',()=>{
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/async function fillMaps\(root\)/);assert.match(app,/fillMaps\(\$\('#rlist'\)\)/);assert.match(app,/id="method-county-maps"/);
});
