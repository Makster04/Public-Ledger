// The trackers (public/trackers.js): the seven approved lobbies, how a campaign's money from each is counted for the
// Summary of Major Lookouts (✕ took / ✓ none / … waiting), and the super PACs around each, plus where they show.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TRACKERS,TRACKER,isTrackerPac,researchPacLines,mergePacLines,trackerMoney,lookouts,trackerSuperPacs,isOwnSuperPac,trackerOutside,ownSuperPacSpending} from '../public/trackers.js';
import {bundledBox} from '../public/money-map.js';

const research=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const line=(name,amount,cid=null)=>({cid,name,amount});
const caught=(key,name)=>isTrackerPac(TRACKER[key],{name});

test('seven trackers in the approved order, each with its PACs on file and none shared',()=>{
  assert.deepEqual(TRACKERS.map(t=>t.key),['aipac','pharma','oil','tech','crypto','defense','wallstreet']);
  assert.deepEqual(TRACKERS.map(t=>t.name),['Pro-Israel Lobby','Big Pharma + Insurance','Big Oil','Big Tech + AI','Crypto','Big Defense','Wall Street']);
  const ids=TRACKERS.flatMap(t=>t.pacIds);
  assert.equal(new Set(ids).size,ids.length,'no committee counts for two trackers by ID');
  for(const t of TRACKERS)for(const id of t.pacIds){
    const c=research.pacCommittees[id];assert.ok(c,`${t.key}: ${id} is on file`);
    assert.ok(t.patterns.some(r=>r.test(c[0])),`${t.key}: ${c[0]} matches its own patterns too`);
  }
});

