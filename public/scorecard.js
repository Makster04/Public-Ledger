// A portable view of the same reviewed scores shown on the profile. No scoring is done here.
const PALETTES={D:{accent:'#70acff',party:'Democrat'},R:{accent:'#ff969c',party:'Republican'},I:{accent:'#bbc2cc',party:'Independent'}};
const LABELS=['Your match','Promises delivered','Ethics','Workers > Profit'];
const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const amount=value=>finite(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value):typeof value==='string'&&value.trim()?value:'Not available';
const letter=value=>value>=90?'A':value>=80?'B':value>=70?'C':value>=60?'D':'F';
const GRADE_COLORS={A:'#28d17c',B:'#a4d65b',C:'#f0c35a',D:'#f0b84b',F:'#f17881'};
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

/** Produce a standalone SVG containing no remote image links, scripts or foreignObject. */
export function renderScorecardSvg(model,portraitDataUrl=''){
  const p=PALETTES[model.party]||PALETTES.I,portrait=cleanImage(portraitDataUrl),name=String(model.name||'Public Ledger profile');
  const raw=Array.isArray(model.grades)?model.grades:[];
  const grades=LABELS.map((label,i)=>({label,...(raw[i]||{}),value:finite(raw[i]?.value)?Math.max(0,Math.min(100,raw[i].value)):null}));
  const panels=grades.map((grade,i)=>{
    const x=40+i*234,y=694,personal=i===0&&model.matchConfigured===false,graded=grade.value!==null;
    const display=graded?letter(grade.value):personal?'Set your priorities':'Not graded';
    return `<rect x="${x}" y="${y}" width="218" height="330" rx="14" fill="url(#tile)" stroke="${p.accent}" stroke-opacity=".58"/>
      <path d="M${x+22} ${y+27}h32" stroke="${p.accent}" stroke-width="4"/>
      ${text(grade.label.toUpperCase(),x+22,y+68,{size:17,color:p.accent,weight:700,width:17,max:2})}
      ${text(display,x+22,y+155,{size:graded?76:25,color:graded?GRADE_COLORS[letter(grade.value)]:personal?'#eff2f8':'#a7b0be',weight:700,width:12,max:2})}
      ${graded?text(`${Math.round(grade.value)} / 100`,x+22,y+208,{size:24,weight:700,width:14}):''}
      ${text(grade.detail||(personal?'Personal to you':'Reviewed evidence required'),x+22,y+266,{size:17,color:'#b6c0cf',width:19,max:3})}`;
  }).join('');
  const nameLines=lines(name,20,3),nameSize=name.length>36?39:49;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1230" viewBox="0 0 1000 1230" role="img" aria-labelledby="title desc">
    <title id="title">${xml(name)} — Public Ledger report card</title>
    <desc id="desc">${xml(grades.map((g,i)=>`${g.label}: ${g.value===null?(i===0&&model.matchConfigured===false?'Set priorities':'Not graded'):letter(g.value)+' '+g.value+' out of 100'}`).join('. '))}. Reporting periods and evidence coverage are shown below.</desc>
    <defs><linearGradient id="tile" x2="1" y2="1"><stop stop-color="#1b2329"/><stop offset="1" stop-color="#151a22"/></linearGradient><clipPath id="photo"><rect x="60" y="166" width="340" height="452" rx="10"/></clipPath></defs>
    <rect width="1000" height="1230" fill="#0d1117"/>
    <path d="M42 41h40M46 50h32M49 59v26M62 59v26M75 59v26M42 88h40" fill="none" stroke="#d1d5db" stroke-width="5"/>
    ${text('PUBLIC LEDGER',103,70,{size:31,weight:700,width:35})}
    ${text('FOLLOW THE MONEY. CHECK THE RECORD.',42,118,{size:17,color:'#a8b6c8',width:75})}
    <rect x="40" y="146" width="920" height="498" rx="16" fill="url(#tile)" stroke="${p.accent}" stroke-width="2"/>
    <rect x="60" y="166" width="340" height="452" rx="10" fill="#202932" stroke="${p.accent}" stroke-opacity=".55"/>
    ${portrait?`<image href="${portrait}" x="60" y="166" width="340" height="452" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/>`:text(initialName(name),230,421,{size:106,color:'#c2ccda',weight:700,width:3,anchor:'middle'})}
    ${text(name,432,220,{size:nameSize,weight:700,width:20,max:3})}
    ${text(`${p.party}${model.state?' · '+model.state:''}`,432,244+(nameLines.length-1)*nameSize*1.3,{size:21,color:p.accent,width:35,max:2})}
    ${text(model.office||'Public profile',432,286+(nameLines.length-1)*nameSize*1.3,{size:21,color:'#c2ccda',width:35,max:2})}
    <path d="M432 434H932" stroke="${p.accent}" stroke-opacity=".45"/>
    ${text('CAMPAIGN SNAPSHOT',432,466,{size:16,color:'#a8b6c8',weight:700,width:40})}
    ${text('Raised',432,504,{size:17,color:'#b6c0cf',width:23})}
    ${text(amount(model.raised),432,543,{size:31,weight:700,width:15,max:2})}
    ${text('Cash on hand',694,504,{size:17,color:'#b6c0cf',width:23})}
    ${text(amount(model.cash),694,543,{size:31,weight:700,width:15,max:2})}
    ${text(model.period||'Reporting period not available',432,596,{size:16,color:'#b6c0cf',width:49,max:2,lineHeight:20})}
    ${text('FOUR MEASURES. FOLLOW THE EVIDENCE.',40,674,{size:17,color:'#b6c0cf',weight:700,width:75})}
    ${panels}
    ${text('Based on reviewed records. Coverage varies.',40,1060,{size:19,color:'#b6c0cf',width:90})}
    <rect x="40" y="1090" width="920" height="110" rx="12" fill="#141b25" stroke="${p.accent}" stroke-opacity=".5"/>
    ${text('SEE THE EVIDENCE, NOT JUST THE LETTER.',62,1127,{size:23,weight:700,width:70})}
    ${text(`${model.reviewedAt?'Research snapshot: '+model.reviewedAt+'. ':''}Some methodology weights remain under review.`,62,1158,{size:16,color:'#b6c0cf',width:102,max:2,lineHeight:20})}
    ${text('An Ethics grade is not a clearance. Missing data is not zero.',62,1183,{size:16,color:'#b6c0cf',width:102,max:1})}
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
