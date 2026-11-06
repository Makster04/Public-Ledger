// Campaign promises, step 1: the text of what each person told voters, from their campaign website as it stood just
// before each election day since 2016 (the Wayback Machine's last saved copy), and their campaign-season Bluesky and
// Threads posts. Text only: no video or audio. Steps 2–4 (finding each promise, matching it to what they did, and the
// verdict) read what this writes.
//   npm run campaign:collect                    everyone with a profile on the site
//   npm run campaign:collect -- --only collins  one person
//   npm run campaign:collect -- --pages 20      issue pages read for each campaign (default 12)
// Which website: the campaign site in data/config.json ("campaignSite", and "campaignSites" for earlier addresses),
// and the website the person's campaign committee gave the FEC (with FEC_API_KEY in .dev.vars). Official .gov sites
// and social media pages aren't campaign sites, so they are left out. Which elections: the years the FEC lists the
// person on the ballot, or, without the FEC, every even year for the House and the seat's years for the Senate.
// Which pages: the homepage, the pages it links to about where they stand ("Issues", "Priorities", "Plan") with the
// pages under an issues page, and any page of the site the Wayback Machine saved whose address says so (/issues,
// /priorities, /on-the-issues): a site's last copy before election day is often only a donate or vote reminder, and
// some menus are drawn by scripts. Every campaign the FEC lists for the person counts, House and Senate, each with
// its committee's website. Pages are kept on this computer in .local/campaign-pages/, so a campaign is read
// once; the text goes to data/campaign-text/<id>.json. Wayback pages are read about one a second.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {requestSource} from '../src/sources.mjs';
import {ownDomain,sameName} from '../src/feeds.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const OUT=path.join(root,'data','campaign-text'),CACHE=path.join(root,'.local','campaign-pages');
const pad=n=>String(n).padStart(2,'0');

