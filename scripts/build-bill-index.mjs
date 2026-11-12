// The bill index behind the alignment questions: every bill and resolution in Congress from the 113th (2013) on, from
// GovInfo's BILLSTATUS bulk files (no key; https://www.govinfo.gov/bulkdata/BILLSTATUS). For each one: its titles,
// policy area, legislative subjects, the Congressional Research Service's latest summary, its sponsor and cosponsors
// (with the dates they signed on and any withdrawal), its recorded votes (chamber, roll call, date), and whether it
// became law. The questions' bills are found and coded from it (scripts/question-bills.mjs); nothing here decides a side.
//
// It also keeps the amendments the files list (.local/amendments/), with the roll calls on each, since a vote on an
// amendment is often the clearest vote a member casts on a question.
//
// Writes .local/bills/<congress>-<type>.jsonl, one bill a line:
//   {id: "119-hr-1", c: 119, t: "hr", n: 1, title, short: [short titles], intro: "2025-05-20", area: policy area,
//    subjects: [...], summary: plain text (at most SUMMARY_MAX characters), sponsor: {id: bioguide, party, state},
//    cosponsors: [{id, date, orig: true when an original cosponsor, out: withdrawal date}], votes: [{ch: "H"|"S",
//    roll, date, session}], law: true when enacted, latest: {date, text}}
// and .local/amendments/<congress>-<type>.jsonl, the amendments to those bills, one a line:
//   {id: "113-hamdt-748", c, t: "hamdt"|"samdt", n, bill: the bill it amends, of: the amendment it amends (if any),
//    purpose, sponsor: {id, party, state}, cosponsors, intro: the date it was submitted, votes: [{ch, roll, date,
//    session, c, yea: true when a Yea is for the amendment (agreeing to it, waiving a point of order against it,
//    cloture on it), false when a Yea is against it (tabling it), null when that can't be told}], latest}
//
//   npm run bills:index                          the 113th Congress through the current one (zips cached in
//                                                .local/billstatus/; the current Congress's re-read when over a day old)
//   npm run bills:index -- --from 118 --to 119   just these Congresses
//   npm run bills:index -- --types hr,s          just these kinds (default: hr, s, hjres, sjres, hconres, sconres, hres, sres)
//   npm run bills:index -- --refresh             download every zip again
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {XMLParser} from 'fast-xml-parser';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const TYPES=['hr','s','hjres','sjres','hconres','sconres','hres','sres'];
export const SUMMARY_MAX=2000;
const BASE='https://www.govinfo.gov/bulkdata/BILLSTATUS';
const DAY=86400000;
const parser=new XMLParser({ignoreAttributes:true,parseTagValue:false,trimValues:true,
  isArray:name=>['item','recordedVote','summary','amendment'].includes(name)});

