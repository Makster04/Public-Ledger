// The House and the Senate as seating charts on the home page: Democrats on the left, Republicans on the right,
// independents between them, each seat a dot colored by whether the member's campaign took corporate PAC money this
// cycle (public/corporate-pacs.json, from scripts/build-corporate-pacs.mjs): red took some, green took none, gray not
// read yet; a vacant seat is a hollow ring. Within each party the dots are grouped by color, so each side's share shows
// as wedges. Each dot links to the member's profile, with their name and status on hover.

export const SEAT_COLORS={took:'#ef5a5a',none:'#2fd27a',waiting:'#3b4452'};
// The House's delegates and resident commissioner (no floor vote), left off its 435 seats.
export const TERRITORIES=new Set(['DC','PR','GU','VI','AS','MP']);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A member's status from their corporate-pacs.json entry ([corporate PAC dollars, corporate PACs]): null when their
// campaign hasn't been read.
export const corporateStatus=entry=>Array.isArray(entry)?(Number(entry[0])>0?'took':'none'):'waiting';

// Seat positions for n seats in rows of arcs between radii r0 and r1: each row gets seats in proportion to its length,
// and every seat is put in order of its angle from the left, so a run of seats fills a wedge. x and y are from the
// center of the bottom edge (y up is negative).
export function seatLayout(n,rows,r0,r1){
  const radii=Array.from({length:rows},(_,i)=>rows===1?r1:r0+(r1-r0)*i/(rows-1)),sum=radii.reduce((a,b)=>a+b,0);
  const per=radii.map(r=>Math.round(n*r/sum));
  for(let diff=n-per.reduce((a,b)=>a+b,0),i=rows-1;diff!==0;i=(i-1+rows)%rows){const s=Math.sign(diff);if(per[i]+s>=1){per[i]+=s;diff-=s;}}
  const out=[];
  radii.forEach((r,i)=>{const k=per[i];for(let j=0;j<k;j++){const a=Math.PI-(k===1?Math.PI/2:Math.PI*j/(k-1));out.push({r,a,x:r*Math.cos(a),y:-r*Math.sin(a)});}});
  return out.sort((p,q)=>q.a-p.a||p.r-q.r);
}

// The seats in order, left to right: Democrats (none, took, not read), independents, the vacant seats, Republicans
// (not read, took, none). total: the chamber's seats; members past it are left off.
export function seatOrder(list,total,statusOf){
  const by=(party,order)=>order.flatMap(st=>list.filter(m=>m.party===party&&statusOf(m)===st));
  const D=by('D',['none','took','waiting']),I=by('I',['none','took','waiting']),R=by('R',['waiting','took','none']);
  const others=list.filter(m=>!['D','I','R'].includes(m.party));
  const seated=[...D,...I,...others].concat(Array(Math.max(0,total-list.length)).fill(null),R);
  return seated.slice(0,total);
}

// One chamber's chart: the SVG, the counts by status (and vacant seats), and the counts by party.
export function seatChart(list,{total,rows,r0,r1,dot,label,statusOf}){
  const order=seatOrder(list,total,statusOf),pos=seatLayout(total,rows,r0,r1),W=Math.ceil(r1*2+dot*2+4),H=Math.ceil(r1+dot+4),cx=W/2,cy=r1+dot+2;
  const say={took:'took corporate PAC money this cycle',none:'took no corporate PAC money this cycle',waiting:'not read yet'};
  const dots=pos.map((p,i)=>{const m=order[i],x=(cx+p.x).toFixed(1),y=(cy+p.y).toFixed(1);
    if(!m)return `<circle cx="${x}" cy="${y}" r="${(dot-0.8).toFixed(1)}" fill="none" stroke="#8b95a5" stroke-width="1.2"><title>Vacant seat</title></circle>`;
    const st=statusOf(m);
    return `<a href="#${esc(m.id)}" tabindex="-1"><circle cx="${x}" cy="${y}" r="${dot}" fill="${SEAT_COLORS[st]}"><title>${esc(m.name)} (${esc(m.party)}-${esc(m.state)}): ${say[st]}</title></circle></a>`;}).join('');
  // A dashed line where the Democrats' side ends and the Republicans' begins.
  const k=order.findIndex(m=>m&&m.party==='R'),mid=k>0?(pos[k-1].a+pos[k].a)/2:null;
  const split=mid==null?'':`<path d="M${(cx+(r0-10)*Math.cos(mid)).toFixed(1)} ${(cy-(r0-10)*Math.sin(mid)).toFixed(1)}L${(cx+(r1+dot+1)*Math.cos(mid)).toFixed(1)} ${(cy-(r1+dot+1)*Math.sin(mid)).toFixed(1)}" stroke="#c9d1dc" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  const seated=order.filter(Boolean),n=st=>seated.filter(m=>statusOf(m)===st).length;
  const counts={took:n('took'),none:n('none'),waiting:n('waiting'),vacant:order.length-seated.length};
  const parties=['D','I','R'].map(p=>[p,seated.filter(m=>m.party===p).length]).filter(x=>x[1]);
  const svg=`<svg class="seats-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">${dots}${split}
    <text x="${cx}" y="${(cy-6).toFixed(1)}" text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="700" font-size="${Math.round(r0*0.62)}" fill="#eef2f7">${total}</text></svg>`;
  return {svg,counts,parties,label};
}
