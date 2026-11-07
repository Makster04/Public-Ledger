// Legislative activity is a view of reviewed selections and completed official snapshots.
// Nothing here adds evidence to a score or changes the saved research.
const TYPES={hr:['H.R.','house-bill'],s:['S.','senate-bill'],hjres:['H.J.Res.','house-joint-resolution'],sjres:['S.J.Res.','senate-joint-resolution'],hconres:['H.Con.Res.','house-concurrent-resolution'],sconres:['S.Con.Res.','senate-concurrent-resolution'],hres:['H.Res.','house-resolution'],sres:['S.Res.','senate-resolution']};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=value=>{try{const url=new URL(String(value));return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};
const knownStatus={law:'Became law',not:'Not enacted',introduced:'Introduced',enacted:'Became law'};
const ordinal=n=>n+(n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
const congressLabel=n=>`${ordinal(n)} Congress`;
const displayDate=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):String(value||'');};

function billIdentity(row,fallbackCongress){
  const id=String(row.bill||row.id||'').toLowerCase().match(/^(\d+)-([a-z]+)-(\d+)$/);
  if(id&&TYPES[id[2]])return {key:id[0],congress:+id[1],type:id[2],number:id[3]};
  const url=link(row.source||row.url),path=url&&new URL(url).pathname.match(/^\/bill\/(\d+)(?:st|nd|rd|th)-congress\/([a-z-]+)\/(\d+)/);
  if(path){const type=Object.keys(TYPES).find(t=>TYPES[t][1]===path[2]);if(type)return {key:`${path[1]}-${type}-${path[3]}`,congress:+path[1],type,number:path[3]};}
  const measure=String(row.measure||row.num||'').replace(/[.\s]/g,'').toLowerCase().match(/^([a-z]+)(\d+)$/),congress=Number(row.congress||fallbackCongress);
  if(measure&&TYPES[measure[1]]&&Number.isInteger(congress)&&congress>0)return {key:`${congress}-${measure[1]}-${measure[2]}`,congress,type:measure[1],number:measure[2]};
  return {key:url||`${row.congress||fallbackCongress||''}|${row.measure||row.num||''}|${row.title||''}`,congress:Number(row.congress||fallbackCongress)||null};
}
const canonicalUrl=id=>id.type?`https://www.congress.gov/bill/${id.congress}th-congress/${TYPES[id.type][1]}/${id.number}`:'';

function normalize(row,{congress,reviewed=false,dateLabel='Introduced',actedOn='',index=null}={}){
  const id=billIdentity(row,congress);
  return {key:id.key,congress:id.congress,measure:row.measure||row.num||(id.type?`${TYPES[id.type][0]} ${id.number}`:'Measure number unavailable'),title:row.title||'Title not recorded',
    source:link(row.source||row.url)||canonicalUrl(id),area:row.area||row.policyArea?.name||index?.area||'',
    date:row.date||'',dateLabel,actedOn,latestAction:typeof row.latestAction==='object'?row.latestAction?.text||'':row.latestAction||index?.stage||'',
    latestActionDate:row.latestActionDate||row.latestAction?.actionDate||'',status:knownStatus[row.status]||knownStatus[index?.status]||(/^(introduced|in committee|passed (?:house|senate)|became law)$/i.test(row.status||'')?row.status:'Status not recorded'),
    reviewed,refreshed:!reviewed};
}

/** Combine records by actual bill and Congress; versions in another Congress stay separate. */
export function collectLegislation(person,data={},snapshots={}){
  const maps={sponsored:new Map(),cosponsored:new Map()};
  const add=(kind,row)=>{
    const previous=maps[kind].get(row.key);
    if(!previous){maps[kind].set(row.key,row);return;}
    const merged={...previous,...Object.fromEntries(Object.entries(row).filter(([,value])=>value!==''&&value!==null)),reviewed:previous.reviewed||row.reviewed,refreshed:previous.refreshed||row.refreshed};
    if(row.status==='Status not recorded')merged.status=previous.status;
    if(row.dateLabel==='Record date'&&previous.date){merged.date=previous.date;merged.dateLabel=previous.dateLabel;}
    maps[kind].set(row.key,merged);
  };
  for(const row of person.bills||[])add('sponsored',normalize(row,{reviewed:true}));
  for(const bill of data.billIndex||[])for(const action of bill.cosponsors||[]){
    if(action.person!==person.id)continue;
    const id=action.bill||bill.id;
    const current=id===bill.id;
    add(action.sponsor?'sponsored':'cosponsored',normalize({id,title:bill.title,area:bill.area,status:current?bill.status:undefined},
      {reviewed:true,dateLabel:'Record date',actedOn:action.date||'',index:current?bill:null}));
  }
  for(const [kind,key] of [['sponsored','legislation'],['cosponsored','cosponsored']]){
    const snapshot=snapshots[key];
    for(const row of snapshot?.rows||[])add(kind,normalize(row,{congress:snapshot.congress}));
  }
  const order=(a,b)=>String(b.latestActionDate||b.date||b.actedOn).localeCompare(String(a.latestActionDate||a.date||a.actedOn))||a.title.localeCompare(b.title);
  return {sponsored:[...maps.sponsored.values()].sort(order),cosponsored:[...maps.cosponsored.values()].sort(order)};
}

export function filterLegislation(rows,{query='',congress=''}={}){
  const q=query.trim().toLowerCase();
  return rows.filter(row=>(!congress||String(row.congress)===String(congress))&&(!q||[row.title,row.measure,row.area,row.latestAction,row.status,row.congress].join(' ').toLowerCase().includes(q)));
}

