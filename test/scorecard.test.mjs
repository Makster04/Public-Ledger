import test from 'node:test';
import assert from 'node:assert/strict';
import {renderScorecardSvg} from '../public/scorecard.js';

const model={id:'booker',name:'Cory Booker',party:'D',office:'U.S. Senate',state:'New Jersey',raised:18869341.39,cash:23060940.12,period:'Jan 2025–Jun 2026',reviewedAt:'Oct 2, 2026',matchConfigured:false,grades:[{label:'Keeps Their Word',value:null},{label:'Shows Up',value:67,detail:'From roll calls'},{label:'Big Money Independence',value:null},{label:'Plays by the Rules',value:null},{label:'People First',value:100}]};
const tag=(t,attrs='')=>new RegExp(`${attrs}[^>]*><tspan[^>]*>${t}</tspan>`);

test('the card is on the party\'s color, 4:5, and shows the supplied grades and missing data as missing',()=>{
  const dem=renderScorecardSvg(model),rep=renderScorecardSvg({...model,party:'R',raised:null,cash:null}),ind=renderScorecardSvg({...model,party:'I'});
  assert.match(dem,/<rect width="1000" height="1250" fill="#70acff"\/>/);assert.match(rep,/fill="#ff969c"\/>/);assert.match(ind,/fill="#bbc2cc"\/>/);
  assert.match(dem,/width="1000" height="1250" viewBox="0 0 1000 1250"/);
  assert.match(dem,tag('67'));assert.match(dem,/Keeps Their Word: Not graded yet/);assert.match(dem,tag('\\$18\\.87M'));assert.match(dem,/Jan 2025–Jun 2026/);
  assert.match(rep,tag('Not available'));assert.doesNotMatch(rep,/\$0/);
  assert.match(dem,tag('CORY BOOKER'));assert.match(dem,tag('NEW JERSEY · DEMOCRAT · U.S. SENATE'));
});

test('download embeds raster portraits only and escapes model text',()=>{
  const dangerous={...model,name:'<script>alert("x")</script>',state:'A & B'};
  const svg=renderScorecardSvg(dangerous,'javascript:alert(1)');
  assert.doesNotMatch(svg,/<script|javascript:|foreignObject/);
  assert.match(svg,/&lt;SCRIPT&gt;/);assert.match(svg,/A &amp; B/);
  assert.doesNotMatch(renderScorecardSvg(model,'https://example.com/photo.jpg'),/<image/);
  assert.doesNotMatch(renderScorecardSvg(model,'data:image/svg+xml;base64,PHN2Zz4='),/<image/);
  assert.match(renderScorecardSvg(model,'data:image/png;base64,aGVsbG8='),/<image href="data:image\/png;base64,aGVsbG8="/);
});

test('the five grades, each once in order, with a bar as long as the score and the grade\'s color',()=>{
  const svg=renderScorecardSvg({...model,grades:[{value:95},{value:85},{value:75},{value:65},{value:16}]});
  const labels=[...svg.matchAll(/><tspan[^>]*>(KEEPS THEIR WORD|SHOWS UP|BIG MONEY INDEPENDENCE|PLAYS BY THE RULES|PEOPLE FIRST)<\/tspan>/g)].map(m=>m[1]);
  assert.deepEqual(labels,['KEEPS THEIR WORD','SHOWS UP','BIG MONEY INDEPENDENCE','PLAYS BY THE RULES','PEOPLE FIRST']);
  assert.match(svg,tag('FIVE GRADES'));assert.doesNotMatch(svg,/FOUR MEASURES|Promises delivered|Ethics/);
  for(const [grade,color,score] of [['A','#138a50',95],['B','#5f8f1e',85],['C','#a87708',75],['D','#bd6416',65],['F','#cc3d4a',16]]){
    assert.match(svg,new RegExp(`fill="${color}"[^>]*font-size="30"[^>]*><tspan[^>]*>${grade}</tspan>`));
    assert.match(svg,new RegExp(`width="${Math.round(190*score/100)}" height="14" rx="3" fill="${color}"`));
  }
  const missing=renderScorecardSvg({...model,grades:[{value:null},{value:null},{value:50}]});
  assert.equal((missing.match(/>NOT GRADED</g)||[]).length,4,'a grade not worked out has no bar, letter or number');
});

const wealth={items:[{label:'Net worth',value:'$1.15M–$5.35M',sub:'2025 annual report'},{label:'Stocks held',value:'~$250K',sub:'2 stocks or options'},{label:'Stock trades',value:'Not read yet',wait:true,sub:'trade reports not read yet'}]};
const lists=[{title:'Bonuses',items:[{label:'No corporate PAC money',status:'no',why:'about $6,126 from corporate PACs',points:0},{label:'Pledged not to take corporate PAC money',status:'yes',why:'signed the pledge',points:1},{label:'Holds no individual stocks',status:'waiting',why:'not read yet',points:0}]},
  {title:'Pledges and bills',items:[],empty:'No pledges or bills on file'}];

