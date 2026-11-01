// Cross-profile views of saved campaign records and disclosures. These do not feed a grade.
import {pacKindTotals} from './pac-types.js';
import {assetKind} from './holdings.js';
import {valueRange,rangeText} from './net-worth.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const money=value=>finite(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value):'Not available';
const fullMoney=value=>finite(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value):'Not available';
const safeUrl=value=>{try{const u=new URL(String(value));return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const date=value=>{const t=String(value||'');if(!t)return 'Not recorded';const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(t);return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):t;};
const partyName=p=>({D:'Democrat',R:'Republican',I:'Independent'}[p]||p||'Not recorded');
const chamberName=p=>p.chamber==='H'?'House':p.chamber==='S'?'Senate':'Other';
const stockId=row=>row.ticker?'ticker:'+String(row.ticker).toUpperCase():'asset:'+String(row.company||row.name||row.asset||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const interval=(low,high)=>({low,high});
const formatRange=x=>rangeText(x,money)||'Range not recorded';
const sourceLink=(url,label='Official filing')=>safeUrl(url)?`<a href="${escape(safeUrl(url))}" target="_blank" rel="noopener">${escape(label)} ↗</a>`:'';
const personId=p=>String(p.id||'');
const includedPeople=model=>(model.people||[]).filter(p=>['S','H'].includes(p.chamber)&&!p.office);
const snapshotFor=(snapshots,p)=>snapshots?.people?.[p.id]||{};

export function stockHoldingRange(report){
  if(!report||report.unreadable||!Array.isArray(report.assets)||!report.assets.length)return null;
  const stocks=report.assets.filter(a=>assetKind(a)==='stock');
  const ranges=stocks.map(a=>valueRange(a.value));
  if(ranges.some(r=>!r))return null;
  return {low:ranges.reduce((n,r)=>n+r[0],0),high:ranges.some(r=>r[1]===null)?null:ranges.reduce((n,r)=>n+r[1],0),count:stocks.length};
}

/** Missing values stay absent; disclosed ranges are ranked by their lower bound, never a fabricated midpoint. */
export function buildRankingRows(people,data={},snapshots={},metric='raised',filters={}){
  const rows=[];
  for(const person of people||[]){
    if(person.office||!['S','H'].includes(person.chamber))continue;
    if(filters.party&&person.party!==filters.party||filters.state&&person.state!==filters.state||filters.chamber&&person.chamber!==filters.chamber)continue;
    const official=snapshotFor(snapshots,person),camp=person.camp&&!person.camp.missing?person.camp:official.campaign;
    let value=null,display='',period='',source='',note='';
    if(metric==='raised'){
      value=finite(camp?.receipts)?camp.receipts:null;display=money(value);period=camp?.start||camp?.end?`${date(camp.start)}–${date(camp.end)}`:'';source=camp?.src||camp?.source||'';
    }else if(metric==='corporate'){
      const itemized=person.pac?.rows;
      if(itemized?.length){value=pacKindTotals(data,itemized).find(r=>r.kind==='corporate')?.total||0;note='Matched corporate contributions only; unclassified PACs excluded';period=person.pac.window||'';source=person.pac.filings?.[0]?.url||'';}
      else if(camp?.pac===0){value=0;period=camp?.end?'Through '+date(camp.end):'';note='No PAC receipts in this reporting period';source=camp?.src||camp?.source||'';}
      display=money(value);
    }else if(metric==='networth'){
      const n=official.netWorth;if(n&&!n.unreadable&&finite(n.low)){value=n.low;display=formatRange(n);period=n.year?`${n.year} annual disclosure`:'';source=n.url||'';note='Assets minus debts; disclosed range';}
    }else if(metric==='holdings'){
      const n=official.netWorth,r=stockHoldingRange(n);if(r){value=r.low;display=formatRange(r);period=n.year?`${n.year} annual disclosure`:'';source=n.url||'';note=r.count+' individual-stock or option positions';}
    }
    if(value===null)continue;
    rows.push({person,value,display,period,source,note});
  }
  return rows.sort((a,b)=>b.value-a.value||a.person.name.localeCompare(b.person.name));
}

const tradeType=value=>{const t=String(value||'').toLowerCase();return /purchase|\bbuy\b|^p$/.test(t)?'Buy':/sale|\bsell\b|^s$/.test(t)?'Sell':'Other';};
function tradeRange(row){
  if(finite(row.low))return interval(row.low,finite(row.high)?row.high:null);
  const r=valueRange(row.amount);return r?interval(r[0],r[1]):null;
}

/** Combine only the available reviewed records and existing published official snapshots. */
export function collectStockData(people,snapshots={}){
  const trades=[],holdings=[];
  for(const person of people||[]){
    if(person.office||!['S','H'].includes(person.chamber))continue;
    const official=snapshotFor(snapshots,person),seen=new Map();
    for(const [rows,reviewed] of [[person.trades||[],true],[official.trades||[],false]])for(const row of rows){
      const company=row.company||row.name||(!['stock','option','fund'].includes(row.asset)?row.asset:'')||row.ticker||'Asset not recorded';
      const amount=tradeRange(row),asset=stockId({...row,company});
      const fingerprint=[personId(person),asset,row.traded,tradeType(row.type),amount?.low,amount?.high,row.owner||''].join('|');
      const key=row.id?personId(person)+'|id:'+row.id:fingerprint;
      const url=row.official?.url||row.links?.[0]||row.src?.u||row.source?.u||row.link||row.url||'';
      if(seen.has(key)){const old=seen.get(key);old.reviewed=old.reviewed||reviewed;if(row.official?.url)old.source=row.official.url;continue;}
      const item={person,id:row.id||'',assetId:asset,ticker:row.ticker||'',company,traded:row.traded||'',filed:row.filed||row.disclosed||'',type:tradeType(row.type),amount,amountText:row.amount|| (amount?formatRange(amount):'Range not recorded'),owner:row.owner||'Not recorded',reviewed,source:safeUrl(url),sources:row.sources||[],review:row.review||[]};
      seen.set(key,item);trades.push(item);
    }
    const report=official.netWorth;
    if(report&&!report.unreadable)for(const asset of report.assets||[]){
      if(assetKind(asset)!=='stock')continue;
      const raw=valueRange(asset.value);
      holdings.push({person,assetId:stockId(asset),ticker:asset.ticker||'',company:asset.name||'Asset not recorded',amount:raw?interval(raw[0],raw[1]):null,amountText:asset.value||'Range not recorded',owner:asset.owner||'Not recorded',year:report.year||'',filed:report.filed||'',source:safeUrl(report.url),reviewed:false});
    }
  }
  trades.sort((a,b)=>String(b.traded).localeCompare(String(a.traded))||String(b.filed).localeCompare(String(a.filed)));
  return {trades,holdings};
}

export function filterStockRows(rows,{query='',party='',chamber=''}={}){
  const q=query.trim().toLowerCase();
  return rows.filter(r=>(!party||r.person.party===party)&&(!chamber||r.person.chamber===chamber)&&(!q||[r.ticker,r.company,r.person.name,r.person.state,r.person.stateName].join(' ').toLowerCase().includes(q)));
}

let officialCache=null,officialTime=0;
function officialData(model){
  if(model.financeSnapshot)return Promise.resolve(model.financeSnapshot);
  if(model.loadFinanceData)return Promise.resolve().then(()=>model.loadFinanceData());
  if(!officialCache||Date.now()-officialTime>60000){officialTime=Date.now();officialCache=fetch('/api/finance-overview',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Official snapshot unavailable');return r.json();}).catch(error=>{officialCache=null;throw error;});}
  return officialCache;
}
const alive=(host,token,hash)=>host.isConnected&&host.__financeToken===token&&location.hash===hash;
const photo=(person,portraits)=>{const src=portraits?.[person.id]?.file;return src?`<img class="ranking-portrait" src="/${escape(src)}" alt="" loading="lazy">`:`<span class="ranking-portrait ranking-initials" aria-hidden="true">${escape(person.name.split(/\s+/).map(n=>n[0]).slice(0,2).join(''))}</span>`;};
const METRICS={raised:{title:'Campaign funds raised',detail:'Reporting periods vary by campaign; each row retains its dates.'},corporate:{title:'Corporate PAC contributions',detail:'Corporate-sponsored PACs matched to FEC records, from the itemized contributions saved here. Coverage and reporting periods vary; this is not an estimate of a complete corporate total.'},networth:{title:'Disclosed net-worth ranges',detail:'Latest available annual disclosures, sorted by the lower end of assets minus debts. These are ranges, not exact wealth estimates; reports may cover different years.'},holdings:{title:'Disclosed individual-stock holdings',detail:'Individual stocks and options in the latest available annual disclosures, sorted by the lower end of each range. Funds, private stock and blind-trust contents are excluded.'}};

export function mountRankings(host,model={}){
  const token=Symbol(),hash=location.hash;host.__financeToken=token;
  const people=includedPeople(model),state={metric:'raised',party:'',state:'',chamber:'',snapshots:{},loading:true,error:false};
  const states=[...new Map(people.map(p=>[p.state,p.stateName||p.state])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  host.innerHTML=`<section class="explore-page"><header class="explore-heading"><h1>Rankings</h1><p>Compare the public records, one measure at a time.</p></header><section class="ranking-panel"><div class="ranking-heading"></div><div class="explore-toolbar"><label><span>Measure</span><select aria-label="Ranking metric">${Object.entries(METRICS).map(([id,m])=>`<option value="${id}">${m.title}</option>`).join('')}</select></label><label><span>State</span><select aria-label="Filter rankings by state"><option value="">All states</option>${states.map(([id,name])=>`<option value="${escape(id)}">${escape(name)}</option>`).join('')}</select></label><label><span>Party</span><select aria-label="Filter rankings by party"><option value="">All parties</option><option value="D">Democrats</option><option value="R">Republicans</option><option value="I">Independents</option></select></label><label><span>Chamber</span><select aria-label="Filter rankings by chamber"><option value="">All chambers</option><option value="S">Senate</option><option value="H">House</option></select></label></div><div class="ranking-list"></div><p class="explore-coverage" role="status"></p></section><p class="explore-notice">These comparisons cover profiles with available records, not every member of Congress. Missing figures are excluded from ranking and never treated as zero. <a href="#scores">Explore the four grade comparisons →</a></p></section>`;
  const draw=()=>{
    const rows=buildRankingRows(people,model.data,state.snapshots,state.metric,state),shown=rows.slice(0,10),metric=METRICS[state.metric];
    host.querySelector('.ranking-heading').innerHTML=`<h2>Top ${shown.length||10} · ${escape(metric.title)}</h2><p>${escape(metric.detail)}</p>`;
    host.querySelector('.ranking-list').innerHTML=shown.length?shown.map((r,i)=>`<article class="ranking-row" data-id="${escape(r.person.id)}" data-party="${escape(r.person.party)}" data-state="${escape(r.person.state)}" data-chamber="${escape(r.person.chamber)}"><span class="ranking-position">#${i+1}</span>${photo(r.person,model.portraits)}<div class="ranking-person"><a href="#${escape(r.person.id)}">${escape(r.person.name)}</a><p>${escape(r.person.stateName||r.person.state)} · ${chamberName(r.person)} <span class="chip ${escape(r.person.party)}">${escape(r.person.party)}</span></p><small>${escape(r.period)}${r.note?' · '+escape(r.note):''}</small></div><div class="ranking-value"><strong title="${escape(fullMoney(r.value))}">${escape(r.display)}</strong>${r.source?sourceLink(r.source,'Source'):''}</div></article>`).join(''):`<div class="ranking-empty"><h3>${state.loading?'Loading available records…':'No comparable records for these filters'}</h3><p>${['networth','holdings'].includes(state.metric)?'Annual disclosure values will appear when completed reports are available in the saved records. No wealth or stock value has been assumed.':'Choose a different state, party, chamber or measure.'}</p></div>`;
    host.querySelector('.explore-coverage').textContent=`Showing ${shown.length} of ${rows.length} profiles with an available value.${state.loading?' Loading saved official disclosures…':state.error?' The official snapshot service is unavailable; reviewed campaign records remain visible.':' Only available saved records are included.'}`;
  };
  const controls=host.querySelectorAll('.explore-toolbar select');['metric','state','party','chamber'].forEach((key,i)=>controls[i].addEventListener('change',()=>{state[key]=controls[i].value;draw();}));
  draw();officialData(model).then(snapshot=>{if(!alive(host,token,hash))return;state.snapshots=snapshot;state.loading=false;draw();}).catch(()=>{if(!alive(host,token,hash))return;state.loading=false;state.error=true;draw();});
}

function showStockDetails(row,all){
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='stock-dialog';dialog.setAttribute('aria-labelledby','stock-detail-title');
  const trades=all.trades.filter(r=>r.assetId===row.assetId),holders=all.holdings.filter(r=>r.assetId===row.assetId);
  const item=r=>`<li><a href="#${escape(r.person.id)}-ethics">${escape(r.person.name)}</a><span class="chip ${escape(r.person.party)}">${escape(partyName(r.person.party))}</span><p>${r.year?escape(r.year)+' annual disclosure':escape(r.type)+' · '+escape(date(r.traded))} · ${escape(r.amountText)} · ${escape(r.owner)}</p>${sourceLink(r.source)}</li>`;
  dialog.innerHTML=`<div class="stock-dialog-head"><div><p class="page-eyebrow">DISCLOSURE RECORD</p><h2 id="stock-detail-title">${escape(row.ticker||row.company)}</h2>${row.ticker?`<p>${escape(row.company)}</p>`:''}</div><button type="button" class="explore-btn">Close</button></div><div class="stock-dialog-body"><p class="explore-notice">Values are disclosure ranges, not current market values. Price history, performance returns and S&amp;P 500 comparisons are not present in the saved dataset.</p><h3>Available holdings (${holders.length})</h3>${holders.length?`<ul class="stock-members">${holders.map(item).join('')}</ul>`:'<p class="ranking-empty">No holdings for this asset in the available annual reports. A trade does not establish a current holding.</p>'}<h3>Available transactions (${trades.length})</h3>${trades.length?`<ul class="stock-members">${trades.map(item).join('')}</ul>`:'<p>No transactions for this asset in the available records.</p>'}</div>`;
  const close=()=>dialog.close();dialog.querySelector('button').addEventListener('click',close);dialog.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',close));dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();},{once:true});
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();});document.body.append(dialog);dialog.showModal();
}

export function mountStocks(host,model={}){
  const token=Symbol(),hash=location.hash;host.__financeToken=token;
  const people=includedPeople(model),state={tab:'latest',query:'',page:0,sort:'date',direction:-1,snapshots:{},loading:true,error:false},pageSize=25;
  host.innerHTML=`<section class="explore-page"><header class="explore-heading"><p class="page-eyebrow">THE FINANCIAL RECORD</p><h1>Congressional Stock Activity</h1><p>Explore disclosed trades and individual-stock holdings in the records available here.</p></header><div class="stocks-tabs" role="tablist" aria-label="Stock activity views"><button type="button" role="tab" data-stocks-tab="latest" aria-selected="true">Latest trades</button><button type="button" role="tab" data-stocks-tab="holdings" aria-selected="false">Total holdings</button><button type="button" role="tab" data-stocks-tab="performers" aria-selected="false">Top performers</button></div><div class="stocks-controls"><label class="stocks-search"><span class="sr-only">Search stocks or members</span><input type="search" aria-label="Search stocks or members" placeholder="Search ticker, company or member name…"></label></div><div class="stocks-content" role="tabpanel" aria-label="Stock activity records"></div><p class="explore-coverage" role="status"></p></section>`;
  const content=host.querySelector('.stocks-content'),coverage=host.querySelector('.explore-coverage');
  const draw=()=>{
    const all=collectStockData(people,state.snapshots);
    const limited=Object.values(state.snapshots.people||{}).some(p=>p.tradesTruncated);
    host.querySelectorAll('[data-stocks-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.stocksTab===state.tab));b.tabIndex=b.dataset.stocksTab===state.tab?0:-1;});
    host.querySelector('.stocks-search').hidden=state.tab==='performers';
    if(state.tab==='performers'){content.innerHTML=`<section class="ranking-panel"><h2>Performance is not calculated</h2><p>The saved project records contain disclosures, not a verified market-price history. We cannot calculate investment returns or compare them with the S&amp;P 500 from these records.</p><p>Latest trades and holdings remain available. The existing Ethics and trading indexes assess disclosures and potential conflicts; they do not measure investment returns.</p><a href="#method">Read the methodology →</a></section>`;coverage.textContent='Performance comparisons require verified market-price history.';return;}
    const raw=state.tab==='latest'?all.trades:all.holdings,rows=filterStockRows(raw,state).slice();
    const sortValue=r=>state.sort==='member'?r.person.name:state.sort==='asset'?(r.ticker||r.company):state.sort==='amount'?(r.amount?.low??-Infinity):state.tab==='latest'?r.traded:String(r.year);
    rows.sort((a,b)=>{const x=sortValue(a),y=sortValue(b);return(typeof x==='number'?x-y:String(x).localeCompare(String(y)))*state.direction;});
    const pages=Math.max(1,Math.ceil(rows.length/pageSize));state.page=Math.min(state.page,pages-1);const shown=rows.slice(state.page*pageSize,(state.page+1)*pageSize);
    const head=(id,label)=>`<button type="button" data-sort="${id}">${label}${state.sort===id?(state.direction===1?' ↑':' ↓'):''}</button>`;
    content.innerHTML=`<p class="explore-notice">${state.tab==='latest'?'Amounts are reported transaction ranges; no return percentage is inferred.':'Latest available annual reports, whose years vary. These are individual-stock and option positions, not live portfolio values; funds and private stock are excluded.'}</p><div class="tablewrap"><table class="stocks-table" id="stocks-table"><thead><tr><th>${head('asset','Asset')}</th><th>${head('member','Member')}</th><th>${head('amount','Disclosed range')}</th>${state.tab==='latest'?'<th>Type</th>':''}<th>${head('date',state.tab==='latest'?'Transaction date':'Report year')}</th><th>${state.tab==='latest'?'Disclosure date':'Owner'}</th><th>Record</th></tr></thead><tbody>${shown.map((r,i)=>`<tr><td><button class="stocks-asset" type="button" data-asset="${i}">${escape(r.ticker||r.company)}</button>${r.ticker?`<small>${escape(r.company)}</small>`:''}</td><td><a href="#${escape(r.person.id)}-ethics">${escape(r.person.name)}</a> <span class="chip ${escape(r.person.party)}">${escape(r.person.party)}</span></td><td>${escape(r.amountText)}</td>${state.tab==='latest'?`<td><span class="stocks-type ${r.type.toLowerCase()}">${escape(r.type)}</span></td>`:''}<td>${escape(state.tab==='latest'?date(r.traded):r.year||'Not recorded')}</td><td>${escape(state.tab==='latest'?date(r.filed):r.owner)}</td><td><span class="small muted">${r.reviewed?'Reviewed':'Refreshed · not reviewed'}</span>${r.source?'<br>'+sourceLink(r.source):''}${r.review?.length?'<br><span class="small">Flagged for review</span>':''}</td></tr>`).join('')||`<tr><td colspan="7"><div class="ranking-empty"><h3>${state.loading?'Loading saved disclosures…':'No matching records available'}</h3><p>${state.query?'Try a different ticker, company or member name.':'No '+(state.tab==='latest'?'transactions':'individual-stock holdings')+' have been loaded for the available profiles. Missing records do not establish that no trades or holdings exist.'}</p></div></td></tr>`}</tbody></table></div><div class="explore-pagination"><span>${rows.length?'Showing '+(state.page*pageSize+1)+'–'+Math.min((state.page+1)*pageSize,rows.length)+' of '+rows.length:'0 available records'}</span><div><button type="button" class="explore-btn" data-page="previous" ${state.page===0?'disabled':''}>Previous</button><span>Page ${state.page+1} of ${pages}</span><button type="button" class="explore-btn" data-page="next" ${state.page>=pages-1?'disabled':''}>Next</button></div></div>`;
    content.querySelectorAll('[data-sort]').forEach(b=>b.addEventListener('click',()=>{if(state.sort===b.dataset.sort)state.direction*=-1;else{state.sort=b.dataset.sort;state.direction=state.sort==='date'||state.sort==='amount'?-1:1;}state.page=0;draw();}));
    content.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{state.page+=b.dataset.page==='next'?1:-1;draw();}));
    content.querySelectorAll('[data-asset]').forEach(b=>b.addEventListener('click',()=>showStockDetails(shown[+b.dataset.asset],all)));
    coverage.textContent=`${all.trades.length} transactions and ${all.holdings.length} holdings from available saved records.${state.loading?' Loading official snapshots…':state.error?' Official snapshots are temporarily unavailable.':''}${state.snapshots.checkedAt?' Latest snapshot check: '+date(state.snapshots.checkedAt)+'.':''}${limited?' Some trade histories are capped at 1,500 records per person or are still being read.':''} Coverage is limited; amounts are not current market values.`;
  };
  host.querySelector('input').addEventListener('input',e=>{state.query=e.target.value;state.page=0;draw();});
  host.querySelectorAll('[data-stocks-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.stocksTab;state.page=0;state.sort='date';state.direction=-1;draw();}));
  host.querySelector('.stocks-tabs').addEventListener('keydown',e=>{const tabs=[...host.querySelectorAll('[data-stocks-tab]')],i=tabs.indexOf(document.activeElement);let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();tabs[next].click();tabs[next].focus();});
  draw();officialData(model).then(snapshots=>{if(!alive(host,token,hash))return;state.snapshots=snapshots;state.loading=false;draw();}).catch(()=>{if(!alive(host,token,hash))return;state.loading=false;state.error=true;draw();});
}
