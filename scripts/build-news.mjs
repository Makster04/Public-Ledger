// The site's news, for the ticker under the top bar and the Latest updates page (public/ticker.js), written to
// public/news.json (approved 2026-11-14):
//   grade     a grade that moved since the last six-score log (scripts/scores-monthly.mjs, the page's own scoring), or
//             someone newly graded or no longer graded: Keeps Their Word, Shows Up and People First, for everyone graded
//   promise   a reviewed promise verdict (data/promise-reviews.json: kept, partially kept, broken, allegedly broken),
//             dated by the review
//   lobby     a tracker's PAC checks to sitting members, from this cycle's FEC bulk files (pas2 and cm in .local/fec-bulk/):
//             one item per PAC, date and amount, with every member who got that check
//   superpac  a tracker's own super PAC's spending for or against a candidate, from the cycle's independent-expenditure
//             file (each transaction at its latest amendment): one item per super PAC, candidate, side and day, at least
//             $10,000
// Each item keeps "seen", when a run first found it (the last file's, else now); on the first file, items have none and
// go by their own date. An item stays while its "seen" (or date) is under 45 days old, even after its source moves on (a
// grade change the next monthly log takes in stays listed). The bulk files are read when they're on disk (npm run
// corporate:pacs downloads them); otherwise the last file's lobby and super PAC items are kept as they were.
//   npm run news:build    (also run at the end of npm run corporate:pacs and npm run promises:build)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {letter} from '../public/grades.js';
import {buildEntry,sixFiles,formulaOf} from './scores-monthly.mjs';
import {committeeKind,committeeCheck,trackersOf,membersByCandidate,lines} from './build-corporate-pacs.mjs';
import {readIeRecords,latestVersions,isoDate,seatOf,partyOf,trackerOfSpender} from './build-super-pac-races.mjs';

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
export function gradeNews(before,now,date){
  const out=[];
  for(const [id,x] of Object.entries(now||{}))for(const g of GRADES){
    const a=before?.[id]?.[g],b=x?.[g];if(!b)continue;
    const from=a?a.pct??null:null,to=b.pct??null;
    if(from===to)continue;
    out.push({key:`grade:${id}:${g}:${from??'n'}>${to??'n'}`,kind:'grade',id,grade:g,from,to,
      fromLetter:from==null?null:letter(Math.min(100,from)),toLetter:to==null?null:letter(Math.min(100,to)),why:gradeWhy(g,a,b),date});
  }
  return out;
}
// Reviewed verdicts: reviews is data/promise-reviews.json's "people", promises public/promises.json's.
export function promiseNews(reviews,promises){
  const out=[];
  for(const [id,list] of Object.entries(reviews||{}))for(const [key,r] of Object.entries(list||{})){
    if(!VERDICTS[r?.status]||!r.date)continue;
    const p=(promises?.[id]||[]).find(x=>x.key===key),quote=String(p?.quote||'').trim();
    out.push({key:`promise:${id}:${key}:${r.status}`,kind:'promise',id,promise:key,status:r.status,
      quote:quote.length>90?quote.slice(0,88).replace(/\s+\S*$/,'')+'…':quote,date:r.date});
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
// This run's items with the last file's: an item keeps its "seen" (a new one gets now's, or none on the first file);
// one the run didn't find again stays; anything 45 days old (by "seen", else its date) goes.
export function mergeNews(prev,fresh,{now=Date.now()}={}){
  const first=!prev,old=new Map((prev?.items||[]).map(x=>[x.key,x])),stamp=new Date(now).toISOString(),out=new Map();
  for(const x of fresh)out.set(x.key,{...x,seen:old.has(x.key)?old.get(x.key).seen??null:first?null:stamp});
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
  const names=new Map(),keysOf=new Map(),out=[];
  for await(const line of lines(cm,'cm.txt')){const k=committeeKind(line);if(k)names.set(k[0],k[2]);}
  for await(const line of lines(pas2,'itpas2.txt')){
    const x=committeeCheck(line);if(!x||!byCand.has(x.cand))continue;
    if(!keysOf.has(x.cmte))keysOf.set(x.cmte,trackersOf(x.cmte,names.get(x.cmte)));
    const keys=keysOf.get(x.cmte);if(keys.length)out.push({cmte:x.cmte,pac:names.get(x.cmte)||x.cmte,id:byCand.get(x.cand),amount:x.amount,date:mdy(x.date),keys});
  }
  return out;
}
// Builds and writes public/news.json; returns it.
export async function writeNews({now=Date.now(),dir=process.env.FEC_BULK_DIR||path.join(ROOT,'.local','fec-bulk'),log=console.log}={}){
  const config=readIf('data/config.json')||{},cycle=Number(config.cycle)||2026,today=new Date(now).toISOString().slice(0,10);
  const prev=readIf('public/news.json'),fresh=[];
  // Grades: the page's own scoring now, against the last six-score log.
  const research=readIf('public/research.json'),scoreLog=readIf('public/score-log.json');
  const last=(scoreLog?.entries||[]).filter(e=>formulaOf(e)==='six').at(-1);
  if(research&&last){
    const entry=buildEntry(research,readIf('public/committees.json')||{},readIf('public/committee-sectors.json')||{},readIf('public/funder-history.json'),config,today,readIf('public/vote-party.json')?.votes||null,sixFiles());
    fresh.push(...gradeNews(last.scores,entry.scores,today));
  }
  fresh.push(...promiseNews(readIf('data/promise-reviews.json')?.people,readIf('public/promises.json')?.people));
  const checks=await trackerChecks(dir,cycle);if(checks)fresh.push(...lobbyNews(checks));
  const ie=path.join(dir,`independent_expenditure_${cycle}.csv`);if(fs.existsSync(ie))fresh.push(...superPacNews(await readIeRecords(ie)));
  const items=mergeNews(prev,fresh,{now});
  const out={about:'The site\'s news for the ticker and the Latest updates page: grade changes, reviewed promise verdicts, the trackers\' PAC checks and their super PACs\' spending. See scripts/build-news.mjs.',
    built:today,since:last?.date||null,bulk:{checks:!!checks,superPacs:fs.existsSync(ie)},items};
  fs.writeFileSync(path.join(ROOT,'public','news.json'),JSON.stringify(out));
  const n=k=>items.filter(x=>x.kind===k).length;
  log(`Wrote public/news.json: ${n('grade')} grade changes, ${n('promise')} reviewed verdicts, ${n('lobby')} PAC check groups, ${n('superpac')} super PAC filings${checks?'':' (no bulk files on disk: the last file\'s PAC checks kept)'}.`);
  return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))writeNews().catch(e=>{console.error(e.message);process.exit(1);});
