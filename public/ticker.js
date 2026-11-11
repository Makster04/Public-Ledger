// The ticker under the top bar: the site's updates from the last 24 hours, newest first, each with a tag, its date and a
// link: race calls (research.json "races", dated by the election results' "asof"), site updates
// (score-presentation-log.json; not rule changes), the interest-group ratings (group-ratings.json "checked") and, from
// the refresh, newly reported stock trades and annual disclosures (/api/ticker), dated by when the refresh first read
// them. Older updates drop off. Races still counting stay on, whatever their date, while the results are recent. With
// nothing to show, the strip isn't shown at all. It scrolls slowly, stops while it's hovered or focused, and stands still
// for visitors whose device asks for reduced motion.
export const TICKER={limit:14,hours:24,countingDays:45,liveEvery:300000};
const DAY=864e5,HOUR=36e5;
// A record's time in ms: a timestamp as given, a date alone at noon UTC that day.
const t=d=>{const x=String(d||'');return /T\d/.test(x)?Date.parse(x):Date.parse(x.slice(0,10)+'T12:00:00Z');};
// From the last 24 hours (a date alone: until noon UTC the next day; today's counts all day, and a later date doesn't).
export const isFresh=(d,now=Date.now())=>{const x=t(d);return Number.isFinite(x)&&x<=now+DAY/2&&now-x<=TICKER.hours*HOUR;};
const withinDays=(d,days,now)=>{const x=t(d);return Number.isFinite(x)&&x<=now+DAY&&now-x<=days*DAY;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const lowerFirst=s=>s?s[0].toLowerCase()+s.slice(1):s;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const shortDate=d=>{const x=new Date(t(d));return Number.isFinite(x.getTime())?`${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}`:'';};

// A person as the ticker names them: short name and party, from the profiles and directories.
export function nameOf(id,people){const p=people?.get?.(id);return p?{name:p.short||String(p.name||'').split(/\s+/).pop(),party:p.party||null}:null;}

// Races: one item a race the site follows: a call within 24 hours of the results it's in; a race still counting for as
// long as it's counting (and the results are under TICKER.countingDays old).
export function raceItems(research,{now=Date.now(),people}={}){
  const asof=research?.election?.asof||research?.election?.date;if(!withinDays(asof,TICKER.countingDays,now))return [];
  const out=[],called=isFresh(asof,now);
  for(const r of research?.races||[]){
    const res=r?.result;if(!res)continue;
    if(res.winner){
      if(!called)continue;
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
// Site updates: the presentation log's entries that carry a headline (one picked for the ticker; older entries, about
// grades since replaced, have none), within 24 hours. Rule changes stay in the log and on the methodology page only.
export function siteItems(entries,{now=Date.now()}={}){
  return (entries||[]).filter(e=>e?.headline&&!/^Rule change/i.test(e.note||'')&&isFresh(e.date,now)).map((e,i)=>({key:`log:${e.date}:${i}`,
    kind:'site',tag:'Site update',date:e.date,order:3,href:'#method',parts:[e.headline]}));
}
// The interest-group ratings: how many groups were read and how many profiles they rate.
export function ratingItems(ratings,{now=Date.now()}={}){
  if(!ratings||!isFresh(ratings.checked,now))return [];
  const groups=Object.values(ratings.groups||{}).filter(g=>g?.read).length,profiles=Object.keys(ratings.people||{}).length;
  return groups?[{key:'ratings',kind:'new',tag:'Ratings',date:ratings.checked,order:3,href:'#method',
    parts:[`Interest-group ratings read: ${groups} groups · ${profiles} profiles rated`]}]:[];
}
// From the refresh (/api/ticker): newly reported stock trades and annual disclosures, within 24 hours of when the refresh
// first read them ("seen"; a record from before it kept that, by its own date). Each shows the date it was reported.
const WHAT={purchase:'a purchase',sale:'a sale',exchange:'an exchange'};
export function liveItems(live,{now=Date.now(),people}={}){
  const out=[];
  for(const x of live?.items||[]){
    const who=nameOf(x.subject,people);if(!who)continue;
    if(x.kind==='trade'&&isFresh(x.seen||x.disclosed,now))
      out.push({key:`trade:${x.subject}:${x.id||x.disclosed}`,kind:'trade',tag:'Stock trade',date:x.disclosed,at:x.seen||null,order:2,href:`#${x.subject}-aboveboard`,
        parts:[who,` reported ${WHAT[x.type]||'a trade'}${x.amount?` of ${String(x.amount).replace(/\s*-\s*/,'–')}`:''}${x.ticker||x.asset?` in ${x.ticker||String(x.asset).slice(0,48)}`:''}${x.owner&&!/^self$/i.test(x.owner)?` (${x.owner})`:''}`]});
    else if(x.kind==='filing'&&isFresh(x.seen||x.filed,now))
      out.push({key:`filing:${x.subject}:${x.year}`,kind:'filing',tag:'Disclosure',date:x.filed,at:x.seen||null,order:2,href:`#${x.subject}-aboveboard`,
        parts:[who,` filed their ${x.year?`${x.year} `:''}annual financial disclosure`]});
  }
  return out;
}
// Everything, newest first by when it reached the site (ties: still counting, then the closest races, then the rest),
// at most `limit`.
export function tickerItems({research,log,ratings,live,people},{now=Date.now(),limit=TICKER.limit}={}){
  const all=[...raceItems(research,{now,people}),...liveItems(live,{now,people}),...ratingItems(ratings,{now}),...siteItems(log,{now})];
  const seen=new Set();
  const at=x=>t(x.at||x.date)||0;
  return all.filter(x=>!seen.has(x.key)&&seen.add(x.key)).sort((a,b)=>at(b)-at(a)||a.order-b.order).slice(0,limit);
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
