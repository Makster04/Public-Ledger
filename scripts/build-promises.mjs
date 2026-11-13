// Keeps Their Word: every promise a profiled politician made to voters, and whether they kept it.
//
// The promises are the statements tagged to the alignment questions (data/question-statements.json: campaign websites,
// campaign posts, speeches, press releases) whose words commit them to something: "I will…", "I'll vote to…", "Jon will
// defend…", "I support a ban on…". A short quote cut from a longer list ("…legalize cannabis…") is read in its full
// sentence from their campaign text (data/campaign-text/<id>.json), which has to make the commitment. Descriptions of
// their record ("has fought for…"), calls on others ("the President should…") and the like are not promises.
// What they did afterward is their record on the same questions (public/question-evidence/<bioguide>.json: each bill
// they sponsored or cosponsored and each deciding vote, with the side it takes), dated after the promise. Earlier
// actions are background. A bill failing doesn't count against them; only their own vote or (co)sponsorship does.
//   kept         every action after the promise went its way
//   broken       every action went against it; or a reversal: after acting its way, at least 2 later bills went against
//                it and none its way since; or no bill introduced, (co)sponsored or voted on in the GRACE_MONTHS they
//                held office after the promise (or after taking office, for a promise made as a candidate)
//   unclear      some actions each way (often a bill that mixed several things): a reviewer decides
//   no-action    in office, nothing on it yet, and the grace months haven't run out (the date they do is shown)
//   not-tested   not in Congress (a candidate, a member-elect, or out of office) while the promise could be acted on
// A reviewer can settle any promise in data/promise-reviews.json, keyed "<first question>@<date>":
//   kept, step (voted for a first step toward it, ¾), compromise (introduced or (co)sponsored a compromised version, ½),
//   broken, unclear, no-action, not-tested, not-a-promise (left out), promise (a statement the wording test missed);
//   each with "why", shown on the profile, and the date it was reviewed.
// Writes public/promises.json. Run after npm run statements:record and npm run bills:record.
//   npm run promises:build
//   npm run promises:build -- --today 2026-11-13   judge as of a given day
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sentences,commitmentIn} from '../src/promise-finder.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const GRACE_MONTHS=6;
export const STATUSES=['kept','step','compromise','broken','unclear','no-action','not-tested'];
const REVIEWABLE=new Set([...STATUSES,'not-a-promise','promise']);
const norm=s=>String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();
const fmt=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).replace(/^(\w{3}) /,(m,a)=>a==='May'?'May ':`${a}. `).replace(/^Jun\. /,'June ').replace(/^Jul\. /,'July ').replace(/^Sep\. /,'Sept. ');
export const addMonths=(d,n)=>{const t=new Date(d+'T12:00:00Z');const day=t.getUTCDate();t.setUTCDate(1);t.setUTCMonth(t.getUTCMonth()+n);
  const last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();t.setUTCDate(Math.min(day,last));return t.toISOString().slice(0,10);};
const monthsBetween=(a,b)=>{const x=new Date(a+'T12:00:00Z'),y=new Date(b+'T12:00:00Z');return (y.getUTCFullYear()-x.getUTCFullYear())*12+y.getUTCMonth()-x.getUTCMonth()-(y.getUTCDate()<x.getUTCDate()?1:0);};
const plural=(n,w,ws=w+'s')=>`${n} ${n===1?w:ws}`;

