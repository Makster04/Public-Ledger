// The home page's seating charts of who takes corporate PAC money (public/seats.js), and the bulk-file reader behind
// them (scripts/build-corporate-pacs.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {seatLayout,seatOrder,seatChart,corporateStatus,TERRITORIES,SEAT_COLORS} from '../public/seats.js';
import {committeeKind,corporateCheck,membersByCandidate,corporateTotals,trackersOf,routedByMember,trackerTotals} from '../scripts/build-corporate-pacs.mjs';
import senate from '../public/senate.json' with {type:'json'};
import house from '../public/house.json' with {type:'json'};

test('seats: rows of arcs, every seat once, in order from the left',()=>{
  for(const [n,rows] of [[435,12],[100,5],[7,2]]){
    const s=seatLayout(n,rows,40,100);
    assert.equal(s.length,n);assert.ok(s.every((p,i)=>i===0||p.a<=s[i-1].a),'by angle, left to right');
    assert.ok(s.every(p=>p.y<=1e-9&&Math.abs(Math.hypot(p.x,p.y)-p.r)<1e-6),'on its arc, above the bottom edge');
    assert.equal(new Set(s.map(p=>`${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size,n,'no two seats in one place');
  }
});

test('the order: Democrats from the left (none, took, not read), independents, vacant seats, Republicans to the right (not read, took, none)',()=>{
  const m=(id,party,st)=>({id,party,st,name:id,state:'XX'}),statusOf=x=>x.st;
  const list=[m('r1','R','none'),m('d1','D','took'),m('i1','I','none'),m('d2','D','none'),m('r2','R','took'),m('d3','D','waiting'),m('r3','R','waiting')];
  const o=seatOrder(list,9,statusOf);
  assert.deepEqual(o.map(x=>x?.id??null),['d2','d1','d3','i1',null,null,'r3','r2','r1']);
  assert.equal(corporateStatus([12500,3]),'took');assert.equal(corporateStatus([0,0]),'none');assert.equal(corporateStatus(undefined),'waiting');
});

test('a chamber\'s chart: a dot for each seat, linked to the profile, colored by status, the counts, a dashed line between the parties',()=>{
  const sen=senate.senators,st=x=>x.id==='collins'?'took':x.id==='booker'?'none':'waiting';
  const c=seatChart(sen,{total:100,rows:5,r0:44,r1:100,dot:5.6,label:'Senate',statusOf:st});
  assert.equal((c.svg.match(/<circle/g)||[]).length,100);assert.equal((c.svg.match(/<a href="#/g)||[]).length,100);
  assert.deepEqual(c.counts,{took:1,none:1,waiting:98,vacant:0});
  assert.deepEqual(c.parties,[['D',45],['I',2],['R',53]]);
  assert.match(c.svg,new RegExp(`<a href="#collins" tabindex="-1"><circle[^>]*fill="${SEAT_COLORS.took}"><title>Susan M\\. Collins \\(R-ME\\): took corporate PAC money this cycle</title>`));
  assert.match(c.svg,/stroke-dasharray="3 3"/);assert.match(c.svg,/>100<\/text>/);
  // The House: 435 seats for the voting members (delegates left off), the rest hollow.
  const voting=house.members.filter(x=>!TERRITORIES.has(x.state)),h=seatChart(voting,{total:435,rows:12,r0:66,r1:168,dot:4.3,label:'House',statusOf:()=>'waiting'});
  assert.equal((h.svg.match(/<circle/g)||[]).length,435);assert.equal(h.counts.vacant,435-voting.length);
  assert.equal((h.svg.match(/<title>Vacant seat<\/title>/g)||[]).length,435-voting.length);
  assert.ok(!voting.some(x=>['DC','PR','GU','VI','AS','MP'].includes(x.state)));
  const evil=seatChart([{id:'x"><script>',name:'<b>',party:'D',state:'ZZ'}],{total:3,rows:1,r0:20,r1:40,dot:4,label:'T',statusOf:()=>'none'});
  assert.doesNotMatch(evil.svg,/<script|<b>/);
});

// FEC bulk-file lines, as the files lay them out (pipe-separated): cm.txt and itpas2.txt.
const cm=(id,name,dsgn,type,org,cand='')=>[id,name,'TREASURER','1 MAIN ST','','CITY','ST','00000',dsgn,type,'','Q',org,'SPONSOR',cand].join('|');
const pas=(cmte,tp,amt,cand,memo='')=>{const c=new Array(22).fill('');c[0]=cmte;c[5]=tp;c[13]='10152025';c[14]=String(amt);c[16]=cand;c[19]=memo;return c.join('|');};

test('the bulk files: a corporation\'s PAC, its direct and in-kind checks to each member, refunds taken off',()=>{
  assert.deepEqual(committeeKind(cm('C00000001','ACME CORP PAC','U','Q','C')),['C00000001','corporate','ACME CORP PAC',null]);
  assert.deepEqual(committeeKind(cm('C00000005','NO STOCK CORP PAC','U','Q','W')).slice(0,2),['C00000005','corporate'],'a corporation without capital stock');
  assert.deepEqual(committeeKind(cm('C00000002','TEAMSTERS','U','Q','L')).slice(0,2),['C00000002','labor']);
  assert.deepEqual(committeeKind(cm('C00000004','A LEADERSHIP PAC','D','Q','C')).slice(0,2),['C00000004','leadership'],'a politician\'s PAC, even with a corporate sponsor listed');
  assert.deepEqual(committeeKind(cm('C00314575','COLLINS FOR SENATOR','P','S','','S6ME00159')),['C00314575','candidate','COLLINS FOR SENATOR','S6ME00159'],'a campaign committee knows its candidate');
  assert.equal(committeeKind('header|line'),null);
  const kinds=new Map([['C00000001','corporate'],['C00000002','labor'],['C00000004','leadership']]);
  assert.deepEqual(corporateCheck(pas('C00000001','24K',5000,'S6ME00159'),kinds),{cand:'S6ME00159',cmte:'C00000001',amount:5000,date:'10152025'});
  assert.equal(corporateCheck(pas('C00000001','24Z',750,'H2AK01083'),kinds).amount,750,'in-kind counts');
  assert.equal(corporateCheck(pas('C00000001','24E',90000,'S6ME00159'),kinds),null,'outside spending isn\'t a check');
  assert.equal(corporateCheck(pas('C00000001','24K',2000,'S6ME00159','X'),kinds),null,'a memo line repeats another');
  assert.equal(corporateCheck(pas('C00000002','24K',2500,'S6ME00159'),kinds),null,'a union\'s PAC');
  assert.equal(corporateCheck(pas('C00000004','24K',5000,'S6ME00159'),kinds),null,'a leadership PAC');
  const byCand=membersByCandidate({senators:[{id:'collins',fecCand:'S6ME00159'},{id:'newsen'}]},{members:[{id:'begich',fecCand:'H2AK01083'},{id:'quiet',fecCand:'H0XX00001'}]});
  assert.deepEqual([...byCand],[['S6ME00159','collins'],['H2AK01083','begich'],['H0XX00001','quiet']],'a senator without a candidate ID isn\'t read');
  const t=corporateTotals([{cand:'S6ME00159',cmte:'C1',amount:5000},{cand:'S6ME00159',cmte:'C1',amount:-1000},{cand:'S6ME00159',cmte:'C2',amount:2500},{cand:'H2AK01083',cmte:'C1',amount:750},{cand:'H2AK01083',cmte:'C3',amount:-750},{cand:'S9ZZ00000',cmte:'C1',amount:1}],byCand);
  assert.deepEqual(t,{collins:[6500,2],begich:[0,0],quiet:[0,0]},'net of refunds; a check refunded in full is none; someone not in Congress is left out');
});

test('each tracker\'s checks, matched as its Tracker matches PACs, and AIPAC\'s routed gifts from its payments by recipient',()=>{
  assert.deepEqual(trackersOf('C00797670','AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE'),['aipac'],'by committee ID');
  assert.deepEqual(trackersOf('C09999999','PFIZER INC. PAC'),['pharma'],'by name');
  assert.deepEqual(trackersOf('C09999998','EXXON MOBIL CORPORATION POLITICAL ACTION COMMITTEE'),['oil']);
  assert.deepEqual(trackersOf('C09999997','COINBASE INC PAC'),['crypto']);
  assert.deepEqual(trackersOf('C09999996','LOCAL BAKERY PAC'),[]);
  const byCand=new Map([['S6ME00159','collins'],['S8GA00180','ossoff'],['H2AK01083','begich']]);
  const cmteCand=new Map([['C00314575','S6ME00159'],['C00740001','S8GA00180']]);
  // Collins: gifts listed as memo entries; Ossoff: a payment beyond AIPAC's PAC's own $5,000 check; a committee not in Congress.
  const routed=routedByMember([{recipient_id:'C00314575',total:10000,memo_total:3348020.18},{recipient_id:'C00740001',total:5000,memo_total:0},{recipient_id:'C00999999',total:900,memo_total:900}],cmteCand,byCand,new Map([['ossoff',5000]]));
  assert.deepEqual(routed,{collins:3348020.18},'Ossoff\'s $5,000 is the PAC\'s own check, not routed');
  const checks=[{cand:'S6ME00159',cmte:'C00797670',amount:10000,keys:['aipac']},{cand:'S8GA00180',cmte:'C09999999',amount:2500,keys:['pharma']},{cand:'S8GA00180',cmte:'C09999999',amount:-2500,keys:['pharma']},{cand:'H2AK01083',cmte:'C09999998',amount:1000,keys:['oil']}];
  const t=trackerTotals(checks,byCand,routed);
  assert.deepEqual(t.aipac,{collins:[10000,1,3348020.18]});assert.deepEqual(t.pharma,{},'refunded in full: none');assert.deepEqual(t.oil,{begich:[1000,1]});
  assert.deepEqual(Object.keys(t),['aipac','pharma','oil','tech','crypto']);
  assert.deepEqual(trackerTotals([],byCand,{ossoff:250}).aipac,{ossoff:[0,0,250]},'routed gifts alone count');
});
