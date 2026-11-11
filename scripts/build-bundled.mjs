// Bundled ("earmarked") donations: individual donors' gifts that a group collected and forwarded to a campaign through
// its PAC, for each funder group that does this (research.json groupPos[].conduits: AIPAC, Club for Growth, EMILY's
// List, J Street and the Senate Conservatives Fund). They are the donors' own money, which the FEC counts as individual
// contributions, so they aren't in the PAC contributions on file; the group decided where they went.
//
// From the FEC (FEC_API_KEY in .dev.vars): each conduit's disbursements to each profiled person's campaign committee
// (Schedule B, by recipient committee) in the cycles their PAC reports cover. A row that says "earmark" is a forwarded
// gift; the rest are the PAC's own checks, already in the PAC rows. Conduits report forwarded gifts either as one line
// for the total with each gift listed below it as a memo entry, or as memo entries only: the total line is used when
// there is one, so nothing counts twice. ActBlue and WinRed, which forward gifts for any campaign that uses them, are not
// conduits here.
//
// Every other committee forwarding earmarked gifts is found too: the FEC's totals by recipient list every committee that
// sent the campaign money in a cycle, and any that sent more than a PAC may give directly, or many checks, has its
// disbursements read the same way (maybeConduits). Each cycle from historyFrom on is kept (byCycle), for the Big Money Independence
// tab's earlier periods; "routed" stays the current cycle's.
//
// Writes research.json "bundled": {asOf, conduits: {group: [committee ID]}, names: {"fec:C…": name}, listed: {person: true
// when searched completely: no read failed and no limit in LIMITS cut a search short}, discovered (everyone was), cycles,
// people: {person: {group or "fec:C…": {routed, n, direct, byMonth, cycles, byCycle: {cycle: {routed, n}}, src, partial?}}}};
// "partial": a total a limit cut short with no earlier total saved, so it's a lower bound. A search a limit cut short
// keeps the earlier saved total when there is one, as a failed read does.
// scripts/build-funders.mjs adds "routed" to each person's funders from it. Rerun build-funders after.
//   npm run funders:bundled                     look up and rewrite public/research.json
//   npm run funders:bundled -- --check          list what it found, without writing
//   npm run funders:bundled -- --only ossoff    just these people (the others keep what's saved)
//   npm run funders:bundled -- --only perry --max-found 20   read more of the other possible conduits on each cycle's
//                                               list than the usual 10 (for a person a run says that limit cut short)
//   npm run funders:bundled -- --mark-complete-except a,b   one time, for a file saved before "listed" was kept
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {requestSource,fecNext} from '../src/sources.mjs';
import {cyclesOf} from './build-pac-types.mjs';

const EARMARK=/earmark/i;
const isMemo=r=>r.memo_code==='X'||r.memoed_subtotal===true||r.memoed_subtotal==='true';
const cents=n=>Math.round(n*100)/100;
// One conduit's disbursements to one campaign: the forwarded (earmarked) total, how many gifts, the PAC's own checks, and
// the forwarded total by month (YYYY-MM, from the disbursement date), which the money-pledge checks date against a pledge.
export function conduitTotals(rows){
  let lines=0,memos=0,nLines=0,nMemos=0,direct=0;const lineMonths={},memoMonths={};
  const add=(by,r,amt)=>{const m=String(r.disbursement_date||'').slice(0,7);if(/^\d{4}-\d{2}$/.test(m))by[m]=cents((by[m]||0)+amt);};
  for(const r of rows||[]){
    const amt=Number(r.disbursement_amount)||0,earmark=EARMARK.test(`${r.disbursement_description||''} ${r.memo_text||''}`);
    if(earmark){if(isMemo(r)){memos+=amt;nMemos++;add(memoMonths,r,amt);}else{lines+=amt;nLines++;add(lineMonths,r,amt);}}
    else if(!isMemo(r))direct+=amt;
  }
  const byMonth=nLines?lineMonths:memoMonths;
  return {routed:cents(nLines?lines:memos),n:nMemos||nLines,direct:cents(direct),byMonth:Object.fromEntries(Object.entries(byMonth).sort())};
}
export const conduitURL=(conduit,cmte,cycle)=>`https://api.open.fec.gov/v1/schedules/schedule_b/?committee_id=${conduit}&recipient_committee_id=${cmte}&two_year_transaction_period=${cycle}&per_page=100&sort=-disbursement_date`;
export const conduitLink=(conduit,cmte,cycle)=>`https://www.fec.gov/data/disbursements/?data_type=processed&committee_id=${conduit}&recipient_committee_id=${cmte}&two_year_transaction_period=${cycle}`;
// The committees that sent money to a campaign in a cycle, from the FEC's totals by recipient (Schedule B aggregated by
// recipient committee). One that might be forwarding earmarked gifts: more than the most a PAC can give directly in a
// cycle ($10,000: $5,000 each for the primary and the general), more than a few checks, or gifts listed as memo
// entries. ActBlue, WinRed and other platforms that forward gifts for any campaign, and the groups read already, are
// left out.
export const PLATFORM=/\b(act\s*blue|win\s*red|anedot|democracy\s*engine|revv|fundrise|nationbuilder)\b/i;
export const givers=results=>(results||[]).map(r=>({committee:r.committee_id,name:String(r.committee_name||r.committee?.name||'').trim(),total:Number(r.total)||0,count:Number(r.count)||0,memoTotal:Number(r.memo_total)||0,memoCount:Number(r.memo_count)||0}))
  .filter(r=>/^C\d{8}$/.test(r.committee||''));