// Does a sentence commit its speaker to something? First person ("I will", "I'll vote", "we will", "I support"), the
// campaign writing about them ("Jon will", "He will support", "Ossoff vows to") — not their record ("has fought",
// "voted", "introduced"), and not others ("the President should"). Returns null, or {reactive}: a promise to oppose,
// defend or protect against something is only tested when that something comes up, so doing nothing doesn't break it.
const APOS=`['’]`,esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const ADV=String.raw`(?:(?:also|always|still|firmly|strongly|fully|proudly|vigorously|immediately|continue to|never|not)\s+)*`;
const FUT=String.raw`(?:will|shall|(?:am|are|is) going to|plans? to|intends? to|pledges? to|promises? to|vows? to|commits? to|(?:am|are|is) committed to|(?:am|are|is) determined to|wants? to)`;
const NOW=String.raw`(?:supports?|opposes?|backs?|stands? (?:with|for|against|up for)|(?:am|are|is) fighting (?:for|to|against))`;
const subjects=names=>[String.raw`I|[Ww]e|He|She`,...names.filter(Boolean).map(esc)].join('|');
const PROMISE=new Map();
function promiseRe(names){const k=names.join('|');if(!PROMISE.has(k))PROMISE.set(k,new RegExp(String.raw`\b(?:${subjects(names)})(?:${APOS}(?:ll|m going to|m committed to|re going to)\s+${ADV}|\s+${ADV}(?:${FUT}\s+${ADV}|(?=${NOW}\b)))(\w+(?:\s+\w+)?)`));return PROMISE.get(k);}
const REACTIVE=/^(?:defend|oppose|opposes|protect|preserve|safeguard|resist|reject|block|stop|fight against|fight any|stand against|stand up to|vote against|never|not)\b/i;
// "pledge to oppose any bill…", "I'll stand up to the politicians who…": a promise to oppose, wherever in the sentence.
const REACTIVE_ANY=new RegExp(String.raw`\b(?:will|${APOS}ll|pledge to|vow to|promise to|commit(?:ted)? to)\s+(?:always\s+|never\s+|vigorously\s+|continue to\s+)?(?:oppose|defend|protect|block|stop|resist|reject|fight (?:any|against)|stand up to|stand against)\b`,'i');
export function promiseWords(text,names=[]){
  const s=String(text||''),m=promiseRe(names.filter(Boolean)).exec(s);
  if(m)return {reactive:REACTIVE.test(m[1])||REACTIVE_ANY.test(s)||/\b(?:never|not)\s+$/i.test(s.slice(0,m.index+m[0].length-m[1].length))};
  // The promise finder's own test (floor speeches and posts): "I urge my colleagues to support…", "I won't vote for…".
  for(const name of [null,...names.filter(Boolean)]){const c=commitmentIn(s,name);if(c&&c.kind==='promise')return {reactive:c.side==='against'};}
  return null;
}
// The full sentence a short quote was cut from, in their campaign text (null when the quote is a sentence itself or
// isn't found there).
export function fullSentence(quote,docs){
  const q=norm(quote);if(!q||q.split(' ').length>=12)return null;
  for(const d of docs||[])for(const line of String(d.text||'').split(/\n+/))for(const sen of sentences(line))if(norm(sen).includes(q)&&norm(sen)!==q)return sen.trim();
  return null;
}
const campaignDocs=c=>(c?.campaigns||[]).flatMap(k=>[...(k.pages||[]),...(k.posts||[])]).filter(p=>p.text);

// When they could act: the time they've held a seat in Congress, from the House and Senate directories (sitting members)
// or their record (a former member: their first to last action on file). dirs: Map bioguide -> since.
export function officeWindow(person,{dirs,evidence,elect,today}){
  const dates=Object.values(evidence||{}).flat().map(a=>a[2]).filter(Boolean).sort();
  const since=person?.bioguide&&dirs?.get(person.bioguide);
  if(since)return {from:[since,dates[0]].filter(Boolean).sort()[0],to:today,current:true};
  if(elect)return {from:null,to:null,current:false,takes:elect};
  if(dates.length)return {from:dates[0],to:dates.at(-1),current:false};
  return {from:null,to:null,current:false};
}

