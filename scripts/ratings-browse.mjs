// The interest groups whose scorecards are drawn by their pages' own scripts (Planned Parenthood Action, Americans for
// Prosperity, the U.S. Chamber of Commerce: npm run ratings:probe finds no ratings in what their sites send), opened in a
// browser so their readers can be written from the real thing. Nothing here is scored or shown on the site.
//   npm install --no-save playwright && npx playwright install chromium     (once; package.json is unchanged)
//   npm run ratings:browse                                   every group below
//   npm run ratings:browse -- --only afp                     one of them
//   npm run ratings:browse -- --only chamber --url <address> another page of theirs (one the first run listed)
// For each page: its title and text once its scripts have run, the profiled members named in it, the links and tables on
// it, and every data answer its scripts got back (address, type, size, the shape of the first item, the members named).
// Writes data/ratings-browse.txt, and copies into data/ratings-samples/ the drawn page (<key>-drawn-N.html, without
// scripts and styles) and each data answer that names members (<key>-data-N.json), at most 400 KB each. Commit and push
// them so the readers can be written.
// The browser is Playwright's Chromium as it comes (it says it is a headless Chrome), one page at a time with a pause
// between. A page that shows a bot check is recorded as such and the group left out.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {tablesOf,namesOn} from './ratings-probe.mjs';

const root=new URL('../',import.meta.url);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MAX=400000;

export const PAGES=[
  {key:'ppaction',org:'Planned Parenthood Action',urls:['https://www.plannedparenthoodaction.org/congressional-scorecard']},
  {key:'afp',org:'Americans for Prosperity',urls:['https://americansforprosperity.org/national-scorecard/']},
  {key:'chamber',org:'U.S. Chamber of Commerce',urls:['https://www.uschamber.com/how-they-voted','https://www.uschamber.com/htv']},
];

