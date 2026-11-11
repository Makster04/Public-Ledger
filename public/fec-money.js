// The campaign money read from the FEC beyond the cycle's totals, shared by the refresh (src/feeds.mjs), which reads and
// sums it, and the pages, which show it and give it to the Big Money Independence grade:
//   PAC lines by cycle      every PAC contribution the FEC has processed (Form 3, line 11C), with each PAC's type
//   not yet processed       PAC contributions in reports filed since the FEC's processed totals end (raw e-filings)
//   by state                itemized gifts from individuals, by the donor's state
//   joint fundraising       money a joint fundraising committee passed on (line 12), credited back to the people who gave it
// and how the Big Money Independence grade adds these up over more than one cycle.
import {SIZE_BRACKETS} from './donor-sizes.js';
import {pacKind,PAC_KINDS} from './pac-types.js';

const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const cents=n=>Math.round(n*100)/100;
const isMemo=r=>String(r?.memo_code||'').toUpperCase()==='X'||r?.memoed_subtotal===true||r?.memoed_subtotal==='true';
const day=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10):null;

// Which of the FEC's five size groups an amount falls in (0 to 4), by the amount itself.
export function sizeBand(amount){
  const a=Number(amount)||0;
  return a<=200?0:a<500?1:a<1000?2:a<2000?3:4;
}

// ---------- PAC lines by cycle ----------
// One processed PAC contribution: who gave (their committee ID and name), how much, when, and the giving committee's
// type as the FEC records it (from the record's "contributor" committee: type, designation, sponsor's type).
export function pacLine(r){
  const c=r?.contributor||null,amount=num(r?.contribution_receipt_amount);
  return {id:String(r?.sub_id??r?.transaction_id??''),cid:r?.contributor_id||c?.committee_id||null,name:String(r?.contributor_name||c?.name||'').trim(),
    amount:amount==null?null:cents(amount),date:day(r?.contribution_receipt_date),memo:isMemo(r),
    type:c?[c.name||r?.contributor_name||'',c.committee_type||'',c.designation||'',c.organization_type||'']:null};
}
// One cycle's PAC lines: each giving committee once (its gifts added up), with its kind; the total by kind.
export function pacCycleSummary(rows){
  const by=new Map();let total=0,n=0;
  for(const r of rows||[]){
    if(r.memo||!(r.amount>0))continue;
    const key=r.cid||r.name;if(!key)continue;
    const o=by.get(key)||{cid:r.cid||null,name:r.name,amount:0,n:0,kind:r.type?pacKind(r.type):null};
    o.amount=cents(o.amount+r.amount);o.n++;if(!o.kind&&r.type)o.kind=pacKind(r.type);by.set(key,o);total+=r.amount;n++;
  }
  const committees=[...by.values()].sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name));
  const byKind={};for(const c of committees){const k=c.kind||'unknown';byKind[k]=cents((byKind[k]||0)+c.amount);}
  return {total:cents(total),n,typed:cents(committees.filter(c=>c.kind).reduce((t,c)=>t+c.amount,0)),byKind,committees:committees.slice(0,400),more:Math.max(0,committees.length-400)};
}

// ---------- Not yet processed ----------
// PAC contributions in raw e-filings (schedules/schedule_a/efile): line 11C only, memo entries left out. Each row keeps
// its transaction ID and filing number, so an amended report's rows replace the original's when they're added up.
export function efileRows(results,{since=null}={}){
  const out=[];
  for(const r of results||[]){
    if(!/11C$/i.test(String(r?.line_number||'')))continue;
    if(isMemo(r))continue;
    const date=day(r.contribution_receipt_date),amount=num(r.contribution_receipt_amount);
    if(!date||amount==null||(since&&date<since))continue;
    const file=Number(r.file_number)||0,key=r.transaction_id?`t:${r.transaction_id}`:`x:${r.image_number||''}:${r.contributor_name}:${amount}:${date}`;
    out.push({id:`${key}:${file}`,key,name:String(r.contributor_name||'').trim(),cid:r.contributor_id||r.contributor_committee_id||null,amount:cents(amount),date,file,
      url:file?`https://docquery.fec.gov/cgi-bin/forms/${r.committee_id}/${file}/sa/11C`:null});
  }
  return out;
}
// Each transaction once, from its newest filing; newest first.
export function efileSummary(rows,{since,committee}={}){
  const by=new Map();
  for(const r of rows||[]){if(!(r.amount>0))continue;const old=by.get(r.key||r.id);if(!old||r.file>old.file)by.set(r.key||r.id,r);}
  const list=[...by.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.amount-a.amount),total=cents(list.reduce((t,r)=>t+r.amount,0));
  return {since:since||null,through:list[0]?.date||null,count:list.length,total,files:[...new Set(list.map(r=>r.file).filter(Boolean))].length,rows:list.slice(0,300),
    source:committee?`https://www.fec.gov/data/receipts/?data_type=efiling&committee_id=${committee}${since?`&min_date=${since}`:''}`:null};
}