// One promise's verdict. promise: {date, qs: [[question, side]]}; acts: [[question, bill, kind, date, side]] on its
// questions; office: officeWindow(); coded: how many bills, amendments and roll calls are coded to its questions.
export function judge(promise,acts,office,{today,grace=GRACE_MONTHS,review=null,who='They',coded=0}={}){
  const sideOf=new Map(promise.qs.map(([q,s])=>[q,s]));
  const after=acts.filter(a=>a[3]>promise.date).sort((a,b)=>a[3].localeCompare(b[3])),before=acts.filter(a=>a[3]<=promise.date);
  // One count per bill (its key without the roll call) and side: a cosponsorship and the vote on the same bill are one.
  const seen=new Map();for(const a of after){const k=`${a[1].split('#')[0]}|${a[4]===sideOf.get(a[0])?1:0}`;if(!seen.has(k))seen.set(k,a);}
  const counted=[...seen.values()],yes=counted.filter(a=>a[4]===sideOf.get(a[0])),no=counted.filter(a=>a[4]!==sideOf.get(a[0]));
  const base={acts:after,before,forN:yes.length,againstN:no.length};
  if(review&&STATUSES.includes(review.status))return {...base,status:review.status,rule:'reviewed',why:review.why||'',reviewed:review.date||null};
  if(counted.length){
    // "All 12 actions after the promise, on 9 bills, went its way": a bill's roll calls and (co)sponsorship count once.
    const all=w=>`${after.length===1?'The one action':`All ${after.length} actions`} after the promise${counted.length<after.length?`, on ${plural(counted.length,'bill')},`:''} went ${w}.`;
    if(!no.length)return {...base,status:'kept',rule:'all-for',why:all('its way')};
    if(!yes.length)return {...base,status:'broken',rule:'all-against',why:all('against it')};
    const lastYes=yes.at(-1)[3],later=no.filter(a=>a[3]>lastYes);
    if(later.length>=2&&later.length===no.length)return {...base,status:'broken',rule:'reversal',why:`Their actions on ${plural(yes.length,'bill')} went its way until ${fmt(lastYes)}; then ${plural(later.length,'bill')} went against it and none its way since: a reversal.`};
    return {...base,status:'unclear',rule:'mixed',why:`Their actions on ${plural(yes.length,'bill')} went its way and on ${no.length} against it. A reviewer decides, often because a bill mixed it with other things.`};
  }
  if(office.takes)return {...base,status:'not-tested',rule:'not-in-office',why:`Takes office ${fmt(office.takes)}; checked from then on.`};
  if(!office.from)return {...base,status:'not-tested',rule:'not-in-office',why:'Not in Congress, so there is no vote or bill of theirs to check yet.'};
  const start=promise.date>office.from?promise.date:office.from,end=office.current?today:office.to;
  if(start>end)return {...base,status:'not-tested',rule:'not-in-office',why:`Made after they left Congress (their last action on file is from ${fmt(office.to)}).`};
  if(promise.reactive)return {...base,status:'not-tested',rule:'nothing-to-oppose',why:'A promise to oppose or defend against something, and nothing on it has come up for them to act on.'};
  const deadline=addMonths(start,grace),bills=coded?` (${coded.toLocaleString('en-US')} bills and votes on ${promise.qs.length>1?'these questions':'this question'} in the records read)`:'';
  if(deadline<=end){const m=monthsBetween(start,end);
    return {...base,status:'broken',rule:'no-action',why:`No bill on it introduced, sponsored or cosponsored, and no vote on it, in ${m>=24?`${Math.floor(m/12)} years`:plural(m,'month')} in office after the promise${bills}.`};}
  if(office.current)return {...base,status:'no-action',rule:'grace',deadline,why:`Nothing on it yet. Counted as broken if there's still no bill or vote on it by ${fmt(deadline)}.`};
  return {...base,status:'not-tested',rule:'left-office',why:`They left Congress within ${grace} months of the promise.`};
}

