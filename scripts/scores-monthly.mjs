// The monthly recalculation, run after the month's review: recalculates the grades the profiles show from the site's
// own files, Keeps Their Word, Shows Up and People First (LOGGED_GRADES in public/scoring.js), for everyone graded: the
// reviewed profiles and every senator's and House member's basic profile. It uses the page's own code and files
// (gradedPeople, sixContext and makeScorer in public/scoring.js, with research.json, senate.json, house.json,
// attendance.json, get-it-done.json, conflicts.json, group-ratings.json, the committee files and vote-party.json), so a
// logged grade is the one the page shows. It reruns the Money & Influence timing flags too, and adds an entry to
// public/score-log.json saying which grade moved, by how much and why.
// Not logged: Big Money Independence, and Plays by the Rules once a profile has read the refresh's trade records, since both also use the
// refresh's saved records; Ideology, which is a position, not a grade; and Your match, which depends on each visitor.
// Entries marked formula "retired" logged the grades the six scores replaced (Promises delivered, Ethics and the earlier
// People First formula). They are kept as they were, and a new entry is compared only with the last one of its formula.
//   npm run scores:monthly               write this month's entry (a second run on the same day replaces it)
//   npm run scores:monthly -- --dry-run  print the changes without writing
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ETHICS_COST,CASE_KIND,CASE_AGE,INDEX_COST,INSIDER,DODGER,LATE_DAYS,WEIGHT,MIN_CHECKS,MIN_PVP_ACTIONS,CORP_COMPROMISED} from '../public/grades.js';
import {makeScorer,gradedPeople,sixContext,LOGGED_GRADES} from '../public/scoring.js';
import {PEOPLE_FIRST} from '../public/six-scores.js';
import {SHOWING_UP_PER_POINT,SHOWING_UP_MIN_VOTES,GET_IT_DONE_MIN_BILLS,SHOWING_UP_PARTS} from '../public/integrity.js';
import {timingFlags,SWING,WINDOW_MONTHS,TOP_DONORS} from '../public/influence.js';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const readIf=f=>fs.existsSync(new URL(f,root))?JSON.parse(read(f)):null;
const LOG='public/score-log.json',SIX='six',RETIRED='retired';
const round1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
// An entry's formula: the six scores, or (an entry from before them, which says nothing) the retired grades.
export const formulaOf=e=>e?.formula||RETIRED;

// One person's logged grades: each grade's percentage (null when not graded) and the counts behind it, from the same
// six() the page's tiles and tabs show (ctx: sixContext()).
export function personScores(s,scorer,history,ctx={}){
  const x=scorer.six(s,ctx),w=x.word.score,u=x.showsup,pf=x.peoplefirst,a=u.detail?.attendance||{},d=u.detail?.getItDone||{};
  let flags=0;
  if(history){const h=history.people[s.id]||{},through=history.contribThrough.slice(0,7);
    for(const g of s.funderPos||[]){const series={};for(const [m,v] of (h[g.key]||{}).c||[])series[m]=(series[m]||0)+v;
      flags+=timingFlags(g.org,series,(g.compared||[]).map(c=>({date:c.date,match:c.match})),through).length;}}
  return {
    word:{pct:x.word.pct,kept:w.kept,half:w.half,broken:w.broken,counted:w.clear},
    showsup:{pct:u.pct,missed:a.complete?a.missed:null,votes:a.complete?a.votes:null,getItDone:d.complete?round1(d.value):null},
    // Counts of actions on each side (each one is weighted by its bill's strength in the grade itself).
    peoplefirst:{pct:pf.pct,people:pf.v?.nPeople??0,profit:pf.v?.nProfit??0,actions:pf.v?.n??0,cci:pf.cci?.index??null},
    flags,
  };
}
export const NAMES={word:'Keeps Their Word',showsup:'Shows Up',peoplefirst:'People First',promises:'Promises delivered (retired)',ethics:'Ethics (retired)',pvp:'People First (earlier formula)'};
// The counts behind each grade, as [field, one, several], for the reason given with each change. The retired grades'
// are kept so their entries still read.
const PARTS={
  word:[['kept','kept promise','kept promises'],['half','partly kept or changed promise','partly kept or changed promises'],['broken','contradicted promise','contradicted promises'],['counted','counted check','counted checks']],
  showsup:[['missed','missed roll call','missed roll calls'],['votes','roll call on record','roll calls on record'],['getItDone','Get It Done point','Get It Done points']],
  peoplefirst:[['people','action for working people','actions for working people'],['profit','action for the wealthy and corporations','actions for the wealthy and corporations'],['cci','Corporation Compromised Index point','Corporation Compromised Index points']],
  promises:[['kept','kept promise','kept promises'],['half','partly kept or changed promise','partly kept or changed promises'],['broken','contradicted promise','contradicted promises'],['counted','counted check','counted checks']],
  ethics:[['finding','confirmed finding','confirmed findings'],['open','open investigation','open investigations'],['closed','investigation closed without a finding','investigations closed without a finding'],['allegation','allegation (not scored)','allegations (not scored)'],['late','late disclosure','late disclosures'],['conflict','committee-conflict trade','committee-conflict trades'],
    ['legal','Legal Trouble Index point','Legal Trouble Index points'],['insider','Insider Trading Index point','Insider Trading Index points'],['dodger','Stock Disclosure Dodger Index point','Stock Disclosure Dodger Index points']],
  pvp:[['people','action for working people','actions for working people'],['profit','action for the wealthy and corporations','actions for the wealthy and corporations'],['cci','Corporation Compromised Index point','Corporation Compromised Index points']],
};
// What moved between two runs, with the reason drawn from the counts behind each grade.
export function compare(before,after){
  const changes=[];
  for(const [id,now] of Object.entries(after)){
    const was=before?.[id];
    for(const g of Object.keys(PARTS)){
      const a=was?.[g],b=now[g];if(!b)continue;
      // A count an older entry didn't record (the Ethics indexes, before they existed) is not compared; an index without
      // enough data (null) counts as 0.
      const diff=k=>a[k]===undefined?0:(b[k]??0)-(a[k]??0);
      if(a&&a.pct===b.pct&&PARTS[g].every(([k])=>!diff(k)))continue;
      const why=a?PARTS[g].filter(([k])=>diff(k)).map(([k,one,many])=>{const d=diff(k);return `${d>0?'+':'−'}${Math.abs(d)} ${Math.abs(d)===1?one:many}`;}):[];
      changes.push({id,grade:g,from:a?a.pct:undefined,to:b.pct,why:!a?'First recorded score':why.length?why.join(', '):'Rule or weight change'});
    }
  }
  for(const id of Object.keys(before||{}))if(!after[id])changes.push({id,grade:'all',from:null,to:null,why:'No longer profiled'});
  return changes.filter(c=>!(c.from===undefined&&c.to===null&&c.why==='First recorded score'));
}
// files: the parsed senate.json, house.json, attendance.json, get-it-done.json, conflicts.json, group-ratings.json and
// promises.json.
export function buildEntry(research,committees,sectors,history,config,date,tallies=null,files={}){
  const scorer=makeScorer(research,committees,sectors.committees||{},tallies),ctx=sixContext({...files,today:date});
  const people=gradedPeople(research,{senate:files.senate?.senators||[],house:files.house?.members||[]});
  const scores=Object.fromEntries(people.map(s=>[s.id,personScores(s,scorer,history,ctx)]));
  return {date,formula:SIX,grades:LOGGED_GRADES,reviewedAt:config.reviewedAt,research:crypto.createHash('sha256').update(JSON.stringify(research)).digest('hex').slice(0,12),
    rules:{MIN_CHECKS,MIN_PVP_ACTIONS,PEOPLE_FIRST,SHOWING_UP_PER_POINT,SHOWING_UP_MIN_VOTES,GET_IT_DONE_MIN_BILLS,SHOWING_UP_PARTS,CORP_COMPROMISED,SWING,WINDOW_MONTHS,TOP_DONORS},scores};
}
// The files the page scores with, as buildEntry takes them (a missing one is null, as on the page).
export const sixFiles=()=>({senate:readIf('public/senate.json'),house:readIf('public/house.json'),attendance:readIf('public/attendance.json'),
  getItDone:readIf('public/get-it-done.json'),conflicts:readIf('public/conflicts.json'),ratings:readIf('public/group-ratings.json'),promises:readIf('public/promises.json')});
