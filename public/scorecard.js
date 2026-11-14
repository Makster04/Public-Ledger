// A portable view of the same reviewed scores shown on the profile. No scoring is done here.
const PALETTES={D:{accent:'#70acff',party:'Democrat'},R:{accent:'#ff969c',party:'Republican'},I:{accent:'#bbc2cc',party:'Independent'}};
// The five letter grades, in the order the profile shows them (Ideology is a position, not a grade).
const LABELS=['Keeps Their Word','Shows Up','Big Money Independence','Plays by the Rules','People First'];
const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const amount=value=>finite(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value):typeof value==='string'&&value.trim()?value:'Not available';
const letter=value=>value>=90?'A':value>=80?'B':value>=70?'C':value>=60?'D':'F';
// The card's two box colors (and the outline), the gray text on each, and the grade colors dark enough to read on paper.
const INK='#121519',PAPER='#f3efe6',SUB='#4a525e',SUB_DARK='#b9b3a6';
const GRADE_ON_PAPER={A:'#138a50',B:'#5f8f1e',C:'#a87708',D:'#bd6416',F:'#cc3d4a'};
const MONO="ui-monospace, Menlo, Consolas, 'Courier New', monospace",SANS='Arial, Helvetica, sans-serif';
const cleanImage=value=>/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value||'')?value:'';
const initialName=name=>(String(name||'').trim().split(/\s+/).filter(Boolean).map(x=>x[0]).filter(Boolean).slice(0,2).join('')||'PL').toUpperCase();

// Text is deliberately wrapped into SVG text nodes, never interpreted as markup.
function lines(value,width,max=5){
  const out=[],words=String(value??'').trim().split(/\s+/).filter(Boolean);
  let line='';
  for(const word of words){
    if(line&&(line+' '+word).length>width){out.push(line);line=word;}else line+=(line?' ':'')+word;
  }
  if(line)out.push(line);
  return out.slice(0,max).map((s,i)=>i===max-1&&out.length>max?s.slice(0,width-1)+'…':s);
}
const text=(value,x,y,{size=20,color='#eff2f8',weight=400,width=44,max=5,lineHeight=size*1.3,anchor='start',family='Arial, sans-serif'}={})=>`<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${lines(value,width,max).map((line,i)=>`<tspan x="${x}" dy="${i?lineHeight:0}">${xml(line)}</tspan>`).join('')}</text>`;

// Where the money came from, for the funding overview: each source's share of what they raised (the FEC's own
// categories in the committee's totals), and the individuals' money by gift size when it's been read (sizes: the
// donor-sizes record). null without a campaign total, or without its split by source (a basic profile's summary has
// only the total), so nothing shows as "Other" that is only unknown.
export function fundingParts(camp,sizes=null){
  const n=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):0,total=n(camp?.receipts);
  if(!total||!['indiv','pac','transfers','party'].some(k=>camp[k]!=null&&camp[k]!==''))return null;
  const self=camp.self!=null?n(camp.self):n(camp.candidate);
  const parts=[['indiv','Individuals',n(camp.indiv)],['pac','PACs',n(camp.pac)],['transfers','Transfers',n(camp.transfers)],['party','Party',n(camp.party)],['self','Self-funding',self]];
  parts.push(['other','Other',Math.max(0,total-parts.reduce((t,p)=>t+p[2],0))]);
  const b=Array.isArray(sizes?.brackets)?sizes.brackets:null,bt=b?b.reduce((t,x)=>t+n(x.total),0)+n(sizes.notSorted):0;
  const BAND=['$200 & under','$200–499','$500–999','$1K–1,999','$2K+'];
  return {total,parts:parts.map(([key,label,value])=>({key,label,value,share:value/total})),
    sizes:b&&bt>0?[...b.map((x,i)=>({label:BAND[i]||x.short||'',value:n(x.total),share:n(x.total)/bt})),...(n(sizes.notSorted)?[{label:'not sorted yet',value:n(sizes.notSorted),share:n(sizes.notSorted)/bt}]:[])]:null};
}
const pct=s=>s>0&&s<0.005?'<1%':Math.round(s*100)+'%';
const SOURCE_COLORS={indiv:'#3ddc84',pac:'#ef6b6b',transfers:'#f0c35a',party:'#8fb8ff',self:'#c39bff',other:'#9aa3ae'};
const SIZE_SHADES=['#d2f7dd','#9fe9b6','#64d48c','#33b468','#1d874a','#6d7a71'];
// A ring segment from angle a0 to a1 (radians, 0 at the top, clockwise).
function arc(cx,cy,ro,ri,a0,a1){
  const pt=(r,a)=>`${(cx+r*Math.sin(a)).toFixed(2)} ${(cy-r*Math.cos(a)).toFixed(2)}`,large=a1-a0>Math.PI?1:0;
  if(a1-a0>=Math.PI*2-1e-6)return `M${pt(ro,0)}A${ro} ${ro} 0 1 1 ${pt(ro,Math.PI)}A${ro} ${ro} 0 1 1 ${pt(ro,0)}M${pt(ri,0)}A${ri} ${ri} 0 1 0 ${pt(ri,Math.PI)}A${ri} ${ri} 0 1 0 ${pt(ri,0)}Z`;
  return `M${pt(ro,a0)}A${ro} ${ro} 0 ${large} 1 ${pt(ro,a1)}L${pt(ri,a1)}A${ri} ${ri} 0 ${large} 0 ${pt(ri,a0)}Z`;
}