// ---------- By state ----------
// The FEC's totals by the donor's state (schedules/schedule_a/by_state): itemized gifts from individuals only, since
// the FEC has no address for the small gifts reported as a total. home: the person's state.
export function stateSummary(rows,home){
  const states=(rows||[]).map(r=>({state:String(r.state||'').toUpperCase()||null,name:r.state_full||r.state||'Not given',total:cents(num(r.total)||0),count:num(r.count)||0})).filter(r=>r.total>0);
  const total=cents(states.reduce((t,r)=>t+r.total,0)),known=states.filter(r=>/^[A-Z]{2}$/.test(r.state||''));
  const inState=cents(known.filter(r=>r.state===home).reduce((t,r)=>t+r.total,0)),unknown=cents(total-known.reduce((t,r)=>t+r.total,0));
  return {home:home||null,total,inState,outState:cents(total-inState-unknown),unknown,
    states:states.sort((a,b)=>b.total-a.total).slice(0,60).map(r=>({...r,share:total?Math.round(r.total/total*1000)/10:0}))};
}
// The pie of where the itemized gifts come from (x: stateSummary()): the home state first, then the largest other states
// (up to `others`), then the rest of the states together, then gifts with no state given. Each slice: {key, label,
// total, share (0-100), home?}. Every dollar is in exactly one slice.
export function statePie(x,{others=5}={}){
  if(!(x?.total>0))return [];
  const known=(x.states||[]).filter(r=>/^[A-Z]{2}$/.test(r.state||'')),home=x.home?known.find(r=>r.state===x.home):null;
  const top=known.filter(r=>r.state!==x.home).slice(0,x.home?others:others+1);
  const slice=(key,label,total,extra={})=>({key,label,total:cents(total),share:Math.round(total/x.total*1000)/10,...extra});
  const out=[];
  if(home&&x.inState>0)out.push(slice(home.state,home.name,x.inState,{home:true}));
  for(const r of top)out.push(slice(r.state,r.name,r.total));
  const rest=cents((x.home?x.outState:x.total-x.unknown)-top.reduce((t,r)=>t+r.total,0));
  if(rest>=0.01)out.push(slice('other','All other states',rest));
  if(x.unknown>=0.01)out.push(slice('none','No state given',x.unknown));
  return out;
}

