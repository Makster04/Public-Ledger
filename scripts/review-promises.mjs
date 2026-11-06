// Reviewing what the promise finder found (data/promise-queue.json, from npm run promises:find). Each item shows the
// quote, the bill it was linked to and how, their votes on it after the statement, the draft verdict and what to check.
// A verdict you give adds the check to their Promises Delivered record in public/research.json, where it counts like
// every other reviewed check; every decision is kept in data/promise-decisions.json, so an item never comes back.
//   npm run promises:review                 review one at a time
//   npm run promises:review -- --list       only print the queue
//   npm run promises:review -- --all          also the people without a profile on the site: a verdict on one is kept in
//                                           data/promise-decisions.json and added once they have a profile
//   npm run promises:review -- --skip-debate  leave out what was said in debate (shown on the profile, not scored)
//   npm run promises:review -- --only high  only the surest items (the bill named, a final vote): --only medium adds
//                                           subject links with a final vote and matching procedural votes
// The keys: Enter takes the draft verdict; k kept, p partly kept, b broken, c changed position, w waiting (no vote on it
// yet: listed, not counted), u unclear (listed, not counted), n not a promise or the wrong bill (left out), s skip for
// now, q stop. Commit and push public/research.json and data/promise-decisions.json afterward.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {FLAGS,verdictLabel,voteKind,fmtDate} from '../src/promise-finder.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const KEYS={k:'consistent',p:'partial',b:'contradiction',c:'changed',w:'pending',u:'unclear'};
const fmt=fmtDate;
const question=q=>String(q||'').replace(/^on\s+(?:the\s+)?/i,'').toLowerCase()||'the vote';
const rollName=a=>a.chamber==='S'?`Senate roll call ${a.congress}-${a.session}-${a.number}`:a.chamber==='H'?`House roll call ${a.number}, ${String(a.date).slice(0,4)}`:a.measure||'Congress.gov';
// The deciding action: the last final vote, else the last vote, else a sponsorship.
export const decidingAct=did=>{const v=did.filter(a=>a.kind==='vote'&&voteKind(a.question,a.what)!=='amendment');return v.filter(a=>voteKind(a.question,a.what)==='final').at(-1)||v.at(-1)||did.at(-1)||null;};

