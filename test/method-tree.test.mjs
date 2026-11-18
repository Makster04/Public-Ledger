// The Methodology page as a tree (public/method-tree.js, public/app.js methodTree): every section heading the page has
// lands in a branch, and every branch topic still names a heading the page has.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {METHOD_TREE,BUILT_SECTIONS,topicOf,blurbOf} from '../public/method-tree.js';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const page=app.slice(app.indexOf('function renderMethod('),app.indexOf('function methodTrackers('));
const headings=[...page.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m=>m[1].replace(/&amp;/g,'&').trim());

test('every Methodology section has a branch, and nothing lands under "More"',()=>{
  assert.ok(headings.length>=36,`${headings.length} headings read`);
  for(const h of headings)assert.ok(BUILT_SECTIONS.some(b=>h.startsWith(b))||topicOf(h),`"${h}" has no branch`);
});
test('every branch topic names a heading the page has, or one app.js builds',()=>{
  for(const b of METHOD_TREE)for(const t of b.topics){
    if(t.startsWith('@'))assert.ok(app.includes(`built['${t}']`),`${t} is built`);
    else assert.ok(headings.some(h=>h.startsWith(t)),`"${t}" (${b.name}) matches a heading`);
  }
  assert.deepEqual(METHOD_TREE.map(b=>b.name),['The six scores','Money','Votes, bills and positions','The pages','Who and what is covered','Glossary','What changed, and when']);
  // The sections that move: the retired grades and old logs go under "What changed", the trackers under Money.
  assert.ok(METHOD_TREE.find(b=>b.key==='history').topics.includes('@retiredGrades'));
  assert.ok(METHOD_TREE.find(b=>b.key==='money').topics.includes('@trackers'));
  for(const h3 of ['The three primary grades','Outside money by month'])assert.ok(page.includes(`<h3>${h3}`),h3);
});
test('a topic\'s one line: the first sentence, at most 130 characters',()=>{
  assert.equal(blurbOf('Definition: How independent their money is. It doesn\'t measure votes.'),'How independent their money is.');
  assert.ok(blurbOf('x '.repeat(200)).length<=130);
  assert.equal(blurbOf(''),'');
});
