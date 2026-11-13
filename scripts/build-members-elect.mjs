// The House members-elect of the November 3, 2026 election who have no profile on the site yet: one basic profile each,
// and the race they won, for the House page, the Races page and their own profile (public/members-elect.json).
//   npm run house:elect                build the file from Wikipedia and the FEC's bulk files
//   npm run house:elect -- --cached    use the pages and bulk files saved by the last run (.local/wiki, .local/fec-bulk)
// Who: Wikipedia's "List of new members of the 120th United States Congress" (its House table: district, member, the
// seat's change, prior background, birth year, and the news report of the win it cites). A district is left out when
// the site already profiles it (a race in public/research.json, or a profile whose district it is; a profiled winner's
// race is kept so their profile can find it) or when data/members-elect-skip.json lists it (a race not called yet, or
// a result no source confirms yet). Edit that file as races are called and run this again.
// The count: each district's general-election box on Wikipedia's state page (the nominees, their votes and shares, and
// how much was counted when it was last updated), or none when the page has no numbers yet.
// The money, from the FEC's bulk files for 2026 (each person found by state, district and name):
//   campaign: the principal campaign committee's own totals (committee_summary_2026.csv), as npm run money:update
//   keeps the profiles' figures;
//   outside spending: general-election independent expenditures (independent_expenditure_2026.csv), each spender's
//   latest version of each item, from Jan. 1, 2025 through Sept. 30, 2026 like every other profile, "for" being spent
//   supporting them or opposing their opponent and "against" the reverse.
// Their basic profile is a directory entry like public/house.json's, marked "elect", and becomes a regular member's
// once the new Congress is sworn in and npm run house:build reads the new House.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BULK='https://www.fec.gov/files/bulk-downloads/2026';
const LIST='List_of_new_members_of_the_120th_United_States_Congress';
const UA='PublicLedger/1.0 (members-elect list for a nonprofit scorecard; https://github.com/Makster04/Public-Ledger)';
export const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',
  MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',
  NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
