// The money map at the top of each profile's Money & Influence tab: where the campaign's money came from (each kind of
// receipt the FEC counts), what it has spent and has left, and what outside groups spent for and against the person
// on their own. Circle area and line width are to scale. Everything comes from records the site already keeps: the FEC
// committee totals ("camp"), the PAC lines and their kinds ("pac.rows"), the gifts groups bundled ("bundled") and the outside
// spending ("out"). Where the campaign's spending went (staff, ads, transfers to party committees) isn't collected yet,
// so the map shows the total spent and the cash left.
import {categoryAlign} from './influence.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const short$=n=>{const a=Math.abs(n);if(a>=1e9)return '$'+(n/1e9).toFixed(1)+'B';if(a>=1e6)return '$'+(n/1e6).toFixed(1)+'M';if(a>=1e4)return '$'+Math.round(n/1e3)+'K';if(a>=1e3)return '$'+(n/1e3).toFixed(1)+'K';return '$'+Math.round(n).toLocaleString('en-US');};
const full$=n=>'$'+Math.round(n).toLocaleString('en-US');
const day=d=>/^\d{4}-\d{2}-\d{2}/.test(d||'')?new Date(String(d).slice(0,10)+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'';
export const share=(a,b)=>!b?'':a>0&&a/b<0.01?'<1%':Math.round(a/b*100)+'%';
const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;

// The kinds of receipts, in the FEC's own terms, people first. key: the field in the committee totals.
export const SOURCES=[
  {k:'small',label:'Small donors',sub:'gifts under $200',color:'--s1'},
  {k:'large',label:'Larger donors',sub:'$200 or more, named',color:'--s5'},
  {k:'transfers',label:'Joint fundraising',sub:'from shared committees',color:'--s4'},
  {k:'pac',label:'PACs',sub:'political action committees',color:'--s2'},
  {k:'own',label:'Their own money',sub:'gifts and loans',color:'--s6'},
  {k:'party',label:'Party committees',sub:'from their party',color:'--cx-other'},
  {k:'other',label:'Other receipts',sub:'refunds and interest',color:'--muted'},
];

// What the map shows for one profile, or null when the campaign has no FEC report yet.
// groups: {key: name} for the groups that bundle; categories: {key: label} for the PAC kinds.
// The PACs behind the lines read: [{name, a, n}] largest first, for one kind (this app's sector) or, with a type
// function, the ones the FEC records as sponsored by a corporation. A PAC that gave more than once counts once, its gifts
// added up. rows: s.pac.rows ([name index, amount, kind, …]); names: research.json "pacNames".
export function pacsOf(s,kind,names=[],type=null){
  const by=new Map();
  for(const [i,amt,k] of s?.pac?.rows||[]){
    if(type?type(i)?.kind!=='corporate':k!==kind)continue;
    const name=names[i]||`PAC #${i}`,o=by.get(name)||{name,a:0,n:0};o.a+=num(amt);o.n++;by.set(name,o);
  }
  return [...by.values()].filter(x=>x.a>0).sort((a,b)=>b.a-a.a||a.name.localeCompare(b.name));
}
// PAC money by kind for the "PACs by kind" tree map (approved 2026-11-11): the research's kinds (this app's sectors),
// except that every committee the FEC lists as a leadership PAC or a candidate's committee (public/pac-types.js:
// "leadership", "candidate") counts with "lead", Leadership PACs & politician-affiliated committees, wherever the
// research filed it. "lead" is kept apart: the tree map and the total above it leave it out. Each kind: {k, label,
// align (People, Profit or Other, public/influence.js), a, pacs: [{name, a, n}] largest first}.
export const POLITICIAN_KINDS=new Set(['leadership','candidate']);
export function pacKindsFor(s,{categories={},pacNames=[],pacType=null}={}){
  const by=new Map();
  for(const [i,amt,k] of s?.pac?.rows||[]){
    const a=num(amt);if(!(a>0))continue;
    const t=pacType?pacType(i):null,kind=POLITICIAN_KINDS.has(t?.kind)?'lead':(k||'other');
    const o=by.get(kind)||{k:kind,label:categories[kind]||kind,align:categoryAlign(kind),a:0,pacs:new Map()};
    // One line a committee: by its FEC ID when known (a name can be saved whole and cut short), with the longest name.
    const name=pacNames[i]||`PAC #${i}`,key=t?.id||`name:${name}`,pc=o.pacs.get(key)||{name,a:0,n:0};
    if(name.length>pc.name.length)pc.name=name;pc.a+=a;pc.n++;o.pacs.set(key,pc);o.a+=a;by.set(kind,o);
  }
  const list=[...by.values()].map(o=>({...o,a:Math.round(o.a*100)/100,pacs:[...o.pacs.values()].sort((x,y)=>y.a-x.a||x.name.localeCompare(y.name))})).sort((x,y)=>y.a-x.a||x.label.localeCompare(y.label));
  const lead=list.find(x=>x.k==='lead');
  return {kinds:list.filter(x=>x.k!=='lead'),lead:lead?lead.a:0,leadPacs:lead?lead.pacs:[],total:Math.round(list.reduce((t,x)=>t+x.a,0)*100)/100};
}
// Short names for the tree map's boxes (the full name is on hover, and on the list it opens).
export const SHORT_KIND={labor:'Labor unions',health:'Health care providers',pharma:'Drugs, biotech & devices',insur:'Insurance & health plans',finance:'Banking & finance',oil:'Oil, gas & mining',utility:'Utilities & energy',defense:'Defense & aerospace',ag:'Agriculture & food',tech:'Tech, telecom & media',transport:'Transportation',realestate:'Real estate & construction',retail:'Retail & consumer brands',law:'Law & lobbying',prof:'Professional services',manuf:'Manufacturing',biz:'Business associations',ideo:'Ideological & advocacy',tribal:'Tribal governments',other:'Unclassified'};
const initials=n=>String(n||'').replace(/\b(PAC|POLITICAL|ACTION|COMMITTEE|FUND|INC|CORP(ORATION)?|THE|OF|AND|FOR|EMPLOYEES?|GOOD GOVERNMENT|CO)\b/gi,' ').trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'·';
export function moneyMap(s,{bundled=null,groups={},categories={},pacNames=[],pacType=null}={}){
  const c=s?.camp;if(!c||c.missing||!(num(c.receipts)>0))return null;
  const parts={small:num(c.unitemized),large:num(c.itemized),transfers:num(c.transfers),pac:num(c.pac),own:num(c.candidate)+num(c.loans),party:num(c.party),other:num(c.other)};
  const o=s.out||{};
  return {
    cmte:c.cmte||'Campaign committee',cmteId:c.cmteId||'',start:c.start,end:c.end,src:c.src||null,receipts:num(c.receipts),
    ins:SOURCES.map(x=>({...x,a:parts[x.k]})).filter(x=>x.a>0),
    // (raised minus the parts named: what the FEC's totals leave unsorted, normally nothing)
    unsorted:Math.max(0,num(c.receipts)-Object.values(parts).reduce((a,b)=>a+b,0)),
    outs:[{k:'spent',label:'Spent so far',sub:`through ${day(c.end)}`,a:num(c.disbursements),color:'--s3'},{k:'cash',label:'Cash on hand',sub:`on ${day(c.end)}`,a:num(c.cash),color:'--ink-2'}].filter(x=>x.a>0),
    debts:num(c.debts),
    side:[{k:'for',label:'Outside groups for them',a:num(o.for?.total),color:'--for-ink'},{k:'against',label:'Outside groups against them',a:num(o.against?.total),color:'--against-ink'}].filter(x=>x.a>0),
    sideStart:o.start||null,sideEnd:o.end||null,
    // (the kinds without Leadership PACs & politician-affiliated committees, which are pacLead)
    ...(()=>{const pk=pacKindsFor(s,{categories,pacNames,pacType});return {pacKinds:pk.kinds,pacLead:pk.lead,pacTotal:pk.total};})(),
    corporate:pacsOf(s,null,pacNames,pacType),
    pacWindow:s.pac?.window||null,pacRead:num(s.pac?.retrieved),
    bundled:Object.entries(bundled||{}).map(([k,v])=>({k,who:groups[k]||k,routed:num(v?.routed),n:num(v?.n),src:v?.src||null})).filter(x=>x.routed>0).sort((a,b)=>b.routed-a.routed),
  };
}

// The diagram, as SVG: money in on the left, the campaign in the middle, money out on the right, and outside groups'
// own spending below, dashed. Circle area and line width are to scale; amounts too small to see are drawn at the
// smallest size.
export const LAYOUT={W:1080,RMAX:70,RMIN:12,CX:540,CR:112,LX:250,RX:830,GAP:14,SLOT:58,LINE:46};
export function mapSVG(m){
  const {W,RMAX,RMIN,CX,CR,LX,RX,GAP,SLOT,LINE}=LAYOUT;
  const ins=m.ins.map(n=>({...n})),outs=m.outs.map(n=>({...n})),side=m.side.map(n=>({...n}));
  const maxA=Math.max(1,...ins.map(n=>n.a),...outs.map(n=>n.a),...side.map(n=>n.a));
  const rad=a=>Math.max(RMIN,RMAX*Math.sqrt(a/maxA)),width=a=>Math.max(2,LINE*a/m.receipts);
  const stack=list=>{let h=0;for(const n of list){n.r=rad(n.a);n.h=Math.max(2*n.r,SLOT);h+=n.h+GAP;}return Math.max(0,h-GAP);};
  const lh=stack(ins),rh=stack(outs),col=Math.max(lh,rh,2*CR+20),top=36,cy=top+col/2,mainH=top+col+24;
  const bandH=side.length?Math.max(...side.map(n=>2*rad(n.a)))+114:0,H=Math.round(mainH+bandH+10);
  const f=v=>Math.round(v*10)/10;
  const t=(x,y,str,style,anchor='start')=>`<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" style="${style}">${esc(str)}</text>`;
  const T={label:'font:700 15px var(--font-display);fill:var(--ink)',amount:'font:500 14px var(--font-mono);fill:var(--ink)',sub:'font:400 12.5px var(--font-body);fill:var(--muted)',head:'font:500 11px var(--font-mono);letter-spacing:.08em;fill:var(--muted)'};
  const colors=[...new Set([...ins,...outs,...side].map(n=>n.color))];
  const out=[`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${m.cmte} raised ${short$(m.receipts)}: ${ins.map(n=>`${n.label} ${short$(n.a)}`).join(', ')}. ${outs.map(n=>`${n.label} ${short$(n.a)}`).join(', ')}.${side.length?` ${side.map(n=>`${n.label} ${short$(n.a)}`).join(', ')}.`:''}`)}">`,
    `<defs>${colors.map(c=>`<marker id="mm-arrow${c}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(${c})"/></marker>`).join('')}</defs>`];
  for(const [x,h] of [[LX,'MONEY IN'],[CX,'THE CAMPAIGN'],[RX,'MONEY OUT']])out.push(t(x,18,h,T.head,'middle'));
  // Where each line meets the campaign: spread along its edge by line width.
  const spread=(list,dir)=>{const ws=list.map(n=>width(n.a)),total=ws.reduce((a,b)=>a+b,0)+6*Math.max(0,list.length-1);let y=cy-total/2;
    return list.map((n,i)=>{const w=ws[i],yy=y+w/2;y+=w+6;const dy=Math.max(-CR+6,Math.min(CR-6,yy-cy));return {x:CX+dir*Math.sqrt(CR*CR-dy*dy),y:cy+dy,w};});};
  let y=cy-lh/2;for(const n of ins){n.cx=LX;n.cy=y+n.h/2;y+=n.h+GAP;}
  y=cy-rh/2;for(const n of outs){n.cx=RX;n.cy=y+n.h/2;y+=n.h+GAP;}
  spread(ins,-1).forEach((p,i)=>{const n=ins[i],x1=n.cx+n.r,x2=p.x-9;
    out.push(`<path d="M${f(x1)},${f(n.cy)} C${f(x1+120)},${f(n.cy)} ${f(x2-120)},${f(p.y)} ${f(x2)},${f(p.y)}" style="fill:none;stroke:var(${n.color});stroke-opacity:.55;stroke-width:${f(p.w)}" marker-end="url(#mm-arrow${n.color})"/>`);});
  spread(outs,1).forEach((p,i)=>{const n=outs[i],x2=n.cx-n.r-9;
    out.push(`<path d="M${f(p.x)},${f(p.y)} C${f(p.x+120)},${f(p.y)} ${f(x2-110)},${f(n.cy)} ${f(x2)},${f(n.cy)}" style="fill:none;stroke:var(${n.color});stroke-opacity:.55;stroke-width:${f(p.w)}" marker-end="url(#mm-arrow${n.color})"/>`);});
  const node=(n,anchor,showShare)=>{const lx=anchor==='end'?n.cx-n.r-12:n.cx+n.r+12;
    out.push(`<circle cx="${f(n.cx)}" cy="${f(n.cy)}" r="${f(n.r)}" style="fill:var(${n.color});fill-opacity:.9"/>`,
      t(lx,n.cy-12,n.label,T.label,anchor),t(lx,n.cy+7,showShare?`${short$(n.a)} · ${share(n.a,m.receipts)}`:short$(n.a),T.amount,anchor),n.sub?t(lx,n.cy+25,n.sub,T.sub,anchor):'');};
  ins.forEach(n=>node(n,'end',true));outs.forEach(n=>node(n,'start',false));
  // The campaign committee, its name on up to three lines.
  out.push(`<circle cx="${CX}" cy="${f(cy)}" r="${CR}" style="fill:var(--surface-2);stroke:var(--line-2);stroke-width:1.5"/>`);
  const lines=[];let cur='';for(const w of String(m.cmte).split(/\s+/)){if((cur+' '+w).trim().length>18&&cur){lines.push(cur);cur=w;}else cur=(cur+' '+w).trim();}lines.push(cur);
  const shown=lines.slice(0,3),nameTop=cy-24-(shown.length-1)*10;
  shown.forEach((l,i)=>out.push(t(CX,nameTop+i*20,l,'font:700 17px var(--font-display);fill:var(--ink)','middle')));
  out.push(t(CX,cy+30,`raised ${short$(m.receipts)}`,'font:500 16px var(--font-mono);fill:var(--ink)','middle'));
  if(m.cmteId)out.push(t(CX,cy+52,`FEC ${m.cmteId}`,'font:400 12px var(--font-mono);fill:var(--muted)','middle'));
  if(side.length){
    const by=mainH+18,xs=side.length===2?[CX-190,CX+190]:[CX-190];
    out.push(`<line x1="40" x2="${W-40}" y1="${f(by)}" y2="${f(by)}" style="stroke:var(--line);stroke-width:1;stroke-dasharray:3 5"/>`,t(40,by+20,'OUTSIDE SPENDING',T.head),t(40,by+38,'not money the campaign received',T.sub));
    side.forEach((n,i)=>{n.r=rad(n.a);n.cx=xs[i];n.cy=by+62+n.r;const sy=cy+CR+8,dx=(n.cx-CX)*0.25,anchor=i===0?'end':'start',lx=i===0?n.cx-n.r-12:n.cx+n.r+12;
      out.push(`<path d="M${f(n.cx)},${f(n.cy-n.r-4)} C${f(n.cx)},${f(n.cy-n.r-70)} ${f(CX+dx)},${f(sy+60)} ${f(CX+dx*0.4)},${f(sy)}" style="fill:none;stroke:var(${n.color});stroke-width:2;stroke-dasharray:6 5" marker-end="url(#mm-arrow${n.color})"/>`,
        `<circle cx="${f(n.cx)}" cy="${f(n.cy)}" r="${f(n.r)}" style="fill:none;stroke:var(${n.color});stroke-width:2;stroke-dasharray:5 4"/>`,
        t(lx,n.cy-6,n.label,T.label,anchor),t(lx,n.cy+13,short$(n.a),T.amount,anchor),m.sideStart?t(lx,n.cy+31,`${day(m.sideStart)} – ${day(m.sideEnd)}`,T.sub,anchor):'');});
  }
  out.push('</svg>');
  return out.join('');
}

