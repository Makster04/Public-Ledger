// Career Totals (public/career.js, scripts/build-corporate-pacs.mjs careerHistory): each sitting member's career money
// from a tracker, ranked in dollar clubs: $1M or more, $500K, $100K, under $100K, none.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CLUB_KEYS,CLUB_LABEL,clubOf,careerAmount,chamberCareer,routedStatus} from '../public/career.js';
import {careerCycles,CAREER_FROM,AIPAC_FROM,legislatorIds,careerIds,careerSums,careerRouted} from '../scripts/build-corporate-pacs.mjs';

const read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));

test('the five clubs and their lines',()=>{
  assert.deepEqual(CLUB_KEYS.map(k=>CLUB_LABEL[k]),['Million Dollar Club','Half-Million Club','Six-Figure Club','Under $100,000','None, ever']);
  assert.deepEqual([2.5e6,1e6,999999.99,5e5,499999,1e5,99999,1,0].map(clubOf),['club','club','half','half','six','six','under','under','none']);
  assert.equal(clubOf(null),null,'not read: not placed');
});

test('a member\'s career amount: PAC checks, plus for AIPAC the gifts it passed on in each cycle read; first and last cycles',()=>{
  const h={people:{a:1,b:1,c:1},trackers:{aipac:{a:[10000,1,2024,2026]},oil:{b:[250000,12,1990,2024]}},routed:{aipac:{2022:{a:50000,c:7},2026:{a:3e6}}}};
  assert.deepEqual(careerAmount(h,'aipac','a'),{pac:10000,pacs:1,routed:3050000,total:3060000,first:2022,last:2026});
  assert.deepEqual(careerAmount(h,'oil','b'),{pac:250000,pacs:12,routed:0,total:250000,first:1990,last:2024});
  assert.deepEqual(careerAmount(h,'aipac','c'),{pac:0,pacs:0,routed:7,total:7,first:2022,last:2022},'gifts passed on, no PAC check');
  assert.equal(careerAmount(h,'oil','a').total,0);assert.equal(careerAmount(h,'oil','zz'),null);
  assert.equal(careerAmount(h,'oil','c').routed,0,'passed-on gifts count for AIPAC only');
});

test('one chamber: ranked largest first, ties share a rank, clubs in order, not read left out',()=>{
  const h={people:{a:1,b:1,c:1,d:1,e:1,g:1},trackers:{oil:{a:[1.2e6,30,1990,2026],b:[1.2e6,25,1996,2026],c:[600000,9,2008,2026],g:[150000,4,2018,2026],d:[400,1,2026,2026]}}};
  const m=['a','b','c','d','e','f','g'].map(id=>({id,name:id.toUpperCase()}));
  const T=chamberCareer(h,'oil',m);
  assert.equal(T.read,6);assert.equal(T.took,5);assert.deepEqual(T.notRead.map(x=>x.id),['f']);
  assert.deepEqual(T.rows.map(r=>[r.m.id,r.rank]),[['a',1],['b',1],['c',3],['g',4],['d',5],['e',6]]);
  assert.deepEqual(Object.fromEntries(CLUB_KEYS.map(k=>[k,T.clubs[k].map(r=>r.m.id)])),{club:['a','b'],half:['c'],six:['g'],under:['d'],none:['e']});
  assert.equal(T.byId.g.club,'six');assert.equal(T.byId.f,undefined);
  assert.deepEqual(routedStatus({routedCycles:[2026],routedMissing:[2022,2024]}),{read:[2026],missing:[2022,2024]});
});