const CODE=Object.fromEntries(Object.entries(STATES).map(([k,v])=>[v,k]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const c2=v=>v==null?null:Math.round(v*100)/100;

// ---------- Wikipedia text ----------
// Wiki markup as plain text: links as their words, templates, references and bold marks out.
export const plain=s=>String(s||'').replace(/<ref[\s\S]*?(<\/ref>|\/>)/g,'').replace(/\{\{efn[\s\S]*?\}\}/g,'').replace(/\{\{small\|([\s\S]*?)\}\}/g,'$1')
  .replace(/\{\{sortname\|([^|}]*)\|([^|}]*)(?:\|[^}]*)?\}\}/g,'$1 $2').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g,'$1').replace(/<br\s*\/?>/gi,'; ')
  .replace(/\{\{[^{}]*\}\}/g,'').replace(/'''?/g,'').replace(/\s*;\s*;\s*/g,'; ').replace(/\s+/g,' ').replace(/^[;\s]+|[;\s]+$/g,'').trim();
// "AZ-06" from a row's district cell ({{ushr|AZ|6|X}} or [[Arizona's 6th congressional district|Arizona 6]]); "SD-AL" at large.
export function districtOf(cell){
  let st,d;const u=/\{\{ushr\|([A-Z]{2})\|([^|}]+)/.exec(cell);
  if(u){st=u[1];d=u[2];}else{const l=/\[\[[^\]|]*\|([^\]]+)\]\]/.exec(cell)?.[1]||plain(cell);const m=/^(.*?) (\d+|at-large)$/i.exec(l.trim());if(!m)return null;st=CODE[m[1]]||m[1];d=m[2];}
  d=/^(at-large|AL|0)$/i.test(String(d).trim())?'AL':String(Number(d)).padStart(2,'0');
  return STATES[st]?`${st}-${d}`:null;
}
// The House table of the new-members list: [{district, first, last, party, switched, how, background, born, ref}].
export function newMembers(wikitext){
  const a=wikitext.indexOf('== House of Representatives =='),b=wikitext.indexOf('====Non-voting delegates====',a);
  const out=[];
  for(const chunk of wikitext.slice(a,b<0?undefined:b).split(/\n\|-\s*\n/)){
    const lines=chunk.split('\n').filter(l=>/^\s*[|!]/.test(l)),head=lines.find(l=>/^\s*!/.test(l)&&!/^\s*!\s*(District|Image|Representative|Switched|Prior|Birth|Ref)\b/.test(l));
    const district=head&&districtOf(head);if(!district)continue;
    const repLine=lines.find(l=>/\{\{sortname/.test(l));if(!repLine)continue;
    const sn=/\{\{sortname\|([^|}]*)\|([^|}]*)(?:\|([^}]*))?\}\}\s*\((DFL|[A-Z])\)/.exec(repLine);if(!sn)continue;
    const cells=lines.slice(lines.indexOf(repLine)+1).map(l=>l.replace(/^\s*\|\s*/,''));
    const sw=cells[0]||'',ref=cells.slice(3).join(' '),field=k=>new RegExp(`\\|\\s*${k}\\s*=\\s*([^|}]+)`).exec(ref)?.[1]?.trim()||null;
    const url=/url\s*=\s*(https?:[^|\s}]+)/.exec(ref)?.[1]||null;
    out.push({district,first:sn[1].trim(),last:sn[2].trim(),party:sn[4]==='DFL'?'D':sn[4],switched:/\|\s*Yes\s*\]\]/.test(sw),how:plain(sw).replace(/^(Yes|No)\b\s*;?\s*/,''),
      background:plain(cells[1]),born:plain(cells[2])||null,
      ref:url?{u:url,t:plain(field('title')),site:plain(field('website')||field('work')||field('publisher')).replace(/^\[\[/,'')||null,date:plain(field('date'))||null}:null});
  }
  return out;
}
// One district's section of a state's House elections page (the whole page for a single at-large seat).
export function districtSection(text,d){
  if(d==='AL'){const m=/==\s*At-large(?: congressional)? district\s*==/i.exec(text);if(m){const r=text.slice(m.index+m[0].length);const n=r.search(/\n==[^=]/);return r.slice(0,n<0?undefined:n);}
    return /\{\{Infobox election/.test(text)?text:null;}
  const m=new RegExp(`==\\s*District ${Number(d)}\\s*==`).exec(text);if(!m)return null;
  const r=text.slice(m.index+m[0].length),n=r.search(/\n==[^=]/);return r.slice(0,n<0?undefined:n);
}
const PARTY={'Democratic Party (United States)':'D','Republican Party (United States)':'R','Minnesota Democratic–Farmer–Labor Party':'D','Libertarian Party (United States)':'L',
  'Green Party of the United States':'G','Independent politician':'I','Nonpartisan politician':'I'};
// The district's election box: [{name, party, votes, pct}] (votes and pct null until the page has them), with how much
// was counted and when the page last updated it.
export function electionBox(sec){
  const ib=/\{\{Infobox election([\s\S]*?)\n\}\}/.exec(sec||'')?.[1]||'';
  const field=k=>new RegExp(`\\|[ \\t]*${k}[ \\t]*=[ \\t]*([^\\n]*)`).exec(ib)?.[1]?.trim()||'';
  const num=s=>{const t=plain(s);return /\d/.test(t)?Number(t.replace(/[^\d.]/g,'')):null;};
  const nominees=[];
  for(let i=1;i<=8;i++){const name=plain(field('nominee'+i)||field('candidate'+i));if(!name)continue;const p=plain(field('party'+i));
    nominees.push({name,party:PARTY[p]||(/Democratic/.test(p)?'D':/Republican/.test(p)?'R':/Libertarian/.test(p)?'L':/Green/.test(p)?'G':p?'I':null),votes:num(field('popular_vote'+i)),pct:num(field('percentage'+i))});}
  return {nominees,reporting:num(field('reporting')),updated:plain(field('last_update'))||null};
}

// ---------- the FEC's bulk files ----------
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z ]/g,' ').replace(/\s+/g,' ').trim();
// A name as "LAST, FIRST" (the FEC's way) fits a name written "First Last" when the last names agree: the last word,
// leaving out Jr. and III, or a two-word last name ("TRONE GARRIOTT").
const SUFFIX=/ (JR|SR|II|III|IV)$/;
export function nameFits(fecName,name){
  const last=norm(String(fecName).split(',')[0]).replace(SUFFIX,''),words=norm(name).replace(SUFFIX,'');
  return !!last&&(words===last||words.endsWith(' '+last)||last.split(' ').includes(words.split(' ').at(-1)));
}
const fitsName=(a,b)=>nameFits(`${String(a).split(' ').slice(-1)[0]}, x`,b)||nameFits(`${String(b).split(' ').slice(-1)[0]}, x`,a);
function parseCSV(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}else if(c==='"')q=true;else if(c===','){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;}
const MON={JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};
const dmy=d=>{const m=/^(\d{2})-([A-Z]{3})-(\d{2})$/.exec(d||'');return m?`20${m[3]}-${MON[m[2]]}-${m[1]}`:'';};
const ymd=d=>/^\d{8}$/.test(d||'')?`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`:null;
const mdy=d=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d||'');return m?`${m[3]}-${m[1]}-${m[2]}`:null;};
const titleCase=s=>String(s||'').toLowerCase().replace(/\b([a-z])/g,c=>c.toUpperCase()).replace(/\b(Nc|Pa|Ny|Ca|Tx|Fl|Ga|Az|Nj|Va|Wi|Mi|Oh|Mn|Ia|Il|In|Ky|Md|Ma|Mo|Mt|Ne|Nv|Nh|Ok|Sc|Sd|Tn|Ut|Wa|Wy|Co|Ct|Al|Ii|Iii|Iv)\b/g,x=>x.toUpperCase());
// The bulk files as lookups: candidates by office, principal committees, committees' names and kinds, committee totals,
// and the independent expenditures by candidate.
export function fecTables({weball,ccl,cm,summary,ie}){
  const cands=weball.split('\n').filter(Boolean).map(l=>l.split('|')).filter(v=>v[0].startsWith('H')).map(v=>({id:v[0],name:v[1],party:v[4],receipts:Number(v[5])||0,st:v[18],dist:v[19],end:mdy(v[27])}));
  const principal=new Map();for(const v of ccl.split('\n').filter(Boolean).map(l=>l.split('|')))if(v[5]==='P'&&(!principal.has(v[0])||v[1]==='2026'))principal.set(v[0],v[3]);
  const committees=new Map(cm.split('\n').filter(Boolean).map(l=>{const v=l.split('|');return [v[0],{name:v[1],type:v[9]}];}));
  const sl=summary.split(/\r?\n/).filter(Boolean),sh=parseCSV(sl[0]);const totals=new Map(sl.slice(1).map(l=>{const v=parseCSV(l);return [v[1],Object.fromEntries(sh.map((h,i)=>[h,v[i]]))];}));
  const il=ie.split(/\r?\n/).filter(Boolean),ih=parseCSV(il[0]);const byCand=new Map();
  for(const l of il.slice(1)){const v=parseCSV(l),r=Object.fromEntries(ih.map((h,i)=>[h,v[i]]));if(r.ele_type!=='G'||!r.cand_id?.startsWith('H'))continue;(byCand.get(r.cand_id)||byCand.set(r.cand_id,[]).get(r.cand_id)).push(r);}
  return {cands,principal,committees,totals,byCand};
}
// A nominee's FEC candidate: same state and district, the name fits; the one that raised the most when two do.
export function findCandidate(T,district,name,party){
  const [st,d]=district.split('-'),dist=d==='AL'?'00':d;
  const fits=T.cands.filter(c=>c.st===st&&c.dist===dist&&nameFits(c.name,name));
  const best=fits.filter(c=>!party||(party==='D'?c.party==='DEM':party==='R'?c.party==='REP':true));
  return (best.length?best:fits).sort((a,b)=>b.receipts-a.receipts)[0]||null;
}
// The principal committee's totals in the profiles' "camp" shape.
export function campOf(T,cand){
  const id=T.principal.get(cand),r=id&&T.totals.get(id);if(!r)return null;
  const x=k=>Number(r[k])||0,receipts=x('TTL_RECEIPTS'),itemized=x('INDV_ITEM_CONTB'),unitemized=x('INDV_UNITEM_CONTB'),pac=x('OTH_CMTE_CONTB'),party=x('PTY_CMTE_CONTB'),transfers=x('TRANF_FROM_OTHER_AUTH_CMTE'),candidate=x('CAND_CNTB'),loans=x('CAND_LOAN');
  const self=c2(candidate+loans),end=ymd(r.CVG_END_DT);
  return {receipts:c2(receipts),indiv:c2(x('INDV_CONTB')),itemized:c2(itemized),unitemized:c2(unitemized),party:c2(party),pac:c2(pac),transfers:c2(transfers),candidate:c2(candidate),loans:c2(loans),
    disbursements:c2(x('TTL_DISB')),cash:c2(x('COH_COP')),debts:c2(x('DEBTS_OWED_BY_CMTE')),cmte:titleCase(r.CMTE_NM),cmteId:id,start:ymd(r.CVG_START_DT),end,missing:false,
    src:`https://www.fec.gov/data/committee/${id}/?cycle=2026`,note:`Figures from the FEC's committee summary file (committee_summary_2026) through ${end}.`,
    other:c2(Math.max(0,receipts-itemized-unitemized-pac-party-transfers-self)),loansKnown:true,self,selfShare:receipts?Math.round(self/receipts*1000)/10:0};
}
const kindOf=t=>['O','U','V','W'].includes(t)?'super_pac':['X','Y','Z'].includes(t)?'party':'other';
// Outside spending for and against one candidate, against their rivals, in the profiles' "out" shape (no committee table).
export function outOf(T,me,rivals,{from='2025-01-01',to='2026-09-30'}={}){
  const by=()=>({super_pac:0,other:0,party:0}),parts={S:by(),O:by(),OO:by(),SO:by(),X:by()},pre={n:0,amount:0};let n=0;
  for(const cand of [me,...rivals].filter(Boolean)){
    const latest=new Map();for(const r of T.byCand.get(cand)||[]){const k=r.spe_id+'|'+r.tran_id,o=latest.get(k);if(!o||Number(r.file_num)>Number(o.file_num))latest.set(k,r);}
    for(const r of latest.values()){const date=dmy(r.dissem_dt)||dmy(r.exp_date),amt=Number(r.exp_amo)||0;if(!date||!['S','O'].includes(r.sup_opp))continue;
      if(date<from){if(cand===me){pre.n++;pre.amount+=amt;}continue;}if(date>to)continue;
      const k=cand===me?r.sup_opp:(r.sup_opp==='O'?'OO':'SO');parts[k][kindOf(T.committees.get(r.spe_id)?.type)]+=amt;n++;}
  }
  for(const p of Object.values(parts))for(const k of Object.keys(p))p[k]=c2(p[k]);
  const side=(a,b)=>{const o={};for(const k of ['super_pac','other','party'])o[k]=c2(parts[a][k]+parts[b][k]);o.total=c2(o.super_pac+o.other+o.party);return o;};
  return {start:from,end:to,multi:false,incomplete:[],for:side('S','OO'),against:side('O','SO'),parts,rivals:[],others:[],excludedPre:{n:pre.n,amount:c2(pre.amount)},n,uncertain:0,cms:[],same:null,dupRemoved:{n:0,amount:0},possibleRepeat:0,pinned:0};
}

// ---------- the members-elect ----------
const slug=s=>norm(s).toLowerCase().replace(/[^a-z]/g,'');
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const periodLabel=(a,b)=>{const m=d=>`${MONTHS[Number(d.slice(5,7))-1]} ${d.slice(0,4)}`;return a&&b?`${m(a)} – ${m(b)}`:'2025–26';};
const dayOf=s=>{const t=Date.parse(`${s} 12:00 UTC`);return s&&Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null;};
// Each new member without a profile, and their race. taken: IDs already in use; profiled: district -> {id, fecCand} of a
// full profile whose race this is; house: the sitting members (to link a defeated or departing one); skip: district ->
// reason. Returns {members, races, left}.
export function buildMembersElect({rows,pages,T,taken,profiled,house,skip,listUrl}){
  const members=[],races=[],left=[];const used=new Set(taken);
  for(const r of rows){
    if(skip[r.district]){left.push(`${r.district} ${r.first} ${r.last}: ${skip[r.district]}`);continue;}
    const [st,d]=r.district.split('-'),page=pages[st]?.[d];
    const box=page?electionBox(page.section):{nominees:[]};
    const name=`${r.first} ${r.last}`.replace(/\s+/g,' ');
    const win=findCandidate(T,r.district,name,r.party);
    const pro=profiled.get(r.district);
    if(pro&&!(pro.race))continue;            // a race the site already shows
    // The defeated or departing member, and the general-election opponent(s).
    // Who held the seat: the member being replaced, or the one defeated (in a primary only when they're a sitting member;
    // otherwise just the party).
    const held=/(?:Defeated|replacing)\s+([^;(]+?)\s*\((D|R|I|DFL)\)/.exec(r.how),heldParty=held?(held[2]==='DFL'?'D':held[2]):null;
    const named=held?.[1]?.trim()||null,inPrimary=/in a primary/i.test(r.how);
    const heldBy=named&&(!inPrimary||house.some(m=>m.state===st&&fitsName(m.name,named)))?named:null;
        const wbox=box.nominees.find(n=>nameFits(`${r.last}, ${r.first}`,n.name)),others=box.nominees.filter(n=>n!==wbox);
    const id=pro?.id||(()=>{let b=slug(r.last)||slug(name),x=b;if(used.has(x))x=b+st.toLowerCase();let i=2;while(used.has(x))x=b+st.toLowerCase()+(i++);used.add(x);return x;})();
    const rivals=others.slice(0,1).map(n=>{const f=findCandidate(T,r.district,n.name,n.party);const h=heldBy&&fitsName(n.name,heldBy)?house.find(m=>m.state===st&&fitsName(m.name,n.name)):null;
      return {...(h?{id:h.id,bioguide:h.bioguide,incumbent:true}:{}),name:n.name,party:n.party,fecCand:f?.id||null,box:n};});
    const keyOf=n=>n.id||n.fecCand||`${st.toLowerCase()}${d}-${slug(n.name.split(' ').slice(-1)[0])}`;
    const winner={id:pro?undefined:id,profile:pro?.id,name,party:r.party,fecCand:win?.id||pro?.fecCand||null};
    if(pro)delete winner.id;
    const wkey=winner.id||winner.fecCand;
    const shown=[{...winner,key:wkey,box:wbox},...rivals.map(n=>({...n,key:keyOf(n)}))];
    const counted=box.nominees.some(n=>n.pct!=null);
    const label=`${STATES[st]} ${d==='AL'?'at-large':r.district}`;
    const call=r.ref?{t:[r.ref.t,r.ref.site,r.ref.date].filter(Boolean).join(', '),u:r.ref.u}:page?{t:`Wikipedia: ${page.title.replace(/_/g,' ')}`,u:page.url}:{t:'Wikipedia: List of new members of the 120th United States Congress',u:listUrl};
    const race={id:`H-${r.district}`,chamber:'H',state:STATES[st],district:r.district,label,elect:true,
      nominees:shown.map(({key,box,...n})=>({...n,...(n.id||n.fecCand?{}:{id:key})})),
      result:{winner:wkey,date:dayOf(r.ref?.date),how:r.how||'',src:call,
        tally:counted?{shares:Object.fromEntries(shown.filter(n=>n.box?.pct!=null).map(n=>[n.key,n.box.pct])),
          votes:Object.fromEntries(shown.filter(n=>n.box?.votes!=null).map(n=>[n.key,n.box.votes])),
          others:box.nominees.filter(b=>!shown.some(n=>n.box===b)).map(b=>({name:b.name,...(b.party?{party:b.party}:{}),pct:b.pct,...(b.votes!=null?{votes:b.votes}:{})})),
          counted:box.reporting!=null?`${box.reporting}% of the expected vote counted${box.updated?` (as of ${box.updated})`:''}`:'',
          src:{t:`Wikipedia: ${page.title.replace(/_/g,' ')}, ${label}`,u:page.url},asof:null}:null},
      held:heldParty?{party:heldParty,by:heldBy}:null};
    races.push(race);
    if(pro)continue;
    const camp=win?campOf(T,win.id):null,out=win?outOf(T,win.id,rivals.map(n=>n.fecCand).filter(Boolean)):null;
    members.push({id,name,short:r.last,party:r.party,state:st,stateName:STATES[st],district:d==='AL'?0:Number(d),seat:`${st}-${d==='AL'?'AL':Number(d)}`,elect:true,
      takesOffice:'2027-01-03',how:r.how,switched:r.switched,background:r.background,born:r.born,
      fecCand:win?.id||null,fecCmte:camp?.cmteId||null,cmteName:camp?.cmte||null,...(camp?{camp,cycleLabel:periodLabel(camp.start,camp.end)}:{}),...(out?{out}:{}),
      call,list:{t:'Wikipedia: List of new members of the 120th United States Congress',u:listUrl},race:race.id});
  }
  return {members,races,left};
}

// ---------- the run ----------
async function wiki(title,cached){
  const dir=path.join(ROOT,'.local','wiki'),file=path.join(dir,`${title.replace(/[^\w–-]/g,'_')}.wiki`);
  if(cached&&fs.existsSync(file))return fs.readFileSync(file,'utf8');
  const get=async t=>{const r=await fetch(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(t)}&action=raw`,{headers:{'User-Agent':UA}});if(!r.ok)throw new Error(`Wikipedia: ${t} (HTTP ${r.status})`);await sleep(600);return r.text();};
  let s=await get(title);const red=/^#REDIRECT \[\[([^\]]+)\]\]/i.exec(s);if(red)s=await get(red[1].replace(/ /g,'_'));
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,s);return s;
}
function bulk(name,cached){
  const dir=path.join(ROOT,'.local','fec-bulk'),file=path.join(dir,name);fs.mkdirSync(dir,{recursive:true});
  return (async()=>{if(!(cached&&fs.existsSync(file))){console.log(`Downloading ${BULK}/${name}…`);const r=await fetch(`${BULK}/${name}`);if(!r.ok)throw new Error(`FEC: ${name} (HTTP ${r.status})`);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}
    if(!name.endsWith('.zip'))return fs.readFileSync(file,'utf8');
    const u=spawnSync('unzip',['-p',file],{maxBuffer:1<<30,encoding:'utf8'});if(u.status!==0)throw new Error(`unzip ${name}: ${u.stderr}`);return u.stdout;})();
}
const statePage=(st,d)=>st==='CA'?`2026_United_States_House_of_Representatives_elections_in_California_(districts_${Number(d)<=26?'1–26':'27–52'})`:`2026_United_States_House_of_Representatives_elections_in_${STATES[st].replace(/ /g,'_')}`;
async function main(){
  const cached=process.argv.includes('--cached'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
  const D=read('public/research.json'),house=read('public/house.json').members,senate=read('public/senate.json').senators,skip=read('data/members-elect-skip.json').skip||{};
  const listUrl=`https://en.wikipedia.org/wiki/${LIST}`;
  const rows=newMembers(await wiki(LIST,cached));
  // Districts the site already shows: its races, and its House profiles (a profile of a winner of a results-only race
  // keeps the race here, so their profile can find it).
  const profiled=new Map();
  for(const r of [...D.races,...D.liteRaces])if(r.chamber==='H')profiled.set(r.id.slice(2),{covered:true});
  for(const c of D.cands)if(c.chamber==='H'&&c.district){const k=c.district.replace(/^([A-Z]{2})-(\d)$/,'$1-0$2');if(!profiled.has(k))profiled.set(k,{id:c.id,fecCand:c.fecCand,race:true});}
  const wanted=rows.filter(r=>!profiled.get(r.district)?.covered);
  const pages={};
  for(const r of wanted){const [st,d]=r.district.split('-');if(skip[r.district])continue;const t=statePage(st,d);
    const text=await wiki(t,cached).catch(e=>{console.log(e.message);return '';});const section=districtSection(text,d);
    (pages[st]||={})[d]=section?{title:t,url:`https://en.wikipedia.org/wiki/${t}#${d==='AL'?'':`District_${Number(d)}`}`.replace(/#$/,''),section}:null;}
  const T=fecTables({weball:await bulk('weball26.zip',cached),ccl:await bulk('ccl26.zip',cached),cm:await bulk('cm26.zip',cached),summary:await bulk('committee_summary_2026.csv',cached),ie:await bulk('independent_expenditure_2026.csv',cached)});
  const taken=[...D.members,...D.cands,...(D.featured||[]),...house,...senate].map(x=>x.id);
  const {members,races,left}=buildMembersElect({rows:wanted,pages,T,taken,profiled,house,skip,listUrl});
  const out={about:'The House members-elect of the November 3, 2026 election with no profile on the site yet, each with a basic profile and the race they won, and the races of winners profiled after the election. From scripts/build-members-elect.mjs (npm run house:elect): who won from Wikipedia\'s list of new members of the 120th Congress and the news report of each win it cites, the count from Wikipedia\'s state pages, and the money from the FEC\'s bulk files. Unofficial until each state certifies.',
    built:new Date().toISOString().slice(0,10),source:{list:listUrl,fec:BULK},members,races};
  fs.writeFileSync(path.join(ROOT,'public','members-elect.json'),JSON.stringify(out,null,1)+'\n');
  const noFec=members.filter(m=>!m.fecCand).map(m=>`${m.seat} ${m.name}`),noCount=races.filter(r=>!r.result.tally).map(r=>r.district);
  console.log(`${members.length} members-elect with a basic profile, ${races.length} races (${races.length-members.length} for winners already profiled). Wrote public/members-elect.json.`);
  if(left.length)console.log(`Left out (data/members-elect-skip.json):\n  ${left.join('\n  ')}`);
  if(noFec.length)console.log(`No FEC candidate found for: ${noFec.join(', ')}`);
  if(noCount.length)console.log(`No count on Wikipedia yet for: ${noCount.join(', ')}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exit(1);});
