import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moneyMap,mapSVG,moneyMapBlock,LAYOUT,short$,share} from '../public/money-map.js';

const research=JSON.parse(fs.readFileSync(new URL('../public/research.json',import.meta.url),'utf8'));
const people=[...research.members,...research.cands];
const opts=s=>({bundled:research.bundled?.people?.[s.id],groups:{...Object.fromEntries((research.groupPos||[]).map(g=>[g.key,g.org])),...(research.bundled?.names||{})},categories:research.categories||{}});

test('every profile\'s map: the kinds of receipts add up to what was raised, and the drawing is complete',()=>{
  let drawn=0;
  for(const s of people){
    const m=moneyMap(s,opts(s));if(!m)continue;drawn++;
    const sum=m.ins.reduce((a,n)=>a+n.a,0)+m.unsorted;
    assert.ok(Math.abs(sum-m.receipts)<1,`${s.id}: parts ${sum} vs raised ${m.receipts}`);
    const svg=mapSVG(m);
    assert.doesNotMatch(svg,/NaN|undefined|Infinity/,s.id);
    // One circle for each kind of money in and out, the campaign, and each outside side.
    assert.equal((svg.match(/<circle /g)||[]).length,m.ins.length+m.outs.length+1+m.side.length,s.id);
    for(const n of m.ins)assert.ok(svg.includes(`>${n.label}<`),`${s.id}: ${n.label}`);
  }
  assert.ok(drawn>=50,`${drawn} maps drawn`);
});

test('Ossoff: the example map',()=>{
  const s=people.find(p=>p.id==='ossoff'),m=moneyMap(s,opts(s));
  assert.deepEqual(m.ins.map(n=>[n.label,short$(n.a),share(n.a,m.receipts)]),[['Small donors','$55.3M','48%'],['Larger donors','$46.9M','40%'],['Joint fundraising','$11.6M','10%'],['PACs','$1.1M','<1%'],['Party committees','$11K','<1%'],['Other receipts','$954K','<1%']]);
  assert.deepEqual(m.outs.map(n=>[n.label,short$(n.a)]),[['Spent so far','$105.8M'],['Cash on hand','$15.1M']]);
  assert.deepEqual(m.side.map(n=>[n.label,short$(n.a)]),[['Outside groups for them','$6.0M'],['Outside groups against them','$11.7M']]);
  // J Street first (the largest); any other group the FEC shows forwarding gifts to the campaign is listed by its name.
  assert.deepEqual([m.bundled[0].who,m.bundled[0].routed],['J Street',309639.01]);
  for(const b of m.bundled){assert.ok(b.routed>0);assert.ok(!/^fec:/.test(b.who),`${b.who} is named`);}
  assert.equal(m.pacKinds[0].label,research.categories.lead);
  const html=moneyMapBlock(s,opts(s));
  assert.match(html,/id="f-map"/);assert.match(html,/\$115,904,486/);assert.match(html,/Bundled through groups/);assert.match(html,/Not on the map yet/);
});

test('circle area and line width are to scale; tiny amounts get the smallest size',()=>{
  const m={cmte:'Test for Senate',cmteId:'C1',receipts:1_000_000,ins:[{k:'small',label:'Small donors',color:'--s1',a:900_000},{k:'pac',label:'PACs',color:'--s2',a:100_000}],
    outs:[{k:'spent',label:'Spent so far',color:'--s3',a:400_000}],side:[],unsorted:0};
  const r=[...mapSVG(m).matchAll(/<circle cx="[\d.]+" cy="[\d.]+" r="([\d.]+)"/g)].map(x=>Number(x[1]));
  // Small donors (the largest amount) at the full size; PACs at a third of its radius (a ninth of its area).
  assert.equal(r[0],LAYOUT.RMAX);assert.ok(Math.abs(r[1]-LAYOUT.RMAX/3)<0.2);
  assert.equal(r[2],Math.round(LAYOUT.RMAX*Math.sqrt(4/9)*10)/10);
  const tiny=mapSVG({...m,ins:[...m.ins,{k:'party',label:'Party committees',color:'--cx-other',a:5}]});
  assert.ok(tiny.includes(`r="${LAYOUT.RMIN}"`));
  // No outside spending, no outside band.
  assert.doesNotMatch(mapSVG(m),/OUTSIDE SPENDING/);
});

test('no map without an FEC report, and text from the records is escaped',()=>{
  assert.equal(moneyMap({camp:{missing:true,receipts:0}}),null);
  assert.equal(moneyMap({}),null);
  assert.equal(moneyMapBlock({camp:{missing:true}}),'');
  const html=moneyMapBlock({camp:{receipts:100,unitemized:100,cmte:'<b>Friends</b> & Co',cmteId:'C9',start:'2025-01-01',end:'2026-06-30',disbursements:50,cash:50}});
  assert.match(html,/&lt;b&gt;Friends&lt;\/b&gt; &amp; Co/);assert.doesNotMatch(html,/<b>Friends/);
});

test('each PAC kind opens to its PACs, and the corporate card lists the PACs the FEC records as corporate',async()=>{
  const {pacTypeOf}=await import('../public/pac-types.js');
  const s=people.find(p=>p.id==='perry'),o={...opts(s),pacNames:research.pacNames,pacType:i=>pacTypeOf(research,i)};
  const m=moneyMap(s,o);
  for(const k of m.pacKinds){const sum=k.pacs.reduce((t,p)=>t+p.a,0);assert.ok(Math.abs(sum-k.a)<1,`${k.k}: ${sum} vs ${k.a}`);}
  assert.ok(m.corporate.length>0);
  assert.ok(m.corporate.every((p,i,a)=>!i||a[i-1].a>=p.a),'largest first');
  const html=moneyMapBlock(s,o);
  assert.match(html,/<details class="mm-kind">/);assert.match(html,/Corporate PAC donors/);assert.match(html,/from \d+ corporate PACs?/);
});
