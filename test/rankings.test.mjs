// The Rankings page's sorting (public/rankings.js): each score's two boxes, the 70% line between them, ties broken by
// evidence, the filters, and the line under each right-hand box.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RANK,RANK_SCORES,RANK_BY,rankSides,rankingsHTML} from '../public/rankings.js';

const row=(id,scores,extra={})=>({id,name:extra.name||id,party:'D',state:'NY',chamber:'H',cand:false,office:false,officeLabel:'House',scores,n:{},...extra});

test('the six tabs and their box names',()=>{
  assert.deepEqual(RANK_SCORES.map(s=>[s.key,s.left,s.right]),[
    ['ideology','Top 10 Liberal','Top 10 Conservative'],['word','Top 10 Honest','Top 10 Dishonest'],['showsup','Top 10 Stalwarts','Top 10 Slackers'],
    ['unbought','Top 10 Purists','Top 10 Sellouts'],['aboveboard','Top 10 Ethical','Top 10 Unethical'],['peoplefirst','Top 10 for Working People','Top 10 for the Rich']]);
  assert.deepEqual([RANK.size,RANK.cut],[10,70]);
});

test('grades: 70% or higher on the left, highest first; under 70% on the right, lowest first; no score left out of both',()=>{
  const rows=[row('a',{word:95}),row('b',{word:70}),row('c',{word:69}),row('d',{word:20}),row('e',{word:null}),row('f',{})];
  const s=rankSides(rows,RANK_BY.word);
  assert.equal(s.pool,4);
  assert.deepEqual(s.left.top.map(r=>r.id),['a','b']);assert.deepEqual(s.right.top.map(r=>r.id),['d','c']);
});

test('Ideology: the most liberal on the left, the most conservative on the right; moderates at 0 in neither',()=>{
  const rows=[row('l1',{ideology:-100}),row('l2',{ideology:-40}),row('m',{ideology:0}),row('c1',{ideology:60}),row('c2',{ideology:100})];
  const s=rankSides(rows,RANK_BY.ideology);
  assert.deepEqual(s.left.top.map(r=>r.id),['l1','l2']);assert.deepEqual(s.right.top.map(r=>r.id),['c2','c1']);
});

test('ties go to whoever has more evidence, then by name; the box counts the tie; only 10 shown, all on request',()=>{
  const rows=Array.from({length:14},(_,i)=>row(`p${i}`,{peoplefirst:100},{name:`Name ${String(i).padStart(2,'0')}`,n:{peoplefirst:i%3}}));
  const s=rankSides(rows,RANK_BY.peoplefirst);
  assert.equal(s.left.top.length,10);assert.equal(s.left.all.length,14);assert.equal(s.left.tied,14);
  assert.deepEqual(s.left.top.slice(0,4).map(r=>r.n.peoplefirst),[2,2,2,2],'most evidence first');
  const html=rankingsHTML(rows,{key:'peoplefirst'});
  assert.match(html,/14 people tied at 100%; these have the most evidence/);assert.match(html,/See all \(14\)/);
  assert.equal((rankingsHTML(rows,{key:'peoplefirst',open:{left:true}}).match(/class="rk-row"/g)||[]).length,14);
});

test('filters: a state, and Senate, House or candidates (the president only under everyone)',()=>{
  const rows=[row('ny',{showsup:90}),row('oh',{showsup:91},{state:'OH'}),row('sen',{showsup:92},{chamber:'S'}),row('cand',{showsup:93},{cand:true,chamber:'S'}),row('pres',{showsup:94},{office:true,chamber:null})];
  assert.deepEqual(rankSides(rows,RANK_BY.showsup,{state:'OH'}).left.top.map(r=>r.id),['oh']);
  assert.deepEqual(rankSides(rows,RANK_BY.showsup,{who:'S'}).left.top.map(r=>r.id),['sen']);
  assert.deepEqual(rankSides(rows,RANK_BY.showsup,{who:'H'}).left.top.map(r=>r.id).sort(),['ny','oh']);
  assert.deepEqual(rankSides(rows,RANK_BY.showsup,{who:'C'}).left.top.map(r=>r.id),['cand']);
  assert.equal(rankSides(rows,RANK_BY.showsup).pool,5);
});

test('markup: tabs, the score\'s note, "only N" when fewer qualify, the no-wrongdoing line, waiting and empty boxes, escaped names',()=>{
  const rows=[row('x',{word:40},{name:'<b>X</b>',n:{word:5}}),row('y',{word:90})];
  const html=rankingsHTML(rows,{key:'word'},{portraits:{y:{file:'portraits/y.webp'}}});
  assert.match(html,/data-key="word" aria-selected="true">Keeps Their Word/);
  assert.match(html,/Only 1 scores under 70%\./);assert.match(html,/Only 1 scores 70% or higher\./);
  assert.match(html,/Lowest scores on this measure, not a finding of wrongdoing\./);
  assert.ok(html.includes('&lt;b&gt;X&lt;/b&gt;')&&!html.includes('<b>X</b>'));assert.match(html,/5 promises/);
  assert.match(html,/<img class="rk-pic rk-d" src="\/portraits\/y.webp"/);assert.match(html,/<b>40%<\/b><span class="rk-chip gr-F">F<\/span>/);
  assert.match(rankingsHTML([],{key:'unbought'},{loading:true}),/Reading their disclosures…/);
  assert.match(rankingsHTML([],{key:'unbought'}),/It fills in as the refresh reads their disclosures/);
  assert.ok(!rankingsHTML([row('i',{ideology:-50})],{key:'ideology'}).includes('not a finding of wrongdoing'),'Ideology is a position, not a grade');
  assert.match(rankingsHTML([row('i',{ideology:-50})],{key:'ideology'}),/<b>−50<\/b><span class="rk-chip rk-lean rk-lib">Liberal<\/span>/);
});
