import test from 'node:test';
import assert from 'node:assert/strict';
import {renderScorecardSvg} from '../public/scorecard.js';

const model={id:'booker',name:'Cory Booker',party:'D',office:'U.S. Senate',state:'New Jersey',raised:18869341.39,cash:23060940.12,period:'Jan 2025–Jun 2026',reviewedAt:'Oct 2, 2026',matchConfigured:false,grades:[{label:'Your match',value:null},{label:'Promises delivered',value:67,detail:'3 counted checks'},{label:'Ethics',value:100},{label:'Workers > Profit',value:100}]};

test('portable scorecard uses real supplied scores, party colors and missing-data states',()=>{
  const dem=renderScorecardSvg(model),rep=renderScorecardSvg({...model,party:'R',raised:null,cash:null});
  assert.match(dem,/#70acff/);assert.match(rep,/#ff969c/);
  assert.match(dem,/67 \/ 100/);assert.match(dem,/Your match: Set priorities/);assert.match(dem,/\$18\.87M/);assert.match(dem,/Jan 2025–Jun 2026/);
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
    const svg=renderScorecardSvg({...model,party,grades:[{value:95},{value:85},{value:75},{value:65}]});
    for(const [grade,color] of [['A','#28d17c'],['B','#a4d65b'],['C','#f0c35a'],['D','#f0b84b']]){
      assert.match(svg,new RegExp(`fill="${color}"[^>]*font-size="76"[^>]*><tspan[^>]*>${grade}</tspan>`));
    }
    const missing=renderScorecardSvg({...model,party,matchConfigured:true,grades:[{value:null},{value:null},{value:null},{value:50}]});
    assert.match(missing,/fill="#a7b0be"[^>]*font-size="25"/);
    assert.match(missing,/fill="#f17881"[^>]*font-size="76"[^>]*><tspan[^>]*>F<\/tspan>/);
  }
});