// A bot check, from what the page shows (its title and visible text), not from words in its code.
const BOT=/just a moment|attention required|verify (that )?you are (a )?human|are you a robot|captcha|access denied|request blocked/i;
export const blocked=(title,text)=>BOT.exec(`${title||''} ${String(text||'').slice(0,2000)}`)?.[0]||null;
// An answer worth listing: JSON, CSV, XML or plain text, or any script-requested answer that isn't a picture, font,
// style, script or page.
export const isData=(type,kind)=>/json|csv|xml|text\/plain/i.test(type||'')||(/^(xhr|fetch)$/.test(kind||'')&&!/image|font|css|javascript|html/i.test(type||''));
// An address as listed: any key, token or signature in it blanked out.
export const redact=u=>{try{const x=new URL(u);for(const k of [...x.searchParams.keys()])if(/key|token|secret|signature|auth|session/i.test(k))x.searchParams.set(k,'hidden');return x.href;}catch{return String(u);}};
// The shape of a JSON answer: its keys, and the keys of the first item of its list (at the top or one level down).
export function shapeOf(j){
  const first=v=>v&&typeof v==='object'?Object.keys(v).slice(0,20).join(', '):typeof v;
  if(Array.isArray(j))return `a list of ${j.length}; first item's keys: ${first(j[0])}`;
  if(j&&typeof j==='object'){const list=Object.entries(j).find(([,v])=>Array.isArray(v)&&v.length);
    return `keys: ${Object.keys(j).slice(0,20).join(', ')}${list?`; "${list[0]}" is a list of ${list[1].length}, first item's keys: ${first(list[1][0])}`:''}`;}
  return typeof j;
}
const clean=h=>String(h).replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\n\s*\n+/g,'\n').slice(0,MAX);
const RATING_LINK=/scorecard|score|member|legislator|senat|house|congress|vote|grade|rating|htv|download|csv|xlsx?|json|pdf|2025|2026/i;

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),arg=f=>{const i=args.indexOf(f);return i>=0?String(args[i+1]||''):null;};
  const only=arg('--only')?new Set(arg('--only').split(',')):null,extra=arg('--url');
  const groups=PAGES.filter(g=>!only||only.has(g.key)).map(g=>extra?{...g,urls:[extra]}:g);
  if(!groups.length){console.log(`No group with that key. The keys: ${PAGES.map(g=>g.key).join(', ')}`);process.exit(1);}
  if(extra&&groups.length!==1){console.log('With --url, name the one group it belongs to with --only.');process.exit(1);}
  let playwright;
  try{playwright=await import('playwright');}
  catch{console.log('Playwright isn\'t installed here. Run once:\n  npm install --no-save playwright\n  npx playwright install chromium\nthen run this again.');process.exit(1);}
  const research=JSON.parse(await fs.readFile(new URL('public/research.json',root),'utf8'));
  const surnames=[...new Set([...research.members,...research.cands].map(p=>String(p.name).replace(/\b(Jr|Sr|III|II)\b\.?/g,'').trim().split(/\s+/).pop()))];
  const samples=new URL('data/ratings-samples/',root);await fs.mkdir(samples,{recursive:true});
  const file=new URL('data/ratings-browse.txt',root);
  // A run for one group keeps what earlier runs found for the others (and, for another page, for this one).
  const kept=only?(await fs.readFile(file,'utf8').catch(()=>'')).trim().split('\n\n').slice(1).filter(s=>extra||!groups.some(g=>s.startsWith(`${g.org} (${g.key})`))):[];
  // Another page (--url) is numbered after the copies already saved.
  const have=await fs.readdir(samples).catch(()=>[]),last=(key,kind)=>extra?Math.max(0,...have.map(f=>Number(new RegExp(`^${key}-${kind}-(\\d+)\\.`).exec(f)?.[1]||0))):0;
  const browser=await playwright.chromium.launch();
  const out=[`Interest group scorecards opened in a browser, ${new Date().toISOString()}: what each page draws and the data its scripts load, for writing its reader.`];
  console.log(`Opening ${groups.length} group${groups.length===1?"'s":"s'"} scorecard pages in a browser (one at a time, a minute or so each)…`);
  for(const g of groups){
    const part=[`${g.org} (${g.key})${extra?' · another page':''}`];console.log(`${g.org}…`);
    let drawn=last(g.key,'drawn'),saved=last(g.key,'data');const cap=saved+12;
    for(const u of g.urls){
      const page=await browser.newPage(),answers=[];
      page.on('response',async res=>{try{const type=res.headers()['content-type']||'';if(!isData(type,res.request().resourceType()))return;
        answers.push({url:res.url(),status:res.status(),type:type.split(';')[0],body:await res.text().catch(()=>'')});}catch{}});
      let status=null,note='';
      try{status=(await page.goto(u,{waitUntil:'networkidle',timeout:60000}))?.status()??null;}
      catch(e){note=` (${String(e.message).split('\n')[0].slice(0,120)}; read what it had drawn)`;}
      // Scroll to the end, so anything drawn as it comes into view is drawn, then give its scripts a moment.
      for(let k=0;k<10;k++){await page.mouse.wheel(0,5000).catch(()=>{});await sleep(500);}
      await sleep(3000);
      const title=await page.title().catch(()=>''),html=await page.content().catch(()=>''),text=await page.evaluate(()=>document.body?.innerText||'').catch(()=>'');
      part.push(`  ${u} → HTTP ${status??'?'}${page.url()!==u?` (now ${page.url()})`:''}${note}`);
      const bot=blocked(title,text);
      if(bot){part.push(`    A bot check ("${bot}"), not the page: this group is left out.`);await page.close();await sleep(2000);continue;}
      const names=namesOn(text,surnames);
      part.push(`    title: ${title.replace(/\s+/g,' ').slice(0,110)} · ${text.length.toLocaleString('en-US')} characters of text once drawn`);
      part.push(`    profiled members named once drawn: ${names.length}${names.length?` (${names.slice(0,12).join(', ')}${names.length>12?' …':''})`:''}`);
      const links=await page.$$eval('a[href]',as=>as.map(a=>[a.href,(a.innerText||'').replace(/\s+/g,' ').trim()])).catch(()=>[]),seen=new Set();
      for(const [a,t] of links){if(seen.has(a)||!/^https?:/.test(a)||!RATING_LINK.test(`${t} ${a}`)||/facebook|twitter|x\.com|instagram|youtube|linkedin|donate|privacy|cookie/i.test(a))continue;
        seen.add(a);part.push(`    link: ${t.slice(0,60)||'(no text)'} → ${redact(a)}`);if(seen.size>=25)break;}
      for(const t of tablesOf(html))part.push(`    table: ${t}`);
      drawn++;await fs.writeFile(new URL(`${g.key}-drawn-${drawn}.html`,samples),clean(html));
      part.push(`    the drawn page: data/ratings-samples/${g.key}-drawn-${drawn}.html`);
      for(const a of answers){
        const n=namesOn(a.body,surnames);let shape;
        try{shape=shapeOf(JSON.parse(a.body));}catch{shape=`starts: ${a.body.slice(0,140).replace(/\s+/g,' ')}`;}
        part.push(`    data: ${redact(a.url).slice(0,220)} → HTTP ${a.status}, ${a.type||'no type'}, ${Math.round(a.body.length/1024)} KB · ${shape.slice(0,300)} · profiled members named: ${n.length}`);
        if(n.length>=3&&saved<cap){saved++;const f=`${g.key}-data-${saved}.${/json/i.test(a.type)?'json':'txt'}`;await fs.writeFile(new URL(f,samples),a.body.slice(0,MAX));part.push(`      saved: data/ratings-samples/${f}`);}
      }
      if(!answers.length)part.push('    no data answers: the ratings, if any, are in the drawn page');
      await page.close();await sleep(2000);
    }
    out.push('',...part);
  }
  await browser.close();
  for(const k of kept)out.push('',k);
  await fs.writeFile(file,out.join('\n')+'\n');
  console.log('\nSaved data/ratings-browse.txt and the pages in data/ratings-samples/. Commit and push them so these groups\' readers can be written.');
}