test('who is in and who is out, as approved',()=>{
  // The Pro-Israel Lobby (2026-11-14): AIPAC, the PACs that say they exist to support Israel, the RJC's and those named for
  // Israel; not J Street, not groups that don't say so, and not a bank or an anti-Zionist PAC that shares a word.
  for(const n of ['AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE','NORPAC','JOINT ACTION COMMITTEE FOR POLITICAL AFFAIRS','TO PROTECT OUR HERITAGE PAC','U.S. ISRAEL PAC  (USI PAC)','CITYPAC','DMFI PAC',
    'REPUBLICAN JEWISH COALITION POLITICAL ACTION COMMITTEE (RJC-PAC)','FRIENDS OF ISRAEL POLITICAL ACTION COMMITTEE - FIPAC','PRO-ISRAEL AMERICA PAC','CHRISTIANS FOR ISRAEL PAC','DEMOCRATS FOR ISRAEL LOS ANGELES FEDERAL PAC'])assert.ok(caught('aipac',n),n);
  for(const n of ['JSTREETPAC','J STREET PAC','J STREET ACTION FUND','BEND THE ARC JEWISH ACTION INC. PAC','JVP ACTION PAC','MARYLAND ASSOCIATION FOR CONCERNED CITIZENS POLITICAL ACTION COMMITTEE',
    'MID MANHATTAN POLITICAL ACTION COMMITTEE (MID PAC)','NATPAC 1947','ZIONS BANCORPORATION PAC','ANTI-ZIONIST AMERICA PAC','ROCKET CITY PAC'])assert.ok(!caught('aipac',n),n);
  // Oil: Koch, coal and mining, and gas utilities are out.
  for(const n of ['EXXON MOBIL CORPORATION POLITICAL ACTION COMMITTEE','CHEVRON EMPLOYEES POLITICAL ACTION COMMITTEE','AMERICAN PETROLEUM INSTITUTE PAC','VALERO ENERGY CORPORATION PAC'])assert.ok(caught('oil',n),n);
  for(const n of ['KOCH INDUSTRIES INC POLITICAL ACTION COMMITTEE (KOCHPAC)','PEABODY ENERGY PAC','NATIONAL MINING ASSOCIATION PAC','ATMOS ENERGY CORPORATION PAC','SHELLEY FOR CONGRESS'])assert.ok(!caught('oil',n),n);
  // Pharma + Insurance: drugmakers, health insurers, the PBMs and their groups; devices, distributors, hospitals and
  // drugstore chains are out (CVS Health is in, as Aetna's and Caremark's owner).
  for(const n of ['PFIZER INC. PAC','AMGEN INC. POLITICAL ACTION COMMITTEE','PHARMACEUTICAL RESEARCH AND MANUFACTURERS OF AMERICA PAC','UNITEDHEALTH GROUP INCORPORATED PAC (UNITEDHEALTH GROUP PAC)','CVS HEALTH PAC',
    'THE CIGNA GROUP EMPLOYEE POLITICAL ACTION COMMITTEE','BLUEPAC - BLUE CROSS BLUE SHIELD ASSOCIATION PAC','CAREFIRST BLUECROSS BLUESHIELD ASSOCIATES FEDERAL PAC','AMERICA\'S HEALTH INSURANCE PLANS, INC. PAC (AHIP PAC)',
    'PHARMACEUTICAL CARE MANAGEMENT ASSOCIATION POLITICAL ACTION COMMITTEE (PCMA PAC)','MOLINA HEALTHCARE, INC. PAC'])assert.ok(caught('pharma',n),n);
  for(const n of ['MEDTRONIC INC PAC','MCKESSON CORPORATION EMPLOYEES POLITICAL FUND','WALGREEN CO PAC','AMERICAN HOSPITAL ASSOCIATION PAC','HCA HEALTHCARE PAC','MOLINARO VICTORY COMMITTEE','SHIELD AI POLITICAL ACTION COMMITTEE (SAIPAC)'])assert.ok(!caught('pharma',n),n);
  assert.equal(TRACKER.pharma.card,'Pharma + Ins.','the report card\'s shorter label');
  // Wall Street: big banks, investment firms, private equity, exchanges, card companies and their national groups; community
  // banks, state bankers associations, credit unions and insurers are out.
  for(const n of ['JPMORGAN CHASE & CO. FEDERAL POLITICAL ACTION COMMITTEE','THE GOLDMAN SACHS GROUP, INC. POLITICAL ACTION COMMITTEE','AMERICAN BANKERS ASSOCIATION PAC (BANKPAC)','THE CARLYLE GROUP INC. PAC (AKA \'CARLYLE PAC\')',
    'CITADEL SECURITIES POLITICAL ACTION COMMITTEE (CITADEL SECURITIES PAC)','VISA, INC. POLITICAL ACTION COMMITTEE','FMR LLC POLITICAL ACTION COMMITTEE - FEDERAL (FIDELITY PAC)','THE VANGUARD GROUP COMMITTEE FOR RESPONSIBLE GOVERNMENT'])assert.ok(caught('wallstreet',n),n);
  for(const n of ['WISCONSIN BANKERS ASSOCIATION (WISBANKPAC)','INDEPENDENT COMMUNITY BANKERS OF AMERICA PAC','AMERICA\'S CREDIT UNIONS PAC','MASSACHUSETTS MUTUAL LIFE INSURANCE COMPANY POLITICAL ACTION COMMITTEE',
    'FIDELITY NATIONAL FINANCIAL INC PAC 2001','HINMAN STRAUB PAC (STATE STREET ASSOCIATES PAC)','AMERICA FIRST BLACK VANGUARDS'])assert.ok(!caught('wallstreet',n),n);
  // Tech + AI: platforms, chips, Nvidia and Palantir; telecom and cable are out.
  for(const n of ['MICROSOFT CORPORATION POLITICAL ACTION COMMITTEE','GOOGLE LLC NETPAC','NVIDIA CORPORATION PAC','PALANTIR TECHNOLOGIES INC. PAC'])assert.ok(caught('tech',n),n);
  for(const n of ['AT&T INC. EMPLOYEE FEDERAL POLITICAL ACTION COMMITTEE','VERIZON COMMUNICATIONS INC. GOOD GOVERNMENT CLUB','COMCAST CORPORATION POLITICAL ACTION COMMITTEE'])assert.ok(!caught('tech',n),n);
  // Andreessen Horowitz counts for both Tech + AI and Crypto.
  assert.ok(caught('tech','ANDREESSEN HOROWITZ PAC')&&caught('crypto','ANDREESSEN HOROWITZ PAC'));
  assert.ok(caught('crypto','COINBASE INC. PAC')&&caught('crypto','BLOCKCHAIN ASSOCIATION POLITICAL ACTION COMMITTEE (BA PAC)'));
  // Big Defense: the contractors, and GE's and Honeywell's aerospace PACs; the rest of GE and Honeywell, space launch,
  // commercial-only aerospace and a brewery named Sierra Nevada are out. Palantir counts for both Big Defense and Tech + AI.
  for(const n of ['LOCKHEED MARTIN CORPORATION EMPLOYEES\' POLITICAL ACTION COMMITTEE','EMPLOYEES OF RTX CORPORATION POLITICAL ACTION COMMITTEE','THE BOEING COMPANY PAC','HUNTINGTON INGALLS INDUSTRIES, INC. EMPLOYEES POLITICAL ACTION COMMITTEE (HIIPAC)',
    'ANDURIL INDUSTRIES, INC. POLITICAL ACTION COMMITTEE (ANDURIL PAC)','SIERRA NEVADA COMPANY, LLC POLITICAL ACTION COMMITTEE','AEROJET ROCKETDYNE AN L3HARRIS TECHNOLOGIES COMPANY PAC','CRITICAL MISSION SOLUTIONS PAC OF AMENTUM HOLDINGS INC.',
    'GENERAL ELECTRIC COMPANY AEROSPACE EMPLOYEE POLITICAL ACTION COMMITTEE (GE AEROSPACE PAC)','HONEYWELL AEROSPACE US LLC PUBLIC AFFAIRS COUNCIL (HONA PAC)','SAAB, INC. EMPLOYEES POLITICAL ACTION COMMITTEE (SAAB PAC)'])assert.ok(caught('defense',n),n);
  for(const n of ['HONEYWELL INTERNATIONAL INC. TECHNOLOGIES PUBLIC AFFAIRS COUNCIL (HONPAC)','GENERAL ELECTRIC COMPANY POLITICAL ACTION COMMITTEE','SPACE EXPLORATION TECHNOLOGIES CORP. PAC','BLUE ORIGIN LLC POLITICAL ACTION COMMITTEE (BLUE ORIGIN PAC)',
    'AIRBUS AMERICAS, INC. POLITICAL ACTION COMMITTEE','SPIRIT AEROSYSTEMS, INC. PAC','SIERRA NEVADA BREWING CO. PAC','BOEING EMPLOYEES CREDIT UNION PAC'])assert.ok(!caught('defense',n),n);
  assert.ok(caught('defense','EMPLOYEES OF PALANTIR TECHNOLOGIES INC. PAC')&&caught('tech','EMPLOYEES OF PALANTIR TECHNOLOGIES INC. PAC'));
  assert.equal(TRACKER.defense.superPacs.length,0);assert.equal(TRACKER.defense.groups.length,0,'the defense trade groups have no PACs');
});

