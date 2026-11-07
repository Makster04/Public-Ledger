// Senate eFD reports, fetched by a browser instead of saved by hand. Senate eFD turns the refresh's plain requests away
// (HTTP 403), so this opens the site in Playwright's own headless Chromium, with its default User-Agent and nothing
// disguised, ticks the box agreeing to the site's terms as every visitor does, and then searches and opens each report
// the way the search page does. Each report page is saved into efd-downloads/<id>/, where npm run efd:import reads it.
// If the site answers with a bot check, a captcha or a refusal (HTTP 403 or 429), it stops and says so: nothing tries to
// get past one, and the reports are then saved by hand as scripts/import-efd.mjs explains.
//
// The terms (shown on https://efdsearch.senate.gov/search/home/): the reports can't be used for any commercial purpose
// other than news media, for credit ratings, or to raise money. Read them before running this.
//
//   npm install --no-save playwright && npx playwright install chromium     (once; package.json is unchanged)
//   npm run efd:fetch                       every sitting senator and Senate candidate on file, reports since 2016
//   npm run efd:fetch -- --only ossoff,collins --since 2022
//   npm run efd:fetch -- --dry-run          search only, list what would be saved
//   npm run efd:fetch -- --max 100          stop after saving 100 new reports (run again to continue)
//   then: npm start once and stop it (first time only), npm run efd:import
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import config from '../data/config.json' with {type:'json'};
import {SENATORS,surname} from './import-efd.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const EFD='https://efdsearch.senate.gov';
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z]/g,'');

// The searches for one person: a senator's annual reports (type 7) and trade reports (type 11); a candidate's reports of
// any type (their Candidate Report is listed as an annual one). Filer type 1 is a senator, 4 a candidate.
export function searchesFor(p,since){
  const base={last:surname(p),first:[p.name.split(/\s+/)[0],...(p.nicknames||[])],since};
  return p.inOffice?[{...base,label:'annual',types:'[7]',filer:'[1]'},{...base,label:'trade',types:'[11]',filer:'[1]'}]
    :[{...base,label:'candidate',types:'[]',filer:'[4]'}];
}
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

class Blocked extends Error{}