// ---------- Joint fundraising ----------
// Line 12, transfers from other authorized committees: a joint fundraising committee's transfer is one line, and the
// people whose gifts it holds are listed under it as memo entries with each one's share. A page of the FEC's records
// becomes its transfer lines and, for the memo entries under each transfer, their shares added up by size; donors'
// names are never kept.
export function jfcPage(results){
  const lines=[],groups=new Map();
  for(const r of results||[]){
    const amount=num(r?.contribution_receipt_amount);if(!(amount>0))continue;
    const c=r.contributor||null,entity=String(r.entity_type||'').toUpperCase(),ind=entity==='IND'||r.is_individual===true;
    if(!isMemo(r)){lines.push({id:`l:${r.sub_id??r.transaction_id}`,line:true,tx:r.transaction_id||null,cid:r.contributor_id||c?.committee_id||null,
      name:String(r.contributor_name||c?.name||'').trim(),designation:c?.designation||null,amount:cents(amount)});continue;}
    const back=r.back_reference_transaction_id||null,g=groups.get(back)||{id:`m:${back||'none'}:${r.sub_id??r.transaction_id}`,memo:true,back,bands:SIZE_BRACKETS.map(()=>0),people:0,shares:0,committees:0};
    if(ind){g.bands[sizeBand(amount)]=cents(g.bands[sizeBand(amount)]+amount);g.people=cents(g.people+amount);g.shares++;}else g.committees=cents(g.committees+amount);
    groups.set(back,g);
  }
  return [...lines,...groups.values()];
}
// One cycle: the transfers from joint fundraising committees, and their money credited back. Individuals' shares go to
// the FEC's size groups by each share's amount; committees' shares stay committee money; what the memo entries don't
// account for is people whose share was $200 or less (not itemized), so it counts as small gifts. When the shares add
// up to more than was transferred (they're listed before the committee's costs), each is scaled down to fit.
export function jfcCycleSummary(rows){
  const lines=(rows||[]).filter(r=>r.line&&r.amount>0),memos=(rows||[]).filter(r=>r.memo);
  const parents=new Set(memos.map(m=>m.back).filter(Boolean));
  // A transfer is from a joint fundraiser when the FEC says so (designation J), or when shares are listed under it.
  const jfc=lines.filter(l=>String(l.designation||'').toUpperCase()==='J'||(l.tx&&parents.has(l.tx))||/\b(victory|joint|jfc)\b/i.test(l.name||''));
  const ids=new Set(jfc.map(l=>l.tx).filter(Boolean)),mine=memos.filter(m=>!m.back||ids.has(m.back));
  const transferred=cents(jfc.reduce((t,l)=>t+l.amount,0)),listedPeople=mine.reduce((t,m)=>t+m.people,0),listedCommittees=mine.reduce((t,m)=>t+m.committees,0);
  const listed=listedPeople+listedCommittees,scale=listed>transferred&&listed>0?transferred/listed:1;
  const bands=SIZE_BRACKETS.map((_,i)=>mine.reduce((t,m)=>t+(m.bands[i]||0),0)*scale);
  const committees=cents(listedCommittees*scale),unlisted=cents(Math.max(0,transferred-listed*scale));
  bands[0]+=unlisted;
  const from=new Map();for(const l of jfc){const k=l.cid||l.name,o=from.get(k)||{cid:l.cid,name:l.name,amount:0,n:0};o.amount=cents(o.amount+l.amount);o.n++;from.set(k,o);}
  return {transferred,people:cents(bands.reduce((t,b)=>t+b,0)),committees,unlisted,shares:mine.reduce((t,m)=>t+m.shares,0),bands:bands.map(cents),scaled:scale<1,
    from:[...from.values()].sort((a,b)=>b.amount-a.amount).slice(0,30)};
}

// ---------- Periods for the Big Money Independence grade ----------
// The cycles a period covers: 'this' (the current cycle) or 'since:YYYY' (each cycle from YYYY's on) or 'cycle:YYYY'.
export function periodCycles(period,current,available=[]){
  const all=[...new Set([current,...available].map(Number))].filter(Number.isFinite).sort((a,b)=>b-a);
  const m=String(period||'this').match(/^(since|cycle):(\d{4})$/);
  if(!m)return [current];
  return m[1]==='cycle'?[Number(m[2])]:all.filter(c=>c>=Number(m[2])&&c<=current);
}
export function periodLabel(period,current){
  const cy=periodCycles(period,current,[]),m=String(period||'').match(/^(since|cycle):(\d{4})$/);
  if(!m)return `${current-1}–${current} (this cycle)`;
  return m[1]==='cycle'?`${Number(m[2])-1}–${m[2]}`:`${Number(m[2])-1}–${current}`;
}
// The periods to offer: this cycle, then each wider span back to the first cycle on file, then each earlier cycle alone.
export function periodOptions(current,cycles){
  const past=[...new Set((cycles||[]).map(Number))].filter(c=>c<current).sort((a,b)=>b-a);
  return [{value:'this',label:periodLabel('this',current)},...past.map(c=>({value:`since:${c}`,label:`${c-1}–${current}`})),...past.map(c=>({value:`cycle:${c}`,label:`${c-1}–${c} only`}))];
}

