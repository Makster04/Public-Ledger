// Plays by the Rules: Conflicts of Interest. Matches the organizations on each sitting member's latest annual
// disclosures (data/disclosure-items.json, from npm run disclosures:export) against what their committees handle:
// an organization is "interested" when it lobbies Congress on an issue one of their committees handles (Senate LDA
// filings, lda.gov), works in an industry their committees oversee (public/committee-sectors.json), or holds federal
// contracts from an agency their committees oversee (USAspending.gov). Candidates who hold no seat have no committees,
// so nothing on their reports can be interested; they're left out of the score.
//
//   npm run conflicts:lookup   look up each organization (network: lda.gov, api.usaspending.gov), into
//                              data/conflict-lookups.json, and print what each member's items show, for review
//   npm run conflicts:build    write public/conflicts.json from the reviewed decisions (data/conflict-reviews.json)
//
//   npm run conflicts:propose  decide each organization from its lookup, into data/conflict-proposals.json (since Nov.
//                              28, 2026): interested when it lobbied on an issue their committees handle or holds
//                              contracts from an agency they oversee; never touches a reviewed decision
//   npm run conflicts:approve -- <ids | --all>   move approved members' proposals into data/conflict-reviews.json
// The lookup, for hundreds of members: it saves as it goes, so Ctrl+C keeps what's done and the next run goes on from
// there. -- --only <ids> looks up those members' organizations; -- --show prints each member's items as before.
//
// Nothing counts until it's reviewed: an item is interested only when data/conflict-reviews.json says so. A proposal
// is not a review until it's approved.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
export const LOOKUPS='data/conflict-lookups.json',REVIEWS='data/conflict-reviews.json',OUT='public/conflicts.json',PROPOSALS='data/conflict-proposals.json';

// The Senate LDA general issue codes each full committee handles (what "lobbies their committees" means). Select and
// special committees with no bills of their own handle none.
export const COMMITTEE_ISSUES={
  HSAG:['AGR','ANI','FOO','CDT'],SSAF:['AGR','ANI','FOO','CDT','NAT'],
  HSAP:['BUD'],SSAP:['BUD'],HSBU:['BUD'],SSBU:['BUD'],
  HSAS:['DEF','AER'],SSAS:['DEF','AER'],
  HSBA:['BAN','FIN','HOU','INS','URB','MON','CSP'],SSBK:['BAN','FIN','HOU','INS','URB','MON','CSP'],
  HSED:['EDU','LBR','RET','FAM'],SSHR:['HCR','MED','PHA','EDU','LBR','RET','FAM'],
  HSFA:['FOR'],SSFR:['FOR'],
  HSGO:['GOV','POS'],SSGA:['GOV','POS','HOM'],HSHM:['HOM'],
  HSIF:['HCR','MED','PHA','ENG','FUE','UTI','TEC','COM','MIA','CSP','CPI','ENV','AUT','MAN','TOB','SPO'],
  HSII:['NAT','IND','FUE'],SSEG:['NAT','ENG','FUE','UTI'],SLIA:['IND'],
  HSJU:['CPT','LAW','CIV','IMM','FIR','TOR'],SSJU:['CPT','LAW','CIV','IMM','FIR','TOR'],
  HSPW:['TRA','AVI','RRR','ROD','MAR','TRU','URB'],SSEV:['ENV','CAW','WAS','ROD','UTI'],
  SSCM:['TRA','AVI','RRR','TRU','MAR','TEC','COM','MIA','SCI','CSP','AUT','SPO','ADV'],
  HSSM:['SMB'],SSSB:['SMB'],HSSY:['SCI','AER','CPI'],HSVR:['VET'],SSVA:['VET'],
  HSWM:['TAX','TRD','TAR','MMM','RET','WEL','HCR'],SSFI:['TAX','TRD','TAR','MMM','RET','WEL','HCR'],
  HSRU:[],SSRA:[],HLIG:[],SLIN:[],HSZS:[],HSQJ:[],SPAG:[],HSHA:[],HSSO:[],SLET:[]};
