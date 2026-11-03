import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const formula=fs.readFileSync(new URL('../public/integrity.js',import.meta.url),'utf8');
const scoreLog=JSON.parse(fs.readFileSync(new URL('../public/score-log.json',import.meta.url),'utf8'));
const migration=JSON.parse(fs.readFileSync(new URL('../public/score-presentation-log.json',import.meta.url),'utf8'));

test('current profile and score navigation expose only the three primary grades',()=>{
  assert.match(app,/const SCORE_PAGES=\[\['match','Your Match'\],\['integrity','Integrity'\],\['pvp','People First'\]/);
  assert.match(app,/\['accountability','Integrity'\]/);
  assert.match(app,/promises:\['integrity','integrity-honesty'\]/);
  assert.match(app,/ethics:\['integrity','integrity-personal-finances'\]/);
  assert.match(app,/grades:\[\{label:'Your Match'[^\]]*\{label:'Integrity'[^\]]*\{label:'People First'/);
  assert.doesNotMatch(app,/\$\{gradeTile\('Promises delivered'/);
  assert.doesNotMatch(app,/\$\{gradeTile\('Ethics'/);
});

test('Integrity view contains component sections and explicit unavailable-data language',()=>{
  for(const id of ['integrity-honesty','integrity-personal-finances','integrity-fundraising','integrity-legal','integrity-method','integrity-history'])assert.ok(app.includes(`id="${id}"`),`${id} exists`);
  assert.match(app,/Missing data is never treated as zero misconduct/);
  assert.match(formula,/Needs two complete components/);
  assert.match(formula,/Sourced Legal Trouble review is missing/);
  assert.match(app,/Selected conduit collection is partial; total remains unknown/);
});

test('historical published grade values are read from their stored percentages, never recomputed',()=>{
  const existing=scoreLog.entries.find(e=>e.scores?.collins?.promises?.pct!=null&&e.scores?.collins?.ethics?.pct!=null);
  assert.ok(existing,'historical Promise and Ethics values exist');
  assert.match(app,/v\.promises\?\.pct\?\?null/);
  assert.match(app,/v\.ethics\?\.pct\?\?null/);
  assert.match(app,/not recalculated or averaged into Integrity/);
});

test('presentation migration is dated separately from monthly comparison data',()=>{
  assert.equal(migration.entries[0].date,'2026-11-02');
  assert.match(migration.entries[0].note,/No historical values or scoring formulas were recalculated/);
  assert.match(migration.entries[0].note,/monthly comparison log continues separately/);
});
