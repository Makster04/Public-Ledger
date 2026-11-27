// The Ideology tab's categories (Nov. 27, 2026): the "Lean on each category" table folded into the category list, so
// each category is one row with its lean bar, number, label and the questions it's based on, and opens to its questions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/remake.css',import.meta.url),'utf8');
const mount=app.slice(app.indexOf('function mountQCats('),app.indexOf('\n}\n',app.indexOf('function mountQCats('))+2);

test('one row a category: bar, number and label, and the questions it is based on',()=>{
  assert.ok(mount.length>100,'mountQCats is in public/app.js');
  assert.match(mount,/class="q-bar st-lean/,'the lean bar');
  assert.match(mount,/<b>\$\{signed\(c\.lean\)\}<\/b>/,'the number');
  assert.match(mount,/leanLabel\(c\.lean\)/,'its label');
  assert.match(mount,/questions?\$\{|question\$\{/,'how many questions it is based on');
  assert.ok(mount.includes('placed'),'"N of M questions placed"');
  assert.ok(mount.includes('with no left–right side'),'and those with no left–right side');
});

test('a category with a record opens to its questions; one without is a row that does not open',()=>{
  assert.match(mount,/<details class="st-more q-cat" data-cat=[^>]*><summary class="q-cat-row">\$\{row\(c\)\}<\/summary>/);
  assert.match(mount,/qTableHTML\(s,c\)/);
  assert.match(mount,/<div class="q-cat q-cat-none"><div class="q-cat-row">/);
  assert.ok(mount.includes('No record yet')&&mount.includes('No left–right question on record'));
});

test('no separate table above the list',()=>{
  assert.ok(app.includes('<h4 class="st-sub">Lean on each category <span class="muted small">(−100 liberal to +100 conservative)</span></h4><div class="q-cats" id="q-cats">'));
  assert.ok(!app.includes('data-qcat'),'the old table rows that opened a category are gone');
  assert.ok(!/\bissueRows\b/.test(app),'nor the rows built for it');
});

test('on a phone the bar and the count go under the name',()=>{
  const phone=css.slice(css.indexOf('.q-cat-row { display: grid'));
  assert.match(phone,/\.q-cat-row \.q-bar \{ grid-column: 2 \/ 4; grid-row: 2; \}/);
  assert.match(phone,/\.q-cat-row \.q-n \{ grid-column: 2 \/ 5; grid-row: 3; \}/);
  assert.match(phone,/\.q-cat-row \.q-pos\.muted \{ grid-column: 2 \/ 4; grid-row: 2;/);
});
