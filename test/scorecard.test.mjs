import test from 'node:test';
import assert from 'node:assert/strict';
import {renderScorecardSvg} from '../public/scorecard.js';

const model={id:'booker',name:'Cory Booker',party:'D',office:'U.S. Senate',state:'New Jersey',raised:18869341.39,cash:23060940.12,period:'Jan 2025–Jun 2026',reviewedAt:'Oct 2, 2026',matchConfigured:false,grades:[{label:'Keeps Their Word',value:null},{label:'Shows Up',value:67,detail:'From roll calls'},{label:'Big Money Independence',value:null},{label:'Plays by the Rules',value:null},{label:'People First',value:100}]};

test('portable scorecard uses real supplied scores, party colors and missing-data states',()=>{
  const dem=renderScorecardSvg(model),rep=renderScorecardSvg({...model,party:'R',raised:null,cash:null});
  assert.match(dem,/#70acff/);assert.match(rep,/#ff969c/);
  assert.match(dem,/67 \/ 100/);assert.match(dem,/Keeps Their Word: Not graded yet/);assert.match(dem,/\$18\.87M/);assert.match(dem,/Jan 2025–Jun 2026/);
  assert.match(rep,/Not available/);assert.doesNotMatch(rep,/\$0/);
  assert.match(renderScorecardSvg({...model,matchConfigured:true}),/Not graded/);
});

test('download embeds raster portraits only and escapes model text',()=>{
  const dangerous={...model,name:'<script>alert("x")</script>',state:'A & B'};
  const svg=renderScorecardSvg(dangerous,'javascript:alert(1)');
  assert.doesNotMatch(svg,/<script|javascript:|foreignObject/);
  assert.match(svg,/&lt;script&gt;/);assert.match(svg,/A &amp; B/);
  assert.doesNotMatch(renderScorecardSvg(model,'https://example.com/photo.jpg'),/<image/);
  assert.doesNotMatch(renderScorecardSvg(model,'data:image/svg+xml;base64,PHN2Zz4='),/<image/);
  assert.match(renderScorecardSvg(model,'data:image/png;base64,aGVsbG8='),/<image href="data:image\/png;base64,aGVsbG8="/);
});

test('party outlines do not replace the semantic grade palette or neutral missing values',()=>{
  for(const party of ['D','R']){
    const svg=renderScorecardSvg({...model,party,grades:[{value:95},{value:85},{value:75}]})+renderScorecardSvg({...model,party,grades:[{value:65},{value:null},{value:null}]});
    for(const [grade,color] of [['A','#28d17c'],['B','#a4d65b'],['C','#f0c35a'],['D','#f0b84b']]){
      assert.match(svg,new RegExp(`fill="${color}"[^>]*font-size="66"[^>]*><tspan[^>]*>${grade}</tspan>`));
    }
    const missing=renderScorecardSvg({...model,party,matchConfigured:true,grades:[{value:null},{value:null},{value:50}]});
    assert.match(missing,/fill="#a7b0be"[^>]*font-size="21"/);
    assert.match(missing,/fill="#f17881"[^>]*font-size="66"[^>]*><tspan[^>]*>F<\/tspan>/);
  }
});

test('the image has exactly the five grades, each once, side by side',()=>{
  const svg=renderScorecardSvg({...model,grades:[{label:'Keeps Their Word',value:null},{label:'Shows Up',value:null},{label:'Big Money Independence',value:null},{label:'Plays by the Rules',value:null},{label:'People First',value:100}]});
  const labels=[...svg.matchAll(/font-weight="700"[^>]*><tspan[^>]*>(KEEPS THEIR WORD|SHOWS UP|BIG MONEY|PLAYS BY THE|PEOPLE FIRST)<\/tspan>/g)].map(m=>m[1]);
  assert.deepEqual(labels,['KEEPS THEIR WORD','SHOWS UP','BIG MONEY','PLAYS BY THE','PEOPLE FIRST']);
  assert.match(svg,/>PLAYS BY THE<\/tspan><tspan[^>]*>RULES<\/tspan>/);
  assert.match(svg,/>BIG MONEY<\/tspan><tspan[^>]*>INDEPENDENCE<\/tspan>/,'the long name on two lines in its tile');
  assert.match(svg,/FIVE GRADES/);assert.doesNotMatch(svg,/FOUR MEASURES|Promises delivered|Ethics/);
  const tiles=[...svg.matchAll(/<rect x="(\d+)" y="\d+" width="(\d+)" height="330"/g)].map(m=>[+m[1],+m[2]]);
  assert.equal(tiles.length,5);assert.ok(Math.abs(tiles[4][0]+tiles[4][1]-960)<=2,'the last tile ends at the card\'s right edge');
});

test('the money box: raised, cash on hand and spent, then net worth, stocks held and stock trades; a long name makes it taller',()=>{
  const wealth={items:[{label:'Net worth',value:'$1.15M–$5.35M'},{label:'Stocks held',value:'~$250K'},{label:'Stock trades',value:'Not read yet',wait:true}],note:'2025 annual report · 2 stocks or options'};
  const svg=renderScorecardSvg({...model,spent:12500000,wealth});
  for(const t of ['CAMPAIGN SNAPSHOT','Spent','\\$12\\.50M','NET WORTH AND STOCKS','Net worth','\\$1\\.15M–\\$5\\.35M','~\\$250K','2025 annual report · 2 stocks or options'])assert.match(svg,new RegExp(`>${t}<`));
  assert.match(svg,/fill="#a7b0be"[^>]*><tspan[^>]*>Not read yet</,'a number not read yet is grey');
  assert.match(svg,/<desc[^>]*>Raised \$18\.87M, cash on hand \$23\.06M, spent \$12\.50M\. Net worth \$1\.15M–\$5\.35M, Stocks held ~\$250K, Stock trades Not read yet\./);
  const box=x=>Number(x.match(/<rect x="40" y="146" width="920" height="(\d+)"/)[1]);
  const long=renderScorecardSvg({...model,name:'Catherine Cortez Masto Long Name',wealth});
  assert.ok(box(long)>box(svg),'a name on two lines moves the numbers down and the box grows');
  assert.ok(Number(long.match(/height="(\d+)"/)[1])>Number(svg.match(/height="(\d+)"/)[1]),'and the card with it');
  // A president has no disclosures here: no net worth row, and the box keeps its size.
  const none=renderScorecardSvg(model);assert.doesNotMatch(none,/NET WORTH AND STOCKS/);assert.equal(box(none),498);
});

test('bonuses and pledges and bills side by side, each item marked with why, and no points',()=>{
  const lists=[{title:'Bonuses',items:[{label:'No corporate PAC money',status:'no',why:'about $6,126 from corporate PACs',points:0},{label:'Pledged not to take corporate PAC money',status:'yes',why:'signed the pledge',points:1},{label:'Holds no individual stocks',status:'waiting',why:'their annual disclosure isn\'t read yet',points:0}]},
    {title:'Pledges and bills',items:[],empty:'No pledges or bills on file'}];
  const svg=renderScorecardSvg({...model,lists});
  assert.match(svg,/>BONUSES</);assert.match(svg,/>PLEDGES AND BILLS</);assert.match(svg,/>No pledges or bills on file</);
  assert.match(svg,/fill="#28d17c"[^>]*><tspan[^>]*>✓</);assert.match(svg,/fill="#8b95a5"[^>]*><tspan[^>]*>✕</);assert.match(svg,/fill="#f0c35a"[^>]*><tspan[^>]*>…</);
  assert.match(svg,/font-weight="700"[^>]*><tspan[^>]*>Pledged not to take corporate PAC money</,'an earned one in bold');
  assert.match(svg,/>about \$6,126 from corporate PACs</);assert.doesNotMatch(svg,/>\+1</,'no points shown');
  const tiles=[...svg.matchAll(/<rect x="(\d+(?:\.\d+)?)" y="(\d+)" width="452"/g)].map(m=>[+m[1],+m[2]]);
  assert.deepEqual(tiles.map(t=>t[0]),[40,508]);assert.equal(tiles[0][1],tiles[1][1],'side by side');
  const grades=Number(svg.match(/<rect x="40" y="(\d+)" width="174" height="330"/)[1]);assert.ok(grades>tiles[0][1],'below them, the five grades');
  const evil=renderScorecardSvg({...model,lists:[{title:'<b>x</b>',items:[{label:'<script>',status:'yes',why:'A & B'}]}]});
  assert.doesNotMatch(evil,/<script|<b>/);assert.match(evil,/A &amp; B/);
});
