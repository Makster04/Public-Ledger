import {mountRankings,mountStocks} from './explore-finance.js';
import {mountConsistency} from './consistency.js';
import {moneyMapBlock} from './money-map.js';
import {mountLegislation} from './legislation.js';
import {openScorecard} from './scorecard.js';
import {KV_MIN,leanOfVote,whyNotMarked,sideTaken,keyVoteRows,keyVoteScore,positionByCategory,poolIdeo} from './lean.js';
import {MIN_CHECKS,MIN_PVP_ACTIONS,ETHICS_COST,CASE_KIND,CASE_AGE,INDEX_COST,LATE_DAYS,WEIGHT,ACTION_TYPES,letter,billKey,matchScore,promiseScore,moneyRatio,GAINS_STEPS,ACCESS_STEPS,BILL_GROUPS,BILL_STATUS,HOLDINGS,CORP_COMPROMISED,INSIDER,DODGER} from './grades.js';
import {makeScorer,voteBill} from './scoring.js';
import {money,hoverTips,tableView,legend,rankBars,stackRows,divergingRows,leanRows,categoryBars,drawScatter,drawDelay,drawTradeTimeline,drawCaseTimeline,drawTreemap,drawMonthly,sectorSpendBars} from './charts.js';
import {makeOrgs,SMALL_DOLLAR_ABOUT,EMPLOYER_ABOUT} from './orgs.js';
import {billFamilies,groupInfo,issueEvidence} from './bills.js';
import {sizeParts,sizeShare} from './donor-sizes.js';
import {pacTypeOf,pacKindTotals} from './pac-types.js';
import {rangeText} from './net-worth.js';
import {pledgeCheck} from './pledges.js';
import {holdingsLead,reviewedHoldingsSummary,assetKind} from './holdings.js';
import {SIX,UNBOUGHT,UNBOUGHT_PAC_LABEL,unbought,unboughtPledges,aboveBoard,leanLabel} from './six-scores.js';
import {OUTCOME,raceResult,outcomeOf,seatNote,resultCounts,termAfter,tallyOf,sharePct,nomineeKey,seatChange,countyTally} from './results.js';
import {integrityPreview,previewCci,workersPreview,fundraisingPledgePoints,coversPeriod} from './integrity.js';
import {ALIGN_LABEL,SECTOR_LABEL_EXTRA,TOP_DONORS,WINDOW_MONTHS,SWING,categoryAlign,outsideBySector,topDonors,voteDonorAlignment,donorLoyalty,DONOR_LOYALTY,timingFlags,positionChangeFlags,stockFlags,tradesInDonors,corp,addMonths} from './influence.js';
(function(){
const $=s=>document.querySelector(s);
const app=$('#app'), tip=$('#tip');
const MEM=DATA.members, CANDS=DATA.cands||[], ALL=MEM.concat(CANDS);
const toneAttrs=(value,direction='neutral')=>{
  if(direction==='neutral'||value==null)return '';
  const n=Number(value);if(!Number.isFinite(n))return '';
  const bounded=Math.max(0,Math.min(100,n)),goodness=direction==='bad'?100-bounded:bounded;
  return ` class="score-tone" style="--score-goodness:${goodness}%" title="Higher scores are ${direction==='bad'?'less':'more'} favorable"`;
};
// Featured profiles (the president) get a card at the top of the home page and a full profile, but stay out of the
// filters, races, comparisons and score pages, which cover the 2026 ballot.
const FEATURED=DATA.featured||[];
const byId=Object.fromEntries(ALL.concat(FEATURED).map(s=>[s.id,s]));
// Every sitting senator (public/senate.json, from scripts/build-senate.mjs). Those without a reviewed profile get a basic
// one: their place in the Senate, their committees and the records the daily refresh collects, without grades.
const SENATE=(window.SENATE||[]).map(x=>({...x,chamber:'S',ideo:poolIdeo(DATA.pools?.S,x.bioguide,x.party)}));
const BASIC=Object.fromEntries(SENATE.filter(x=>!byId[x.id]).map(x=>[x.id,Object.assign(x,{basic:true,evidence:{},statements:[],ethics:[],bills:[]})]));
const BASIC_LIST=Object.values(BASIC);
// One ID per bill ("117-hr-1319"), so a vote and a sponsorship on the same bill count once.
const VOTE_BY_ID=new Map(DATA.votes.concat(DATA.hvotes).map(v=>[v.id,v]));
for(const s of ALL.concat(FEATURED))for(const ev of Object.values(s.evidence||{}))for(const e of ev){
  if(e.bill)continue;
  const v=VOTE_BY_ID.get(e.ref);if(v){e.bill=voteBill(v);continue;}
  const m=/:bill:(\d+)$/.exec(e.ref||''), b=m&&(s.bills||[])[+m[1]];if(b)e.bill=billKey(b.congress,b.num);
}
// Sponsorships and cosponsorships of the bills on the Bills page that count in Your match (public/bills.js).
for(const [id,list] of issueEvidence(DATA))for(const {issue,entry} of list){const s=byId[id];if(!s)continue;const ev=(s.evidence||={})[issue]||=[];if(!ev.some(e=>e.bill===entry.bill))ev.push(entry);}
// The reviewed grades come from public/scoring.js, shared with the monthly recalculation. Committee assignments
// (public/committees.json) and the sectors each committee oversees (public/committee-sectors.json) feed the Ethics
// committee-conflict check.
const COMMITTEES=window.COMMITTEES||{committees:{},people:{}}, COMMITTEE_SECTORS=window.COMMITTEE_SECTORS||{};
const SCORER=makeScorer(DATA,COMMITTEES,COMMITTEE_SECTORS,window.VOTE_PARTY);
const PVP_MARKS=SCORER.marks, PVP_BILLS=SCORER.bills, committeesOf=SCORER.committeesOf, fullCommittee=SCORER.fullCommittee, overseenSectors=SCORER.overseen;
const personPvp=SCORER.pvp, personTrading=SCORER.trading, personEthics=SCORER.ethics;
const icH=s=>s.ideoKind==='house'?'H':s.chamber;
const chipCh=s=>s.office?CH[s.chamber].member:s.senInc?'Senate':s.cand?(s.openSeat?'Senate candidate':(s.chamber==='S'?'Senate challenger':'House challenger')):CH[s.chamber].name;
const CH={S:{name:'Senate',noun:'senator',nouns:'senators',votes:DATA.votes,member:'Senate'},H:{name:'House',noun:'representative',nouns:'representatives',votes:DATA.hvotes,member:'House'},P:{name:'Presidency',noun:'president',nouns:'presidents',votes:[],member:'President'}};
const fmt$=n=>{if(n==null)return'—';const a=Math.abs(n);if(a>=1e6)return'$'+(n/1e6).toFixed(a>=1e7?1:2)+'M';if(a>=1e3)return'$'+(n/1e3).toFixed(a>=1e5?0:1)+'K';return'$'+n.toFixed(0)};
const fmtFull=n=>n==null?'—':'$'+Math.round(n).toLocaleString('en-US');
const pct=(a,b)=>b?Math.round(a/b*1000)/10:0;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ASSESS={pending:['neutral','No related bill yet'],consistent:['good','Consistent'],contradiction:['crit','Direct contradiction'],partial:['warn','Partly consistent'],unclear:['neutral','Ambiguous or incomplete evidence'],changed:['serious','Changed position'],outcome:['neutral','Outcome check']};
const ICON={good:'✓',crit:'✕',warn:'◐',serious:'↻',neutral:'◇'};
const FOUND_IN={floor:'a floor speech',press:'a press release',bluesky:'a Bluesky post',threads:'a Threads post',youtube:'a YouTube video'};
const AICON={pending:'…',consistent:'✓',contradiction:'✕',partial:'◐',unclear:'?',changed:'↻',outcome:'◇'};
const posClass=p=>{p=(p||'').toLowerCase();if(p==='yea'||p==='guilty')return'yea';if(p==='nay'||p==='not guilty')return'nay';return'nv'};
const voteUrl=v=>v.roll!=null?`https://clerk.house.gov/Votes/${v.year}${v.roll}`:`https://www.senate.gov/legislative/LIS/roll_call_votes/vote${v.congress}${v.session}/vote_${v.congress}_${v.session}_${String(v.number).padStart(5,'0')}.htm`;
const partyName=p=>p==='R'?'Republican':p==='D'?'Democrat':'Independent';
const seatLabel=s=>s.chamber==='H'?s.district:s.state;
const REC_SHORT={senator:'Senator',member_of_congress:'House member',former_member_of_congress:'Ex-member of Congress',state_legislator:'State legislator',executive:'Executive office',none:'No elected office'};
const REC_LABEL={senator:'Sitting U.S. senator',member_of_congress:'Sitting U.S. House member',former_member_of_congress:'Former member of Congress',state_legislator:'State legislator',executive:'Executive / appointed office',none:'No prior elected office'};
const fmtDate=d=>{if(!d)return'—';const m=d.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return d;return new Date(+m[1],+m[2]-1,+m[3]).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
const cgUrl=s=>`https://www.congress.gov/member/${s.name.toLowerCase().replace(/-/g,' ').replace(/[^a-z ]/g,'').trim().split(/\s+/).filter(w=>w.length>1).join('-')}/${s.bioguide}`;
const fecCandUrl=id=>id[0]==='P'?`https://www.fec.gov/data/candidate/${id}/`:`https://www.fec.gov/data/candidate/${id}/?cycle=2026&election_full=true`;
const fecCmteUrl=id=>`https://www.fec.gov/data/committee/${id}/?cycle=2026`;
const fecIeUrl=id=>`https://www.fec.gov/data/independent-expenditures/?data_type=processed&cycle=2026&candidate_id=${id}`;
let resizers=[];
window.addEventListener('resize',()=>{clearTimeout(window.__rz);window.__rz=setTimeout(()=>resizers.forEach(f=>f()),120)});

// ---------- ideology helpers ----------
function ideoText(s){
  const i=s.ideo;
  if(!i){
    if(s.ideoKind==='former_text'){const m=(s.ideoNote||'').match(/more (conservative|liberal) than \d+% of the \d+\w* (House|Senate)/i);const ph=m?m[0]:'scored by Voteview';return {head:'In Congress: '+ph,within:'',short:'Voteview: '+ph}}
    if(s.ideoKind==='state'&&s.stateIdeology)return {head:s.stateIdeology.text,within:'',short:s.stateIdeology.text};
    if(s.ideoKind==='former_noscore')return {head:'Former member of Congress',within:'',short:'Ideology score not retrieved'};
    if(hasStateLeg(s))return {head:'No comparable ideology score',within:'',short:(s.recordType==='state_legislator'?'State legislator':'Former state legislator')+' (no comparable score)'};
    return {head:'No legislative voting record',within:'',short:'No legislative voting record'};
  }
  const ch=CH[icH(s)].name, grp=s.party==='R'?(ch+' Republicans'):(ch+' Democrats');
  const hi=Math.round((100-i.lo)*10)/10, phi=Math.round((100-i.plo)*10)/10;
  const head=s.party==='R'?`More conservative than ${i.lo}% of the ${ch}`:`More liberal than ${hi}% of the ${ch}`;
  let within;
  if(s.party==='R') within=i.plo>=50?`more conservative than ${i.plo}% of ${grp}`:(i.plo===0?`the most moderate of ${i.np+1} ${grp} scored`:`more moderate than ${phi}% of ${grp}`);
  else within=phi>=50?`more liberal than ${phi}% of ${grp}`:(phi===0?`the most moderate of ${i.np+1} ${grp} scored`:`more moderate than ${i.plo}% of ${grp}`);
  const short=s.party==='R'?`More conservative than ${Math.round(i.lo)}% of ${ch}`:`More liberal than ${Math.round(hi)}% of ${ch}`;
  return {head,within,short};
}
const hasStateLeg=s=>s.recordType==='state_legislator'||!!(s.stateLeg&&s.stateLeg.length);
function noIdeoBlock(s){
  const t=ideoText(s);
  let body;
  if(s.ideoKind==='former_text') body=`<p style="margin:8px 0 0">${esc(s.short)} served in Congress (see offices held above). Voteview's own summary: <b>${esc((s.ideoNote||'').replace(/^.*?It says: /,'').replace(/^Voteview: /,''))}</b> <a href="${esc((s.ideoSrc||{}).u||'#')}" target="_blank" rel="noopener">Voteview ↗</a></p><p class="small muted" style="margin:6px 0 0">That comparison is with colleagues in that Congress, not today's, so it is not placed on the current-chamber chart used for sitting members.</p>`;
  else if(s.ideoKind==='state') body=`<p style="margin:8px 0 0">${esc(s.stateIdeology.text)} <a href="${esc(s.stateIdeology.src.u)}" target="_blank" rel="noopener">${esc(s.stateIdeology.src.t)} ↗</a></p><p class="small muted" style="margin:6px 0 0">A state-legislature ranking, not comparable with congressional DW-NOMINATE scores.</p>`;
  else if(s.ideoKind==='former_noscore') body=`<p style="margin:8px 0 0">${esc(s.short)} served in Congress, but Voteview's page did not show an ideology score or comparison for ${esc(s.short)} when this release was built, so no percentile is shown. ${esc(s.short)}'s congressional votes are listed below. ${s.ideoSrc?`<a href="${esc(s.ideoSrc.u)}" target="_blank" rel="noopener">Voteview record ↗</a>`:''}</p>`;
  else if(hasStateLeg(s)) body=`<p style="margin:8px 0 0">${esc(s.short)}'s legislative votes were cast in a state legislature, which has no published score comparable with congressional DW-NOMINATE. The record below lists ${s.recordType==='state_legislator'?esc(s.short)+"'s recorded votes and bills on major issues":'major official actions'+(s.recordType==='executive'?' in executive office':'')} instead.</p>`;
  else body=`<p style="margin:8px 0 0">${esc(s.short)} has not served in a legislature, so there is no roll-call record to score. The record below lists ${esc(s.short)}'s documented official actions and public commitments instead.</p>`;
  return `<div class="chart"><div class="kicker">Voting ideology</div><div class="big" style="margin-top:4px">${esc(t.head)}</div>${body}</div>`;
}
function ideoBlock(s,id){
  if(!s.ideo)return noIdeoBlock(s);
  const t=ideoText(s), i=s.ideo, C=icH(s);
  return `<div class="chart">
    <div class="ideo-head"><div><div class="kicker">Voting ideology · DW-NOMINATE</div><div class="big" style="margin-top:4px">${esc(t.head)}</div></div>
    <div class="mono muted">Score ${i.dim1>0?'+':''}${i.dim1.toFixed(3)} on a −1 (liberal) to +1 (conservative) scale</div></div>
    <p class="small" style="margin:8px 0 0;color:var(--ink-2)">Within the party: ${esc(t.within)}.${i.unity!=null?` Party unity: votes with the ${s.party==='R'?'Republican':'Democratic'} majority on <b class="num">${i.unity}%</b> of party-line votes${i.partyVotes?` (${i.withParty} of ${i.partyVotes} in the 119th Congress)`:''}.`:''}</p>
    <div class="ideo" id="${id}" style="margin-top:10px"></div>
    <div class="legend"><span><i style="background:var(--dem)"></i>Democrats</span><span><i style="background:var(--rep)"></i>Republicans</span>${C==='S'?'<span><i style="background:var(--muted)"></i>Independents</span>':''}<span><i style="background:var(--ink);border-radius:50%"></i>${esc(s.short)}</span></div>
    <div class="sub" style="margin:8px 0 0">${s.ideoKind==='house'?esc(s.short)+' is a sitting House member, so the comparison is with the current House. ':''}Each dot is one current ${CH[C].noun} with at least 100 scored votes (${i.n+1} in all). Hover a dot for the name. Source: Voteview DW-NOMINATE first dimension, which scores a member's whole career of roll-call votes. <a href="https://voteview.com/person/${esc(i.icpsr)}" target="_blank" rel="noopener">Voteview record ↗</a></div>
  </div>`;
}
function drawIdeo(el,s){
  if(!el||!s.ideo)return;
  const C=icH(s), pts=DATA.pools[C];
  const W=Math.max(280,el.clientWidth), small=W<520;
  const diam=C==='S'?(small?7:10):(small?4.4:6);
  const mL=10,mR=10,x0=-1.0,x1=1.05;
  const X=v=>mL+(Math.max(x0,Math.min(x1,v))-x0)/(x1-x0)*(W-mL-mR);
  const nb=Math.floor((W-mL-mR)/diam);
  const bins={};
  const order=pts.map((p,i)=>i).sort((a,b)=>pts[a][0]-pts[b][0]);
  const pos=new Array(pts.length);
  let maxS=0;
  order.forEach(i=>{const b=Math.min(nb-1,Math.floor((X(pts[i][0])-mL)/diam));const k=bins[b]||0;bins[b]=k+1;pos[i]=[mL+(b+.5)*diam,k];if(k+1>maxS)maxS=k+1;});
  const top=34, plotH=maxS*diam, base=top+plotH, H=base+64;
  const meIdx=pts.findIndex(p=>(s.bioguide&&p[3]===s.bioguide)||p[2]===s.name);
  const med=code=>{const v=pts.filter(p=>p[1]===code).map(p=>p[0]).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null};
  const dM=med('D'), rM=med('R');
  let g='';
  pts.forEach((p,i)=>{if(i===meIdx)return;const [cx,k]=pos[i];g+=`<circle class="${p[1]==='R'?'r':p[1]==='D'?'d':'i'}" cx="${cx.toFixed(1)}" cy="${(base-(k+.5)*diam).toFixed(1)}" r="${(diam/2-.6).toFixed(2)}" data-i="${i}"></circle>`;});
  const mx=X(s.ideo.dim1);
  let me='';
  if(meIdx>=0){const [cx,k]=pos[meIdx];const cy=base-(k+.5)*diam;
    me=`<line class="guide" x1="${cx}" x2="${cx}" y1="${top-8}" y2="${cy-diam/2-2}"></line><circle class="me ${s.party==='R'?'r':'d'}" cx="${cx}" cy="${cy}" r="${Math.max(4.5,diam/2+1.5)}" data-i="${meIdx}"></circle>`;
    const anchor=cx<W*.18?'start':cx>W*.82?'end':'middle';
    me+=`<text class="me-lab" x="${cx}" y="${top-14}" text-anchor="${anchor}">${esc(s.short)} ${s.ideo.dim1>0?'+':''}${s.ideo.dim1.toFixed(2)}</text>`;}
  let ax=`<line class="axis" x1="${mL}" x2="${W-mR}" y1="${base+2}" y2="${base+2}"></line>`;
  [-1,-.5,0,.5,1].forEach(v=>{ax+=`<line class="axis" x1="${X(v)}" x2="${X(v)}" y1="${base+2}" y2="${base+7}"></line><text class="tick" x="${X(v)}" y="${base+19}" text-anchor="${v===-1?'start':v===1?'end':'middle'}">${v>0?'+':''}${v}</text>`;});
  const medMark=(v,lab,cls)=>v==null?'':`<path d="M${X(v)-5},${base+33} L${X(v)+5},${base+33} L${X(v)},${base+26} Z" class="${cls}" style="fill:var(${cls==='d'?'--dem':'--rep'})"></path><text class="med" x="${X(v)}" y="${base+46}" text-anchor="middle">${lab} ${v>0?'+':''}${v.toFixed(2)}</text>`;
  ax+=medMark(dM,small?'D median':'Democratic median','d')+medMark(rM,small?'R median':'Republican median','r');
  ax+=`<text class="cap" x="${mL}" y="${base+62}">← More liberal</text><text class="cap" x="${W-mR}" y="${base+62}" text-anchor="end">More conservative →</text>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(s.name)}'s DW-NOMINATE score ${s.ideo.dim1.toFixed(3)} among ${pts.length} ${CH[C].nouns}; ${esc(ideoText(s).head)}">${g}${ax}${me}</svg>`;
  const svg=el.querySelector('svg');
  svg.addEventListener('mousemove',e=>{const c=e.target.closest('circle[data-i]');if(!c){tip.classList.remove('show');return}const p=pts[+c.dataset.i];tip.textContent=`${p[2]} (${p[1]}) · ${p[0]>0?'+':''}${p[0].toFixed(3)}`;tip.classList.add('show');tip.style.left=Math.min(e.clientX+12,window.innerWidth-270)+'px';tip.style.top=(e.clientY+14)+'px';});
  svg.addEventListener('mouseleave',()=>tip.classList.remove('show'));
}
function mountIdeo(id,s){const f=()=>drawIdeo(document.getElementById(id),s);f();resizers.push(f);}

// ---------- funding (stage 3): campaign funds and outside spending are never added together ----------
const IE=DATA.ie, CLS=['super_pac','other','party'];
const CLSN={super_pac:'Super PACs',other:'Other outside groups',party:'Party committees'};
const CLS1={super_pac:'super PAC',other:'other outside group',party:'party committee'};
const CLSL={super_pac:'super PACs',other:'other outside groups',party:'party committees'};
const CLSV={super_pac:'--s2',other:'--s3',party:'--s4'};
const GLOSS={
  ie:'Independent expenditure: ads, mail or canvassing that support or oppose a candidate, paid for by a group that may not coordinate with the campaign. It is not money the campaign raised or controls.',
  superpac:'Super PAC: a committee that can raise unlimited sums and spend them independently. It cannot give money to a campaign directly.',
  receipts:'Campaign funds raised: everything the candidate\'s own campaign committee reported taking in (FEC "total receipts"): contributions, transfers, loans and other receipts.',
  pac:'PAC contribution: a check from a political action committee to the campaign, capped at $5,000 per election. It is part of campaign funds.',
  transfers:'Transfers: money passed on from joint fundraising committees, mostly individual contributions raised together with party committees.',
  earmarked:'Earmarked contribution: an individual\'s donation that a PAC collects and forwards. The FEC counts it as an individual contribution to the campaign.',
  party:'Party committees can make independent expenditures too. They are reported separately from the party\'s direct contributions.',
  coverage:'Coverage: the share of the PAC money a report lists that could be read row by row for this release.'
};
const term=(k,t)=>`<span class="term" tabindex="0" data-tip="${esc(GLOSS[k])}">${t}</span>`;
const period=(a,b)=>`${fmtDate(a)} – ${fmtDate(b)}`;
const shortPer=(b)=>'through '+fmtDate(b);
const cmOf=i=>IE.cm[i];
// An organization's name with its one-line description (public/orgs.js) shown on hover, tap or focus; inner replaces the
// plain name, for a name that is also a link.
const ORGS=makeOrgs(DATA);
const orgName=(name,about,inner)=>about?`<span class="org" data-tip="${esc(`${name}: ${about}`)}">${inner??esc(name)}</span>`:(inner??esc(name));
const candName=id=>IE.cands[id]||id;
const flag=(t,why)=>`<span class="flag" ${why?`data-tip="${esc(why)}" tabindex="0"`:''}>${t}</span>`;
function raceOf(s){return DATA.races.find(r=>r.keys.includes(s.id))}
function rivalsOf(s){const r=raceOf(s);return r?r.keys.filter(k=>k!==s.id).map(k=>byId[k]):[]}
// ---------- November 3, 2026 results (public/results.js) ----------
const resultChip=o=>o?`<span class="chip ${OUTCOME[o].cls}">${OUTCOME[o].label}</span>`:'';
const decidedChip=o=>o==='pending'?'':resultChip(o);
const resultSrc=x=>x&&x.u?`<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)} ↗</a>`:'';
const RESULTS_ASOF=()=>DATA.election?`unofficial results as of ${fmtDate(DATA.election.asof)}`:'';
// Their 2026 line ("Seeking a 6th term") in the past tense once their race is decided.
const termNow=s=>{const r=raceOf(s);return termAfter(s.term,r?outcomeOf(r,s.id):null)};
// One profiled person's result: their outcome, and a line saying how the race was decided and what it means for the seat.
function personResult(s){
  const race=raceOf(s),r=raceResult(race);if(!r)return null;
  const o=outcomeOf(race,s.id),w=r.winner&&byId[r.winner];
  const to=o==='lost'?`to ${w?w.name:'another candidate'}`:'';
  const line=parts=>parts.filter(Boolean).map(x=>x.replace(/\.$/,'')).join('. ')+'.';
  const rest=[r.how||(r.decided?'Race called':''),seatNote(race,s.id,{incumbent:race.inc===s.id,winner:w&&w.name})];
  // text: the whole sentence ("Lost to Jon Ossoff. Called by …"); after: what follows the Won, Lost or Not called yet label.
  return {o,src:r.src,text:line([OUTCOME[o].label+(to?' '+to:''),...rest]),after:line([to,...rest])};
}
function campFlags(s){
  const c=s.camp, f=[];
  if(c.missing)return [flag('No FEC report yet',c.note)];
  if(c.selfShare>20)f.push(flag(`${c.selfShare}% self-funded`,`Candidate loans and contributions: ${fmtFull(c.self)} of ${fmtFull(c.receipts)} in receipts.`));
  return f;
}
function outFlags(s){
  const o=s.out, f=[];
  if(o.incomplete.length)f.push(flag('Incomplete data',o.incomplete.join(' ')));
  if(o.multi)f.push(flag('Three-way race','Spending against one candidate cannot be credited to a single rival, so only spending aimed at this candidate is summarized.'));
  return f;
}
// headline numbers ---------------------------------------------------------
function campLine(s){return s.camp.missing?'<span class="muted">not yet reported</span>':`${fmt$(s.camp.receipts)} <span class="small muted">${shortPer(s.camp.end)}</span>`}
const forLabel=s=>s.out.multi?'Supporting '+s.short:'For '+s.short;
const agLabel=s=>s.out.multi?'Opposing '+s.short:'Against '+s.short;
function fundingPanels(s){
  const c=s.camp,o=s.out;
  const comp=c.missing?'':`<ul class="kvl">
      <li><span>From individuals</span><b>${fmt$(c.indiv)}</b></li>
      <li><span>${term('pac','From PACs')}</span><b>${fmt$(c.pac)}</b></li>
      <li><span>${term('transfers','Transfers from joint fundraising')}</span><b>${fmt$(c.transfers)}</b></li>
      <li><span>From party committees</span><b>${fmt$(c.party)}</b></li>
      ${c.self?`<li><span>Candidate's own loans and contributions</span><b>${fmt$(c.self)}</b></li>`:''}
      <li><span>Other receipts</span><b>${fmt$(Math.max(0,c.other))}</b></li>
    </ul>`;
  const byCls=(x)=>CLS.filter(k=>x[k]).map(k=>`<li><span><i class="sw" style="background:var(${CLSV[k]})"></i>${CLSN[k]}</span><b>${fmt$(x[k])}</b></li>`).join('')||'<li><span class="muted">None reported</span></li>';
  return `<div class="fpanels">
    <section class="fpanel camp">
      <div class="kicker">${term('receipts','Campaign funds raised')}</div>
      <div class="fbig">${c.missing?'—':fmt$(c.receipts)}</div>
      <div class="fper">${c.missing?'No FEC financial report filed yet':`${period(c.start,c.end)} · FEC committee summary`}</div>
      <div class="row" style="margin-top:6px">${campFlags(s).join('')}</div>
      ${c.missing?`<p class="small" style="margin-top:8px">${esc(c.note)}</p>`:comp}
      ${c.missing?'':`<p class="small muted" style="margin:8px 0 0">Cash on hand ${fmt$(c.cash)} on ${fmtDate(c.end)}${c.debts?` · debts ${fmt$(c.debts)}`:''}${c.src?` · <a href="${esc(c.src)}" target="_blank" rel="noopener">FEC ↗</a>`:''}</p>`}
    </section>
    <section class="fpanel out">
      <div class="kicker">Outside spending · ${term('ie','independent expenditures')}</div>
      <div class="fsplit">
        <div><div class="fl">${esc(forLabel(s))}</div><div class="fbig">${fmt$(o.for.total)}</div><ul class="kvl">${byCls(o.for)}</ul></div>
        <div><div class="fl">${esc(agLabel(s))}</div><div class="fbig">${fmt$(o.against.total)}</div><ul class="kvl">${byCls(o.against)}</ul></div>
      </div>
      <div class="fper">${period(o.start,o.end)} · general election only · <b>not money raised by the campaign</b></div>
      <div class="row" style="margin-top:6px">${outFlags(s).join('')}</div>
      ${o.multi?'':`<p class="small muted" style="margin:8px 0 0"><b>"For":</b> spending supporting ${esc(s.short)} or opposing ${esc(rivalsOf(s).map(x=>x.short).join(' or ')||'the opponent')}. <b>"Against":</b> the reverse.</p>`}
    </section>
  </div>`;
}
// same-scale bars (not summed) ------------------------------------------------
function hbar(parts,max,label){
  const tot=parts.reduce((a,p)=>a+Math.max(0,p[0]),0);
  if(!(tot>0))return '<div class="trk"></div>';
  return `<div class="trk"><div class="stk" style="width:${Math.max(.4,tot/max*100)}%">${parts.filter(p=>p[0]>0).map(([v,col,t])=>`<i style="flex:${v};background:var(${col})" data-tip="${esc(label)} · ${esc(t)}: ${fmtFull(v)}"></i>`).join('')}</div></div>`;
}
function scaleChart(s,compact){
  const c=s.camp,o=s.out;
  const rows=[
    ['Campaign funds raised',c.missing?'No FEC report yet':period(c.start,c.end),c.missing?null:[[c.receipts,'--s1','Campaign funds raised']],c.missing?null:c.receipts],
    ['Outside spending '+(o.multi?'supporting ':'for ')+s.short,period(o.start,o.end),CLS.map(k=>[o.for[k],CLSV[k],CLSN[k]]),o.for.total],
    ['Outside spending '+(o.multi?'opposing ':'against ')+s.short,period(o.start,o.end),CLS.map(k=>[o.against[k],CLSV[k],CLSN[k]]),o.against.total]];
  const max=Math.max(1,...rows.map(r=>r[3]||0));
  const leg=`<div class="legend" style="margin:0 0 10px"><span><i style="background:var(--s1)"></i>Campaign funds</span>${CLS.map(k=>`<span><i style="background:var(${CLSV[k]})"></i>${CLSN[k]} (outside)</span>`).join('')}</div>`;
  const body=rows.map(([l,p,parts,v])=>`<div class="r"><div class="lab"><b>${esc(l)}</b><small>${esc(p)}</small></div>${parts?hbar(parts,max,l):'<div class="trk"><div class="nm">not yet reported</div></div>'}<div class="val">${v==null?'—':fmt$(v)}</div></div>`).join('');
  const table=`<details class="tv"><summary>Show as a table</summary><div class="tablewrap"><table><thead><tr><th>Measure</th><th>Period</th><th class="r">Amount</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td class="small">${esc(r[1])}</td><td class="r">${r[3]==null?'—':fmtFull(r[3])}</td></tr>`).join('')}</tbody></table></div></details>`;
  return `<div class="chart"><h3>On the same scale</h3><div class="sub">Three separate amounts on one scale, so you can compare their sizes. <b>Not added together:</b> they cover different dates, and outside spending never passes through the campaign. Hover a bar for exact amounts.</div>${leg}<div class="hb ch">${body}</div>${compact?'':table}</div>`;
}
function combinedBlock(s){
  const c=s.camp,o=s.out,sm=o.same;
  if(c.missing)return `<div class="chart"><h3>Campaign funds + outside spending</h3><p class="small muted" style="margin:0"><b>Not available:</b> ${esc(s.short)}'s campaign has not filed an FEC financial report yet.</p></div>`;
  if(o.multi||!sm)return `<div class="chart"><h3>Campaign funds + outside spending</h3><p class="small muted" style="margin:0"><b>Not computed:</b> in a three-way race, spending against one candidate can't be credited to a single rival.</p></div>`;
  return `<div class="chart"><h3>Campaign funds + outside spending for ${esc(s.short)}, same period</h3>
    <div class="sub"><b>Same dates:</b> ${period(c.start,sm.end)}. A combined figure is shown only when both parts cover the same dates.</div>
    <div class="eq"><div><b>${fmtFull(sm.receipts)}</b><span>campaign funds raised</span></div><div class="op">+</div><div><b>${fmtFull(sm.for)}</b><span>outside spending for ${esc(s.short)}, same dates</span></div><div class="op">=</div><div><b>${fmtFull(sm.receipts+sm.for)}</b><span>campaign funds + outside spending</span></div></div>
    <ul class="list small" style="margin-top:10px">
      <li><b>Left out because the dates don't match yet:</b> ${fmtFull(sm.after)} in outside spending for ${esc(s.short)} after ${fmtDate(sm.end)}. Campaign reports for that period are due Oct. 15, 2026.</li>
      <li><b>Left out by design:</b> outside spending against ${esc(s.short)} (${fmtFull(o.against.total)}). Also party coordinated spending, which is reported separately.</li>
      <li><b>No double counting:</b> PAC and party contributions are already in campaign funds, so they are not added again. Outside groups pay for independent expenditures, which never pass through the campaign. The FEC counts earmarked donations routed through PACs as individual contributions, so they are already in campaign funds.</li>
    </ul></div>`;
}
function shareBlock(s){
  return `<div class="note"><b>Super PAC share: withdrawn for now.</b>${points([['Why','An earlier version divided super PAC spending through Sept. 30, 2026 by campaign receipts through mid-2026. Those are two different periods.'],['When it returns','Once the campaigns\' Q3 reports (due Oct. 15) are in, so both parts cover Jan. 1, 2025 – Sept. 30, 2026.'],['Formula','<span class="mono">super PAC spending for the candidate ÷ (campaign funds raised + all outside spending for the candidate)</span>, from FEC filings.'],['Covers','General-election spending only. Primary spending is not in the data used here.'],['Use instead','The raw figures above. They are the reliable numbers.']],'small')}</div>`;
}
// outside-spending inspector ---------------------------------------------------
function ieRole(s,r){
  const me=s.fecCand, riv=rivalsOf(s).map(x=>x.fecCand);
  if(r[2]===me)return r[3]==='S'?'for':'against';
  if(riv.includes(r[2]))return s.out.multi?'rival':(r[3]==='O'?'for':'against');
  return 'other';
}
const ROLE_N={for:'For',against:'Against',rival:'Aimed at a rival',other:'Other candidate'};
function ieCommitteeTable(s){
  const o=s.out, multi=o.multi, hasO=o.others.length;
  if(!o.cms.length)return `<p class="small muted">No general-election independent expenditures were reported in this race through ${fmtDate(o.end)}.</p>`;
  const head=`<tr><th>Committee</th><th class="r">${esc(forLabel(s))}</th><th class="r">${esc(agLabel(s))}</th>${multi?'<th class="r">Aimed at rivals</th>':''}${hasO?'<th class="r">Other candidates</th>':''}<th class="r">Items</th><th>Dates</th></tr>`;
  const body=o.cms.map(([ci,f,a,rv,ot,n,d0,d1])=>{const m=cmOf(ci);return `<tr><td>${orgName(m[1],ORGS.spender(m),`<a href="https://www.fec.gov/data/committee/${m[0]}/?cycle=2026" target="_blank" rel="noopener">${esc(m[1])}</a>`)}<div><span class="tag">${CLS1[m[2]]||m[2]}</span>${m[5]===1?'<span class="tag">only this race</span>':`<span class="tag">${m[5]} races</span>`}</div>${m[3]?`<div class="small" style="color:var(--ink-2);margin-top:4px">${esc(m[3])}${m[4]?` <a href="${esc(m[4])}" target="_blank" rel="noopener">source ↗</a>`:''}</div>`:''}</td>
    <td class="r">${f?fmtFull(f):'—'}</td><td class="r">${a?fmtFull(a):'—'}</td>${multi?`<td class="r">${rv?fmtFull(rv):'—'}</td>`:''}${hasO?`<td class="r">${ot?fmtFull(ot):'—'}</td>`:''}<td class="r">${n}</td><td class="mono small" style="white-space:nowrap">${d0===d1?fmtDate(d0):fmtDate(d0)+' –<br>'+fmtDate(d1)}</td></tr>`}).join('');
  return `<div class="tablewrap"><table>${'<thead>'+head+'</thead>'}<tbody>${body}</tbody></table></div>`;
}
function rowFlags(r){
  const f=r[7]||'', out=[];
  if(f.includes('d'))out.push(flag('Possible repeat','Same committee, candidate, amount, date and description as an item in an earlier filing, but listed as a separate transaction. It may be the same spending reported twice. It is kept because the filings list it separately.'));
  if(f.includes('p'))out.push(flag('Date capped',`Filed ${fmtDate(r[8])} with a date of Sept. 30 or later. The data set shows such dates as its Sept. 30 cut-off.`));
  if(f.includes('u'))out.push(flag('Designation uncertain','The filing does not clearly mark this as general-election spending.'));
  return out.length?`<div class="row" style="margin-top:4px;gap:4px">${out.join('')}</div>`:'';
}
function ieItems(s,host){
  const rows=(IE.rows[s.race]||[]).map(r=>({r,role:ieRole(s,r)}));
  if(!rows.length){host.innerHTML='';return}
  const roles=['for','against'].concat(s.out.multi?['rival']:[]).concat(rows.some(x=>x.role==='other')?['other']:[]);
  const cms=[...new Set(rows.map(x=>x.r[1]))].sort((a,b)=>cmOf(a)[1].localeCompare(cmOf(b)[1]));
  let st={role:'',cm:'',n:50,sort:'date'};
  host.innerHTML=`<div class="filters" id="ief"><button class="active" data-r="">All</button>${roles.map(k=>`<button data-r="${k}">${k==='for'?esc(forLabel(s)):k==='against'?esc(agLabel(s)):ROLE_N[k]}</button>`).join('')}</div>
    <div class="toolbar" style="margin:0 0 10px"><label class="small muted">Committee <select id="iec"><option value="">All committees</option>${cms.map(i=>`<option value="${i}">${esc(cmOf(i)[1])}</option>`).join('')}</select></label>
    <label class="small muted">Sort <select id="ies"><option value="date">Newest first</option><option value="amt">Largest first</option></select></label></div>
    <p class="small" id="iesum" style="margin:0 0 8px"></p>
    <div class="tablewrap"><table><thead><tr><th>Date</th><th>Committee</th><th>Aimed at</th><th>Description (as filed)</th><th class="r">Amount</th><th>Filing</th></tr></thead><tbody id="ietb"></tbody></table></div>
    <div id="iemore" style="margin-top:8px"></div>`;
  const draw=()=>{
    let L=rows.filter(x=>(!st.role||x.role===st.role)&&(st.cm===''||x.r[1]===+st.cm));
    L=L.slice().sort(st.sort==='amt'?(a,b)=>b.r[4]-a.r[4]:(a,b)=>b.r[0].localeCompare(a.r[0])||b.r[4]-a.r[4]);
    const tot=L.reduce((a,x)=>a+x.r[4],0);
    host.querySelector('#iesum').innerHTML=`<b class="num">${L.length.toLocaleString()}</b> items · <b class="num">${fmtFull(tot)}</b>${L.some(x=>x.r[4]<0)?' · negative amounts are corrections filed by the committee':''}`;
    host.querySelector('#ietb').innerHTML=L.slice(0,st.n).map(({r,role})=>{const m=cmOf(r[1]);return `<tr><td class="mono" style="white-space:nowrap">${fmtDate(r[0])}</td><td>${orgName(m[1],ORGS.spender(m))}<div class="small muted">${CLS1[m[2]]||''}</div></td><td><span class="chip ${role==='for'?'dfor':role==='against'?'dag':'ghost'}">${r[3]==='S'?'Supports':'Opposes'} ${esc(candName(r[2]))}</span>${rowFlags(r)}</td><td class="small">${esc(IE.purp[r[5]]||'—')}</td><td class="r">${fmtFull(r[4])}</td><td class="small"><a href="https://docquery.fec.gov/cgi-bin/forms/${m[0]}/${esc(r[6])}/" target="_blank" rel="noopener">${esc(r[6])} ↗</a></td></tr>`}).join('')||'<tr><td colspan="6" class="muted">No items match.</td></tr>';
    hoverTips(host.querySelector('#ietb'));
    host.querySelector('#iemore').innerHTML=L.length>st.n?`<button class="more" id="iemb">Show ${Math.min(50,L.length-st.n)} more of ${(L.length-st.n).toLocaleString()} remaining</button>`:'';
    const b=host.querySelector('#iemb');if(b)b.addEventListener('click',()=>{st.n+=50;draw();});
  };
  host.querySelector('#ief').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;host.querySelector('#ief .active').classList.remove('active');b.classList.add('active');st.role=b.dataset.r;st.n=50;draw();});
  host.querySelector('#iec').addEventListener('change',e=>{st.cm=e.target.value;st.n=50;draw();});
  host.querySelector('#ies').addEventListener('change',e=>{st.sort=e.target.value;draw();});
  draw();
}
// PAC contributions inspector -------------------------------------------------
function pacCoverage(s){
  const p=s.pac,c=s.camp;
  if(!p.filings.length)return `<div class="note">${c.missing?'No FEC reports have been filed yet, so there are no itemized PAC contributions to show.':`No PAC contribution rows were itemized for ${esc(s.short)}${c.pac?` (the FEC summary shows ${fmtFull(c.pac)} from PACs and other committees in 2025–26)`:''}.`}</div>`;
  const notIt=(c.pac||0)-p.subtotal;
  const over=p.filings.filter(f=>f.over);
  return `<div style="margin:0 0 8px">${points([['Reports read',`${p.filings.length}, covering ${esc(p.window)}.`],p.subtotal>0?['Rows add to',`<span class="num">${fmtFull(p.retrieved)}</span>, of <span class="num">${fmtFull(p.subtotal)}</span> in PAC contributions listed in those reports (${term('coverage',`${p.coverage}% coverage`)}).`]:['PAC contributions','None listed in those reports.'],!c.missing&&c.pac!=null&&['FEC summary',`<span class="num">${fmtFull(c.pac)}</span> from PACs and other committees, ${period(c.start,c.end)}.${notIt>500?` <span class="num">${fmtFull(notIt)}</span> of it is in reports not itemized here.`:''}`]],'small')}</div>
  ${p.coverage!=null&&p.coverage<95?`<div class="row" style="margin-bottom:8px">${flag('Incomplete rows',`Only ${p.coverage}% of the PAC money in these reports could be read row by row. The missing rows are not shown or guessed.`)}</div>`:''}
  ${over.length?`<div class="note" style="margin-bottom:8px"><b>Check needed:</b> ${over.map(f=>`the ${esc(f.report)} transcription adds to ${fmtFull(f.retrieved-f.subtotal)} more than the report's own subtotal`).join('; ')}, so a row may be duplicated. Compare with the linked report before relying on individual rows.</div>`:''}
  ${p.gap?`<p class="small muted" style="margin:0 0 8px">${esc(p.gap)}</p>`:''}`;
}
function pacSectors(s){
  const p=s.pac;if(!p.byCat.length)return '';
  const tiles=pacSectorTiles(s),sum=k=>tiles.filter(x=>x.align===k).reduce((n,x)=>n+x.value,0);
  return `<div class="chart"><h3>Itemized PAC contributions by sector</h3><div class="sub">${points([['Tile size',`The amount from each sector: ${fmtFull(p.retrieved)} from ${p.nPacs} committees (${esc(p.window)}).`],['Sectors','Assigned by this app from each committee\'s name and sponsor, not by the FEC. Committees that can\'t be identified are left unclassified, not guessed.']],'small')}</div>
    <div class="cx-plot" id="pac-tm"></div>${legend([['var(--s1)',`People-aligned ${fmt$(sum('people'))}`],['var(--s5)',`Profit-aligned ${fmt$(sum('profit'))}`],['var(--cx-other)',`Other ${fmt$(sum('other'))}`]])}
    ${tableView(['Sector','Amount','Share','Alignment'],tiles.map(x=>[esc(x.label),fmtFull(x.value),pct(x.value,p.retrieved)+'%',x.alignLabel]))}</div>`;
}
// The same itemized PAC money by the type the FEC records for each committee (public/pac-types.js), once
// scripts/build-pac-types.mjs has looked them up.
function pacKinds(s){
  const p=s.pac;if(!p.rows.length||!DATA.pacIds)return '';
  const k=pacKindTotals(DATA,p.rows),max=Math.max(1,...k.map(x=>x.total)),known=k.filter(x=>x.kind!=='unknown').reduce((t,x)=>t+x.total,0);
  return `<div class="chart"><h3>Itemized PAC contributions by FEC type</h3><div class="sub">${points([['Type','From each committee\'s own FEC registration: who sponsors it (a company, union, trade or membership group), or that it is a leadership, party or candidate committee. Not assigned by this app.'],
      ['Matched',`${pct(known,p.retrieved)}% of the ${fmtFull(p.retrieved)}, by each committee's FEC ID (looked up ${esc(fmtDate(DATA.pacTypesAsOf))}).`],['Not graded','Shown only; no grade uses it.']],'small')}</div>
    <div class="cx-rows">${k.map(x=>`<div class="cx-row"><div class="cx-who">${esc(x.label)}</div><div class="cx-track"><i class="cx-bar" style="width:${Math.max(1,x.total/max*100)}%;background:${x.kind==='unknown'?'var(--cx-other)':'var(--s1)'}" data-tip="${esc(`${x.label}: ${fmtFull(x.total)}, ${x.n} contribution${x.n===1?'':'s'}`)}"></i></div><div class="cx-val"><b>${pct(x.total,p.retrieved)}%</b> <span class="muted">${fmt$(x.total)}</span></div></div>`).join('')}</div>
    ${tableView(['FEC type','Amount','Share','Contributions'],k.map(x=>[esc(x.label),fmtFull(x.total),pct(x.total,p.retrieved)+'%',String(x.n)]))}</div>`;
}
const pacSectorTiles=s=>s.pac.byCat.map(([k,v])=>{const align=categoryAlign(k);return {label:DATA.categories[k]||k,value:v,align,alignLabel:ALIGN_LABEL[align],about:`${pct(v,s.pac.retrieved)}% of the itemized PAC money`};});
function mountPacSectors(s){if(!s.pac?.byCat?.length)return;const tiles=pacSectorTiles(s),f=()=>drawTreemap(document.getElementById('pac-tm'),tiles);f();resizers.push(f);}
function pacTable(s,host){
  const p=s.pac;if(!p.rows.length){host.innerHTML='';return}
  let st={q:'',k:'amt',dir:-1,n:50};
  host.innerHTML=`<div class="toolbar" style="margin:0 0 10px"><div class="search" style="margin:0"><input id="pq" type="search" placeholder="Filter by committee, sector or FEC type" aria-label="Filter PAC contributions"></div></div>
    <p class="small" id="psum" style="margin:0 0 8px"></p>
    <div class="tablewrap"><table id="pt"><thead><tr><th><button data-k="name">Contributor (as filed)</button></th><th><button data-k="cat">Sector (assigned)</button></th><th><button data-k="type">FEC type</button></th><th><button data-k="rep">Report and period</button></th><th class="r"><button data-k="amt">Amount</button></th></tr></thead><tbody></tbody></table></div><div id="pmore" style="margin-top:8px"></div>`;
  const R=p.rows.map(r=>{const t=pacTypeOf(DATA,r[0]);return {name:DATA.pacNames[r[0]],about:ORGS.pac(r[0]),amt:r[1],cat:DATA.categories[r[2]]||r[2],fi:r[3],rep:p.filings[r[3]].start,orient:(DATA.pacOrient||{})[r[0]],
    t,type:t?t.label:DATA.pacIds?'Not matched':'Not looked up yet'};});
  const draw=()=>{
    const q=st.q.toLowerCase();
    let L=R.filter(x=>!q||(x.name+' '+x.cat+' '+x.type).toLowerCase().includes(q));
    L.sort((a,b)=>{const x=a[st.k],y=b[st.k];return (typeof x==='number'?x-y:String(x).localeCompare(String(y)))*st.dir||b.amt-a.amt});
    host.querySelector('#psum').innerHTML=`<b class="num">${L.length.toLocaleString()}</b> contributions · <b class="num">${fmtFull(L.reduce((a,x)=>a+x.amt,0))}</b>. The FEC lists these by report, so each row shows its report period, not an exact date.`;
    host.querySelector('#pt tbody').innerHTML=L.slice(0,st.n).map(x=>{const f=p.filings[x.fi];return `<tr><td>${orgName(x.name,x.about)}${x.orient?`<div class="small muted">${esc(x.orient)}</div>`:''}</td><td class="small">${esc(x.cat)}</td><td class="small">${x.t?`<span class="org" data-tip="${esc(`${x.t.label}: ${x.t.about} FEC ID ${x.t.id}.`)}">${esc(x.t.label)}</span>${x.t.lobbyist?'<div class="muted">also a lobbyist PAC</div>':''}`:`<span class="muted">${esc(x.type)}</span>`}</td><td class="small"><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.report)}</a><div class="muted">${fmtDate(f.start)} – ${fmtDate(f.end)}</div></td><td class="r">${fmtFull(x.amt)}</td></tr>`}).join('')||'<tr><td colspan="4" class="muted">No rows match.</td></tr>';
    hoverTips(host.querySelector('#pt tbody'));
    host.querySelector('#pmore').innerHTML=L.length>st.n?`<button class="more" id="pmb">Show ${Math.min(50,L.length-st.n)} more of ${(L.length-st.n).toLocaleString()} remaining</button>`:'';
    const b=host.querySelector('#pmb');if(b)b.addEventListener('click',()=>{st.n+=50;draw();});
  };
  host.querySelector('#pq').addEventListener('input',e=>{st.q=e.target.value;st.n=50;draw();});
  host.querySelector('#pt thead').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;st=Object.assign(st,st.k===k?{dir:-st.dir}:{k,dir:k==='amt'?-1:1});draw();});
  draw();
}
function topSpenders(s,role,n){
  const idx=role==='for'?1:2;
  return s.out.cms.filter(x=>x[idx]>0).sort((a,b)=>b[idx]-a[idx]).slice(0,n).map(x=>({name:cmOf(x[0])[1],cls:cmOf(x[0])[2],about:ORGS.spender(cmOf(x[0])),amt:x[idx]}));
}

// ---------- routing ----------
let homeCh='', cmpCh='S';
// Older profile links (#id-record, #id-funding, ...) still work: each opens the tab that now holds that content, and the spot on it.
const TAB_ALIAS={record:['ideology','m-record'],legislation:['ideology','legislation-lists'],match:['ideology','i-match'],align:['ideology','i-match'],statements:['word'],promises:['word'],ethics:['aboveboard'],integrity:['overview'],accountability:['overview'],finance:['unbought'],funding:['unbought'],superpacs:['unbought','f-out'],latest:['unbought','live-records'],connections:['unbought','u-connections'],history:['unbought','u-finance'],bills:['ideology','leg-sponsored'],funders:['unbought','rec-funders'],money:['unbought','rec-money'],pvp:['peoplefirst']};
function route(){
  resizers=[];tip.classList.remove('show');
  const h=(location.hash||'#home').slice(1);
  const m=h.match(/^([a-zA-Z0-9]+)(?:-([a-z]+))?$/)||[];
  const current=byId[m[1]]||BASIC[m[1]];
  document.body.dataset.party=current?(['D','R'].includes(current.party)?current.party:'I'):'';
  document.body.dataset.page=current?'profile':(m[1]||'home');
  document.body.dataset.tab=current?profileLocation(TAB_ALIAS[m[2]]?.[0]||m[2]||'overview').primary:'';
  document.body.dataset.view=current?(TAB_ALIAS[m[2]]?.[0]||m[2]||'overview'):'';
  document.title=current?`${current.name} · Public Ledger`:'Public Ledger · Follow the record';
  document.querySelectorAll('.nav-more[open]').forEach(el=>el.open=false);
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('active',a.dataset.route===m[1]||(a.dataset.route==='home'&&!!byId[m[1]])||(a.dataset.route==='senate'&&!!BASIC[m[1]])));
  if(!h||m[1]==='home'){homeCh=m[2]==='senate'?'S':m[2]==='house'?'H':m[2]==='candidates'?'C':homeCh;renderHome();}
  else if(m[1]==='updates'){window.RecordLive.dashboard(app);}
  else if(m[1]==='websites'){window.RecordLive.sites(app);}
  else if(m[1]==='rankings'){mountRankings(app,financeExplorerModel());}
  else if(m[1]==='stocks'){mountStocks(app,financeExplorerModel());}
  else if(m[1]==='races'){renderRaces();}
  else if(m[1]==='bills'){renderBills(m[2]||'all');}
  else if(m[1]==='senate'){renderSenate();}
  else if(m[1]==='compare'){if(m[2])cmpCh=m[2]==='house'?'H':'S';renderCompare();}
  else if(m[1]==='method'){renderMethod();if(m[2]){const t=document.getElementById('method-'+m[2]);if(t)setTimeout(()=>t.scrollIntoView({block:'start'}),0);}}
  else if(m[1]==='scores'){renderScores(m[2]||'match');}
  else if(m[1]==='align'){renderAlign();}
  else if(byId[m[1]]){const [tb,foc]=TAB_ALIAS[m[2]]||[m[2]||'overview'];renderProfile(byId[m[1]],tb,foc||null);}
  else if(BASIC[m[1]]){const [tb,foc]=TAB_ALIAS[m[2]]||[m[2]||'overview'];renderBasic(BASIC[m[1]],tb,foc||null);}
  else if(m[2]==='latest'){window.RecordLive.standalone(app,m[1]);}
  else renderHome();
  window.scrollTo({top:0});
}
window.addEventListener('hashchange',route);
document.querySelector('.skip-link')?.addEventListener('click',e=>{e.preventDefault();app.focus();app.scrollIntoView({block:'start'});});
document.addEventListener('click',e=>{if(!e.target.closest('.nav-more'))document.querySelectorAll('.nav-more[open]').forEach(el=>el.open=false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.nav-more[open]').forEach(el=>{el.open=false;el.querySelector('summary').focus();});});

// ---------- home cards: who they are, three primary A-F grades, campaign and outside money ----------
// Descriptions are written short: a one-line question, then bullet points with a bold label before each colon.
// points([[label, text], ...]) renders them; a falsy item is skipped.
const points=(items,cls='')=>`<ul class="pts${cls?' '+cls:''}">${items.filter(Boolean).map(([l,t])=>`<li><b>${l}:</b> ${t}</li>`).join('')}</ul>`;
// The three primary grades: the question each answers and how it is figured. Shown as bullets on the pages, and joined into one
// line for the grade tiles' hover text.
const GRADE={
  match:{q:'How closely does this politician\'s record align with your views?',pts:[
    ['What it compares','Your issue positions with their documented positions and recorded actions. It is personalized to your answers.'],
    ['What counts','Their votes, bills and official acts on each issue you picked in My alignment.'],
    ['Statements','An issue backed only by speeches or statements counts half as much.'],
    ['Your choices','Saved only in this browser.'],
    ['Higher score','Closer agreement with you. It does not measure honesty, ethics, or whether their policies benefit working people.'],
    ['Not graded','Until there is evidence on at least 3 of your issues.']]},
  integ:{q:'How consistently does this politician keep commitments, manage financial conflicts, and meet accountability standards?',pts:[
    ['Honesty (20%)','The Promises Delivered Index: reviewed kept, partly kept and broken commitments.'],
    ['Personal Finances (20%)','The Insider Trading Index, the Stock Disclosure Dodger Index, and the holdings and trading penalties.'],
    ['Fundraising (25%)','Donor-size contributions, PAC-type and PAC-reliance penalties, earmarked-donation penalties, and verified pledge adjustments, adapted from IntegrityIndex.us.'],
    ['Showing Up (15%)','75% Attendance (roll-call votes missed since 2018: 100 minus 5 points per percentage point missed; votes missed while campaigning count; a cited medical leave, birth or adoption, death in the family or military duty is left out) and 25% Get It Done (their share of sponsored bills that advanced, against the typical member of their party in their chamber). A missed vote says nothing about where they were.'],
    ['Conflicts of Interest (20%)','From their latest annual or candidate report: income, board seats and agreements with organizations that have business before their committees, campaign money from organizations that lobbied them, donor companies with contracts from agencies they oversee, foreign-agent filings naming them, and gifts and paid trips from interested sources. Only reviewed matches count.'],
    ['Legal Trouble Index 🚨','Subtracted at full strength after averaging the available components. The result stays between 0 and 100.'],
    ['Not graded','Until at least two components are complete and the Legal Trouble review is sourced. Honesty needs at least 3 counted promise checks. Missing evidence is never treated as a clean record.'],
    ['Provisional','The parameters still need calibration. Flip-Flop and Pants on Fire are planned additions to Honesty.']]},
  prom:{q:'Did they do what they said they would?',pts:[
    ['Kept','1 point. The record supports the promise.'],
    ['Partly kept or changed','½ point.'],
    ['Broken','0 points, including a promise never acted on by the end of the term.'],
    ['Left out','Unclear checks, promises with no related bill yet, vague goals, and statements made in debate the day of the vote or the day before.'],
    ['For a president',"PolitiFact's ratings count the same way: Promise Kept 1, Compromise ½, Promise Broken 0."],
    ['Not graded',`Until there are at least ${MIN_CHECKS} counted checks.`]]},
  eth:{q:'Have they gotten into legal or ethical trouble?',pts:[
    ['Starting score','Everyone starts at 100.'],
    ['Legal Trouble Index 🚨',`Minus all of it. Each case: ${ETHICS_COST.finding} for a confirmed finding, ${ETHICS_COST.open} for an open investigation, ${ETHICS_COST.closed} for one closed without a finding. Criminal cases count × ${CASE_KIND.criminal}, technical ones × ${CASE_KIND.technical}, and a case decided over ${CASE_AGE.years} years ago × ${CASE_AGE.factor}.`],
    ['Insider Trading Index 📈','Minus a tenth of it. Stock trades in industries their committees oversee, near related votes, or in donors\' companies.'],
    ['Stock Disclosure Dodger Index 🙈',`Minus a tenth of it. Trade reports filed after the ${LATE_DAYS}-day deadline, or never.`],
    ['Not counted','Accusations no official body has acted on. They are listed, but cost nothing.']]},
  pvp:{q:'How consistently do this politician\'s legislative actions prioritize working people?',pts:[
    ['High grade','Their record helped working and middle-class families more.'],
    ['Low grade','Their record helped the wealthy and corporations more.'],
    ['What counts','Their votes on, and sponsorships of, scored bills.'],
    ['Bill scores','Each bill is scored from −100 (fully corporate-backed) to +100 (fully worker-backed): half from a nonpartisan study of who gains, half from which side worker and business groups took.'],
    ['How votes count',"A yes vote takes the bill's side and a no vote the other side, counted by the bill's strength: a yes on a +60 bill adds 0.6 to the working-people side."],
    ['Bills that didn\'t pass','Count too: sponsoring or cosponsoring one counts like a yes vote, and a cited public statement for or against it counts half as much. A bill counts once across its versions in different Congresses.'],
    ['How it adds up','75% their legislative-action score + 25% (100 − the Corporation Compromised Index 🏢). A lower index raises the grade. Without the index, the legislative-action score stands alone.'],
    ['Corporation Compromised Index 🏢','Measures how much of their campaign money comes from businesses\' PACs and how much more often they vote with business funders than their party does.'],
    ['For a president','Signing a bill counts like a yes. A veto counts like a no.'],
    ['Not graded',`Until they have at least ${MIN_PVP_ACTIONS} of these.`]]},
};
const GRADE_TIP=Object.fromEntries(Object.entries(GRADE).map(([k,g])=>[k,`${g.q} ${g.pts.map(([l,t])=>`${l}: ${t}`).join(' ')}`]));
const gradeRule=k=>`<p class="gh-q">${GRADE[k].q}</p>${points(GRADE[k].pts,'small')}`;
const initials=n=>{const w=n.replace(/\b(Jr|Sr|III|II)\b\.?/g,'').split(/\s+/).filter(x=>/^[A-Z][a-z'-]/.test(x));return ((w[0]||'?')[0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase()};
// Portrait: a cut-out photo standing in a party-colored circle, head rising above its top edge (public/portraits/,
// built by scripts/build-portraits.py). Without a photo, or if it fails to load, the same circle shows initials.
const PORTRAITS=window.PORTRAITS||{};
function portrait(s){
  const p=PORTRAITS[s.id], ini=initials(s.name);
  return p?`<div class="hc-pv ${s.party}" data-ini="${ini}"><img src="/${esc(p.file)}" alt="" width="88" height="104" loading="lazy" decoding="async"></div>`
    :`<div class="hc-pv ${s.party} ini" aria-hidden="true"><span>${ini}</span></div>`;
}
document.addEventListener('error',e=>{
  const pv=e.target.tagName==='IMG'&&e.target.parentNode.classList.contains('hc-pv')?e.target.parentNode:null;if(!pv)return;
  const span=document.createElement('span');span.textContent=pv.dataset.ini;pv.replaceChildren(span);pv.classList.add('ini');pv.setAttribute('aria-hidden','true');
},true);
function gradeTile(label,pct,detail,tip,extra='',href='',emptyLabel='Not graded'){
  const g=pct==null?null:letter(pct), t=href?'a':'div';
  return `<${t} class="hc-gt"${label==='Integrity'?' data-integrity-tile':''}${href?` href="${href}"`:''} title="${esc(tip)}"><div class="hc-gl">${label}</div><div class="hc-gv">${g?`<b class="gr-${g}">${g}</b><span>${pct}%</span>`:`<span class="hc-ng">${esc(emptyLabel)}</span>`}</div>${extra}<div class="hc-gd">${detail}</div></${t}>`;
}
function integritySnapshot(s){const entry=window.INTEGRITYLOG?.at(-1),record=entry?.scores?.[s.id]?.integrity;return {pct:Number.isFinite(record?.pct)?record.pct:null,entry,record};}
// With links, each tile opens that grade's tab on the profile (not on the home cards, which are links themselves).
function reportCard(s,links){return sixTiles(s,links);}
// Promises, Ethics and People First are recalculated monthly after review (public/score-log.json). The tab says
// when, and marks a grade that reviewed edits have changed since; the next monthly run logs it.
function monthlyNote(s,key,pct){
  const last=(window.SCORELOG||[]).at(-1);if(!last)return '';
  const was=last.scores[s.id]?.[key];
  return `<p class="small muted gh-mo">Recalculated monthly; last on ${fmtDate(last.date)}.${was&&was.pct!==pct?` <b>Changed since then</b> (was ${was.pct==null?'not graded':was.pct+'%'}): the next monthly recalculation will log why.`:''} <a href="#method-log">Change log</a></p>`;
}
// The top of each grade tab: the letter and percentage, what it is based on, and the rule.
function gradeHead(title,pct,detail,rule,extra=''){
  const g=pct==null?null:letter(pct);
  return `<div class="gh"><div class="gh-g">${g?`<b class="gr-${g}">${g}</b><span${toneAttrs(pct,'good')}>${pct}%</span>`:'<span class="gh-ng">Not graded</span>'}</div>
    <div class="gh-t"><h2>${title}</h2><div class="gh-d">${detail}</div>${extra}<details class="gh-r"><summary>How this grade is calculated</summary>${rule}<p class="small"><a href="#method">Full methodology ↗</a></p></details></div></div>`;
}
function homeMonths(asof=DATA.ie_asof){const end=asof.slice(0,7), out=[];let y=+end.slice(0,4), k=+end.slice(5,7);for(let i=0;i<7;i++){out.unshift(`${y}-${String(k).padStart(2,'0')}`);if(--k<1){k=12;y--;}}return out;}
// Outside money by month: for and against side by side, with the month's for-to-against ratio as a line on its own scale (right).
const RATIO_TICKS=[[1,'all for'],[.75,'3 : 1'],[.5,'1 : 1'],[.25,'1 : 3'],[0,'all against']];
// live, when given, is outside spending from the daily FEC refresh ({end, items:[{date, amount, role}]}) instead of the
// reviewed race data.
function miniOutside(s,bare,live){
  const asof=live?live.end:DATA.ie_asof, months=homeMonths(asof), M=Object.fromEntries(months.map(m=>[m,{f:0,a:0}]));
  const items=live?live.items:(IE.rows[s.race]||[]).map(r=>({date:r[0],amount:r[4],role:ieRole(s,r)}));
  for(const x of items){const mo=x.date.slice(0,7);if(!M[mo])continue;if(x.role==='for')M[mo].f+=x.amount;else if(x.role==='against')M[mo].a+=x.amount;}
  const fw=s.out.multi?'supporting':'for', aw=s.out.multi?'opposing':'against';
  const max=Math.max(0,...months.map(m=>Math.max(M[m].f,M[m].a)));
  const F=months.reduce((t,m)=>t+M[m].f,0), A=months.reduce((t,m)=>t+M[m].a,0), q=moneyRatio(F,A);
  const badge=q?`<span class="hc-ratio" title="${esc(`For-to-against ratio of outside money in the months charted: ${fmtFull(F)} ${fw} ${s.short}, ${fmtFull(A)} ${aw}.`)}">${q.oneSided?`<b class="${q.side}">${q.text[0].toUpperCase()+q.text.slice(1)}</b>`:`For-to-against <b class="${q.side}">${q.text}</b>`}</span>`:'';
  const head=`<div class="hc-mh"><span>${bare?'':'Outside money by month'}${badge}</span><span>${MON[+months[0].slice(5,7)-1]} – <b>${fmtDate(asof)}</b></span></div>`;
  if(!max)return `<div class="hc-mini">${head}<p class="small muted" style="margin:4px 0 0">No outside spending reported in these months.</p></div>`;
  const W=280,top=6,base=96,gw=W/7,bw=14,y=sh=>top+(1-sh)*(base-top);
  let svg=RATIO_TICKS.slice(1,4).map(([sh])=>`<line class="${sh===.5?'hc-g1':'hc-g'}" x1="0" x2="${W}" y1="${y(sh)}" y2="${y(sh)}"></line>`).join('');
  const pts=months.map((m,i)=>{const {f,a}=M[m], x0=i*gw+(gw-2*bw-2)/2, r=moneyRatio(f,a);
    if(f>0){const h=Math.max(1.5,f/max*(base-top));svg+=`<rect class="hc-f" x="${x0.toFixed(1)}" y="${(base-h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}"></rect>`;}
    if(a>0){const h=Math.max(1.5,a/max*(base-top));svg+=`<rect class="hc-a" x="${(x0+bw+2).toFixed(1)}" y="${(base-h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}"></rect>`;}
    return r&&{x:(i*gw+gw/2).toFixed(1),y:y(r.share).toFixed(1),m,r};});
  svg+=`<line class="hc-z" x1="0" x2="${W}" y1="${base}" y2="${base}"></line>`;
  // The line breaks over a month with no outside money, since it has no ratio.
  const d=pts.map((p,i)=>p?`${pts[i-1]?'L':'M'}${p.x} ${p.y}`:'').join('');
  if(d)svg+=`<path class="hc-rl-h" d="${d}"></path><path class="hc-rl" d="${d}"></path>`;
  svg+=pts.filter(Boolean).map(p=>`<path class="hc-rd" d="M${p.x} ${p.y}h0"></path>`).join('');
  svg+=months.map((m,i)=>{const {f,a}=M[m],r=pts[i];return `<rect class="hc-hit" x="${(i*gw).toFixed(1)}" y="0" width="${gw.toFixed(1)}" height="100"><title>${esc(`${monLabel(m)}: ${fmt$(f)} ${fw}, ${fmt$(a)} ${aw}${!r?'':r.r.oneSided?` · ${r.r.text}`:` · for-to-against ${r.r.text}`}`)}</title></rect>`}).join('');
  const label=months.map((m,i)=>`${monLabel(m)}: ${fmt$(M[m].f)} ${fw}, ${fmt$(M[m].a)} ${aw}${pts[i]?`, ratio ${pts[i].r.text}`:''}`).join('; ');
  const rax=RATIO_TICKS.map(([sh,t])=>`<span style="top:${y(sh)}%">${t}</span>`).join('');
  return `<div class="hc-mini">${head}<div class="hc-plot"><svg viewBox="0 0 ${W} 100" preserveAspectRatio="none" role="img" aria-label="${esc(`Outside spending by month, with the for-to-against ratio. ${label}`)}">${svg}</svg><div class="hc-rax" aria-hidden="true">${rax}</div></div>
    <div class="hc-mx" aria-hidden="true">${months.map(m=>`<span>${MON[+m.slice(5,7)-1]}</span>`).join('')}</div>
    <div class="hc-ms"><span><i class="sw" style="background:var(--s3)"></i>${fw}</span><span><i class="sw" style="background:var(--s2)"></i>${aw}</span><span><i class="hc-ln"></i>ratio, right scale</span><span>tallest bar ${fmt$(max)}</span></div></div>`;
}
// A titled section of a home card: the grades ("Report Card"), then the money ("Money & Influence Analysis").
const hcHead=(icon,cls,title,sub)=>`<div class="hc-sh"><h4><i class="${cls}" aria-hidden="true">${icon}</i>${title}</h4><p>${sub}</p></div>`;
function homeCard(s){
  const c=s.camp, o=s.out, it=ideoText(s), race=raceOf(s), riv=rivalsOf(s), res=personResult(s);
  const ideo=s.cand&&!s.ideo&&s.ideoKind!=='former_text'&&s.ideoKind!=='state'?`No voting score · ${REC_LABEL[s.recordType]||it.short}`:it.short;
  const sub=s.cand?`${s.openSeat?'Open seat':termNow(s)} · ${s.since}`:`In the ${CH[s.chamber].name} since ${String(s.since).split(' (')[0]} · ${termNow(s)}`;
  return `<article class="card sen-card hc" tabindex="0" data-id="${s.id}" data-party="${esc(s.party)}" role="link" aria-label="Open profile of ${esc(s.name)}">
    <div class="hc-top">${portrait(s)}<div class="hc-who">
      <div class="row" style="gap:5px"><span class="chip ${s.party}">${s.party} · ${esc(seatLabel(s))}</span><span class="chip ch">${chipCh(s)}</span>${res?`<span title="${esc(res.text)}">${resultChip(res.o)}</span>`:''}</div>
      <div class="name">${esc(s.name)}</div><div class="hc-sub">${esc(sub)}</div></div></div>
    <div class="hc-ideo">${esc(ideo)}</div>
    ${hcHead('✓','rc','Report Card','Four A–F grades from the documented record and your own answers')}
    ${reportCard(s)}
    ${hcHead('$','mi','Money &amp; Influence Analysis','Who pays for the campaign, and who spends for and against it')}
    <div class="hc-money">
      <div class="hc-mt">${c.missing?'<b class="hc-na">Not yet reported</b><span>Campaign funds raised</span><small>no FEC report filed yet</small>':`<b>${fmt$(c.receipts)}</b><span>Campaign funds raised</span><small>${shortPer(c.end)}</small>`}</div>
      <div class="hc-mt"><b class="hc-two"><i class="sw" style="background:var(--s3)"></i>${fmt$(o.for.total)} <em>${o.multi?'supporting':'for'}</em><br><i class="sw" style="background:var(--s2)"></i>${fmt$(o.against.total)} <em>${o.multi?'opposing':'against'}</em></b><span>Outside money</span><small>${shortPer(o.end)}</small></div>
    </div>
    <div class="hc-ft"><span>${race?esc(race.label):''}</span><span class="hc-vs">${riv.length?'vs. '+esc(riv.map(x=>x.short).join(', ')):'No profiled opponent'}</span></div>
  </article>`;
}
// The featured card (the president): the same Report Card and Money & Influence Analysis as the others. Not being on the
// 2026 ballot, there is no reviewed race money, so the money comes from the daily FEC refresh of the committee that
// still files (filled in by fillFeatured).
function featuredCard(s){
  return `<article class="card sen-card hc hc-feat" tabindex="0" data-id="${s.id}" data-party="${esc(s.party)}" role="link" aria-label="Open profile of ${esc(s.name)}">
    <div class="hc-top">${portrait(s)}<div class="hc-who">
      <div class="row" style="gap:5px"><span class="chip ${s.party}">${s.party} · ${esc(seatLabel(s))}</span><span class="chip ch">${chipCh(s)}</span></div>
      <div class="name">${esc(s.name)}</div><div class="hc-sub">${esc(s.term)}</div></div></div>
    <div class="hc-ideo">${esc(REC_SHORT[s.recordType]||'')} · ${esc(s.seat)}</div>
    ${hcHead('✓','rc','Report Card','Four A–F grades from the documented record and your own answers')}
    ${reportCard(s)}
    ${hcHead('$','mi','Money &amp; Influence Analysis',`Money raised by ${esc(s.cmteName||'the campaign committee')}, and outside spending for and against ${esc(s.short)}, from the daily FEC refresh`)}
    <div class="hc-live" data-live="${s.id}">${featuredMoney(s,null)}</div>
    <div class="hc-ft"><span>Not on the 2026 ballot</span><span class="hc-vs">Open profile →</span></div>
  </article>`;
}
// p is the person's refreshed records (/api/profile), null while loading, or false when the refresh is unreachable.
function featuredMoney(s,p){
  const c=p&&p.sections.campaign, o=p&&p.sections.outside;
  const wait=p===null?'Loading…':p===false?'Refresh unavailable':'Waiting for the FEC refresh';
  const camp=c?`<b>${fmt$(c.receipts)}</b><span>Campaign funds raised</span><small>${shortPer(c.end)}</small>`:`<b class="hc-na">${wait}</b><span>Campaign funds raised</span><small>${esc(s.fecCmte)}, 2025–26</small>`;
  const out=o?`<b class="hc-two"><i class="sw" style="background:var(--s3)"></i>${fmt$(o.support)} <em>for</em><br><i class="sw" style="background:var(--s2)"></i>${fmt$(o.oppose)} <em>against</em></b><span>Outside money</span><small>${shortPer(o.through)}</small>`:`<b class="hc-na">${wait}</b><span>Outside money</span><small>2025–26</small>`;
  const mini=o?miniOutside(s,false,{end:o.through,items:(o.rows||[]).map(r=>({date:r.date,amount:r.amount,role:r.direction==='S'?'for':'against'}))})
    :`<div class="hc-mini"><div class="hc-mh"><span>Outside money by month</span></div><p class="small muted" style="margin:4px 0 0">${p===false?'The refreshed FEC records are unavailable right now.':p===null?'Loading the refreshed FEC records…':'Fills in from the daily FEC refresh.'}</p></div>`;
  return `<div class="hc-money"><div class="hc-mt">${camp}</div><div class="hc-mt">${out}</div></div>${mini}`;
}
async function fillFeatured(){
  for(const el of document.querySelectorAll('.hc-live[data-live]')){
    const s=byId[el.dataset.live];let p=false;
    try{const r=await fetch('/api/profile?id='+encodeURIComponent(s.id),{cache:'no-store'});if(r.ok)p=await r.json();}catch{}
    if(el.isConnected)el.innerHTML=featuredMoney(s,p&&p.sections?p:false);
  }
}
const gradeHow=()=>`<section class="hc-how" aria-labelledby="hc-how-h"><h2 id="hc-how-h" style="font-size:1.05rem">How the grades work</h2>
  <div class="hc-howg">
    <div><h3>Your match</h3>${gradeRule('match')}</div>
    <div><h3>Integrity</h3>${gradeRule('integ')}<p class="small"><a href="#method-integrity">Full Integrity formula and coverage</a></p></div>
    <div><h3>People First</h3>${gradeRule('pvp')}</div>
    <div><h3>Grade scale</h3>${points([['A','90–100'],['B','80–89'],['C','70–79'],['D','60–69'],['F','Below 60'],['Not graded','Too little evidence yet. It never means zero.']],'small')}<p class="small"><a href="#method">Full rules</a></p></div>
  </div></section>`;
let homeSort='', homeParty='';

// ---------- home ----------
function renderHome(){
  const nS=ALL.filter(s=>s.chamber==='S'&&(!s.cand||s.senInc)).length, nH=MEM.filter(s=>s.chamber==='H').length, nC=CANDS.filter(s=>!s.senInc).length, nComp=DATA.races.filter(r=>r.chamber==='S'&&r.competitive).length;
  app.innerHTML=`
  <section class="hero ledger-hero${FEATURED.length?' hero-feat':''}">
    <div class="hero-text">
    <div class="page-eyebrow">PUBLIC RECORDS. PERSONAL PERSPECTIVE.</div>
    <h1>Follow the money.<br><span>Check the record.</span></h1>
    <p class="lede">Find your alignment. Explore the people, promises and public records behind ${DATA.races.length} key 2026 races.</p>
    <div class="hero-stats"><a href="#races"><b>${DATA.races.length}</b><span>Key races</span></a><a href="#senate"><b>${SENATE.length}</b><span>Sitting senators</span></a><a href="#align"><b>${ISS.length}</b><span>Issues to explore</span></a></div>
    <div class="row hero-actions"><a class="cta" href="#align">Set my priorities <span aria-hidden="true">→</span></a><a class="hero-secondary" href="#method">How the grades work ↗</a></div>
    <details class="coverage-details"><summary>About the research <span>Snapshot: ${esc(DATA.asof)}</span></summary>
    ${points([
      ['Who is covered',`${nS} senators and ${nH} House members on the November 3, 2026 ballot, their ${CANDS.filter(c=>!c.openSeat&&!c.senInc).length} opponents, and ${CANDS.filter(c=>c.openSeat).length} nominees for ${DATA.races.filter(r=>r.open).length} open Senate seats. That includes all ${nComp} Senate races rated competitive by Cook, Inside Elections or Sabato.`],
      DATA.election&&['November 3 results',resultsLine()],
      ['Where it comes from','FEC filings, roll-call votes, state legislative records, ethics findings and court records. Every entry links to its source.'],
      ['What each profile shows',"Their record, the money their campaign raised, outside groups' spending for and against them (kept separate), and their statements checked against their actions."],
      ['Grades','Three primary grades: Your Match, Integrity, and People First. "Not graded" means required evidence is missing, never a zero.'],
      SENATE.length&&['Every senator',`<a href="#senate">All ${SENATE.length} sitting senators</a>, with a basic profile for each one not in these races.`]],'lede-pts')}</details>
    </div>
    ${FEATURED.length?`<aside class="hero-side" aria-label="Featured profile">${FEATURED.map(featuredCard).join('')}</aside>`:''}
    <div class="toolbar">
      <div class="seg" id="chs" role="group" aria-label="Chamber"><button data-c="" class="${homeCh===''?'active':''}">All ${ALL.length+BASIC_LIST.length}</button><button data-c="S" class="${homeCh==='S'?'active':''}">Senators</button><button data-c="H" class="${homeCh==='H'?'active':''}">House</button><button data-c="C" class="${homeCh==='C'?'active':''}">Challengers & candidates</button></div>
      <div class="search"><input id="q" type="search" placeholder="Search by name, state or district" aria-label="Search members"></div>
      <label class="small muted">Sort <select id="hsort" aria-label="Sort candidates"><option value="">Default</option><option value="out">Most outside money</option><option value="camp">Most campaign money</option><option value="name">Name</option></select></label>
    </div>
  </section>
  <div class="directory-heading"><div><div class="page-eyebrow">THE PEOPLE BEHIND THE RECORD</div><h2>Explore profiles</h2></div><span id="profile-count" class="small muted" role="status"></span></div>
  <div class="seg party-filter" id="hparty" role="group" aria-label="Filter profiles by party">${[['','All parties'],['D','Democrats'],['R','Republicans'],['I','Independents']].map(([k,l])=>`<button data-p="${k}" aria-pressed="${homeParty===k}" class="${homeParty===k?'active':''}">${l}</button>`).join('')}</div>
  <div class="grid hc-grid" id="cards"></div>
  <details class="directory-method"><summary>How the three grades work</summary>${gradeHow()}</details>
  <section class="section">
    <div class="cols">
      <div class="card"><h3>Head-to-head races</h3><p class="small" style="margin-top:6px">${DATA.election?'Who won on November 3, each candidate\'s share of the vote, and the reported turnout.':'Each candidate next to their 2026 opponents: money raised, cash on hand, and outside spending for and against each side.'}</p><a class="cta" href="#races">See the ${DATA.races.length} races</a></div>
      <div class="card"><h3>Compare the record</h3><p class="small" style="margin-top:6px">How Senate and House members voted on major bills since 2021, with their ideology and money side by side.</p><a class="cta" href="#compare">Open the comparison</a></div>
      <div class="card"><h3>How the numbers work</h3><p class="small" style="margin-top:6px">Every rule, every source and every known gap, in one place.</p><a class="cta" href="#method">Read the methodology</a></div>
    </div>
  </section>`;
  const cards=$('#cards');
  const draw=q=>{
    q=(q||'').trim().toLowerCase();
    const list=ALL.concat(BASIC_LIST).filter(s=>(!homeCh||(homeCh==='C'?(s.cand&&!s.senInc):((!s.cand||s.senInc)&&s.chamber===homeCh)))&&(!homeParty||s.party===homeParty)&&(!q||[s.name,s.state,s.stateName,s.district||'',s.cand?(s.openSeat?'senate candidate open seat':'challenger '+(s.chamber==='S'?'senate':'house')):s.chamber==='S'?'senate senator':'house representative',partyName(s.party)].join(' ').toLowerCase().includes(q)));
    // Basic profiles have no reviewed money, so they sort after everyone with it.
    const key={out:s=>s.basic?1:-(s.out.for.total+s.out.against.total),camp:s=>s.basic||s.camp.missing?1:-s.camp.receipts,name:s=>s.short+' '+s.name}[homeSort];
    if(key)list.sort((x,y)=>{const a=key(x),b=key(y);return typeof a==='number'?a-b:String(a).localeCompare(String(b))});
    $('#profile-count').textContent=`${list.length} profiles · reviewed and basic coverage labeled`;
    cards.innerHTML=list.map(s=>s.basic?basicCard(s):homeCard(s)).join('')||`<p class="muted">No one matches that search. This release covers ${ALL.length} people in ${DATA.races.length} races; the methodology page explains how they were chosen.</p>`;
  };
  draw('');fillBasic(cards);
  $('#q').addEventListener('input',e=>{draw(e.target.value);fillBasic(cards);});
  const hs=$('#hsort');hs.value=homeSort;hs.addEventListener('change',e=>{homeSort=e.target.value;draw($('#q').value);fillBasic(cards);});
  $('#chs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;homeCh=b.dataset.c;$('#chs .active').classList.remove('active');b.classList.add('active');draw($('#q').value);fillBasic(cards);});
  $('#hparty').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;homeParty=b.dataset.p;$('#hparty').querySelectorAll('button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});draw($('#q').value);fillBasic(cards);});
  fillFeatured();
  for(const host of [cards,$('.hero-side')].filter(Boolean)){
    host.addEventListener('click',e=>{const c=e.target.closest('.sen-card');if(c)location.hash=c.dataset.id;});
    host.addEventListener('keydown',e=>{const c=e.target.closest('.sen-card');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();location.hash=c.dataset.id;}});
  }
}

// ---------- profile ----------
// Overview, then one tab per home-card grade, then the money.
const TABS=[['overview','Overview'],['ideology','Ideology'],['word','Keeps Their Word'],['showsup','Shows Up'],['unbought','Unbought'],['aboveboard','Above Board'],['peoplefirst','People First']];
const tabsFor=s=>TABS;
const PANES={ideology:(...a)=>paneIdeology(...a),word:(...a)=>paneWord(...a),showsup:(...a)=>paneShowsUp(...a),unbought:(...a)=>paneUnbought(...a),aboveboard:(...a)=>paneAboveBoard(...a),peoplefirst:(...a)=>panePeopleFirst(...a),overview:(...a)=>paneOverview(...a),integrity:(...a)=>paneIntegrity(...a),match:(...a)=>paneMatch(...a),promises:(...a)=>panePromises(...a),ethics:(...a)=>paneEthics(...a),pvp:(...a)=>panePvp(...a),finance:(...a)=>paneFinance(...a),legislation:(...a)=>paneLegislation(...a),sources:(...a)=>paneSources(...a)};
// Shared profile presentation. The evidence panes and scorer remain the source of truth.
const profileAmount=n=>n==null?'Not available':Math.abs(n)>=1e6?'$'+(n/1e6).toFixed(2)+'M':fmtFull(n);
function profileHeader(s,showFacts=false){
  const basic=!!s.basic,c=s.camp&&!s.camp.missing&&!s.office?s.camp:null;
  const photo=portrait(s), office=basic?'U.S. Senate':s.office?'President':s.chamber==='S'?'U.S. Senate':'U.S. House', res=!basic&&!s.office&&personResult(s);
  const compareHref=s.office?'#home':s.chamber==='H'?'#compare-house':'#compare-senate';
  const details=basic?`<div class="meta"><div><span>In the Senate since</span>${esc(monthYear(s.since))}</div><div><span>2026 ballot</span>${esc(ballotLine(s))}${offBallot(s)?` · next election ${s.nextElection}`:''}</div><div class="roles"><span>Committees / roles</span>${esc(committeesOf(s).map(x=>fullCommittee(x.id)).filter((x,i,a)=>a.indexOf(x)===i).map(id=>COMMITTEES.committees[id]?.name||id).join('; ')||'None listed')}</div><div><span>Identifiers</span>${s.fecCand?'FEC '+esc(s.fecCand)+' · ':''}Bioguide ${esc(s.bioguide)}${s.lis?' · LIS '+esc(s.lis):''}</div></div><div class="links row">${s.fecCand?`<a href="${fecCycleUrl(s.fecCand,s.nextElection)}" target="_blank" rel="noopener">FEC candidate summary ↗</a>`:''}<a href="${cgUrl(s)}" target="_blank" rel="noopener">Congress.gov member page ↗</a>${s.site?`<a href="${esc(s.site)}" target="_blank" rel="noopener">Official site ↗</a>`:''}<a href="#senate">All senators →</a></div>`:`
    <div class="meta">
      <div><span>${s.office?'In office':s.cand?'Current or most recent role':'In the '+CH[s.chamber].name+' since'}</span>${esc(s.since)}</div>
      ${s.office?`<div><span>2026 ballot</span>${esc(s.seat)}</div>`:`<div><span>2026 ${s.cand?'opponents':'opponent'}</span>${esc(s.opponent)} · <a href="#races">race view</a></div>`}
      ${res?`<div><span>November 3, 2026 result</span>${esc(res.text)} ${resultSrc(res.src)}</div>`:''}
      <div class="roles"><span>${s.cand?'Offices held':'Committees / roles'}</span>${esc(s.roles||'None')}</div>
      <div><span>Identifiers</span><span class="mono" style="display:inline;color:var(--ink-2);text-transform:none;letter-spacing:0;font-size:.82rem">FEC ${esc(s.fecCand)}${s.office&&s.fecCmte?' · committee '+esc(s.fecCmte):''}${s.bioguide?' · Bioguide '+esc(s.bioguide):''}</span></div>
    </div>
    <div class="links row">
      <a href="${fecCandUrl(s.fecCand)}" target="_blank" rel="noopener">FEC candidate summary ↗</a>
      ${s.bioguide?`<a href="${cgUrl(s)}" target="_blank" rel="noopener">Congress.gov member page ↗</a>`:''}
      ${s.site?`<a href="${esc(s.site)}" target="_blank" rel="noopener">${s.cand&&!s.office?'Campaign site':'Official site'} ↗</a>`:''}
      <a href="#${s.id}-sources">All sources for this profile →</a>
    </div>

  `;
  return `<header class="phead profile-hero" data-party="${esc(s.party)}">
    <div class="profile-main"><div class="profile-photo">${photo}</div><div class="profile-identity">
      <div class="page-eyebrow">${basic?'SENATE DIRECTORY':'THE PUBLIC RECORD'}</div><h1>${esc(s.name)}</h1>
      <p class="profile-office">${partyName(s.party)} · ${esc(s.stateName||s.state||'United States')}${s.chamber==='H'?' · '+esc(s.district):''} · ${office}</p>
      <div class="row"><span class="chip ${basic?'ghost':'profile-reviewed'}">${basic?'Basic profile · not yet reviewed':'Reviewed research'}</span><span class="small muted">${esc(basic?'Term ends '+fmtDate(s.termEnd):termNow(s)||'')}</span></div>
      ${res?`<p class="small profile-result">${resultChip(res.o)} ${esc(res.after)} <span class="muted">(${esc(RESULTS_ASOF())})</span></p>`:''}
      ${s.cand?`<p class="small profile-background">${esc(s.status||s.background||'')}</p>`:''}
    </div><div class="profile-actions"><a class="profile-compare" href="${compareHref}">${s.office?'Explore people':'Compare'}</a><button class="profile-share" type="button">Share scorecard <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M11 3h6v6M17 3l-8 8M8 4H4v12h12v-4"/></svg></button></div></div>
    ${showFacts?`<div class="profile-facts">${c?[['Raised',c.receipts],['Cash on hand',c.cash],['Spent',c.disbursements]].map(([label,n])=>`<div class="profile-fact"><span>${label}</span><b title="${esc(n==null?'Not available':fmtFull(n))}">${profileAmount(n)}</b></div>`).join(''):`<div class="profile-fact profile-fact-empty"><span>${s.office?'Officeholder profile':'Campaign records'}</span><b>${s.office?'Not on the 2026 ballot':basic?'Awaiting reviewed data':'No FEC report available'}</b></div>`}</div>
    <p class="profile-period small muted">${c?`Campaign filings: ${period(c.start,c.end)}${c.src?` · <a href="${esc(c.src)}" target="_blank" rel="noopener">FEC source ↗</a>`:''}`:basic?'Official records remain available in the tabs below.':esc(s.seat||'Campaign records are on the Money & Influence tab.')}</p>
    `:''}
    <details class="profile-details"><summary>Biography, committees & source links</summary>${s.cand?`<p class="small">${esc(s.status||'')}${s.statusSrc?` <a href="${esc(s.statusSrc.u)}" target="_blank" rel="noopener">${esc(s.statusSrc.t)} ↗</a>`:''}</p>${s.background?`<p class="small muted">${esc(s.background)}</p>`:''}`:''}${details}</details>
  </header>`;
}
function profileReport(s){
  return `<section class="profile-report" aria-label="Four measures from the public record">${s.basic?basicReport(s,true):reportCard(s,true)}<p class="profile-coverage">${s.basic?'Not graded until the research is reviewed.':'Based on reviewed records. Coverage varies; some methodology weights remain under review.'} <a href="${s.basic?'#method':'#'+s.id+'-sources'}">Sources & coverage ↗</a></p></section>`;
}
function evidenceStrip(s){
  return `<aside class="evidence-strip"><div><div class="page-eyebrow">FOLLOW THE EVIDENCE</div><h3>Every conclusion has a paper trail.</h3><p class="small muted">Research snapshot: ${esc(DATA.asof)} · Each source keeps its own reporting period.</p></div><div class="row"><a href="${s.basic?'#method-sources':'#'+s.id+'-sources'}">${s.basic?'Source guide':'Profile sources'} ↗</a><a href="#method">Methodology ↗</a><a href="#method-log">Score history ↗</a></div></aside>`;
}
function bindProfileActions(s,pane){
  $('.profile-share')?.addEventListener('click',async()=>{
    let c=s.camp&&!s.camp.missing&&!s.office?s.camp:null;
    if(s.basic||s.office){try{const records=await loadCards();c=records?.[s.id]?.campaign||null;}catch{}}
    const m=scoreFor(s), i=s.basic?null:integritySnapshot(s), v=s.basic?null:personPvp(s);
    openScorecard({id:s.id,name:s.name,party:s.party,office:s.office?'President':CH[s.chamber].name,state:s.stateName||s.state||'United States',portrait:PORTRAITS[s.id]?.file?'/'+PORTRAITS[s.id].file:'',raised:c?.receipts,cash:c?.cash,period:c?.end?period(c.start,c.end):'No reviewed campaign period available',reviewedAt:s.basic?'Research not reviewed':DATA.asof,matchConfigured:true,grades:s.basic?SIX.filter(x=>x.grade).map(x=>({label:x.name,value:null,detail:'Research not reviewed'})):(()=>{const x=sixOf(s),tile=k=>document.querySelector(`[data-six-tile="${k}"] .hc-gv span`)?.textContent;const u=Number(tile('unbought'));return [{label:'Keeps Their Word',value:x.word.pct,detail:x.word.why||`${x.word.score.clear} counted checks`},{label:'Shows Up',value:x.showsup.pct,detail:x.showsup.why||x.showsup.parts[0].note},{label:'Unbought',value:Number.isFinite(u)?u:null,detail:Number.isFinite(u)?'IntegrityIndex.us formula':'See the profile'},{label:'Above Board',value:x.aboveboard.pct,detail:x.aboveboard.why||''},{label:'People First',value:x.peoplefirst.pct,detail:x.peoplefirst.why||`${x.peoplefirst.v?.n||0} scored actions`}];})()});
  });
  pane.querySelectorAll('.profile-subnav [data-section]').forEach(b=>{
    if(!pane.querySelector('#'+b.dataset.section)){b.hidden=true;return;}
    b.addEventListener('click',()=>{const target=pane.querySelector('#'+b.dataset.section);if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({behavior:'smooth',block:'start'});}});
  });
}
const sectionNav=items=>`<nav class="profile-subnav" aria-label="On this page">${items.map(([id,label])=>`<button type="button" data-section="${id}">${label}</button>`).join('')}</nav>`;
function financeExplorerModel(){return {people:ALL.concat(BASIC_LIST),data:DATA,portraits:PORTRAITS,recordLive:window.RecordLive};}
function profileLocation(view){
  if(SIX_BY[view])return {primary:view,view};
  return {primary:'overview',view:view==='sources'?'sources':'overview'};
}
function sectionSwitch(s,items,active){
  return `<nav class="profile-section-switch" aria-label="Section">${items.map(([key,label])=>`<a class="profile-section-link ${key===active?'active':''}" href="#${s.id}-${key}"${key===active?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}
// ---------- The six score tabs (Scores/06_SIX_GRADES_PROPOSAL.md) ----------
// Each tab: the score's tag, name and definition; the person; the score card with its breakdown; the sources and what
// grading needs; the evidence it counts; what's shown but not counted; how it's calculated; the documented assumptions.
const SIX_CTX={attendance:window.ATTENDANCE||null,getItDone:window.GET_IT_DONE||null,conflicts:window.CONFLICTS||null,ratings:window.GROUP_RATINGS?.people||null};
const GROUP_RATINGS=window.GROUP_RATINGS||{groups:{},people:{}};
const sixCache=new Map();
const sixOf=s=>{if(!sixCache.has(s.id))sixCache.set(s.id,SCORER.six(s,SIX_CTX));return sixCache.get(s.id);};
const SIX_BY=Object.fromEntries(SIX.map(x=>[x.key,x]));
const officeLabel=s=>s.office?'PRESIDENT':s.cand?(s.chamber==='H'?'HOUSE CANDIDATE':'SENATE CANDIDATE'):s.chamber==='S'?'SENATOR':'REPRESENTATIVE';
const placeLabel=s=>s.chamber==='H'&&s.district?`${s.stateName||s.state} · ${s.district}`:(s.stateName||s.state||'United States');
const pts1=v=>v==null?'—':v===0?'0':(v>0?'+':'−')+Math.abs(Math.round(v*10)/10).toFixed(1);
function stHead(s,key){
  const m=SIX_BY[key];
  return `<header class="st-head"><div class="st-title"><div class="st-tag">${esc(m.tag)}</div><h2>${esc(m.name)}</h2><p>${esc(m.q)}</p></div>
    <div class="st-person" data-party="${esc(s.party)}"><div class="st-photo">${portrait(s)}</div><div class="st-who"><div class="st-office">${officeLabel(s)}</div><div class="st-name">${esc(s.name)}</div><div class="st-place">${esc(partyName(s.party))} · ${esc(placeLabel(s))}</div></div></div></header>`;
}
// The score card: the number out of 100 and its letter, or why it isn't graded yet, beside the breakdown.
function stCard(key,res,breakdown){
  const m=SIX_BY[key],g=res?.pct==null?null:letter(Math.min(100,res.pct));
  if(res?.position!=null)return `<section class="st-card" aria-label="${esc(m.name)}"><div class="st-card-h"><h3>Political position (overall)</h3><span class="st-grade">${esc(res.badge)}</span></div><div class="st-card-b st-card-pos">${res.position}${breakdown}</div></section>`;
  const big=res?.loading?`<div class="st-ng"><b>Reading the records…</b><span>${esc(res.loading)}</span></div>`:g?`<div class="st-big"><b>${res.pct}</b><span>/ 100</span></div><div class="st-letter"><span>Grade</span><b class="gr-${g}">${g}</b></div>`:`<div class="st-ng"><b>Not graded yet</b><span>${esc(res?.why||'')}</span></div>`;
  return `<section class="st-card" aria-label="${esc(m.name)} score"><div class="st-card-h"><h3>${esc(m.name)}</h3><span class="st-grade">${g?`${res.pct} / 100 · Grade <b class="gr-${g}">${g}</b>`:res?.loading?'Loading':'Not graded yet'}</span></div><div class="st-card-b"><div class="st-score">${big}</div><div class="st-break">${breakdown}</div></div></section>`;
}
// A breakdown table: head [labels], rows [[cells]]; a cell is text or {v, cls}.
const stTable=(head,rows,cls='',right=null)=>{const R=i=>right?right.includes(i):i>0;return `<div class="tablewrap"><table class="st-table ${cls}"><thead><tr>${head.map((h,i)=>`<th${R(i)?' class="r"':''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${R(i)?' class="r"':''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;};
// A signed bar for a part's points: green when it adds, red when it takes away, to the scale of the largest part.
const stBar=(v,max)=>v==null?'':`<span class="st-bar ${v<0?'neg':'pos'}" style="--w:${Math.min(100,Math.abs(v)/(max||1)*100).toFixed(1)}%"></span>`;
function stSide(sources,needs,notes=[],needsTitle='What we need before grading'){
  return `<aside class="st-side"><h3>Sources</h3><ul class="st-src">${sources.map(t=>`<li>${t}</li>`).join('')}</ul>
    <h4>${esc(needsTitle)}</h4><ul class="st-needs">${needs.map(([t,ok])=>`<li class="${ok?'ok':'no'}"><span class="st-tick" aria-hidden="true">${ok?'✓':'○'}</span><span>${esc(t)}<span class="sr-only">${ok?': in hand':': not yet'}</span></span></li>`).join('')}</ul>
    ${notes.map(([h,t])=>`<p class="st-note"><span aria-hidden="true">ⓘ</span><span><b>${h}</b> ${t}</span></p>`).join('')}</aside>`;
}
function stFrame(s,key,{res,breakdown,sources,needs,notes,needsTitle,evidenceTitle,evidence='',shown='',calc,assumptions,method}){
  return `<div class="st" data-score="${key}">${stHead(s,key)}<div class="st-grid">${stCard(key,res,breakdown)}${stSide(sources,needs,notes,needsTitle)}</div>
    <h3 class="st-evh">${evidenceTitle}</h3><div class="st-evidence">${evidence}</div>
    ${shown?`<details class="st-more st-shown"><summary>Shown, not counted in ${esc(SIX_BY[key].name)}</summary><div class="st-more-b">${shown}</div></details>`:''}
    <details class="st-more"><summary>How it's calculated</summary><div class="st-more-b">${calc}</div></details>
    <details class="st-more"><summary>Documented assumptions</summary><div class="st-more-b"><ol class="st-assume">${assumptions.map(a=>`<li>${a}</li>`).join('')}</ol></div></details>
    <p class="small muted st-method">See the <a href="#method-${method}">Methodology page</a> for the full formula, data standards and assumptions.</p></div>`;
}
const stF=t=>`<div class="st-formula">${t}</div>`;

// ----- Ideology -----
const RATING_PAIRS=[['Guns',['NRA'],['Giffords','Everytown']],['Abortion',['SBA Pro-Life America','National Right to Life'],['Planned Parenthood Action','Reproductive Freedom for All']],
  ['Environment',[],['League of Conservation Voters','Environmental Defense Fund','NRDC']],['Labor',['U.S. Chamber of Commerce','NFIB'],['AFL-CIO','SEIU','AFSCME','NEA','AFT']],
  ['Taxes & spending',['Club for Growth','Americans for Prosperity'],[]],['Civil rights',[],['Human Rights Campaign','ACLU']],['Overall',['Heritage Action','Senate Conservatives Fund'],[]]];
const leanPos=v=>((Math.max(-100,Math.min(100,v))+100)/2).toFixed(1);
// What the probe found about a group without a reader yet (scripts/collect-ratings.mjs, PROBED).
const RATING_WHY={blocked:'its site turns scripts away',none:'no congressional scorecard found',states:'rates states, not members of Congress',
  'no-list':'grades are announced one at a time, not published as a list',permission:'waiting on their permission',
  'to-build':'reader still to be written'};
// One group's rating of this person, exactly as published, with the year and a link; or why there isn't one.
function ratingCell(s,org){
  const g=Object.entries(GROUP_RATINGS.groups||{}).find(([,x])=>x.org===org),key=g?.[0],grp=g?.[1];
  const mine=(GROUP_RATINGS.people?.[s.id]||[]).find(r=>r.group===key);
  if(mine){const v=mine.grade||`${mine.score}%`;return `<a href="${esc(mine.url)}" target="_blank" rel="noopener">${esc(org)}</a> <b>${esc(v)}</b> <span class="muted small">· ${esc(mine.year||grp?.year||'')}${mine.lifetime!=null?` · lifetime ${mine.lifetime}%`:''}</span>`;}
  const why=grp?.read?'not rated by them':grp?.why?`not read: ${grp.why}`:grp?.status?RATING_WHY[grp.status]:'not read yet';
  return `${grp?.url?`<a href="${esc(grp.url)}" target="_blank" rel="noopener">${esc(org)}</a>`:esc(org)} <span class="muted small">· ${esc(why)}</span>`;
}
function leanScale(s,x){
  const peers=ALL.filter(p=>p.id!==s.id&&p.chamber===s.chamber&&!p.office).map(p=>({p,l:sixOf(p).ideology.lean})).filter(r=>r.l!=null);
  return `<div class="st-scale" role="img" aria-label="${x.lean==null?'Not placed yet':`${esc(s.name)}: ${signed(x.lean)}, ${x.label}`}">
    <div class="st-scale-ends"><span><b>Liberal</b> −100</span><span><b>Conservative</b> +100</span></div>
    <div class="st-scale-bar">${peers.map(r=>`<i class="st-peer ${esc(r.p.party)}" style="left:${leanPos(r.l)}%" title="${esc(r.p.name)}: ${signed(r.l)}"></i>`).join('')}${x.lean==null?'':`<span class="st-mark${x.lean<-60?' lft':x.lean>60?' rgt':''}" style="left:${leanPos(x.lean)}%"><em>${esc(s.short||s.name)}: ${signed(x.lean)} · ${esc(x.label)}</em></span>`}</div>
    <div class="st-scale-ticks">${[-100,-60,-20,20,60,100].map(t=>`<span style="left:${leanPos(t)}%">${signed(t)}</span>`).join('')}</div>
    <p class="small muted">${peers.length?`Small marks: the other ${peers.length} ${s.chamber==='S'?'Senate':'House'} profiles with a lean, by party.`:''} Bands: very liberal below −60, liberal to −20, moderate to +20, conservative to +60, very conservative above.</p></div>`;
}
function paneIdeology(s,pane){
  const x=sixOf(s).ideology,max=100;
  const issueRows=x.issues.map(i=>{
    const n=i.n?`${i.n} ${i.basis==='statements'?`statement${i.n===1?'':'s'} (half weight)`:`vote${i.n===1?'':'s'} or bill${i.n===1?'':'s'}`}`:'No record yet';
    const pos=i.cross?(i.n?`<span class="muted">Splits both parties</span>`:'—'):i.lean==null?'<span class="muted">No record yet</span>':`<b>${signed(i.lean)}</b> <span class="muted">${esc(leanLabel(i.lean))}</span>`;
    return [`<a href="#${s.id}-ideology" data-issue="${esc(i.id)}">${esc(i.label)}</a>${i.cross&&i.note?`<div class="small muted">${esc(i.note)}</div>`:''}`,pos,i.lean==null?'':`<span class="st-lean${i.lean<0?' neg':''}" style="--x:${leanPos(i.lean)}%" aria-hidden="true"><i></i></span>`,n];
  });
  const ratings=stTable(['Issue','Conservative side','Liberal side'],RATING_PAIRS.map(([issue,con,lib])=>[esc(issue),con.length?con.map(o=>ratingCell(s,o)).join('<br>'):'<span class="muted">Not tracked yet</span>',lib.length?lib.map(o=>ratingCell(s,o)).join('<br>'):'<span class="muted">Not tracked yet</span>']),'st-pairs',[]);
  const position=`<div class="st-ideo-pos"><div class="st-ideo-n">${x.lean==null?'<b>Not placed yet</b>':`<b>${signed(x.lean)}</b><span>${esc(x.label)}</span>`}</div>${leanScale(s,x)}${x.lean==null?`<p class="small">${esc(x.why)}.</p>`:''}</div>`;
  const checks=`<div class="st-checks"><div class="st-check"><h4>DW-NOMINATE <span class="muted small">(Voteview)</span></h4>${x.dw==null?'<p class="small muted">No score: it covers members of Congress, from their roll-call votes.</p>':`<div class="st-check-n">${s.ideo.dim1.toFixed(3)} → <b>${signed(x.dw)}</b></div><p class="small muted">Their career score, on the same scale. It rarely passes ±80, so it reads closer to the middle than the issue leans.</p>`}</div>
    <div class="st-check"><h4>Ratings lean</h4>${x.ratings.lean==null?'<p class="small muted">Not read yet: the groups\' scorecards are read from their own sites once a year.</p>':`<div class="st-check-n"><b>${signed(x.ratings.lean)}</b></div>`}</div></div>`;
  const measures=stTable(['Measure','Lean','Based on'],[['Issue leans (overall)',x.lean==null?'—':`<b>${signed(x.lean)}</b>`,`${x.scored} left–right issue${x.scored===1?'':'s'}`],['Ratings lean',x.ratings.lean==null?'<span class="muted">not read yet</span>':`<b>${signed(x.ratings.lean)}</b>`,`${x.ratings.rows.length} group rating${x.ratings.rows.length===1?'':'s'}`],['DW-NOMINATE',x.dw==null?'—':`<b>${signed(x.dw)}</b>`,'Voteview, career']],'st-measures');
  pane.innerHTML=stFrame(s,'ideology',{
    res:{position,badge:x.lean==null?'Not placed yet':`${signed(x.lean)} · ${x.label}`},breakdown:measures,needsTitle:'What we need to place them',
    sources:['<b>Votes:</b> roll calls in Congress, and state votes for state legislators.','<b>Bills:</b> bills they sponsored and cosponsored.','<b>Statements:</b> speeches, press releases and campaign positions, counted half and only on issues with no votes.','<b>Each vote\'s side:</b> reviewed and cited on each issue (which side of the question a Yea takes).','<b>Voteview:</b> DW-NOMINATE.','<b>Group scorecards:</b> each group\'s own published ratings.'],
    needs:x.needs,
    notes:[['A position, not a grade.','Liberal and conservative are shown neutrally. Keeps Their Word, Shows Up, Unbought, Above Board and People First are the grades.'],['When the measures disagree,','the gap is shown, not averaged away.']],
    evidenceTitle:'Evidence: positions and outside ratings',
    evidence:`<h4 class="st-sub">Lean on each issue</h4>${stTable(['Issue','Position (−100 to +100)','','Based on'],issueRows,'st-issues',[])}${checks}<h4 class="st-sub">Interest-group ratings</h4><p class="small muted">Published ratings, shown in opposing pairs exactly as each group gives them, with the year and a link.${GROUP_RATINGS.checked?` Read ${esc(fmtDate(GROUP_RATINGS.checked))}.`:''} A group without a rating says why.</p>${ratings}
      <section class="st-match" id="i-match"><h4 class="st-sub">Your Match</h4><p class="small muted">Compare your positions on each issue with ${esc(s.short||s.name)}'s record. Saved only in this browser.</p><details class="st-more st-match-b"><summary>Set your issue positions</summary><div class="st-more-b"><div id="m-al"></div></div></details></section>`,
    shown:`<div id="rec-ideo">${ideoBlock(s,'ideo2')}<div class="chart">${kvBlock(s,'kv2',true)}</div></div>${positionBlock(s)}<div id="legislation-lists"></div><div id="legislation-record"></div>`,
    calc:`${stF('Issue lean = 100 × (conservative items − liberal items) ÷ all items')}${stF('Overall lean = average of the issue leans on the left–right issues (at least 3)')}${stF('Ratings lean = average of (2 × score − 100) for conservative groups and −(2 × score − 100) for liberal groups')}${stF('DW-NOMINATE lean = 100 × their first-dimension score')}${stF('Your Match = share of their record on your side, by issue, weighted by how much each issue matters to you')}
      <p class="small">An item is a vote, bill, cosponsorship or official act, one per bill; statements count only on an issue with no action. Letter grades convert A 100, B 75, C 50, D 25, F 0.</p>`,
    assumptions:['Votes, bills and cosponsorships set the issue positions.','Statements count half, and only when there are no votes on that issue.','Each vote\'s side on its issue is reviewed and cited; the issue says which side is the liberal one.','Issues that split both parties (tariffs, Ukraine aid, war powers, Jan. 6, infrastructure, ethics) are shown, not averaged into the overall lean.','Group ratings are read from each group\'s own site once a year and shown as published, with the year and a link. Groups whose sites block scripts or publish only images are left out rather than entered by hand. Vote Smart isn\'t used: its ratings cost $350 a month.','DW-NOMINATE comes from Voteview.'],
    method:'ideology'});
  alignInto(s,pane.querySelector('#m-al'));
  mountIdeo('ideo2',s);mountKV('kv2',s);
  mountLegislation(pane.querySelector('#legislation-lists'),{person:s,data:DATA,recordLive:window.RecordLive});
  recordInto(s,pane.querySelector('#legislation-record'));
  pane.querySelectorAll('[data-issue]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const t=pane.querySelector('#m-al');if(t)t.scrollIntoView({behavior:'smooth',block:'start'});}));
  bindTips(pane);
}

// ----- Keeps Their Word -----
function paneWord(s,pane){
  const x=sixOf(s).word,p=x.score;
  pane.innerHTML=stFrame(s,'word',{
    res:x,
    breakdown:stTable(['Outcome','Count'],[['Kept',p.kept],['Partly kept or changed',p.half],['Broken',p.broken],['<b>Counted checks</b>',`<b>${p.clear}</b>`]])+(p.notCounted+p.vague+(p.debate||0)?`<p class="small muted">${p.notCounted+p.vague+(p.debate||0)} more listed below but not counted (waiting on a vote, vague, or said in debate).</p>`:''),
    sources:['Campaign websites and posts.','Speeches.','Press releases.','Signed pledges.','Later votes and bills.',s.office?'PolitiFact\'s promise tracker.':null].filter(Boolean),
    needs:x.needs,
    notes:[['PolitiFact\'s tracker','applies to presidents only.'],['Unknown is not broken.','A promise without enough follow-up evidence is shown as waiting, not counted as broken.']],
    evidenceTitle:'Evidence: promises and what they did afterward',
    evidence:'<div id="word-evidence"></div>',
    calc:`${stF('Keeps Their Word = 100 × (kept + ½ × (partly kept + changed)) ÷ (kept + partly kept + changed + broken)')}${p.clear?`<p class="small">${x.pct==null?'Not graded yet':''}${p.clear?`(${p.kept} + ½ × ${p.half}) ÷ ${p.clear} = ${p.clear?Math.round((p.kept+p.half/2)/p.clear*1000)/10:0}%`:''}.</p>`:''}<p class="small">At least ${MIN_CHECKS} counted checks are needed. A promise left unacted at the end of a term counts as broken.</p>`,
    assumptions:['Each promise is checked against the action that decided it: the final vote, a sponsorship, or a signature.','Promises found automatically on campaign sites are labeled "matched automatically"; "no action found" isn\'t counted.','Vague goals, promises with no related bill yet, unclear checks and statements made in debate the day of the vote or the day before are shown, not scored.','A reviewed pledge counts as a promise kept or broken.','For a president, PolitiFact\'s ratings count: Promise Kept 1, Compromise ½, Promise Broken 0; Stalled and In the Works wait.'],
    method:'word'});
  panePromises(s,pane.querySelector('#word-evidence'),{embedded:true,bare:true});
}

// ----- Shows Up -----
function paneShowsUp(s,pane){
  const x=sixOf(s).showsup,a=x.parts[0],g=x.parts[1];
  const row=p=>[esc(p.label),p.value==null?'—':String(p.value),p.weight?`× ${p.weight}`:'—',p.value==null||!p.weight?'—':(Math.round(p.value*p.weight*10)/10).toFixed(1)];
  pane.innerHTML=stFrame(s,'showsup',{
    res:x,
    breakdown:stTable(['Part','Score','Weight','Points'],[row(a),row(g),['<b>Total</b>','','',x.pct==null?'—':`<b>${x.pct}</b>`]])+`<p class="small muted">${esc(a.note||'')}${g.note?` · ${esc(g.note)}`:''}</p>`,
    sources:['<b>Roll-call record:</b> every recorded roll call from 2018 on, from Voteview.','<b>Sponsored bills:</b> the bills they sponsored and how far each got, from Congress.gov.','<b>Party comparison:</b> the typical advancement rate for their party in their chamber.'],
    needs:x.needs,
    notes:[['A fair comparison','uses the same definition of "advanced" and the same years for the member and their party.'],['Unknown is not zero.','Without a record, Shows Up says so rather than scoring it.']],
    evidenceTitle:'Evidence: votes missed and bills moved',
    evidence:`<div id="showsup-evidence">${showingUpDetails(s,x.detail)}</div>`,
    calc:`${stF('Shows Up = 0.75 × Attendance + 0.25 × Get It Done')}${stF('Attendance = 100 − 5 × % of votes missed')}${stF('Get It Done = 100 × min(1, their bills advanced rate ÷ their party\'s typical rate)')}${x.pct!=null&&g.value!=null?`<p class="small">0.75 × ${a.value} + 0.25 × ${g.value} = ${Math.round((0.75*a.value+0.25*g.value)*10)/10}, rounded to ${x.pct}.</p>`:x.pct!=null?`<p class="small">Get It Done isn't available, so Shows Up is Attendance alone: ${a.value}.</p>`:''}`,
    assumptions:['The same roll-call period (2018 on) counts for everyone compared.','"Not voting", paired and announced votes are missed; Present counts as there. A reviewed, cited medical leave, birth or adoption, death in the family or military duty is left out.','Bills and joint resolutions count; one advanced when a committee reported it, a chamber passed it, or it became law. At least 10 sponsored bills.','Get It Done is capped at 100 when they meet or beat their party\'s typical rate.','The record shows that a vote was missed, not why or where they were.'],
    method:'showsup'});
}

// ----- Unbought (async: the gift sizes and the financial disclosure come from the refreshed official records) -----
function unboughtInputs(s){
  const pacRows=[];for(const [i,amount] of (s.pac?.rows||[])){const t=pacTypeOf(DATA,i);if(t&&amount>0)pacRows.push({kind:t.kind,amount});}
  const bundled=Object.entries(DATA.bundled?.people?.[s.id]||{}).map(([group,r])=>({group,amount:r.routed}));
  const hand=(s.conduit?.rows||[]).map(r=>({group:r.conduit,amount:r.amount}));
  return {pacRows,earmarks:bundled.concat(hand).filter(r=>Number.isFinite(r.amount)),pledges:unboughtPledges(s,DATA.billIndex||[])};
}
function unboughtBreakdown(x){
  const max=Math.max(1,...x.parts.map(p=>Math.abs(p.points||0)));
  const items=p=>p.items?`<ul class="st-items">${p.items.map(b=>`<li class="${b.status}"><span aria-hidden="true">${b.status==='yes'?'✓':b.status==='waiting'?'…':'✕'}</span><span><b>${esc(b.label)}</b>${b.status==='yes'?` +${b.points}`:''} <span class="muted">${esc(b.status==='waiting'?'waiting: ':'')}${esc(b.why)}</span></span></li>`).join('')}</ul>`:`<div class="small muted">${esc(p.note||'')}</div>`;
  return stTable(['Part','Points',''],x.parts.map(p=>[`${esc(p.label)}${items(p)}`,p.points==null?'<span class="muted">waiting</span>':`<b class="${p.points<0?'st-neg':p.points>0?'st-pos':''}">${pts1(p.points)}</b>`,stBar(p.points,max)]),'st-unbought');
}
function unboughtCalc(s,x){
  const W=UNBOUGHT[s.chamber==='S'?'S':'H'],ch=s.chamber==='S'?'Senate':'House';
  return `${stF('Unbought = 75 + Donor − PAC − PAC Reliance − Earmarks − Stocks − Trades + Bonuses + Pledges, never below 0')}
    <p class="small"><b>${ch} weights.</b> Donor: share of receipts × ${W.donor.join(' · ')} for gifts ≤$200, $200–499, $500–999, $1,000–1,999 and $2,000+ (unitemized ${W.unitemized}, not yet sorted ${W.unsorted}, self-funding ${W.self}, joint fundraising ${W.joint}), up to ${W.donorCap}.
    PAC: dollars × ${Object.entries(W.pac).filter(([k])=>k!=='ideological'&&k!=='other').map(([k,v])=>`${UNBOUGHT_PAC_LABEL[k].toLowerCase()} ${v}`).join(' · ')}, up to ${UNBOUGHT.pacFloor}.
    PAC Reliance: ${UNBOUGHT.reliance.max} × Hill(PAC share, ${UNBOUGHT.reliance.midpoint*100}%). Earmarks: dollars × ${UNBOUGHT.earmark} (not ActBlue or WinRed).
    Stocks: ${UNBOUGHT.stocks.max} × Hill(stock value, $${UNBOUGHT.stocks.midpoint.toLocaleString('en-US')}). Trades: ${UNBOUGHT.trades.countMax} × Hill(count, ${UNBOUGHT.trades.countMidpoint}) + ${UNBOUGHT.trades.valueMax} × Hill(value, $${UNBOUGHT.trades.valueMidpoint.toLocaleString('en-US')}).
    Bonuses: +${UNBOUGHT.bonus.noCorporatePac} no corporate PAC money · +${UNBOUGHT.bonus.corporatePacPledge} pledged not to take it · +${UNBOUGHT.bonus.noStocks} no individual stocks. Pledges and bills: +1 each for banning lobbying by former members, banning congressional stock trading, and overturning Citizens United.
    Hill(x, m) = x<sup>0.745</sup> ÷ (m<sup>0.745</sup> + x<sup>0.745</sup>).</p>
    ${x?.pct!=null?`<p class="small">${x.parts.map(p=>`${p.label} ${pts1(p.points)}`).join(' · ')} → 75 ${x.parts.map(p=>p.points<0?`− ${Math.abs(p.points).toFixed(1)}`:`+ ${(p.points||0).toFixed(1)}`).join(' ')} = ${Math.round(x.raw*10)/10}, rounded to ${x.pct}.</p>`:''}`;
}
function holdingsEvidence(s,d,x){
  const nw=d?.netWorth,held=x?.held,tr=x?.traded;
  const stocks=(nw?.assets||[]).filter(a=>assetKind(a)==='stock');
  return `<section class="st-sec" id="u-holdings"><h4 class="st-sub">Stocks held and trades</h4>
    <p class="small">${held?.blindTrust?'Their holdings are in a qualified blind trust, so there is no stock penalty.':held?.value!=null?`Their ${nw?.year||'latest'} annual report lists ${held.count} individual stock${held.count===1?'':'s'} or option${held.count===1?'':'s'} worth ${fmtFull(Math.round(held.value))} (the middle of each range).${nw?.url?` <a href="${esc(nw.url)}" target="_blank" rel="noopener">Report ↗</a>`:''}`:esc(held?.why||'Their annual financial disclosure hasn\'t been read yet.')}</p>
    ${stocks.length?`<details class="tv"><summary>${stocks.length} individual stock${stocks.length===1?'':'s'} on the report</summary>${stTable(['Asset','Value range'],stocks.slice(0,80).map(a=>[esc(a.name||''),esc(a.value||'')]),'',[1])}</details>`:''}
    <p class="small">${tr?.count!=null?`${tr.count} trade${tr.count===1?'':'s'} in the campaign's reporting period, worth ${fmtFull(Math.round(tr.value))} in all (the middle of each range).`:esc(tr?.why||'Their stock trade reports haven\'t been read yet.')} The full list of their trades, with filing dates and conflict checks, is on the <a href="#${s.id}-aboveboard">Above Board</a> tab.</p></section>`;
}
function pledgesEvidence(s,pl){
  return `<section class="st-sec" id="u-pledges"><h4 class="st-sub">Pledges and reform bills</h4>${stTable(['Category','Points','How'],pl.map(p=>[esc(p.label),p.points?`+${p.points}`:'0',p.via==='pledge'?'Signed the pledge':p.via==='bill'?`Cosponsored ${esc(p.title||p.bill||'a reform bill')}`:p.via==='broken'?'Pledge reviewed as broken: no point':'No pledge or cosponsored bill on file']),'',[1])}<p class="small muted">The corporate-PAC pledge counts as its own +1 bonus. A broken pledge also counts as broken in Keeps Their Word.</p></section>`;
}
function paneUnbought(s,pane){
  const inputs=unboughtInputs(s);
  const draw=(x,d)=>stFrame(s,'unbought',{
    res:x,breakdown:x?.parts?.length?unboughtBreakdown(x):'',
    sources:['<b>FEC reports:</b> gifts by size, PAC money by type, and gifts routed through groups.','<b>Financial disclosures:</b> the stocks they hold and the trades they report.','<b>Pledges and bills:</b> pledges they signed and reform bills they cosponsored.'],
    needs:x?.needs||[['The cycle\'s FEC report',!!(s.camp&&!s.camp.missing)],['Their financial disclosure read (holdings and trades)',false]],
    notes:[['Unknown is not none.','Missing records stay unknown; the stock terms are never dropped to make a grade possible.'],['Earmarks are partial.','Gifts routed through 5 groups are collected so far, so the penalty may be too small.'],['Formula:','<a href="https://integrityindex.us/methodology" target="_blank" rel="noopener">IntegrityIndex.us\'s published formula ↗</a>, with House and Senate weights.']],
    evidenceTitle:'Evidence: where the money comes from',
    evidence:`${s.office?'':moneyMapBlock(s,{bundled:DATA.bundled?.people?.[s.id],groups:Object.fromEntries((DATA.groupPos||[]).map(g=>[g.key,g.org])),categories:DATA.categories||{}})}${holdingsEvidence(s,d,x)}${pledgesEvidence(s,inputs.pledges)}`,
    shown:`<div id="u-finance"></div><div id="u-connections"></div>`,
    calc:unboughtCalc(s,x),
    assumptions:['PAC penalty: at most 30 points (their page says it is capped but gives no number).','Donor score: 0 to 16 for the House, 0 to 14 for the Senate.','PAC Reliance uses a 20% midpoint.','Stocks: the total of the middle of each individual stock\'s value range on their latest annual report ("avg_value" on their page is read as that total). Funds, bonds, property and cash are left out; a qualified blind trust removes the penalty.','Trade value: their published maximum (0.00001) is copied as published, so trade value barely counts. Trades are those in the campaign\'s reporting period.','The itemized PAC lines read so far give each PAC type\'s share, applied to the FEC\'s PAC total for the period.','When the FEC\'s gift-size split isn\'t read for the period, itemized gifts count at the not-yet-sorted rate, as their formula scores gifts the FEC hasn\'t sorted.','A broken pledge earns no point; a cosponsored bill still can. This is our one deliberate difference from their page.','Disclosures are read automatically from the official reports; paper filings and open-ended values wait.'],
    method:'unbought'});
  const first=s.office?unbought(s):unbought(s,{...inputs});
  pane.innerHTML=draw(s.office?first:{...first,pct:null,why:null,loading:'the FEC gift sizes and their financial disclosure'},null);
  const mountShown=()=>{
    const fin=pane.querySelector('#u-finance'),con=pane.querySelector('#u-connections');
    if(fin){(s.office?paneFinanceOffice:paneFinance)(s,fin);fin.querySelector('h2')?.remove();fin.querySelector('.intro')?.remove();fin.querySelector('.pts')?.remove();fin.querySelector('#f-map')?.remove();}
    if(con){paneConnections(s,con);const lr=con.querySelector('#live-records');if(lr)lr.id='u-connections-records';}
  };
  mountShown();
  if(s.office)return;
  window.RecordLive.disclosure(s.id,s.chamber).then(d=>{
    if(!pane.isConnected||!location.hash.startsWith('#'+s.id))return;
    const x=unbought(s,{...inputs,sizes:d?.sizes||null,snapshot:d?.netWorth||null,trades:d?.trades||null});
    if(!d)x.why='The update service is offline, so their financial disclosure can\'t be read right now';
    const card=pane.querySelector('.st-grid');if(card){const tmp=document.createElement('div');tmp.innerHTML=draw(x,d);card.replaceWith(tmp.querySelector('.st-grid'));}
    const ev=pane.querySelector('#u-holdings');if(ev){const tmp=document.createElement('div');tmp.innerHTML=holdingsEvidence(s,d,x);ev.replaceWith(tmp.firstElementChild);}
    const calc=pane.querySelectorAll('.st-more .st-more-b')[1];if(calc)calc.innerHTML=unboughtCalc(s,x);
    const tile=document.querySelector(`[data-six-tile="unbought"][href="#${s.id}-unbought"]`);if(tile)fillSixTile(tile,x);
  });
}

// ----- Above Board (async: trades from the official reports) -----
function aboveBoardInputs(s,d){
  const reviewed=SCORER.reviewedTrades(s);
  if(reviewed.covered)return {...reviewed,known:{nearVotes:true,donors:true}};
  const t=d?.trades;if(!t)return reviewed;
  const donors=[...(s.pac?.rows||[]).map(r=>({org:(DATA.pacNames||[])[r[0]]})),...(s.funderPos||[]).map(g=>({org:g.org}))].filter(x=>x.org);
  const rows=t.rows.map(r=>({...r,company:r.asset,asset:r.assetType||'stock'}));
  return {rows,covered:t.covered,why:t.why,overseen:overseenSectors(s),inDonors:new Set(tradesInDonors(rows,donors).map(x=>x.trade)).size,known:{nearVotes:false,donors:true}};
}
function aboveBoardBreakdown(x){
  return stTable(['Part','Index','Points'],x.parts.map(p=>[`${esc(p.label)}${p.note?`<div class="small muted">${esc(p.note)}</div>`:''}`,p.index==null?'<span class="muted">waiting</span>':`${Math.round(p.index*10)/10}${p.key==='legal'?'':' / 100'}`,p.points==null?'—':`<b class="st-neg">${pts1(p.points)}</b>`]).concat(x.pct==null?[]:[['<b>Above Board score</b>','',`<b>${x.pct} / 100</b>`]]),'st-ab');
}
function aboveBoardCalc(x){
  return `${stF('Above Board = 100 − (0.35 × Outside Income & Conflicts + 0.20 × Gifts & Travel + 0.25 × Trade Conflicts + 0.20 × Stock Disclosure Dodger) − Legal Trouble')}
    ${stF('Outside Income & Conflicts = 0.40 × outside pay, board seats and job deals from interested organizations + 0.25 × Lobbyist Overlap + 0.20 × Contracts for Donors + 0.15 × Foreign Agent')}
    ${stF('Gifts & Travel = 60 × Hill(value of gifts and paid trips from interested organizations, $10,000) + 10 per gift or trip (up to 40)')}
    ${stF('Trade Conflicts = 0.45 × share in their committees\' sectors + 0.30 × share within 30 days of a related vote + 0.25 × share in donor companies')}
    ${stF('Stock Disclosure Dodger = 0.70 × share of trade reports late (after 45 days) or missing + 0.30 × share of annual reports late')}
    ${stF('Legal Trouble = each case: status (finding 20 · open 15 · closed 5) × kind (criminal 1.5 · ethics or civil 1 · technical 0.5), halved for a closed case over 10 years old')}
    <p class="small">A missing index drops out and the others are rescaled.${x?.pct!=null?` Here: ${x.parts.filter(p=>p.points!=null).map(p=>`${p.label} ${pts1(p.points)}`).join(', ')} → ${x.pct}.`:''}</p>`;
}
function paneAboveBoard(s,pane){
  const draw=(x)=>stFrame(s,'aboveboard',{
    res:x,breakdown:aboveBoardBreakdown(x),
    sources:['<b>Financial disclosures:</b> outside pay, board seats, job deals, gifts, paid trips, trades and their filing dates.','<b>Connections:</b> lobbying reports, federal contracts, foreign-agent filings, their committees and their votes.','<b>Legal records:</b> court, ethics and enforcement cases.'],
    needs:x.needs,
    notes:[['Interested organization:','one that lobbies their committees, works in a sector their committees oversee, or holds contracts from an agency they oversee.'],['It shows overlap, not proof.','A confirmed case counts through Legal Trouble.'],['Unknown is not none.','Missing disclosures stay unknown, never a clean record.']],
    evidenceTitle:'Evidence: conflicts, disclosures and legal matters',
    evidence:'<div id="ab-conflicts"></div><div id="ab-ethics"></div>',
    calc:aboveBoardCalc(x),
    assumptions:['Only an organization with business before them counts: it lobbies their committees, works in a sector their committees oversee, or holds contracts from an agency they oversee.','Trades read automatically from the official reports count; a stock whose company isn\'t matched to an industry is left out of the committee part, and the near-vote part waits for review.','Trade Conflicts needs at least 5 trades; verified reports with no trades score 0. The single-stock activity part is left out because Unbought counts how much they trade.','A trade report is late after 45 days. Missing filing dates are not assumed on time.','Legal Trouble counts each case once at its current status; allegations are listed but cost nothing.','Legal records alone aren\'t enough for a grade: at least one of the four indexes is needed.'],
    method:'aboveboard'});
  const start=aboveBoard(s,{trades:aboveBoardInputs(s,null),conflicts:SIX_CTX.conflicts,asOfYear:SCORER.asOfYear});
  pane.innerHTML=draw(start);
  const fill=x=>{
    const coi=pane.querySelector('#ab-conflicts');if(coi)coi.innerHTML=`<section class="st-sec"><h4 class="st-sub">Outside income, gifts and travel</h4>${conflictsDetails(s,x.conflicts)}</section>`;
  };
  fill(start);
  const eth=pane.querySelector('#ab-ethics');paneEthics(s,eth,{embedded:true});eth.querySelector('#eth-indexes')?.remove();
  if(s.office||!s.bioguide)return;
  window.RecordLive.disclosure(s.id,s.chamber).then(d=>{
    if(!d||!pane.isConnected||!location.hash.startsWith('#'+s.id))return;
    const x=aboveBoard(s,{trades:aboveBoardInputs(s,d),conflicts:SIX_CTX.conflicts,asOfYear:SCORER.asOfYear});
    const grid=pane.querySelector('.st-grid');if(grid){const tmp=document.createElement('div');tmp.innerHTML=draw(x);grid.replaceWith(tmp.querySelector('.st-grid'));}
    const calc=pane.querySelectorAll('.st-more .st-more-b')[0];if(calc)calc.innerHTML=aboveBoardCalc(x);
  });
}

// ----- People First -----
function panePeopleFirst(s,pane){
  const x=sixOf(s).peoplefirst,v=x.v,c=x.cci;
  const row=p=>[`${esc(p.label)}<div class="small muted">${esc(p.note||'')}</div>`,p.value==null?'—':String(p.value),p.weight?`× ${p.weight}`:'—'];
  const old=personPvp(s);
  pane.innerHTML=stFrame(s,'peoplefirst',{
    res:x,
    breakdown:stTable(['Part','Score','Weight'],[row(x.parts[0]),row(x.parts[1])])+(x.pct!=null?`<p class="small">${x.blended?`0.75 × ${x.bills} + 0.25 × (100 − ${c.index}) = ${Math.round(x.raw*10)/10}`:`Legislative Action alone: ${x.bills}`}${Math.round(x.raw*10)/10!==x.pct?`, rounded to ${x.pct}`:''}.</p>`:''),
    sources:['<b>Votes and bills,</b> each scored by who gains and which worker and business groups took sides.','<b>Business funders\' positions</b> and the bills they lobbied on.','<b>Party comparison:</b> how they voted against their own party on the votes where business funders took a side.'],
    needs:x.needs,
    notes:[['A disputed bill','is shown but left unscored.'],['CCI','is the Corporation Compromised Index. It keeps only how they act, since Unbought counts where the money comes from.']],
    evidenceTitle:'Evidence: votes, bills, groups and funding ties',
    evidence:`<div id="pf-bills">${pvpTable(s,old)}</div><section class="st-sec"><h4 class="st-sub">Corporation Compromised Index</h4><p class="small">${c.index==null?esc(c.why)+', so it isn\'t counted.':`${c.index}: ${c.parts.businessVotes!=null?`voting with business funders ${c.parts.businessVotes} (65%)`:''}${c.parts.lobbiedBills!=null?`, donor-lobbied bills on the profit side ${Math.round(c.parts.lobbiedBills)} (35%)`:''}.`}</p></section>`,
    shown:'<div id="pf-funders"></div>',
    calc:`${stF('People First = 0.75 × Legislative Action + 0.25 × (100 − CCI)')}${stF('Legislative Action = 100 × worker-side points ÷ (worker-side + profit-side points)')}${stF('CCI = 0.65 × how far above their party they vote with business funders (25 points above = 100) + 0.35 × share of donor-lobbied bills where they took the profit side')}<p class="small">Without the CCI, People First is Legislative Action alone. At least ${MIN_PVP_ACTIONS} scored actions.</p>`,
    assumptions:['Each scored bill counts once, at its strength (|bill score| ÷ 100), across its versions.','Worker-side and profit-side support decide which side an action favors: a nonpartisan study of who gains, and which worker and business groups took sides.','The CCI compares their votes with business funders against their own party\'s, leaving their own vote out of the party\'s count; it needs 5 compared votes.','Donor-lobbied bills need at least 3 bills.','Outside spending is left out: candidates can\'t control it.'],
    method:'peoplefirst'});
  const f=pane.querySelector('#pf-funders');if(f&&!s.office){f.innerHTML=`${fundersBlock(s)}${moneyVotesBlock(s)}`;mountFundTL(f);}
  hoverTips(pane);bindTips(pane);
}
// On a profile's Overview, Unbought and Above Board use the official records read by the refresh.
function fillProfileTiles(s){
  if(s.office){const t=document.querySelector(`[data-six-tile="unbought"][href="#${s.id}-unbought"]`);if(t)fillSixTile(t,unbought(s));return;}
  window.RecordLive.disclosure(s.id,s.chamber).then(d=>{
    if(!location.hash.startsWith('#'+s.id))return;
    const u=document.querySelector(`[data-six-tile="unbought"][href="#${s.id}-unbought"]`);
    if(u){const x=unbought(s,{...unboughtInputs(s),sizes:d?.sizes||null,snapshot:d?.netWorth||null,trades:d?.trades||null});if(!d)x.why='The update service is offline';fillSixTile(u,x);}
    const a=document.querySelector(`[data-six-tile="aboveboard"][href="#${s.id}-aboveboard"]`);
    if(a&&d)fillSixTile(a,aboveBoard(s,{trades:aboveBoardInputs(s,d),conflicts:SIX_CTX.conflicts,asOfYear:SCORER.asOfYear}));
  });
}
// The score tiles on the Overview and on the cards: Ideology's lean, then the five grades.
function fillSixTile(tile,x){
  const g=x?.pct==null?null:letter(Math.min(100,x.pct));
  tile.querySelector('.hc-gv').innerHTML=g?`<b class="gr-${g}">${g}</b><span>${x.pct}</span>`:'<span class="hc-ng">Not graded yet</span>';
  tile.querySelector('.hc-gd').textContent=g?'':(x?.why||'');
}
function sixTiles(s,links){
  const x=sixOf(s),h=k=>links?`#${s.id}-${k}`:'',i=x.ideology;
  const tip=k=>SIX_BY[k].q;
  const ideo=`<${links?'a':'div'} class="hc-gt hc-ideo-t"${links?` href="${h('ideology')}"`:''} title="${esc(tip('ideology'))}"><div class="hc-gl">Ideology</div><div class="hc-gv">${i.lean==null?'<span class="hc-ng">Not placed yet</span>':`<b class="lean">${signed(i.lean)}</b><span>${esc(i.label)}</span>`}</div><div class="hc-gd">${i.lean==null?esc(i.why):`${i.scored} issues${i.dw!=null?` · DW-NOMINATE ${signed(i.dw)}`:''}`}</div></${links?'a':'div'}>`;
  const tile=(k,res,detail,empty='Not graded yet')=>{const t=links?'a':'div',g=res?.pct==null?null:letter(Math.min(100,res.pct));
    return `<${t} class="hc-gt" data-six-tile="${k}"${links?` href="${h(k)}"`:''} title="${esc(tip(k))}"><div class="hc-gl">${esc(SIX_BY[k].name)}</div><div class="hc-gv">${g?`<b class="gr-${g}">${g}</b><span>${res.pct}</span>`:`<span class="hc-ng">${esc(empty)}</span>`}</div><div class="hc-gd">${g?esc(detail||''):esc(res?.why||detail||'')}</div></${t}>`;};
  const w=x.word.score,u=x.showsup,pf=x.peoplefirst;
  return `<div class="hc-rc hc-six">${ideo}
    ${tile('word',x.word,`${w.clear} counted checks`)}
    ${tile('showsup',u,u.parts[0].note||'')}
    ${s.office?tile('unbought',unbought(s),''):tile('unbought',links?{pct:null,why:'Reading their disclosure…'}:{pct:null,why:'Open the profile to read their disclosure'},'', links?'Loading':'On profile')}
    ${tile('aboveboard',x.aboveboard,'')}
    ${tile('peoplefirst',pf,pf.v?.n?`${pf.v.nPeople} of ${pf.v.n} actions for working people`:'')}</div>`;
}

function renderProfile(s,requested='overview',focus){
  const {primary,view}=profileLocation(requested),overview=view==='overview',scoreTab=!!SIX_BY[view];
  app.innerHTML=`${scoreTab?'':profileHeader(s,overview)}${overview?profileReport(s):''}<nav class="tabs${scoreTab?' tabs-top':''}" aria-label="Profile"><div class="wrap" style="padding-inline:0" id="tabs">${TABS.map(([key,label])=>`<button type="button" data-tab="${key}" class="${key===primary?'active':''}" aria-current="${key===primary?'page':'false'}">${label}</button>`).join('')}</div></nav><section class="section" id="pane"${s.basic?' data-basic="1"':''}></section>`;
  $('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)location.hash=`${s.id}-${b.dataset.tab}`;});
  const pane=$('#pane');
  pane.innerHTML='<div id="profile-content"></div>';
  const content=pane.querySelector('#profile-content');
  if(overview)paneOverview(s,content);
  else if(s.basic)paneBasicContent(s,view,content);
  else (PANES[view]||paneOverview)(s,content,focus);
  simplifyDetailSections(content,view);
  if(overview&&s.basic)fillBasicHeader(s);
  if(overview&&!s.basic)fillProfileTiles(s);
  if(!overview)content.insertAdjacentHTML('beforeend',evidenceStrip(s));
  bindProfileActions(s,pane);
  if(focus){const target=document.getElementById(focus);if(target){for(let p=target.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;setTimeout(()=>target.scrollIntoView({block:'start'}),50);}}
  $('#tabs .active')?.scrollIntoView({block:'nearest',inline:'center'});
}
// One visible summary per section; detailed evidence remains expandable and deep-linkable.
function simplifyDetailSections(root,view){
  const fold=(node,label)=>{
    if(!node||node.closest('details.data-disclosure'))return;
    const details=document.createElement('details');details.className='data-disclosure';
    const summary=document.createElement('summary');summary.textContent=label;
    node.before(details);details.append(summary,node);
    details.addEventListener('toggle',()=>{if(details.open)resizers.forEach(fn=>fn());});
  };
  if(view==='promises'){
    const legend=root.querySelector('.legendlist');
    if(legend){const next=legend.nextElementSibling;fold(legend,'Verdict labels & counting rules');if(next&&next.querySelector('.pts'))legend.parentElement.append(next);}
  }
  if(view==='ethics'){
    fold(root.querySelector('#eth-indexes'),'Ethics index breakdowns & calculations');
    fold(root.querySelector('#eth-timeline'),'Case timeline');
    fold(root.querySelector('#eth-trades'),'Reviewed stock trades & disclosure analysis');
    fold(root.querySelector('#live-records'),'Personal finances & latest official records');
  }
  if(view==='legislation')fold(root.querySelector('#legislation-record'),'Full voting record, committees & official actions');
  if(view==='finance')fold(root.querySelector('#live-records'),'Latest official filings & source coverage');
}
async function fillBasicHeader(s){
  let c;try{c=await window.RecordLive.section(s.id,'campaign');}catch{return;}
  if(!c||document.body.dataset.view!=='overview'||!location.hash.startsWith('#'+s.id))return;
  const facts=document.querySelector('.profile-facts'),label=document.querySelector('.profile-period');if(!facts||!label)return;
  facts.innerHTML=[['Raised',c.receipts],['Cash on hand',c.cash],['Spent',c.disbursements]].map(([title,n])=>`<div class="profile-fact"><span>${title}</span><b>${profileAmount(n)}</b></div>`).join('');
  label.textContent=`Official campaign snapshot: ${period(c.start,c.end)} · Not reviewed for a grade`;
}
// ---------- The Senate: every sitting senator, with a full profile (reviewed research) or a basic one ----------
const monthYear=d=>{const m=/^(\d{4})-(\d{2})/.exec(d||'');return m?new Date(+m[1],+m[2]-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'—';};
const fecCycleUrl=(id,cycle)=>`https://www.fec.gov/data/candidate/${id}/?cycle=${cycle}&election_full=true`;
let senQ='',senParty='',senYear='',senSort='state';
function renderSenate(){
  const full=SENATE.filter(x=>byId[x.id]).length,info=window.SENATE_INFO||{};
  const years=[...new Set(SENATE.map(x=>x.nextElection))].sort();
  app.innerHTML=`<section class="section">
    <div class="kicker">${info.congress?info.congress+'th Congress':'U.S. Senate'}</div><h1>The Senate</h1>
    <p class="intro">All ${SENATE.length} sitting senators.</p>
    ${points([['Full profiles',`${full} senators on the 2026 ballot in the races this site covers: grades, campaign money, outside spending and statement checks.`],
      ['Basic profiles',`The other ${SENATE.length-full}: their place in the Senate, their committees, and the records the daily refresh collects (votes, bills, statements, stock trades and campaign money). No grades until their research is reviewed.`],
      ['Ideology','Voteview DW-NOMINATE, from every roll call they have cast, the same as on the full profiles.'],
      info.source&&['Source',`<a href="${esc(info.source)}" target="_blank" rel="noopener">congress-legislators</a>, checked ${fmtDate(info.checked)}.`]])}
    <div class="toolbar">
      <div class="seg" id="sen-party" role="group" aria-label="Party">${[['','All'],['D','Democrats'],['R','Republicans'],['I','Independents']].map(([k,l])=>`<button data-p="${k}" class="${senParty===k?'active':''}">${l}</button>`).join('')}</div>
      <div class="search"><input id="sen-q" type="search" placeholder="Search by name or state" aria-label="Search senators" value="${esc(senQ)}"></div>
      <label class="small muted">Next election <select id="sen-year" aria-label="Next election"><option value="">Any</option>${years.map(y=>`<option value="${y}" ${String(y)===senYear?'selected':''}>${y}</option>`).join('')}</select></label>
      <label class="small muted">Sort <select id="sen-sort" aria-label="Sort senators">${[['state','State'],['name','Name'],['lib','Most liberal first'],['con','Most conservative first']].map(([k,l])=>`<option value="${k}" ${senSort===k?'selected':''}>${l}</option>`).join('')}</select></label>
    </div>
    <p class="small" id="sen-n" style="margin:10px 0 8px"></p>
    <div class="tablewrap"><table><thead><tr><th>Senator</th><th>State</th><th>Party</th><th>Next election</th><th>Ideology</th><th>Profile</th></tr></thead><tbody id="sen-rows"></tbody></table></div>
  </section>`;
  const score=x=>x.ideo?x.ideo.dim1:null;
  const draw=()=>{
    const q=senQ.toLowerCase();
    const L=SENATE.filter(x=>(!senParty||x.party===senParty)&&(!senYear||String(x.nextElection)===senYear)&&(!q||`${x.name} ${x.stateName} ${x.state}`.toLowerCase().includes(q)));
    const by={state:(a,b)=>a.stateName.localeCompare(b.stateName)||a.short.localeCompare(b.short),name:(a,b)=>a.short.localeCompare(b.short)||a.name.localeCompare(b.name),
      lib:(a,b)=>(score(a)??9)-(score(b)??9),con:(a,b)=>(score(b)??-9)-(score(a)??-9)}[senSort];
    L.sort(by);
    $('#sen-n').innerHTML=`<b class="num">${L.length}</b> of ${SENATE.length} senators`;
    $('#sen-rows').innerHTML=L.map(x=>`<tr><td><a href="#${esc(x.id)}">${esc(x.name)}</a></td><td>${esc(x.stateName)}</td><td><span class="chip ${esc(x.party)}">${partyName(x.party)}</span></td>
      <td>${x.nextElection}${(o=>o?' '+resultChip(o):x.nextElection===2026?' <span class="chip ghost">Not running</span>':'')(senatorOutcome(x))}</td>
      <td>${x.ideo?`<span class="mono">${x.ideo.dim1>0?'+':''}${x.ideo.dim1.toFixed(2)}</span><div class="small muted">${esc(ideoText(x).short)}</div>`:'<span class="small muted">No score yet</span>'}</td>
      <td>${byId[x.id]?'<span class="chip good">Full</span>':'<span class="chip ghost">Basic</span>'}</td></tr>`).join('')||'<tr><td colspan="6">No senators match.</td></tr>';
  };
  $('#sen-party').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;senParty=b.dataset.p;$('#sen-party .active').classList.remove('active');b.classList.add('active');draw();});
  $('#sen-q').addEventListener('input',e=>{senQ=e.target.value;draw();});
  $('#sen-year').addEventListener('change',e=>{senYear=e.target.value;draw();});
  $('#sen-sort').addEventListener('change',e=>{senSort=e.target.value;draw();});
  draw();
}
// Basic profiles: senators without reviewed research. They use the same header, tabs and cards as the full profiles;
// every grade stays "Not graded" until the research is reviewed, and each tab shows the records the daily refresh
// collects. Election boxes say whether the seat is on the 2026 ballot.
// A senator's 2026 race: the results-only race they ran in, or, for a seat up in 2026, the state's Senate race.
function seatRace(s){
  const ran=DATA.liteRaces.find(r=>r.chamber==='S'&&r.nominees.some(n=>nomineeKey(n)===s.id));if(ran)return ran;
  if(s.nextElection!==2026)return null;
  return DATA.races.find(r=>r.chamber==='S'&&r.state===s.state)||DATA.liteRaces.find(r=>r.chamber==='S'&&r.state===s.state)||null;
}
const offBallot=s=>s.nextElection!==2026&&!seatRace(s);
// A senator's own November 3 outcome (won, lost, not called yet), or null when they weren't on the ballot.
function senatorOutcome(x){
  const r=byId[x.id]?raceOf(byId[x.id]):seatRace(x);if(!r)return null;
  return (r.keys||r.nominees.map(nomineeKey)).includes(x.id)?outcomeOf(r,x.id):null;
}
// The election box: their own result if they ran, else who won the seat they're leaving.
function ballotLine(s){
  if(offBallot(s))return 'Not running for election in 2026';
  const r=seatRace(s);if(!r)return 'Seat up in 2026 · race not covered here';
  const res=raceResult(r),w=res&&res.winner,ran=(r.keys||r.nominees.map(nomineeKey)).includes(s.id);
  const name=w&&(byId[w]?.name||r.nominees?.find(n=>nomineeKey(n)===w)?.name);
  if(ran){const o=outcomeOf(r,s.id);
    return o==='won'?(res.special?'Won the November 3, 2026 special election':'Re-elected November 3, 2026'):o==='lost'?`Lost to ${name} on November 3, 2026`:'On the November 3, 2026 ballot · not called yet';}
  return res?.decided?`Not running in 2026 · ${name} won the seat`:'Not running in 2026 · the race for the seat is not called yet';
}
const BASIC_GRADE={match:'No reviewed record of their votes and statements on the site\'s issues yet.',prom:'No statements checked against the record yet.',
  eth:'No cases reviewed yet. Leads from official records are on the Integrity tab.',pvp:'No scored votes or sponsorships reviewed yet.'};
function basicReport(s,links){
  const h=k=>links?`#${s.id}-${k}`:'',d='Research not reviewed yet';
  return `<div class="hc-rc hc-six">${SIX.map(m=>`<${links?'a':'div'} class="hc-gt"${links?` href="${h(m.key)}"`:''} title="${esc(m.q)}"><div class="hc-gl">${esc(m.name)}</div><div class="hc-gv"><span class="hc-ng">${m.grade?'Not graded yet':'Not placed yet'}</span></div><div class="hc-gd">${d}</div></${links?'a':'div'}>`).join('')}</div>`;
}
// Campaign and outside-money totals for everyone, loaded once (/api/cards) and reused by the cards and profiles.
let cardsData=null,cardsTime=0;
function loadCards(){if(!cardsData||Date.now()-cardsTime>60000){cardsTime=Date.now();cardsData=fetch('/api/cards',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>d?.people||null).catch(()=>null);}return cardsData;}
// c: this person's totals, undefined while loading, or null when the refresh is unreachable.
function basicMoney(s,c,{mini:withMini=true}={}){
  const wait=c===undefined?'Loading…':c===null?'Refresh unavailable':'Waiting for the FEC refresh',k=c?.campaign,o=c?.outside;
  const camp=k&&k.receipts!=null?`<b>${fmt$(k.receipts)}</b><span>Campaign funds raised</span><small>${shortPer(k.end)}</small>`:`<b class="hc-na">${wait}</b><span>Campaign funds raised</span><small>${s.fecCand?'from the daily FEC refresh':'no FEC candidate ID listed'}</small>`;
  const out=offBallot(s)?`<b class="hc-na">Not running for election in 2026</b><span>Outside money</span><small>no 2026 race</small>`
    :o?`<b class="hc-two"><i class="sw" style="background:var(--s3)"></i>${fmt$(o.support)} <em>for</em><br><i class="sw" style="background:var(--s2)"></i>${fmt$(o.oppose)} <em>against</em></b><span>Outside money</span><small>${shortPer(o.through)}</small>`
    :`<b class="hc-na">${wait}</b><span>Outside money</span><small>from the daily FEC refresh</small>`;
  const mini=!withMini?'':`<div class="hc-mini"><div class="hc-mh"><span>Outside money by month</span><span></span></div><p class="small muted" style="margin:4px 0 0">${offBallot(s)?`Not running for election in 2026. ${esc(s.short)}'s seat is next on the ballot in ${s.nextElection}.`:'Seat up in 2026, in a race this site doesn\'t cover in depth. Outside spending shows on the profile once refreshed.'}</p></div>`;
  return `<div class="hc-money"><div class="hc-mt">${camp}</div><div class="hc-mt">${out}</div></div>${mini}`;
}
function basicCard(s){
  return `<article class="card sen-card hc" tabindex="0" data-id="${s.id}" data-party="${esc(s.party)}" role="link" aria-label="Open profile of ${esc(s.name)}">
    <div class="hc-top">${portrait(s)}<div class="hc-who">
      <div class="row" style="gap:5px"><span class="chip ${s.party}">${s.party} · ${esc(s.state)}</span><span class="chip ch">Senate</span></div>
      <div class="name">${esc(s.name)}</div><div class="hc-sub">${esc(`In the Senate since ${String(s.since).slice(0,4)} · Next election ${s.nextElection}`)}</div></div></div>
    <div class="hc-ideo">${esc(s.ideo?ideoText(s).short:'No voting score yet')}</div>
    ${hcHead('✓','rc','Report Card','Four A–F grades from the documented record and your own answers')}
    ${basicReport(s)}
    ${hcHead('$','mi','Money &amp; Influence Analysis','Campaign money from the daily FEC refresh, and outside spending for and against them')}
    <div class="hc-live" data-basic="${s.id}">${basicMoney(s,undefined)}</div>
    <div class="hc-ft"><span>${esc(ballotLine(s))}</span><span class="hc-vs">Basic profile →</span></div>
  </article>`;
}
async function fillBasic(root=document){
  const els=[...root.querySelectorAll('.hc-live[data-basic]')];if(!els.length)return;
  const all=await loadCards();
  for(const el of els)if(el.isConnected){const s=BASIC[el.dataset.basic];el.innerHTML=basicMoney(s,all?(all[s.id]||{}):null,{mini:el.dataset.mini!=='0'});}
}
// The records each tab adds from the daily refresh (public/live.js), the same groups the full profiles' tabs show.
const BASIC_LIVE={promises:['crec-day','hearings','statements','factcheck','news'],
  ethics:['netWorth','trades','legal'],pvp:['donorOrgs'],finance:['campaign','campaign-history','donor-sizes','pac','outside','donorOrgs','outside-groups']};
const BASIC_INTRO='These update on their own from official sources. Nothing here has been reviewed yet, so none of it counts toward a grade.';
function renderBasic(s,tab,focus){renderProfile(s,tab,focus);}
function paneBasicContent(s,view,pane){
  // The score tabs map onto the official-record views a basic profile has.
  view=({ideology:'legislation',word:'promises',showsup:'integrity',unbought:'finance',aboveboard:'ethics',peoplefirst:'pvp'})[view]||view;
  const person={id:s.id,name:s.name,chamber:'S',bioguide:s.bioguide};
  const head=(title,key)=>gradeHead(title,null,BASIC_GRADE[key],gradeRule(key));
  if(view==='integrity'){
    pane.innerHTML=`<h2>Integrity <span class="integrity-pill">Provisional</span></h2><div class="note"><b>Not graded.</b> This profile has no reviewed Honesty, Personal Finances, Fundraising, Showing Up or Conflicts of Interest components, and no sourced Legal Trouble coverage review. Missing current imports are not treated as zero activity or a clean score.</div><p class="small">Official records remain available below for review. IntegrityIndex.us inspired the provisional method; this profile does not yet meet its evidence requirements.</p><section id="integrity-live-records"></section><p class="small"><a href="#method-integrity">Formula, source credit and coverage rules</a> · <a href="#${s.id}-legislation">Legislation and votes</a></p>`;
    window.RecordLive.profile(person,pane.querySelector('#integrity-live-records'),['netWorth','trades','legal','statements','votes']);
  }else if(view==='legislation'){
    pane.innerHTML=`<h2>Legislative Activity</h2><p class="intro">Bills, votes and committee records. Research has not been reviewed for this basic profile.</p><div id="legislation-lists"></div>${committeeBlock(s)}<section id="live-records"></section>`;
    mountLegislation(pane.querySelector('#legislation-lists'),{person:s,data:DATA,recordLive:window.RecordLive});
    window.RecordLive.profile(person,pane.querySelector('#live-records'),['crs','stateBills','committees','votes'],{intro:BASIC_INTRO});
  }else if(view==='match'){
    pane.innerHTML=`${head('Your match','match')}<p class="intro">No reviewed issue evidence yet. <a href="#${s.id}-legislation">Open bills and votes</a>.</p>${s.ideo?ideoBlock(s,'ideo-b'):'<p class="note">No comparable career ideology score is available.</p>'}`;
    if(s.ideo)mountIdeo('ideo-b',s);
  }else if(['promises','ethics','pvp'].includes(view)){
    const [title,key]=({promises:['Keeps Their Word','prom'],ethics:['Above Board','eth'],pvp:['People First','pvp']})[view];
    pane.innerHTML=`${head(title,key)}<section id="live-records"></section>`;
    window.RecordLive.profile(person,pane.querySelector('#live-records'),BASIC_LIVE[view],{intro:BASIC_INTRO});
  }else if(view==='sources')pane.innerHTML=`<h2>Sources & coverage</h2><p>No reviewed research yet. Official records are under Legislative Activity and Accountability.</p><a href="#method-sources">Source guide</a>`;
  else{
    const parts=view==='connections'?['donorOrgs','outside-groups']:view==='history'?['campaign-history','donor-sizes']:['campaign','pac','outside'];
    pane.innerHTML=`<h2>${view==='connections'?'Funder connections':view==='history'?'History & source records':'Campaign funding'}</h2><p class="intro">${view==='finance'?esc(ballotLine(s))+'. ':''}Available official snapshots, separate from reviewed research.</p><section id="live-records"></section>`;
    window.RecordLive.profile(person,pane.querySelector('#live-records'),parts,{intro:BASIC_INTRO});
  }
  bindTips(pane);
}
function tiles(items){return `<div class="tiles">${items.map(t=>`<div class="tile"><div class="l">${t[0]}</div><div class="v">${t[1]}</div><div class="d">${t[2]||''}</div></div>`).join('')}</div>`}
const statedVotes=s=>CH[icH(s)].votes.filter(v=>s.id in v.pos&&!/not in office/i.test(v.pos[s.id])).length;

// ---------- overview: five quick visuals and a short ethics list ----------
const ovPct=(v,t)=>{const p=v/t*100;return p<0.5?'<1%':Math.round(p)+'%'};
function ovCard(kicker,title,sub,body,foot,cls){
  return `<section class="chart ov-card ${cls||''}"><div class="kicker">${kicker}</div><h3>${title}</h3><p class="sub">${sub}</p>${body}${foot?`<p class="ov-foot small muted">${foot}</p>`:''}</section>`;
}
// 1. where the campaign's money comes from: one bar, parts of FEC total receipts (none counted twice)
function ovMoney(s,here,wide=true){
  const c=s.camp, T='Where the campaign’s money comes from';
  if(c.missing)return ovCard('Campaign money',T,'Share of campaign funds raised, by source',`<div class="note"><b>No FEC financial report yet.</b> ${esc(c.note)}</div>`,`<a href="${fecCandUrl(s.fecCand)}" target="_blank" rel="noopener">FEC candidate page ↗</a>`,wide?'ov-wide':'');
  const split=c.itemized!=null&&c.unitemized!=null;
  const defs=[
    ...(split?[['Small donors','gifts of $200 or less','--s1',c.unitemized],['Larger individual donors','gifts over $200','--s2',c.itemized]]:[['Individual donors','size split not available','--s1',c.indiv]]),
    ['PACs','political action committees','--s3',c.pac],
    ['Party committees','','--s4',c.party],
    ['Candidate’s own money and loans','','--s5',c.self],
    ['Joint fundraising and other','transfers and other receipts','--muted',(c.transfers||0)+Math.max(0,c.other||0)],
  ];
  const segs=defs.map(([l,d,col,v])=>({l,d,col,v:Math.max(0,v||0)})).filter(x=>x.v>0);
  const tot=segs.reduce((a,x)=>a+x.v,0)||1;
  const top=segs.slice().sort((a,b)=>b.v-a.v)[0];
  const rows=[...(split?[['Individuals, $200 or less',c.unitemized],['Individuals, over $200',c.itemized]]:[['Individuals',c.indiv]]),['PACs and other committees',c.pac],['Joint fundraising transfers',c.transfers],['Party committees',c.party],['Candidate’s own loans and contributions',c.self],['Other receipts',c.other==null?null:Math.max(0,c.other)]].filter(r=>r[1]!=null);
  const body=`<div class="big" style="font-size:1.15rem">Largest source: ${esc(top.l.toLowerCase())}, ${ovPct(top.v,tot)}</div>
    <div class="ov-stack" role="group" aria-label="Campaign funds raised, by source">${segs.map(x=>`<i style="flex:${x.v};background:var(${x.col})" data-tip="${esc(x.l)}: ${fmtFull(x.v)} (${ovPct(x.v,tot)})"></i>`).join('')}</div>
    <ul class="ov-legend">${segs.map(x=>`<li><i style="background:var(${x.col})"></i><span>${esc(x.l)}${x.d?`<small class="muted">${esc(x.d)}</small>`:''}</span><b>${ovPct(x.v,tot)}</b><span class="v">${fmt$(x.v)}</span></li>`).join('')}</ul>
    <details class="tv"><summary>Show as a table</summary><div class="tablewrap"><table><thead><tr><th>Source</th><th class="r">Amount</th><th class="r">Share</th></tr></thead><tbody>${rows.map(([l,v])=>`<tr><td>${esc(l)}</td><td class="r">${fmtFull(v)}</td><td class="r">${v>0?ovPct(v,c.receipts):'0%'}</td></tr>`).join('')}</tbody></table></div></details>`;
  return ovCard('Campaign money',T,`Share of the ${fmtFull(c.receipts)} the campaign raised, ${period(c.start,c.end)}`,body+`<div class="ov-sizes" data-sizes="${esc(s.id)}" hidden></div>`,`FEC two-year committee summary · <a href="${esc(c.src)}" target="_blank" rel="noopener">source ↗</a>${here?'':` · <a href="#${s.id}-finance">Money &amp; Influence details →</a>`}`,wide?'ov-wide':'');
}
// The money card's second bar: individual donors' money by gift size, from the daily FEC refresh (public/donor-sizes.js).
// Left out when the update service is offline; says so while the first refresh is still to come.
async function fillSizes(root){
  for(const el of root.querySelectorAll('.ov-sizes[data-sizes]')){
    const s=byId[el.dataset.sizes];if(!s)continue;
    let x;try{x=await window.RecordLive.section(s.id,'donor-sizes');}catch{continue;}
    if(!el.isConnected)continue;el.hidden=false;
    const head=`<h4 class="ov-subhead">Individual donors, by gift size</h4>`;
    const parts=x?sizeParts(x):[];
    if(!parts.length){el.innerHTML=`${head}<p class="small muted" style="margin:4px 0 0">${x?'No gifts from individuals reported for this cycle yet.':'Appears after the FEC gift-size refresh runs.'}</p>`;continue;}
    const share=k=>sizeShare(x.brackets[k].total,x.total);
    el.innerHTML=`${head}<p class="small muted" style="margin:2px 0 0">Share of the ${fmtFull(x.total)} individuals gave${x.start?`, ${period(x.start,x.end)}`:''}. Each gift counts by its own amount, so "$200 and under" also holds smaller gifts from donors who gave more in all, and can be larger than "Small donors" above. <a href="${esc(x.source)}" target="_blank" rel="noopener">FEC ↗</a></p>
      <div class="big" style="font-size:1rem;margin-top:6px">Of individuals' money: $200 and under ${share(0)} · $2,000 and over ${share(4)}</div>
      <div class="ov-stack" role="group" aria-label="Individual donors' money by gift size">${parts.map(p=>`<i style="flex:${p.total};background:var(--${p.key})" data-tip="${esc(p.label)}: ${fmtFull(p.total)} (${sizeShare(p.total,x.total)})"></i>`).join('')}</div>
      <ul class="ov-legend">${parts.map(p=>`<li><i style="background:var(--${p.key})"></i><span>${esc(p.label)}</span><b>${sizeShare(p.total,x.total)}</b><span class="v">${fmt$(p.total)}</span></li>`).join('')}</ul>
      <details class="tv"><summary>Show gift sizes as a table</summary><div class="tablewrap"><table><thead><tr><th>Gift size</th><th class="r">Amount</th><th class="r">Share</th></tr></thead><tbody>${parts.map(p=>`<tr><td>${esc(p.label)}</td><td class="r">${fmtFull(p.total)}</td><td class="r">${sizeShare(p.total,x.total)}</td></tr>`).join('')}</tbody></table></div></details>`;
    bindTips(el);
  }
}
// 2. outside money for and against: two bars on one scale, top groups named under each
function ovOutside(s,here,wide=false){
  const o=s.out, f=o.for.total, a=o.against.total, T='Outside money for and against';
  const sub=`Spending by outside groups, ${period(o.start,o.end)}`;
  const foot=`<b>Not campaign money:</b> outside groups spend this on their own, and it is never added to the campaign's total.${o.multi?'':` <b>"For":</b> spending that supports ${esc(s.short)} or attacks their opponent.`} ${here?'Every group and filing is listed below.':`<a href="#${s.id}-finance">Every group and filing →</a>`}`;
  if(!(f>0)&&!(a>0))return ovCard('Outside money',T,sub,`<div class="note">No outside spending for or against ${esc(s.short)} was reported through ${fmtDate(o.end)}.</div>`,foot,wide?'ov-wide':'');
  const max=Math.max(f,a,1);
  const col=(label,amt,list,cls)=>`<div class="ov-col"><div class="ov-amt">${fmt$(amt)}</div>
    <div class="ov-plot">${amt>0?`<i class="${cls}" style="height:${Math.max(2,amt/max*100).toFixed(1)}%" data-tip="${esc(label)}: ${fmtFull(amt)}"></i>`:''}</div>
    <div class="ov-collab">${esc(label)}</div>
    ${list.length?`<ul class="ov-top">${list.map(x=>`<li><span>${orgName(x.name,x.about)}<small class="muted">${CLS1[x.cls]||''}</small></span><b>${fmt$(x.amt)}</b></li>`).join('')}</ul>`:'<p class="small muted" style="margin:6px 0 0">No groups reported</p>'}</div>`;
  const body=`<div class="ov-pair">${col(forLabel(s),f,topSpenders(s,'for',3),'for')}${col(agLabel(s),a,topSpenders(s,'against',3),'ag')}</div>${o.incomplete.length?`<p class="small" style="margin:10px 0 0">${flag('Incomplete data',o.incomplete.join(' '))}</p>`:''}`;
  return ovCard('Outside money',T,sub,body,foot,wide?'ov-wide':'');
}
// 3. issue by issue against the viewer's own choices; no evidence is left blank, never scored as a mismatch
function ovAlign(s){
  const r=scoreFor(s), T='How they compare with your choices';
  if(!r.nChosen)return ovCard('Your issues',T,'Issue by issue, never a single score',`<p class="small" style="margin:0 0 6px">Pick your positions on up to ${ISS.length} issues in My alignment to see where ${esc(s.short)}'s record matches you.</p>${points([['Evidence available',esc(evidenceMix(s))]],'small')}<a class="cta" href="#align" style="margin-top:10px">Choose my issues</a>`,'');
  const kind=x=>x.status==='none'?'none':x.agree===1?'match':x.agree===0?'differ':'mixed';
  const SYM={match:'✓',differ:'✕',mixed:'◐',none:''};
  const rows=r.rows.map(x=>({x,k:kind(x)}));
  const n=k=>rows.filter(y=>y.k===k).length;
  const txt=({x,k})=>{
    if(k==='none')return 'No evidence';
    const lead=k==='match'?'Matches you':k==='differ'?'Doesn’t match':`Mixed: ${x.match} of ${x.n} match`;
    return lead+(x.status==='stated'?' <span class="muted">(stated position only)</span>':'');
  };
  const body=`<div class="row" style="margin-bottom:6px"><span class="chip good">✓ ${n('match')} match</span><span class="chip crit">✕ ${n('differ')} differ</span>${n('mixed')?`<span class="chip warn">◐ ${n('mixed')} mixed</span>`:''}<span class="chip ghost">${n('none')} no evidence</span></div>
    <ul class="ov-iss">${rows.map(y=>`<li class="${y.k}"><span class="ov-mk ${y.k}" aria-hidden="true">${SYM[y.k]}</span><span>${esc(y.x.i.label)}</span><span class="r">${txt(y)}</span></li>`).join('')}</ul>`;
  return ovCard('Your issues',T,`Your ${r.nChosen} chosen issue${r.nChosen===1?'':'s'}. An issue with no evidence is left blank, not counted as a mismatch.`,body,`Not a rating of the candidate. <a href="#${s.id}-match">Evidence for every issue →</a>`);
}
// ---------- key-vote ideology: bills marked liberal or conservative, scored from how each person voted ----------
const kvCache=new Map();
const kvScore=s=>{if(!kvCache.has(s.id))kvCache.set(s.id,keyVoteScore(keyVoteRows(CH[icH(s)].votes,s.id,ISSBY)));return kvCache.get(s.id)};
function kvTotals(C){
  let lib=0,con=0;
  CH[C].votes.forEach(v=>{const l=leanOfVote(v,ISSBY);if(l==='liberal')lib++;else if(l==='conservative')con++;});
  return {lib,con,n:lib+con};
}
const kvSide=side=>`<span class="chip ${side==='liberal'?'D':'R'}">Voted ${side==='liberal'?'Liberal':'Conservative'} Side</span>`;
// A Yea/Nay row's mark, for the vote lists: what a Yea means, or that the bill is not marked and why.
function leanTag(v){
  const l=leanOfVote(v,ISSBY);
  return l?`<span class="chip ${l==='liberal'?'D':'R'}" title="This bill is marked ${l}: a Yea takes the ${l} side and a Nay takes the other.">A Yea is the ${l} side</span>`:`<span class="chip ghost" title="${esc(whyNotMarked(v,ISSBY))}">Not marked liberal or conservative</span>`;
}
// A person's vote on a bill, always plain black text; the side taken is shown separately in the "Side taken" chip.
function voteText(v,pos){
  const l=v?leanOfVote(v,ISSBY):null, side=l?sideTaken(l,pos):null;
  const tip=side?`${pos}: voted the ${side} side on a bill marked ${l}`:l?`${pos}: no side taken`:`${pos}: bill not marked liberal or conservative`;
  return `<span class="vt" title="${esc(tip)}">${esc(pos)}</span>`;
}
const vtLegend=()=>points([['Reading a vote',"A yes vote takes the bill's marked side, liberal or conservative. A no vote takes the other side."],['Side taken','The column that says which side each vote was on.'],['Unmarked bills','Bills not marked liberal or conservative have no side.']],'small vtkey');
function kvBlock(s,id,full){
  const kv=kvScore(s), C=icH(s), tot=kvTotals(C), noun=CH[C].noun, T='Key votes marked liberal or conservative';
  const head=`<div class="kicker">${T}</div>`;
  if(!CH[C].votes.length)return `${head}<p class="small" style="margin:6px 0 0;color:var(--ink-2)">${esc(s.short)} casts no roll-call votes in this office, so there is no key-vote position.</p>`;
  if(!kv.n)return `${head}<p class="small" style="margin:6px 0 0;color:var(--ink-2)">${esc(s.short)} has no Yea or Nay on the ${tot.n} bills marked in the ${CH[C].name} set, so there is no key-vote position.</p>`;
  const rows=kv.rows.slice().sort((a,b)=>b.v.date.localeCompare(a.v.date));
  const table=`<details class="tv" ${full?'open':''}><summary>${full?'The marked bills':'Show the marked bills'} (${kv.n})</summary>${vtLegend()}<div class="tablewrap"><table><thead><tr><th>Date</th><th>Bill</th><th>Vote</th><th>Side taken</th><th>How it is marked</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="mono" style="white-space:nowrap">${fmtDate(r.v.date)}</td><td><a href="${voteUrl(r.v)}" target="_blank" rel="noopener">${esc(r.v.short)}</a></td><td>${voteText(r.v,r.pos)}</td><td>${kvSide(r.side)}</td><td class="small">A Yea is the ${r.lean} side</td></tr>`).join('')}</tbody></table></div></details>`;
  if(!kv.ok)return `${head}<p class="small" style="margin:6px 0 0;color:var(--ink-2)">${esc(s.short)} voted on only ${kv.n} of the ${tot.n} marked ${CH[C].name} bills. At least ${KV_MIN} are needed for a position, so none is shown.</p>${table}`;
  const pool=ALL.filter(p=>icH(p)===C&&kvScore(p).ok);
  const unmarked=full?CH[C].votes.filter(v=>!leanOfVote(v,ISSBY)):[];
  const why=unmarked.length?`<details class="tv"><summary>The other ${unmarked.length} ${CH[C].name} bills, not marked, and why</summary><ul class="list small" style="margin-top:8px">${unmarked.map(v=>`<li><b>${esc(v.short)}</b> <span class="muted">${esc(whyNotMarked(v,ISSBY))}</span></li>`).join('')}</ul></details>`:'';
  return `${head}<div class="big" style="margin-top:4px">Conservative side on ${kv.con} of ${kv.n} marked bills</div>
    <p class="small muted" style="margin:4px 0 6px">Liberal side on ${kv.lib} of ${kv.n}. A missed vote is not counted.</p>
    <div class="ideo" id="${id}"></div>
    ${points([['Each dot',`One profiled ${noun} with at least ${KV_MIN} marked votes (${pool.length} in all).`],['Bills marked',`${tot.n} in the ${CH[C].name} set. A yes vote is the liberal side on ${tot.lib} and the conservative side on ${tot.con}.`],['Compare within',`The ${CH[C].name} only, since each chamber votes on different bills.`],['Not the career score','This counts selected votes only.']],'small')}
    ${table}${why}`;
}
function drawKV(el,s){
  if(!el)return;
  const me=kvScore(s);if(!me.ok)return;
  const C=icH(s), pool=ALL.filter(p=>icH(p)===C&&kvScore(p).ok).sort((a,b)=>kvScore(a).share-kvScore(b).share);
  const W=Math.max(280,el.clientWidth), small=W<520, d=small?9:11, mL=16, mR=16;
  const X=v=>mL+v*(W-mL-mR), nb=Math.floor((W-mL-mR)/d), bins={};
  let maxS=0;
  const placed=pool.map(p=>{const b=Math.min(nb-1,Math.floor((X(kvScore(p).share)-mL)/d));const k=bins[b]||0;bins[b]=k+1;if(k+1>maxS)maxS=k+1;return [p,mL+(b+.5)*d,k]});
  const top=38, base=top+maxS*d, H=base+50;
  let g='',mine='';
  placed.forEach(([p,cx,k])=>{
    const k2=kvScore(p), cy=base-(k+.5)*d, cls=p.party==='R'?'r':p.party==='D'?'d':'i';
    const tip=`${p.name} (${p.party}) · conservative side on ${k2.con} of ${k2.n}`;
    if(p.id===s.id){
      const anchor=cx<W*.18?'start':cx>W*.82?'end':'middle';
      mine=`<line class="guide" style="stroke-dasharray:none" x1="${cx}" x2="${cx}" y1="${top-8}" y2="${cy-d/2-2}"></line><circle class="me ${cls}" cx="${cx}" cy="${cy}" r="${d/2+1.5}" data-tip="${esc(tip)}"></circle><text class="me-lab" x="${cx}" y="${top-14}" text-anchor="${anchor}">${esc(s.short)} · ${k2.con} of ${k2.n}</text>`;
    } else g+=`<circle class="${cls}" cx="${cx}" cy="${cy}" r="${d/2-.6}" data-tip="${esc(tip)}"></circle>`;
  });
  let ax=`<line class="axis" x1="${mL}" x2="${W-mR}" y1="${base+2}" y2="${base+2}"></line>`;
  [[0,'0%','start'],[.5,'50%','middle'],[1,'100%','end']].forEach(([v,l,a])=>{ax+=`<line class="axis" x1="${X(v)}" x2="${X(v)}" y1="${base+2}" y2="${base+7}"></line><text class="tick" x="${X(v)}" y="${base+19}" text-anchor="${a}">${l}</text>`;});
  ax+=`<text class="cap" x="${mL}" y="${base+40}">← Liberal side every time</text><text class="cap" x="${W-mR}" y="${base+40}" text-anchor="end">Conservative side every time →</text>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(s.name)} took the conservative side on ${me.con} of ${me.n} bills marked liberal or conservative, among ${pool.length} ${CH[C].nouns}">${ax}${g}${mine}</svg>`;
  bindTips(el);
}
function mountKV(id,s){const f=()=>drawKV(document.getElementById(id),s);f();resizers.push(f);}

// 4. one line from most liberal to most conservative, the candidate among faint dots for the whole chamber
function ovIdeo(s){
  const it=ideoText(s), T='Where they sit politically', kv=kvScore(s);
  if(!s.ideo&&!kv.ok){
    const few=kv.n?` ${esc(s.short)} voted on only ${kv.n} bill${kv.n===1?'':'s'} marked liberal or conservative, too few for a position.`:'';
    return ovCard('Politics',T,'Needs a congressional voting record',`<div class="big">No voting score</div><p class="small" style="margin:6px 0 0;color:var(--ink-2)">${esc(it.short)}. A position is shown only where there is a congressional voting record, and is never guessed.${few}</p>`,`<a href="#${s.id}-record">Record and votes →</a>`,'ov-wide');
  }
  const C=icH(s);
  const career=s.ideo?`<div class="kicker">Whole career, Voteview</div><div class="big" style="margin-top:4px">${esc(it.head)}</div><div class="ideo ov-strip" id="ovstrip"></div>${points([['Each faint dot',`One current ${CH[C].noun} (${DATA.pools[C].length} in all).`],['Score',`${s.ideo.dim1>0?'+':''}${s.ideo.dim1.toFixed(3)}, on a scale from −1 (most liberal) to +1 (most conservative), from Voteview's DW-NOMINATE.`]],'small')}`:'';
  const keyv=kv.ok?`<div class="${s.ideo?'ov-sep':''}">${kvBlock(s,'ovkv',false)}</div>`:'';
  return ovCard('Politics',T,kv.ok&&s.ideo?'Two views: the whole career, and the bills marked liberal or conservative':kv.ok?'From the bills marked liberal or conservative':'Whole career',career+keyv,`<a href="#${s.id}-record">Full chart with names and every vote →</a> · <a href="#method">How bills are marked</a>`,'ov-wide');
}
function drawStrip(el,s){
  if(!el||!s.ideo)return;
  const C=icH(s), pts=DATA.pools[C];
  const W=Math.max(260,el.clientWidth), mL=12, mR=12, x0=-1, x1=1.05, lineY=48, H=96;
  const X=v=>mL+(Math.max(x0,Math.min(x1,v))-x0)/(x1-x0)*(W-mL-mR);
  const meIdx=pts.findIndex(p=>(s.bioguide&&p[3]===s.bioguide)||p[2]===s.name);
  let g='';
  pts.forEach((p,i)=>{if(i===meIdx)return;g+=`<circle class="f ${p[1]==='R'?'r':p[1]==='D'?'d':'i'}" cx="${X(p[0]).toFixed(1)}" cy="${(lineY+((i*37)%9-4)*1.5).toFixed(1)}" r="3.2"></circle>`;});
  const mx=X(s.ideo.dim1), score=(s.ideo.dim1>0?'+':'')+s.ideo.dim1.toFixed(2);
  const anchor=mx<W*.18?'start':mx>W*.82?'end':'middle';
  const me=`<line class="guide" style="stroke-dasharray:none" x1="${mx}" x2="${mx}" y1="${lineY-30}" y2="${lineY-8}"></line><circle class="me ${s.party==='R'?'r':'d'}" cx="${mx}" cy="${lineY}" r="6.5" data-tip="${esc(s.name)} · ${score}"></circle><text class="me-lab" x="${mx}" y="${lineY-36}" text-anchor="${anchor}">${esc(s.short)} ${score}</text>`;
  const ax=`<line class="axis" x1="${mL}" x2="${W-mR}" y1="${lineY}" y2="${lineY}"></line><text class="cap" x="${mL}" y="${H-6}">← More liberal</text><text class="cap" x="${W-mR}" y="${H-6}" text-anchor="end">More conservative →</text>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(s.name)}'s DW-NOMINATE score ${s.ideo.dim1.toFixed(3)} among ${pts.length} ${CH[C].nouns}; ${esc(ideoText(s).head)}">${ax}${g}${me}</svg>`;
  bindTips(el);
}
function mountStrip(id,s){const f=()=>drawStrip(document.getElementById(id),s);f();resizers.push(f);}
// 5. do their words match their actions: a tally of checked statements that always shows how many were checked
const WORD_GROUPS=[
  ['Record supports it','good','✓',['consistent'],true],
  ['Partly supported, or changed over time','warn','◐',['partial','changed'],true],
  ['Record contradicts it','crit','✕',['contradiction'],true],
  ['Unclear, or later events matter','neutral','◇',['unclear','outcome'],false],
];
function ovWords(s){
  const T='Do their words match their actions?', N=s.statements.length;
  if(!N)return ovCard('Words and actions',T,'Checked statements',`<div class="big">No statements checked</div>`,'');
  const groups=WORD_GROUPS.map(([label,cls,icon,keys,always])=>({label,cls,icon,always,items:s.statements.filter(x=>keys.includes(x.assessment))}));
  const body=`<div class="big">${N} statement${N===1?'':'s'} checked</div>
    <div class="ov-tiles" role="group" aria-label="${N} checked statements, grouped by result">${groups.map(g=>g.items.map(x=>`<i class="${g.cls}" data-tip="${esc(x.topic)}: ${esc(g.label.toLowerCase())}">${g.icon}</i>`).join('')).join('')}</div>
    <ul class="ov-tally">${groups.filter(g=>g.always||g.items.length).map(g=>`<li><span class="chip ${g.cls}">${g.icon}</span><span>${g.label}</span><b class="num">${g.items.length}</b></li>`).join('')}</ul>
    <details class="tv"><summary>Show the statements</summary><ul class="list small" style="margin-top:8px">${groups.map(g=>g.items.map(x=>`<li>${esc(x.topic)} <span class="muted">· ${esc(g.label.toLowerCase())}</span></li>`).join('')).join('')}</ul></details>`;
  return ovCard('Words and actions',T,`Only the statements that were checked, not everything ${esc(s.short)} has said.`,body,`<a href="#${s.id}-promises">Read the checks →</a>`);
}
// ethics: a short text list, never a chart, because an allegation, an investigation and a confirmed finding are very different things
const ETH_TAG={finding:['Confirmed finding','crit'],investigation:['Investigation','warn'],allegation:['Allegation','neutral']};
function ovEthicsCard(s){
  const items=s.ethics.filter(e=>e.outcome!=='None found');
  const order=Object.keys(ETH_TAG), rank=e=>{const i=order.indexOf(e.status);return i<0?order.length:i};
  const list=items.map((e,i)=>[e,i]).sort((a,b)=>rank(a[0])-rank(b[0])||a[1]-b[1]).map(x=>x[0]);
  const body=list.length?`<ul class="ov-eths">${list.map(e=>{const [lab,cls]=ETH_TAG[e.status]||[e.type,'ghost'];return `<li class="ov-eth"><span class="chip ${cls}">${esc(lab)}</span><b>${esc(e.title)}</b> <span class="mono muted">${esc(e.date)}</span><div class="small muted ov-clamp" style="margin-top:4px">${esc(e.outcome)}</div></li>`}).join('')}</ul>
    ${points([['Allegation','A complaint or report with no official finding.'],['Investigation',`A formal inquiry, lawsuit or case, still open or ended without a finding against ${esc(s.short)}.`],['Confirmed finding',`A court, agency or ethics body found a violation or issued a penalty, or ${esc(s.short)} admitted it.`]],'small')}`
    :`<p class="small" style="margin:8px 0 0">No documented violations, penalties or findings located in the sources checked.</p>`;
  return ovCard('Integrity','Legal & ethics records',`${list.length?`${list.length} item${list.length===1?'':'s'}, most certain first`:'Sources checked'}`,body,`<a href="#${s.id}-integrity">Details and sources in Integrity →</a>`,'ov-top-align');
}
// The ethics card, with a line for the net-worth range from the member's latest annual disclosure (filled from the refresh).
function ovEthics(s){
  const card=ovEthicsCard(s),at=card.lastIndexOf('</section>');
  const reviewed=reviewedHoldingsSummary(s.holdings);
  const citation=src=>src?.u?` · <a href="${esc(src.u)}" target="_blank" rel="noopener noreferrer">${esc(src.t||'source')} ↗</a>`:'';
  const reviewedHTML=reviewed?`<p class="small ov-holdings-note"><b>Reviewed holdings note:</b> ${esc(reviewed.note||reviewed.label)}${reviewed.since?` (since ${esc(reviewed.since)})`:''}${citation(reviewed.source)}${citation(reviewed.also)}</p>`:'';
  return at<0?card:card.slice(0,at)+`<div class="ov-networth" data-networth="${esc(s.id)}">${reviewedHTML}</div>`+card.slice(at);
}
// Each year's annual disclosure on file, newest first: its net-worth range and its individual stocks, so a change
// shows. Only with more than one year; a year whose report couldn't be read says so.
function netWorthOverTime(x){
  const years=(x?.history||[]).filter(h=>h.year!=null);
  if(years.length<2)return '';
  const one=h=>{const link=h.url?` <a href="${esc(h.url)}" target="_blank" rel="noopener">↗</a>`:'';
    if(h.unreadable)return `<li><b>${esc(h.year)}</b>: not readable (filed on paper)${link}</li>`;
    const st=h.stocks?`; ${h.stocks.count} individual stock${h.stocks.count===1?'':'s'} or option${h.stocks.count===1?'':'s'}, ${esc(rangeText(h.stocks,fmt$))}`:'';
    return `<li><b>${esc(h.year)}</b>: ${esc(rangeText(h,fmt$))}${st}${link}</li>`;};
  return `<details class="small ov-networth-years" style="margin:6px 0 0"><summary>Net worth by year (${years.length} annual disclosures)</summary><ul style="margin:6px 0 0;padding-left:18px">${years.map(one).join('')}</ul></details>`;
}
async function fillNetWorth(root){
  for(const el of root.querySelectorAll('.ov-networth[data-networth]')){
    let x=null,coverage=null;try{x=await window.RecordLive.netWorth(el.dataset.networth);}catch{}
    if(!el.isConnected)continue;
    if(!x){try{coverage=await window.RecordLive.netWorthStatus(el.dataset.networth);}catch{}}
    if(!x){
      const note=el.innerHTML;
      const why=coverage?.error?`The latest import reported: ${esc(coverage.error)}.`:
        coverage?.last_success?`Last successful import: ${esc(new Date(coverage.last_success).toLocaleDateString())}.`:
        'No completed disclosure import is available.';
      el.innerHTML=`<p class="small ov-holdings-status"><b>Current holdings and trades:</b> unknown. ${why} Missing data does not mean no holdings or no trades. <a href="#updates">Check source coverage</a>.</p>${note}`;
      continue;
    }
    const reviewed=el.innerHTML;
    const lead=holdingsLead(x),held=lead?(lead.status==='stocks'?` It lists ${lead.stocks} individual stock${lead.stocks===1?'':'s'} or option${lead.stocks===1?'':'s'}.`:lead.status==='blind-trust'?' It lists a qualified blind trust.':' It lists no individual stocks.'):'';
    el.innerHTML=`<p class="small" style="margin:10px 0 0"><b>Net worth:</b> ${x.unreadable?'the latest annual report was filed on paper or could not be read':`${esc(rangeText(x,fmt$))}, from their ${esc(x.year||'')} annual disclosure (every value on it is a range)`}.${held} <a href="#${esc(el.dataset.networth)}-ethics">Details</a> · <a href="${esc(x.url)}" target="_blank" rel="noopener">report ↗</a></p>${netWorthOverTime(x)}${reviewed}`;
  }
}

// In place of the campaign and outside-money cards for someone in office who is not on the 2026 ballot.
function ovOffice(s){
  return ovCard('Not on the ballot','No 2026 race to show',esc(s.term),`<div class="big">${esc(s.seat)}</div>${points([['Nothing to compare','No 2026 campaign totals, outside spending or opponents.'],['Left out of','The filters, races, comparisons and score pages.'],['Grades','From the official acts and the ethics record.'],['Campaign committee',`${esc(s.cmteName||'The 2024 committee')} (${esc(s.fecCmte)}) still files with the FEC. Its latest totals are on the Money &amp; Influence tab.`]],'small')}`,`<a href="${fecCmteUrl(s.fecCmte)}" target="_blank" rel="noopener">FEC committee page ↗</a> · <a href="#${s.id}-finance">Money &amp; Influence →</a>`);
}
function paneOverview(s,pane){
  const pr=s.basic?null:SCORER.promises(s),v=s.basic?null:personPvp(s),e=s.basic?null:personEthics(s);
  const highlights=s.basic?[
    ['Office & election',`In the Senate since ${monthYear(s.since)}. Class ${s.class}; term ends ${fmtDate(s.termEnd)}. ${ballotLine(s)}.`, 'legislation','View official records'],
    ['Reviewed coverage','Research is not yet reviewed. Missing grades do not mean a zero or a clean record.','ethics','See disclosure coverage'],
    ['Find your alignment','Choose your priorities; this profile needs reviewed issue evidence before it can be compared.','match','Your match']
  ]:[
    ['Keeps Their Word',pr.clear?`${pr.clear} counted checks: ${pr.kept} supported${pr.half?`, ${pr.half} partial or changed`:''}${pr.broken?`, ${pr.broken} contradicted`:''}. ${pr.notCounted+pr.vague+(pr.debate||0)} excluded or pending.`:'No reviewed statement checks are available yet.','word','Read the promises and checks'],
    ['Votes and bills',`${v.n} scored actions for People First. ${evidenceOf(s).label}.`,'ideology','Positions, votes and bills'],
    ['Above Board',e.finding||e.open||e.closed?`${e.finding} findings, ${e.open} open and ${e.closed} closed investigations in checked records.`:`${e.allegation?e.allegation+' allegations listed; ':''}No confirmed findings located in checked sources. This is not a clearance.`,'aboveboard','Conflicts, disclosures and legal records']
  ];
  pane.innerHTML=`<div class="overview-summary-head"><h2>Three things to know</h2><p class="intro">A quick summary. Open a finding or a grade for its evidence.</p></div><div class="overview-highlights">${highlights.map(([title,body,route,label])=>`<article class="overview-highlight"><h3>${title}</h3><p>${esc(body)}</p><a href="#${s.id}-${route}">${label} →</a></article>`).join('')}</div><div class="overview-links"><a href="#${s.id}-unbought">Campaign money and the money map</a><a href="#${s.id}-ideology">Issue positions & Your Match</a><a href="#${s.id}-showsup">Votes missed and bills moved</a>${s.basic?'':`<a href="#${s.id}-sources">Sources & coverage</a>`}<a href="#method">Methodology</a><a href="#method-log">Score history</a></div><p class="small muted overview-asof">Research snapshot: ${esc(DATA.asof)}. Financial records and source updates keep their own dates.</p>`;
}

function integrityPreviewShell(s){return `<section class="integrity-preview chart" aria-labelledby="integrity-title"><div class="kicker">PROVISIONAL METHODOLOGY · CALIBRATION PENDING</div><h2 id="integrity-title">Integrity <span class="integrity-pill">Provisional</span></h2>${gradeRule('integ')}<div data-integrity-content><p class="small muted">Checking reviewed evidence and official filing coverage…</p></div><p class="small muted">The interface is consolidated; this does not mean the methodology is calibrated. <a href="#method-integrity">Formula and coverage limits</a>.</p></section>`;}
function integrityComponentRow(label,component,formula=''){
  const val=component?.value==null?'Not graded':`${Number(component.value.toFixed(2))}%`;
  const tone=label==='Legal Trouble'?'bad':'good';
  const reason=component?.why||'Complete from available reviewed inputs';
  const seen=new Set(),links=(component?.sources||[]).map(x=>{const url=typeof x==='string'?x:x?.u||x?.url;let label=typeof x==='string'?'':x?.t||x?.title||'';if(!label&&/^https?:\/\//.test(url||'')){try{label=new URL(url).hostname.replace(/^www\./,'');}catch{label='Source';}}return {url,label:label||'Source'};}).filter(x=>/^https?:\/\//.test(x.url||'')&&!seen.has(x.url)&&seen.add(x.url)).map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>`).join(' · ');
  return `<details><summary><b>${esc(label)}</b><span${toneAttrs(component?.value,tone)}>${val}</span></summary><p class="small">${esc(reason)}${formula?`<br>${formula}`:''}</p>${links?`<p class="small">${links}</p>`:''}</details>`;
}
async function loadIntegrityPreview(s,pane,workers){
  const host=pane.querySelector('[data-integrity-content]');
  const asOfYear=Number(String(DATA.asof||'').match(/\b(19|20)\d{2}\b/)?.[0])||null;
  const [sizes,annual]=await Promise.all([
    window.RecordLive.section(s.id,'donor-sizes').catch(()=>null),
    window.RecordLive.section(s.id,s.chamber==='S'?'net-worth-senate':'net-worth-house').catch(()=>null)
  ]);
  if(host&&!host.isConnected||!location.hash.startsWith('#'+s.id))return;
  const typed=[];for(const [i,amount] of (s.pac?.rows||[])){const t=pacTypeOf(DATA,i);if(!t)continue;
    const kind=({corporate:'corporate',lobbyist:'lobbyist',trade:'trade',membership:'membership',cooperative:'cooperative',leadership:'leadership',party:'party',candidate:'candidate',unconnected:'unconnected',labor:'labor',joint:'other',other:'other'})[t.kind]||'other';typed.push({amount,kind});}
  const typedTotal=typed.reduce((n,r)=>n+r.amount,0),campaign=s.camp||{};
  const pledge=fundraisingPledgePoints(DATA,s),ethics=personEthics(s);
  const bundled=Object.entries(DATA.bundled?.people?.[s.id]||{}).map(([group,r])=>({id:`bundled:${group}`,group,amount:r.routed,src:r.src,period:bundledCycle(s.id,group)}));
  const hand=(s.conduit?.rows||[]).map((r,i)=>({id:`conduit:${i}`,group:r.conduit,amount:r.amount,src:r.srcs?.[0],period:r.period}));
  const earmarkEvidence=bundled.concat(hand).filter(r=>Number.isFinite(r.amount)&&r.src);
  const preview=integrityPreview({...s,ethicsResult:ethics},{asOfYear,attendance:window.ATTENDANCE||null,getItDone:window.GET_IT_DONE||null,conflicts:window.CONFLICTS||null,finance:{netWorth:annual},sizes,
    pacRows:typed,pacReceipts:typedTotal,pacCoverage:campaign.pac!=null&&Math.abs(typedTotal-campaign.pac)<=.02,
    pacPeriodMatches:coversPeriod(s.pac?.filings,campaign.start,campaign.end),
    earmarks:{complete:false,rows:earmarkEvidence},pledgePoints:pledge.points,pledgeSources:pledge.rows.map(r=>r.source).filter(Boolean),pledgesReviewed:true,
    trust:s.holdings?.status==='blind-trust'?{verified:false}:null});
  const cci=previewCci({businessVotes:SCORER.cci(s)?.votes?.index??null}),workerPreview=workersPreview(workers?.billsPct??null,cci);
  const o=preview.overall,grade=o.pct==null?'Not graded':`${o.pct}% · ${letter(o.pct)}`;
  const overallWhy=o.why?`${o.why}${preview.legal.value==null?`; ${preview.legal.why||'Sourced Legal Trouble review is missing'}`:''}`:`${o.used.length} components, weights normalized; Legal Trouble deducted at full strength.`;
  const formula=preview.honesty.value==null?'Promise data needs three counted checks':`(${preview.honesty.score.kept} + 0.5 × ${preview.honesty.score.half}) ÷ ${preview.honesty.score.clear} counted checks × 100 = ${Number(preview.honesty.value.toFixed(4))}%`;
  const workText=workerPreview.pct==null?workerPreview.why:`${workerPreview.pct}%${workerPreview.blended?' · 75% legislative actions + 25% (100 − preview CCI)':' · legislative actions only; preview CCI unavailable'}`;
  const fin=preview.personalFinances,finMath=fin.complete?`S = ${fin.stockPenalty.toFixed(2)}; T = ${fin.tradeCountPenalty.toFixed(2)} + ${fin.tradeValuePenalty.toFixed(2)}; index deductions = ${fin.insiderPenalty.toFixed(2)} + ${fin.dodgerPenalty.toFixed(2)}. Holdings year ${esc(fin.holdingsYear)}; trades ${esc(fin.tradePeriod?.start)} – ${esc(fin.tradePeriod?.end)}.`:'S, T, and index deductions are shown only when the reviewed holdings and trade coverage are complete.';
  const fund=preview.fundraising,fundMath=[fund.D!=null?`D ${fund.D.toFixed(2)}`:'D unavailable',fund.P!=null?`P ${fund.P.toFixed(2)}`:'P unavailable',fund.R!=null?`R ${fund.R.toFixed(2)}`:'R unavailable',fund.E!=null?`E ${fund.E.toFixed(2)}`:'E unavailable',`pledges ${pledge.points>0?'+':''}${pledge.points}`].join(' · ');
  const summary=`<div class="integrity-score"><b${toneAttrs(o.pct,'good')}>${esc(grade)}</b><span>${esc(overallWhy)}</span></div>
    <div class="integrity-components">${integrityComponentRow('Honesty',preview.honesty,formula)}${integrityComponentRow('Personal Finances',preview.personalFinances,finMath)}${integrityComponentRow('Fundraising',preview.fundraising,`${fundMath}${sizes?` · Gift buckets: ${esc(sizes.start||'')} – ${esc(sizes.end||'')}; receipts: ${campaign.receipts==null?'unavailable':fmtFull(campaign.receipts)}`:' · Same-period gift-size data unavailable'}`)}${integrityComponentRow('Showing Up',preview.showingUp,showingUpMath(preview.showingUp))}${integrityComponentRow('Conflicts of Interest',preview.conflicts,conflictsMath(preview.conflicts))}${integrityComponentRow('Legal Trouble',preview.legal,preview.legal.reviewed?`Legal Trouble index: ${preview.legal.value}; sourced review dated ${esc(preview.legal.reviewedAt)}.`:'A dated, sourced review is required; no legal input is assumed.')}</div>
    <details class="integrity-worker"><summary><b>People First comparison</b><span>${esc(workText)}</span></summary><p class="small">Preview CCI omits direct business-PAC share. Its available implemented parts are employee giving (10%), business-funder votes (35%) and lobbied bills (20%), renormalized over available evidence. Current People First remains unchanged. <a href="#${s.id}-pvp">Open its actions and supporting research →</a></p></details>`;
  if(host)host.innerHTML=summary;
  const tile=app.querySelector(`[data-integrity-tile][href="#${s.id}-integrity"]`);if(tile){const pct=o.pct;tile.querySelector('.hc-gv').innerHTML=pct==null?'<span class="hc-ng">Not graded</span>':`<b class="gr-${letter(pct)}">${letter(pct)}</b><span>${pct}%</span>`;tile.querySelector('.hc-gd').textContent=o.why||`${o.used.length} complete components; Legal Trouble review sourced.`;}
  const fundraising=pane.querySelector('[data-integrity-fundraising-detail]');if(fundraising)fundraising.innerHTML=integrityFundraisingDetails({s,preview,sizes,typed,typedTotal,earmarkEvidence,pledge});
  const showing=pane.querySelector('[data-integrity-showing-up]');if(showing)showing.innerHTML=showingUpDetails(s,preview.showingUp);
  const conflicts=pane.querySelector('[data-integrity-conflicts]');if(conflicts)conflicts.innerHTML=conflictsDetails(s,preview.conflicts);
}
// Showing Up's arithmetic, for its row: the votes, the misses and the score.
function showingUpMath(x){
  const a=x?.attendance||x,g=x?.getItDone;
  if(!a?.complete)return a?.votes?`${a.missed.toLocaleString()} of ${a.votes.toLocaleString()} roll-call votes missed on record.`:'';
  const att=`Attendance: missed ${a.missed.toLocaleString()} of ${a.votes.toLocaleString()} roll-call votes in ${a.first}–${a.last} (${a.rate.toFixed(2)}%), 100 − 5 × ${a.rate.toFixed(2)} = ${Number(a.value.toFixed(2))}.${a.excused.length?` ${a.excused.length} excused absence${a.excused.length===1?'':'s'} left out.`:''}`;
  if(!g?.complete)return `${att} Get It Done: ${g?.why||'not available'}, so Showing Up is Attendance alone.`;
  return `${att} Get It Done: ${g.advanced} of ${g.sponsored} sponsored bills advanced (${(g.rate*100).toFixed(1)}%), against a typical ${(g.typical*100).toFixed(1)}% for their party in their chamber = ${Number(g.value.toFixed(2))}. Showing Up = 0.75 × ${Number(a.value.toFixed(2))} + 0.25 × ${Number(g.value.toFixed(2))} = ${Number(x.value.toFixed(2))}.`;
}
// Showing Up in full: each year's votes and misses, the excused absences with their sources, the bills by Congress, and
// what the record can't say.
function showingUpDetails(s,x){
  if(!x)return '';
  const a=x.attendance||x,g=x.getItDone;
  const years=a.years?.length?`<div class="tablewrap"><table><thead><tr><th>Year</th><th class="r">Roll-call votes</th><th class="r">Missed</th><th class="r">Share missed</th></tr></thead><tbody>${a.years.map(y=>`<tr><td>${esc(y.year)}</td><td class="r">${y.votes.toLocaleString()}</td><td class="r">${y.missed.toLocaleString()}</td><td class="r">${y.votes?(y.missed/y.votes*100).toFixed(1)+'%':'—'}</td></tr>`).join('')}</tbody></table></div>`:'';
  const excused=a.excused?.length?`<p class="small"><b>Excused, left out:</b> ${a.excused.map(e=>`${esc(e.label)}, ${esc(fmtDate(e.from))}${e.to!==e.from?` – ${esc(fmtDate(e.to))}`:''} (${e.votes} votes, ${e.missed} missed)${e.src?.u?` · <a href="${esc(e.src.u)}" target="_blank" rel="noopener noreferrer">${esc(e.src.t||'source')} ↗</a>`:''}`).join('; ')}</p>`:'';
  const bills=g?.congresses?.length?`<h3>Get It Done</h3><p class="small">${esc(g.complete?`${Number(g.value.toFixed(1))} of 100: ${g.advanced} of ${g.sponsored} sponsored bills and joint resolutions advanced.`:g.why)}</p><div class="tablewrap"><table><thead><tr><th>Congress</th><th>Chamber</th><th class="r">Sponsored</th><th class="r">Advanced</th><th class="r">Their rate</th><th class="r">Typical for their party</th></tr></thead><tbody>${g.congresses.map(c=>`<tr><td>${esc(c.congress)}th</td><td>${c.chamber==='S'?'Senate':'House'}</td><td class="r">${c.sponsored}</td><td class="r">${c.advanced}</td><td class="r">${c.sponsored?(c.advanced/c.sponsored*100).toFixed(1)+'%':'—'}</td><td class="r">${c.typical==null?'—':(c.typical*100).toFixed(1)+'%'}</td></tr>`).join('')}</tbody></table></div><p class="small muted">A bill advanced when it was reported by a committee, placed on a calendar, passed a chamber, sent to the other, signed or became law (Congress.gov). Compared within their party and chamber, so the minority isn't marked down for being the minority.</p>`:g?`<h3>Get It Done</h3><p class="small">${esc(g.why)}</p>`:'';
  return `<p class="small">${x.complete?`<b>${Number(x.value.toFixed(1))} of 100.</b> `:''}${esc(x.complete?showingUpMath(x):a.why)}</p>${years}${excused}
    <p class="small muted">From Voteview's record of every roll call (<a href="https://voteview.com/data" target="_blank" rel="noopener noreferrer">voteview.com ↗</a>). A missed vote is shown as missed; the record doesn't say why or where ${esc(s.name.split(' ')[0])} was. Votes missed while campaigning count. A medical leave, a birth or adoption, a death in the family, or military duty is left out when a cited source shows it.</p>${bills}`;
}
// Conflicts of Interest's arithmetic, for its row.
function conflictsMath(x){
  if(!x?.complete)return '';
  const p=x.parts||{},f=v=>v==null?'not available':Number(v.toFixed(1));
  return `Outside Income & Conflicts ${f(x.outside)} (income, boards & agreements ${f(p.income)}; Lobbyist Overlap ${f(p.lobbyistOverlap)}; Contracts for Donors ${f(p.contractsForDonors)}; Foreign Agent ${f(p.foreignAgent)}) · Gifts & Travel ${f(x.gifts)} · 100 − (0.60 × outside + 0.40 × gifts & travel) = ${Number(x.value.toFixed(2))}.`;
}
// Conflicts of Interest in full: what the report shows from interested organizations, each with its source.
function conflictsDetails(s,x){
  if(!x)return '';
  if(!x.complete)return `<p class="small">${esc(x.why)}</p><p class="small muted">Read from the latest annual or candidate financial disclosure (Senate eFD Parts 1–10, House Schedules A–J): outside income, board seats, agreements, gifts and paid travel. An organization counts only after it is matched and reviewed as having business before their committees; an unreviewed name is a lead. Not graded until then — missing evidence is never a clean record.</p>`;
  const list=(title,rows,line)=>rows?.length?`<p class="small"><b>${esc(title)}:</b> ${rows.map(line).join('; ')}</p>`:'';
  const link=r=>r?.src?.u?` · <a href="${esc(r.src.u)}" target="_blank" rel="noopener noreferrer">${esc(r.src.t||'source')} ↗</a>`:'';
  const money=n=>Number.isFinite(Number(n))?fmtFull(Number(n)):'amount not given';
  const rec=(window.CONFLICTS?.people||{})[s.id]||{};const mine=r=>r?.interested===true;
  return `<p class="small"><b>${Number(x.value.toFixed(1))} of 100.</b> ${esc(conflictsMath(x))}</p>
    ${list('Income from interested organizations',(rec.income||[]).filter(mine),r=>`${esc(r.payer||r.source||'payer')} ${money(r.amount)}${link(r)}`)}
    ${list('Board seats and positions',(rec.positions||[]).filter(mine),r=>`${esc(r.position||'position')}, ${esc(r.org||'organization')}${link(r)}`)}
    ${list('Agreements',(rec.agreements||[]).filter(mine),r=>`${esc(r.kind||'agreement')}, ${esc(r.org||'organization')}${link(r)}`)}
    ${list('Gifts',(rec.gifts||[]).filter(mine),r=>`${esc(r.source||'source')} ${money(r.value)}${link(r)}`)}
    ${list('Paid travel',(rec.travel||[]).filter(mine),r=>`${esc(r.sponsor||'sponsor')}${r.dates?`, ${esc(r.dates)}`:''} ${money(r.value)}${link(r)}`)}
    <p class="small muted">From their ${esc(x.report?.year||'')} report${x.report?.url?` (<a href="${esc(x.report.url)}" target="_blank" rel="noopener noreferrer">open ↗</a>)`:''}, matches reviewed ${esc(fmtDate(x.reviewed?.at))}. Legal gifts, trips and income count when they come from an interested organization: this measures exposure to those with business before them, not a rule broken.</p>`;
}

function conduitBlock(s){
  const c=s.conduit||{status:'not_measured',rows:[],aipacDirect:[]};
  const direct=c.aipacDirect||[];
  const dsum=direct.reduce((a,b)=>a+b.amount,0);
  const head=`<h3 style="margin:22px 0 6px">${term('earmarked','Money routed through PACs on donors\' behalf')}</h3>
  <div style="margin-bottom:10px">${points([['PAC limit','A PAC can give a candidate at most $5,000 per election from its own account.'],['Conduits','Some groups also collect checks from their members and forward them ("earmarked" contributions).'],['Where it shows','The FEC counts that money as individual contributions. It is already in campaign funds raised, but not in the PAC table above, even though the group directed it.']],'small')}</div>`;
  let body='';
  if(c.status==='measured'){
    body=`<div class="tablewrap"><table><thead><tr><th>Conduit</th><th>Period</th><th class="r">Amount</th></tr></thead><tbody>${c.rows.map(r=>`<tr><td>${orgName(r.conduit,ORGS.about(r.conduit),`<a href="${fecCmteUrl(r.id)}" target="_blank" rel="noopener">${esc(r.conduit)}</a>`)}<div class="small" style="color:var(--ink-2);margin-top:4px">${esc(r.detail)}</div><div class="small" style="margin-top:4px">${r.srcs.map(x=>`<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)} ↗</a>`).join(' · ')}</div></td><td class="mono" style="white-space:nowrap">${esc(r.period)}</td><td class="r"><b>${fmtFull(r.amount)}</b></td></tr>`).join('')}</tbody></table></div>`;
  } else if(c.status==='present'){
    body=`<div class="note"><b>Earmarked money found, total not yet tallied.</b> ${esc(c.note)}</div>`;
  } else if(!DATA.bundled){
    body=`<div class="note"><b>Not measured for ${esc(s.short)}.</b> Earmarked totals come from each conduit's own FEC reports, which run to tens of thousands of rows. They could not be read accurately for this release, so no partial total is shown. This does not mean ${esc(s.short)} received none.</div>`;
  }
  let note=c.status==='measured'&&c.note?`<p class="small" style="margin-top:8px;color:var(--ink-2)">${esc(c.note)} ${c.noteSrc?`<a href="${esc(c.noteSrc.u)}" target="_blank" rel="noopener">${esc(c.noteSrc.t)} ↗</a>`:''}</p>`:(c.status==='present'&&c.noteSrc?`<p class="small" style="margin-top:6px"><a href="${esc(c.noteSrc.u)}" target="_blank" rel="noopener">${esc(c.noteSrc.t)} ↗</a></p>`:'');
  // The groups whose bundled gifts are read for everyone (research.json "bundled", scripts/build-bundled.mjs), first.
  const B=DATA.bundled,mine=Object.entries(B?.people?.[s.id]||{}).sort((a,b)=>b[1].routed-a[1].routed);
  if(B){
    const names=Object.keys(B.conduits||{}).map(k=>(GPBY[k]||{}).org||k);
    const hand=c.status==='measured'||c.status==='present';
    const auto=mine.length?`<div class="tablewrap"><table><thead><tr><th>Group</th><th>Cycle</th><th class="r">Gifts forwarded</th><th class="r">Amount</th></tr></thead><tbody>${mine.map(([k,v])=>`<tr><td>${orgName((GPBY[k]||{}).org||k,ORGS.group(k))}<div class="small"><a href="${esc(v.src)}" target="_blank" rel="noopener">FEC: what its PAC forwarded ↗</a>${v.direct?` · its PAC's own checks, ${fmtFull(v.direct)}, are in the PAC table above`:''}</div></td><td class="small">${esc(bundledCycle(s.id,k))}</td><td class="r">${v.n?v.n.toLocaleString():'—'}</td><td class="r"><b class="num">${fmtFull(v.routed)}</b></td></tr>`).join('')}</tbody></table></div>`
      :hand?'':`<div class="note">None of the groups tracked here (${esc(names.join(', '))}) forwarded donors' gifts to ${esc(s.short)}'s campaign, in the FEC's processed records as of ${esc(fmtDate(B.asOf))}.</div>`;
    const read=`From each group's PAC's own FEC reports, read ${esc(fmtDate(B.asOf))}. ActBlue and WinRed, which forward gifts for any campaign that uses them, aren't counted.`;
    if(!mine.length&&hand)body=`${body}${note}<p class="small muted" style="margin:6px 0 0">The automatic reading of every campaign's bundled gifts (from each group's PAC's own FEC reports, ${esc(fmtDate(B.asOf))}) found none for ${esc(s.short)}, so the figure researched by hand above stands.</p>`;
    else body=`${auto}<p class="small muted" style="margin:6px 0 0">${read}</p>${hand?`<details style="margin-top:8px"><summary>Researched by hand</summary>${body}${note}</details>`:''}`;
    note='';
  }
  const dl=s.pac.filings.length?(direct.length?`<p class="small" style="margin-top:8px"><b>Direct checks from AIPAC's PAC (${esc(s.pac.window)}):</b> <span class="num">${fmtFull(dsum)}</span>. ${direct.map(d=>`${esc(d.report)} ${fmtFull(d.amount)}`).join('; ')}. These are in the PAC table above.</p>`:`<p class="small muted" style="margin-top:8px">No direct check from AIPAC's PAC appears in the reports itemized here (${esc(s.pac.window)}).</p>`):'';
  return head+body+note+dl;
}

// ---------- Money & Influence tab: where the campaign's money comes from, outside money, and every filing behind them ----------
function researchedFunders(s){
  const rows=(s.funderPos||[]).filter(f=>f.pac>0||f.routed>0).slice().sort((a,b)=>(b.pac+(b.routed||0))-(a.pac+(a.routed||0)));
  if(!rows.length)return '';
  const cash=n=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
  return `<section class="chart researched-funders" id="f-groups"><div class="page-eyebrow">FOLLOW THE MONEY</div><h3>Selected researched funder groups</h3><p class="sub">Reviewed groups on file, not a complete donor ranking. Each underlying filing keeps its own period.</p><div class="tablewrap"><table><thead><tr><th>Group</th><th class="r">PAC’s own contribution</th><th class="r">Routed individual gifts</th></tr></thead><tbody>${rows.map(f=>`<tr><td><a href="#${s.id}-funders">${esc(f.org)}</a></td><td class="r mono">${cash(f.pac||0)}</td><td class="r mono">${f.routed?cash(f.routed):'—'}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Routed gifts are already part of campaign receipts; never add them again. A dash means no routed amount is shown in these reviewed entries.</p><a href="#${s.id}-funders">Compare each group’s positions with their actions →</a></section>`;
}
function paneConnections(s,pane){
  pane.innerHTML=`${analysisBlock(s)}${s.office?'':`<details class="data-disclosure" open><summary>Funder positions & voting evidence</summary>${donorTreemapBlock(s)}${fundersBlock(s)}${moneyVotesBlock(s)}</details>`}<section id="live-records"></section>`;
  mountAnalysis(s);if(!s.office){mountFundTL(pane);mountTreemap(s);}hoverTips(pane);bindTips(pane);
  window.RecordLive.profile(s,pane.querySelector('#live-records'),['donorOrgs','outside-groups']);
}
function paneMoneyHistory(s,pane){
  pane.innerHTML=`<h2>History & source records</h2><p class="intro">Reporting periods and historical records, separate from the current campaign summary.</p>${s.office?'':`<section class="chart"><h3>Outside spending over time</h3>${miniOutside(s)}</section><details class="data-disclosure"><summary>Same-period combined view & reporting notes</summary>${combinedBlock(s)}${shareBlock(s)}</details>`}<section id="live-records"></section>`;
  window.RecordLive.profile(s,pane.querySelector('#live-records'),['campaign-history','donor-sizes','pac','outside']);bindTips(pane);
}
function paneFinance(s,pane){
  if(s.office)return paneFinanceOffice(s,pane);
  const c=s.camp, o=s.out;
  pane.innerHTML=`
  <h2>Money &amp; Influence</h2>
  <p class="intro">Where campaign receipts come from and what outside groups spend. Each keeps its own reporting period.</p>${points([['Campaign funds',`What ${esc(s.short)}'s own committee raised and reported to the FEC.`],['Outside spending','Money other groups spent on the race on their own. The campaign never receives it.']])}
  <nav class="jump small">${c.missing?'':'<a href="#f-map">Money map</a>'}<a href="#f-glance">Funding mix</a><a href="#f-pac">PAC contributions</a><a href="#f-out">Outside spending</a><a href="#f-items">Every filing</a></nav>
  ${moneyMapBlock(s,{bundled:DATA.bundled?.people?.[s.id],groups:Object.fromEntries((DATA.groupPos||[]).map(g=>[g.key,g.org])),categories:DATA.categories||{}})}
  <div id="f-glance">${ovMoney(s,true)}</div>
  <details class="data-disclosure"><summary>Selected researched funders</summary>${researchedFunders(s)}</details>
  <details class="data-disclosure"><summary>Campaign and outside-money comparison charts</summary><div id="f-sum">${fundingPanels(s)}</div>${scaleChart(s,false)}</details>
  <h2 id="f-camp" style="margin-top:28px">Campaign funds raised</h2>
  ${c.missing?`<div class="note"><b>No FEC financial report yet.</b> ${esc(c.note)} <a href="${fecCandUrl(s.fecCand)}" target="_blank" rel="noopener">FEC candidate page ↗</a></div>`:`
  <p class="small muted" style="margin:4px 0 0">${esc(c.cmte||'Campaign committee')} (${esc(c.cmteId)}) · FEC two-year summary, ${period(c.start,c.end)} · <a href="${esc(c.src)}" target="_blank" rel="noopener">source ↗</a></p>
  <details class="data-disclosure"><summary>Campaign totals & reporting details</summary>${tiles([
    ['Campaign funds raised',fmt$(c.receipts),period(c.start,c.end)],
    ['Small donors',fmt$(c.unitemized),c.unitemized==null?'not broken out':`${pct(c.unitemized,c.receipts)}% of campaign funds (gifts of $200 or less)`],
    [term('pac','From PACs'),fmt$(c.pac),`${pct(c.pac,c.receipts)}% of campaign funds`],
    ['Spent · cash on hand',c.disbursements==null?fmt$(c.cash):`${fmt$(c.disbursements)} · ${fmt$(c.cash)}`,`cash on ${fmtDate(c.end)}${c.debts?` · debts ${fmt$(c.debts)}`:''}`],
  ])}</details>
  ${c.selfShare>20?`<div class="note" style="margin-bottom:12px"><b>Mostly self-funded so far.</b> ${fmtFull(c.self)} (${c.selfShare}%) of ${esc(s.short)}'s campaign funds are the candidate's own loans or contributions${c.debts?`; the committee reports ${fmtFull(c.debts)} in debts`:''}.</div>`:''}
  ${c.itemized==null?'<p class="small muted" style="margin:8px 0 0">The itemized/unitemized split is not available for this committee.</p>':''}`}
  <h2 id="f-pac" style="margin-top:28px">${term('pac','PAC contributions to the campaign')}</h2>
  <p class="small muted" style="margin:4px 0 10px">Part of campaign funds raised. Each row is one contribution, as listed on FEC Schedule A, line 11C.</p>
  ${pacCoverage(s)}
  <details class="data-disclosure" data-chart-refresh><summary>PAC sectors and FEC types</summary>${pacSectors(s)}${pacKinds(s)}</details>
  <div id="pachost"></div>
  ${conduitBlock(s)}
  <h2 id="f-out" style="margin-top:28px">Outside spending (${term('ie','independent expenditures')})</h2>
  <p class="small" style="margin:4px 0 0;color:var(--ink-2);max-width:78ch">Spending by ${term('superpac','super PACs')}, other outside groups and party committees that support or oppose a candidate without working with the campaign.</p>
  <div style="margin:0 0 10px">${points([['Covers',`General-election spending only, ${period(o.start,o.end)}.`],['Source',`${esc(IE.source)} <a href="${fecIeUrl(s.fecCand)}" target="_blank" rel="noopener">FEC independent expenditures for ${esc(s.short)} ↗</a>`],o.excludedPre.n&&['Left out, filed late',`${fmtFull(o.excludedPre.amount)} in ${o.excludedPre.n} items dated before 2025. This is 2024-election spending.`],o.dupRemoved.n&&['Left out, filed twice',`${fmtFull(o.dupRemoved.amount)} in ${o.dupRemoved.n} items identical in every field, including the transaction ID. The latest filing is kept.`],o.uncertain&&['Marked',`${o.uncertain} items whose election type is unclear.`]],'small')}</div>
  ${o.incomplete.map(t=>`<div class="note" style="margin-bottom:10px"><b>Incomplete data:</b> ${esc(t)}</div>`).join('')}
  ${o.possibleRepeat?`<div class="note" style="margin-bottom:10px"><b>Possible repeats:</b> ${fmtFull(o.possibleRepeat)} of the totals above is in items that match another filing in every detail except the transaction ID. They may be the same spending reported twice, so the totals may be up to that much too high. They are marked "Possible repeat" in the item list.</div>`:''}
  ${o.pinned?`<p class="small muted" style="margin:0 0 10px"><b>Date capped:</b> ${o.pinned} items were filed ahead with a date of Sept. 30 or later. They are dated Sept. 30 here.</p>`:''}
  ${o.others.length?`<div class="note" style="margin-bottom:10px"><b>Spending on other candidates in this race:</b> listed separately, and not counted for or against ${esc(s.short)}. ${o.others.map(x=>`${esc(candName(x.cand))} (${x.O?fmtFull(x.O)+' opposing':''}${x.O&&x.S?', ':''}${x.S?fmtFull(x.S)+' supporting':''})`).join('; ')}.</div>`:''}
  ${o.multi&&o.rivals.length?`<div class="note" style="margin-bottom:10px"><b>Aimed at ${esc(s.short)}'s rivals (not credited to ${esc(s.short)}):</b> ${o.rivals.map(x=>`${esc(candName(x.cand))}: ${fmtFull(x.S)} supporting, ${fmtFull(x.O)} opposing`).join('; ')}.</div>`:''}
  <p class="small" style="margin:0 0 8px"><a href="#${s.id}-funders">How these groups' own published positions compare with ${esc(s.short)}'s votes →</a></p>
  ${outsideSectorBlock(s)}
  <h3 style="margin:14px 0 8px">By committee</h3>
  ${ieCommitteeTable(s)}
  <h3 id="f-items" style="margin:22px 0 8px">Every item</h3>
  <p class="small muted" style="margin:0 0 8px">Each outside-spending item as filed, with the date it went out and its FEC filing.</p>
  <div id="iehost"></div>
  <section id="live-records" style="margin-top:28px"></section>`;
  mountPacSectors(s);pacTable(s,$('#pachost'));
  ieItems(s,$('#iehost'));
  pane.querySelectorAll('[data-chart-refresh]').forEach(el=>el.addEventListener('toggle',()=>{if(el.open)mountPacSectors(s);}));hoverTips(pane);
  window.RecordLive.profile(s,$('#live-records'),['campaign','donor-sizes','pac','outside']);fillSizes(pane);
  pane.querySelectorAll('.jump a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const t=document.getElementById(a.getAttribute('href').slice(1));if(t)t.scrollIntoView({behavior:'smooth',block:'start'});}));
  bindTips(pane);
}

// Someone in office who is not on the 2026 ballot: no 2026 campaign or outside money, so the analysis and the refreshed
// FEC, lobbying and contract records for the committee that still files.
function paneFinanceOffice(s,pane){
  pane.innerHTML=`
  <h2>Money &amp; Influence</h2>
  <p class="intro">${esc(s.short)} is not on the 2026 ballot.</p>${points([['Not shown','2025–26 campaign totals and outside spending. There is no race to compare.'],['Still filing',`${esc(s.cmteName||'The 2024 committee')} (${esc(s.fecCmte)}) still files with the FEC. Its totals, PAC contributions and donors by employer are under Latest official records, from the daily refresh.`]])}
  <p class="small" style="margin:0 0 6px"><a href="${fecCandUrl(s.fecCand)}" target="_blank" rel="noopener">FEC candidate page ↗</a> · <a href="${fecCmteUrl(s.fecCmte)}" target="_blank" rel="noopener">FEC committee page ↗</a></p>
  <p><a href="#${s.id}-connections">Open funder connections and analysis →</a></p>
  <section id="live-records" style="margin-top:28px"></section>`;
  hoverTips(pane);
  window.RecordLive.profile(s,$('#live-records'),['campaign','campaign-history','donor-sizes','pac','outside','donorOrgs','outside-groups']);
  bindTips(pane);
}

// ---------- records (stage 5): congressional, state legislative and other records kept in separate, labeled sections ----------
const realVotes=(s,V)=>V.filter(v=>s.id in v.pos&&!/not in office/i.test(v.pos[s.id]));
function evidenceOf(s){
  const sv=realVotes(s,DATA.votes).length, hv=realVotes(s,DATA.hvotes).length, st=s.stateRecord?s.stateRecord.items.length:0;
  let kind,label;
  if(!s.cand||s.recordType==='senator'||s.ideoKind==='house'){
    const ch=(!s.cand&&s.chamber==='H')||s.ideoKind==='house'?'House':'Senate', n=ch==='House'?hv:sv;
    kind='us';label=`U.S. ${ch} votes (${n} key roll calls) and a career ideology score`;
  } else if(s.recordType==='former_member_of_congress'){kind='former';label=`Former member of Congress: ${s.record.length} documented votes or bills${sv?`, plus ${sv} key Senate roll calls`:''}`;}
  else if(s.recordType==='state_legislator'){kind='state';label=`State legislature: ${s.record.length} documented votes or bills`;}
  else if(s.recordType==='executive'){kind='exec';label=`Executive office: ${s.record.length} official actions (no legislative votes in that office)`;}
  else {kind='none';label=`No voting record: ${s.record.length} documented public actions`;}
  if(st&&s.recordType!=='state_legislator')label+=`; earlier state legislative service: ${st} documented item${st===1?'':'s'}`;
  else if(s.stateRecord&&!st&&s.recordType!=='state_legislator')label+='; earlier state legislative service (no votes could be sourced)';
  return {kind,label};
}
function evidenceNote(list){
  const k=[...new Set(list.map(s=>evidenceOf(s).kind))];
  if(k.length<2)return '';
  const N={us:'U.S. congressional votes',former:'a past congressional record',state:'state legislative votes',exec:'official actions in executive office',none:'documented public actions without a voting record'};
  return `Different kinds of evidence. ${list.map(s=>`${esc(s.short)}'s record is ${N[evidenceOf(s).kind]}`).join('; ')}. These records can't be compared directly, and fewer items doesn't mean a better or worse record.`;
}
function senateVoteList(s){
  const V=DATA.votes.filter(v=>s.id in v.pos);
  const n=realVotes(s,DATA.votes).length;
  if(!n)return '';
  return `<h3 style="margin-top:26px">Key U.S. Senate votes</h3><p class="small muted" style="margin:4px 0 8px">The same ${V.length} roll calls shown for the other senators, each linked to the official tally. ${esc(s.short)} cast ${n} of them${V.length>n?`; "Not in office" marks votes cast when ${esc(s.short)} was not a senator`:''}.</p>
  <div>${V.slice().sort((x,y)=>y.date.localeCompare(x.date)).map(v=>{const p=v.pos[s.id]||'—';return `<div class="vote"><div class="d">${v.date}</div><div><div class="t"><a href="${voteUrl(v)}" target="_blank" rel="noopener">${esc(v.short)}</a></div><div class="s">${esc(v.issue)} · ${esc(v.result)}</div><div class="s muted">${esc(v.area)}</div></div><div class="pos"><span class="chip ${posClass(p)}">${esc(p)}</span></div></div>`}).join('')}</div>`;
}
function stateRecordBlock(s){
  const r=s.stateRecord;
  if(!r){
    if(s.recordType==='state_legislator')return '';
    return '';
  }
  const kindN={vote:'Recorded vote',authored:'Bill authored',sponsored:'Bill sponsored',cosponsored:'Co-sponsored',leadership:'Leadership post'};
  return `<section class="recsec state">
    <div class="kicker">State legislative record · not a congressional record</div>
    <h3 style="margin-top:4px">State legislative record</h3>
    <ul class="list small" style="margin:6px 0 10px">${r.service.map(x=>`<li><b>${esc(x.chamber)}</b>${x.district?`, District ${esc(x.district)}`:''}, ${esc(x.start)}–${esc(x.end)}${x.roles?` (${esc(x.roles)})`:''} ${x.src?`<a href="${esc(x.src.u)}" target="_blank" rel="noopener">source ↗</a>`:''}</li>`).join('')}</ul>
    ${r.stateIdeology?`<p class="small" style="margin:0 0 10px"><b>Published ranking:</b> ${esc(r.stateIdeology.text)} <a href="${esc(r.stateIdeology.src.u)}" target="_blank" rel="noopener">${esc(r.stateIdeology.src.t)} ↗</a> <span class="muted">(state-legislature ranking; not comparable with congressional scores)</span></p>`:''}
    ${r.items.length?r.items.map(it=>`<div class="vote"><div class="d">${esc(it.date||'')}</div><div><div class="t">${esc(it.title)}</div><div class="s">${esc(it.summary||'')}</div>${it.result?`<div class="s"><b>Result:</b> ${esc(it.result)}</div>`:''}<div class="s muted">${esc(kindN[it.kind]||it.kind)}${it.session?' · '+esc(it.session):''} · ${esc(it.area||'')}${it.areaWhy?` <span class="term" tabindex="0" data-tip="Why this policy area: ${esc(it.areaWhy)}">why this area?</span>`:''}${it.src?` · <a href="${esc(it.src.u)}" target="_blank" rel="noopener">${esc(it.src.t)} ↗</a>`:''}</div></div><div class="pos"><span class="chip ${posClass(it.position)}">${esc(it.position||'')}</span></div></div>`).join(''):`<div class="note">No recorded votes or bills from this service could be sourced for this release.</div>`}
    ${r.searched?`<p class="small muted" style="margin-top:8px"><b>What was searched:</b> ${esc(r.searched)}</p>`:''}
  </section>`;
}
function recordHeading(s){
  return {state_legislator:'State legislative record',executive:'Record in executive office',member_of_congress:'Bills sponsored in Congress',senator:'Bills sponsored in the Senate',former_member_of_congress:'Record in Congress',none:'Other documented record (no voting record)'}[s.recordType]||'Documented record';
}
function recordKicker(s){
  return {state_legislator:'State legislative record · not a congressional record',executive:'Executive or appointed office · not a voting record',member_of_congress:'Congressional record',senator:'Congressional record',former_member_of_congress:'Congressional record (past service)',none:'Documented actions and commitments · no voting record'}[s.recordType]||'';
}
// ---------- voter alignment (stage 7): a comparison with the viewer's own choices, never a quality rating ----------
const ISS=DATA.issues, ISSBY=Object.fromEntries(ISS.map(i=>[i.id,i]));
const RECT=ACTION_TYPES;
const TYPEL=DATA.typeLabel;
const WLAB={1:'Low',2:'Medium',3:'High'};
const ALKEY='crc-align-v1';
let PROF=(()=>{try{const v=JSON.parse(localStorage.getItem(ALKEY)||'null');if(v&&v.issues)return v}catch(e){}return {issues:{}}})();
function saveProf(){try{localStorage.setItem(ALKEY,JSON.stringify(PROF))}catch(e){}}
const chosenIssues=()=>ISS.filter(i=>PROF.issues[i.id]&&PROF.issues[i.id].side&&PROF.issues[i.id].w>0);
// Example starting points: labeled by their content only. Every choice can be changed.
const EXAMPLES=[
  {name:'Health coverage, abortion access, climate',set:{health:['A',3],abortion:['A',3],climate:['A',2],labor:['A',1],tariffs:['B',1]}},
  {name:'Lower taxes, immigration enforcement, gun rights',set:{taxes:['B',3],immigration:['A',3],guns:['B',2],voting:['A',2],vouchers:['A',1]}},
  {name:'Ukraine aid, war-powers limits, ending Canada tariffs',set:{ukraine:['A',3],warpowers:['A',2],tariffs:['B',2],jan6:['A',1],infra:['A',1]}},
];
function scoreFor(s){
  const ch=chosenIssues();
  const r=matchScore(ch.map(i=>({id:i.id,side:PROF.issues[i.id].side,w:PROF.issues[i.id].w})),s.evidence);
  r.rows.forEach((x,k)=>{x.i=ch[k];x.pr=PROF.issues[ch[k].id];});
  return r;
}
function scoreBadge(r){
  if(!r.nChosen)return '<span class="muted">Set your priorities</span>';
  if(r.score==null)return `<span class="chip ghost" data-tip="Evidence covers ${r.nCov} of your ${r.nChosen} issues (${Math.round(r.covW/r.totW*100)||0}% of your weight). A score needs at least ${r.need} issues and half your weight.">Insufficient data</span>`;
  return `<span class="alscore"><b>${r.score}%</b> match</span>`;
}
function evidenceMix(s){
  const c={};Object.values(s.evidence||{}).flat().forEach(e=>{const k=RECT.has(e.type)?(e.type==='senate_vote'||e.type==='house_vote'||e.type==='vote'?'votes':e.type==='state_vote'?'state votes':e.type==='sponsored'?'bills sponsored':e.type==='cosponsored'?'bills cosponsored':'official actions'):'statements';c[k]=(c[k]||0)+1});
  return Object.entries(c).map(([k,n])=>`${n} ${k}`).join(', ')||'no coded evidence';
}
function sideLabel(i,side){return side==='A'?ISSBY[i].A:ISSBY[i].B}
function builderHTML(){
  return `<div class="albuild">
    <div class="row" style="margin-bottom:10px"><span class="small muted">Start from an example (you can change every choice):</span>${EXAMPLES.map((x,k)=>`<button class="pill" data-ex="${k}">${esc(x.name)}</button>`).join('')}<button class="pill ghostb" data-ex="clear">Clear all</button></div>
    ${ISS.map(i=>{const pr=PROF.issues[i.id]||{};return `<div class="alrow" data-i="${i.id}">
      <div class="alq"><b>${esc(i.label)}</b><small>${esc(i.q)}</small></div>
      <div class="seg alside" role="group" aria-label="${esc(i.label)}: your position"><button data-s="A" class="${pr.side==='A'?'active':''}">${esc(i.A)}</button><button data-s="B" class="${pr.side==='B'?'active':''}">${esc(i.B)}</button><button data-s="" class="${!pr.side?'active':''}">Skip</button></div>
      <label class="alw small">Importance <select data-w aria-label="${esc(i.label)}: importance">${[1,2,3].map(w=>`<option value="${w}" ${(pr.w||2)===w?'selected':''}>${WLAB[w]}</option>`).join('')}</select></label>
    </div>`}).join('')}
  </div>`;
}
function bindBuilder(root,onChange){
  root.querySelectorAll('.alrow').forEach(r=>{
    const id=r.dataset.i;
    r.querySelector('.alside').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const w=+r.querySelector('select').value;if(b.dataset.s)PROF.issues[id]={side:b.dataset.s,w};else delete PROF.issues[id];r.querySelectorAll('.alside button').forEach(x=>x.classList.toggle('active',x===b));saveProf();onChange();});
    r.querySelector('select').addEventListener('change',e=>{if(PROF.issues[id]){PROF.issues[id].w=+e.target.value;saveProf();onChange();}});
  });
  root.querySelectorAll('[data-ex]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.ex;PROF={issues:{}};if(k!=='clear')Object.entries(EXAMPLES[+k].set).forEach(([i,[s,w]])=>PROF.issues[i]={side:s,w});saveProf();onChange(true);}));
}
const ALNOTE=`<div class="note small" style="margin:10px 0">${points([['What this is','A comparison between the positions <i>you</i> pick and each candidate\'s documented record.'],['What it is not','A rating of how good a candidate is. It covers only issues with documented evidence.'],['Evidence used','Recorded votes, bills and official acts come first. Stated positions are used only for an issue with no recorded action, and they are labeled.'],['When a score shows','Evidence must cover at least three of your issues and half of your total importance. Otherwise you see "Insufficient data", never a zero.']])}<p style="margin:6px 0 0"><a href="#method">How it is calculated</a></p></div>`;
// ---------- My alignment: a five-point quiz over the issue list. Each answer is saved as a side and an importance:
// strongly agree/disagree = importance 3, agree/disagree = 2, neutral = answered but not counted. ----------
const AL_GROUPS=[['econ','Economy & health','$'],['rights','Rights & social','♥'],['imm','Immigration & elections','⛨'],['foreign','Foreign policy','◍'],['env','Environment','❦'],['gov','Ethics & money in politics','⚖']];
const AL_GBY=Object.fromEntries(AL_GROUPS.map(g=>[g[0],g]));
// mixed order for "All questions": one from each category in turn
const AL_ORDER=(()=>{const by=AL_GROUPS.map(([g])=>ISS.filter(i=>i.group===g)),out=[];for(let k=0;out.length<ISS.length&&k<ISS.length;k++)by.forEach(l=>{if(l[k])out.push(l[k])});ISS.forEach(i=>{if(!out.includes(i))out.push(i)});return out})();
const AL_OPTS=[['B',3,'Strongly disagree'],['B',2,'Disagree'],['',0,'Neutral'],['A',2,'Agree'],['A',3,'Strongly agree']];
const AL_PAGE=5;
let alView={g:'',page:0};
const alPick=id=>{const p=PROF.issues[id];if(!p)return -1;if(p.neutral)return 2;if(p.side==='B')return p.w>=3?0:1;if(p.side==='A')return p.w>=3?4:3;return -1};
const alAnswered=()=>ISS.filter(i=>alPick(i.id)>=0).length;
const AL_VOTES=Object.fromEntries(ISS.map(i=>[i.id,DATA.votes.map(v=>['Senate',v]).concat(DATA.hvotes.map(v=>['House',v])).filter(([,v])=>(v.codes||[]).some(c=>c.issue===i.id)).sort((a,b)=>b[1].date.localeCompare(a[1].date))]));
function alTied(i){
  const V=AL_VOTES[i.id];
  if(!V.length)return 'No key congressional vote on this yet; compared with state records, official actions and statements where they exist.';
  return 'Compared with: '+V.slice(0,2).map(([c,v])=>`${esc(v.short)} (${c}, ${v.date.slice(0,4)})`).join(' · ')+(V.length>2?` · ${V.length-2} more`:'');
}
function alCard(i){
  const [g,label,icon]=AL_GBY[i.group]||['econ','Other','•'], n=AL_ORDER.indexOf(i)+1, k=alPick(i.id);
  return `<article class="al-q" data-i="${i.id}"><div class="al-qh"><span class="al-ic al-${g}" aria-hidden="true">${icon}</span><span class="al-tag al-${g}">${label}</span><span class="al-qn">Question ${n} of ${ISS.length}</span></div>
    <h3 id="alq-${i.id}">${esc(i.statement||i.A)}</h3><p class="al-tied">${alTied(i)}</p>
    <div class="al-opts" role="radiogroup" aria-labelledby="alq-${i.id}">${AL_OPTS.map((o,j)=>`<button type="button" role="radio" aria-checked="${k===j}" data-k="${j}" class="${k===j?'on':''}"><span class="al-r" aria-hidden="true"></span>${o[2]}</button>`).join('')}</div></article>`;
}
function alList(){return alView.g?AL_ORDER.filter(i=>i.group===alView.g):AL_ORDER.slice(alView.page*AL_PAGE,alView.page*AL_PAGE+AL_PAGE);}
// "Your matches so far": the closest records to your answers, or flipped to the furthest ("mismatches").
let alLiveMode='match', alLiveCh='';
function alLive(){
  const mis=alLiveMode==='mismatch', chName={S:'Senate',H:'House'}[alLiveCh]||'', title=`Your ${chName?chName+' ':''}${mis?'mismatches':'matches'} so far`;
  const sw=`<div class="seg al-seg" role="group" aria-label="Show matches or mismatches"><button type="button" data-m="match" class="${mis?'':'active'}" aria-pressed="${!mis}">Top matches</button><button type="button" data-m="mismatch" class="${mis?'active':''}" aria-pressed="${mis}">Top mismatches</button></div>`;
  const sw2=`<div class="seg al-seg" role="group" aria-label="Which races">${[['','All'],['S','Senate'],['H','House']].map(([c,l])=>`<button type="button" data-c="${c}" class="${alLiveCh===c?'active':''}" aria-pressed="${alLiveCh===c}">${l}</button>`).join('')}</div>`;
  const counted=chosenIssues().length;
  if(!counted)return `<h4>${title}</h4>${sw}${sw2}<p class="small muted" style="margin:0">Answer a few questions${alAnswered()?' (Neutral answers are not counted)':''} to see how every candidate compares.</p>`;
  const rows=ALL.filter(s=>!alLiveCh||s.chamber===alLiveCh).map(s=>({s,r:scoreFor(s)})), graded=rows.filter(x=>x.r.score!=null);
  // matches are records at 50% or more of your answers, mismatches below 50%, so neither list borrows from the other
  const pool=graded.filter(x=>mis?x.r.score<50:x.r.score>=50).sort((a,b)=>(mis?a.r.score-b.r.score:b.r.score-a.r.score)||a.s.name.localeCompare(b.s.name));
  const list=pool.slice(0,6).map(({s,r})=>{const L=letter(r.score);return `<a class="al-lr" href="#${s.id}-match"><span class="chip ${s.party}">${s.party}</span><span class="al-ln">${esc(s.name)}<small>${esc(seatLabel(s))} ${s.chamber==='S'?'Senate':'House'}</small></span><b class="gr-${L}">${L}</b><span class="al-lp">${r.score}%</span></a>`}).join('');
  const where=chName?` in ${chName} races`:'';
  const empty=!graded.length?`No one${where} has enough evidence on your issues yet.`:mis?`No one${where} is below 50% on your answers yet.`:`No one${where} reaches 50% on your answers yet.`;
  return `<h4>${title}</h4>${sw}${sw2}${list||`<p class="small muted" style="margin:0">${empty}</p>`}
    <p class="al-foot">${pool.length?`${mis?'Lowest':'Top'} ${Math.min(6,pool.length)} of ${pool.length} ${mis?'below 50%, furthest from your answers first':'at 50% or more'} · `:''}${graded.length} graded${where}, ${rows.length-graded.length} not graded yet.${chName?` ${chName} races include challengers${DATA.races.some(r=>r.chamber===alLiveCh&&r.open)?' and nominees for open seats':''}.`:''} Based on your ${counted} answer${counted===1?'':'s'} that ${counted===1?"isn't":"aren't"} Neutral. A grade needs evidence on 3 of your issues. <button type="button" class="al-link" id="al-all">See every candidate ↓</button></p>`;
}
function alResults(){
  const ch=chosenIssues();
  if(!ch.length)return '<div class="note">Answer at least one question (other than Neutral) to see how every candidate compares, race by race.</div>';
  return `<p class="small muted" style="margin:0 0 6px">Results for ${ch.length} issue${ch.length===1?'':'s'}. Open a candidate for the issue-by-issue breakdown and every piece of evidence.</p>`+DATA.races.map(r=>{const C=r.keys.map(k=>byId[k]);return `<article class="race"><div class="rh"><h3>${esc(r.label)}</h3><span class="small muted">${r.open?'Open seat':DATA.election?'Incumbent ran':'Incumbent running'}</span></div>
    <div class="tablewrap"><table><thead><tr><th>Candidate</th><th>Compared with your choices</th><th>Evidence used</th></tr></thead><tbody>${C.map(s=>{const sc=scoreFor(s);return `<tr><td><a href="#${s.id}-match"><b>${esc(s.name)}</b></a> <span class="chip ${s.party}">${s.party}</span> ${decidedChip(outcomeOf(r,s.id))}</td><td>${sc.score==null?scoreBadge(sc):`<span class="alscore"><b class="gr-${letter(sc.score)}">${letter(sc.score)}</b> <b>${sc.score}%</b> match</span>`}<div class="small muted">${sc.nCov} of ${sc.nChosen} of your issues have evidence</div></td><td class="small">${esc(evidenceOf(s).label)}<div class="muted">${esc(evidenceMix(s))}</div></td></tr>`}).join('')}</tbody></table></div>
    ${evidenceNote(C)?`<p class="small" style="margin:6px 0 0;color:var(--ink-2)"><b>Comparing records:</b> ${evidenceNote(C)}</p>`:''}</article>`}).join('');
}
function renderAlign(){
  const pages=Math.ceil(ISS.length/AL_PAGE);
  app.innerHTML=`
  <section class="al-hero">
    <svg class="al-dome" width="300" height="172" viewBox="0 0 330 190" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M165 10v22M158 32h14M150 60c0-14 7-26 15-28 8 2 15 14 15 28"/><path d="M118 96c0-24 21-40 47-40s47 16 47 40"/><path d="M108 96h114v10H108zM112 106v34M124 106v34M136 106v34M148 106v34M160 106v34M172 106v34M184 106v34M196 106v34M208 106v34M218 106v34"/><path d="M30 140h270v10H30zM40 150v30M290 150v30M30 180h270"/><path d="M60 150v30M80 150v30M100 150v30M230 150v30M250 150v30M270 150v30"/><path d="M95 140V122h140v18"/></svg>
    <h1>My <em>alignment</em></h1>
    <p class="al-lede">Say how strongly you agree or disagree with each statement. There are no right or wrong answers. Your answers are compared with every candidate's real votes, bills and statements, issue by issue.</p>
    <div class="al-feats">
      <div><span class="al-fi" aria-hidden="true">▤</span><div><b>${ISS.length} issues, tied to real votes</b><small>Each question lists the roll calls behind it</small></div></div>
      <div><span class="al-fi" aria-hidden="true">🔒</span><div><b>Your answers stay with you</b><small>Saved only in this browser</small></div></div>
      <div><span class="al-fi" aria-hidden="true">⚖</span><div><b>Not a rating of candidates</b><small>Same questions and rules for everyone</small></div></div>
    </div>
  </section>
  <div class="al-wrap">
    <nav class="al-cats" id="al-cats" aria-label="Question categories"></nav>
    <div class="al-main">
      <div class="al-top"><b id="al-pos"></b><span id="al-pct"></span></div>
      <div class="al-prog" aria-hidden="true"><i id="al-bar"></i></div>
      <div id="al-qs"></div>
      <div class="al-nav"><button type="button" class="al-btn" id="al-prev">← Previous</button><span class="small muted">Answer as many as you like; results update as you go</span><button type="button" class="al-btn p" id="al-next">Next →</button></div>
      <div class="al-ex"><span class="small muted">Or start from an example (you can change every answer):</span>${EXAMPLES.map((x,k)=>`<button class="pill" data-ex="${k}">${esc(x.name)}</button>`).join('')}<button class="pill ghostb" data-ex="clear">Clear all</button></div>
    </div>
    <aside class="al-box al-live" id="al-live" aria-live="polite"></aside>
    <aside class="al-box al-keep"><h4>💡 Keep in mind</h4>${points([['Strongly','Counts three times as much as a plain agree or disagree.'],['Neutral','Skips the issue. It never counts against anyone.'],['A match','Compares a record with your views. It is not a rating of the candidate.']])}</aside>
  </div>
  <section class="section" id="al-results" style="padding-top:8px"><h2>Every candidate, race by race</h2>${ALNOTE}<div id="alr"></div></section>`;
  const drawCats=()=>{$('#al-cats').innerHTML=[['','All questions','☰',ISS.length]].concat(AL_GROUPS.map(([g,l,ic])=>[g,l,ic,ISS.filter(i=>i.group===g).length])).map(([g,l,ic,n])=>{const done=(g?ISS.filter(i=>i.group===g):ISS).filter(i=>alPick(i.id)>=0).length;return `<button type="button" class="al-cat${alView.g===g?' on':''}" data-g="${g}" aria-pressed="${alView.g===g}"><span class="al-ic${g?' al-'+g:''}" aria-hidden="true">${ic}</span><span class="al-cl">${l}</span><span class="al-cn" title="${done} of ${n} answered">${n}</span></button>`}).join('');};
  const drawTop=()=>{const L=alList(),a=alAnswered();
    $('#al-pos').textContent=alView.g?`${AL_GBY[alView.g][1]} · ${L.length} question${L.length===1?'':'s'}`:`Questions ${alView.page*AL_PAGE+1}–${alView.page*AL_PAGE+L.length} of ${ISS.length}`;
    $('#al-pct').textContent=`${a} of ${ISS.length} answered · ${Math.round(a/ISS.length*100)}% complete`;
    $('#al-bar').style.width=(a/ISS.length*100)+'%';
    const gi=AL_GROUPS.findIndex(g=>g[0]===alView.g);
    $('#al-prev').disabled=alView.g?false:alView.page===0;
    $('#al-next').textContent=alView.g?(gi<AL_GROUPS.length-1?`Next: ${AL_GROUPS[gi+1][1]} →`:'See my results ↓'):(alView.page<pages-1?'Next →':'See my results ↓');};
  const drawQs=()=>{$('#al-qs').innerHTML=alList().map(alCard).join('');};
  const drawBox=focus=>{$('#al-live').innerHTML=alLive();const b=$('#al-all');if(b)b.addEventListener('click',()=>$('#al-results').scrollIntoView({behavior:'smooth'}));if(focus){const f=$(`#al-live ${focus}`);if(f)f.focus();}};
  const drawLive=()=>{drawBox();$('#alr').innerHTML=alResults();bindTips(app);};
  $('#al-live').addEventListener('click',e=>{const m=e.target.closest('button[data-m]'),c=e.target.closest('button[data-c]');
    if(m&&m.dataset.m!==alLiveMode){alLiveMode=m.dataset.m;drawBox(`[data-m="${alLiveMode}"]`);}
    else if(c&&c.dataset.c!==alLiveCh){alLiveCh=c.dataset.c;drawBox(`[data-c="${alLiveCh}"]`);}});
  const all=()=>{drawCats();drawTop();drawQs();drawLive();};
  $('#al-qs').addEventListener('click',e=>{
    const b=e.target.closest('button[data-k]');if(!b)return;
    const id=b.closest('.al-q').dataset.i, k=+b.dataset.k, was=alPick(id);
    if(was===k)delete PROF.issues[id];
    else{const [side,w]=AL_OPTS[k];PROF.issues[id]=side?{side,w}:{side:'',w:0,neutral:true};}
    saveProf();
    b.closest('.al-opts').querySelectorAll('button').forEach(x=>{const on=+x.dataset.k===alPick(id);x.classList.toggle('on',on);x.setAttribute('aria-checked',on);});
    drawCats();drawTop();drawLive();
  });
  $('#al-cats').addEventListener('click',e=>{const b=e.target.closest('button[data-g]');if(!b)return;alView={g:b.dataset.g,page:0};all();});
  const go=d=>{
    if(alView.g){const gi=AL_GROUPS.findIndex(g=>g[0]===alView.g)+d;if(gi<0){alView={g:'',page:0};}else if(gi>=AL_GROUPS.length){$('#al-results').scrollIntoView({behavior:'smooth'});return}else alView.g=AL_GROUPS[gi][0];}
    else{const p=alView.page+d;if(p>=pages){$('#al-results').scrollIntoView({behavior:'smooth'});return}alView.page=Math.max(0,p);}
    all();$('.al-main').scrollIntoView({behavior:'smooth',block:'start'});
  };
  $('#al-prev').addEventListener('click',()=>go(-1));
  $('#al-next').addEventListener('click',()=>go(1));
  app.querySelectorAll('[data-ex]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.ex;PROF={issues:{}};if(k!=='clear')Object.entries(EXAMPLES[+k].set).forEach(([i,[s,w]])=>PROF.issues[i]={side:s,w});saveProf();all();}));
  all();
}
function evRow(e,want){
  const m=want?(e.side===want):null;
  return `<li class="evi"><span class="mk ${m===null?'':m?'yes':'no'}" aria-label="${m===null?'':m?'matches your choice':'differs from your choice'}">${m===null?'·':m?'✓':'✕'}</span>
    <div><div><span class="chip ghost">${esc(TYPEL[e.type]||e.type)}</span> <b>${esc(e.title)}</b> <span class="mono muted">${esc(e.date||'date not given')}</span></div>
    <div class="small">${e.pos?`<b>Position:</b> ${esc(e.pos)} → `:''}counts toward "${esc(sideLabel(e.issue||'',e.side))}"</div>
    <div class="small muted">${e.yea?`<b>What the measure does:</b> ${esc(e.why)} A Yea counts toward "${esc(sideLabel(e.issue,e.yea))}".`:`<b>Why:</b> ${esc(e.why)}`} ${e.src&&e.src.u?`<a href="${esc(e.src.u)}" target="_blank" rel="noopener">${esc(e.src.t||'source')} ↗</a>`:''}</div></div></li>`;
}
// ---------- Your match: personalized evidence and ideology; raw records live on Legislative Activity ----------
function paneMatch(s,pane){
  pane.innerHTML=`<div id="m-al"></div><section class="recsec" id="m-context"><h2>Where the record sits</h2><p class="intro">Career ideology and issue positions provide context for your match. The complete vote and bill lists now have their own home in <a href="#${s.id}-legislation">Legislative Activity</a>.</p><div id="rec-ideo">${ideoBlock(s,'ideo2')}<div class="chart">${kvBlock(s,'kv2',true)}</div></div>${positionBlock(s)}</section>`;
  alignInto(s,pane.querySelector('#m-al'));
  mountIdeo('ideo2',s);mountKV('kv2',s);bindTips(pane);
}
function paneLegislation(s,pane){
  pane.innerHTML=`<div class="page-eyebrow">BILLS, VOTES & OFFICIAL ACTIONS</div><h2>Legislative Activity</h2><p class="intro">What ${esc(s.short)} sponsored, cosponsored and voted on. Reviewed research and newly refreshed official records are labeled separately.</p>${sectionNav([['leg-sponsored','Sponsored bills'],['leg-cosponsored','Cosponsored legislation'],['m-record','Votes & official actions'],['live-records','Latest records']])}<div id="legislation-lists"></div><div id="legislation-record"></div>`;
  mountLegislation(pane.querySelector('#legislation-lists'),{person:s,data:DATA,recordLive:window.RecordLive});
  recordInto(s,pane.querySelector('#legislation-record'));
}
function alignInto(s,host){
  const draw=()=>{
    const r=scoreFor(s);
    const ev=s.evidence||{};
    const all=ISS.filter(i=>(ev[i.id]||[]).length);
    const md=!r.nChosen?'You have not chosen any positions yet.':r.score==null?`Evidence on ${r.nCov} of your ${r.nChosen} issues, too few for a grade.`:`Based on ${r.nCov} of your ${r.nChosen} issues.`;
    host.innerHTML=`${gradeHead('Your match',r.score,md,gradeRule('match'))}
    <p class="intro">How ${esc(s.short)}'s record compares with the positions you pick below. <b>Evidence available:</b> ${esc(evidenceOf(s).label)}.</p>
    ${ALNOTE}
    <div class="chart"><div class="kicker">How the match is calculated</div>
      ${r.nChosen?(r.score==null?points([['Evidence found',`${r.nCov} of your ${r.nChosen} issues (${Math.round(r.covW/r.totW*100)||0}% of your total importance).`],['Needed for a score',`At least ${r.need} issue${r.need===1?'':'s'} with evidence, and at least half of your total importance.`]],'small'):points([['How it works',`For each issue, the share of ${esc(s.short)}'s items that match your side, times the issue's importance. An issue backed only by statements counts at half its importance.`],['The math',`${r.rows.filter(x=>x.status!=='none').map(x=>`${esc(x.i.label)} ${x.match}/${x.n} × ${+x.iw.toFixed(2)}${x.status==='stated'?' (statements only)':''}`).join(' + ')} = ${(r.num).toFixed(2)}. Divided by the importance counted, ${+r.effW.toFixed(2)}, that gives <b>${r.score}%</b>.`],['Counted once','A sponsorship and a vote on the same bill.'],r.nChosen>r.nCov&&['Left out',`${r.nChosen-r.nCov} issue${r.nChosen-r.nCov===1?'':'s'} without evidence. They are not scored as zero.`]],'small')):`<p class="small" style="margin:6px 0 0">Choose positions below, or on the <a href="#align">My alignment</a> page.</p>`}
    </div>
    ${r.nChosen?`<h3 style="margin-top:18px">Issue by issue</h3>${r.rows.map(x=>`<div class="alissue">
      <div class="row" style="justify-content:space-between"><div><b>${esc(x.i.label)}</b> <span class="small muted">· you: ${esc(sideLabel(x.i.id,x.pr.side))} · importance ${WLAB[x.pr.w]}</span></div>
      <div>${x.status==='none'?'<span class="chip ghost">Insufficient data</span>':`<span class="chip ${x.agree>=.5?'dfor':'dag'}">${x.match} of ${x.n} ${x.status==='record'?'recorded actions':'statements'} match</span>`}</div></div>
      ${x.status==='stated'?'<p class="small" style="margin:4px 0 0;color:var(--warn)"><b>Statements only:</b> no recorded vote, bill or official action on this issue. It counts at half its importance.</p>':''}
      ${x.status==='record'&&x.st.length?`<p class="small muted" style="margin:4px 0 0"><b>Stated positions:</b> ${x.stMatch} of ${x.st.length} match. Shown but not scored, because recorded actions exist.</p>`:''}
      ${(x.rec.concat(x.st)).length?`<ul class="evl">${x.rec.concat(x.st).map(e=>evRow(Object.assign({issue:x.i.id},e),x.pr.side)).join('')}</ul>`:`<p class="small muted" style="margin:4px 0 0">No vote, bill, official action or statement on this issue was found for ${esc(s.short)}.${(s.notVoted||{})[x.i.id]?' <b>Did not vote on:</b> '+s.notVoted[x.i.id].map(n=>esc(n.title)).join('; ')+'.':''}</p>`}
    </div>`).join('')}`:''}
    <details class="tv" ${r.nChosen?'':'open'}><summary>${r.nChosen?'Change your choices':'Choose your positions'}</summary><div id="alb2" style="margin-top:10px">${builderHTML()}</div></details>
    ${all.length?`<h3 style="margin-top:22px">All coded evidence for ${esc(s.short)}</h3><p class="small muted">Every item used for the match, by issue. Shown whatever you picked.</p>${all.map(i=>`<div class="alissue"><b>${esc(i.label)}</b><ul class="evl">${ev[i.id].map(e=>evRow(Object.assign({issue:i.id},e),null)).join('')}</ul></div>`).join('')}`:`<div class="note" style="margin-top:16px">No action or statement by ${esc(s.short)} fits the issue list, so there is nothing to compare. ${s.recordType==='none'||s.recordType==='executive'?esc(s.short)+' has no legislative voting record.':''}</div>`}`;
    bindBuilder(host.querySelector('#alb2'),rebuild=>{draw();});
    bindTips(host);
  };
  draw();
}

// ---------- legislative record tab (votes with bill details, state record, other record, money & votes, ethics) ----------
function billDetails(v){
  const b=v.bill||{};
  const codes=(v.codes||[]).map(c=>`<li><b>${esc(ISSBY[c.issue].label)}</b>: a Yea counts toward "${esc(sideLabel(c.issue,c.yea))}". ${esc(c.why)}</li>`).join('');
  return `<details class="bd"><summary>Bill details and why it is filed under this issue</summary>
    <dl class="kvd small">
      <dt>Measure</dt><dd>${esc(b.measure||'')}${b.popularTitle?` (${esc(b.popularTitle)})`:''}</dd>
      ${b.officialTitle?`<dt>Official title</dt><dd>${esc(b.officialTitle)}</dd>`:''}
      ${b.introduced?`<dt>Introduced</dt><dd>${fmtDate(b.introduced)}</dd>`:''}
      <dt>What it does</dt><dd>${esc(b.summary||'')} ${b.summarySrc?`<a href="${esc(b.summarySrc.u)}" target="_blank" rel="noopener">${esc(b.summarySrc.t)} ↗</a>`:''}</dd>
      ${(b.provisions||[]).length?`<dt>Key provisions</dt><dd><ul class="list">${b.provisions.map(p=>`<li>${esc(p.fact)} <a href="${esc(p.src.u)}" target="_blank" rel="noopener">source ↗</a></li>`).join('')}</ul></dd>`:''}
      <dt>Recorded vote</dt><dd>${fmtDate(v.date)} · ${esc(b.voteQuestion||v.question)} · ${esc(v.result)} · <a href="${voteUrl(v)}" target="_blank" rel="noopener">official tally ↗</a></dd>
      <dt>Policy area</dt><dd>${esc(v.area)}</dd>
      <dt>Alignment issue</dt><dd>${codes?`<ul class="list">${codes}</ul>`:`Not used for voter alignment: ${esc(v.excluded||'')}`}</dd>
    </dl></details>`;
}
function keyVotesBlock(s,V,label,id){
  if(!V.length)return '';
  const areas=[...new Set(V.map(v=>v.area))].sort();
  const html=`<section class="recsec" id="${id}"><div class="kicker">Congressional record</div><h3 style="margin-top:4px">${esc(label)}</h3>
    <p class="small muted" style="margin:4px 0 8px">${V.length} important roll-call votes picked by this app, newest first. Open "Bill details" to see what the bill does, the result, and why it is filed under its issue.</p>${vtLegend()}
    <div class="filters" data-vf><button class="active" data-a="">All areas</button>${areas.map(a=>`<button data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div><div data-vl></div></section>`;
  return html;
}
// ---------- funders' and spenders' own published positions vs. the candidate's votes ----------
const GP=DATA.groupPos||[], GPBY=Object.fromEntries(GP.map(g=>[g.key,g]));
// ---------- money and votes over time: one group's money to or about a candidate, month by month, on the same axis as its key votes ----------
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monLabel=m=>`${MON[+m.slice(5,7)-1]} ${m.slice(0,4)}`;
const nextMon=m=>{let y=+m.slice(0,4),k=+m.slice(5,7)+1;if(k>12){k=1;y++;}return `${y}-${String(k).padStart(2,'0')}`};
// Months from the group: contributions from the FEC bulk file (all years); outside spending naming the candidate from the bulk
// file before 2025 and from the reviewed 2025-26 data (the same rows as the totals above) after.
function fundSeries(s,g){
  const H=window.FUNDHIST;if(!H)return null;
  const grp=(DATA.groupPos.find(x=>x.key===g.key)||{}).fecIds||[], ids=new Set(grp.map(f=>f.id));
  const M=new Map(), add=(m,k,v)=>{const o=M.get(m)||{c:0,f:0,a:0};o[k]+=v;M.set(m,o);};
  const h=(H.people[s.id]||{})[g.key]||{c:[],f:[],a:[]};
  for(const k of ['c','f','a'])h[k].forEach(([m,v])=>add(m,k,v));
  (IE.rows[s.race]||[]).forEach(r=>{if(r[0]<H.ieBefore||r[2]!==s.fecCand||!ids.has(cmOf(r[1])[0]))return;add(r[0].slice(0,7),r[3]==='S'?'f':'a',r[4]);});
  const votes=g.compared.map((c,i)=>({c,i})).sort((a,b)=>a.c.date.localeCompare(b.c.date)).map((x,k)=>Object.assign({n:k+1},x));
  let end=DATA.ie_asof.slice(0,7);
  votes.forEach(v=>{if(v.c.date.slice(0,7)>end)end=v.c.date.slice(0,7)});
  const months=[];for(let m=H.start.slice(0,7);m<=end;m=nextMon(m))months.push(m);
  const tot={c:0,f:0,a:0};M.forEach(o=>{tot.c+=o.c;tot.f+=o.f;tot.a+=o.a;});
  // A group added after the file was last built has no months yet (older files don't list their groups).
  const built=H.groups?H.groups.includes(g.key):Object.values(H.people).some(p=>p[g.key]);
  return {M,months,votes,tot,committees:grp.map(f=>f.name),H,built};
}
const voteNum=(g,i)=>1+g.compared.map((c,k)=>[c.date,k]).sort((a,b)=>a[0].localeCompare(b[0])||a[1]-b[1]).findIndex(x=>x[1]===i);
function fundTimeline(s,g,id){
  const d=fundSeries(s,g);if(!d)return '';
  if(!d.built)return `<div class="ftl-wrap"><div class="kicker" style="margin-top:14px">Money and votes over time</div><p class="small muted" style="margin:4px 0 0">The month-by-month figures for ${esc(g.org)} aren't built yet. They are added the next time the funder timelines are rebuilt from the FEC's bulk files.</p></div>`;
  const {tot,M,votes,H}=d, none=!(tot.c||tot.f||tot.a);
  const rows=d.months.filter(m=>M.has(m)||votes.some(v=>v.c.date.slice(0,7)===m));
  const vt=v=>`#${v.n} ${esc(v.c.short)}: ${v.c.match===null?'did not vote':v.c.match?'✓ same as the group':'✕ opposite of the group'}`;
  return `<div class="ftl-wrap"><div class="kicker" style="margin-top:14px">Money and votes over time</div>
    <p class="small" style="margin:4px 0 6px">${none?(g.for||g.against?`None of ${esc(g.org)}'s outside spending above names ${esc(s.short)} in a general-election FEC item (it was about an opponent, or in a primary), so only the votes are shown.`:`No money from ${esc(g.org)} to or about ${esc(s.short)} appears in the FEC data for ${fmtDate(H.start)} – ${fmtDate(DATA.ie_asof)}; only the votes are shown.`):`<b>${fmtDate(H.start)} – ${fmtDate(DATA.ie_asof)}:</b> contributions to the campaign <b class="num">${fmtFull(tot.c)}</b> · outside spending for ${esc(s.short)} <b class="num">${fmtFull(tot.f)}</b> · against ${esc(s.short)} <b class="num">${fmtFull(tot.a)}</b>.`}</p>
    <div class="legend" style="margin:0 0 6px"><span><i style="background:var(--s1)"></i>Contributions to ${esc(s.short)}'s campaign</span><span><i style="background:var(--s3)"></i>Outside spending for ${esc(s.short)}</span><span><i style="background:var(--s2)"></i>Outside spending against ${esc(s.short)} (below the line)</span><span><i class="ftl-key same"></i>Voted the way ${esc(g.org)} wanted</span><span><i class="ftl-key opp"></i>Voted the opposite way</span></div>
    <div class="ftl" id="${id}" data-person="${esc(s.id)}" data-group="${esc(g.key)}"></div>
    ${points([['Each bar','One month.'],['Above the line',`Money for ${esc(s.short)}: checks to the campaign from the group's PACs, and outside ads or mail supporting ${esc(s.short)}.`],['Below the line',`Outside spending against ${esc(s.short)}. This is money spent to defeat ${esc(s.short)}, not money ${esc(s.short)} received.`],['Numbered circles','The votes in the table above, on their dates.'],['Committees counted',esc(d.committees.join(', '))],['Sources',`FEC bulk data for contributions (through ${fmtDate(H.contribThrough)}) and for outside spending before 2025. From 2025 on, outside spending is the same data as the totals above.`],['Not shown',`Primary spending. Only general-election items that name ${esc(s.short)} count here, so this can be lower than the totals above, which also count spending on opponents.`],['Correlation, not cause','Money arriving near a vote does not show that it changed the vote.']],'small')}
    <details class="tv"><summary>Show as a table</summary><div class="tablewrap"><table><thead><tr><th>Month</th><th class="r">Contributions</th><th class="r">Outside for</th><th class="r">Outside against</th><th>Votes that month</th></tr></thead><tbody>${rows.map(m=>{const o=M.get(m)||{c:0,f:0,a:0};return `<tr><td class="mono" style="white-space:nowrap">${monLabel(m)}</td><td class="r">${o.c?fmtFull(o.c):'—'}</td><td class="r">${o.f?fmtFull(o.f):'—'}</td><td class="r">${o.a?fmtFull(o.a):'—'}</td><td class="small">${votes.filter(v=>v.c.date.slice(0,7)===m).map(vt).join('<br>')}</td></tr>`}).join('')||'<tr><td colspan="5" class="muted">No months with money or votes.</td></tr>'}</tbody></table></div></details></div>`;
}
function drawFundTL(el){
  if(!el)return;
  const s=byId[el.dataset.person], g=(s.funderPos||[]).find(x=>x.key===el.dataset.group), d=s&&g&&fundSeries(s,g);if(!d||!d.built)return;
  const {M,months,votes}=d, n=months.length;
  const W=Math.max(300,el.clientWidth), small=W<560, mL=small?42:54, mR=8, top=20;
  const mw=(W-mL-mR)/n, X=i=>mL+i*mw;
  const xDate=iso=>{const i=months.indexOf(iso.slice(0,7));const dim=new Date(+iso.slice(0,4),+iso.slice(5,7),0).getDate();return X(Math.max(0,i)+(+iso.slice(8,10)-.5)/dim)};
  let up=0,down=0;M.forEach(o=>{up=Math.max(up,o.c+o.f);down=Math.max(down,o.a)});
  const P=small?110:140, total=up+down||1, upH=up||down?P*up/total:P/2, base=top+upH, k=P/total;
  const plotBottom=top+P, axisY=plotBottom+(down?0:2);
  let svg='';
  // election days (first Tuesday after the first Monday in November, even years)
  for(let y=+months[0].slice(0,4);y<=+months[n-1].slice(0,4);y++){if(y%2)continue;const m=`${y}-11`,i=months.indexOf(m);if(i<0)continue;const x=X(i);svg+=`<rect class="ftl-elec" x="${x}" y="${top}" width="${Math.max(2,mw)}" height="${P}"></rect>${small?'':`<text class="ftl-small" x="${x+mw/2}" y="${top-6}" text-anchor="middle">${y} election</text>`}`;}
  // data end shading
  const endI=months.indexOf(DATA.ie_asof.slice(0,7));if(endI>=0&&endI<n-1)svg+=`<rect class="ftl-nodata" x="${X(endI+1)}" y="${top}" width="${X(n)-X(endI+1)}" height="${P}"></rect>`;
  svg+='@@GUIDES@@';
  // bars and hover columns
  const bw=Math.max(1,mw-(mw>4?1:0));
  months.forEach((m,i)=>{
    const o=M.get(m);if(!o)return;
    const x=X(i);
    const hc=o.c*k, hf=o.f*k, ha=o.a*k;
    if(hc>0)svg+=`<rect class="ftl-c" x="${x}" y="${base-Math.max(2,hc)}" width="${bw}" height="${Math.max(2,hc)}"></rect>`;
    if(hf>0)svg+=`<rect class="ftl-f" x="${x}" y="${base-(hc>0?Math.max(2,hc)+1:0)-Math.max(2,hf)}" width="${bw}" height="${Math.max(2,hf)}"></rect>`;
    if(ha>0)svg+=`<rect class="ftl-a" x="${x}" y="${base}" width="${bw}" height="${Math.max(2,ha)}"></rect>`;
    const tip=`${monLabel(m)} · contributions ${fmtFull(o.c)} · outside for ${fmtFull(o.f)} · outside against ${fmtFull(o.a)}`;
    svg+=`<rect class="ftl-hit" x="${x}" y="${top}" width="${Math.max(mw,1)}" height="${P}" data-tip="${esc(tip)}"></rect>`;
  });
  // value scale: the line, and the largest month in each direction
  svg+=`<line class="ftl-base" x1="${mL}" x2="${W-mR}" y1="${base}" y2="${base}"></line>`;
  svg+=`<text class="ftl-y" x="${mL-6}" y="${base+4}" text-anchor="end">$0</text>`;
  if(up)svg+=`<text class="ftl-y" x="${mL-6}" y="${top+9}" text-anchor="end">${fmt$(up)}</text><line class="ftl-grid" x1="${mL}" x2="${W-mR}" y1="${top}" y2="${top}"></line>`;
  if(down)svg+=`<text class="ftl-y" x="${mL-6}" y="${plotBottom}" text-anchor="end">−${fmt$(down)}</text><line class="ftl-grid" x1="${mL}" x2="${W-mR}" y1="${plotBottom}" y2="${plotBottom}"></line>`;
  // years
  const yAx=axisY+14;
  months.forEach((m,i)=>{if(m.endsWith('-01')){const x=X(i);svg+=`<line class="ftl-tick" x1="${x}" x2="${x}" y1="${axisY}" y2="${axisY+4}"></line>`;if(!small||(+m.slice(0,4))%2===0)svg+=`<text class="ftl-small" x="${x}" y="${yAx}" text-anchor="middle">${m.slice(0,4)}</text>`;}});
  // votes: numbered circles on their dates, stacked when they would overlap
  const r=small?8:9, laneTop=yAx+10, rows=[];
  const placed=votes.map(v=>{const x=xDate(v.c.date);let row=0;while((rows[row]||[]).some(px=>Math.abs(px-x)<r*2+2))row++;(rows[row]=rows[row]||[]).push(x);return {v,x,row};});
  const laneH=(rows.length||1)*(r*2+6);
  let guides='';placed.forEach(({v,x})=>{guides+=`<line class="ftl-guide ${v.c.match===null?'nv':v.c.match?'same':'opp'}" x1="${x}" x2="${x}" y1="${top}" y2="${laneTop}"></line>`;});
  placed.forEach(({v,x,row})=>{
    const cy=laneTop+r+row*(r*2+6), cls=v.c.match===null?'nv':v.c.match?'same':'opp';
    const tip=`#${v.n} ${fmtDate(v.c.date)} · ${v.c.short} · ${g.org} wanted ${v.c.wanted}, ${s.short} voted ${v.c.cast}${v.c.match===null?'':v.c.match?' (same)':' (opposite)'}`;
    svg+=`<g class="ftl-vote ${cls}" data-tip="${esc(tip)}"><circle cx="${x}" cy="${cy}" r="${r}"></circle><text x="${x}" y="${cy+4}" text-anchor="middle">${v.n}</text></g>`;
  });
  svg=svg.replace('@@GUIDES@@',guides);
  const H=laneTop+laneH+4;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(g.org)}'s money to or about ${esc(s.name)} by month since ${monLabel(months[0])}, with ${votes.length} key votes on the same time axis. The table below the chart lists every month.">${svg}</svg>`;
  bindTips(el);
}
function mountFundTL(root){root.querySelectorAll('.ftl').forEach(el=>{const f=()=>drawFundTL(document.getElementById(el.id));f();resizers.push(f);});}

// The cycles a group's bundled gifts to a person were read for (research.json "bundled"), as "2025–26 cycle".
const bundledCycle=(id,key)=>{const c=DATA.bundled?.people?.[id]?.[key]?.cycles||[];return c.length?`${c[0]-1}–${String(c.at(-1)).slice(2)} cycle`:'this cycle';};
function fundersBlock(s){
  const F=s.funderPos||[];
  const noVotes=!realVotes(s,DATA.votes).length&&!realVotes(s,DATA.hvotes).length;
  const head=`<section class="recsec" id="rec-funders"><div class="kicker">Funding and legislative activity, side by side</div><h3 style="margin-top:4px">What ${esc(s.short)}'s funders and spenders wanted, and how ${esc(s.short)} voted</h3>
    <div class="note small" style="margin:6px 0 12px">${points([['Which groups',`Groups that gave to ${esc(s.short)}'s campaign, bundled their donors' gifts to it, or spent on the race, <i>and</i> take public positions on bills (scorecards, "key vote" letters or statements).`],['Bundled','Donors\' own gifts a group collected and forwarded through its PAC ("earmarked"). The FEC counts them as individual contributions, not the PAC\'s, so they are shown apart from its PAC checks.'],['What is shown',`Each key vote the group took a side on, next to ${esc(s.short)}'s recorded vote, with a link to the source: the group's own page, or a news report of its campaign.`],['Correlation, not cause','A match shows agreement, not that money changed the vote. Groups mostly back people who already vote their way, and spend against people who don\'t.'],['Groups covered',`Only the ${GP.length} groups whose public positions this app collects${GP.some(g=>g.status!=='done')?` (${GP.filter(g=>g.status!=='done').length} still being researched)`:''}. Other spenders, including the big party-aligned super PACs, are not compared.`]])}</div>`;
  if(!F.length)return head+`<p class="small muted">None of the ${GP.length} groups whose positions this app collects gave to ${esc(s.short)}'s campaign or spent on this race.</p></section>`;
  const money=g=>[g.pac?`gave <b class="num">${fmtFull(g.pac)}</b> to the campaign (${g.pacN} contribution${g.pacN>1?'s':''}, ${esc(s.pac.window)})`:'',
    g.routed?`${term('earmarked','bundled')} <b class="num">${fmtFull(g.routed)}</b> of its donors' own gifts to the campaign${g.routedN?` (${g.routedN.toLocaleString()} gift${g.routedN>1?'s':''})`:''}, ${g.routedBy==='hand'?`${esc(g.routedPeriod)}, researched by hand from the filings`:esc(bundledCycle(s.id,g.key))}`:'',g.for?`spent <b class="num">${fmtFull(g.for)}</b> ${s.out.multi?'supporting':'for'} ${esc(s.short)}`:'',g.against?`spent <b class="num">${fmtFull(g.against)}</b> ${s.out.multi?'opposing':'against'} ${esc(s.short)}`:''].filter(Boolean).join('; ');
  const body=F.map(g=>{
    const meta=GPBY[g.key]||{};
    let res;
    if(g.status==='pending')res=`<p class="small" style="margin:6px 0 0">${flag('Research not finished','This group\'s published positions are not collected yet. They will be added in the next update.')} Its positions on these votes are not shown yet.</p>`;
    else if(noVotes)res=`<p class="small muted" style="margin:6px 0 0">${esc(s.short)} cast none of the key votes, so there is nothing to compare.</p>`;
    else if(!g.compared.length)res=`<p class="small muted" style="margin:6px 0 0">No published position by ${esc(g.org)} was found on the key votes ${esc(s.short)} cast.</p>`;
    else res=`<p class="small" style="margin:6px 0 4px"><b>${esc(s.short)} voted the way ${esc(g.org)} wanted on ${g.agree} of ${g.n} key votes it scored or took a public position on.</b></p>
      <div class="tablewrap"><table><thead><tr><th>#</th><th>Vote</th><th>${esc(g.org)} wanted</th><th>${esc(s.short)} voted</th><th>Same?</th><th>Group's own source</th></tr></thead><tbody>${g.compared.map((c,ci)=>{const v=(DATA.votes.concat(DATA.hvotes)).find(x=>x.id===c.voteId);return `<tr><td><span class="ftl-num ${c.match===null?'nv':c.match?'same':'opp'}">${voteNum(g,ci)}</span></td><td><a href="${voteUrl(v)}" target="_blank" rel="noopener">${esc(c.short)}</a><div class="small muted">${esc(c.chamber)} · ${fmtDate(c.date)}</div></td><td><span class="chip ${posClass(c.wanted)}">${esc(c.wanted)}</span></td><td><span class="chip ${posClass(c.cast)}">${esc(c.cast)}</span></td><td>${c.match===null?'<span class="muted">did not vote</span>':c.match?'<b style="color:var(--good)">✓ Same</b>':'<b style="color:var(--crit)">✕ Opposite</b>'}</td><td class="small">${c.basis==='scorecard'?'Scored in its scorecard':c.basis==='key_vote_alert'?'Key-vote letter before the vote':'Public statement'}: <a href="${esc(c.src.u)}" target="_blank" rel="noopener">${esc(c.src.t)} ↗</a></td></tr>`}).join('')}</tbody></table></div>${fundTimeline(s,g,'ftl-'+g.key)}`;
    return `<div class="mv"><h4>${orgName(g.org,ORGS.group(g.key))}</h4><p class="small" style="margin:0">${money(g)}${g.spenders.length?` <span class="muted">(${esc(g.spenders.join(', '))})</span>`:''}</p>${res}</div>`;}).join('');
  return head+body+`<p class="small muted" style="margin-top:10px"><b>Groups researched:</b> ${GP.map(g=>esc(g.org)+(g.status==='pending'?' (in progress)':'')).join(', ')}. <a href="#method">How positions were collected</a>.</p></section>`;
}

function moneyVotesBlock(s){
  const A=s.assoc||{}, keys=ISS.map(i=>i.id).filter(k=>A[k]);
  const head=`<section class="recsec" id="rec-money"><div class="kicker">Funding and legislative activity, by issue</div><h3 style="margin-top:4px">Money and votes by issue</h3>
    <div class="note small" style="margin:6px 0 12px">${points([['How to read this',`For each issue, ${esc(s.short)}'s recorded actions sit next to the groups tied to that issue. Look for patterns yourself.`],['Groups shown','PACs that gave to the campaign, and outside groups that spent on the race. Each is tied to the issue by its sector, documented stance or name.'],['Why a group is linked','Hover or tap the dotted label next to it.'],['Correlation, not cause','This does not show that any money changed a vote. Groups often back candidates who already agree with them, and both can follow party lines.']])}</div>`;
  if(!keys.length)return head+`<p class="small muted">No issue-linked groups or coded actions were found for ${esc(s.short)}.</p></section>`;
  const body=keys.map(k=>{const a=A[k], ev=((s.evidence||{})[k]||[]).filter(e=>RECT.has(e.type)), st=((s.evidence||{})[k]||[]).filter(e=>e.type==='stated');
    return `<div class="mv"><h4>${esc(ISSBY[k].label)}</h4><div class="mvgrid">
      <div><div class="kicker">${esc(s.short)}'s recorded actions</div>${ev.length?`<ul class="list small">${ev.map(e=>`<li><b>${esc(e.title)}</b> (${esc(e.date||'')}): ${esc(e.pos||'')} → "${esc(sideLabel(k,e.side))}" <span class="muted">${esc(TYPEL[e.type])}</span></li>`).join('')}</ul>`:`<p class="small muted">No recorded vote, bill or official action on this issue${st.length?` (${st.length} stated position${st.length>1?'s':''} on the Your match tab)`:''}.</p>`}</div>
      <div><div class="kicker">Groups with a stake in this issue</div>
        ${a.pac.length?`<p class="small" style="margin:4px 0 2px"><b>PAC contributions to the campaign</b> (${esc(s.pac.window)}): ${fmtFull(a.pacTotal)} from ${a.pac.length+a.pacMore} PAC${a.pac.length+a.pacMore>1?'s':''}</p>${(()=>{const li=g=>`<li>${esc(g.name)}: <b class="num">${fmtFull(g.amount)}</b> <span class="muted">(${g.n} × ${g.reports.map(fi=>esc(s.pac.filings[fi].report)).join(', ')})</span> <span class="term small" tabindex="0" data-tip="${esc(g.why)}">${esc(g.whyShort)}</span></li>`;return `<ul class="list small">${a.pac.slice(0,5).map(li).join('')}</ul>${a.pac.length>5?`<details class="tv"><summary>${a.pac.length-5} more</summary><ul class="list small">${a.pac.slice(5).map(li).join('')}</ul></details>`:''}`})()}${a.pacMore?`<p class="small muted">and ${a.pacMore} more in the PAC table on the Money &amp; Influence tab.</p>`:''}`:'<p class="small muted" style="margin:4px 0">No issue-linked PAC contributions in the itemized reports.</p>'}
        ${a.out.length?`<p class="small" style="margin:8px 0 2px"><b>Outside spending on the race</b> (${period(s.out.start,s.out.end)}):</p><ul class="list small">${a.out.map(o=>{const m=cmOf(o.ci);return `<li>${orgName(m[1],ORGS.spender(m))} (${CLS1[m[2]]}): ${o.for?`<b class="num">${fmtFull(o.for)}</b> ${s.out.multi?'supporting':'for'} ${esc(s.short)}`:''}${o.for&&o.against?'; ':''}${o.against?`<b class="num">${fmtFull(o.against)}</b> ${s.out.multi?'opposing':'against'}`:''}, ${fmtDate(o.first)}${o.last!==o.first?' – '+fmtDate(o.last):''} <span class="term small" tabindex="0" data-tip="${esc(o.why)}">${esc(o.whyShort)}</span></li>`}).join('')}</ul>`:''}
      </div></div></div>`}).join('');
  return head+body+'</section>';
}
// Points with up to two decimals (a case can be worth 22.5 or 3.75), and an index or deduction to one decimal.
const fmtPts=v=>String(Math.round(v*100)/100), fmt1=v=>String(Math.round(v*10)/10);
const KIND_LABEL={criminal:'criminal',ethics:'ethics or civil',technical:'technical'};
// r: the entry's row in the Legal Trouble Index (its status, kind, age and points).
function ethTag(e,r){
  if(e.outcome==='None found')return '<span class="chip good">Nothing found</span>';
  const [lab,cls]=ETH_TAG[e.status]||[e.type,'ghost'], stage=e.status==='investigation'?(e.stage==='open'?' · open':' · closed, no finding'):'';
  const chip=`<span class="chip ${cls}">${esc(lab+stage)}</span>`;
  if(!r)return chip;
  if(r.covered)return chip+'<span class="eth-cost">Counted in the Stock Disclosure Dodger Index 🙈</span>';
  if(!r.points)return chip+'<span class="eth-cost">no points</span>';
  const how=[ETHICS_COST[r.status],r.kind!=='ethics'&&`× ${CASE_KIND[r.kind]} ${KIND_LABEL[r.kind]}`,r.old&&`× ${CASE_AGE.factor} over ${CASE_AGE.years} years old`].filter(Boolean);
  return chip+`<span class="eth-cost">−${fmtPts(r.points)} points${how.length>1?` <span class="eth-how">(${how.join(' ')})</span>`:''}</span>`;
}
// An index as a card in a row: its name, value and description, with a boxed "How it's calculated" right under the
// description, using the person's own numbers where there are any.
const ixCard=({icon='',name,value,about,how,label='How it\'s calculated',score=null,tone='neutral'})=>`<div class="cx-stat ix-card"><span>${icon?icon+' ':''}${name}</span><b${toneAttrs(score,tone)}>${value}</b><small>${about}</small>${how?`<div class="ix-how"><div class="ix-h">${label}</div>${how}</div>`:''}</div>`;
const ixN=v=>v==null?'—':String(Math.round(v));
// The grade's three parts, each with what it costs.
function ethIndexes(s,e,{integrity=false}={}){
  const cost=(x,c,whole)=>x.index==null?`${esc(x.why)}: unavailable`:!c?(x.why?`${esc(x.why)}: costs nothing`:'Costs nothing'):whole?`Costs all ${fmtPts(c)} points`:integrity?`Costs 0.20 × index = ${fmt1(c)} points`:`Costs a tenth: ${fmt1(c)} points`;
  const cases=e.legal.rows.filter(r=>r.points).length;
  // Legal Trouble: each case's status points × kind × age, added up.
  const lr=e.legal.rows.filter(r=>r.points),term=r=>`${ETHICS_COST[r.status]}${r.kind!=='ethics'?` × ${CASE_KIND[r.kind]}`:''}${r.old?` × ${CASE_AGE.factor}`:''}`;
  const legalHow=`Each case: status points (${ETHICS_COST.finding} confirmed finding, ${ETHICS_COST.open} open, ${ETHICS_COST.closed} closed without a finding) × kind (criminal × ${CASE_KIND.criminal}, technical × ${CASE_KIND.technical}) × age (× ${CASE_AGE.factor} after ${CASE_AGE.years} years), added up, at most 100.`
    +(lr.length?`<div class="ix-f">${lr.slice(0,5).map(term).join(' + ')}${lr.length>5?` + ${lr.length-5} more`:''} = <b>${fmtPts(e.legal.total)}</b>${e.legal.total>100?', capped at <b>100</b>':''}</div>`:`<div class="ix-f">No case with points = <b>0</b></div>`)
    +`<div class="ix-f">${integrity?'Subtracted after the weighted component average at full strength.':'Historical published Ethics method: all of it.'}</div>`;
  // Insider Trading: four weighted shares of their reviewed trades.
  const IW=INSIDER.weights,ip=e.insider.parts;
  const insiderHow=`${IW.conflicts} × committee conflicts (dollar share of single-stock trades in sectors their committees oversee) + ${IW.nearVotes} × share near related votes + ${IW.donors} × share in donors' companies + ${IW.activity} × single-stock activity (${INSIDER.activityCeiling} trades a year scores 100). Needs ${INSIDER.minTrades} reviewed trades.`
    +(ip?`<div class="ix-f">${IW.conflicts} × ${ixN(ip.conflicts)} + ${IW.nearVotes} × ${ixN(ip.nearVotes)} + ${IW.donors} × ${ixN(ip.donors)} + ${IW.activity} × ${ixN(ip.activity)} = <b>${e.insider.index??ixN(IW.conflicts*ip.conflicts+IW.nearVotes*ip.nearVotes+IW.donors*ip.donors+IW.activity*ip.activity)}</b>${e.insider.index==null?` (${e.insider.n} of ${INSIDER.minTrades} trades, so not counted)`:''}</div>`:`<div class="ix-f">${esc(e.insider.why||'No trades')} = <b>${e.insider.index??'—'}</b></div>`)
    +`<div class="ix-f">${integrity?'Personal Finances deduction: 0.20 × the index.':'Historical published Ethics deduction: a tenth ('+INDEX_COST+' × the index).'}</div>`;
  // Stock Disclosure Dodger: late or missing trade reports, and late annual reports.
  const DW=DODGER.weights,dp=e.dodger.parts;
  const dodgerHow=`${DW.trades} × share of trades reported after ${LATE_DAYS} days or never + ${DW.annual} × share of the last 3 years' annual reports filed late. Without annual reports on file, the trade part counts alone. Needs ${DODGER.minFilings} filings.`
    +(e.dodger.index!=null?`<div class="ix-f">${dp.annual!=null?`${DW.trades} × ${ixN(dp.trades)} + ${DW.annual} × ${ixN(dp.annual)}`:`trade reports alone: ${ixN(dp.trades)}`} = <b>${e.dodger.index}</b></div>`:`<div class="ix-f">${esc(e.dodger.why||'No trades')} = <b>—</b></div>`)
    +`<div class="ix-f">${integrity?'Personal Finances deduction: 0.20 × the index.':'Historical published Ethics deduction: a tenth ('+INDEX_COST+' × the index).'}</div>`;
  const insiderCost=integrity?e.insider.index*.2:e.insiderCost,dodgerCost=integrity?e.dodger.index*.2:e.dodgerCost;
  return `<section class="recsec" id="eth-indexes"><div class="kicker">${integrity?'Integrity components':'The grade\'s three parts'}</div><h3 style="margin-top:4px">${integrity?'Legal Trouble and financial indices':'Ethics indexes'}</h3>
  <div class="cx-stats ix-row">${ixCard({icon:'🚨',name:'Legal Trouble Index',value:e.legal.index==null?'—':fmtPts(e.legal.index),score:e.legal.index,tone:'bad',about:`${cost(e.legal,e.legal.index,true)}. ${cases?`${cases} case${cases===1?'':'s'} with points.`:'No case with points.'}`,how:legalHow})}${ixCard({icon:'📈',name:'Insider Trading Index',value:e.insider.index==null?'—':fmtPts(e.insider.index),score:e.insider.index,tone:'bad',about:`${cost(e.insider,insiderCost,false)}. Trades that overlap with their committees, votes or donors.`,how:insiderHow})}${ixCard({icon:'🙈',name:'Stock Disclosure Dodger Index',value:e.dodger.index==null?'—':fmtPts(e.dodger.index),score:e.dodger.index,tone:'bad',about:`${cost(e.dodger,dodgerCost,false)}. Trade reports filed late or never.`,how:dodgerHow})}</div>
  <div style="margin:8px 0 0">${points([['How a case counts',`Its status points × its kind × its age. Status: ${ETHICS_COST.finding} for a confirmed finding, ${ETHICS_COST.open} for an open investigation, ${ETHICS_COST.closed} for one closed without a finding, 0 for an allegation.`],['Kind',`Criminal × ${CASE_KIND.criminal}, ethics or civil × ${CASE_KIND.ethics}, technical × ${CASE_KIND.technical} (such as an FEC fine for a late report).`],['Age',`× ${CASE_AGE.factor} when it was decided more than ${CASE_AGE.years} years ago. Open cases always count in full.`],['Trading',integrity?'Each available trading index costs 0.20 × its value in Personal Finances. The indices still have their existing evidence minimums.':`The two trading indexes cost a tenth of their value each, so trading can cost at most ${Math.round(2*100*INDEX_COST)} points.`]],'small')}</div></section>`;
}
function ethicsHTML(s){
  const rowOf=new Map(personEthics(s).legal.rows.map(r=>[s.ethics[r.i],r]));
  const rank=e=>e.outcome==='None found'?9:e.status==='finding'?0:e.status==='investigation'?(e.stage==='open'?1:2):e.status==='allegation'?3:4;
  const list=s.ethics.map((e,i)=>[e,i]).sort((x,y)=>rank(x[0])-rank(y[0])||x[1]-y[1]).map(x=>x[0]);
  return `<section class="recsec" id="rec-ethics"><div class="kicker">Ethics & legal compliance</div><h3 style="margin-top:4px">Every entry, most serious first</h3>
  <p class="small muted" style="margin:4px 0 0">Findings, penalties, investigations and disclosure checks. Each is tied to an official record or a credible report.</p>
  <div style="margin:0 0 10px">${points([['Allegation','A complaint or report with no official finding.'],['Investigation',`A formal inquiry, lawsuit or proceeding. It is still open, or it closed without a finding against ${esc(s.short)}.`],['Confirmed finding',`A court, agency or ethics body found a violation or set a penalty, or ${esc(s.short)} admitted it.`],['Nothing found','The sources checked turned up nothing. That does not mean nothing exists.'],['Points','What each entry costs in the Legal Trouble Index 🚨.']],'small')}</div>
  ${list.map(e=>`<article class="eth"><div class="head">${ethTag(e,rowOf.get(e))}<span class="chip ghost">${esc(e.type)}</span><span class="mono muted">${esc(e.date)}</span></div><h3>${esc(e.title)}</h3><p style="margin-top:8px">${esc(e.summary)}</p><div class="outcome"><b>Outcome:</b> ${esc(e.outcome)}</div><ul class="srcs">${e.sources.map(x=>`<li><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)} ↗</a></li>`).join('')}</ul></article>`).join('')}
  ${s.ethicsSearched&&s.ethics.some(e=>e.outcome!=='None found')?`<p class="small muted" style="margin-top:12px"><b>Also checked:</b> ${esc(s.ethicsSearched)}</p>`:''}</section>`;
}
// Stock trading: reviewed trades, each checked for a late or missing disclosure and for a committee conflict.
const TRADE_OWNER={self:'Self',spouse:'Spouse',child:'Dependent child',joint:'Joint'};
// A president's trades, from the OGE reports compiled in Disclosed Capitol's open dataset (public/exec-trades.json,
// written by scripts/build-exec-trades.mjs, CC BY 4.0, so the credit line always shows). Listed, never scored.
const EXEC=window.EXEC_TRADES||null;
const TRADE_TYPE={buy:'Buy',sell:'Sell',other:'Other'};
function presidentTradesHTML(s){
  const x=EXEC?.people?.[s.id];
  if(!x)return `<p class="small muted" style="margin:4px 0 0"><b>Not loaded:</b> a president reports trades on OGE Form 278e and 278-T reports. They couldn't be loaded right now.</p>`;
  const n=v=>Number(v||0).toLocaleString('en-US'),pct=(a,b)=>b?Math.round(a/b*100):0,ext=(u,t)=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`;
  const bars=(rows,label,key,color)=>stackRows(rows.map(r=>({label:r[label],parts:{[key]:r.n},value:r.n,display:n(r.n)})),[{key,label:'Trades',color}]);
  const years=x.byYear.map(y=>({label:y.year,parts:{buy:y.buy,sell:y.sell,other:y.other},value:y.buy+y.sell+y.other,display:n(y.buy+y.sell+y.other)}));
  const late=x.late.of?pct(x.late.n,x.late.of):null, shown=x.recent.slice(0,25), more=x.recent.slice(25);
  const row=t=>`<tr><td class="mono" style="white-space:nowrap">${esc(t.traded)}</td><td class="mono" style="white-space:nowrap">${t.filed?`${esc(t.filed)}${t.days!=null?`<div class="small muted">${n(t.days)} days</div>`:''}`:'<span class="muted">Not linked</span>'}</td><td>${esc(t.asset)}${t.ticker?` <span class="mono muted">${esc(t.ticker)}</span>`:''}</td><td>${TRADE_TYPE[t.type]||esc(t.type)}</td><td class="r" style="white-space:nowrap">${esc(t.amount)}</td><td>${esc(t.form||'—')}</td></tr>`;
  const table=list=>`<div class="tablewrap"><table><thead><tr><th>Traded</th><th>Reported</th><th>Asset</th><th>Type</th><th class="r">Amount</th><th>Form</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>`;
  return `<p class="small" style="margin:4px 0 8px">From ${esc(s.short)}'s own OGE reports: a Form 278-T for trades, and the yearly Form 278e. <b>Listed, not scored.</b></p>
  <div style="margin:0 0 8px">${points([['Not scored','How to score a president\'s trades is still an open decision. The committee-conflict rule for members of Congress has no direct match for a president, so the Ethics grade above doesn\'t count them.'],
    ['Amounts','Reports give ranges, not exact amounts.'],
    ['Counted once',`${n(x.repeats)} rows repeat a trade with the same date, asset, type and amount, often because it was listed on two reports. So ${n(x.rows)} rows are ${n(x.trades)} trades. Two identical trades in separate accounts on the same day would also count once.`],
    x.misdated&&['Dates that don\'t fit',`${n(x.misdated)} trades are dated more than a year before the report that lists them, so the date was likely misread (some are bonds whose due date was taken for the trade date). They're left out of the charts and the late count.`],
    ['Deadline',`A 278-T is due within ${EXEC.deadline} days of a trade at the latest.`]],'small')}</div>
  <div class="cx-stats">
    <div class="cx-stat"><span>Trades</span><b>${n(x.trades)}</b><small>${n(x.buys)} buys and ${n(x.sells)} sells, ${fmtDate(x.first)} to ${fmtDate(x.last)}</small></div>
    <div class="cx-stat"><span>Value traded</span><b>${money(x.value.low)}–${money(x.value.high)}</b><small>Buys and sells added together, from the disclosed ranges</small></div>
    <div class="cx-stat"><span>Linked to a report</span><b>${pct(x.linked,x.trades-x.misdated)}%</b><small>${n(x.linked)} trades. The dataset has no report date for the rest, so when they were reported can't be shown</small></div>
    <div class="cx-stat"><span>Reported after ${EXEC.deadline} days</span><b>${late==null?'—':late+'%'}</b><small>${late==null?'No 278-T trades with a report date':`${n(x.late.n)} of the ${n(x.late.of)} trades on a dated 278-T. A lead, not a finding: extensions and late fees aren't in the data`}</small></div></div>
  <div class="chart"><h3>Trades by year</h3><div class="sub">${points([['Each bar','Buys and sells in the year the trade was made.'],['Left out',`Trades whose date doesn't fit their report.`]],'small')}</div>
    ${stackRows(years,[{key:'buy',label:'Buys',color:'var(--s1)'},{key:'sell',label:'Sells',color:'var(--s2)'},{key:'other',label:'Other',color:'var(--cx-other)'}])}${legend([['var(--s1)','Buys'],['var(--s2)','Sells']])}
    ${tableView(['Year','Count','Buys','Sells'],x.byYear.map(y=>[esc(y.year),n(y.buy+y.sell+y.other),n(y.buy),n(y.sell)]))}</div>
  <div class="chart"><h3>What was traded</h3><div class="sub">${points([['Kind of asset','From the ticker the dataset gives. Most trades list a company by name with no ticker, so those are grouped together.']],'small')}</div>${bars(x.byKind,'label','kind','var(--s3)')}</div>
  <div class="chart"><h3>Trades by amount</h3><div class="sub">${points([['Ranges','The value range each report gives. "Other ranges" are ranges that aren\'t one of OGE\'s, likely typed or read wrong.']],'small')}</div>${bars(x.byAmount,'label','amount','var(--s4)')}</div>
  <div class="chart"><h3>The reports</h3><div class="sub">${points([['Each row','The reports the dataset ties trades to, by date. Two filed the same day are counted together.'],['Rows listed','As listed in the dataset, so a trade listed twice counts twice here.']],'small')}</div>
    <div class="tablewrap"><table><thead><tr><th>Date</th><th>Form</th><th class="r">Reports</th><th class="r">Rows listed</th><th>Trades made</th></tr></thead><tbody>${x.reports.map(r=>`<tr><td class="mono" style="white-space:nowrap">${esc(r.filed)}</td><td>${esc(r.form||'Not given')}</td><td class="r">${r.count}</td><td class="r">${n(r.listed)}${r.misdated?`<div class="small muted">${n(r.misdated)} misdated</div>`:''}</td><td class="mono small" style="white-space:nowrap">${r.from?`${esc(r.from)} to ${esc(r.to)}`:'—'}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="chart"><h3>Latest trades</h3><div class="sub">${points([['Order','Newest trade first.'],['Reported','The date on the report, and how many days after the trade. "Not linked" when the dataset has no report for it.']],'small')}</div>
    ${table(shown)}${more.length?`<details class="tv"><summary>Show ${more.length} more</summary>${table(more)}</details>`:''}
    <p class="small muted" style="margin:8px 0 0">The full list: ${ext(x.profile||EXEC.source,`${s.short} on Disclosed Capitol`)}</p></div>
  <p class="small muted" style="margin:12px 0 0"><b>Source:</b> ${ext(EXEC.source,EXEC.credit)}, under ${ext(EXEC.licenseUrl,EXEC.license)}, from ${esc(EXEC.from)}. ${esc(EXEC.changes)} Dataset refreshed ${fmtDate(EXEC.refreshed)}.</p>`;
}
// How they hold investments (step 8), from the reviewed research: a qualified blind trust or no individual stocks.
function holdingsLine(s){
  const h=s.holdings;if(!h||!HOLDINGS[h.status])return '';
  const src=[h.src,h.also].filter(Boolean).map(x=>`<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)} ↗</a>`).join(' · ');
  const rule=h.status==='blind-trust'?'An independent trustee decides what to buy and sell and doesn\'t tell them, so trades made inside the trust don\'t count in the trading indexes. Trades they report outside it, or made before it, count as usual.'
    :'Trades in funds don\'t count as conflicts or single-stock activity. Stock trades from before they sold count as usual.';
  return `<div class="note small" style="margin:6px 0 10px">${points([[esc(HOLDINGS[h.status]),`Since ${esc(h.since)}. ${esc(h.note||'')} ${src}`],['What it changes',rule],['What doesn\'t count','A managed or "discretionary" account, an adviser who trades without asking, or a trust that isn\'t a qualified blind trust. Those trades are still theirs to report, and count in full.'],['No bonus','The Ethics grade starts at 100 and only loses points.']],'small')}</div>`;
}
function tradingHTML(s){
  const t=personTrading(s), sec=overseenSectors(s);
  const head=`<section class="recsec" id="eth-trades"><div class="kicker">Stock trading</div><h3 style="margin-top:4px">Stock trades</h3>`;
  if(s.office)return head+presidentTradesHTML(s)+'</section>';
  if(!s.bioguide)return head+`<p class="small muted" style="margin:4px 0 0"><b>No trading data:</b> these reports cover members of Congress only. State rules vary.</p></section>`;
  if(!t.rows.length)return head+holdingsLine(s)+`<p class="small muted" style="margin:4px 0 0">No reviewed stock trades for ${esc(s.short)} yet. New trades from official reports show under Latest official records below. They count toward the grade only after review.</p></section>`;
  const e=personEthics(s),dp=e.dodger.parts,n=v=>`${Math.round(v)}%`,ab=sixOf(s).aboveboard,tc=ab.tradeConflicts,ip=tc.parts||{};
  return head+holdingsLine(s)+`<div style="margin:0 0 8px">${e.inTrust?`<p class="small" style="margin:0 0 6px"><b>Left out:</b> ${e.inTrust} trade${e.inTrust===1?'':'s'} made inside the qualified blind trust.</p>`:''}${points([['Trade Conflicts Index 📈',`${tc.index??'—'}${tc.why?` (${esc(tc.why)})`:''}. In sectors their committees oversee ${ip.committees==null?'—':n(ip.committees)} of the dollars in single stocks, near related votes ${ip.nearVotes==null?'—':n(ip.nearVotes)}, in donors' companies ${ip.donors==null?'—':n(ip.donors)}.`],['Stock Disclosure Dodger Index 🙈',`${ab.dodger.index??'—'}${e.dodger.why?` (${esc(e.dodger.why)})`:''}. Trade reports late or missing: ${n(dp.trades)}${dp.annual!=null?`; annual disclosures late: ${n(dp.annual)}`:'; annual disclosures are not on file yet'}.`],['Filing deadline',`Trade reports are due within ${LATE_DAYS} days of a trade.`],['Their committees oversee',sec.length?esc(sec.join(', ')):'Not recorded yet, so no trade counts as a conflict.'],['Family trades','Spouse and dependent-child trades are included and labeled.'],['Returns','Not scored.']],'small')}</div>
  ${tradeChartsBlock(t.rows,sec,'eth-tr')}
  <div class="tablewrap"><table><thead><tr><th>Traded</th><th>Filed</th><th>Company</th><th>Type</th><th class="r">Amount</th><th>Owner</th><th>Checks</th></tr></thead><tbody>${t.rows.map(r=>`<tr><td class="mono">${esc(r.traded||'')}</td><td class="mono">${r.missing?'<b style="color:var(--crit)">not filed</b>':esc(r.filed||'')}${r.days!=null?`<div class="small muted">${r.days} days</div>`:''}</td><td>${esc(r.company||'')}${r.ticker?` <span class="mono muted">${esc(r.ticker)}</span>`:''}${r.sector?`<div class="small muted">${esc(r.sector)}</div>`:''}</td><td>${esc(r.type||'')}</td><td class="r">${esc(r.amount||'')}</td><td>${esc(TRADE_OWNER[r.owner]||r.owner||'')}</td><td>${r.late?'<span class="chip crit">Late</span> ':''}${r.conflict?'<span class="chip warn">Committee conflict</span>':''}${r.flag||r.nearVote?` <span class="chip ghost" title="${esc(r.flag||'')}">Near a related vote</span>`:''}${r.src?` <a class="small" href="${esc(r.src.u)}" target="_blank" rel="noopener">filing ↗</a>`:''}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function paneEthics(s,pane,{embedded=false}={}){
  const e=personEthics(s);
  const terms=[[e.finding,'confirmed finding','confirmed findings'],[e.open,'open investigation','open investigations'],[e.closed,'investigation closed without a finding','investigations closed without a finding']].filter(t=>t[0]);
  const trade=[e.late&&`${e.late} late or missing disclosure${e.late>1?'s':''}`,e.conflict&&`${e.conflict} committee-conflict trade${e.conflict>1?'s':''}`].filter(Boolean);
  const detail=(terms.length||trade.length)?terms.map(([n,one,many])=>`${n} ${n>1?many:one}`).concat(trade).join(' · ')+(e.allegation?` · ${e.allegation} allegation${e.allegation>1?'s':''} (not scored)`:''):`No confirmed findings, investigations or trading problems in the sources checked${e.allegation?`; ${e.allegation} allegation${e.allegation>1?'s are':' is'} listed but not scored`:''}.`;
  const parts=[e.legal.index&&`${fmtPts(e.legal.index)} (Legal Trouble 🚨${e.legal.total>100?', capped at 100':''})`,e.insiderCost&&`${fmt1(e.insiderCost)} (a tenth of Insider Trading 📈 ${e.insider.index})`,e.dodgerCost&&`${fmt1(e.dodgerCost)} (a tenth of Stock Disclosure Dodger 🙈 ${e.dodger.index})`].filter(Boolean);
  const total=fmtPts(e.raw);
  const math=parts.length?`<p class="small gh-m"><b>How it was calculated:</b> 100 − ${parts.join(' − ')} = ${e.raw<0?`${total}, shown as <b>0%</b>`:+total===e.pct?`<b>${e.pct}%</b>`:`${total}, rounded to <b>${e.pct}%</b>`}.</p>`:'';
  pane.innerHTML=`${embedded?'':gradeHead('Ethics',e.pct,detail,gradeRule('eth'),math+monthlyNote(s,'ethics',e.pct))}${embedded?'':sectionNav([['eth-indexes','Indexes & calculation'],['rec-ethics','Cases & findings'],['eth-timeline','Case timeline'],['eth-trades','Stock trades'],['live-records','Personal finances & latest records']])}${ethIndexes(s,e,{integrity:embedded})}${ethicsHTML(s)}${caseTimelineBlock(s)}${tradingHTML(s)}<section id="live-records" style="margin-top:28px"></section>`;
  mountCaseTimeline(s);mountTradeCharts(s,personTrading(s).rows,'eth-tr');hoverTips(pane);
  window.RecordLive.profile(s,pane.querySelector('#live-records'),['netWorth','trades','legal']);
}

function integrityFundraisingDetails({s,preview,sizes,typed,typedTotal,earmarkEvidence,pledge}){
  const f=preview.fundraising,c=s.camp||{},usd=n=>n==null?'Unknown':fmtFull(n),share=n=>c.receipts>0&&Number.isFinite(n)?`${(n/c.receipts*100).toFixed(2)}% of receipts`:'share unavailable: receipts missing',url=x=>typeof x==='string'?x:x?.u||x?.url||'';
  const donorRows=sizes?.brackets?.map(b=>`<tr><td>${esc(b.label||b.size)}</td><td class="r">${usd(b.total)}</td><td class="r">${share(b.total)}</td></tr>`).join('')||'';
  const pacRows=typed.map(r=>`<tr><td>${esc(r.kind)}</td><td class="r">${usd(r.amount)}</td><td class="r">${share(r.amount)}</td></tr>`).join('');
  const earmarkRows=earmarkEvidence.map(r=>{const href=url(r.src);return `<tr><td>${esc(r.group)}</td><td>${esc(r.period||'Period unavailable')}</td><td class="r">${usd(r.amount)}</td><td>${href?`<a href="${esc(href)}" target="_blank" rel="noopener">FEC source ↗</a>`:'Source unavailable'}</td></tr>`}).join('');
  return `<details class="chart" open><summary><b>Fundraising calculation and source coverage</b></summary><p class="small">${f.complete?`Receipts ${usd(c.receipts)}, ${fmtDate(c.start)} – ${fmtDate(c.end)}.`:`Not graded: ${esc(f.why||'required coverage unavailable')}.`} Shares use this same reporting period.</p><p class="small">M = clamp(75 + D − P − R − E + pledges, 0–100). D ${f.D==null?'unknown':f.D.toFixed(2)} · P ${f.P==null?'unknown':f.P.toFixed(2)} · R ${f.R==null?'unknown':f.R.toFixed(2)} · E ${f.E==null?'unknown':f.E.toFixed(2)} · pledge adjustment ${pledge.points>0?'+':''}${pledge.points}.</p>
  <h4>Donor buckets ${sizes?`· ${esc(sizes.start)} – ${esc(sizes.end)}`:'· not available for this period'}</h4>${donorRows?`<div class="tablewrap"><table><thead><tr><th>FEC bucket</th><th class="r">Dollars</th><th class="r">Receipt share</th></tr></thead><tbody>${donorRows}<tr><td>Itemized, not sorted</td><td class="r">${usd(sizes.notSorted)}</td><td class="r">${share(sizes.notSorted)}</td></tr><tr><td>Self funding / joint fundraising</td><td class="r">${usd(c.self)} / ${usd(c.transfers)}</td><td class="r">${share(c.self==null?null:c.self+(c.transfers||0))}</td></tr></tbody></table></div>`:'<p class="small muted">Missing donor-size fetch is unknown, not zero. Bucket boundaries: under $200 (itemized or unitemized), $200–499, $500–999, $1,000–1,999, and $2,000+.</p>'}
  <h4>PAC types</h4><p class="small">Reviewed PAC rows ${usd(typedTotal)}; campaign PAC total ${usd(c.pac)}. ${f.P==null?'Rows or filing periods do not reconcile; penalty unavailable.':'Same-period categorized PAC coverage reconciles.'}</p>${pacRows?`<div class="tablewrap"><table><thead><tr><th>Category</th><th class="r">Dollars</th><th class="r">Receipt share</th></tr></thead><tbody>${pacRows}</tbody></table></div>`:'<p class="small muted">No reviewed PAC-type rows.</p>'}
  <h4>Earmarks</h4><p class="small">${f.E==null?'Selected conduit collection is partial; total remains unknown.':'Complete reviewed earmark coverage.'} ActBlue and WinRed are excluded. Routed gifts are not added again as direct PAC checks.</p>${earmarkRows?`<div class="tablewrap"><table><thead><tr><th>Group</th><th>Period</th><th class="r">Dollars</th><th>Source</th></tr></thead><tbody>${earmarkRows}</tbody></table></div>`:'<p class="small muted">No sourced earmark total can be established.</p>'}
  <h4>Pledge adjustments</h4><div class="tablewrap"><table><thead><tr><th>Category</th><th>Points</th><th>Review/source</th></tr></thead><tbody>${pledge.rows.map(r=>`<tr><td>${esc(r.category)}</td><td>${r.score>0?'+1':r.score<0?'−1':'0'}</td><td>${r.awaiting?'Awaiting review':r.source?`<a href="${esc(r.source)}" target="_blank" rel="noopener">Evidence ↗</a>`:'No qualifying pledge or cosponsorship evidence recorded'}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function paneIntegrity(s,pane){
  pane.innerHTML=`${integrityPreviewShell(s)}<nav class="jump small" aria-label="Integrity sections"><a href="#integrity-honesty">Honesty</a><a href="#integrity-personal-finances">Personal Finances</a><a href="#integrity-fundraising">Fundraising</a><a href="#integrity-showing-up">Showing Up</a><a href="#integrity-conflicts">Conflicts of Interest</a><a href="#integrity-legal">Legal Trouble</a><a href="#integrity-method">Method & coverage</a><a href="#integrity-history">Historical grades</a></nav><section id="integrity-honesty"><h2>Honesty: Promises Delivered Index</h2><div data-integrity-honesty></div></section><section id="integrity-personal-finances"><h2>Personal Finances</h2><div data-integrity-finances></div></section><section id="integrity-fundraising"><h2>Fundraising</h2><div data-integrity-fundraising-detail><p class="small muted">Loading reviewed sources…</p></div></section><section id="integrity-showing-up"><h2>Showing Up</h2><div data-integrity-showing-up><p class="small muted">Loading the roll-call record…</p></div></section><section id="integrity-conflicts"><h2>Conflicts of Interest</h2><div data-integrity-conflicts><p class="small muted">Loading the disclosure record…</p></div></section><section id="integrity-legal"><h2>Legal Trouble</h2><div data-integrity-legal></div></section><section id="integrity-method"><h2>Methodology and coverage</h2><p>Integrity is provisional and uncalibrated. Component values remain visible even when the overall grade is Not graded. At least two complete components and a sourced Legal Trouble review are required. Missing data is never treated as zero misconduct.</p><p>IntegrityIndex.us inspired the adapted structure. Fundraising and campaign receipts retain reporting dates; holdings and trades retain separate dates. Selected bundler coverage is partial.</p><p><a href="#method-integrity">Full formulas, parameters and source credit</a> · <a href="#method-integrity-log">Separate monthly comparison log</a> · <a href="#method-log">Published grade history</a></p></section><section id="integrity-history"><h2>Historical grades</h2>${historicalIntegrityGrades(s)}</section><div data-integrity-staging hidden></div>`;
  const honesty=pane.querySelector('[data-integrity-honesty]'),fin=pane.querySelector('[data-integrity-finances]'),legal=pane.querySelector('[data-integrity-legal]'),staging=pane.querySelector('[data-integrity-staging]');
  panePromises(s,honesty,{embedded:true});paneEthics(s,staging,{embedded:true});
  const indexes=staging.querySelector('#eth-indexes'),cards=[...(indexes?.querySelectorAll('.ix-card')||[])];
  if(indexes){const legalCard=cards.find(x=>x.textContent.includes('Legal Trouble Index'));const financeCards=cards.filter(x=>x!==legalCard);indexes.querySelector('.ix-row')?.replaceChildren(...financeCards);if(financeCards.length){indexes.id='integrity-financial-indexes';fin.append(indexes);indexes.querySelector('h3').textContent='Insider Trading and Stock Disclosure Dodger';}if(legalCard){const box=document.createElement('section');box.className='recsec';box.id='eth-indexes';box.innerHTML='<h3>Legal Trouble Index and calculation</h3>';box.append(legalCard);legal.append(box);}}
  const cases=staging.querySelector('#rec-ethics'),timeline=staging.querySelector('#eth-timeline'),trades=staging.querySelector('#eth-trades'),live=staging.querySelector('#live-records');
  if(cases)legal.append(cases);if(timeline)legal.append(timeline);if(trades)fin.append(trades);
  if(live){live.id='integrity-live-records';fin.append(live);}
  const promiseLive=honesty.querySelector('#live-records');if(promiseLive)promiseLive.id='integrity-honesty-live';
  mountCaseTimeline(s);mountTradeCharts(s,personTrading(s).rows,'eth-tr');hoverTips(pane);
  loadIntegrityPreview(s,pane,personPvp(s));
}
function historicalIntegrityGrades(s){
  const entries=(window.SCORELOG||[]).filter(e=>e.scores?.[s.id]).slice().reverse();
  if(!entries.length)return '<p class="small muted">No historical published grades recorded for this profile.</p>';
  return `<details><summary>Ethics and Promises Delivered history (${entries.length} monthly records)</summary><p class="small">Preserved published values; not recalculated or averaged into Integrity.</p><div class="tablewrap"><table><thead><tr><th>Date</th><th>Promises Delivered</th><th>Ethics</th></tr></thead><tbody>${entries.map(e=>{const v=e.scores[s.id],p=v.promises?.pct??null,eth=v.ethics?.pct??null;return `<tr><td>${fmtDate(e.date)}</td><td>${p==null?'Not graded':`${letter(p)} ${p}%`}</td><td>${eth==null?'Not graded':`${letter(eth)} ${eth}%`}</td></tr>`}).join('')}</tbody></table></div></details>`;
}

// ---------- People First tab: votes on scored bills, then who funds them and how those funders wanted them to vote ----------
const PVP_SIDE={people:'Working people',profit:'The wealthy and corporations'};
const billUrl=k=>{const eo=/^eo-(\d+)$/.exec(k||'');if(eo)return `https://www.govinfo.gov/link/cpd/executiveorder/${eo[1]}`;const m=/^(\d+)-([a-z]+)-(\d+)$/.exec(k||'');if(!m)return null;const T={hr:'house-bill',s:'senate-bill',hjres:'house-joint-resolution',sjres:'senate-joint-resolution',hconres:'house-concurrent-resolution',sconres:'senate-concurrent-resolution',hres:'house-resolution',sres:'senate-resolution'},A={samdt:'senate-amendment',hamdt:'house-amendment'};return A[m[2]]?`https://www.congress.gov/amendment/${m[1]}th-congress/${A[m[2]]}/${m[3]}`:`https://www.congress.gov/bill/${m[1]}th-congress/${T[m[2]]}/${m[3]}`;};
const billLabel=k=>{const eo=/^eo-(\d+)$/.exec(k||'');if(eo)return `Executive Order ${eo[1]}`;const m=/^(\d+)-([a-z]+)-(\d+)$/.exec(k||'');if(!m)return k;const L={hr:'H.R.',s:'S.',hjres:'H.J.Res.',sjres:'S.J.Res.',hconres:'H.Con.Res.',sconres:'S.Con.Res.',hres:'H.Res.',sres:'S.Res.',samdt:'S.Amdt.',hamdt:'H.Amdt.'};return `${L[m[2]]} ${m[3]} (${m[1]}th Congress)`;};
const PVP_DID={vote:p=>`Voted ${p}`,sponsored:()=>'Sponsored',cosponsored:()=>'Cosponsored',signed:()=>'Signed into law',vetoed:()=>'Vetoed',order:()=>'Issued the order',statement:p=>`Said they ${p==='support'?'support':'oppose'} it`};
// People First bill scores (grades.js billScore): the badge, a short reason, and the full list of bills on file.
const POS_WORD={support:'supported',oppose:'opposed'};
const signed=n=>n==null?'—':`${n>0?'+':n<0?'−':''}${Math.abs(n)}`;
const srcLink=x=>x?.src?` <a href="${esc(x.src.u)}" target="_blank" rel="noopener">${esc(x.src.t)} ↗</a>`:'';
const billScoreBadge=b=>b.status==='scored'?`<b class="${b.score>0?'gr-A':'gr-F'}">${signed(b.score)}</b>`:`<span class="muted">Not scored</span>`;
const sidesText=b=>(b.sides||[]).map(p=>`${esc(BILL_GROUPS[p.group]?.org||p.group)} ${POS_WORD[p.pos]}`).join(', ');
function billWhyShort(b){
  return [(b.gains||b.access)&&`<b>Who gains (${signed(b.gainsPart)}):</b> ${[b.gains&&`${esc(b.gains.by)}: ${esc(GAINS_STEPS[b.gains.step].toLowerCase())}`,b.access&&`access (${esc(b.access.by)}): ${esc(ACCESS_STEPS[b.access.step].toLowerCase())}`].filter(Boolean).join('; ')}.`,
    b.sides?.length&&`<b>Who took a side (${signed(b.sidesPart)}):</b> ${sidesText(b)}.`].filter(Boolean).join(' ');
}
function billsBlock(bills){
  if(!bills.length)return '';
  const order=b=>b.status==='scored'?0:b.status==='disputed'?1:2;
  const rows=bills.slice().sort((a,b)=>order(a)-order(b)||Math.abs(b.score||0)-Math.abs(a.score||0)||a.title.localeCompare(b.title));
  const n=bills.filter(b=>b.status==='scored').length;
  return `<div class="chart" id="pvp-bills"><h3>Every bill on file</h3><div class="sub">${n} of ${bills.length} bills are scored, from −100 (fully corporate-backed) to +100 (fully worker-backed). Half the score is who gains, from a nonpartisan study; half is which side worker and business groups took. <a href="#method">How bills are scored</a></div>
    <div class="tablewrap"><table><thead><tr><th>Bill</th><th class="r">Score</th><th>Who gains</th><th>Who took a side</th><th>Also on record (not scored)</th></tr></thead><tbody>${rows.map(b=>{const u=billUrl(b.id);
      const who=[...new Set((b.cosponsors||[]).map(c=>c.person))].map(id=>byId[id]?`<a href="#${id}-pvp">${esc(byId[id].short||byId[id].name)}</a>`:'').filter(Boolean);
      return `<tr><td>${u?`<a href="${u}" target="_blank" rel="noopener">${esc(b.title)}</a>`:esc(b.title)}<div class="small muted">${esc(billLabel(b.id))}${b.versions?.length?`; also ${b.versions.map(k=>esc(billLabel(k))).join(', ')}`:''}</div>${who.length?`<div class="small"><b>Sponsors and cosponsors here:</b> ${who.join(', ')}</div>`:''}${b.stated?.length?`<div class="small"><b>Said so publicly</b> (half a vote each)${['support','oppose'].map(pos=>{const l=b.stated.filter(st=>st.pos===pos).map(st=>`${byId[st.person]?`<a href="#${st.person}-pvp">${esc(byId[st.person].short||byId[st.person].name)}</a>`:esc(st.person)}${st.src?` <a href="${esc(st.src.u)}" target="_blank" rel="noopener" title="${esc(st.src.t)}">↗</a>`:''}`);return l.length?` · <b>${pos==='support'?'for':'against'}:</b> ${l.join(', ')}`:'';}).join('')}</div>`:''}</td>
      <td class="r">${billScoreBadge(b)}${b.status!=='scored'?`<div class="small muted">${esc(BILL_STATUS[b.status]||'')}</div>`:''}</td>
      <td class="small">${b.gains||b.access?`<b>${signed(b.gainsPart)}</b>${b.gains?`<div><b>Money (${signed(b.moneyPart)}):</b> ${esc(GAINS_STEPS[b.gains.step])}. ${esc(b.gains.why)}${srcLink(b.gains)}</div>`:''}${b.access?`<div><b>Access (${signed(b.accessPart)}):</b> ${esc(ACCESS_STEPS[b.access.step])}. ${esc(b.access.why)}${srcLink(b.access)}</div>`:''}`:'<span class="muted">No who-gains study on file.</span>'}</td>
      <td class="small">${b.sides?.length?`<b>${signed(b.sidesPart)}</b><ul class="list">${b.sides.map(p=>`<li><b>${esc(BILL_GROUPS[p.group]?.org||p.group)} ${POS_WORD[p.pos]}</b> (${BILL_GROUPS[p.group]?.side==='worker'?'worker side':'business side'}${p.date?', '+esc(p.date):''}). ${esc(p.why)}${srcLink(p)}</li>`).join('')}</ul>`:'<span class="muted">No group positions on file.</span>'}</td>
      <td class="small"><div data-lob="${esc(b.id)}"><span class="muted">Lobbying: checking…</span></div>${b.context?.cbo?`<div><b>CBO:</b> ${esc(b.context.cbo.why)}${srcLink(b.context.cbo)}</div>`:''}${b.context?.note?`<div><b>Note:</b> ${esc(b.context.note.why)}${srcLink(b.context.note)}</div>`:''}${b.context?.whiteHouse?`<div><b>White House:</b> ${esc(POS_WORD[b.context.whiteHouse.pos]||b.context.whiteHouse.pos)}. ${esc(b.context.whiteHouse.why||'')}${srcLink(b.context.whiteHouse)}</div>`:''}</td></tr>`;}).join('')}</tbody></table></div>
    <p class="small muted"><b>Bills that didn't pass</b> count too: sponsoring or cosponsoring one counts like a yes vote, a cited public statement counts half, and a bill counts once across its versions. Cosponsors come from Congress.gov. <b>Lobbying</b> comes from LDA.gov reports that name the bill, in the two years of its Congress. A report says a client lobbied on the bill, not which side it was on, so it's shown here and never scored. Unions are counted by the client's name.</p></div>`;
}
// Fills each bill's lobbying line from the daily refresh (/api/bills), or says the update service isn't running.
async function mountBillLobbying(host){
  const els=[...host.querySelectorAll('[data-lob]')];if(!els.length)return;
  let lob=null;try{const r=await fetch('/api/bills',{cache:'no-cache'});if(r.ok)lob=(await r.json()).lobbying||{};}catch{}
  const yrs=id=>{const c=Number(id.split('-')[0]),y=1787+2*c;return `${y}–${String(y+1).slice(2)}`;};
  for(const el of els){const x=lob?.[el.dataset.lob],id=el.dataset.lob;
    el.innerHTML=!lob?'<span class="muted">Lobbying counts need the update service running.</span>':!x?'<span class="muted">Lobbying: not checked yet.</span>'
      :`<b>Lobbying (${yrs(id)}):</b> ${x.atLeast?'At least ':''}${x.total.toLocaleString()} report${x.total===1?'':'s'} name it.${x.read?` Of the ${x.read} read, ${x.unions} ${x.unions===1?'was':'were'} filed for unions and ${x.others} for companies and other groups.`:''}${x.unionClients?.length?` Unions: ${esc(x.unionClients.slice(0,4).join(', '))}.`:''}`;}
}
// The Corporation Compromised Index 🏢 on the People First tab: its parts, what each is built from, and what's missing.
const CCI_PART={pacShare:'Business PACs\' share of funds raised',employees:'Donor companies\' employees',businessVotes:'Votes with business funders',lobbiedBills:'Profit side on lobbied bills'};
function cciBlock(s,v){
  const c=v.cci;if(!c||s.office)return '';
  const C=CORP_COMPROMISED,m=c.money,bv=c.votes,wt=k=>c.weights?.[k]!=null?`${Math.round(c.weights[k]*100)}% of the index`:'Not counted yet';
  if(c.index==null)return `<div class="chart"><h3>Corporation Compromised Index 🏢</h3><p class="small muted">${esc(c.why)}, so it isn't counted.</p></div>`;
  const W=C.weights,pc=k=>Math.round(c.parts[k]);
  // The index itself: the parts on file, reweighted.
  const indexHow=`${Math.round(W.pacShare*100)}% PAC share + ${Math.round(W.employees*100)}% employees + ${Math.round(W.businessVotes*100)}% business-funder votes + ${Math.round(W.lobbiedBills*100)}% lobbied bills. A part without data drops out and the rest are reweighted.<div class="ix-f">${c.used.map(k=>`${(c.weights[k]).toFixed(2).replace(/0$/,'')} × ${pc(k)}`).join(' + ')} = <b>${c.index}</b></div><div class="ix-f">In this grade: 0.25 × (100 − ${c.index}) = ${fmt1(0.25*(100-c.index))} of 25 points.</div>`;
  const pacHow=m?(m.pacTotal?`Business PACs' money ÷ funds raised; ${C.pacCeiling}% or more scores 100. Business PACs: companies', trade associations' and cooperatives' (by FEC type, or by name until matched).<div class="ix-f">${fmtFull(m.rowsBusiness)} ÷ ${fmtFull(m.rowsTotal)} (business share of the itemized PAC money) × ${fmtFull(m.pacTotal)} (the cycle's PAC total) = ${fmtFull(Math.round(m.businessPac))}</div><div class="ix-f">${fmtFull(Math.round(m.businessPac))} ÷ ${fmtFull(m.receipts)} = ${fmt1(c.share)}%; ${fmt1(c.share)} ÷ ${C.pacCeiling} × 100 = <b>${pc('pacShare')}</b>${c.share>C.pacCeiling?' (capped)':''}</div>`
    :`Business PACs' money ÷ funds raised; ${C.pacCeiling}% or more scores 100.<div class="ix-f">No PAC money in ${fmtFull(m.receipts)} raised = <b>0</b></div>`):'';
  const voteHow=`Their rate of voting the way business funders that gave to the campaign wanted − their party's rate on the same votes, averaged by money given. ${C.voteCeiling} points above scores 100; at or below the party scores 0. Needs 5 compared votes.`
    +(c.parts.businessVotes!=null?`<div class="ix-f">${fmt1(bv.diff)} ÷ ${C.voteCeiling} × 100 = <b>${c.parts.businessVotes}</b>${bv.diff>C.voteCeiling?' (capped)':bv.diff<=0?' (at or below the party: 0)':''} · ${bv.n} votes</div>`:`<div class="ix-f">${bv?.rows?.length?`${bv.n} of 5 compared votes`:'No business funder took a side on their votes'}: not counted</div>`);
  return `<div class="chart"><h3>Corporation Compromised Index 🏢</h3><div class="sub">How much of their campaign money comes from businesses' PACs, and how much more often they vote with business funders than their party does. Higher means more. It is a quarter of this grade, as 100 minus the index.</div>
    <div class="cx-stats ix-row">
      ${ixCard({icon:'🏢',name:'Corporation Compromised Index',value:c.index,score:c.index,tone:'bad',about:`From ${c.used.length} of its 4 parts. Higher means more reliance on, and siding with, business money.`,how:indexHow})}
      ${ixCard({name:CCI_PART.pacShare,value:c.parts.pacShare==null?'—':pc('pacShare'),score:c.parts.pacShare,tone:'bad',about:`${c.share!=null?`${fmt1(c.share)}% of the money raised${m?.start?`, ${period(m.start,m.end)}`:''}`:'No campaign money on file'}. ${wt('pacShare')}.`,how:pacHow})}
      ${ixCard({name:CCI_PART.businessVotes,value:c.parts.businessVotes??'—',score:c.parts.businessVotes,tone:'bad',about:`${c.parts.businessVotes!=null?`${bv.diff>=0?fmt1(bv.diff)+' points more':fmt1(-bv.diff)+' points less'} often than their party, on ${bv.n} votes`:'Not counted'}. ${wt('businessVotes')}.`,how:voteHow})}
      ${ixCard({name:CCI_PART.employees,value:'—',about:'Not counted yet: the top donor organizations\' employee giving comes from the daily refresh and isn\'t reviewed.',how:`Giving by employees of the companies among their top 20 donor organizations ÷ funds raised; ${C.employeeCeiling}% or more scores 100.`})}
      ${ixCard({name:CCI_PART.lobbiedBills,value:'—',about:'Not counted yet: lobbying on each bill comes from the refresh and isn\'t reviewed.',how:`Of the People First bills a top donor organization lobbied on, the share where they took the Profit side. Needs ${C.minLobbied} such bills.`})}
    </div>
    ${points([['Business funders','The Chamber of Commerce, NFIB, Americans for Prosperity, Club for Growth, and industries\' associations (bankers, mortgage bankers, community banks, Realtors, drug makers, hospitals, credit unions, the crypto industry\'s Fairshake).'],['Left out','Outside spending, which candidates can\'t control.']],'small')}</div>`;
}
function pvpTable(s,v){
  return v.scored.length?`<div class="tablewrap"><table><thead><tr><th>Bill</th><th>${esc(s.short)}</th><th class="r">Bill score</th><th>Delivered more for</th><th class="r">Points</th><th>Why the bill scores this way</th></tr></thead><tbody>${v.scored.map(a=>{const mk=PVP_MARKS.get(a.bill)||{},u=billUrl(a.bill);return `<tr><td>${u?`<a href="${u}" target="_blank" rel="noopener">${esc(mk.title||billLabel(a.bill))}</a>`:esc(mk.title||a.bill)}<div class="small muted">${esc(billLabel(a.bill))}</div></td><td>${esc(PVP_DID[a.kind](a.pos))}${a.kind==='statement'&&a.ref?` <a href="${esc(a.ref)}" target="_blank" rel="noopener">source ↗</a>`:''}${a.via&&a.via!==a.bill?`<div class="small muted">${esc(billLabel(a.via))}</div>`:''}</td><td class="r">${billScoreBadge(mk)}</td><td><b class="${a.took==='people'?'gr-A':'gr-F'}">${PVP_SIDE[a.took]}</b></td><td class="r">${a.points}</td><td class="small">${billWhyShort(mk)}</td></tr>`}).join('')}</tbody></table></div><p class="small muted">Every bill on file, with all its evidence and who lobbied on it: <a href="#scores-pvp">People First scores</a>.</p>`
    :`<div class="note">${PVP_MARKS.size?`${esc(s.short)} has no recorded ${s.office?'signing, veto or executive order':'vote or sponsorship'} on any of the ${PVP_MARKS.size} scored bill${PVP_MARKS.size===1?'':'s'}.`:`<b>No bills are scored yet.</b>${points([['When a bill counts','Once a nonpartisan study of who gains from it is cited, or worker and business groups took opposite sides on it.'],['What will show here','Each scored vote and sponsorship, the side it took, and the evidence behind the bill.']])}`}</div>`;
}
function panePvp(s,pane){
  const v=personPvp(s);
  const detail=v.pct!=null?`${v.nPeople} of ${v.n} scored actions delivered more for working people; ${v.nProfit} more for the wealthy and corporations.`:!PVP_MARKS.size?'No bills have been scored yet, so no one has this grade.':v.n?`${v.n} of the ${MIN_PVP_ACTIONS} scored actions a grade needs.`:`None of ${esc(s.short)}'s recorded ${s.office?'bill signings, vetoes or executive orders':'votes or sponsorships'} is on a scored bill yet.`;
  const billMath=`working-people points ÷ all points = ${v.people} ÷ (${v.people} + ${v.profit}) = ${v.billsPct}%`;
  const math=v.pct==null?'':v.blended?`<p class="small gh-m"><b>How it was calculated:</b> the bills, ${billMath}, count three quarters; 100 minus the Corporation Compromised Index 🏢 (${v.cci.index}) counts one quarter: 0.75 × ${v.billsPct} + 0.25 × ${100-v.cci.index} = ${fmt1(v.raw)}, rounded to <b>${v.pct}%</b>. Each ${s.office?'signing, veto or order':'vote or sponsorship'} counts its bill's strength (a +75 bill counts 0.75), and a bill counts once.</p>`
    :`<p class="small gh-m"><b>How it was calculated:</b> ${billMath.replace(/ = (\d+)%$/,' = <b>$1%</b>')}. Each ${s.office?'signing, veto or order':'vote or sponsorship'} counts its bill's strength (a +75 bill counts 0.75), and a bill counts once.${v.cci?.why?` The Corporation Compromised Index 🏢 isn't counted: ${esc(v.cci.why.toLowerCase())}.`:''}</p>`;
  const table=pvpTable(s,v);
  pane.innerHTML=`${gradeHead('People First',v.pct,detail,gradeRule('pvp'),math+monthlyNote(s,'pvp',v.pct))}
  <div class="chart"><h3>Who the record delivered more for</h3><div class="sub"><b>Right of 50%:</b> leans toward working people. <b>Left:</b> leans toward the wealthy and corporations. <a href="#scores-pvp">Everyone on one chart</a></div>
    ${divergingRows([{label:s.name,sub:`${v.people} points for working people · ${v.profit} for the wealthy and corporations`,value:v.pct,cls:v.pct==null?'':'gr-'+letter(v.pct),note:v.pct==null?`${v.n} of ${MIN_PVP_ACTIONS} scored actions`:`${v.n} scored actions`}])}</div>
  ${cciBlock(s,v)}
  <h3 style="margin:18px 0 8px">${s.office?'Scored bills signed or vetoed, and executive orders':'Scored votes and sponsorships'}</h3>${table}
  <p class="note"><a href="#${s.id}-connections">Explore funders, donor alignment and money/vote histories →</a></p>`;
  hoverTips(pane);
  bindTips(pane);
}

// The votes, bills and actions behind the match, kept in separate, labeled sections by kind of record.
// Committee seats, full committees first with their subcommittees beneath, and the sectors each one oversees.
function committeeBlock(s){
  const list=committeesOf(s), info=id=>COMMITTEES.committees[id]||{name:id};if(!list.length)return '';
  const full=[...new Set(list.map(c=>fullCommittee(c.id)))], seat=id=>list.find(c=>c.id===id);
  return `<section class="recsec" id="rec-cmte"><div class="kicker">Committee assignments</div><h3 style="margin-top:4px">Committees in the ${COMMITTEES.congress}th Congress</h3>
  <div style="margin:0 0 8px">${points([['Source',`The <a href="${esc(COMMITTEES.source)}" target="_blank" rel="noopener">congress-legislators</a> project, checked ${fmtDate(COMMITTEES.checked)}.`],['Colored tags','The sectors each committee oversees.'],['Why it matters','A stock trade in one of these sectors counts as a committee conflict in the Insider Trading Index, on the Integrity tab. The sector list is a draft under review.']],'small')}</div>
  <ul class="list small cmte">${full.map(id=>{const c=seat(id),i=info(id),sec=(COMMITTEE_SECTORS[id]||{}).sectors||[],subs=list.filter(x=>x.id!==id&&fullCommittee(x.id)===id);
    return `<li>${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.name)} ↗</a>`:esc(i.name)}${c&&c.title?` <span class="chip ghost">${esc(c.title)}</span>`:''}${c?'':' <span class="small muted">(subcommittee seat only)</span>'}${sec.map(x=>` <span class="chip warn">${esc(x)}</span>`).join('')}${subs.length?`<div class="muted">Subcommittees: ${subs.map(x=>esc(info(x.id).name)+(x.title?` (${esc(x.title)})`:'')).join('; ')}</div>`:''}</li>`;}).join('')}</ul></section>`;
}
// Position by issue: where the record sits between liberal and conservative in each category (public/lean.js).
// Context only, never part of a grade.
function positionBlock(s){
  const cats=positionByCategory(ISS,s.evidence),shown=cats.filter(c=>c.status==='placed'||c.status==='none');
  const names=st=>cats.filter(c=>c.status===st).map(c=>c.label);
  const kind=c=>c.record?(c.stated?'actions and statements':c.n===1?'action':'actions'):c.n===1?'statement':'statements';
  const value=c=>c.lean===0?'Even':`${Math.max(c.lib,c.con)} of ${c.n}`,side=c=>c.lean===0?`${c.lib} each side`:c.lean>0?'liberal':'conservative';
  // The issues behind each category, unless the only one has the category's own name.
  const sub=c=>{const t=c.issues.map(i=>i.label).join(' · ');return t.toLowerCase()===c.label.toLowerCase()?'':t;};
  const rows=shown.map(c=>c.status==='none'?{label:c.label,sub:sub(c),lean:null,empty:'No record yet'}:
    {label:c.label,sub:sub(c),lean:c.lean,value:value(c),note:side(c),light:!c.record,
      tip:`${c.label}: of ${c.n} ${kind(c)}, ${c.lib} on the liberal side and ${c.con} on the conservative side${c.record?'':' (statements only, counted at half)'}`});
  if(!shown.some(c=>c.status==='placed'))return `<section class="recsec" id="rec-pos"><div class="kicker">Issue by issue</div><h3 style="margin-top:4px">Position by issue</h3><p class="small muted">No votes, bills or statements on the tracked issues yet for ${esc(s.short)}.</p></section>`;
  return `<section class="recsec" id="rec-pos"><div class="kicker">Issue by issue</div><h3 style="margin-top:4px">Position by issue</h3>
    ${points([['How to read it','A bar to the left means more of the record is on the liberal side of that issue, and to the right the conservative side. The longer the bar, the more consistent the record. A short bar near the center means a mixed record.'],['Based on','Votes, sponsored bills and official acts on each issue, one credit per bill. Statements count at half, and only where there is no recorded action (paler bars).'],['Context only','Never part of a grade. Which side of each issue counts as liberal is listed on the <a href="#method">Methodology</a> page.']],'small')}
    ${leanRows(rows)}
    ${points([names('unsided').length&&['Not on the scale',`${esc(names('unsided').join(', '))}. Their issues split both parties, so they aren't marked liberal or conservative.`],names('untracked').length&&['Not tracked yet',esc(names('untracked').join(', '))+'.']],'small')}
    ${tableView(['Category','Liberal side','Conservative side','Based on'],shown.map(c=>[esc(c.label),c.status==='placed'?c.lib:'—',c.status==='placed'?c.con:'—',c.status==='placed'?`${c.n} ${kind(c)}`:'No record yet']))}</section>`;
}
function recordInto(s,host){
  const inc=!s.cand;
  const SV=inc?(s.chamber==='S'?DATA.votes:[]):(s.senateVotes?DATA.votes.filter(v=>s.id in v.pos):[]);
  const HV=inc?(s.chamber==='H'?DATA.hvotes:[]):(s.ideoKind==='house'?DATA.hvotes.filter(v=>s.id in v.pos):[]);
  const ev=evidenceOf(s);
  const jump=[SV.length&&['rec-sv','Senate votes'],HV.length&&['rec-hv','House votes'],!inc&&['rec-other',recordHeading(s)],committeesOf(s).length&&['rec-cmte','Committees'],s.stateRecord&&['rec-state','State legislative record'],['live-records','Latest official records']].filter(Boolean);
  host.innerHTML=`
  <h2 id="m-record" style="margin-top:34px">Votes, committees & official actions</h2>
  <p class="intro">${inc?`${esc(s.short)}'s positions on consequential ${CH[s.chamber].name} roll calls, sponsored bills`:esc(REC_LABEL[s.recordType]||'')+'. '+esc({member_of_congress:'Positions on key House roll calls and notable sponsored bills',senator:'Positions on key Senate roll calls and notable sponsored bills',former_member_of_congress:'Votes and bills from '+s.short+"'s time in Congress",state_legislator:'Recorded votes and bills from '+s.short+"'s time in a state legislature",executive:'No legislative votes in executive office; major official actions are listed instead',none:'No legislative voting record; documented public actions and commitments are listed instead'}[s.recordType]||'')}${hasStateLeg(s)&&s.recordType!=='state_legislator'?', a separate state legislative record':''}. Each item links to its source. Your match uses the coded evidence from these records.</p>
  <div class="note" style="margin-bottom:12px"><b>Evidence available:</b> ${esc(ev.label)}.</div>
  <nav class="jump small">${jump.map(([k,l])=>`<a href="#${k}">${esc(l)}</a>`).join('')}</nav>
  ${keyVotesBlock(s,SV,'Key U.S. Senate votes','rec-sv')}
  ${keyVotesBlock(s,HV,'Key U.S. House votes','rec-hv')}
  ${inc?'':
  `<section class="recsec" id="rec-other"><div class="kicker">${esc(recordKicker(s))}</div><h3 style="margin-top:4px">${esc(recordHeading(s))}</h3>
    <div>${s.record.map(r=>`<div class="vote"><div class="d">${esc(r.date||'')}</div><div><div class="t">${esc(r.title)}</div><div class="s">${esc(r.detail)}</div><div class="s muted">${esc(r.area||'')}${r.src?` · <a href="${esc(r.src.u)}" target="_blank" rel="noopener">${esc(r.src.t)} ↗</a>`:''}${(r.more||[]).map(m=>` · <a href="${esc(m.u)}" target="_blank" rel="noopener">${esc(m.t)} ↗</a>`).join('')}</div></div><div class="pos"><span class="chip ${posClass(r.position)}">${esc(r.position||'')}</span></div></div>`).join('')}</div></section>`}
  ${committeeBlock(s)}
  <div id="rec-state">${stateRecordBlock(s)}</div>
  <section id="live-records" style="margin-top:28px"></section>`;
  host.querySelectorAll('#rec-sv,#rec-hv').forEach(sec=>{const V=sec.id==='rec-sv'?SV:HV;const f=sec.querySelector('[data-vf]'),L=sec.querySelector('[data-vl]');
    const draw=a=>{L.innerHTML=V.filter(v=>!a||v.area===a).slice().sort((x,y)=>y.date.localeCompare(x.date)).map(v=>{const p=v.pos[s.id]||'—';return `<div class="vote"><div class="d">${v.date}</div><div><div class="t"><a href="${voteUrl(v)}" target="_blank" rel="noopener">${esc(v.short)}</a></div><div class="s">${esc(v.issue)} · ${esc(v.result)}</div><div class="s muted">${esc(v.area)}</div><div class="s" style="margin:4px 0">${leanTag(v)}</div>${billDetails(v)}</div><div class="pos">${voteText(v,p)}</div></div>`}).join('');};
    draw('');f.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;f.querySelector('.active').classList.remove('active');b.classList.add('active');draw(b.dataset.a);});});
  host.querySelectorAll('.jump a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const t=document.getElementById(a.getAttribute('href').slice(1));if(t)t.scrollIntoView({behavior:'smooth',block:'start'});}));
  bindTips(host);
  window.RecordLive.profile(s,host.querySelector('#live-records'),['crs','official-acts','stateBills','committees','votes']);
}

// ---------- Promises Delivered tab: the grade, then every statement check behind it ----------
// For a president: PolitiFact's promise trackers, each tally as a bar, with sourced examples of each rating.
const PF_RATING={kept:['good','✓','Promise Kept'],compromise:['warn','◐','Compromise'],broken:['crit','✕','Promise Broken'],stalled:['neutral','…','Stalled'],inTheWorks:['neutral','…','In the Works']};
function trackerBlock(s){
  const T=s.promiseTrackers||[];if(!T.length)return '';
  const seg=(n,col)=>n?`<i style="flex:${n};background:${col}"></i>`:'';
  return `<h2 id="p-trackers" style="margin-top:6px">PolitiFact promise trackers</h2>
  <p class="intro">${esc(s.short)}'s promise grade uses PolitiFact's own ratings.</p>${points([['What PolitiFact checks',`Each campaign promise against what happened, including the executive orders and bills ${esc(s.short)} signed or vetoed.`],['How each rating counts','Promise Kept 1, Compromise ½, Promise Broken 0. The same as the checks on other profiles.'],['Not counted yet','Stalled and In the Works. They wait for a final rating.']])}
  ${T.map(t=>{const c=t.counts,rated=(c.kept||0)+(c.compromise||0)+(c.broken||0),waiting=(c.stalled||0)+(c.inTheWorks||0);
    return `<div class="chart pf-tracker"><h3>${esc(t.name)} <span class="muted" style="font-weight:600">· ${esc(t.term)}</span></h3>
    <div class="sub">${esc(t.rater)} · ratings ${t.final?'':'as of '}${esc(t.asOf)} · <a href="${esc(t.url)}" target="_blank" rel="noopener">Every promise on PolitiFact ↗</a></div>
    <div class="hc-seg pf-bar" role="img" aria-label="${esc(`${t.name}: ${c.kept||0} kept, ${c.compromise||0} compromise, ${c.broken||0} broken${waiting?`, ${waiting} stalled or in the works`:''}`)}">${seg(c.kept,'var(--good)')}${seg(c.compromise,'var(--warn)')}${seg(c.broken,'var(--crit)')}${seg(c.stalled,'var(--muted)')}${seg(c.inTheWorks,'var(--line-2)')}</div>
    <ul class="pf-tally">${['kept','compromise','broken','stalled','inTheWorks'].filter(k=>c[k]!=null).map(k=>{const [cls,ic,lab]=PF_RATING[k];return `<li><span class="chip ${cls}">${ic} ${lab}</span><b class="num">${c[k]}</b></li>`}).join('')}</ul>
    <p class="small muted" style="margin:6px 0 0">${esc(t.about)} <b>Counted here:</b> ${rated} with a final rating${waiting?`; ${waiting} not counted yet`:''}.</p>
    ${t.examples?.length?`<h4 style="margin:14px 0 6px">Examples</h4><ul class="pf-ex">${t.examples.map(x=>{const [cls,ic,lab]=PF_RATING[x.rating];return `<li><span class="chip ${cls}">${ic} ${lab}</span><div><b>${esc(x.title)}</b><div class="small" style="color:var(--ink-2);margin-top:2px">${esc(x.did)}</div><div class="small" style="margin-top:2px">${x.action?`<a href="${esc(x.action.u)}" target="_blank" rel="noopener">${esc(x.action.t)} ↗</a> · `:''}<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.urlT||'PolitiFact rating')} ↗</a></div></div></li>`}).join('')}</ul><p class="small muted" style="margin:6px 0 0">A sample of the ratings. The tally above counts all ${rated+waiting} promises.</p>`:''}
    <p class="small" style="margin:8px 0 0"><b>Source:</b> <a href="${esc(t.src.u)}" target="_blank" rel="noopener">${esc(t.src.t)} ↗</a>${t.also?` · <a href="${esc(t.also.u)}" target="_blank" rel="noopener">${esc(t.also.t)} ↗</a>`:''}</p></div>`}).join('')}`;
}
// Under a money pledge (a statement tagged "pledge"): what the records on file show now (public/pledges.js). Shown only;
// the reviewed verdict above it is the one the Promise score counts.
const PLEDGE_CHIP={kept:['good','✓'],'not-kept':['crit','✕'],mixed:['warn','◐'],against:['warn','◐'],waiting:['neutral','…'],none:['neutral','…']};
function pledgeBlock(s,x){
  const c=pledgeCheck(DATA,s,x);if(!c)return '';
  const [cls,icon]=PLEDGE_CHIP[c.outcome];
  // Only the reports on file are read, so "after the pledge" names the dates they cover.
  const when=c.span?`in the ${c.span.n} report${c.span.n===1?'':'s'} on file${c.since?' after the pledge':''} (${period(c.span.start,c.span.end)})`:c.since?`in the reports on file after ${fmtDate(c.since)}`:'in the reports on file';
  const pacList=rows=>{const top=rows.slice().sort((a,b)=>b.amount-a.amount);
    return `<ul class="list small" style="margin:4px 0 0">${top.slice(0,6).map(r=>`<li>${orgName(r.name,ORGS.about(r.name,'pac'))}: ${fmtFull(r.amount)}${r.report?` (${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.report)} ↗</a>`:esc(r.report)})`:''}</li>`).join('')}${top.length>6?`<li>${top.length-6} more, on the Money &amp; Influence tab</li>`:''}</ul>`;};
  let body;
  if(c.totals){
    const corp=c.kind==='corporate-pac',n=c.counted.after.length;
    body=points([
      [corp?'Company PACs':'Ideological PACs',`${n?`${fmtFull(c.totals.after)} from ${n} contribution${n===1?'':'s'} ${when}`:`none ${when}`}${corp?'. These are PACs the FEC records as sponsored by a corporation.':'. These are PACs in this app\'s "ideological, single-issue and advocacy" sector, assigned from their names.'}${n?pacList(c.counted.after):''}`],
      c.totals.during?['In the report covering the pledge date',`${fmtFull(c.totals.during)}. A report can't be split by day, so it is shown here and decides nothing.`]:null,
      c.totals.beside?['Trade and membership groups\' PACs',`${fmtFull(c.totals.beside)} ${when}. Listed, not counted: they are funded by a group's members, not by one company.`]:null,
      c.totals.unknown?['No FEC type on file yet',`${fmtFull(c.totals.unknown)} from ${c.unknown.after.length+c.unknown.during.length} contribution${c.unknown.after.length+c.unknown.during.length===1?'':'s'} ${when}. These PACs haven't been matched to their FEC registration yet, so a company's PAC can't be told apart from a trade group's.`]:null,
      ...c.bundled.map(b=>[`Bundled through ${esc(b.org)}`,`${fmtFull(b.amount)} ${b.when==='undated'?'(the months weren\'t saved, so it decides nothing)':b.when==='during'?'in the month of the pledge (decides nothing)':b.when}. <a href="${esc(b.src)}" target="_blank" rel="noopener">FEC ↗</a>`]),
      c.refunded.length?['Returned',c.refunded.map(r=>`${esc(r.name)} ${fmtFull(r.amount)}`).join('; ')+', not counted.']:null,
      ['How it\'s checked',`Each FEC report that starts on or after the pledge date counts${c.since?'':' (here, every report on file, because the statement covers the whole campaign)'}. ${corp?'Only PACs sponsored by a corporation count; leadership PACs, unions and trade groups don\'t.':'Gifts a group bundled from its donors through its PAC count too.'}`]],'small');
  }else{
    const a=c.actions;
    body=a.length?`<ul class="list small" style="margin:4px 0 0">${a.map(r=>`<li><b>${r.way==='for'?'Backed':'Against'}:</b> ${esc(r.what)} ${esc(r.measure)}, ${esc(r.title)}${r.date?` (${fmtDate(r.date)})`:''}. <a href="${esc(r.src.u)}" target="_blank" rel="noopener">${esc(r.src.t)} ↗</a></li>`).join('')}</ul>`
      :`<p class="small" style="margin:4px 0 0">No sponsorship, cosponsorship or vote on the ${c.bills.length} bill${c.bills.length===1?'':'s'} on file for this.</p>`;
    body+=points([['How it\'s checked',`Sponsoring, cosponsoring or voting for one of the bills on the Bills page that would ${c.kind==='stock-trading'?'ban or limit members\' stock trading':c.kind==='lobbying'?'ban lobbying by former members':'overturn Citizens United'} counts as backing it. A vote against one is weighed with the reason given (for example, a section the bill carried on something else), so it is reviewed rather than counted as a broken pledge.`]],'small');
  }
  return `<div class="note small" style="margin-top:12px"><div class="k" style="margin-bottom:6px"><b>Checked against the records on file · ${esc(c.label)}</b> <span class="chip ${cls}">${icon} ${esc(c.outcomeLabel)}</span></div>${body}
    ${c.conflict?`<p class="small" style="margin:8px 0 0"><b>Flagged for review:</b> the records point the other way from the reviewed verdict above. The reviewed verdict is still the one counted until it's checked again.</p>`:''}
    <p class="small muted" style="margin:6px 0 0">Shown only. The verdict above is the reviewed one, and it is the one the grade counts.</p></div>`;
}
function panePromises(s,pane,{embedded=false,bare=false}={}){
  const pr=SCORER.promises(s), out=pr.notCounted, pf=!!(s.promiseTrackers||[]).length;
  const detail=pf&&pr.pct!=null?`${pr.kept} of ${pr.clear} promises with a final PolitiFact rating kept, ${pr.half} compromises, ${pr.broken} broken.`:pr.pct!=null?`${pr.kept} of ${pr.clear} clear checks kept${pr.half?`, ${pr.half} partly kept or changed over time`:''}${pr.broken?`, ${pr.broken} contradicted by the record`:''}.`:pr.total?`${pr.clear} clear check${pr.clear===1?'':'s'} so far; a grade needs ${MIN_CHECKS}.`:'No statements checked yet.';
  const bar=pr.pct!=null?`<div class="hc-seg gh-bar" aria-hidden="true">${pr.kept?`<i style="flex:${pr.kept};background:var(--good)"></i>`:''}${pr.half?`<i style="flex:${pr.half};background:var(--warn)"></i>`:''}${pr.broken?`<i style="flex:${pr.broken};background:var(--crit)"></i>`:''}</div>`:'';
  const math=pf&&pr.pct!=null?`<p class="small gh-m"><b>How it was calculated:</b> (${pr.kept} kept + ${pr.half} × ½ compromise) ÷ ${pr.clear} promises with a final rating = <b>${pr.pct}%</b>.${out?` ${out} Stalled or In the Works ${out===1?'is':'are'} not counted yet.`:''}</p>`
    :pr.pct!=null?`<p class="small gh-m"><b>How it was calculated:</b> (${pr.kept} kept${pr.half?` + ${pr.half} × ½ partly kept or changed`:''}) ÷ ${pr.clear} clear checks = <b>${pr.pct}%</b>.${out?` ${out} ambiguous or outcome check${out===1?' is':'s are'} listed below but not counted.`:''}</p>`:'';
  pane.innerHTML=`
  ${bare?'':embedded?`<div class="chart"><h3>Promise index · Honesty</h3><p class="small">${esc(detail)} ${pr.pct==null?'Not graded until at least three checks count.':`Honesty: ${pr.pct}%.`}</p>${bar}${math}</div>`:gradeHead('Promises Delivered',pr.pct,detail,gradeRule('prom'),bar+math+monthlyNote(s,'promises',pr.pct))}<div class="page-eyebrow">WHAT WAS SAID → WHAT THE RECORD SHOWS</div>
  ${trackerBlock(s)}
  ${bare?'':`<section class="consistency-block" id="statement-consistency" aria-label="Statement–action consistency"></section>`}
  ${pf&&!s.statements.length?'':`<details class="consistency-legacy"${bare?' open':''}><summary>Every promise check (${s.statements.length})</summary><p class="intro">Each check pairs something ${esc(s.short)} said or promised with what the record shows. The label rates that match, not whether the policy is good.</p>
  <dl class="legendlist small">
    <div><dt><span class="chip good">✓ Consistent</span></dt><dd>The action matches the statement.</dd></div>
    <div><dt><span class="chip crit">✕ Direct contradiction</span></dt><dd>The record directly conflicts with what was said.</dd></div>
    <div><dt><span class="chip warn">◐ Partly consistent</span></dt><dd>Part of the record matches the statement, and part conflicts with it.</dd></div>
    <div><dt><span class="chip neutral">? Ambiguous or incomplete evidence</span></dt><dd>The statement and the action point different ways, but whether they conflict depends on how you read them. Or the evidence is incomplete.</dd></div>
    <div><dt><span class="chip serious">↻ Changed position</span></dt><dd>A clear or admitted reversal over time.</dd></div>
    <div><dt><span class="chip neutral">◇ Outcome check</span></dt><dd>The action fit the reasons given at the time, but later events bear on it.</dd></div>
    <div><dt><span class="chip neutral">… No related bill yet</span></dt><dd>Nothing has come up to act on yet. Not counted until something does.</dd></div>
  </dl>
  <div style="margin:0 0 10px">${points([['How each check counts','Consistent 1. Partly consistent or changed ½. Contradicted 0.'],['Not acted on',`A promise ${esc(s.short)} could have acted on but didn't by the end of the term is closed as contradicted.`],['Vague goals',`Such as "fight for families." Listed but never scored.${pr.vague?` ${pr.vague} ${pr.vague>1?'are':'is'} listed below.`:''}`],['Said in debate',`A statement made the day of the vote or the day before ("I rise in support of this bill") nearly always matches the vote that follows, so it is listed but not scored.${pr.debate?` ${pr.debate} ${pr.debate>1?'are':'is'} listed below.`:''}`]],'small')}</div>
  ${s.statements.map(x=>{const [cls,lab]=ASSESS[x.assessment];return `
  <article class="stmt ${x.assessment}">
    <h3>${esc(x.topic)}${x.promise?' <span class="chip ghost">Promise</span>':''}${x.vague?' <span class="chip ghost">Vague goal · not scored</span>':''}${x.debate&&!x.vague?' <span class="chip ghost">Said in debate · not scored</span>':''}</h3>
    <div class="sd">
      <div><div class="k">What was said</div><div>${esc(x.said.text)}</div><div class="src">${esc(x.said.date)} · <a href="${esc(x.said.src.u)}" target="_blank" rel="noopener">${esc(x.said.src.t)} ↗</a></div></div>
      <div><div class="k">What the record shows</div><div>${esc(x.did.text)}</div><div class="src">${esc(x.did.date)} · <a href="${esc(x.did.src.u)}" target="_blank" rel="noopener">${esc(x.did.src.t)} ↗</a></div></div>
    </div>
    ${x.record?`<div class="small" style="margin-top:10px;color:var(--ink-2)"><b>Context:</b> ${esc(x.record)} ${x.recordSrc?`<a href="${esc(x.recordSrc.u)}" target="_blank" rel="noopener">${esc(x.recordSrc.t)} ↗</a>`:''}</div>`:''}
    ${x.unacted?`<div class="small" style="margin-top:10px;color:var(--ink-2)"><b>Not acted on by the end of the term</b>${x.unacted.date?` (${esc(x.unacted.date)})`:''}: ${esc(x.unacted.reason||'')}</div>`:''}
    <div class="verdict"><span class="chip ${cls}">${AICON[x.assessment]} ${lab}</span><div class="note">${esc(x.note)}</div></div>
    ${x.found?`<div class="small" style="margin-top:6px;color:var(--ink-2)">Found by the promise finder in ${esc(FOUND_IN[x.found.source]||'a statement')}, ${x.found.link==='subject'?'linked to the bill by its subject':'which names the bill'}; reviewed ${esc(x.found.reviewed||'')}.</div>`:''}
    ${pledgeBlock(s,x)}
  </article>`}).join('')}</details>`}
  <section id="live-records" style="margin-top:28px"></section>`;
  if(!bare)void mountConsistency(pane.querySelector('#statement-consistency'),s.id);
  window.RecordLive.profile(s,pane.querySelector('#live-records'),['crec-day','hearings','statements','wayback','factcheck','news']);
}

function paneSources(s,pane){
  const list=[];
  list.push({t:'FEC candidate financial summary ('+s.fecCand+')',u:fecCandUrl(s.fecCand)});
  list.push({t:'FEC filings, '+s.cmteName+' ('+s.fecCmte+')',u:`https://docquery.fec.gov/cgi-bin/forms/${s.fecCmte}/`});
  list.push({t:'FEC independent expenditures for this candidate',u:fecIeUrl(s.fecCand)});
  if(s.ideo&&s.ideo.icpsr)list.push({t:'Voteview DW-NOMINATE record',u:`https://voteview.com/person/${s.ideo.icpsr}`});
  if(s.ideoSrc)list.push(s.ideoSrc);
  if(s.statusSrc)list.push(s.statusSrc);
  (s.record||[]).forEach(r=>{if(r.src)list.push(r.src)});
  s.out.cms.forEach(x=>{const m=cmOf(x[0]);if(m[4])list.push({t:m[1]+': affiliation source',u:m[4]})});
  s.pac.filings.forEach(f=>list.push({t:'FEC report '+f.report+' ('+f.start+' to '+f.end+'), Schedule A line 11C',u:f.url}));
  if(s.camp.src)list.push({t:'FEC committee summary, 2025–26: '+(s.camp.cmte||s.fecCmte),u:s.camp.src});
  s.statements.forEach(x=>{list.push(x.said.src);list.push(x.did.src);if(x.recordSrc)list.push(x.recordSrc)});
  s.ethics.forEach(e=>e.sources.forEach(x=>list.push(x)));
  s.bills.forEach(b=>list.push({t:b.num+' — '+b.title,u:b.url}));
  if(s.stateRecord){s.stateRecord.service.forEach(x=>{if(x.src)list.push(x.src)});s.stateRecord.items.forEach(x=>{if(x.src)list.push(x.src)});}
  {const r=raceOf(s);if(r&&r.rating&&r.rating.src)list.push(r.rating.src);}
  const seen=new Set();const uniq=list.filter(x=>x&&x.u&&!seen.has(x.u)&&seen.add(x.u));
  pane.innerHTML=`<h2>Sources for this profile</h2><p class="intro">${uniq.length} distinct records and reports. Roll-call votes link to their official tallies from the Legislative Activity tab; every independent expenditure links to its FEC filing from the Money &amp; Influence tab.</p><ul class="list">${uniq.map(x=>`<li><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)}</a> <span class="small muted mono">${esc(x.u.replace(/^https?:\/\//,'').split('/')[0])}</span></li>`).join('')}</ul>`;
}

// ---------- races ----------
// One race on the Races page: each candidate's photo, name and party over their share of the vote, highest first, then
// the other candidates, the votes counted and the source. A profiled candidate's tile opens their profile.
const numFmt=n=>Number(n).toLocaleString('en-US');
// county: the state's own count (countyTally), shown instead of the count on file when it is as recent or newer.
function resultCard(r,county=null){
  const lite=!r.keys,res=raceResult(r),t=county||tallyOf(r);
  // A results-only nominee who is a sitting senator opens their basic profile; others have no profile yet.
  const who=k=>{if(!lite)return {...byId[k],href:'#'+k};const n=r.nominees.find(x=>nomineeKey(x)===k);return {id:k,name:n.name,party:n.party,href:BASIC[k]||byId[k]?'#'+k:''};};
  const keys=t?t.rows.map(x=>x.key):(r.keys||r.nominees.map(nomineeKey));
  const tile=k=>{const p=who(k),row=t&&t.rows.find(x=>x.key===k),o=outcomeOf(r,k),tag=p.href?'a':'div';
    return `<${tag} class="rc-c${o==='won'?' won':''}"${p.href?` href="${p.href}"`:''}>${portrait(p)}
      <div class="rc-who"><b>${esc(p.name)}</b> <span class="chip ${p.party}">${p.party}</span></div>
      <div class="rc-flag">${o==='won'?resultChip('won'):''}</div>
      <div class="rc-pct">${sharePct(row&&row.pct,t&&t.whole)}</div><div class="small muted">${row&&row.votes!=null?numFmt(row.votes)+' votes':'&nbsp;'}</div></${tag}>`;};
  const others=t?[...t.others.map(o=>`${esc(o.name)}${o.party?` (${esc(o.party)})`:''} ${sharePct(o.pct,t.whole)}`),t.rest?`other candidates and write-ins ${sharePct(t.rest)}`:''].filter(Boolean):[];
  const turnout=!t?'not reported yet':[t.total!=null?`${numFmt(t.total)} votes counted`:'',t.counted].filter(Boolean).map(esc).join(' · ')||'not given in this source';
  // Between the candidates and the map: whether the seat flipped, in the winner's color.
  const ch=res&&res.decided?seatChange(r,who(res.winner)?.party):null;
  const change=ch?`<div class="rc-change ${ch.flip?'flip':'hold'} ${esc(ch.to)}" title="${esc(`Held before the election by ${r.held.by} (${r.held.party})`)}"><b>${esc(ch.label)}</b><span>${esc(ch.detail)}</span></div>`:'';
  return `<article class="race rc">
    <div class="rh"><h3>${esc(r.label)}</h3><span class="small muted">${r.open||lite&&!r.nominees.some(n=>n.incumbent)?'Open seat':'Incumbent ran'}</span></div>
    ${res&&!res.decided?`<p class="small rc-status"><span class="chip warn">Not called yet</span> ${esc(res.how)}</p>`:res?`<p class="small muted rc-status">${esc(res.how||'Race called')} · <a href="${esc(res.src.u)}" target="_blank" rel="noopener">${esc(res.src.t)} ↗</a></p>`:''}
    <div class="rc-cols${change?' has-side':''}"><div class="rc-left">
    <div class="rc-grid">${keys.map(tile).join('')}</div>
    ${others.length?`<p class="small muted" style="margin:0">Also on the ballot: ${others.join(' · ')}</p>`:''}
    <p class="small rc-turnout"><b>Reported turnout:</b> ${turnout}${t&&t.src?` · <a href="${esc(t.src.u)}" target="_blank" rel="noopener">${esc(t.src.t)} ↗</a>`:''}${t&&t.fromState?`, read ${esc(readTime(t.fetched))}`:''}</p>
    </div><aside class="rc-side">${change}<div class="rc-map" data-map="${esc(r.id)}" hidden></div></aside></div>
  </article>`;
}
// ---------- county maps (public/county-results.json, outlines in public/maps/<ST>.json) ----------
// Each county is colored by who leads it, darker the wider the lead; hovering shows its count.
const COUNTY={data:null,maps:{},text:null,poll:null};
const countyData=()=>COUNTY.data??=fetch('/county-results.json',{cache:'no-cache'}).then(r=>r.ok?r.text():null).then(t=>{COUNTY.text=t;return t?JSON.parse(t):null;}).catch(()=>null);
// When the county results were read: "Nov 4, 3:06 PM".
const readTime=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};
const stateMap=st=>COUNTY.maps[st]??=fetch(`/maps/${st}.json`).then(r=>r.ok?r.json():null).catch(()=>null);
const MARGINS=[5,15,30];
const marginBand=m=>MARGINS.filter(x=>m>=x).length;
// One county's count: candidates by votes, each with a share, and the leader's margin over the runner-up in points.
function countyCount(res,votes){
  const rows=res.candidates.map(c=>({...c,votes:votes?.[c.key]||0})).filter(c=>c.votes>0).sort((a,b)=>b.votes-a.votes);
  const total=rows.reduce((a,c)=>a+c.votes,0);
  return {rows,total,lead:rows[0]||null,margin:total&&rows.length?((rows[0].votes-(rows[1]?.votes||0))/total*100):0};
}
function countyMap(res,m){
  const name=res.candidates.reduce((o,c)=>(o[c.key]=c,o),{}),led={};
  const paths=m.counties.map(c=>{const k=countyCount(res,res.counties[c.fips]);
    if(!k.lead)return `<path d="${c.d}" class="cm-none" data-f="${c.fips}"></path>`;
    led[k.lead.key]=(led[k.lead.key]||0)+1;const party=k.lead.key==='other'?'O':(name[k.lead.key]?.party||'I');
    return `<path d="${c.d}" class="cm-${party} cm-m${marginBand(k.margin)}" data-f="${c.fips}"></path>`;}).join('');
  const main=res.candidates.filter(c=>c.key!=='other');
  const summary=main.map(c=>`${c.name} led ${led[c.key]||0}`).join(', ')+` of ${m.counties.length} counties`;
  const swatch=p=>MARGINS.concat(99).map((x,i)=>`<i class="cm-${p} cm-m${i}"></i>`).join('');
  // Every state is drawn in the same box, as large as fits: a tall state is narrower, a wide one shorter.
  return `<div class="cm-box"><svg viewBox="0 0 ${m.width} ${m.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(`County map: ${summary}`)}"><g class="cm-counties">${paths}</g><path class="cm-state" d="${m.outline}"></path></svg></div>
    ${reportingBar(res,m)}
    <div class="cm-legend small">${main.map(c=>`<span><span class="cm-sw">${swatch(c.party)}</span>${esc(c.name.split(' ').at(-1))}</span>`).join('')}<span class="muted">Stronger color: wider lead (under 5, 5–15, 15–30, 30+ points)</span></div>
    <p class="small muted cm-src">${esc(summary)}. County results: <a href="${esc(res.source.u)}" target="_blank" rel="noopener">${esc(res.source.t)} ↗</a>, read ${esc(readTime(res.fetched))}.</p>
    <details class="cm-table small"><summary>All ${m.counties.length} counties</summary><div class="tablewrap"><table><thead><tr><th>County</th>${main.map(c=>`<th>${esc(c.name.split(' ').at(-1))}</th>`).join('')}<th>Others</th><th>Lead</th></tr></thead><tbody>
    ${m.counties.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>{const k=countyCount(res,res.counties[c.fips]),v=res.counties[c.fips]||{};
      return `<tr><td>${esc(c.name)}</td>${main.map(x=>`<td class="num">${k.total?((v[x.key]||0)/k.total*100).toFixed(1)+'%':'—'}</td>`).join('')}<td class="num">${k.total?((v.other||0)/k.total*100).toFixed(1)+'%':'—'}</td><td>${k.lead?`${esc(k.lead.key==='other'?'Other':k.lead.name.split(' ').at(-1))} +${k.margin.toFixed(1)}`:'No votes'}</td></tr>`;}).join('')}
    </tbody></table></div></details>`;
}
// How much has reported, as a bar under the map: the precincts reporting when the state's file says, otherwise the
// counties with any votes in it.
function reporting(res,m){
  const r=res.reporting;
  if(r&&r.of>0)return {n:r.n,of:r.of,unit:r.unit||'precincts'};
  return {n:m.counties.filter(c=>countyCount(res,res.counties[c.fips]).total>0).length,of:m.counties.length,unit:'counties'};
}
function reportingBar(res,m){
  const r=reporting(res,m),p=r.n/r.of*100,shown=p>=99.95&&r.n<r.of?'99.9':p.toFixed(p<10&&p>0?1:p%1?1:0);
  const what=r.unit==='counties'?(m.state==='LA'?'Parishes':'Counties'):r.unit[0].toUpperCase()+r.unit.slice(1);
  return `<div class="cm-rep small"><div class="cm-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.toFixed(1)}" aria-label="${esc(what)} reporting"><i style="width:${p.toFixed(2)}%"></i></div>
    <span>${esc(what)} reporting: <b>${shown}%</b> (${numFmt(r.n)} of ${numFmt(r.of)}${r.unit==='counties'?' with votes':''})</span></div>`;
}
// Hover (or tap) a county for its count.
function bindCountyTips(el,res,m){
  const names=new Map(m.counties.map(c=>[c.fips,c.name]));
  const text=f=>{const k=countyCount(res,res.counties[f]);
    return `${names.get(f)} ${m.state==='LA'?'Parish':'County'}: `+(k.total?k.rows.map(r=>`${r.key==='other'?'Others':r.name} ${(r.votes/k.total*100).toFixed(1)}% (${numFmt(r.votes)})`).join(' · ')+` · lead ${k.margin.toFixed(1)} points`:'no votes reported');};
  const show=e=>{const p=e.target.closest('path[data-f]');if(!p){tip.classList.remove('show');return;}
    tip.textContent=text(p.dataset.f);tip.classList.add('show');
    const x=Math.max(10,Math.min(e.clientX+12,window.innerWidth-310));tip.style.left=x+'px';tip.style.top=(e.clientY+14)+'px';};
  const svg=el.querySelector('svg');svg.addEventListener('mousemove',show);svg.addEventListener('click',show);svg.addEventListener('mouseleave',()=>tip.classList.remove('show'));
}
// Each race with county results gets its map, and its card takes the state's own count when that is the newer one.
async function fillMaps(root){
  const d=await countyData();if(!d?.races)return;
  for(let el of [...root.querySelectorAll('.rc-map[data-map]')]){
    const res=d.races[el.dataset.map];if(!res||!el.isConnected)continue;
    const m=await stateMap(res.state);if(!m||!el.isConnected)continue;
    const race=DATA.races.find(x=>x.id===el.dataset.map)||DATA.liteRaces.find(x=>x.id===el.dataset.map),ct=race&&countyTally(race,res),box=el.closest('[id^="r-"]');
    if(ct&&box){box.innerHTML=resultCard(race,ct);el=box.querySelector('.rc-map');}
    el.innerHTML=countyMap(res,m);el.hidden=false;el.closest('.rc-cols').classList.add('has-side');bindCountyTips(el,res,m);
  }
  // While the Races page is open, look for a new read every two minutes (npm run counties:update -- --watch).
  COUNTY.poll??=setInterval(async()=>{
    const list=$('#rlist');if(!list||document.hidden)return;
    const t=await fetch('/county-results.json',{cache:'no-cache'}).then(r=>r.ok?r.text():null).catch(()=>null);
    if(!t||t===COUNTY.text)return;
    COUNTY.data=Promise.resolve(JSON.parse(t));COUNTY.text=t;fillMaps(list);
  },120000);
}
// How many covered races are called, and which are not yet.
function resultsLine(){
  const all=DATA.races.concat(DATA.liteRaces),c=resultCounts(all);
  return `${c.decided} of ${c.total} races called as of ${fmtDate(DATA.election.asof)}.${c.pending.length?` Not called yet: ${c.pending.map(r=>esc(r.label)).join(', ')}.`:''} A race counts as called once a news organization calls it or the loser concedes. Unofficial until each state certifies. <a href="#method-results">How results are shown</a>`;
}
function renderRaces(){
  const S=DATA.races.filter(r=>r.chamber==='S'), H=DATA.races.filter(r=>r.chamber==='H');
  // Results-only races (no profiles): the other 2026 Senate races and the other House toss-ups.
  const lite=ch=>DATA.liteRaces.filter(r=>(r.chamber||'H')===ch),LS=lite('S'),LH=lite('H');
  app.innerHTML=`
  <section class="hero" style="padding-bottom:10px"><div class="asof">2026 general election${DATA.election?' · '+RESULTS_ASOF():''}</div><h1 style="margin-top:8px">The races</h1>
  <p class="lede">How the vote went on November 3 in every race this site covers: each candidate's share and the reported turnout. Competitive races come first.</p>${points([DATA.election&&['Results',resultsLine()],['Shares','As each source reported them on election night or the morning after, with how much of the vote was counted. They change as counting finishes.']].filter(Boolean),'lede-pts')}
  <div class="toolbar"><div class="seg" id="rs"><button data-c="S" class="active">Senate (${S.length+LS.length})</button><button data-c="H">House (${H.length+LH.length})</button></div>
  <label class="small muted">Jump to <select id="rj">${S.concat(LS,H,LH).map(r=>`<option value="${r.id}">${esc(r.label)}</option>`).join('')}</select></label></div></section>
  <div id="rlist"></div>`;
  const draw=ch=>{const L=DATA.races.filter(r=>r.chamber===ch),card=r=>`<div id="r-${r.id}">${resultCard(r)}</div>`;
    $('#rlist').innerHTML=ch==='S'?`<h2 style="margin-top:8px">Competitive Senate races</h2><p class="small muted" style="margin:4px 0 0;max-width:80ch">Rated Toss-up, Tilt or Lean by at least one forecaster (Cook, Inside Elections or Sabato's Crystal Ball, Sept. 2026).</p>${L.filter(r=>r.competitive).map(card).join('')}<h2 style="margin-top:26px">Other Senate races covered</h2>${L.filter(r=>!r.competitive).map(card).join('')}
        <h2 style="margin-top:26px">The rest of the 2026 Senate races</h2><p class="small muted" style="margin:4px 0 0;max-width:80ch">The other ${LS.length} Senate races on the November 3 ballot, with results only. Open a sitting senator for their Senate profile; their opponents don't have profiles yet.</p>${LS.map(card).join('')}`
      :`<h2 style="margin-top:8px">House toss-ups with full profiles</h2><p class="small muted" style="margin:4px 0 0;max-width:80ch">Eight of the ${L.length+LH.length} House races the Cook Political Report rated Toss-up (Sept. 25, 2026). Open a candidate for their profile.</p>${L.map(card).join('')}
        <h2 style="margin-top:26px">Other House toss-ups</h2><p class="small muted" style="margin:4px 0 0;max-width:80ch">The other ${LH.length} Cook toss-ups. Their nominees don't have profiles yet.</p>${LH.map(card).join('')}`;
    bindTips(app);fillMaps($('#rlist'));};
  draw('S');
  $('#rs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$('#rs .active').classList.remove('active');b.classList.add('active');draw(b.dataset.c);});
  $('#rj').addEventListener('change',e=>{const r=DATA.races.find(x=>x.id===e.target.value)||DATA.liteRaces.find(x=>x.id===e.target.value);const want=r.chamber||'H';const cur=$('#rs .active').dataset.c;if(cur!==want){$('#rs .active').classList.remove('active');$(`#rs button[data-c="${want}"]`).classList.add('active');draw(want);}document.getElementById('r-'+r.id).scrollIntoView({behavior:'smooth',block:'start'});});
}

// ---------- bills ----------
// Every bill on file (public/bills.js): the bills behind the saved roll calls and the People First bills, split into
// those that became law and those that haven't (or were reintroduced), each with the groups that took a side on it.
let billQ='';
const BILL_SEG=[['all','All'],['law','Became law'],['not','Not passed or reintroduced']];
const posDate=d=>!d?'':/^\d{4}-\d{2}-\d{2}$/.test(d)?fmtDate(d):/^\d{4}-\d{2}$/.test(d)?monLabel(d):d;
function billGroupLine(p){
  const g=groupInfo(DATA,p.group),tags=[];
  if(g.pac>0)tags.push(`PACs gave ${fmt$(g.pac)} to campaigns here`);
  if(g.routed>0)tags.push(`Bundled ${fmt$(g.routed)} from its donors here`);
  if(g.out>0)tags.push(`${fmt$(g.out)} in outside spending here`);
  if(!g.pac&&!g.routed&&!g.out)tags.push(g.pacs?'Has PACs; none gave to campaigns here':'Advocacy group; no PAC on file');
  const src=p.src?.u?` <a href="${esc(p.src.u)}" target="_blank" rel="noopener" title="${esc(p.src.t||'Source')}">Source ↗</a>`:'';
  return `<li><b${g.about?` data-tip="${esc(`${g.org}: ${g.about}`)}" class="org"`:''}>${esc(g.org)}</b> ${tags.map(t=>`<span class="tag">${esc(t)}</span>`).join(' ')}<div class="small muted">${esc(p.why||'')}${p.date?` (${esc(posDate(p.date))})`:''}${src}</div></li>`;
}
function billCard(e){
  const u=billUrl(e.id),nums=e.keys.map(billLabel);
  const sup=e.positions.filter(p=>p.pos==='support'),opp=e.positions.filter(p=>p.pos==='oppose');
  const here=[...new Set([...(e.work?.cosponsors||[]),...(e.cosponsors||[])].map(c=>c.person))].filter(id=>byId[id]).map(id=>`<a href="#${id}-${e.issue?'match':'pvp'}">${esc(byId[id].short||byId[id].name)}</a>`);
  const statusSrc=e.statusSrc?` <a href="${esc(e.statusSrc.u)}" target="_blank" rel="noopener" title="${esc(e.statusSrc.t)}">Source ↗</a>`:'';
  const status=e.status==='law'?`<b class="gr-A">Became law</b>: ${esc(e.law)}, signed ${fmtDate(e.date)}.${statusSrc}`:`<b>${e.reintroduced?'Not passed; reintroduced':'Not passed'}</b>: ${esc(e.stage)}${statusSrc}`;
  const tally=v=>{const c={};for(const x of Object.values(v.pos||{}))if(/^(Yea|Nay|Aye|No)$/.test(x))c[x==='Aye'?'Yea':x==='No'?'Nay':x]=(c[x==='Aye'?'Yea':x==='No'?'Nay':x]||0)+1;return c.Yea||c.Nay?` · people on this site: ${c.Yea||0} yes, ${c.Nay||0} no`:'';};
  const votes=e.votes.map(v=>`<li>${esc(v.chamber)}, ${fmtDate(v.date)}: ${esc(v.question||v.bill?.voteQuestion||'Vote')}, <b>${esc(v.result)}</b> <a href="${esc(voteUrl(v))}" target="_blank" rel="noopener">Roll call ↗</a><span class="muted">${tally(v)}</span></li>`)
    .concat((e.steps||[]).map(x=>`<li>${esc(x.text)}${x.src?` <a href="${esc(x.src.u)}" target="_blank" rel="noopener" title="${esc(x.src.t)}">Source ↗</a>`:''}</li>`));
  return `<article class="card bill-card" id="bill-${esc(e.id)}">
    <div class="bill-head"><h3>${u?`<a href="${u}" target="_blank" rel="noopener">${esc(e.title)}</a>`:esc(e.title)}</h3>${e.area?`<span class="tag">${esc(e.area)}</span>`:''}${e.work?`<span class="tag" title="People First bill score">People First: ${e.work.status==='scored'?signed(e.work.score):'not scored'}</span>`:''}</div>
    <div class="small muted">${nums.map(esc).join(' · ')}</div>
    <p class="small" style="margin:8px 0 0">${status}</p>
    ${e.summary?`<p class="small" style="margin:6px 0 0">${esc(e.summary)}${e.summarySrc?.u?` <a href="${esc(e.summarySrc.u)}" target="_blank" rel="noopener" title="${esc(e.summarySrc.t||'')}">Source ↗</a>`:''}</p>`:''}
    ${e.note?`<p class="small muted" style="margin:6px 0 0">${esc(e.note)}</p>`:''}
    <div class="bill-sides">
      <div><h4 class="gr-A">Supported it (${sup.length})</h4>${sup.length?`<ul class="list small">${sup.map(billGroupLine).join('')}</ul>`:'<p class="small muted">No position on file.</p>'}</div>
      <div><h4 class="gr-F">Opposed it (${opp.length})</h4>${opp.length?`<ul class="list small">${opp.map(billGroupLine).join('')}</ul>`:'<p class="small muted">No position on file.</p>'}</div>
    </div>
    ${votes.length?`<details class="small" style="margin-top:8px"><summary>Votes (${votes.length})</summary><ul class="list">${votes.join('')}</ul></details>`:''}
    ${here.length?`<p class="small" style="margin:6px 0 0"><b>Sponsors and cosponsors on this site:</b> ${here.join(', ')}</p>`:''}
    ${e.issue?`<p class="small muted" style="margin:6px 0 0"><b>Counts in Your match</b> under "${esc(ISSBY[e.issue]?.label||e.issue)}": sponsoring or cosponsoring it counts toward "${esc(ISSBY[e.issue]?.[e.side]||e.side)}".</p>`:''}
    <div class="small" style="margin-top:6px" data-lob="${esc(e.id)}"></div>
  </article>`;
}
function renderBills(seg){
  if(!BILL_SEG.some(([k])=>k===seg))seg='all';
  const F=billFamilies(DATA,PVP_BILLS),law=F.filter(e=>e.status==='law'),not=F.filter(e=>e.status!=='law');
  const groups=new Set(F.flatMap(e=>e.positions.map(p=>p.group)));
  app.innerHTML=`<section class="hero" style="padding-bottom:10px"><div class="asof">${F.length} bills · ${law.length} became law · ${not.length} not passed or reintroduced</div><h1 style="margin-top:8px">Bills</h1>
    <p class="lede">Every bill collected so far: the bills behind the saved roll calls and the bills scored for People First, with the groups that supported or opposed each one.</p>
    ${points([['Supported and opposed','Positions from the groups\' own scorecards, key-vote letters and statements, each with its source: '+groups.size+' groups so far, including Heritage Action, the ACLU, the League of Conservation Voters and the Human Rights Campaign.'],['Money','Beside each group, what its PACs gave to the campaigns on this site and what it spent on outside ads, from FEC records. A group with no PAC lobbies but gives no campaign money tracked here.'],['Versions','A bill reintroduced in a later Congress, or its Senate companion, is listed once with all its numbers.'],['Not graded here','This page lists bills. Grades count votes and sponsorships on them as described in the <a href="#method">methodology</a>.']])}
    <div class="toolbar"><div class="seg" id="bill-seg">${BILL_SEG.map(([k,l])=>`<button data-k="${k}" class="${k===seg?'active':''}">${esc(l)} (${k==='all'?F.length:k==='law'?law.length:not.length})</button>`).join('')}</div>
    <div class="search"><input id="bill-q" type="search" placeholder="Search by name, number, topic or group" aria-label="Search bills" value="${esc(billQ)}"></div></div></section>
    <section class="section" style="padding-top:6px" id="bill-list"></section>`;
  const text=e=>[e.title,...e.keys.map(billLabel),e.area,e.summary,...e.positions.map(p=>groupInfo(DATA,p.group).org)].join(' ').toLowerCase();
  const draw=()=>{
    const q=billQ.trim().toLowerCase(),hit=e=>!q||text(e).includes(q);
    const part=(title,sub,list)=>{const L=list.filter(hit);return `<h2 style="margin-top:14px">${esc(title)} <span class="muted small">(${L.length})</span></h2><p class="small muted" style="margin:2px 0 10px">${sub}</p>${L.length?`<div class="bill-grid">${L.map(billCard).join('')}</div>`:'<p class="small muted">None match the search.</p>'}`;};
    $('#bill-list').innerHTML=(seg!=='not'?part('Became law','Signed into law. Newest first.',law):'')+(seg!=='law'?part('Not passed yet, or reintroduced','Passed one chamber, fell short, or never got a vote. Bills reintroduced in later Congresses are marked. Newest action first.',not):'');
    mountBillLobbying($('#bill-list'));bindTips(app);hoverTips(app);
  };
  draw();
  $('#bill-seg').addEventListener('click',ev=>{const b=ev.target.closest('button');if(b)location.hash='#bills'+(b.dataset.k==='all'?'':'-'+b.dataset.k);});
  $('#bill-q').addEventListener('input',ev=>{billQ=ev.target.value;draw();});
}

// ---------- compare ----------
let cmpGrp='all';
function renderCompare(){
  const V=CH[cmpCh].votes, M=MEM.filter(s=>s.chamber===cmpCh).concat(cmpCh==='S'?CANDS.filter(s=>s.senateVotes):[]);
  const areas=[...new Set(V.map(v=>v.area))].sort();
  app.innerHTML=`
  <section class="hero" style="padding-bottom:10px"><div class="asof">Roll calls since 2021 · ideology · money</div><h1 style="margin-top:8px">Compare</h1>
  <p class="lede">Two views of the ${ALL.length} people profiled.</p>${points([['Votes','How the senators and representatives voted on important roll calls. Former members\' votes are included for the years they served.'],['Side by side','Ideology, campaign funds and outside spending for everyone.']],'lede-pts')}
  <div class="toolbar"><div class="seg" id="cs"><button data-c="S" class="${cmpCh==='S'?'active':''}">Senate votes</button><button data-c="H" class="${cmpCh==='H'?'active':''}">House votes</button></div></div></section>
  <div class="filters" id="cf"><button class="active" data-a="">All areas</button>${areas.map(a=>`<button data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div>
  ${vtLegend()}<div class="matrix"><table id="mx"><thead><tr><th>Vote</th>${M.map(s=>`<th class="sen"><a href="#${s.id}">${esc(s.short)}</a><br><span class="chip ${s.party}" style="margin-top:4px">${s.party}-${esc(seatLabel(s))}</span>${s.recordType==='former_member_of_congress'?'<div class="small muted" style="font-weight:400;text-transform:none;letter-spacing:0">former senator</div>':''}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
  <section class="section">
    <h2>Side by side</h2>
    <p class="intro">Click a column to sort.</p>${points([['Money','Campaign funds and outside spending are separate columns, each with its own dates, on one shared scale. They are never added together.'],['Ideology','Percentiles are within each member\'s own chamber. Candidates without a congressional record show their record type.'],['Different evidence','Some people have U.S. votes, some state votes, some no voting record. Ideology cells can\'t be compared across those types.']])}
    <div class="toolbar" style="margin:0 0 10px"><div class="seg" id="cg"><button data-g="all" class="${cmpGrp==='all'?'active':''}">All ${ALL.length}</button><button data-g="S" class="${cmpGrp==='S'?'active':''}">Senate races</button><button data-g="H" class="${cmpGrp==='H'?'active':''}">House races</button></div></div>
    <div class="tablewrap"><table id="side"><thead><tr><th><button data-k="name">Name</button></th><th><button data-k="pctl">Voting record</button></th><th class="r"><button data-k="unity">Party unity</button></th><th><button data-k="rc">Campaign funds raised</button></th><th><button data-k="of">Outside spending for</button></th><th><button data-k="oa">Outside spending against</button></th><th><button data-k="al">Compared with your choices</button></th></tr></thead><tbody></tbody></table></div>
    <div style="margin:8px 0 0">${points([['Campaign funds','FEC two-year summaries, through the date shown for each person (mostly June 30, 2026).'],['Outside spending',`General-election independent expenditures through ${fmtDate(DATA.ie_asof)}.`],['Montana','In the three-way race, the outside-spending columns show only spending aimed directly at that candidate.']],'small')}</div>
  </section>`;
  const draw=a=>{$('#mx tbody').innerHTML=V.filter(v=>!a||v.area===a).slice().sort((x,y)=>y.date.localeCompare(x.date)).map(v=>`<tr><td class="v"><a href="${voteUrl(v)}" target="_blank" rel="noopener"><b>${esc(v.short)}</b></a><div class="s">${v.date} · ${esc(v.result)} · ${esc(v.area)}</div></td>${M.map(s=>{const p=v.pos[s.id]||'—';return `<td class="c">${voteText(v,p)}</td>`}).join('')}</tr>`).join('');};
  draw('');
  $('#cf').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$('#cf .active').classList.remove('active');b.classList.add('active');draw(b.dataset.a);});
  $('#cs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;location.hash='compare-'+(b.dataset.c==='H'?'house':'senate');});
  const all=ALL.map(s=>{const sc=scoreFor(s);return {s,sc,name:s.name,pctl:s.ideo?s.ideo.lo:-1,unity:s.ideo&&s.ideo.unity!=null?s.ideo.unity:-1,rc:s.camp.missing?-1:s.camp.receipts,of:s.out.for.total,oa:s.out.against.total,al:sc.score==null?-1:sc.score}});
  let sort={k:'rc',dir:-1};
  const cell=(v,max,col,sub)=>v<0?'<span class="muted">No FEC report yet</span>':`<div class="mini"><span class="num" style="min-width:4.6em"><b>${fmt$(v)}</b></span><span class="tr"><b style="width:${Math.max(.5,v/max*100)}%;background:var(${col})"></b></span></div>${sub?`<div class="small muted">${sub}</div>`:''}`;
  const drawS=()=>{
    const rows=all.filter(x=>cmpGrp==='all'||x.s.chamber===cmpGrp);
    const max=Math.max(1,...rows.map(x=>Math.max(x.rc,x.of,x.oa)));
    rows.sort((a,b)=>{const x=a[sort.k],y=b[sort.k];return (typeof x==='number'?x-y:String(x).localeCompare(String(y)))*sort.dir});
    $('#side tbody').innerHTML=rows.map(({s,rc,of,oa,sc})=>`<tr><td><a href="#${s.id}-finance">${esc(s.name)}</a><div class="row" style="margin-top:3px"><span class="chip ${s.party}">${s.party}-${esc(seatLabel(s))}</span><span class="chip ch">${chipCh(s)}</span></div></td><td class="small">${esc(ideoText(s).short)}<div class="muted">${esc(evidenceOf(s).kind==='us'?'U.S. votes':evidenceOf(s).kind==='former'?'past congressional record':evidenceOf(s).kind==='state'?'state legislative record':evidenceOf(s).kind==='exec'?'executive record, no votes':'no voting record')}</div></td><td class="r">${s.ideo&&s.ideo.unity!=null?s.ideo.unity+'%':'—'}</td><td style="min-width:170px">${cell(rc,max,'--s1',s.camp.missing?'':'through '+fmtDate(s.camp.end))}</td><td style="min-width:170px">${cell(of,max,'--neutral',s.out.incomplete.length?'incomplete data':'')}</td><td style="min-width:170px">${cell(oa,max,'--neutral','')}</td><td style="min-width:150px">${scoreBadge(sc)}<div class="small muted">${esc(evidenceMix(s))}</div></td></tr>`).join('');bindTips(app);};
  drawS();
  $('#side thead').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;sort=sort.k===k?{k,dir:-sort.dir}:{k,dir:k==='name'?1:-1};drawS();});
  $('#cg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;cmpGrp=b.dataset.g;$('#cg .active').classList.remove('active');b.classList.add('active');drawS();});
}

// ---------- methodology ----------
// ---------- profile charts: Ethics case timeline and trading, People First donors, Money & Influence Analysis ----------
const CASE_COLOR={finding:'var(--s1)',open:'var(--s2)',closed:'var(--s3)',allegation:'var(--cx-other)'};
const CASE_LABEL={finding:'Confirmed finding',open:'Open investigation',closed:'Investigation closed without a finding',allegation:'Allegation'};
function caseRows(s){
  return (s.ethics||[]).filter(e=>e.outcome!=='None found'&&['finding','investigation','allegation'].includes(e.status)).map(e=>{
    const y=(String(e.date||'').match(/\b(?:19|20)\d{2}\b/g)||[]).map(Number),k=e.status==='investigation'?(e.stage==='open'?'open':'closed'):e.status;
    return {label:e.title,from:y[0]||null,to:y.length>1?y.at(-1):null,status:k,statusLabel:CASE_LABEL[k],when:e.date};
  });
}
function caseTimelineBlock(s){
  const rows=caseRows(s).filter(r=>r.from);if(!rows.length)return '';
  return `<div class="chart" id="eth-timeline"><h3>Case timeline</h3><div class="sub">Each entry across the years it covers, colored by its current status. When a case changes, its status is updated instead of adding a new entry, so each counts once.</div>
    <div class="cx-plot" id="eth-tl"></div>${legend(Object.keys(CASE_LABEL).filter(k=>rows.some(r=>r.status===k)).map(k=>[CASE_COLOR[k],CASE_LABEL[k]]))}
    ${tableView(['Entry','Status','Dates'],rows.map(r=>[esc(r.label),esc(r.statusLabel),esc(r.when)]))}</div>`;
}
// Trading charts, for reviewed trades (and, on the latest-records card, for trades not reviewed yet).
function tradeChartsBlock(rows,sectors,id){
  if(!rows.length)return '';
  const by={};for(const r of rows)if(r.sector)by[r.sector]=(by[r.sector]||0)+1;
  const cats=Object.entries(by).map(([label,value])=>({label,value,hi:sectors.includes(label)})).sort((a,b)=>b.value-a.value);
  return `<div class="chart"><h3>Days from trade to disclosure</h3><div class="sub">One dot per trade. Reports are due within ${LATE_DAYS} days. Dots past the line were late.</div><div class="cx-plot" id="${id}-delay"></div>${legend([['var(--crit)','Late or never disclosed'],['var(--cx-other)','On time']])}</div>
    ${cats.length?`<div class="chart"><h3>Trades by sector</h3><div class="sub">Sectors their committees oversee are highlighted. A trade in a single company's stock in one of them counts as a committee conflict.</div>${categoryBars(cats,{highlightLabel:'Overseen by their committees',otherLabel:'Other sectors'})}</div>`:''}
    <div class="chart"><h3>Trades and votes</h3><div class="sub"><b>Above the line:</b> buys. <b>Below:</b> sells. <b>Ticks on the line:</b> their key votes. <b>Ringed dot:</b> a trade near a related vote. Once reviewed, it counts in the Insider Trading Index 📈.</div><div class="cx-plot" id="${id}-tl"></div>${legend([['var(--s3)','Buy'],['var(--s2)','Sell'],['var(--ink-2)','Recorded vote']])}</div>`;
}
function personVotes(s){return DATA.votes.concat(DATA.hvotes).filter(v=>v.pos&&/^(Yea|Nay|Aye|No)$/i.test(v.pos[s.id]||'')).map(v=>({date:v.date,label:`${v.short}: voted ${v.pos[s.id]}`}));}
function mountTradeCharts(s,rows,id){
  if(!rows.length||!document.getElementById(id+'-delay'))return;
  const tr=rows.map(r=>({...r,company:r.company||r.asset}));
  const span=tr.map(r=>r.traded).filter(Boolean).sort(),from=addMonths(span[0].slice(0,7),-3),to=addMonths(span.at(-1).slice(0,7),3);
  const ev=personVotes(s).filter(v=>v.date.slice(0,7)>=from&&v.date.slice(0,7)<=to);
  const f=()=>{drawDelay(document.getElementById(id+'-delay'),tr,LATE_DAYS);drawTradeTimeline(document.getElementById(id+'-tl'),tr,ev);};f();resizers.push(f);
}
function mountCaseTimeline(s){const el=document.getElementById('eth-tl');if(!el)return;const rows=caseRows(s).filter(r=>r.from);const f=()=>drawCaseTimeline(document.getElementById('eth-tl'),rows,CASE_COLOR);f();resizers.push(f);}

// People First: the person's own diverging bar, and the tree map of their top donors.
const catLabel=c=>c==='small'?'Small-dollar donors':DATA.categories[c]||SECTOR_LABEL_EXTRA[c]||c;
function donorTreemapBlock(s){
  const p=s.pac||{},t=topDonors(p.rows,DATA.pacNames,s.camp&&!s.camp.missing?s.camp.unitemized:0);
  if(!t.tiles.length)return `<div class="chart"><h3>Top donors</h3><p class="small muted">No PAC contributions or small-dollar totals are on file for ${esc(s.short)}'s campaign.</p></div>`;
  const tiles=t.tiles.map(x=>({...x,alignLabel:ALIGN_LABEL[x.align],catLabel:catLabel(x.cat),about:x.cat==='small'?SMALL_DOLLAR_ABOUT:ORGS.about(x.label,'pac')}));
  const sum=k=>tiles.filter(x=>x.align===k).reduce((n,x)=>n+x.value,0);
  return `<div class="chart" id="pvp-donors"><h3>Top ${tiles.length} donors</h3><div class="sub">${points([['Tile size',`The amount given${p.window?` (PAC contributions ${esc(p.window)}; small-dollar donors ${s.camp?period(s.camp.start,s.camp.end):''})`:''}.`],['People-aligned','Unions, plus small-dollar donors as one tile.'],['Profit-aligned','Corporate PACs and industry groups.'],['Other','Leadership, party and ideological committees.'],['Sectors','Assigned by this app from each committee\'s name.'],t.rest&&['Not shown',`${t.rest} smaller PACs (${fmtFull(t.restAmount)}).`]],'small')}</div>
    <div class="cx-plot" id="pvp-tm"></div>${legend([['var(--s1)',`People-aligned ${fmt$(sum('people'))}`],['var(--s5)',`Profit-aligned ${fmt$(sum('profit'))}`],['var(--cx-other)',`Other ${fmt$(sum('other'))}`]])}
    ${tableView(['Donor','Amount','Alignment','Sector'],tiles.map(x=>[orgName(x.label,x.about),fmtFull(x.value),x.alignLabel,esc(x.catLabel)]))}
    <p class="small" style="margin:8px 0 0"><a href="#${s.id}-finance">Outside spending by sector, for and against, on the Money &amp; Influence tab →</a></p></div>`;
}
function mountTreemap(s){const el=document.getElementById('pvp-tm');if(!el)return;const p=s.pac||{},t=topDonors(p.rows,DATA.pacNames,s.camp&&!s.camp.missing?s.camp.unitemized:0);
  const tiles=t.tiles.map(x=>({...x,alignLabel:ALIGN_LABEL[x.align],catLabel:catLabel(x.cat),about:x.cat==='small'?SMALL_DOLLAR_ABOUT:ORGS.about(x.label,'pac')}));const f=()=>drawTreemap(document.getElementById('pvp-tm'),tiles);f();resizers.push(f);}

// Money & Influence Analysis: alignment and timing, from the reviewed research now, and from the daily FEC and LDA.gov
// refresh as it fills in. Never part of a grade.
function influenceData(s){
  const H=window.FUNDHIST,funders=s.funderPos||[],through=H?H.contribThrough.slice(0,7):null;
  const rows=[];
  // Every group whose positions are collected and whose PACs gave to this person, with the votes it took a position on.
  for(const [key,h] of Object.entries(H?.people[s.id]||{})){
    const g=funders.find(f=>f.key===key)||{key,org:(GPBY[key]||{}).org||key,compared:[]};
    const series={};for(const [m,v] of h.c||[])series[m]=(series[m]||0)+v;
    const total=Object.values(series).reduce((t,v)=>t+v,0);if(!total)continue;
    const decisions=(g.compared||[]).map(c=>({date:c.date,match:c.match,label:`${c.short}: ${g.org} wanted ${c.wanted}, ${s.short} voted ${c.cast}`}));
    // A changed-position check tagged with an issue the group took positions on (through the votes it scored).
    const issues=new Set((g.compared||[]).flatMap(c=>(VOTE_BY_ID.get(c.voteId)?.codes||[]).map(x=>x.issue)));
    const changes=(s.statements||[]).filter(x=>x.assessment==='changed'&&x.issue&&/^\d{4}-\d{2}/.test(x.did?.date||'')).map(x=>({date:x.did.date,issue:x.issue,label:`Changed position: ${x.topic}`}));
    const flags=timingFlags(g.org,series,decisions,through).concat(positionChangeFlags(g.org,series,issues,changes,through));
    rows.push({key,label:g.org,series,total,flags,markers:decisions.filter(d=>d.match!==null).map(d=>({date:d.date,kind:d.match?'same':'opp',label:d.label}))});
  }
  rows.sort((a,b)=>b.total-a.total);
  const trades=personTrading(s).rows,stock=stockFlags(trades,funders.map(g=>({org:g.org,positions:(g.compared||[]).length})));
  // Reviewed trades in a charted donor's company, as diamonds on that donor's row.
  const inDonors=tradesInDonors(trades,rows.map(r=>({org:r.label})));
  for(const {org,trade:t} of inDonors)rows.find(r=>r.label===org).markers.push({date:t.traded,kind:'trade',label:`${t.type||'Trade'} of ${t.company||t.asset}${t.owner?` (${t.owner})`:''}`});
  const months=[];if(H)for(let m=H.start.slice(0,7);m<=through;m=addMonths(m,1))months.push(m);
  return {rows:rows.slice(0,8),allFlags:rows.flatMap(r=>r.flags).concat(stock),months,vda:voteDonorAlignment(funders),through,trades,inDonors,stock};
}
// Whose trades the disclosures cover: members of Congress file Periodic Transaction Reports (STOCK Act); a president files
// OGE Form 278-T reports, listed on the Ethics tab but not compared with donors; anyone else has no trading data.
const tradeCoverage=s=>s.office?{ok:false,label:'Not compared with donors',short:'Not compared for a president',why:`A president's trades are listed on the Integrity tab, from OGE reports. They aren't compared with donors here, because the donor data covers the 2026 candidates' committees.`}
  :s.bioguide?{ok:true}:{ok:false,why:'Trade disclosures cover members of Congress only, and state disclosure rules vary.'};
function stockBlock(s,d){
  const cov=tradeCoverage(s),tr=d.trades;
  const body=!cov.ok?`<p class="small muted" style="margin:0"><b>${esc(cov.label||'No trading data')}:</b> ${s.office?`${esc(s.short)}'s trades are listed from OGE reports on the <a href="#${s.id}-integrity">Integrity tab</a>. They aren't compared with donors here, because the donor data covers the 2026 candidates' committees.`:esc(cov.why)}</p>`
    :!tr.length?`<p class="small muted" style="margin:0">No reviewed trades for ${esc(s.short)} yet. The latest reported trades are checked against the top donors below, as leads. A trade counts once it is reviewed.</p>`
    :d.inDonors.length?`<div class="tablewrap"><table><thead><tr><th>Traded</th><th>Company</th><th>Type</th><th>Owner</th><th>Donor</th><th>Flag</th></tr></thead><tbody>${d.inDonors.map(({org,trade:t})=>`<tr><td class="mono" style="white-space:nowrap">${esc(t.traded||'')}</td><td>${esc(t.company||t.asset||'')}</td><td>${esc(t.type||'')}</td><td>${esc(t.owner||'Self')}</td><td>${esc(org)}</td><td>${d.stock.some(f=>f.trade===t)?`<b>${FLAG_TEXT.stock}</b>`:'<span class="muted">Donor took no position on a vote compared here</span>'}</td></tr>`).join('')}</tbody></table></div>`
    :`<p class="small muted" style="margin:0">None of ${esc(s.short)}'s ${tr.length} reviewed trade${tr.length===1?'':'s'} was in a donor's company.</p>`;
  if(!cov.ok)return `<div class="chart" id="f-stock"><h3>Stock holdings and trades</h3>${body}</div>`;
  return `<div class="chart" id="f-stock"><h3>Stock holdings and trades</h3><div class="sub">${points([['What is checked','Trades from official reports, including spouse and dependent-child accounts, against the donors.'],['Timing flag',`A trade in a donor that had a stake in ${esc(s.short)}'s decisions, such as a public position on a vote or lobbying on a bill ${esc(s.short)} acted on.`],['Insider Trading Index 📈',`${(e=>e.index==null?esc(e.why):e.index)(personEthics(s).insider)}. The same number as on the <a href="#${s.id}-integrity">Integrity tab</a>, which shows how it's figured.`],['Graded in Integrity',`Trades count in <a href="#${s.id}-integrity">Integrity</a>'s Personal Finances through the Insider Trading 📈 and Stock Disclosure Dodger 🙈 indexes, not here.`]],'small')}</div>
    ${body}<div id="f-live-stock"></div></div>`;
}
const H0=()=>window.FUNDHIST?monLabel(window.FUNDHIST.start.slice(0,7)):'2019';
const FLAG_TEXT={rose:'Donations rose',dropped:'Donations dropped',changed:'Position changed after a donation shift',stock:'Held or traded stock in a donor'};
function analysisBlock(s){
  const d=influenceData(s),v=d.vda;
  // Donor Loyalty 🤝: against the rest of their party on the same votes, from the saved votes' party totals
  // (public/vote-party.json, written by scripts/build-vote-party.mjs). A president signs bills rather than voting.
  const dl=s.office?null:donorLoyalty(s.funderPos,s.party,window.VOTE_PARTY),side=s.party==='R'?'Republicans':'Democrats';
  const pts1=x=>`${x>0?'+':x<0?'−':''}${Math.abs(Math.round(x))}`,sg1=x=>`${x>0?'+':x<0?'−':''}${fmt1(Math.abs(x))}`;
  const dlText=!dl?`Not measured for a president, who signs bills rather than voting on them`
    :dl.index!=null?`${pts1(dl.diff)} points vs. other ${side} on ${dl.n} votes, weighted by each funder's money. 100 at ${DONOR_LOYALTY.ceiling} points above`
    :dl.why==='Not enough data'?`Not enough data: ${dl.n} compared vote${dl.n===1?'':'s'}, ${DONOR_LOYALTY.minVotes} needed${dl.diff!=null?` (${pts1(dl.diff)} points vs. other ${side} so far)`:''}`
    :dl.why==='Party totals not loaded'?`The party totals for these votes aren't loaded yet`
    :dl.why==='No funder took a position on their votes'?`No group that gave to the campaign or spent for them took a public side on a vote compared here`:esc(dl.why);
  const flagRows=d.allFlags.map(f=>f.kind==='stock'?`<li><b>${FLAG_TEXT.stock}:</b> ${esc(f.org)} · ${esc(f.decision.label)} on ${fmtDate(f.decision.date)}</li>`
    :`<li><b>${FLAG_TEXT[f.kind]}${f.kind==='rose'?' after a vote it wanted':f.kind==='dropped'?' after a vote it opposed':''}:</b> ${esc(f.org)}, ${fmtFull(f.before)} in the ${WINDOW_MONTHS} months before → ${fmtFull(f.after)} from ${monLabel(f.decision.date.slice(0,7))} through ${monLabel(f.to)}. ${esc(f.decision.label)} (${fmtDate(f.decision.date)}).</li>`);
  return `<section id="f-analysis"><h2 style="margin-top:6px">Money &amp; Influence Analysis</h2>
    <p class="intro">Does the timing of ${esc(s.short)}'s money line up with ${esc(s.short)}'s decisions?</p>${points([['Correlation, not cause','This shows timing and alignment. It does not prove that money caused a decision.'],['Context','These timing and alignment analyses sit beside the grades. The Corporation Compromised Index separately contributes to People First as explained in its calculation.'],['Settings under review',`The top ${TOP_DONORS} donors, a ${SWING*100}% change, and a ${WINDOW_MONTHS}-month window.`]])}
    <div class="cx-stats ix-row">
      ${ixCard({name:'Vote Donor Alignment',value:v.pct==null?'—':v.pct+'%',score:v.pct,tone:'bad',about:v.n?`${v.same} of ${v.n} votes went the way a donor that took a public position wanted (${v.rows.length} donor${v.rows.length===1?'':'s'})`:'No donor that gave to the campaign took a public position on a vote compared here',
        how:`Votes that went a donor's way ÷ votes where a donor that gave to the campaign, bundled for it or spent for them took a public side (its scorecard or key-vote letter). Missed votes don't count.<div class="ix-f">${v.n?`${v.same} ÷ ${v.n} = <b>${v.pct}%</b>`:'No compared votes = <b>—</b>'}</div>`})}
      ${ixCard({icon:'🤝',name:'Donor Loyalty',value:dl?.index==null?'—':dl.index,score:dl?.index,tone:'bad',about:dlText,
        how:`For each funder: their rate of voting its way − the rest of their party's rate on the same votes. Averaged by each funder's money (no funder over half the weight). Only the part above the party counts; ${DONOR_LOYALTY.ceiling} points above scores 100. Needs ${DONOR_LOYALTY.minVotes} compared votes.${dl?.rows?.length?`<div class="ix-f">${dl.rows.slice(0,3).map(r=>`${esc(r.org)} <b${toneAttrs(50+r.diff/2,'bad')}>${sg1(r.diff)}</b> × ${r.share}%`).join(' + ')}${dl.rows.length>3?` + ${dl.rows.length-3} more`:''} = <b${toneAttrs(dl.index,'bad')}>${sg1(dl.diff)}</b> points</div>${dl.index!=null?`<div class="ix-f">${fmt1(Math.max(0,dl.diff))} ÷ ${DONOR_LOYALTY.ceiling} × 100 = <b${toneAttrs(dl.index,'bad')}>${dl.index}</b>${dl.diff>DONOR_LOYALTY.ceiling?' (capped)':dl.diff<=0?' (at or below the party: 0)':''}</div>`:''}`:''}`})}
      ${ixCard({name:'Speech Donor Alignment',value:'—',about:'Not measured yet. Floor speeches are collected, but must be sorted by issue and side before they can be compared',
        how:`Planned: speeches on an issue a top donor lobbied on that took the donor's side ÷ all such speeches.`})}
      ${ixCard({name:'Timing flags',value:d.allFlags.length,about:`for review, not scored${d.stock.length?`; ${d.stock.length} from stock in a donor`:''}`,label:'How it\'s counted',
        how:`One flag each time, within ${WINDOW_MONTHS} months: a group's donations rose ${SWING*100}% or more after a vote it wanted, or dropped ${SWING*100}% or more after a vote it opposed (compared with the ${WINDOW_MONTHS} months before); they changed position on an issue after a ${SWING*100}% shift in a group's donations; or they held or traded stock in a donor with a stake in their decisions.`})}
      ${ixCard({name:'Stock in donors',value:tradeCoverage(s).ok&&d.trades.length?d.inDonors.length:'—',about:!tradeCoverage(s).ok?esc(tradeCoverage(s).short||'No trading data'):d.trades.length?`of ${d.trades.length} reviewed trade${d.trades.length===1?' was':'s were'} in a donor's company`:'No reviewed trades yet. The latest reports are checked below',label:'How it\'s counted',
        how:`Reviewed trades whose company matches, by name, a PAC that gave to the campaign or a group whose positions are compared. ${tradeCoverage(s).ok&&d.trades.length?`<div class="ix-f">${d.inDonors.length} of ${d.trades.length} trades</div>`:''}`})}</div>
    ${d.rows.length?`<div class="chart"><h3>Donations by month from donors with public positions</h3><div class="sub">${points([['Each row',`Contributions to the campaign from one group's PACs${d.months.length?`, ${monLabel(d.months[0])} – ${monLabel(d.months.at(-1))}`:''}. Each row has its own scale. The largest month is labeled at the right.`],['Triangles',`Votes the group took a side on. Green when ${esc(s.short)} voted its way, red when not.`],['Diamond at the top','A reviewed trade in that group\'s company.'],['Shaded window','A timing flag.'],['Source','FEC bulk data. The groups are the ones whose scorecards or key-vote letters are collected.']],'small')}</div>
      <div class="cx-plot" id="f-months"></div>${legend([['var(--s1)','Monthly contributions'],['var(--good)','Voted the way the donor wanted'],['var(--crit)','Voted the other way'],['var(--s4)','Trade in the donor\'s company'],['var(--warn)','Timing flag window']])}
      ${tableView(['Donor','Total','Votes compared','Flags'],d.rows.map(r=>[esc(r.label),fmtFull(r.total),r.markers.length,r.flags.length]))}</div>`:s.office?`<p class="small muted">The monthly donations from the ${GP.length} groups this app tracks cover the 2026 candidates' committees, not ${esc(s.short)}'s. There is no series to compare.</p>`:`<p class="small muted">None of the ${GP.length} groups this app tracks gave to ${esc(s.short)}'s campaign since ${H0()}, in the FEC data. There is no monthly series to compare yet.</p>`}
    ${flagRows.length?`<div class="chart"><h3>Timing flags</h3><ul class="list small">${flagRows.join('')}</ul></div>`:''}
    ${stockBlock(s,d)}
    ${dl?.rows.length?`<details class="tv"><summary>Donor Loyalty 🤝 by funder</summary>${points([['Each funder','A group that gave to the campaign or spent for them, on the votes where it took a public side.'],['Party\'s way',`How the rest of the ${side} in the chamber voted on the same votes, from the official roll calls (Voteview's copy for Senate votes Senate.gov wouldn't send).`],['The index',`The differences weighted by each funder's money, with no funder counting more than all the others put together (at most half the weight). Only the part above the party counts, and ${DONOR_LOYALTY.ceiling} points above scores 100.`]],'small')}<div class="tablewrap"><table><thead><tr><th>Funder</th><th class="r">Gave, bundled or spent for them</th><th class="r">Weight</th><th class="r">Votes</th><th class="r">Their way</th><th class="r">Party's way</th><th class="r">Difference</th></tr></thead><tbody>${dl.rows.map(r=>`<tr><td>${orgName(r.org,ORGS.about(r.org,'group'))}</td><td class="r">${fmtFull(r.money)}</td><td class="r">${r.share}%</td><td class="r">${r.n}</td><td class="r">${r.rate}%</td><td class="r">${r.partyRate}%</td><td class="r"><span${toneAttrs(50+r.diff/2,'bad')}>${pts1(r.diff)}</span></td></tr>`).join('')}</tbody></table></div></details>`:''}
    ${v.rows.length?`<details class="tv"><summary>Vote Donor Alignment by donor</summary><div class="tablewrap"><table><thead><tr><th>Donor</th><th class="r">Votes its way</th><th class="r">Votes compared</th></tr></thead><tbody>${v.rows.map(r=>`<tr><td>${orgName(r.org,ORGS.about(r.org,'group'))}</td><td class="r">${r.same}</td><td class="r">${r.n}</td></tr>`).join('')}</tbody></table></div></details>`:''}
    <div id="f-live-analysis"></div></section>`;
}
function mountAnalysis(s){
  const el=document.getElementById('f-months');
  if(el){const d=influenceData(s);const rows=d.rows.map(r=>({...r,flags:r.flags.map(f=>({from:f.from,to:f.to,tip:`${FLAG_TEXT[f.kind]}: ${fmtFull(f.before)} before, ${fmtFull(f.after)} after`}))}));
    const f=()=>drawMonthly(document.getElementById('f-months'),rows,d.months,[]);f();resizers.push(f);}
  liveAnalysis(s,document.getElementById('f-live-analysis'));
}
// From the daily refresh: the top donor organizations combining PAC and employee money, and the bills they lobbied on
// that this person acted on.
const orgKey=v=>String(v||'').toLowerCase().replace(/\b(pac|political action committee|employees|of|the|inc|corp|corporation|co|company|llc|federal|fund)\b/g,'').replace(/[^a-z0-9]/g,'');
// The latest disclosed trades (from the refresh, not yet reviewed) in the top donor organizations; a donor that also
// lobbied on a bill this person acted on makes it a timing flag, as leads for review.
function liveStock(s,p,top,stake){
  const el=document.getElementById('f-live-stock');if(!el)return [];
  const trades=p.merged?.trades||[];
  if(!trades.length){el.innerHTML=`<p class="small muted" style="margin:8px 0 0">The latest reported trades fill in from the daily refresh once the keys are set. <b>Sources:</b> the member's own trade reports (House Clerk and Senate eFD), cross-checked with Bargo, Eulerpool and Financial Modeling Prep. <a href="#updates">Update status</a></p>`;return [];}
  if(!top.length){el.innerHTML=`<p class="small muted" style="margin:8px 0 0">${trades.length} reported trade${trades.length===1?' is':'s are'} on file. They are checked against the top donor organizations once the FEC refresh lists them.</p>`;return [];}
  const lobbied=new Set(stake.map(l=>corp(l.org)));
  const hits=tradesInDonors(trades.map(t=>({...t,company:t.asset||t.ticker})),top.map(o=>({org:o.name,stake:lobbied.has(corp(o.name))})));
  el.innerHTML=`<h4 style="margin:12px 0 6px">Latest disclosed trades in top donors (leads, for review)</h4>${hits.length?`<div class="tablewrap"><table><thead><tr><th>Traded</th><th>Asset</th><th>Type</th><th class="r">Amount</th><th>Owner</th><th>Top donor</th><th>Flag</th></tr></thead><tbody>${hits.map(({org,donor,trade:t})=>`<tr><td class="mono" style="white-space:nowrap">${esc(t.traded||'')}</td><td>${esc(t.asset||t.ticker||'')}${t.ticker?` <span class="muted mono">${esc(t.ticker)}</span>`:''}</td><td>${esc(t.type||'')}</td><td class="r">${esc(t.amount||'')}</td><td>${esc(t.owner||'')}</td><td>${esc(org)}</td><td>${donor.stake?`<b>${FLAG_TEXT.stock}</b> (it lobbied on a bill ${esc(s.short)} acted on)`:'<span class="muted">No lobbying on their bills found</span>'}</td></tr>`).join('')}</tbody></table></div>`:`<p class="small muted" style="margin:0">None of the ${trades.length} latest disclosed trades was in one of the top ${top.length} donor organizations.</p>`}`;
  return hits;
}
async function liveAnalysis(s,host){
  if(!host)return;
  try{
    const r=await fetch('/api/profile?id='+encodeURIComponent(s.id),{cache:'no-store'});if(!r.ok)throw 0;const p=await r.json();if(!host.isConnected)return;
    const emp=p.sections.donors?.orgs||[],pac=p.sections.pac?.rows||[],months=p.sections['donor-months']?.months||{},lob=p.sections.lobbying?.rows||[];
    if(!emp.length&&!pac.length){liveStock(s,p,[],[]);host.innerHTML=`<p class="small muted"><b>Coming from the daily refresh:</b> the top ${TOP_DONORS} donor organizations by month (each one's PAC plus its employees), and lobbying on bills ${esc(s.short)} acted on. They fill in from FEC and LDA.gov once the keys are set. <a href="#updates">Update status</a></p>`;return;}
    const orgs=new Map();
    for(const e of emp){const k=orgKey(e.employer);orgs.set(k,{name:e.employer,pac:0,emp:e.total});}
    for(const x of pac){const k=orgKey(x.name);const o=orgs.get(k)||{name:x.name,pac:0,emp:0};o.pac+=x.amount;orgs.set(k,o);}
    const top=[...orgs.values()].map(o=>({...o,total:o.pac+o.emp})).sort((a,b)=>b.total-a.total).slice(0,TOP_DONORS);
    const mine=new Set([...(p.sections.legislation?.rows||[]),...(p.sections.cosponsored?.rows||[])].map(r=>r.bill||String(r.id).toLowerCase()).concat(p.sections.legislation?.bills||[],p.sections.cosponsored?.bills||[]).concat(DATA.votes.concat(DATA.hvotes).filter(v=>v.pos&&s.id in v.pos).map(voteBill)).filter(Boolean));
    const stake=lob.filter(l=>l.bills.some(b=>mine.has(b)));
    const hits=liveStock(s,p,top,stake);
    const mrows=Object.entries(months).map(([org,series])=>({label:org,series,markers:[]})).slice(0,8),ms=[...new Set(mrows.flatMap(r=>Object.keys(r.series)))].sort();
    for(const {org,trade:t} of hits){const row=mrows.find(r=>corp(r.label)===corp(org));if(row)row.markers.push({date:t.traded,kind:'trade',label:`${t.type||'Trade'} of ${t.asset||t.ticker} (disclosed, not yet reviewed)`});}
    const allMonths=[];if(ms.length)for(let m=ms[0];m<=ms.at(-1);m=addMonths(m,1))allMonths.push(m);
    host.innerHTML=`<div class="chart"><h3>Top ${top.length} donor organizations this cycle</h3><div class="sub">Each organization's PAC giving plus its employees' itemized giving, grouped by employer. Donors' names are never shown. From the latest FEC refresh.</div>
      ${rankBars(top.map(o=>({label:o.name,value:Math.round(o.total/top[0].total*100),color:'var(--s1)',display:fmt$(o.total),note:[o.pac&&`PAC ${fmt$(o.pac)}`,o.emp&&`employees ${fmt$(o.emp)}`].filter(Boolean).join(' · '),tip:`${o.name}: ${fmtFull(o.total)}. ${EMPLOYER_ABOUT}`})))}</div>
      ${mrows.length?`<div class="chart"><h3>Top donors' employees by month</h3><div class="cx-plot" id="f-live-months"></div></div>`:''}
      <div class="chart"><h3>Who had a stake</h3><div class="sub">Lobbying reports filed for top donor organizations that name a bill ${esc(s.short)} sponsored, cosponsored or voted on (LDA.gov).</div>${stake.length?`<ul class="list small">${stake.map(l=>`<li>${esc(l.org)} (${esc(l.registrant||'self-filed')}, ${esc(l.period||'')} ${esc(l.year||'')}): ${l.bills.filter(b=>mine.has(b)).map(b=>esc(billLabel(b))).join(', ')}${l.url?` <a href="${esc(l.url)}" target="_blank" rel="noopener">report ↗</a>`:''}</li>`).join('')}</ul>`:'<p class="small muted">No lobbying report from a top donor names one of these bills yet.</p>'}</div>`;
    if(mrows.length){const f=()=>drawMonthly(document.getElementById('f-live-months'),mrows,allMonths,[]);f();resizers.push(f);}
    hoverTips(host);
  }catch{if(host.isConnected)host.innerHTML='<p class="small muted">The refreshed donor and lobbying records are unavailable right now. The analysis above uses the reviewed research.</p>';
    const el=document.getElementById('f-live-stock');if(el)el.innerHTML='<p class="small muted" style="margin:8px 0 0">The latest disclosed trades are unavailable right now.</p>';}
}
// Outside spending for and against, each split by the spenders' sectors and colored People- or Profit-aligned.
function outsideSectorBlock(s){
  const o=s.out;if(!o||!o.cms?.length)return '';
  const by=outsideBySector(o.cms,cmOf),F=by.for.reduce((t,x)=>t+x.amount,0),A=by.against.reduce((t,x)=>t+x.amount,0),q=moneyRatio(F,A);
  const fw=o.multi?'Supporting':'For',aw=o.multi?'Opposing':'Against';
  const cats=[...new Set([...by.for,...by.against].map(x=>x.cat))];
  const amt=(side,c)=>side.find(x=>x.cat===c)?.amount||0;
  return `<div class="chart" id="f-out-sector"><h3>Outside spending by sector</h3><div class="sub">${points([['Each bar',`Split by the spending groups' sectors, ${period(o.start,o.end)}.`],['People-aligned','Unions.'],['Profit-aligned','Industry and corporate groups.'],['Other','Party, ideological and candidate-aligned groups.'],['Sectors','Assigned by this app from each committee\'s name. Under review.']],'small')}</div>
    ${q?`<p class="small" style="margin:0 0 6px"><span class="hc-ratio" style="margin-left:0;font-size:.8rem">${q.oneSided?`<b class="${q.side}">${esc(q.text[0].toUpperCase()+q.text.slice(1))}</b>`:`For-to-against <b class="${q.side}">${esc(q.text)}</b>`}</span></p>`:''}
    ${sectorSpendBars(by,catLabel,{fw,aw})}${legend([['var(--s1)',ALIGN_LABEL.people],['var(--s5)',ALIGN_LABEL.profit],['var(--cx-other)',ALIGN_LABEL.other]])}
    ${tableView(['Sector','Alignment',`Amount ${fw.toLowerCase()}`,`Amount ${aw.toLowerCase()}`],cats.map(c=>[esc(catLabel(c)),ALIGN_LABEL[categoryAlign(c)],fmtFull(amt(by.for,c)),fmtFull(amt(by.against,c))]))}</div>`;
}

// ---------- score pages: each grade ranks everyone; people who are "Not graded" stay as grey rows ----------
const SCORE_PAGES=[['ideology','Ideology'],['word','Keeps Their Word'],['showsup','Shows Up'],['unbought','Unbought'],['aboveboard','Above Board'],['peoplefirst','People First'],['match','Your Match']];
const GRADE_FILL={A:'var(--good)',B:'var(--grade-b)',C:'var(--warn)',D:'var(--serious)',F:'var(--crit)'};
const gradeFill=p=>GRADE_FILL[letter(p)];
const whoSub=s=>`${partyName(s.party)} · ${chipCh(s)} · ${seatLabel(s)}`;
// Points lost on the Ethics grade, by kind, in the palette's fixed order.
const ETH_SEGS=[{key:'finding',label:'Legal Trouble: confirmed findings',color:'var(--s1)'},{key:'open',label:'Legal Trouble: open investigations',color:'var(--s2)'},{key:'closed',label:'Legal Trouble: closed without a finding',color:'var(--s3)'},{key:'insider',label:'Insider Trading (a tenth)',color:'var(--s4)'},{key:'dodger',label:'Stock Disclosure Dodger (a tenth)',color:'var(--s5)'}];
const PROM_SEGS=[{key:'consistent',label:'Supported',color:'var(--good)'},{key:'partial',label:'Partly supported',color:'var(--warn)'},{key:'changed',label:'Changed position',color:'var(--warn)',cls:'cx-hatch'},{key:'contradiction',label:'Contradicted',color:'var(--crit)'}];
// The points each part took off. Legal Trouble is split by status, scaled down when its total is capped at 100.
function ethicsPoints(s){const e=personEthics(s),L=e.legal,k=L.total?L.index/L.total:0,by=st=>Math.round(L.rows.filter(r=>r.status===st).reduce((t,r)=>t+r.points,0)*k*10)/10;
  return {e,parts:{finding:by('finding'),open:by('open'),closed:by('closed'),insider:Math.round(e.insiderCost*10)/10,dodger:Math.round(e.dodgerCost*10)/10}};}
function promiseCounts(s){const c={consistent:0,partial:0,changed:0,contradiction:0};for(const x of s.statements||[])if(!x.vague&&!x.debate&&x.assessment in c)c[x.assessment]++;return c;}
// One letter grade for everyone, highest first; the people not graded yet follow, with why.
function scoresGrade(host,key,note){
  const rows=ALL.map(s=>({s,x:sixOf(s)[key]})).sort((a,b)=>(b.x.pct??-1)-(a.x.pct??-1)||a.s.name.localeCompare(b.s.name));
  const graded=rows.filter(r=>r.x.pct!=null).length;
  host.innerHTML=`<div class="chart"><h3>${esc(SIX_BY[key].name)}</h3><div class="sub">${graded} of ${ALL.length} have enough evidence for a grade. <a href="#method-${key}">How it's calculated</a></div>
    ${rankBars(rows.map(({s,x})=>({label:s.name,sub:whoSub(s),href:`#${s.id}-${key}`,value:x.pct,color:x.pct==null?null:gradeFill(Math.min(100,x.pct)),cls:x.pct==null?'':'gr-'+letter(Math.min(100,x.pct)),display:x.pct==null?'':`${letter(Math.min(100,x.pct))} ${x.pct}`,note:x.pct==null?x.why:note(x),tip:x.pct==null?x.why:`${s.name}: ${x.pct}`})))}
    ${tableView(['Name','Score','Based on'],rows.map(({s,x})=>[`<a href="#${s.id}-${key}">${esc(s.name)}</a>`,x.pct==null?'Not graded yet':`${letter(Math.min(100,x.pct))} ${x.pct}`,esc(x.pct==null?x.why:note(x))]))}</div>`;
}
// Ideology: everyone from most liberal to most conservative, and Voteview's chamber chart.
function scoresLean(host){
  const rows=ALL.map(s=>({s,x:sixOf(s).ideology})).sort((a,b)=>(a.x.lean??999)-(b.x.lean??999)||a.s.name.localeCompare(b.s.name));
  host.innerHTML=`<div class="chart"><h3>From most liberal to most conservative</h3><div class="sub">The overall lean from each record, −100 to +100. A position, not a grade. ${rows.filter(r=>r.x.lean!=null).length} of ${ALL.length} have enough issues to place.</div>
    ${tableView(['Name','Lean','Issues','DW-NOMINATE'],rows.map(({s,x})=>[`<a href="#${s.id}-ideology">${esc(s.name)}</a>`,x.lean==null?'Not placed yet':`${signed(x.lean)} · ${esc(x.label)}`,x.scored,x.dw==null?'—':signed(x.dw)]))}</div><div id="sc-dw"></div>`;
  scoresIdeology(host.querySelector('#sc-dw'));
}
// Unbought reads each person's financial disclosure from the official records, so it is graded on the profile.
function scoresUnbought(host){
  host.innerHTML=`<div class="chart"><h3>Unbought</h3><div class="sub">IntegrityIndex.us's published formula. Each grade is figured on the profile from the FEC reports and the financial disclosure read from the official records, so open a profile to see it. <a href="#method-unbought">How it's calculated</a></div>
    ${tableView(['Name','Raised','From PACs'],ALL.filter(s=>!s.office).map(s=>[`<a href="#${s.id}-unbought">${esc(s.name)}</a>`,s.camp?.missing?'No FEC report yet':fmt$(s.camp?.receipts),s.camp?.receipts>0?`${(100*(s.camp.pac||0)/s.camp.receipts).toFixed(1)}%`:'—']))}</div>`;
}
function renderScores(sub){
  sub=({promises:'word',ethics:'aboveboard',integrity:'word',pvp:'peoplefirst'})[sub]||sub;if(!SCORE_PAGES.some(([k])=>k===sub))sub='ideology';
  const N=ALL.length,title=SCORE_PAGES.find(([k])=>k===sub)[1];
  const head=`<section class="hero" style="padding-bottom:6px"><div class="asof">Scores · ${N} politicians and candidates</div><h1 style="margin-top:8px">${esc(title)}</h1>
    <p class="lede">${esc(SIX_BY[sub]?.q||'Each page ranks everyone on one score.')}</p>${points([['Data points','Each row says what the score is built on.'],['Not graded','People with too little evidence are still listed, not left out.']],'lede-pts')}
    <nav class="sc-tabs" aria-label="Score pages">${SCORE_PAGES.map(([k,l])=>`<a href="#scores-${k}" class="${k===sub?'active':''}">${esc(l)}</a>`).join('')}</nav></section><section class="section" id="sc-body"></section>`;
  app.innerHTML=head;
  const body=$('#sc-body');
  ({match:scoresMatch,ideology:scoresLean,word:scoresPromises,showsup:h=>scoresGrade(h,'showsup',x=>x.parts[0].note||''),unbought:scoresUnbought,aboveboard:h=>scoresGrade(h,'aboveboard',x=>x.parts.filter(p=>p.index!=null).map(p=>p.label).join(', ')||'no index read yet'),peoplefirst:h=>{scoresGrade(h,'peoplefirst',x=>x.v?.n?`${x.v.nPeople} of ${x.v.n} actions for working people`:'');h.insertAdjacentHTML('beforeend',billsBlock(PVP_BILLS));mountBillLobbying(h);}})[sub](body);
  hoverTips(body);bindTips(body);
}
function scoresMatch(host){
  const ch=chosenIssues();
  const rows=ALL.map(s=>({s,r:scoreFor(s)})).sort((a,b)=>(b.r.score??-1)-(a.r.score??-1)||b.r.nCov-a.r.nCov||a.s.name.localeCompare(b.s.name));
  const bars=rankBars(rows.map(({s,r})=>({label:s.name,sub:whoSub(s),href:`#${s.id}-match`,value:r.score,color:r.score==null?null:gradeFill(r.score),cls:r.score==null?'':'gr-'+letter(r.score),display:r.score==null?'':`${letter(r.score)} ${r.score}%`,
    note:!ch.length?'choose your issues':`${r.nCov} of ${r.nChosen} issues`,tip:r.score==null?'':`${s.name}: ${r.score}% match on ${r.nCov} of your ${r.nChosen} issues`})));
  const graded=rows.filter(x=>x.r.score!=null);
  host.innerHTML=`${ch.length?'':`<div class="note" style="margin-bottom:12px"><b>Choose your positions first.</b> This ranking compares each record with the positions you pick in <a href="#align">My alignment</a>, weighted by how important you say each issue is. Your choices stay in this browser.</div>`}
    <div class="chart"><h3>Match with your positions</h3><div class="sub">${ch.length?`${graded.length} of ${ALL.length} have evidence on enough of your ${ch.length} issues for a grade. <b>Bar color:</b> the grade. <b>Note under each value:</b> how many of your issues have evidence.`:'Everyone shows as Not graded until you choose issues.'}</div>${bars}
    ${tableView(['Name','Score','Issues with evidence'],rows.map(({s,r})=>[`<a href="#${s.id}-match">${esc(s.name)}</a>`,r.score==null?'Not graded':`${letter(r.score)} ${r.score}%`,`${r.nCov} of ${r.nChosen}`]))}</div>
    ${ch.length?`<div class="chart"><h3>Issue by issue</h3><div class="sub">For one person: how much of their record matches your side on each issue. Most important issues first.</div>
      <label class="small">Person <select id="sc-person">${rows.map(({s})=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><div id="sc-issues"></div></div>`:''}`;
  const sel=host.querySelector('#sc-person');
  const drawIssues=()=>{const s=byId[sel.value],r=scoreFor(s);const list=r.rows.slice().sort((a,b)=>b.pr.w-a.pr.w);
    host.querySelector('#sc-issues').innerHTML=rankBars(list.map(x=>({label:x.i.label,sub:`you: ${sideLabel(x.i.id,x.pr.side)} · importance ${WLAB[x.pr.w]}`,value:x.status==='none'?null:Math.round(x.agree*100),color:'var(--s1)',
      display:x.status==='none'?'':`${Math.round(x.agree*100)}%`,note:x.status==='none'?'no evidence':`${x.match} of ${x.n} ${x.status==='record'?'actions':'statements'}`,tip:x.status==='none'?'':`${x.i.label}: ${x.match} of ${x.n} match your side`})));
    hoverTips(host);};
  if(sel){sel.addEventListener('change',drawIssues);drawIssues();}
}
function scoresIntegrity(host){
  const entry=(window.INTEGRITYLOG||[]).at(-1),rows=ALL.map(s=>({s,r:entry?.scores?.[s.id]?.integrity||null,c:entry?.scores?.[s.id]?.coverage||{}})).sort((a,b)=>(b.r?.pct??-1)-(a.r?.pct??-1)||a.s.name.localeCompare(b.s.name));
  const graded=rows.filter(x=>Number.isFinite(x.r?.pct)).length;
  host.innerHTML=`<div class="note"><b>Provisional and uncalibrated.</b> Latest separate monthly comparison snapshot${entry?` · ${fmtDate(entry.date)}`:''}. The published Ethics and Promises Delivered history remains preserved. At least two complete components and a sourced Legal Trouble review are required.</div><div class="chart"><h3>Integrity and evidence coverage</h3><p class="sub">${graded} of ${rows.length} have an overall score. Available component results remain visible on each profile when the overall score is Not graded; missing evidence never means a clean result.</p>${rankBars(rows.map(({s,r,c})=>({label:s.name,sub:whoSub(s),href:`#${s.id}-integrity`,value:r?.pct??null,color:r?.pct==null?null:gradeFill(r.pct),cls:r?.pct==null?'':'gr-'+letter(r.pct),display:r?.pct==null?'':`${letter(r.pct)} ${r.pct}%`,note:r?.why||`${['honesty','personalFinances','fundraising'].filter(k=>c[k]).length} complete components`,empty:'Not graded',tip:r?.why||'Latest monthly comparison'})))}${tableView(['Name','Integrity','Components','Explanation'],rows.map(({s,r,c})=>[`<a href="#${s.id}-integrity">${esc(s.name)}</a>`,r?.pct==null?'Not graded':`${letter(r.pct)} ${r.pct}%`,['honesty','personalFinances','fundraising','legal'].filter(k=>c[k]).join(', ')||'None complete',esc(r?.why||'Sourced legal review and two components recorded')]))}</div><p class="small muted">Open a profile’s <a href="#${rows[0]?.s.id||''}-integrity">Integrity section</a> for formulas, sources, dates, missing-data reasons and historical published scores.</p>`;
}
function scoresPromises(host){
  const rows=ALL.map(s=>({s,p:SCORER.promises(s),c:promiseCounts(s)})).sort((a,b)=>(b.p.pct??-1)-(a.p.pct??-1)||b.p.clear-a.p.clear||a.s.name.localeCompare(b.s.name));
  const graded=rows.filter(x=>x.p.pct!=null).length;
  host.innerHTML=`<div class="chart"><h3>Promises and stated positions checked against the record</h3><div class="sub">${points([['Raw counts','A grade built on 3 checks looks different from one built on 20.'],['Graded',`${graded} of ${ALL.length} have the ${MIN_CHECKS} counted checks a grade needs.`],['Not counted','Ambiguous checks, outcome checks, promises with no related bill yet, vague goals, and statements made in debate the day of the vote or the day before.']],'small')}</div>
    ${legend(PROM_SEGS.map(x=>[x.color,x.label,x.cls]))}
    ${stackRows(rows.map(({s,p,c})=>({label:s.name,sub:whoSub(s),href:`#${s.id}-promises`,parts:c,grey:p.pct==null,value:p.pct==null?'Not graded':`${letter(p.pct)} ${p.pct}%`,cls:p.pct==null?'':'gr-'+letter(p.pct),note:`${p.clear} counted check${p.clear===1?'':'s'}`,empty:'No counted checks'})),PROM_SEGS,{unit:''})}
    ${tableView(['Name','Score','Kept','Half','Contradicted','Not counted'],rows.map(({s,p,c})=>[`<a href="#${s.id}-promises">${esc(s.name)}</a>`,p.pct==null?'Not graded':`${letter(p.pct)} ${p.pct}%`,c.consistent,`${c.partial} partly, ${c.changed} changed`,c.contradiction,p.notCounted+p.vague+(p.debate||0)]))}</div>`;
}
function scoresEthics(host){
  const rows=ALL.map(s=>({s,...ethicsPoints(s)}));
  const noCases=rows.filter(({e})=>!e.finding&&!e.open&&!e.closed&&!e.allegation).length;
  const ded=rows.filter(({e})=>e.raw<100).sort((a,b)=>a.e.pct-b.e.pct||a.s.name.localeCompare(b.s.name));
  host.innerHTML=`<div class="cx-stats"><div class="cx-stat"><span>No recorded cases</span><b>${noCases} of ${ALL.length}</b><small>No finding, investigation or allegation in the sources checked</small></div><div class="cx-stat"><span>Lost points</span><b>${ded.length} of ${ALL.length}</b><small>Have at least one deduction</small></div></div>
    <div class="chart"><h3>Points lost, by kind</h3><div class="sub">${points([['Shown','Only people with deductions. Everyone else scores 100%.'],['Legal Trouble Index 🚨',`Costs all of its value, split here by each case's status. A case: ${ETHICS_COST.finding} for a confirmed finding, ${ETHICS_COST.open} open, ${ETHICS_COST.closed} closed without a finding; criminal × ${CASE_KIND.criminal}, technical × ${CASE_KIND.technical}; × ${CASE_AGE.factor} after ${CASE_AGE.years} years.`],['Trading indexes','The Insider Trading 📈 and Stock Disclosure Dodger 🙈 indexes cost a tenth of their value each.']],'small')}</div>
    ${legend(ETH_SEGS.map(x=>[x.color,x.label]))}
    ${ded.length?stackRows(ded.map(({s,e,parts})=>({label:s.name,sub:whoSub(s),href:`#${s.id}-ethics`,parts,value:`${letter(e.pct)} ${e.pct}%`,cls:'gr-'+letter(e.pct),note:`−${100-e.pct} points`})),ETH_SEGS,{unit:' points'}):'<p class="small muted">No one has a deduction.</p>'}
    ${tableView(['Name','Score','Points lost','Legal Trouble','Insider Trading','Stock Disclosure Dodger','Findings','Open','Closed','Allegations (not scored)'],rows.sort((a,b)=>a.e.pct-b.e.pct||a.s.name.localeCompare(b.s.name)).map(({s,e})=>[`<a href="#${s.id}-ethics">${esc(s.name)}</a>`,`${letter(e.pct)} ${e.pct}%`,100-e.pct,e.legal.index,e.insider.index??'—',e.dodger.index??'—',e.finding,e.open,e.closed,e.allegation]))}</div>`;
}
function scoresPvp(host){
  const rows=ALL.map(s=>({s,v:personPvp(s)})).sort((a,b)=>(b.v.pct??-1)-(a.v.pct??-1)||b.v.n-a.v.n||a.s.name.localeCompare(b.s.name));
  const graded=rows.filter(x=>x.v.pct!=null);
  const pts=graded.filter(x=>x.s.ideo).map(({s,v})=>({x:s.ideo.dim1,y:v.pct,cls:s.party,tip:`${s.name}: ${v.pct}% for working people · DW-NOMINATE ${s.ideo.dim1>0?'+':''}${s.ideo.dim1.toFixed(2)}`}));
  host.innerHTML=`${PVP_MARKS.size?'':`<div class="note" style="margin-bottom:12px"><b>No bills are scored yet, so no one has this grade.</b> A bill counts once a nonpartisan study of who gains from it is cited, or worker and business groups took opposite sides on it. Until then everyone is listed as Not graded.</div>`}
    <div class="chart"><h3>Who their record delivered more for</h3><div class="sub"><b>Right of 50%:</b> their grade leans toward working people. <b>Left:</b> toward the wealthy and corporations. <b>The grade:</b> three quarters their scored actions, one quarter 100 minus the Corporation Compromised Index 🏢. ${graded.length} of ${ALL.length} have the ${MIN_PVP_ACTIONS} scored actions a grade needs.</div>
    ${divergingRows(rows.map(({s,v})=>({label:s.name,sub:whoSub(s),href:`#${s.id}-pvp`,value:v.pct,cls:v.pct==null?'':'gr-'+letter(v.pct),note:v.pct==null?`${v.n} of ${MIN_PVP_ACTIONS} actions`:`${v.nPeople} of ${v.n} actions`,tip:v.pct==null?'':`${s.name}: ${v.people} points for working people, ${v.profit} for the wealthy and corporations`})))}
    ${tableView(['Name','Score','Bills','Corporation Compromised 🏢','Actions','People points','Profit points'],rows.map(({s,v})=>[`<a href="#${s.id}-pvp">${esc(s.name)}</a>`,v.pct==null?'Not graded':`${letter(v.pct)} ${v.pct}%`,v.billsPct==null?'—':`${v.billsPct}%`,v.cci?.index??'—',v.n,v.people,v.profit]))}</div>
    ${billsBlock(PVP_BILLS)}
    <div class="chart"><h3>People First against ideology</h3><div class="sub">Each graded person with a DW-NOMINATE score. <b>Look for outliers:</b> someone far from others with a similar ideology.</div>
    ${pts.length?`<div class="cx-plot" id="sc-scatter"></div>${legend([['var(--dem)','Democrats'],['var(--rep)','Republicans'],['var(--muted)','Independents']])}`:'<p class="small muted">Nothing to plot until people are graded.</p>'}</div>`;
  if(pts.length){const f=()=>drawScatter(document.getElementById('sc-scatter'),pts,{x:{min:-1,max:1,ticks:[-1,-.5,0,.5,1],left:'More liberal',right:'More conservative',label:'DW-NOMINATE'},y:{min:0,max:100,ticks:[0,25,50,75,100],label:'People First'}});f();resizers.push(f);}
  mountBillLobbying(host);
}
function scoresIdeology(host){
  const list=ALL.filter(s=>s.ideo);
  host.innerHTML=`<div class="chart"><h3>Where each sits in the chamber</h3><div class="sub">Voteview's DW-NOMINATE score for the whole chamber, with one person highlighted. ${list.length} of ${ALL.length} have a score. <b>Not graded:</b> it describes a voting pattern, not a better or worse record.</div>
    <label class="small">Person <select id="sc-ideo-p">${list.map(s=>`<option value="${s.id}">${esc(s.name)} (${CH[icH(s)].name})</option>`).join('')}</select></label><div id="sc-ideo-host"></div></div>`;
  const sel=host.querySelector('#sc-ideo-p');
  const draw=()=>{const s=byId[sel.value];resizers=resizers.filter(f=>!f.ideoPage);host.querySelector('#sc-ideo-host').innerHTML=ideoBlock(s,'sc-ideo');const f=()=>drawIdeo(document.getElementById('sc-ideo'),s);f.ideoPage=true;f();resizers.push(f);};
  sel.addEventListener('change',draw);draw();
}

// The latest entries of the monthly change log, newest first.
function methodLog(){
  const migrations=(window.SCOREMIGRATIONS||[]).map(e=>`<div class="note"><b>Presentation migration · ${fmtDate(e.date)}</b><p>${esc(e.note)}</p></div>`).join('');
  const L=(window.SCORELOG||[]).slice(-3).reverse();if(!L.length)return migrations+'<p class="small muted">No monthly recalculation has been recorded yet.</p>';
  const G={promises:'Promises delivered',ethics:'Ethics',pvp:'People First',all:'All grades'},pc=v=>v==null?'Not graded':v+'%';
  return migrations+L.map(e=>`<div class="chart"><h3>${fmtDate(e.date)}</h3><div class="sub">Research reviewed ${esc(e.reviewedAt)} · ${esc(e.note||'')}</div>${e.changes.length?`<div class="tablewrap"><table><thead><tr><th>Person</th><th>Grade</th><th>From</th><th>To</th><th>Why</th></tr></thead><tbody>${e.changes.slice(0,60).map(c=>`<tr><td>${byId[c.id]?`<a href="#${c.id}">${esc(byId[c.id].name)}</a>`:esc(c.id)}</td><td>${G[c.grade]||esc(c.grade)}</td><td>${c.from===undefined?'—':pc(c.from)}</td><td>${pc(c.to)}</td><td class="small">${esc(c.why)}</td></tr>`).join('')}</tbody></table></div>${e.changes.length>60?`<p class="small muted">and ${e.changes.length-60} more in the log file.</p>`:''}`:'<p class="small muted">No grade changed.</p>'}</div>`).join('');
}
function integrityPreviewLog(){
  const entries=(window.INTEGRITYLOG||[]).slice(-3).reverse();
  if(!entries.length)return '<p class="small muted">No preview comparison has been recorded. <code>npm run integrity:monthly</code> writes to the separate preview log.</p>';
  return entries.map(e=>`<div class="chart"><h3>${fmtDate(e.date)}</h3><p class="sub">${esc(e.note||'Integrity preview only')} · Reviewed ${esc(e.reviewedAt||'date unavailable')}. Not official score history.</p>${e.changes?.length?`<div class="tablewrap"><table><thead><tr><th>Person</th><th>Preview</th><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>${e.changes.slice(0,30).map(c=>`<tr><td>${byId[c.id]?`<a href="#${c.id}">${esc(byId[c.id].name)}</a>`:esc(c.id)}</td><td>${esc(c.grade)}</td><td>${c.from==null?'Not graded':c.from+'%'}</td><td>${c.to==null?'Not graded':c.to+'%'}</td><td>${esc(c.why)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">No preview value changed.</p>'}</div>`).join('');
}
// The Methodology page's section for each of the six scores: its definition, what it uses and its formula.
function methodSix(){
  const W=UNBOUGHT;
  const f=t=>`<div class="st-formula">${t}</div>`;
  const rows=[
    ['ideology','Ideology',SIX_BY.ideology.q,'Votes, bills, cosponsorships and official acts on each issue; statements (half, only with no action); each vote\'s reviewed side; Voteview\'s DW-NOMINATE; each interest group\'s published scorecard.',
      f('Issue lean = 100 × (conservative items − liberal items) ÷ all items')+f('Overall lean = average of the left–right issue leans (at least 3)')+f('Ratings lean = average of ±(2 × score − 100)')+f('DW-NOMINATE lean = 100 × first-dimension score')+'<p class="small">Scale: −100 most liberal to +100 most conservative; very liberal below −60, liberal to −20, moderate to +20, conservative to +60, very conservative above. Issues that split both parties are shown, not averaged. Your Match, on this tab, compares your positions with their record.</p>'],
    ['word','Keeps Their Word',SIX_BY.word.q,'Promises from campaign sites and posts, speeches, press releases and signed pledges, each checked against the action that decided it; PolitiFact\'s tracker for a president.',
      f('Keeps Their Word = 100 × (kept + ½ × (partly kept + changed)) ÷ counted checks')+`<p class="small">At least ${MIN_CHECKS} counted checks. Vague goals, promises with no related bill yet and statements made in debate the day of the vote or the day before are shown, not counted.</p>`],
    ['showsup','Shows Up',SIX_BY.showsup.q,'Every roll call from 2018 on (Voteview); the bills they sponsored and how far each got (Congress.gov).',
      f('Shows Up = 0.75 × Attendance + 0.25 × Get It Done')+f('Attendance = 100 − 5 × % of votes missed')+f('Get It Done = 100 × min(1, their bills advanced rate ÷ their party\'s typical rate)')+'<p class="small">At least 50 votes; Attendance alone with fewer than 10 sponsored bills.</p>'],
    ['unbought','Unbought',SIX_BY.unbought.q,'FEC reports (gift sizes, PAC money by type, gifts routed through groups); their financial disclosure (stocks held, trades); pledges and reform bills. <a href="https://integrityindex.us/methodology" target="_blank" rel="noopener">IntegrityIndex.us\'s published formula ↗</a>, credited to them.',
      f('Unbought = 75 + Donor − PAC − PAC Reliance − Earmarks − Stocks − Trades + Bonuses + Pledges, never below 0')+`<p class="small">House: donor weights ${W.H.donor.join(' · ')} (≤$200 to $2,000+), unitemized ${W.H.unitemized}, not yet sorted ${W.H.unsorted}; PAC per dollar: corporate ${W.H.pac.corporate}, lobbyist ${W.H.pac.lobbyist}, trade ${W.H.pac.trade}, political and ideological ${W.H.pac.political}, union and other ${W.H.pac.union}. Senate: donor weights ${W.S.donor.join(' · ')}, unitemized ${W.S.unitemized}, not yet sorted ${W.S.unsorted}; PAC per dollar ${W.S.pac.corporate} · ${W.S.pac.lobbyist} · ${W.S.pac.trade} · ${W.S.pac.political} · ${W.S.pac.union}. Earmarks ${W.earmark} per dollar (not ActBlue or WinRed). PAC Reliance ${W.reliance.max} × Hill(PAC share, 20%). Stocks ${W.stocks.max} × Hill(value, $400,000). Trades ${W.trades.countMax} × Hill(count, 50) + ${W.trades.valueMax} × Hill(value, $8,000). Bonuses +5 no corporate PAC money, +1 pledged not to take it, +1 no individual stocks; +1 each for a pledge or cosponsored bill to ban lobbying by former members, ban congressional stock trading, overturn Citizens United. Filled in where their page gives no number: PAC penalty at most 30, donor score 0–16 (House) or 0–14 (Senate), PAC Reliance midpoint 20%, stock value as the total of range midpoints. A broken pledge earns no point. No grade until their financial disclosure is read.</p>`],
    ['aboveboard','Above Board',SIX_BY.aboveboard.q,'Financial disclosures (outside pay, board seats, job deals, gifts, paid trips, trades and filing dates); lobbying reports, federal contracts, foreign-agent filings, committees and votes; court, ethics and enforcement cases.',
      f('Above Board = 100 − (0.35 × Outside Income & Conflicts + 0.20 × Gifts & Travel + 0.25 × Trade Conflicts + 0.20 × Stock Disclosure Dodger) − Legal Trouble')+f('Trade Conflicts = 0.45 × share in their committees\' sectors + 0.30 × share within 30 days of a related vote + 0.25 × share in donor companies')+f('Stock Disclosure Dodger = 0.70 × share of trade reports late or missing + 0.30 × share of annual reports late')+f('Legal Trouble = Σ status (20 · 15 · 5) × kind (1.5 · 1 · 0.5), halved when closed over 10 years ago')+'<p class="small">A missing index drops out and the others are rescaled. It needs the legal review and at least one index. Trade Conflicts was the Insider Trading Index, without its single-stock activity part. It shows overlap, not proof of wrongdoing.</p>'],
    ['peoplefirst','People First',SIX_BY.peoplefirst.q,'Their votes and bills, each scored by who gains and which worker and business groups took sides; their business funders\' positions and lobbying.',
      f('People First = 0.75 × Legislative Action + 0.25 × (100 − CCI)')+f('Legislative Action = 100 × worker-side points ÷ (worker-side + profit-side points)')+f('CCI = 0.65 × voting with business funders beyond their party + 0.35 × profit side on donor-lobbied bills')+`<p class="small">The Corporation Compromised Index keeps only how they act; Unbought counts where the money comes from. At least ${MIN_PVP_ACTIONS} scored actions.</p>`],
  ];
  return rows.map(([key,name,q,uses,formula])=>`<section class="method-six" id="method-${key}"><h3>${esc(name)}</h3><p><b>Definition:</b> ${esc(q)}</p><p><b>Uses:</b> ${uses}</p>${formula}</section>`).join('');
}
function renderMethod(sub){
  const sv=DATA.votes.length, hv=DATA.hvotes.length;
  const nRows=Object.values(IE.rows).reduce((a,r)=>a+r.length,0);
  app.innerHTML=`
  <section class="hero" style="padding-bottom:10px"><div class="asof">How this works</div><h1 style="margin-top:8px">Methodology</h1><p class="lede">What is covered, where every number comes from, how figures are calculated, and what is missing.</p></section>
  <section class="section prose" id="method-six">
    <h2>The six scores (November 7, 2026)</h2>
    <p>Each profile has an Overview and one tab per score. Ideology is a position from liberal to conservative, not a grade; the other five are letter grades (A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below 60). Without its evidence a score says "Not graded yet" and why — never a zero. Integrity is retired: its parts are now separate grades. Its past values, and the older Ethics and Promises Delivered grades, stay in the score log.</p>
    ${methodSix()}
  </section>
  <section class="section prose">
    <h2>What changed in this version (November 1, 2026)</h2>
    <ul class="list">
      <li><b>Donors by gift size:</b> the Overview's money card has a second bar that splits individual gifts into the FEC's five size groups, from the daily refresh. Shown only.</li>
      <li><b>PAC types:</b> each PAC's type as the FEC records it (corporate, trade association, labor union, leadership PAC and so on) is shown beside the sector this app assigns from its name, once it has been looked up. Shown only.</li>
      <li><b>Bundled donations:</b> what AIPAC's, Club for Growth's, EMILY's List's, J Street's and the Senate Conservatives Fund's PACs forwarded from their donors to each campaign is now read from those PACs' own FEC reports, and shown beside each group's own money (see "Money routed through PACs on donors' behalf" below). It counts as that group's money in Donor Loyalty and Vote Donor Alignment, never in a grade.</li>
      <li><b>Net worth:</b> a range from each sitting member's latest annual financial disclosure, on the Ethics tab and the Overview's ethics card (see "Ethics and compliance" below). Shown only.</li>
      <li><b>Money in politics and congressional ethics:</b> a new Your match issue, the 16th: banning members' stock trading and lobbying after office, and overturning Citizens United. Sponsoring or cosponsoring one of the six bills on it counts as an action.</li>
      <li><b>Donor Loyalty 🤝 cap:</b> no single funder counts for more than all the others put together (at most half the weight), so one large funder with one position on file can't decide the number alone.</li>
      <li><b>Money pledges checked against the records:</b> 12 pledges on the Promises tabs (corporate PAC money, single-issue PAC money and stock-trading bans) now show what the FEC records, the bills' cosponsors and the votes on file say, under the reviewed verdict. Shown only.</li>
      <li><b>Blind trusts and divestment:</b> a qualified blind trust now takes its trustee's trades out of the trading indexes, and "no individual stocks" is shown on the Insider Trading Index. Managed accounts aren't excused. Two statuses are reviewed so far (Ossoff and Hinson), and no grade changed.</li>
      <li><b>Corporation Compromised Index 🏢 in People First:</b> a quarter of the grade is now 100 minus the index, which measures business PACs' share of the money raised and votes with business funders beyond the party. Three letter grades changed (Kaptur, Gonzalez and Castor, from A); each People First tab shows the math.</li>
      <li><b>No other grade formula changed.</b> Your match changes only for visitors who pick the new issue.</li>
    </ul>
    <details class="tv"><summary>Earlier changes (October 28, 2026)</summary>
    <ul class="list">
      <li><b>Ethics indexes:</b> the Ethics grade is now 100 − the Legal Trouble Index 🚨 − a tenth of the Insider Trading Index 📈 − a tenth of the Stock Disclosure Dodger Index 🙈. A case now counts by its kind (criminal cases more, technical ones less) and its age (half after 10 years). Thirteen grades changed. Each changed grade says so on its Ethics tab, and the next monthly recalculation logs why.</li>
    </ul></details>
    <details class="tv"><summary>Earlier changes (October 24, 2026)</summary>
    <ul class="list">
      <li><b>New scoring rules (Rule 1):</b> votes, sponsorships, cosponsorships and official acts count fully. Statements count half, and only where no action exists. A vote and a sponsorship on the same bill count once. Promises left unacted at the end of a term count as contradicted. Vague goals and promises with no related bill yet are left out. People First also counts sponsorships, from a list of marked bills. Ethics adds stock-trading deductions.</li>
      <li><b>Score pages:</b> a Scores menu ranks everyone on each grade. "Not graded" people show as grey rows, with the data behind each grade.</li>
      <li><b>Money &amp; Influence Analysis:</b> on each Money &amp; Influence tab. It has Vote Donor Alignment, Donor Loyalty 🤝, monthly donations with vote markers, and timing flags. From the daily refresh, it adds the top 20 donor organizations and who lobbied on their bills. Outside spending is also split by sector and colored People- or Profit-aligned.</li>
      <li><b>New charts:</b> an Ethics case timeline, trading charts, a People First diverging bar and a donor tree map.</li>
      <li><b>More official sources:</b> many now refresh automatically (listed under "What refreshes" below), each with its own free key. Every key that is set is used at once, and a record found in several sources shows once.</li>
      <li><b>Committees and IDs:</b> committee seats and each member's IDs come from congress-legislators. Senate votes now match senators by their official LIS ID, not surname and state.</li>
      <li><b>Monthly recalculation:</b> Promises, Ethics and People First are recalculated each month after review, with a change log (below).</li>
      <li><b>Press releases, Bluesky and Threads:</b> members' press releases now come from their official websites, Bluesky accounts are checked at each person's official and campaign website domains, and Threads posts that mention an issue can be collected once Meta approves access. See "What refreshes" below.</li>
    </ul></details>
    <details class="tv"><summary>Earlier changes (October 3, 2026)</summary>
    <ul class="list">
      <li><b>Voter alignment:</b> choose a side and an importance on ${ISS.length} issues ("My alignment" in the top menu, or the Voter alignment tab on any profile). See how each candidate's record compares, issue by issue, with every piece of evidence, its date, its type and the math. Candidates without enough evidence show "Insufficient data".</li>
      <li><b>Money and votes side by side:</b> each Legislative record tab now lists, issue by issue, the candidate's recorded actions next to the PACs and outside groups with a stake in that issue. These are shown as links only.</li>
      <li><b>Bill details:</b> every key vote now opens to the measure's official title, a cited summary, the recorded question and result, and why it is filed under its issue (or why it is not used for alignment).</li>
      <li><b>All 22 House toss-up races</b> (Cook, Sept. 25, 2026) are on the Races page: 8 with full profiles and 14 with verified nominees, campaign funds and outside spending.</li>
      <li><b>Simpler profiles:</b> five tabs (Overview, Funding, Legislative record, Statements vs. actions, Voter alignment). Ethics sits inside the Legislative record tab, and sources are one link away.</li>
      <li><b>Citations:</b> 37 Wikipedia citations were replaced with official, Ballotpedia or news sources. Claims those sources did not support were trimmed, such as unconfirmed primary percentages. Three errors were corrected: Paxton finished second, not first, in the March primary; the 2002 phone-jamming settlement was $135,000; Wess's primary share was 39.57%. One unconfirmed ethics item (Merrin) was removed.</li>
      <li><b>Ohio and Nebraska:</b> added the Ohio special election (Sen. Jon Husted vs. Sherrod Brown) and Nebraska (Sen. Pete Ricketts vs. independent Dan Osborn). Every Senate race rated Toss-up, Tilt or Lean by Cook, Inside Elections or Sabato is now covered, listed first on the Races page with its ratings.</li>
      <li><b>State legislative records:</b> candidates who served in a state legislature have a separate, labeled section with their seats and the votes and bills that could be sourced.</li>
      <li><b>Statement checks:</b> a direct contradiction is now separate from a pairing whose evidence is ambiguous or incomplete. The old "mixed" label is gone.</li>
      <li><b>Kinds of evidence:</b> race and comparison views say what kind of evidence each record rests on, and flag when candidates are compared on different kinds.</li>
      <li><b>Money kept apart:</b> campaign funds and outside spending are shown separately everywhere. The old "all PAC and super PAC money" total, which added outside spending to PAC checks the campaign received, was withdrawn.</li>
      <li><b>Super PAC percentage withdrawn:</b> it divided outside spending through Sept. 30 by campaign receipts through mid-2026. See "Super PAC share" below.</li>
      <li><b>Senators' headline figures:</b> now cover 2025–26, the same two years as everyone else, not their six-year Senate cycle.</li>
      <li><b>For or against:</b> outside spending now counts for or against a candidate only when it names that candidate or their current opponent. $6.86 million spent opposing Graham Platner, who withdrew from the Maine race, had been counted as help for Sen. Collins. It is now listed separately.</li>
      <li><b>Late and repeated filings:</b> spending dated before 2025 (2024-election ads filed late) is left out; it had added about $330,000, mostly to three House races. Seven items filed twice with the same transaction ID ($243,601, mostly in Alaska) now count once.</li>
      <li><b>Every item can be checked:</b> each independent expenditure (${nRows.toLocaleString()} items) and each itemized PAC contribution is on the Funding tab, with dates or report periods and links to the FEC filings.</li>
    </ul></details>
    <h2>The Overview page</h2>
    <p>Each profile opens on its Overview: three primary grades, five small visuals and short evidence highlights. Each grade links to its supporting section.</p>
    <ul class="list">
      <li><b>Where the campaign's money comes from:</b> one bar splitting the FEC two-year total receipts into groups. The groups are small donors (gifts of $200 or less, the FEC's "unitemized" contributions), larger donors (over $200), PACs and other committees, party committees, the candidate's own money and loans, and joint-fundraising transfers and other receipts. They add up to total receipts, so nothing is left out or counted twice. A campaign with no FEC report yet shows a note instead.
        <ul class="list">
          <li><b>Second bar, by gift size:</b> individuals' money in the FEC's five size groups ($200 and under, $200.01–$499.99, $500–$999.99, $1,000–$1,999.99, $2,000 and over), from the daily refresh. Each gift counts by its own amount, so "$200 and under" also holds small gifts from donors who gave more in all, and can be larger than "small donors" in the first bar. Shown only, never in a grade.</li>
        </ul></li>
      <li><b>Outside money for and against:</b> two bars on one scale, with the three largest spenders named under each. They use the same totals as the Money &amp; Influence tab (see Outside spending below). This is never added to campaign money.</li>
      <li><b>How they compare with your choices:</b> one row per issue you chose in My alignment. No single percentage is shown. Until you choose issues, the card just invites you to.
        <ul class="list">
          <li><b>Check mark:</b> every recorded item on the issue matches your side.</li>
          <li><b>Cross:</b> none does.</li>
          <li><b>Half mark:</b> the record is split.</li>
          <li><b>Empty dashed circle:</b> no evidence. It never counts as a mismatch.</li>
        </ul></li>
      <li><b>Where they sit politically:</b> their DW-NOMINATE score as a dot among faint dots for every current member of their chamber. People with no congressional voting record show "No voting score". Below it, a second chart shows how they voted on bills marked liberal or conservative (see below).</li>
      <li><b>Do their words match their actions?:</b> counts of the checked statements the record supports, contradicts, partly supports or shows changed, and those that are unclear. It always says how many were checked, because a few checks are not a full picture.</li>
      <li><b>Integrity:</b> the provisional calculation and expandable Honesty, Personal Finances, Fundraising, Showing Up, Conflicts of Interest and Legal Trouble evidence. Historical Ethics and Promises Delivered values remain in the score history, not in the Integrity calculation.
        <ul class="list">
          <li><b>Allegation:</b> a complaint or report with no official finding.</li>
          <li><b>Investigation:</b> a formal inquiry, lawsuit or proceeding. It may be pending, closed, or ended without a finding against the person.</li>
          <li><b>Confirmed finding:</b> a court, agency or ethics body found a violation or set a penalty, or the person admitted it.</li>
          <li><b>Net worth:</b> for a sitting member, a range from their latest annual financial disclosure, under the list (see Ethics and compliance below).</li>
        </ul></li>
    </ul>
    <h2>Profile pages</h2>
    <p>Each profile has four main tabs: Overview, Money & Influence, Legislative Activity and Integrity. Your Match and People First remain in Legislative Activity. Integrity combines promise evidence, personal-finance evidence, fundraising and Legal Trouble. Old Ethics and Promises links open the corresponding Integrity evidence.</p>
    <ul class="list">
      <li><b>Overview:</b> three grades, one campaign snapshot and three short findings. Full charts, records and interpretations open in the appropriate section.</li>
      <li><b>Your match:</b> the comparison with your positions, issue by issue, with every piece of evidence. Career ideology and issue-position charts provide context; the complete vote and bill lists are on Legislative Activity.</li>
      <li><b>Integrity → Honesty:</b> reviewed promise checks, quotes, tracker ratings, dates, outcomes, evidence and latest official statement records.</li>
      <li><b>Integrity → Personal Finances and Legal Trouble:</b> holdings, trades, Insider Trading and Stock Disclosure Dodger indices, cases, findings, the full legal deduction and source records.</li>
      <li><b>Integrity → Fundraising:</b> donor-size and PAC breakdowns, earmark coverage and pledge adjustments, with reporting dates and missing-data explanations.</li>
      <li><b>People First:</b> a diverging bar, votes and sponsorships on bills scored by who gains, a tree map of the top 20 donors, how funders wanted the candidate to vote, and money and votes by issue. These show agreement, not that money changed a vote.</li>
      <li><b>Legislative Activity:</b> sponsored bills and cosponsored legislation, searchable by title or measure and filterable by Congress. Reviewed selections and refreshed records are labeled separately; roll calls, state records, committees and official acts follow. Counts describe loaded records, not an assumed complete career total.</li>
      <li><b>Money &amp; Influence:</b> the Money &amp; Influence Analysis (below), where the campaign's money comes from, outside money for and against (also by month), campaign funds raised, cash on hand, every PAC contribution, money routed through PACs, every outside-spending group and item, the combined view, and the latest official filings.</li>
    </ul>
    <h2 id="m-grades">Grades on the home page</h2>
    <ul class="list">
      <li><b>Scale:</b> A is 90–100, B 80–89, C 70–79, D 60–69 and F below 60, after rounding to a whole percentage.</li>
      <li><b>Not graded:</b> shown when there isn't enough evidence. It is never a zero.</li>
      <li><b>Where the rules live:</b> one file, <span class="mono">public/grades.js</span>. The inputs are the same records shown on each profile.</li>
      <li><b>Full methodology:</b> with worked examples and open decisions, in <span class="mono">Scores/00_POLITICAL_SCORECARD_METHODOLOGY.md</span>.</li>
    </ul>
    <h3>Rule 1: actions count more than words</h3>
    <ul class="list">
      <li><b>Actions:</b> sponsoring or cosponsoring a bill, voting on it, or an official act (for officials who don't vote in Congress) each weigh ${WEIGHT.action}.</li>
      <li><b>Statements:</b> a speech or statement weighs ${WEIGHT.statement}. It is used only on an issue with no recorded action.</li>
      <li><b>One bill, one count:</b> sponsoring a bill and then voting on it counts once. If the two differ, the vote counts.</li>
      <li><b>Sides:</b> a Yea or a sponsorship takes the bill's marked side, and a Nay the other. Missed votes are not counted.</li>
      <li><b>State officials:</b> someone who never held federal office but held a state office is scored on that state record.</li>
    </ul>
    <h3>The three primary grades</h3>
    <ul class="list">
      <li><b>Your match:</b> how well the record matches the positions you chose in My alignment (see Voter alignment below).
        <ul class="list">
          <li><b>Each issue:</b> the share of the record on your side, weighted by how important you said the issue is. An issue backed only by statements counts at half its importance.</li>
          <li><b>Left out:</b> issues with no evidence.</li>
          <li><b>Needed:</b> evidence on at least 3 of your issues and half of your total importance.</li>
          <li><b>Private:</b> it uses only your own choices, saved in your browser.</li>
        </ul></li>
      <li><b>Integrity → Honesty:</b> reuses reviewed Promise checks and PolitiFact tracker handling. Each item pairs a specific promise or stated position with what the record shows; this evidence is not a separate current grade.
        <ul class="list">
          <li><b>Counts:</b> 1 if the record supports it, ½ if partly supported or the position changed, 0 if contradicted.</li>
          <li><b>Not acted on:</b> a promise the person could have acted on but didn't by the end of the term is closed as contradicted.</li>
          <li><b>Left out:</b> ambiguous checks, outcome checks, promises with no related bill yet, vague goals such as "fight for families," and statements made in debate the day of the vote or the day before, which nearly always match the vote that follows.</li>
          <li><b>Needed:</b> ${MIN_CHECKS} counted checks. True campaign promises are labeled "Promise".</li>
          <li><b>For a president:</b> PolitiFact's promise trackers are used instead (the Trump-O-Meter and MAGA-Meter for Donald Trump). Promise Kept counts 1, Compromise ½ and Promise Broken 0. Stalled and In the Works wait for a final rating.</li>
          <li><b>Money pledges:</b> a pledge to refuse corporate PAC money or single-issue PAC money, or to back a ban on members' stock trading, a lobbying ban for former members or overturning Citizens United, is checked again against the records on file each time the page loads. Company PACs come from the FEC's PAC types, counted from the first report that starts on or after the pledge (trade-association PACs are listed, not counted). Bans come from the bills' sponsors, cosponsors and votes. The result is shown under the reviewed verdict and never replaces it; where the records point the other way, the check is flagged for the next review.</li>
        </ul></li>
      <li><b>Historical Ethics method:</b> the preserved published score used 100 − Legal Trouble Index − a tenth of the Insider Trading Index − a tenth of the Stock Disclosure Dodger Index, rounded. This old percentage is not averaged into Integrity. Integrity subtracts Legal Trouble at full strength after averaging complete components and applies 0.20 × each trading index inside Personal Finances.
        <ul class="list">
          <li><b>Legal Trouble Index 🚨:</b> each case's status points × its kind × its age, totaled, with a ceiling of 100. Each case counts once, at its current status, and one matter is one case.</li>
          <li><b>Status points:</b> ${ETHICS_COST.finding} for a confirmed finding, ${ETHICS_COST.open} for an open investigation (including one with no public resolution), ${ETHICS_COST.closed} for one closed without a finding (an acquittal, dismissal, decision not to charge, ruling in the person's favor, or settlement without admission). Allegations, which no official body acted on, cost nothing.</li>
          <li><b>Kind:</b> criminal × ${CASE_KIND.criminal} (indictments, convictions, guilty pleas), ethics or civil × ${CASE_KIND.ethics}, technical × ${CASE_KIND.technical} (such as an FEC fine for a late report, or a late stock disclosure).</li>
          <li><b>Age:</b> × ${CASE_AGE.factor} when the case was decided more than ${CASE_AGE.years} years before the reviewed research. Open cases always count in full.</li>
          <li><b>Insider Trading Index 📈:</b> committee conflicts 40% (the dollar share of single-stock trades in sectors their committees oversee, using the middle of each disclosed range), trades near related votes 25%, trades in donors' companies 20%, and single-stock activity 15% (trades a year, with 50 counting as 100). It needs 5 reviewed trades; no trades scores 0.</li>
          <li><b>Blind trusts and divestment:</b> a qualified blind trust, certified by the House or Senate ethics committee, takes the trades its trustee makes out of both trading indexes, because the member neither chooses nor sees them. Trades they report outside it, or made before it, count as usual. Holding no individual stocks labels the index. A managed or "discretionary" account, an adviser who trades without asking, a spouse's account, or a trust that isn't a qualified blind trust is not excused: those trades count in full. Neither adds points; the grade starts at 100. Each status is reviewed and cited; the latest annual report only suggests one.</li>
          <li><b>Stock Disclosure Dodger Index 🙈:</b> trade reports filed after the ${LATE_DAYS}-day deadline or never 70%, and annual financial disclosures filed late 30%. It needs 3 required filings. A STOCK Act late-disclosure case moves here from the Legal Trouble Index once the person's trades are reviewed, so a late report never costs twice.</li>
          <li><b>Who counts:</b> spouse and dependent-child trades count and are labeled. A president's trades are listed on the Integrity tab, from OGE reports, but not scored. Other people not in Congress show "No trading data". Only reviewed trades count; new reports are listed for review first. Returns are never scored.</li>
        </ul></li>
      <li><b>People First:</b> whether the record did more for working people or for the wealthy and corporations.
        <ul class="list">
          <li><b>Bill scores:</b> each bill is scored from −100 (fully corporate-backed) to +100 (fully worker-backed), from two equal parts.
            <ul class="list">
              <li><b>Who gains (50%):</b> a cited nonpartisan study (the Congressional Budget Office, the Joint Committee on Taxation, the Tax Policy Center or the Penn Wharton Budget Model), placed on one of five steps: ${Object.entries(GAINS_STEPS).sort((a,b)=>b[0]-a[0]).map(([k,t])=>`${Number(k)>0?'+':''}${k} ${esc(t.toLowerCase())}`).join('; ')}.</li>
              <li><b>Access counts as who gains too:</b> when a cited estimate shows a bill expands or cuts access to a basic need, mainly for lower- and middle-income households (health coverage, public schools, child care, food assistance, housing, or services like clean water and low-income broadband): +100 for a clear expansion, −100 for a clear cut, ±50 for a smaller or mixed change. With both money and access, their average is used. Access doesn't count for bills that fund the whole government, or for public money that mainly goes to companies.</li>
              <li><b>Who took a side (50%):</b> worker groups (${Object.values(BILL_GROUPS).filter(g=>g.side==='worker'&&!g.tax).map(g=>esc(g.org)).join(', ')}) count +100 for supporting a bill and −100 for opposing it. Business groups (${Object.values(BILL_GROUPS).filter(g=>g.side==='business'&&!g.tax).map(g=>esc(g.org)).join(', ')}) count the other way, so a business group opposing a bill counts toward workers. On tax bills, ITEP counts with the worker groups and the Tax Foundation with the business groups; on construction-pay measures, North America's Building Trades Unions and Associated Builders and Contractors do the same. Each side's groups are averaged, then the two sides. If both sides support a bill, it lands near 0.</li>
              <li><b>When they disagree:</b> if who gains and who took a side point opposite ways, the bill is Disputed: it's shown, but not scored. With only one part on file, that part decides, but a bill marked from groups' positions alone needs a worker group and a business group on opposite sides.</li>
              <li><b>Shown, not scored:</b> lobbying reports naming the bill (LDA.gov), split into unions and other clients, since a report doesn't say which side the client was on; CBO estimates that don't say who gains by income; and the White House's position, which follows the president's party.</li>
            </ul></li>
          <li><b>Bills that didn't pass:</b> count the same way. Sponsoring or cosponsoring one counts like a yes vote (cosponsors from Congress.gov). A cited public statement that names the bill counts half a vote, and a later vote or cosponsorship replaces it. Not cosponsoring counts for nothing. A bill counts once across its versions in different Congresses, with the latest vote winning.</li>
          <li><b>Counting:</b> each vote or sponsorship on a scored bill counts the bill's strength (its score ÷ 100) for the side it took, once per bill. A yes on a +75 bill adds 0.75 to the working-people side; a no adds 0.75 to the other side. The score is working-people points ÷ all points.</li>
          <li><b>For a president:</b> signing a marked bill or issuing a marked executive order counts for its side. A veto counts for the other side.</li>
          <li><b>Corporation Compromised Index 🏢 (a quarter of the grade):</b> the grade is 0.75 × the bills' score + 0.25 × (100 − the index). The index (0–100) has four parts. Business PACs' share of the money they raised: ${CORP_COMPROMISED.weights.pacShare*100}%, with ${CORP_COMPROMISED.pacCeiling}% of funds scoring 100. A business PAC is one the FEC records as sponsored by a corporation, trade association or cooperative, or by its sector when it isn't matched to its FEC record yet. Votes with business funders that gave to the campaign, compared with their party: ${CORP_COMPROMISED.weights.businessVotes*100}%, with ${CORP_COMPROMISED.voteCeiling} points above the party scoring 100, from 5 compared votes. Donor companies' employees' giving: ${CORP_COMPROMISED.weights.employees*100}%. The Profit side on bills their top donors lobbied on: ${CORP_COMPROMISED.weights.lobbiedBills*100}%. The last two aren't counted until their data is reviewed, and a part without data drops out, so the others are reweighted. Outside spending is left out. Without the index (no campaign money on file, or a president), the bills count alone.</li>
          <li><b>Needed:</b> ${MIN_PVP_ACTIONS} scored actions. ${PVP_MARKS.size?`${PVP_MARKS.size} bill${PVP_MARKS.size===1?' is':'s are'} marked so far.`:'<b>No bills are marked yet</b>, so no one is graded.'}</li>
        </ul></li>
    </ul>
    <h3>Outside money by month (on each card)</h3>
    <ul class="list">
      <li><b>What it shows:</b> outside money for the candidate (green) and against them (orange) for the last seven months, side by side. It covers general-election independent expenditures, not money given to the campaign.</li>
      <li><b>The line:</b> each month's for-to-against ratio, read on the right-hand scale. The scale runs from "all for" at the top, through 1 : 1, to "all against" at the bottom. The line is placed by the share spent for the candidate (3 : 1 is 75%, 1 : 3 is 25%). It breaks over a month with no outside money.</li>
      <li><b>Reading a ratio:</b> always for-to-against. "2.1 : 1" means $2.10 was spent for the candidate for every $1 against. "1 : 2.1" is the reverse.</li>
      <li><b>The badge:</b> the same ratio for all seven months. Green when more was spent for, orange when more was spent against, uncolored at 1 : 1. With nothing against, it reads "No opposing spending" (or "No supporting spending" for the reverse).</li>
      <li><b>Exact amounts:</b> hover over a month or the badge. Races with more than two candidates say "supporting" and "opposing".</li>
    </ul>
    <h2 id="method-scores">Score pages</h2>
    <p>The Scores menu has a page for each primary grade, plus ideological position. Each ranks all ${ALL.length} people. Integrity uses the latest separate monthly comparison snapshot and remains provisional. People with incomplete evidence remain visible as Not graded.</p>
    <ul class="list">
      <li><b>Your match:</b> ranked bars colored by grade, and an issue-by-issue breakdown for one person, most important issues first.</li>
      <li><b>Integrity:</b> latest monthly comparison values, with profile links to component coverage and Not graded explanations. Historical Ethics and Promise values remain in the official monthly score log.</li>
      <li><b>People First:</b> bars centered at 50%, and a chart of People First against DW-NOMINATE to spot outliers.</li>
      <li><b>Ideological position:</b> the whole chamber on the DW-NOMINATE scale, with one person highlighted.</li>
    </ul>
    <h2 id="method-influence">Money &amp; Influence Analysis</h2>
    <ul class="list">
      <li><b>Where it shows:</b> on each Money &amp; Influence tab, beside the grades, never inside them.</li>
      <li><b>Correlation, not cause:</b> it shows timing and alignment. It does not prove that money caused a decision.</li>
      <li><b>Settings under review:</b> the top ${TOP_DONORS} donors, a ${SWING*100}% change, and a ${WINDOW_MONTHS}-month window.</li>
    </ul>
    <h3>What it measures</h3>
    <ul class="list">
      <li><b>Vote Donor Alignment:</b> votes on bills where a donor group took a public position (in its scorecard or key-vote letter). It is the share that went the group's way. Missed votes are not counted.</li>
      <li><b>Donor Loyalty 🤝:</b> how much more often they vote the way their funders wanted than the rest of their party does on the same votes. For each group that gave to the campaign or spent for them, their rate of voting its way minus the party's rate, from the official roll calls' party totals with their own vote left out (Voteview's copy of a Senate vote when Senate.gov won't send it, kept only when its totals match the recorded result). The groups are weighted by the money each gave, bundled from its donors or spent for them, but no group counts for more than all the others put together (at most half the weight), so one large funder with a single position on file can't decide the number alone. Only the part above the party counts: ${DONOR_LOYALTY.ceiling} points above scores 100. It needs ${DONOR_LOYALTY.minVotes} compared votes. Independents are compared with the party they caucus with.</li>
      <li><b>Speech Donor Alignment:</b> not measured yet. Floor speeches arrive from the Congressional Record, but must first be sorted by issue and side.</li>
      <li><b>Donations by month:</b> each group's PAC giving to the campaign by month (FEC bulk data since ${H0()}), with the votes it took a side on marked under its row.</li>
      <li><b>Top donor organizations:</b> from the daily FEC refresh, the top ${TOP_DONORS} organizations, each combining its PAC with its employees' itemized giving, grouped by employer. Donors' names are never shown, as FEC rules on reusing contributor information require.</li>
      <li><b>Timing flags (for review, not scored):</b>
        <ul class="list">
          <li>Donations rose ${SWING*100}% or more in the ${WINDOW_MONTHS} months after a vote the group wanted, compared with the ${WINDOW_MONTHS} months before.</li>
          <li>Donations dropped ${SWING*100}% or more after a vote it opposed.</li>
          <li>A position change on an issue followed a ${SWING*100}% shift in donations from a group that took positions on it.</li>
          <li>The person held or traded stock in a group that donated and took positions on bills they acted on.</li>
          <li>A window that runs past the data is not judged.</li>
        </ul></li>
      <li><b>Who had a stake:</b> lobbying reports (LDA.gov) for top donor organizations that name a bill the person sponsored, cosponsored or voted on. Also listed, as context: foreign-agent registrations (FARA), comments on federal rules (Regulations.gov) and federal contracts (USAspending, matched through SAM.gov company IDs).</li>
      <li><b>Outside spending by sector:</b> money spent for and against, each bar split by the groups' sectors. Outside spending is a plain number, not a grade, because the person cannot legally coordinate with these groups.
        <ul class="list">
          <li><b>People-aligned:</b> unions.</li>
          <li><b>Profit-aligned:</b> industry and corporate groups.</li>
          <li><b>Other:</b> party, ideological and candidate-aligned groups.</li>
          <li><b>Sectors:</b> outside spenders have no industry code, so this app assigns one from the committee's name, as for PACs. Under review.</li>
        </ul></li>
      <li><b>Top donors tree map (People First tab):</b> tile size is the amount given. Unions and small-dollar donors (one tile) are People-aligned. Corporate PACs and industry groups are Profit-aligned. Leadership, party and ideological committees are Other.</li>
    </ul>
    <h2 id="method-integrity">Integrity (provisional, uncalibrated)</h2>
    <p>The current grading interface consolidates reviewed promises as Honesty with Personal Finances, Fundraising, and a full Legal Trouble deduction, adapting the structure of <a href="https://integrityindex.us/methodology" target="_blank" rel="noopener">IntegrityIndex.us</a>. This presentation migration does not establish calibration. Historical Ethics and Promises Delivered grades and formulas remain preserved, and the monthly comparison log remains separate. A methodology change still requires reviewed live coverage, source-backed calibration, and a later explicit methodology migration.</p>
    <ul class="list">
      <li><b>Overall:</b> available component values weighted Honesty 20%, Personal Finances 20%, Fundraising 25%, Showing Up 15%, Conflicts of Interest 20%; missing components drop out and available weights are normalized. At least two complete components and a sourced Legal Trouble review are required. Subtract Legal Trouble at full strength, floor at zero, and round only the final display. The two-component minimum also applies to the president.</li>
      <li><b>Showing Up:</b> <code>0.75 × Attendance + 0.25 × Get It Done</code>, or Attendance alone when Get It Done isn't available. <b>Get It Done:</b> <code>100 × min(1, their advanced rate ÷ the typical rate of their party in their chamber)</code>, over the Congresses since 2018 (the 115th through the 119th now), the typical rate weighted by their own bills in each; bills and joint resolutions they sponsored count (not simple or concurrent resolutions), and one advanced when its latest action shows a committee reporting it, a calendar placement, passage of either chamber, arrival in the other, presentment, signing or law. It needs at least 10 sponsored bills; a party's typical rate is the median of its members with at least 5 bills that Congress, independents compared with the party they caucus with (Congress.gov and Voteview, <code>npm run getitdone:build</code>). <b>Attendance:</b> <code>clamp(100 − 5 × missed %, 0, 100)</code>, where missed % is the share of roll-call votes the member missed while in office from 2018 through the current year, from Voteview's record of every roll call in both chambers (votes "not voting", paired or announced are missed; Present counts as there). 2% missed is 90, 10% is 50, 20% or more is 0. Votes missed while campaigning count. A reviewed absence with a cited source for medical leave, a birth or adoption, a death in the family, or military duty is left out of both the votes and the misses for its dates. It needs at least 50 votes in office in those years: a former member who served then is counted for the time they served, and a candidate who hasn't served has no Showing Up part. The record shows that a vote was missed, not why or where the member was.</li>
      <li><b>Conflicts of Interest:</b> <code>clamp(100 − (0.60 × Outside Income &amp; Conflicts + 0.40 × Gifts &amp; Travel), 0, 100)</code>, from their latest annual or candidate report (Senate eFD Parts 1–10, House Schedules A–J) and reviewed matches of the organizations on it. An interested organization lobbied on a bill sent to one of their committees, is a company in a sector their committees oversee, or received contracts from an agency their committees oversee (for a candidate: lobbied the chamber they're running for). <b>Outside Income &amp; Conflicts</b> = 0.40 × I + 0.25 × Lobbyist Overlap + 0.20 × Contracts for Donors + 0.15 × Foreign Agent, over the parts available (I required): I = 60 × Hill(income from interested organizations, $50,000) + 20 a board seat or officer position with one (at most 40) + 40 for a future-job or payment agreement with one, capped at 100; Lobbyist Overlap = 100 × Hill(share of campaign receipts from interested organizations, 25%); Contracts for Donors = 100 × Hill(donor companies, $10,000 or more given, with over $1 million in contracts from agencies they oversee, 5); Foreign Agent = 25 a reviewed FARA filing naming them, at most 100. <b>Gifts &amp; Travel</b> = 60 × Hill(value of gifts and paid trips from interested organizations, $10,000) + 10 each (at most 40), capped at 100; a trip the Ethics Committee approved still counts when its sponsor is interested. Unreviewed names are leads and count for nothing; without a reviewed report the part is not graded.</li>
      <li><b>Honesty:</b> 100 × (kept + 0.5 × partly kept) ÷ counted checks, with at least 3. It reuses reviewed Promise assessments and PolitiFact trackers; pending, vague, ambiguous and same-day debate checks remain out. Flip-Flop and Pants on Fire are not implemented.</li>
      <li><b>Personal Finances:</b> <code>100 − 20·Hill(stock value, $400,000) − 20·Hill(trade count, 50) − 20·Hill(trade value, $1,000,000) − 0.20·Insider − 0.20·Dodger</code>, clamped to 0–100; <code>Hill(x,m)=x^0.745/(m^0.745+x^0.745)</code>. Stock value means the sum of individual-stock range midpoints from one reviewed annual snapshot. The snapshot date and trade period remain separate. Only verified holdings/trades inside a qualified blind trust after its effective date can be excluded. A complete reviewed snapshot, transaction coverage, amounts, filing dates and sources are required.</li>
      <li><b>Fundraising:</b> <code>clamp(75 + D − P − R − E + pledges, 0, 100)</code>. D scores same-period FEC gift-size buckets using weights 14, 10, 6, 3 and 2, plus 5.2 for itemized gifts not yet sorted, 1 for self-funding and 1 for joint fundraising; cap 14. Buckets are by each gift: ≤$200 (including unitemized once), $200.01–$499.99, $500–$999.99, $1,000–$1,999.99, and ≥$2,000; the FEC’s unsorted itemized remainder is separate. P applies category rates per percentage point of receipts (corporate 2; lobbyist 1; trade/membership/cooperative 0.2; political/leadership/party/candidate/ideological 0.1; labor/other 0.05), capped at 30. PAC categories must reconcile to the same-period FEC total. R = 10 × Hill(PAC receipts share, 0.20). E is 4 points per percentage point of eligible earmarks, capped at 30; ActBlue and WinRed are excluded. Selected-group conduit data is partial and cannot establish complete coverage or zero.</li>
      <li><b>Pledges:</b> four categories, each counted once: corporate PAC refusal, congressional stock-trading ban, former-member lobbying ban, and overturning Citizens United. A reviewed kept/broken pledge adds/subtracts 1; absent pledge evidence may receive +1 for qualifying bill cosponsorship; pending pledges receive no fallback. No abstention bonuses.</li>
      <li><b>People First comparison:</b> a separate preview CCI drops direct business-PAC share and renormalizes employee giving (10%), business-funder voting (35%) and lobbied bills (20%) over available implemented parts. The comparison is 75% legislative actions + 25% (100 − preview CCI), or the legislative-action score alone when CCI is unavailable. Published Workers &gt; Profit remains unchanged.</li>
      <li><b>Calibration:</b> all supplied weights, caps, $400,000/$1,000,000 Hill midpoints, 50-trade midpoint, $20M reference-campaign context, and evidence minimums are provisional and uncalibrated. The $20M reference is documentation context, not an extra calculation in these formulas. Scores and preview history are not official grade history.</li>
      <li><b>Coverage today:</b> current imported annual financial records and official trade refreshes are not yet reviewed score inputs; dated, source-linked Legal Trouble coverage reviews are not recorded for profiles; complete earmark coverage is unavailable; and employee-giving/lobbied-bill CCI inputs are not built. Those values remain unavailable instead of earning a clean score. Existing quotes, promises, votes, legislation, holdings, trades, disclosures, cases and indices stay accessible.</li>
      <li><b>Rollout:</b> the interface consolidation is complete. Continue monthly comparisons in the separate log; do not switch grade calculations automatically. Methodology activation still requires an adequate comparison period, reviewed live financial coverage, source-backed calibration, and a later explicit methodology migration.</li>
    </ul>
    <h3 id="method-integrity-log">Monthly preview comparisons</h3>
    ${integrityPreviewLog()}
    <h2 id="method-sources">What refreshes, and how sources are merged</h2>
    <ul class="list">
      <li><b>Grades:</b> based on the reviewed research.</li>
      <li><b>Latest official records:</b> official sources refresh daily (weekly for court records, LegiScan and committee meetings). They show under "Latest official records" on each tab.</li>
      <li><b>Nothing new changes a grade by itself:</b> new votes, bills, speeches, trades, filings and leads are listed for review. A grade changes only after the reviewed research is updated and the monthly recalculation runs.</li>
      <li><b>Merging:</b> where several sources cover the same thing, each record shows once.
        <ul class="list">
          <li><b>Stock trades:</b> read from the members' own reports: House members' PDFs from the House Clerk, and senators' reports from the Senate eFD site (when it turns scripts away, report pages saved from a browser are imported instead). Bargo is a cross-check, matched by member, company, date, buy or sell and amount range. The official report's date wins, a trade only a service reports goes to review, and a report filed on paper is listed to check by hand.</li>
          <li><b>Hearings:</b> a Congress.gov committee meeting and its GovInfo transcript are one hearing, matched by the transcript's number or the same title on the day it was held. The meeting gives the witnesses and documents, the transcript the text and who attended.</li>
          <li><b>Legal leads:</b> a CourtListener docket and opinion in the same case are one case, and a DOJ press release that cites its docket number joins it. FEC enforcement records are listed alongside. Nothing is joined on a name or date alone.</li>
          <li><b>Statements:</b> the same message as a press release, a Bluesky or Threads post, or a YouTube video shows once, when a post links to the release or repeats most of its words within 3 days.</li>
          <li><b>Top donor organizations:</b> for each organization whose employees gave the most, what LDA.gov (lobbying), FARA, Regulations.gov, SAM.gov and USAspending found for the same name, in one row.</li>
          <li><b>The president's trades:</b> from the president's OGE Form 278e and 278-T reports, as compiled in <a href="https://github.com/disclosedcapitol/executive-branch-trades" target="_blank" rel="noopener">Disclosed Capitol's executive-branch-trades dataset ↗</a> (CC BY 4.0) and imported by hand. A trade listed on two reports shows once. Listed on the Ethics tab, not scored.</li>
          <li><b>State bills:</b> Open States and LegiScan, by state, session year and bill number.</li>
          <li><b>News:</b> GDELT and the New York Times, by link.</li>
        </ul></li>
      <li><b>Disagreements:</b> flagged for review.</li>
      <li><b>Posts and press releases:</b> listed as statements, never as actions.
        <ul class="list">
          <li><b>Press releases:</b> from the RSS feed on each member's official website. They often carry the same message as the office's posts on X and Facebook.</li>
          <li><b>Bluesky:</b> each person's official and campaign website domains are checked as handles, since only a domain's owner can use one. Other accounts are added only when they are linked from those websites or carry Bluesky's verified badge with the person's name (<span class="mono">npm run social:bluesky</span>).</li>
          <li><b>Threads:</b> each account is searched for the site's ${ISS.length} issues, so only posts that mention one are collected. It needs Meta's approval to search other people's posts. A Threads account uses its Instagram username.</li>
          <li><b>Not collected:</b> X and Facebook, which have no free way to read other people's posts.</li>
        </ul></li>
      <li><b>Leads:</b> court records, FEC enforcement records, DOJ press releases and news. A lead becomes a scored case only after its status is confirmed from an official record. <a href="#updates">See every source and its status</a>.</li>
    </ul>
    <h2 id="method-log">Monthly recalculation and change log</h2>
    <ul class="list">
      <li><b>What is recalculated:</b> Promises delivered, Ethics and People First, once a month after the month's review.</li>
      <li><b>How:</b> <span class="mono">npm run scores:monthly</span> records every change, and why, in <span class="mono">public/score-log.json</span>.</li>
      <li><b>Not logged:</b> Your match, since it depends on your own choices.</li>
      <li><b>On each grade tab:</b> when it was last recalculated, and a note if reviewed edits have changed the grade since.</li>
    </ul>
    ${methodLog()}
    <h2>Key votes marked liberal or conservative</h2>
    <ul class="list">
      <li><b>How a side is marked:</b> each key vote is checked against the issues it is coded to. Where an issue is a clear liberal-versus-conservative question in U.S. politics today, one side is marked liberal and the other conservative (listed below).</li>
      <li><b>All issues must agree:</b> a bill is marked only if every issue it is coded to points the same way.</li>
      <li><b>Left unmarked:</b> bills on unmarked issues, bipartisan deals, nominations and stopgap funding bills. Each shows its reason on the Your match tab.</li>
      <li><b>A judgment call:</b> kept in one place (<span class="mono">liberalSide</span> on each issue in <span class="mono">research.json</span>), so it can be reviewed and changed.</li>
    </ul>
    <ul class="list">${ISS.map(i=>i.liberalSide?`<li><b>${esc(i.label)}:</b> liberal side = "${esc(i[i.liberalSide])}"; conservative side = "${esc(i[i.liberalSide==='A'?'B':'A'])}".</li>`:`<li><b>${esc(i.label)}:</b> not marked. ${esc(i.leanNote)}</li>`).join('')}</ul>
    <ul class="list">
      <li><b>Counting:</b> only marked bills the person voted on count. A Yea takes the bill's marked side, and a Nay takes the other. Missed votes, and bills from before the person took office, are not counted.</li>
      <li><b>Minimum:</b> a position shows only with at least ${KV_MIN} such votes. The chart places the person by the share of those votes on the conservative side.</li>
      <li><b>Not an ideology score:</b> this counts a small, selected set of important votes. It can be compared only within a chamber, because the House and Senate sets differ. Don't confuse it with the DW-NOMINATE career score, which uses every roll call.</li>
      <li><b>Vote text:</b> always plain black. The "Side taken" column says whether each vote was on the liberal or conservative side.</li>
    </ul>
    <h2>Position by issue</h2>
    <ul class="list">
      <li><b>What it shows:</b> on the Your match tab, a bar for each issue category, toward the liberal or the conservative side, by how much of the person's record on it is on each side. Context only, never part of a grade.</li>
      <li><b>Evidence:</b> the same as Your match: votes, sponsored bills and official acts, one credit per bill. Statements count at half, and only for an issue with no recorded action.</li>
      <li><b>Sides:</b> each issue's liberal side, listed above. Issues that aren't marked (trade, foreign policy, Jan. 6, infrastructure) aren't placed.</li>
      <li><b>Categories:</b> immigration, taxes and spending, civil liberties, environment, health care, abortion, guns, workers, trade, foreign policy, voting, education, criminal justice, LGBTQ rights, housing, and Social Security and Medicare. Civil liberties, criminal justice, housing, and Social Security and Medicare have no tracked issue yet.</li>
      <li><b>Minimum:</b> one action or statement for now. A thin record shows its count beside the bar.</li>
    </ul>
    <h2>Portraits</h2>
    <ul class="list">
      <li><b>Sources:</b> for people who served in Congress, usually their official congressional portrait, a public-domain U.S. government photo, from the <a href="https://github.com/unitedstates/images" target="_blank" rel="noopener">unitedstates/images</a> project. Photos of the other candidates, and of Sens. Cory Booker and Jon Husted, were supplied by the site's editor for use here.</li>
      <li><b>Same size for everyone:</b> the background is removed automatically, and each face is scaled and placed the same way. One person is shown about 15% smaller so a wide-brimmed hat fits the frame.</li>
      <li><b>Clothing:</b> where a photo was cropped tightly, the clothing is extended into the bottom of the circle.</li>
      <li><b>Older photos:</b> former members' official photos date from their time in Congress, which for some was years ago.</li>
      <li><b>Missing photo:</b> every profiled person has one now. If one fails to load, the card shows their initials.</li>
    </ul>
    <h2>Who is covered</h2>
    <ul class="list">
      <li><b>Senate incumbents:</b> six senators on the November 3, 2026 ballot, three Republicans and three Democrats, as a bipartisan mix of competitive and safe seats. Two senators first picked were replaced because they won't be on the ballot: Sen. Lindsey Graham (R-SC) died in July 2026, and Sen. Markwayne Mullin (R-OK) left the Senate for an administration post.</li>
      <li><b>House:</b> the Cook Political Report rates 22 House races Toss-up (Sept. 25, 2026). Eight have full profiles of both nominees, four seats held by each party. The other 14 are on the Races page with their nominees (verified from results or news reports) and the November 3 results. Their records, statements, ethics and campaign money are not shown yet.</li>
      <li><b>Challengers and open seats:</b> every opponent of those incumbents, and both major-party nominees in each open Senate race (plus independent Seth Bodnar in Montana). Nominees were confirmed from primary and runoff results.</li>
      <li><b>The rest of the 2026 Senate races:</b> the ${DATA.liteRaces.filter(r=>r.chamber==='S').length} other Senate races on the November 3 ballot, including Florida's special election, are on the Races page with results only: the nominees, each one's share of the vote, the reported turnout and the winner. Sitting senators link to their Senate page profile; their opponents don't have profiles yet.</li>
      <li><b>Every other senator:</b> a basic profile for each sitting senator not in these races (see the <a href="#senate">Senate</a> page): their place in the Senate, their committees, and the records the daily refresh collects. No grades until their research is reviewed. The list comes from the congress-legislators project.</li>
      <li><b>Ohio and Nebraska:</b> Sen. Jon Husted (appointed in January 2025) and Sen. Pete Ricketts are profiled with their opponents, Sherrod Brown and independent Dan Osborn. No Democrat is on the Nebraska ballot: the nominee withdrew in July 2026 and the state party named no replacement.</li>
    </ul>
    <h2>Competitive races</h2>
    <ul class="list">
      <li><b>Senate:</b> a race is competitive when at least one forecaster rates it Toss-up, Tilt or Lean. The forecasters are the Cook Political Report (Sept. 23), Inside Elections (Sept. 17) and Sabato's Crystal Ball (Sept. 22, 2026), as compiled in Wikipedia's ratings table.</li>
      <li><b>The ten races:</b> Alaska, Georgia, Iowa, Kansas, Maine, Michigan, New Hampshire, North Carolina, Ohio and Texas. All are covered.</li>
      <li><b>Nebraska:</b> rated Likely Republican by all three, but Toss-up or Lean by some other forecasters. It is included.</li>
      <li><b>House:</b> chosen from Cook's toss-up list at the time of research. The ratings have not been re-checked.</li>
    </ul>
    <h2 id="method-results">Election results</h2>
    <ul class="list">
      <li><b>What is shown:</b> who won each covered race on November 3, 2026, and how it was decided: a news organization's call (the AP, a TV network or Decision Desk HQ) or the losing candidate's concession. Each result links to its source.</li>
      <li><b>Shares and turnout:</b> each candidate's share of the vote, and their votes when the source gave them, from one news report or results page per race, with how much of the vote was counted at the time. Reported turnout is the votes counted in that report: the source's own total, or the sum of every candidate's votes when all were given. Where a source gave neither, the page says so. Shares that don't reach 100% leave the rest to candidates and write-ins not named.</li>
      <li><b>Not called yet:</b> a race nobody has called and no candidate has conceded shows who was leading, but nobody is marked as having won or lost.</li>
      <li><b>Unofficial:</b> ${DATA.election?`results were last checked ${fmtDate(DATA.election.asof)}. `:''}They are updated as races are called, and each state certifies its official results in the following weeks.</li>
      <li><b>Taking office:</b> winners of regular elections take office January 3, 2027, and incumbents who lost serve until then. Ohio's was a special election for the rest of the term ending in January 2029, so its winner takes the seat once the state certifies the result.</li>
      <li><b>Flip or hold:</b> once a race is called, the card says "Flip +1" when the winner's party is not the one that held the seat before the election, or "Remains Blue" or "Remains Red" when it is, in the winner's color. The seat's holder is the incumbent who ran or, for an open seat, its outgoing member: the retiring senator, or a redrawn House district's current member.</li>
      <li id="method-county-maps"><b>County maps:</b> where a state's county-by-county results are on file, the race shows a map of its counties, each colored by who leads it; the stronger the color, the wider the lead (under 5, 5–15, 15–30 and 30 or more points). Hover over or tap a county for its count, or open the table under the map. Every state is drawn in the same box, as large as it fits. While the county results are being read again (every 15 minutes or so), the page picks up each new read within two minutes, and the race's shares and turnout then come from the same count. The bar under a map is how much had reported in the state's file when it was read: the share of precincts reporting when the file gives them, otherwise the share of counties with any votes. A precinct or county that has reported can still add ballots counted later, such as mail, absentee and provisional ballots. The counts come from each state's own results file, linked under its map, and are unofficial until the state certifies. County outlines: U.S. Census Bureau cartographic boundary files, simplified in the us-atlas package.</li>
      <li><b>Grades:</b> no grade uses the results. Everyone keeps their profile, records and grades whether they won or lost.</li>
    </ul>
    <h2>Campaign funds raised</h2>
    <ul class="list">
      <li><b>Source:</b> the FEC's two-year summary (2025–26) for each campaign's main committee, through its latest report, usually June 30, 2026.</li>
      <li><b>What it includes:</b> the FEC's total receipts. That is individual gifts, PAC and party contributions, transfers from joint fundraising committees, the candidate's own loans and contributions, and other receipts.</li>
      <li><b>Self-funding:</b> noted when the candidate's own money is more than 20% of the total.</li>
      <li><b>Cash on hand and debts:</b> as of the same date.</li>
      <li><b>Next reports:</b> third-quarter reports, through Sept. 30, are due October 15, 2026.</li>
    </ul>
    <h2>PAC contributions</h2>
    <ul class="list">
      <li><b>Part of campaign funds:</b> each row is one contribution itemized on FEC Schedule A, line 11C.</li>
      <li><b>Reports used:</b> 2025–26 reports for senators, and January–June 2026 reports for everyone else.</li>
      <li><b>Dates:</b> the FEC lists contributions by report, so each row shows its report and period, not an exact date.</li>
      <li><b>Transcription:</b> rows were copied from the FEC's report viewer. Where some couldn't be read, the profile shows the share covered and doesn't estimate the rest.</li>
      <li><b>Sectors:</b> assigned by this app from each committee's name and sponsor, not by the FEC. Committees that can't be identified are left unclassified.</li>
      <li><b>FEC type:</b> each PAC's type as the FEC records it from the committee's own registration: corporate, trade association, membership group, cooperative, labor union, lobbyist, leadership PAC, nonconnected, another candidate's committee, party or joint fundraiser. Each name on file is matched to its FEC committee ID first; a name that could be two committees is left unmatched. Shown in the PAC table, a by-type chart and each PAC's description once the lookup has been run (<code>npm run pacs:types</code>). Shown only, never in a grade.</li>
      <li><b>Orientation:</b> shown only where a group's political purpose is documented.</li>
    </ul>
    <h2>Outside spending (independent expenditures)</h2>
    <p>An independent expenditure is spending on ads, mail or canvassing that supports or opposes a candidate. A group that may not coordinate with the campaign pays for it. It is never money the campaign raised.</p>
    <ul class="list">
      <li><b>Data:</b> ${esc(IE.source)} Items run from January 1, 2025 to ${fmtDate(IE.asof)}, by the date they went out. Three filings were spot-checked against FEC images.</li>
      <li><b>For a candidate:</b> items supporting them, plus items opposing their current opponent.</li>
      <li><b>Against:</b> items opposing them, plus items supporting the opponent.</li>
      <li><b>Anyone else:</b> items naming someone else (a primary candidate, or a nominee who withdrew) are listed separately and counted for no one.</li>
      <li><b>Three-way races (Montana):</b> spending against one candidate can't be credited to a single rival. Profiles count only spending aimed directly at that candidate, and list spending aimed at rivals separately.</li>
      <li><b>Who paid:</b> super PACs, other outside groups (nonprofits and traditional PACs) and party committees. Party coordinated spending is a different category and is not included.</li>
      <li><b>Negative amounts:</b> corrections filed by the spender. They are kept so totals match the filings.</li>
      <li><b>Filed twice:</b> an item in two filings that are identical in every field, including its transaction ID, counts once, from the latest filing.</li>
      <li><b>Possible repeats:</b> items identical except for the transaction ID are kept, because the filings list them separately. They are flagged, and their total is stated on the profile.</li>
      <li><b>Date capped:</b> notices filed in advance with a date after the cut-off show as Sept. 30.</li>
      <li><b>Split costs:</b> when one ad both supports a candidate and opposes the opponent, both lines count toward "for" the same candidate, so the split doesn't change the totals. If a spender reported the full cost on both lines, the totals would be too high. This app adds lines as filed and can't check the split without the filing images.</li>
      <li><b>Not included:</b> spending on third-party and independent candidates, which is missing from the compiled data, so Montana (Seth Bodnar) is marked incomplete. Primary-election spending is also not included.</li>
    </ul>
    <h2>Combined view</h2>
    <ul class="list">
      <li><b>When it shows:</b> only where both parts cover the same dates. That is campaign funds through the latest report, plus outside spending for the candidate on or before that day.</li>
      <li><b>Shown separately:</b> outside spending after that date, and spending against the candidate.</li>
      <li><b>No double counting:</b> PAC and party contributions are already in campaign funds. Independent expenditures never pass through the campaign. The FEC records earmarked donations routed through PACs as individual contributions.</li>
    </ul>
    <h2>Super PAC share</h2>
    <ul class="list">
      <li><b>Withdrawn for now:</b> the earlier figure divided super PAC spending through Sept. 30 by campaign receipts through mid-2026. Those are two different periods, and most general-election spending came after June.</li>
      <li><b>Planned replacement:</b> <b>super PAC spending for the candidate ÷ (campaign funds raised + all outside spending for the candidate)</b>, both covering January 1, 2025 to September 30, 2026. It will be computed once third-quarter reports are filed (due October 15).</li>
      <li><b>Limits:</b> labeled general-election only. Not shown for three-way races or races marked incomplete.</li>
      <li><b>Dropped:</b> the earlier Low/Moderate/High bands, which were never validated.</li>
    </ul>
    <h2>Money routed through PACs on donors' behalf</h2>
    <ul class="list">
      <li><b>How it works:</b> some groups bundle their members' donations. Members give through the group's PAC, which forwards each gift to the candidate as an "earmarked" contribution.</li>
      <li><b>Why it's hidden:</b> the FEC treats this as individual money, so it doesn't show in a PAC breakdown even when a group directed it. It is already in campaign funds raised, so it is never added to them.</li>
      <li><b>Groups read for everyone:</b> AIPAC, Club for Growth, EMILY's List, J Street and the Senate Conservatives Fund. For each profiled campaign, what each group's PAC forwarded is read from the PAC's own FEC reports (its disbursements to that campaign marked "earmark"), for the cycles its PAC reports cover. A group that reports a total line with each gift listed below it is counted from the total line, so nothing counts twice. The PAC's own checks stay in the PAC table.</li>
      <li><b>Left out:</b> ActBlue and WinRed, which forward gifts for any campaign that uses them, so the campaign, not a group, chose them.</li>
      <li><b>Researched by hand:</b> where the FEC reading misses a total found in the filings by a reporter, the hand-researched total is used and labeled. Sen. Booker: $707,803 through AIPAC's PAC from January to September 2025, as tallied from FEC filings by Sludge; $5,000 of it was the PAC's own check, so $702,803 counts as bundled.</li>
      <li><b>Where it counts:</b> beside each group's own money in the funder list, a table on the Money &amp; Influence tab and a tag on the Bills page. It counts as that group's money in Donor Loyalty 🤝 and Vote Donor Alignment, never in a grade.</li>
      <li><b>Anyone else:</b> no row means none of these groups forwarded gifts to that campaign in the FEC's processed records as of the date shown. Other groups that bundle aren't read yet.</li>
    </ul>
    <h2>Voting ideology (liberal–conservative %)</h2>
    <ul class="list">
      <li><b>Score:</b> Voteview's DW-NOMINATE first-dimension score, from every roll call a member has cast. −1 is most liberal and +1 most conservative.</li>
      <li><b>Source:</b> the Open Chambers mirror of Voteview data (built September 30, 2026), spot-checked against Voteview.</li>
      <li><b>Percentile:</b> compared with the other current members of the same chamber who have at least 100 scored votes (${DATA.pools.S.length} senators, ${DATA.pools.H.length} representatives).</li>
      <li><b>Party unity:</b> the share of party-line votes cast with the party majority in the 119th Congress.</li>
      <li><b>State legislators:</b> no published state score is comparable, so they show their record instead.</li>
    </ul>
    <h2>Records for candidates who are not in Congress</h2>
    <p>Each candidate's record comes from the office they actually held, in clearly labeled sections:</p>
    <ul class="list">
      <li><b>Congressional record:</b> U.S. roll-call votes and sponsored bills.</li>
      <li><b>State legislative record:</b> seats held, recorded votes, bills authored or sponsored, and leadership posts.</li>
      <li><b>Record in executive office:</b> major official acts with their outcomes.</li>
      <li><b>Other documented record:</b> for candidates who never held office, public actions and platform commitments.</li>
      <li><b>No inferred votes:</b> a state vote is shown only where a source shows that person's own vote.</li>
      <li><b>Gaps:</b> many state journals from before about 2010 are not online, so several state records are short or empty. Each section says what was searched.</li>
      <li><b>Filing:</b> each state item notes why it is filed under its policy area.</li>
      <li><b>Comparisons:</b> flagged when candidates' records are different kinds of evidence, because those can't be compared directly.</li>
    </ul>
    <h2>Legislative record</h2>
    <ul class="list">
      <li><b>Senate:</b> ${sv} roll calls from the 117th–119th Congresses, from the Senate's official vote records.</li>
      <li><b>House:</b> ${hv} roll calls from 2021–2026, from the House Clerk's records (via the Open Chambers mirror for 2025–26, checked against the Clerk for sampled votes).</li>
      <li><b>Picked by this app:</b> to cover major issues of the period. Each opens to the measure's official title, a cited summary, the question and result, and whether it is used for voter alignment, and why.</li>
    </ul>
    <h2>Statements vs. actions</h2>
    <p>Each check pairs a dated, sourced statement with a dated, sourced action. The label rates that pairing, not whether the policy is good. Checks were picked for being important and verifiable, not as a sample of everything a candidate has said.</p>
    <ul class="list">
      <li><b>Consistent:</b> the action matches the statement.</li>
      <li><b>Direct contradiction:</b> the record directly conflicts with what was said, such as a claimed amount the official record shows was not reached.</li>
      <li><b>Partly consistent:</b> part of the record matches the statement, and part conflicts with it.</li>
      <li><b>Ambiguous or incomplete evidence:</b> the statement and action point different ways, but whether they conflict depends on how you read them (different bills, different stated reasons). Or the record is incomplete, for example because of absences.</li>
      <li><b>Changed position:</b> a clear or admitted reversal.</li>
      <li><b>Outcome check:</b> the action fit the reasons given at the time, but later events bear on it.</li>
    </ul>
    <h2>Ethics and compliance</h2>
    <ul class="list">
      <li><b>Covered:</b> findings by ethics bodies, enforcement actions, reported STOCK Act late disclosures, complaints and referrals (with their documented outcome), and investigations that ended without charges.</li>
      <li><b>Sources:</b> a partisan outlet is never the only source.</li>
      <li><b>"None found":</b> the listed searches turned up nothing. That does not mean nothing exists.</li>
      <li><b>Net worth:</b> for each sitting member, from their latest annual financial disclosure (an amendment over the original), read weekly: House reports from the House Clerk's disclosure index, senators' from Senate eFD. The forms give every value as a range, so net worth is a range too: the lowest is every asset at the bottom of its range minus every debt at the top of its, and the highest is the reverse. A range with no upper limit ("Over $50,000,000") shows as "or more". A home and its mortgage aren't on the form unless the home earns income, so neither is counted. Candidates who never served aren't covered yet. Shown only, never in a grade.</li>
    </ul>
    <h2>Voter alignment</h2>
    <ul class="list">
      <li><b>Issues:</b> ${ISS.length} issues, each with two sides written neutrally: ${ISS.map(i=>esc(i.label)).join('; ')}. The list covers only issues where records could be documented, so many topics voters care about are left out.</li>
      <li><b>Answering:</b> on My alignment, each issue is one statement. Agreeing takes the issue's first side, and disagreeing the second.</li>
      <li><b>Importance:</b> strongly agree or disagree counts as high (3). Agree or disagree counts as medium (2). Neutral is recorded but left out of every score.</li>
      <li><b>Same answers everywhere:</b> each question lists the key votes it is compared with. Your answers are also used on each Your match tab and in the home-page "Your match" grade.</li>
      <li><b>Evidence from votes:</b> a key vote is assigned to an issue only when the measure's content makes the direction clear, with the reason shown under "Bill details". Nominations, stopgap spending bills, bundled packages and lopsided votes are not used; each shows why. When a member voted more than once on a bill, only the final vote counts.</li>
      <li><b>Other evidence:</b> state votes, sponsored bills, official actions and statements are coded only when the item's own words make the side clear, and each shows the reason. Coding was proposed item by item, then reviewed. Two items coded from a bill title alone were removed. No vote is inferred, and absences never count.</li>
      <li><b>Score per issue:</b> the share of recorded actions (votes, bills, official actions) on your side. Stated positions are used only for an issue with no recorded action, and are labeled.</li>
      <li><b>Overall figure:</b> Σ (importance × agreement) ÷ Σ importance of covered issues. Issues without evidence are left out, not scored as zero.</li>
      <li><b>When it shows:</b> evidence must cover at least three of your issues (or all of them, if you chose fewer than three) and half of your total importance. Otherwise you see "Insufficient data".</li>
      <li><b>Keep in mind:</b> it compares a record with your choices. It is not a rating of the candidate. Candidates with more votes on record have more chances to differ from you.</li>
      <li><b>Your choices:</b> stored only in your browser. The example starting points are labeled by their content, and every choice can be changed.</li>
    </ul>
    <h2>Money and votes side by side</h2>
    <p>For each issue, the People First tab lists the candidate's recorded actions next to groups linked to that issue.</p>
    <ul class="list">
      <li><b>How groups are linked:</b> by their documented stance or description (for example, a gun-rights or environmental group), by their name, or by the sector this app assigned to a PAC (for example, oil and gas for climate and energy). The reason is shown.</li>
      <li><b>Amounts:</b> PAC contributions to the campaign in the itemized reports, and outside spending for or against the candidate, with dates.</li>
      <li><b>Correlation, not cause:</b> this is a link to explore, not evidence that money changed a vote. Groups often back candidates who already agree with them.</li>
    </ul>
    <h2>Funders' own positions vs. votes</h2>
    <ul class="list">
      <li><b>Which groups:</b> those that gave to a campaign or spent on a race, and publish congressional scorecards or "key vote" letters.</li>
      <li><b>What is recorded:</b> which way the group wanted each key vote to go, from its own scorecard or letter (or, as a second choice, a news report quoting it). The candidate's recorded vote is shown beside it.</li>
      <li><b>Exact match only:</b> a position is recorded only for the same roll call (or, for a public letter, the same bill at the same stage). Nothing is inferred from a group's general mission.</li>
      <li><b>Left out:</b> two positions whose exact roll call couldn't be confirmed from a page that was read (AFL-CIO on the March 2025 stopgap bill; NFIB on the Senate's 2025 budget-bill vote).</li>
      <li><b>Groups researched:</b> ${GP.map(g=>esc(g.org)+' ('+g.nPositions+' positions'+(g.status==='pending'?', research in progress':'')+')').join('; ')}.</li>
      <li><b>Matching money:</b> groups are matched to money by the names of the committees they control.</li>
      <li><b>Not researched:</b> party-aligned super PACs, which make most of the outside spending in these races.</li>
      <li><b>Correlation, not cause:</b> agreeing with a funder's positions is not evidence that money changed a vote.</li>
    </ul>
    <h3>Money and votes over time</h3>
    <p>Under each comparison, a timeline shows the group's money to or about the candidate by month since ${H0()}. The compared votes are numbered circles on the same time axis.</p>
    <ul class="list">
      <li><b>Above the line:</b> contributions to the campaign from the group's PACs, and independent expenditures supporting the candidate.</li>
      <li><b>Below the line:</b> independent expenditures opposing the candidate. This is money spent to defeat them, not money they received.</li>
      <li><b>Committees:</b> listed under each chart, including the group's own connected PAC where the FEC committee file names the group.</li>
      <li><b>Contributions:</b> direct and in-kind, from the FEC bulk file of committee contributions to candidates (2020–2026 cycles), by transaction date. They include earlier campaigns for another office (for example, a House member now running for the Senate), matched by FEC candidate ID. Memo lines are left out.</li>
      <li><b>Outside spending:</b> before 2025, from the same bulk file. From January 2025, from the outside-spending data used everywhere else on this site, because the bulk file misses the latest 24- and 48-hour notices.</li>
      <li><b>What counts:</b> only general-election items that name the candidate directly, including runoffs after a general election (such as Georgia's in January 2021). Primary spending and spending about an opponent are not shown, so a chart's total can be lower than the totals above it.</li>
      <li><b>Correlation, not cause:</b> money arriving before or after a vote does not show that it changed the vote. Groups mostly fund people who already vote their way, and spend most in the months before an election.</li>
    </ul>
    <h2>Glossary</h2>
    <dl class="kvd">
      <dt>Campaign funds raised</dt><dd>${esc(GLOSS.receipts)}</dd>
      <dt>Independent expenditure</dt><dd>${esc(GLOSS.ie)}</dd>
      <dt>Outside spending</dt><dd>All independent expenditures by super PACs, other outside groups and party committees. "For" a candidate means supporting them or opposing their opponent.</dd>
      <dt>Super PAC</dt><dd>${esc(GLOSS.superpac)}</dd>
      <dt>PAC contribution</dt><dd>${esc(GLOSS.pac)}</dd>
      <dt>Joint fundraising transfer</dt><dd>${esc(GLOSS.transfers)}</dd>
      <dt>Earmarked contribution</dt><dd>${esc(GLOSS.earmarked)}</dd>
      <dt>Roll call</dt><dd>A recorded vote. Each member's position is listed by name in the official record.</dd>
      <dt>Cloture</dt><dd>A Senate vote to end debate. It usually needs 60 votes. A vote for cloture is a vote to move a measure forward.</dd>
      <dt>DW-NOMINATE</dt><dd>A political-science score of where a member of Congress sits on a left–right scale, estimated from all their roll-call votes.</dd>
      <dt>Insufficient data</dt><dd>Shown instead of an alignment figure when the evidence covers too few of your chosen issues.</dd>
    </dl>
    <h2>Automatic refresh checks</h2>
    <ul class="list">
      <li><b>Before publishing:</b> the update service checks source IDs, required fields, amounts, page-by-page fetching, and vote identities.</li>
      <li><b>If an update fails:</b> the previous published records are kept.</li>
      <li><b>Reviewed research:</b> stays the imported snapshot. It is not fact-checked or reclassified automatically.</li>
      <li><b>History and coverage:</b> on the <a href="#updates">API updates</a> and <a href="#websites">Website updates</a> pages.</li>
    </ul>
    <h2>Known gaps</h2>
    <ul class="list">
      <li><b>Dates:</b> campaign funds run through each campaign's latest report (mostly June 30, 2026). Outside spending runs through ${fmtDate(IE.asof)}.</li>
      <li><b>No report yet:</b> Troy Jackson (D-ME) has not filed a financial report.</li>
      <li><b>Missing PAC rows:</b> two of Sen. Collins' reports (Year-End 2025 and Pre-Primary 2026) could not be retrieved, so those PAC rows are incomplete. Several other candidates' rows are a few short of their reports' totals; each profile shows its coverage.</li>
      <li><b>Possible duplicate:</b> one of Sen. Marshall's reports (April 2025) transcribed to $5,000 more than the report's subtotal. It is flagged on Marshall's profile.</li>
      <li><b>Earmarked totals:</b> read for five groups that bundle (see above). Other groups' bundling isn't read yet, and the FEC reading can miss gifts a conduit reported in an unusual way, as it did for Sen. Booker.</li>
      <li><b>Net worth:</b> only for sitting members, and a paper-filed report can't be read.</li>
      <li><b>House toss-ups:</b> 14 of the 22 are shown with results only. Their candidates have no profile, record, statement or ethics research yet.</li>
      <li><b>Issue list:</b> covers ${ISS.length} issues that could be documented. Candidates whose records are mostly on other topics (for example, Texas education bills) have little coded evidence. Several candidates without a voting record show "Insufficient data".</li>
      <li><b>Primary results:</b> some 2026 primary percentages could not be confirmed against certified results and were removed from status lines.</li>
      <li><b>State records:</b> thin where old journals are offline. None could be sourced for Chris Pappas or Juliana Stratton, and only a leadership post for Mary Peltola and Mariannette Miller-Meeks.</li>
      <li><b>Independent candidates:</b> outside spending on Dan Osborn (Nebraska) and Seth Bodnar (Montana) is missing from the compiled data, so those races are marked incomplete.</li>
      <li><b>Sherrod Brown's ideology score:</b> Voteview's page did not show a numeric score, so none is displayed.</li>
    </ul>
    <h2>Independence</h2>
    <p>Built from public records. No ties to any campaign, party or PAC. Nothing here is a voting recommendation.</p>
  </section>`;
}

// ---------- tooltips ----------
function bindTips(root){
  root.querySelectorAll('[data-tip]').forEach(el=>{
    el.addEventListener('mouseenter',()=>{tip.textContent=el.dataset.tip;tip.classList.add('show');});
    el.addEventListener('mousemove',e=>{const x=Math.max(10,Math.min(e.clientX+12,window.innerWidth-310));tip.style.left=x+'px';tip.style.top=(e.clientY+14)+'px';});
    el.addEventListener('mouseleave',()=>tip.classList.remove('show'));
    el.setAttribute('tabindex','0');el.setAttribute('aria-label',el.dataset.tip);
    el.addEventListener('focus',()=>{const r=el.getBoundingClientRect();tip.textContent=el.dataset.tip;tip.style.left=Math.max(10,Math.min(r.left,window.innerWidth-310))+'px';tip.style.top=(r.bottom+6)+'px';tip.classList.add('show')});
    el.addEventListener('blur',()=>tip.classList.remove('show'));
  });
}
route();
})();
