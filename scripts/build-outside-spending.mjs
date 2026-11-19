// Outside spending (public/research.json "ie", and the "out" summary on each profile and toss-up nominee), brought up
// to date from the FEC's bulk file of independent expenditures (independent_expenditure_2026.csv, which the FEC rebuilds
// every day; no key needed).
//   npm run outside:update               download the bulk file and update public/research.json
//   npm run outside:update -- --cached   use the bulk file saved by the last run (.local/fec-bulk)
//   npm run outside:update -- --dry-run  say what would change, write nothing
// From the Nov. 18, 2026 audit: the research's rows stopped at Sept. 30 (filings through Oct. 6), and rows identical in
// every field couldn't be told apart from double counts. Now:
//   - every row the research has is kept (some came from processed and e-filed data the bulk file doesn't carry);
//   - each gets the FEC transaction ID it matches (same spender, candidate, amount and filing), the row's 10th field.
//     Four $22,794.66 mailers on one day are four transaction IDs: four items, not one counted four times. An ID is
//     unique only within one report and its amendments (rootFiles), so that is what a transaction is here;
//   - a transaction the FEC has amended since takes its latest version (its amount, date and filing);
//   - a row that is another version of a transaction already matched (the research kept an original and its amendment
//     both: 20 rows, $5.7M on Nov. 18, 2026) is a double count and is dropped, counted in the summary's dupRemoved;
//   - a row dated Sept. 30 because the research capped later dates there gets its own date back;
//   - every transaction first filed after the research's latest filing and dated after its coverage (Sept. 30) is
//     added: its latest version, general-election designations only (ele_type G). (An earlier date is 2024 spending,
//     "excludedPre"; one by Sept. 30 is left to the research, see COMPILED_END.) A row added by an earlier run carries
//     its transaction ID, so the next run matches it by that and never adds it twice.
//     Dated by when it went out (dissem_dt), else the expense date, as the research dates its rows;
//   - an added item that matches another filing's item in every detail but the transaction ID is marked "d" (possible
//     repeat, kept and shown as one, as the research marks them) and the earlier one "D".
// Then each race's total and each summary are worked out again from the rows with the research's own rules (outSummary:
// tested to give the research's figures from its own rows), through the bulk file's latest filing.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {outOf} from './build-members-elect.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const BULK_FILE='https://www.fec.gov/files/bulk-downloads/2026/independent_expenditure_2026.csv';
export const CM_FILE='https://www.fec.gov/files/bulk-downloads/2026/cm26.zip';
export const SINCE='2025-01-01';
// The research's own coverage ended here (rows from three FEC sources, without transaction IDs). A transaction dated by
// then but first filed later is usually a regular report re-listing a 24/48-hour notice the research already has under
// another ID (168 such rows, $11.3M, on Nov. 18, 2026), so it is left to the research; later ones are added.
export const COMPILED_END='2026-09-30';
const c2=v=>Math.round(v*100)/100;
const MON={JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};
export const dmy=d=>{const m=/^(\d{2})-([A-Z]{3})-(\d{2})$/.exec(String(d||'').trim());return m&&MON[m[2]]?`20${m[3]}-${MON[m[2]]}-${m[1]}`:'';};

// One CSV line into its fields (quoted fields, doubled quotes).
export function csvLine(line){
  const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const c=line[i];
    if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
    else if(c==='"')q=true;else if(c===','){out.push(cur);cur='';}else cur+=c;}
  out.push(cur);return out;
}
// The bulk file's rows as objects, keyed by its header.
export function parseBulk(text){
  const lines=String(text).split(/\r?\n/).filter(Boolean),head=csvLine(lines[0]);
  return lines.slice(1).map(l=>{const v=csvLine(l);return Object.fromEntries(head.map((h,i)=>[h,v[i]??'']));});
}
// The research's race key for a bulk row: S-ME, H-NC-11.
export const raceOf=b=>b.can_office==='S'?`S-${b.can_office_state}`:b.can_office==='H'?`H-${b.can_office_state}-${String(Number(b.can_office_dis)||0).padStart(2,'0')}`:null;
const dateOf=b=>dmy(b.dissem_dt)||dmy(b.exp_date);
const amountOf=b=>c2(Number(b.exp_amo)||0);
const kindOfType=t=>['O','U','V','W'].includes(t)?'super_pac':['X','Y','Z'].includes(t)?'party':'other';
const titleCase=s=>String(s||'').toLowerCase().replace(/\b([a-z])/g,c=>c.toUpperCase());
const candName=s=>{const [last,rest]=String(s||'').split(/,\s*/);return titleCase(rest?`${rest} ${last}`:last).replace(/\s+/g,' ').trim();};

