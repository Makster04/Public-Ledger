// What each interest group's scorecard pages serve, so a reader can be written for each one from the real thing
// (the Ideology tab's group ratings, Scores/06_SIX_GRADES_PROPOSAL.md). Nothing here is scored or shown on the site.
//   npm run ratings:probe                    every group below
//   npm run ratings:probe -- --only lcv,nra  some of them
// Writes data/ratings-probe.txt (for each address: what it answered, its title, the links and tables on it, whether the
// profiled members' names appear in it, and the data addresses its scripts ask for) and, for each page, a copy without
// its scripts and styles (at most 150 KB) in data/ratings-samples/; for a PDF, its text. Commit and push both so the readers can be written.
// It asks as Public Ledger, about one page every two seconds. A site that answers with a bot check is recorded as such
// and left alone: the rule is to leave a group out rather than get around a block or type its ratings in by hand.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sampleOf,scriptAddresses,botCheck} from './county-results.mjs';
import {Worker} from 'node:worker_threads';
import {xlsxText} from './xlsx.mjs';
import {PROBED} from './collect-ratings.mjs';

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
  // Added November 8, 2026: every other group found publishing ratings of members of Congress, with the side and row
  // chosen for each. lean 'none': shown beside the others, never counted in the Ratings lean. Where the first look found
  // the ratings in a document its page links to (a PDF, a spreadsheet, a scorecard site), the addresses are those.
  {key:'nssf',org:'National Shooting Sports Foundation',lean:'conservative',issue:'Guns',urls:['https://www.nssf.org/government-relations/report-card/','https://www.nssf.org/download/nssf-congressional-report-card/?wpdmdl=62675']},
  {key:'goa',org:'Gun Owners of America',lean:'conservative',issue:'Guns',urls:['https://www.gunowners.org/congressional-ratings/','https://www.gunowners.org/scorecard/']},
  {key:'sfla',org:'Students for Life Action',lean:'conservative',issue:'Abortion',urls:['https://www.studentsforlifeaction.org/pro-life-generation-report-card-update-know-the-bills-were-tracking-119th-congressional-session']},
  {key:'aea',org:'American Energy Alliance',lean:'conservative',issue:'Environment',urls:['https://www.americanenergyalliance.org/american-energy-scorecard/','https://www.americanenergyalliance.org/energy-scorecard/','https://www.americanenergyalliance.org/2026/09/american-energy-alliance-releases-2026-american-energy-scorecard/']},
  {key:'defenders',org:'Defenders of Wildlife',lean:'liberal',issue:'Environment',urls:['https://defenders.org/conservation-report-card','https://defenders.org/sites/default/files/2026-03/Conservation-Report-Card-2025.pdf']},
  {key:'climatehawks',org:'Climate Hawks Vote',lean:'liberal',issue:'Environment',urls:['https://climatehawksvote.com/scorecard/','https://climatehawksvote.com/scorecard/ohio/']},
  {key:'cwa',org:'Communications Workers of America',lean:'liberal',issue:'Labor',urls:['https://scorecard.cwa-union.org/']},
  {key:'teamsters',org:'Teamsters',lean:'liberal',issue:'Labor',urls:['https://teamster.org/political-legislative-scorecards/']},
  {key:'apwu',org:'American Postal Workers Union',lean:'liberal',issue:'Labor',urls:['https://apwu.org/congressional-voting-records/']},
  {key:'ntu',org:'National Taxpayers Union',lean:'conservative',issue:'Taxes & spending',urls:['https://www.ntu.org/ratecongress/legislator/SearchResult','https://www.ntu.org/library/doclib/2026/05/NTURC2025rollcalls.xlsx']},
  {key:'ccagw',org:'Council for Citizens Against Government Waste',lean:'conservative',issue:'Taxes & spending',urls:['https://ccagwratings.org/']},
  {key:'network',org:'NETWORK Lobby for Catholic Social Justice',lean:'liberal',issue:'Taxes & spending',urls:['https://media.networklobby.org/uploads/2026/01/2025-NETWORK-Voting-Record.pdf']},
  {key:'naacp',org:'NAACP',lean:'liberal',issue:'Civil rights',urls:['https://naacp.org/find-resources/legislative-report-cards']},
  {key:'civilrights',org:'The Leadership Conference on Civil and Human Rights',lean:'liberal',issue:'Civil rights',urls:['https://civilrights.org/wp-content/uploads/2026/10/119th-Congress.pdf']},
  {key:'aauw',org:'AAUW',lean:'liberal',issue:'Civil rights',urls:['https://act.aauw.org/CVR2026']},
  {key:'cpac',org:'CPAC',lean:'conservative',issue:'Overall',urls:['https://dea0d469-c1d7-4068-bddd-0a3895cc096b.usrfiles.com/ugd/dea0d4_1fbfb19d94774b4a889fd895daf6b73c.pdf','https://ratings.conservative.org/']},
  {key:'jbs',org:'John Birch Society (Freedom Index)',lean:'conservative',issue:'Overall',urls:['https://freedomindex.us/us/legislators/','https://freedomindex.us/us/report/255/','https://thenewamerican.com/files/Freedom_Index_119-3.pdf']},
  {key:'rlc',org:'Republican Liberty Caucus (Liberty Index)',lean:'conservative',issue:'Overall',urls:['https://rlc.org/wp-content/uploads/2026/03/Liberty-Index-2026-US-Senate.pdf','https://rlc.org/wp-content/uploads/2026/03/Liberty-Index-2026-US-House.pdf']},
  {key:'progressivepunch',org:'ProgressivePunch',lean:'liberal',issue:'Overall',urls:['https://www.progressivepunch.org/','https://www.progressivepunch.org/scores.htm?house=house']},
  {key:'ada',org:'Americans for Democratic Action',lean:'liberal',issue:'Overall',urls:['https://adaction.org/','https://adaction.org/voting-records/']},
  {key:'numbersusa',org:'NumbersUSA',lean:'conservative',issue:'Immigration',urls:['https://grades.numbersusa.com/','https://grades.numbersusa.com/search/']},
  {key:'frc',org:'FRC Action',lean:'conservative',issue:'Family & religion',urls:['https://www.frcaction.org/get.cfm?c=FRCA_SCORECARD&scorecard=scorecard_senate','https://www.frcaction.org/get.cfm?c=FRCA_SCORECARD&scorecard=scorecard_house']},
  {key:'ncpssm',org:'National Committee to Preserve Social Security and Medicare',lean:'liberal',issue:'Seniors',urls:['https://www.ncpssm.org/119th-congress/','https://www.ncpssm.org/scorecard/vote-descriptions/']},
  {key:'ara',org:'Alliance for Retired Americans',lean:'liberal',issue:'Seniors',urls:['https://retiredamericans.org/voting-record/embed/','https://retiredamericans.org/wp-content/uploads/2026/03/2025-Congressional-Voting-Record.pdf']},
  {key:'ecu',org:'End Citizens United',lean:'liberal',issue:'Money in politics',urls:['https://www.endcitizensunited.org/end-citizens-united-action-fund-releases-anti-corruption-scorecard-for-119th-congress']},
  {key:'commoncause',org:'Common Cause',lean:'liberal',issue:'Money in politics',urls:['https://democracyscorecard.org/']},
  {key:'humane',org:'Humane World Action Fund',lean:'liberal',issue:'Animal welfare',urls:['https://humaneaction.org/current_scorecard']},
  {key:'standwithcrypto',org:'Stand With Crypto',lean:'conservative',issue:'Crypto & tech',urls:['https://www.standwithcrypto.org/politicians']},
  {key:'c4ip',org:'Council for Innovation Promotion',lean:'none',issue:'Crypto & tech',urls:['https://c4ip.org/interactive-scorecard/','https://c4ip.org/wp-content/uploads/2026/05/C4IP-Congressional-Innovation-Scorecard-Third-Edition.pdf']},
  {key:'ajp',org:'AJP Action',lean:'liberal',issue:'Israel, Palestine & Iran',urls:['https://ajpaction.org/wp-content/uploads/2026/05/AJP-Action-Congressional-Scorecard-2026.xlsx','https://ajpaction.org/scorecard2026/']},
  {key:'imeu',org:'IMEU Policy Project',lean:'liberal',issue:'Israel, Palestine & Iran',urls:['https://imeupolicyproject.org/scorecard']},
  {key:'niac',org:'NIAC Action',lean:'liberal',issue:'Israel, Palestine & Iran',urls:['https://scorecard.niacaction.org/']},
  {key:'napo',org:'National Association of Police Organizations',lean:'conservative',issue:'Policing',urls:['https://www.napo.org/legislative-scorecard/']},
  {key:'norml',org:'NORML',lean:'liberal',issue:'Marijuana',urls:['https://vote.norml.org/']},
  {key:'lugar',org:'The Lugar Center (Bipartisan Index)',lean:'none',issue:'Bipartisanship',urls:['https://www.thelugarcenter.org/ourwork-Bipartisan-Index.html']},
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
// A PDF's text, read in a thread of its own with a memory limit and a time limit, so one PDF can't stop the run:
// {text} or {text: '', why}.
export function pdfTextLimited(bytes,{memoryMb=1024,timeout=120000}={}){
  return new Promise(resolve=>{
    let w;
    try{w=new Worker(new URL('./pdf-text-worker.mjs',import.meta.url),{workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:memoryMb}});}
    catch(e){resolve({text:'',why:e.message});return;}
    const timer=setTimeout(()=>{resolve({text:'',why:`it took longer than ${Math.round(timeout/1000)} seconds`});w.terminate();},timeout);
    w.once('message',text=>{clearTimeout(timer);resolve({text:String(text||'')});w.terminate();});
    w.once('error',e=>{clearTimeout(timer);resolve({text:'',why:e.code==='ERR_WORKER_OUT_OF_MEMORY'?`it needed more than ${memoryMb} MB of memory`:e.message});});
    w.once('exit',()=>{clearTimeout(timer);resolve({text:'',why:'the reader stopped'});});
  });
}
// What one address serves.
export async function probe(u,{get=fetch,surnames=[]}={}){
  let res;try{res=await get(u,{headers:{'User-Agent':UA},redirect:'follow',signal:AbortSignal.timeout(45000)});}
  catch(e){return {lines:[`${u} → couldn't connect (${e.cause?.code||e.message})`],sample:null};}
  const type=(res.headers.get('content-type')||'').split(';')[0],bytes=new Uint8Array(await res.arrayBuffer()),text=new TextDecoder().decode(bytes.subarray(0,4e6));
  const lines=[`${u} → HTTP ${res.status}${res.redirected?` (now ${res.url})`:''}, ${type||'no type'}, ${Math.round(bytes.length/1024)} KB`],base=res.url||u;
  if(botCheck(res.status,res.url,text.slice(0,4000))){lines.push('    A bot check, not the page: this site turns scripts away, so this group is left out.');return {lines,sample:null};}
  if(/pdf/i.test(type)||/^%PDF-/.test(text.slice(0,8))){
    // Its text, read the way the House trade reports are (src/pdf.mjs), saved so a reader can be written from it.
    const {text:t,why}=await pdfTextLimited(bytes);
    if(why){lines.push(`    A PDF that couldn't be read here: ${why}.`);return {lines,sample:null};}
    if(!t.trim()){lines.push('    A PDF with no text (a scanned image, or one this reader can\'t open).');return {lines,sample:null};}
    const names=namesOn(t,surnames);
    lines.push(`    A PDF: ${t.length.toLocaleString('en-US')} characters of text; profiled members named in it: ${names.length}${names.length?` (${names.slice(0,12).join(', ')}${names.length>12?' …':''})`:''}`);
    lines.push(`    starts: ${t.slice(0,240).replace(/\s+/g,' ')}`);
    return {lines,sample:{ext:'txt',text:t.slice(0,150000)}};
  }
  // A spreadsheet (.xlsx, a zip): its sheets as text.
  if(bytes[0]===0x50&&bytes[1]===0x4b||/spreadsheetml|ms-excel/i.test(type)){
    let t='';try{t=xlsxText(bytes);}catch{}
    if(!t.trim()){lines.push('    A spreadsheet that couldn\'t be read.');return {lines,sample:null};}
    const names=namesOn(t,surnames);
    lines.push(`    A spreadsheet: ${t.split('\n').length.toLocaleString('en-US')} rows; profiled members named in it: ${names.length}${names.length?` (${names.slice(0,12).join(', ')}${names.length>12?' …':''})`:''}`);
    lines.push(`    starts: ${t.slice(0,240).replace(/\s+/g,' ')}`);
    return {lines,sample:{ext:'txt',text:t.slice(0,150000)}};
  }
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
  const args=process.argv.slice(2),i=args.indexOf('--only');
  // --to-build: the groups whose reader is still to be written (PROBED in scripts/collect-ratings.mjs).
  const only=i>=0?new Set(String(args[i+1]||'').split(',')):args.includes('--to-build')?new Set(Object.entries(PROBED).filter(([,x])=>x[3]==='to-build').map(([k])=>k)):null;
  const research=JSON.parse(await fs.readFile(new URL('public/research.json',root),'utf8'));
  const surnames=[...new Set([...research.members,...research.cands].map(p=>String(p.name).replace(/\b(Jr|Sr|III|II)\b\.?/g,'').trim().split(/\s+/).pop()))];
  const groups=GROUPS.filter(g=>!only||only.has(g.key));
  if(!groups.length){console.log(`No group with that key. The keys: ${GROUPS.map(g=>g.key).join(', ')}`);process.exit(1);}
  const samples=new URL('data/ratings-samples/',root);await fs.mkdir(samples,{recursive:true});
  const file=new URL('data/ratings-probe.txt',root);
  // A run for some groups keeps what earlier runs found for the others; the notes are saved after each group.
  const kept=only?(await fs.readFile(file,'utf8').catch(()=>'')).trim().split('\n\n').slice(1).filter(x=>!groups.some(g=>x.startsWith(`${g.org} (${g.key})`))):[];
  const out=[`Interest group scorecards probe, ${new Date().toISOString()}: what each group's scorecard pages serve, for writing its reader.`];
  const save=()=>fs.writeFile(file,[...out,...kept.flatMap(k=>['',k])].join('\n')+'\n');
  console.log(`Looking at ${groups.length} group${groups.length===1?"'s":"s'"} scorecard pages (about one page every two seconds)…`);
  for(const g of groups){
    out.push('',`${g.org} (${g.key}) · ${g.lean} · ${g.issue}${g.permission?' · shown only with their permission':''}`);console.log(`${g.org}…`);
    let n=0;for(const u of g.urls){const r=await probe(u,{surnames});out.push(...r.lines.map(l=>'  '+l));
      if(r.sample){n++;await fs.writeFile(new URL(`${g.key}-${n}.${r.sample.ext}`,samples),r.sample.text);}await sleep(2000);}
    await save();
  }
  console.log(`\nSaved data/ratings-probe.txt and the pages in data/ratings-samples/. Commit and push them so each group's reader can be written from what its site serves.`);
}
