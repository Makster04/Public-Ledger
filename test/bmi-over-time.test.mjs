// Big Money Independence over time (Nov. 27, 2026): a point a two-year cycle under the score card, each cycle scored on
// its own as the Period menu's "only" choices score it; and "How to read this" in Tracking Lobby Money opens and closes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.document??={querySelector:()=>null};
const {drawScoreCycles,gradeFill}=await import('../public/charts.js');

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const plot=(w=600)=>({clientWidth:w,innerHTML:'',querySelectorAll:()=>[]});
const count=(html,re)=>(html.match(re)||[]).length;
const PTS=[{cycle:2016,pct:null,why:'not read'},{cycle:2018,pct:71.4,grade:'C'},{cycle:2020,pct:64,grade:'D'},{cycle:2022,pct:79.3,grade:'C'},{cycle:2024,pct:83.6,grade:'B'},{cycle:2026,pct:88.1,grade:'B'}];

test('a dot a graded cycle in its grade\'s color, an empty ring for one not graded, the latest labeled',()=>{
  const el=plot();drawScoreCycles(el,PTS,{selected:[2026],name:'Big Money Independence'});const h=el.innerHTML;
  assert.equal(count(h,/class="sc-dot"/g),5);assert.equal(count(h,/class="sc-none"/g),1);
  assert.ok(h.includes(`fill:${gradeFill('B')}`)&&h.includes(`fill:${gradeFill('D')}`));
  assert.deepEqual([gradeFill('A'),gradeFill('C'),gradeFill('D'),gradeFill('F'),gradeFill(null)],['var(--good)','var(--warn)','var(--warn)','var(--crit)','var(--muted)']);
  assert.equal(count(h,/class="cx-lab"[^>]*>[\d.]+%</g),1,'only the latest is labeled');assert.match(h,/>88\.1%</);
  assert.match(h,/data-tip="2015–2016: not graded yet \(not read\) · Show this cycle"/);
  assert.match(h,/aria-label="2023–2024: Big Money Independence 83\.6% · Grade B\. Show this cycle"/);
  assert.equal(count(h,/data-cycle="\d{4}"/g),6,'every cycle can be picked');
  assert.equal(count(h,/class="cx-sel"/g),1,'the period picked');
  assert.match(h,/role="img" aria-label="Big Money Independence by two-year cycle, 2015 to 2026"/);
});

test('the line breaks where a cycle has no score; a period over several cycles shades each; a lone cycle picked is labeled',()=>{
  const gap=[...PTS.slice(1,3),{cycle:2022,pct:null},...PTS.slice(4)],el=plot();
  drawScoreCycles(el,gap,{selected:[2020,2022,2024,2026]});
  assert.equal(count(el.innerHTML,/<polyline/g),2);assert.equal(count(el.innerHTML,/class="cx-sel"/g),4);
  const one=plot();drawScoreCycles(one,PTS,{selected:[2020]});assert.match(one.innerHTML,/>64\.0%</);assert.match(one.innerHTML,/>88\.1%</);
  // provisional: an open ring in its grade's color, no grade in the tip
  const pv=plot();drawScoreCycles(pv,[{cycle:2024,pct:70,grade:'C',provisional:true},{cycle:2026,pct:80,grade:'B'}]);
  assert.match(pv.innerHTML,/class="sc-dot sc-prov"[^>]*style="stroke:var\(--warn\)"/);assert.match(pv.innerHTML,/70\.0%, provisional, no grade/);
  const empty=plot();drawScoreCycles(empty,[]);assert.equal(empty.innerHTML,'');
});

test('the tab: each cycle scored on its own, under the score card, and picking a cycle picks it in the Period menu',()=>{
  assert.match(app,/unboughtFor\(s,inputs,d,cy===current\?'this':`cycle:\$\{cy\}`\)/,'the same score the Period menu gives');
  assert.ok(app.includes("under:s.office?'':unboughtTrendHTML(s,live,trend,period)"));
  assert.ok(app.includes('<div class="st-maincol">${stCard(key,res,breakdown)}${under}</div>'));
  assert.ok(app.includes("drawScoreCycles(el,trend,{selected:periodCycles(period,cur,trend.map(p=>p.cycle)),name:'Big Money Independence'})"));
  assert.ok(app.includes("sel.value=v;sel.dispatchEvent(new Event('change'))"));
  assert.ok(app.includes("Earlier cycles appear here once the FEC refresh has read them."));
  assert.ok(app.includes("Stocks held are from the latest annual report in every cycle."));
});

test('"How to read this" opens and closes, and stays open when the box is drawn again',()=>{
  assert.ok(app.includes('<details class="lk-key" data-keep="key"><summary><h4>How to read this</h4></summary>'));
  assert.ok(!app.includes('<div class="lk-key">'));
  // (and "Cause groups", since Nov. 28, 2026): every details[data-keep] open before is open again
  assert.equal(count(app,/reopenKept\((nb|el),open\)/g),2,'when its box or the score card is redrawn');
  assert.ok(app.includes("const reopenKept=(el,keys)=>{for(const k of keys)el.querySelector(`details[data-keep=\"${k}\"]`)?.setAttribute('open','');};"));
});
