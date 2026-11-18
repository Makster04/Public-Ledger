// Who lobbied on each scored People First bill (LDA.gov lobbying reports), for Lobbied Bills inside Corporation
// Compromised (public/lobbied.js): public/lobbied-bills.json.
//
// For each scored bill and each of its versions, every report filed in the two years of its Congress that names the bill
// (LDA.gov's issue search, with the number in quotes and written both ways, "H.R. 1" and "H.R.1"; a report counts only
// when its lobbying description names the bill). Then the members a coalition lists on its registration, for each client
// called a coalition or an alliance, since a company often lobbies through one. The file keeps only the clients and
// members whose names match one of a profile's top business donors, so it stays small; which profile they match is
// worked out on the page.
//
// The big bills run to thousands of reports (the Inflation Reduction Act about 15,000), read 25 at a time, so the first
// run takes a while: about two hours without a key, under 20 minutes with LDA_API_KEY in .dev.vars. What's read is saved
// in data/lobbying-bill-clients.json; a later run reads only this year's reports again, and anything a stopped run
// didn't finish.
//   npm run lobbying:bills               (--fresh reads everything again)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {requestSource} from '../src/sources.mjs';
import {billsInText} from '../src/feeds.mjs';
import {billScore} from '../public/grades.js';
import {makeScorer,gradedPeople} from '../public/scoring.js';
import {sameOrg} from '../public/lobbied.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CACHE=path.join(ROOT,'data','lobbying-bill-clients.json');
const ABBR={hr:'H.R.',s:'S.',hjres:'H.J.Res.',sjres:'S.J.Res.'};
export const COALITION=/\b(coalition|alliance)\b/i;
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// The searches for each scored bill: [{credit (the bill on file), key (this version), congress, year, form, text}].
export function searches(bills,thisYear){
  const out=[];
  for(const b of bills)for(const key of [b.id,...(b.versions||[])]){
    const [congress,type,num]=String(key).split('-');if(!ABBR[type])continue;
    const first=1787+2*Number(congress);
    for(const year of [first,first+1])if(year<=thisYear)[`${ABBR[type]} ${num}`,`${ABBR[type]}${num}`].forEach((spelling,form)=>out.push({credit:b.id,key,congress:Number(congress),year,form,text:`"${spelling}"`}));
  }
  return out;
}
export const searchId=s=>`${s.key}|${s.year}|${s.form}`;
// One page of reports: the clients of those that name the bill. LDA.gov ignores the search when it can't use it, so a page
// where most reports don't name the bill stops the search rather than count clients that didn't lobby on it.
export function pageClients(results,s){
  const rows=(results||[]).filter(f=>f?.filing_uuid).map(f=>({id:f.filing_uuid,client:f.client?.name||null,clientId:f.client?.id??null,
    named:(f.lobbying_activities||[]).some(a=>billsInText(a?.description,s.congress).includes(s.key))}));
  if(rows.length>=10&&rows.filter(r=>r.named).length<rows.length/2)throw new Error(`LDA.gov did not filter reports by ${s.text} in ${s.year}`);
  return rows.filter(r=>r.named&&r.client);
}

// The donors' names on file for every profile, and the entries for one bill: each client that matches one, and each
// coalition member that does ([name, coalition]).
// clients: {name: one of its LDA.gov client IDs} (each firm that files for a client gives it its own ID).
export function billEntries(clients,coalitions,donors){
  const out=new Map(),hit=name=>donors.some(d=>sameOrg(d,name));
  for(const [name,id] of Object.entries(clients)){
    if(hit(name))out.set(name.toLowerCase(),[name,null]);
    const c=coalitions[id];
    if(c&&COALITION.test(name))for(const m of c.members||[])if(hit(m)&&!out.has(m.toLowerCase()))out.set(m.toLowerCase(),[m,name]);
  }
  return [...out.values()].sort((a,b)=>a[0].localeCompare(b[0]));
}

