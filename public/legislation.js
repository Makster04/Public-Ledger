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

function billCard(row,kind){
  const source=row.source?`<a class="legislation-source" href="${escape(row.source)}" target="_blank" rel="noopener">${new URL(row.source).hostname==='www.congress.gov'?'Congress.gov':'Official record'} <span aria-hidden="true">↗</span></a>`:'';
  return `<article class="legislation-bill"><div class="legislation-bill-head"><h4>${escape(row.title)}</h4><span class="legislation-status">${escape(row.status)}</span></div>
    <p class="legislation-meta">${escape(row.measure)}${row.congress?' · '+escape(congressLabel(row.congress)):''}${row.date?' · '+escape(row.dateLabel)+' '+escape(displayDate(row.date)):''}</p>
    ${row.actedOn?`<p class="legislation-meta">${kind==='sponsored'?'Sponsored':'Cosponsored'} ${escape(displayDate(row.actedOn))}</p>`:''}
    ${row.latestAction?`<p class="legislation-meta"><b>Latest recorded action:</b> ${escape(row.latestAction)}${row.latestActionDate?' ('+escape(displayDate(row.latestActionDate))+')':''}</p>`:''}
    <div class="legislation-tags">${row.area?`<span class="chip ghost">${escape(row.area)}</span>`:''}<span class="chip ${row.reviewed?'profile-reviewed':'ghost'}">${row.reviewed?'Reviewed selection':'Refreshed record · not reviewed'}</span>${row.reviewed&&row.refreshed?'<span class="chip ghost">Latest official update · not reviewed</span>':''}${source}</div></article>`;
}

/** Mount the two bill panels, then load only existing completed snapshots. */
export function mountLegislation(host,{person,data={},recordLive}={}){
  if(!host||!person)return;
  const noCongress=!!person.office||person.chamber==='P';
  const state={snapshots:{},loading:!noCongress,error:false,query:'',congress:''};
  host.innerHTML=`<div class="legislation-toolbar"><label><span>Find a bill</span><input type="search" placeholder="Search title, measure or policy area" aria-label="Search legislative activity"></label><label><span>Congress</span><select aria-label="Filter legislative activity by Congress"><option value="">All available Congresses</option></select></label></div><div class="legislation-panels" aria-live="polite"></div>`;
  const search=host.querySelector('input'),select=host.querySelector('select'),panels=host.querySelector('.legislation-panels');
  const draw=()=>{
    const rows=collectLegislation(person,data,state.snapshots),congresses=[...new Set([...rows.sponsored,...rows.cosponsored].map(r=>r.congress).filter(Boolean))].sort((a,b)=>b-a);
    select.innerHTML='<option value="">All available Congresses</option>'+congresses.map(c=>`<option value="${c}">${escape(congressLabel(c))}</option>`).join('');select.value=state.congress;
    panels.innerHTML=[['sponsored','Sponsored Bills','legislation'],['cosponsored','Cosponsored Legislation','cosponsored']].map(([kind,title,key])=>{
      const all=rows[kind],filtered=filterLegislation(all,state),snapshot=state.snapshots[key],reported=Number.isFinite(snapshot?.count)?snapshot.count:null;
      const coverage=noCongress?'Presidents do not sponsor or cosponsor congressional bills. Executive orders and other official actions are listed below.':reported!==null?`Official snapshot reports ${reported.toLocaleString()} measures${snapshot.checkedAt?'; checked '+escape(displayDate(String(snapshot.checkedAt).slice(0,10))):''}. The cards show the records loaded here; reviewed selections may cover other periods.`
        :state.loading?'Loading completed official records. Reviewed selections appear below.':state.error?'Official records are temporarily unavailable. Reviewed selections remain available.':'Waiting for an official refresh. The reviewed selections below are not a complete legislative history.';
      const noMatch=state.query||state.congress;
      const empty=noCongress?'Not applicable to the presidency.':noMatch?'No loaded bills match these filters.':state.loading?'Loading official records…':reported===0?'The completed official snapshot returned no measures for its covered period.':'No reviewed selections are on file here yet. Waiting for official records; this does not mean no bills exist.';
      const career=kind==='sponsored'&&!noCongress&&(person.sponsoredCount!=null||person.sponsoredNote)?`<p class="legislation-meta">${person.sponsoredCount!=null?`<b>Reviewed career total:</b> ${escape(Number(person.sponsoredCount).toLocaleString('en-US'))} bills, resolutions and amendments sponsored. This total is separate from the loaded cards and official snapshot count. `:''}${escape(person.sponsoredNote||'')}</p>`:'';
      return `<section class="legislation-panel" id="leg-${kind}"><div class="legislation-panel-head"><h3>${title}</h3><span class="legislation-count" aria-label="${noCongress?'Not applicable':filtered.length+' of '+all.length+' loaded records'}">${noCongress?'Not applicable':filtered.length+(noMatch?' / '+all.length:'')+' loaded'}</span></div>${career}<p class="legislation-meta">${coverage}</p>${snapshot?`<p class="legislation-meta">${escape(legislationCoverage(snapshot))}</p><p class="legislation-meta"><a href="#updates">Refresh status &amp; history ↗</a></p>`:''}<div class="legislation-list">${!noCongress&&filtered.length?filtered.map(row=>billCard(row,kind)).join(''):`<p class="legislation-empty">${empty}</p>`}</div></section>`;
    }).join('');
  };
  search.addEventListener('input',()=>{state.query=search.value;draw();});
  select.addEventListener('change',()=>{state.congress=select.value;draw();});
  draw();
  if(noCongress){search.disabled=true;select.disabled=true;return;}
  Promise.allSettled(['legislation','cosponsored'].map(key=>recordLive?.section?recordLive.section(person.id,key):Promise.resolve(null))).then(results=>{
    if(!host.isConnected)return;
    state.loading=false;state.error=results.some(r=>r.status==='rejected');
    results.forEach((result,i)=>{if(result.status==='fulfilled'&&result.value)state.snapshots[i?'cosponsored':'legislation']=result.value;});
    draw();
  });
}
