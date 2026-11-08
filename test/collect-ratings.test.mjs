import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readSba,readLcv,readRfa,readHeritage,readClubForGrowth,cfgLatest,congressLabel,congressOf,matchPerson,stateCode,collect,READERS,probedGroups,HIDDEN,
  readVoterVoice,newestScorecard,readAfp,readGoa,readAra,araLatest,ARA_PDF,districtOf,readRlc,
  readAjp,readFreedomIndex,readProgressivePunch,readStandWithCrypto,readC4ip,readCpac,cloudItems,C4IP_API,
  readNumbersUsa,readNiac,readHumane,readFrcSheet,parseCsv,FRC_PAGES,NIAC_CSV} from '../scripts/collect-ratings.mjs';
import {ratingsLean} from '../public/six-scores.js';

const sample=f=>fs.readFileSync(new URL(`../data/ratings-samples/${f}`,import.meta.url),'utf8');
const research=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
const config=JSON.parse(fs.readFileSync(new URL('../data/config.json',import.meta.url),'utf8'));
const full=[...research.members,...research.cands],have=new Set(full.map(p=>p.id));
const people=[...full,...config.people.filter(p=>p.basic&&!have.has(p.id))].map(p=>({id:p.id,name:p.name,short:p.short,state:stateCode(p.state)||stateCode(p.stateName),chamber:p.chamber,district:p.chamber==='H'?districtOf(p.district):null,bioguide:p.bioguide||null,cand:!!p.cand}));
// The complete items of a JSON list the probe saved cut short.
const items=t=>{const out=[];let depth=0,start=-1,str=false,esc=false;for(let i=t.indexOf('[')+1;i<t.length;i++){const c=t[i];if(str){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')str=false;continue;}if(c==='"'){str=true;continue;}if(c==='{'){if(!depth)start=i;depth++;}else if(c==='}'&&!--depth)out.push(JSON.parse(t.slice(start,i+1)));}return out;};
const matchedBy=async rows=>Object.fromEntries((await collect({rows:async()=>rows},people,{wait:0})).matched.map(m=>[m.id,m.row]));
const of=(rows,id)=>rows.map(r=>[r,matchPerson(r,people)]).find(([,p])=>p?.id===id)?.[0];

test('SBA Pro-Life America: letter grades from its Senate and House tables, for the Congress the page names',()=>{
  const rows=readSba(sample('sba-1.html'));
  assert.ok(rows.length>=20);
  assert.deepEqual(rows[0],{name:'Tammy Baldwin',party:'Democrat',state:'WI',chamber:'S',grade:'F',status:'Current',url:'https://sbaprolife.org/senator/tammy-baldwin/',year:'119th Congress'});
  assert.equal(of(rows,'collins').grade,'D');assert.equal(of(rows,'booker').grade,'F');
});

test('LCV: the year\'s score and the lifetime score, by state',()=>{
  const rows=readLcv(sample('lcv-2.html'));
  const o=of(rows,'ossoff');
  assert.deepEqual([o.state,o.score,o.year],['GA',94,2025]);assert.ok(o.lifetime!=null);
  assert.equal(of(rows,'marshall').score,0);
});

test('Reproductive Freedom for All: the latest year with a score, page by page',async()=>{
  const rows=readRfa(sample('rfa-1.html'));
  assert.equal(rows.length,20);
  assert.deepEqual([rows[0].name,rows[0].state,rows[0].chamber,rows[0].district,rows[0].score],['Alma Adams','NC','H','NC-12',100]);
  const pages={0:sample('rfa-1.html'),1:'<table class="votes1"></table>'};
  const got=await collect(READERS.find(r=>r.key==='rfa'),people,{fetchPage:async u=>pages[/pg=(\d+)/.exec(u)[1]]??'',wait:0});
  assert.equal(got.rows.length,20);
});

test('Heritage Action: every member\'s score for the sitting Congress, from the page\'s members list, matched on Bioguide ID',async()=>{
  const rows=readHeritage(sample('heritage-2.html'));
  assert.ok(rows.length>=200,'a page cut short still reads');
  const c=rows.find(r=>r.bioguide==='C001035');
  assert.deepEqual(c,{name:'Susan Collins',state:'ME',chamber:'S',party:'R',district:null,bioguide:'C001035',score:31,url:'https://heritageaction.com/scorecard/members/C001035'});
  assert.equal(matchPerson(c,people)?.id,'collins');
  assert.ok(!rows.some(r=>r.name==='Clay Fuller'),'a member scored "N/A" (too new) is left out');
  assert.equal(matchPerson(rows.find(r=>r.name==='Mike Collins'),people)?.id,'mcollins','the other Collins, by their own ID');
  // Early in a new Congress, before any scores are posted, the one before.
  const asked=[],pages={120:'<div :members="[]"></div>',119:sample('heritage-2.html')};
  const got=await collect(READERS.find(r=>r.key==='heritage'),people,{fetchPage:async u=>{asked.push(u);return pages[/members\/(\d+)/.exec(u)[1]];},wait:0,today:new Date('2027-01-10')});
  assert.deepEqual(asked,['https://heritageaction.com/scorecard/members/120','https://heritageaction.com/scorecard/members/119']);
  assert.ok(got.matched.some(m=>m.id==='collins'&&m.row.year==='119th Congress'));
  assert.deepEqual([congressOf(2025),congressOf(2026),congressOf(2027)],[119,119,120]);
  assert.deepEqual([119,121,122,123,111,112,113].map(congressLabel),['119th Congress','121st Congress','122nd Congress','123rd Congress','111th Congress','112th Congress','113th Congress']);
});

test('Club for Growth: the newest year\'s Senate and House tables, the year\'s score and the lifetime score',async()=>{
  const latest=cfgLatest(sample('clubforgrowth-1.html'));
  assert.equal(latest.year,2025);
  assert.deepEqual(latest.pages,[{chamber:'S',url:'https://www.clubforgrowth.org/scorecards/app/?party=all&chamber=S&yr=2025&state=all&rep'},{chamber:'H',url:'https://www.clubforgrowth.org/scorecards/app/?party=all&chamber=H&yr=2025&state=all&rep'}]);
  const sen=readClubForGrowth(sample('clubforgrowth-2.html'),{chamber:'S',year:2025});
  assert.equal(sen.length,100);
  assert.deepEqual(sen.find(r=>r.bioguide==='C001035'),{name:'Susan Collins',state:'ME',chamber:'S',party:'R',bioguide:'C001035',score:43,lifetime:34,year:2025,url:'https://www.clubforgrowth.org/scorecards/legislator/C001035/Susan-Collins'});
  assert.ok(readClubForGrowth(sample('clubforgrowth-3.html'),{chamber:'H',year:2025}).length>=100,'a House page cut short still reads');
  const pages={'https://www.clubforgrowth.org/scorecards/':sample('clubforgrowth-1.html'),[latest.pages[0].url]:sample('clubforgrowth-2.html'),[latest.pages[1].url]:sample('clubforgrowth-3.html')};
  const got=await collect(READERS.find(r=>r.key==='clubforgrowth'),people,{fetchPage:async u=>pages[u],wait:0});
  const ossoff=got.matched.find(m=>m.id==='ossoff');assert.ok(ossoff&&ossoff.row.chamber==='S'&&ossoff.row.year===2025);
  await assert.rejects(collect(READERS.find(r=>r.key==='clubforgrowth'),people,{fetchPage:async()=>'<p>nothing</p>',wait:0}),/no scorecard year/);
});

test('matching: the same last name and state, and the same first name or initial; never a near miss',()=>{
  assert.equal(matchPerson({name:'Jon Ossoff',state:'GA',chamber:'S'},people)?.id,'ossoff');
  assert.equal(matchPerson({name:'Jon Ossoff',state:'TX',chamber:'S'},people),null);
  assert.equal(matchPerson({name:'Rick Scott',state:'FL',chamber:'S'},people)?.id,'rscott');assert.equal(matchPerson({name:'Zed Nobody',state:'FL',chamber:'S'},people),null);
  // A House district must agree: a former member of the same name from another district never takes the rating.
  assert.equal(matchPerson({name:'Barry Loudermilk',state:'GA',chamber:'H',district:11},people)?.id,'loudermilk');
  assert.equal(matchPerson({name:'Barry Loudermilk',state:'GA',chamber:'H',district:3},people),null);
  assert.deepEqual(['GA','Georgia','OK-04','nowhere'].map(stateCode),['GA','GA','OK',null]);
});

test('the ratings become the Ratings lean; every group without a reader says why',()=>{
  assert.deepEqual(ratingsLean([{org:'SBA',lean:'conservative',grade:'F'},{org:'LCV',lean:'liberal',score:94},{org:'RFA',lean:'liberal',score:100}]).lean,-96);
  const g=probedGroups();
  for(const [k,x] of Object.entries(g))assert.ok(['blocked','none','states','no-list','permission','to-build','old','image','unreadable','not-found'].includes(x.status),k);
  assert.equal(g.aflcio.status,'blocked');assert.equal(g.hrc.status,'permission');assert.equal(g.chamber.status,'not-found');for(const k of ['heritage','clubforgrowth','ppaction','afp','goa','ara','rlc','ajp','jbs','progressivepunch','standwithcrypto','c4ip','cpac','numbersusa','niac','humane','frc'])assert.ok(!g[k],`${k} has a reader`);
  assert.equal(g.giffords.status,'states');assert.ok(HIDDEN.has('states')&&HIDDEN.has('none')&&HIDDEN.has('old'),'groups with no current ratings of members are not shown');
  for(const r of READERS)assert.ok(!g[r.key],`${r.key} has a reader`);
});

test('Planned Parenthood Action: its newest VoterVoice scorecard, each member\'s score, at-large seats matched',async()=>{
  assert.equal(newestScorecard([{id:'a',name:'117th Congress'},{id:'b',name:'119th Congress Scorecard'},{id:'c',name:'2024 votes'}]).id,'b');
  assert.equal(newestScorecard([{id:'a',name:'Scorecard'},{id:'b',name:'Other'}]).id,'a','no year: the first listed');
  const rows=readVoterVoice(items(sample('ppaction-data-2.json')),{year:'119th Congress'});
  assert.ok(rows.length>=250);
  assert.deepEqual(rows.find(r=>r.name==='Lisa Murkowski'),{name:'Lisa Murkowski',state:'AK',chamber:'S',party:'R',district:null,score:56,year:'119th Congress'});
  const by=await matchedBy(rows);
  assert.equal(by.murkowski.score,56);assert.equal(by.collins.score,67);
  assert.ok(by.djohnson,'an at-large member listed as district 1');
  // Read in a browser (VoterVoice answers only the page's own session): the scorings the page loaded, named from its list.
  const opened=[];
  const got=await collect(READERS.find(r=>r.key==='ppaction'),people,{wait:0,fetchPage:async()=>{throw new Error('not asked directly');},browse:async(page,match)=>{opened.push(page);
    return [{url:'https://www.votervoice.net/Api/Scorecards?association=PPFA&government=./USA&active=true',text:JSON.stringify([{id:'4473-1848',name:'119th Congress'},{id:'x',name:'118th Congress'}])},
      {url:'https://www.votervoice.net/Api/Scorecards/4473-1848/Scorings',text:JSON.stringify(items(sample('ppaction-data-2.json')))}].filter(a=>match.test(a.url));}});
  assert.deepEqual(opened,['https://www.plannedparenthoodaction.org/congressional-scorecard']);
  assert.ok(got.matched.length>=250);assert.equal(got.matched.find(m=>m.id==='murkowski').row.year,'119th Congress');
  // A page that never loads the scorecard: the reason names what VoterVoice answered.
  const none=Object.assign([],{seen:['200 https://www.votervoice.net/Api/Users/GetRemembered','401 https://www.votervoice.net/Api/Scorecards/4473-1848/Scorings']});
  await assert.rejects(collect(READERS.find(r=>r.key==='ppaction'),people,{wait:0,browse:async()=>none}),/loaded no scorecard \(VoterVoice answered: 200 .*GetRemembered; 401 .*Scorings\)/);
});

test('Americans for Prosperity: the newest Congress\'s score, matched on the Bioguide ID in each photo\'s name',async()=>{
  const rows=readAfp(items(sample('afp-data-1.json')));
  const biggs=rows.find(r=>r.name==='Andy Biggs');
  assert.deepEqual([biggs.score,biggs.year,biggs.chamber,biggs.state],[100,'119th Congress','H','AZ']);
  assert.equal(rows.find(r=>r.name==='Tom Barrett').bioguide,'B001321');
  const by=await matchedBy(rows);assert.equal(by.mcollins?.score,100);assert.ok(Object.keys(by).length>=200);
});

test('Gun Owners of America: the voter guide\'s grades for Congress; an incumbent listed twice keeps the starred entry',async()=>{
  const rows=readGoa(sample('goa-1.html'));
  assert.ok(rows.length>=200&&rows.every(r=>/^[A-F][+-]?$/.test(r.grade)&&r.year===2026));
  assert.deepEqual(rows.find(r=>r.name==='Jon Ossoff'),{name:'Jon Ossoff',incumbent:true,party:'D',state:'GA',chamber:'S',race:null,grade:'F',year:2026});
  const by=await matchedBy(rows);
  assert.equal(by.ossoff.grade,'F');assert.equal(by.mcollins.grade,'A');
  const twice=await matchedBy([{name:'Clay Fuller',state:'GA',chamber:'H',grade:'B'},{name:'Clay Fuller',incumbent:true,state:'GA',chamber:'H',grade:'A'}]);
  assert.equal(Object.values(twice)[0]?.grade??'A','A');
  const clash=await matchedBy([{name:'Jon Ossoff',state:'GA',chamber:'S',grade:'A'},{name:'Jon Ossoff',state:'GA',chamber:'S',grade:'F'}]);
  assert.equal(clash.ossoff,undefined,'two entries that disagree: neither');
});


test('Alliance for Retired Americans: by state, senators then House members, last names matched with the district',async()=>{
  const rows=readAra(sample('ara-2.txt'));
  const ga=rows.filter(r=>r.state==='GA');
  assert.deepEqual(ga.slice(0,2).map(r=>[r.chamber,r.name,r.score,r.lifetime,r.year]),[['S','Ossoff',100,100,2025],['S','Warnock',100,100,2025]]);
  assert.deepEqual(ga.filter(r=>r.name==='Scott').map(r=>[r.district,r.score]),[[8,0],[13,100]]);
  assert.equal(rows.find(r=>r.state==='AK'&&r.chamber==='H').district,0,'at large');
  const by=await matchedBy(rows);
  assert.deepEqual([by.collins.score,by.collins.lifetime,by.ossoff.score,by.mcollins.score],[10,43,100,0]);
  assert.ok(Object.keys(by).length>=450);
  assert.equal(araLatest('<a href="/x/2024-Congressional-Voting-Record.pdf">a</a><a href="/x/2026-Congressional-Voting-Record.pdf">b</a>'),'/x/2026-Congressional-Voting-Record.pdf');
  assert.equal(araLatest('<p>none</p>'),ARA_PDF);
  assert.deepEqual(['PA-10','AK-AL',7,null].map(districtOf),[10,0,7,null]);
});

test('Republican Liberty Caucus: its Liberty Index PDFs, letters cut off and some old districts, matched on what\'s left',async()=>{
  const sen=readRlc(sample('rlc-1.txt'),{chamber:'S',year:2025}),house=readRlc(sample('rlc-2.txt'),{chamber:'H',year:2025});
  assert.equal(sen.length,53,'every Republican senator');assert.ok(house.length>=210);
  assert.equal(sen.find(r=>r.name==='Rand Paul').score,99);assert.equal(house.find(r=>r.name==='Thomas Massie').score,101,'the bonus counted, as published');
  const by=await matchedBy([...sen,...house]);
  assert.ok(Object.keys(by).length>=255);
  assert.deepEqual(['britt','rscott','tscott','collins','mcollins','ecarter','jcarter'].map(id=>by[id]?.score),[50,52,40,35,59,39,40]);
  assert.ok(by.csmith,'a profile with the legal first name (Christopher)');
  assert.equal(by.kennedy?.name,'John ennedy','a last name with its first letter cut off');
  assert.equal(by.diazbalart?.name,'Mario Diaz-Balart','listed under his old district');
});

// The items of a JSON list in a saved answer (from the given key), even when it was cut short.
const itemsAt=(t,key)=>items(t.slice(t.indexOf(`"${key}"`)));

test('AJP Action: its spreadsheet\'s "All Members", AJP\'s own letter grade (its points are its own scale)',async()=>{
  const sheets=sample('ajp-1.txt').split(/\n\n(?=# )/).map(b=>{const [h,...rows]=b.split('\n');return {name:h.replace(/^# /,''),rows:rows.map(r=>r.split('\t'))};});
  const rows=readAjp(sheets,{year:2026});
  assert.equal(rows.length,532,'members who left have no grade');
  assert.deepEqual(rows.find(r=>r.name==='Susan M. Collins'),{name:'Susan M. Collins',state:'ME',party:'R',chamber:'S',district:null,grade:'F',year:2026});
  assert.ok(rows.every(r=>r.score===undefined),'no points stored as a percent');
  const by=await matchedBy(rows);assert.deepEqual([by.ossoff.grade,by.booker.grade,by.mcollins.grade],['C','C','D']);assert.ok(Object.keys(by).length>=520);
});

test('Freedom Index: each card\'s Freedom Index grade and percent, the Bioguide ID from the photo when it has one',async()=>{
  const rows=readFreedomIndex(sample('jbs-1.html'));
  assert.ok(rows.length>=100);
  assert.deepEqual(rows.find(r=>r.name==='Susan M. Collins'),{name:'Susan M. Collins',state:'ME',party:'R',chamber:'S',district:null,bioguide:'C001035',score:38,grade:'F',year:'119th Congress',url:'https://freedomindex.us/legislator/994/'});
  const by=await matchedBy(rows);assert.deepEqual([by.booker.score,by.begich.grade],[13,'B']);
});

test('ProgressivePunch: this Congress\'s and the career share of progressive votes, a chamber a page',async()=>{
  const rows=readProgressivePunch(sample('progressivepunch-2.html'),{chamber:'H'});
  const aoc=rows.find(r=>r.name==='Alexandria Ocasio-Cortez');
  assert.deepEqual([aoc.state,aoc.district,aoc.score,aoc.lifetime,aoc.year],['NY',14,99,98,'2025–26']);
  const by=await matchedBy(rows);assert.deepEqual([by.adams.score,by.adams.lifetime],[98,97]);
  // The Senate's page, asked for by name, is read only if its title says Senate.
  const pages={senate:sample('progressivepunch-2.html'),house:sample('progressivepunch-2.html')};
  const got=await collect(READERS.find(r=>r.key==='progressivepunch'),people,{wait:0,fetchPage:async u=>pages[/house=(\w+)/.exec(u)[1]]});
  assert.ok(got.rows.every(r=>r.chamber==='H'),'a House page served for the Senate is skipped');
});

test('Stand With Crypto: sitting members and candidates with a stance score; no score, no rating',async()=>{
  const rows=readStandWithCrypto({people:itemsAt(sample('standwithcrypto-data-1.json'),'people')});
  assert.ok(rows.length>=100&&rows.every(r=>Number.isFinite(r.score)));
  const lummis=rows.find(r=>r.name==='Cynthia Lummis');assert.deepEqual([lummis.state,lummis.chamber,lummis.score,lummis.party],['WY','S',100,'R']);
  const by=await matchedBy(rows);assert.equal(by.blackburn?.score,100);
  // Refused directly: read from its page in a browser.
  const got=await collect(READERS.find(r=>r.key==='standwithcrypto'),people,{wait:0,fetchPage:async()=>{throw new Error('HTTP 401');},
    browse:async()=>[{url:'https://www.standwithcrypto.org/api/us/dtsi/all-people',text:JSON.stringify({people:itemsAt(sample('standwithcrypto-data-1.json'),'people')})}]});
  assert.ok(got.matched.length>=100);
});

test('Council for Innovation Promotion: its member list page by page, grades and Bioguide IDs; on no side',async()=>{
  const page=JSON.parse(sample('c4ip-data-1.json'));
  assert.deepEqual(readC4ip(page,{year:2026})[0],{name:'Marsha Blackburn',state:'TN',chamber:'S',party:'R',bioguide:'B001243',grade:'A+',year:2026});
  const asked=[];
  const got=await collect(READERS.find(r=>r.key==='c4ip'),people,{wait:0,fetchPage:async u=>{asked.push(u);const skip=Number(new URL(u).searchParams.get('skip'));return JSON.stringify(skip<96?{...page,total:96,skip}:{members:[],total:96});}});
  assert.deepEqual(asked.map(u=>new URL(u).searchParams.get('skip')),['0','48']);assert.ok(asked.every(u=>u.startsWith(C4IP_API)));
  assert.equal(READERS.find(r=>r.key==='c4ip').lean,'none');assert.ok(got.matched.length>=40);
  // Refused to a script: read from its page in a browser, scrolled until every member is loaded; part of them is no read.
  const refused=async()=>{throw new Error('HTTP 403');},pg=skip=>({url:`${C4IP_API}?skip=${skip}`,text:JSON.stringify({...page,skip,total:96})});
  const all=await collect(READERS.find(r=>r.key==='c4ip'),people,{wait:0,fetchPage:refused,browse:async()=>[pg(0),pg(48)].map((a,i)=>i?{...a,text:JSON.stringify({...JSON.parse(a.text),members:JSON.parse(a.text).members.map(m=>({...m,bioguideId:m.bioguideId+'x',member_name:m.member_name+' II'}))})}:a)});
  assert.equal(all.rows.length,96);
  await assert.rejects(collect(READERS.find(r=>r.key==='c4ip'),people,{wait:0,fetchPage:refused,browse:async()=>[pg(0)]}),/loaded 48 of its 96 members/);
});

test('CPAC: its database\'s ratings of Congress, read in a browser, the latest year\'s and the lifetime rating by Bioguide ID',async()=>{
  const answer={url:'https://www.cpac.org/_api/cloud-data/v2/items/query?.r=x',text:JSON.stringify({dataItems:itemsAt(sample('cpac-data-2.json'),'dataItems')})};
  const list=cloudItems([answer,answer]);assert.ok(list.length>=400,'the same item twice counts once');
  const rows=readCpac(list);
  assert.deepEqual(rows[0],{name:'Alma Adams',state:'NC',chamber:'H',bioguide:'A000370',score:0,lifetime:2,year:2025,url:'https://www.cpac.org/bio/a000370'});
  const got=await collect(READERS.find(r=>r.key==='cpac'),people,{wait:0,fetchPage:async()=>{throw new Error('not asked directly');},browse:async()=>[answer]});
  const by=Object.fromEntries(got.matched.map(m=>[m.id,m.row]));assert.deepEqual([by.collins.score,by.collins.lifetime,by.mcollins.score],[50,43,90]);
});

test('NumbersUSA: the grades service its grade cards page draws from, this Congress, by grade',async()=>{
  const rows=readNumbersUsa(JSON.parse(sample('numbersusa-data-2.json')));
  assert.ok(rows.length>=500);
  assert.deepEqual(rows[0],{name:'Tom McClintock',state:'CA',chamber:'H',party:'R',district:5,bioguide:'M001177',score:100,grade:'A+',year:'119th Congress'});
  const by=await matchedBy(rows);assert.deepEqual([by.collins.grade,by.collins.score,by.mcollins.grade],['C-',38,'A+']);assert.ok(Object.keys(by).length>=500);
  // Refused to a script: the same answer, from its page in a browser.
  const got=await collect(READERS.find(r=>r.key==='numbersusa'),people,{wait:0,today:new Date('2026-11-09'),fetchPage:async()=>{throw new Error('HTTP 403');},
    browse:async(page)=>{assert.equal(page,'https://www.numbersusa.org/grades/');return [{url:'https://grades.numbersusa.org/v1/grades/search/?congress=119',text:sample('numbersusa-data-2.json')}];}});
  assert.ok(got.matched.length>=500);
});

test('NIAC Action: its spreadsheet file, members in office, their overall percent and grade',async()=>{
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n'),[['a','b'],['x, y','say "hi"\nthere']]);
  const rows=readNiac(sample('niac-data-3.txt'),{year:'119th Congress'});
  assert.ok(rows.length>=400);
  assert.deepEqual(rows.find(r=>r.bioguide==='B001288'),{name:'Cory A. Booker',state:'NJ',chamber:'S',party:'D',district:null,bioguide:'B001288',score:70,grade:'B',year:'119th Congress'});
  const by=await matchedBy(rows);assert.deepEqual([by.collins.grade,by.mcollins.district??null,by.mcollins.score],['F',10,4]);
  assert.ok(NIAC_CSV.endsWith('/scores_wide.csv'));
});

test('Humane World: its House and Senate sheets, read in a browser; "100+" counts 100; the year from the page title',async()=>{
  const house=readHumane(JSON.parse(sample('humane-data-1.json')).values,{year:2026}),sen=readHumane(JSON.parse(sample('humane-data-2.json')).values,{year:2026});
  assert.ok(house.length>=400&&house.every(r=>r.chamber==='H'));assert.ok(sen.length>=90&&sen.every(r=>r.chamber==='S'));
  assert.deepEqual(sen.find(r=>r.name==='Cory A. Booker'),{name:'Cory A. Booker',state:'NJ',party:'D',chamber:'S',district:null,score:100,lifetime:105,year:2026});
  const answers=Object.assign([{url:'https://sheets.googleapis.com/v4/spreadsheets/a/values/modded',text:sample('humane-data-1.json')},{url:'https://sheets.googleapis.com/v4/spreadsheets/b/values/modded',text:sample('humane-data-2.json')}],{title:'2026 Humane Scorecard Preview | Humane World Action Fund'});
  const got=await collect(READERS.find(r=>r.key==='humane'),people,{wait:0,browse:async()=>answers});
  const by=Object.fromEntries(got.matched.map(m=>[m.id,m.row]));assert.deepEqual([by.booker.score,by.booker.year,by.adams.score],[100,2026,71]);
});

test('FRC Action: each chamber\'s page names its public Quorum sheet; the share of votes with FRC; members-elect left out',async()=>{
  const sheet=JSON.parse(sample('frc-data-2.json'));
  const rows=readFrcSheet(sheet);
  assert.ok(rows.length>=90&&rows.every(r=>r.chamber==='S'&&r.year===2026));
  assert.deepEqual(rows.find(r=>r.name==='Josh Hawley'),{name:'Josh Hawley',state:'MO',party:'R',chamber:'S',district:null,score:100,year:2026});
  assert.ok(!rows.some(r=>r.name==='Kurt Alme'),'a senator-elect');
  const asked=[];
  const got=await collect(READERS.find(r=>r.key==='frc'),people,{wait:0,fetchPage:async u=>{asked.push(u);
    if(u===FRC_PAGES[0])return '<iframe src="https://www.quorum.us/spreadsheet/external/wxRyBnaMcQErlwGUCwFg/"></iframe>';
    if(u===FRC_PAGES[1])return '<iframe src="https://www.quorum.us/spreadsheet/external/JOaiLNNYQtOvwaIrcaRi/"></iframe>';
    return /wxRy/.test(u)?JSON.stringify(sheet):JSON.stringify({...sheet,name:'119th Congress, Second Session, 2026 (House)',row_data:[]});}});
  assert.ok(asked.some(u=>/api\/sheet\/wxRyBnaMcQErlwGUCwFg\//.test(u))&&asked.some(u=>/api\/sheet\/JOaiLNNYQtOvwaIrcaRi\//.test(u)));
  const by=Object.fromEntries(got.matched.map(m=>[m.id,m.row]));assert.deepEqual([by.collins.score,by.hawley.score],[50,100]);
});
