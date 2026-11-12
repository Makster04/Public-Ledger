// The political compass on the Ideology tab (public/compass.js): its two axes from the tab's own issue leans, the
// words, everyone else grouped into bubbles, and the chart.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compassAxes,compassOf,compassWord,compassSpots,compassSvg,signedLean,COMPASS_GROUPS} from '../public/compass.js';
import research from '../public/research.json' with {type:'json'};

const ISSUES=[
  {id:'taxes',label:'Taxes',group:'econ',liberalSide:'A'},{id:'labor',label:'Labor',group:'econ',liberalSide:'A'},
  {id:'climate',label:'Climate',group:'env',liberalSide:'A'},{id:'tariffs',label:'Tariffs',group:'econ',liberalSide:null},
  {id:'abortion',label:'Abortion',group:'rights',liberalSide:'A'},{id:'immigration',label:'Immigration',group:'imm',liberalSide:'B'},
  {id:'ukraine',label:'Ukraine',group:'foreign',liberalSide:'A'}];
const vote=(side,bill)=>({type:'senate_vote',side,bill});

test('the axes: economic and climate issues across, rights and immigration up and down; issues splitting both parties on neither',()=>{
  assert.deepEqual(compassAxes(ISSUES),{econ:['taxes','labor','climate'],social:['abortion','immigration']});
  assert.deepEqual(COMPASS_GROUPS,{econ:['econ','env'],social:['rights','imm']});
  // the real issue list: every left–right issue is on one axis or none, never both
  const a=compassAxes(research.issues);
  assert.ok(a.econ.includes('taxes')&&a.econ.includes('health')&&a.social.includes('abortion')&&a.social.includes('immigration'));
  assert.equal(a.econ.filter(i=>a.social.includes(i)).length,0);
  for(const i of research.issues.filter(i=>!i.liberalSide))assert.ok(!a.econ.includes(i.id)&&!a.social.includes(i.id),i.id);
});

test('a place is the average of the tab\'s issue leans on each axis (one credit per bill), placed with one issue',()=>{
  const person={evidence:{
    taxes:[vote('A','b1'),vote('A','b1'),vote('B','b2')],   // one credit per bill: A once, B once -> 0
    labor:[vote('B','b3')],                                 // +100
    climate:[{type:'stated',side:'A'}],                     // statements alone: -100
    tariffs:[vote('A','b4')],                               // splits both parties: on no axis
    immigration:[vote('A','b5'),vote('A','b6'),vote('B','b7'),vote('A','b8')]}}; // liberal side B: (3-1)/4 -> +50
  const c=compassOf(person,ISSUES);
  assert.equal(c.x,0,'(0 + 100 - 100) / 3');assert.equal(c.nx,3);
  assert.equal(c.y,50);assert.equal(c.ny,1);
  assert.deepEqual(c.social,[{id:'immigration',label:'Immigration',lean:50,n:4}]);
  const none=compassOf({evidence:{taxes:[vote('A','x')]}},ISSUES);
  assert.equal(none.x,-100);assert.equal(none.y,null,'no social issue: not placed up and down');assert.equal(none.ny,0);
  assert.deepEqual(compassOf({},ISSUES),{x:null,y:null,nx:0,ny:0,econ:[],social:[]});
});

test('the words: within 20 of the middle is the middle',()=>{
  assert.equal(compassWord(-100,'econ'),'left');assert.equal(compassWord(38,'econ'),'right');assert.equal(compassWord(20,'econ'),'center');assert.equal(compassWord(-20,'econ'),'center');
  assert.equal(compassWord(-25,'social'),'liberal');assert.equal(compassWord(100,'social'),'conservative');assert.equal(compassWord(0,'social'),'moderate');
  assert.equal(compassWord(null,'social'),'not placed yet');
  assert.equal(signedLean(38),'+38');assert.equal(signedLean(-25),'−25');assert.equal(signedLean(0),'0');assert.equal(signedLean(null),'—');
});

const P=(id,party,x,y)=>({id,name:`Member ${id}`,short:id,party,state:'ME',x,y});
const LIST=[P('a','D',-100,-100),P('b','D',-100,-100),P('c','D',-100,-100),P('d','R',100,100),P('e','I',-100,-100),P('f','R',0,50),P('g','R',null,50),P('me','R',0,-25)];

test('everyone else in bubbles: by party and spot, the biggest first; the person and anyone not placed left out',()=>{
  const sp=compassSpots(LIST,'me');
  assert.deepEqual(sp.map(s=>[s.party,s.x,s.y,s.people.length]),[['D',-100,-100,3],['R',100,100,1],['I',-100,-100,1],['R',0,50,1]]);
  assert.equal(compassSpots([P('x','L',10,10)],'me')[0].party,'I','another party is drawn as independent');
});

test('the chart: drawn at its size, quadrants and labels, a lone member linked to their profile, the person\'s portrait',()=>{
  const svg=compassSvg({me:{id:'me',name:'Pat Example',short:'Example',party:'R'},place:{x:0,y:-25},list:LIST,size:420,portrait:'/portraits/me.jpg'});
  assert.match(svg,/viewBox="0 0 420 420" width="420" height="420"/);
  for(const t of ['Socially conservative','Socially liberal','Economic left','Economic right'])assert.ok(svg.includes(`>${t}</text>`),t);
  assert.equal((svg.match(/class="cmp-q /g)||[]).length,4);
  assert.match(svg,/<a href="#d-ideology"><circle class="cmp-b cmp-R"/);
  assert.match(svg,/3 Democrats at economic −100, social −100: a, b, c/);
  assert.match(svg,/<image href="\/portraits\/me.jpg"/);assert.match(svg,/>Example<\/text>/);
  assert.ok(!svg.includes('cmp-me-here'),'no one else at their spot');
  // counts only on bubbles of 10 or more
  assert.ok(!svg.includes('cmp-count'));
  const many=Array.from({length:12},(_,i)=>P('m'+i,'D',-100,-100));
  const big=compassSvg({me:{id:'me',name:'Pat',party:'D'},place:{x:-100,y:-100},list:many,size:500});
  assert.match(big,/class="cmp-count"[^>]*>12</);assert.match(big,/>and 12 others</,'the others under the portrait are counted');
  // not placed: no portrait; names escaped
  const off=compassSvg({me:{id:'me',name:'A <b>',party:'D'},place:{x:null,y:10},list:[],size:300});
  assert.ok(!off.includes('cmp-me"')&&!off.includes('<b>'));
});
