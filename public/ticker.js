// The ticker under the top bar, the Latest updates cards on the home page and the Latest updates page behind them: the
// site's news, newest first, each with a tag (its kind's emoji and name), its date and a link to where it changed.
//   races       a race called, or still counting (research.json "races" and "liteRaces")
//   grades      a grade that moved, someone newly graded (news.json, scripts/build-news.mjs)
//   promises    a reviewed promise verdict, by its topic and month, never its words (news.json)
//   legal       a legal case dated in the last 45 days (research.json "ethics"), with what it costs in Legal Trouble
//   stock trades, net worth   newly reported trades (with how late they were filed) and annual disclosures (with their
//               net worth range, and the year before's), from the refresh (/api/ticker), dated by when it first read them
//   lobby money a tracker's PAC checks to sitting members (news.json, from the FEC bulk files)
//   super PACs  a tracker's own super PAC's spending for or against a candidate (news.json, from the FEC's filings)
//   FEC reports the campaign reports read (research.json "camp")
//   site        site updates (score-presentation-log.json headlines; not rule changes) and the interest-group ratings read
// The strip (approved Nov. 14, 2026, from the mockup) has two parts: TRADES, the newest stock trades (▲ bought, ▼ sold,
// the company, who, the amount as reported, and how late it was filed), and PAC MONEY, the trackers' newest PAC checks.
// The cards show the rest (and the PAC checks too): races still counting first, then each kind in turn, so one kind can't
// fill the row. The page shows the last 45 days by day, with a filter for each kind. Each item is placed by when it
// reached the site ("seen", else its own date). With nothing to show, the strip or the cards aren't shown. The strip
// scrolls slowly, stops while hovered or focused, and stands still for visitors whose device asks for reduced motion.
import {TRACKER} from './trackers.js';
import {ETHICS_COST,CASE_KIND} from './grades.js';