async function main(argv){
  // EFD_BROWSER_BASE: a stand-in site for checking this script without visiting eFD (the tests' mock).
  const site=process.env.EFD_BROWSER_BASE||EFD;
  const arg=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null;};
  const only=arg('--only')?.split(',').map(s=>s.trim()).filter(Boolean)||null,dryRun=argv.includes('--dry-run');
  const since=Number(arg('--since'))||Number(config.historyFrom)||2016,max=Number(arg('--max'))||Infinity,pause=Number(arg('--pause'))||1500;
  const people=SENATORS().filter(p=>!only||only.includes(p.id));
  if(!people.length){console.log(only?`No sitting senator or Senate candidate with the id ${only.join(', ')}.`:'No senators in data/config.json.');return 1;}
  let playwright;
  try{playwright=await import('playwright');}
  catch{console.log('Playwright isn\'t installed here. Run once:\n  npm install --no-save playwright\n  npx playwright install chromium\nthen run this again.');return 1;}
  const browser=await playwright.chromium.launch({headless:!argv.includes('--show')});
  const page=await browser.newPage();
  const wait=()=>page.waitForTimeout(pause);
  let saved=0,already=0,papers=0,failed=0;
  const open=async url=>{
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
    await Promise.all([page.waitForURL(/\/search\/(?!home)/,{timeout:30000}).catch(()=>null),box.click()]);
    if(/\/search\/home\/?$/.test(new URL(page.url()).pathname)){
      const submit=page.locator('form button[type=submit], form input[type=submit]').first();
      if(await submit.count())await Promise.all([page.waitForURL(/\/search\/(?!home)/,{timeout:30000}).catch(()=>null),submit.click()]);
    }
    const why=blockedBy(0,await seen(page));if(why)throw new Blocked(`${why} at ${page.url()}`);
    if(/\/search\/home\/?$/.test(new URL(page.url()).pathname))throw new Blocked('agreeing to the terms didn\'t open the search page');
  };
  // The search, posted from the page itself with the session's own token, as the search page's script does.
  const search=async s=>{
    const found=[];
    for(let start=0;start<2000;start+=100){
      const r=await page.evaluate(async({form,url})=>{
        const csrf=(document.cookie.match(/csrftoken=([^;]+)/)||[])[1]||'';
        const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-CSRFToken':csrf,'X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({...form,csrfmiddlewaretoken:csrf}).toString(),credentials:'same-origin'});
        return {status:res.status,text:await res.text()};
      },{form:searchForm(s,start,''),url:`${site}/search/report/data/`});
      const why=blockedBy(r.status,r.status===200?'':strip(r.text));if(why)throw new Blocked(`${why} (the search)`);
      let d;try{d=JSON.parse(r.text);}catch{throw new Error(`the search didn't answer with results (HTTP ${r.status})`);}
      found.push(...reportsIn(d.data,s,site));
      if(start+100>=Number(d.recordsFiltered??d.recordsTotal??0))break;
      await wait();
    }
    return found;
  };
  try{
    console.log(`Opening ${site}/search/home/ and agreeing to its terms, as a visitor does…`);
    await agree();
    console.log(`Agreed. Searching ${people.length} ${people.length===1?"person's":"people's"} reports since ${since}${dryRun?' (dry run: nothing is saved)':''}.\n`);
    for(const p of people){
      if(saved>=max)break;
      const reports=[];
      for(const s of searchesFor(p,since)){
        try{reports.push(...await search(s));}catch(e){if(e instanceof Blocked)throw e;console.log(`  ${p.name}: the ${s.label} search failed (${e.message}); skipped`);failed++;}
        await wait();
      }
      const todo=reports.filter(r=>!r.skip&&!fs.existsSync(path.join(root,fileFor(p.id,r))));
      papers+=reports.filter(r=>r.skip).length;already+=reports.filter(r=>!r.skip).length-todo.length;
      console.log(`${p.name} (${p.state}, ${p.inOffice?'senator':'candidate'}): ${reports.length} report${reports.length===1?'':'s'} found, ${todo.length} new${reports.some(r=>r.skip)?`, ${reports.filter(r=>r.skip).length} on paper (scanned, not saved)`:''}`);
      if(dryRun){for(const r of todo)console.log(`  would save ${fileFor(p.id,r)}  ${r.title} (filed ${r.filed||'?'})`);continue;}
      for(const r of todo){
        if(saved>=max)break;
        let {html}=await open(r.url);
        if(backAtTerms(html)){await agree();await wait();({html}=await open(r.url));}
        if(!looksRight(r.kind,html)){console.log(`  not saved: ${r.url} didn't open as a report`);failed++;await wait();continue;}
        const file=path.join(root,fileFor(p.id,r));
        fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,savedPage(r.url,html,r.filed));
        saved++;console.log(`  saved ${fileFor(p.id,r)}  ${r.title} (filed ${r.filed||'?'})`);
        await wait();
      }
    }
  }catch(e){
    if(e instanceof Blocked){
      console.log(`\nStopped: ${e.message}. This script doesn't try to get past a bot check.${saved?` The ${saved} report${saved===1?'':'s'} saved so far are kept.`:''}\nThe reports can still be saved by hand: npm run efd:import -- --list shows which ones.`);
      await browser.close();return saved?0:2;
    }
    // Anything else (a page that never loaded, a step that timed out): say which, briefly, keeping what was saved.
    console.log(`\nStopped on an error: ${String(e?.message||e).split('\n')[0]}${saved?`\nThe ${saved} report${saved===1?'':'s'} saved so far are kept; run it again to continue.`:''}`);
    await browser.close();return 1;
  }
  await browser.close();
  console.log(`\n${dryRun?'Dry run done.':`Saved ${saved} new report${saved===1?'':'s'}`}${already?`; ${already} already saved`:''}${papers?`; ${papers} paper reports left out (scanned images)`:''}${failed?`; ${failed} not saved (see above)`:''}.`);
  if(!dryRun&&saved)console.log('Next: npm run efd:import (run npm start once first, then stop it, if you never have).');
  if(saved>=max)console.log(`Stopped at --max ${max}; run it again to continue where it left off.`);
  return 0;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exit(await main(process.argv.slice(2)));