test('a lookout: PAC checks and routed gifts take it; employees\' gifts are shown but don\'t',()=>{
  const t=TRACKER.oil,lines=[line('PHILLIPS 66 PAC',5000),line('CHEVRON EMPLOYEES POLITICAL ACTION COMMITTEE',1500,'C00035006'),line('CHEVRON EMPLOYEES PAC',1000,'C00035006'),line('NATIONAL ASSOCIATION OF REALTORS PAC',5000)];
  const x=trackerMoney(t,{pacLines:lines});
  assert.equal(x.status,'took');assert.equal(x.total,7500);assert.equal(x.pac,7500);
  assert.deepEqual(x.pacs.map(p=>[p.name,p.amount,p.n]),[['PHILLIPS 66 PAC',5000,1],['CHEVRON EMPLOYEES POLITICAL ACTION COMMITTEE',2500,2]],'one committee\'s checks together, by its ID');
  assert.equal(trackerMoney(t,{pacLines:[line('NATIONAL ASSOCIATION OF REALTORS PAC',5000)]}).status,'none');
  assert.equal(trackerMoney(t,{pacLines:null}).status,'waiting','PAC lines not read: never shown as none');
  const tech=TRACKER.tech,e=trackerMoney(tech,{pacLines:[],employees:{ai:2500,both:1000,crypto:9999}});
  assert.equal(e.status,'none','employee gifts alone don\'t flip the mark');assert.equal(e.employees,3500,'AI and both, not crypto');assert.equal(e.total,0);
  assert.equal(trackerMoney(TRACKER.pharma,{pacLines:[],employees:{ai:5}}).employees,null,'no employee read for this tracker yet');
});