export function maybeConduits(list,skip=new Set()){
  return (list||[]).filter(r=>!skip.has(r.committee)&&!PLATFORM.test(r.name)&&(r.total>10000||r.count>6||r.memoTotal>0||r.memoCount>0))
    .sort((a,b)=>b.total+b.memoTotal-(a.total+a.memoTotal));
}
export const recipientURL=(cmte,cycle)=>`https://api.open.fec.gov/v1/schedules/schedule_b/by_recipient_id/?recipient_id=${cmte}&cycle=${cycle}&per_page=100&sort=-total`;
const people=data=>[...(data.members||[]),...(data.cands||[]),...(data.featured||[])];
const dollars=n=>`$${Math.round(n).toLocaleString('en-US')}`;

// How far each search goes: pages of each cycle's list of who gave (100 committees a page), pages of one committee's
// payments to the campaign in a cycle (100 a page), and how many other possible conduits are read from each list.
export const LIMITS={recipients:5,conduit:200,found:10};
// Every page of an FEC list, up to max pages: {rows, capped}. capped: the FEC had more after the last page read. A
// cursor list (Schedule B) can only show it has ended with an empty page, so after max pages one more is asked for, and
// it is capped only if that page has rows.
export async function readPages(get,url,max){
  const rows=[];let page=0;
  for(;url&&page<max;page++){const d=await get(url);rows.push(...(d.results||[]));url=fecNext(url,d);}
  if(!url)return {rows,capped:false};
  const more=await get(url);if(!(more.results||[]).length)return {rows,capped:false};
  return {rows:rows.concat(more.results),capped:true};
}
// The committees to read beyond the groups listed by hand: from each cycle's list of who gave, those that might be
// forwarding gifts (maybeConduits), the largest `limit` of each list. skipped: the others, left unread.
export function conduitsToRead(gave,known,limit=LIMITS.found){
  const found=new Map(),skipped=new Map();
  for(const list of Object.values(gave)){const m=maybeConduits(list,known);
    for(const c of m.slice(0,limit))if(!found.has(c.committee))found.set(c.committee,c.name);
    for(const c of m.slice(limit))skipped.set(c.committee,c.name);}
  for(const k of found.keys())skipped.delete(k);
  return {found,skipped};
}
// One person's search: each cycle's list of who gave to their campaign, each group's forwarded gifts, then every other
// committee that might be forwarding them. Returns {entries (group or "fec:C…" → totals), failed, capped (what a limit cut
// short), listed (cycle lists read), complete}. complete only when nothing failed and no limit cut anything short. A
// read that failed or was cut short keeps the earlier saved total (prev); with none saved, a cut-short total is kept
// marked partial (a lower bound). names gets the name of each committee found.
export async function searchPerson(p,{get,groups,known,allCycles,current,prev={},names={},limits=LIMITS}){
  const entries={},failed=[],capped=[];let listed=0;
  const cycles=cyclesOf(p).length?cyclesOf(p):[current];
  // First, who sent the campaign money in each cycle (null when that list couldn't be read).
  const gave={};
  for(const cycle of allCycles){
    try{const r=await readPages(get,recipientURL(p.fecCmte,cycle),limits.recipients);gave[cycle]=givers(r.rows);listed++;
      if(r.capped)capped.push(`the committees that gave in ${cycle}: more than ${limits.recipients*100}, the rest not read`);}
    catch(e){gave[cycle]=null;failed.push(`the committees that gave in ${cycle}: ${e.message}`);}
  }
  // A committee's payments to the campaign are read for a cycle it gave in (every cycle when that list is missing; the
  // groups always in the current cycle, as before).
  const read=async(conduits,always)=>{
    const byCycle={},rows=[];let cut=false;
    for(const cycle of allCycles){
      const list=gave[cycle],there=!list||conduits.some(c=>list.some(g=>g.committee===c));
      if(!there&&!(always&&cycles.includes(cycle)))continue;
      const got=[];
      for(const conduit of conduits){const r=await readPages(get,conduitURL(conduit,p.fecCmte,cycle),limits.conduit);if(r.capped)cut=true;
        got.push(...r.rows.filter(x=>x.recipient_committee_id==null||x.recipient_committee_id===p.fecCmte));}
      const t=conduitTotals(got);if(t.routed>0)byCycle[cycle]={routed:t.routed,n:t.n};
      if(cycles.includes(cycle))rows.push(...got);
    }
    const t=conduitTotals(rows);
    return {result:Object.keys(byCycle).length?{...t,cycles,byCycle,src:conduitLink(conduits[0],p.fecCmte,cycles.at(-1))}:null,cut};
  };
  const save=(key,label,{result,cut})=>{
    if(!cut){if(result)entries[key]=result;return;}
    const was=prev[key];
    capped.push(`${label}: more than ${limits.conduit*100} payments in a cycle, the rest not read${was?` (kept the earlier ${dollars(was.routed)})`:result?' (saved as a partial total)':''}`);
    if(was)entries[key]=was;else if(result)entries[key]={...result,partial:true};
  };
  // A read that failed partway would save a partial total (or none), so the earlier saved total is kept instead.
  const fail=(key,label,e)=>{const was=prev[key];failed.push(`${label}: ${e.message}${was?` (kept the earlier ${dollars(was.routed)})`:' (none saved before)'}`);if(was)entries[key]=was;};
  for(const g of groups){try{save(g.key,g.org,await read(g.conduits,true));}catch(e){fail(g.key,g.org,e);}}
  // Every other committee that might be forwarding gifts to the campaign, from those lists.
  const {found,skipped}=conduitsToRead(gave,known,limits.found);
  for(const [cmte,name] of found){
    const key=`fec:${cmte}`;
    try{const r=await read([cmte],false);save(key,name||cmte,r);if(entries[key])names[key]=name||cmte;}
    catch(e){fail(key,name||cmte,e);}
  }
  if(skipped.size){
    capped.push(`${skipped.size} more committee${skipped.size===1?'':'s'} that may forward gifts, past the ${limits.found} read from each cycle's list: ${[...skipped.values()].slice(0,5).join(', ')}${skipped.size>5?' …':''}`);
    for(const cmte of skipped.keys()){const key=`fec:${cmte}`;if(prev[key])entries[key]=prev[key];}
  }
  return {entries,failed,capped,listed,complete:!failed.length&&!capped.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const env=process.env;
  // One time, for a file saved before each person's completeness was kept: every person with a campaign committee
  // except these is marked complete (the run's own list of failed reads names the ones to leave out), with no FEC
  // requests. Then run --only for the ones left out.
  if(process.argv.includes('--mark-complete-except')){
    const file=new URL('../public/research.json',import.meta.url),data=JSON.parse(await fs.readFile(file,'utf8'));
    const skip=(process.argv[process.argv.indexOf('--mark-complete-except')+1]||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(!data.bundled?.names){console.log('The saved earmarks are from before every group was searched for; run npm run funders:bundled first.');process.exit(1);}
    const all=people(data).filter(p=>p.fecCmte).map(p=>p.id),unknown=skip.filter(id=>!all.includes(id));
    if(unknown.length){console.log(`No one with a campaign committee has the id ${unknown.join(', ')}; nothing changed.`);process.exit(1);}
    data.bundled.listed=Object.fromEntries(all.filter(id=>!skip.includes(id)).map(id=>[id,true]));
    data.bundled.discovered=all.every(id=>data.bundled.listed[id]);
    await fs.writeFile(file,JSON.stringify(data,null,2));
    console.log(`Marked ${Object.keys(data.bundled.listed).length} of ${all.length} complete.${skip.length?` Now run: npm run funders:bundled -- --only ${skip.join(',')}`:''}`);
    process.exit(0);
  }
  if(!env.FEC_API_KEY){console.error('Set FEC_API_KEY in .dev.vars first (see README, "Connect official data sources").');process.exit(1);}
  const file=new URL('../public/research.json',import.meta.url),data=JSON.parse(await fs.readFile(file,'utf8'));
  const config=JSON.parse(await fs.readFile(new URL('../data/config.json',import.meta.url),'utf8'));
  const since=Number(config.historyFrom)||2016,current=Number(config.cycle)||2026,arg=k=>process.argv.includes(k)?process.argv[process.argv.indexOf(k)+1]:null;
  const only=arg('--only')?.split(',')||null,allCycles=[];for(let y=current;y>=since+since%2;y-=2)allCycles.push(y);
  const limits={...LIMITS,found:Math.max(1,Math.floor(Number(arg('--max-found'))||LIMITS.found))};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // Each request is tried up to three times (the FEC turns away bursts and sometimes times out), with a pause between;
  // past the key's hourly limit (HTTP 429), it waits a minute at a time and goes on.
  let requests=0;
  const get=async u=>{for(let k=0,limited=0;;){await sleep(250);try{requests++;return await requestSource(u,env);}catch(e){
    if((e?.statusCode===429||/429|rate limit/i.test(e?.message||''))&&limited<60){limited++;if(limited===1)console.log('  (the FEC key\'s hourly limit: waiting a minute at a time)');await sleep(60000);continue;}
    if(++k>2)throw e;await sleep(2000*3**k);}}};
  const before=data.bundled?.people||{},kept=[],cut=[],names={...(data.bundled?.names||{})};
  const groups=(data.groupPos||[]).filter(g=>g.conduits?.length),known=new Set(groups.flatMap(g=>g.conduits)),out={};
  // Who was searched completely (every cycle's list of who gave read in full, and every committee's gifts read in full):
  // their Earmarks part isn't marked partial. A run with --only keeps everyone else's as it was.
  const complete={...(data.bundled?.listed||{})},incomplete=[];
  let listed=0;
  for(const p of people(data)){
    if(!p.fecCmte)continue;
    if(only&&!only.includes(p.id)){if(before[p.id])out[p.id]=before[p.id];continue;}
    const r=await searchPerson(p,{get,groups,known,allCycles,current,prev:before[p.id]||{},names,limits});
    listed+=r.listed;if(Object.keys(r.entries).length)out[p.id]=r.entries;
    kept.push(...r.failed.map(m=>`${p.id} · ${m}`));cut.push(...r.capped.map(m=>`${p.id} · ${m}`));
    if(r.complete)complete[p.id]=true;else{delete complete[p.id];incomplete.push(p.id);}
    const mine=out[p.id];if(mine)console.log(`${p.id}: ${Object.entries(mine).map(([k,v])=>`${names[k]||k} $${Math.round(v.routed).toLocaleString()} this cycle (${Object.keys(v.byCycle||{}).length} cycle${Object.keys(v.byCycle||{}).length===1?'':'s'})`).join(', ')}`);
  }
  // A check against the one total researched by hand (Booker through AIPAC's PAC, from Sludge's reading of the filings).
  const hand=people(data).find(p=>p.id==='booker')?.conduit?.rows?.find(r=>r.id==='C00797670');
  if(hand)console.log(`\nCheck: Booker through AIPAC PAC, researched by hand $${hand.amount.toLocaleString()} for ${hand.period}; found $${Math.round(out.booker?.aipac?.routed||0).toLocaleString()} for the whole cycle.`);
  if(kept.length)console.log(`\n${kept.length} read${kept.length===1?'':'s'} failed after three tries:\n  ${kept.slice(0,40).join('\n  ')}${kept.length>40?`\n  …and ${kept.length-40} more`:''}\nRun it again later to fill them in.`);
  if(cut.length)console.log(`\n${cut.length} search${cut.length===1?'':'es'} stopped at a limit (LIMITS in this script), so those people stay marked partial:\n  ${cut.slice(0,40).join('\n  ')}${cut.length>40?`\n  …and ${cut.length-40} more`:''}`);
  // The command to finish them: with a higher --max-found when that limit is what cut a search short.
  const more=cut.some(m=>/may forward gifts, past the/.test(m))?` --max-found ${limits.found*2}`:'';
  if(incomplete.length)console.log(`\nNot searched completely, so their Earmarks part stays marked partial: ${incomplete.join(', ')}.\nTo finish them: npm run funders:bundled -- --only ${incomplete.join(',')}${more}`);
  // Every group counts as found for everyone only when everyone with a campaign committee was searched completely.
  const discovered=people(data).filter(p=>p.fecCmte).every(p=>complete[p.id]);
  if(!listed)console.log('\nThe FEC\'s totals by recipient couldn\'t be read, so only the 5 groups were read; the Earmarks part stays marked partial.');
  console.log(`\n${requests.toLocaleString()} FEC requests.`);
  if(!process.argv.includes('--check')){
    data.bundled={asOf:new Date().toISOString().slice(0,10),conduits:Object.fromEntries(groups.map(g=>[g.key,g.conduits])),names,
      discovered,listed:complete,cycles:allCycles,people:out};
    await fs.writeFile(file,JSON.stringify(data,null,2));
    console.log('\nWrote "bundled" to public/research.json. Now run node scripts/build-funders.mjs, review the changes, and commit.');
  }
}
