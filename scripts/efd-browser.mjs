// Senate eFD reports, fetched by a browser instead of saved by hand. Senate eFD turns the refresh's plain requests away
// (HTTP 403), so this opens the site in Playwright's own headless Chromium, with its default User-Agent and nothing
// disguised, ticks the box agreeing to the site's terms as every visitor does, and then searches and opens each report
// the way the search page does. Each report page is saved into efd-downloads/<id>/, where npm run efd:import reads it.
// If the site answers with a bot check, a captcha or a refusal (HTTP 403 or 429), it stops and says so: nothing tries to
// get past one, nothing tries again after one, and the reports are then saved by hand as scripts/import-efd.mjs explains.
//
// eFD only answers so many pages in a while (about 30 to 40 pages close together, then HTTP 403), so a run can work in
// batches: a set number of pages, then a wait, then the next batch, until everyone's reports are saved. Searches count
// as pages, so they're remembered for a week (efd-downloads/.senate-searches.json for all senators' reports, searched
// together; efd-downloads/<id>/.searches.json for one person's), and the newest annual report of every person is saved
// before anyone's older reports, so each profile gets its net worth first.
//
// The terms (shown on https://efdsearch.senate.gov/search/home/): the reports can't be used for any commercial purpose
// other than news media, for credit ratings, or to raise money. Read them before running this.
//
//   npm install --no-save playwright && npx playwright install chromium     (once; package.json is unchanged)
//   npm run efd:fetch                       every sitting senator and Senate candidate on file, reports since 2016
//   npm run efd:fetch -- --only ossoff,collins --since 2022
//   npm run efd:fetch -- --annual           annual reports only (net worth, holdings, income, positions, gifts, travel)
//   npm run efd:fetch -- --dry-run          search only, list what would be saved
//   npm run efd:fetch -- --max 100          stop after saving 100 new reports (run again to continue)
//   npm run efd:fetch -- --batch 30         ask eFD for at most 30 pages, then stop (run again later to continue)
//   npm run efd:fetch -- --batch 30 --every 60 --import
//                                           30 pages, wait 60 minutes, the next 30, ... until done, importing after each
//   npm run efd:fetch -- --fresh            search again now, instead of using searches from the past week
//   then: npm start once and stop it (first time only), npm run efd:import
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import config from '../data/config.json' with {type:'json'};
import {SENATORS,surname,importEfd} from './import-efd.mjs';
import {openDatabase} from './sqlite.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const EFD='https://efdsearch.senate.gov';
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z]/g,'');