test('the Pro-Israel Lobby: routed gifts count, AIPAC\'s own PAC checks fill in missing PAC lines once, and unsearched gifts and unread donors wait',()=>{
  const t=TRACKER.aipac;
  const a=trackerMoney(t,{pacLines:[],routed:{aipac:819771.19,other:5},routedKnown:true,direct:{aipac:10000}});
  assert.equal(a.status,'took');assert.equal(a.routed,819771.19);assert.equal(a.pac,10000);assert.equal(a.total,829771.19);
  assert.ok(a.pacs[0].own,'marked as from AIPAC\'s own reports');
  const b=trackerMoney(t,{pacLines:[line('AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE',5000,'C00797670')],routed:{},routedKnown:true,direct:{aipac:10000}});
  assert.equal(b.pac,10000,'the same checks counted once, at the larger amount');
  const c=trackerMoney(t,{pacLines:[line('AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE',10000,'C00797670')],direct:{aipac:5000},routedKnown:true});
  assert.equal(c.pac,10000);assert.ok(!c.pacs[0].own);
  assert.equal(trackerMoney(t,{pacLines:[],routed:{},routedKnown:false,donors:{}}).status,'waiting','not every routed gift searched: no ✓');
  assert.equal(trackerMoney(t,{pacLines:[],routed:{},routedKnown:true,donors:{}}).status,'none');
  assert.equal(trackerMoney(t,{pacLines:[],routed:{},routedKnown:true}).status,'waiting','the named donors not read: no ✓');
  // NORPAC's, JACPAC's and the RJC's passed-on gifts count with AIPAC's; J Street's don't.
  const g=trackerMoney(t,{pacLines:[],routed:{aipac:100,'fec:C00247403':50,'fec:C00139659':25,'fec:C00345132':10,jstreet:999},routedKnown:true,donors:{}});
  assert.equal(g.routed,185);
  // The named donors' own checks count and are listed by name, largest first.
  const d=trackerMoney(t,{pacLines:[],routed:{},routedKnown:true,donors:{sadelson:2800,madelson:6600,someone:5}});
  assert.equal(d.status,'took');assert.equal(d.donors,9400);assert.equal(d.total,9400);
  assert.deepEqual(d.named.map(x=>[x.name,x.amount]),[['Miriam Adelson',6600],['Sheldon Adelson',2800]]);
  assert.equal(trackerMoney(TRACKER.oil,{pacLines:[],donors:{madelson:6600}}).total,0,'named donors only where the tracker has them');
  assert.equal(trackerMoney(TRACKER.oil,{pacLines:[],routedKnown:false}).status,'none','routed gifts only matter where the tracker has a group');
});

test('lookouts: one line a tracker, in order',()=>{
  const L=lookouts({pacLines:[line('PFIZER INC. PAC',5000),line('LOCKHEED MARTIN CORPORATION EMPLOYEES\' POLITICAL ACTION COMMITTEE',2500,'C00303024')],routed:{aipac:100},routedKnown:true,donors:{}});
  assert.deepEqual(L.map(x=>[x.key,x.status,x.total]),[['aipac','took',100],['pharma','took',5000],['oil','none',0],['tech','none',0],['crypto','none',0],['defense','took',2500],['wallstreet','none',0]]);
});

test('PAC lines: research.json\'s with full committee names, merged with the refresh\'s at the larger amount',()=>{
  const s=research.members.find(p=>p.id==='lawler');
  const L=researchPacLines(research,s);
  assert.equal(L.length,s.pac.rows.filter(r=>r[1]>0).length);
  assert.ok(L.every(l=>typeof l.name==='string'&&l.amount>0));
  assert.ok(L.some(l=>l.cid&&l.name===research.pacCommittees[l.cid]?.[0]),'names from the committee record');
  const m=mergePacLines([line('PFIZER INC. PAC',5000,'C1'),line('A PAC',100)],[line('PFIZER INC PAC',7500,'C1'),line('A PAC',50),line('B PAC',0)]);
  assert.deepEqual(m.map(l=>[l.cid,l.amount]),[['C1',7500],[null,100]]);
  // Two checks from one PAC in the same read add up (a primary and a general check), and only then is the larger read kept.
  const two=mergePacLines([line('PHILLIPS 66 PAC',2500,'C2'),line('PHILLIPS 66 PAC',2500,'C2')],[line('PHILLIPS 66 PAC',4000,'C2')]);
  assert.deepEqual(two.map(l=>[l.cid,l.amount]),[['C2',5000]]);
  // Lawler's own lines merged with nothing else give the same tracker totals as the lines themselves.
  const ln=researchPacLines(research,s);
  for(const t of TRACKERS)assert.equal(trackerMoney(t,{pacLines:mergePacLines(ln,[])}).pac,trackerMoney(t,{pacLines:ln}).pac,t.key);
});

