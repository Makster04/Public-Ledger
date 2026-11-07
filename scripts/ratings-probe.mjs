// What each interest group's scorecard pages serve, so a reader can be written for each one from the real thing
// (the Ideology tab's group ratings, Scores/06_SIX_GRADES_PROPOSAL.md). Nothing here is scored or shown on the site.
//   npm run ratings:probe                    every group below
//   npm run ratings:probe -- --only lcv,nra  some of them
// Writes data/ratings-probe.txt (for each address: what it answered, its title, the links and tables on it, whether the
// profiled members' names appear in it, and the data addresses its scripts ask for) and, for each page, a copy without
// its scripts and styles (at most 150 KB) in data/ratings-samples/. Commit and push both so the readers can be written.
// It asks as Public Ledger, about one page every two seconds. A site that answers with a bot check is recorded as such
// and left alone: the rule is to leave a group out rather than get around a block or type its ratings in by hand.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sampleOf,scriptAddresses,botCheck} from './county-results.mjs';

const root=new URL('../',import.meta.url);
const UA='Mozilla/5.0 (compatible; PublicLedger/1.0; interest group scorecards)';

// Each group: its side (as the Ideology tab pairs them), the issue it rates on, and the addresses to look at: its
// scorecard's home and, where known, the members list or a download. Some addresses are best guesses; the probe says
// which answer.
export const GROUPS=[
  {key:'heritage',org:'Heritage Action for America',lean:'conservative',issue:'Overall',urls:['https://heritageaction.com/scorecard','https://heritageaction.com/scorecard/members/119','https://heritageaction.com/api/scorecard/scores/member','https://heritageaction.com/api/scorecard/scores/states','https://heritageaction.com/api/scorecard/scores/averageforchamber','https://heritageaction.com/api/scorecard/scores/mostconservative']},
  {key:'clubforgrowth',org:'Club for Growth',lean:'conservative',issue:'Taxes & spending',urls:['https://www.clubforgrowth.org/scorecards/','https://www.clubforgrowth.org/scorecards/app/?party=all&chamber=S&yr=2025&state=all&rep','https://www.clubforgrowth.org/scorecards/app/?party=all&chamber=H&yr=2025&state=all&rep']},
  {key:'afp',org:'Americans for Prosperity',lean:'conservative',issue:'Taxes & spending',urls:['https://americansforprosperity.org/national-scorecard/','https://americansforprosperity.org/wp-json/']},
  {key:'scf',org:'Senate Conservatives Fund',lean:'conservative',issue:'Overall',urls:['https://senateconservatives.com/scorecard']},
  {key:'nra',org:'NRA',lean:'conservative',issue:'Guns',urls:['https://www.nrapvf.org/grades/','https://www.nrapvf.org/']},
  {key:'sba',org:'SBA Pro-Life America',lean:'conservative',issue:'Abortion',urls:['https://sbaprolife.org/scorecard','https://sbaprolife.org/national-pro-life-scorecard']},
  {key:'nrlc',org:'National Right to Life',lean:'conservative',issue:'Abortion',urls:['https://www.nrlc.org/federal/scorecard/','https://www.nrlc.org/federal/votingrecords/']},
  {key:'chamber',org:'U.S. Chamber of Commerce',lean:'conservative',issue:'Labor',urls:['https://www.uschamber.com/how-they-voted','https://www.uschamber.com/how-they-voted-methodology']},
  {key:'nfib',org:'NFIB',lean:'conservative',issue:'Labor',urls:['https://www.nfib.com/advocacy/how-congress-voted/','https://www.nfib.com/advocacy/voting-records/']},
  {key:'lcv',org:'League of Conservation Voters',lean:'liberal',issue:'Environment',urls:['https://scorecard.lcv.org/','https://scorecard.lcv.org/members-of-congress']},
  {key:'edf',org:'Environmental Defense Fund',lean:'liberal',issue:'Environment',urls:['https://www.edfaction.org/scorecard']},
  {key:'nrdc',org:'NRDC',lean:'liberal',issue:'Environment',urls:['https://www.nrdcactionfund.org/scorecard/']},
  {key:'aflcio',org:'AFL-CIO',lean:'liberal',issue:'Labor',urls:['https://aflcio.org/scorecard','https://aflcio.org/scorecard/legislators']},
  {key:'seiu',org:'SEIU',lean:'liberal',issue:'Labor',urls:['https://www.seiu.org/scorecard']},
  {key:'afscme',org:'AFSCME',lean:'liberal',issue:'Labor',urls:['https://www.afscme.org/scorecard']},
  {key:'nea',org:'NEA',lean:'liberal',issue:'Labor',urls:['https://educationvotes.nea.org/report-card/','https://educationvotes.nea.org/scorecard/']},
  {key:'aft',org:'AFT',lean:'liberal',issue:'Labor',urls:['https://www.aft.org/scorecard']},
  {key:'giffords',org:'Giffords',lean:'liberal',issue:'Guns',urls:['https://giffords.org/scorecard/']},
  {key:'everytown',org:'Everytown',lean:'liberal',issue:'Guns',urls:['https://www.everytown.org/scorecard/']},
  {key:'ppaction',org:'Planned Parenthood Action',lean:'liberal',issue:'Abortion',urls:['https://www.plannedparenthoodaction.org/congressional-scorecard','https://www.plannedparenthoodaction.org/congressional-scorecard/senate','https://www.plannedparenthoodaction.org/congressional-scorecard/house']},
  {key:'rfa',org:'Reproductive Freedom for All',lean:'liberal',issue:'Abortion',urls:['https://reproductivefreedomforall.org/congressional-record/','https://reproductivefreedomforall.org/scorecard/']},
  // ACLU and HRC: probed only to see what they publish; their ratings wait on their permission (.03_Future_Goals.md).
  {key:'hrc',org:'Human Rights Campaign',lean:'liberal',issue:'Civil rights',permission:true,urls:['https://www.hrc.org/resources/congressional-scorecard']},
  {key:'aclu',org:'ACLU',lean:'liberal',issue:'Civil rights',permission:true,urls:['https://www.aclu.org/congressional-scorecards']},
];

