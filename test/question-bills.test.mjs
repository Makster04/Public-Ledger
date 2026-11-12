// Candidate bills for the alignment questions (scripts/question-bills.mjs): how a bill is matched to a question's search.
import test from 'node:test';
import assert from 'node:assert/strict';
import {matches,candidates,phraseRe} from '../scripts/question-bills.mjs';

const bill=(id,o={})=>({id,c:118,n:Number(id.split('-')[2]),title:'',short:[],subjects:[],area:null,summary:null,cosponsors:[],votes:[],...o});
const MW={any:['minimum wage'],subjects:['Wages and earnings'],not:['minimum wage for tipped employees in Guam']};

test('a phrase in the title or a short title is enough; in the summary, only with one of the question\'s subjects',()=>{
  assert.ok(matches(bill('118-hr-1',{title:'Raise the Wage Act',short:['Raise the Minimum Wage Act']}),MW));
  assert.ok(matches(bill('118-hr-2',{title:'A bill on wages',summary:'This bill increases the federal minimum wage.',subjects:['Wages and earnings']}),MW));
  assert.ok(!matches(bill('118-hr-3',{title:'Omnibus',summary:'Section 9 adjusts the minimum wage.',subjects:['Appropriations']}),MW),'in the summary of an unrelated bill: no');
  assert.ok(matches(bill('118-hr-4',{title:'A bill',summary:'Raises the minimum-wage floor.',area:'Wages and earnings'}),MW),'policy area counts as a subject; hyphens and spaces alike');
  assert.ok(!matches(bill('118-hr-5',{title:'Minimum wage for tipped employees in Guam'}),MW),'ruled out by "not"');
  assert.ok(matches(bill('118-hr-6',{summary:'Sets a minimum wage.'}),{any:['minimum wage']}),'no subjects listed: the summary alone is enough');
});

test('phrases match whole words',()=>{
  assert.ok(phraseRe('ICE').test('abolish ice now'));assert.ok(!phraseRe('ice').test('lower drug prices'));
  assert.ok(phraseRe('right to work').test('national right-to-work act'));
});

test('candidates: became law first, then recorded votes, then cosponsors; already-coded ones marked',()=>{
  const list=candidates([
    bill('118-hr-7',{title:'Minimum wage study',cosponsors:[{id:'A'},{id:'B'}]}),
    bill('118-hr-8',{title:'Raise the minimum wage',votes:[{ch:'H',roll:1}]}),
    bill('118-hr-9',{title:'Minimum wage act',law:true}),
    bill('118-hr-10',{title:'Unrelated'})],MW,{'118-hr-8':[0,'Raises it to $17.']});
  assert.deepEqual(list.map(c=>c.id),['118-hr-9','118-hr-8','118-hr-7']);
  assert.deepEqual(list[1].coded,[0,'Raises it to $17.']);assert.equal(list[0].law,true);assert.equal(list[2].cosponsors,2);
});