test('every reviewed profile gets a mark for each tracker from the files on hand, and Lawler\'s add up',()=>{
  const people=[...research.members,...research.cands].filter(s=>s.fecCand);
  for(const s of people){
    const b=research.bundled?.people?.[s.id]||{};
    const L=lookouts({pacLines:s.pac?researchPacLines(research,s):null,routed:Object.fromEntries(Object.entries(b).map(([g,v])=>[g,v.routed])),routedKnown:true,direct:Object.fromEntries(Object.entries(b).map(([g,v])=>[g,v.direct]))});
    for(const x of L){assert.ok(['took','none','waiting'].includes(x.status));assert.ok(x.total>=0);if(!s.pac&&x.total===0)assert.equal(x.status,'waiting',`${s.id} ${x.key}: no PAC lines, no ✓`);}
  }
  const s=research.members.find(p=>p.id==='lawler'),b=research.bundled.people.lawler.aipac;
  const x=trackerMoney(TRACKER.aipac,{pacLines:researchPacLines(research,s),routed:{aipac:b.routed},routedKnown:true,direct:{aipac:b.direct},donors:{}});
  const other=researchPacLines(research,s).filter(l=>l.cid!=='C00797670'&&isTrackerPac(TRACKER.aipac,l)).reduce((a,l)=>a+l.amount,0);
  assert.equal(x.total,Math.round((b.routed+b.direct+other)*100)/100,'AIPAC\'s gifts and checks, and the other pro-Israel PACs\' lines');
});

test('super PACs: its own by name, and those its companies gave to, with spending for and against the person',()=>{
  const data={superPacs:[
    {id:'C1',name:'United Democracy Project',total:5e6,cands:[{cand:'H4NY17000',for:0,against:250000}],donors:{orgs:[],indiv:{total:0,n:0},read:10}},
    {id:'C2',name:'Leading the Future',total:2e6,cands:[{cand:'H4NY17000',for:90000,against:0}],donors:{orgs:[{name:'OPENAI',amount:100000,n:1},{name:'ANDREESSEN HOROWITZ',amount:300000,n:1}],indiv:{total:600000,n:3},read:20}},
    {id:'C3',name:'Some Other Fund',total:1e6,cands:[],donors:{orgs:[{name:'MICROSOFT CORPORATION',amount:50000,n:1},{name:'ACME',amount:10,n:1}],indiv:{total:0,n:0},read:5}}]};
  const a=trackerSuperPacs(TRACKER.aipac,data,'H4NY17000');
  assert.deepEqual(a.named.map(o=>[o.name,o.for,o.against]),[['United Democracy Project',0,250000]]);assert.deepEqual(a.funded,[]);
  const t=trackerSuperPacs(TRACKER.tech,data,'H4NY17000');
  assert.deepEqual(t.named.map(o=>[o.name,o.for]),[['Leading the Future',90000]],'its own super PAC by name');
  assert.deepEqual(t.funded.map(o=>[o.name,o.given,o.for,o.against]),[['Some Other Fund',50000,0,0]],'its own isn\'t listed twice');
  assert.deepEqual(trackerSuperPacs(TRACKER.tech,{},'X'),{named:[],funded:[]});
});