async function lda(url,env,pace){
  for(let tries=0;;tries++){
    const start=Date.now();
    try{const d=await requestSource(url,env,{allow404:true});await wait(pace-(Date.now()-start));return d;}
    catch(e){const busy=e.statusCode===429;if(!busy&&!/HTTP 5\d\d|timeout|timed out|aborted|fetch failed/i.test(e.message)||tries>=12)throw e;
      if(tries===0||tries%4===3)console.log(`  LDA.gov: ${busy?'too many requests':e.message}; waiting`);await wait(Math.max(e.retryAfter||0,busy?60_000:15_000));}
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  // Requests start this far apart: about 14 a minute without a key (LDA.gov allows 15), about 100 with one (it allows 120).
  const env=process.env,fresh=process.argv.includes('--fresh'),pace=env.LDA_API_KEY?600:4200;
  const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
  const research=read('public/research.json'),senate=read('public/senate.json'),house=read('public/house.json');
  const bills=(research.bills||[]).map(b=>Object.assign({},b,billScore(b))).filter(b=>b.status==='scored');
  const thisYear=new Date().getFullYear(),today=new Date().toISOString().slice(0,10);
  const cache=!fresh&&fs.existsSync(CACHE)?JSON.parse(fs.readFileSync(CACHE,'utf8')):{searches:{},coalitions:{}};
  // (a file saved by IDs, before clients were kept by name)
  for(const x of Object.values(cache.searches)){const c=x.clients||{};if(Object.keys(c).length&&Object.keys(c).every(k=>/^\d+$/.test(k)))x.clients=Object.fromEntries(Object.entries(c).map(([id,n])=>[n,id]).reverse());}
  const save=()=>fs.writeFileSync(CACHE,JSON.stringify(cache,null,0)+'\n');
  // --only=119-hr-1 reads just that bill (its versions too), to try a run.
  const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
  const list=searches(bills,thisYear).filter(s=>!only||s.credit===only||s.key===only),failed=[];
  console.log(`${bills.length} scored bills, ${list.length} searches${env.LDA_API_KEY?'':' (no LDA_API_KEY in .dev.vars, so about 14 requests a minute)'}.`);
  for(const s of list){
    const id=searchId(s),had=cache.searches[id];
    if(had?.done&&s.year<thisYear)continue;
    // A search a stopped run left part-way picks up at its next page; this year's starts over, since reports keep coming.
    const keep=had&&!had.done&&had.page?had:null;
    const got={done:false,page:keep?.page||0,reports:keep?.reports||0,clients:{...(keep?.clients||{})},at:today};
    let total=null;
    try{
      for(;;){
        const u=new URL('https://lda.gov/api/v1/filings/');
        for(const [k,v] of Object.entries({filing_specific_lobbying_issues:s.text,filing_year:s.year,page_size:25,page:got.page+1}))u.searchParams.set(k,v);
        const d=await lda(u.href,env,pace);
        if(!d)break;
        total=Number(d.count)||0;
        for(const r of pageClients(d.results,s)){got.reports++;got.clients[r.client]??=r.clientId==null?null:String(r.clientId);}
        got.page++;
        if(got.page%20===0){cache.searches[id]=got;save();console.log(`  ${s.key} ${s.year} ${s.text}: page ${got.page} of ${Math.ceil(total/25)}`);}
        if(!d.next)break;
      }
      got.done=true;cache.searches[id]=got;save();
      console.log(`${s.key} ${s.year} ${s.text}: ${got.reports} of ${total??0} reports name it, ${Object.keys(got.clients).length} clients`);
    }catch(e){failed.push(`${s.key} ${s.year} ${s.text}`);cache.searches[id]=got;save();console.log(`${s.key} ${s.year} ${s.text}: stopped (${e.message})`);}
  }
  // Coalitions' members, from the newest registration of each coalition client (read once; --fresh reads them again).
  const coalitionIds=new Set(Object.values(cache.searches).flatMap(x=>Object.entries(x.clients||{}).filter(([n])=>COALITION.test(n)).map(([,id])=>id)).filter(id=>/^\d+$/.test(id||'')));
  let newCoalitions=0;
  for(const id of coalitionIds){
    if(cache.coalitions[id])continue;
    try{
      const d=await lda(`https://lda.gov/api/v1/filings/?client_id=${encodeURIComponent(id)}&filing_type=RR&page_size=5`,env,pace);
      const f=(d?.results||[]).find(x=>(x.affiliated_organizations||[]).length)||(d?.results||[])[0];
      cache.coalitions[id]={client:f?.client?.name||null,members:[...new Set((f?.affiliated_organizations||[]).map(o=>o?.name).filter(Boolean))],at:today};
      newCoalitions++;if(newCoalitions%25===0){save();console.log(`  coalitions read: ${newCoalitions}`);}
    }catch(e){console.log(`Coalition ${id}: not read (${e.message})`);}
  }
  save();
  // Keep only the names that match a profile's top business donor.
  const scorer=makeScorer(research),people=gradedPeople(research,{senate:senate.senators||[],house:house.members||[]});
  const donors=[...new Map(people.flatMap(p=>scorer.businessDonors(p)).map(d=>[d.words.join(' '),d.words])).values()];
  const out={about:'Who lobbied on each scored People First bill (LDA.gov reports, and coalitions\' listed members), kept when the name matches a profile\'s top business donor. See scripts/build-lobbied-bills.mjs and public/lobbied.js.',
    built:today,bills:{}};
  for(const b of bills){
    const mine=searches([b],thisYear),clients={};
    for(const s of mine)Object.assign(clients,cache.searches[searchId(s)]?.clients||{});
    const complete=mine.every(s=>cache.searches[searchId(s)]?.done);
    out.bills[b.id]={reports:mine.reduce((t,s)=>t+(cache.searches[searchId(s)]?.reports||0),0),clientsRead:Object.keys(clients).length,complete,clients:billEntries(clients,cache.coalitions,donors)};
  }
  fs.writeFileSync(path.join(ROOT,'public','lobbied-bills.json'),JSON.stringify(out,null,1)+'\n');
  const n=Object.values(out.bills);
  console.log(`Wrote public/lobbied-bills.json: ${n.length} bills, ${n.reduce((t,b)=>t+b.clients.length,0)} donor matches from ${n.reduce((t,b)=>t+b.clientsRead,0)} clients, ${coalitionIds.size} coalitions${failed.length?`; not finished: ${failed.join(', ')} (run it again to pick up)`:''}.`);
}
