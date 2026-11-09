// Sends the requests behind four failing refresh checks once, with a few variations, and prints each source's own reply,
// so a fix can follow the source's stated reason instead of a guess:
//   1. FEC enforcement records (HTTP 422)   2. Top donors by month (HTTP 422)
//   3. Groups behind outside spending (ProPublica 404)   4. Lobbying on key bills (LDA.gov, "did not filter")
// About 15 requests in all. Every key in .dev.vars is replaced by [key] in what is printed. Run it while the refresh is
// stopped, or an hour after other FEC scripts, so the FEC's hourly limit isn't the answer.
//   npm run check:sources            (or: npm run check:sources -- --person collins, or -- --only fec|propublica|lda|bargo)
// 5. Bargo (--only bargo): what it lists for the Senate, and senators searched as the refresh searches them.
import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {HOSTS} from '../src/sources.mjs';
import {billsInText,bargoKeeps,surname,firstName} from '../src/feeds.mjs';

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

// Bargo's replies, described: how many trades, anything else it sent, the fields of a trade, the dates covered, how the
// chamber is written, who is listed (with their state as written), and how many profiled senators the refresh would find.
export const bargoTrades=j=>Array.isArray(j?.trades)?j.trades:[];
const nameArgs=p=>({last:surname(p),first:firstName(p),state:p.state});
const tradeLine=t=>`member "${t.member}", state "${t.state}", chamber "${t.chamber??''}", traded ${t.transaction_date}, disclosed ${t.disclosure_date}, ${t.ticker||t.asset}`;
export function bargoLines(j,senators=[]){
  if(!j||typeof j!=='object')return ['  No JSON in the reply.'];
  const trades=bargoTrades(j),other=Object.entries(j).filter(([k])=>k!=='trades').map(([k,v])=>`${k}: ${v&&typeof v==='object'?JSON.stringify(v).slice(0,160):v}`);
  const out=[`  ${trades.length} trades${Array.isArray(j.trades)?'':' (no "trades" list in the reply)'}${other.length?`; also in the reply: ${other.join(', ')}`:''}`];
  if(!trades.length)return out;
  const span=k=>{const d=trades.map(t=>String(t[k]||'').slice(0,10)).filter(Boolean).sort();return d.length?`${d[0]} to ${d.at(-1)}`:'none given';};
  const tally=f=>{const m=new Map();for(const t of trades){const k=f(t);m.set(k,(m.get(k)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]);};
  const who=tally(t=>`${t.member} (${t.state??'no state'})`);
  out.push(`  fields of a trade: ${Object.keys(trades[0]).join(', ')}`,`  traded ${span('transaction_date')}; disclosed ${span('disclosure_date')}`,
    `  chamber written as: ${tally(t=>JSON.stringify(t.chamber??null)).map(([k,n])=>`${k} ×${n}`).join(', ')}`,
    `  ${who.length} members: ${who.slice(0,15).map(([k,n])=>`${k} ×${n}`).join('; ')}${who.length>15?' …':''}`);
  if(senators.length){const m=senators.filter(p=>trades.some(t=>bargoKeeps(t,nameArgs(p))));
    out.push(`  profiled senators the refresh's name and state check finds here: ${m.length}${m.length?` (${m.slice(0,10).map(p=>p.name).join(', ')}${m.length>10?' …':''})`:''}`);}
  return out;
}

const argPerson=process.argv.includes('--person')?process.argv[process.argv.indexOf('--person')+1]:null;
const jobs=localJobs(),failed=(kind,pattern)=>jobs.find(j=>j.kind===kind&&(!pattern||pattern.test(j.error||'')));
const person=id=>config.people.find(p=>p.id===id);
const pick=(kind,pattern)=>person(argPerson)||person(failed(kind,pattern)?.subject)||config.people.find(p=>p.fecCand&&p.fecCmte);

const only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1]:null,part=n=>!only||only===n;
async function main(){
  console.log(`Source check, ${new Date().toISOString().slice(0,16)}Z. ${jobs.length?'Using the failed checks saved by npm start.':'No local refresh database found; using a sample person.'}`);
  if(part('fec')&&!env.FEC_API_KEY)console.log('FEC_API_KEY is not set in .dev.vars, so the FEC answers will be about the missing key.');

  if(part('fec')){
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

  }
  if(part('propublica')){
  // 3. ProPublica's nonprofit search: a super PAC (not a nonprofit), a nonprofit, and a group from the failed checks.
  console.log('\n=== 3. Groups behind outside spending (ProPublica Nonprofit Explorer)');
  await ask('A super PAC, which is not a nonprofit: "Senate Leadership Fund"',`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent('"Senate Leadership Fund"')}`);
  await ask('A nonprofit: "Sierra Club"',`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent('"Sierra Club"')}`);
  const j3=failed('outside-groups',/404/),g3=j3?JSON.parse(j3.args).groups?.[0]:null;
  if(g3)await ask(`A group from a failed check: "${g3}"`,`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(`"${g3}"`)}`);

  }
  if(part('lda')){
  // 4. LDA.gov: two bills the refresh couldn't count, each searched a few ways; for each way, how many reports matched and
  // how many of the first 25 actually name the bill (what the refresh needs, at least half).
  const ABBR={hr:'H.R.',s:'S.',hjres:'H.J.Res.',sjres:'S.J.Res.'};
  const research=JSON.parse(fs.readFileSync(new URL('public/research.json',root),'utf8'));
  const titleOf=k=>(research.billIndex.find(b=>b.id===k||(b.versions||[]).includes(k))||research.bills.find(b=>b.id===k))?.title?.replace(/\s*\(.*\)\s*$/,'')||null;
  const failedBills=jobs.filter(j=>j.kind==='bill-lobbying'&&/did not filter/.test(j.error||'')).map(j=>j.subject);
  const bills=[...new Set([...failedBills.filter(titleOf).slice(0,1),...failedBills.filter(k=>!titleOf(k)).slice(0,1),...(failedBills.length?[]:['115-hr-1'])])];
  for(const bill of bills){
    const [congress,type,number]=bill.split('-'),year=1787+2*Number(congress),label=`${ABBR[type]} ${number}`,title=titleOf(bill);
    console.log(`\n=== 4. Lobbying on key bills: ${label} (${congress}th Congress)${title?`, "${title}"`:''}, ${year}`);
    const ways=[[`As the refresh asks: ${label}`,label],[`In quotes: "${label}"`,`"${label}"`],[`No space, in quotes: "${label.replace(' ','')}"`,`"${label.replace(' ','')}"`],...(title?[[`The bill's name in quotes: "${title}"`,`"${title}"`]]:[])];
    for(const [how,q] of ways){
      const r=await ask(how,`https://lda.gov/api/v1/filings/?filing_specific_lobbying_issues=${encodeURIComponent(q)}&filing_year=${year}&page_size=25&page=1`);
      const results=Array.isArray(r.json?.results)?r.json.results:[];
      const named=results.filter(f=>(f.lobbying_activities||[]).some(x=>billsInText(String(x.description||''),Number(congress)).includes(bill))).length;
      console.log(`  ${r.json?.count??'?'} reports matched; ${named} of the first ${results.length} name ${label}.`);
      const miss=results.find(f=>!(f.lobbying_activities||[]).some(x=>billsInText(String(x.description||''),Number(congress)).includes(bill)));
      const text=miss&&(miss.lobbying_activities||[]).map(x=>String(x.description||'')).find(t=>new RegExp(number+'\\b').test(t));
      if(text)console.log(`  e.g. not counted: ${redact(text.replace(/\s+/g,' ')).slice(0,160)}`);
    }
  }

  }
  if(part('bargo')){
  // 5. Bargo for senators' trades. First what it has for the Senate with no name given (who, written how, and the dates
  // it covers) and with no chamber either; then senators searched by last name as the refresh does (src/feeds.mjs
  // trades-bargo): one it listed, if any, so a search that comes back empty is the search's doing, then Marshall, Sullivan
  // and Collins. A search that finds nothing is tried again by full name and without the chamber. At most 14 requests
  // (its free plan allows 100 a day).
  const B='https://www.bargo.ai/free-apis/congress/v1/trades',senators=config.people.filter(p=>p.chamber==='S'&&p.inOffice);
  console.log('\n=== 5a. Bargo: the Senate trades it has, no name given');
  const all=await ask('Senate trades, no member',`${B}?chamber=senate&limit=250&page=0`);
  for(const l of bargoLines(all.json,senators))console.log(l);
  console.log('\n=== 5b. Bargo: trades from either chamber, no name given');
  const any=await ask('Trades, no chamber or member',`${B}?limit=100&page=0`);
  for(const l of bargoLines(any.json,senators))console.log(l);
  const listed=senators.find(p=>bargoTrades(all.json).some(t=>bargoKeeps(t,nameArgs(p))));
  for(const p of [...new Set([listed,...['marshall','sullivan','collins'].map(person)])].filter(Boolean)){
    const a=nameArgs(p);
    console.log(`\n=== 5c. Bargo trades for ${p.name} (${p.state})${p===listed?', one it listed in 5a':''}`);
    const r=await ask(`Search for "${a.last}" in the Senate, as the refresh does`,`${B}?member=${encodeURIComponent(a.last)}&chamber=senate&limit=250&page=0`);
    const trades=bargoTrades(r.json),kept=trades.filter(t=>bargoKeeps(t,a));
    console.log(`  ${trades.length} trades returned; ${kept.length} kept by the name and state check.`);
    for(const t of trades.slice(0,3))console.log(`  - ${tradeLine(t)}`);
    if(trades.length&&!kept.length)console.log('  (None kept: the name or state above is written differently from what the refresh expects.)');
    if(trades.length)continue;
    const full=`${a.first} ${a.last}`,r2=await ask(`Search for "${full}" in the Senate`,`${B}?member=${encodeURIComponent(full)}&chamber=senate&limit=250&page=0`);
    console.log(`  ${bargoTrades(r2.json).length} trades returned.`);
    const r3=await ask(`Search for "${a.last}" in either chamber`,`${B}?member=${encodeURIComponent(a.last)}&limit=250&page=0`),t3=bargoTrades(r3.json);
    console.log(`  ${t3.length} trades returned${t3.length?`: ${[...new Set(t3.map(t=>`${t.member} (${t.chamber??'no chamber'}, ${t.state??'no state'})`))].slice(0,5).join('; ')}`:''}.`);
  }
  }
  console.log('\nDone. Copy everything above and send it; no keys are in it.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
