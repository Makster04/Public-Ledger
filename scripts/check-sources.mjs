// Sends the requests behind four failing refresh checks once, with a few variations, and prints each source's own reply,
// so a fix can follow the source's stated reason instead of a guess:
//   1. FEC enforcement records (HTTP 422)   2. Top donors by month (HTTP 422)
//   3. Groups behind outside spending (ProPublica 404)   4. Lobbying on key bills (LDA.gov, "did not filter")
// About 15 requests in all. Every key in .dev.vars is replaced by [key] in what is printed. Run it while the refresh is
// stopped, or an hour after other FEC scripts, so the FEC's hourly limit isn't the answer.
//   npm run check:sources            (or: npm run check:sources -- --person collins)
import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {HOSTS} from '../src/sources.mjs';
import {billsInText} from '../src/feeds.mjs';

const env=process.env,root=new URL('../',import.meta.url);
const config=JSON.parse(fs.readFileSync(new URL('data/config.json',root),'utf8'));
const SECRETS=[...new Set(Object.values(HOSTS).flatMap(h=>[...(h.keys||[]),...(h.agent?[h.agent]:[])]).map(k=>env[k]).filter(v=>v&&v.length>=6))];
export function redact(text,secrets=SECRETS){
  let s=String(text);for(const k of secrets)s=s.split(k).join('[key]');
  return s.replace(/\b(api_key|apikey|key|token)=[^&\s"']+/gi,'$1=[key]');
}

// Jobs on file in the local refresh database (npm start), to repeat exactly what failed there.
function localJobs(){
  const file=new URL('.local/records.sqlite',root);if(!fs.existsSync(file))return [];
  const {DatabaseSync}=globalThis.process.getBuiltinModule('node:sqlite'),db=new DatabaseSync(fileURLToPath(file),{readOnly:true});
  try{return db.prepare("SELECT id,kind,subject,args,error FROM jobs WHERE kind IN ('fec-legal','donor-months','outside-groups','bill-lobbying')").all();}finally{db.close();}
}

async function ask(label,url,{as='json'}={}){
  const u=new URL(url),h=HOSTS[u.hostname],headers={Accept:'application/json'};
  const key=h?.keys?.map(k=>env[k]).find(Boolean);
  if(key){if(h.query)u.searchParams.set(h.query,key);else headers[h.header]=(h.prefix||'')+key;}
  if(h?.ua)headers['User-Agent']=h.ua;
  const shown=redact(decodeURIComponent(u.pathname+u.search));
  try{
    const r=await fetch(u,{headers,signal:AbortSignal.timeout(30000)}),text=await r.text();
    let json=null;if(as==='json')try{json=JSON.parse(text);}catch{}
    console.log(`\n• ${label}\n  ${shown}\n  → HTTP ${r.status}${r.ok?'':`: ${redact(text.replace(/\s+/g,' ')).slice(0,700)}`}`);
    return {status:r.status,json};
  }catch(e){console.log(`\n• ${label}\n  ${shown}\n  → no reply (${e.name}${e.cause?.code?` ${e.cause.code}`:''})`);return {status:0,json:null};}
}

const argPerson=process.argv.includes('--person')?process.argv[process.argv.indexOf('--person')+1]:null;
const jobs=localJobs(),failed=(kind,pattern)=>jobs.find(j=>j.kind===kind&&(!pattern||pattern.test(j.error||'')));
const person=id=>config.people.find(p=>p.id===id);
const pick=(kind,pattern)=>person(argPerson)||person(failed(kind,pattern)?.subject)||config.people.find(p=>p.fecCand&&p.fecCmte);

async function main(){
  console.log(`Source check, ${new Date().toISOString().slice(0,16)}Z. ${jobs.length?'Using the failed checks saved by npm start.':'No local refresh database found; using a sample person.'}`);
  if(!env.FEC_API_KEY)console.log('FEC_API_KEY is not set in .dev.vars, so the FEC answers will be about the missing key.');

  // 1. FEC enforcement records: the refresh's request, then the same search with each setting changed.
  const p1=pick('fec-legal',/422/),q=encodeURIComponent(`"${p1.name}"`);
  console.log(`\n=== 1. FEC enforcement records, for ${p1.name}`);
  await ask('As the refresh asks (type=all, 50 results)',`https://api.open.fec.gov/v1/legal/search/?q=${q}&type=all&hits_returned=50`);
  await ask('Without type',`https://api.open.fec.gov/v1/legal/search/?q=${q}&hits_returned=50`);
  await ask('type=murs',`https://api.open.fec.gov/v1/legal/search/?q=${q}&type=murs&hits_returned=50`);
  await ask('type=all, 20 results',`https://api.open.fec.gov/v1/legal/search/?q=${q}&type=all&hits_returned=20`);
  await ask('Name without quotes, no type',`https://api.open.fec.gov/v1/legal/search/?q=${encodeURIComponent(p1.name)}&hits_returned=20`);

  // 2. Top donors by month: the refresh's employer list for that person, then fewer names and an older cycle.
  const j2=failed('donor-months',/422/),p2=person(argPerson)||person(j2?.subject)||p1,a2=j2?JSON.parse(j2.args):{committee:p2.fecCmte,cycle:config.cycle,orgs:[]};
  const orgs=a2.orgs?.length?a2.orgs:['Google','Microsoft','Amazon'];
  console.log(`\n=== 2. Top donors by month, for ${p2.name} (${orgs.length} employer names${a2.orgs?.length?' from the refresh':', a sample list'})`);
  const donors=(cycle,names)=>{const u=new URL('https://api.open.fec.gov/v1/schedules/schedule_a/');
    for(const[k,v]of Object.entries({committee_id:a2.committee||p2.fecCmte,two_year_transaction_period:cycle,is_individual:'true',per_page:100,sort:'-contribution_receipt_date'}))u.searchParams.set(k,v);
    for(const o of names)u.searchParams.append('contributor_employer',o);return u.href;};
  const first=await ask(`As the refresh asks: cycle ${a2.cycle||config.cycle}, all ${orgs.length} names`,donors(a2.cycle||config.cycle,orgs));
  if(orgs.length>10)await ask('The first 10 names',donors(a2.cycle||config.cycle,orgs.slice(0,10)));
  await ask('One name',donors(a2.cycle||config.cycle,orgs.slice(0,1)));
  await ask('Cycle 2016, all names',donors(2016,orgs));
  const last=first.json?.pagination?.last_indexes;
  if(last&&first.json.results?.length){const u=new URL(donors(a2.cycle||config.cycle,orgs));for(const[k,v]of Object.entries(last))if(v!=null)u.searchParams.set(k,String(v));await ask('Page 2, as the refresh asks for it',u.href);}

  // 3. ProPublica's nonprofit search: a super PAC (not a nonprofit), a nonprofit, and a group from the failed checks.
  console.log('\n=== 3. Groups behind outside spending (ProPublica Nonprofit Explorer)');
  await ask('A super PAC, which is not a nonprofit: "Senate Leadership Fund"',`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent('"Senate Leadership Fund"')}`);
  await ask('A nonprofit: "Sierra Club"',`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent('"Sierra Club"')}`);
  const j3=failed('outside-groups',/404/),g3=j3?JSON.parse(j3.args).groups?.[0]:null;
  if(g3)await ask(`A group from a failed check: "${g3}"`,`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(`"${g3}"`)}`);

  // 4. LDA.gov: one bill the refresh couldn't count, with a few of the reports it returned.
  const ABBR={hr:'H.R.',s:'S.',hjres:'H.J.Res.',sjres:'S.J.Res.'};
  const j4=failed('bill-lobbying',/did not filter/),bill=j4?.subject||(config.keyBills||[]).find(k=>/-hr-1$/.test(k))||(config.keyBills||[])[0];
  if(bill){const [congress,type,number]=bill.split('-'),year=1787+2*Number(congress),label=`${ABBR[type]} ${number}`;
    console.log(`\n=== 4. Lobbying on key bills: ${label} (${congress}th Congress), ${year}`);
    const r=await ask(`Search reports for "${label}"`,`https://lda.gov/api/v1/filings/?filing_specific_lobbying_issues=${encodeURIComponent(label)}&filing_year=${year}&page_size=25&page=1`);
    const results=Array.isArray(r.json?.results)?r.json.results:[];
    console.log(`  ${r.json?.count??'?'} reports matched; the first ${Math.min(6,results.length)}:`);
    for(const f of results.slice(0,6)){
      const texts=(f.lobbying_activities||[]).map(x=>String(x.description||'')),named=texts.some(t=>billsInText(t,Number(congress)).includes(bill));
      const hit=texts.map(t=>{const i=t.search(new RegExp(ABBR[type].replace(/\./g,'\\.?\\s*')+'\\s*'+number+'\\b','i'));return i<0?null:t.slice(Math.max(0,i-40),i+60);}).find(Boolean);
      console.log(`  - ${named?'names the bill':'not recognized as naming it'}: ${redact((hit||texts[0]||'(no issue text)').replace(/\s+/g,' ')).slice(0,140)}`);
    }}

  console.log('\nDone. Copy everything above and send it; no keys are in it.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