test('the builder: every cycle since 1980, each member\'s IDs from congress-legislators, career sums and AIPAC\'s gifts by cycle',()=>{
  assert.equal(CAREER_FROM,1980);assert.equal(AIPAC_FROM,2022);
  const cy=careerCycles(2026);assert.equal(cy.length,24);assert.equal(cy[0],1980);assert.equal(cy.at(-1),2026);
  const people=[{id:'schumer',bioguide:'S000148'},{id:'new',bioguide:'X000001'}];
  const leg=[{id:{bioguide:'S000148',fec:['S8NY00082','H0NY16010','bad']}},{id:{bioguide:'O000001',fec:['H0XX00001']}}];
  assert.deepEqual(legislatorIds(people,leg),{schumer:['S8NY00082','H0NY16010']});
  const byCand=new Map([['S8NY00082','schumer'],['H2KY04121','massie']]);
  const {both,linked}=careerIds(byCand,{massie:['H2KY99999']},{schumer:['S8NY00082','H0NY16010'],other:['H2KY04121']});
  assert.equal(both.get('H0NY16010'),'schumer');assert.equal(both.get('H2KY04121'),'massie','an ID stays with the member it was first given to');
  assert.deepEqual(linked,{massie:['H2KY99999'],schumer:['H0NY16010']});
  const sums=careerSums(both);
  sums.add([{cand:'H0NY16010',cmte:'C1',amount:5000,keys:['wallstreet']},{cand:'H0NY16010',cmte:'C2',amount:2000,keys:['wallstreet','tech']}],1990);
  sums.add([{cand:'S8NY00082',cmte:'C1',amount:10000,keys:['wallstreet']},{cand:'S8NY00082',cmte:'C3',amount:-500,keys:['tech']}],2016);
  sums.add([{cand:'H2KY04121',cmte:'C9',amount:-100,keys:['oil']}],2020);
  const t=sums.totals();
  assert.deepEqual(t.wallstreet.schumer,[17000,2,1990,2016],'his House and Senate races together');
  assert.deepEqual(t.tech.schumer,[1500,1,1990,1990],'a refund comes off; a cycle left at a loss isn\'t his last');
  assert.equal(t.oil.massie,undefined,'a refund alone: none');
  const r=careerRouted({2026:{a:9}},{routed:{aipac:{2022:{a:1},2024:{a:2},2026:{a:3}}}},careerCycles(2026));
  assert.deepEqual(r,{routed:{aipac:{2022:{a:1},2024:{a:2},2026:{a:9}}},routedCycles:[2022,2024,2026],routedMissing:[]},'this run\'s cycle, the last file\'s for the others');
  assert.deepEqual(careerRouted({},null,careerCycles(2026)).routedMissing,[2022,2024,2026]);
});

test('the real file: every cycle since 1980, every sitting member ranked once in each chamber, long careers from their House years',()=>{
  const h=read('../public/tracker-history.json'),cp=read('../public/corporate-pacs.json');
  const S=read('../public/senate.json').senators,H=read('../public/house.json').members.filter(x=>!x.delegate);
  assert.deepEqual(h.cycles,careerCycles(cp.cycle));assert.equal(h.from,'1979-01-01');
  assert.deepEqual(Object.keys(h.trackers).sort(),Object.keys(cp.trackers).sort());
  for(const list of Object.values(h.trackers))for(const v of Object.values(list)){assert.equal(v.length,4);assert.ok(v[0]>0&&v[2]>=CAREER_FROM&&v[3]>=v[2]&&v[3]<=cp.cycle);}
  for(const key of Object.keys(h.trackers))for(const list of [S,H]){
    const T=chamberCareer(h,key,list),placed=CLUB_KEYS.flatMap(k=>T.clubs[k]);
    assert.equal(placed.length,T.read,key);assert.equal(new Set(placed.map(r=>r.m.id)).size,placed.length,key);
    assert.equal(T.read+T.notRead.length,list.length,key);
  }
  // A career is at least this cycle's PAC checks for nearly everyone (a refund of an earlier gift can make it less).
  let n=0,lower=0;
  for(const [key,list] of Object.entries(cp.trackers))for(const [id,v] of Object.entries(list)){const a=careerAmount(h,key,id);if(!a)continue;n++;if(a.pac+1<v[0])lower++;}
  assert.ok(n>1000&&lower/n<0.02,`${lower} of ${n} lower`);
  const ws=careerAmount(h,'wallstreet','schumer');assert.ok(ws.first<=1982,'Schumer\'s House races count');
  assert.ok(chamberCareer(h,'defense',H).clubs.club.length>0,'some House members are in Big Defense\'s Million Dollar Club');
  assert.ok(Object.keys(h.linked).length>40,'other candidate IDs linked');
  assert.ok(Array.isArray(h.routedCycles)&&Array.isArray(h.routedMissing));
  assert.deepEqual([...h.routedCycles,...h.routedMissing].sort(),careerCycles(cp.cycle).filter(c=>c>=AIPAC_FROM));
});