// The entry before this one to compare with: the latest of the same formula, not from today.
export const previousOf=(entries,entry)=>entries.filter(e=>e.date!==entry.date&&formulaOf(e)===formulaOf(entry)).at(-1)||null;
export const ABOUT='Monthly recalculations, after review, of the grades the profiles show from the site\'s own files (Keeps Their Word, Shows Up and People First), for the reviewed profiles and every senator\'s and House member\'s basic profile, with every change and why. Entries marked "retired" logged the grades the six scores replaced (Promises delivered, Ethics and the earlier People First formula) and are kept as they were. Written by scripts/scores-monthly.mjs; newest last.';

// The log file: one entry per line keeps it reviewable as a diff.
export const logText=log=>`{"about":${JSON.stringify(log.about)},"entries":[\n${log.entries.map(e=>JSON.stringify(e)).join(',\n')}\n]}\n`;

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const dry=process.argv.includes('--dry-run');
  const research=JSON.parse(read('public/research.json')),config=JSON.parse(read('data/config.json'));
  const committees=JSON.parse(read('public/committees.json')),sectors=JSON.parse(read('public/committee-sectors.json'));
  const history=readIf('public/funder-history.json'),log=readIf(LOG)||{about:'',entries:[]};
  const date=new Date().toISOString().slice(0,10),tallies=readIf('public/vote-party.json')?.votes||null;
  const entry=buildEntry(research,committees,sectors,history,config,date,tallies,sixFiles());
  const prev=previousOf(log.entries,entry);
  entry.changes=prev?compare(prev.scores,entry.scores):[];
  entry.note=prev?`${entry.changes.length} change${entry.changes.length===1?'':'s'} since ${prev.date}.`
    :log.entries.length?'First recalculation with the six scores: these are their starting grades. The entries before it logged the retired grades.':'First recalculation: these are the starting grades.';
  if(prev&&JSON.stringify(prev.rules)!==JSON.stringify(entry.rules))entry.note+=' Scoring rules or weights changed since the last run.';
  console.log(`${entry.note} ${Object.keys(entry.scores).length} people. Research ${entry.research}, reviewed ${entry.reviewedAt}.`);
  for(const c of entry.changes)console.log(`  ${c.id} · ${NAMES[c.grade]||c.grade}: ${c.from==null?'Not graded':c.from+'%'} → ${c.to==null?'Not graded':c.to+'%'} (${c.why})`);
  if(dry){console.log('Dry run: nothing written.');process.exit(0);}
  log.about=ABOUT;
  log.entries=log.entries.filter(e=>e.date!==date||formulaOf(e)!==SIX).map(e=>({formula:formulaOf(e),...e})).concat(entry);
  fs.writeFileSync(new URL(LOG,root),logText(log));
  console.log(`Wrote ${LOG} (${log.entries.length} entr${log.entries.length===1?'y':'ies'}).`);
}