// The searches for one person: a senator's annual reports (type 7) and trade reports (type 11); a candidate's reports of
// any type (their Candidate Report is listed as an annual one). Filer type 1 is a senator, 4 a candidate. annual: a
// senator's annual reports only.
export function searchesFor(p,since,{annual=false}={}){
  const base={last:surname(p),first:[p.name.split(/\s+/)[0],...(p.nicknames||[])],since};
  return p.inOffice?[{...base,label:'annual',types:'[7]',filer:'[1]'},...(annual?[]:[{...base,label:'trade',types:'[11]',filer:'[1]'}])]
    :[{...base,label:'candidate',types:'[]',filer:'[4]'}];
}
// The same search for every senator at once (no name): about 9 pages of 100 for all senators' annual reports since
// 2020, instead of one search each.
export const allSenators=(label,since)=>({label,types:label==='trade'?'[11]':'[7]',filer:'[1]',last:'',first:[],since});
// The form the search page posts to /search/report/data/, a page of 100 at a time.
export function searchForm(s,start,csrf){
  return {start:String(start),length:'100',report_types:s.types,filer_types:s.filer,submitted_start_date:`01/01/${s.since} 00:00:00`,submitted_end_date:'',
    candidate_state:'',senator_state:'',office_id:'',first_name:'',last_name:s.last,csrfmiddlewaretoken:csrf};
}
// The reports in the search results that are this person's: the same last name, and when two filers share it, the same
// first name. rows: the search's data ([first, last, filer, link, filed]). Paper reports are scanned images: a trade
// report on paper is kept (the import lists it to check by hand); any other paper report is only counted.
export function reportsIn(rows,s,base=EFD){
  const mine=(rows||[]).filter(r=>Array.isArray(r)&&fold(r[1])===fold(s.last));
  const firsts=new Set(mine.map(r=>fold(String(r[0]).split(/\s+/)[0])));
  const kept=firsts.size>1?mine.filter(r=>s.first.some(f=>fold(r[0]).startsWith(fold(f).slice(0,3)))):mine;
  const out=[];
  for(const r of kept){
    const href=String(r[3]).match(/href=["']([^"']+)["']/)?.[1],m=href?.match(/^\/search\/view\/(ptr|annual|paper)\/([0-9a-f-]{36})\/?$/i);
    if(!m)continue;
    const kind=m[1].toLowerCase(),filed=String(r[4]||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    out.push({kind,doc:m[2].toLowerCase(),url:`${base}/search/view/${kind}/${m[2].toLowerCase()}/`,title:strip(r[3]),
      filed:filed?`${filed[3]}-${filed[1].padStart(2,'0')}-${filed[2].padStart(2,'0')}`:null,skip:kind==='paper'&&s.label!=='trade'});
  }
  return out;
}
const strip=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

// Searches remembered for a week, so a batch spends its pages on reports. memory: {label: {at, since, ...}}. A search
// from the past week since the same year or earlier is used (filtered to the year asked); an older one, or one from a
// later year, isn't.
export const SEARCH_DAYS=7;
export const searchesFile=id=>path.join('efd-downloads',id,'.searches.json');
export const SHARED_FILE=path.join('efd-downloads','.senate-searches.json');
export function stillGood(c,since,now=new Date(),days=SEARCH_DAYS){
  const age=now.getTime()-Date.parse(c?.at);
  return !!c&&Number(c.since)<=Number(since)&&age>=0&&age<days*86400000;
}
// One person's reports from a search remembered for them, with addresses on the site asked of; null if none is good.
export function remembered(memory,s,{now=new Date(),days=SEARCH_DAYS,base=EFD}={}){
  const c=memory?.[s.label];
  if(!stillGood(c,s.since,now,days)||!Array.isArray(c.reports))return null;
  return fromYear(c.reports,s.since).map(r=>({...r,url:`${base}/search/view/${r.kind}/${r.doc}/`}));
}
export const remember=(memory,s,reports,now=new Date())=>({...(memory||{}),[s.label]:{at:now.toISOString(),since:s.since,reports:reports.map(({url,...r})=>r)}});
// A search of all senators, kept page by page so a batch that ends partway through goes on from there: {at, since,
// rows, next, total}. A new one when the kept one is past its week or from a later year.
export const sharedSearch=(kept,since,now=new Date())=>stillGood(kept,since,now)&&Array.isArray(kept.rows)?kept:{at:now.toISOString(),since,rows:[],next:0,total:null};
export const searchDone=st=>st.total!=null&&st.next>=st.total;
// Reports filed in the year asked or later (a search remembered from an earlier year has more).
export const fromYear=(reports,since)=>reports.filter(r=>!r.filed||Number(r.filed.slice(0,4))>=Number(since));

// The newest annual report among a person's (a candidate's Candidate Report is one): the one their net worth is read
// from, saved for everyone before anyone's older reports. Its year: "for CY 2024" in the title (an amendment says the
// same year, and is preferred, being filed later), else the year before it was filed.
const yearOf=r=>Number(String(r.title||'').match(/\b(?:CY|Calendar Year)\s*(\d{4})/i)?.[1])||(r.filed?Number(r.filed.slice(0,4))-1:0);
export function newestAnnual(reports){
  return (reports||[]).filter(r=>r.kind==='annual'&&!r.skip).sort((a,b)=>yearOf(b)-yearOf(a)||String(b.filed||'').localeCompare(String(a.filed||'')))[0]||null;
}

// Where a report is saved: one file per report, named by its eFD id, so a saved report is never fetched twice.
export const fileFor=(id,r)=>path.join('efd-downloads',id,`${r.kind}-${r.doc}.html`);
// The page as saved, with the address noted at the top as browsers do, so the import knows which report it is. A
// paper report's page is only its scanned images, so the filing date from the search results is noted with it.
export function savedPage(url,html,filed=null){
  const date=filed&&!/\bFiled\s+\d{1,2}\/\d{1,2}\/\d{4}/i.test(html)?`<p hidden>Filed ${filed.slice(5,7)}/${filed.slice(8,10)}/${filed.slice(0,4)} (from the search results)</p>\n`:'';
  return `<!-- saved from url=${url} -->\n${date}${html}`;
}
// A page that is a bot check, a captcha or a refusal, rather than the site: the reason, or null. text: what a visitor
// sees (the page's title and its visible words), never its code, where the same words can appear harmlessly.
const BOT_CHECK=/captcha|are you a (human|robot)|verify you are (a )?human|unusual traffic|request rejected|access denied|just a moment\.\.\.|checking your browser/i;
export function blockedBy(status,text=''){
  if(status===403||status===429)return `the site answered HTTP ${status}`;
  if(status>=500)return null;
  const t=String(text).replace(/\s+/g,' '),m=t.match(BOT_CHECK);
  if(!m)return null;
  const at=Math.max(0,m.index-60);
  return `the page showed a bot check or refusal ("…${t.slice(at,m.index+m[0].length+60).trim()}…")`;
}
// What a visitor sees on the page: its title and its visible words.
const seen=async page=>`${await page.title()}\n${await page.evaluate(()=>document.body?document.body.innerText:'')}`;
// The page answered is the terms page again (the session ended): agree once more.
export const backAtTerms=html=>/prohibition_agreement|agree_statement/i.test(String(html))&&!/Assets|Liabilities|Transactions?/i.test(strip(html));
// What a report page has to show to be the report.
export const looksRight=(kind,html)=>kind==='paper'?/<img/i.test(html):kind==='ptr'?/Transaction/i.test(html):/Assets|Liabilities|Report/i.test(html);

// The pages a batch may ask for: every page asked of eFD counts (the terms page, each page of a search, each report).
// The first page of a batch always goes, so a batch smaller than the terms takes still moves on.
export function pageBudget(limit){
  let asked=0;
  return {spend(n=1){if(asked>0&&asked+n>limit)throw new BatchFull();asked+=n;},get asked(){return asked;},reset(){asked=0;}};
}
export class BatchFull extends Error{}
class Blocked extends Error{}
const readJson=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}};
const writeJson=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v));};
const plural=(n,w,ws=w+'s')=>`${n} ${n===1?w:ws}`;