// The major lookouts under the funding overview: each tracker's PAC checks and gifts routed through it this cycle
// (✕ took some, ✓ none, ? not read yet), and its super PACs' spending for or against them when there is some.
const money=n=>n>=1e6?'$'+(n/1e6).toFixed(n>=1e7?1:2).replace(/\.0+$/,'')+'M':'$'+Math.round(n).toLocaleString('en-US');
function lookoutRow(items,fx,y0,fw){
  const MARK={took:['#e0535f','M-3.5-3.5l7 7M3.5-3.5l-7 7'],none:['#18a35f','M-4 0l3 3L4-3.5'],waiting:['#8b95a5','']},cw=(fw-52)/items.length,spW=items.length>6?18:items.length>5?23:28;
  return `<path d="M${fx+1.5} ${y0}H${fx+fw-1.5}" stroke="#3a4250" stroke-width="1.5"/>
    ${text('MAJOR LOOKOUTS · PAC CHECKS AND GIFTS ROUTED THROUGH EACH, THIS CYCLE',fx+26,y0+22,{size:11,color:SUB_DARK,width:90,max:1,family:MONO})}
    ${items.map((x,i)=>{const X=fx+26+i*cw,[c,d]=MARK[x.status]||MARK.waiting,o=x.superPac;
      const sp=o&&(o.for>0||o.against>0)?['SUPER PAC:',o.for>0?money(o.for)+' FOR':'',o.against>0?money(o.against)+' AGAINST':''].filter(Boolean).join(' '):'';
      const e=x.emoji,tx=X+(e?26:22);
      const icon=e?`${text(e,X+9,y0+51,{size:19,width:4,anchor:'middle',family:SANS})}<circle cx="${X+16}" cy="${y0+52}" r="6" fill="${c}" stroke="#121519" stroke-width="1.5"/>${d?`<path d="${d}" transform="translate(${X+16} ${y0+52}) scale(.62)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`:text('?',X+16,y0+55,{size:8,color:'#fff',weight:700,width:2,anchor:'middle',family:SANS})}`
        :`<circle cx="${X+8}" cy="${y0+44}" r="8" fill="${c}"/>${d?`<path d="${d}" transform="translate(${X+8} ${y0+44})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`:text('?',X+8,y0+48,{size:11,color:'#fff',weight:700,width:2,anchor:'middle',family:SANS})}`;
      return `${icon}
        ${text(String(x.card||x.name).toUpperCase(),tx,y0+49,{size:e?11:12,color:PAPER,weight:700,width:20,max:1,family:MONO})}
        ${text(x.status==='waiting'?'NOT READ YET':money(x.total),tx,y0+71,{size:x.status==='waiting'?11:18,color:x.status==='waiting'?SUB_DARK:x.status==='took'?'#ff8a8a':'#5fe39a',weight:700,width:20,max:1,family:x.status==='waiting'?MONO:SANS})}
        ${sp?text(sp,tx,y0+88,{size:9,color:SUB_DARK,width:spW,max:2,lineHeight:11,family:MONO}):''}`;}).join('')}`;
}
/** Produce a standalone SVG containing no remote image links, scripts or foreignObject: a 1000 × 1250 card (an Instagram
 * post's 4:5) on the party's color, in boxes. Row 1: the photo; the name with state, party and chamber; the five grades
 * with bars. Row 2: Big Money Independence's Bonuses and Pledges and bills as a checklist; six money boxes (Raised, Cash
 * on hand, Spent; Net worth, Stocks held, Stock trades). Row 3, the funding overview: each source's share of what they
 * raised, the individuals' money by gift size, a donut, and the major lookouts (each tracker's PAC checks and routed
 * gifts this cycle). The research date and the reminder go in the bottom strip; without a campaign total, the evidence
 * note takes row 3's place. A card without a checklist (basic profiles) or without net worth (a president) closes up
 * around what it has.
 * model: name, party, state, office, raised, cash, spent, period, wealth ({items: [{label, value, wait, sub}]}), lists
 * ([{title, items: [{label, status: 'yes'|'no'|'waiting', emoji?: shown before the label}], empty}]), funding (fundingParts),
 * trackers ([{key, name, card (a shorter label for the card, when the name is long), emoji (its icon, with the mark as a
 * small badge; without it, the mark alone), status: 'took'|'none'|'waiting', total, superPac: {for, against}|null}]), grades, reviewedAt. */