// The filing an amendment amends, back to the original report: a transaction ID is unique only within one report and
// its amendments (a committee's 24/48-hour reports often each start again at SE.1), so a transaction is the spender,
// the original report and the ID.
export function rootFiles(bulk){
  const prev=new Map();for(const b of bulk)if(b.prev_file_num&&b.file_num)prev.set(String(b.file_num),String(b.prev_file_num));
  const memo=new Map(),root=f=>{f=String(f);if(memo.has(f))return memo.get(f);let x=f;for(let i=0;i<20&&prev.has(x);i++)x=prev.get(x);memo.set(f,x);return x;};
  return root;
}
export const txKey=(spe,root,file,tran)=>`${spe}|${root(file)}|${tran}`;
// Each transaction of the tracked races: every version, oldest filing first.
export function transactions(bulk,races,root=rootFiles(bulk)){
  const by=new Map();
  for(const b of bulk){
    if(b.ele_type!=='G'||!b.spe_id||!b.tran_id||!b.cand_id||!['S','O'].includes(b.sup_opp))continue;
    const race=raceOf(b);if(!races.has(race))continue;
    const k=txKey(b.spe_id,root,b.file_num,b.tran_id);(by.get(k)||by.set(k,[]).get(k)).push({...b,race});
  }
  for(const v of by.values())v.sort((x,y)=>Number(x.file_num)-Number(y.file_num));
  return by;
}

// Each profile's outside-spending summary from the race's rows: for (supporting them, or opposing their opponent),
// against (the reverse), by kind of spender; in a three-way race only spending naming them counts for or against, and
// what names a rival is listed apart; what names someone else in the race is listed under others. cms: each spender's
// [committee, for, against, aimed at rivals, other candidates, items, first, last], largest first. same: the "for" side
// up to the end of their latest campaign report, and after it. The research's own rules (checked in the tests).
export function outSummary(rows,{me,rivals=[],multi=false,start=SINCE,end,camp=null,kindOf}){
  const by=()=>({super_pac:0,other:0,party:0}),parts={S:by(),O:by(),OO:by(),SO:by(),X:by()};
  const others=new Map(),rivalSums=new Map(),cms=new Map(),forBy=by(),forAfter=by();
  let n=0,uncertain=0,possibleRepeat=0,pinned=0;
  for(const x of rows){
    const [date,ci,cand,so,amt,,,flags='']=x;if(date<start||date>end)continue;
    let k=null,role;
    if(cand===me){k=so;role=so==='S'?'for':'against';}
    else if(rivals.includes(cand)){k=so==='O'?'OO':'SO';
      if(multi){const v=rivalSums.get(cand)||{cand,S:0,O:0};v[so]+=amt;rivalSums.set(cand,v);role='rival';}else role=so==='O'?'for':'against';}
    else{k='X';const v=others.get(cand)||{cand,S:0,O:0};v[so]+=amt;others.set(cand,v);role='other';}
    const kind=kindOf(ci);parts[k][kind]+=amt;
    if(role==='for'&&camp?.end)(date<=camp.end?forBy:forAfter)[kind]+=amt;
    const m=cms.get(ci)||{f:0,a:0,rv:0,ot:0,n:0,d0:date,d1:date};
    if(role==='for')m.f+=amt;else if(role==='against')m.a+=amt;else if(role==='rival')m.rv+=amt;else m.ot+=amt;
    m.n++;if(date<m.d0)m.d0=date;if(date>m.d1)m.d1=date;cms.set(ci,m);
    n++;if(role!=='other'){if(flags.includes('u'))uncertain++;if(flags.includes('d'))possibleRepeat+=amt;if(flags.includes('p'))pinned++;}
  }
  for(const p of Object.values(parts))for(const k of Object.keys(p))p[k]=c2(p[k]);
  const side=(a,b)=>{const q={};for(const k of ['super_pac','other','party'])q[k]=c2(parts[a][k]+(b?parts[b][k]:0));q.total=c2(q.super_pac+q.other+q.party);return q;};
  const sum=o=>c2(o.super_pac+o.other+o.party),fix=o=>({super_pac:c2(o.super_pac),other:c2(o.other),party:c2(o.party)});
  return {for:multi?side('S'):side('S','OO'),against:multi?side('O'):side('O','SO'),parts,n,uncertain,possibleRepeat:c2(possibleRepeat),pinned,
    others:[...others.values()].map(v=>({cand:v.cand,S:c2(v.S),O:c2(v.O)})),rivals:[...rivalSums.values()].map(v=>({cand:v.cand,S:c2(v.S),O:c2(v.O)})),
    cms:[...cms.entries()].map(([ci,m])=>[ci,c2(m.f),c2(m.a),c2(m.rv),c2(m.ot),m.n,m.d0,m.d1]).sort((a,b)=>(b[1]+b[2]+b[3]+b[4])-(a[1]+a[2]+a[3]+a[4])||a[0]-b[0]),
    same:camp?.end?{end:camp.end,receipts:camp.receipts,forBy:fix(forBy),forAfter:fix(forAfter),for:sum(forBy),after:sum(forAfter)}:null};
}