async function main(argv){
  // EFD_BROWSER_BASE: a stand-in site for checking this script without visiting eFD.
  const site=process.env.EFD_BROWSER_BASE||EFD;
  const arg=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null;};
  const only=arg('--only')?.split(',').map(s=>s.trim()).filter(Boolean)||null,dryRun=argv.includes('--dry-run');
  const annualOnly=argv.includes('--annual'),fresh=argv.includes('--fresh'),doImport=argv.includes('--import')&&!dryRun;
  const every=Math.max(0,Number(arg('--every'))||0),batch=arg('--batch')?Math.max(5,Number(arg('--batch'))||5):every?25:Infinity;
  const since=Number(arg('--since'))||Number(config.historyFrom)||2016,max=Number(arg('--max'))||Infinity,pause=Number(arg('--pause'))||(batch<Infinity?5000:1500);
  const people=SENATORS().filter(p=>!only||only.includes(p.id));
  if(!people.length){console.log(only?`No sitting senator or Senate candidate with the id ${only.join(', ')}.`:'No senators in data/config.json.');return 1;}
  const dbFile=path.join(root,'.local','records.sqlite');
  if(doImport&&!fs.existsSync(dbFile)){console.log('No local database yet (.local/records.sqlite). Run npm start once, stop it, then run this again.');return 1;}
  let playwright;
  try{playwright=await import('playwright');}
  catch{console.log('Playwright isn\'t installed here. Run once:\n  npm install --no-save playwright\n  npx playwright install chromium\nthen run this again.');return 1;}
  const browser=await playwright.chromium.launch({headless:!argv.includes('--show')});
  const budget=pageBudget(batch);
  let page,saved=0,inBatch=0,already=0,papers=0,failed=0,batchNo=0,sharedBroken=false,toldRest=false;
  // What this run already did, so a later batch or the second pass doesn't do it again: the reports tried (saved,
  // or opened and not a report), each person's reports found, the people listed, the searches that failed.
  const tried=new Set(),found=new Map(),listed=new Set(),gaveUp=new Set(),renewed=new Set();
  // Several senators: their searches are made for all senators at once.
  const useShared=people.filter(p=>p.inOffice).length>5,sharedPath=path.join(root,SHARED_FILE);
  const shared=(fresh?null:readJson(sharedPath))||{};
  const wait=()=>page.waitForTimeout(pause);
  const open=async url=>{
    budget.spend();
    const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    const html=await page.content(),why=blockedBy(res?.status()??0,await seen(page));
    if(why)throw new Blocked(`${why} at ${page.url()}`);
    return {status:res?.status()??0,html};
  };
  const agree=async()=>{
    await open(`${site}/search/home/`);
    const box=page.locator('#agree_statement, input[name="prohibition_agreement"]').first();
    if(!await box.count())throw new Blocked('the terms page has no agreement box (the site may have changed)');
    // Ticking the box sends the form at once and the page moves on to the search, so it is clicked, not checked
    // (a check waits for the box to read as ticked, and the box is gone by then).
    budget.spend(2); // the form sent, and the search page it leads to
    await Promise.all([page.waitForURL(/\/search\/(?!home)/,{timeout:30000}).catch(()=>null),box.click()]);
    if(/\/search\/home\/?$/.test(new URL(page.url()).pathname)){
      const submit=page.locator('form button[type=submit], form input[type=submit]').first();
      if(await submit.count())await Promise.all([page.waitForURL(/\/search\/(?!home)/,{timeout:30000}).catch(()=>null),submit.click()]);
    }
    const why=blockedBy(0,await seen(page));if(why)throw new Blocked(`${why} at ${page.url()}`);
    if(/\/search\/home\/?$/.test(new URL(page.url()).pathname))throw new Blocked('agreeing to the terms didn\'t open the search page');
  };
  // A search, posted from the page itself with the session's own token, as the search page's script does, a page of
  // 100 results at a time. st: how far it got ({rows, next, total}), so it can go on from there; kept() after each page.
  const searchPages=async(s,st={rows:[],next:0,total:null},kept=()=>{})=>{
    while(!searchDone(st)&&st.next<20000){
      budget.spend();
      const r=await page.evaluate(async({form,url})=>{
        const csrf=(document.cookie.match(/csrftoken=([^;]+)/)||[])[1]||'';
        const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-CSRFToken':csrf,'X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({...form,csrfmiddlewaretoken:csrf}).toString(),credentials:'same-origin'});
        return {status:res.status,text:await res.text()};
      },{form:searchForm(s,st.next,''),url:`${site}/search/report/data/`});
      const why=blockedBy(r.status,r.status===200?'':strip(r.text));if(why)throw new Blocked(`${why} (the search)`);
      let d;try{d=JSON.parse(r.text);}catch{throw new Error(`the search didn't answer with results (HTTP ${r.status})`);}
      st.rows.push(...(d.data||[]).filter(Array.isArray).map(x=>x.slice(0,5).map(String)));
      st.total=Number(d.recordsFiltered??d.recordsTotal??0);st.next+=100;kept(st);
      if(!searchDone(st))await wait();
    }
    return st.rows;
  };
  // All senators' reports of one kind, searched together (and remembered for a week, page by page).
  const allRows=async label=>{
    const st=shared[label]=sharedSearch(shared[label],since);
    if(!searchDone(st)){
      if(!st.next)console.log(`Searching all senators' ${label} reports since ${since} together (${label==='trade'?'about 10 to 30':'about 9'} pages)…`);
      await searchPages(allSenators(label,since),st,()=>writeJson(sharedPath,shared));
      await wait();
    }
    return st.rows;
  };
  // A person's reports, from each search: in the first pass only the searches with annual reports in them.
  const reportsFor=async(p,pass)=>{
    const memoryPath=path.join(root,searchesFile(p.id));
    let memory=readJson(memoryPath);
    const out=[];
    for(const s of searchesFor(p,since,{annual:annualOnly}).filter(s=>pass!=='newest'||s.label!=='trade')){
      const k=`${p.id}:${s.label}`;
      if(gaveUp.has(k))continue;
      let got=found.get(k)||(fresh&&!renewed.has(k)?null:remembered(memory,s,{base:site}));
      // A few senators (--only): all senators' search is used when a whole one from the past week is kept.
      if(!got&&p.inOffice&&!sharedBroken&&(useShared||!fresh&&shared[s.label]&&searchDone(shared[s.label])&&stillGood(shared[s.label],since))){
        try{got=fromYear(reportsIn(await allRows(s.label),s,site),since);}
        catch(e){if(e instanceof Blocked||e instanceof BatchFull)throw e;console.log(`  The search of all senators' ${s.label} reports didn't work (${e.message}); searching one senator at a time.`);sharedBroken=true;}
      }
      if(!got){
        try{got=reportsIn(await searchPages(s),s,site);}
        catch(e){if(e instanceof Blocked||e instanceof BatchFull)throw e;console.log(`  ${p.name}: the ${s.label} search failed (${e.message}); skipped`);failed++;gaveUp.add(k);await wait();continue;}
        memory=remember(memory,s,got);writeJson(memoryPath,memory);renewed.add(k);
        await wait();
      }
      found.set(k,got);out.push({s,k,got});
    }
    return out;
  };
  // One person, in one of the two passes: their newest annual report, then the rest. Each search's reports are listed
  // the first time they're seen.
  const visit=async(p,pass)=>{
    const searches=await reportsFor(p,pass),reports=searches.flatMap(x=>x.got);
    const isNew=r=>!r.skip&&!tried.has(r.doc)&&!fs.existsSync(path.join(root,fileFor(p.id,r)));
    let told=false;
    for(const {s,k,got} of searches){
      if(listed.has(k))continue;
      const who=listed.has(p.id)?p.name:`${p.name} (${p.state}, ${p.inOffice?'senator':'candidate'})`;listed.add(k);listed.add(p.id);told=true;
      const paper=got.filter(r=>r.skip).length,todo=got.filter(isNew).length;
      papers+=paper;already+=got.length-paper-todo;
      console.log(`${who}: ${plural(got.length,s.label==='candidate'?'report':`${s.label} report`)} found, ${todo} new${paper?`, ${paper} on paper (scanned, not saved)`:''}`);
    }
    const newest=newestAnnual(reports),todo=(pass==='newest'?[newest].filter(Boolean):reports).filter(isNew);
    if(pass==='rest'&&todo.length&&!told)console.log(`${p.name}: ${plural(todo.length,'more report')} to save`);
    for(const r of todo){
      if(saved>=max)return;
      if(dryRun){tried.add(r.doc);console.log(`  would save ${fileFor(p.id,r)}  ${r.title} (filed ${r.filed||'?'})`);continue;}
      let {html}=await open(r.url);
      if(backAtTerms(html)){await agree();await wait();({html}=await open(r.url));}
      tried.add(r.doc);
      if(!looksRight(r.kind,html)){console.log(`  not saved: ${r.url} didn't open as a report`);failed++;await wait();continue;}
      const file=path.join(root,fileFor(p.id,r));
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,savedPage(r.url,html,r.filed));
      saved++;inBatch++;console.log(`  saved ${fileFor(p.id,r)}  ${r.title} (filed ${r.filed||'?'})`);
      await wait();
    }
  };
  // The saved reports into the local database, after each batch (--import).
  const importNow=async()=>{
    let db;
    try{
      db=openDatabase(dbFile);const r=await importEfd({dir:path.join(root,'efd-downloads'),db});
      const checks=r.lines.filter(l=>/^CHECK/.test(l)),who=new Set(r.summary.map(l=>l.split(':')[0])).size;
      console.log(`Imported into the local database: ${plural(who,"person's reports","people's reports")} (${plural(r.files,'page')} read)${checks.length?`; to check:\n  ${checks.join('\n  ')}`:'.'}`);
    }catch(e){console.log(`The import didn't run (${String(e?.message||e).split('\n')[0]}). The reports are saved; run npm run efd:import later, with npm start stopped.`);}
    finally{try{db?.close();}catch{}}
  };
  const pages=batch===Infinity?'':` ${plural(batch,'page')} a batch${every?`, ${every} minutes apart`:''};`;
  for(;;){
    batchNo++;budget.reset();inBatch=0;
    const context=await browser.newContext();page=await context.newPage();
    let full=false,stop=null;
    try{
      if(batchNo===1)console.log(`Opening ${site}/search/home/ and agreeing to its terms, as a visitor does…`);
      await agree();
      if(batchNo===1)console.log(`Agreed. Searching ${people.length} ${people.length===1?"person's":"people's"} ${annualOnly?'annual ':''}reports since ${since};${pages} newest annual reports first${dryRun?' (dry run: no reports are saved)':''}.\n`);
      else console.log(`\nBatch ${batchNo}: agreed to the terms again.`);
      for(const pass of ['newest','rest']){
        if(pass==='rest'&&!toldRest&&saved<max){toldRest=true;console.log(`\nThe newest annual reports are ${dryRun?'listed':'done'}. Now the rest: older annual reports${annualOnly?'':' and trade reports'}.`);}
        for(const p of people){if(saved>=max)break;await visit(p,pass);}
      }
    }catch(e){if(e instanceof BatchFull)full=true;else stop=e;}
    await context.close().catch(()=>{});
    if(stop){
      if(stop instanceof Blocked)console.log(`\nStopped: ${stop.message}. This script doesn't try to get past a bot check, and doesn't try again after a refusal.${saved?` The ${plural(saved,'report')} saved so far are kept.`:''}\nRun it again in a few hours: it goes on where it stopped, with the searches it already made. If eFD refuses often, ask for fewer pages a batch (--batch ${batch===Infinity?25:Math.max(5,Math.floor(batch/2))}) or wait longer between batches (--every ${every?every*2:60}). The reports can also be saved by hand: npm run efd:import -- --list shows which ones.`);
      // Anything else (a page that never loaded, a step that timed out): say which, briefly, keeping what was saved.
      else console.log(`\nStopped on an error: ${String(stop?.message||stop).split('\n')[0]}${saved?`\nThe ${plural(saved,'report')} saved so far are kept; run it again to continue.`:''}`);
      if(doImport&&inBatch)await importNow();
      await browser.close();return stop instanceof Blocked?(saved?0:2):1;
    }
    if(doImport&&inBatch)await importNow();
    if(!full||saved>=max)break;
    if(!every){console.log(`\nStopped after ${plural(batch,'page')} (--batch ${batch}). Run it again in an hour or so to continue where it left off, or add --every 60 to have it wait and go on by itself.`);break;}
    const at=new Date(Date.now()+every*60000);
    console.log(`\nBatch ${batchNo} done: ${plural(inBatch,'report')} saved (${saved} in all). The next batch starts in ${every} minutes, at ${at.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}. Control+C stops it; what's saved is kept.`);
    await new Promise(r=>setTimeout(r,every*60000));
  }
  await browser.close();
  console.log(`\n${dryRun?'Dry run done':`Saved ${plural(saved,'new report')}${batchNo>1?` in ${batchNo} batches`:''}`}${already?`; ${already} already saved`:''}${papers?`; ${papers} paper reports left out (scanned images)`:''}${failed?`; ${failed} not saved (see above)`:''}.`);
  if(!dryRun&&saved&&!doImport)console.log('Next: npm run efd:import (run npm start once first, then stop it, if you never have).');
  if(saved>=max)console.log(`Stopped at --max ${max}; run it again to continue where it left off.`);
  return 0;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exit(await main(process.argv.slice(2)));