export function renderScorecardSvg(model,portraitDataUrl=''){
  const p=PALETTES[model.party]||PALETTES.I,portrait=cleanImage(portraitDataUrl),name=String(model.name||'Public Ledger profile');
  const raw=Array.isArray(model.grades)?model.grades:[];
  const grades=LABELS.map((label,i)=>({label,...(raw[i]||{}),value:finite(raw[i]?.value)?Math.max(0,Math.min(100,raw[i].value)):null}));
  const W=1000,L={x:28,w:372},R={x:416,w:556};
  // Dark boxes hold light text; light boxes, dark text. Every box has the same dark outline.
  const box=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${INK}" stroke-width="3"/>`;
  // Top strip: the site's name.
  const top=`<rect x="0" y="0" width="${W}" height="56" fill="${PAPER}"/><path d="M0 56H${W}" stroke="${INK}" stroke-width="3"/>
    <path d="M28 16h22M30 21h18M32 25v13M39 25v13M46 25v13M28 40h22" fill="none" stroke="${INK}" stroke-width="3"/>
    ${text('PUBLIC LEDGER',62,37,{size:20,color:INK,weight:700,width:30,family:MONO})}
    ${text('FOLLOW THE MONEY. CHECK THE RECORD.',972,36,{size:13,color:SUB,width:60,family:MONO,anchor:'end'})}`;
  // Row 1: the photo; their name; the five grades.
  const photo=`${box(L.x,76,L.w,476,INK)}
    ${portrait?`<image href="${portrait}" x="${L.x}" y="76" width="${L.w}" height="476" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/>${box(L.x,76,L.w,476,'none')}`:text(initialName(name),L.x+L.w/2,345,{size:106,color:SUB_DARK,weight:700,width:3,anchor:'middle'})}`;
  // The name as big as fits the box (capitals are about 0.68 of the size wide): one line, else two smaller.
  const upper=name.toUpperCase(),fitName=size=>({size,width:Math.floor((R.w-48)/(size*.68))});
  const big=fitName(46),{size:ns,width:nw}=lines(upper,big.width,2).length===1?big:fitName(38),two=lines(upper,nw,2).length>1;
  const who=`${box(R.x,76,R.w,150,INK)}
    ${text(upper,R.x+26,two?126:146,{size:ns,color:PAPER,weight:700,width:nw,max:2,lineHeight:ns*1.08,family:SANS})}
    ${text([model.state,p.party,model.office].filter(Boolean).join(' · ').toUpperCase(),R.x+26,204,{size:14,color:p.accent,weight:700,width:60,max:1,family:MONO})}`;
  const gradeRows=grades.map((g,i)=>{
    const y=320+i*46,graded=g.value!==null,l=graded?letter(g.value):null,c=graded?GRADE_ON_PAPER[l]:SUB;
    return `${text(g.label.toUpperCase(),R.x+26,y,{size:15,color:INK,weight:700,width:26,max:1,family:SANS})}
      <rect x="${R.x+250}" y="${y-13}" width="190" height="14" rx="3" fill="#d9d3c6"/>
      ${graded?`<rect x="${R.x+250}" y="${y-13}" width="${Math.max(4,Math.round(190*g.value/100))}" height="14" rx="3" fill="${c}"/>
      ${text(l,R.x+462,y+4,{size:30,color:c,weight:700,width:2,max:1,family:SANS})}${text(`${Math.round(g.value)}%`,R.x+530,y,{size:15,color:SUB,weight:700,width:4,max:1,family:MONO,anchor:'end'})}`
        :text('NOT GRADED',R.x+530,y,{size:12,color:SUB,weight:700,width:12,max:1,family:MONO,anchor:'end'})}`;
  }).join('');
  const gradesBox=`${box(R.x,242,R.w,310,PAPER)}
    ${text('FIVE GRADES',R.x+26,282,{size:24,color:INK,weight:700,width:30,family:SANS})}
    ${text('PERCENT · FROM REVIEWED RECORDS',R.x+530,280,{size:11,color:SUB,width:40,family:MONO,anchor:'end'})}
    ${gradeRows}`;
  // Row 2, left: the bonuses and the pledges and bills, as a checklist (✓ earned, ✕ not, ? a record not read yet).
  const MARK={yes:['#18a35f','M-5 0l3.5 3.5L5-4'],no:['#e0535f','M-4-4l8 8M4-4l-8 8'],waiting:['#8b95a5','']};
  const lists=(Array.isArray(model.lists)?model.lists:[]).slice(0,2);
  let ly=612;
  const listSvg=lists.map(x=>{
    const head=text(String(x.title||'').toUpperCase(),L.x+22,ly,{size:18,color:PAPER,weight:700,width:30,max:1,family:SANS});ly+=16;
    const items=(Array.isArray(x.items)?x.items:[]);
    const rows=items.length?items.map(it=>{
      const [c,d]=MARK[it.status]||MARK.no,label=(it.emoji?it.emoji+' ':'')+String(it.label||'').toUpperCase(),LW=it.emoji?34:30,n=lines(label,LW,2).length,y=ly+18;ly+=n*17+10;
      return `<circle cx="${L.x+34}" cy="${y-5}" r="11" fill="${c}"/>${d?`<path d="${d}" transform="translate(${L.x+34} ${y-5})" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`:text('?',L.x+34,y,{size:14,color:'#fff',weight:700,width:2,anchor:'middle',family:SANS})}
        ${text(label,L.x+56,y,{size:13,color:it.status==='yes'?PAPER:SUB_DARK,weight:it.status==='yes'?700:400,width:LW,max:2,lineHeight:17,family:MONO})}`;
    }).join(''):(ly+=34,text(x.empty||'None on file',L.x+22,ly-8,{size:13,color:SUB_DARK,width:40,family:MONO}));
    ly+=24;return head+rows;
  }).join('');
  // Row 2, right (the whole width without a checklist): the money boxes, a light strip with the label over the number.
  const fitLines=(v,w)=>{const s=String(v);if(s.length*.6*32<=w)return {ls:[s],size:32};
    if(s.includes('–')){const [a,b]=s.split('–');return {ls:[a+'–',b],size:Math.min(30,Math.floor(w/(Math.max(a.length+1,b.length)*.6)))};}
    return {ls:[s],size:Math.max(17,Math.floor(w/(s.length*.6)))};};
  const short=t=>String(t||'').replace(/([A-Z][a-z]{2}) \d{1,2}, (\d{4})/g,'$1 $2'),end=String(model.period||'').split(/\s*–\s*/)[1]||'';
  const camp=[['Raised',model.raised,short(model.period)],['Cash on hand',model.cash,end?`as of ${end}`:''],['Spent',model.spent,short(model.period)]].map(([label,v,sub])=>{const a=amount(v);return {label,value:a,wait:a==='Not available',sub:a==='Not available'?'':sub};});
  const wealth=model.wealth&&Array.isArray(model.wealth.items)?model.wealth.items.slice(0,3):[];
  const cells=[...camp,...wealth],area=lists.length?R:{x:L.x,w:W-56},cw=(area.w-24)/3,ch=155;
  const statsH=Math.ceil(cells.length/3)*(ch+16)-16;
  const stats=cells.map((c,i)=>{
    const x=area.x+(i%3)*(cw+12),y=568+Math.floor(i/3)*(ch+16),wait=!!c.wait||!c.value,{ls,size}=wait?{ls:[String(c.value||'Not read yet')],size:19}:fitLines(c.value,cw-28);
    return `${box(x,y,cw,ch,INK)}<path d="M${x+12} ${y+1.5}h${cw-24}a10.5 10.5 0 0 1 10.5 10.5v32h-${cw-1}v-32a10.5 10.5 0 0 1 10.5-10.5z" fill="${PAPER}"/><path d="M${x+1.5} ${y+44}H${x+cw-1.5}" stroke="${INK}" stroke-width="3"/>
      ${text(String(c.label).toUpperCase(),x+cw/2,y+29,{size:13,color:INK,weight:700,width:20,max:1,family:MONO,anchor:'middle'})}
      ${ls.map((l,k)=>text(l,x+cw/2,y+(ls.length>1?80:94)+k*size*1.05,{size,color:wait?SUB_DARK:PAPER,weight:700,width:20,max:1,family:SANS,anchor:'middle'})).join('')}
      ${text(c.sub||'',x+cw/2,y+136,{size:11,color:SUB_DARK,width:26,max:2,lineHeight:14,family:MONO,anchor:'middle'})}`;
  }).join('');
  const row2=Math.max(statsH,lists.length?ly-568+6:0),listBox=lists.length?`${box(L.x,568,L.w,row2,INK)}${listSvg}`:'';
  // The evidence note across the card, then the bottom strip.
  const ny=568+row2+16,F=model.funding&&model.funding.total>0?model.funding:null,TK=Array.isArray(model.trackers)&&model.trackers.length?model.trackers:null,FH=TK?274:204;
  const H=F?Math.max(1250,ny+FH+12+54):Math.max(1250,ny+196),by=H-54;
  let fund='';
  if(F){
    const fx=L.x,fw=W-56,body=ny+44,cx=fx+fw-108,cy=body+(TK?75:80),ro=TK?60:66,ri=TK?38:42;
    const part=k=>F.parts.find(p=>p.key===k)||{share:0,value:0},indiv=part('indiv');
    // The ring: the individuals' money by gift size (or in one piece), then each other source, from the top clockwise.
    const segs=[...(F.sizes&&indiv.value?F.sizes.map((z,i)=>({value:indiv.value*z.share,color:SIZE_SHADES[i]||SIZE_SHADES[5]})):[{value:indiv.value,color:SOURCE_COLORS.indiv}]),
      ...F.parts.filter(p=>p.key!=='indiv').map(p=>({value:p.value,color:SOURCE_COLORS[p.key]}))].filter(x=>x.value>0);
    const sum=segs.reduce((t,x)=>t+x.value,0)||1;let a=0;
    const ring=segs.map(x=>{const a1=a+x.value/sum*Math.PI*2,d=arc(cx,cy,ro,ri,a,a1);a=a1;return `<path d="${d}" fill="${x.color}" stroke="${INK}" stroke-width="2" fill-rule="evenodd"/>`;}).join('');
    let chipX=fx+26;
    const chips=F.sizes?F.sizes.map((z,i)=>{const t=`${z.label} ${pct(z.share)}`,x=chipX;chipX+=t.length*6.8+30;
      return `<rect x="${x}" y="${body+70}" width="11" height="11" rx="2" fill="${SIZE_SHADES[i]||SIZE_SHADES[5]}"/>${text(t,x+17,body+80,{size:11,color:SUB_DARK,width:40,max:1,family:MONO})}`;}).join('')
      :text('GIFT SIZES NOT READ YET',fx+26,body+80,{size:11,color:SUB_DARK,width:40,family:MONO});
    // The other sources on one line, each as wide as its words.
    let ox=fx+26;
    const others=F.parts.filter(p=>p.key!=='indiv').map(p=>{const t=`${pct(p.share)} ${p.label.toUpperCase()}`,x=ox;ox+=Math.round(t.length*18*.62)+24;return text(t,x,body+126,{size:18,color:SOURCE_COLORS[p.key],weight:700,width:30,max:1,family:SANS});}).join('');
    fund=`${box(fx,ny,fw,FH,INK)}<path d="M${fx+12} ${ny+1.5}h${fw-24}a10.5 10.5 0 0 1 10.5 10.5v32h-${fw-1}v-32a10.5 10.5 0 0 1 10.5-10.5z" fill="${PAPER}"/><path d="M${fx+1.5} ${ny+44}H${fx+fw-1.5}" stroke="${INK}" stroke-width="3"/>
      ${text('FUNDING OVERVIEW',fx+26,ny+29,{size:14,color:INK,weight:700,width:30,family:MONO})}
      ${text(`WHERE THE ${amount(F.total)} CAME FROM${model.period?' · '+short(model.period):''} · FEC`,fx+fw-24,ny+28,{size:11,color:SUB,width:80,max:1,family:MONO,anchor:'end'})}
      ${text(`${pct(indiv.share)} INDIVIDUALS`,fx+26,body+48,{size:28,color:SOURCE_COLORS.indiv,weight:700,width:30,max:1,family:SANS})}
      ${chips}
      ${others}${ring}${TK?lookoutRow(TK,fx,body+150,fw):''}
      ${text(amount(F.total),cx,cy+2,{size:15,color:PAPER,weight:700,width:10,max:1,family:SANS,anchor:'middle'})}${text('RAISED',cx,cy+17,{size:9,color:SUB_DARK,width:10,max:1,family:MONO,anchor:'middle'})}`;
  }
  // (its words in the middle of the box, which fills the rest of the card)
  const nh=Math.max(150,by-20-ny),nt=ny+Math.round(nh/2)-22;
  const note=F?'':`${box(L.x,ny,W-56,nh,PAPER)}
    ${text('SEE THE EVIDENCE, NOT JUST THE LETTER.',L.x+24,nt,{size:24,color:INK,weight:700,width:60,family:SANS})}
    ${text(`${!model.reviewedAt?'':/not reviewed/i.test(model.reviewedAt)?'Research not reviewed yet. ':'Research snapshot: '+model.reviewedAt+'. '}Based on reviewed records; coverage varies. A grade is not a clearance. Missing data is not zero.`,L.x+24,nt+40,{size:15,color:SUB,width:94,max:2,lineHeight:20,family:MONO})}`;
  const bottom=`<rect x="0" y="${by}" width="${W}" height="54" fill="${PAPER}"/><path d="M0 ${by}H${W}" stroke="${INK}" stroke-width="3"/>
    ${F?`${text(`PUBLIC LEDGER · ${!model.reviewedAt?'':/not reviewed/i.test(model.reviewedAt)?'RESEARCH NOT REVIEWED YET':'RESEARCH SNAPSHOT: '+String(model.reviewedAt).toUpperCase()}`,28,by+32,{size:12,color:INK,weight:700,width:70,family:MONO})}${text('A GRADE IS NOT A CLEARANCE. MISSING DATA IS NOT ZERO.',972,by+32,{size:12,color:SUB,width:70,family:MONO,anchor:'end'})}`
      :`${text('PUBLIC LEDGER',28,by+32,{size:13,color:INK,weight:700,width:30,family:MONO})}${text('FOLLOW THE EVIDENCE',972,by+32,{size:13,color:SUB,width:30,family:MONO,anchor:'end'})}`}`;
  const desc=[`Raised ${amount(model.raised)}, cash on hand ${amount(model.cash)}, spent ${amount(model.spent)}`,...(wealth.length?[wealth.map(x=>`${x.label} ${x.value||'Not read yet'}`).join(', ')]:[]),
    ...lists.map(x=>`${x.title}: ${(x.items||[]).map(it=>`${it.label} (${it.status==='yes'?'yes':it.status==='waiting'?'not read yet':'no'})`).join(', ')||x.empty||'none on file'}`),
    ...grades.map(g=>`${g.label}: ${g.value===null?'Not graded yet':letter(g.value)+' '+g.value+'%'}`)].join('. ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
    <title id="title">${xml(name)} — Public Ledger report card</title>
    <desc id="desc">${xml(desc)}. Reporting periods and evidence coverage are shown on the card.</desc>
    <defs><clipPath id="photo"><rect x="${L.x}" y="76" width="${L.w}" height="476" rx="12"/></clipPath></defs>
    <rect width="${W}" height="${H}" fill="${p.accent}"/>${top}${photo}${who}${gradesBox}${listBox}${stats}${fund}${note}${bottom}
  </svg>`;
}

const STYLE=`
.scorecard-dialog{color:#edf2fa;background:#10151d;border:1px solid var(--scorecard-accent);border-radius:18px;padding:0;width:min(760px,calc(100vw - 28px));max-height:calc(100dvh - 32px);box-shadow:0 32px 100px #0009;overflow:auto}
.scorecard-dialog::backdrop{background:#05080dd9;backdrop-filter:blur(5px)}
.scorecard-toolbar{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;background:#10151df5;border-bottom:1px solid #2d3745}
.scorecard-toolbar h2{font:700 18px system-ui,sans-serif;margin:0}.scorecard-close{font:inherit;background:transparent;color:#e6edf8;border:1px solid #48566a;border-radius:8px;padding:8px 12px;cursor:pointer}
.scorecard-preview{padding:20px 22px 0}.scorecard-preview svg{display:block;width:100%;height:auto;border-radius:10px}
.scorecard-actions{display:flex;gap:10px;flex-wrap:wrap;padding:18px 22px 4px}.scorecard-actions button{font:600 14px system-ui,sans-serif;border:1px solid var(--scorecard-accent);padding:11px 16px;border-radius:8px;background:transparent;color:var(--scorecard-accent);cursor:pointer}.scorecard-actions button:first-child{background:#c1c7d0;border-color:#c1c7d0;color:#0d1117}.scorecard-actions button:disabled{opacity:.5;cursor:wait}
.scorecard-status{font:14px/1.5 system-ui,sans-serif;color:#b6c0cf;margin:10px 22px 18px;min-height:21px}.scorecard-link{display:block;width:calc(100% - 44px);margin:0 22px 20px;padding:10px;background:#192130;border:1px solid #48566a;color:#edf2fa;border-radius:6px;box-sizing:border-box}
.scorecard-dialog :focus-visible{outline:3px solid var(--scorecard-accent);outline-offset:4px}
@media(max-width:520px){.scorecard-toolbar{padding:14px}.scorecard-preview{padding:12px 10px 0}.scorecard-actions{padding:14px 12px 4px}.scorecard-status{margin:8px 12px 14px}.scorecard-actions button{flex:1}.scorecard-dialog{max-height:calc(100dvh - 16px)}}`;

async function embeddedPortrait(source){
  if(!source)return '';
  try{
    const url=new URL(source,location.href);
    if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))return '';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
    let response;try{response=await fetch(url,{signal:controller.signal});}finally{clearTimeout(timer);}
    if(!response.ok)return '';
    const blob=await response.blob();
    if(!/^image\/(png|jpeg|webp)$/.test(blob.type)||blob.size>5*1024*1024)return '';
    return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(cleanImage(reader.result));reader.onerror=()=>resolve('');reader.readAsDataURL(blob);});
  }catch{return '';}
}

/** Open an accessible preview with an offline SVG download and profile-link sharing. */
export function openScorecard(model){
  if(!document.getElementById('scorecard-style')){const style=document.createElement('style');style.id='scorecard-style';style.textContent=STYLE;document.head.append(style);}
  const previous=document.activeElement,palette=PALETTES[model.party]||PALETTES.I;
  const dialog=document.createElement('dialog');dialog.className='scorecard-dialog';dialog.style.setProperty('--scorecard-accent',palette.accent);dialog.setAttribute('aria-labelledby','scorecard-title');
  dialog.innerHTML=`<div class="scorecard-toolbar"><h2 id="scorecard-title">Share report card</h2><button type="button" class="scorecard-close" autofocus>Close</button></div><div class="scorecard-preview"></div><div class="scorecard-actions"><button type="button" data-action="download">Download SVG</button><button type="button" data-action="share">Share profile link</button></div><p class="scorecard-status" role="status" aria-live="polite">Preparing the original portrait…</p>`;
  const preview=dialog.querySelector('.scorecard-preview'),status=dialog.querySelector('.scorecard-status');
  let svg=renderScorecardSvg(model),downloadReady=false;
  preview.innerHTML=svg;
  const download=dialog.querySelector('[data-action="download"]');download.disabled=true;
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();},{once:true});
  dialog.querySelector('.scorecard-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
  dialog.showModal();
  embeddedPortrait(model.portrait).then(portrait=>{
    if(!dialog.isConnected)return;
    svg=renderScorecardSvg(model,portrait);preview.innerHTML=svg;downloadReady=true;download.disabled=false;status.textContent='Download a self-contained image, or share the profile link. Your match reflects this browser’s saved priorities.';
  });
  download.addEventListener('click',()=>{
    if(!downloadReady)return;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download=`public-ledger-${String(model.id||'profile').replace(/[^a-z0-9_-]/gi,'')||'profile'}-scorecard.svg`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Scorecard downloaded as SVG. It includes the reporting period and coverage notes.';
  });
  dialog.querySelector('[data-action="share"]').addEventListener('click',async()=>{
    const url=new URL(location.href);url.hash=encodeURIComponent(String(model.id||''));
    const info={title:`${model.name||'Profile'} — Public Ledger`,text:'Follow the evidence behind the report card.',url:url.href};
    try{if(navigator.share){await navigator.share(info);status.textContent='Profile shared.';return;}}
    catch(error){if(error.name==='AbortError'){status.textContent='Sharing cancelled.';return;}}
    try{await navigator.clipboard.writeText(url.href);status.textContent='Profile link copied. Personalized match scores depend on each visitor’s priorities.';}
    catch{
      let input=dialog.querySelector('.scorecard-link');
      if(!input){input=document.createElement('input');input.className='scorecard-link';input.readOnly=true;input.setAttribute('aria-label','Profile link to copy');dialog.append(input);}
      input.value=url.href;input.focus();input.select();status.textContent='Copy the selected profile link.';
    }
  });
  return dialog;
}
