// The political compass on every profile's Ideology tab: economic views across (left to right), social views up and
// down (liberal at the bottom, conservative at the top). Each axis is the average of the Ideology tab's own issue leans
// (public/six-scores.js issueLeans: −100 liberal to +100 conservative, from votes, bills and statements) on the issues of
// that kind, by research.json's issue groups: economic, the 'econ' and 'env' issues (taxes, health coverage, labor,
// climate and energy); social, the 'rights' and 'imm' issues (abortion, marriage and contraception, guns, school
// vouchers, immigration enforcement, voter ID). Issues with no liberal side (the ones that split both parties) are on
// neither axis. An axis needs a lean on at least COMPASS_MIN_ISSUES issues; how many it has is shown.
import {issueLeans} from './six-scores.js';
import {compassFrom} from './question-scores.js';

export const COMPASS_GROUPS={econ:['econ','env'],social:['rights','imm']};
export const COMPASS_MIN_ISSUES=1;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const signedLean=n=>n==null?'—':(n>0?'+':n<0?'−':'')+Math.abs(n);

// The issue IDs on each axis.
export function compassAxes(issues){
  const of=groups=>(issues||[]).filter(i=>i.liberalSide&&groups.includes(i.group)).map(i=>i.id);
  return {econ:of(COMPASS_GROUPS.econ),social:of(COMPASS_GROUPS.social)};
}

// With the alignment questions (a list of questions, each with an axis), the axes average the question leans on each
// (public/question-scores.js compassFrom), from person.qst; the questions with no liberal side are on neither axis.
// A person's place: {x (economic), y (social), nx, ny (issues with a lean on each), econ, social (those issues)}; x or y is
// null when that axis has too few issues.
export function compassOf(person,issues){
  if((issues||[]).some(q=>'axis' in q&&'sides' in q))return compassFrom(person?.qst||{},issues);
  const leans=issueLeans(person,issues),axes=compassAxes(issues);
  const axis=ids=>{const L=leans.filter(x=>ids.includes(x.id)&&x.lean!=null);
    return {value:L.length>=COMPASS_MIN_ISSUES?Math.round(L.reduce((t,x)=>t+x.lean,0)/L.length):null,issues:L.map(x=>({id:x.id,label:x.label,lean:x.lean,n:x.n}))};};
  const e=axis(axes.econ),s=axis(axes.social);
  return {x:e.value,y:s.value,nx:e.issues.length,ny:s.issues.length,econ:e.issues,social:s.issues};
}

// The word for a place on an axis: within 20 of the middle, the middle (the Ideology tab's "moderate" band).
export function compassWord(v,axis){
  if(v==null)return 'not placed yet';
  if(Math.abs(v)<=20)return axis==='econ'?'center':'moderate';
  return axis==='econ'?(v<0?'left':'right'):(v<0?'liberal':'conservative');
}

// Everyone else placed on both axes, grouped by party and spot: [{party, x, y, people: [{id, name, party, state}]}],
// the biggest groups first (so smaller bubbles are drawn on top of them).
export function compassSpots(list,meId){
  const by=new Map();
  for(const p of list||[]){
    if(p.id===meId||p.x==null||p.y==null)continue;
    const party=['D','R'].includes(p.party)?p.party:'I',k=`${party}|${p.x}|${p.y}`;
    if(!by.has(k))by.set(k,{party,x:p.x,y:p.y,people:[]});by.get(k).people.push(p);
  }
  return [...by.values()].sort((a,b)=>b.people.length-a.people.length);
}

