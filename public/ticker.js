// The ticker under the top bar, and the Latest updates page behind it (approved 2026-11-14): the site's news, newest
// first, each with a tag (its kind's emoji and name), its date and a link to where it changed.
//   races       a race called, or still counting (research.json "races" and "liteRaces")
//   grades      a grade that moved, someone newly graded (news.json, scripts/build-news.mjs)
//   promises    a reviewed promise verdict (news.json)
//   stock trades, net worth   newly reported trades (with how late they were filed) and annual disclosures (with their
//               net worth range, and the year before's), from the refresh (/api/ticker), dated by when it first read them
//   lobby money a tracker's PAC checks to sitting members (news.json, from the FEC bulk files)
//   super PACs  a tracker's own super PAC's spending for or against a candidate (news.json, from the FEC's filings)
//   FEC reports the campaign reports read (research.json "camp")
//   site        site updates (score-presentation-log.json headlines; not rule changes) and the interest-group ratings read
// The strip shows the last 7 days (filled to 6 items from older news when there are fewer), races still counting first,
// then each kind in turn so one kind can't fill it. The page shows the last 45 days by day, with a filter for each kind.
// Each item is placed by when it reached the site ("seen", else its own date). With nothing to show, the strip isn't
// shown. It scrolls slowly, stops while hovered or focused, and stands still for visitors whose device asks for reduced
// motion.
import {TRACKER} from './trackers.js';