const list=v=>v==null?[]:Array.isArray(v)?v:[v];
const items=v=>list(v?.item);
const day=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10):null;
// Plain text from a summary's HTML.
export function plainText(html){
  return String(html||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}

// One BILLSTATUS XML file -> the index's record for it (null when it isn't a bill status file).
export function billRecord(xml){return billFromParsed(parser.parse(xml)?.billStatus?.bill);}
function billFromParsed(b){
  if(!b)return null;
  // (a few files use the older layout: billNumber and billType)
  const c=Number(b.congress),t=String(b.type??b.billType??'').toLowerCase(),n=Number(b.number??b.billNumber);if(!c||!t||!n)return null;
  const titles=items(b.titles);
  const short=[...new Set(titles.filter(x=>/short title/i.test(x.titleType||'')).map(x=>String(x.title||'').trim()).filter(Boolean))];
  // the latest summary (by its action date, then update date)
  const sums=list(b.summaries?.summary).map(s=>({d:day(s.actionDate)||day(s.updateDate)||'',u:String(s.updateDate||''),text:plainText(s.text)})).filter(s=>s.text);
  sums.sort((x,y)=>x.d.localeCompare(y.d)||x.u.localeCompare(y.u));
  const summary=sums.at(-1)?.text||null;
  const sp=items(b.sponsors)[0];
  const cosponsors=items(b.cosponsors).filter(x=>x.bioguideId).map(x=>({id:String(x.bioguideId),date:day(x.sponsorshipDate),...(String(x.isOriginalCosponsor)==='True'||String(x.isOriginalCosponsor)==='true'?{orig:true}:{}),...(day(x.sponsorshipWithdrawnDate)?{out:day(x.sponsorshipWithdrawnDate)}:{})}));
  const seen=new Set(),votes=[];
  for(const a of items(b.actions))for(const v of list(a.recordedVotes?.recordedVote)){
    const ch=/senate/i.test(v.chamber||'')?'S':/house/i.test(v.chamber||'')?'H':null,roll=Number(v.rollNumber),k=`${ch}-${v.congress}-${v.sessionNumber}-${roll}`;
    if(!ch||!roll||seen.has(k))continue;seen.add(k);votes.push({ch,roll,date:day(v.date),session:Number(v.sessionNumber)||null,c:Number(v.congress)||c});
  }
  votes.sort((x,y)=>String(x.date).localeCompare(String(y.date))||x.roll-y.roll);
  const latest=b.latestAction?{date:day(b.latestAction.actionDate),text:String(b.latestAction.text||'').slice(0,300)}:null;
  return {id:`${c}-${t}-${n}`,c,t,n,title:String(b.title||'').trim(),short,intro:day(b.introducedDate),area:b.policyArea?.name||null,
    subjects:items(b.subjects?.legislativeSubjects).map(x=>String(x.name||'').trim()).filter(Boolean),
    summary:summary&&summary.length>SUMMARY_MAX?summary.slice(0,SUMMARY_MAX).replace(/\s+\S*$/,'')+' …':summary,
    sponsor:sp?.bioguideId?{id:String(sp.bioguideId),party:sp.party||null,state:sp.state||null}:null,
    cosponsors,votes,...(items(b.laws).length?{law:true}:{}),latest};
}

// Which way a Yea points on a recorded vote about an amendment, from the action's text: true when a Yea is for the
// amendment (agreeing to it, waiving a point of order against it, cloture on it), false when a Yea is against it
// (tabling it), null when it can't be told (a motion about another motion, a point of order, reconsidering).
export function amendmentYea(text){
  const t=String(text||'').toLowerCase();
  if(/reconsider|point of order|previous question|division of the question|motion to (re)?commit|motion to (instruct|concur|proceed|adjourn|refer|postpone|discharge)/.test(t))return null;
  if(/motion to table/.test(t))return false;
  if(/motion to waive|cloture/.test(t))return true;
  if(/on agreeing to the .*amendment|amendment (sa|ha|no\.)? ?[\w.]* .*\b(agreed to|failed|rejected)\b|\bamendment\b[^.]*\b(agreed to|failed|rejected)\b/.test(t))return true;
  return null;
}
const amdtId=a=>{const c=Number(a?.congress),t=String(a?.type||'').toLowerCase(),n=Number(a?.number);return c&&/^[hs]amdt$/.test(t)&&n?`${c}-${t}-${n}`:null;};
// The amendments one bill's status file lists -> the index's records for them.
export function amendmentRecords(xml){return amendmentsFromParsed(parser.parse(xml)?.billStatus?.bill);}
function amendmentsFromParsed(b){
  if(!b)return [];
  const c=Number(b.congress),t=String(b.type??b.billType??'').toLowerCase(),n=Number(b.number??b.billNumber),billId=c&&t&&n?`${c}-${t}-${n}`:null;
  const out=[];
  for(const a of list(b.amendments?.amendment)){
    const id=amdtId(a);if(!id)continue;
    const ab=a.amendedBill,bill=ab?.congress&&ab?.type&&ab?.number?`${Number(ab.congress)}-${String(ab.type).toLowerCase()}-${Number(ab.number)}`:billId;
    const acts=[...items(a.actions),...items(a.actions?.actions)];
    const byRoll=new Map();
    for(const x of acts)for(const v of list(x.recordedVotes?.recordedVote)){
      const ch=/senate/i.test(v.chamber||'')?'S':/house/i.test(v.chamber||'')?'H':null,roll=Number(v.rollNumber);if(!ch||!roll)continue;
      const k=`${ch}-${v.congress}-${v.sessionNumber}-${roll}`,yea=amendmentYea(x.text),prev=byRoll.get(k);
      if(!prev||(prev.yea==null&&yea!=null))byRoll.set(k,{ch,roll,date:day(v.date)||day(x.actionDate),session:Number(v.sessionNumber)||null,c:Number(v.congress)||c,yea,text:String(x.text||'').replace(/^(Roll call votes on amendments in Senate|Senate amendment (not )?agreed to): /i,'').slice(0,200)});
    }
    const votes=[...byRoll.values()].sort((x,y)=>String(x.date).localeCompare(String(y.date))||x.roll-y.roll);
    const sp=items(a.sponsors)[0];
    out.push({id,c:Number(a.congress),t:String(a.type).toLowerCase(),n:Number(a.number),bill,...(amdtId(a.amendedAmendment)?{of:amdtId(a.amendedAmendment)}:{}),
      purpose:String(a.purpose||a.description||'').replace(/\s+/g,' ').trim().slice(0,600)||null,
      sponsor:sp?.bioguideId?{id:String(sp.bioguideId),party:sp.party||null,state:sp.state||null}:null,
      cosponsors:items(a.cosponsors).filter(x=>x.bioguideId).map(x=>({id:String(x.bioguideId),date:day(x.sponsorshipDate),...(day(x.sponsorshipWithdrawnDate)?{out:day(x.sponsorshipWithdrawnDate)}:{})})),
      intro:day(a.submittedDate)||day(a.proposedDate),votes,
      latest:a.latestAction?{date:day(a.latestAction.actionDate),text:String(a.latestAction.text||'').slice(0,300)}:null});
  }
  return out;
}

// The current Congress for a date: the 119th runs 2025–2026.
export const congressOf=(d=new Date())=>Math.floor((d.getUTCFullYear()-1789)/2)+1;

async function download(url,file,{maxAge,refresh}){
  if(!refresh&&fs.existsSync(file)&&(maxAge==null||Date.now()-fs.statSync(file).mtimeMs<maxAge))return false;
  const r=await fetch(url);if(r.status===404)return null;if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);
  const tmp=file+'.part';fs.writeFileSync(tmp,Buffer.from(await r.arrayBuffer()));fs.renameSync(tmp,file);return true;
}