const strip=t=>String(t||'').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&rsquo;/g,"'").replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// The words that mark a link worth following to the ratings themselves.
const RATING_LINK=/scorecard|score|member|legislator|senat|house|congress|vote|grade|rating|report|download|csv|xlsx?|json|pdf|119|2025|2026/i;

// The tables on a page, each as its heading row and how many rows it has.
export function tablesOf(html){
  return [...String(html).matchAll(/<table\b[\s\S]*?<\/table>/gi)].slice(0,8).map(m=>{
    const rows=[...m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)],cells=r=>[...r[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c=>strip(c[1]).slice(0,30));
    return `${rows.length} rows; first: ${(rows[0]?cells(rows[0]):[]).join(' | ')}${rows[1]?`; second: ${cells(rows[1]).join(' | ')}`:''}`;
  });
}
// How many of the profiled members' last names appear on a page: a scorecard that lists them in its own HTML shows
// many; one filled in by its scripts shows few or none.
export function namesOn(text,surnames){
  const t=String(text).toLowerCase();return surnames.filter(n=>n.length>3&&new RegExp(`\\b${n.toLowerCase()}\\b`).test(t));
}
// What one address serves.
export async function probe(u,{get=fetch,surnames=[]}={}){
  let res;try{res=await get(u,{headers:{'User-Agent':UA},redirect:'follow',signal:AbortSignal.timeout(45000)});}
  catch(e){return {lines:[`${u} → couldn't connect (${e.cause?.code||e.message})`],sample:null};}
  const type=(res.headers.get('content-type')||'').split(';')[0],bytes=new Uint8Array(await res.arrayBuffer()),text=new TextDecoder().decode(bytes.subarray(0,4e6));
  const lines=[`${u} → HTTP ${res.status}${res.redirected?` (now ${res.url})`:''}, ${type||'no type'}, ${Math.round(bytes.length/1024)} KB`],base=res.url||u;
  if(botCheck(res.status,res.url,text.slice(0,4000))){lines.push('    A bot check, not the page: this site turns scripts away, so this group is left out.');return {lines,sample:null};}
  if(/pdf/i.test(type)){lines.push('    A PDF: its text can be read if it isn\'t a scanned image.');return {lines,sample:null};}
  if(/^\s*[{[]/.test(text.slice(0,200))){
    try{const j=JSON.parse(text),first=Array.isArray(j)?j[0]:j;lines.push(`    JSON: ${Array.isArray(j)?`a list of ${j.length}; first item's keys: `:'keys: '}${first&&typeof first==='object'?Object.keys(first).slice(0,20).join(', '):''}`);}
    catch{lines.push('    JSON that doesn\'t read (cut off?)');}
    return {lines,sample:{ext:'json',text:text.slice(0,150000)}};
  }
  if(!/^\s*</.test(text.slice(0,400))){lines.push(`    starts: ${text.slice(0,240).replace(/\s+/g,' ')}`);return {lines,sample:{ext:'txt',text:text.slice(0,150000)}};}
  const body=strip(text);
  lines.push(`    title: ${strip(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1]||'(none)').slice(0,110)} · ${body.length.toLocaleString('en-US')} characters of text`);
  const names=namesOn(body,surnames);
  lines.push(`    profiled members named on the page: ${names.length}${names.length?` (${names.slice(0,12).join(', ')}${names.length>12?' …':''})`:' (the ratings may be filled in by its scripts, or on another page)'}`);
  const seen=new Set();
  for(const m of text.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1],t=strip(m[2]);if(!href||/^(#|javascript:|mailto:|tel:)/i.test(href))continue;
    let a;try{a=new URL(href,base).href;}catch{continue;}
    if(seen.has(a)||!RATING_LINK.test(`${t} ${a}`)||/facebook|twitter|x\.com|instagram|youtube|linkedin|donate|privacy|cookie/i.test(a))continue;
    seen.add(a);lines.push(`    link: ${t.slice(0,60)||'(no text)'} → ${a}`);if(seen.size>=20)break;
  }
  for(const t of tablesOf(text))lines.push(`    table: ${t}`);
  // A page filled in by its scripts: the data addresses in its own scripts and the ones it loads from its own site.
  const found=new Set(scriptAddresses(text));
  const srcs=[...text.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(m=>{try{return new URL(m[1],base);}catch{return null;}}).filter(x=>x&&x.host===new URL(base).host).slice(0,4);
  for(const src of srcs){try{const r=await get(src.href,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(45000)});for(const v of scriptAddresses(await r.text()))found.add(v);}catch{}}
  const data=[...found].filter(v=>/score|member|legislator|vote|rating|grade|api|json|csv/i.test(v)).slice(0,24);
  if(data.length)lines.push(`    data addresses in its scripts: ${data.join(' · ')}`);
  return {lines,sample:{ext:'html',text:sampleOf(text)}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),i=args.indexOf('--only'),only=i>=0?new Set(String(args[i+1]||'').split(',')):null;
  const research=JSON.parse(await fs.readFile(new URL('public/research.json',root),'utf8'));
  const surnames=[...new Set([...research.members,...research.cands].map(p=>String(p.name).replace(/\b(Jr|Sr|III|II)\b\.?/g,'').trim().split(/\s+/).pop()))];
  const groups=GROUPS.filter(g=>!only||only.has(g.key));
  if(!groups.length){console.log(`No group with that key. The keys: ${GROUPS.map(g=>g.key).join(', ')}`);process.exit(1);}
  const samples=new URL('data/ratings-samples/',root);await fs.mkdir(samples,{recursive:true});
  const out=[`Interest group scorecards probe, ${new Date().toISOString()}: what each group's scorecard pages serve, for writing its reader.`];
  console.log(`Looking at ${groups.length} group${groups.length===1?"'s":"s'"} scorecard pages (about one page every two seconds)…`);
  for(const g of groups){
    out.push('',`${g.org} (${g.key}) · ${g.lean} · ${g.issue}${g.permission?' · shown only with their permission':''}`);console.log(`${g.org}…`);
    let n=0;for(const u of g.urls){const r=await probe(u,{surnames});out.push(...r.lines.map(l=>'  '+l));
      if(r.sample){n++;await fs.writeFile(new URL(`${g.key}-${n}.${r.sample.ext}`,samples),r.sample.text);}await sleep(2000);}
  }
  await fs.writeFile(new URL('data/ratings-probe.txt',root),out.join('\n')+'\n');
  console.log(`\nSaved data/ratings-probe.txt and the pages in data/ratings-samples/. Commit and push them so each group's reader can be written from what its site serves.`);
}
