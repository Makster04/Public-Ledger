// The Rankings page (#rankings, approved Nov. 14, 2026 from the mockup): a tab for each of the six scores, and two boxes
// side by side, the 10 at one end and the 10 at the other. Ideology is a position, so its boxes are the most liberal and
// the most conservative. For the five grades, the left box lists only people at 70% (a C) or higher and the right box only
// people under 70%, so nobody with a passing grade is called "Dishonest" or "Unethical" just because few are graded;
// a box shows fewer than 10 when fewer qualify, and says so. Ties go to whoever has more evidence (more questions,
// promises, votes, trades or scored actions), then by name, and a box says how many are tied. Each right-hand box carries
// a line saying a low score isn't a finding of wrongdoing. The page builds each person's row (public/app.js); this file
// sorts and draws them.
import {letter} from './grades.js';
import {leanLabel} from './six-scores.js';

export const RANK={size:10,cut:70};
export const RANK_SCORES=[
  {key:'ideology',name:'Ideology',left:'Top 10 Liberal',right:'Top 10 Conservative',position:true,unit:'questions',
    note:'A position from −100 (most liberal) to +100 (most conservative), not a grade.'},
  {key:'word',name:'Keeps Their Word',left:'Top 10 Honest',right:'Top 10 Dishonest',unit:'promises',
    note:'The share of their decided promises they kept. It needs 3 decided promises.'},
  {key:'showsup',name:'Shows Up',left:'Top 10 Stalwarts',right:'Top 10 Slackers',unit:'votes',
    note:'Roll-call attendance since 2018, and how far the bills they sponsor get. Delegates aren\'t graded.'},
  {key:'unbought',name:'Big Money Independence',left:'Top 10 Purists',right:'Top 10 Sellouts',unit:null,disclosure:true,
    note:'How independent their campaign money and holdings are from special interests. It needs their financial disclosure read.'},
  {key:'aboveboard',name:'Plays by the Rules',left:'Top 10 Ethical',right:'Top 10 Unethical',unit:'trades',disclosure:true,
    note:'Conflicts, the disclosure rules and legal trouble. It needs their legal record reviewed and their trade reports read.'},
  {key:'peoplefirst',name:'People First',left:'Top 10 for Working People',right:'Top 10 for the Rich',unit:'scored actions',
    note:'Whether their votes and bills favor working people or business interests.'},
];
export const RANK_BY=Object.fromEntries(RANK_SCORES.map(s=>[s.key,s]));
export const WHO=[['','Everyone'],['S','Senate'],['H','House'],['C','Candidates']];
const inWho=(r,who)=>!who||(who==='C'?!!r.cand:!r.cand&&!r.office&&r.chamber===who);