// The chart, size pixels square: the four quadrants, everyone else as bubbles by party (area grows with how many share
// the spot; a single member links to their profile), and the person's portrait at their place. Text and dots keep their
// size at any size (it's drawn at the size it's shown).
const PARTY={D:'Democrat',R:'Republican',I:'independent'};
export function compassSvg({me,place,list,size,portrait}){
  const S=Math.round(size),pad=30,W=S-pad*2,IN=28,X=v=>pad+IN+(v+100)/200*(W-2*IN),Y=v=>pad+IN+(100-v)/200*(W-2*IN);
  const spots=compassSpots(list,me.id);
  const bubble=sp=>{const n=sp.people.length,r=Math.min(26,3+Math.sqrt(n)*1.8),cx=X(sp.x).toFixed(1),cy=Y(sp.y).toFixed(1);
    const where=`economic ${signedLean(sp.x)}, social ${signedLean(sp.y)}`;
    if(n===1){const p=sp.people[0];return `<a href="#${esc(p.id)}-ideology"><circle class="cmp-b cmp-${sp.party}" cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill-opacity=".6"><title>${esc(p.name)} (${esc(p.party)}-${esc(p.state)}): ${where}</title></circle></a>`;}
    const names=sp.people.slice(0,5).map(p=>p.short||p.name).join(', ')+(n>5?` and ${n-5} more`:'');
    return `<circle class="cmp-b cmp-${sp.party}" cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill-opacity=".3"><title>${n} ${PARTY[sp.party]}s at ${where}: ${esc(names)}</title></circle>`;};
  const counts=spots.filter(sp=>sp.people.length>=10).map(sp=>`<text class="cmp-count" x="${X(sp.x).toFixed(1)}" y="${(Y(sp.y)+4).toFixed(1)}" text-anchor="middle">${sp.people.length}</text>`).join('');
  const grid=[-75,-50,-25,25,50,75].map(v=>`<path d="M${X(v).toFixed(1)} ${pad}V${pad+W}M${pad} ${Y(v).toFixed(1)}H${pad+W}"/>`).join('');
  const q=(x,y,c)=>`<rect class="cmp-q cmp-q${c}" x="${x}" y="${y}" width="${W/2}" height="${W/2}"/>`;
  const placed=place&&place.x!=null&&place.y!=null,mx=placed?X(place.x):0,my=placed?Y(place.y):0,party=['D','R'].includes(me.party)?me.party:'I';
  // (the others at the same spot are under the portrait, so how many is said under the name)
  const here=placed?spots.filter(sp=>sp.x===place.x&&sp.y===place.y).reduce((t,sp)=>t+sp.people.length,0):0;
  const meDot=!placed?'':`<g class="cmp-me"><clipPath id="cmp-me-clip"><circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="17"/></clipPath>
    <circle class="cmp-me-ring cmp-${party}" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="20"/>${portrait?`<image href="${esc(portrait)}" x="${(mx-17).toFixed(1)}" y="${(my-17).toFixed(1)}" width="34" height="34" preserveAspectRatio="xMidYMid slice" clip-path="url(#cmp-me-clip)"/>`:''}
    <text class="cmp-me-name" x="${mx.toFixed(1)}" y="${(my+34).toFixed(1)}" text-anchor="middle">${esc(me.short||me.name)}</text>${here?`<text class="cmp-me-here" x="${mx.toFixed(1)}" y="${(my+48).toFixed(1)}" text-anchor="middle">and ${here} other${here===1?'':'s'}</text>`:''}
    <title>${esc(me.name)}: economic ${signedLean(place.x)}, social ${signedLean(place.y)}</title></g>`;
  return `<svg class="cmp-svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="Political compass: ${esc(me.name)} at economic ${signedLean(place?.x)}, social ${signedLean(place?.y)}${list?.length?`, with ${spots.reduce((t,s)=>t+s.people.length,0)} others`:''}">
    ${q(pad,pad,'tl')}${q(pad+W/2,pad,'tr')}${q(pad,pad+W/2,'bl')}${q(pad+W/2,pad+W/2,'br')}<g class="cmp-grid">${grid}</g>
    <path class="cmp-axis" d="M${pad+W/2} ${pad}V${pad+W}M${pad} ${pad+W/2}H${pad+W}"/><rect class="cmp-frame" x="${pad}" y="${pad}" width="${W}" height="${W}"/>
    <text class="cmp-lab" x="${pad+W/2}" y="${pad-10}" text-anchor="middle">Socially conservative</text>
    <text class="cmp-lab" x="${pad+W/2}" y="${pad+W+20}" text-anchor="middle">Socially liberal</text>
    <text class="cmp-lab" text-anchor="middle" transform="translate(${pad-10} ${pad+W/2}) rotate(-90)">Economic left</text>
    <text class="cmp-lab" text-anchor="middle" transform="translate(${pad+W+18} ${pad+W/2}) rotate(90)">Economic right</text>
    ${spots.map(bubble).join('')}${counts}${meDot}</svg>`;
}
