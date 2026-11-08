// Interest groups' published ratings of the profiled members, for the Ideology tab's group ratings and its Ratings lean
// (public/six-scores.js, ratingsLean). Each group's reader was written from what its own site serves
// (npm run ratings:probe, data/ratings-probe.txt). Ratings are kept exactly as each group gives them, with the year and
// a link to the group's page.
//   npm run ratings:collect                 every group with a reader
//   npm run ratings:collect -- --only lcv   one of them
// Writes public/group-ratings.json:
//   {checked, groups: {key: {org, lean, issue, url, year, read, why?}},
//    people: {id: [{group, org, lean, issue, score?, grade?, year, url, name}]}}
// It asks as Public Ledger, a page at a time with a pause between. A site that answers with a bot check is left out
// and said so; nothing is typed in by hand.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {botCheck} from './county-results.mjs';
import {pdfText} from '../src/pdf.mjs';
import {xlsxSheets} from './xlsx.mjs';

const root=new URL('../',import.meta.url);
const UA='Mozilla/5.0 (compatible; PublicLedger/1.0; interest group scorecards)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ENT={'&amp;':'&','&#39;':"'",'&rsquo;':"'",'&#8217;':"'",'&quot;':'"','&nbsp;':' ','&#8211;':'-'};
const text=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/&[#a-z0-9]+;/gi,m=>ENT[m]??' ').replace(/\s+/g,' ').trim();

export const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};
const CODE=Object.fromEntries(Object.entries(STATES).map(([k,v])=>[v.toLowerCase(),k]));
// A state as its two-letter code, from a code, a name, or a district like "OK-04".
export const stateCode=v=>{const t=String(v||'').trim();const m=/^([A-Z]{2})(?:-\d+|-AL)?$/.exec(t);return m?m[1]:CODE[t.toLowerCase()]||null;};

// ---------- The readers: each takes a page's HTML and returns [{name, state, chamber?, party?, score?|grade?, year?, url?}] ----------
// SBA Pro-Life America (sbaprolife.org/scorecard): two tables, Senate (Senator | Party | State | Rating | Status) and House
// (Representative | Party | District | Rating | Status); the rating is a letter grade, A+ to F, for the Congress the page names.
export function readSba(html){
  const out=[];
  // The page says which Congress it covers ("…during the 119th Congress").
  const n=/during the (\d{3})(?:st|nd|rd|th) Congress/i.exec(text(html))?.[1],year=n?congressLabel(Number(n)):null;
  // Each table runs to the next one (or the end of the page), so a page cut short still reads.
  const parts=String(html).split(/<table\b[^>]*id="sc_dt_/i).slice(1);
  for(const t of parts){
    const head=text(/<thead\b[\s\S]*?<\/thead>/i.exec(t)?.[0]||'');if(!/rating/i.test(head))continue;
    const chamber=/senator/i.test(head)?'S':'H';
    for(const r of t.split(/<\/table>/i)[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)){
      const cells=[...r[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>c[1]);if(cells.length<4)continue;
      const link=/href="([^"]+)"/.exec(cells[0])?.[1]||null,grade=text(cells[3]);
      if(!/^[A-F][+-]?$/.test(grade))continue;
      out.push({name:text(cells[0]),party:text(cells[1]),state:stateCode(text(cells[2])),chamber,grade,status:text(cells[4]||''),url:link,...(year?{year}:{})});
    }
  }
  return out;
}
// LCV (lcv.org/congressional-scorecard/members-of-congress/): members by state, each card "Last, First", party, the
// year's score and the lifetime score.
export function readLcv(html){
  const out=[];
  for(const st of String(html).split(/<h5 class="state-title">/).slice(1)){
    const state=stateCode(text(st.slice(0,st.indexOf('</h5>'))));
    for(const c of st.split(/<li class="congress-item">/).slice(1)){
      const link=/<a href="([^"]+)" class="card-link">([\s\S]*?)<\/a>/.exec(c);if(!link)continue;
      const [last,first]=text(link[2]).split(/,\s*/);
      const year=/<span class="year">(\d{4})<\/span>/.exec(c)?.[1]||null;
      const scores=[...c.matchAll(/<span class="data-score">([\s\S]*?)<\/span>/g)].map(m=>text(m[1]));
      const score=/^(\d{1,3})%$/.exec(scores[0]||'')?.[1],life=/^(\d{1,3})%$/.exec(scores[1]||'')?.[1];
      if(score==null&&life==null)continue;
      out.push({name:`${first||''} ${last}`.trim(),state,party:text(/<p class="congress-party[^"]*">([\s\S]*?)<\/p>/.exec(c)?.[1]),score:score==null?null:Number(score),lifetime:life==null?null:Number(life),year:year?Number(year):null,url:link[1]});
    }
  }
  return out;
}
// Reproductive Freedom for All (reproductivefreedomforall.org/congressional-record-on-reproductive-freedom/?pg=N): a
// table page by page; each member's annual scores, one per year, shown by year. The latest year with a number counts.
export function readRfa(html){
  const out=[];
  const table=/<table\b[^>]*class="[^"]*votes1[\s\S]*?<\/table>/i.exec(String(html));if(!table)return out;
  for(const r of table[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)){
    const name=/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(r[0]);if(!name)continue;
    const cells=[...r[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>c[1]);
    const years=[...r[0].matchAll(/x-show="vote_year == (\d{4})">\s*<span>([^<]*)<\/span>/g)].map(m=>({year:Number(m[1]),v:text(m[2]).replace('%','')})).filter(x=>/^\d{1,3}$/.test(x.v));
    const last=years.at(-1);if(!last)continue;
    out.push({name:text(name[2]),state:stateCode(text(cells[0])),chamber:/senate/i.test(text(cells[1]))?'S':'H',party:text(cells[2]),district:text(cells[3]),score:Number(last.v),year:last.year,url:name[1]});
  }
  return out;
}
// Whether a page has a next page of the RFA table.
const rfaHasNext=(html,pg)=>new RegExp(`\\?pg=${pg+1}["']`).test(String(html));

// "119th Congress" from 119.
export const congressLabel=n=>{const k=n%100,s=k>=11&&k<=13?'th':({1:'st',2:'nd',3:'rd'})[n%10]||'th';return `${n}${s} Congress`;};
// The Congress sitting in a year (the 119th in 2025 and 2026).
export const congressOf=year=>Math.floor((year-1789)/2)+1;
const unattr=s=>String(s).replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