// The agencies whose contracts each committee oversees (USAspending awarding agency names). Appropriations funds them all.
export const COMMITTEE_AGENCIES={
  HSAG:['Department of Agriculture'],SSAF:['Department of Agriculture'],
  HSAS:['Department of Defense'],SSAS:['Department of Defense'],
  HSBA:['Department of the Treasury','Department of Housing and Urban Development'],SSBK:['Department of the Treasury','Department of Housing and Urban Development'],
  HSED:['Department of Education','Department of Labor'],SSHR:['Department of Health and Human Services','Department of Education','Department of Labor'],
  HSFA:['Department of State','Agency for International Development'],SSFR:['Department of State','Agency for International Development'],
  HSGO:['General Services Administration','Office of Personnel Management'],SSGA:['Department of Homeland Security','General Services Administration','Office of Personnel Management'],
  HSHM:['Department of Homeland Security'],HSIF:['Department of Health and Human Services','Department of Energy','Department of Commerce'],
  HSII:['Department of the Interior'],SSEG:['Department of the Interior','Department of Energy'],
  HSJU:['Department of Justice'],SSJU:['Department of Justice'],
  HSPW:['Department of Transportation'],SSEV:['Environmental Protection Agency','Department of Transportation'],
  SSCM:['Department of Transportation','Department of Commerce','National Aeronautics and Space Administration'],
  HSSY:['National Aeronautics and Space Administration','National Science Foundation','Department of Energy'],
  HSVR:['Department of Veterans Affairs'],SSVA:['Department of Veterans Affairs'],
  HSWM:['Department of the Treasury','Department of Health and Human Services'],SSFI:['Department of the Treasury','Department of Health and Human Services'],
  HSAP:['*'],SSAP:['*']};
export const fullCommittee=id=>String(id||'').replace(/\d+$/,'');