export const TICKER={trades:24,pac:12,cards:16,pageDays:45,countingDays:45,liveEvery:300000,lateDays:45};
const DAY=864e5,HOUR=36e5;
// A record's time in ms: a timestamp as given, a date alone at noon UTC that day.
const t=d=>{const x=String(d||'');return /T\d/.test(x)?Date.parse(x):Date.parse(x.slice(0,10)+'T12:00:00Z');};
// Within the last `days` days (a date alone counts from noon UTC that day; a date to come doesn't count).
export const isFresh=(d,now=Date.now(),days=TICKER.pageDays)=>{const x=t(d);return Number.isFinite(x)&&x<=now+DAY/2&&now-x<=days*DAY;};
const withinDays=(d,days,now)=>{const x=t(d);return Number.isFinite(x)&&x<=now+DAY&&now-x<=days*DAY;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
// (only a sentence's own first word: "Called by the AP" -> "called by the AP", but never a name, as in "Susan Collins conceded")
const lowerFirst=s=>s&&/^(Called|Projected|Declared|Won|Leads|Conceded|Too)\b/.test(s)?s[0].toLowerCase()+s.slice(1):s;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const shortDate=d=>{const x=new Date(t(d));return Number.isFinite(x.getTime())?`${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}`:'';};
// When an item reached the site: when the refresh or the news build first read it, else its own date.
export const atOf=x=>t(x.at||x.date)||0;

// The kinds: each item's tag emoji, and the group its filter is under on the page.
export const KIND={call:['🗳️','race'],warn:['🗳️','race'],grade:['🎓','grade'],promise:['📝','promise'],legal:['🚨','legal'],trade:['📈','trade'],filing:['💵','finance'],
  lobby:['💰','lobby'],superpac:['📣','superpac'],fec:['🏦','fec'],site:['🛠️','site'],new:['📊','site']};
export const GROUPS=[['race','🗳️','Races'],['grade','🎓','Grades'],['promise','📝','Promises'],['legal','🚨','Legal'],['trade','📈','Stock trades'],['finance','💵','Net worth'],
  ['lobby','💰','Lobby money'],['superpac','📣','Super PACs'],['fec','🏦','FEC reports'],['site','🛠️','Site']];
const groupOf=x=>KIND[x.kind]?.[1]||'site';

// A person as the ticker names them: short name and party, from the profiles and directories.
export function nameOf(id,people){const p=people?.get?.(id);return p?{name:p.short||String(p.name||'').split(/\s+/).pop(),party:p.party||null}:null;}
// The people the page knows (the profiles and both chambers' directories), by ID.
export function pagePeople(w=globalThis){const m=new Map();for(const p of [...(w.HOUSE||[]),...(w.SENATE||[]),...(w.DATA?.cands||[]),...(w.DATA?.members||[])])if(p?.id)m.set(p.id,p);return m;}
// A profile by FEC candidate ID (their own or an earlier one).
function byFec(people,cand){if(!cand||!people?.values)return null;for(const p of people.values())if(p?.fecCand===cand||(p?.fecCandPast||[]).includes(cand))return p;return null;}
const money=n=>{const a=Math.abs(n),s=n<0?'−':'';return a>=1e6?`${s}$${(a/1e6).toFixed(a>=1e7?1:2)}M`:a>=1e3?`${s}$${Math.round(a/1e3)}K`:`${s}$${Math.round(a)}`;};
const dollars=n=>n>=1e6?money(n):`$${Math.round(n).toLocaleString('en-US')}`;
const titleCase=n=>String(n||'').replace(/\s*\((a\.?k\.?a\.?|also known as)\b[^)]*\)/ig,'').toLowerCase().replace(/(^|[\s(/&'-])([a-z])/g,(x,a,b)=>a+b.toUpperCase()).replace(/\b(Pac|Llc|Inc|Usa|Us|Ai|Ibm|Bae|Rtx|Ge)\b/g,w=>w.toUpperCase());
const STATE={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
// "S-MI" -> "Michigan Senate", "H-TX-09" -> "TX-9".
export const seatLabel=seat=>{const [o,st,d]=String(seat||'').split('-');return o==='S'?`${STATE[st]||st} Senate`:o==='H'?`${st}-${Number(d)||'AL'}`:'';};

// Races: a call (within the page's 45 days of its result's date, else the results' "asof"); a race still counting for
// as long as it's counting (and the results are under TICKER.countingDays old). A results-only race names its nominees
// from their profiles when they have one, else as the race lists them. href: the profile: the one a results-only
// nominee names, the person's own, or (a House member known by FEC ID) the one with that FEC ID; the Races page without one.
export function raceItems(research,{now=Date.now(),people,days=TICKER.pageDays}={}){
  const asof=research?.election?.asof||research?.election?.date;if(!withinDays(asof,TICKER.countingDays,now))return [];
  const out=[];
  for(const r of [...(research?.races||[]),...(research?.liteRaces||[])]){
    const res=r?.result;if(!res)continue;
    const date=res.date||asof,n=k=>r.nominees?.find(x=>(x.id||x.fecCand)===k);
    const profile=k=>{const x=n(k);if(x?.profile&&people?.get?.(x.profile))return x.profile;if(people?.get?.(k))return k;return [...(people?.values?.()||[])].find(p=>p?.fecCand===k)?.id||null;};
    const who=k=>{const id=profile(k);if(id)return nameOf(id,people);const x=n(k);return x?{name:String(x.name||'').split(/\s+/).pop(),party:x.party||null}:null;};
    const link=k=>{const id=profile(k);return id?`#${id}`:'#races';};
    // The card's rows: the top shares, and the next candidate with at least 1% when there's room for three.
    const tally=res.tally||{},rows=Object.entries(tally.shares||{}).sort((a,b)=>b[1]-a[1]).map(([k,pct])=>{const w=who(k);return w&&Number.isFinite(pct)?{...w,pct}:null;}).filter(Boolean);
    for(const o of tally.others||[])if(rows.length<3&&Number.isFinite(o.pct)&&o.pct>=1)rows.push({name:String(o.name||'').split(/\s+/).pop(),party:o.party||null,pct:o.pct});
    const race={label:r.label,rows,src:String(tally.src?.t||res.src?.t||'').split(',')[0]};
    if(res.winner){
      if(!isFresh(date,now,days))continue;
      const w=who(res.winner);if(!w)continue;
      const how=String(res.how||'').trim();
      out.push({key:`race:${r.id}`,kind:'call',tag:'Race called',date,order:r.competitive?1:2,href:link(res.winner),race,
        parts:[`${r.label}: `,w,' wins',...(how&&how.length<=70?[` · ${lowerFirst(how)}`]:[])]});
    }else if(res.leader){
      const l=who(res.leader);if(!l)continue;
      const other=(r.keys||r.nominees?.map(x=>x.id||x.fecCand)||[]).find(k=>k!==res.leader),o=other&&who(other),by=/by ([\d,]+) votes/.exec(res.how||'')?.[1];
      out.push({key:`race:${r.id}`,kind:'warn',tag:'Still counting',date,order:0,pinned:true,href:link(res.leader),race,
        parts:[`${r.label}: `,l,' leads',...(o?[' ',o]:[]),...(by?[` by ${by} votes`]:[])]});
    }
  }
  return out;
}
// Site updates: the presentation log's entries that carry a headline (one picked for the ticker; older entries, about
// grades since replaced, have none). Rule changes stay in the log and on the methodology page only.
export function siteItems(entries,{now=Date.now(),days=TICKER.pageDays}={}){
  return (entries||[]).filter(e=>e?.headline&&!/^Rule change/i.test(e.note||'')&&isFresh(e.date,now,days)).map((e,i)=>({key:`log:${e.date}:${i}`,
    kind:'site',tag:'Site update',date:e.date,order:3,href:'#method',parts:[e.headline]}));
}
// The interest-group ratings: how many groups were read and how many profiles they rate.
export function ratingItems(ratings,{now=Date.now(),days=TICKER.pageDays}={}){
  if(!ratings||!isFresh(ratings.checked,now,days))return [];
  const groups=Object.values(ratings.groups||{}).filter(g=>g?.read).length,profiles=Object.keys(ratings.people||{}).length;
  return groups?[{key:'ratings',kind:'new',tag:'Ratings',date:ratings.checked,order:3,href:'#method',
    parts:[`Interest-group ratings read: ${groups} groups · ${profiles} profiles rated`]}]:[];
}
// From the refresh (/api/ticker): newly reported stock trades (with how late they were filed: over 45 days after the
// trade) and annual disclosures (with the net worth range they give, and the year before's), placed by when the refresh
// first read them ("seen"; a record on a check's first list goes by its own date). Each shows the date it was reported.
const WHAT={purchase:'a purchase',sale:'a sale',exchange:'an exchange'};
const range=r=>`${money(r[0])}–${money(r[1])}`;
// "$1,001 - $15,000" -> "$1K–$15K"; a company without a ticker, in a few words.
const short$=n=>n>=1e6?`$${+(n/1e6).toFixed(1)}M`:n>=1e3?`$${Math.round(n/1e3)}K`:`$${n}`;
export const amountShort=a=>String(a||'').replace(/\$([\d,]+)/g,(m,n)=>short$(Number(n.replace(/,/g,'')))).replace(/\s*-\s*/,'–');
export const assetShort=a=>String(a||'').replace(/\b(common stock|class [a-z]|inc|corp|corporation|co|plc|ltd|holdings?|the)\b\.?/gi,'').replace(/[,.]+/g,' ').replace(/\s+/g,' ').trim().slice(0,22);
const DIR={purchase:'buy',sale:'sell'};
export function liveItems(live,{now=Date.now(),people,days=TICKER.pageDays}={}){
  const out=[];
  for(const x of live?.items||[]){
    const who=nameOf(x.subject,people);if(!who)continue;
    if(x.kind==='trade'&&isFresh(x.seen||x.disclosed,now,days)){
      const gap=x.traded&&x.disclosed?Math.round((t(x.disclosed)-t(x.traded))/DAY):null,late=gap!=null&&gap>TICKER.lateDays?gap-TICKER.lateDays:0;
      out.push({key:`trade:${x.subject}:${x.id||x.disclosed}`,kind:'trade',tag:'Stock trade',date:x.disclosed,at:x.seen||null,order:2,href:`#${x.subject}-unbought`,id:x.subject,
        trade:{dir:DIR[x.type]||'other',sym:x.ticker||assetShort(x.asset)||'Stock',amount:amountShort(x.amount),late,owner:x.owner&&!/^self$/i.test(x.owner)?String(x.owner).toLowerCase():null},
        parts:[who,` reported ${WHAT[x.type]||'a trade'}${x.amount?` of ${String(x.amount).replace(/\s*-\s*/,'–')}`:''}${x.ticker||x.asset?` in ${x.ticker||String(x.asset).slice(0,48)}`:''}${x.owner&&!/^self$/i.test(x.owner)?` (${x.owner})`:''}${late?` · filed ${late} day${late===1?'':'s'} late`:''}`]});
    }else if(x.kind==='filing'&&isFresh(x.seen||x.filed,now,days)){
      const worth=Array.isArray(x.worth)?x.worth:null,was=Array.isArray(x.was)?x.was:null;
      const dir=worth&&was?((worth[0]+worth[1])>(was[0]+was[1])?'up from':(worth[0]+worth[1])<(was[0]+was[1])?'down from':'the same as'):'';
      out.push({key:`filing:${x.subject}:${x.year}`,kind:'filing',tag:worth?'Net worth':'Disclosure',date:x.filed,at:x.seen||null,order:2,href:`#${x.subject}-unbought`,id:x.subject,
        w:{worth,was,wasYear:x.wasYear||null,year:x.year??null},
        parts:[who,worth?` filed their ${x.year?`${x.year} `:''}annual report: net worth ${range(worth)}${was?`, ${dir} ${range(was)}${x.wasYear?` in ${x.wasYear}`:''}`:''}`
          :` filed their ${x.year?`${x.year} `:''}annual financial disclosure`]});
    }
  }
  return out;
}
// From the news build (public/news.json, scripts/build-news.mjs): grade changes, reviewed promise verdicts, the
// trackers' PAC checks and their super PACs' spending.
const GRADE_NAME={word:'Keeps Their Word',showsup:'Shows Up',peoplefirst:'People First'};
const VERDICT={kept:'kept',partly:'partially kept',broken:'broken',alleged:'allegedly broken'};
// A promise's topic in a few words (the question it's checked against, public/questions.json), so the line stays short:
// "Cory Booker (D): drug decriminalization promise (Apr 2021), partially kept". A topic not listed reads from its id.
export const PROMISE_TOPIC={'affordable-care-act':'Affordable Care Act','pre-existing-conditions':'pre-existing conditions',
  'end-filibuster':'filibuster','stay-in-nato':'NATO','support-israel':'Israel','gun-purchase-limits':'gun buying','war-with-iran':'Iran war',
  'climate-regulations':'climate rules','disposables-ban':'disposable plastics','transit-spending':'public transit','contraception':'birth control',
  'planned-parenthood':'Planned Parenthood','block-mega-mergers':'mega-merger','military-equipment-police':'police military gear',
  'release-nonviolent':'prisoner release','work-amnesty':'immigrant work status','paris-agreement':'Paris climate agreement','encryption-backdoor':'encryption',
  'police-funding-shift':'police funding','decriminalize-drugs':'drug decriminalization','ukraine-aid':'Ukraine aid','medicaid-funding':'Medicaid funding',
  'congress-stock-trading':'congressional stock trading','chips-industry':'chip manufacturing','ev-support':'electric vehicle','court-reform':'Supreme Court reform',
  'fund-who':'WHO funding','rent-algorithms':'rent-pricing software','tax-the-rich':'taxes on the wealthy','voter-id':'voter ID','abolish-ice':'ICE',
  'ai-regulation':'AI regulation','single-payer':'single-payer health care','cut-spending-debt':'spending cuts','homeless-funding':'homeless services',
  'end-dei-hiring':'DEI hiring','local-police-ice':'local police and ICE','deport-serious-crime':'deportation','crypto-regulation':'crypto regulation',
  'military-vs-cartels':'cartels'};
export const promiseTopic=id=>PROMISE_TOPIC[id]||String(id||'').replace(/-/g,' ');
const spName=n=>/^UNITED DEMOCRACY PROJECT/i.test(n||'')?'United Democracy Project':titleCase(n);
// A PAC's name, short: the name in its parentheses when that's a PAC's ("GE Aerospace PAC"), else without the filler.
export const pacShort=n=>{const m=/\(([^)]*\bpac\b[^)]*)\)/i.exec(n||'');if(m)return titleCase(m[1]);
  return titleCase(String(n||'').replace(/\([^)]*\)/g,'')).replace(/^The /,'').replace(/Political Action Committee/i,'PAC').replace(/\b(Company|Employees?|LLC|Inc|Corporation)\b\.?/g,'').replace(/\s+/g,' ').trim();};
// A list of people: "A (D), B (R) and C (D)", at most `max` named.
function peopleList(ids,people,max=4){
  const named=ids.map(id=>nameOf(id,people)).filter(Boolean),shown=named.slice(0,max),more=named.length-shown.length,out=[];
  shown.forEach((p,i)=>{if(i)out.push(i===shown.length-1&&!more?' and ':', ');out.push(p);});
  if(more)out.push(` and ${more} more`);
  return {parts:out,n:named.length};
}
export function newsItems(news,{now=Date.now(),people,days=TICKER.pageDays}={}){
  const out=[];
  for(const x of news?.items||[]){
    const at=x.seen||null;if(!isFresh(at||x.date,now,days))continue;
    if(x.kind==='grade'){
      const who=nameOf(x.id,people),name=GRADE_NAME[x.grade];if(!who||!name)continue;
      const parts=x.to==null?[who,` ${name}: no longer graded (${x.why})`]
        :x.from==null?[who,` ${name}: `,{grade:x.toLetter},` (${x.to}%), ${x.why}`]
        :[who,` ${name} `,{grade:x.fromLetter},' → ',{grade:x.toLetter},` (${x.from}% → ${x.to}%): ${x.why}`];
      out.push({key:x.key,kind:'grade',tag:x.from==null&&x.to!=null?'Newly graded':'Grade change',date:x.date,at,order:2,href:`#${x.id}-${x.grade}`,parts,id:x.id,
        g:{score:name,from:x.from,to:x.to,fromLetter:x.fromLetter||null,toLetter:x.toLetter||null,why:x.why||''}});
    }else if(x.kind==='promise'){
      const who=nameOf(x.id,people);if(!who||!VERDICT[x.status])continue;
      // Its topic and its own month and year (so two promises on one topic read apart), never its words.
      const m=/@(\d{4})-(\d{2})/.exec(x.promise||''),when=m?` (${MONTHS[Number(m[2])-1]} ${m[1]})`:'',topic=promiseTopic(x.topic||String(x.promise||'').split('@')[0]);
      out.push({key:x.key,kind:'promise',tag:'Promise check',date:x.date,at,order:2,href:`#${x.id}-word`,parts:[who,`: ${topic?`${topic} promise`:'a promise'}${when}, ${VERDICT[x.status]}`],id:x.id,
        p:{verdict:x.status,what:`${topic?`${topic[0].toUpperCase()}${topic.slice(1)} promise`:'A promise'}${when}`}});
    }else if(x.kind==='lobby'){
      const T=TRACKER[x.tracker],list=peopleList(x.ids||[],people);if(!T||!list.n)continue;
      out.push({key:x.key,kind:'lobby',tag:'Lobby money',date:x.date,at,order:2,href:list.n===1?`#${x.ids.find(id=>nameOf(id,people))}-unbought`:`#trackers-${x.tracker}`,
        l:{pac:pacShort(x.pac),amount:x.amount,ids:(x.ids||[]).filter(id=>nameOf(id,people)),tracker:T.name},
        parts:[`${T.name} ${T.emoji} · ${titleCase(x.pac)} gave ${dollars(x.amount)}${list.n>1?' each':''} to `,...list.parts]});
    }else if(x.kind==='superpac'){
      const T=TRACKER[x.tracker];if(!T)continue;
      const p=byFec(people,x.cand),who=p?nameOf(p.id,people):{name:titleCase(String(x.name||'').split(',')[0]),party:x.party||null};
      out.push({key:x.key,kind:'superpac',tag:'Super PAC',date:x.date,at,order:2,href:p?`#${p.id}-unbought`:'#superpacs',id:p?.id||null,
        s:{spender:spName(x.spender),so:x.so,amount:x.amount,seat:seatLabel(x.seat),who,tracker:T.name},
        parts:[`${T.name} ${T.emoji} · ${spName(x.spender)} spent ${dollars(x.amount)} ${x.so==='O'?'against':'for'} `,who,`${seatLabel(x.seat)?`, ${seatLabel(x.seat)}`:''}`]});
    }
  }
  return out;
}
// The campaign reports read (research.json "camp"): one item a report date, with how many campaigns and who raised most.
export function fecItems(research,{now=Date.now(),people,days=TICKER.pageDays}={}){
  const by=new Map();
  for(const p of [...(research?.members||[]),...(research?.cands||[])]){const e=p?.camp?.end;if(!e||p.camp.missing||!isFresh(e,now,days))continue;(by.get(e)||by.set(e,[]).get(e)).push(p);}
  return [...by].map(([end,list])=>{
    const top=list.slice().sort((a,b)=>(b.camp.receipts||0)-(a.camp.receipts||0))[0],who=nameOf(top.id,people)||{name:top.short||top.name,party:top.party};
    return {key:`fec:${end}`,kind:'fec',tag:'FEC reports',date:end,order:3,href:'#rankings',id:top.id,f:{receipts:top.camp.receipts||0,cash:top.camp.cash??null,n:list.length},
      parts:[`Reports through ${shortDate(end)} read for ${list.length} campaign${list.length===1?'':'s'} · most raised: `,who,` ${money(top.camp.receipts||0)} this cycle`]};
  });
}
// Legal cases dated in the page's 45 days (research.json "ethics": a full date and a status that counts), with what each
// costs in Legal Trouble (status × kind; a case this new is never discounted for age).
const LEGAL_LABEL={finding:'Confirmed finding',open:'Open investigation',closed:'Closed without a finding',allegation:'Allegation'};
export function legalItems(research,{now=Date.now(),people,days=TICKER.pageDays}={}){
  const out=[];
  for(const p of [...(research?.members||[]),...(research?.cands||[]),...(research?.featured||[])])for(const e of p?.ethics||[]){
    if(e?.outcome==='None found'||!/^\d{4}-\d{2}-\d{2}$/.test(e?.date||'')||!isFresh(e.date,now,days))continue;
    const st=e.status==='finding'?'finding':e.status==='investigation'?(e.stage==='open'?'open':'closed'):e.status==='allegation'?'allegation':null;if(!st)continue;
    const who=nameOf(p.id,people)||{name:p.short||p.name,party:p.party||null},points=ETHICS_COST[st]*(CASE_KIND[e.kind]??1);
    out.push({key:`legal:${p.id}:${e.date}:${String(e.title||'').slice(0,40)}`,kind:'legal',tag:'Legal',date:e.date,order:2,href:`#${p.id}-aboveboard`,id:p.id,
      e:{title:e.title,status:LEGAL_LABEL[st],points},parts:[who,`: ${e.title} (${LEGAL_LABEL[st].toLowerCase()}, ${points} point${points===1?'':'s'} in Legal Trouble)`]});
  }
  return out;
}
// Everything in the page's 45 days, newest first by when it reached the site (ties: still counting, then the closest
// races, then the rest), each once.
export function allItems({research,log,ratings,live,news,people},{now=Date.now(),days=TICKER.pageDays}={}){
  const all=[...raceItems(research,{now,people,days}),...liveItems(live,{now,people,days}),...newsItems(news,{now,people,days}),
    ...fecItems(research,{now,people,days}),...legalItems(research,{now,people,days}),...ratingItems(ratings,{now,days}),...siteItems(log,{now,days})];
  const seen=new Set();
  return all.filter(x=>!seen.has(x.key)&&seen.add(x.key)).sort((a,b)=>atOf(b)-atOf(a)||a.order-b.order);
}
// Each kind in turn (the kind with the newest item first), so one kind can't fill the strip.
export function mixKinds(items){
  const by=new Map();for(const x of items){const g=groupOf(x);(by.get(g)||by.set(g,[]).get(g)).push(x);}
  const queues=[...by.values()],out=[];
  while(queues.some(q=>q.length))for(const q of queues)if(q.length)out.push(q.shift());
  return out;
}
const part=p=>typeof p==='string'?esc(p):p.grade?`<b class="gr-${esc(p.grade)}">${esc(p.grade)}</b>`
  :`<b class="tk-${p.party==='D'?'d':p.party==='R'?'r':'i'}">${esc(p.name)}${p.party?` (${esc(p.party)})`:''}</b>`;
const tagHTML=x=>`<span class="tk-tag tk-${esc(x.kind)}"><span aria-hidden="true">${KIND[x.kind]?.[0]||''}</span>${esc(x.tag)}</span>`;
// The refresh's newest records, shared by the strip, the cards and the page; each draws again when they arrive.
const latest={live:null,group:''},onLive=new Set();
const fetchTicker=()=>fetch('/api/ticker').then(r=>r.ok?r.json():null);
const gotLive=j=>{if(!j)return;latest.live=j;for(const f of onLive)f();};
const sideOf=p=>p?.party==='D'?'d':p?.party==='R'?'r':'i';
// "D-NY": party and state, from the profiles and directories.
const where=(id,people)=>{const p=people?.get?.(id);return p?[p.party,p.state].filter(Boolean).join('-'):'';};
const whoHTML=(id,people)=>{const p=nameOf(id,people);if(!p)return '';const w=where(id,people);return `<span class="tk-${sideOf(p)}">${esc(p.name)}${w?` (${esc(w)})`:''}</span>`;};

// ---------- The strip: TRADES and PAC MONEY ----------
// The newest stock trades and PAC checks in the page's 45 days, newest first by when they reached the site.
export function stripData(all,{trades=TICKER.trades,pac=TICKER.pac}={}){
  const newest=(a,b)=>atOf(b)-atOf(a);
  return {trades:all.filter(x=>x.kind==='trade'&&x.trade).sort(newest).slice(0,trades),pac:all.filter(x=>x.kind==='lobby'&&x.l?.ids?.length).sort(newest).slice(0,pac)};
}
const ARROW={buy:['▲','Bought'],sell:['▼','Sold'],other:['◆','Exchanged']};
const tradeHTML=(x,people)=>{const t=x.trade,[arrow,did]=ARROW[t.dir]||ARROW.other,p=nameOf(x.id,people);
  return `<a class="tk-item" href="${esc(x.href)}" title="${esc(`${p?.name||''}: ${did.toLowerCase()} ${t.sym}, ${t.amount}, reported ${shortDate(x.date)}`)}"><span class="tk-arrow tk-${esc(t.dir)}" aria-label="${did}">${arrow}</span><b class="tk-sym">${esc(t.sym)}</b>${whoHTML(x.id,people)}<span class="tk-amt">${esc(t.amount)}</span>${t.owner?`<span class="tk-own">${esc(t.owner)}</span>`:''}${t.late?`<span class="tk-late">${t.late} day${t.late===1?'':'s'} late</span>`:''}</a>`;};
const pacHTML=(x,people)=>{const l=x.l,more=l.ids.length-1;
  return `<a class="tk-item" href="${esc(x.href)}"><span class="tk-pac">${esc(l.pac)}</span><span class="tk-to" aria-label="to">→</span>${whoHTML(l.ids[0],people)}${more?`<span class="tk-more">+${more} more</span>`:''}<span class="tk-amt">${esc(money(l.amount))}${more?' each':''}</span></a>`;};
// The strip's markup: each part with its label, the parts twice over (the second copy hidden from screen readers, for a
// seamless loop), and a link to the Latest updates page. The loop's length sets its speed, so it reads at the same pace
// however many items there are.
export function stripHTML({trades=[],pac=[]}={},{people}={}){
  if(!trades.length&&!pac.length)return '';
  const seg=(label,cls,list,fn)=>list.length?`<span class="tk-label ${cls}"><i class="tk-dot" aria-hidden="true"></i><span>${label}</span></span>${list.map(x=>fn(x,people)).join('')}`:'';
  const one=seg('Trades','tk-l-trades',trades,tradeHTML)+seg('PAC money','tk-l-pac',pac,pacHTML);
  // About 5.5 characters a second (slowed from 6 on Nov. 14, 2026: each item stays on screen about 0.7 seconds longer).
  const seconds=Math.max(33,Math.round(one.replace(/<[^>]+>/g,'').length/5.5));
  return `<div class="tk-view"><div class="tk-track" style="--tk-time:${seconds}s"><div class="tk-set">${one}</div><div class="tk-set" aria-hidden="true">${one.replace(/<a /g,'<a tabindex="-1" ')}</div></div></div><a class="tk-all" href="#latest">All updates <span aria-hidden="true">→</span></a>`;
}
// Fills the strip (host: the ticker's element) from what the page has loaded, then again whenever the refresh's newest
// records are read (at once, then every few minutes). The refresh being offline only leaves its trades out.
export function mountTicker(host,{research,log,ratings,people,news=null,fetchLive=fetchTicker}={}){
  if(!host)return;
  const draw=()=>{const html=stripHTML(stripData(allItems({research,log,ratings,live:latest.live,news,people})),{people});if(host.dataset.drawn===html)return;host.dataset.drawn=html;host.innerHTML=html;host.hidden=!html;};
  draw();onLive.add(draw);
  const poll=async()=>{try{gotLive(await fetchLive());}catch{}};
  poll();const every=setInterval(poll,TICKER.liveEvery);every?.unref?.();
  return {redraw:draw};
}

// ---------- The Latest updates cards (home page) ----------
const CARD_KINDS=new Set(['call','warn','grade','promise','legal','lobby','superpac','fec','filing']);
// Races still counting first, then the newest of each kind in turn, so one kind can't fill the row; at most `limit`.
export function cardItems(all,{limit=TICKER.cards}={}){
  const list=all.filter(x=>CARD_KINDS.has(x.kind)),pinned=list.filter(x=>x.pinned);
  return [...pinned,...mixKinds(list.filter(x=>!x.pinned))].slice(0,limit);
}
const CARD_NAME={call:'Race · called',warn:'Race · still counting',grade:'Grade',promise:'Promise checked',legal:'Legal',lobby:'PAC check',superpac:'Super PAC',fec:'FEC report',filing:'Net worth'};
const chamberOf=p=>p?.office?'President':p?.chamber==='H'?'House':p?.chamber==='S'?'Senate':p?.class!=null?'Senate':p?.district!=null?'House':'';
const initials=n=>String(n||'').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
// A person: their portrait (initials without one), full name, and party · state · chamber.
function personHTML(id,people,portraits){
  const p=people?.get?.(id)||{},file=portraits?.[id]?.file,name=p.name||id;
  return `<div class="upd-p">${file?`<img src="/${esc(file)}" alt="" width="36" height="42" loading="lazy" decoding="async">`:`<span class="upd-ini upd-${sideOf(p)}" aria-hidden="true">${esc(initials(name))}</span>`}<div><div class="upd-nm">${esc(name)}</div><div class="upd-sub">${esc([p.party,p.state,chamberOf(p)].filter(Boolean).join(' · '))}</div></div></div>`;
}
const VERDICT_CHIP={kept:['Kept','good'],partly:['Partly kept','warn'],broken:['Broken','crit'],alleged:['Allegedly broken','crit']};
const CARD={
  race:x=>{const r=x.race;return `<div class="upd-t">${esc(r.label)}</div>${r.rows.length?r.rows.map(w=>`<div class="upd-rr"><span>${esc(w.name)} <span class="tk-${sideOf(w)}">${esc(w.party||'')}</span></span><b>${w.pct.toFixed(1)}%</b></div><div class="upd-bar upd-${sideOf(w)}" style="width:${Math.max(2,Math.min(100,w.pct))}%"></div>`).join(''):`<div>${x.parts.map(part).join('')}</div>`}<div class="upd-src">${esc(r.src)}</div>`;},
  grade:(x,people,portraits)=>{const g=x.g;return `${personHTML(x.id,people,portraits)}<div>${esc(g.score)}</div><div class="upd-big">${g.to==null?'<span class="upd-lbl">No longer graded</span>':`${g.from!=null&&g.fromLetter?`<b class="gr-${esc(g.fromLetter)}">${esc(g.fromLetter)}</b> <span class="upd-arrow">→</span> `:'<span class="upd-lbl">Newly graded </span>'}<b class="gr-${esc(g.toLetter)}">${esc(g.toLetter)}</b> <small>${g.to}%</small>`}</div><div class="upd-src">${esc(g.why)}</div>`;},
  promise:(x,people,portraits)=>{const [label,tone]=VERDICT_CHIP[x.p.verdict]||[x.p.verdict,'neutral'];return `${personHTML(x.id,people,portraits)}<div><span class="upd-chip upd-${tone}">${esc(label)}</span></div><div class="upd-clamp">${esc(x.p.what)}</div>`;},
  legal:(x,people,portraits)=>`${personHTML(x.id,people,portraits)}<div><span class="upd-chip upd-${x.e.points?'serious':'neutral'}">${esc(x.e.status)} · ${x.e.points} pt${x.e.points===1?'':'s'}</span></div><div class="upd-clamp upd-small">${esc(x.e.title)}</div>`,
  lobby:(x,people)=>{const l=x.l,more=l.ids.length-1,p=people?.get?.(l.ids[0]);return `<div class="upd-t">${esc(l.pac)}</div><div>→ <b>${esc(p?.name||'')}</b>${where(l.ids[0],people)?` <span class="tk-${sideOf(p)}">(${esc(where(l.ids[0],people))})</span>`:''}${more?` and ${more} more`:''}</div><div class="upd-big">${esc(money(l.amount))}${more?' <small>each</small>':''}</div><div class="upd-src">${esc(l.tracker)} tracker · FEC</div>`;},
  superpac:(x,people)=>{const s=x.s,p=x.id&&people?.get?.(x.id);return `<div class="upd-t">${esc(s.spender)}</div><div><span class="${s.so==='O'?'upd-against':'upd-for'}">${s.so==='O'?'against':'for'}</span> <b>${esc(p?.name||s.who?.name||'')}</b> <span class="tk-${sideOf(p||s.who)}">(${esc((p||s.who)?.party||'')})</span></div><div class="upd-big">${esc(money(s.amount))}</div><div class="upd-src">${esc([s.seat,`${s.tracker} tracker`].filter(Boolean).join(' · '))} · FEC 24/48-hour report</div>`;},
  fec:(x,people,portraits)=>`${personHTML(x.id,people,portraits)}<div class="upd-rr"><span>Raised this cycle</span><b>${esc(money(x.f.receipts))}</b></div>${x.f.cash!=null?`<div class="upd-rr"><span>Cash on hand</span><b>${esc(money(x.f.cash))}</b></div>`:''}<div class="upd-src">Most raised of ${x.f.n} campaign report${x.f.n===1?'':'s'} through ${esc(shortDate(x.date))}</div>`,
  filing:(x,people,portraits)=>{const w=x.w;if(!w.worth)return `${personHTML(x.id,people,portraits)}<div>${x.parts.slice(1).map(part).join('')}</div>`;
    const mid=r=>(r[0]+r[1])/2,dir=w.was?(mid(w.worth)>mid(w.was)?'up':mid(w.worth)<mid(w.was)?'down':'same'):null;
    return `${personHTML(x.id,people,portraits)}<div>${w.year?`${esc(w.year)} annual report`:'Annual report'}</div><div class="upd-big upd-range">${esc(range(w.worth))}</div><div class="upd-src">${w.was?`${dir==='up'?'Up from':dir==='down'?'Down from':'Same as'} ${esc(range(w.was))}${w.wasYear?` in ${esc(w.wasYear)}`:''}`:'Net worth range as reported'}</div>`;},
};
const cardKind=x=>x.kind==='call'||x.kind==='warn'?'race':x.kind;
export function cardHTML(x,{people,portraits}={}){
  const body=CARD[cardKind(x)]?.(x,people,portraits);if(!body)return '';
  const when=x.kind==='fec'?`through ${shortDate(x.date)}`:shortDate(x.date);
  return `<a class="upd-card upd-${esc(cardKind(x))}" href="${esc(x.href)}"><div class="upd-k"><span aria-hidden="true">${KIND[x.kind]?.[0]||''}</span> ${esc(CARD_NAME[x.kind]||x.tag)}${when?` · ${esc(when)}`:''}</div>${body}</a>`;
}
// The row: its heading, a link to the Latest updates page, and arrows that scroll it.
export function cardsHTML(items,{people,portraits}={}){
  const cards=items.map(x=>cardHTML(x,{people,portraits})).filter(Boolean);if(!cards.length)return '';
  return `<div class="upd-head"><h2 id="upd-h">Latest updates</h2><a class="upd-all" href="#latest">All updates <span aria-hidden="true">↗</span></a><button type="button" class="upd-arr" data-dir="-1" aria-label="Scroll back">←</button><button type="button" class="upd-arr" data-dir="1" aria-label="Scroll on">→</button></div><div class="upd-row" role="list" aria-labelledby="upd-h">${cards.map(c=>c.replace('<a class="upd-card','<a role="listitem" class="upd-card')).join('')}</div>`;
}
// Fills the home page's card row (host), and again when the refresh's records arrive; hidden when there's nothing.
let cardsDraw=null;
export function mountCards(host,{research,log,ratings,people,news=null,portraits=globalThis.PORTRAITS||{},fetchLive=fetchTicker}={}){
  if(!host)return;
  const draw=()=>{const html=cardsHTML(cardItems(allItems({research,log,ratings,live:latest.live,news,people})),{people,portraits});if(host.dataset.drawn===html)return;host.dataset.drawn=html;host.innerHTML=html;host.hidden=!html;};
  host.addEventListener('click',e=>{const b=e.target.closest('.upd-arr');if(!b)return;const row=host.querySelector('.upd-row');row?.scrollBy?.({left:Number(b.dataset.dir)*Math.max(240,row.clientWidth*0.8),behavior:'smooth'});});
  if(cardsDraw)onLive.delete(cardsDraw);cardsDraw=draw;onLive.add(draw);
  draw();
  if(!latest.live)fetchLive().then(gotLive).catch(()=>{});
  return {redraw:draw};
}

// ---------- The Latest updates page (#latest) ----------
const dayLabel=(ms,now)=>{const d=new Date(ms).toISOString().slice(0,10),today=new Date(now).toISOString().slice(0,10),yest=new Date(now-DAY).toISOString().slice(0,10);
  return `${d===today?'Today, ':d===yest?'Yesterday, ':''}${shortDate(d)}`;};
// The page's list: still counting first, then each day's items, newest day first; group: the filter picked ('' for all).
export function latestHTML(items,{group='',now=Date.now()}={}){
  const counts=Object.fromEntries(GROUPS.map(([g])=>[g,items.filter(x=>groupOf(x)===g).length]));
  const chips=`<div class="lu-chips" role="group" aria-label="Show">${[['','','All',items.length],...GROUPS.filter(([g])=>counts[g]).map(([g,e,l])=>[g,e,l,counts[g]])].map(([g,e,l,n])=>
    `<button type="button" class="lu-chip${g===group?' on':''}" data-group="${g}" aria-pressed="${g===group}">${e?`<span aria-hidden="true">${e}</span> `:''}${esc(l)}<small>${n}</small></button>`).join('')}</div>`;
  const shown=items.filter(x=>!group||groupOf(x)===group),pinned=shown.filter(x=>x.pinned),days=new Map();
  for(const x of shown.filter(x=>!x.pinned)){const k=new Date(atOf(x)).toISOString().slice(0,10);(days.get(k)||days.set(k,[]).get(k)).push(x);}
  const row=x=>`<a class="lu-row" href="${esc(x.href)}">${tagHTML(x)}<span class="lu-t">${x.parts.map(part).join('')}</span><span class="lu-d">${esc(shortDate(x.date))}</span></a>`;
  const body=[pinned.length?`<h2 class="lu-day">Still counting</h2>${pinned.map(row).join('')}`:'',
    ...[...days].map(([d,list])=>`<h2 class="lu-day">${esc(dayLabel(t(d),now))}</h2>${list.map(row).join('')}`)].join('');
  return `${chips}<div class="lu-list">${body||'<p class="muted">Nothing new in the last 45 days.</p>'}</div>`;
}
// Draws the page into host, from what the page has loaded and the refresh's newest records (read again if the strip
// hasn't yet).
export function renderLatest(host,data,{now=Date.now(),fetchLive=fetchTicker}={}){
  if(!host)return;
  host.innerHTML=`<section class="section lu" id="latest"><div class="kicker">Explore</div><h1>Latest updates</h1>
    <p class="lede">Everything new on the site in the last ${TICKER.pageDays} days, newest first, by when it reached the site. The strip under the top bar shows the newest stock trades and PAC checks, and the cards on the home page the newest of each other kind.</p>
    <div id="lu-body"></div>
    <p class="small muted lu-note">Stock trades and annual reports come from the refresh while it runs; grade changes, reviewed promises, the trackers' PAC checks and their super PACs' filings from the news build (npm run news:build, also run by npm run corporate:pacs and npm run promises:build); FEC reports from each profile's campaign money; legal cases from each profile's reviewed legal record. What the refresh has read: <a href="#updates">API updates</a> · <a href="#websites">Website updates</a>.</p></section>`;
  const body=host.querySelector('#lu-body');
  const draw=()=>{body.innerHTML=latestHTML(allItems({...data,live:latest.live},{now}),{group:latest.group,now});};
  body.addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){latest.group=b.dataset.group;draw();}});
  draw();
  if(!latest.live)fetchLive().then(j=>{if(j){gotLive(j);draw();}}).catch(()=>{});
}
