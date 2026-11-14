import test from 'node:test';
import assert from 'node:assert/strict';
import {renderScorecardSvg,fundingParts} from '../public/scorecard.js';

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
  const boxes=[...svg.matchAll(/<rect x="([\d.]+)" y="(568|739)" width="([\d.]+)" height="155"/g)];
  assert.equal(boxes.length,6);assert.ok(boxes.every(b=>+b[1]>=416),'beside the checklist');
  // A president (no disclosures here): three boxes. A basic profile (no checklist): the boxes take the whole width.
  assert.equal([...renderScorecardSvg({...model,lists}).matchAll(/height="155"/g)].length,3);
  const basic=renderScorecardSvg({...model,wealth});assert.match(basic,/<rect x="28" y="568" width="[\d.]+" height="155"/);assert.doesNotMatch(basic,/BONUSES/);
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

const camp={receipts:22465217.83,indiv:15299978.61,pac:1593453.75,transfers:5371811.34,party:62000,candidate:0,self:0,other:137974.13};
const sizes={brackets:[{total:4000000},{total:1000000},{total:1500000},{total:3000000},{total:5500000}],notSorted:299978.61};

test('the funding overview\'s parts: each source\'s share, the rest as other, and the individuals\' money by gift size',()=>{
  const f=fundingParts(camp,sizes);
  assert.equal(f.total,22465217.83);
  assert.deepEqual(f.parts.map(p=>[p.key,Math.round(p.share*1000)/10]),[['indiv',68.1],['pac',7.1],['transfers',23.9],['party',0.3],['self',0],['other',0.6]]);
  assert.deepEqual(f.sizes.map(z=>z.label),['$200 & under','$200–499','$500–999','$1K–1,999','$2K+','not sorted yet']);
  assert.ok(Math.abs(f.sizes.reduce((t,z)=>t+z.share,0)-1)<1e-9);
  assert.equal(fundingParts(camp).sizes,null,'gift sizes not read yet');
  assert.equal(fundingParts({receipts:5000000,cash:100}),null,'a total without its split by source (a basic profile) shows nothing');
  assert.equal(fundingParts(null),null);assert.equal(fundingParts({receipts:0,indiv:0}),null);
});

const trackers=[{key:'aipac',name:'AIPAC',status:'took',total:3358020,superPac:{for:0,against:1250000}},{key:'pharma',name:'Big Pharma',status:'took',total:9500,superPac:null},
  {key:'oil',name:'Big Oil',status:'none',total:0,superPac:null},{key:'tech',name:'Big Tech + AI',status:'took',total:12500,superPac:{for:400000,against:0}},{key:'crypto',name:'Crypto',status:'waiting',total:0,superPac:null}];

test('the funding overview on the card: the shares, a donut, the total, and the trackers, and the card stays 4:5',()=>{
  const svg=renderScorecardSvg({...model,receipts:undefined,raised:camp.receipts,period:'Jan 1, 2025 – Oct 14, 2026',spent:22351644,wealth,lists,funding:fundingParts(camp,sizes),trackers});
  assert.match(svg,/width="1000" height="1250"/);
  for(const t of ['FUNDING OVERVIEW','68% INDIVIDUALS','7% PACS','24% TRANSFERS','&lt;1% PARTY','0% SELF-FUNDING','1% OTHER','\\$200 &amp; under 26%','\\$2K\\+ 36%','\\$22\\.47M','RAISED'])assert.match(svg,tag(t));
  assert.match(svg,tag('WHERE THE \\$22\\.47M CAME FROM · Jan 2025 – Oct 2026 · FEC'));
  assert.equal([...svg.matchAll(/<path d="M[^"]+A[^"]+Z" fill="#[0-9a-f]{6}" stroke="#121519" stroke-width="2"/g)].length,10,'a ring piece for each gift size and each other source with money');
  // The trackers: ✕ took some, ✓ none, ? not read yet; super PAC spending under them; no evidence box, its words in the strip.
  for(const t of ['MAJOR LOOKOUTS · PAC CHECKS AND GIFTS ROUTED THROUGH EACH, THIS CYCLE','AIPAC','\\$3\\.36M','\\$9,500','\\$0','\\$12,500','NOT READ YET','SUPER PAC: \\$1\\.25M AGAINST','SUPER PAC: \\$400,000 FOR'])assert.match(svg,tag(t));
  assert.match(svg,tag('\\$3\\.36M','fill="#ff8a8a"'));assert.match(svg,tag('\\$0','fill="#5fe39a"'));
  assert.doesNotMatch(svg,/SEE THE EVIDENCE/);assert.match(svg,tag('PUBLIC LEDGER · RESEARCH SNAPSHOT: OCT 2, 2026'));assert.match(svg,tag('A GRADE IS NOT A CLEARANCE\\. MISSING DATA IS NOT ZERO\\.'));
  const noSizes=renderScorecardSvg({...model,funding:fundingParts(camp),trackers});assert.match(noSizes,tag('GIFT SIZES NOT READ YET'));
  assert.equal([...noSizes.matchAll(/stroke="#121519" stroke-width="2" fill-rule/g)].length,5,'individuals in one piece');
  // Without a campaign total (or its split), the evidence box as before.
  const none=renderScorecardSvg({...model,trackers});assert.match(none,tag('SEE THE EVIDENCE, NOT JUST THE LETTER\\.'));assert.doesNotMatch(none,/FUNDING OVERVIEW|MAJOR LOOKOUTS/);
});

test('the card\'s emojis: each tracker\'s as its icon with the mark as a badge, and the reform pledges\' issue emojis; still 4:5',()=>{
  const seven=['aipac','pharma','oil','tech','crypto','defense','wallstreet'].map((key,i)=>({key,name:key,card:key==='pharma'?'Pharma + Ins.':null,emoji:['🇮🇱','💊','🛢️','🤖','🤑','🪖','💰'][i],status:i===4?'none':i===6?'waiting':'took',total:i===4?0:1000*(i+1),superPac:null}));
  const pledged=[{title:'Bonuses',items:[{label:'No corporate PAC money',status:'no'}]},{title:'Pledges and bills',items:[{label:'Ban lobbying by former members',status:'no',emoji:'🏛️'},{label:'Ban congressional stock trading',status:'yes',emoji:'🇺🇸'},{label:'Overturn Citizens United',status:'no',emoji:'🗳️'}]}];
  const svg=renderScorecardSvg({...model,raised:camp.receipts,funding:fundingParts(camp,sizes),trackers:seven,lists:pledged});
  assert.match(svg,/width="1000" height="1250"/);
  for(const e of ['🇮🇱','💊','🛢️','🤖','🤑','🪖','💰'])assert.match(svg,new RegExp(`>${e}</tspan>`),e);
  assert.equal([...svg.matchAll(/<circle [^>]*r="6"[^>]*stroke="#121519"/g)].length,7,'a small badge on each tracker\'s emoji');
  for(const t of ['🏛️ BAN LOBBYING BY FORMER MEMBERS','🗳️ OVERTURN CITIZENS UNITED'])assert.match(svg,new RegExp(`>${t}</tspan>`),t+' on one line');
  assert.match(svg,tag('PHARMA \\+ INS\\.'));
  // Without an emoji, the mark alone, as before.
  assert.doesNotMatch(renderScorecardSvg({...model,raised:camp.receipts,funding:fundingParts(camp,sizes),trackers}),/r="6"[^>]*stroke="#121519"/);
});
