// The site's news, for the ticker under the top bar and the Latest updates page (public/ticker.js), written to
// public/news.json (approved 2026-11-14):
//   grade     a grade that moved since the last six-score log (scripts/scores-monthly.mjs, the page's own scoring), or
//             someone newly graded or no longer graded: Keeps Their Word, Shows Up and People First, for everyone graded
//   promise   a reviewed promise verdict (data/promise-reviews.json: kept, partially kept, broken, allegedly broken),
//             dated by the review
//   lobby     a tracker's PAC checks to sitting members, from this cycle's FEC bulk files (pas2 and cm in .local/fec-bulk/):
//             one item per PAC, date and amount, with every member who got that check
//   site      a site update: each dated line of data/site-updates.md (its bold title is the headline), after the newest
//             headline in public/score-presentation-log.json, which had them before (since Nov. 25, 2026; in the README's
//             "What's new" until Nov. 26); a line ending in <!-- not news --> is maintenance and is left out. Placed by
//             its own date.
//   conflict  someone's Conflicts of Interest score (public/conflicts.json) newly given or moved since the last run, with
//             the interested organizations behind it
//   superpac  a tracker's own super PAC's spending for or against a candidate, from the cycle's independent-expenditure
//             file (each transaction at its latest amendment): one item per super PAC, candidate, side and day, at least
//             $10,000
// Each item keeps "seen", when a run first found it (the last file's, else now); on the first file, items have none and
// go by their own date. An item stays while its "seen" (or date) is under 45 days old, even after its source moves on (a
// grade change the next monthly log takes in stays listed). The bulk files are read when they're on disk (npm run
// corporate:pacs downloads them); otherwise the last file's lobby and super PAC items are kept as they were.
//   npm run news:build    (also run at the end of npm run corporate:pacs and npm run promises:build)
//   node scripts/build-news.mjs --local   writes .local/news.json instead: npm start runs it once a day by itself
//                                         (scripts/news-file.mjs)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {letter} from '../public/grades.js';
import {buildEntry,sixFiles,formulaOf} from './scores-monthly.mjs';
import {committeeKind,committeeCheck,trackersOf,membersByCandidate,lines} from './build-corporate-pacs.mjs';
import {readIeRecords,latestVersions,isoDate,seatOf,partyOf,trackerOfSpender} from './build-super-pac-races.mjs';
import {NEWS_FILES,newestNews} from './news-file.mjs';
import {conflictsComponent} from '../public/integrity.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const NEWS_DAYS=45,NEWS_LIMIT={lobby:60,superpac:60},SUPER_PAC_MIN=10000;
export const GRADES=['word','showsup','peoplefirst'];
export const VERDICTS={kept:'Kept',partly:'Partially kept',broken:'Broken',alleged:'Allegedly broken'};
const DAY=864e5;
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
// MMDDYYYY -> YYYY-MM-DD
const mdy=d=>/^\d{8}$/.test(d||'')?`${d.slice(4)}-${d.slice(0,2)}-${d.slice(2,4)}`:'';