async function main(argv){
  const arg=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null;};
  const now=congressOf(),from=Number(arg('--from'))||113,to=Number(arg('--to'))||now,types=(arg('--types')||TYPES.join(',')).split(',').filter(t=>TYPES.includes(t)),refresh=argv.includes('--refresh');
  const zips=path.join(ROOT,'.local','billstatus'),out=path.join(ROOT,'.local','bills'),amdts=path.join(ROOT,'.local','amendments');
  for(const d of [zips,out,amdts])fs.mkdirSync(d,{recursive:true});
  for(let c=from;c<=to;c++)for(const t of types){
    const name=`BILLSTATUS-${c}-${t}.zip`,zip=path.join(zips,name);
    const got=await download(`${BASE}/${c}/${t}/${name}`,zip,{maxAge:c===now?DAY:null,refresh});
    if(got===null){console.log(`${c} ${t}: no file`);continue;}
    const dest=path.join(out,`${c}-${t}.jsonl`),adest=path.join(amdts,`${c}-${t}.jsonl`);
    const fresh=f=>fs.existsSync(f)&&fs.statSync(f).mtimeMs>=fs.statSync(zip).mtimeMs;
    if(got===false&&fresh(dest)&&fresh(adest)){console.log(`${c} ${t}: up to date`);continue;}
    const dir=fs.mkdtempSync(path.join(zips,'x-'));
    try{
      const u=spawnSync('unzip',['-q','-o',zip,'-d',dir]);if(u.status)throw new Error(`unzip failed for ${name}: ${u.stderr}`);
      const files=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.xml$/i.test(e.name))files.push(p);}};walk(dir);
      const lines=[],am=new Map();let bad=0;
      for(const f of files){try{const p=parser.parse(fs.readFileSync(f,'utf8'))?.billStatus?.bill,r=billFromParsed(p);if(!r){bad++;continue;}lines.push(JSON.stringify(r));
        for(const a of amendmentsFromParsed(p)){const prev=am.get(a.id);if(!prev||a.votes.length>prev.votes.length)am.set(a.id,a);}}catch{bad++;}}
      lines.sort((a,b)=>{const x=JSON.parse(a).n,y=JSON.parse(b).n;return x-y;});
      fs.writeFileSync(dest,lines.join('\n')+'\n');
      const alines=[...am.values()].sort((a,b)=>a.t.localeCompare(b.t)||a.n-b.n).map(a=>JSON.stringify(a));
      fs.writeFileSync(adest,alines.join('\n')+(alines.length?'\n':''));
      console.log(`${c} ${t}: ${lines.length} bills, ${alines.length} amendments (${[...am.values()].filter(a=>a.votes.length).length} with roll calls)${bad?`, ${bad} files not read`:''}`);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exit(1);});
