// Chart builders for the score pages and the profile tabs. List charts (ranked, stacked and diverging bars) are HTML and
// size themselves; plotted charts draw into an element at its current width and are redrawn on resize by the caller.
// Every mark carries a data-tip for the shared hover tip, and every chart has a table view next to it.
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayMs=86400000;
export const money=n=>{if(n==null)return '—';const a=Math.abs(n);return (n<0?'−$':'$')+(a>=1e9?(a/1e9).toFixed(a>=1e10?1:2)+'B':a>=1e6?(a/1e6).toFixed(a>=1e7?1:2)+'M':a>=1e3?(a/1e3).toFixed(a>=1e5?0:1)+'K':Math.round(a));};
const when=d=>{const m=/^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(d||'');return m?`${m[3]?+m[3]+' ':''}${MON[+m[2]-1]} ${m[1]}`:d||'';};
// People and Profit share their colors everywhere: the diverging bars, the tree map and the outside-spending sectors.
export const ALIGN_COLOR={people:'var(--s1)',profit:'var(--s5)',other:'var(--cx-other)'};

// The shared hover tip: a mark's data-tip shows on hover and on keyboard focus.
export function hoverTips(root){
  const tip=document.querySelector('#tip');if(!tip||!root)return;
  root.querySelectorAll('[data-tip]').forEach(el=>{
    if(el.dataset.tipBound)return;el.dataset.tipBound='1';
    el.addEventListener('mouseenter',()=>{tip.textContent=el.dataset.tip;tip.classList.add('show');});
    el.addEventListener('mousemove',e=>{tip.style.left=Math.max(10,Math.min(e.clientX+12,window.innerWidth-310))+'px';tip.style.top=(e.clientY+14)+'px';});
    el.addEventListener('mouseleave',()=>tip.classList.remove('show'));
    el.setAttribute('tabindex','0');el.setAttribute('aria-label',el.dataset.tip);
    el.addEventListener('focus',()=>{const r=el.getBoundingClientRect();tip.textContent=el.dataset.tip;tip.style.left=Math.max(10,Math.min(r.left,window.innerWidth-310))+'px';tip.style.top=(r.bottom+6)+'px';tip.classList.add('show');});
    el.addEventListener('blur',()=>tip.classList.remove('show'));
  });
}
export const tableView=(head,rows,summary='Show as a table')=>`<details class="tv"><summary>${esc(summary)}</summary><div class="tablewrap"><table><thead><tr>${head.map(h=>`<th${/^(Amount|Points|Days|%|Count|Total|Kept|Half|Contradicted|People|Profit|Score)/.test(h)?' class="r"':''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${/^(Amount|Points|Days|%|Count|Total|Kept|Half|Contradicted|People|Profit|Score)/.test(head[i])?' class="r"':''}>${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${head.length}" class="muted">Nothing to show.</td></tr>`}</tbody></table></div></details>`;
const legend=items=>`<div class="legend">${items.map(([c,l,cls])=>`<span><i class="${cls||''}" style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`;
export {legend};
const who=r=>`<div class="cx-who">${r.href?`<a href="${esc(r.href)}">${esc(r.label)}</a>`:esc(r.label)}${r.sub?`<small>${esc(r.sub)}</small>`:''}</div>`;

// Ranked bars: one row per person, a bar to the value (0-100) colored by grade; "Not graded" rows stay, greyed.
export function rankBars(rows){
  return `<div class="cx-rows">${rows.map(r=>r.value==null
    ?`<div class="cx-row cx-ng">${who(r)}<div class="cx-track"><span class="cx-ngt">Not graded${r.note?` · ${esc(r.note)}`:''}</span></div><div class="cx-val">—</div></div>`
    :`<div class="cx-row">${who(r)}<div class="cx-track"><i class="cx-bar" style="width:${Math.max(1,r.value)}%;background:${r.color}" data-tip="${esc(r.tip||`${r.label}: ${r.value}%`)}"></i></div><div class="cx-val"><b class="${r.cls||''}">${esc(r.display||r.value+'%')}</b>${r.note?`<small>${esc(r.note)}</small>`:''}</div></div>`).join('')}</div>`;
}
// Stacked bars in raw counts or points, on one scale for every row, with a 2px surface gap between segments.
export function stackRows(rows,segs,{unit='',max}={}){
  const top=max||Math.max(1,...rows.map(r=>segs.reduce((t,s)=>t+(r.parts[s.key]||0),0)));
  return `<div class="cx-rows">${rows.map(r=>{const total=segs.reduce((t,s)=>t+(r.parts[s.key]||0),0);
    return `<div class="cx-row${r.grey?' cx-ng':''}">${who(r)}<div class="cx-track"><div class="cx-stack" style="width:${total/top*100}%">${segs.filter(s=>r.parts[s.key]).map(s=>`<i class="${s.cls||''}" style="flex:${r.parts[s.key]};background:${s.color}" data-tip="${esc(`${r.label}: ${r.parts[s.key]} ${s.label.toLowerCase()}${unit}`)}"></i>`).join('')}</div>${!total?`<span class="cx-ngt">${esc(r.empty||'None')}</span>`:''}</div><div class="cx-val">${r.value!=null?`<b class="${r.cls||''}">${esc(r.display||r.value)}</b>`:''}${r.note?`<small>${esc(r.note)}</small>`:''}</div></div>`;}).join('')}</div>`;
}
// Diverging bars centered at 50%: People-leaning to the right, wealthy-and-corporate-leaning to the left.
export function divergingRows(rows,{left='More for the wealthy and corporations',right='More for working people'}={}){
  return `<div class="cx-rows"><div class="cx-row cx-dhead"><div></div><div class="cx-dlabels"><span>← ${esc(left)}</span><span>${esc(right)} →</span></div><div></div></div>${rows.map(r=>{
    if(r.value==null)return `<div class="cx-row cx-ng">${who(r)}<div class="cx-track cx-dtrack"><span class="cx-ngt">Not graded${r.note?` · ${esc(r.note)}`:''}</span></div><div class="cx-val">—</div></div>`;
    const d=r.value-50,w=Math.abs(d)/50*50;
    return `<div class="cx-row">${who(r)}<div class="cx-track cx-dtrack"><i class="cx-dbar ${d>=0?'r':'l'}" style="width:${Math.max(.6,w)}%;${d>=0?'left:50%':'right:50%'};background:${d>=0?ALIGN_COLOR.people:ALIGN_COLOR.profit}" data-tip="${esc(r.tip||`${r.label}: ${r.value}%`)}"></i></div><div class="cx-val"><b class="${r.cls||''}">${r.value}%</b>${r.note?`<small>${esc(r.note)}</small>`:''}</div></div>`;}).join('')}</div>`;
}
// Position by issue: a bar from the center line toward the liberal side (left) or the conservative side (right), the
// same way round as the ideology scale. rows: [{label, sub, lean (-100 all conservative to +100 all liberal) or null,
// value, note, tip, light (statements only), empty}].
export function leanRows(rows){
  return `<div class="cx-rows cx-lean"><div class="cx-row cx-dhead"><div></div><div class="cx-dlabels"><span>← Liberal</span><span>Conservative →</span></div><div></div></div>${rows.map(r=>{
    if(r.lean==null)return `<div class="cx-row cx-ng">${who(r)}<div class="cx-track cx-dtrack"><span class="cx-ngt">${esc(r.empty||'No record yet')}</span></div><div class="cx-val">—</div></div>`;
    const lib=r.lean>0,w=Math.abs(r.lean)/2;
    return `<div class="cx-row">${who(r)}<div class="cx-track cx-dtrack"><i class="cx-dbar ${lib?'l':'r'}${r.light?' cx-light':''}" style="width:${Math.max(.6,w)}%;${lib?'right:50%':'left:50%'};background:${lib?'var(--dem)':'var(--rep)'}" data-tip="${esc(r.tip||r.label)}"></i></div><div class="cx-val"><b>${esc(r.value)}</b>${r.note?`<small>${esc(r.note)}</small>`:''}</div></div>`;}).join('')}</div>`;
}
// Horizontal bars by category (trades by sector), highlighted categories in the accent and the rest grey.
export function categoryBars(rows,{highlightLabel,otherLabel}){
  const max=Math.max(1,...rows.map(r=>r.value));
  return `<div class="cx-rows cx-cat">${rows.map(r=>`<div class="cx-row"><div class="cx-who">${esc(r.label)}</div><div class="cx-track"><i class="cx-bar" style="width:${r.value/max*100}%;background:${r.hi?'var(--s2)':'var(--cx-other)'}" data-tip="${esc(`${r.label}: ${r.value} trade${r.value===1?'':'s'}${r.hi?' · a sector their committees oversee':''}`)}"></i></div><div class="cx-val"><b>${r.value}</b></div></div>`).join('')}</div>${legend([['var(--s2)',highlightLabel],['var(--cx-other)',otherLabel]])}`;
}

// ---------- plotted charts (draw at the element's width) ----------
const svgOpen=(W,H,label)=>`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">`;
const niceMax=v=>{if(v<=0)return 1;const p=10**Math.floor(Math.log10(v)),n=v/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p;};
const t=d=>Date.parse(d+(d.length===7?'-15':''));

// Scatter: each person a dot, x and y on their own scales, grid at the ticks.
export function drawScatter(el,pts,{x,y}){
  if(!el)return;const W=Math.max(300,el.clientWidth),H=Math.min(360,Math.round(W*.62)),mL=46,mR=14,mT=12,mB=40;
  const X=v=>mL+(v-x.min)/(x.max-x.min)*(W-mL-mR),Y=v=>mT+(1-(v-y.min)/(y.max-y.min))*(H-mT-mB);
  let g='';
  for(const v of x.ticks){g+=`<line class="cx-grid" x1="${X(v)}" x2="${X(v)}" y1="${mT}" y2="${H-mB}"></line><text class="cx-tick" x="${X(v)}" y="${H-mB+15}" text-anchor="middle">${v>0?'+':''}${v}</text>`;}
  for(const v of y.ticks){g+=`<line class="cx-grid" x1="${mL}" x2="${W-mR}" y1="${Y(v)}" y2="${Y(v)}"></line><text class="cx-tick" x="${mL-6}" y="${Y(v)+4}" text-anchor="end">${v}%</text>`;}
  g+=`<text class="cx-cap" x="${mL}" y="${H-4}">← ${esc(x.left)}</text><text class="cx-cap" x="${W-mR}" y="${H-4}" text-anchor="end">${esc(x.right)} →</text>`;
  for(const p of pts)g+=`<circle class="cx-dot ${p.cls||''}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="5" data-tip="${esc(p.tip)}"></circle>`;
  el.innerHTML=svgOpen(W,H,`${y.label} against ${x.label} for ${pts.length} people`)+g+'</svg>';
  hoverTips(el);
}

// Filing delay: one dot per trade at its days from trade to disclosure, with a line at the deadline.
export function drawDelay(el,trades,deadline){
  if(!el)return;const W=Math.max(300,el.clientWidth),mL=10,mR=14,H=96,base=58;
  const pts=trades.filter(r=>r.days!=null||r.missing);
  const maxD=niceMax(Math.max(deadline*1.6,...pts.map(r=>r.days||0)));
  const X=v=>mL+v/maxD*(W-mL-mR);
  let g=`<line class="cx-axis" x1="${mL}" x2="${W-mR}" y1="${base}" y2="${base}"></line>`;
  for(let v=0;v<=maxD;v+=maxD/4)g+=`<text class="cx-tick" x="${X(v)}" y="${base+16}" text-anchor="${v===0?'start':v===maxD?'end':'middle'}">${Math.round(v)} days</text>`;
  g+=`<line class="cx-deadline" x1="${X(deadline)}" x2="${X(deadline)}" y1="8" y2="${base+2}"></line><text class="cx-tick" x="${X(deadline)+4}" y="16">${deadline}-day deadline</text>`;
  const lanes={};
  for(const r of pts){const d=r.missing?maxD:r.days,k=Math.round(X(d)/9);lanes[k]=(lanes[k]||0)+1;
    g+=`<circle class="cx-dot ${r.late?'late':'ontime'}" cx="${X(d).toFixed(1)}" cy="${base-8-(lanes[k]-1)*9}" r="4" data-tip="${esc(`${r.company||r.asset||r.ticker||'Trade'} · traded ${when(r.traded)} · ${r.missing?'never disclosed':`disclosed after ${r.days} days`}${r.late?' (late)':''}`)}"></circle>`;}
  g+=`<text class="cx-cap" x="${mL}" y="${H-4}">Days from trade to disclosure</text>`;
  el.innerHTML=svgOpen(W,H,`Filing delay for ${pts.length} trades; ${pts.filter(r=>r.late).length} after the ${deadline}-day deadline`)+g+'</svg>';
  hoverTips(el);
}

// Trades and votes on one time axis: buys above the line, sells below, related votes and hearings as ticks on the
// line; flagged trades carry a ring.
export function drawTradeTimeline(el,trades,events){
  if(!el)return;const W=Math.max(300,el.clientWidth),mL=10,mR=10,H=130,mid=62;
  const dates=[...trades.map(r=>r.traded),...events.map(e=>e.date)].filter(Boolean).map(t);
  if(!dates.length){el.innerHTML='';return;}
  const a=Math.min(...dates)-20*dayMs,b=Math.max(...dates)+20*dayMs,X=v=>mL+(v-a)/(b-a)*(W-mL-mR);
  let g=`<line class="cx-axis" x1="${mL}" x2="${W-mR}" y1="${mid}" y2="${mid}"></line><text class="cx-cap" x="${mL}" y="12">Buys</text><text class="cx-cap" x="${mL}" y="${H-24}">Sells</text>`;
  for(let y=new Date(a).getUTCFullYear();y<=new Date(b).getUTCFullYear();y++){const v=Date.UTC(y,0,1);if(v>a&&v<b){const near=X(v)>W-40;g+=`<line class="cx-grid" x1="${X(v)}" x2="${X(v)}" y1="18" y2="${H-30}"></line><text class="cx-tick" x="${X(v)+(near?-3:3)}" y="${H-8}" text-anchor="${near?'end':'start'}">${y}</text>`;}}
  for(const e of events)g+=`<rect class="cx-event" x="${X(t(e.date))-1.5}" y="${mid-9}" width="3" height="18" data-tip="${esc(`${when(e.date)} · ${e.label}`)}"></rect>`;
  const used={};
  for(const r of trades){const x=X(t(r.traded)),up=r.type!=='sale',k=`${up}${Math.round(x/10)}`;used[k]=(used[k]||0)+1;const y=up?mid-16-(used[k]-1)*11:mid+16+(used[k]-1)*11;
    g+=`<circle class="cx-dot ${up?'buy':'sell'}${r.flag?' flagged':''}" cx="${x.toFixed(1)}" cy="${y}" r="5.5" data-tip="${esc(`${when(r.traded)} · ${up?'Bought':'Sold'} ${r.company||r.asset||r.ticker||''} ${r.amount||''}${r.flag?` · Flagged: ${r.flag}`:''}`)}"></circle>`;}
  el.innerHTML=svgOpen(W,H,`${trades.length} trades and ${events.length} related votes or hearings on one timeline`)+g+'</svg>';
  hoverTips(el);
}

// Ethics cases on a year axis: each case a bar over the years it spans (a dot for a single date), colored by status.
export function drawCaseTimeline(el,cases,colors){
  if(!el)return;const W=Math.max(300,el.clientWidth),mL=10,mR=10,row=34,top=8;
  const ok=cases.filter(c=>c.from);if(!ok.length){el.innerHTML='';return;}
  const a=Math.min(...ok.map(c=>c.from))-.3,b=Math.max(...ok.map(c=>c.to||c.from))+1.3,X=v=>mL+(v-a)/(b-a)*(W-mL-mR);
  const H=top+ok.length*row+26;let g='';
  for(let y=Math.ceil(a);y<=Math.floor(b);y++)g+=`<line class="cx-grid" x1="${X(y)}" x2="${X(y)}" y1="${top}" y2="${H-22}"></line>${(y-Math.ceil(a))%(W<520?3:2)===0?`<text class="cx-tick" x="${X(y)}" y="${H-8}" text-anchor="middle">${y}</text>`:''}`;
  ok.forEach((c,i)=>{const y=top+i*row+row/2+6,x0=X(c.from),x1=X((c.to||c.from)+1)-2,col=colors[c.status]||'var(--cx-other)',max=Math.floor((W-mL-mR)/6.2);
    g+=`<text class="cx-lab" x="${x0<W/2?x0:Math.max(mL,x1)}" y="${y-9}" text-anchor="${x0<W/2?'start':'end'}">${esc(c.label.length>max?c.label.slice(0,max-1)+'…':c.label)}</text>`;
    g+=c.to&&c.to>c.from?`<rect x="${x0}" y="${y-5}" width="${Math.max(6,x1-x0)}" height="10" rx="4" style="fill:${col}" data-tip="${esc(`${c.label} · ${c.statusLabel} · ${c.when}`)}"></rect>`:`<circle cx="${x0+4}" cy="${y}" r="5" style="fill:${col}" data-tip="${esc(`${c.label} · ${c.statusLabel} · ${c.when}`)}"></circle>`;});
  el.innerHTML=svgOpen(W,H,`${ok.length} ethics entries on a timeline`)+g+'</svg>';
  hoverTips(el);
}

// Tree map: tile area is the amount; squarified so tiles stay close to square. Labels only where they fit.
export function squarify(items,x,y,w,h){
  const out=[],total=items.reduce((t,i)=>t+i.value,0);if(!total)return out;
  const scale=w*h/total;let rest=items.map(i=>({...i,area:i.value*scale}));
  while(rest.length){
    const short=Math.min(w,h);let row=[rest[0]],worst=Infinity;
    for(let k=1;k<=rest.length;k++){const r=rest.slice(0,k),s=r.reduce((t,i)=>t+i.area,0),mx=Math.max(...r.map(i=>i.area)),mn=Math.min(...r.map(i=>i.area));
      const wv=Math.max(short*short*mx/(s*s),s*s/(short*short*mn));if(wv<=worst){worst=wv;row=r;}else break;}
    const s=row.reduce((t,i)=>t+i.area,0);
    if(w>=h){const cw=s/h;let yy=y;for(const i of row){const ch=i.area/cw;out.push({...i,x,y:yy,w:cw,h:ch});yy+=ch;}x+=cw;w-=cw;}
    else{const ch=s/w;let xx=x;for(const i of row){const cw=i.area/ch;out.push({...i,x:xx,y,w:cw,h:ch});xx+=cw;}y+=ch;h-=ch;}
    rest=rest.slice(row.length);
  }
  return out;
}
export function drawTreemap(el,tiles){
  if(!el)return;const W=Math.max(300,el.clientWidth),H=Math.round(Math.min(420,Math.max(240,W*.5)));
  const laid=squarify(tiles.filter(x=>x.value>0).sort((a,b)=>b.value-a.value),0,0,W,H);
  el.style.height=H+'px';
  el.innerHTML=`<div class="cx-tm" style="width:${W}px;height:${H}px">${laid.map(r=>{const fits=r.w>86&&r.h>40;
    return `<div class="cx-tile ${r.align}" style="left:${r.x+1}px;top:${r.y+1}px;width:${Math.max(0,r.w-2)}px;height:${Math.max(0,r.h-2)}px;background:${ALIGN_COLOR[r.align]}" data-tip="${esc(`${r.label}: ${money(r.value)} · ${r.alignLabel}${r.catLabel?` · ${r.catLabel}`:''}${r.about?`. ${r.about}`:''}`)}">${fits?`<span>${esc(r.label)}</span><b>${money(r.value)}</b>`:''}</div>`;}).join('')}</div>`;
  hoverTips(el);
}

// Small multiples: one row per donor, monthly amounts as a 2px line with a 10% wash, on a shared month axis and each
// row's own scale (labelled), with decision markers and flagged windows.
export function drawMonthly(el,rows,months,markers){
  if(!el)return;const W=Math.max(300,el.clientWidth),mL=Math.min(190,Math.round(W*.32)),mR=58,rowH=44,top=6;
  const n=months.length,X=i=>mL+(n<2?0:i/(n-1)*(W-mL-mR)),xm=m=>{const i=months.indexOf(m.slice(0,7));return i<0?null:X(i);};
  const H=top+rows.length*rowH+30;let g='';
  months.forEach((m,i)=>{if(m.endsWith('-01')||i===0)g+=`<line class="cx-grid" x1="${X(i)}" x2="${X(i)}" y1="${top}" y2="${H-26}"></line><text class="cx-tick" x="${X(i)}" y="${H-10}" text-anchor="${i===0?'start':'middle'}">${m.endsWith('-01')?m.slice(0,4):MON[+m.slice(5,7)-1]+' '+m.slice(2,4)}</text>`;});
  rows.forEach((r,k)=>{
    const y0=top+k*rowH,base=y0+rowH-10,max=Math.max(1,...months.map(m=>r.series[m]||0)),Y=v=>base-v/max*(rowH-18);
    for(const f of r.flags||[]){const a=xm(f.from)??X(0),b=xm(f.to)??X(n-1);g+=`<rect class="cx-flagwin" x="${a}" y="${y0+2}" width="${Math.max(3,b-a)}" height="${rowH-10}" data-tip="${esc(f.tip)}"></rect>`;}
    const d=months.map((m,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(r.series[m]||0).toFixed(1)}`).join('');
    g+=`<path class="cx-wash" d="${d}L${X(n-1)} ${base}L${X(0)} ${base}Z"></path><path class="cx-line" d="${d}"></path><line class="cx-axis" x1="${mL}" x2="${W-mR}" y1="${base}" y2="${base}"></line>`;
    g+=`<text class="cx-lab" x="${mL-8}" y="${y0+rowH/2}" text-anchor="end">${esc(r.label.length>28?r.label.slice(0,27)+'…':r.label)}</text><text class="cx-tick" x="${W-mR+6}" y="${y0+14}">${money(max)}</text>`;
    // Each month's hover area, kept inside the plot so the first and last months don't spill past the edges.
    const half=Math.max(3,(W-mL-mR)/n/2);
    months.forEach((m,i)=>{const v=r.series[m]||0,a=Math.max(mL-3,X(i)-half),b=Math.min(W-mR+3,X(i)+half);g+=`<rect class="cx-hit" x="${a}" y="${y0}" width="${Math.max(6,b-a)}" height="${rowH-8}" data-tip="${esc(`${r.label} · ${MON[+m.slice(5,7)-1]} ${m.slice(0,4)}: ${money(v)}`)}"></rect>`;});
    // Votes are triangles under the row; trades in the donor's company are diamonds at the top.
    for(const mk of r.markers||[]){const x=xm(mk.date);if(x==null)continue;g+=`<path class="cx-mark ${mk.kind}" d="${mk.kind==='trade'?`M${x} ${y0+1}l4.5 4.5l-4.5 4.5l-4.5-4.5z`:`M${x} ${base+1}l-4 6h8z`}" data-tip="${esc(`${when(mk.date)} · ${mk.label}`)}"></path>`;}
  });
  for(const mk of markers||[]){const x=xm(mk.date);if(x==null)continue;g+=`<line class="cx-vline ${mk.kind}" x1="${x}" x2="${x}" y1="${top}" y2="${H-26}" data-tip="${esc(`${when(mk.date)} · ${mk.label}`)}"></line>`;}
  el.innerHTML=svgOpen(W,H,`Monthly money from ${rows.length} donors`)+g+'</svg>';
  hoverTips(el);
}

// Outside spending for and against, each bar split into sectors and colored by alignment.
export function sectorSpendBars(by,label,{fw='For',aw='Against'}={}){
  const tot=s=>s.reduce((t,x)=>t+x.amount,0),F=tot(by.for),A=tot(by.against),max=Math.max(F,A,1);
  const bar=(side,name,total)=>`<div class="cx-row"><div class="cx-who">${esc(name)}<small>${money(total)}</small></div><div class="cx-track"><div class="cx-stack" style="width:${total/max*100}%">${side.map(x=>`<i style="flex:${x.amount};background:${ALIGN_COLOR[x.align]}" data-tip="${esc(`${name}: ${label(x.cat)} ${money(x.amount)}`)}"></i>`).join('')}</div></div><div class="cx-val"></div></div>`;
  return `<div class="cx-rows cx-sector">${bar(by.for,fw,F)}${bar(by.against,aw,A)}</div>`;
}

// ---------- Their own money over time (public/wealth-timeline.js), on the Big Money Independence tab ----------
// One band a year from tl.from to tl.to, the year under its band ('16 when the bands are narrow).
function yearBands(tl,W,mL,mR){
  const n=tl.to-tl.from+1,band=(W-mL-mR)/n,cx=y=>mL+band*(y-tl.from+.5);
  return {band,cx,labels:H=>tl.years.map(({year})=>band<34&&(year-tl.from)%2?'':`<text class="cx-tick" x="${cx(year).toFixed(1)}" y="${H-6}" text-anchor="middle">${band<44?"'"+String(year).slice(2):year}</text>`).join('')};
}
// A bar with 4px rounded ends: a floating range (both ends) or a column from the baseline (top end only).
function roundBar(x,w,yt,yb,fill,floating){
  const h=yb-yt;if(!(h>0.5))return '';const r=Math.min(4,w/2,h/2);
  if(floating)return `<rect x="${x.toFixed(1)}" y="${yt.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}" style="fill:${fill}"></rect>`;
  return `<path d="M${x.toFixed(1)},${yb.toFixed(1)} L${x.toFixed(1)},${(yt+r).toFixed(1)} Q${x.toFixed(1)},${yt.toFixed(1)} ${(x+r).toFixed(1)},${yt.toFixed(1)} L${(x+w-r).toFixed(1)},${yt.toFixed(1)} Q${(x+w).toFixed(1)},${yt.toFixed(1)} ${(x+w).toFixed(1)},${(yt+r).toFixed(1)} L${(x+w).toFixed(1)},${yb.toFixed(1)} Z" style="fill:${fill}"></path>`;
}
// A round step (1, 2, 2.5 or 5 times a power of ten) at least v.
const niceStep=v=>{if(v<=0)return 1;const p=10**Math.floor(Math.log10(v)),n=v/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p;};
// The top of an axis in five round steps that holds v: $2.05M → $2.5M, $186K → $250K.
const fiveSteps=v=>niceStep(v/5)*5;
// Ticks from lo to hi in steps of a round size, about five of them.
function moneyTicks(lo,hi){const step=niceStep(Math.max(Math.abs(lo),hi)/5||1),out=[];for(let v=Math.floor(lo/step)*step;v<hi+step*.999;v+=step)out.push(Math.round(v));return out;}
const rangeTip=(lo,hi)=>lo==null&&hi==null?'can\'t be bounded from the form':hi==null?`${money(lo)} or more`:lo==null?`${money(hi)} or less`:`${money(lo)} to ${money(hi)}`;
const yearHit=(x,band,top,bot,tip)=>`<rect class="cx-hit" x="${(x-band/2).toFixed(1)}" y="${top}" width="${band.toFixed(1)}" height="${bot-top}" data-tip="${esc(tip)}"></rect>`;

// Net worth by year: each annual report's range, lowest to highest possible. An open-ended top runs to the top of the
// chart with an arrow; a report filed on paper is an empty dashed box; a year without a report is left blank.
export function drawNetWorthYears(el,tl){
  if(!el)return;const W=Math.max(280,el.clientWidth),H=W<420?200:230,mL=48,mR=8,top=14,bot=H-24;
  const vals=tl.years.map(y=>y.worth).filter(w=>w&&!w.unreadable).flatMap(w=>[w.low,w.high]).filter(Number.isFinite);
  const ticks=moneyTicks(Math.min(0,...vals),Math.max(1,...vals)),yMin=ticks[0],yMax=ticks.at(-1);
  const Y=v=>bot-(v-yMin)/(yMax-yMin)*(bot-top),{band,cx,labels}=yearBands(tl,W,mL,mR),bw=Math.min(22,band*.5);
  let g='';
  for(const v of ticks)g+=`<line class="${v===0?'cx-axis':'cx-grid'}" x1="${mL}" x2="${W-mR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"></line><text class="cx-tick" x="${mL-7}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${v?money(v):'$0'}</text>`;
  for(const {year,worth:w} of tl.years){const x=cx(year);
    if(!w){g+=yearHit(x,band,top,bot,`${year}: no annual report on file`);continue;}
    if(w.unreadable){const a=Y(yMin+(yMax-yMin)*.35),b=Y(yMin+(yMax-yMin)*.08);
      g+=`<rect x="${(x-bw/2).toFixed(1)}" y="${a.toFixed(1)}" width="${bw.toFixed(1)}" height="${(b-a).toFixed(1)}" rx="4" class="cx-gapbox"></rect><text class="cx-tick" x="${x.toFixed(1)}" y="${(a-6).toFixed(1)}" text-anchor="middle">paper</text>`;
      g+=yearHit(x,band,top,bot,`${year} annual report: filed on paper, so it can't be read automatically. Left blank, not guessed.`);continue;}
    if(w.low==null&&w.high==null){g+=yearHit(x,band,top,bot,`${year} annual report: its net worth can't be bounded from the form`);continue;}
    // An open-ended top fades out toward the top of the chart: its height isn't a value.
    const yt=w.high==null?top:Y(w.high),yb=w.low==null?Y(yMin):Y(w.low);
    g+=roundBar(x-bw/2,bw,yt,yb,w.high==null?'url(#wt-fade)':'var(--s1)',true);
    if(w.high==null)g+=`<path class="cx-open" d="M${(x-5).toFixed(1)},${(yt+10).toFixed(1)} L${x.toFixed(1)},${(yt+4).toFixed(1)} L${(x+5).toFixed(1)},${(yt+10).toFixed(1)}"></path>`;
    g+=yearHit(x,band,top,bot,`${year} annual report · net worth ${rangeTip(w.low,w.high)}${w.filed?` · filed ${when(w.filed)}`:''}`);
  }
  const last=tl.latest;if(last&&last.high!=null&&last.low!=null&&W>=360)g+=`<text class="cx-lab" x="${(cx(last.year)+bw/2).toFixed(1)}" y="${(Y(last.high)-7).toFixed(1)}" text-anchor="end">${money(last.low)}–${money(last.high)}</text>`;
  const fade='<defs><linearGradient id="wt-fade" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--s1)"></stop><stop offset=".55" style="stop-color:var(--s1);stop-opacity:.75"></stop><stop offset="1" style="stop-color:var(--s1);stop-opacity:.08"></stop></linearGradient></defs>';
  el.innerHTML=svgOpen(W,H,`Net worth by year, ${tl.from} to ${tl.to}: each annual report's range`)+fade+g+labels(H)+'</svg>';
  hoverTips(el);
}
// Stocks held (left axis) and bought and sold each year (right axis): the line is the middle of the individual stocks'
// added-up ranges on each annual report; the columns add up the middle of each trade's range. Both axes start at $0.
export function drawStocksTrades(el,tl){
  if(!el)return;const W=Math.max(280,el.clientWidth),H=W<420?200:230,mL=48,mR=48,top=14,bot=H-24;
  const sv=tl.years.map(y=>y.worth?.stocks?.value).filter(Number.isFinite),tv=tl.years.flatMap(y=>[y.bought.mid,y.sold.mid]);
  const sMax=fiveSteps(Math.max(10000,...sv)),tMax=fiveSteps(Math.max(10000,...tv)),Y=v=>bot-v/sMax*(bot-top),Y2=v=>bot-v/tMax*(bot-top);
  const {band,cx,labels}=yearBands(tl,W,mL,mR),cw=Math.max(3,Math.min(12,band*.22));
  let g='';
  for(let k=0;k<=5;k++){const y=bot-k/5*(bot-top);
    g+=`<line class="${k?'cx-grid':'cx-axis'}" x1="${mL}" x2="${W-mR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"></line><text class="cx-tick" x="${mL-7}" y="${(y+4).toFixed(1)}" text-anchor="end">${k?money(sMax*k/5):'$0'}</text><text class="cx-tick" x="${W-mR+7}" y="${(y+4).toFixed(1)}">${k?money(tMax*k/5):'$0'}</text>`;}
  for(const y of tl.years){const x=cx(y.year);g+=roundBar(x-cw-1,cw,Y2(y.bought.mid),bot,'var(--s3)',false)+roundBar(x+1,cw,Y2(y.sold.mid),bot,'var(--s2)',false);}
  // The stocks line, broken where a year's value isn't known.
  let seg=[];const segs=[];for(const y of tl.years){const v=y.worth?.stocks?.value;if(!Number.isFinite(v)){if(seg.length)segs.push(seg);seg=[];continue;}seg.push([cx(y.year),Y(v)]);}if(seg.length)segs.push(seg);
  for(const s of segs){if(s.length>1)g+=`<polyline class="cx-line" points="${s.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ')}"></polyline>`;for(const [x,y] of s)g+=`<circle class="cx-dot held" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"></circle>`;}
  const part=(t,verb)=>t.n?`${verb} about ${money(t.mid)} in ${t.n} trade${t.n===1?'':'s'}${t.n>t.unread?` (${rangeTip(t.low,t.high)})`:''}${t.unread?`, ${t.unread} with an amount that can't be read`:''}`:`${verb} nothing reported`;
  for(const y of tl.years){const w=y.worth,st=w?.stocks;
    const held=!w?'no annual report on file':w.unreadable?'annual report filed on paper':st==null?'stocks held can\'t be read from the report':st.count===0?'no individual stocks':`stocks held about ${money(st.value)}${st.open?' or more':''}${st.count?` (${st.count} stock${st.count===1?'':'s'})`:''}`;
    g+=yearHit(cx(y.year),band,top,bot,`${y.year} · ${held} · ${part(y.bought,'bought')} · ${part(y.sold,'sold')}${y.other?` · ${y.other} exchange${y.other===1?'':'s'}`:''}`);}
  el.innerHTML=svgOpen(W,H,`Value of individual stocks held by year, with the amounts bought and sold each year, ${tl.from} to ${tl.to}`)+g+labels(H)+'</svg>';
  hoverTips(el);
}
// Each trade on the date it was made: buys above the line, sells below, an exchange on it; bigger dots for bigger
// amounts; a ring in the critical color for one reported late or never.
export function drawTradeStrip(el,tl){
  if(!el)return;const W=Math.max(280,el.clientWidth),mL=48,mR=10,R=[4,6,8.5];
  if(!tl.trades.length){el.innerHTML='<p class="small muted">No trades in the reports read so far.</p>';return;}
  const a=Date.UTC(tl.from,0,1),b=Date.UTC(tl.to+1,0,1),X=d=>mL+(Date.parse(d)-a)/(b-a)*(W-mL-mR),step=W<520?8:9;
  const used={},pos=tl.trades.map(r=>{const x=X(r.traded),k=r.side+Math.round(x/(step+3));used[k]=(used[k]||0)+1;return {r,x,n:used[k]-1};});
  const deep=Math.min(8,Math.max(1,...Object.values(used))),mid=24+deep*step+6,H=mid*2+22;
  let g='';
  for(let y=tl.from;y<=tl.to+1;y++){const x=X(`${y}-01-01`);g+=`<line class="cx-grid" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="4" y2="${H-22}"></line>`;}
  const band=(W-mL-mR)/(tl.to-tl.from+1);
  for(let y=tl.from;y<=tl.to;y++)if(!(band<34&&(y-tl.from)%2))g+=`<text class="cx-tick" x="${X(`${y}-07-02`).toFixed(1)}" y="${H-6}" text-anchor="middle">${band<44?"'"+String(y).slice(2):y}</text>`;
  g+=`<line class="cx-axis" x1="${mL}" x2="${W-mR}" y1="${mid}" y2="${mid}"></line><text class="cx-cap" x="${mL-8}" y="${mid-14}" text-anchor="end">Buys</text><text class="cx-cap" x="${mL-8}" y="${mid+22}" text-anchor="end">Sells</text>`;
  for(const {r,x,n} of pos){const rad=R[r.size??0],off=10+Math.min(n,8)*step+rad;
    const y=r.side==='buy'?mid-off:r.side==='sell'?mid+off:mid,cls=r.side==='buy'?'buy':r.side==='sell'?'sell':'ontime';
    const amt=r.range?(r.range[1]==null?`over ${money(r.range[0]-1)}`:`$${r.range[0].toLocaleString('en-US')}–$${r.range[1].toLocaleString('en-US')}`):'amount not readable';
    const tip=`${when(r.traded)} · ${r.side==='buy'?'bought':r.side==='sell'?'sold':'exchanged'} ${r.name} · ${amt}${r.owner&&!/^self$/i.test(r.owner)?` · ${r.owner}`:''} · ${r.never?'never reported (late)':r.days!=null?`reported after ${r.days} days${r.late?' (late)':''}`:'report date unknown'}`;
    g+=`<circle class="cx-dot ${cls}${r.late?' late-ring':''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" data-tip="${esc(tip)}"></circle>`;}
  el.innerHTML=svgOpen(W,H,`${tl.trades.length} stock trades by date, ${tl.from} to ${tl.to}: buys above the line, sells below`)+g+'</svg>';
  hoverTips(el);
}

// A pie: slices [{label, total, share (0-100), color}] clockwise from the top, largest first as given, each with a hover
// tip; a 2px surface gap between slices. One slice of everything is a whole circle. Returns the SVG.
export function pieSVG(slices,{size=200,label='Pie chart',tip=s=>`${s.label}: ${money(s.total)} · ${s.share}%`}={}){
  const r=size/2-2,c=size/2,sum=slices.reduce((t,s)=>t+s.total,0);
  if(!(sum>0))return '';
  const pt=a=>`${(c+r*Math.sin(a)).toFixed(2)},${(c-r*Math.cos(a)).toFixed(2)}`;
  let a=0,g='';
  for(const s of slices){
    const sweep=s.total/sum*2*Math.PI;if(sweep<=0)continue;
    const attrs=`class="cx-slice" style="fill:${s.color}" data-tip="${esc(tip(s))}"`;
    g+=sweep>=2*Math.PI-1e-6?`<circle cx="${c}" cy="${c}" r="${r}" ${attrs}></circle>`
      :`<path d="M${c},${c} L${pt(a)} A${r},${r} 0 ${sweep>Math.PI?1:0} 1 ${pt(a+sweep)} Z" ${attrs}></path>`;
    a+=sweep;
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">${g}</svg>`;
}