// Why a grade moved, in plain words, from the counts behind it (scores-monthly.mjs personScores).
export function gradeWhy(g,a,b){
  const d=k=>(Number(b?.[k])||0)-(Number(a?.[k])||0),fresh=!a||a.pct==null;
  if(g==='word'){
    if(fresh)return plural(b.counted||0,'promise')+' decided';
    const c=d('counted'),br=d('broken');
    return c>0?`${plural(c,'more promise')} checked${br>0?`, ${br} broken`:''}`:c<0?`${plural(-c,'fewer promise')} counted`:'a verdict changed';
  }
  if(g==='showsup'){
    if(fresh)return b.votes!=null?`${plural(b.votes,'roll call')} on record`:'their record was read';
    const v=d('votes'),m=d('missed');
    return v>0?`${plural(v,'more roll call')}${m>0?`, ${m} missed`:''}`:d('getItDone')?'their bills moved':'their record changed';
  }
  if(fresh)return `${plural(b.actions||0,'scored action')}`;
  const n=d('actions');return n>0?`${plural(n,'more scored action')}`:n<0?`${plural(-n,'fewer scored action')}`:'a bill\'s score changed';
}
// The grades that moved: before and now are {id: {word, showsup, peoplefirst}} as the score log keeps them.
// wholeNumbers: the last log is from before scores were worked out to one decimal (Nov. 14, 2026), so it holds rounded
// whole numbers: a score that rounds to the logged one (89.7 against a logged 90) only lost its rounding, which isn't news.
export const ONE_DECIMAL_SINCE='2026-11-14';
export function gradeNews(before,now,date,{wholeNumbers=false}={}){
  const out=[];
  for(const [id,x] of Object.entries(now||{}))for(const g of GRADES){
    const a=before?.[id]?.[g],b=x?.[g];if(!b||b.provisional)continue;   // a provisional People First isn't a grade
    const from=a?a.pct??null:null,to=b.pct??null;
    if(from===to)continue;
    // Scores are worked out to one decimal (since Nov. 14, 2026): a move under one point that keeps the letter isn't news.
    if(from!=null&&to!=null&&letter(Math.min(100,from))===letter(Math.min(100,to))&&Math.abs(to-from)<1)continue;
    if(wholeNumbers&&from!=null&&to!=null&&Math.round(to)===from)continue;
    out.push({key:`grade:${id}:${g}:${from??'n'}>${to??'n'}`,kind:'grade',id,grade:g,from,to,
      fromLetter:from==null?null:letter(Math.min(100,from)),toLetter:to==null?null:letter(Math.min(100,to)),why:gradeWhy(g,a,b),date});
  }
  return out;
}
// Reviewed verdicts: reviews is data/promise-reviews.json's "people", promises public/promises.json's. Each keeps the
// promise's topic (the question it's checked against, which the ticker names in a few words), not its words.
export function promiseNews(reviews,promises){
  const out=[];
  for(const [id,list] of Object.entries(reviews||{}))for(const [key,r] of Object.entries(list||{})){
    if(!VERDICTS[r?.status]||!r.date)continue;
    const p=(promises?.[id]||[]).find(x=>x.key===key);
    out.push({key:`promise:${id}:${key}:${r.status}`,kind:'promise',id,promise:key,topic:p?.qs?.[0]?.[0]||String(key).split('@')[0],status:r.status,date:r.date});
  }
  return out;
}
// A tracker's PAC checks, grouped: checks are [{cmte, pac, id (member), amount, date, keys}].
export function lobbyNews(checks,{limit=NEWS_LIMIT.lobby}={}){
  const by=new Map();
  for(const c of checks||[]){
    if(!(c.amount>0)||!c.date||!c.keys?.length)continue;
    const k=`lobby:${c.cmte}:${c.date}:${c.amount}`,o=by.get(k)||{key:k,kind:'lobby',tracker:c.keys[0],trackers:c.keys,pac:c.pac||c.cmte,cmte:c.cmte,amount:c.amount,date:c.date,ids:[]};
    if(!o.ids.includes(c.id))o.ids.push(c.id);by.set(k,o);
  }
  return [...by.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.amount*b.ids.length-a.amount*a.ids.length).slice(0,limit);
}
// The trackers' own super PACs' spending, a day at a time: records are the independent-expenditure file's.
export function superPacNews(records,{limit=NEWS_LIMIT.superpac,min=SUPER_PAC_MIN}={}){
  const by=new Map();
  for(const r of latestVersions(records||[])){
    const tracker=trackerOfSpender(r.spe_id,r.spe_nam),date=isoDate(r.exp_date)||isoDate(r.dissem_dt),seat=seatOf(r.can_office,r.can_office_state,r.can_office_dis);
    if(!tracker||!date||!r.cand_id||!seat)continue;
    const so=r.sup_opp==='O'?'O':'S',k=`sp:${r.spe_id}:${r.cand_id}:${so}:${date}`;
    const o=by.get(k)||{key:k,kind:'superpac',tracker,spender:r.spe_nam,cmte:r.spe_id,cand:r.cand_id,name:r.cand_name,party:partyOf(r.cand_pty_aff),seat,so,
      ele:String(r.ele_type||'').toUpperCase()[0]||'',amount:0,date};
    o.amount+=Number(r.exp_amo)||0;by.set(k,o);
  }
  return [...by.values()].map(o=>({...o,amount:Math.round(o.amount*100)/100})).filter(o=>o.amount>=min)
    .sort((a,b)=>b.date.localeCompare(a.date)||b.amount-a.amount).slice(0,limit);
}
// data/site-updates.md's lines as site updates: "- **Nov. 25: Title.** text" under a month heading, "## November 2026"
// (or the README's old "## What's new (November 2026)").
const MONTH={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
export const SITE_UPDATES='data/site-updates.md';
export function siteNews(text,{after=''}={}){
  const out=[];let year=null;
  for(const line of String(text||'').split('\n')){
    const h=/^##\s+(?:What.s new \()?([A-Z][a-z]+) (\d{4})\)?\s*$/.exec(line);if(h){year=Number(h[2]);continue;}
    if(/^## /.test(line)){year=null;continue;}
    const m=year&&/^- \*\*([A-Z][a-z]{2})[a-z]*\.? (\d{1,2})(?:[–-]\d{1,2})?: (.+?)\*\*/.exec(line);
    if(!m||/<!--\s*not news\s*-->/.test(line)||!MONTH[m[1].toLowerCase()])continue;
    const date=`${year}-${String(MONTH[m[1].toLowerCase()]).padStart(2,'0')}-${m[2].padStart(2,'0')}`;if(date<=after)continue;
    const headline=m[3].replace(/\.$/,'').replace(/`/g,'').trim();
    out.push({key:`site:${date}:${headline.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60)}`,kind:'site',date,headline});
  }
  return out;
}
// Conflicts of Interest: each score in public/conflicts.json that's new or moved since the last run's (scores).
export function conflictNews(conflicts,scores,date){
  const out=[],now={};
  for(const id of Object.keys(conflicts?.people||{})){
    const x=conflictsComponent({id},conflicts);if(!x.complete)continue;
    const to=Math.round(x.value*10)/10,from=scores?.[id]??null;now[id]=to;if(from===to)continue;
    const rec=conflicts.people[id],names=[...new Set(['income','positions','agreements','gifts','travel'].flatMap(k=>(rec[k]||[]).filter(i=>i.interested).map(i=>i.name||i.source||i.org||i.sponsor)))];
    const why=names.length?`${plural(names.length,'interested organization')}: ${names.join(', ')}`:'nothing on their report from an organization with business before their committees';
    out.push({key:`conflict:${id}:${to}`,kind:'conflict',id,from,to,why,date:rec.reviewed?.at||date});
  }
  return {items:out,scores:now};
}
// This run's items with the last file's: an item keeps its "seen" (a new one gets now's, or none on the first file);
// one the run didn't find again stays; anything 45 days old (by "seen", else its date) goes.
export function mergeNews(prev,fresh,{now=Date.now()}={}){
  const first=!prev,old=new Map((prev?.items||[]).map(x=>[x.key,x])),stamp=new Date(now).toISOString(),out=new Map();
  const own=x=>Date.parse(`${String(x.date).slice(0,10)}T12:00:00Z`);
  // An item found for the first time is news from now, unless its own date is already past the 45 days (an old check
  // that was only outside the window before): that one is left out, not stamped.
  for(const x of fresh){if(!old.has(x.key)&&!(now-own(x)<=NEWS_DAYS*DAY))continue;out.set(x.key,{...x,seen:old.has(x.key)?old.get(x.key).seen??null:first?null:stamp});}
  for(const [k,x] of old)if(!out.has(k))out.set(k,x);
  const at=x=>Date.parse(x.seen||`${String(x.date).slice(0,10)}T12:00:00Z`);
  return [...out.values()].filter(x=>Number.isFinite(at(x))&&now-at(x)<=NEWS_DAYS*DAY).sort((a,b)=>at(b)-at(a)||String(a.key).localeCompare(String(b.key)));
}

const readIf=f=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));}catch{return null;}};
// This cycle's tracker PAC checks to sitting members, from the bulk files on disk (null without them).
async function trackerChecks(dir,cycle){
  const yy=String(cycle).slice(2),cm=path.join(dir,`cm${yy}.zip`),pas2=path.join(dir,`pas2${yy}.zip`);
  if(!fs.existsSync(cm)||!fs.existsSync(pas2))return null;
  const byCand=membersByCandidate(readIf('public/senate.json'),readIf('public/house.json'));
  for(const [id,ids] of Object.entries(readIf('public/tracker-history.json')?.linked||{}))for(const c of ids)if(!byCand.has(c))byCand.set(c,id);
  const names=new Map(),cmteCand=new Map(),keysOf=new Map(),out=[];
  for await(const line of lines(cm,'cm.txt')){const k=committeeKind(line);if(!k)continue;names.set(k[0],k[2]);if(k[3])cmteCand.set(k[0],k[3]);}
  for await(const line of lines(pas2,'itpas2.txt')){
    const x=committeeCheck(line,cmteCand);if(!x||!byCand.has(x.cand))continue;
    if(!keysOf.has(x.cmte))keysOf.set(x.cmte,trackersOf(x.cmte,names.get(x.cmte)));
    const keys=keysOf.get(x.cmte);if(keys.length)out.push({cmte:x.cmte,pac:names.get(x.cmte)||x.cmte,id:byCand.get(x.cand),amount:x.amount,date:mdy(x.date),keys});
  }
  return out;
}
// Builds and writes public/news.json (or, with local, .local/news.json); returns it. The "seen" stamps carry forward from
// whichever of the two was built later.
export async function writeNews({now=Date.now(),dir=process.env.FEC_BULK_DIR||path.join(ROOT,'.local','fec-bulk'),log=console.log,local=false}={}){
  const config=readIf('data/config.json')||{},cycle=Number(config.cycle)||2026,today=new Date(now).toISOString().slice(0,10);
  const prev=newestNews(ROOT)?.news||null,fresh=[];
  // Grades: the page's own scoring now, against the last six-score log.
  const research=readIf('public/research.json'),scoreLog=readIf('public/score-log.json');
  const last=(scoreLog?.entries||[]).filter(e=>formulaOf(e)==='six').at(-1);
  if(research&&last){
    const entry=buildEntry(research,readIf('public/committees.json')||{},readIf('public/committee-sectors.json')||{},readIf('public/funder-history.json'),config,today,readIf('public/vote-party.json')?.votes||null,sixFiles());
    fresh.push(...gradeNews(last.scores,entry.scores,today,{wholeNumbers:String(last.date)<ONE_DECIMAL_SINCE}));
  }
  fresh.push(...promiseNews(readIf('data/promise-reviews.json')?.people,readIf('public/promises.json')?.people));
  const plog=readIf('public/score-presentation-log.json'),after=((plog?.entries||plog||[]).map(e=>e.date).sort().at(-1))||'';
  try{fresh.push(...siteNews(fs.readFileSync(path.join(ROOT,SITE_UPDATES),'utf8'),{after}));}catch{}
  const coi=conflictNews(readIf('public/conflicts.json'),prev?.conflicts,today);fresh.push(...coi.items);
  const checks=await trackerChecks(dir,cycle);if(checks)fresh.push(...lobbyNews(checks));
  const ie=path.join(dir,`independent_expenditure_${cycle}.csv`);if(fs.existsSync(ie))fresh.push(...superPacNews(await readIeRecords(ie)));
  const items=mergeNews(prev,fresh,{now}).filter(x=>x.kind!=='conflict'||coi.scores[x.id]===x.to||!(x.id in coi.scores));
  const out={about:'The site\'s news for the ticker and the Latest updates page: grade changes, Conflicts of Interest scores, reviewed promise verdicts, site updates, the trackers\' PAC checks and their super PACs\' spending. See scripts/build-news.mjs.',
    built:today,since:last?.date||null,bulk:{checks:!!checks,superPacs:fs.existsSync(ie)},conflicts:coi.scores,items};
  const file=local?NEWS_FILES.local:NEWS_FILES.committed;
  fs.mkdirSync(path.dirname(path.join(ROOT,file)),{recursive:true});
  fs.writeFileSync(path.join(ROOT,file),JSON.stringify(out));
  const n=k=>items.filter(x=>x.kind===k).length;
  log(`Wrote ${file.split(path.sep).join('/')}: ${n('grade')} grade changes, ${n('conflict')} Conflicts of Interest scores, ${n('site')} site updates, ${n('promise')} reviewed verdicts, ${n('lobby')} PAC check groups, ${n('superpac')} super PAC filings${checks?'':' (no bulk files on disk: the last file\'s PAC checks kept)'}.`);
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))writeNews({local:process.argv.includes('--local')}).catch(e=>{console.error(e.message);process.exit(1);});