// The organization an item names, as written (the Senate pages add a city and state: "Chipotle Mexican Grill, Inc.
// Newport Beach, CA"); for an agreement, the parties before its terms.
export function orgOf(x){
  const n=String(x?.source||x?.org||x?.terms||'').split(' · ')[0].trim();
  return n.replace(/^(Filer|Myself|Spouse)\s+and\s+(the\s+)?/i,'').replace(/\s+/g,' ').trim();
}
// The names to look an organization up by, longest first: without the state, then without one, two or three more
// words (the city, which can't be told from the name by itself). A lookup keeps only a match on the whole name.
const STATE=new RegExp(`,\\s*(?:[A-Z]{2}|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)$`);
export function nameCandidates(org){
  if(!STATE.test(org))return [org];
  const words=org.replace(STATE,'').trim().split(' '),out=[];
  for(let k=0;k<=3&&words.length-k>=1;k++){const c=words.slice(0,words.length-k).join(' ');if(words.length-k>=2||k===0)out.push(c);}
  return out;
}
// Organizations that can't be an interested party: public employers and their pension plans, the member's own trusts,
// holding companies and family foundations, accounts, and houses of worship. They're not looked up.
export function notAnInterest(name,person){
  const surname=String(person?.name||'').trim().split(/\s+/).pop();
  if(/\b(state of|county of|city of|retirement|pension|PERA|public employees?|annuity|457|house of representatives|senate|legislature|general assembly)\b/i.test(name))return 'a public employer or its pension plan';
  if(/\b(trust|IRA)\b/i.test(name)||(surname&&surname.length>2&&new RegExp(`\\b${surname}\\b`,'i').test(name)))return 'the member\'s own trust, account, holding or family foundation';
  if(/\b(church|methodist|christian|lumen christi|ministr)/i.test(name))return 'a house of worship or religious ministry';
  return null;
}
const norm=s=>String(s||'').toLowerCase().replace(/&/g,' and ').replace(/\b(inc|llc|llp|lp|corp|corporation|co|company|ltd|the|of|group|holdings?)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();

async function getJSON(url,opts={}){
  for(let i=0;i<4;i++){
    const r=await fetch(url,{...opts,headers:{'User-Agent':'public-ledger-research','Accept':'application/json',...(opts.headers||{})}});
    if(r.status===429){await new Promise(z=>setTimeout(z,15000*(i+1)));continue;}
    if(!r.ok)throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  throw new Error(`rate limited ${url}`);
}
// Lobbying: the LDA filings in the years asked whose client name matches the whole name: issue codes and spending.
export async function ldaLookup(org,years){
  for(const name of nameCandidates(org)){
    const core=norm(name);if(!core)continue;
    const q=encodeURIComponent(name.replace(/,?\s+(Inc|LLC|LLP|Corp|Corporation|Co|Ltd)\.?$/i,''));
    const issues=new Set(),filings=[],names=new Set();let spent=0,description=null;
    for(const y of years){
      const f=(await getJSON(`https://lda.gov/api/v1/filings/?client_name=${q}&filing_year=${y}&page_size=100`)).results||[];
      for(const x of f){if(norm(x.client?.name)!==core)continue;names.add(x.client.name);description??=x.client.general_description||null;
        for(const a of x.lobbying_activities||[])if(a.general_issue_code)issues.add(a.general_issue_code);spent+=Number(x.income||x.expenses||0);
        filings.push({year:x.filing_year,period:x.filing_period,registrant:x.registrant?.name,url:x.filing_document_url});}
    }
    if(filings.length)return {match:[...names],as:name,description,issues:[...issues].sort(),filings:filings.length,spent:Math.round(spent),sample:filings.slice(0,3)};
  }
  return {match:null};
}
// Federal contracts: the recipient whose name matches, then its contract awards in the fiscal years asked, by agency.
export async function contractsLookup(org,from,to){
  for(const name of nameCandidates(org)){
    const core=norm(name);if(!core)continue;
    const ac=await getJSON('https://api.usaspending.gov/api/v2/autocomplete/recipient/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({search_text:name,limit:20})});
    const rec=(ac.results||[]).filter(r=>norm(r.recipient_name)===core);if(!rec.length)continue;
    const body={filters:{recipient_search_text:[rec[0].recipient_name],award_type_codes:['A','B','C','D'],time_period:[{start_date:from,end_date:to}]},
      fields:['Award ID','Recipient Name','Award Amount','Awarding Agency'],limit:100,page:1,sort:'Award Amount',order:'desc'};
    const j=await getJSON('https://api.usaspending.gov/api/v2/search/spending_by_award/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const by={};for(const r of j.results||[]){if(norm(r['Recipient Name'])!==core)continue;const a=r['Awarding Agency']||'?';by[a]=(by[a]||0)+Number(r['Award Amount']||0);}
    return {recipient:rec[0].recipient_name,agencies:Object.fromEntries(Object.entries(by).map(([a,v])=>[a,Math.round(v)]))};
  }
  return null;
}

// The members to match: everyone in the disclosure file with committee seats; their items from the latest report
// (income, positions, agreements) and the latest two (gifts, travel), as the score reads them.
export function scope(disclosures,committees){
  const out=[];
  for(const [id,p] of Object.entries(disclosures.people||{})){
    const seats=(committees.people?.[id]||[]).map(c=>fullCommittee(c.id));if(!seats.length)continue;
    const [r0,r1]=p.reports||[];if(!r0)continue;
    const items=[];
    for(const kind of ['income','positions','agreements'])for(const x of r0[kind]||[])items.push({kind,year:r0.year,x});
    for(const r of [r0,r1].filter(Boolean))for(const kind of ['gifts','travel'])for(const x of r[kind]||[])items.push({kind,year:r.year,x});
    out.push({id,name:p.name,chamber:p.chamber,committees:[...new Set(seats)],report:{year:r0.year,url:r0.url},items});
  }
  return out;
}

// An item's dollar amount, or null when the report doesn't give one (Senate spouse income is "over $1,000", not $1,000).
export function itemAmount(kind,x){
  if(/(&gt;|>|over)\s*\$1,000\b/i.test(String(x?.text||'')))return null;
  const v=kind==='income'?(x?.amounts||[]).reduce((n,a)=>n+(Number(a)||0),0):Number(x?.value);
  return Number.isFinite(v)&&v>0?v:null;
}
// One member's record for public/conflicts.json, from their items and the reviewed decisions (keyed by organization).
// Null when an organization on the report has no decision yet: a half-reviewed report isn't scored.
// The name an organization goes by in the news: the name its lobbying filings matched, without "Inc." and the like.
export const shortName=(org,lookup)=>String(lookup?.lobbying?.as||org).replace(/,?\s+(Inc|LLC|LLP|Corp|Corporation|Co|Ltd)\.?$/i,'').trim();
export function buildRecord(m,decisions,reviewedAt,person,lookups={}){
  const rec={report:m.report,reviewed:{at:reviewedAt,src:{t:'Matches reviewed against lda.gov lobbying filings and USAspending.gov contracts',u:'https://lda.gov/'}},income:[],positions:[],agreements:[],gifts:[],travel:[]};
  const missing=[];
  for(const it of m.items){
    const org=orgOf(it.x),skip=notAnInterest(org,person||m),d=decisions?.[org];
    if(!skip&&!d)missing.push(org);
    const interested=!skip&&d?.interested===true,why=skip||d?.why||null;
    const src={t:`${it.year} report`,u:m.report.url},base={year:it.year,interested,why,src,...(interested?{name:shortName(org,lookups[org])}:{})};
    if(it.kind==='income')rec.income.push({source:org,type:it.x.type||null,amount:itemAmount('income',it.x),paidTo:it.x.paidTo||null,...base});
    else if(it.kind==='positions')rec.positions.push({position:it.x.position||null,org,...base});
    else if(it.kind==='agreements')rec.agreements.push({kind:String(it.x.terms||'').split(' · ')[1]||'agreement',org,date:it.x.date||null,...base});
    else if(it.kind==='gifts')rec.gifts.push({source:org,value:itemAmount('gifts',it.x),...base});
    else rec.travel.push({sponsor:org,dates:[it.x.from,it.x.to].filter(Boolean).join(' – ')||null,value:itemAmount('travel',it.x),...base});
  }
  return missing.length?{missing:[...new Set(missing)]}:rec;
}

// ---------- Proposed decisions, from the lookups (Nov. 28, 2026) ----------
// The Senate LDA general issue codes their committees handle, by name, for the reasons.
export const ISSUE_NAMES={AGR:'agriculture',ANI:'animals',FOO:'the food industry',CDT:'commodities',NAT:'natural resources',BUD:'budget and appropriations',
  DEF:'defense',AER:'aerospace',BAN:'banking',FIN:'financial institutions and securities',HOU:'housing',INS:'insurance',URB:'urban development',MON:'money and coinage',
  CSP:'consumer safety',EDU:'education',LBR:'labor',RET:'retirement',FAM:'family issues',HCR:'health',MED:'medical research',PHA:'pharmacy',FOR:'foreign relations',
  GOV:'government issues',POS:'the postal service',HOM:'homeland security',ENG:'energy',FUE:'fuel, gas and oil',UTI:'utilities',TEC:'telecommunications',
  COM:'broadcasting',MIA:'media',CPI:'the computer industry',ENV:'the environment',AUT:'the auto industry',MAN:'manufacturing',TOB:'tobacco',SPO:'sports',
  IND:'Native American affairs',CPT:'copyrights and patents',LAW:'law enforcement',CIV:'civil rights',IMM:'immigration',FIR:'firearms',TOR:'torts',
  TRA:'transportation',AVI:'aviation',RRR:'railroads',ROD:'roads',MAR:'maritime issues',TRU:'trucking and shipping',SCI:'science and technology',ADV:'advertising',
  CAW:'clean air and water',WAS:'waste',SMB:'small business',VET:'veterans',TAX:'taxes',TRD:'trade',TAR:'tariff bills',MMM:'Medicare and Medicaid',WEL:'welfare'};
const listWords=a=>a.length<=1?a.join(''):a.length===2?a.join(' and '):`${a.slice(0,-1).join(', ')} and ${a.at(-1)}`;
// A committee's short name: "House Committee on Transportation and Infrastructure" is "Transportation and Infrastructure".
export const committeeLabel=(id,names={})=>String(names[id]?.name||id).replace(/^(House|Senate|Joint)\s+(Permanent\s+Select\s+|Select\s+|Special\s+)?Committee\s+on\s+(the\s+)?/i,'').replace(/^Committee\s+on\s+(the\s+)?/i,'').trim();
// One organization's proposed decision, from its lookup and the member's committees: interested when it lobbied on an
// issue one of their committees handles, or holds federal contracts from an agency one oversees (Appropriations: any).
// Whether it works in an industry they oversee isn't decided here (the reviewed decisions noted it alongside lobbying).
// Null when it hasn't been looked up: nothing is proposed without the records.
export function proposeDecision(lookup,committees,names={}){
  if(!lookup||(!lookup.lobbying&&lookup.contracts===undefined))return null;
  const L=lookup.lobbying||{},C=lookup.contracts||null;
  const handled=new Map();for(const c of committees)for(const code of COMMITTEE_ISSUES[c]||[])if(!handled.has(code))handled.set(code,c);
  const hit=(L.issues||[]).filter(code=>handled.has(code));
  const oversee=new Set(committees.flatMap(c=>COMMITTEE_AGENCIES[c]||[])),any=oversee.has('*');
  const agencies=Object.keys(C?.agencies||{}),overseen=agencies.filter(a=>any||oversee.has(a));
  const years='2024–2025',filings=L.filings?`${L.filings} filing${L.filings===1?'':'s'}`:'';
  const parts=[];
  if(hit.length){const by=new Map();for(const code of hit){const c=handled.get(code);by.set(c,[...(by.get(c)||[]),ISSUE_NAMES[code]||code]);}
    parts.push(`Lobbied in ${years} (${filings}) on ${[...by].map(([c,w])=>`${listWords(w)}, which ${committeeLabel(c,names)} handles`).join('; and ')}`);}
  if(overseen.length)parts.push(`federal contracts from ${listWords(overseen)}, which ${any?'Appropriations funds':'their committees oversee'}`);
  if(parts.length)return {interested:true,why:parts.join('; '),proposed:true};
  const lob=L.match?`Lobbies only on ${listWords((L.issues||[]).map(x=>ISSUE_NAMES[x]||x))||'no listed issues'}, which their committees don’t handle`:`No lobbying filings in ${years}`;
  const con=agencies.length?`contracts only from ${listWords(agencies)}, which their committees don’t oversee`:'no federal contracts in fiscal 2024–2025';
  return {interested:false,why:`${lob}; ${con}`,proposed:true};
}
// Every member's proposals: each organization on their report without a reviewed decision. pending: the ones not
// looked up yet. A member is ready to approve when nothing is pending.
export function proposeAll(members,lookups,reviews,names={},personOf=()=>null){
  const people={};
  for(const m of members){
    const done=reviews.people?.[m.id]?.orgs||{},orgs={},pending=[];
    for(const it of m.items){const org=orgOf(it.x);if(!org||done[org]||orgs[org]||notAnInterest(org,personOf(m.id)||m))continue;
      const d=proposeDecision(lookups[org],m.committees,names);if(d)orgs[org]=d;else if(!pending.includes(org))pending.push(org);}
    if(Object.keys(orgs).length||pending.length)people[m.id]={name:m.name,committees:m.committees,orgs,pending};
  }
  return people;
}
// Approving members: their proposals become reviewed decisions (an earlier reviewed decision is kept). Only members with
// nothing pending; returns who was moved and who wasn't, with why.
export function approve(reviews,proposals,ids,today){
  const moved=[],skipped=[];
  for(const id of ids){const p=proposals.people?.[id];
    if(!p){skipped.push(`${id}: no proposals`);continue;}
    if(p.pending?.length){skipped.push(`${id}: ${p.pending.length} organization${p.pending.length===1?'':'s'} not looked up yet`);continue;}
    const r=reviews.people[id]||={name:p.name,committees:p.committees,orgs:{}};
    for(const [org,d] of Object.entries(p.orgs))if(!r.orgs[org])r.orgs[org]={interested:d.interested,why:d.why,approved:today};
    r.reviewedAt=today;delete proposals.people[id];moved.push(id);
  }
  return {moved,skipped};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const mode=process.argv[2]||'lookup';
  const disclosures=read('data/disclosure-items.json'),committees=read('public/committees.json'),research=read('public/research.json');
  const nameOf=Object.fromEntries([...research.members,...research.cands,...(research.featured||[])].map(p=>[p.id,p]));
  const members=scope(disclosures,committees);
  if(mode==='lookup'){
    const cache=fs.existsSync(path.join(root,LOOKUPS))?read(LOOKUPS):{about:'',orgs:{}};
    cache.about='What lda.gov (lobbying filings, 2024–2025) and USAspending.gov (federal contracts, fiscal 2024–2025) show for each organization on sitting members\' disclosures. Written by npm run conflicts:lookup; read when the matches are reviewed (data/conflict-reviews.json).';
    const onlyArg=process.argv.indexOf('--only'),only=onlyArg>0?new Set(String(process.argv[onlyArg+1]||'').split(',').filter(Boolean)):null;
    const todo=[...new Set(members.filter(m=>!only||only.has(m.id)).flatMap(m=>m.items.map(it=>orgOf(it.x)).filter(org=>org&&!cache.orgs[org]&&!notAnInterest(org,nameOf[m.id]||m))))];
    const save=()=>fs.writeFileSync(path.join(root,LOOKUPS),JSON.stringify(cache,null,1)+'\n');
    // Saved as it goes: Ctrl+C keeps what's looked up, and the next run goes on from there.
    process.on('SIGINT',()=>{save();console.log(`\nStopped: saved ${Object.keys(cache.orgs).length} organizations looked up. Run it again to go on.`);process.exit(130);});
    console.log(`${members.length} members with a report and committee seats; ${todo.length} organizations to look up (${Object.keys(cache.orgs).length} already looked up).`);
    let n=0,failed=0;
    for(const org of todo){n++;
      process.stdout.write(`  [${n}/${todo.length}] ${org.slice(0,70)} … `);
      try{cache.orgs[org]={lobbying:await ldaLookup(org,[2024,2025]),contracts:await contractsLookup(org,'2023-10-01','2025-09-30'),checked:new Date().toISOString().slice(0,10)};console.log('ok');}
      catch(e){failed++;console.log(e.message);}
      if(n%10===0)save();
    }
    save();
    console.log(`Looked up ${n-failed} of ${todo.length}${failed?`; ${failed} failed (run again to retry them)`:''}. Then: npm run conflicts:propose`);
    if(process.argv.includes('--show'))for(const m of members.filter(m=>!only||only.has(m.id))){
      const issues=new Set(m.committees.flatMap(c=>COMMITTEE_ISSUES[c]||[]));
      console.log(`\n== ${m.name} (${m.committees.join(', ')}) handles: ${[...issues].join(' ')||'no issue codes'}`);
      for(const it of m.items){const org=orgOf(it.x),skip=notAnInterest(org,nameOf[m.id]||m),L=cache.orgs[org];
        const hit=L?.lobbying?.issues?.filter(c=>issues.has(c))||[];
        console.log(`  ${it.year} ${it.kind.padEnd(10)} ${org.slice(0,60).padEnd(60)} ${skip?`— ${skip}`:L?`lobbies: ${L.lobbying?.match?`${L.lobbying.issues.join(' ')||'(no issues)'}${hit.length?` ← ${hit.join(' ')}`:''}`:'not found'}; contracts: ${L.contracts?Object.keys(L.contracts.agencies).join('; '):'none'}`:'not looked up'}`);}
    }
  }
  if(mode==='propose'){
    const lookups=(fs.existsSync(path.join(root,LOOKUPS))?read(LOOKUPS):{orgs:{}}).orgs,reviews=fs.existsSync(path.join(root,REVIEWS))?read(REVIEWS):{people:{}};
    const people=proposeAll(members,lookups,reviews,committees.committees||{},id=>nameOf[id]);
    const all=Object.values(people),orgs=all.flatMap(p=>Object.values(p.orgs));
    fs.writeFileSync(path.join(root,PROPOSALS),JSON.stringify({about:'Proposed Conflicts of Interest decisions, from the lookups (npm run conflicts:propose): an organization is interested when it lobbied in 2024–2025 on an issue one of the member\'s committees handles, or holds federal contracts from an agency one oversees (Appropriations: any). Whether it works in an industry they oversee isn\'t decided automatically. Nothing here counts until approved (npm run conflicts:approve), which moves a member\'s proposals into data/conflict-reviews.json. pending: organizations not looked up yet.',
      built:new Date().toISOString().slice(0,10),people},null,1)+'\n');
    const ready=all.filter(p=>!p.pending.length).length;
    console.log(`${all.length} members with organizations to decide: ${ready} ready to approve, ${all.length-ready} with some not looked up yet.`);
    console.log(`Proposed: ${orgs.filter(d=>d.interested).length} interested, ${orgs.filter(d=>!d.interested).length} not, of ${orgs.length} organizations.`);
    for(const [id,p] of Object.entries(people))for(const [org,d] of Object.entries(p.orgs))if(d.interested)console.log(`  ${p.name}: ${org} — ${d.why}`);
    console.log(`Wrote ${PROPOSALS}. Approve with npm run conflicts:approve -- <ids> (or --all), then npm run conflicts:build.`);
  }
  if(mode==='approve'){
    const proposals=read(PROPOSALS),reviews=fs.existsSync(path.join(root,REVIEWS))?read(REVIEWS):{about:'',people:{}};
    const args=process.argv.slice(3).filter(a=>!a.startsWith('--')).flatMap(a=>a.split(',')).filter(Boolean);
    const ids=process.argv.includes('--all')?Object.keys(proposals.people||{}):args;
    if(!ids.length){console.log('Name the members to approve (npm run conflicts:approve -- ossoff,booker) or --all.');process.exit(1);}
    const today=new Date().toISOString().slice(0,10),{moved,skipped}=approve(reviews,proposals,ids,today);
    reviews.reviewedAt=today;
    fs.writeFileSync(path.join(root,REVIEWS),JSON.stringify(reviews,null,1)+'\n');fs.writeFileSync(path.join(root,PROPOSALS),JSON.stringify(proposals,null,1)+'\n');
    console.log(`Approved ${moved.length} member${moved.length===1?'':'s'}${skipped.length?`; not moved: ${skipped.join('; ')}`:''}. Then: npm run conflicts:build`);
  }
  if(mode==='build'){
    const reviews=read(REVIEWS),out={about:'Each sitting member\'s outside income, board seats, agreements, gifts and paid travel from their latest annual reports, with the reviewed matches of the organizations on them: an organization is interested when it lobbies on an issue one of their committees handles, works in an industry their committees oversee, or holds contracts from an agency their committees oversee. Written by npm run conflicts:build from data/conflict-reviews.json.',built:new Date().toISOString().slice(0,10),people:{}};
    for(const m of members){
      const r=reviews.people?.[m.id];if(!r){console.log(`  ${m.name}: not reviewed yet`);continue;}
      const rec=buildRecord(m,r.orgs,r.reviewedAt||reviews.reviewedAt,nameOf[m.id]||m,(fs.existsSync(path.join(root,LOOKUPS))?read(LOOKUPS):{}).orgs||{});
      if(rec.missing){console.log(`  ${m.name}: no decision yet for ${rec.missing.join('; ')}`);continue;}
      out.people[m.id]=rec;
      const n=['income','positions','agreements','gifts','travel'].reduce((k,x)=>k+rec[x].filter(i=>i.interested).length,0);
      console.log(`  ${m.name}: ${n} interested of ${m.items.length}`);
    }
    fs.writeFileSync(path.join(root,OUT),JSON.stringify(out,null,1)+'\n');
    console.log(`${OUT}: ${Object.keys(out.people).length} members`);
  }
}