// Heritage Action (heritageaction.com/scorecard/members/<Congress>): every member's score for that Congress so far, in the
// page's members list (a data attribute its scripts read): name, Bioguide ID, chamber, state, district, party, score.
// Each member is read on their own, so a page cut short still reads.
export function readHeritage(html){
  const s=String(html),i=s.indexOf(':members="');if(i<0)return [];
  const out=[];
  for(const m of unattr(s.slice(i+10)).matchAll(/\{"title"[^{}]*\}/g)){
    let o;try{o=JSON.parse(m[0]);}catch{continue;}
    const score=/^\d{1,3}$/.test(String(o.score??'').trim())?Number(o.score):null;if(score==null)continue;
    out.push({name:o.name,state:stateCode(o.state),chamber:/senate/i.test(o.chamber)?'S':'H',party:o.party,district:o.district||null,bioguide:/^[A-Z]\d{6}$/.test(o.congId)?o.congId:null,score,url:o.url?new URL(o.url,'https://heritageaction.com').href:null});
  }
  return out;
}
// Club for Growth (clubforgrowth.org/scorecards/app/?chamber=S|H&yr=<year>): one table per chamber and year; each row
// State | Dist | Party | Name (linked, with the Bioguide ID) | Rank | Score | Lifetime.
export function readClubForGrowth(html,{chamber=null,year=null}={}){
  const out=[];
  for(const r of String(html).split(/<tr class="scorecard-row/).slice(1)){
    const row=r.split(/<\/tr>/)[0],cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>c[1]);if(cells.length<7)continue;
    const link=/href="([^"]+)"/.exec(cells[3])?.[1]||null,pct=v=>/^(\d{1,3})%$/.exec(text(v))?.[1];
    const score=pct(cells[5]),life=pct(cells[6]);if(score==null&&life==null)continue;
    out.push({name:text(cells[3]),state:stateCode(text(cells[0])),chamber:chamber||(text(cells[1])==='00'?'S':'H'),party:text(cells[2]),bioguide:/\/legislator\/([A-Z]\d{6})\//.exec(link||'')?.[1]||null,
      score:score==null?null:Number(score),lifetime:life==null?null:Number(life),year,url:link?new URL(link,'https://www.clubforgrowth.org').href:null});
  }
  return out;
}
// The newest year on Club for Growth's scorecards page, and its Senate and House tables' addresses.
export function cfgLatest(html){
  const links=[...String(html).matchAll(/href="([^"]*\/scorecards\/app\/\?[^"]*)"/g)].map(m=>unattr(m[1]));
  const at=(c,y)=>links.find(u=>new RegExp(`[?&]chamber=${c}&`).test(u)&&new RegExp(`[?&]yr=${y}(&|$)`).test(u));
  const years=[...new Set(links.map(u=>Number(/[?&]yr=(\d{4})/.exec(u)?.[1])).filter(Boolean))].sort((a,b)=>b-a);
  const year=years.find(y=>at('S',y)||at('H',y));
  return year?{year,pages:[['S',at('S',year)],['H',at('H',year)]].filter(([,u])=>u).map(([chamber,u])=>({chamber,url:new URL(u,'https://www.clubforgrowth.org').href}))}:null;
}