// Who a profile's rivals are: the other nominees of their race (research races, toss-up races, members-elect races).
export function rivalsFor(s,{races=[],liteRaces=[],electRaces=[],byId={}}){
  const race=races.find(x=>x.id===s.race);if(race)return (race.keys||[]).filter(k=>k!==s.id).map(k=>byId[k]?.fecCand||race.gone?.[k]?.fecCand).filter(Boolean);
  const lite=liteRaces.find(x=>x.id===s.race);if(lite)return (lite.nominees||[]).filter(n=>n.fecCand&&n.fecCand!==s.fecCand).map(n=>n.fecCand);
  const er=electRaces.find(x=>x.id===s.race||(x.nominees||[]).some(n=>n.fecCand===s.fecCand||n.profile===s.id));
  return er?(er.nominees||[]).filter(n=>n.fecCand&&n.fecCand!==s.fecCand).map(n=>n.fecCand):[];
}

// The members-elect (public/members-elect.json): each winner's outside spending again, through the same date, with the
// members-elect build's own rules (scripts/build-members-elect.mjs outOf); the rest of that file is left as it is.
export function refreshElect(elect,bulk,types,through){
  const E=structuredClone(elect),root=rootFiles(bulk),byCand=new Map();
  for(const b of bulk){if(b.ele_type!=='G'||!b.cand_id?.startsWith('H'))continue;(byCand.get(b.cand_id)||byCand.set(b.cand_id,[]).get(b.cand_id)).push(b);}
  const T={byCand,rootFile:root,through,committees:new Map([...types].map(([id,type])=>[id,{type}]))};
  let n=0;
  for(const m of E.members||[]){if(!m.fecCand||!m.out)continue;const race=(E.races||[]).find(r=>r.id===m.race);
    const rivals=(race?.nominees||[]).map(x=>x.fecCand).filter(c=>c&&c!==m.fecCand);
    m.out=outOf(T,m.fecCand,rivals,{to:through});n++;}
  return {elect:E,n};
}