// Election day: the Tuesday after the first Monday in November.
export function electionDay(year){
  const dow=new Date(Date.UTC(year,10,1)).getUTCDay(),monday=1+((8-dow)%7);
  return `${year}-11-${pad(monday+1)}`;
}
// A campaign website's address, from config or the FEC ("WWW.SUSANCOLLINS.COM"), or null for an official .gov site, a
// social media or donation page, or something that isn't an address.
export function campaignSite(u){
  let s=String(u||'').trim();if(!s)return null;
  if(!/^https?:\/\//i.test(s))s='https://'+s.replace(/^\/+/,'');
  let url;try{url=new URL(s.toLowerCase().startsWith('http://')?'https://'+s.slice(7):s);}catch{return null;}
  const host=url.hostname.toLowerCase();
  if(!host.includes('.')||/\.(gov|mil)$/.test(host)||!ownDomain(url.href))return null;
  return {root:`https://${host}/`,page:url.pathname.length>1?`https://${host}${url.pathname}`:null,host:host.replace(/^www\./,'')};
}
// The years someone was on the ballot from `from` to `to`: the FEC's list for the campaign on file; for a sitting House
// member, every even year since they took office as well (a House member running for the Senate has a Senate record on
// file, whose list starts this year); without the FEC, a senator's seat years (its class, from research.json's
// "Class 2 · …"); and this year's election for a candidate.
export function campaignYears({fecYears,chamber,seat,inOffice,cycle,since},from,to){
  const within=y=>y>=from&&y<=to,years=[];
  const fec=Array.isArray(fecYears)&&fecYears.length;if(fec)years.push(...fecYears.map(Number).filter(within));
  if(inOffice&&chamber==='H'){const took=Number(/\b(19|20)\d{2}\b/.exec(String(since||''))?.[0])||from;for(let y=Math.max(from,took-1);y<=to;y++)if(y%2===0)years.push(y);}
  else if(!fec&&inOffice&&chamber==='S'){const c=/Class ([123])/.exec(seat||'');if(c){const first={1:2018,2:2020,3:2016}[c[1]];for(let y=first-6*Math.ceil((first-from)/6);y<=to;y+=6)if(within(y))years.push(y);}}
  if(cycle&&within(cycle))years.push(cycle);
  return [...new Set(years)].sort((a,b)=>a-b);
}

// ---------- A page as text ----------
const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',mdash:'—',ndash:'–',hellip:'…',bull:'•',middot:'·',copy:'©',reg:'®',trade:'™'};
export const decode=s=>String(s||'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1))):ENTITIES[e.toLowerCase()]??m);
// Lines every campaign site has that say nothing about a position.
const CHROME=/^(?:(?:reply|retweet|like) on twitter|comment on facebook|\d+ comments?\b|load more|view on (?:instagram|facebook|twitter|x)\b|donate|volunteer|contribute|chip in|sign up|subscribe|join (?:us|the team|our team)|get involved|menu|search|home|skip to|close|paid for by|authorized by|©|copyright|privacy|terms|all rights reserved|follow|share|tweet|email|e-mail|phone|address|shop|store|merch|events?|news|press|contact|read more|learn more|click here|back to top|submit|first name|last name|zip|mobile|text|cookie)/i;
// The page's title, and its text: headings as "## …", list items as "- …", one paragraph a line, without scripts,
// menus, footers, forms and the lines every page of a campaign site repeats.
export function pageText(html){
  let h=String(html||'');
  const title=decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1]||'').replace(/\s+/g,' ').trim());
  const raw=h;
  // (Some site builders wrap the whole page in one form, and accordions put each issue's heading in a button: their
  // text stays; inputs, menus and footers go.)
  h=h.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|svg|template|iframe|nav|footer|select|textarea|label|head)\b[\s\S]*?<\/\1>/gi,' ').replace(/<input\b[^>]*>/gi,' ').replace(/<button\b[^>]*>([\s\S]*?)<\/button>/gi,'\n## $1\n');
  // Link text is marked, so a line that is only links (a menu, a row of buttons) can be told apart.
  h=h.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi,'\u0001$1\u0002');
  h=h.replace(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi,(m,t)=>`\n## ${t}\n`).replace(/<li\b[^>]*>/gi,'\n- ').replace(/<\/?(?:p|div|br|section|article|tr|td|blockquote|ul|ol|header|main|aside)\b[^>]*>/gi,'\n');
  const own=l=>l.replace(/\u0001[^\u0002]*\u0002?/g,' ').replace(/^(?:## |- )/,'').trim().split(/\s+/).filter(Boolean).length;
  const lines=decode(h.replace(/<[^>]+>/g,' ')).split('\n').map(l=>l.replace(/[ \t\u00a0]+/g,' ').trim()).filter(Boolean)
    .filter(l=>!/\u0001/.test(l)||own(l)>=2).map(l=>l.replace(/[\u0001\u0002]/g,'').replace(/\s+/g,' ').trim());
  const out=[];
  for(const l of lines){
    const body=l.replace(/^(?:## |- )/,'').trim();
    if(!body||CHROME.test(body))continue;
    const heading=l.startsWith('## ');
    // (three words is enough for a list's point: "Protect Social Security")
    if(!heading&&body.split(/\s+/).length<3)continue;
    if(out.at(-1)===l)continue;
    out.push(heading?`## ${body}`:l.startsWith('- ')?`- ${body}`:body);
  }
  // A heading with nothing under it (a menu's leftovers) goes.
  let text=out.filter((l,i)=>!(l.startsWith('## ')&&(i+1>=out.length||out[i+1].startsWith('## ')))).join('\n');
  // A page drawn by scripts shows almost nothing; its words are often in the page's data instead.
  if(text.length<200){const more=scriptText(raw).filter(l=>!text.includes(l));if(more.length)text=[text,...more].filter(Boolean).join('\n');}
  return {title,text:text.slice(0,40_000)};
}
// Sentences in a page's data (JSON in its scripts: Next.js, Wix, Squarespace), for a page drawn by scripts.
export function scriptText(html){
  const out=new Set();
  for(const m of String(html||'').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
    if(!/^\s*[[{]|__NEXT_DATA__|__INITIAL|warmupData|Static\.SQUARESPACE/.test(m[1])&&!/application\/(?:ld\+)?json/i.test(m[0].slice(0,200)))continue;
    for(const q of m[1].matchAll(/"((?:[^"\\]|\\.){40,3000})"/g)){
      let t;try{t=JSON.parse(`"${q[1]}"`);}catch{continue;}
      t=decode(t.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
      if(t.split(' ').length>=8&&/[a-z]{3,} [a-z]{3,}/i.test(t)&&!/^https?:|[{};]|\.(?:js|css|png|jpg)\b|function\s*\(/.test(t)&&!CHROME.test(t))out.add(t);
    }
  }
  return [...out].slice(0,200);
}
// The lines repeated on most of a campaign's pages (a sign-up box, a slogan) are the site's, not a position.
export function dropRepeated(pages){
  if(pages.length<3)return pages;
  const seen=new Map();for(const p of pages)for(const l of new Set(p.text.split('\n')))seen.set(l,(seen.get(l)||0)+1);
  return pages.map(p=>({...p,text:p.text.split('\n').filter(l=>l.startsWith('## ')||seen.get(l)<pages.length*0.6).join('\n')}));
}

// ---------- Links to where they stand ----------
const ISSUE=/\b(?:issues?|priorit\w*|platform|plans?|agenda|positions?|where[-\s]i[-\s]stand|stands?|polic\w*|vision|values|record|accomplishments?|commitments?|promises?|on[-\s]the[-\s]issues|fighting[-\s]for|contract)\b/i;
const NOT_ISSUE=/donat|volunteer|\bevents?\b|\bnews\b|\bpress\b|\bblog\b|store|shop|merch|contact|privacy|terms|login|cart|account|wp-(?:content|admin|json)|\/feed|\/tag\/|\/category\/|\/author\/|\.(?:pdf|jpe?g|png|gif|zip|mp4|mp3|webp|svg)(?:$|\?)|mailto:|tel:|javascript:/i;
const clean=u=>{const x=new URL(u);x.hash='';x.search='';return x.href.replace(/\/$/,'');};
// The same page with or without "www.".
const pageKey=u=>clean(u).replace(/^https?:\/\/(?:www\.)?/,'');
// The links on a page to the same site's pages about positions, most likely first. under: only pages below this path
// (the issue pages under an "Issues" page).
export function issueLinks(html,base,{under=null}={}){
  const host=new URL(base).hostname.replace(/^www\./,''),out=new Map();
  for(const m of String(html||'').matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    let u;try{u=new URL(decode(m[1]),base);}catch{continue;}
    if(!/^https?:$/.test(u.protocol)||u.hostname.replace(/^www\./,'')!==host||NOT_ISSUE.test(u.href))continue;
    const text=decode(m[2].replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim(),href=clean(u.href),p=new URL(href).pathname;
    if(p==='/'||p==='')continue;
    if(under?!(p.startsWith(under.replace(/\/$/,'')+'/')):!(ISSUE.test(p.replace(/[-_/]/g,' '))||ISSUE.test(text)))continue;
    const score=linkScore(p,text);
    const k=pageKey(href);if(!out.has(k)||out.get(k).score<score)out.set(k,{url:out.get(k)?.url||href,text,score});
  }
  return [...out.values()].sort((a,b)=>b.score-a.score);
}
// How likely a page is to be about where they stand: its address, then its link text, shallower first.
export const linkScore=(p,text='')=>(ISSUE.test(p.replace(/[-_/]/g,' '))?2:0)+(ISSUE.test(text)?1:0)-p.split('/').filter(Boolean).length*0.1;
// Saved pages of a site (from the Wayback Machine's list) that look like they are about positions, as links.
export function savedIssuePages(urls,base){
  const host=new URL(base).hostname.replace(/^www\./,''),out=new Map();
  for(const u of urls){let x;try{x=new URL(u);}catch{continue;}
    if(!x.hostname.replace(/^www\./,'').endsWith(host)||NOT_ISSUE.test(x.href)||x.search)continue;
    const p=x.pathname.replace(/\/$/,'');if(!p||p.split('/').filter(Boolean).length>3||!ISSUE.test(p.replace(/[-_/]/g,' ')))continue;
    const href=`https://${x.hostname}${p}`,k=pageKey(href);if(!out.has(k))out.set(k,{url:href,text:'',score:linkScore(p)});}
  return [...out.values()].sort((a,b)=>b.score-a.score);
}
// An "Issues" page whose pages are below it (/issues/health-care): its path, else null.
export const indexPath=u=>{const p=new URL(u).pathname.replace(/\/$/,'');return /^\/[^/]*(?:issues?|priorit|platform|agenda|plans?|positions?|polic)[^/]*$/i.test(p)?p:null;};

// ---------- The Wayback Machine ----------
const stamp=d=>d.replace(/-/g,'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Requests to the Wayback Machine, about one a second; a 429 waits a minute and tries once more.
export function wayback(env,{wait=1000,cache=CACHE}={}){
  let last=0;
  const get=async(url,opts)=>{
    const gap=last+wait-Date.now();if(gap>0)await sleep(gap);last=Date.now();
    try{return await requestSource(url,env,opts);}
    catch(e){if(e.statusCode!==429&&!(e.statusCode>=500))throw e;await sleep(wait*60);last=Date.now();return requestSource(url,env,opts);}
  };
  return {
    // The last saved copy of a page from `from` through `to` (YYYY-MM-DD): {ts, original} or null.
    async last(page,from,to){
      // (An answer with no saved copy can be empty rather than an empty list.)
      const t=await get(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(page)}&from=${stamp(from)}&to=${stamp(to)}&filter=statuscode:200&fl=timestamp,original&output=json&limit=-1&fastLatest=true`,{as:'text',allow:[404]});
      let d=null;try{d=t&&t.trim()?JSON.parse(t):null;}catch{d=null;}
      const row=Array.isArray(d)?d.slice(1).at(-1):null;
      return row&&/^\d{14}$/.test(row[0])?{ts:row[0],original:row[1]}:null;
    },
    // Every page of a site saved from `from` through `to` whose address looks like it is about positions.
    async issuePages(host,from,to){
      const re='(?i).*(issue|priorit|platform|plan|agenda|position|stand|polic|vision|values|record|accomplish|commitment|promise|contract|fighting).*';
      const t=await get(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}&matchType=domain&from=${stamp(from)}&to=${stamp(to)}&filter=statuscode:200&filter=${encodeURIComponent(`original:${re}`)}&fl=original&collapse=urlkey&output=json&limit=300`,{as:'text',allow:[404]});
      let d=null;try{d=t&&t.trim()?JSON.parse(t):null;}catch{d=null;}
      return Array.isArray(d)?d.slice(1).map(r=>r[0]).filter(Boolean):[];
    },
    // The page as it was saved, without the Wayback Machine's banner (its "id_" address), kept on this computer.
    async page({ts,original}){
      const file=path.join(cache,crypto.createHash('sha1').update(`${ts} ${original}`).digest('hex')+'.html');
      if(fs.existsSync(file))return fs.readFileSync(file,'utf8');
      const html=await get(`https://web.archive.org/web/${ts}id_/${original}`,{as:'text',follow:true,maxChars:8_000_000});
      fs.mkdirSync(cache,{recursive:true});fs.writeFileSync(file,html||'');return html||'';
    },
  };
}
const captured=ts=>`${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
// One campaign: the site as it stood on election day of `year`, its issue pages, as text.
export async function readCampaign(wb,site,year,{pages:max=12}={}){
  const day=electionDay(year);let home=await wb.last(site.root,`${year}-01-01`,day);
  if(!home)return {year,electionDay:day,site:site.root,saved:false,pages:[]};
  let html=await wb.page(home),homeText=pageText(html);
  // A last copy that is only a donate or vote reminder: the one from three weeks before, if it says more.
  if(homeText.text.length<600){const earlier=await wb.last(site.root,`${year}-01-01`,new Date(Date.parse(day)-21*86400000).toISOString().slice(0,10));
    if(earlier&&earlier.ts!==home.ts){const h2=await wb.page(earlier),t2=pageText(h2);if(t2.text.length>homeText.text.length){home=earlier;html=h2;homeText=t2;}}}
  const pages=[{url:`https://web.archive.org/web/${home.ts}/${home.original}`,original:home.original,date:captured(home.ts),...homeText}];
  // The pages to read: the address on file if it is a page, then the homepage's links, then the pages under an
  // "Issues" page, until `max`.
  // The homepage's links first, then the other saved pages whose addresses say they are about positions.
  const linked=issueLinks(html,home.original),listed=savedIssuePages(await wb.issuePages(site.host,`${year-1}-01-01`,day),home.original);
  const queue=[...(site.page&&!NOT_ISSUE.test(site.page)?[{url:site.page}]:[]),...linked,...listed.filter(l=>!linked.some(x=>pageKey(x.url)===pageKey(l.url)))],seen=new Set([pageKey(home.original)]),missing=[];
  while(queue.length&&pages.length<=max){
    const {url}=queue.shift(),key=pageKey(url);if(seen.has(key))continue;seen.add(key);
    // An issue page is often saved less often than the homepage: from the year before.
    const cap=await wb.last(url,`${year-1}-01-01`,day);
    if(!cap){missing.push(url);continue;}
    const h=await wb.page(cap);pages.push({url:`https://web.archive.org/web/${cap.ts}/${cap.original}`,original:cap.original,date:captured(cap.ts),...pageText(h)});
    const under=indexPath(url);if(under)queue.unshift(...issueLinks(h,cap.original,{under}).filter(l=>!seen.has(pageKey(l.url))));
  }
  return {year,electionDay:day,site:site.root,saved:true,capture:{date:captured(home.ts),url:pages[0].url},pages:dropRepeated(pages).filter(p=>p.text),...(missing.length?{notSaved:missing}:{})};
}
// Their Bluesky and Threads posts from July 1 to election day, from the local database (what the refresh collected).
export function campaignPosts(db,person,year){
  if(!db)return [];
  const from=`${year}-07-01`,to=electionDay(year);
  const rows=db.prepare("SELECT j.kind,r.payload FROM jobs j JOIN records r ON r.run_id=j.published_run WHERE j.kind IN ('bluesky','threads') AND j.subject=?").all(person);
  const out=new Map();
  for(const {kind,payload} of rows){const r=JSON.parse(payload);if(!r.text||!r.url||!r.date||r.date<from||r.date>to)continue;out.set(r.url,{date:r.date.slice(0,10),source:kind,url:r.url,text:r.text});}
  return [...out.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

// ---------- Where the FEC says their campaign is ----------
// Every campaign the FEC lists for the person (their candidacy on file, and others of theirs in the same state: a
// House member now running for the Senate has a House candidacy too), with the years on the ballot and each principal
// committee's website. {websites, years}, or null without a key.
export async function fecFacts(p,env){
  if(!env.FEC_API_KEY)return null;
  const ids=new Set(p.fecCand?[p.fecCand]:[]),years=new Set(),websites=new Set();
  const last=String(p.name||'').replace(/,?\s+(Jr\.?|Sr\.?|III|II|IV)$/i,'').trim().split(/\s+/).at(-1);
  try{if(last&&p.state){const d=await requestSource(`https://api.open.fec.gov/v1/candidates/?q=${encodeURIComponent(last)}&state=${p.state}&per_page=50`,env);
    for(const c of d?.results||[]){const [l,f]=String(c.name||'').split(',');if(c.candidate_id&&sameName(f||'',l||'',p))ids.add(c.candidate_id);}}}catch{}
  for(const id of ids){
    try{const d=await requestSource(`https://api.open.fec.gov/v1/candidate/${id}/`,env);for(const y of d?.results?.[0]?.election_years||[])years.add(Number(y));}catch{}
    try{const d=await requestSource(`https://api.open.fec.gov/v1/candidate/${id}/committees/?designation=P&per_page=20`,env);
      for(const c of d?.results||[]){let w=c.website;if(!w&&c.committee_id){try{w=(await requestSource(`https://api.open.fec.gov/v1/committee/${c.committee_id}/`,env))?.results?.[0]?.website;}catch{}}if(w)websites.add(w);}}catch{}
  }
  try{if(p.fecCmte&&!websites.size){const d=await requestSource(`https://api.open.fec.gov/v1/committee/${p.fecCmte}/`,env);if(d?.results?.[0]?.website)websites.add(d.results[0].website);}}catch{}
  return {websites:[...websites],years:[...years].sort((a,b)=>a-b),candidacies:[...ids]};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=(name,d)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:d;};
  const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  const config=read('data/config.json'),research=read('public/research.json'),env=process.env;
  const from=Number(config.historyFrom)||2016,to=Number(config.year)||new Date().getFullYear(),max=Number(arg('--pages',12)),only=arg('--only',null);
  const cfg=new Map(config.people.map(p=>[p.id,p]));
  // The people with a profile (the president's promises come from PolitiFact's tracker instead).
  const people=[...research.members,...research.cands].filter(p=>!only||p.id===only).map(p=>({...p,...(cfg.get(p.id)||{}),seat:p.seat,since:p.since}));
  if(!people.length){console.log(only?`No profile with the id "${only}".`:'No profiles in public/research.json.');process.exit(1);}
  const dbFile=path.join(root,'.local','records.sqlite'),db=fs.existsSync(dbFile)?new DatabaseSync(dbFile,{readOnly:true}):null;
  if(!env.FEC_API_KEY)console.log('No FEC_API_KEY in .dev.vars: only the campaign sites in data/config.json are read, and the election years are estimated.');
  fs.mkdirSync(OUT,{recursive:true});
  const wb=wayback(env),noSite=[],skipped=[],summary=[];
  console.log(`Reading the campaign websites of ${people.length} people from the Wayback Machine (about one page a second; pages read before are kept)…`);
  for(const p of people){
    const fec=await fecFacts(p,env);
    const given=[p.campaignSite,...(p.campaignSites||[])].filter(Boolean),sites=new Map();
    for(const u of [...given,...(fec?.websites||[])]){const s=campaignSite(u);if(s&&!sites.has(s.host))sites.set(s.host,s);}
    for(const u of given)if(!campaignSite(u))skipped.push(`${p.id}: ${u}`);
    if(!sites.size){noSite.push(p.id);continue;}
    const years=campaignYears({fecYears:fec?.years,chamber:p.chamber,seat:p.seat,inOffice:p.inOffice,cycle:config.cycle,since:p.since},from,to),campaigns=[];
    for(const year of years)for(const site of sites.values()){
      try{const c=await readCampaign(wb,site,year,{pages:max});if(c.saved||sites.size===1){c.posts=campaignPosts(db,p.id,year);campaigns.push(c);}}
      catch(e){campaigns.push({year,electionDay:electionDay(year),site:site.root,saved:false,error:e.message,pages:[],posts:[]});}
    }
    const file={about:'What this person told voters in each campaign since 2016: their campaign website as saved by the Wayback Machine just before election day (the homepage and the pages about where they stand), as text, and their campaign-season Bluesky and Threads posts. From scripts/collect-campaign-text.mjs; the promises in it are found by step 2.',
      person:p.id,name:p.name,built:new Date().toISOString().slice(0,10),sites:[...sites.values()].map(s=>s.root),years,campaigns};
    fs.writeFileSync(path.join(OUT,`${p.id}.json`),JSON.stringify(file,null,1)+'\n');
    const saved=campaigns.filter(c=>c.saved);
    summary.push(`  ${p.id.padEnd(14)} ${years.join(', ')||'no election years'}: ${saved.length?saved.map(c=>`${c.year} ${c.pages.length} page${c.pages.length===1?'':'s'}${c.posts.length?` + ${c.posts.length} posts`:''}`).join('; '):'no saved copy before an election day'}`);
    console.log(summary.at(-1));
  }
  const files=fs.readdirSync(OUT).filter(f=>f.endsWith('.json')).length;
  console.log(`\nWrote data/campaign-text/ (${files} people).`);
  if(noSite.length)console.log(`No campaign website found for ${noSite.length}: ${noSite.join(', ')}. Add one as "campaignSite" (or older ones as "campaignSites": [...]) in data/config.json${env.FEC_API_KEY?'':', or add FEC_API_KEY to .dev.vars so the FEC\'s can be used'}.`);
  if(skipped.length)console.log(`Not campaign sites, so not read (official .gov sites and social media pages): ${skipped.join('; ')}.`);
  console.log('\nCommit and push data/campaign-text/ so the promises in it can be checked.');
}