// ---------- Readers added November 8, 2026 (from npm run ratings:probe and ratings:browse) ----------
// VoterVoice, the advocacy platform some groups' scorecard pages draw from: a group's scorecards, then each member's score.
export const VV='https://www.votervoice.net/Api';
// The newest of a group's scorecards: the latest Congress or year in its name, else the first listed.
export function newestScorecard(list){
  const end=s=>{const t=String(s?.name||''),c=/(\d{3})(?:st|nd|rd|th)\s+Congress/i.exec(t);if(c)return 1788+2*Number(c[1]);const y=t.match(/\b20\d\d\b/g);return y?Math.max(...y.map(Number)):0;};
  return [...(Array.isArray(list)?list:[])].map((s,i)=>({s,i})).sort((a,b)=>end(b.s)-end(a.s)||a.i-b.i)[0]?.s||null;
}
export function readVoterVoice(list,{year=null}={}){
  const out=[];
  for(const s of Array.isArray(list)?list:[]){
    const o=s?.official,office=o?.office||{};if(!o||!Number.isFinite(s.score))continue;
    const chamber=/senate/i.test(office.electedBody)?'S':/house/i.test(office.electedBody)?'H':null;if(!chamber)continue;
    const d=String(office.electoralDistrict||'');
    out.push({name:`${o.givenNames||''} ${o.surname||''}`.trim(),state:stateCode(office.state),chamber,party:o.party||null,district:chamber==='H'&&/^\d+$/.test(d)?Number(d):null,score:Math.round(s.score),year});
  }
  return out;
}
// Americans for Prosperity (americansforprosperity.org/national-scorecard): its page draws from its own data address,
// every legislator with a score for each Congress; the newest Congress counts. The photo's file name is the Bioguide ID.
export function readAfp(list){
  const out=[];
  for(const o of Array.isArray(list)?list:[]){
    const sets=(o?.score_sets||[]).filter(s=>Number.isFinite(Number(s?.score))&&s.score!==null&&s.score!=='');if(!sets.length)continue;
    const s=sets.reduce((a,b)=>Number(b.sessionid)>Number(a.sessionid)?b:a);
    const chamber=/senate/i.test(o.chamber)?'S':/house/i.test(o.chamber)?'H':null;if(!chamber)continue;
    out.push({name:`${o.first_name||''} ${o.last_name||''}`.trim(),state:stateCode(o.state),chamber,party:o.party||null,
      district:chamber==='H'&&/^\d+$/.test(String(o.sub_district||''))?Number(o.sub_district):null,
      bioguide:/\/([A-Z]\d{6})\.(?:jpe?g|png|webp)\b/i.exec(o.photo||'')?.[1]?.toUpperCase()||null,score:Math.round(Number(s.score)),
      year:/^\d{3}(st|nd|rd|th)$/.test(s.niceTitle||'')?`${s.niceTitle} Congress`:(s.niceTitle||null),
      url:o.id?`https://americansforprosperity.org/national-scorecard/#/legislator/${o.id}`:null});
  }
  return out;
}
// Gun Owners of America (gunowners.org/grades): its voter guide grades every candidate for Congress, A+ to F-, the
// incumbents starred; the year is the guide's. Only the congressional entries count. Its districts are the election's,
// drawn anew in some states, so they aren't matched against members' current seats (kept as `race`).
export function readGoa(html){
  const s=String(html),year=Number(/(\d{4})\s+Voter Guide/i.exec(s)?.[1])||null,out=[];
  for(const b of s.split(/<div class="rating-item"/).slice(1)){
    if(!/^\s*data-filter-group="[^"]*\bus-congress\b/.test(b))continue;
    const m=/^(.+?)(\*)?\s*\(([A-Z])\)$/.exec(text(/<h3 class="blogPostTitle">([\s\S]*?)<\/h3>/.exec(b)?.[1]));if(!m)continue;
    const grade=text(/<div class="ratingAlpha[^"]*">([\s\S]*?)<\/div>/.exec(b)?.[1]);if(!/^[A-F][+-]?$/.test(grade))continue;
    const seat=text(/<div class="ratingTags">([\s\S]*?)<\/div>/.exec(b)?.[1]),chamber=/senate/i.test(seat)?'S':'H',d=/district\s+(\d+)/i.exec(seat)?.[1];
    out.push({name:m[1].trim(),incumbent:!!m[2],party:m[3],state:stateCode(text(/<div class="postTags">([\s\S]*?)<\/div>/.exec(b)?.[1])),chamber,
      race:chamber==='H'?(d?Number(d):/at.?large/i.test(seat)?0:null):null,grade,year});
  }
  return out;
}
// Alliance for Retired Americans (its yearly Congressional Voting Record, a PDF): by state, senators first, then House
// members with their district; each member by last name and party, their votes, then the year's score and their lifetime
// score. Matched on last name, state, chamber and district.
const STATE_BY_NAME=Object.fromEntries(Object.entries(STATES).map(([k,v])=>[v,k]));
export function readAra(pdfText){
  const lines=String(pdfText).split('\n').map(l=>l.trim()).filter(Boolean),out=[];
  const span=/January\s+(\d{4})\s*[—–-]\s*December\s+(\d{4})/.exec(lines.slice(0,40).join(' ')),year=span?Number(span[2]):null;
  let state=null,house=false;
  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(STATE_BY_NAME[l]){state=STATE_BY_NAME[l];continue;}
    const m=/^(?:(\d{1,2}|AL)\s+)?([A-Z][A-Za-z'’.\- ,]*?)\s+\(([DRI])\)$/.exec(l);if(!m||!state)continue;
    const dist=m[1]??(/^(\d{1,2}|AL)$/.test(lines[i-1]||'')?lines[i-1]:null);
    if(dist!=null)house=true;
    let score=null,life=null;
    for(let k=i+1;k<Math.min(lines.length,i+5);k++){
      if(/\(([DRI])\)$/.test(lines[k])||STATE_BY_NAME[lines[k]])break;
      const s=/^(?:\?\s+)?(\d{1,3})\s+(\d{1,3})$/.exec(lines[k]);if(s){score=Number(s[1]);life=Number(s[2]);break;}
    }
    if(score==null)continue;
    out.push({name:m[2].trim(),lastOnly:true,party:m[3],state,chamber:house?'H':'S',district:house&&dist!=null?(dist==='AL'?0:Number(dist)):null,score,lifetime:life,year});
  }
  return out;
}
// Republican Liberty Caucus (its yearly Liberty Index, two PDFs, Senate and House; Republicans only): each member's
// name, their state (its letters partly cut off in the PDF's text) or district, their votes, the count and share, and
// on the next line the final score with any bonus. Letters of a name are sometimes cut off too, and some House members
// are listed under their district before the 2022 redistricting, so it's matched on last name and chamber, the rest of
// the first name and then the district settling two members with the same last name.
export function readRlc(pdfText,{chamber,year=null}={}){
  const lines=String(pdfText).split('\n').map(l=>l.trim()),out=[];
  for(let i=0;i<lines.length;i++){
    const m=/^([A-Za-z][A-Za-z.'’\- ]*?[a-z.])\s+(?:[A-Z]{1,2}\s+|([A-Z]{0,2})-(\d{1,2})\s+)?((?:[01N]\s+){12,})(\d{1,2})\s+(0?\.?\d{2,3})(?:\s+\d+)*$/.exec(lines[i]);
    if(!m)continue;
    const fin=/^(\d{1,3})$/.exec(lines[i+1]||'')?.[1];if(fin==null)continue;
    out.push({name:m[1].trim(),lastOnly:true,clipped:true,staleDistrict:true,party:'R',state:null,chamber,district:chamber==='H'&&m[3]!=null?Number(m[3]):null,score:Number(fin),year});
  }
  return out;
}
export const RLC_PDFS=[['S','https://rlc.org/wp-content/uploads/2026/03/Liberty-Index-2026-US-Senate.pdf'],['H','https://rlc.org/wp-content/uploads/2026/03/Liberty-Index-2026-US-House.pdf']];
export const ARA_PDF='https://retiredamericans.org/wp-content/uploads/2026/03/2025-Congressional-Voting-Record.pdf';
// The newest voting record its page links to (a PDF named for the year), else the one known.
export const araLatest=html=>{const links=[...String(html).matchAll(/href="([^"]*?(\d{4})-Congressional-Voting-Record\.pdf)"/gi)].map(m=>({url:m[1],year:Number(m[2])})).sort((a,b)=>b.year-a.year);return links[0]?.url||ARA_PDF;};

// ---------- Readers added November 9, 2026 (the second look: npm run ratings:probe -- --to-build, ratings:browse) ----------
// Some pages get their data only with a session of their own: those are read by opening the page in a browser
// (Playwright's Chromium as it comes, saying it is a headless Chrome), as a visitor does, and taking the data answers
// whose address matches. A page that shows a bot check is left out. [{url, text}]
// need(got): keep the page open until it returns true (up to `timeout`); act(page, got): what a visitor does once it's
// open (scroll a list). The answers carry the page's title and every matching address seen with its status (`seen`).
export async function browserData(page,match,{settle=8000,need=null,act=null,timeout=90000}={}){
  let playwright;
  try{playwright=await import('playwright');}
  catch{throw new Error('this group is read in a browser: run npm install --no-save playwright && npx playwright install chromium once');}
  const browser=await playwright.chromium.launch();
  try{
    const p=await browser.newPage(),got=[],seen=[],pending=[];
    p.on('response',res=>{const u=res.url();if(!match.test(u))return;seen.push(`${res.status()} ${u.split('?')[0]}`);
      if(res.ok())pending.push(res.text().then(text=>got.push({url:u,text}),()=>{}));});
    await p.goto(page,{waitUntil:'networkidle',timeout:90000}).catch(()=>{});
    for(let k=0;k<12;k++){await p.mouse.wheel(0,5000).catch(()=>{});await sleep(500);}
    if(act)await act(p,got);
    if(need){const end=Date.now()+timeout;while(Date.now()<end){await Promise.all(pending);if(need(got))break;await sleep(1000);}}
    else await sleep(settle);
    await Promise.all(pending);
    const title=await p.title().catch(()=>''),body=await p.evaluate(()=>document.body?.innerText||'').catch(()=>'');
    if(/just a moment|attention required|verify (that )?you are (a )?human|captcha|access denied/i.test(`${title} ${body.slice(0,2000)}`))throw new Error('the page showed a bot check, so it is left out');
    got.title=title;got.seen=seen;return got;
  }finally{await browser.close();}
}
// "Collins, Susan M." -> "Susan M. Collins".
const firstLast=n=>{const [last,...rest]=String(n||'').split(/,\s*/);return `${rest.join(' ')} ${last}`.replace(/\s+/g,' ').trim();};
// AJP Action (its scorecard spreadsheet, "All Members"): each member's state, party, chamber and district, their points
// and AJP's own letter grade (the points are on AJP's scale, not a percent, so only the letter is kept). A member who
// has left has no grade.
export function readAjp(sheets,{year=null}={}){
  const sh=sheets.find(s=>/all members/i.test(s.name))||sheets.find(s=>s.rows.some(r=>r[0]==='Name'));if(!sh)return [];
  const hi=sh.rows.findIndex(r=>String(r[0]).trim()==='Name'&&r.includes('Chamber'));if(hi<0)return [];
  const h=sh.rows[hi].map(x=>String(x).trim().toLowerCase()),c=n=>h.indexOf(n);
  const out=[];
  for(const r of sh.rows.slice(hi+1)){
    const grade=String(r[c('grade')]??'').trim();if(!/^[A-F][+-]?$/.test(grade))continue;
    const chamber=/senate/i.test(r[c('chamber')])?'S':'H',d=String(r[c('district')]??'').trim();
    out.push({name:firstLast(r[c('name')]),state:stateCode(r[c('state')]),party:String(r[c('party')]||'')[0]||null,chamber,
      district:chamber==='H'?(/^\d+$/.test(d)?Number(d):/at.?large|^AL$/i.test(d)?0:null):null,grade,year});
  }
  return out;
}
// The Freedom Index (freedomindex.us/us/legislators): a card for each member of the sitting Congress with its Freedom
// Index grade and percent (the card's badge), their office and state or district; the photo's file name often carries
// the Bioguide ID.
export function readFreedomIndex(html){
  const out=[],year=/(\d{3})(?:st|nd|rd|th) Congress/.exec(String(html))?.[1];
  for(const c of String(html).split(/fi-legislator-card-wrapper/).slice(1)){
    const a=/<a href="([^"]+)" class="lc"[^>]*?data-fs="(\d+)"\s*data-fg="([A-F][+-]?)"/.exec(c);if(!a)continue;
    const [office='',place='',party='']=[...c.matchAll(/<div class="lc-(?:office|district)[^"]*">([\s\S]*?)<\/div>/g)].map(m=>text(m[1]));
    const chamber=/senate/i.test(office)?'S':/house/i.test(office)?'H':null;if(!chamber)continue;
    const d=/(\d+)(?:st|nd|rd|th)\s+District/i.exec(place)?.[1];
    out.push({name:text(/<div class="lc-name[^"]*">([\s\S]*?)<\/div>/.exec(c)?.[1]),state:stateCode(place.replace(/\s+(\d+(st|nd|rd|th)\s+District|At[- ]Large.*)$/i,'')),
      party:party[0]||null,chamber,district:chamber==='H'?(d?Number(d):/at[- ]large/i.test(place)?0:null):null,
      bioguide:/[-_/]([A-Z]\d{6})[-_.]/.exec(/<img src="([^"]+)"/.exec(c)?.[1]||'')?.[1]||null,score:Number(a[2]),grade:a[3],
      year:year?congressLabel(Number(year)):null,url:a[1]});
  }
  return out;
}
// ProgressivePunch (progressivepunch.org/scores.htm, one page a chamber): each member's share of progressive votes this
// Congress and over their career ("Overall Votes %").
export function readProgressivePunch(html,{chamber}={}){
  const out=[],span=/(\d{4})-(\d{2})\s+Progressive Scores/.exec(String(html));
  for(const r of String(html).matchAll(/<tr\b[\s\S]*?<\/tr>/g)){
    const cell=k=>text(new RegExp(`<td class="[^"]*\\bdata ${k}\\b[^"]*">([\\s\\S]*?)<\\/td>`).exec(r[0])?.[1]);
    const name=cell('name'),cur=cell('overall-current'),life=cell('overall-lifetime');if(!name||!/^\d/.test(cur))continue;
    const where=cell('district'),m=/^([A-Z]{2})(?:-(\d{1,2}|AL))?$/.exec(where);
    out.push({name:firstLast(name),party:cell('party')||null,state:m?.[1]||null,chamber,district:chamber==='H'&&m?.[2]?(m[2]==='AL'?0:Number(m[2])):null,
      score:Math.round(Number(cur)),...(/^\d/.test(life)?{lifetime:Math.round(Number(life))}:{}),year:span?`${span[1]}–${span[2]}`:null});
  }
  return out;
}
// Stand With Crypto (the list its politicians page draws from): each person's office or race and their stance score on
// crypto, 0 to 100 (shown as a letter on this site's scale). People with no stance on record have no score.
export function readStandWithCrypto(json){
  const out=[];
  for(const p of (json?.people||[])){
    const r=p?.primaryRole||{},score=p?.manuallyOverriddenStanceScore??p?.computedStanceScore;
    if(!Number.isFinite(score)||!['SENATE','CONGRESS'].includes(r.roleCategory)||!['HELD','RUNNING_FOR'].includes(r.status))continue;
    const chamber=r.roleCategory==='SENATE'?'S':'H',d=String(r.primaryDistrict||'');
    out.push({name:`${p.firstNickname||p.firstName||''} ${p.lastName||''}`.trim(),state:stateCode(r.primaryState),chamber,
      district:chamber==='H'&&r.status==='HELD'&&/^\d+$/.test(d)?Number(d):null,party:String(p.politicalAffiliationCategoryV2||'').replace('US_','')[0]||null,
      score:Math.round(score),year:new Date().getUTCFullYear(),url:p.slug?`https://www.standwithcrypto.org/politicians/person/${p.slug}`:null});
  }
  return out;
}
// The Council for Innovation Promotion (the member list its interactive scorecard draws from, page by page): each
// member's grade and Bioguide ID.
export function readC4ip(json,{year=null}={}){
  return (json?.members||[]).filter(m=>m?.in_congress!==false&&/^[A-F][+-]?$/.test(String(m?.score||''))).map(m=>({name:firstLast(m.member_name),state:stateCode(m.state),
    chamber:/senate/i.test(m.chamber)?'S':'H',party:String(m.party||'')[0]||null,bioguide:/^[A-Z]\d{6}$/.test(m.bioguideId||'')?m.bioguideId:null,grade:m.score,year}));
}
export const C4IP_API='https://cscp.c4ip.org/public/members/browse';
// The edition its interactive scorecard shows (the third, April 2026).
export const C4IP_YEAR=2026;
export const AJP_XLSX='https://ajpaction.org/wp-content/uploads/2026/05/AJP-Action-Congressional-Scorecard-2026.xlsx';
// CPAC (the ratings its Congress page draws from its site's database): each member's latest yearly rating and lifetime
// rating, keyed by Bioguide ID.
export function readCpac(items){
  const out=[];
  for(const it of items||[]){
    const d=it?.data||it;if(d?.peopleState!=='Congress'||!Number.isFinite(d?.currentRating))continue;
    const t=String(d.title1||''),chamber=/senator/i.test(t)?'S':/representative|delegate/i.test(t)?'H':null;if(!chamber)continue;
    out.push({name:`${d.firstName||''} ${d.lastName||''}`.trim(),state:stateCode(/\bfrom\s+(.+)$/.exec(t)?.[1]||''),chamber,
      bioguide:/^[A-Z]\d{6}$/i.test(d.myCPACId||'')?String(d.myCPACId).toUpperCase():null,score:Math.round(d.currentRating),
      ...(Number.isFinite(d.lifetimeRating)?{lifetime:Math.round(d.lifetimeRating)}:{}),year:Number.isFinite(d.currentRatingYear)?d.currentRatingYear:null,
      url:d['link-people-database-title']?new URL(d['link-people-database-title'],'https://www.cpac.org').href:null});
  }
  return out;
}
// The items of every database answer a page loaded, one each (the same item may come in more than one answer).
export const cloudItems=answers=>{const seen=new Map();for(const a of answers){let j;try{j=JSON.parse(a.text);}catch{continue;}for(const it of j?.dataItems||[])if(it?.id&&!seen.has(it.id))seen.set(it.id,it);}return [...seen.values()];};

// ---------- Readers added November 9, 2026 (the third look, ratings:browse) ----------
// A spreadsheet file's rows (CSV), quoted cells and line breaks inside them included.
export function parseCsv(t){
  const rows=[];let row=[],cell='',q=false;const s=String(t);
  for(let i=0;i<s.length;i++){const c=s[i];
    if(q){if(c==='"'){if(s[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;continue;}
    if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  return rows;
}
// A data address asked for directly; if the site refuses a script (HTTP 401 or 403), the page that loads it is opened
// in a browser and the same data taken from it.
async function directOrBrowser(fetchPage,browse,url,page,match,opts){
  try{return await fetchPage(url);}
  catch(e){if(!/HTTP 40[13]/.test(e.message))throw e;const got=await browse(page,match,opts);if(!got.length)throw new Error(`refused a script, and its page loaded no ratings either`);return got[0].text;}
}
// NumbersUSA (the grades service its grade cards page draws from): every member of a Congress, grouped by grade, with
// their seat ("CA05"), score, NumbersUSA's own letter grade and Bioguide ID.
export function readNumbersUsa(json){
  const out=[];
  for(const list of Object.values(json?.brackets||{}))for(const m of list||[]){
    if(!Number.isFinite(m?.current_score))continue;
    const seat=/^([A-Z]{2})(\d{1,2}|AL)?$/.exec(String(m.state||'')),chamber=/^sen/i.test(m.title||'')?'S':'H';
    out.push({name:m.name,state:seat?.[1]||null,chamber,party:m.party||null,district:chamber==='H'&&seat?.[2]!=null?(seat[2]==='AL'?0:Number(seat[2])):null,
      bioguide:/^[A-Z]\d{6}$/.test(m.bioguide_id||'')?m.bioguide_id:null,score:Math.round(m.current_score),
      ...(/^[A-F][+-]?$/.test(m.current_score_letter_grade||'')?{grade:m.current_score_letter_grade}:{}),year:m.congress_id?congressLabel(m.congress_id):null});
  }
  return out;
}
// NIAC Action (its scorecard's spreadsheet file): each member in office, their overall share (as a fraction) and grade.
export function readNiac(csv,{year=null}={}){
  const [h=[],...rows]=parseCsv(csv),c=n=>h.indexOf(n),out=[];
  for(const r of rows){
    if(r.length<h.length||r[c('in_office')]!=='1')continue;
    const pct=Number(r[c('Percent')]),grade=String(r[c('Grade')]||'').trim();if(!Number.isFinite(pct)&&!/^[A-F][+-]?$/.test(grade))continue;
    const chamber=/senate/i.test(r[c('chamber')])?'S':'H',d=String(r[c('district')]||'').trim();
    out.push({name:firstLast(r[c('full_name')]),state:stateCode(r[c('state')]),chamber,party:String(r[c('party')]||'')[0]||null,
      district:chamber==='H'&&/^\d+$/.test(d)?Number(d):null,bioguide:/^[A-Z]\d{6}$/.test(r[c('bioguide_id')]||'')?r[c('bioguide_id')]:null,
      ...(String(r[c('Percent')]).trim()!==''&&Number.isFinite(pct)?{score:Math.round(pct*100)}:{}),...(/^[A-F][+-]?$/.test(grade)?{grade}:{}),year});
  }
  return out;
}
export const NIAC_CSV='https://scorecard.niacaction.org/data/scores_wide.csv';
// Humane World Action Fund (the two sheets its current scorecard page loads, House and Senate): each member's state,
// name, party, district, score ("100+" when they also led on a bill, counted 100) and lifetime score.
export function readHumane(values,{year=null}={}){
  const [h=[],...rows]=values||[],c=n=>h.findIndex(x=>String(x).trim().toLowerCase()===n),out=[];
  const [iSt,iL,iF,iP,iD,iS,iLife]=['state','last','first','party','district','score','lifetime'].map(c);if(iL<0||iS<0)return out;
  const house=rows.filter(r=>/^\d+$|^at.?large$|^AL$/i.test(String(r[iD]??'').trim())).length>rows.length/2;
  for(const r of rows){
    const sc=/^(\d{1,3})\+?$/.exec(String(r[iS]??'').trim());if(!sc)continue;
    const d=String(r[iD]??'').trim(),life=/^\d{1,3}$/.test(String(r[iLife]??'').trim())?Number(r[iLife]):null;
    out.push({name:`${r[iF]||''} ${r[iL]||''}`.replace(/\s+/g,' ').trim(),state:stateCode(r[iSt]),party:String(r[iP]||'')[0]||null,chamber:house?'H':'S',
      district:house?(/^\d+$/.test(d)?Number(d):/at.?large|^AL$/i.test(d)?0:null):null,score:Math.min(100,Number(sc[1])),...(life!=null?{lifetime:life}:{}),year});
  }
  return out;
}
// FRC Action (its scorecard pages embed a public Quorum sheet, one a chamber): each member's votes with FRC Action and
// against it; the score is the share with it, as the sheet's own Score (%) column figures it. Members-elect are left out.
export function readFrcSheet(sheet){
  const name=String(sheet?.name||''),chamber=/\(senate\)/i.test(name)?'S':/\(house\)/i.test(name)?'H':null,out=[];if(!chamber)return out;
  const col=n=>(sheet.columns||[]).find(x=>String(x?.name||'').trim().toLowerCase()===n)?.data||{};
  const withIt=col('# of votes with'),against=col('# of votes against'),year=Number(/\b(20\d\d)\b/.exec(name)?.[1])||null;
  for(const p of sheet.row_data||[]){
    if(/-elect\b/i.test(p?.name||''))continue;
    const yes=Number(withIt[p.id]||0),no=Number(against[p.id]||0);if(!(yes+no>0))continue;
    const m=/\(([DRI])-([A-Z]{2})(?:-(\d{1,2}|AL))?\)/.exec(p.name||'');
    out.push({name:`${p.firstname||''} ${p.lastname||''}`.trim(),state:m?.[2]||null,party:m?.[1]||null,chamber,district:chamber==='H'&&m?.[3]?(m[3]==='AL'?0:Number(m[3])):null,
      score:Math.round(100*yes/(yes+no)),year});
  }
  return out;
}
export const FRC_PAGES=['https://www.frcaction.org/get.cfm?c=FRCA_SCORECARD&scorecard=scorecard_senate','https://www.frcaction.org/get.cfm?c=FRCA_SCORECARD&scorecard=scorecard_house'];
export const quorumSheet=slug=>`https://www.quorum.us/api/sheet/${slug}/?decode_enums=false&count=false&exclude=%7B%7D&fetch_cache=true`;
// What a visitor does on the Council for Innovation Promotion's scorecard to see every member: open its "Browse
// Legislators" tab, then press its load-more button (or scroll its list) until there's no more. Only buttons inside the
// scorecard are pressed (the cookie notice has a "Show more" of its own).
export async function c4ipVisit(p,{rounds=30,pause=1200}={}){
  const root=p.locator('#c4ip-scorecard-root');
  await root.getByRole('button',{name:/^\s*browse legislators\s*$/i}).first().click({timeout:10000}).catch(()=>{});
  await sleep(pause*2);
  for(let k=0;k<rounds;k++){
    const more=root.getByRole('button',{name:/load more|show more|see more|view more|more legislators|next/i}).first();
    if(await more.count().catch(()=>0)&&await more.isVisible().catch(()=>false)&&await more.isEnabled().catch(()=>false))await more.click({timeout:5000}).catch(()=>{});
    else await scrollLists(p,{rounds:1,pause:0});
    await sleep(pause);
  }
}
// Scrolls every scrolling list on a page to its end, again and again, as a visitor reading down it would, so a list that
// loads more as it's scrolled loads all of it.
export async function scrollLists(p,{rounds=40,pause=1200}={}){
  for(let k=0;k<rounds;k++){
    await p.evaluate(()=>{for(const el of document.querySelectorAll('*')){const s=getComputedStyle(el);if(/(auto|scroll)/.test(s.overflowY)&&el.scrollHeight>el.clientHeight+20)el.scrollTop=el.scrollHeight;}window.scrollTo(0,document.body.scrollHeight);}).catch(()=>{});
    await sleep(pause);
  }
}

export const READERS=[
  {key:'sba',org:'SBA Pro-Life America',lean:'conservative',issue:'Abortion',url:'https://sbaprolife.org/scorecard',read:readSba},
  {key:'lcv',org:'League of Conservation Voters',lean:'liberal',issue:'Environment',url:'https://www.lcv.org/congressional-scorecard/members-of-congress/',read:readLcv},
  {key:'rfa',org:'Reproductive Freedom for All',lean:'liberal',issue:'Abortion',url:'https://reproductivefreedomforall.org/congressional-record-on-reproductive-freedom/',read:readRfa,paged:true},
  // The sitting Congress's scores; early in a new Congress, before any are posted, the one before.
  {key:'heritage',org:'Heritage Action',lean:'conservative',issue:'Overall',url:'https://heritageaction.com/scorecard',
    rows:async(fetchPage,{wait=2000,today=new Date()}={})=>{const now=congressOf(today.getUTCFullYear());
      for(const n of [now,now-1]){const got=readHeritage(await fetchPage(`https://heritageaction.com/scorecard/members/${n}`));if(got.length)return got.map(r=>({...r,year:congressLabel(n)}));await sleep(wait);}
      return [];}},
  // The newest year's Senate and House tables, as listed on the scorecards page.
  {key:'clubforgrowth',org:'Club for Growth',lean:'conservative',issue:'Taxes & spending',url:'https://www.clubforgrowth.org/scorecards/',
    rows:async(fetchPage,{wait=2000}={})=>{const latest=cfgLatest(await fetchPage('https://www.clubforgrowth.org/scorecards/'));if(!latest)throw new Error('no scorecard year listed on its scorecards page');
      const rows=[];for(const p of latest.pages){await sleep(wait);rows.push(...readClubForGrowth(await fetchPage(p.url),{chamber:p.chamber,year:latest.year}));}
      return rows;}},
  // VoterVoice answers only the page's own session (a script asking directly gets HTTP 401), so it's read in a browser.
  {key:'ppaction',org:'Planned Parenthood Action',lean:'liberal',issue:'Abortion',url:'https://www.plannedparenthoodaction.org/congressional-scorecard',
    rows:async(fetchPage,{browse=browserData}={})=>{
      const got=await browse('https://www.plannedparenthoodaction.org/congressional-scorecard',/votervoice\.net\/Api\//i,{need:g=>g.some(a=>/\/Scorings\b/.test(a.url))});
      const scorings=got.find(a=>/\/Scorings\b/.test(a.url));
      if(!scorings)throw new Error(`its page loaded no scorecard${got.seen?.length?` (VoterVoice answered: ${[...new Set(got.seen)].slice(0,5).join('; ')})`:' (it asked VoterVoice for nothing)'}`);
      const id=/Scorecards\/([^/?]+)\/Scorings/.exec(scorings.url)?.[1];let name=null;
      for(const a of got)if(a!==scorings){try{name=(JSON.parse(a.text)||[]).find?.(c=>String(c.id)===id)?.name??name;}catch{}}
      return readVoterVoice(JSON.parse(scorings.text),{year:name});}},
  {key:'afp',org:'Americans for Prosperity',lean:'conservative',issue:'Taxes & spending',url:'https://americansforprosperity.org/national-scorecard/',
    rows:async fetchPage=>readAfp(JSON.parse(await fetchPage('https://americansforprosperity.org/wp-json/rds-bt50-scorecard/v1/legislators')))},
  {key:'goa',org:'Gun Owners of America',lean:'conservative',issue:'Guns',url:'https://www.gunowners.org/grades/',read:readGoa},
  {key:'rlc',org:'Republican Liberty Caucus (Liberty Index)',lean:'conservative',issue:'Overall',url:'https://rlc.org/',
    rows:async(fetchPage,{wait=2000,fetchBytes=getBytes}={})=>{const rows=[];
      for(const [chamber,pdf] of RLC_PDFS){const year=Number(/Liberty-Index-(\d{4})/.exec(pdf)?.[1])-1||null;rows.push(...readRlc(await pdfText(await fetchBytes(pdf)),{chamber,year}));await sleep(wait);}
      return rows;}},
  {key:'ajp',org:'AJP Action',lean:'liberal',issue:'Israel, Palestine & Iran',url:'https://ajpaction.org/scorecard2026/',
    rows:async(fetchPage,{fetchBytes=getBytes}={})=>readAjp(xlsxSheets(await fetchBytes(AJP_XLSX)),{year:Number(/Scorecard-(\d{4})\.xlsx/.exec(AJP_XLSX)?.[1])||null})},
  {key:'jbs',org:'John Birch Society (Freedom Index)',lean:'conservative',issue:'Overall',url:'https://freedomindex.us/us/legislators/',read:readFreedomIndex},
  // One page a chamber; a page whose title names the other chamber is skipped.
  {key:'progressivepunch',org:'ProgressivePunch',lean:'liberal',issue:'Overall',url:'https://www.progressivepunch.org/',
    rows:async(fetchPage,{wait=2000}={})=>{const rows=[];
      for(const [chamber,h] of [['S','senate'],['H','house']]){const html=await fetchPage(`https://www.progressivepunch.org/scores.htm?house=${h}`);
        const title=/<title>([^<]*)/i.exec(html)?.[1]||'';if(chamber==='S'?/senat/i.test(title):/house/i.test(title))rows.push(...readProgressivePunch(html,{chamber}));await sleep(wait);}
      return rows;}},
  // Its list answers scripts too; if it ever refuses one, it's read from its page in a browser.
  {key:'standwithcrypto',org:'Stand With Crypto',lean:'conservative',issue:'Crypto & tech',url:'https://www.standwithcrypto.org/politicians',
    rows:async(fetchPage,{browse=browserData}={})=>{let json;
      try{json=JSON.parse(await fetchPage('https://www.standwithcrypto.org/api/us/dtsi/all-people'));}
      catch(e){if(!/HTTP 40[13]/.test(e.message))throw e;json=JSON.parse((await browse('https://www.standwithcrypto.org/politicians',/\/api\/us\/dtsi\/all-people/))[0]?.text||'{}');}
      return readStandWithCrypto(json);}},
  {key:'c4ip',org:'Council for Innovation Promotion',lean:'none',issue:'Crypto & tech',url:'https://c4ip.org/interactive-scorecard/',
    rows:async(fetchPage,{wait=2000,browse=browserData}={})=>{const rows=[];
      try{
        for(let skip=0,total=Infinity;skip<total&&skip<3000;skip+=48){const j=JSON.parse(await fetchPage(`${C4IP_API}?skip=${skip}&limit=48&sort=score-desc`));
          total=Number(j.total)||0;rows.push(...readC4ip(j,{year:C4IP_YEAR}));if(!(j.members||[]).length)break;await sleep(Math.min(wait,1000));}
        return rows;
      }catch(e){
        if(!/HTTP 40[13]/.test(e.message))throw e;
        // Refused to a script: its page, in a browser, lists 48 at a time and loads more as the list is scrolled.
        const pages=g=>g.map(a=>{try{return JSON.parse(a.text);}catch{return null;}}).filter(j=>j?.members);
        const count=g=>new Set(pages(g).flatMap(j=>j.members.map(m=>m.bioguideId||m.member_name))).size,total=g=>Math.max(0,...pages(g).map(j=>Number(j.total)||0));
        const got=await browse('https://c4ip.org/interactive-scorecard/',/cscp\.c4ip\.org\/public\/members\/browse/,{act:p=>c4ipVisit(p),need:g=>total(g)>0&&count(g)>=total(g),timeout:60000});
        if(count(got)<total(got))throw new Error(`its page loaded ${count(got)} of its ${total(got)} members, so it isn't shown yet`);
        const by=new Map();for(const j of pages(got))for(const r of readC4ip(j,{year:C4IP_YEAR}))by.set(r.bioguide||r.name,r);
        return [...by.values()];
      }}},
  // Its site's database answers only the page's own session, so it's read in a browser.
  {key:'cpac',org:'CPAC',lean:'conservative',issue:'Overall',url:'https://www.cpac.org/foundation/ratings/us',
    rows:async(fetchPage,{browse=browserData}={})=>readCpac(cloudItems(await browse('https://www.cpac.org/foundation/ratings/us',/\/_api\/cloud-data\/v2\/items\/query/)))},
  // The sitting Congress's grades; early in a new Congress, before any are posted, the one before.
  {key:'numbersusa',org:'NumbersUSA',lean:'conservative',issue:'Immigration',url:'https://www.numbersusa.org/grades/',
    rows:async(fetchPage,{wait=2000,today=new Date(),browse=browserData}={})=>{const now=congressOf(today.getUTCFullYear());
      for(const n of [now,now-1]){const json=JSON.parse(await directOrBrowser(fetchPage,browse,`https://grades.numbersusa.org/v1/grades/search/?congress=${n}`,'https://www.numbersusa.org/grades/',/grades\.numbersusa\.org\/v1\/grades\/search/));
        const rows=readNumbersUsa(json);if(rows.length)return rows;await sleep(wait);}
      return [];}},
  {key:'niac',org:'NIAC Action',lean:'liberal',issue:'Israel, Palestine & Iran',url:'https://scorecard.niacaction.org/',
    rows:async(fetchPage,{today=new Date(),browse=browserData}={})=>readNiac(await directOrBrowser(fetchPage,browse,NIAC_CSV,'https://scorecard.niacaction.org/',/scores_wide\.csv/),{year:congressLabel(congressOf(today.getUTCFullYear()))})},
  // Its two sheets are loaded with the page's own key, so it's read in a browser; the year is the page title's.
  {key:'humane',org:'Humane World Action Fund',lean:'liberal',issue:'Animal welfare',url:'https://humaneaction.org/current_scorecard',
    rows:async(fetchPage,{browse=browserData}={})=>{
      const got=await browse('https://humaneaction.org/current_scorecard',/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\//,{need:g=>g.length>=2,timeout:60000});
      const year=Number(/(\d{4})\s+Humane Scorecard/i.exec(got.title||'')?.[1])||null;
      return got.flatMap(a=>{try{return readHumane(JSON.parse(a.text).values,{year});}catch{return [];}});}},
  // Each chamber's page names its Quorum sheet; the sheet is public and read directly (in a browser, if refused).
  {key:'frc',org:'FRC Action',lean:'conservative',issue:'Family & religion',url:'https://www.frcaction.org/scorecard',
    rows:async(fetchPage,{wait=2000,browse=browserData}={})=>{const rows=[];
      for(const page of FRC_PAGES){const slug=/quorum\.us\/spreadsheet\/external\/([A-Za-z0-9]+)/.exec(await fetchPage(page))?.[1];if(!slug)throw new Error('its scorecard page names no sheet');
        await sleep(wait);
        rows.push(...readFrcSheet(JSON.parse(await directOrBrowser(fetchPage,browse,quorumSheet(slug),`https://www.quorum.us/spreadsheet/external/${slug}/`,/quorum\.us\/api\/sheet\//))));await sleep(wait);}
      return rows;}},
  {key:'ara',org:'Alliance for Retired Americans',lean:'liberal',issue:'Seniors',url:'https://retiredamericans.org/voting-record/',
    rows:async(fetchPage,{wait=2000,fetchBytes=getBytes}={})=>{let pdf=ARA_PDF;try{pdf=araLatest(await fetchPage('https://retiredamericans.org/voting-record/'));}catch{}
      await sleep(wait);return readAra(await pdfText(await fetchBytes(pdf)));}},
];

// The groups without a reader yet, and why, from the probe (data/ratings-probe.txt, November 7, 2026):
//   blocked     the site answers scripts with a bot check, so it is left out
//   none        no congressional scorecard found at the group's site
//   states      the group rates states' laws, not members of Congress
//   no-list     grades are given one at a time in announcements, not published as a list
//   permission  waiting on the group's permission to show its ratings
//   to-build    the ratings are published but the reader is still to be written: drawn by the page's own scripts
//               (npm run ratings:browse records what they load) or in a document the page links to (a second
//               ratings:probe, -- --to-build, looks at it)
//   old         its latest scorecard is from an earlier Congress
//   image       its scorecard's member list is a picture, not text
//   unreadable  its scorecard's text is in a font whose letters can't be read back (the Leadership Conference's PDF)
//   not-found   its scorecard page shows no ratings and loads none
// A group marked none, states or old isn't shown on the profiles: it has no current ratings of members of Congress.
export const PROBED={
  scf:['Senate Conservatives Fund','conservative','Overall','none','https://www.senateconservatives.com/'],
  nra:['NRA','conservative','Guns','no-list','https://www.nrapvf.org/grades/'],
  nrlc:['National Right to Life','conservative','Abortion','blocked','https://www.nrlc.org/federal/scorecard/'],
  chamber:['U.S. Chamber of Commerce','conservative','Labor','not-found','https://www.uschamber.com/how-they-voted'],
  nfib:['NFIB','conservative','Labor','blocked','https://www.nfib.com/advocacy/'],
  edf:['Environmental Defense Fund','liberal','Environment','none','https://www.edfaction.org/'],
  nrdc:['NRDC','liberal','Environment','blocked','https://www.nrdcactionfund.org/'],
  aflcio:['AFL-CIO','liberal','Labor','blocked','https://aflcio.org/scorecard'],
  seiu:['SEIU','liberal','Labor','none','https://www.seiu.org/'],
  afscme:['AFSCME','liberal','Labor','none','https://www.afscme.org/'],
  nea:['NEA','liberal','Labor','none','https://educationvotes.nea.org/'],
  aft:['AFT','liberal','Labor','none','https://www.aft.org/'],
  giffords:['Giffords','liberal','Guns','states','https://giffords.org/lawcenter/resources/scorecard/'],
  everytown:['Everytown','liberal','Guns','none','https://www.everytown.org/'],
  hrc:['Human Rights Campaign','liberal','Civil rights','permission','https://www.hrc.org/resources/congressional-scorecard'],
  aclu:['ACLU','liberal','Civil rights','permission','https://www.aclu.org/congressional-scorecards'],
  // Added November 8, 2026 (data/ratings-probe.txt).
  nssf:['National Shooting Sports Foundation','conservative','Guns','image','https://www.nssf.org/government-relations/report-card/'],
  sfla:['Students for Life Action','conservative','Abortion','blocked','https://www.studentsforlifeaction.org/'],
  aea:['American Energy Alliance','conservative','Environment','to-build','https://www.americanenergyalliance.org/american-energy-scorecard/'],
  defenders:['Defenders of Wildlife','liberal','Environment','image','https://defenders.org/sites/default/files/2026-03/Conservation-Report-Card-2025.pdf'],
  climatehawks:['Climate Hawks Vote','liberal','Environment','to-build','https://climatehawksvote.com/'],
  cwa:['Communications Workers of America','liberal','Labor','to-build','https://scorecard.cwa-union.org/'],
  teamsters:['Teamsters','liberal','Labor','old','https://teamster.org/political-legislative-scorecards/'],
  apwu:['American Postal Workers Union','liberal','Labor','none','https://apwu.org/congressional-voting-records/'],
  ntu:['National Taxpayers Union','conservative','Taxes & spending','to-build','https://www.ntu.org/ratecongress/'],
  ccagw:['Council for Citizens Against Government Waste','conservative','Taxes & spending','to-build','https://ccagwratings.org/'],
  network:['NETWORK Lobby for Catholic Social Justice','liberal','Taxes & spending','image','https://networklobby.org/news/11526-voting-record/'],
  naacp:['NAACP','liberal','Civil rights','old','https://naacp.org/find-resources/legislative-report-cards'],
  civilrights:['The Leadership Conference on Civil and Human Rights','liberal','Civil rights','unreadable','https://civilrights.org/voting-record/'],
  aauw:['AAUW','liberal','Civil rights','image','https://www.aauwaction.org/voter-education/congressional-voting-record/'],
  ada:['Americans for Democratic Action','liberal','Overall','to-build','https://adaction.org/'],
  ncpssm:['National Committee to Preserve Social Security and Medicare','liberal','Seniors','to-build','https://www.ncpssm.org/scorecard/'],
  ecu:['End Citizens United','liberal','Money in politics','none','https://www.endcitizensunited.org/'],
  commoncause:['Common Cause','liberal','Money in politics','to-build','https://democracyscorecard.org/'],
  imeu:['IMEU Policy Project','liberal','Israel, Palestine & Iran','blocked','https://imeupolicyproject.org/scorecard'],
  napo:['National Association of Police Organizations','conservative','Policing','none','https://www.napo.org/'],
  norml:['NORML','liberal','Marijuana','to-build','https://vote.norml.org/'],
  lugar:['The Lugar Center (Bipartisan Index)','none','Bipartisanship','old','https://www.thelugarcenter.org/ourwork-Bipartisan-Index.html'],
};
// The statuses not shown on profiles.
export const HIDDEN=new Set(['none','states','old']);
export const probedGroups=()=>Object.fromEntries(Object.entries(PROBED).map(([k,[org,lean,issue,status,url]])=>[k,{org,lean,issue,url,status}]));

// ---------- Matching a rating to a profile: the same last name, the same state, and the same first name or initial ----------
const plain=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,'').replace(/[^a-z\s'-]/g,' ').replace(/\s+/g,' ').trim();
const lastOf=s=>{const w=plain(s).split(' ').filter(Boolean);return w.at(-1)||'';};
const firstOf=s=>plain(s).split(' ').filter(Boolean)[0]||'';
export function matchPerson(row,people){
  // A group that lists each member's Bioguide ID is matched on it.
  if(row.bioguide){const b=people.find(p=>p.bioguide===row.bioguide);if(b)return b;}
  const last=lastOf(row.name),first=firstOf(row.name);
  // A list whose letters may be cut off (row.clipped) matches a last name of five or more letters on its end.
  const sameLast=p=>{const l=lastOf(p.name);return l===last||!!row.clipped&&last.length>=5&&l.endsWith(last);};
  let hits=people.filter(p=>sameLast(p)&&(!row.state||!p.state||row.state===p.state)&&(!row.chamber||!p.chamber||row.chamber===p.chamber||p.cand));
  // A House district, when both give one, must agree: it tells apart two members of one state with the same last name,
  // and a former member from another district.
  // An at-large seat is 0 here and 1 in some groups' lists; a state with one seat has no other.
  const seat=d=>d===1?0:d,rd=row.chamber==='H'?districtOf(row.district):null;
  // A list with some old district numbers (row.staleDistrict) uses its district only to break a tie, below.
  if(rd!=null&&!row.staleDistrict)hits=hits.filter(p=>p.district==null||seat(p.district)===seat(rd));
  // A group that gives only last names is matched when exactly one profile fits; one whose first names may have lost
  // their first letters (row.clipped) settles two with the same last name on the rest of the first name.
  if(row.lastOnly){
    // Each tie-breaker is used only when it leaves someone (a profile may give the legal first name: Christopher, Earl).
    if(row.clipped&&hits.length>1){const h=hits.filter(p=>[firstOf(p.name),firstOf(p.short||'')].some(f=>f&&f.endsWith(first)));if(h.length)hits=h;}
    if(row.staleDistrict&&rd!=null&&hits.length>1){const h=hits.filter(p=>p.district!=null&&seat(p.district)===seat(rd));if(h.length)hits=h;}
    return hits.length===1?hits[0]:null;
  }
  if(hits.length<=1)return hits[0]&&(firstOf(hits[0].name)[0]===first[0]||firstOf(hits[0].short||'')[0]===first[0])?hits[0]:null;
  return hits.find(p=>firstOf(p.name)===first||firstOf(p.short||'')===first)||null;
}

// A House district as a number (0 at large), from 7, "PA-10" or "AK-AL".
export const districtOf=d=>typeof d==='number'?d:/-AL$/i.test(String(d||''))?0:/-(\d{1,2})$/.test(String(d||''))?Number(/-(\d{1,2})$/.exec(d)[1]):null;
// A document's bytes (a PDF), or why not.
async function getBytes(url){
  const res=await fetch(url,{headers:{'User-Agent':UA},redirect:'follow',signal:AbortSignal.timeout(120000)});
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(botCheck(res.status,res.url,new TextDecoder().decode(bytes.subarray(0,4000))))throw new Error(`the site answered with a bot check (HTTP ${res.status}), so it is left out`);
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return bytes;
}
async function get(url){
  const res=await fetch(url,{headers:{'User-Agent':UA},redirect:'follow',signal:AbortSignal.timeout(60000)});
  const html=await res.text();
  if(botCheck(res.status,res.url,html.slice(0,4000)))throw new Error(`the site answered with a bot check (HTTP ${res.status}), so it is left out`);
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return html;
}
// One group: every page, read and matched.
export async function collect(reader,people,{fetchPage=get,fetchBytes=getBytes,browse=browserData,wait=2000,today=new Date()}={}){
  const rows=[];
  if(reader.rows)rows.push(...await reader.rows(fetchPage,{wait,today,fetchBytes,browse}));
  else if(reader.paged){for(let pg=0;pg<60;pg++){const html=await fetchPage(`${reader.url}?pg=${pg}`);const got=reader.read(html);rows.push(...got);if(!got.length||!rfaHasNext(html,pg))break;await sleep(wait);}}
  else rows.push(...reader.read(await fetchPage(reader.url)));
  const found=new Map();
  for(const r of rows){const p=matchPerson(r,people);if(p)(found.get(p.id)||found.set(p.id,[]).get(p.id)).push(r);}
  // Several entries for one person (listed twice after a special election, or a former member with the same name): the
  // incumbent's when one is marked, else the entry when they agree; when they disagree, none.
  const matched=[];
  for(const [id,list] of found){
    const inc=list.filter(r=>r.incumbent),pool=inc.length?inc:list;
    if(new Set(pool.map(r=>`${r.score??''}|${r.grade??''}`)).size===1)matched.push({id,row:pool[0]});
  }
  return {rows,matched};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),i=args.indexOf('--only'),only=i>=0?new Set(String(args[i+1]||'').split(',')):null;
  const research=JSON.parse(await fs.readFile(new URL('public/research.json',root),'utf8'));
  // The full profiles, and the basic ones (every other senator and House member, data/config.json), whose Ideology tab
  // shows the same ratings.
  const config=JSON.parse(await fs.readFile(new URL('data/config.json',root),'utf8'));
  const full=[...research.members,...research.cands],have=new Set(full.map(p=>p.id));
  const people=[...full,...config.people.filter(p=>p.basic&&!have.has(p.id))].map(p=>({id:p.id,name:p.name,short:p.short,state:stateCode(p.state)||stateCode(p.stateName),chamber:p.chamber,district:p.chamber==='H'?districtOf(p.district):null,bioguide:p.bioguide||null,cand:!!p.cand}));
  const file=new URL('public/group-ratings.json',root);
  const out=await fs.readFile(file,'utf8').then(JSON.parse,()=>({groups:{},people:{}}));
  const checked=new Date().toISOString().slice(0,10);
  for(const r of READERS.filter(r=>!only||only.has(r.key))){
    process.stdout.write(`${r.org}… `);
    try{
      const {rows,matched}=await collect(r,people);
      const years=[...new Set(rows.map(x=>x.year).filter(Boolean))].sort();
      out.groups[r.key]={org:r.org,lean:r.lean,issue:r.issue,url:r.url,read:checked,rated:rows.length,matched:matched.length,year:years.at(-1)||null};
      for(const id of Object.keys(out.people))out.people[id]=out.people[id].filter(x=>x.group!==r.key);
      for(const {id,row} of matched)(out.people[id]||=[]).push({group:r.key,org:r.org,lean:r.lean,issue:r.issue,...(row.score!=null?{score:row.score}:{}),...(row.grade?{grade:row.grade}:{}),...(row.lifetime!=null?{lifetime:row.lifetime}:{}),year:row.year||null,url:row.url||r.url,name:row.name});
      console.log(`${rows.length} rated, ${matched.length} of our profiles matched.`);
    }catch(e){out.groups[r.key]={...(out.groups[r.key]||{}),org:r.org,lean:r.lean,issue:r.issue,url:r.url,why:e.message,tried:checked};console.log(`not read: ${e.message}`);}
    await sleep(2000);
  }
  for(const [k,g] of Object.entries(probedGroups()))if(!READERS.some(r=>r.key===k))out.groups[k]=g;
  // A group no longer listed (taken off the list) is dropped, with its ratings.
  const listed=new Set([...READERS.map(r=>r.key),...Object.keys(PROBED)]);
  for(const k of Object.keys(out.groups))if(!listed.has(k))delete out.groups[k];
  for(const id of Object.keys(out.people))out.people[id]=out.people[id].filter(x=>listed.has(x.group));
  out.checked=checked;
  for(const id of Object.keys(out.people))if(!out.people[id].length)delete out.people[id];
  await fs.writeFile(file,JSON.stringify({about:'Interest groups\' published ratings of the profiled members, exactly as each group gives them (scripts/collect-ratings.mjs). Shown on the Ideology tab; the Ratings lean is a check beside the issue leans, never part of a grade.',...out},null,1)+'\n');
  console.log(`\nWrote public/group-ratings.json (${Object.keys(out.people).length} profiles with at least one rating). Commit and push it.`);
}