// The inputs the Big Money Independence grade takes, added up over the period's cycles. cur: what the current cycle uses now
// ({camp, sizes, pacRows, earmarks, jfc}); past: {camp: campaign-history cycles, sizes: donor-sizes cycles, pacs:
// pac-history cycles, jfc: joint-fundraising cycles, earmarks: {cycle: [{group, amount}]}}. A cycle missing a record
// leaves that part waiting (null), never zero.
export function combinePeriod(cycles,current,cur,past,{typeOf=null}={}){
  const parts=cycles.map(cy=>cy===current?{cy,camp:cur.camp,sizes:cur.sizes,pacRows:cur.pacRows,earmarks:cur.earmarks,jfc:cur.jfc??past.jfc?.[cy]??null}
    :{cy,camp:past.camp?.[cy]||null,sizes:past.sizes?.[cy]||null,pacRows:pacRowsOf(past.pacs?.[cy],typeOf),earmarks:past.earmarks?.[cy]||[],jfc:past.jfc?.[cy]||null});
  const missing=parts.filter(p=>!p.camp||!(p.camp.receipts>=0)).map(p=>p.cy);
  if(missing.length)return {missing,why:`The FEC's totals for ${missing.map(c=>`${c-1}–${c}`).join(', ')} aren't read yet`};
  const add=k=>cents(parts.reduce((t,p)=>t+(Number(p.camp[k])||0),0));
  const camp={receipts:add('receipts'),indiv:cents(parts.reduce((t,p)=>t+(Number(p.camp.indiv??p.camp.individual)||0),0)),itemized:add('itemized'),unitemized:add('unitemized'),
    pac:add('pac'),transfers:add('transfers'),self:add('self'),start:parts.map(p=>p.camp.start).filter(Boolean).sort()[0]||null,end:parts.map(p=>p.camp.end).filter(Boolean).sort().at(-1)||null,missing:false};
  // Gift sizes: every cycle's, or none (the grade then counts itemized gifts at the not-yet-sorted rate).
  const sizes=parts.every(p=>p.sizes?.brackets?.length===SIZE_BRACKETS.length)?{brackets:SIZE_BRACKETS.map((b,i)=>({...b,total:cents(parts.reduce((t,p)=>t+(Number(p.sizes.brackets[i].total)||0),0))})),
    notSorted:cents(parts.reduce((t,p)=>t+(Number(p.sizes.notSorted)||0),0)),start:camp.start,end:camp.end}:null;
  // PAC lines: each cycle's shares applied to that cycle's PAC total, so a cycle with more lines read doesn't count more.
  let pacRows=[];
  for(const p of parts){
    const total=Number(p.camp.pac)||0,rows=(p.pacRows||[]).filter(r=>r.amount>0),read=rows.reduce((t,r)=>t+r.amount,0);
    if(total>0&&!read){pacRows=null;break;}
    if(total>0)for(const r of rows)pacRows.push({kind:r.kind,amount:r.amount/read*total});
  }
  const earmarks=parts.flatMap(p=>p.earmarks||[]);
  const jfc=parts.every(p=>p.jfc)?addJfc(parts.map(p=>p.jfc)):null;
  return {camp,sizes,pacRows,earmarks,jfc,cycles,missing:[]};
}
function pacRowsOf(summary,typeOf){
  if(!summary)return null;
  return (summary.committees||[]).map(c=>({kind:c.kind||(c.cid&&typeOf?typeOf(c.cid):null),amount:c.amount})).filter(c=>c.kind);
}
export function addJfc(list){
  const bands=SIZE_BRACKETS.map((_,i)=>cents(list.reduce((t,j)=>t+(Number(j.bands?.[i])||0),0)));
  const sum=k=>cents(list.reduce((t,j)=>t+(Number(j[k])||0),0));
  return {transferred:sum('transferred'),people:sum('people'),committees:sum('committees'),unlisted:sum('unlisted'),shares:sum('shares'),bands,from:list.flatMap(j=>j.from||[])};
}
export {PAC_KINDS};