// Gifts from individuals a group collected and passed on to the campaign (research.json "bundled"), as a box.
const bundledPanel=m=>m.bundled.length?`<div class="mm-panel"><h3>Bundled through groups</h3><p class="small muted">Gifts from individuals that a group collected and passed on. They are part of the donor money above, not extra money.</p><ul class="list small">${m.bundled.map(b=>`<li><b>${esc(b.who)}</b> passed on ${full$(b.routed)}${b.n?` from ${b.n.toLocaleString('en-US')} gifts`:''}${b.src?` · <a href="${esc(b.src)}" target="_blank" rel="noopener">FEC ↗</a>`:''}</li>`).join('')}</ul></div>`:'';
// The same box for another place on the page: the Unbought tab shows it under its Sources (moneyMapBlock with
// withBundled: false leaves it out of the map there).
export function bundledBox(s,opts={}){const m=moneyMap(s,opts);return m?bundledPanel(m):'';}
// A long list shows its first SHOW_FIRST items (they come largest first), with the rest behind "Show all" under them.
// items: each item's HTML; wrap: the list's container for a run of them; noun: what the items are, for the toggle.
export const SHOW_FIRST=10;
export function showFirst(items,wrap,noun){
  if(items.length<=SHOW_FIRST)return wrap(items.join(''));
  return wrap(items.slice(0,SHOW_FIRST).join(''))+`<details class="mm-more"><summary><span class="mm-more-all">Show all ${items.length} ${esc(noun)}</span><span class="mm-more-less">Show fewer</span></summary>${wrap(items.slice(SHOW_FIRST).join(''))}</details>`;
}
// The whole section: the diagram, its key, the numbers behind it, the PACs by kind and the bundled gifts. opts.under:
// more under the numbers, in the same column; opts.withBundled: false leaves the bundled gifts' box out.
export function moneyMapBlock(s,opts={}){
  const m=moneyMap(s,opts);if(!m)return '';
  const row=(sw,l,v,sh='')=>`<tr><td>${sw?`<i class="mm-swatch" style="background:var(${sw})"></i>`:''}${esc(l)}</td><td class="r num">${full$(v)}</td><td class="r num">${sh}</td></tr>`;
  const money=`<thead><tr><th>Money in</th><th class="r">Amount</th><th class="r">Share</th></tr></thead><tbody>${m.ins.map(n=>row(n.color,n.label,n.a,share(n.a,m.receipts))).join('')}${m.unsorted>=1?row('','Not sorted by the FEC',m.unsorted,share(m.unsorted,m.receipts)):''}<tr class="mm-sum"><td>Raised</td><td class="r num">${full$(m.receipts)}</td><td class="r num">100%</td></tr></tbody>`
    +`<thead><tr><th>Money out</th><th class="r">Amount</th><th></th></tr></thead><tbody>${m.outs.map(n=>row('',n.label,n.a)).join('')}${m.debts?row('','Debts owed',m.debts):''}</tbody>`
    +(m.side.length?`<thead><tr><th>Outside spending</th><th class="r">Amount</th><th></th></tr></thead><tbody>${m.side.map(n=>row('',n.label,n.a)).join('')}</tbody>`:'');
  // PACs by kind: a tree map of the kinds (public/app.js lays it out to the box's width and fits the labels), the total
  // without Leadership PACs & politician-affiliated committees above it, and under it an open/close tab with the PACs of
  // the kind picked (the largest at first; tapping a box picks another).
  const pkSum=m.pacKinds.reduce((t,x)=>t+x.a,0),pkFed=m.ins.find(n=>n.k==='pac')?.a||0;
  const pkTile=x=>`<button type="button" class="pk-tile ${esc(x.align)}" data-k="${esc(x.k)}" data-a="${x.a}" title="${esc(`${x.label}: ${full$(x.a)}`)}" aria-label="${esc(`${x.label}: ${full$(x.a)}`)}"><span>${esc(SHORT_KIND[x.k]||x.label)}</span><b>${short$(x.a)}</b></button>`;
  const pkMeta=x=>`${full$(x.a)} · ${x.pacs.length} PAC${x.pacs.length===1?'':'s'}`;
  const pkKind=(x,i)=>`<div class="pk-kind" data-k="${esc(x.k)}" data-label="${esc(x.label)}" data-meta="${esc(pkMeta(x))}"${i?' hidden':''}>${x.pacs.length?showFirst(x.pacs.map(p=>`<li><span>${esc(p.name)}</span><span class="num">${full$(p.a)}${p.n>1?` <span class="muted">· ${p.n} gifts</span>`:''}</span></li>`),h=>`<ul class="mm-pacs">${h}</ul>`,'PACs'):'<p class="small muted">The PACs aren\'t listed for this kind.</p>'}</div>`;
  const pkKey=['people','profit','other'].map(a=>[a,m.pacKinds.filter(x=>x.align===a).reduce((t,x)=>t+x.a,0)]).filter(([,v])=>v>0)
    .map(([a,v])=>`<span><i class="pk-sw ${a}"></i>${({people:'People-aligned',profit:'Profit-aligned',other:'Other'})[a]} ${short$(v)}</span>`).join('');
  const pkNote=`From the PAC lines in the campaign's reports for ${esc(m.pacWindow||'the period on file')}: ${full$(m.pacTotal)} read, of the ${short$(pkFed)} the FEC counts for the whole period.${m.pacLead>0?` Left out: ${full$(m.pacLead)} from leadership PACs and politicians' committees (the ones the research files there, and every committee the FEC lists as a leadership PAC or a candidate's campaign).`:''}`;
  const kinds=m.pacKinds.length?`<p class="pk-excl">(Excluding Leadership PACs &amp; politician-affiliated committees: <b class="num">${full$(pkSum)}</b>)</p>
    <div class="pk-tm" role="group" aria-label="PAC money by kind, without leadership PACs and politicians' committees">${m.pacKinds.map(pkTile).join('')}</div>
    <details class="pk-list"><summary><span><b class="pk-sum-label">${esc(m.pacKinds[0].label)}</b> <span class="muted pk-sum-meta">· ${esc(pkMeta(m.pacKinds[0]))}</span></span></summary><div class="pk-list-b">${m.pacKinds.map(pkKind).join('')}</div></details>
    <div class="pk-key">${pkKey}</div>
    <p class="small muted">Box size is the amount; tap a box to open its PACs. ${pkNote}</p>`
    :m.pacLead>0?`<p class="small">All ${full$(m.pacLead)} of the PAC money read came from leadership PACs and politicians' committees, which this box leaves out.</p><p class="small muted">${pkNote}</p>`
    :'<p class="small muted">No PAC lines read from this campaign\'s reports yet.</p>';
  const corpTotal=m.corporate.reduce((t,p)=>t+p.a,0);
  const corporate=`<div class="mm-panel mm-corp" id="f-corporate"><h3>Corporate PAC donors</h3>${m.corporate.length?`<p class="mm-corp-sum"><b class="num">${full$(corpTotal)}</b> from ${m.corporate.length} corporate PAC${m.corporate.length===1?'':'s'}</p>${showFirst(m.corporate.map(p=>`<li><span><i class="mm-badge" aria-hidden="true">${esc(initials(p.name))}</i>${esc(p.name)}</span><span class="num">${full$(p.a)}</span></li>`),h=>`<ul class="mm-pacs mm-corp-list">${h}</ul>`,'corporate PACs')}<p class="small muted">PACs the FEC records as sponsored by a corporation, from the lines read.</p>`:m.pacRead?'<p class="small">None of the PAC lines read are from corporate PACs.</p>':'<p class="small muted">No PAC lines read yet.</p>'}</div>`;
  const bundled=opts.withBundled===false?'':bundledPanel(m);
  return `<section class="mm" id="f-map">
    <h2>Money map</h2>
    <p class="small muted" style="margin:4px 0 10px">${esc(m.cmte)}${m.cmteId?` (${esc(m.cmteId)})`:''} · FEC committee totals, ${day(m.start)} – ${day(m.end)}${m.src?` · <a href="${esc(m.src)}" target="_blank" rel="noopener">source ↗</a>`:''}</p>
    <div class="mm-diagram">${mapSVG(m)}</div>
    <div class="mm-key small muted"><span><i class="mm-dot"></i>Circle area = dollars (amounts too small to see are drawn at the smallest size)</span><span><i class="mm-line"></i>Line width = dollars, in the direction the money moved</span>${m.side.length?'<span><i class="mm-dash"></i>Outside groups\' own spending, never given to the campaign</span>':''}</div>
    <div class="mm-books">
      <div class="mm-col"><div class="mm-panel"><h3>The numbers</h3><div class="tablewrap"><table>${money}</table></div></div>${opts.under||''}</div>
      <div class="mm-stack">
        <div class="mm-panel mm-pk" id="f-kinds"><h3>PACs by kind</h3>${kinds}</div>
        ${corporate}
        ${bundled}
        <div class="mm-panel mm-todo"><h3>Not on the map yet</h3><p class="small muted"><b>Where the money went:</b> the FEC lists every payment a campaign makes (staff, ads, transfers to party committees, gifts to other candidates), but the site collects only the total spent so far. <b>Donors by employer and industry</b> would split the donor circles further.</p></div>
      </div>
    </div>
  </section>`;
}