// What the record shows, as the site writes it: the deciding vote, and the other votes on it.
export function didText(item){
  const main=decidingAct(item.did);if(!main)return 'No vote on it yet.';
  const bill=[item.measure,item.title].filter(Boolean).join(', ');
  const one=a=>a.kind==='vote'?`voted ${a.vote} on ${question(a.question)} (${fmt(a.date)})`:`${a.kind} it (${fmt(a.date)})`;
  const rest=item.did.filter(a=>a!==main).slice(-3).map(one);
  const first=main.kind==='vote'?`Voted ${main.vote} on ${question(main.question)} of ${bill||'the bill'} (${fmt(main.date)}).`:`${main.kind[0].toUpperCase()+main.kind.slice(1)} ${bill||'the bill'} (${fmt(main.date)}); no vote on it yet.`;
  return rest.length?`${first} Also ${rest.join('; ')}.`:first;
}
// The reviewed check, in the shape of the other statements in public/research.json.
export function reviewedStatement(item,assessment,note,today=new Date().toISOString().slice(0,10)){
  const main=decidingAct(item.did),bill=[item.title,item.measure&&`(${item.measure})`].filter(Boolean).join(' ');
  const quote=item.said.text.replace(/^["“]+|["”]+$/g,'');
  return {topic:bill||item.bill,said:{text:`"${quote}"`,date:item.said.date,src:item.said.src},
    did:{text:didText(item),date:main?.date||item.said.date,src:{t:main?rollName(main):item.said.src.t,u:main?.url||item.said.src.u}},
    assessment,note:note||item.draft.why,...(item.kind==='promise'?{promise:true}:{}),...(item.debate?{debate:true}:{}),
    found:{by:'promise finder',source:item.said.source,link:item.link.how,reviewed:today}};
}
// Adds a reviewed check to the person's record. Returns false when the person isn't in public/research.json.
export function addCheck(research,personId,statement){
  const p=[...research.members,...research.cands,...(research.featured||[])].find(x=>x.id===personId);
  if(!p)return false;(p.statements||=[]).push(statement);return true;
}
// The people with a profile on the site (members, candidates, the featured president): only they can hold checks.
export const profiledIds=research=>new Set([...research.members,...research.cands,...(research.featured||[])].map(p=>p.id));
// Verdicts given for someone who had no profile then, added now that they have one. Returns how many were added.
export function addWaiting(research,decisions){
  const ids=profiledIds(research);let n=0;
  for(const d of Object.values(decisions))if(d.waiting&&d.statement&&ids.has(d.person)&&addCheck(research,d.person,d.statement)){delete d.waiting;delete d.statement;delete d.person;n++;}
  return n;
}
export function card(item,i,n){
  const lines=[`\n[${i+1} of ${n}]${item.confidence?` (${item.confidence}${item.debate?', said in debate: shown, not scored':''})`:''} ${item.name} · ${item.kind==='promise'?'promise':'stance'}, ${item.side==='oppose'?'against':item.side==='support'?'for':'side unclear'}`,
    `  Said ${fmt(item.said.date)} (${item.said.src.t}):`,`    "${item.said.text}"`];
  if(item.said.context&&item.said.context!==item.said.text)lines.push(`    In context: ${item.said.context.slice(0,400)}`);
  lines.push(`    ${item.said.src.u}`);
  for(const a of item.also||[])lines.push(`  Also said ${fmt(a.date)} (${a.src.t}): "${a.text.slice(0,160)}"`);
  lines.push(`  Bill: ${[item.measure||item.bill,item.title].filter(Boolean).join(' ')} — ${item.link.how==='named'?'named in the statement':`linked by subject (${(item.link.words||[]).join(', ')})`}${item.link.others?.length?`; others that fit: ${item.link.others.join(', ')}`:''}`);
  lines.push('  What they did after:');
  for(const a of item.did)lines.push(`    ${fmt(a.date)}  ${a.kind==='vote'?`${a.vote.padEnd(10)} ${question(a.question)}`:a.kind}${a.what&&a.kind==='vote'?` — ${String(a.what).slice(0,90)}`:''}  ${a.url||''}`);
  if(!item.did.length)lines.push('    nothing yet');
  lines.push(`  Draft verdict: ${item.draft.label} — ${item.draft.why}`);
  for(const f of item.flags)lines.push(`  Check: ${FLAGS[f]||f}`);
  return lines.join('\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=(name,d)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:d;};
  const queueFile=path.resolve(arg('--queue',path.join(root,'data','promise-queue.json'))),decisionsFile=path.resolve(arg('--decisions',path.join(root,'data','promise-decisions.json')));
  const researchFile=path.resolve(arg('--research',path.join(root,'public','research.json')));
  if(!fs.existsSync(queueFile)){console.log('No review queue yet: run npm run promises:find first.');process.exit(1);}
  const queue=JSON.parse(fs.readFileSync(queueFile,'utf8')),decisions=fs.existsSync(decisionsFile)?JSON.parse(fs.readFileSync(decisionsFile,'utf8')):{};
  const research=JSON.parse(fs.readFileSync(researchFile,'utf8')),ids=profiledIds(research),all=process.argv.includes('--all');
  const save=()=>{fs.writeFileSync(researchFile,JSON.stringify(research,null,2));fs.writeFileSync(decisionsFile,JSON.stringify(Object.fromEntries(Object.entries(decisions).sort(([a],[b])=>a.localeCompare(b))),null,1)+'\n');};
  const caught=addWaiting(research,decisions);if(caught){save();console.log(`${caught} verdicts given earlier were added to people who now have a profile.`);}
  // --only high (or medium): the surest items alone.
  const only=arg('--only',null),levels=only==='high'?['high']:only==='medium'?['high','medium']:null;
  // --skip-debate: leave out the statements made in debate the day of the vote or the day before (shown, not scored).
  const open=queue.items.filter(x=>!decisions[x.id]&&(!levels||levels.includes(x.confidence||'low'))&&!(x.debate&&process.argv.includes('--skip-debate')));
  // People without a profile can't hold a check on the site, so they wait unless asked for.
  const todo=all?open:open.filter(x=>ids.has(x.person)),without=open.length-todo.length;
  console.log(`${todo.length} of ${queue.items.length} items in the queue (built ${queue.built}) still to review.${without?` ${without} more are for people without a profile on the site, left out (add -- --all to review them too; their verdicts are kept for when they have one).`:''}`);
  if(process.argv.includes('--list')){todo.forEach((x,i)=>console.log(card(x,i,todo.length)));process.exit(0);}
  if(!todo.length)process.exit(0);
  // Answers typed or piped in, one line each; the end of the input stops the review.
  const rl=readline.createInterface({input:process.stdin,terminal:process.stdin.isTTY}),lines=[],waiting=[];
  rl.on('line',l=>waiting.length?waiting.shift()(l):lines.push(l));rl.on('close',()=>{while(waiting.length)waiting.shift()('q');lines.push('q');});
  const ask=q=>{process.stdout.write(q);return lines.length?Promise.resolve(lines.shift()):new Promise(r=>waiting.push(r));};
  let added=0,left=0,kept=0;
  for(const [i,item] of todo.entries()){
    console.log(card(item,i,todo.length));
    const draft=['consistent','partial','contradiction','changed'].includes(item.draft.assessment)?item.draft.assessment:null;
    let answer;
    for(;;){
      answer=(await ask(`  ${draft?`Enter = ${verdictLabel(draft)} · `:''}k kept · p partly · b broken · c changed · w waiting · u unclear · n not a promise/wrong bill · s skip · q quit: `)).trim().toLowerCase();
      if(answer===''&&draft){answer=Object.keys(KEYS).find(k=>KEYS[k]===draft);break;}
      if(answer in KEYS||['n','s','q'].includes(answer))break;
    }
    if(answer==='q'){process.stdout.write('\n');break;}
    if(answer==='s')continue;
    const today=new Date().toISOString().slice(0,10);
    if(answer==='n'){const why=(await ask('  Why (optional): ')).trim();decisions[item.id]={decision:'left out',...(why?{why}:{}),at:today};left++;save();continue;}
    const assessment=KEYS[answer];
    const note=(await ask(`  Note for the site (Enter for: ${assessment===item.draft.assessment?item.draft.why:verdictLabel(assessment)}): `)).trim();
    const st=reviewedStatement(item,assessment,note||(assessment===item.draft.assessment?item.draft.why:`Reviewed: ${verdictLabel(assessment)}. ${item.draft.why}`),today);
    if(!addCheck(research,item.person,st)){decisions[item.id]={decision:assessment,at:today,waiting:'no profile',person:item.person,statement:st};kept++;save();
      console.log(`  ${item.name} has no profile on the site yet, so this is kept in data/promise-decisions.json and added when they have one.`);continue;}
    decisions[item.id]={decision:assessment,at:today};added++;save();
    console.log(`  Added to ${item.name}'s record as ${verdictLabel(assessment)}.`);
  }
  rl.close();
  console.log(`\n${added} added to the site, ${left} left out${kept?`, ${kept} kept for people without a profile yet`:''}.${added||left||kept?' Run npm test, then commit and push public/research.json and data/promise-decisions.json.':''}`);
}
