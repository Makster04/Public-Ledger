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
// Nothing counts until it's reviewed: an item is interested only when data/conflict-reviews.json says so.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
export const LOOKUPS='data/conflict-lookups.json',REVIEWS='data/conflict-reviews.json',OUT='public/conflicts.json';

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

// The organization an item names, without the city and state the Senate pages add ("Chipotle Mexican Grill, Inc.
// Newport Beach, CA"), and, for an agreement, the parties before its terms.
export function orgOf(x){
  let n=String(x?.source||x?.org||x?.terms||'').split(' · ')[0].trim();
  n=n.replace(/^(Filer|Myself|Spouse)\s+and\s+(the\s+)?/i,'');
  n=n.replace(/\s+[A-Z][A-Za-z.' -]+,\s*(?:[A-Z]{2}|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)$/,'');
  return n.replace(/\s+/g,' ').trim();
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
// Lobbying: the LDA clients whose name matches, and their filings in the years asked: issue codes and spending.
export async function ldaLookup(name,years){
  const core=norm(name);if(!core)return null;
  const q=encodeURIComponent(name.replace(/,?\s+(Inc|LLC|LLP|Corp|Corporation|Co|Ltd)\.?$/i,''));
  const res=(await getJSON(`https://lda.gov/api/v1/clients/?client_name=${q}&page_size=25`)).results||[];
  const hits=res.filter(c=>{const n=norm(c.name);return n===core||n.startsWith(core+' ')||core.startsWith(n+' ');});
  if(!hits.length)return {match:null,candidates:res.slice(0,3).map(c=>c.name)};
  const issues=new Set(),filings=[];let spent=0;
  for(const c of hits.slice(0,5))for(const y of years){
    const f=(await getJSON(`https://lda.gov/api/v1/filings/?client_id=${c.client_id}&filing_year=${y}&page_size=25`)).results||[];
    for(const x of f){for(const a of x.lobbying_activities||[])if(a.general_issue_code)issues.add(a.general_issue_code);spent+=Number(x.income||x.expenses||0);
      filings.push({year:x.filing_year,period:x.filing_period,registrant:x.registrant?.name,url:x.filing_document_url});}
  }
  return {match:hits.map(c=>c.name),description:hits[0].general_description||null,issues:[...issues].sort(),filings:filings.length,spent:Math.round(spent),sample:filings.slice(0,3)};
}
// Federal contracts: awards to recipients by this name in the fiscal years asked, by awarding agency.
export async function contractsLookup(name,from,to){
  const body={filters:{recipient_search_text:[name.replace(/,?\s+(Inc|LLC|LLP|Corp|Corporation|Co|Ltd)\.?$/i,'')],award_type_codes:['A','B','C','D'],time_period:[{start_date:from,end_date:to}]},
    fields:['Award ID','Recipient Name','Award Amount','Awarding Agency'],limit:100,page:1,sort:'Award Amount',order:'desc'};
  const j=await getJSON('https://api.usaspending.gov/api/v2/search/spending_by_award/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const core=norm(name),by={};
  for(const r of j.results||[]){if(!norm(r['Recipient Name']).startsWith(core.split(' ').slice(0,2).join(' ')))continue;
    const a=r['Awarding Agency']||'?';by[a]=(by[a]||0)+Number(r['Award Amount']||0);}
  return Object.keys(by).length?{agencies:Object.fromEntries(Object.entries(by).map(([a,v])=>[a,Math.round(v)]))}:null;
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

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const mode=process.argv[2]||'lookup';
  const disclosures=read('data/disclosure-items.json'),committees=read('public/committees.json'),research=read('public/research.json');
  const nameOf=Object.fromEntries([...research.members,...research.cands,...(research.featured||[])].map(p=>[p.id,p]));
  const members=scope(disclosures,committees);
  if(mode==='lookup'){
    const cache=fs.existsSync(path.join(root,LOOKUPS))?read(LOOKUPS):{about:'',orgs:{}};
    cache.about='What lda.gov (lobbying filings, 2024–2025) and USAspending.gov (federal contracts, fiscal 2024–2025) show for each organization on sitting members\' disclosures. Written by npm run conflicts:lookup; read when the matches are reviewed (data/conflict-reviews.json).';
    for(const m of members)for(const it of m.items){
      const org=orgOf(it.x);if(!org||cache.orgs[org]||notAnInterest(org,nameOf[m.id]||m))continue;
      process.stdout.write(`  ${org} … `);
      try{cache.orgs[org]={lobbying:await ldaLookup(org,[2024,2025]),contracts:await contractsLookup(org,'2023-10-01','2025-09-30'),checked:new Date().toISOString().slice(0,10)};console.log('ok');}
      catch(e){console.log(e.message);}
    }
    fs.writeFileSync(path.join(root,LOOKUPS),JSON.stringify(cache,null,1)+'\n');
    for(const m of members){
      const issues=new Set(m.committees.flatMap(c=>COMMITTEE_ISSUES[c]||[]));
      console.log(`\n== ${m.name} (${m.committees.join(', ')}) handles: ${[...issues].join(' ')||'no issue codes'}`);
      for(const it of m.items){const org=orgOf(it.x),skip=notAnInterest(org,nameOf[m.id]||m),L=cache.orgs[org];
        const hit=L?.lobbying?.issues?.filter(c=>issues.has(c))||[];
        console.log(`  ${it.year} ${it.kind.padEnd(10)} ${org.slice(0,60).padEnd(60)} ${skip?`— ${skip}`:L?`lobbies: ${L.lobbying?.match?`${L.lobbying.issues.join(' ')||'(no issues)'}${hit.length?` ← ${hit.join(' ')}`:''}`:'not found'}; contracts: ${L.contracts?Object.keys(L.contracts.agencies).join('; '):'none'}`:'not looked up'}`);}
    }
  }
}
