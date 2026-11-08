// The ticker under the top bar: the latest updates the site keeps, newest first, each with a tag, its date when known and
// a link. Everything comes from records the site already has: race calls and counts (research.json "races", dated by
// the election results' "asof"), rule changes and site updates (score-presentation-log.json), the interest-group ratings
// (group-ratings.json "checked") and, from the refresh, newly reported stock trades and annual disclosures
// (/api/ticker). Each kind is shown for a set number of days, so the strip never runs stale; with nothing recent, it
// isn't shown at all. It scrolls slowly, stops while it's hovered or focused, and stands still for visitors whose device
// asks for reduced motion.
export const TICKER={limit:14,days:{race:45,trade:14,filing:30,rule:30,ratings:30},liveEvery:300000};
const DAY=864e5;
const t=d=>Date.parse(String(d||'').slice(0,10)+'T12:00:00Z');
const recent=(date,days,now)=>{const x=t(date);return Number.isFinite(x)&&x<=now+DAY&&now-x<=days*DAY;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const lowerFirst=s=>s?s[0].toLowerCase()+s.slice(1):s;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const shortDate=d=>{const x=new Date(t(d));return Number.isFinite(x.getTime())?`${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}`:'';};

// A person as the ticker names them: short name and party, from the profiles and directories.
export function nameOf(id,people){const p=people?.get?.(id);return p?{name:p.short||String(p.name||'').split(/\s+/).pop(),party:p.party||null}:null;}

// Races: one item a race the site follows, called or still counting, for a while after the election.
export function raceItems(research,{now=Date.now(),people}={}){
  const asof=research?.election?.asof||research?.election?.date;if(!recent(asof,TICKER.days.race,now))return [];
  const out=[];
  for(const r of research?.races||[]){
    const res=r?.result;if(!res)continue;
    if(res.winner){
      const w=nameOf(res.winner,people);if(!w)continue;
      const how=String(res.how||'').trim();
      out.push({key:`race:${r.id}`,kind:'call',tag:'Race called',date:asof,order:r.competitive?1:2,href:`#${res.winner}`,
        parts:[`${r.label}: `,w,' wins',...(how&&how.length<=70?[` · ${lowerFirst(how)}`]:[])]});
    }else if(res.leader){
      const l=nameOf(res.leader,people);if(!l)continue;
      const other=(r.keys||[]).find(k=>k!==res.leader),o=other&&nameOf(other,people),by=/by ([\d,]+) votes/.exec(res.how||'')?.[1];
      out.push({key:`race:${r.id}`,kind:'warn',tag:'Still counting',date:asof,order:0,href:`#${res.leader}`,
        parts:[`${r.label}: `,l,' leads',...(o?[' ',o]:[]),...(by?[` by ${by} votes`]:[])]});
    }
  }
  return out;
}
// Rule changes and site updates: the presentation log's entries that carry a headline (one picked for the ticker; older
// entries, about grades since replaced, have none), within a month.
export function ruleItems(entries,{now=Date.now()}={}){
  return (entries||[]).filter(e=>e?.headline&&recent(e.date,TICKER.days.rule,now)).map((e,i)=>({key:`log:${e.date}:${i}`,
    kind:/^Rule change/i.test(e.note||'')?'rule':'site',tag:/^Rule change/i.test(e.note||'')?'Rule change':'Site update',date:e.date,order:3,href:'#method',parts:[e.headline]}));
}
// The interest-group ratings: how many groups were read and how many profiles they rate.
export function ratingItems(ratings,{now=Date.now()}={}){
  if(!ratings||!recent(ratings.checked,TICKER.days.ratings,now))return [];
  const groups=Object.values(ratings.groups||{}).filter(g=>g?.read).length,profiles=Object.keys(ratings.people||{}).length;
  return groups?[{key:'ratings',kind:'new',tag:'Ratings',date:ratings.checked,order:3,href:'#method',
    parts:[`Interest-group ratings read: ${groups} groups · ${profiles} profiles rated`]}]:[];
}
// From the refresh (/api/ticker): newly reported stock trades and annual disclosures.
const WHAT={purchase:'a purchase',sale:'a sale',exchange:'an exchange'};
export function liveItems(live,{now=Date.now(),people}={}){
  const out=[];
  for(const x of live?.items||[]){
    const who=nameOf(x.subject,people);if(!who)continue;
    if(x.kind==='trade'&&recent(x.disclosed,TICKER.days.trade,now))
      out.push({key:`trade:${x.subject}:${x.id||x.disclosed}`,kind:'trade',tag:'Stock trade',date:x.disclosed,order:2,href:`#${x.subject}-aboveboard`,
        parts:[who,` reported ${WHAT[x.type]||'a trade'}${x.amount?` of ${String(x.amount).replace(/\s*-\s*/,'–')}`:''}${x.ticker||x.asset?` in ${x.ticker||String(x.asset).slice(0,48)}`:''}${x.owner&&!/^self$/i.test(x.owner)?` (${x.owner})`:''}`]});
    else if(x.kind==='filing'&&recent(x.filed,TICKER.days.filing,now))
      out.push({key:`filing:${x.subject}:${x.year}`,kind:'filing',tag:'Disclosure',date:x.filed,order:2,href:`#${x.subject}-aboveboard`,
        parts:[who,` filed their ${x.year?`${x.year} `:''}annual financial disclosure`]});
  }
  return out;
}
// Everything, newest first (ties: still counting, then the closest races, then the rest), at most `limit`.
export function tickerItems({research,log,ratings,live,people},{now=Date.now(),limit=TICKER.limit}={}){
  const all=[...raceItems(research,{now,people}),...liveItems(live,{now,people}),...ratingItems(ratings,{now}),...ruleItems(log,{now})];
  const seen=new Set();
  return all.filter(x=>!seen.has(x.key)&&seen.add(x.key)).sort((a,b)=>(t(b.date)||0)-(t(a.date)||0)||a.order-b.order).slice(0,limit);
}
const part=p=>typeof p==='string'?esc(p):`<b class="tk-${p.party==='D'?'d':p.party==='R'?'r':'i'}">${esc(p.name)}${p.party?` (${esc(p.party)})`:''}</b>`;
const itemHTML=x=>`<a class="tk-item" href="${esc(x.href)}"><span class="tk-tag tk-${esc(x.kind)}">${esc(x.tag)}</span>${x.date?`<span class="tk-date">${esc(shortDate(x.date))}</span>`:''}<span class="tk-t">${x.parts.map(part).join('')}</span></a><span class="tk-sep" aria-hidden="true">•</span>`;
// The strip: its label, the items twice over (the second copy hidden from screen readers, for a seamless loop), and a link
// to the updates pages. The loop's length sets its speed, so it reads at the same pace however many items there are.
export function tickerHTML(items){
  if(!items.length)return '';
  const one=items.map(itemHTML).join(''),seconds=Math.max(30,Math.round(items.reduce((n,x)=>n+x.tag.length+x.parts.map(p=>typeof p==='string'?p:p.name+' (X)').join('').length+12,0)/7));
  return `<div class="wrap"><span class="tk-label"><i class="tk-dot" aria-hidden="true"></i><span>Latest</span></span><div class="tk-view"><div class="tk-track" style="--tk-time:${seconds}s"><div class="tk-set">${one}</div><div class="tk-set" aria-hidden="true">${one.replace(/<a /g,'<a tabindex="-1" ')}</div></div></div><a class="tk-all" href="#websites">All updates <span aria-hidden="true">→</span></a></div>`;
}
// Fills the strip (host: the ticker's element) from what the page has loaded, then again whenever the refresh's newest
// records are read (at once, then every few minutes). The refresh being offline only leaves its items out.
export function mountTicker(host,{research,log,ratings,people,fetchLive=()=>fetch('/api/ticker').then(r=>r.ok?r.json():null)}={}){
  if(!host)return;
  let live=null;
  const draw=()=>{const items=tickerItems({research,log,ratings,live,people});const html=tickerHTML(items);if(host.dataset.drawn===html)return;host.dataset.drawn=html;host.innerHTML=html;host.hidden=!html;};
  draw();
  const poll=async()=>{try{const j=await fetchLive();if(j){live=j;draw();}}catch{}};
  poll();const every=setInterval(poll,TICKER.liveEvery);every?.unref?.();
  return {redraw:draw};
}