// The update itself, on a copy of the research. bulk: parseBulk's rows; types: committee ID -> FEC committee type (the
// committee master file), for a spender new to the research. Returns {research, stats}.
export function refreshOutside(research,bulk,{electRaces=[],types=new Map()}={}){
  const D=structuredClone(research),ie=D.ie,races=new Set(Object.keys(ie.rows));
  const snapFiled=Object.values(ie.rows).flat().reduce((m,r)=>r[8]>m?r[8]:m,'');
  const through=bulk.reduce((m,b)=>{const d=dmy(b.receipt_dat);return d>m?d:m;},'');
  const root=rootFiles(bulk),tx=transactions(bulk,races,root),stats={matched:0,amended:0,amendedBy:0,undated:0,added:0,addedAmount:0,repeats:0,skippedOld:0,leftToResearch:0,leftAmount:0,pre:{}};
  const cmIdx=new Map(ie.cm.map((c,i)=>[c[0],i])),purpIdx=new Map(ie.purp.map((p,i)=>[p,i]));
  const cmOf=b=>{if(!cmIdx.has(b.spe_id)){cmIdx.set(b.spe_id,ie.cm.length);ie.cm.push([b.spe_id,titleCase(b.spe_nam),kindOfType(types.get(b.spe_id)),null,null,0]);}return cmIdx.get(b.spe_id);};
  const purpOf=b=>{const p=String(b.pur||'').trim()||'Not stated';if(!purpIdx.has(p)){purpIdx.set(p,ie.purp.length);ie.purp.push(p);}return purpIdx.get(p);};
  const rowOf=(b,flags='')=>[dateOf(b),cmOf(b),b.cand_id,b.sup_opp,amountOf(b),purpOf(b),String(b.file_num),flags,dmy(b.receipt_dat),b.tran_id];
  // Version lookup: spender|candidate|amount|filing -> transactions with a version like it.
  const byVersion=new Map();
  for(const [k,v] of tx)for(const b of v){const key=`${b.spe_id}|${b.cand_id}|${amountOf(b)}|${b.file_num}`;(byVersion.get(key)||byVersion.set(key,[]).get(key)).push(k);}
  const used=new Set(),dropped={};stats.dropped=0;stats.droppedAmount=0;
  const take=(rows,i,k)=>{
    used.add(k);stats.matched++;
    const r=rows[i],latest=tx.get(k).at(-1);
    if(String(latest.file_num)!==String(r[6])){stats.amended++;stats.amendedBy=c2(stats.amendedBy+amountOf(latest)-r[4]);
      rows[i]=[dateOf(latest)||r[0],r[1],r[2],latest.sup_opp,amountOf(latest),purpOf(latest),String(latest.file_num),r[7].replace('p',''),dmy(latest.receipt_dat),latest.tran_id];return;}
    if(r[7].includes('p')&&dateOf(latest)){r[0]=dateOf(latest);r[7]=r[7].replace('p','');stats.undated++;}
    r[9]=latest.tran_id;
  };
  // First the rows that carry a transaction ID (an earlier run's), then the rest by spender, candidate, amount and filing.
  for(const race of races){const rows=ie.rows[race];
    for(let i=0;i<rows.length;i++){const r=rows[i],k=r[9]?txKey(ie.cm[r[1]][0],root,r[6],r[9]):null;if(k&&tx.has(k)&&!used.has(k))take(rows,i,k);else if(r.length<10)r[9]='';}}
  for(const race of races){const rows=ie.rows[race],drop=new Set();
    for(let i=0;i<rows.length;i++){const r=rows[i];if(r[9]&&used.has(txKey(ie.cm[r[1]][0],root,r[6],r[9])))continue;
      const list=byVersion.get(`${ie.cm[r[1]][0]}|${r[2]}|${c2(r[4])}|${r[6]}`)||[],k=list.find(t=>!used.has(t));
      if(k){take(rows,i,k);continue;}
      if(list.length){drop.add(i);stats.dropped++;stats.droppedAmount=c2(stats.droppedAmount+r[4]);(dropped[race]||=[]).push(r);}
      r[9]='';}
    if(drop.size)ie.rows[race]=rows.filter((_,i)=>!drop.has(i));}
  // New transactions: first filed after the research's latest filing.
  for(const [k,v] of tx){
    if(used.has(k))continue;
    if(dmy(v[0].receipt_dat)<=snapFiled){stats.skippedOld++;continue;}
    const latest=v.at(-1),date=dateOf(latest);if(!date)continue;
    if(date<SINCE){const p=stats.pre[latest.cand_id]||(stats.pre[latest.cand_id]={n:0,amount:0});p.n++;p.amount=c2(p.amount+amountOf(latest));continue;}
    if(date<=COMPILED_END){stats.leftToResearch++;stats.leftAmount=c2(stats.leftAmount+amountOf(latest));continue;}
    ie.rows[latest.race].push(rowOf(latest));stats.added++;stats.addedAmount=c2(stats.addedAmount+amountOf(latest));
  }
  // Possible repeats among the rows now: same spender, candidate, amount, date and purpose, another filing, another ID.
  for(const race of races){
    const rows=ie.rows[race].sort((a,b)=>a[0].localeCompare(b[0])||a[8].localeCompare(b[8])||Number(a[6])-Number(b[6]));
    const seen=new Map();
    for(const r of rows){if(!r[9])continue;const k=`${r[1]}|${r[2]}|${r[4]}|${r[0]}|${String(ie.purp[r[5]]).trim().toLowerCase()}`,first=seen.get(k);
      if(!first){seen.set(k,r);continue;}
      if(first[6]!==r[6]&&first[9]!==r[9]&&!r[7].includes('d')){if(!first[7].includes('D')&&!first[7].includes('d'))first[7]+='D';r[7]+='d';stats.repeats++;}}
  }
  // Each spender's number of races; race totals; candidate names.
  const raceCount=new Map();for(const rows of Object.values(ie.rows))for(const ci of new Set(rows.map(r=>r[1])))raceCount.set(ci,(raceCount.get(ci)||0)+1);
  ie.cm.forEach((c,i)=>{c[5]=raceCount.get(i)||0;if(!['super_pac','party','other'].includes(c[2]))c[2]='other';});
  for(const race of races)ie.raceTotal[race]=c2(ie.rows[race].reduce((t,r)=>t+r[4],0));
  for(const b of bulk)if(b.cand_id&&!ie.cands[b.cand_id]&&races.has(raceOf(b)))ie.cands[b.cand_id]=candName(b.cand_name);
  for(const r of D.races||[])if(ie.raceTotal[r.id]!=null)r.ieTotal=ie.raceTotal[r.id];
  for(const r of D.liteRaces||[])if(ie.raceTotal[r.id]!=null)r.ieTotal=ie.raceTotal[r.id];
  ie.asof=through;D.ie_asof=through;
  ie.source=`FEC Schedule E independent expenditures: through Sept. 30, 2026 as compiled by the Follow the Money 2026 project (bulk file plus processed and e-filed data), each row matched to its FEC transaction ID where the bulk file has it; after that, the FEC bulk file (independent_expenditure_2026.csv), each transaction once in its latest version, filed through ${through}. General-election designations only.`;
  // The summaries.
  const kindOf=ci=>ie.cm[ci][2]==='super_pac'?'super_pac':ie.cm[ci][2]==='party'?'party':'other';
  const people=[...D.members,...D.cands],byId=Object.fromEntries(people.map(p=>[p.id,p]));
  const ctx={races:D.races||[],liteRaces:D.liteRaces||[],electRaces,byId};
  const summarize=(s,o,race,camp)=>{
    const x=outSummary(ie.rows[race]||[],{me:s.fecCand,rivals:rivalsFor(s,ctx),multi:!!o.multi,start:o.start||SINCE,end:through,camp,kindOf});
    const pre=stats.pre[s.fecCand],riv=rivalsFor(s,ctx),gone=(dropped[race]||[]).filter(r=>r[2]===s.fecCand||riv.includes(r[2]));
    const dup=gone.length?{n:(o.dupRemoved?.n||0)+gone.length,amount:c2((o.dupRemoved?.amount||0)+gone.reduce((t,r)=>t+r[4],0))}:o.dupRemoved;
    return {...o,...x,end:through,same:o.same===undefined?undefined:x.same,dupRemoved:dup,
      excludedPre:pre?{n:(o.excludedPre?.n||0)+pre.n,amount:c2((o.excludedPre?.amount||0)+pre.amount)}:o.excludedPre};
  };
  let summaries=0;
  for(const s of people)if(s.out&&s.fecCand&&races.has(s.race)){s.out=summarize(s,s.out,s.race,s.camp);if(s.out.same===undefined)delete s.out.same;summaries++;}
  for(const r of D.liteRaces||[])if(races.has(r.id))for(const n of r.nominees||[])if(n.out&&n.fecCand){
    const s={id:null,race:r.id,fecCand:n.fecCand},x=summarize(s,n.out,r.id,null);
    n.out={for:x.for,against:x.against,others:x.others,excludedPre:x.excludedPre,dupRemoved:x.dupRemoved,possibleRepeat:x.possibleRepeat,n:x.n};summaries++;}
  return {research:D,stats:{...stats,snapFiled,through,summaries}};
}