test('six money boxes: raised, cash on hand and spent, then net worth, stocks held and stock trades, each with its note',()=>{
  const svg=renderScorecardSvg({...model,period:'Jan 1, 2025 – Jun 30, 2026',spent:12500000,wealth,lists});
  for(const t of ['RAISED','CASH ON HAND','SPENT','NET WORTH','STOCKS HELD','STOCK TRADES','\\$12\\.50M','\\$1\\.15M–','\\$5\\.35M','~\\$250K','2025 annual report','2 stocks or options','Jan 2025 – Jun 2026','as of Jun 30, 2026'])assert.match(svg,tag(t));
  assert.match(svg,tag('Not read yet','fill="#b9b3a6"'),'a number not read yet is gray');
  assert.match(svg,/<desc[^>]*>Raised \$18\.87M, cash on hand \$23\.06M, spent \$12\.50M\. Net worth \$1\.15M–\$5\.35M, Stocks held ~\$250K, Stock trades Not read yet\./);
  const boxes=[...svg.matchAll(/<rect x="([\d.]+)" y="(622|824)" width="([\d.]+)" height="186"/g)];
  assert.equal(boxes.length,6);assert.ok(boxes.every(b=>+b[1]>=416),'beside the checklist');
  // A president (no disclosures here): three boxes. A basic profile (no checklist): the boxes take the whole width.
  assert.equal([...renderScorecardSvg({...model,lists}).matchAll(/height="186"/g)].length,3);
  const basic=renderScorecardSvg({...model,wealth});assert.match(basic,/<rect x="28" y="622" width="[\d.]+" height="186"/);assert.doesNotMatch(basic,/BONUSES/);
});

test('bonuses and pledges and bills as a checklist: a mark for each, no points, no reasons',()=>{
  const svg=renderScorecardSvg({...model,wealth,lists});
  assert.match(svg,tag('BONUSES'));assert.match(svg,tag('PLEDGES AND BILLS'));assert.match(svg,tag('No pledges or bills on file'));
  assert.match(svg,/<circle[^>]*fill="#18a35f"\/><path d="M-5 0/,'✓ earned');assert.match(svg,/<circle[^>]*fill="#e0535f"\/><path d="M-4-4/,'✕ not earned');assert.match(svg,/<circle[^>]*fill="#8b95a5"\/>/,'? not read yet');
  assert.match(svg,tag('PLEDGED NOT TO TAKE CORPORATE','font-weight="700"'),'an earned one in bold');
  assert.doesNotMatch(svg,/>\+1</);assert.doesNotMatch(svg,/about \$6,126/);
  const evil=renderScorecardSvg({...model,lists:[{title:'<b>x</b>',items:[{label:'<script>',status:'yes'}]}]});
  assert.doesNotMatch(evil,/<script|<b>/);
});

test('a long name gets smaller, then two lines, inside its box; a card with more never runs off the bottom',()=>{
  const width=svg=>Math.max(...[...svg.matchAll(/font-size="(\d+)"[^>]*>((?:<tspan[^>]*>[^<]*<\/tspan>)+)/g)].filter(m=>/CATHERINE|JON OSSOFF/.test(m[2])).flatMap(m=>[...m[2].matchAll(/>([^<]*)</g)].map(x=>x[1].length*+m[1]*.68)));
  const short=renderScorecardSvg({...model,name:'Jon Ossoff'}),long=renderScorecardSvg({...model,name:'Catherine Cortez Masto'});
  assert.match(short,/font-size="46"[^>]*><tspan[^>]*>JON OSSOFF</);assert.match(long,/font-size="38"/);
  assert.match(long,/>CATHERINE CORTEZ<\/tspan><tspan[^>]*>MASTO</);assert.ok(width(long)<=508,'fits the 556-wide box with its margins');
  const tall=renderScorecardSvg({...model,wealth,lists:[{title:'Bonuses',items:Array.from({length:6},(_,i)=>({label:'A long item that takes two lines here '+i,status:'no'}))},lists[0]]});
  const h=+tall.match(/height="(\d+)"/)[1];assert.ok(h>1250,'the card grows');assert.match(tall,new RegExp(`<rect x="0" y="${h-54}" width="1000" height="54"`));
  const unreviewed=renderScorecardSvg({...model,reviewedAt:'Research not reviewed'});
  assert.match(unreviewed,/>Research not reviewed yet\. Based on/);assert.doesNotMatch(unreviewed,/Research snapshot: Research/);
});