// Keep source-wide coverage visible separately from the filtered, deduplicated cards.
export function legislationCoverage(snapshot){
  if(!snapshot)return '';
  const notes=[];
  if(snapshot.since)notes.push(`Coverage since ${String(snapshot.since)}`);
  else if(snapshot.congress)notes.push(`Source Congress: ${congressLabel(Number(snapshot.congress))}`);
  const counts=Object.entries(snapshot.byCongress||{}).sort((a,b)=>Number(b[0])-Number(a[0]));
  if(counts.length)notes.push('By Congress: '+counts.map(([c,n])=>`${congressLabel(Number(c))}: ${Number(n).toLocaleString('en-US')}`).join(' · '));
  if(Array.isArray(snapshot.rows))notes.push(`${snapshot.rows.length.toLocaleString('en-US')} records supplied by this snapshot`);
  return notes.join('. ');
}

// The stage a bill reached, from its recorded status or, without one, its latest action on Congress.gov.
export function billStage(row){
  if(row.status&&row.status!=='Status not recorded')return /^not/i.test(row.status)?'Not enacted':row.status.replace(/^in committee$/i,'In Committee');
  const a=String(row.latestAction||'');
  if(/became public law|signed by (the )?president/i.test(a))return 'Became Law';
  if(/passed (the )?senate|passed senate/i.test(a))return 'Passed Senate';
  if(/passed (the )?house|passed\/agreed to in house|passed house/i.test(a))return 'Passed House';
  if(/placed on (the )?.*calendar|reported (by|to)|ordered to be reported/i.test(a))return 'Reported';
  if(/referred to/i.test(a))return 'In Committee';
  return a?'Introduced':'Status not recorded';
}
function billCard(row){
  const source=row.source?`<a class="legislation-source" href="${escape(row.source)}" target="_blank" rel="noopener"><span aria-hidden="true">↗</span> ${new URL(row.source).hostname==='www.congress.gov'?'Congress.gov':'Official record'}</a>`:'';
  const when=row.date||row.actedOn;
  return `<article class="legislation-bill"><div class="legislation-bill-head"><h4>${escape(row.title)}</h4>${billStage(row)==='Status not recorded'?'':`<span class="legislation-status">${escape(billStage(row))}</span>`}</div>
    <p class="legislation-meta">${escape(row.measure)}${row.congress?' · '+escape(congressLabel(row.congress)):''}${when?' · '+escape(displayDate(when)):''}</p>
    ${row.latestAction?`<p class="legislation-meta">Latest: ${escape(row.latestAction)}${row.latestActionDate?' ('+escape(displayDate(row.latestActionDate))+')':''}</p>`:''}
    ${row.area||source?`<div class="legislation-tags">${row.area?`<span class="legislation-area">${escape(row.area)}</span>`:''}${source}</div>`:''}</article>`;
}

/** Two boxes, Sponsored Bills and Cosponsored Legislation, each with its count; the official records fill in as they load. */
export function mountLegislation(host,{person,data={},recordLive}={}){
  if(!host||!person)return;
  const noCongress=!!person.office||person.chamber==='P';
  const state={snapshots:{},loading:!noCongress,error:false};
  host.innerHTML='<div class="legislation-panels" aria-live="polite"></div><p class="legislation-note"></p>';
  const panels=host.querySelector('.legislation-panels'),note=host.querySelector('.legislation-note');
  const ICON={sponsored:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h7l3 3v12H5z M12 2.5v3h3 M7.5 9h5 M7.5 12h5 M7.5 15h3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    cosponsored:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5h13v9h-13z M6 16.5h8 M7 9.5l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'};
  const draw=()=>{
    const rows=collectLegislation(person,data,state.snapshots);
    panels.innerHTML=[['sponsored','Sponsored Bills'],['cosponsored','Cosponsored Legislation']].map(([kind,title])=>{
      const list=rows[kind];
      const empty=noCongress?'Presidents don\'t sponsor or cosponsor bills in Congress.':state.loading?'Loading their bills…':'None on record yet.';
      return `<section class="legislation-panel" id="leg-${kind}"><div class="legislation-panel-head"><h3>${ICON[kind]}${title}</h3><span class="legislation-count">${noCongress?'—':list.length}</span></div>
        ${list.length?`<div class="legislation-list">${list.map(billCard).join('')}</div>`:`<p class="legislation-meta">${escape(empty)}</p>`}</section>`;
    }).join('');
    const counts=['legislation','cosponsored'].map(k=>state.snapshots[k]).filter(Boolean);
    note.textContent=noCongress?'':state.loading?'':state.error?'The latest official records are unavailable right now; the bills on file are shown.':counts.length?`From Congress.gov${counts[0].checkedAt?`, checked ${displayDate(String(counts[0].checkedAt).slice(0,10))}`:''}, and the reviewed research.`:'Waiting for the official refresh; the bills on file are shown, which may not be every bill.';
  };
  draw();
  if(noCongress)return;
  Promise.allSettled(['legislation','cosponsored'].map(key=>recordLive?.section?recordLive.section(person.id,key):Promise.resolve(null))).then(results=>{
    if(!host.isConnected)return;
    state.loading=false;state.error=results.some(r=>r.status==='rejected');
    results.forEach((result,i)=>{if(result.status==='fulfilled'&&result.value)state.snapshots[i?'cosponsored':'legislation']=result.value;});
    draw();
  });
}