test('where they show: the lookouts beside the score, the tracker tabs, the Trackers page, and the bundled box keeps AIPAC',()=>{
  const app=read('../public/app.js'),html=read('../public/index.html'),css=read('../public/remake.css');
  assert.match(app,/from '\.\/trackers\.js'/);
  assert.match(app,/<h3>Summary of Major Lookouts<\/h3>/);
  assert.match(app,/No PAC money or gifts from \$\{esc\(x\.name\)\}/);
  assert.match(app,/bundledBox\(s,mm\)\+lookoutsBox\(/,'the lookouts go right under "Bundled through groups"');
  assert.match(app,/else if\(m\[1\]==='trackers'\)\{renderTrackers\(/);
  assert.match(app,/<th class="r">PAC checks<\/th><th class="r">Gifts routed<\/th>/,'every tracker has the Gifts routed column');
  assert.match(app,/'<span class="muted small">Not updated yet<\/span>'/,'blank, saying so, where routed gifts aren\'t read yet');
  assert.doesNotMatch(app,/function industryCard\(/,'the old crypto and AI card is replaced by the Crypto and Tech + AI trackers');
  assert.match(html,/<a href="#trackers" data-route="trackers">Trackers<\/a>/);
  for(const c of ['.lk-list','.lk-took','.lk-none','.lk-waiting','.tr-tabs','.tr-panel','.tr-page-tabs'])assert.ok(css.includes(c),c);
  // AIPAC's routed gifts stay in "Bundled through groups" too.
  const s=research.members.find(p=>p.id==='lawler');
  const box=bundledBox(s,{bundled:research.bundled.people.lawler,groups:{...Object.fromEntries((research.groupPos||[]).map(g=>[g.key,g.org])),...(research.bundled?.names||{})},categories:research.categories||{},pacNames:research.pacNames||[],pacType:()=>null});
  assert.match(box,/AIPAC/);
});

test('the super PAC line (AIPAC, Big Tech + AI and Crypto): their own super PACs\' spending, refresh first, records on file until then',()=>{
  assert.deepEqual(TRACKERS.filter(t=>t.superPacLine).map(t=>t.key),['aipac','tech','crypto'],'approved for these three');
  assert.ok(isOwnSuperPac(TRACKER.aipac,{name:"UNITED DEMOCRACY PROJECT ('UDP')"})&&isOwnSuperPac(TRACKER.aipac,{name:'United Democracy Project'}),'with or without its short tag');
  assert.ok(!isOwnSuperPac(TRACKER.aipac,{name:'United Democracy Project Action Fund'}));
  assert.ok(isOwnSuperPac(TRACKER.crypto,{name:'FAIRSHAKE'})&&isOwnSuperPac(TRACKER.crypto,{name:'Defend American Jobs, Inc.'})&&isOwnSuperPac(TRACKER.crypto,{id:'C00836221',name:'?'}));
  assert.ok(!isOwnSuperPac(TRACKER.crypto,{name:'Leading the Future'})&&isOwnSuperPac(TRACKER.tech,{name:'LEADING THE FUTURE'}));
  assert.ok(!isOwnSuperPac(TRACKER.crypto,{name:'Fairshake Friends Fund'}),'never a look-alike');
  // The records on file: Defend American Jobs in the Ohio Senate race, American Mission in Louisiana's.
  const p=id=>[...research.members,...research.cands].find(x=>x.id===id);
  const h=trackerOutside(TRACKER.crypto,p('husted').out,research.ie.cm);
  assert.ok(h.for>0,'Husted: crypto super PAC spending for him');assert.equal(h.rows[0].name,'Defend American Jobs');
  assert.ok(trackerOutside(TRACKER.crypto,p('brown').out,research.ie.cm).against>0,'and against his opponent');
  assert.ok(trackerOutside(TRACKER.tech,p('letlow').out,research.ie.cm).for>0);
  assert.deepEqual(trackerOutside(TRACKER.crypto,p('lawler').out,research.ie.cm).rows,[],'none on file for Lawler');
  assert.equal(trackerOutside(TRACKER.crypto,null,research.ie.cm),null);
  // Which source: the refresh when it shows some spending on them, else the records on file.
  const out={start:'2025-01-01',end:'2026-09-30',cms:[[0,500,0]]},cms=[['C00836221','Defend American Jobs']];
  const sp={superPacs:[{id:'C00836221',name:'DEFEND AMERICAN JOBS',cands:[{cand:'S0',for:900,against:0}]}]};
  assert.deepEqual([ownSuperPacSpending(TRACKER.crypto,{sp,cand:'S0',out,cms}).source,ownSuperPacSpending(TRACKER.crypto,{sp,cand:'S0',out,cms}).for],['refresh',900]);
  assert.deepEqual([ownSuperPacSpending(TRACKER.crypto,{sp,cand:'OTHER',out,cms}).source,ownSuperPacSpending(TRACKER.crypto,{sp,cand:'OTHER',out,cms}).for],['file',500],'the refresh shows none: the records on file');
  assert.equal(ownSuperPacSpending(TRACKER.crypto,{}),null,'nothing read');
  // It never changes the mark.
  assert.equal(trackerMoney(TRACKER.crypto,{pacLines:[]}).status,'none');
  const app=read('../public/app.js'),css=read('../public/remake.css');
  assert.match(app,/class="lk-sp">Its super PAC spending/);assert.match(app,/t\.superPacLine\?inp\.superPac/);
  assert.ok(css.includes('.lk-sp'));
});