const kindOf=where=>/campaign|candidate questionnaire/i.test(where||'')?'campaign':'office';
// Every profiled person's promises. statements: data/question-statements.json; people: the profiles; evidence(bioguide)
// -> their question evidence; campaign(id) -> their campaign text; coded: {question: count}.
export function buildPromises({statements,people,evidence,campaign,dirs,elect,reviews={},coded={},today}){
  const out={},queue=[];
  for(const person of people){
    const tags=statements[person.id];if(!tags)continue;
    const names=[person.short,String(person.name||'').split(/\s+/)[0]].filter((n,i,a)=>n&&a.indexOf(n)===i);
    const docs=campaignDocs(campaign(person.id)),ev=person.bioguide?evidence(person.bioguide)||{}:{};
    const office=officeWindow(person,{dirs,evidence:ev,elect:elect(person),today});
    const groups=new Map();
    for(const [q,list] of Object.entries(tags))for(const [side,quote,date,url,where] of list){
      const k=`${norm(quote)}|${date}`;const g=groups.get(k)||{quote,date,url,where,qs:[]};g.qs.push([q,side]);groups.set(k,g);}
    const mine=[];
    for(const g of groups.values()){
      const key=`${g.qs[0][0]}@${g.date}`,review=reviews[person.id]?.[key]||null;
      if(review?.status==='not-a-promise')continue;
      const sentence=fullSentence(g.quote,docs),words=promiseWords(sentence||g.quote,names);
      if(!words&&review?.status!=='promise')continue;
      const acts=g.qs.flatMap(([q])=>(ev[q]||[]).map(a=>[q,...a]));
      const v=judge({...g,reactive:!!words?.reactive},acts,office,{today,review:review?.status==='promise'?null:review,coded:g.qs.reduce((t,[q])=>t+(coded[q]||0),0)});
      const p={key,qs:g.qs,quote:g.quote,...(sentence?{sentence}:{}),date:g.date,url:g.url,where:g.where,kind:kindOf(g.where),
        status:v.status,rule:v.rule,why:v.why,...(v.deadline?{deadline:v.deadline}:{}),...(v.reviewed?{reviewed:v.reviewed}:{}),
        forN:v.forN,againstN:v.againstN,acts:v.acts,before:v.before.sort((a,b)=>b[3].localeCompare(a[3])).slice(0,3),beforeN:v.before.length};
      mine.push(p);if(v.status==='unclear'&&v.rule!=='reviewed')queue.push(`${person.id} ${key}`);
    }
    const order=Object.fromEntries(STATUSES.map((s,i)=>[s,i]));
    if(mine.length)out[person.id]=mine.sort((a,b)=>order[a.status]-order[b.status]||b.date.localeCompare(a.date));
  }
  return {people:out,queue};
}

function main(){
  const args=process.argv.slice(2),at=args.indexOf('--today'),today=at>=0?args[at+1]:new Date().toISOString().slice(0,10);
  const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8')),has=f=>fs.existsSync(path.join(ROOT,f));
  const R=read('public/research.json'),statements=read('data/question-statements.json');delete statements.about;
  const people=[...R.members,...(R.cands||[]),...(R.featured||[])];
  const dirs=new Map([...read('public/senate.json').senators,...read('public/house.json').members].filter(m=>m.bioguide&&m.since).map(m=>[m.bioguide,m.since]));
  // Who won a 2026 race and takes office in January: the race's winner, by profile.
  const winners=new Set();
  for(const r of [...R.races,...(R.liteRaces||[])]){const w=r.result?.winner;if(!w)continue;winners.add(w);for(const n of r.nominees||[])if((n.id||n.fecCand)===w&&n.profile)winners.add(n.profile);}
  const reviews=has('data/promise-reviews.json')?read('data/promise-reviews.json').people||{}:{};
  const coded=read('public/question-stances.json').coded||{};
  const {people:out,queue}=buildPromises({statements,people,dirs,reviews,coded,today,
    evidence:bg=>has(`public/question-evidence/${bg}.json`)?read(`public/question-evidence/${bg}.json`):null,
    campaign:id=>has(`data/campaign-text/${id}.json`)?read(`data/campaign-text/${id}.json`):null,
    elect:p=>!dirs.has(p.bioguide)&&winners.has(p.id)?'2027-01-03':null});
  fs.writeFileSync(path.join(ROOT,'public','promises.json'),JSON.stringify({about:'Each profiled politician\'s promises to voters and whether they kept them: {person id: [{key, qs: [[question, side]], quote, sentence (the full sentence a short quote was cut from), date, url, where, kind (campaign or office), status (kept, step, compromise, broken, unclear, no-action, not-tested), rule (all-for, all-against, reversal, mixed, no-action, grace, not-in-office, left-office, reviewed), why, deadline, forN, againstN, acts: [[question, bill, kind, date, side]] after the promise, before: the latest 3 earlier ones, beforeN}]}. Written by scripts/build-promises.mjs from data/question-statements.json, public/question-evidence/ and data/promise-reviews.json.',
    built:today,graceMonths:GRACE_MONTHS,people:out}));
  const all=Object.values(out).flat(),n={};for(const p of all)n[p.status]=(n[p.status]||0)+1;
  console.log(`${all.length} promises for ${Object.keys(out).length} people: ${STATUSES.filter(s=>n[s]).map(s=>`${n[s]} ${s}`).join(', ')}.`);
  if(queue.length)console.log(`${queue.length} unclear, for a reviewer (data/promise-reviews.json):\n  ${queue.join('\n  ')}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