// rows: [{id, name, party, state, chamber, cand, office, scores: {key: number|null}, n: {key: evidence count}}].
// Returns how many have the score in the group picked, and each box: every qualifying row in order, the top `size`, and
// how many share the first row's value.
export function rankSides(rows,score,{state='',who=''}={},{size=RANK.size,cut=RANK.cut}={}){
  const k=score.key,v=r=>r.scores[k],ev=r=>r.n?.[k]||0,name=(a,b)=>String(a.name).localeCompare(String(b.name));
  const pool=(rows||[]).filter(r=>Number.isFinite(r.scores?.[k])&&(!state||r.state===state)&&inWho(r,who));
  const hi=(a,b)=>v(b)-v(a)||ev(b)-ev(a)||name(a,b),lo=(a,b)=>v(a)-v(b)||ev(b)-ev(a)||name(a,b);
  const [left,right]=score.position?[pool.filter(r=>v(r)<0).sort(lo),pool.filter(r=>v(r)>0).sort(hi)]:[pool.filter(r=>v(r)>=cut).sort(hi),pool.filter(r=>v(r)<cut).sort(lo)];
  const side=list=>({all:list,top:list.slice(0,size),tied:list.length?list.filter(r=>v(r)===v(list[0])).length:0});
  return {pool:pool.length,left:side(left),right:side(right)};
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const ini=n=>String(n||'').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const signed=v=>`${v>0?'+':v<0?'−':''}${Math.abs(v)}`;
const valueText=(score,v)=>score.position?signed(v):`${v}%`;
function rowHTML(r,i,score,portraits){
  const v=r.scores[score.key],n=r.n?.[score.key],file=portraits?.[r.id]?.file,side=r.party==='D'?'d':r.party==='R'?'r':'i';
  const val=score.position?`<b>${esc(signed(v))}</b><span class="rk-chip rk-lean rk-${v<0?'lib':'con'}">${esc(leanLabel(v))}</span>`
    :`<b>${v}%</b><span class="rk-chip gr-${letter(Math.min(100,v))}">${letter(Math.min(100,v))}</span>`;
  return `<a class="rk-row" href="#${esc(r.id)}"><span class="rk-n">${i+1}</span>${file?`<img class="rk-pic rk-${side}" src="/${esc(file)}" alt="" loading="lazy" decoding="async">`:`<span class="rk-pic rk-ini rk-${side}" aria-hidden="true">${esc(ini(r.name))}</span>`}`
    +`<span class="rk-who"><span class="rk-nm">${esc(r.name)}</span><span class="rk-sub">${esc([r.party,r.state,r.officeLabel].filter(Boolean).join(' · '))}${n&&score.unit?` · ${n.toLocaleString('en-US')} ${esc(score.unit)}`:''}</span></span><span class="rk-v">${val}</span></a>`;
}
function boxHTML(which,score,side,{open=false,portraits,loading=false,cut=RANK.cut}={}){
  const good=which==='left',title=good?score.left:score.right,list=open?side.all:side.top;
  const icon=score.position?(good?['◀','lib']:['▶','con']):good?['▲','good']:['▼','bad'];
  const shown=list.length,first=list[0]?.scores[score.key];
  const notes=[];
  if(side.tied>shown&&shown)notes.push(`${side.tied} people tied at ${valueText(score,first)}; these have the most evidence.`);
  if(!score.position&&side.all.length&&side.all.length<RANK.size)notes.push(good?`Only ${side.all.length} score${side.all.length===1?'s':''} ${cut}% or higher.`:`Only ${side.all.length} score${side.all.length===1?'s':''} under ${cut}%.`);
  const empty=loading?'Reading their disclosures…':score.disclosure?`No one here yet. It fills in as the refresh reads their disclosures.`:score.position?'No one placed on this side yet.':good?`No one here scores ${cut}% or higher.`:`No one here scores under ${cut}%.`;
  const more=side.all.length>RANK.size?`<button type="button" class="rk-all" data-open="${which}" aria-expanded="${open}">${open?'Show top 10':`See all (${side.all.length})`}</button>`:'';
  return `<section class="rk-box" aria-labelledby="rk-${which}-h"><div class="rk-head"><span class="rk-ic rk-${icon[1]}" aria-hidden="true">${icon[0]}</span><h2 id="rk-${which}-h">${esc(title)}</h2>${more}</div>`
    +notes.map(t=>`<p class="rk-note">${esc(t)}</p>`).join('')
    +(shown?`<div class="rk-list">${list.map((r,i)=>rowHTML(r,i,score,portraits)).join('')}</div>`:`<p class="rk-empty">${esc(empty)}</p>`)
    +(!good&&!score.position&&shown?`<p class="rk-fine">Lowest scores on this measure, not a finding of wrongdoing.</p>`:'')+'</section>';
}
// The page: tabs, the score's note with how many are graded, the filters, and the two boxes. state: {key, state, who,
// open: {left, right}}; states: [[code, name]]; loading: true while the refresh's disclosures are still being read.
export function rankingsHTML(rows,state={},{portraits={},states=[],loading=false}={}){
  const score=RANK_BY[state.key]||RANK_SCORES[0],sides=rankSides(rows,score,state),wait=loading&&score.disclosure;
  return `<div class="page-eyebrow">RANKINGS</div><h1>Rankings</h1><p class="rk-lede">Who ranks highest and lowest on each score.</p>
    <div class="rk-tabs" role="tablist" aria-label="Score">${RANK_SCORES.map(s=>`<button type="button" class="rk-tab" role="tab" data-key="${s.key}" aria-selected="${s.key===score.key}">${esc(s.name)}</button>`).join('')}</div>
    <div class="rk-bar"><p>${esc(score.note)} ${wait?'Reading the disclosures…':`${sides.pool.toLocaleString('en-US')} ${sides.pool===1?'person':'people'} graded${score.position?' or placed':''}.`} Ties go to whoever has more evidence.</p>
      <label><span class="sr-only">State</span><select class="rk-sel" data-filter="state"><option value="">All states</option>${states.map(([c,n])=>`<option value="${esc(c)}"${c===state.state?' selected':''}>${esc(n)}</option>`).join('')}</select></label>
      <label><span class="sr-only">Who</span><select class="rk-sel" data-filter="who">${WHO.map(([c,n])=>`<option value="${c}"${c===(state.who||'')?' selected':''}>${n}</option>`).join('')}</select></label></div>
    <div class="rk-grid">${boxHTML('left',score,sides.left,{open:!!state.open?.left,portraits,loading:wait})}${boxHTML('right',score,sides.right,{open:!!state.open?.right,portraits,loading:wait})}</div>
    ${sides.left.all.length>RANK.size||sides.right.all.length>RANK.size?`<div class="rk-foot"><button type="button" class="rk-viewall" data-open="both">${state.open?.left&&state.open?.right?'Show the top 10s':'View all rankings'} <span aria-hidden="true">→</span></button></div>`:''}`;
}
