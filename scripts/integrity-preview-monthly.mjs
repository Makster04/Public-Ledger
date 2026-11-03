// Separate monthly snapshot for the Integrity / People First comparison preview. Never writes official score history.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {makeScorer} from '../public/scoring.js';
import {tradeChecks} from '../public/grades.js';
import {integrityOverall,honestyComponent,legalReviewComponent,previewCci,workersPreview} from '../public/integrity.js';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8'),LOG='public/integrity-preview-log.json';
export function previewScores(data,committees,sectors,tallies){
  const scorer=makeScorer(data,committees,sectors,tallies),year=Number(String(data.asof||'').match(/\b(19|20)\d{2}\b/)?.[0])||null;
  return Object.fromEntries([...data.members,...data.cands,...(data.featured||[])].map(person=>{
    const honesty=honestyComponent(person),usedTradeIds=new Set(tradeChecks(person.trades||[],[]).rows.filter(t=>t.late).map(t=>t.id).filter(Boolean));
    const legal=legalReviewComponent(person,{asOfYear:year,stockActCovered:usedTradeIds});
    const integrity=integrityOverall({honesty:honesty.complete?honesty.value:null,legalTrouble:legal.value});
    const legislative=scorer.pvp(person),cci=previewCci({businessVotes:scorer.cci(person)?.votes?.index??null});
    return [person.id,{integrity:{pct:integrity.pct,why:integrity.why,honesty:honesty.complete?honesty.value:null,personalFinances:null,fundraising:null,legalTrouble:legal.value},
      workers:{pct:workersPreview(legislative.billsPct,cci).pct,legislative:legislative.billsPct,cci:cci.index},coverage:{honesty:honesty.complete,personalFinances:false,fundraising:false,legal:legal.reviewed}}];
  }));
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function previewChanges(before={},after={}){
  const changes=[];
  for(const [id,next] of Object.entries(after)){
    const old=before[id];
    const metrics=[['integrity',old?.integrity?.pct,next.integrity.pct],['Honesty',old?.integrity?.honesty,next.integrity.honesty],
      ['Personal Finances',old?.integrity?.personalFinances,next.integrity.personalFinances],['Fundraising',old?.integrity?.fundraising,next.integrity.fundraising],
      ['Legal Trouble',old?.integrity?.legalTrouble,next.integrity.legalTrouble],['People First comparison',old?.workers?.pct,next.workers.pct]];
    for(const [grade,a,b] of metrics){
      if(old&&a===b)continue;
      if(a==null&&b==null)continue;
      changes.push({id,grade,from:old?a:null,to:b,why:!old?'First preview value':a==null||b==null?'Coverage changed':'Preview calculation changed'});
    }
  }
  return changes;
}
export function buildPreviewEntry(data,committees,sectors,tallies,date){
  const scores=previewScores(data,committees,sectors,tallies),rules=crypto.createHash('sha256').update(read('public/integrity.js')).digest('hex').slice(0,12);
  return {date,reviewedAt:data.asof,rules,scores};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
  const dry=process.argv.includes('--dry-run'),data=JSON.parse(read('public/research.json')),
    committees=JSON.parse(read('public/committees.json')),sectors=JSON.parse(read('public/committee-sectors.json')),
    tallies=JSON.parse(read('public/vote-party.json')).votes;
  const log=fs.existsSync(new URL(LOG,root))?JSON.parse(read(LOG)):{about:'Monthly Integrity and People First comparison preview only. Separate from official score history; no grade switches automatically.',entries:[]};
  const date=new Date().toISOString().slice(0,10),entry=buildPreviewEntry(data,committees,sectors.committees||{},tallies,date);
  const previous=log.entries.filter(x=>x.date!==date).at(-1);entry.changes=previewChanges(previous?.scores||{},entry.scores);
  entry.rulesChanged=!!previous&&previous.rules!==entry.rules;
  entry.note=previous?`${entry.changes.length} preview changes since ${previous.date}.${entry.rulesChanged?' Preview rules changed.':''}`:'First preview snapshot.';
  console.log(`${entry.note} Research ${entry.reviewedAt}; preview log only.`);
  if(dry){console.log('Dry run: nothing written.');process.exit(0);}
  log.entries=log.entries.filter(x=>x.date!==date).concat(entry);
  fs.writeFileSync(new URL(LOG,root),JSON.stringify(log,null,2)+'\n');
  console.log(`Wrote ${LOG}.`);
}