export const TICKER={limit:16,days:7,fill:6,pageDays:45,countingDays:45,liveEvery:300000,lateDays:45};
const DAY=864e5,HOUR=36e5;
// A record's time in ms: a timestamp as given, a date alone at noon UTC that day.
const t=d=>{const x=String(d||'');return /T\d/.test(x)?Date.parse(x):Date.parse(x.slice(0,10)+'T12:00:00Z');};
// Within the last `days` days (a date alone counts from noon UTC that day; a date to come doesn't count).
export const isFresh=(d,now=Date.now(),days=TICKER.days)=>{const x=t(d);return Number.isFinite(x)&&x<=now+DAY/2&&now-x<=days*DAY;};
const withinDays=(d,days,now)=>{const x=t(d);return Number.isFinite(x)&&x<=now+DAY&&now-x<=days*DAY;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
// (only a sentence's own first word: "Called by the AP" -> "called by the AP", but never a name, as in "Susan Collins conceded")
const lowerFirst=s=>s&&/^(Called|Projected|Declared|Won|Leads|Conceded|Too)\b/.test(s)?s[0].toLowerCase()+s.slice(1):s;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const shortDate=d=>{const x=new Date(t(d));return Number.isFinite(x.getTime())?`${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}`:'';};
// When an item reached the site: when the refresh or the news build first read it, else its own date.
export const atOf=x=>t(x.at||x.date)||0;

// The kinds: each item's tag emoji, and the group its filter is under on the page.
export const KIND={call:['🗳️','race'],warn:['🗳️','race'],grade:['🎓','grade'],promise:['📝','promise'],trade:['📈','trade'],filing:['💵','finance'],
  lobby:['💰','lobby'],superpac:['📣','superpac'],fec:['🏦','fec'],site:['🛠️','site'],new:['📊','site']};
export const GROUPS=[['race','🗳️','Races'],['grade','🎓','Grades'],['promise','📝','Promises'],['trade','📈','Stock trades'],['finance','💵','Net worth'],
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
    if(res.winner){
      if(!isFresh(date,now,days))continue;
      const w=who(res.winner);if(!w)continue;
      const how=String(res.how||'').trim();
      out.push({key:`race:${r.id}`,kind:'call',tag:'Race called',date,order:r.competitive?1:2,href:link(res.winner),
        parts:[`${r.label}: `,w,' wins',...(how&&how.length<=70?[` · ${lowerFirst(how)}`]:[])]});
    }else if(res.leader){
      const l=who(res.leader);if(!l)continue;
      const other=(r.keys||r.nominees?.map(x=>x.id||x.fecCand)||[]).find(k=>k!==res.leader),o=other&&who(other),by=/by ([\d,]+) votes/.exec(res.how||'')?.[1];
      out.push({key:`race:${r.id}`,kind:'warn',tag:'Still counting',date,order:0,pinned:true,href:link(res.leader),
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
export function liveItems(live,{now=Date.now(),people,days=TICKER.pageDays}={}){
  const out=[];
  for(const x of live?.items||[]){
    const who=nameOf(x.subject,people);if(!who)continue;
    if(x.kind==='trade'&&isFresh(x.seen||x.disclosed,now,days)){
      const gap=x.traded&&x.disclosed?Math.round((t(x.disclosed)-t(x.traded))/DAY):null,late=gap!=null&&gap>TICKER.lateDays?gap-TICKER.lateDays:0;
      out.push({key:`trade:${x.subject}:${x.id||x.disclosed}`,kind:'trade',tag:'Stock trade',date:x.disclosed,at:x.seen||null,order:2,href:`#${x.subject}-unbought`,
        parts:[who,` reported ${WHAT[x.type]||'a trade'}${x.amount?` of ${String(x.amount).replace(/\s*-\s*/,'–')}`:''}${x.ticker||x.asset?` in ${x.ticker||String(x.asset).slice(0,48)}`:''}${x.owner&&!/^self$/i.test(x.owner)?` (${x.owner})`:''}${late?` · filed ${late} day${late===1?'':'s'} late`:''}`]});
    }else if(x.kind==='filing'&&isFresh(x.seen||x.filed,now,days)){
      const worth=Array.isArray(x.worth)?x.worth:null,was=Array.isArray(x.was)?x.was:null;
      const dir=worth&&was?((worth[0]+worth[1])>(was[0]+was[1])?'up from':(worth[0]+worth[1])<(was[0]+was[1])?'down from':'the same as'):'';
      out.push({key:`filing:${x.subject}:${x.year}`,kind:'filing',tag:worth?'Net worth':'Disclosure',date:x.filed,at:x.seen||null,order:2,href:`#${x.subject}-unbought`,
        parts:[who,worth?` filed their ${x.year?`${x.year} `:''}annual report: net worth ${range(worth)}${was?`, ${dir} ${range(was)}${x.wasYear?` in ${x.wasYear}`:''}`:''}`
          :` filed their ${x.year?`${x.year} `:''}annual financial disclosure`]});
    }
  }
  return out;
}
// From the news build (public/news.json, scripts/build-news.mjs): grade changes, reviewed promise verdicts, the
// trackers' PAC checks and their super PACs' spending.
const GRADE_NAME={word:'Keeps Their Word',showsup:'Shows Up',peoplefirst:'People First'};
const VERDICT={kept:'Kept',partly:'Partially kept',broken:'Broken',alleged:'Allegedly broken'};
const spName=n=>/^UNITED DEMOCRACY PROJECT/i.test(n||'')?'United Democracy Project':titleCase(n);
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
      out.push({key:x.key,kind:'grade',tag:x.from==null&&x.to!=null?'Newly graded':'Grade change',date:x.date,at,order:2,href:`#${x.id}-${x.grade}`,parts});
    }else if(x.kind==='promise'){
      const who=nameOf(x.id,people);if(!who||!VERDICT[x.status])continue;
      // (the promise's own month and year, so two promises that begin alike read apart)
      const m=/@(\d{4})-(\d{2})/.exec(x.promise||''),when=m?` (${MONTHS[Number(m[2])-1]} ${m[1]})`:'';
      out.push({key:x.key,kind:'promise',tag:'Promise check',date:x.date,at,order:2,href:`#${x.id}-word`,parts:[who,x.quote?` “${x.quote}”${when}: ${VERDICT[x.status]}`:`: a promise${when} ${VERDICT[x.status].toLowerCase()}`]});
    }else if(x.kind==='lobby'){
      const T=TRACKER[x.tracker],list=peopleList(x.ids||[],people);if(!T||!list.n)continue;
      out.push({key:x.key,kind:'lobby',tag:'Lobby money',date:x.date,at,order:2,href:list.n===1?`#${x.ids.find(id=>nameOf(id,people))}-unbought`:`#trackers-${x.tracker}`,
        parts:[`${T.name} ${T.emoji} · ${titleCase(x.pac)} gave ${dollars(x.amount)}${list.n>1?' each':''} to `,...list.parts]});
    }else if(x.kind==='superpac'){
      const T=TRACKER[x.tracker];if(!T)continue;
      const p=byFec(people,x.cand),who=p?nameOf(p.id,people):{name:titleCase(String(x.name||'').split(',')[0]),party:x.party||null};
      out.push({key:x.key,kind:'superpac',tag:'Super PAC',date:x.date,at,order:2,href:p?`#${p.id}-unbought`:'#superpacs',
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
    return {key:`fec:${end}`,kind:'fec',tag:'FEC reports',date:end,order:3,href:'#rankings',
      parts:[`Reports through ${shortDate(end)} read for ${list.length} campaign${list.length===1?'':'s'} · most raised: `,who,` ${money(top.camp.receipts||0)} this cycle`]};
  });
}
// Everything in the page's 45 days, newest first by when it reached the site (ties: still counting, then the closest
// races, then the rest), each once.
export function allItems({research,log,ratings,live,news,people},{now=Date.now(),days=TICKER.pageDays}={}){
  const all=[...raceItems(research,{now,people,days}),...liveItems(live,{now,people,days}),...newsItems(news,{now,people,days}),
    ...fecItems(research,{now,people,days}),...ratingItems(ratings,{now,days}),...siteItems(log,{now,days})];
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
// The strip: races still counting first, then the last 7 days (filled to TICKER.fill from older news), each kind in turn,
// at most `limit`.
export function tickerItems(data,{now=Date.now(),limit=TICKER.limit}={}){
  const all=allItems(data,{now}),pinned=all.filter(x=>x.pinned),rest=all.filter(x=>!x.pinned);
  const week=rest.filter(x=>now-atOf(x)<=TICKER.days*DAY),more=rest.filter(x=>!week.includes(x)).slice(0,Math.max(0,TICKER.fill-week.length));
  return [...pinned,...mixKinds([...week,...more])].slice(0,limit);
}
const part=p=>typeof p==='string'?esc(p):p.grade?`<b class="gr-${esc(p.grade)}">${esc(p.grade)}</b>`
  :`<b class="tk-${p.party==='D'?'d':p.party==='R'?'r':'i'}">${esc(p.name)}${p.party?` (${esc(p.party)})`:''}</b>`;
const tagHTML=x=>`<span class="tk-tag tk-${esc(x.kind)}"><span aria-hidden="true">${KIND[x.kind]?.[0]||''}</span>${esc(x.tag)}</span>`;
const itemHTML=x=>`<a class="tk-item" href="${esc(x.href)}">${tagHTML(x)}${x.date?`<span class="tk-date">${esc(shortDate(x.date))}</span>`:''}<span class="tk-t">${x.parts.map(part).join('')}</span></a><span class="tk-sep" aria-hidden="true">•</span>`;
const plain=p=>typeof p==='string'?p:p.grade||`${p.name} (X)`;
// The strip: its label, the items twice over (the second copy hidden from screen readers, for a seamless loop), and a link
// to the Latest updates page. The loop's length sets its speed, so it reads at the same pace however many items there are.
export function tickerHTML(items){
  if(!items.length)return '';
  const one=items.map(itemHTML).join(''),seconds=Math.max(30,Math.round(items.reduce((n,x)=>n+x.tag.length+x.parts.map(plain).join('').length+14,0)/7));
  return `<div class="wrap"><span class="tk-label"><i class="tk-dot" aria-hidden="true"></i><span>Latest · ${TICKER.days} days</span></span><div class="tk-view"><div class="tk-track" style="--tk-time:${seconds}s"><div class="tk-set">${one}</div><div class="tk-set" aria-hidden="true">${one.replace(/<a /g,'<a tabindex="-1" ')}</div></div></div><a class="tk-all" href="#latest">All updates <span aria-hidden="true">→</span></a></div>`;
}
const fetchTicker=()=>fetch('/api/ticker').then(r=>r.ok?r.json():null);
// Fills the strip (host: the ticker's element) from what the page has loaded, then again whenever the refresh's newest
// records are read (at once, then every few minutes). The refresh being offline only leaves its items out.
export function mountTicker(host,{research,log,ratings,people,news=null,fetchLive=fetchTicker}={}){
  if(!host)return;
  let live=null;
  const draw=()=>{const items=tickerItems({research,log,ratings,live,news,people});const html=tickerHTML(items);if(host.dataset.drawn===html)return;host.dataset.drawn=html;host.innerHTML=html;host.hidden=!html;};
  draw();
  const poll=async()=>{try{const j=await fetchLive();if(j){live=j;latest.live=j;draw();}}catch{}};
  poll();const every=setInterval(poll,TICKER.liveEvery);every?.unref?.();
  return {redraw:draw};
}

// ---------- The Latest updates page (#latest) ----------
const latest={live:null,group:''};
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
    <p class="lede">Everything new on the site in the last ${TICKER.pageDays} days, newest first, by when it reached the site. The strip under the top bar shows the last ${TICKER.days} days.</p>
    <div id="lu-body"></div>
    <p class="small muted lu-note">Stock trades and annual reports come from the refresh while it runs; grade changes, reviewed promises, the trackers' PAC checks and their super PACs' filings from the news build (npm run news:build, also run by npm run corporate:pacs and npm run promises:build); FEC reports from each profile's campaign money. What the refresh has read: <a href="#updates">API updates</a> · <a href="#websites">Website updates</a>.</p></section>`;
  const body=host.querySelector('#lu-body');
  const draw=()=>{body.innerHTML=latestHTML(allItems({...data,live:latest.live},{now}),{group:latest.group,now});};
  body.addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){latest.group=b.dataset.group;draw();}});
  draw();
  if(!latest.live)fetchLive().then(j=>{if(j){latest.live=j;draw();}}).catch(()=>{});
}
