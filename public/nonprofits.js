// Nonprofits' own tax returns (public/nonprofits.json, scripts/build-990.mjs): finding a group's return and saying what
// it shows, for the bill pages, the profiles' funder lists and outside-spending cards, and the Super PACs page. Shown,
// never graded. Donors are blacked out of public copies of a return, so the trail stops at the last nonprofit.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export const money=v=>v==null?'—':Math.abs(v)>=1e6?`$${(v/1e6).toFixed(1)}M`:Math.abs(v)>=1e3?`$${Math.round(v/1e3)}K`:`$${Math.round(v)}`;
// The same name as the build script reads it (scripts/build-990.mjs normName).
export const normName=n=>String(n||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\b(inc|incorporated|the|corp|corporation|co|llc)\b/g,' ').replace(/\s+/g,' ').trim();
// An all-capitals name in title case, keeping the usual abbreviations ("FUTURE FORWARD USA PAC" -> "Future Forward USA PAC").
const ACRONYMS=new Set(['PAC','CFG','USA','US','AFL','CIO','NRA','NEA','SEIU','LCV','AIPAC','NRDC','EDF','DC','LLC','II','III','IV','AFSCME','AFT','NAR','ABA','AMA','AHA','NFIB','HRC','EMILY','SBA','PCCC','DNC','RNC','DSCC','DCCC','NRSC','NRCC','CPAC']);
const nameTitle=n=>{const t=String(n||'');if(/[a-z]/.test(t))return t;
  return t.toLowerCase().replace(/[a-z0-9']+/g,(w,i)=>ACRONYMS.has(w.toUpperCase())?w.toUpperCase():i>0&&/^(of|and|for|the|to|in|on|a)$/.test(w)?w:w[0].toUpperCase()+w.slice(1));};
export const SECTION={3:'501(c)(3) charity',4:'501(c)(4) social welfare group',5:'501(c)(5) labor union',6:'501(c)(6) trade association',PF:'private foundation'};
// A return by tracked group key, EIN or name.
export function npOf(data,{group,ein,name}={}){
  if(!data?.orgs)return null;
  const e=group?data.groups?.[group]:ein?String(ein).replace(/\D/g,'').padStart(9,'0'):name?data.names?.[normName(name)]:null;
  return e?data.orgs[e]||null:null;
}
const top=(list,k,n=3)=>list.slice(0,n).map(x=>`${esc(nameTitle(x.name))} ${money(x[k])}`).join(', ');
// One line: what its newest return says about politics and where its money went.
export function npLine(o,{lead='Its nonprofit\'s'}={}){
  if(!o)return '';
  const p=o.political||{},paid=(p.toPoliticalOrgs||0)+(p.passedThrough||0),parts=[];
  if(p.spent)parts.push(`${money(p.spent)} on politics`);
  if(paid)parts.push(`${money(paid)} to political groups (${top(p.orgs.map(x=>({...x,v:x.paid+x.passed})),'v')})`);
  if(o.grants?.total)parts.push(`${money(o.grants.total)} in grants to ${o.grants.n} organization${o.grants.n===1?'':'s'}`);
  if(o.fundedBy?.length)parts.push(`grants from ${top(o.fundedBy,'amount',2)}`);
  return `${lead} ${o.taxYear} tax return (${esc(SECTION[o.subsection]||'nonprofit')}): ${parts.length?parts.join(' · '):'no political spending or grants reported'}. <a href="${esc(o.url)}" target="_blank" rel="noopener">Return ↗</a>`;
}
// The fuller view: totals, every political group paid, the largest grants and who among the followed nonprofits funded it.
export function npDetails(o){
  if(!o)return '';
  const p=o.political||{},rows=(list,cols)=>`<div class="tablewrap"><table><thead><tr>${cols.map(c=>`<th${c[2]?' class="r"':''}>${c[0]}</th>`).join('')}</tr></thead><tbody>${list.map(x=>`<tr>${cols.map(c=>`<td${c[2]?' class="r"':''}>${c[1](x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="np"><p class="small"><b>${esc(nameTitle(o.name))}</b> · ${esc(SECTION[o.subsection]||'nonprofit')} · Form ${esc(o.form)}, tax year ${o.taxYear} · raised ${money(o.revenue)}${o.contributions!=null?` (${money(o.contributions)} in gifts and grants, givers not public)`:''} · spent ${money(o.expenses)}${p.spent?` · on politics ${money(p.spent)}`:''}${o.lobbying?` · lobbying and political spending members can't deduct ${money(o.lobbying)}`:''} · <a href="${esc(o.url)}" target="_blank" rel="noopener">its returns ↗</a></p>
    ${p.orgs?.length?`<h5 class="np-h">Paid to political groups (super PACs and other 527s)</h5>${rows(p.orgs.slice(0,12),[['Group',x=>esc(nameTitle(x.name))],['From its own funds',x=>money(x.paid),1],['Passed on from others',x=>x.passed?money(x.passed):'—',1]])}`:''}
    ${o.grants?.top?.length?`<h5 class="np-h">Largest grants to other organizations (${o.grants.n} in all, ${money(o.grants.total)})</h5>${rows(o.grants.top.slice(0,10),[['Organization',x=>esc(nameTitle(x.name))],['Type',x=>esc(x.section||'—')],['Amount',x=>money(x.amount),1]])}`:''}
    ${o.fundedBy?.length?`<h5 class="np-h">Grants it got from other nonprofits followed here</h5>${rows(o.fundedBy,[['From',x=>esc(nameTitle(x.name))],['Year',x=>esc(x.year)],['Amount',x=>money(x.amount),1]])}`:''}</div>`;
}
// A short chip for a name on a list (a super PAC's donor, an ad's sponsor): the kind of nonprofit, with its line as the tip.
export function npChip(o){
  if(!o)return '';
  const kind=o.subsection==='3'?'charity':o.subsection==='PF'?'foundation':`501(c)(${o.subsection})`;
  const tip=npLine(o,{lead:'Its'}).replace(/<[^>]+>/g,'');
  return ` <span class="np-chip" tabindex="0" data-tip="${esc(tip)}">${esc(kind)} · doesn't name its donors</span>`;
}