async function download(url,cached){
  const dir=path.join(ROOT,'.local','fec-bulk'),file=path.join(dir,path.basename(url));
  if(!(cached&&fs.existsSync(file))){
    console.log(`Downloading ${url}…`);
    const r=await fetch(url,{redirect:'follow'});if(!r.ok)throw new Error(`FEC bulk file ${path.basename(url)}: HTTP ${r.status}`);
    fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));
  }
  return file;
}
// The committee master file (cm26.zip, pipe-separated): ID -> committee type.
export function committeeTypes(text){
  const m=new Map();for(const l of String(text).split(/\r?\n/)){const v=l.split('|');if(v[0])m.set(v[0],v[9]||'');}return m;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const dry=process.argv.includes('--dry-run'),file=path.join(ROOT,'public','research.json');
  const research=JSON.parse(fs.readFileSync(file,'utf8'));
  const elect=JSON.parse(fs.readFileSync(path.join(ROOT,'public','members-elect.json'),'utf8'));
  const cached=process.argv.includes('--cached');
  const bulk=parseBulk(fs.readFileSync(await download(BULK_FILE,cached),'utf8'));
  const cm=spawnSync('unzip',['-p',await download(CM_FILE,cached)],{maxBuffer:1<<30,encoding:'utf8'});
  if(cm.status!==0){console.log('Could not open cm26.zip (the FEC committee list); nothing written.');process.exit(1);}
  if(!bulk.length||!('tran_id' in bulk[0])){console.log('The bulk file has no rows or no transaction IDs; nothing written.');process.exit(1);}
  const {research:D,stats}=refreshOutside(research,bulk,{electRaces:elect.races||[],types:committeeTypes(cm.stdout)});
  console.log(`Outside spending through ${stats.through} (the research's rows were filed through ${stats.snapFiled}):`);
  console.log(`  ${stats.matched} of the research's rows matched an FEC transaction; ${stats.amended} amended since (${stats.amendedBy>=0?'+':''}$${stats.amendedBy.toLocaleString('en-US')}); ${stats.undated} capped dates restored`);
  console.log(`  ${stats.dropped} rows dropped as another version of a transaction already counted ($${stats.droppedAmount.toLocaleString('en-US')})`);
  console.log(`  ${stats.added} transactions added ($${stats.addedAmount.toLocaleString('en-US')}); ${stats.repeats} possible repeats marked; ${stats.skippedOld} older transactions the research left out stay out`);
  console.log(`  ${stats.leftToResearch} filed late but dated by ${COMPILED_END} left to the research ($${stats.leftAmount.toLocaleString('en-US')}): usually re-listings of items it has`);
  console.log(`  ${stats.summaries} summaries worked out again`);
  if(dry){console.log('Dry run: nothing written.');process.exit(0);}
  fs.writeFileSync(file,JSON.stringify(D,null,2)+'\n');
  const {elect:E,n}=refreshElect(elect,bulk,committeeTypes(cm.stdout),stats.through);
  fs.writeFileSync(path.join(ROOT,'public','members-elect.json'),JSON.stringify(E,null,1)+'\n');
  console.log(`Wrote public/research.json and the outside spending of ${n} members-elect (public/members-elect.json). Run npm test, then commit and push them.`);
}
